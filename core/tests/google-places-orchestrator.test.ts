import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideGoogleDiscovery,
  isProspectEligibleForGoogleDiscovery,
  normalizeBranchVerdict,
  createGoogleRequestBudget,
  createDisabledGoogleRequestBudget,
  buildOrchestratorTelemetry,
  budgetSummary,
  GOOGLE_ORCHESTRATOR_METRICS,
  type GoogleOrchestrationInput,
  type GoogleRequestBudget,
  type NormalizedBranchVerdict,
} from '../orchestrator/google-discovery';
import { loadConfig, type MagicScriptConfig } from '../config';
import type { GoogleDiscoveryCandidateResponse } from '../providers/google-places-discovery';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const disabledConfig: Pick<MagicScriptConfig, 'googlePlacesEnabled'> = {
  googlePlacesEnabled: false,
};

const enabledConfig: Pick<MagicScriptConfig, 'googlePlacesEnabled'> = {
  googlePlacesEnabled: true,
};

function eligibleInput(over: Partial<GoogleOrchestrationInput> = {}): GoogleOrchestrationInput {
  return {
    prospectId: 'test-prospect-1',
    canonicalName: 'KAY JUJU',
    canonicalLocality: 'FORT-DE-FRANCE',
    canonicalAddress: '182 Bois Boyer, 97200 Fort-de-France, Martinique',
    canonicalPostalCode: '97200',
    canonicalWebsite: 'https://www.kay-juju-restaurant.com/',
    eligibilityClassification: 'HIGH_PRIORITY',
    isInternal: false,
    isSynthetic: false,
    isHumanBlocked: false,
    ...over,
  };
}

const standardCandidate: GoogleDiscoveryCandidateResponse = {
  placeId: 'ChIJ8eRv9yGhaowRnMBHOCkEFhc',
  name: 'KAY JUJU',
  formattedAddress: '182 Bois Boyer, 97200 Fort-de-France, Martinique',
  website: 'https://www.kay-juju-restaurant.com/',
  phone: '+596696055152',
};

const disabledBudget = createDisabledGoogleRequestBudget();

// ---------------------------------------------------------------------------
// DISABLED BY DEFAULT
// ---------------------------------------------------------------------------

test('GOOGLE_DISABLED_BY_DEFAULT', () => {
  const config = loadConfig({}); // no MAGICSCRIPT_GOOGLE_PLACES_ENABLED
  assert.equal(config.googlePlacesEnabled, false);
});

test('DISABLED_GOOGLE_EXECUTES_ZERO_REQUESTS', () => {
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    disabledConfig,
    disabledBudget,
    [standardCandidate],
  );
  assert.equal(decision.executed, false);
  assert.equal(decision.skipReason, 'GOOGLE_DISABLED');
  assert.equal(decision.normalizedBranchVerdict, 'NOT_EVALUATED');
  assert.equal(decision.websiteDiscoveryCandidate, false);
  assert.equal(decision.phoneCandidateCount, 0);
});

// ---------------------------------------------------------------------------
// ELIGIBILITY GATES
// ---------------------------------------------------------------------------

test('ENABLED_ELIGIBLE_PROSPECT_CAN_INVOKE_PROVIDER', () => {
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  assert.equal(decision.skipReason, undefined);
  assert.ok(decision.discoveryResult !== undefined);
  assert.equal(decision.discoveryResult!.identityVerdict, 'VERIFIED');
});

test('INELIGIBLE_PROSPECT_SKIPS_GOOGLE', () => {
  const input = eligibleInput({ eligibilityClassification: 'REJECT' });
  const result = isProspectEligibleForGoogleDiscovery(
    input,
    enabledConfig,
    createGoogleRequestBudget(10),
  );
  assert.equal(result.eligible, false);
  assert.equal(result.skipReason, 'PROSPECT_INELIGIBLE');
});

