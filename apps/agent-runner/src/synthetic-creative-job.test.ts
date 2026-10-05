import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSyntheticCreativeJob, type SyntheticCreativeInput } from './synthetic-creative-job';

async function fixture(page = '<main><h1>Fixture</h1><div class="card card card card card card card card card">Contact</div></main>') {
  const root = await mkdtemp(join(tmpdir(), 'synthetic-creative-'));
  await mkdir(join(root, 'app'), { recursive: true });
  await writeFile(join(root, 'app', 'page.tsx'), page);
  await writeFile(join(root, 'app', 'globals.css'), '.card{display:grid}');
  return root;
}
function input(root: string): SyntheticCreativeInput { return { synthetic: true, fixtureId: 'fixture-ugly', fixtureRoot: root, approvedLocalFixtureRoot: root, internalProvenance: { source: 'INTERNAL_SYNTHETIC_FIXTURE', approvedBy: 'test', reason: 'local' }, protectedFacts: { identity: 'fixture' }, protectedContract: { routes: ['/'] } }; }
const deps = { qa: (_root: string, phase: 'QA_PREFLIGHT' | 'QA_FINAL') => ({ phase, passed: true, blockers: [], checkedAt: new Date().toISOString() }), build: async () => ({ command: 'local-build', exitCode: 0, status: 'PASSED' as const, outputPath: 'out', timestamp: new Date().toISOString() }) };

test('SYNTHETIC_CREATIVE_JOB_ACCEPTS_INTERNAL_FIXTURE and reworks real local file', async () => { const root = await fixture(); const result = await runSyntheticCreativeJob(input(root), deps); assert.equal(result.kind, 'CREATIVE_WEB_DESIGN_SYNTHETIC'); assert.equal(result.synthetic, true); assert.ok(result.iterations.length >= 1); assert.equal(result.externalActions.length, 0); assert.notEqual(await readFile(join(root, 'app', 'globals.css'), 'utf8'), '.card{display:grid}'); });
test('rejects real prospect and unsafe path', async () => { const root = await fixture(); await assert.rejects(() => runSyntheticCreativeJob({ ...input(root), fixtureId: 'real-prospect' }, deps), /rejected/); await assert.rejects(() => runSyntheticCreativeJob({ ...input(root), fixtureRoot: join(root, '..'), approvedLocalFixtureRoot: root }, deps), /outside/); });
test('QA_PREFLIGHT blocks creative mutation and build failure cannot pass', async () => { const root = await fixture(); let calls = 0; const blocked = await runSyntheticCreativeJob(input(root), { ...deps, qa: (_r, phase) => { calls += 1; return { phase, passed: false, blockers: ['unsafe'], checkedAt: new Date().toISOString() }; } }); assert.equal(blocked.creativeVerdict, 'BLOCKED'); assert.equal(calls, 2); const failed = await runSyntheticCreativeJob(input(await fixture()), { ...deps, build: async () => ({ command: 'bad', exitCode: 1, status: 'FAILED' as const, outputPath: null, timestamp: new Date().toISOString() }) }); assert.notEqual(failed.creativeVerdict, 'PASS'); });
test('max three iterations and protected mutation block', async () => { const root = await fixture(); const exhausted = await runSyntheticCreativeJob(input(root), { ...deps, review: () => ({ status: 'REWORK', findings: [{ code: 'X', category: 'layout', severity: 'BLOCKING', message: 'x' }], checkedAt: new Date().toISOString(), owner: 'WEB_DESIGN' }), mutate: async () => [] }); assert.equal(exhausted.creativeVerdict, 'EXHAUSTED'); assert.equal(exhausted.iterations.length, 3); const facts = input(await fixture()); const blocked = await runSyntheticCreativeJob(facts, { ...deps, mutate: async () => { facts.protectedFacts.extra = 'bad'; return []; } }); assert.equal(blocked.creativeVerdict, 'BLOCKED'); });
