import fs from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildDeterministicArtifact } from '../core/design/design-artifact.ts';
import { executeBuilder, InMemoryBuildArtifactStore } from '../core/builder/site-builder.ts';
import { createBuildCorrectionRequest, executeVisualQa } from '../core/visual-qa/engine.ts';
import { InMemoryBuildCorrectionStore, InMemoryVisualQaReportStore } from '../core/visual-qa/contracts.ts';
import { runBrowserQa } from './m007-browser-qa.cjs';

const root = resolve('artifacts/v2');
const buildRoot = join(root, 'sites');
const evidenceRoot = join(root, 'm007r-acceptance');
const knownGoodDist = join(buildRoot, 'prospect-m007-cafe', 'artifact-dr-m007-cafe-design_request_v1-design_artifact_v1-r1', 'dist');
const defectRoot = join(evidenceRoot, 'defect-fixture');
const reportPath = join(evidenceRoot, 'final-acceptance.json');
const request: any = { id: 'dr-m007-cafe-DESIGN_REQUEST_V1', version: 'DESIGN_REQUEST_V1', prospectId: 'prospect-m007-cafe', admission: { packId: 'pack-m007-cafe', schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2' }, identity: { businessName: 'Café Rivage' }, opportunity: { businessContext: 'Local café' }, designInput: { businessVertical: 'RESTAURANT', evidence: [{ url: 'https://example.test', note: 'verified identity', supports: ['identity'] }] }, createdAt: '2026-01-01T00:00:00.000Z' };
const now = () => new Date();
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
function browserEvidenceToQaEvidence(value: any, overflowOverride?: number) { return { viewports: value.viewports.map((item: any) => ({ name: item.viewport.width === 1440 ? 'DESKTOP' : 'MOBILE', width: item.viewport.width, height: item.viewport.height, horizontalOverflow: overflowOverride ?? item.viewport.horizontalOverflow, heroVisible: item.viewport.heroVisible, primaryCtaVisible: item.viewport.primaryCtaVisible, contentVisible: item.viewport.contentVisible, controlsWithinViewport: item.viewport.controlsWithinViewport })), observedSections: ['hero', 'menu-or-offer', 'visit-information', 'location-and-contact'], brokenAssets: [], internalLinkErrors: [], consoleErrors: [], unresolvedMarkers: [], headings: ['h1 Café Rivage'] }; }
async function main() {
  const design: any = { ...buildDeterministicArtifact(request, request.createdAt), status: 'APPROVED' as const };
  const buildStore = new InMemoryBuildArtifactStore();
  const build = await executeBuilder({ artifact: design, designRequest: request, root: buildRoot, store: buildStore });
  assert(build.status === 'SUCCEEDED' && build.version === 'BUILD_ARTIFACT_V1', 'M006 Builder did not produce BUILD_ARTIFACT_V1');
  assert(build.outputPath === knownGoodDist && fs.existsSync(join(knownGoodDist, 'index.html')), 'actual M006 dist verification failed');
  const replayBuild = await executeBuilder({ artifact: design, designRequest: request, root: buildRoot, store: buildStore });
  assert(replayBuild.id === build.id && (await buildStore.list()).length === 1, 'Builder replay is not idempotent');
  await rm(evidenceRoot, { recursive: true, force: true }); await mkdir(evidenceRoot, { recursive: true });
  const good = await runBrowserQa({ root: knownGoodDist, outputDir: join(evidenceRoot, 'known-good'), primaryCta: design.strategy.primaryCta, viewports: ['DESKTOP', 'MOBILE'] });
  const goodQaEvidence: any = browserEvidenceToQaEvidence(good);
  const qaStore = new InMemoryVisualQaReportStore(); const correctionStore = new InMemoryBuildCorrectionStore();
  const goodReport = await executeVisualQa({ build, design, request, evidence: goodQaEvidence, attempt: 1, now, store: qaStore });
  if (goodReport.decision !== 'PASS') { console.error(JSON.stringify({goodQaEvidence, issues: goodReport.issues}, null, 2)); throw new Error(`known-good browser evidence did not PASS: ${goodReport.decision}`); }
  await cp(knownGoodDist, defectRoot, { recursive: true }); await writeFile(join(defectRoot, 'styles.css'), `${await readFile(join(defectRoot, 'styles.css'), 'utf8')}\nbody{min-width:500px}\n`);
  const defect = await runBrowserQa({ root: defectRoot, outputDir: join(evidenceRoot, 'defect'), primaryCta: design.strategy.primaryCta, viewports: ['MOBILE'] });
  const defectQaEvidence: any = browserEvidenceToQaEvidence(defect, defect.viewports[0].viewport.horizontalOverflow);
  assert(defect.viewports[0].viewport.horizontalOverflow > 1, 'injected overflow was not observed by browser');
  const defectReport = await executeVisualQa({ build, design, request, evidence: defectQaEvidence, attempt: 1, now });
  assert(defectReport.decision === 'CORRECTION_REQUIRED' && defectReport.issues.some((issue) => issue.category === 'RESPONSIVE_LAYOUT'), 'browser defect did not produce RESPONSIVE_LAYOUT CORRECTION_REQUIRED');
  const correction = createBuildCorrectionRequest(defectReport); await correctionStore.save(correction); await correctionStore.save(correction); assert((await correctionStore.list()).length === 1, 'correction persistence replay duplicated');
  const correctedDesign: any = { ...design, id: `artifact-${request.id}-DESIGN_ARTIFACT_V1-r2`, revision: 2, createdAt: now() };
  const correctedBuild = await executeBuilder({ artifact: correctedDesign, designRequest: request, root: buildRoot, store: buildStore });
  assert(correctedBuild.status === 'SUCCEEDED' && correctedBuild.approvedRevision === 2, 'Builder correction rebuild failed');
  const corrected = await runBrowserQa({ root: correctedBuild.outputPath, outputDir: join(evidenceRoot, 'corrected'), primaryCta: correctedDesign.strategy.primaryCta, viewports: ['DESKTOP', 'MOBILE'] });
  const correctedReport = await executeVisualQa({ build: correctedBuild, design: correctedDesign, request, evidence: browserEvidenceToQaEvidence(corrected), attempt: 1, now, store: qaStore });
  assert(correctedReport.decision === 'PASS', `corrected browser evidence did not PASS: ${correctedReport.decision}`);
  const replayReport = await executeVisualQa({ build, design, request, evidence: goodQaEvidence, attempt: 1, now, store: qaStore }); assert(replayReport.id === goodReport.id && (await qaStore.list()).length === 2, 'QA replay is not idempotent');
  const limitEvidence = { ...defectQaEvidence, unresolvedMarkers: ['debug'] }; const limit = [1, 2, 3].map(() => 0);
  const limitReports = []; for (let i = 1; i <= 3; i += 1) limitReports.push(await executeVisualQa({ build, design, request, evidence: limitEvidence, attempt: i, now }));
  assert(limitReports.map((report) => report.decision).join(',') === 'CORRECTION_REQUIRED,CORRECTION_REQUIRED,VISUAL_QA_LIMIT_REACHED', 'QA attempt limit behavior failed');
  const final = { status: 'PASS', browser: good.browser, build: { id: build.id, outputPath: build.outputPath, correctedId: correctedBuild.id }, previewUrls: { knownGood: good.previewUrl, defect: defect.previewUrl, corrected: corrected.previewUrl }, decisions: { knownGood: goodReport.decision, defect: defectReport.decision, corrected: correctedReport.decision, limit: limitReports.map((report) => report.decision) }, defect: { horizontalOverflow: defect.viewports[0].viewport.horizontalOverflow, category: defectReport.issues[0]?.category }, persistence: { qaReports: (await qaStore.list()).map((report) => report.id), corrections: (await correctionStore.list()).map((item) => item.id), correctionCount: (await correctionStore.list()).length }, screenshots: { desktop: good.viewports.find((item: any) => item.viewport.name === 'DESKTOP')?.screenshotPath, mobile: good.viewports.find((item: any) => item.viewport.name === 'MOBILE')?.screenshotPath, defect: defect.viewports[0].screenshotPath, correctedDesktop: corrected.viewports[0].screenshotPath, correctedMobile: corrected.viewports[1].screenshotPath }, m006Regression: { initialBuildSucceeded: true, replayStable: true, buildStoreCount: (await buildStore.list()).length } };
  await writeFile(reportPath, `${JSON.stringify(final, null, 2)}\n`); console.log(JSON.stringify(final, null, 2));
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
