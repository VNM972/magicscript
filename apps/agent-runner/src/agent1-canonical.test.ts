import assert from 'node:assert/strict';
import test from 'node:test';
import { toCanonicalAgent1Batch } from './agent1-canonical';

test('converts legacy discovery output into a validated canonical Agent 1 batch', () => {
  const batch = toCanonicalAgent1Batch({
    prospects: [{
      companyName: 'Example Shop',
      siren: '123456789',
      siret: '12345678900010',
      city: 'Fort-de-France',
      sourceUrl: 'https://annuaire.example.test/company',
      activity: 'Retail',
    }],
  }, { batchId: 'job-1', provenance: 'agent1-runtime-discovery' });
  assert.equal(batch.schemaVersion, 'AGENT1_CANDIDATE_BATCH_V1');
  assert.equal(batch.origin, 'runtime');
  assert.equal(batch.candidates.length, 1);
  assert.equal(batch.candidates[0].evidence[0].url, 'https://annuaire.example.test/company');
});

test('rejects discovery output without identity or evidence instead of bypassing canonical intake', () => {
  assert.throws(() => toCanonicalAgent1Batch({ prospects: [{ companyName: '', sourceUrl: '' }] }, { batchId: 'job-2', provenance: 'test' }), /companyName|sourceUrl|evidence/);
});
