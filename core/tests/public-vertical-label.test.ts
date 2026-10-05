import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DesignRequestV1, DesignVertical } from '../design/design-request';
import { buildDeterministicArtifact } from '../design/design-artifact';
import { executeBuilder, executeBuildCorrection, filesHash, InMemoryBuildArtifactStore } from '../builder/site-builder';
import { BuilderError, deterministicFaviconBytes, ensureLocalFaviconHtml, normalizePublicVerticalLabelHtml, publicVerticalLabel } from '../builder/contracts';
import { createBuildCorrectionRequest, executeVisualQa } from '../visual-qa/engine';
import { correctionJobFor } from '../visual-qa/contracts';

const heroStart = '<section class="hero" aria-labelledby="hero-title"><p class="eyebrow">';
const verticals: DesignVertical[] = ['GENERAL_LOCAL_BUSINESS', 'RESTAURANT', 'BEAUTY', 'LOCAL_SERVICE'];

test('public vertical labels are exhaustive, neutral and preserve existing public copy', () => {
  for (const vertical of verticals) {
    const html = `<main>${heroStart}${vertical}</p><h1>Verified name</h1></section><p>Valid $& copy</p></main>`;
    const corrected = normalizePublicVerticalLabelHtml(html, vertical);
    assert.equal(corrected, html.replace(`${heroStart}${vertical}</p>`, `${heroStart}${publicVerticalLabel(vertical)}</p>`));
    assert.equal(normalizePublicVerticalLabelHtml(corrected, vertical), corrected);
    const valid = html.replace(`${heroStart}${vertical}</p>`, `${heroStart}Une offre vérifiée</p>`);
    assert.equal(normalizePublicVerticalLabelHtml(valid, vertical), valid);
  }
  assert.equal(publicVerticalLabel('GENERAL_LOCAL_BUSINESS'), 'Entreprise locale');
  assert.throws(() => normalizePublicVerticalLabelHtml(`${heroStart}BEAUTY</p>`, 'GENERAL_LOCAL_BUSINESS'), BuilderError);
  assert.throws(() => normalizePublicVerticalLabelHtml('<p>GENERAL_LOCAL_BUSINESS</p>', 'GENERAL_LOCAL_BUSINESS'), BuilderError);
  assert.throws(() => normalizePublicVerticalLabelHtml(`${heroStart}GENERAL_LOCAL_BUSINESS</p>`.repeat(2), 'GENERAL_LOCAL_BUSINESS'), BuilderError);
  assert.throws(() => publicVerticalLabel('UNSUPPORTED' as DesignVertical), BuilderError);
});