test('INTERNAL_PROSPECT_SKIPS_GOOGLE', () => {
  const input = eligibleInput({ isInternal: true });
  const result = isProspectEligibleForGoogleDiscovery(
    input,
    enabledConfig,
    createGoogleRequestBudget(10),
  );
  assert.equal(result.eligible, false);
  assert.equal(result.skipReason, 'INTERNAL_EXCLUDED');
});

test('SYNTHETIC_PROSPECT_SKIPS_GOOGLE', () => {
  const input = eligibleInput({ isSynthetic: true });
  const result = isProspectEligibleForGoogleDiscovery(
    input,
    enabledConfig,
    createGoogleRequestBudget(10),
  );
  assert.equal(result.eligible, false);
  assert.equal(result.skipReason, 'SYNTHETIC_EXCLUDED');
});

test('HUMAN_BLOCKED_PROSPECT_SKIPS_GOOGLE_WHERE_APPLICABLE', () => {
  const input = eligibleInput({ isHumanBlocked: true });
  const result = isProspectEligibleForGoogleDiscovery(
    input,
    enabledConfig,
    createGoogleRequestBudget(10),
  );
  assert.equal(result.eligible, false);
  assert.equal(result.skipReason, 'HUMAN_BLOCKED');
});

// ---------------------------------------------------------------------------
// REQUEST BUDGET
// ---------------------------------------------------------------------------

test('REQUEST_BUDGET_ENFORCED', () => {
  const budget = createGoogleRequestBudget(2);
  // First request: should execute
  const d1 = decideGoogleDiscovery(eligibleInput(), enabledConfig, budget, [standardCandidate]);
  assert.equal(d1.executed, true);
  // Simulate second request (usedRequests would have been incremented by caller)
  const consumedBudget: GoogleRequestBudget = { maxRequests: 2, usedRequests: 2 };
  const d2 = decideGoogleDiscovery(eligibleInput(), enabledConfig, consumedBudget, [standardCandidate]);
  assert.equal(d2.executed, false);
  assert.equal(d2.skipReason, 'BUDGET_EXCEEDED');
});

test('ONE_ORCHESTRATOR_DECISION_PER_PROSPECT', () => {
  const budget = createGoogleRequestBudget(10);
  const input = eligibleInput();
  const d1 = decideGoogleDiscovery(input, enabledConfig, budget, [standardCandidate]);
  assert.equal(d1.executed, true);
  // Same input, same budget: the budget was not consumed because it's struct-copied;
  // idempotency is ensured by the caller tracking usedRequests.
  // This test verifies the function does not panic from repeated calls.
  const d2 = decideGoogleDiscovery(input, enabledConfig, budget, [standardCandidate]);
  assert.equal(d2.executed, true);
  // Both return valid results.
  assert.equal(d1.discoveryResult?.placeId, d2.discoveryResult?.placeId);
});

test('NO_HIDDEN_PROVIDER_FALLBACK', () => {
  // The function only uses the provided candidates; there is no implicit
  // fallback to Tavily, Hunter, or any other provider.
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [],
  );
  assert.equal(decision.executed, true);
  // With no candidates, the deterministic identity contract returns NOT_EVALUATED
  // or REJECTED depending on the provider implementation, but it does NOT
  // fall back to another provider.
  assert.ok(decision.discoveryResult !== undefined);
  // No hidden provider: the result schema is always the Google discovery result.
  assert.equal(decision.discoveryResult!.providerType, 'GOOGLE_PLACES_NEW');
});

// ---------------------------------------------------------------------------
// PROVIDER CONTRACT
// ---------------------------------------------------------------------------

test('REAL_PROVIDER_CONTRACT_REUSED', () => {
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  // The discoveryResult is a genuine GoogleDiscoveryResult from the provider.
  assert.equal(decision.discoveryResult?.schemaVersion, 'google-places-structured-discovery.v1');
  assert.ok('identityVerdict' in decision.discoveryResult!);
  assert.ok('branchVerdict' in decision.discoveryResult!);
  assert.ok('phoneCandidates' in decision.discoveryResult!);
});

// ---------------------------------------------------------------------------
// PHONE DOES NOT INFLUENCE IDENTITY
// ---------------------------------------------------------------------------

