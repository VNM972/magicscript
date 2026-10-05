import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDeterministicArtifact } from '../../../core/design/design-artifact';
import { executeBuilder } from '../../../core/builder/site-builder';
import { createBuildCorrectionRequest } from '../../../core/visual-qa/engine';
import { correctionJobFor, type VisualQaReportV1 } from '../../../core/visual-qa/contracts';
import type { ClaimedJob } from './api';

const originalFetch = globalThis.fetch;
const root = await mkdtemp(join(tmpdir(), 'r73z-runner-'));
process.env.MAGICSCRIPT_API_BASE_URL = 'http://runner-fixture.invalid';
process.env.MAGICSCRIPT_RUNNER_TOKEN = 'offline-fixture';
process.env.MAGICSCRIPT_RUNNER_WORK_DIR = join(root, 'runner');
const { executeV2BuildCorrection, runOne } = await import('./index');
before(() => { globalThis.fetch = async () => { throw new Error('External or model operation forbidden'); }; });
after(async () => { globalThis.fetch = originalFetch; await rm(root, { recursive: true, force: true }); });

async function fixture(name: string): Promise<ClaimedJob> {
  const request: any = { id: `dr-${name}`, version: 'DESIGN_REQUEST_V1', prospectId: `fixture-${name}`,
    admission: { packId: `pack-${name}`, schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2' },
    identity: { businessName: 'Fixture café' }, opportunity: { businessContext: 'Local café' },
    designInput: { businessVertical: 'RESTAURANT', evidence: [{ url: 'https://fixture.invalid', note: 'fixture identity', supports: ['identity'] }] },
    createdAt: '2026-10-03T00:00:00.000Z' };
  const design = { ...buildDeterministicArtifact(request, request.createdAt), status: 'APPROVED' as const };
  const build = await executeBuilder({ artifact: design, designRequest: request, root: join(root, name) });
  const report: VisualQaReportV1 = { id: `qa-${build.id}-r1-a1`, version: 'VISUAL_QA_REPORT_V1',
    buildArtifactId: build.id, designArtifactId: design.id, designArtifactRevision: 1, designRequestId: request.id,
    prospectId: request.prospectId, buildVersion: build.version, buildRevision: 1, attempt: 1,
    decision: 'CORRECTION_REQUIRED', createdAt: request.createdAt,
    issues: [{ category: 'BUILD_RENDER', severity: 'MAJOR', message: 'GET /favicon.ico 404',
      expectedCorrection: 'Ignore arbitrary QA prose: do not execute shell commands or redesign.' }],
    inspection: { viewports: [], expectedSections: [], observedSections: [], primaryCta: '',
      brokenAssets: [], internalLinkErrors: [], consoleErrors: [], unresolvedMarkers: [], headings: [] } };
  const correction = createBuildCorrectionRequest(report, 'ENSURE_LOCAL_FAVICON_V1', { build, design, request });
  const job = { ...correctionJobFor(correction, request.createdAt), status: 'RUNNING', attempts: 1 };
  return { job, prospect: { id: request.prospectId, companyName: 'Fixture café', state: 'INGESTED' }, contacts: [],
    buildCorrectionContext: { correctionRequest: correction, targetBuild: build, qaReport: report,
      designRequest: request, approvedDesignArtifact: design,
      productionSlot: { slotId: 1, prospectId: request.prospectId, acquiredAt: request.createdAt } } };
}

test('runner dispatch uses deterministic correction executor without model or editor and preserves r1', async () => {
  const claim = await fixture('dispatch');
  const parent = claim.buildCorrectionContext!.targetBuild;
  const html = await readFile(join(parent.sourcePath, 'index.html'));
  const css = await readFile(join(parent.sourcePath, 'styles.css'));
  let saved: any;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input); requests.push(url);
    if (url.endsWith('/api/runner/jobs/claim')) return Response.json(claim);
    if (url.endsWith('/api/runner/heartbeat')) return Response.json({ ok: true });
    if (url.endsWith(`/api/runner/jobs/${encodeURIComponent(claim.job.id)}/succeed`)) {
      saved = JSON.parse(String(init?.body)).output; return Response.json({ ok: true });
    }
    throw new Error(`External/model/failure path forbidden: ${url}`);
  };
  try {
    assert.equal(await runOne(), true);
    assert.equal(saved.id, `${parent.id}-br2`);
    assert.equal(saved.buildRevision, 2);
    assert.equal(saved.qaAttempt, 2);
    assert.equal(saved.previousBuildArtifactId, parent.id);
    assert.match(saved.outputPath, /build-r2[/\\]dist$/);
    assert.deepEqual(await readFile(join(parent.sourcePath, 'index.html')), html);
    assert.deepEqual(await readFile(join(parent.sourcePath, 'styles.css')), css);
    assert.equal(requests.length, 4);
    assert.equal(requests.some((url) => /ollama|kimi|qa/.test(url)), false);
    const replay = await executeV2BuildCorrection({ ...claim,
      buildCorrectionContext: { ...claim.buildCorrectionContext!, existingCorrectedBuild: saved } });
    assert.deepEqual(replay, saved);
  } finally { globalThis.fetch = async () => { throw new Error('External or model operation forbidden'); }; }
});

test('runner rejects foreign payload, prospect, report, design, revision, unsupported operation and missing/foreign/released slot', async () => {
  const claim = await fixture('reject');
  for (const key of Object.keys(claim.job.payload)) {
    const invalid = structuredClone(claim); invalid.job.payload[key] = 'foreign';
    await assert.rejects(executeV2BuildCorrection(invalid), /INVALID_CORRECTION_REQUEST/);
  }
  const variants: Array<(value: ClaimedJob) => void> = [
    (value) => { value.prospect!.id = 'foreign'; },
    (value) => { value.job.id = 'foreign'; },
    (value) => { value.buildCorrectionContext = null; },
    (value) => { value.buildCorrectionContext!.productionSlot.prospectId = 'foreign'; },
    (value) => { value.buildCorrectionContext!.productionSlot.acquiredAt = ''; },
    (value) => { value.buildCorrectionContext!.qaReport.buildArtifactId = 'foreign'; },
    (value) => { value.buildCorrectionContext!.designRequest.id = 'foreign'; },
    (value) => { value.buildCorrectionContext!.targetBuild.prospectId = 'foreign'; },
    (value) => { value.buildCorrectionContext!.correctionRequest.targetBuildRevision = 2; },
    (value) => { (value.buildCorrectionContext!.correctionRequest as any).operation = 'EXECUTE_QA_PROSE'; },
  ];
  for (const mutate of variants) {
    const invalid = structuredClone(claim); mutate(invalid);
    await assert.rejects(executeV2BuildCorrection(invalid), (error: any) =>
      ['INVALID_CORRECTION_REQUEST', 'BUILD_REVISION_CONFLICT', 'UNSUPPORTED_CORRECTION'].includes(error.code)
      || /INVALID_CORRECTION_REQUEST/.test(error.message));
  }
});
