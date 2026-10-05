import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSyntheticCreativeJob, type SyntheticCreativeInput } from './synthetic-creative-job';
import { projectSyntheticCreativeTrace, type Job } from '../../control-center/lib/api';

async function root() { const value = await mkdtemp(join(tmpdir(), 'synthetic-persistence-')); await mkdir(join(value, 'app')); await writeFile(join(value, 'app/page.tsx'), '<main><h1>Fixture</h1><div class="card card card card card card card card card">Contact</div></main>'); await writeFile(join(value, 'app/globals.css'), '.card{}'); return value; }
function input(value: string): SyntheticCreativeInput { return { synthetic: true, fixtureId: 'synthetic-round-trip', fixtureRoot: value, approvedLocalFixtureRoot: value, internalProvenance: { source: 'INTERNAL_SYNTHETIC_FIXTURE', approvedBy: 'test', reason: 'round-trip' }, protectedFacts: { id: 'fixture' }, protectedContract: { routes: ['/'] } }; }
const deps = { qa: (_r: string, phase: 'QA_PREFLIGHT' | 'QA_FINAL') => ({ phase, passed: true, blockers: [], checkedAt: new Date().toISOString() }), build: async () => ({ command: 'build', exitCode: 0, status: 'PASSED' as const, outputPath: 'out', timestamp: new Date().toISOString() }) };

test('API_JOB_ROUND_TRIP preserves technical and creative status independently', async () => { const result = await runSyntheticCreativeJob(input(await root()), deps); const persisted = JSON.parse(JSON.stringify(result)); const trace = projectSyntheticCreativeTrace({ id: 'parent-1', kind: 'CREATIVE_WEB_DESIGN_SYNTHETIC', status: 'SUCCEEDED', attempts: 1, runAfter: '', createdAt: '', updatedAt: '', result: persisted } as Job); assert.ok(trace); assert.equal(trace.technicalJobStatus, 'SUCCEEDED'); assert.equal(trace.creativeVerdict, result.creativeVerdict); assert.equal(trace.externalActions.length, 0); });
test('QA_FINAL_CAN_BLOCK_CREATIVE_PASS', async () => { const result = await runSyntheticCreativeJob(input(await root()), { ...deps, qa: (_r, phase) => ({ phase, passed: phase === 'QA_PREFLIGHT', blockers: phase === 'QA_FINAL' ? ['PROTECTED_CONTRACT'] : [], checkedAt: new Date().toISOString() }) }); assert.equal(result.creativeVerdict, 'BLOCKED'); assert.equal(result.technicalJobStatus, 'BLOCKED'); });
test('CRASH_RECOVERS_LAST_GOOD_ARTIFACT', async () => { const value = await root(); const before = '.card{}'; const result = await runSyntheticCreativeJob(input(value), { ...deps, mutate: async (directory) => { await writeFile(join(directory, 'app/globals.css'), 'corrupt'); throw new Error('simulated interruption'); } }); assert.equal(result.creativeVerdict, 'BLOCKED'); const { readFile } = await import('node:fs/promises'); assert.equal(await readFile(join(value, 'app/globals.css'), 'utf8'), before); });
