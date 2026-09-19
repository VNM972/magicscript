import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeterministicArtifact, executeVerticalDesigner, InMemoryDesignArtifactStore, validateDesignArtifact } from '../design/design-artifact';
import type { DesignRequestV1 } from '../design/design-request';

function request(vertical: DesignRequestV1['designInput']['businessVertical']): DesignRequestV1 {
  return { id: `dr-p-${vertical}`, version: 'DESIGN_REQUEST_V1', prospectId: 'p-1', admission: { packId: 'pack-1', schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2' }, identity: { businessName: 'Maison Test', city: 'Fort-de-France' }, opportunity: { businessContext: 'Local business', digitalFriction: 'Unclear next action' }, designInput: { businessVertical: vertical, evidence: [{ url: 'https://example.test', note: 'Provided source', supports: ['website'] }] }, createdAt: '2026-09-20T00:00:00.000Z' };
}

test('all supported profiles produce validated grounded artifacts', async () => {
  for (const vertical of ['RESTAURANT', 'BEAUTY', 'LOCAL_SERVICE', 'GENERAL_LOCAL_BUSINESS'] as const) {
    const req = request(vertical); const artifact = buildDeterministicArtifact(req, '2026-09-20T01:00:00.000Z');
    assert.equal(validateDesignArtifact(artifact, req).version, 'DESIGN_ARTIFACT_V1');
    assert.equal(artifact.prospectId, req.prospectId); assert.equal(artifact.pages.length, 1);
  }
});

test('invalid output is rejected and successful replay is idempotent', async () => {
  const req = request('RESTAURANT'); const store = new InMemoryDesignArtifactStore(); let calls = 0;
  const first = await executeVerticalDesigner({ request: req, artifacts: store, generate: async () => { calls += 1; return buildDeterministicArtifact(req, '2026-09-20T01:00:00.000Z'); } });
  const second = await executeVerticalDesigner({ request: req, artifacts: store, generate: async () => { calls += 1; throw new Error('must not run'); } });
  assert.deepEqual(second, first); assert.equal(calls, 1);
  await assert.rejects(() => executeVerticalDesigner({ request: request('BEAUTY'), artifacts: new InMemoryDesignArtifactStore(), generate: async () => ({}) }), /invalid/i);
});

test('designer input contains no contacts and cannot research, score, outreach, or deploy', () => {
  const req = request('LOCAL_SERVICE'); assert.equal('contacts' in req, false); const artifact = buildDeterministicArtifact(req, '2026-09-20T01:00:00.000Z');
  const text = JSON.stringify(artifact).toLowerCase(); for (const forbidden of ['research', 'score', 'outreach', 'deploy']) assert.equal(text.includes(forbidden), false);
});
