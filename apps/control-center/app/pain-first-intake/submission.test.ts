import test from 'node:test';
import assert from 'node:assert/strict';
import { mapManualPainFirstSubmission } from './submission';
import { painFirstQueryPlans } from '../../../../core/research/pain-first-staging';

const acquiredAt = '2026-10-01T12:00:00.000Z';
test('fixed UI fields bind both frozen queries to the corresponding R55 plans', () => {
  const result = mapManualPainFirstSubmission({ SITE_UNDER_CONSTRUCTION: 'https://cafe-alizes.fr/',
    SITE_REBUILDING: 'https://salon-alizes.fr/' }, acquiredAt);
  assert.deepEqual(result.candidates.map((candidate) => [candidate.conditionClass, candidate.queryPlanId]),
    painFirstQueryPlans().map((plan) => [plan.conditionClass, plan.planId]));
});
test('submission mapping preserves per-field positions and individual failures', () => {
  const result = mapManualPainFirstSubmission({ SITE_UNDER_CONSTRUCTION: 'http://[\nhttps://cafe-alizes.fr/',
    SITE_REBUILDING: 'https://salon-alizes.fr/' }, acquiredAt);
  assert.equal(result.acceptedCount, 2); assert.equal(result.rejectedCount, 1);
  assert.deepEqual(result.candidates.map((candidate) => candidate.resultPosition), [2, 1]);
});
test('unknown UI fields ignored and new validation replaces rather than accumulates candidates', () => {
  const result = mapManualPainFirstSubmission({ WEBSITE_VERIFIED_ABSENT: 'https://cafe-alizes.fr/',
    BROKEN_PRIMARY_ACTION: 'https://salon-alizes.fr/' }, acquiredAt);
  assert.equal(result.acceptedCount, 0);
  assert.equal(mapManualPainFirstSubmission({ SITE_UNDER_CONSTRUCTION: 'https://cafe-alizes.fr/' }, acquiredAt).acceptedCount, 1);
  assert.equal(mapManualPainFirstSubmission({}, acquiredAt).acceptedCount, 0);
});
