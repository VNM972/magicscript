import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT1_CANDIDATE_BATCH_VERSION, validateAgent1CandidateBatch } from '../types/agent1-batch';

const valid = {
  schemaVersion: AGENT1_CANDIDATE_BATCH_VERSION,
  batchId: 'batch-test-001', provenance: 'synthetic-test', collectedAt: '2026-01-01T00:00:00.000Z', origin: 'manual',
  candidates: [{ companyName: 'Synthetic Coffee', siren: '123456789', siret: '12345678900001', city: 'FORT-DE-FRANCE', sourceUrl: 'https://example.test/source', evidence: [{ url: 'https://example.test/source', note: 'Public business listing', supports: ['activity', 'location'], observedAt: '2026-01-01T00:00:00.000Z' }], score: 99, opportunity: 'A' }],
};

test('AGENT1_RICH_BATCH_SCHEMA_VALID', () => assert.equal(validateAgent1CandidateBatch(valid).accepted, true));
test('AGENT1_RICH_BATCH_INVALID_FAILS_CLOSED', () => {
  const invalid = { ...valid, schemaVersion: 'v0', candidates: [{ ...valid.candidates[0], sourceUrl: 'file:///secret', siren: '123', evidence: [] }] };
  const result = validateAgent1CandidateBatch(invalid);
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.length >= 3);
});

test('AGENT1_MANUAL_SCORE_DOES_NOT_BYPASS_CANONICAL_SCORE', () => {
  assert.equal(typeof valid.candidates[0].score, 'number');
  assert.equal(validateAgent1CandidateBatch(valid).accepted, true);
});
