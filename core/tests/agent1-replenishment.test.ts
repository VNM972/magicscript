import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_CAPACITY,
  ACTIVE_GEOGRAPHY,
  READY_RESERVE_CRITICAL,
  READY_RESERVE_LOW_WATER,
  READY_RESERVE_TARGET,
  REPLENISHMENT_EVALUATION_INTERVAL_HOURS,
  countReadyReserve,
  getReplenishmentState,
  hasPersistentMartiniqueSupplyLow,
  isReadyReserveCandidate,
  selectReadyReserveCandidate,
  type ReadyReserveCandidate,
} from '../orchestrator/agent1-replenishment';

const candidate = (overrides: Partial<ReadyReserveCandidate> = {}): ReadyReserveCandidate => ({
  id: 'p1', icpDecision: 'ADMIT', hasQualifyingEmailOrMobile: true, dedupePassed: true,
  activeProductionSlot: false, progressedIntoDownstreamProduction: false, commerciallyEligible: true,
  geography: ACTIVE_GEOGRAPHY, createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
});

test('frozen replenishment constants reuse active capacity and six-hour cadence', () => {
  assert.equal(ACTIVE_CAPACITY, 20);
  assert.equal(READY_RESERVE_TARGET, 40);
  assert.equal(READY_RESERVE_LOW_WATER, 20);
  assert.equal(READY_RESERVE_CRITICAL, 10);
  assert.equal(REPLENISHMENT_EVALUATION_INTERVAL_HOURS, 6);
});

test('reserve thresholds map to bounded policy', () => {
  assert.equal(getReplenishmentState(40).state, 'HEALTHY');
  assert.equal(getReplenishmentState(40).recommendedDiscoveryBatches, 0);
  assert.equal(getReplenishmentState(41).state, 'HEALTHY');
  assert.equal(getReplenishmentState(39).state, 'NORMAL');
  assert.equal(getReplenishmentState(20).state, 'NORMAL');
  assert.equal(getReplenishmentState(19).state, 'ACCELERATED');
  assert.equal(getReplenishmentState(10).state, 'ACCELERATED');
  assert.equal(getReplenishmentState(9).state, 'CRITICAL');
  assert.equal(getReplenishmentState(0).state, 'CRITICAL');
  assert.ok(getReplenishmentState(19).recommendedDiscoveryBatches <= 2);
  assert.ok(getReplenishmentState(9).recommendedDiscoveryBatches <= 3);
});

test('only admitted, contactable, deduped, non-active Martinique candidates count', () => {
  const valid = candidate();
  const gated = candidate({ id: 'gated', icpDecision: 'QUALITY_GATED' });
  const capability = candidate({ id: 'capability', icpDecision: 'CAPABILITY_GATED' });
  const needsContact = candidate({ id: 'needs-contact', icpDecision: 'NEEDS_CONTACT_DISCOVERY', hasQualifyingEmailOrMobile: false });
  const rejected = candidate({ id: 'rejected', icpDecision: 'REJECT' });
  const active = candidate({ id: 'active', activeProductionSlot: true });
  const downstream = candidate({ id: 'downstream', progressedIntoDownstreamProduction: true });
  const wrongGeography = candidate({ id: 'wrong-geo', geography: 'GUADELOUPE' });
  assert.equal(countReadyReserve([valid, gated, capability, needsContact, rejected, active, downstream, wrongGeography]), 1);
  assert.equal(isReadyReserveCandidate(gated), false);
  assert.equal(isReadyReserveCandidate(capability), false);
  assert.equal(isReadyReserveCandidate(needsContact), false);
  assert.equal(isReadyReserveCandidate(rejected), false);
});

test('existing reserve is selected deterministically before discovery', () => {
  const selected = selectReadyReserveCandidate([
    candidate({ id: 'later', createdAt: '2026-01-02T00:00:00.000Z' }),
    candidate({ id: 'earlier', createdAt: '2026-01-01T00:00:00.000Z' }),
  ]);
  assert.equal(selected?.id, 'earlier');
  assert.equal(getReplenishmentState(40).searchRequired, false);
});

test('low reserve does not promote gated candidates or expand geography', () => {
  assert.equal(isReadyReserveCandidate(candidate({ icpDecision: 'QUALITY_GATED' })), false);
  assert.equal(isReadyReserveCandidate(candidate({ icpDecision: 'CAPABILITY_GATED' })), false);
  assert.equal(isReadyReserveCandidate(candidate({ geography: 'GUADELOUPE' })), false);
  assert.equal(hasPersistentMartiniqueSupplyLow(12, 1, 0), true);
  assert.equal(hasPersistentMartiniqueSupplyLow(12, 0, 0), false);
  assert.equal(hasPersistentMartiniqueSupplyLow(12, 1, 1), false);
});
