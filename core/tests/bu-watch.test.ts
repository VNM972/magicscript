import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBuWatchDelta, validateBuWatchDelta, type BuWatchDelta } from '../types/bu-watch';

const validChange: BuWatchDelta = {
  id: 'watch-001',
  businessUnit: 'BU Web Design',
  specialty: 'accessibility',
  status: 'CHANGE',
  changedWhat: 'A published standard changed.',
  source: { url: 'https://example.test/standard', checkedAt: '2026-09-02', confidence: 'HIGH' },
  whyItMatters: 'It changes the review checklist.',
  businessUnitImpact: 'Update the Web Design gate.',
  affectedArtifact: 'core/prototypes/web-design-review.ts',
  recommendation: 'Review the affected criterion before the next prototype.',
  confidence: 'HIGH',
};

test('accepts and normalizes a sourced BU change delta', () => {
  const normalized = normalizeBuWatchDelta(validChange);
  assert.equal(validateBuWatchDelta(normalized).accepted, true);
  assert.equal(normalized.source?.url, 'https://example.test/standard');
});

test('keeps NO_CHANGE and UNKNOWN explicit', () => {
  const noChange: BuWatchDelta = { ...validChange, id: 'watch-002', status: 'NO_CHANGE', changedWhat: 'No relevant change observed.' };
  const unknown: BuWatchDelta = { ...validChange, id: 'watch-003', status: 'UNKNOWN', changedWhat: 'The source could not be verified.', source: null, confidence: 'UNKNOWN' };

  assert.equal(validateBuWatchDelta(noChange).accepted, true);
  assert.equal(validateBuWatchDelta(unknown).accepted, true);
});

test('rejects an asserted change without source or with unknown confidence', () => {
  const missingSource = validateBuWatchDelta({ ...validChange, source: null });
  const unknownConfidence = validateBuWatchDelta({ ...validChange, confidence: 'UNKNOWN' });

  assert.equal(missingSource.accepted, false);
  assert.ok(missingSource.reasons.includes('source is required for a confirmed change or no-change result'));
  assert.equal(unknownConfidence.accepted, false);
  assert.ok(unknownConfidence.reasons.includes('confirmed result cannot have UNKNOWN confidence'));
});
