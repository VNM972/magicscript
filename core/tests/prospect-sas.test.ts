import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPromoteSasRecord,
  createSasPendingRecord,
  validateSasRecord,
  type ProspectSasRecord,
} from '../types/prospect-sas';

test('creates an isolated SAS_PENDING record with commercial activation disabled', () => {
  const record = createSasPendingRecord('sas-001', 'Entreprise synthétique', '2026-09-02');
  assert.equal(record.status, 'SAS_PENDING');
  assert.equal(record.contactAllowed, false);
  assert.equal(record.commercialActivation, 'DISABLED');
  assert.equal(validateSasRecord(record).accepted, true);
});

test('requires evidence for populated fields and preserves UNKNOWN', () => {
  const record = createSasPendingRecord('sas-002', 'Entreprise synthétique', '2026-09-02');
  const withEvidence: ProspectSasRecord = {
    ...record,
    status: 'VALIDATED',
    fields: {
      activity: {
        value: 'Conseil',
        confidence: 'HIGH',
        evidence: [{ url: 'https://example.test/activity', checkedAt: '2026-09-02', confidence: 'HIGH' }],
      },
      founder: { value: null, confidence: 'UNKNOWN', evidence: [] },
    },
  };

  assert.equal(validateSasRecord(withEvidence).accepted, true);
  assert.equal(canPromoteSasRecord(withEvidence, false), false);
  assert.equal(canPromoteSasRecord(withEvidence, true), false);
});

test('permits promotion only for a fully evidenced validated record after human approval', () => {
  const record: ProspectSasRecord = {
    ...createSasPendingRecord('sas-003', 'Entreprise synthétique', '2026-09-02'),
    status: 'VALIDATED',
    fields: {
      activity: {
        value: 'Conseil',
        confidence: 'HIGH',
        evidence: [{ url: 'https://example.test/activity', checkedAt: '2026-09-02', confidence: 'HIGH' }],
      },
    },
  };

  assert.equal(canPromoteSasRecord(record, false), false);
  assert.equal(canPromoteSasRecord(record, true), true);
});

test('rejects any attempt to enable contact or commercial activation in the SAS', () => {
  const result = validateSasRecord({
    ...createSasPendingRecord('sas-004', 'Entreprise synthétique', '2026-09-02'),
    contactAllowed: true as never,
    commercialActivation: 'ENABLED' as never,
  });

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('SAS contact must remain disabled'));
  assert.ok(result.reasons.includes('commercial activation must remain disabled'));
});

test('can stage 100 synthetic records without promotion or contact permission', () => {
  const records = Array.from({ length: 100 }, (_, index) =>
    createSasPendingRecord(`sas-batch-${String(index + 1).padStart(3, '0')}`, `Entreprise synthétique ${index + 1}`, '2026-09-02'),
  );

  assert.equal(new Set(records.map((record) => record.id)).size, 100);
  assert.equal(records.every((record) => validateSasRecord(record).accepted), true);
  assert.equal(records.every((record) => !canPromoteSasRecord(record, true)), true);
  assert.equal(records.every((record) => record.contactAllowed === false), true);
});