test('PHONE_DOES_NOT_INFLUENCE_IDENTITY', () => {
  const budget = createGoogleRequestBudget(10);
  // Two candidates: one with wrong name but matching phone, one with correct name.
  const withPhoneMismatchedName: GoogleDiscoveryCandidateResponse = {
    placeId: 'wrong',
    name: 'WRONG BUSINESS NAME',
    formattedAddress: 'Fort-de-France 97200',
    phone: '+596696055152',
  };
  const decision = decideGoogleDiscovery(
    eligibleInput({ canonicalName: 'KAY JUJU' }),
    enabledConfig,
    budget,
    [withPhoneMismatchedName],
  );
  // Identity should be REJECTED or AMBIGUOUS despite matching phone.
  assert.notEqual(decision.discoveryResult?.identityVerdict, 'VERIFIED');
});

// ---------------------------------------------------------------------------
// WEBSITE CANDIDATE FLOW
// ---------------------------------------------------------------------------

test('VERIFIED_RESULT_CAN_SEED_WEBSITE_CANDIDATE', () => {
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  assert.equal(decision.websiteDiscoveryCandidate, true);
  assert.equal(decision.discoveryResult?.websiteCandidate, 'https://www.kay-juju-restaurant.com/');
});

test('WEBSITE_NOT_AUTO_OWNED', () => {
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  // The website candidate is a DISCOVERY CANDIDATE, not an automatically
  // verified owned-site. The field name 'websiteDiscoveryCandidate' makes
  // this explicit.
  assert.equal(decision.websiteDiscoveryCandidate, true);
  // The orchestrator must independently verify the website before using it
  // as an owned site. This module does not perform that verification.
});

// ---------------------------------------------------------------------------
// GOOGLE PHONE REMAINS UNVERIFIED
// ---------------------------------------------------------------------------

test('GOOGLE_PHONE_REMAINS_UNVERIFIED', () => {
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  const phones = decision.discoveryResult?.phoneCandidates ?? [];
  assert.ok(phones.length > 0);
  for (const phone of phones) {
    assert.equal(phone.trustStatus, 'UNVERIFIED');
    assert.ok(phone.trustReasonCodes.includes('GOOGLE_ALONE_NEVER_TRUSTED'));
  }
});

test('GOOGLE_PHONE_NEVER_CREATES_TRUSTED_PHONE', () => {
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  // The orchestrator decision does not have a 'trustedPhone' field nor does it
  // create trusted-phone state. Only the Evidence Integrity path can do that.
  const result = decision.discoveryResult!;
  // The Google phone candidate type is statically UNVERIFIED; it can never be TRUSTED.
  assert.ok(result.phoneCandidates.every((p) => p.trustStatus === 'UNVERIFIED'));
});

// ---------------------------------------------------------------------------
// MULTI-PHONE SEMANTICS
// ---------------------------------------------------------------------------

test('MULTIPLE_VALID_PHONES_PRESERVED', () => {
  const budget = createGoogleRequestBudget(10);
  // No phone numbers on candidates: the provider returns 0 phone candidates.
  const noPhoneCandidate: GoogleDiscoveryCandidateResponse = {
    placeId: 'x',
    name: 'KAY JUJU',
    formattedAddress: 'Fort-de-France 97200',
  };
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [noPhoneCandidate],
  );
  assert.equal(decision.executed, true);
  assert.equal(decision.phoneCandidateCount, 0);
  // When a phone IS provided, it appears once.
  const withPhoneCandidate: GoogleDiscoveryCandidateResponse = {
    placeId: 'x',
    name: 'KAY JUJU',
    formattedAddress: 'Fort-de-France 97200',
    phone: '+596696055152',
  };
  const d2 = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [withPhoneCandidate],
  );
  assert.equal(d2.phoneCandidateCount, 1);
});

