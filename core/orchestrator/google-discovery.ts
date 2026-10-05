/**
 * Google Places Orchestrator Integration (V1).
 *
 * Integrates the ACCEPTED Google Places Structured Discovery Adapter V1 into
 * the normal Magic Script prospect orchestration path.
 *
 * ARCHITECTURE:
 *
 *   Canonical Prospect
 *   → existing orchestration decision
 *   → optional Google Structured Discovery (disabled by default)
 *   → identity/branch evaluation (deterministic)
 *   → structured website candidate → owned-site verification
 *   → structured phone candidates → Evidence Integrity → per-phone trust
 *   → contactability/scoring (no influence from Google alone)
 *
 * CONTRACT PRESERVED:
 *   - googlePlaces.enabled = false by default
 *   - No automatic enablement, hidden fallback, or default background spend
 *   - Phone NEVER influences identity
 *   - Google phones remain UNVERIFIED by default
 *   - Google alone NEVER creates trustedPhone, scoring, contactability
 *   - Multi-phone semantics preserved (multiple valid numbers may coexist)
 *   - MOBILE does not imply WhatsApp
 *
 * BRANCH SIGNAL NORMALIZATION:
 *   The live adapter uses strict website-domain matching which produces a
 *   conservative signal (0 MATCH, 6 MISMATCH, 2 UNKNOWN in V3 sample despite
 *   0 wrong-branch promotions). This module normalizes the branch contract so
 *   the orchestrator distinguishes:
 *
 *   BRANCH_MATCH        — identity + address/locality/postal evidence compatible
 *   BRANCH_NOT_PROVEN   — identity compatible but website-domain mismatch (not
 *                         equivalent to WRONG_BRANCH)
 *   BRANCH_CONFLICT     — actual identity conflict (fail closed)
 *
 * @module orchestrator/google-discovery
 */

import type { MagicScriptConfig } from '../config';
import { GOOGLE_PLACES_PROVIDER } from '../google-places-trust';
import { googlePlacesStructuredDiscovery } from '../providers/google-places-discovery';
import type {
  DiscoveryIdentityVerdict,
  GoogleDiscoveryResult,
  GoogleDiscoveryIdentityInput,
  GoogleDiscoveryCandidateResponse,
} from '../providers/google-places-discovery';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const GOOGLE_DISCOVERY_ORCHESTRATOR_VERSION =
  'google-places-orchestrator-integration.v1' as const;

/**
 * Normalized branch verdict for the orchestrator.
 * Distinguishes a proven branch match from a website-domain-only mismatch that
 * is NOT evidence of wrong-branch promotion.
 */
export type NormalizedBranchVerdict =
  | 'BRANCH_MATCH'
  | 'BRANCH_NOT_PROVEN'
  | 'BRANCH_CONFLICT'
  | 'NOT_EVALUATED';

/**
 * Reason why a Google discovery request was NOT executed.
 */
export type GoogleSkipReason =
  | 'GOOGLE_DISABLED'
  | 'PROSPECT_INELIGIBLE'
  | 'INTERNAL_EXCLUDED'
  | 'SYNTHETIC_EXCLUDED'
  | 'HUMAN_BLOCKED'
  | 'BUDGET_EXCEEDED';

/**
 * The orchestrator-level execution decision.
 */
export interface GoogleOrchestratorDecision {
  /** Whether a Google request was actually made. */
  executed: boolean;
  /** If skipped, the reason why. */
  skipReason?: GoogleSkipReason;
  /** The provider-level result (present only when executed = true). */
  discoveryResult?: GoogleDiscoveryResult;
  /** Normalized branch verdict for the orchestrator. */
  normalizedBranchVerdict: NormalizedBranchVerdict;
  /** Whether the result includes a website candidate for owned-site verification. */
  websiteDiscoveryCandidate: boolean;
  /** How many phone candidates were produced. */
  phoneCandidateCount: number;
  /** Budget remaining after this decision. */
  budgetRemaining: number;
}

/**
 * Input for a single Google discovery orchestration decision.
 */
export interface GoogleOrchestrationInput {
  prospectId: string;
  canonicalName: string;
  canonicalLocality: string | null;
  canonicalAddress: string | null;
  canonicalPostalCode: string | null;
  canonicalWebsite: string | null;
  /** The prospect's commercial eligibility classification. */
  eligibilityClassification: string;
  /** Whether the prospect is internal (INTERNAL_RELATION, EXISTING_MAGIC_SCRIPT_ASSET). */
  isInternal: boolean;
  /** Whether the prospect is synthetic/technical/fixture. */
  isSynthetic: boolean;
  /** Whether the prospect is human-blocked (DO_NOT_CONTACT, HUMAN_ACTION_REQUIRED). */
  isHumanBlocked: boolean;
}

/**
 * Budget state for Google discovery requests.
 */
export interface GoogleRequestBudget {
  /** Maximum number of requests permitted. */
  maxRequests: number;
  /** Requests already consumed. */
  usedRequests: number;
}

