import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePrototypeCostGate } from '../orchestrator/prototype-cost-gate';

const evaluatedAt = '2026-09-04T09:00:00.000Z';

function engagement(
  activity_score: number,
  intent_score: number,
  trend: 'RISING' | 'STABLE' | 'COOLING',
) {
  return {
    score_total: Math.min(100, activity_score + intent_score),
    activity_score,
    intent_score,
    trend,
    top_contributors: [],
    last_meaningful_event: null,
    computed_at: evaluatedAt,
  };
}

test('fails closed outside the qualified-interest funnel stage', () => {
  const result = evaluatePrototypeCostGate({
    state: 'QUALIFIED',
    opportunity: 'A',
    prospectScore: 100,
    websiteUrl: null,
    primaryFriction: 'Needs a website',
    primaryAsset: 'Logo',
    primaryCta: 'Book',
    engagement: engagement(30, 40, 'RISING'),
    computeClass: 'LOW',
    estimatedExternalCost: { kind: 'UNKNOWN', reason: 'No priced provider used' },
    evaluatedAt,
  });

  assert.equal(result.decision, 'NO-GO');
  assert.equal(result.authorization, 'NONE');
  assert.equal(result.policyScore, 0);
  assert.equal(result.reevaluateAt, null);
  assert.deepEqual(result.reasonCodes, ['FUNNEL_STAGE_NOT_ELIGIBLE']);
});

test('allows reevaluation after an objective MEETING_BOOKED signal', () => {
  const result = evaluatePrototypeCostGate({
    state: 'MEETING_BOOKED',
    opportunity: 'A',
    prospectScore: 90,
    websiteUrl: null,
    primaryFriction: 'Needs a website',
    primaryAsset: 'Logo',
    primaryCta: 'Book',
    engagement: engagement(30, 40, 'RISING'),
    computeClass: 'LOW',
    estimatedExternalCost: { kind: 'UNKNOWN', reason: 'No priced provider used' },
    evaluatedAt,
  });

  assert.equal(result.decision, 'GO');
  assert.equal(result.authorization, 'FULL');
  assert.equal(result.reevaluateAt, null);
  assert.ok(result.reasonCodes.includes('MEETING_BOOKED_SIGNAL'));
});

test('authorizes a full prototype for a strongly qualified prospect', () => {
  const result = evaluatePrototypeCostGate({
    state: 'INTERESTED',
    opportunity: 'A',
    prospectScore: 85,
    websiteUrl: null,
    primaryFriction: 'No credible digital presence',
    primaryAsset: 'Official logo',
    primaryCta: 'Request a quote',
    engagement: engagement(24, 40, 'RISING'),
    computeClass: 'MEDIUM',
    estimatedExternalCost: { kind: 'UNKNOWN', reason: 'No proven external cost' },
    evaluatedAt,
  });

  assert.equal(result.decision, 'GO');
  assert.equal(result.authorization, 'FULL');
  assert.equal(result.policyScore, 95);
  assert.equal(result.reevaluateAt, null);
});

test('authorizes only a light prototype for a medium-strength prospect', () => {
  const result = evaluatePrototypeCostGate({
    state: 'INTERESTED',
    opportunity: 'B',
    prospectScore: 65,
    websiteUrl: 'https://example.test',
    primaryFriction: 'Existing site is dated',
    primaryAsset: 'Logo',
    primaryCta: null,
    engagement: engagement(12, 22, 'STABLE'),
    computeClass: 'MEDIUM',
    estimatedExternalCost: { kind: 'UNKNOWN', reason: 'Provider pricing unavailable' },
    evaluatedAt,
  });

  assert.equal(result.decision, 'LIGHT');
  assert.equal(result.authorization, 'LIGHT');
  assert.equal(result.reevaluateAt, null);
});

test('refuses prototype spend and schedules reevaluation after 30 days for a weak prospect', () => {
  const result = evaluatePrototypeCostGate({
    state: 'INTERESTED',
    opportunity: 'D',
    prospectScore: 20,
    websiteUrl: 'https://example.test',
    primaryFriction: null,
    primaryAsset: null,
    primaryCta: null,
    engagement: engagement(0, 0, 'COOLING'),
    computeClass: 'HIGH',
    estimatedExternalCost: { kind: 'UNKNOWN', reason: 'No cost evidence' },
    evaluatedAt,
  });

  assert.equal(result.decision, 'NO-GO');
  assert.equal(result.authorization, 'NONE');
  assert.equal(result.policyScore, 0);
  assert.equal(result.reevaluateAt, '2026-10-04T09:00:00.000Z');
});

test('preserves UNKNOWN external cost instead of inventing zero', () => {
  const result = evaluatePrototypeCostGate({
    state: 'INTERESTED',
    opportunity: 'B',
    prospectScore: 70,
    websiteUrl: null,
    primaryFriction: 'Needs conversion path',
    primaryAsset: 'Logo',
    primaryCta: 'Contact',
    engagement: engagement(20, 30, 'RISING'),
    computeClass: 'LOW',
    estimatedExternalCost: { kind: 'UNKNOWN', reason: 'No priced external provider' },
    evaluatedAt,
  });

  assert.deepEqual(result.estimatedExternalCost, {
    kind: 'UNKNOWN',
    reason: 'No priced external provider',
  });
});

test('rejects an invalid known external cost', () => {
  assert.throws(
    () =>
      evaluatePrototypeCostGate({
        state: 'INTERESTED',
        opportunity: 'A',
        prospectScore: 90,
        websiteUrl: null,
        primaryFriction: 'Need',
        primaryAsset: 'Logo',
        primaryCta: 'Contact',
        engagement: engagement(25, 40, 'RISING'),
        computeClass: 'LOW',
        estimatedExternalCost: {
          kind: 'KNOWN',
          amountEur: -1,
          source: 'provider',
        },
        evaluatedAt,
      }),
    /non-negative finite amount/,
  );
});
