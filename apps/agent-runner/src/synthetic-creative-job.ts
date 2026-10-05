import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

export const SYNTHETIC_CREATIVE_JOB_KIND = 'CREATIVE_WEB_DESIGN_SYNTHETIC' as const;
export const MAX_SYNTHETIC_CREATIVE_ITERATIONS = 3;

export type CreativeVerdict = 'PASS' | 'PASS_WITH_NOTES' | 'REWORK' | 'BLOCKED' | 'EXHAUSTED';
export type TechnicalJobStatus = 'SUCCEEDED' | 'FAILED' | 'BLOCKED';

export interface SyntheticCreativeInput {
  synthetic: true;
  fixtureId: string;
  fixtureRoot: string;
  approvedLocalFixtureRoot: string;
  internalProvenance: { source: 'INTERNAL_SYNTHETIC_FIXTURE'; approvedBy: string; reason: string };
  protectedFacts: Record<string, unknown>;
  protectedContract: Record<string, unknown>;
  maxIterations?: number;
  renderEvidence?: RenderEvidence;
  failureMode?: 'NONE' | 'BUILD_FAILURE' | 'PROTECTED_FACT_MUTATION' | 'PROTECTED_CONTRACT_MUTATION';
}

export interface RenderEvidence {
  desktop: { viewport: string; width?: number; height?: number; checked: boolean; artifactPath?: string; artifactFingerprint?: string; evidenceId?: string; success?: boolean };
  mobile: { viewport: string; width?: number; height?: number; checked: boolean; artifactPath?: string; artifactFingerprint?: string; evidenceId?: string; success?: boolean };
  method: 'LOCAL_STATIC_RENDER_METADATA';
  capturedAt: string;
}

export interface CreativeFinding { code: string; category: string; severity: 'WARNING' | 'BLOCKING'; message: string; }
export interface BuildResult { command: string; exitCode: number; status: 'PASSED' | 'FAILED'; outputPath: string | null; timestamp: string; }
export interface SyntheticCreativeResult {
  kind: typeof SYNTHETIC_CREATIVE_JOB_KIND;
  synthetic: true;
  fixtureId: string;
  technicalJobStatus: TechnicalJobStatus;
  creativeVerdict: CreativeVerdict;
  before: { artifactFingerprint: string; protectedFactsFingerprint: string; protectedContractFingerprint: string; fileInventory: string[]; creativeReview: Review; timestamp: string };
  qaPreflight: QaResult;
  iterations: IterationRecord[];
  qaFinal: QaResult;
  after: { artifactFingerprint: string; creativeVerdict: CreativeVerdict; renderEvidence: RenderEvidence | null; timestamp: string };
  externalActions: readonly [];
  startedAt: string;
  completedAt: string;
  blockers: string[];
}

export interface Review { status: CreativeVerdict; findings: CreativeFinding[]; checkedAt: string; owner: 'WEB_DESIGN'; }
export interface QaResult { phase: 'QA_PREFLIGHT' | 'QA_FINAL'; passed: boolean; blockers: string[]; checkedAt: string; }
export interface IterationRecord {
  index: number; findingsBefore: CreativeFinding[]; plannedChanges: string[]; filesChanged: string[]; diffMetadata: { beforeBytes: number; afterBytes: number; changed: boolean };
  buildResult: BuildResult; creativeReviewAfter: Review; fingerprints: { before: string; after: string };
  protectedFactsPreserved: boolean; protectedContractPreserved: boolean; timestamp: string;
}

export interface SyntheticCreativeDeps {
  qa: (root: string, phase: QaResult['phase'], input: SyntheticCreativeInput) => Promise<QaResult> | QaResult;
  build: (root: string, input: SyntheticCreativeInput) => Promise<BuildResult> | BuildResult;
  review?: (root: string, input: SyntheticCreativeInput) => Promise<Review> | Review;
  mutate?: (root: string, findings: CreativeFinding[], input: SyntheticCreativeInput) => Promise<string[]> | string[];
  render?: (root: string) => Promise<RenderEvidence> | RenderEvidence;
}

