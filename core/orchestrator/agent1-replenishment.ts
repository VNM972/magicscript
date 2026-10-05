/**
 * Magic Script V2 — Agent 1 replenishment policy.
 *
 * This module is deliberately pure: it decides reserve health and bounded
 * discovery intensity, but it never performs discovery or changes prospect state.
 * Admission remains the sole authority for ICP/contactability.
 */
import { MAX_ACTIVE_PRODUCTION_PROSPECTS } from './deck-commercial-pipeline';

export const ACTIVE_CAPACITY = MAX_ACTIVE_PRODUCTION_PROSPECTS;
export const READY_RESERVE_TARGET = 40 as const;
export const READY_RESERVE_LOW_WATER = 20 as const;
export const READY_RESERVE_CRITICAL = 10 as const;
export const REPLENISHMENT_EVALUATION_INTERVAL_HOURS = 6 as const;
export const ACTIVE_GEOGRAPHY = 'MARTINIQUE' as const;

export type ReplenishmentState = 'HEALTHY' | 'NORMAL' | 'ACCELERATED' | 'CRITICAL';

export interface ReplenishmentEvaluation {
  state: ReplenishmentState;
  readyReserveCount: number;
  deficit: number;
  recommendedDiscoveryBatches: number;
  searchRequired: boolean;
}

export interface ReadyReserveCandidate {
  id: string;
  icpDecision: 'ADMIT' | 'CAPABILITY_GATED' | 'QUALITY_GATED' | 'NEEDS_CONTACT_DISCOVERY' | 'REJECT';
  hasQualifyingEmailOrMobile: boolean;
  dedupePassed: boolean;
  activeProductionSlot: boolean;
  progressedIntoDownstreamProduction: boolean;
  commerciallyEligible: boolean;
  geography: string;
  createdAt: string;
}

export function isReadyReserveCandidate(candidate: ReadyReserveCandidate): boolean {
  return candidate.icpDecision === 'ADMIT'
    && candidate.hasQualifyingEmailOrMobile
    && candidate.dedupePassed
    && !candidate.activeProductionSlot
    && !candidate.progressedIntoDownstreamProduction
    && candidate.commerciallyEligible
    && candidate.geography.trim().toUpperCase() === ACTIVE_GEOGRAPHY;
}

export function countReadyReserve(candidates: readonly ReadyReserveCandidate[]): number {
  return candidates.filter(isReadyReserveCandidate).length;
}

export function getReplenishmentState(readyReserveCount: number): ReplenishmentEvaluation {
  const count = Math.max(0, Math.floor(readyReserveCount));
  if (count >= READY_RESERVE_TARGET) {
    return { state: 'HEALTHY', readyReserveCount: count, deficit: 0, recommendedDiscoveryBatches: 0, searchRequired: false };
  }
  if (count >= READY_RESERVE_LOW_WATER) {
    return { state: 'NORMAL', readyReserveCount: count, deficit: READY_RESERVE_TARGET - count, recommendedDiscoveryBatches: 1, searchRequired: true };
  }
  if (count >= READY_RESERVE_CRITICAL) {
    return { state: 'ACCELERATED', readyReserveCount: count, deficit: READY_RESERVE_TARGET - count, recommendedDiscoveryBatches: 2, searchRequired: true };
  }
  return { state: 'CRITICAL', readyReserveCount: count, deficit: READY_RESERVE_TARGET - count, recommendedDiscoveryBatches: 3, searchRequired: true };
}

/**
 * Existing reserve order is deterministic and intentionally not a new score:
 * oldest admitted candidate first, then canonical id as a stable tie-breaker.
 */
export function selectReadyReserveCandidate(candidates: readonly ReadyReserveCandidate[]): ReadyReserveCandidate | null {
  return candidates.filter(isReadyReserveCandidate).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0] ?? null;
}

export function hasPersistentMartiniqueSupplyLow(
  readyReserveCount: number,
  boundedAttemptsCompleted: number,
  admissibleMartiniqueCandidatesProduced: number,
): boolean {
  return readyReserveCount < READY_RESERVE_LOW_WATER
    && boundedAttemptsCompleted > 0
    && admissibleMartiniqueCandidatesProduced === 0;
}
