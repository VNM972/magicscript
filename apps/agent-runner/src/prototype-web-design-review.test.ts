import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDeterministicWebDesignReview } from './prototype-web-design-review';

test('returns PASS when QA schema and deterministic checks are clean', () => {
  const review = buildDeterministicWebDesignReview({
    buildPassed: true,
    blockingFindings: [],
    qaSchemaIsValid: true,
    checkedAt: '2026-09-04T16:00:00.000Z',
  });

  assert.equal(review.status, 'PASS');
  assert.equal(review.owner, 'BU Web Design');
  assert.equal(review.verifier, 'runner-deterministic-web-design-v2');
  assert.equal(review.blockers, undefined);
  assert.ok(review.checks.includes('selected-design-direction-composition'));
  assert.ok(review.checks.includes('anti-slop-visual-hierarchy-and-rhythm'));
});

test('fails closed when the QA schema is invalid and composition was not verified', () => {
  const review = buildDeterministicWebDesignReview({
    buildPassed: true,
    blockingFindings: [],
    qaSchemaIsValid: false,
    checkedAt: '2026-09-04T16:00:00.000Z',
  });

  assert.equal(review.status, 'BLOCKED');
  assert.deepEqual(review.blockers, [
    'QA agent schema is invalid; the Web Design composition review is unavailable.',
  ]);
  assert.equal(review.notes, undefined);
});

test('returns BLOCKED and preserves an anti-slop composition blocker', () => {
  const review = buildDeterministicWebDesignReview({
    buildPassed: true,
    blockingFindings: ['Unjustified card-wall flattens the visual hierarchy'],
    qaSchemaIsValid: true,
    checkedAt: '2026-09-04T16:00:00.000Z',
  });

  assert.equal(review.status, 'BLOCKED');
  assert.deepEqual(review.blockers, ['Unjustified card-wall flattens the visual hierarchy']);
});

test('returns BLOCKED when the technical build fails', () => {
  const review = buildDeterministicWebDesignReview({
    buildPassed: false,
    blockingFindings: ['Deterministic npm build failed'],
    qaSchemaIsValid: true,
    checkedAt: '2026-09-04T16:00:00.000Z',
  });

  assert.equal(review.status, 'BLOCKED');
});