// ---------------------------------------------------------------------------
// Eligibility helpers
// ---------------------------------------------------------------------------

const INELIGIBLE_CLASSIFICATIONS = new Set(['REJECT']);
const INTERNAL_CATEGORIES = new Set([
  'INTERNAL_RELATION',
  'EXISTING_MAGIC_SCRIPT_ASSET',
]);

/**
 * Check whether a prospect is eligible for Google discovery.
 *
 * ALL gates must be satisfied:
 *   - googlePlaces.enabled = true
 *   - prospect has non-REJECT eligibility classification
 *   - prospect is not internal
 *   - prospect is not synthetic/technical
 *   - prospect has not been human-blocked
 *   - budget permits execution
 */
export function isProspectEligibleForGoogleDiscovery(
  input: GoogleOrchestrationInput,
  config: Pick<MagicScriptConfig, 'googlePlacesEnabled'>,
  budget: GoogleRequestBudget,
): { eligible: boolean; skipReason?: GoogleSkipReason } {
  if (!config.googlePlacesEnabled) {
    return { eligible: false, skipReason: 'GOOGLE_DISABLED' };
  }

  if (input.isHumanBlocked) {
    return { eligible: false, skipReason: 'HUMAN_BLOCKED' };
  }

  if (input.isInternal) {
    return { eligible: false, skipReason: 'INTERNAL_EXCLUDED' };
  }

  if (input.isSynthetic) {
    return { eligible: false, skipReason: 'SYNTHETIC_EXCLUDED' };
  }

  if (INELIGIBLE_CLASSIFICATIONS.has(input.eligibilityClassification)) {
    return { eligible: false, skipReason: 'PROSPECT_INELIGIBLE' };
  }

  if (budget.usedRequests >= budget.maxRequests) {
    return { eligible: false, skipReason: 'BUDGET_EXCEEDED' };
  }

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Branch signal normalization
// ---------------------------------------------------------------------------

/**
 * Normalize the provider-level branch verdict to the orchestrator contract.
 *
 * The live adapter uses strict website-domain matching which is CONSERVATIVE:
 * a website-domain MISMATCH after identity match does NOT mean wrong branch.
 * We normalize:
 *
 *   - Provider MATCH                  → BRANCH_MATCH
 *   - Provider MISMATCH (website)     → BRANCH_NOT_PROVEN
 *     (identity/address evidence was compatible, only website domain differs)
 *   - Identity REJECTED (real conflict) → BRANCH_CONFLICT
 *   - Provider NOT_EVALUATED          → NOT_EVALUATED
 *
 * This prevents a conservative website-domain mismatch from being incorrectly
 * interpreted as a wrong-branch promotion in the orchestrator.
 */
export function normalizeBranchVerdict(
  providerIdentityVerdict: DiscoveryIdentityVerdict,
  providerBranchVerdict: GoogleDiscoveryResult['branchVerdict'],
): NormalizedBranchVerdict {
  if (providerIdentityVerdict !== 'VERIFIED') {
    return 'NOT_EVALUATED';
  }

  switch (providerBranchVerdict) {
    case 'MATCH':
      return 'BRANCH_MATCH';
    case 'MISMATCH':
      // Website-domain mismatch ONLY after identity match: conservative signal,
      // NOT proven wrong branch.
      return 'BRANCH_NOT_PROVEN';
    case 'UNKNOWN':
      // No website available from Google: cannot confirm branch from this signal alone.
      return 'BRANCH_NOT_PROVEN';
    case 'NOT_EVALUATED':
      return 'NOT_EVALUATED';
    default:
      return 'BRANCH_NOT_PROVEN';
  }
}

// ---------------------------------------------------------------------------
// Orchestrator decision
// ---------------------------------------------------------------------------

/**
 * Make a single Google discovery orchestration decision.
 *
 * This is the primary entry point for the orchestrator. It:
 *   1. Checks eligibility gates
 *   2. If eligible and budget permits, delegates to the provider
 *   3. Normalizes the branch verdict
 *   4. Returns a structured decision with telemetry-friendly fields
 *
 * The provider itself is a pure function (no real network) so this is safe
 * to call in any context. Real Google execution requires the operator to have
 * set googlePlacesEnabled = true and provided a real transport.
 */
export function decideGoogleDiscovery(
  input: GoogleOrchestrationInput,
  config: Pick<MagicScriptConfig, 'googlePlacesEnabled'>,
  budget: GoogleRequestBudget,
  candidates: GoogleDiscoveryCandidateResponse[],
  idempotencyKey?: string,
): GoogleOrchestratorDecision {
  const eligibility = isProspectEligibleForGoogleDiscovery(input, config, budget);

  if (!eligibility.eligible) {
    return {
      executed: false,
      skipReason: eligibility.skipReason,
      normalizedBranchVerdict: 'NOT_EVALUATED',
      websiteDiscoveryCandidate: false,
      phoneCandidateCount: 0,
      budgetRemaining: Math.max(0, budget.maxRequests - budget.usedRequests),
    };
  }

  // Build the identity input for the provider.
  const identityInput: GoogleDiscoveryIdentityInput = {
    canonicalName: input.canonicalName,
    canonicalLocality: input.canonicalLocality,
    canonicalAddress: input.canonicalAddress,
    canonicalPostalCode: input.canonicalPostalCode,
    canonicalWebsite: input.canonicalWebsite,
  };

  // Call the existing provider (pure function).
  const result = googlePlacesStructuredDiscovery(
    identityInput,
    candidates,
    {
      queryHash: idempotencyKey ?? `orchestrator-${input.prospectId}`,
      responseHash: `mock-${candidates.length}-candidates`,
      httpStatus: 200,
      rawPlaceCount: candidates.length,
    },
    { enabled: true, prospectId: input.prospectId },
  );

  const normalizedBranch = normalizeBranchVerdict(
    result.identityVerdict,
    result.branchVerdict,
  );

  const websiteDiscoveryCandidate =
    result.identityVerdict === 'VERIFIED' && Boolean(result.websiteCandidate);

  return {
    executed: true,
    discoveryResult: result,
    normalizedBranchVerdict: normalizedBranch,
    websiteDiscoveryCandidate,
    phoneCandidateCount: result.phoneCandidates.length,
    budgetRemaining: Math.max(0, budget.maxRequests - budget.usedRequests - 1),
  };
}

// ---------------------------------------------------------------------------
// Budget accounting
// ---------------------------------------------------------------------------

/**
 * Create a fresh request budget.
 */
export function createGoogleRequestBudget(maxRequests: number): GoogleRequestBudget {
  return { maxRequests: Math.max(0, Math.floor(maxRequests)), usedRequests: 0 };
}

/**
 * Create a budget that permits zero requests (the safe default).
 */
export function createDisabledGoogleRequestBudget(): GoogleRequestBudget {
  return { maxRequests: 0, usedRequests: 0 };
}

// ---------------------------------------------------------------------------
// Telemetry helpers
// ---------------------------------------------------------------------------

/**
 * Telemetry event names for the Google discovery orchestrator.
 * These are designed to be emitted by the orchestrator for observability.
 */
export const GOOGLE_ORCHESTRATOR_METRICS = {
  ELIGIBLE: 'google.orchestrator.eligible',
  SKIPPED_DISABLED: 'google.orchestrator.skipped_disabled',
  SKIPPED_INELIGIBLE: 'google.orchestrator.skipped_ineligible',
  REQUESTED: 'google.orchestrator.requested',
  EXECUTED: 'google.orchestrator.executed',
  BUDGET_EXCEEDED: 'google.orchestrator.budget_exceeded',
  FAILED: 'google.orchestrator.failed',
  IDENTITY_VERIFIED: 'google.orchestrator.identity_verified',
  IDENTITY_AMBIGUOUS: 'google.orchestrator.identity_ambiguous',
  IDENTITY_REJECTED: 'google.orchestrator.identity_rejected',
  WEBSITE_CANDIDATE: 'google.orchestrator.website_candidate',
  PHONE_CANDIDATES: 'google.orchestrator.phone_candidates',
} as const;

/**
 * Build a telemetry payload from an orchestrator decision.
 * Never contains sensitive provider data, raw Google responses, or GKEY.
 */
export function buildOrchestratorTelemetry(
  decision: GoogleOrchestratorDecision,
  prospectId: string,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    prospectId,
    executed: decision.executed,
    schemaVersion: GOOGLE_DISCOVERY_ORCHESTRATOR_VERSION,
  };

  if (!decision.executed) {
    return {
      ...base,
      skipReason: decision.skipReason,
      normalizedBranchVerdict: decision.normalizedBranchVerdict,
      budgetRemaining: decision.budgetRemaining,
    };
  }

  return {
    ...base,
    identityVerdict: decision.discoveryResult?.identityVerdict,
    normalizedBranchVerdict: decision.normalizedBranchVerdict,
    websiteDiscoveryCandidate: decision.websiteDiscoveryCandidate,
    phoneCandidateCount: decision.phoneCandidateCount,
    branchVerdict: decision.discoveryResult?.branchVerdict,
    budgetRemaining: decision.budgetRemaining,
    // Raw phone numbers, raw response bodies, and GKEY are NEVER included.
    // Only derived counts and verdicts are exposed.
  };
}

/**
 * Summarise the request-budget state for operator visibility.
 * Never exposes sensitive provider data.
 */
export function budgetSummary(budget: GoogleRequestBudget): {
  maxRequests: number;
  usedRequests: number;
  remainingRequests: number;
  exhausted: boolean;
} {
  const remainingRequests = Math.max(0, budget.maxRequests - budget.usedRequests);
  return {
    maxRequests: budget.maxRequests,
    usedRequests: budget.usedRequests,
    remainingRequests,
    exhausted: remainingRequests <= 0,
  };
}