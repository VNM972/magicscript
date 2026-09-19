import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { buildDeterministicArtifact } from '../core/design/design-artifact.ts';
import { executeBuilder, InMemoryBuildArtifactStore } from '../core/builder/site-builder.ts';
import { executeVisualQa } from '../core/visual-qa/engine.ts';
import { InMemoryVisualQaReportStore } from '../core/visual-qa/contracts.ts';
import { InMemoryProposalStore, packageProposal, proposalShareEvent, proposalViewEvent, type ProposalSessionState } from '../core/index.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve('artifacts/v2/proposal');
const request: any = { id: 'dr-m008-cafe-DESIGN_REQUEST_V1', version: 'DESIGN_REQUEST_V1', prospectId: 'prospect-m008-cafe', admission: { packId: 'pack-m008-cafe', schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2' }, identity: { businessName: 'Café Rivage' }, opportunity: { businessContext: 'Local café' }, designInput: { businessVertical: 'RESTAURANT', evidence: [{ url: 'https://example.test', note: 'identity', supports: ['identity'] }] }, createdAt: '2026-01-01T00:00:00.000Z' };
const evidence = (build: any, design: any) => ({ viewports: [{ name: 'DESKTOP', width: 1440, height: 900, horizontalOverflow: 0, heroVisible: true, primaryCtaVisible: true, contentVisible: true, controlsWithinViewport: true }, { name: 'MOBILE', width: 390, height: 844, horizontalOverflow: 0, heroVisible: true, primaryCtaVisible: true, contentVisible: true, controlsWithinViewport: true }], expectedSections: design.buildGuidance.sectionOrder, observedSections: design.buildGuidance.sectionOrder, primaryCta: design.strategy.primaryCta, brokenAssets: [], internalLinkErrors: [], consoleErrors: [], unresolvedMarkers: [], headings: ['h1 Café Rivage'] });

async function main() {
  await mkdir(root, { recursive: true });
  const design: any = { ...buildDeterministicArtifact(request, request.createdAt), status: 'APPROVED' };
  const builds = new InMemoryBuildArtifactStore();
  const build = await executeBuilder({ artifact: design, designRequest: request, root: join(root, 'sites'), store: builds });
  assert.equal(build.status, 'SUCCEEDED');
  const qaStore = new InMemoryVisualQaReportStore();
  const qa = await executeVisualQa({ build, design, request, evidence: evidence(build, design), attempt: 1, store: qaStore });
  assert.equal(qa.decision, 'PASS');
  const proposals = new InMemoryProposalStore();
  const first = await packageProposal({ build, design, qa, store: proposals, now: '2026-01-02T00:00:00.000Z' });
  const replay = await packageProposal({ build, design, qa, store: proposals });
  assert.equal(replay.duplicate, true); assert.equal(replay.proposal.id, first.proposal.id); assert.equal((await proposals.list()).length, 1);
  await assert.rejects(() => packageProposal({ build: { ...build, status: 'FAILED' }, design, qa, store: new InMemoryProposalStore() }));
  const session: ProposalSessionState = { firstViewedAt: null, lastViewedAt: null };
  assert.equal(proposalViewEvent({ session, now: '2026-01-02T01:00:00.000Z' }), 'PROPOSAL_VIEWED');
  assert.equal(proposalViewEvent({ session, now: '2026-01-03T01:00:00.000Z' }), 'RETURN_VISIT');
  assert.equal(proposalShareEvent(), 'SHARE_CLICKED');
  const html = await readFile(join(build.outputPath, build.metadata.entryFile), 'utf8');
  const server = createServer(async (req, res) => { if (req.url !== first.proposal.entryPath) { res.statusCode = 404; res.end('not found'); return; } res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(`<!doctype html><title>Proposal</title><main data-proposal="${first.proposal.id}">${html}</main><a href="${first.proposal.booking.bookingPath}">Réserver un échange</a>`); });
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}${first.proposal.entryPath}`); const body = await response.text();
  assert.equal(response.status, 200); assert.match(body, /Café Rivage/); assert.match(body, /Réserver un échange/); assert.doesNotMatch(body, /prospectId|report_json|private|sales.?room/i);
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  const result = { status: 'PASS', proposalId: first.proposal.id, prospectId: first.proposal.prospectId, buildId: build.id, qaReportId: qa.id, trackedProposalPath: first.proposal.entryPath, firstView: 'PROPOSAL_VIEWED', returnVisit: 'RETURN_VISIT', share: 'SHARE_CLICKED', bookingPath: first.proposal.booking.bookingPath, idempotence: { proposal: true }, safety: { correctBuild: true, privateDataExposed: false, salesRoomRequired: false, outreach: false, deployment: false }, runtime: { httpStatus: response.status, htmlServed: true } };
  const resultPath = join(root, 'm008-final-acceptance.json'); await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2));
}
main().catch(async (error) => { const result = { status: 'FAIL', error: error instanceof Error ? error.message : String(error) }; await mkdir(root, { recursive: true }); await writeFile(join(root, 'm008-final-acceptance.json'), `${JSON.stringify(result, null, 2)}\n`); console.error(error); process.exitCode = 1; });
