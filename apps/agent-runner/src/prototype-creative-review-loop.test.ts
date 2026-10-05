import test from 'node:test';
import assert from 'node:assert/strict';

import { runSyntheticCreativeReviewLoop } from './prototype-creative-review-loop';

test('reworks a local synthetic artifact until creative blockers clear', () => {
  const result = runSyntheticCreativeReviewLoop({
    artifact: { hierarchy: 'flat' },
    facts: ['verified-company-name'],
    maxIterations: 2,
    compliance: { passed: true },
    review: (artifact) => artifact.hierarchy === 'flat'
      ? [{ code: 'FLAT_HIERARCHY', severity: 'BLOCKER', message: 'Hierarchy is flat' }]
      : [],
    rework: (artifact) => ({ ...artifact, hierarchy: 'clear' }),
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.iterations, 2);
  assert.equal(result.artifact.hierarchy, 'clear');
  assert.equal(result.contractVersion, 'synthetic-creative-review-v1');
  assert.deepEqual(result.externalActions, []);
});

test('fails closed when compliance is not passed and does not rework', () => {
  let reworkCalls = 0;
  const result = runSyntheticCreativeReviewLoop({
    artifact: { copy: 'verified' },
    facts: ['verified-copy'],
    compliance: { passed: false, blockers: ['unverified claim'] },
    review: () => [],
    rework: (artifact) => {
      reworkCalls += 1;
      return artifact;
    },
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.iterations, 0);
  assert.deepEqual(result.compliance.blockers, ['unverified claim']);
  assert.equal(reworkCalls, 0);
});

test('returns EXHAUSTED when blockers remain after bounded local iterations', () => {
  const result = runSyntheticCreativeReviewLoop({
    artifact: 'draft',
    facts: [],
    maxIterations: 1,
    compliance: { passed: true },
    review: () => [{ code: 'CONTRAST', severity: 'BLOCKER', message: 'Needs contrast' }],
    rework: (artifact) => artifact,
  });

  assert.equal(result.status, 'EXHAUSTED');
  assert.equal(result.iterations, 1);
  assert.equal(result.findings[0]?.code, 'CONTRAST');
});

test('rejects protected-fact mutation during rework', () => {
  const facts = ['verified'];
  assert.throws(() => runSyntheticCreativeReviewLoop({
    artifact: 'draft',
    facts,
    maxIterations: 2,
    compliance: { passed: true },
    review: () => [{ code: 'X', severity: 'BLOCKER', message: 'x' }],
    rework: () => {
      facts.push('invented');
      return 'reworked';
    },
  }), /changed protected facts/);
});