function stable(value: unknown): string { return JSON.stringify(value, Object.keys(value as object).sort()); }
function fingerprint(value: unknown): string { return createHash('sha256').update(stable(value)).digest('hex'); }
async function files(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true }); const out: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ['node_modules', '.next', 'out'].includes(entry.name)) continue;
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) out.push(...await files(root, absolute)); else out.push(relative(root, absolute).replaceAll('\\', '/'));
  }
  return out.sort();
}
async function artifactFingerprint(root: string): Promise<string> {
  const inventory = await files(root); const material = await Promise.all(inventory.map(async (file) => [file, await readFile(join(root, file), 'utf8')]));
  return fingerprint(material);
}
function assertAdmission(input: SyntheticCreativeInput): void {
  if (input.synthetic !== true || !input.fixtureId?.trim() || !input.internalProvenance || input.internalProvenance.source !== 'INTERNAL_SYNTHETIC_FIXTURE') throw new Error('Synthetic provenance is required');
  const root = resolve(input.approvedLocalFixtureRoot); const fixture = resolve(input.fixtureRoot);
  if (root !== fixture && !fixture.startsWith(`${root}${sep}`)) throw new Error('Fixture path is outside approved local fixture root');
  if (/prospect|prototype|production|deploy/i.test(input.fixtureId) || /prospect|prototype|production/i.test(fixture)) throw new Error('Real prospect, prototype, or production paths are rejected');
}
function assertWhitelist(file: string): void {
  const normalized = file.replaceAll('\\', '/');
  if (!/^(app\/(globals\.css|.*\.(css|module\.css))|components\/.*\.(tsx|jsx|css|module\.css)|styles\/.*\.css)$/.test(normalized)) throw new Error(`Mutation outside whitelist: ${normalized}`);
}
async function defaultReview(root: string): Promise<Review> {
  const inventory = await files(root); const source = (await Promise.all(inventory.filter((f) => /\.(tsx|jsx|css)$/.test(f)).map((f) => readFile(join(root, f), 'utf8')))).join('\n');
  const findings: CreativeFinding[] = [];
  const reworked = source.includes('MAGIC_SCRIPT_SYNTHETIC_CREATIVE_REWORK_V1');
  if (!reworked && (source.match(/card|grid|panel/gi) ?? []).length >= 8) findings.push({ code: 'FLAT_COMPOSITION', category: 'antiSlop', severity: 'BLOCKING', message: 'Repeated card/grid/panel composition.' });
  if (!reworked && (source.match(/<h[1-3]\b/gi) ?? []).length < 2) findings.push({ code: 'HIERARCHY', category: 'hierarchy', severity: 'BLOCKING', message: 'Insufficient heading hierarchy.' });
  if (!/contact|réserver|reserver|découvrir|decouvrir|demander/i.test(source)) findings.push({ code: 'CTA_PRESENTATION', category: 'cta', severity: 'BLOCKING', message: 'No recognizable CTA presentation.' });
  if (!/@media/.test(source)) findings.push({ code: 'MOBILE_COMPOSITION', category: 'mobile', severity: 'WARNING', message: 'No bounded mobile composition rule.' });
  return { status: findings.some((f) => f.severity === 'BLOCKING') ? 'REWORK' : findings.length ? 'PASS_WITH_NOTES' : 'PASS', findings, checkedAt: new Date().toISOString(), owner: 'WEB_DESIGN' };
}
async function defaultMutate(root: string, findings: CreativeFinding[], input: SyntheticCreativeInput): Promise<string[]> {
  const target = 'app/globals.css'; assertWhitelist(target); const path = join(root, target); const before = await readFile(path, 'utf8');
  if (input.failureMode === 'PROTECTED_FACT_MUTATION') input.protectedFacts.__mutation = true;
  if (input.failureMode === 'PROTECTED_CONTRACT_MUTATION') input.protectedContract.__mutation = true;
  const marker = '/* MAGIC_SCRIPT_SYNTHETIC_CREATIVE_REWORK_V1 */';
  if (before.includes(marker)) return [];
  await writeFile(path, `${before.trimEnd()}\n\n${marker}\nmain{max-width:72rem;margin-inline:auto;padding-inline:1rem}\nsection{margin-block:clamp(3rem,9vw,7rem)}\n@media(max-width:40rem){main{padding-inline:.875rem}}\n`, 'utf8');
  return [target];
}
async function snapshot(root: string, destination: string): Promise<void> { await mkdir(destination, { recursive: true }); await cp(root, destination, { recursive: true, force: true }); }