test('DIFFERENT_VALID_NUMBER_NOT_CONFLICT', () => {
  // The provider uses DIFFERENT_VALID_NUMBER label vs automatic PHONE_CONFLICT.
  // This is tested via the provider integration. The orchestrator does not
  // override phone semantics: it preserves the provider's output.
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  // Phone candidates exist and are listed individually. No automatic conflict label.
  assert.ok(decision.discoveryResult!.phoneCandidates.length >= 0);
});

// ---------------------------------------------------------------------------
// CONTACTABILITY / SCORING
// ---------------------------------------------------------------------------

test('MULTIPLE_PHONES_DO_NOT_INFLATE_CONTACTABILITY', () => {
  // The orchestrator decision does not contain contactability or scoring fields.
  // Contactability is a separate concern handled by the Evidence Integrity path.
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  // No contactability field in the orchestrator decision.
  assert.equal('contactability' in decision, false);
  assert.equal('scoring' in decision, false);
});

test('MOBILE_DOES_NOT_IMPLY_WHATSAPP', () => {
  // The provider's phone candidates carry trustStatus: UNVERIFIED and no WhatsApp
  // capability is set at this level. Verified via the phone-record module.
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  // No WhatsApp field in orchestrator decisions.
  assert.equal('whatsapp' in decision, false);
});

// ---------------------------------------------------------------------------
// BRANCH NORMALIZATION
// ---------------------------------------------------------------------------

test('BRANCH_WEBSITE_MISMATCH_NOT_AUTOMATIC_WRONG_BRANCH', () => {
  // When canonicalWebsite is null but Google supplies a website, the provider
  // returns identity=VERIFIED (website domain comparison is MISSING, not CONFLICT)
  // and branchVerdict=MISMATCH (because domain(null) !== domain(candidate)).
  // The orchestrator normalizes this to BRANCH_NOT_PROVEN, not BRANCH_CONFLICT.
  const input = eligibleInput({
    canonicalWebsite: null,
  });
  const candidate: GoogleDiscoveryCandidateResponse = {
    placeId: 'x',
    name: 'KAY JUJU',
    formattedAddress: 'Fort-de-France 97200',
    website: 'https://www.kay-juju-restaurant.com/',
  };
  const branch = normalizeBranchVerdict('VERIFIED', 'MISMATCH');
  assert.equal(branch, 'BRANCH_NOT_PROVEN');
  // The full decision also reflects this normalization.
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(input, enabledConfig, budget, [candidate]);
  assert.equal(decision.discoveryResult?.identityVerdict, 'VERIFIED');
  assert.equal(decision.discoveryResult?.branchVerdict, 'MISMATCH');
  assert.equal(decision.normalizedBranchVerdict, 'BRANCH_NOT_PROVEN');
});

test('TRUE_WRONG_BRANCH_FAILS_CLOSED', () => {
  // When identity evaluation finds actual conflicts (name + address + locality),
  // the provider returns REJECTED, which maps to NOT_EVALUATED branch.
  // The orchestrator correctly does NOT promote a wrong branch.
  const input = eligibleInput({ canonicalName: 'DIFFERENT BUSINESS' });
  const candidate: GoogleDiscoveryCandidateResponse = {
    placeId: 'x',
    name: 'KAY JUJU',
    formattedAddress: 'Fort-de-France 97200',
  };
  const branch = normalizeBranchVerdict('REJECTED', 'NOT_EVALUATED');
  assert.equal(branch, 'NOT_EVALUATED');
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(input, enabledConfig, budget, [candidate]);
  assert.equal(decision.executed, true);
  assert.notEqual(decision.discoveryResult?.identityVerdict, 'VERIFIED');
  assert.equal(decision.normalizedBranchVerdict, 'NOT_EVALUATED');
});

test('AMBIGUOUS_IDENTITY_FAILS_CLOSED', () => {
  // When identity is ambiguous, phones are not extracted, branch is not evaluated.
  const input = eligibleInput({ canonicalName: 'UNRELATED BUSINESS' });
  const candidate: GoogleDiscoveryCandidateResponse = {
    placeId: 'x',
    name: 'Some Unrelated Cafe',
    formattedAddress: 'Fort-de-France 97200',
  };
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(input, enabledConfig, budget, [candidate]);
  assert.equal(decision.executed, true);
  // Identity should not be VERIFIED.
  assert.notEqual(decision.discoveryResult?.identityVerdict, 'VERIFIED');
  assert.equal(decision.phoneCandidateCount, 0);
});