test('generic builder and immutable correction preserve internal vertical, reject foreign context and retain favicon r3', async () => {
  const root = await mkdtemp(join(tmpdir(), 'r78z-public-label-'));
  for (const vertical of verticals) {
    const request: DesignRequestV1 = { id: `dr-label-${vertical}`, version: 'DESIGN_REQUEST_V1', prospectId: `fixture-label-${vertical}`, admission: { packId: `pack-${vertical}`, schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2' }, identity: { businessName: 'Identité vérifiée' }, opportunity: {}, designInput: { businessVertical: vertical, evidence: [] }, createdAt: '2026-10-04T00:00:00.000Z' };
    const design = { ...buildDeterministicArtifact(request, request.createdAt), status: 'APPROVED' as const };
    const generated = await executeBuilder({ artifact: design, designRequest: request, root });
    const html = await readFile(join(generated.sourcePath, 'index.html'), 'utf8');
    assert(html.includes(`${heroStart}${publicVerticalLabel(vertical)}</p>`));
    assert(!html.includes(`${heroStart}${vertical}</p>`));
    if (vertical === 'GENERAL_LOCAL_BUSINESS') assert(!html.includes(vertical));
    assert.equal(design.verticalProfile, vertical);
    assert.equal(request.designInput.businessVertical, vertical);
    const designBefore = structuredClone(design); const requestBefore = structuredClone(request);
    // Reproduce the pre-fix immutable build without changing the approved design.
    const oldHtml = html.replace(`${heroStart}${publicVerticalLabel(vertical)}</p>`, `${heroStart}${vertical}</p>`);
    await writeFile(join(generated.sourcePath, 'index.html'), oldHtml);
    await writeFile(join(generated.outputPath, 'index.html'), oldHtml);
    const r1 = { ...generated, sourceHash: await filesHash(generated.sourcePath) };
    const store = new InMemoryBuildArtifactStore(); await store.save(r1);
    const evidence = { viewports: [], observedSections: design.buildGuidance.sectionOrder, unresolvedMarkers: [vertical], consoleErrors: ['GET /favicon.ico 404'] };
    const qa1 = await executeVisualQa({ build: r1, design, request, evidence });
    const correction = createBuildCorrectionRequest(qa1, 'NORMALIZE_PUBLIC_VERTICAL_LABEL_V1', { build: r1, design, request }, qa1.issues.find(i => i.category === 'PLACEHOLDER'));
    assert.equal(correctionJobFor(correction).payload.nextBuildRevision, 2);
    const context = { request: correction, targetBuild: r1, qaReport: qa1, designRequest: request, approvedDesignArtifact: design };
    const r1Files = Object.fromEntries(await Promise.all((await readdir(r1.sourcePath)).map(async n => [n, (await readFile(join(r1.sourcePath, n))).toString('base64')])));
    const r2 = await executeBuildCorrection({ ...context, store });
    assert.equal(r2.id, `${r1.id}-br2`); assert.equal(r2.buildRevision, 2); assert.equal(r2.qaAttempt, 2); assert.equal(r2.approvedRevision, 1);
    assert.equal(r2.previousBuildArtifactId, r1.id); assert.notEqual(r2.sourcePath, r1.sourcePath);
    assert.equal(await readFile(join(r2.outputPath, 'index.html'), 'utf8'), html);
    assert.deepEqual(await readFile(join(r2.outputPath, 'styles.css')), await readFile(join(r1.sourcePath, 'styles.css')));
    assert(!((await readdir(r2.outputPath)).includes('favicon.ico')));
    assert.deepEqual(await executeBuildCorrection({ ...context, store }), r2);
    assert.deepEqual(await store.get(r1.id), r1);
    for (const [n, bytes] of Object.entries(r1Files)) assert.equal((await readFile(join(r1.sourcePath, n))).toString('base64'), bytes);
    assert.deepEqual(design, designBefore); assert.deepEqual(request, requestBefore);
    for (const altered of [
      { ...context, request: { ...correction, prospectId: 'foreign' } },
      { ...context, qaReport: { ...qa1, buildArtifactId: 'foreign' } },
      { ...context, approvedDesignArtifact: { ...design, prospectId: 'foreign' } },
      { ...context, designRequest: { ...request, id: 'foreign' } },
      { ...context, request: { ...correction, nextBuildRevision: 3 } },
      { ...context, request: { ...correction, issue: qa1.issues.find(i => i.category === 'BUILD_RENDER')! } },
      { ...context, qaReport: { ...qa1, inspection: { ...qa1.inspection, unresolvedMarkers: [] } } },
    ]) await assert.rejects(() => executeBuildCorrection(altered), BuilderError);
    const qa2 = await executeVisualQa({ build: r2, design, request, evidence: { ...evidence, unresolvedMarkers: [] } });
    const favicon = createBuildCorrectionRequest(qa2, 'ENSURE_LOCAL_FAVICON_V1', { build: r2, design, request });
    const r3 = await executeBuildCorrection({ ...context, request: favicon, targetBuild: r2, qaReport: qa2, store });
    assert.equal(r3.buildRevision, 3); assert.equal(r3.qaAttempt, 3);
    assert.equal(await readFile(join(r3.outputPath, 'index.html'), 'utf8'), ensureLocalFaviconHtml(html));
    assert.deepEqual(await readFile(join(r3.outputPath, 'favicon.ico')), Buffer.from(deterministicFaviconBytes()));
    assert.deepEqual(await store.get(r1.id), r1);
  }
});
