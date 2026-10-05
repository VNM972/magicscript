import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  runSyntheticCreativeJob,
  SYNTHETIC_FIXTURE_MATRIX,
  type SyntheticCreativeDeps,
  type SyntheticCreativeInput,
  type SyntheticCreativeResult,
  type Review,
} from './synthetic-creative-job';

export interface MatrixCaseResult {
  fixtureId: (typeof SYNTHETIC_FIXTURE_MATRIX)[number];
  result: SyntheticCreativeResult;
  fileChanged: boolean;
  recoveredAfterFailure: boolean;
}

const uglyPage = '<main><h1>Fixture</h1><div class="card card card card card card card card card">Contact</div></main>';
const goodPage = '<main><h1>Fixture</h1><h2>Contact</h2><a href="/sales-room">Contact</a></main>';

async function createFixture(fixtureId: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `magicscript-${fixtureId}-`));
  await mkdir(join(root, 'app'), { recursive: true });
  await writeFile(join(root, 'app', 'page.tsx'), fixtureId === 'already-good' ? goodPage : uglyPage);
  await writeFile(join(root, 'app', 'globals.css'), fixtureId === 'already-good' ? '@media(max-width:40rem){}' : '.card{display:grid}');
  return root;
}

function baseInput(root: string, fixtureId: string): SyntheticCreativeInput {
  return { synthetic: true, fixtureId: `synthetic-${fixtureId}`, fixtureRoot: root, approvedLocalFixtureRoot: root, internalProvenance: { source: 'INTERNAL_SYNTHETIC_FIXTURE', approvedBy: 'matrix', reason: 'bounded local validation' }, protectedFacts: { identity: `fixture-${fixtureId}` }, protectedContract: { routes: ['/'], ctaDestination: '/sales-room' } };
}

function buildDeps(fixtureId: string): SyntheticCreativeDeps {
  const base: SyntheticCreativeDeps = {
    qa: (_root, phase) => ({ phase, passed: fixtureId !== 'broken-mobile', blockers: fixtureId === 'broken-mobile' ? ['MOBILE_TECHNICAL_VALIDITY'] : [], checkedAt: new Date().toISOString() }),
    build: async () => ({ command: 'synthetic-local-build', exitCode: 0, status: 'PASSED', outputPath: 'out', timestamp: new Date().toISOString() }),
  };
  if (fixtureId === 'impossible') {
    const review: Review = { status: 'REWORK', findings: [{ code: 'UNIMPROVABLE', category: 'layout', severity: 'BLOCKING', message: 'Fixture remains intentionally impossible.' }], checkedAt: new Date().toISOString(), owner: 'WEB_DESIGN' };
    base.review = () => review;
    base.mutate = async () => [];
  }
  if (fixtureId === 'build-failure') base.build = async () => ({ command: 'synthetic-failing-build', exitCode: 1, status: 'FAILED', outputPath: null, timestamp: new Date().toISOString() });
  if (fixtureId === 'protected-facts') base.mutate = async (_root, _findings, input) => { input.protectedFacts.mutated = true; return ['app/globals.css']; };
  if (fixtureId === 'protected-contract') base.mutate = async (_root, _findings, input) => { input.protectedContract.mutated = true; return ['app/globals.css']; };
  return base;
}

export async function runSyntheticFixtureMatrix(): Promise<MatrixCaseResult[]> {
  const results: MatrixCaseResult[] = [];
  for (const fixtureId of SYNTHETIC_FIXTURE_MATRIX) {
    const root = await createFixture(fixtureId);
    const before = await readFile(join(root, 'app', 'globals.css'), 'utf8');
    const result = await runSyntheticCreativeJob(baseInput(root, fixtureId), buildDeps(fixtureId));
    const after = await readFile(join(root, 'app', 'globals.css'), 'utf8');
    results.push({ fixtureId, result, fileChanged: before !== after, recoveredAfterFailure: fixtureId === 'build-failure' ? before === after : true });
  }
  return results;
}