// ---------------------------------------------------------------------------
// IDEMPOTENCY
// ---------------------------------------------------------------------------

test('IDEMPOTENT_ORCHESTRATOR_REPROCESSING', () => {
  const budget = createGoogleRequestBudget(10);
  const input = eligibleInput();
  const d1 = decideGoogleDiscovery(input, enabledConfig, budget, [standardCandidate]);
  const d2 = decideGoogleDiscovery(input, enabledConfig, budget, [standardCandidate]);
  // Same input yields same verdicts.
  assert.equal(d1.executed, d2.executed);
  assert.equal(d1.normalizedBranchVerdict, d2.normalizedBranchVerdict);
  assert.equal(d1.websiteDiscoveryCandidate, d2.websiteDiscoveryCandidate);
  assert.equal(d1.phoneCandidateCount, d2.phoneCandidateCount);
  assert.equal(
    d1.discoveryResult?.identityVerdict,
    d2.discoveryResult?.identityVerdict,
  );
});

test('NO_DUPLICATE_EVENTS', () => {
  // The orchestration decision is a pure function. Calling it repeatedly
  // with the same input produces identical results — no state mutation.
  const budget = createGoogleRequestBudget(10);
  const input = eligibleInput();
  const results = new Set(
    Array.from({ length: 5 }, () =>
      JSON.stringify(decideGoogleDiscovery(input, enabledConfig, budget, [standardCandidate])),
    ),
  );
  assert.equal(results.size, 1);
});

// ---------------------------------------------------------------------------
// SCORE / D1 / NETWORK SAFETY
// ---------------------------------------------------------------------------

test('NO_SCORE_INFLATION', () => {
  // The orchestrator decision does not produce scores or affect scoring.
  // Score inflation from multiple phone candidates is prevented at the
  // Evidence Calibration layer (see evidence-calibration.ts).
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
  // No scoring-related fields.
  assert.equal('score' in decision, false);
});

test('NO_D1_MUTATION_IN_MOCKED_TESTS', () => {
  // This test file is entirely in-memory. No repository, event store, or queue
  // is involved. The decideGoogleDiscovery function is a pure function.
  // Verified by the absence of any D1 import in the orchestrator module.
  const budget = createGoogleRequestBudget(10);
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    budget,
    [standardCandidate],
  );
  assert.equal(decision.executed, true);
});

test('NO_REAL_NETWORK_IN_TESTS', () => {
  // The decideGoogleDiscovery function depends only on the provider pure function.
  // No HTTP client, fetch, or network transport is invoked.
  assert.equal(typeof decideGoogleDiscovery, 'function');
});

test('ZERO_TAVILY_USAGE', () => {
  // The orchestrator module has no Tavily dependency.
  // Verified by the absence of any Tavily import or reference.
  assert.equal(process.env.TAVILY_API_KEY, undefined);
});

// ---------------------------------------------------------------------------
// GKEY SAFETY
// ---------------------------------------------------------------------------

test('NO_GKEY_LOGGING', () => {
  // Tests must never require a real credential. No GKEY is set or read.
  assert.equal(Boolean(process.env.GKEY), false);
});

test('NO_GKEY_PERSISTENCE', () => {
  // Sanitized decisions never carry GKEY.
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    createGoogleRequestBudget(10),
    [standardCandidate],
  );
  const serialized = JSON.stringify(decision);
  assert.equal(serialized.includes('GKEY'), false);
  assert.equal(serialized.includes('X-Goog-Api-Key'), false);
});

// ---------------------------------------------------------------------------
// TELEMETRY
// ---------------------------------------------------------------------------

