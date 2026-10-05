import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSyntheticCreativeJob, type SyntheticCreativeInput } from './synthetic-creative-job';

async function setup() { const root = await mkdtemp(join(tmpdir(), 'synthetic-idempotency-')); await mkdir(join(root, 'app')); await writeFile(join(root, 'app/page.tsx'), '<main><h1>Fixture</h1><div class="card card card card card card card card card">Contact</div></main>'); await writeFile(join(root, 'app/globals.css'), '.card{}'); return root; }
function input(root: string): SyntheticCreativeInput { return { synthetic: true, fixtureId: 'synthetic-idempotent-parent', fixtureRoot: root, approvedLocalFixtureRoot: root, internalProvenance: { source: 'INTERNAL_SYNTHETIC_FIXTURE', approvedBy: 'test', reason: 'retry proof' }, protectedFacts: { identity: 'fixture' }, protectedContract: { routes: ['/'] } }; }
const deps = { qa: (_r: string, phase: 'QA_PREFLIGHT' | 'QA_FINAL') => ({ phase, passed: true, blockers: [], checkedAt: new Date().toISOString() }), build: async () => ({ command: 'build', exitCode: 0, status: 'PASSED' as const, outputPath: 'out', timestamp: new Date().toISOString() }) };

test('RETRY_PARENT_IDEMPOTENT and does not double patch or duplicate iteration', async () => { const root = await setup(); const first = await runSyntheticCreativeJob(input(root), deps); const second = await runSyntheticCreativeJob(input(root), deps); const css = await readFile(join(root, 'app/globals.css'), 'utf8'); assert.equal((css.match(/MAGIC_SCRIPT_SYNTHETIC_CREATIVE_REWORK_V1/g) ?? []).length, 1); assert.equal(first.iterations.length, 1); assert.equal(second.iterations.length, 0); assert.equal(first.before.protectedFactsFingerprint, second.before.protectedFactsFingerprint); assert.equal(first.before.protectedContractFingerprint, second.before.protectedContractFingerprint); });