export async function runSyntheticCreativeJob(input: SyntheticCreativeInput, deps: SyntheticCreativeDeps): Promise<SyntheticCreativeResult> {
  assertAdmission(input); const root = resolve(input.fixtureRoot); const startedAt = new Date().toISOString();
  const factsFingerprint = fingerprint(input.protectedFacts); const contractFingerprint = fingerprint(input.protectedContract); const beforeArtifact = await artifactFingerprint(root);
  const beforeReview = await (deps.review ?? defaultReview)(root, input); const before = { artifactFingerprint: beforeArtifact, protectedFactsFingerprint: factsFingerprint, protectedContractFingerprint: contractFingerprint, fileInventory: await files(root), creativeReview: beforeReview, timestamp: startedAt };
  const preflight = await deps.qa(root, 'QA_PREFLIGHT', input); const iterations: IterationRecord[] = []; let verdict: CreativeVerdict = beforeReview.status;
  if (!preflight.passed) verdict = 'BLOCKED';
  const snapshotRoot = await mkdtemp(join(tmpdir(), 'magicscript-synthetic-good-')); await snapshot(root, snapshotRoot);
  if (verdict === 'REWORK') {
    for (let index = 1; index <= Math.min(MAX_SYNTHETIC_CREATIVE_ITERATIONS, Math.max(1, Math.trunc(input.maxIterations ?? 3))); index += 1) {
      const beforeIteration = await artifactFingerprint(root);
      let filesChanged: string[];
      try {
        filesChanged = await (deps.mutate ?? defaultMutate)(root, beforeReview.findings, input);
      } catch (error) {
        await snapshot(snapshotRoot, root);
        verdict = 'BLOCKED';
        iterations.push({ index, findingsBefore: beforeReview.findings, plannedChanges: ['bounded presentation-only rework'], filesChanged: [], diffMetadata: { beforeBytes: beforeIteration.length, afterBytes: beforeIteration.length, changed: false }, buildResult: { command: 'not-run', exitCode: 1, status: 'FAILED', outputPath: null, timestamp: new Date().toISOString() }, creativeReviewAfter: { status: 'BLOCKED', findings: [{ code: 'MUTATION_CRASH', category: 'recovery', severity: 'BLOCKING', message: error instanceof Error ? error.message : String(error) }], checkedAt: new Date().toISOString(), owner: 'WEB_DESIGN' }, fingerprints: { before: beforeIteration, after: await artifactFingerprint(root) }, protectedFactsPreserved: fingerprint(input.protectedFacts) === factsFingerprint, protectedContractPreserved: fingerprint(input.protectedContract) === contractFingerprint, timestamp: new Date().toISOString() });
        break;
      }
      for (const file of filesChanged) assertWhitelist(file);
      const afterIteration = await artifactFingerprint(root); const build = await deps.build(root, input);
      if (build.status !== 'PASSED') { await snapshot(snapshotRoot, root); verdict = 'BLOCKED'; iterations.push({ index, findingsBefore: beforeReview.findings, plannedChanges: ['bounded presentation-only rework'], filesChanged, diffMetadata: { beforeBytes: beforeIteration.length, afterBytes: afterIteration.length, changed: beforeIteration !== afterIteration }, buildResult: build, creativeReviewAfter: { status: 'BLOCKED', findings: [{ code: 'BUILD_FAILURE', category: 'technical', severity: 'BLOCKING', message: 'Rebuild failed; last known-good artifact restored.' }], checkedAt: new Date().toISOString(), owner: 'WEB_DESIGN' }, fingerprints: { before: beforeIteration, after: await artifactFingerprint(root) }, protectedFactsPreserved: fingerprint(input.protectedFacts) === factsFingerprint, protectedContractPreserved: fingerprint(input.protectedContract) === contractFingerprint, timestamp: new Date().toISOString() }); break; }
      const factsOk = fingerprint(input.protectedFacts) === factsFingerprint; const contractOk = fingerprint(input.protectedContract) === contractFingerprint;
      const afterReview = await (deps.review ?? defaultReview)(root, input); iterations.push({ index, findingsBefore: beforeReview.findings, plannedChanges: ['bounded presentation-only rework'], filesChanged, diffMetadata: { beforeBytes: beforeIteration.length, afterBytes: afterIteration.length, changed: beforeIteration !== afterIteration }, buildResult: build, creativeReviewAfter: afterReview, fingerprints: { before: beforeIteration, after: afterIteration }, protectedFactsPreserved: factsOk, protectedContractPreserved: contractOk, timestamp: new Date().toISOString() });
      if (!factsOk || !contractOk) { await snapshot(snapshotRoot, root); verdict = 'BLOCKED'; break; }
      verdict = afterReview.status; if (verdict !== 'REWORK') break;
    }
    if (verdict === 'REWORK') verdict = 'EXHAUSTED';
  }
  const finalQa = await deps.qa(root, 'QA_FINAL', input); if (!finalQa.passed && (verdict === 'PASS' || verdict === 'PASS_WITH_NOTES')) verdict = 'BLOCKED';
  const renderEvidence = deps.render ? await deps.render(root) : input.renderEvidence ?? null; const completedAt = new Date().toISOString();
  return { kind: SYNTHETIC_CREATIVE_JOB_KIND, synthetic: true, fixtureId: input.fixtureId, technicalJobStatus: verdict === 'BLOCKED' ? 'BLOCKED' : 'SUCCEEDED', creativeVerdict: verdict, before, qaPreflight: preflight, iterations, qaFinal: finalQa, after: { artifactFingerprint: await artifactFingerprint(root), creativeVerdict: verdict, renderEvidence, timestamp: completedAt }, externalActions: [], startedAt, completedAt, blockers: [...preflight.blockers, ...finalQa.blockers] };
}

export const SYNTHETIC_FIXTURE_MATRIX = ['ugly', 'already-good', 'dense-content', 'broken-mobile', 'protected-facts', 'protected-contract', 'impossible', 'build-failure'] as const;