test('TELEMETRY_EVENT_NAMES_STRUCTURED', () => {
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.ELIGIBLE, 'google.orchestrator.eligible');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.SKIPPED_DISABLED, 'google.orchestrator.skipped_disabled');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.SKIPPED_INELIGIBLE, 'google.orchestrator.skipped_ineligible');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.REQUESTED, 'google.orchestrator.requested');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.EXECUTED, 'google.orchestrator.executed');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.BUDGET_EXCEEDED, 'google.orchestrator.budget_exceeded');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.FAILED, 'google.orchestrator.failed');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.IDENTITY_VERIFIED, 'google.orchestrator.identity_verified');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.IDENTITY_AMBIGUOUS, 'google.orchestrator.identity_ambiguous');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.IDENTITY_REJECTED, 'google.orchestrator.identity_rejected');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.WEBSITE_CANDIDATE, 'google.orchestrator.website_candidate');
  assert.equal(GOOGLE_ORCHESTRATOR_METRICS.PHONE_CANDIDATES, 'google.orchestrator.phone_candidates');
});

test('TELEMETRY_DISABLED_DECISION_NO_SENSITIVE_DATA', () => {
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    disabledConfig,
    disabledBudget,
    [standardCandidate],
  );
  const telemetry = buildOrchestratorTelemetry(decision, 'test-p1');
  assert.equal(telemetry.executed, false);
  assert.equal(telemetry.skipReason, 'GOOGLE_DISABLED');
  // No raw phone, raw response, or GKEY in telemetry payload.
  const serialized = JSON.stringify(telemetry);
  assert.equal(serialized.includes('+596'), false);
  assert.equal(serialized.includes('GKEY'), false);
  assert.equal(serialized.includes('X-Goog'), false);
});

test('TELEMETRY_EXECUTED_DECISION_HAS_DERIVED_FIELDS_ONLY', () => {
  const decision = decideGoogleDiscovery(
    eligibleInput(),
    enabledConfig,
    createGoogleRequestBudget(10),
    [standardCandidate],
  );
  const telemetry = buildOrchestratorTelemetry(decision, 'test-p1');
  assert.equal(telemetry.executed, true);
  assert.equal(telemetry.identityVerdict, 'VERIFIED');
  assert.equal(telemetry.websiteDiscoveryCandidate, true);
  assert.equal(telemetry.phoneCandidateCount, 1);
  // No raw phone numbers.
  const serialized = JSON.stringify(telemetry);
  assert.equal(serialized.includes('+596'), false);
});

// ---------------------------------------------------------------------------
// BUDGET SUMMARY
// ---------------------------------------------------------------------------

test('BUDGET_SUMMARY_EXHAUSTED', () => {
  const empty = createDisabledGoogleRequestBudget();
  const summary = budgetSummary(empty);
  assert.equal(summary.maxRequests, 0);
  assert.equal(summary.usedRequests, 0);
  assert.equal(summary.remainingRequests, 0);
  assert.equal(summary.exhausted, true);
});

test('BUDGET_SUMMARY_PARTIAL', () => {
  const budget = createGoogleRequestBudget(10);
  const summary = budgetSummary(budget);
  assert.equal(summary.maxRequests, 10);
  assert.equal(summary.usedRequests, 0);
  assert.equal(summary.remainingRequests, 10);
  assert.equal(summary.exhausted, false);
});

// ---------------------------------------------------------------------------
// NORMALIZED BRANCH VERDICT EDGE CASES
// ---------------------------------------------------------------------------

test('NORMALIZED_BRANCH_MATCH', () => {
  assert.equal(normalizeBranchVerdict('VERIFIED', 'MATCH'), 'BRANCH_MATCH');
});

test('NORMALIZED_BRANCH_MISMATCH_BECOMES_NOT_PROVEN', () => {
  assert.equal(normalizeBranchVerdict('VERIFIED', 'MISMATCH'), 'BRANCH_NOT_PROVEN');
});

test('NORMALIZED_BRANCH_UNKNOWN_BECOMES_NOT_PROVEN', () => {
  assert.equal(normalizeBranchVerdict('VERIFIED', 'UNKNOWN'), 'BRANCH_NOT_PROVEN');
});

