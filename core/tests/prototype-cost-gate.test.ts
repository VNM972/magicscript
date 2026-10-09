import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePrototypeCostGate } from '../orchestrator/prototype-cost-gate';

const evaluatedAt = '2026-09-04T09:00:00.000Z';
const engagement = (activity_score = 0, intent_score = 0, trend: 'RISING' | 'STABLE' | 'COOLING' = 'STABLE') => ({
  score_total: activity_score + intent_score,
  activity_score,
  intent_score,
  trend,
  top_contributors: [],
  last_meaningful_event: null,
  computed_at: evaluatedAt,
});
const base = {
  opportunity: 'A' as const,
  prospectScore: 90,
  websiteUrl: null,
  primaryFriction: 'Conversion friction',
  primaryAsset: 'Verified logo',
  primaryCta: 'Request a quote',
  engagement: engagement(),
  computeClass: 'LOW' as const,
  estimatedExternalCost: { kind: 'UNKNOWN' as const, reason: 'Historical provider pricing unavailable' },
  evaluatedAt,
};

function evaluate(overrides: Record<string, unknown> = {}) {
  return evaluatePrototypeCostGate({ ...base, ...overrides } as never);
}

test('navigation richness cannot classify compute or alter authorization', () => {
  const light = evaluate({ state: 'PROTOTYPE_REQUIRED', computeClass: 'HIGH' });
  const low = evaluate({ state: 'PROTOTYPE_REQUIRED', computeClass: 'LOW' });
  assert.equal(light.authorization, 'LIGHT');
  assert.equal(light.decision, 'LIGHT');
  assert.equal(light.computeClass, 'HIGH');
  assert.equal(low.authorization, 'LIGHT');
});

test('qualified PROTOTYPE_REQUIRED receives bounded LIGHT without engagement', () => {
  const result = evaluate({ state: 'PROTOTYPE_REQUIRED' });
  assert.equal(result.authorization, 'LIGHT');
  assert.equal(result.decision, 'LIGHT');
  assert.ok(result.reasonCodes.includes('PRECONTACT_LIGHT_PROTOTYPE'));
  assert.ok(result.reasonCodes.includes('COMMERCIAL_QUALIFICATION_SUFFICIENT'));
  assert.ok(result.reasonCodes.includes('ENGAGEMENT_NOT_REQUIRED_PRECONTACT'));
});

test('PROTOTYPE_REQUIRED can never receive FULL', () => {
  const result = evaluate({ state: 'PROTOTYPE_REQUIRED', engagement: engagement(40, 100, 'RISING') });
  assert.notEqual(result.authorization, 'FULL');
  assert.equal(result.authorization, 'LIGHT');
});

test('weak cold prospect remains NO-GO', () => {
  const result = evaluate({ state: 'PROTOTYPE_REQUIRED', opportunity: 'D', prospectScore: 20, primaryFriction: null, primaryAsset: null, primaryCta: null });
  assert.equal(result.authorization, 'NONE');
  assert.equal(result.decision, 'NO-GO');
});

test('INTERESTED and MEETING_BOOKED can receive FULL from engagement and qualification', () => {
  const interested = evaluate({ state: 'INTERESTED', engagement: engagement(24, 40, 'RISING') });
  const meeting = evaluate({ state: 'MEETING_BOOKED', engagement: engagement(30, 40, 'RISING') });
  assert.equal(interested.authorization, 'FULL');
  assert.equal(meeting.authorization, 'FULL');
  assert.ok(meeting.reasonCodes.includes('MEETING_BOOKED_SIGNAL'));
  assert.ok(meeting.reasonCodes.includes('POST_INTEREST_FULL_AUTHORIZATION'));
});

test('unknown historical cost does not block bounded local LIGHT', () => {
  const result = evaluate({ state: 'PROTOTYPE_REQUIRED', paidCostRequired: false });
  assert.equal(result.authorization, 'LIGHT');
  assert.equal(result.estimatedExternalCost.kind, 'UNKNOWN');
});

test('unknown cost fails closed when a paid provider is actually required', () => {
  const result = evaluate({ state: 'INTERESTED', paidCostRequired: true });
  assert.equal(result.authorization, 'NONE');
  assert.equal(result.decision, 'NO-GO');
  assert.ok(result.reasonCodes.includes('PAID_COST_UNKNOWN_BLOCK'));
});

test('known external cost validation remains strict', () => {
  assert.throws(() => evaluate({ state: 'INTERESTED', estimatedExternalCost: { kind: 'KNOWN', amountEur: -1, source: 'provider' } }), /non-negative finite amount/);
});

test('ineligible states fail closed', () => {
  const result = evaluate({ state: 'QUALIFIED' });
  assert.equal(result.authorization, 'NONE');
  assert.deepEqual(result.reasonCodes, ['FUNNEL_STAGE_NOT_ELIGIBLE']);
});
test('prospect without functional website qualifies precontact even with modest score', () => {
  // Vision Phase F : un prospect SANS site web entre en file prototype
  // meme sans opportunite A/B, avec un score modeste et un seul signal.
  const result = evaluate({
    state: 'PROTOTYPE_REQUIRED',
    opportunity: 'C',
    prospectScore: 50,
    websiteUrl: null,
    primaryFriction: 'Website manquant',
    primaryAsset: null,
    primaryCta: null,
  });
  assert.equal(result.authorization, 'LIGHT');
  assert.equal(result.decision, 'LIGHT');
  assert.ok(result.reasonCodes.includes('COMMERCIAL_QUALIFICATION_SUFFICIENT'));
});

test('prospect with existing website is blocked even with excellent score', () => {
  // Vision Phase F : la presence d'un site web fonctionnel bloque
  // le prototype pre-contact, peu importe le score ou l'opportunite.
  const result = evaluate({
    state: 'PROTOTYPE_REQUIRED',
    opportunity: 'A',
    prospectScore: 95,
    websiteUrl: 'https://example.com',
    primaryFriction: 'Friction',
    primaryAsset: 'Asset',
    primaryCta: 'CTA',
  });
  assert.equal(result.authorization, 'NONE');
  assert.equal(result.decision, 'NO-GO');
  assert.ok(result.reasonCodes.includes('COMMERCIAL_QUALIFICATION_INSUFFICIENT'));
});