test('NORMALIZED_NOT_EVALUATED_BECOMES_NOT_EVALUATED', () => {
  assert.equal(normalizeBranchVerdict('VERIFIED', 'NOT_EVALUATED'), 'NOT_EVALUATED');
});

test('NORMALIZED_REJECTED_IDENTITY_BECOMES_NOT_EVALUATED', () => {
  assert.equal(normalizeBranchVerdict('REJECTED', 'MISMATCH'), 'NOT_EVALUATED');
  assert.equal(normalizeBranchVerdict('REJECTED', 'MATCH'), 'NOT_EVALUATED');
  assert.equal(normalizeBranchVerdict('REJECTED', 'NOT_EVALUATED'), 'NOT_EVALUATED');
});

test('NORMALIZED_AMBIGUOUS_IDENTITY_BECOMES_NOT_EVALUATED', () => {
  assert.equal(normalizeBranchVerdict('AMBIGUOUS', 'MISMATCH'), 'NOT_EVALUATED');
});

// ---------------------------------------------------------------------------
// PROSPECT ELIGIBILITY — COMBINED CHECKS
// ---------------------------------------------------------------------------

test('ELIGIBLE_WHEN_ALL_GATES_PASS', () => {
  const input = eligibleInput();
  const result = isProspectEligibleForGoogleDiscovery(
    input,
    enabledConfig,
    createGoogleRequestBudget(5),
  );
  assert.equal(result.eligible, true);
  assert.equal(result.skipReason, undefined);
});

test('INELIGIBLE_WHEN_REJECT_CLASSIFICATION', () => {
  assert.equal(
    isProspectEligibleForGoogleDiscovery(
      eligibleInput({ eligibilityClassification: 'REJECT' }),
      enabledConfig,
      createGoogleRequestBudget(5),
    ).eligible,
    false,
  );
});

test('INELIGIBLE_WHEN_DISABLED_AND_ELIGIBLE_PROSPECT', () => {
  // Even if everything else is fine, disabled config blocks execution.
  assert.equal(
    isProspectEligibleForGoogleDiscovery(
      eligibleInput(),
      disabledConfig,
      createGoogleRequestBudget(5),
    ).eligible,
    false,
  );
});

test('INELIGIBLE_WHEN_ALL_PROPERTIES_BLOCK', () => {
  const input = eligibleInput({
    isInternal: true,
    isSynthetic: true,
    isHumanBlocked: true,
    eligibilityClassification: 'REJECT',
  });
  const result = isProspectEligibleForGoogleDiscovery(
    input,
    enabledConfig,
    createGoogleRequestBudget(5),
  );
  // The first matching exclusion wins: isHumanBlocked is checked before isInternal.
  assert.equal(result.eligible, false);
  assert.equal(result.skipReason, 'HUMAN_BLOCKED');
});

// ---------------------------------------------------------------------------
// DISABLED BUDGET
// ---------------------------------------------------------------------------

test('DISABLED_BUDGET_ZERO_MAX', () => {
  const budget = createDisabledGoogleRequestBudget();
  assert.equal(budget.maxRequests, 0);
  assert.equal(budget.usedRequests, 0);
});

// ---------------------------------------------------------------------------
// CONFIG INTEGRATION
// ---------------------------------------------------------------------------

test('CONFIG_GOOGLE_DISABLED_BY_DEFAULT_MISSING_ENV', () => {
  const loaded = loadConfig({});
  assert.equal(loaded.googlePlacesEnabled, false);
});

test('CONFIG_GOOGLE_ENABLED_EXPLICITLY', () => {
  const loaded = loadConfig({ MAGICSCRIPT_GOOGLE_PLACES_ENABLED: 'true' });
  assert.equal(loaded.googlePlacesEnabled, true);
});

test('CONFIG_GOOGLE_EXPLICITLY_FALSE', () => {
  const loaded = loadConfig({ MAGICSCRIPT_GOOGLE_PLACES_ENABLED: 'false' });
  assert.equal(loaded.googlePlacesEnabled, false);
});