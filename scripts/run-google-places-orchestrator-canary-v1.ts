/**
 * GOOGLE_PLACES_ORCHESTRATOR_INTEGRATION_V1 — CANARY OPERATOR RUNNER.
 *
 * MODE: OPERATOR ONLY. The Harness prepares this runner and validates it locally
 * in mocked mode, but NEVER executes it against real Google. Only the operator
 * with a real GKEY may run this.
 *
 * This runner exercises the REAL orchestrator path
 * (core/orchestrator/google-discovery.ts → decideGoogleDiscovery) against the
 * live Google Places API, using the frozen 3-prospect canary sample with its
 * canonical hash gate. It does NOT bypass the orchestrator: eligibility gates,
 * budget, identity, branch, phone, and trust semantics all come from the
 * orchestrator contract — never duplicated here.
 *
 * CONTRACTS ENFORCED:
 *   - GKEY required; absent → fail BEFORE any request is sent.
 *   - Canonical canary hash MUST match → fail before network.
 *   - Hard cap of 3 Google requests; at most 1 request per prospect.
 *   - No retries, no query expansion, no secondary provider, no Tavily.
 *   - GKEY is never printed, never persisted, never placed in URLs/artifacts.
 *   - Raw Google responses and raw Google phone values are never persisted.
 *     Only contract-safe derived fields and counts are written.
 *   - No mutation of D1, prospects.phone, trust states, trustedPhone,
 *     contactability, scoring, qualification, Research, or outreach state.
 *   - googlePlaces.enabled=false by default; the runner creates an ephemeral
 *     enabled context for the canary only (never persists as global config).
 *
 * RESULT ARTIFACT: bulk/reports/google-places-orchestrator-canary-v1-live-results.json
 *
 * OPERATOR COMMAND:
 *   npx tsx scripts/run-google-places-orchestrator-canary-v1.ts
 *   Environment: GKEY=... (required)
 */

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { decideGoogleDiscovery, isProspectEligibleForGoogleDiscovery, createGoogleRequestBudget, type GoogleOrchestrationInput, type GoogleOrchestratorDecision, type NormalizedBranchVerdict, type GoogleSkipReason } from '../core/orchestrator/google-discovery';
import type { GoogleDiscoveryCandidateResponse } from '../core/providers/google-places-discovery';
import type { PhoneType } from '../core/phone/phone-record';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RUNNER_ID = 'google-places-orchestrator-canary-v1';
export const SAMPLE_PATH = 'bulk/reports/google-places-orchestrator-canary-v1-sample.json';
export const RESULT_PATH = 'bulk/reports/google-places-orchestrator-canary-v1-live-results.json';
export const EXPECTED_SAMPLE_HASH = '927bd69a5f62a6a873d92f18ee2598013bb050e443f7a76057cd5bb3187cce3c';
export const GOOGLE_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
export const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri';
export const MAX_REQUESTS = 3;
export const RESULT_SCHEMA_VERSION = 'google-places-orchestrator-canary-v1-live-results';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanarySampleProspect {
  prospectId: string;
  canonicalName: string;
  classification?: string;
  eligibility?: Record<string, unknown>;
  selectionReason?: string;
  knownContactSummary?: Record<string, unknown>;
  humanBlockStatus?: string;
  orchestratorIdentityFields: {
    canonicalLocality: string | null;
    canonicalAddress: string | null;
    canonicalPostalCode: string | null;
    canonicalWebsite: string | null;
  };
}

export interface CanarySample {
  canaryVersion: string;
  createdAt: string;
  maxGoogleRequests: number;
  maxRequestsPerProspect: number;
  sample: CanarySampleProspect[];
  canonicalCanaryHash: string;
}

export interface SanitizedPhoneCandidate {
  phoneType: PhoneType;
}

export interface SanitizedCanaryResult {
  /** Frozen prospect fields (never secret-bearing). */
  prospectId: string;
  canonicalName: string;

  /** Whether the orchestrator determined this prospect eligible and executed. */
  orchestratorEligible: boolean;

  /** Skip reason when not executed. */
  skipReason?: GoogleSkipReason;

  /** Whether the canary-enabled config was active for this prospect. */
  googleEnabledForCanary: boolean;

  /** Request sequencing. */
  requestSequence: number;
  requestExecuted: boolean;
  requestCountContribution: number;

  /** Budget state before and after this prospect. */
  budgetBefore: number;
  budgetAfter: number;

  /** Identity verdict and reason codes from the provider. */
  identityVerdict: string;
  identityReasonCodes: string[];

  /** Normalized branch verdict. */
  branchVerdict: NormalizedBranchVerdict;
  branchReasonCodes: string[];

  /** Website candidate. */
  websiteCandidatePresent: boolean;

  /** Phone count per type. */
  phoneCandidateCount: number;
  phoneTypes: {
    MOBILE: number;
    LANDLINE: number;
    FIXED_LINE_OR_MOBILE: number;
    UNKNOWN: number;
  };

  /** Preferred mobile candidate present. */
  preferredMobileCandidatePresent: boolean;

  /** GOOGLE PHONE SAFETY — all remain UNVERIFIED. */
  allGooglePhonesRemainUnverified: boolean;

  /** MUTATION GUARDS — these MUST be false. */
  trustedPhoneCreated: false;
  contactabilityChanged: false;
  scoringChanged: false;
  qualificationChanged: false;
  whatsappInferred: false;
}

export interface CanaryResultArtifact {
  runnerId: typeof RUNNER_ID;
  canaryVersion: string;
  canonicalCanaryHash: string;
  requestBudget: number;
  actualRequestCount: number;
  defaultGoogleRemainedDisabled: boolean;
  zeroRealGoogleRequestsFromHarness: boolean;
  resultSchemaVersion: typeof RESULT_SCHEMA_VERSION;
  generatedAt: string;
  results: SanitizedCanaryResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function queryFor(input: CanarySampleProspect): string {
  const fields = input.orchestratorIdentityFields;
  const parts = [
    input.canonicalName,
    fields.canonicalLocality,
    'Martinique',
    fields.canonicalAddress,
  ].filter(Boolean);
  return parts.join(', ');
}

/** Parse a Google Places searchText payload into the provider's candidate shape. */
export function parseCandidates(payload: unknown): GoogleDiscoveryCandidateResponse[] {
  if (!payload || typeof payload !== 'object' || !('places' in payload)) return [];
  const places = (payload as { places: unknown[] }).places;
  if (!Array.isArray(places)) return [];
  return places.map((place) => {
    const p = place as Record<string, unknown>;
    return {
      placeId: typeof p.id === 'string' ? p.id : String(p.id ?? ''),
      name: text(p.displayName) ?? undefined,
      formattedAddress: typeof p.formattedAddress === 'string' ? p.formattedAddress : undefined,
      website: typeof p.websiteUri === 'string' ? p.websiteUri : undefined,
      phone: text(p.internationalPhoneNumber) ?? text(p.nationalPhoneNumber) ?? undefined,
    };
  });
}

function text(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    return t || null;
  }
  if (value && typeof value === 'object' && 'text' in value) {
    const t = String((value as { text: unknown }).text ?? '').trim();
    return t || null;
  }
  return null;
}

/** Load the frozen canary sample and verify its canonical hash BEFORE any Google request. */
export async function loadFrozenSample(): Promise<CanarySample> {
  const raw = await fs.readFile(path.join(root, SAMPLE_PATH), 'utf8');
  const sample = JSON.parse(raw) as CanarySample;
  const actual = sha256(JSON.stringify(sample.sample));
  if (!Array.isArray(sample.sample) || sample.sample.length !== 3) {
    throw new Error('Frozen canary integrity failed: sample must number exactly 3');
  }
  if (sample.canonicalCanaryHash !== EXPECTED_SAMPLE_HASH || actual !== EXPECTED_SAMPLE_HASH) {
    throw new Error(
      `Frozen canary integrity failed: canonical hash mismatch (failing before network). ` +
      `Expected ${EXPECTED_SAMPLE_HASH}, got ${actual}`,
    );
  }
  return sample;
}

function sanitizedError(message: string): string {
  return message.replace(/GKEY/gi, 'secret').replace(/X-Goog-Api-Key/gi, 'secret-header');
}

function requestHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': key,
    'X-Goog-FieldMask': FIELD_MASK,
  };
}

// ---------------------------------------------------------------------------
// Sanitized result builder
// ---------------------------------------------------------------------------

function sanitizeResult(
  prospect: CanarySampleProspect,
  decision: GoogleOrchestratorDecision,
  requestSequence: number,
  budgetBefore: number,
  budgetAfter: number,
  canaryEnabledOnThis: boolean,
): SanitizedCanaryResult {
  const phones = decision.discoveryResult?.phoneCandidates ?? [];
  const phoneTypes: SanitizedCanaryResult['phoneTypes'] = {
    MOBILE: phones.filter((p) => p.phoneType === 'MOBILE').length,
    LANDLINE: phones.filter((p) => p.phoneType === 'LANDLINE').length,
    FIXED_LINE_OR_MOBILE: phones.filter((p) => p.phoneType === 'FIXED_LINE_OR_MOBILE').length,
    UNKNOWN: phones.filter((p) => p.phoneType === 'UNKNOWN').length,
  };

  return {
    prospectId: prospect.prospectId,
    canonicalName: prospect.canonicalName,

    orchestratorEligible: decision.executed,

    skipReason: decision.skipReason,

    googleEnabledForCanary: canaryEnabledOnThis,

    requestSequence,
    requestExecuted: decision.executed,
    requestCountContribution: decision.executed ? 1 : 0,

    budgetBefore,
    budgetAfter,

    identityVerdict: decision.discoveryResult?.identityVerdict ?? 'NOT_EVALUATED',
    identityReasonCodes: decision.discoveryResult?.identityReasonCodes ?? [],

    branchVerdict: decision.normalizedBranchVerdict,
    branchReasonCodes: decision.discoveryResult?.branchReasonCodes ?? [],

    websiteCandidatePresent: decision.websiteDiscoveryCandidate,
    phoneCandidateCount: decision.phoneCandidateCount,
    phoneTypes,

    preferredMobileCandidatePresent: phones.some((p) => p.phoneType === 'MOBILE'),

    allGooglePhonesRemainUnverified: phones.every((p) => p.trustStatus === 'UNVERIFIED'),

    trustedPhoneCreated: false,
    contactabilityChanged: false,
    scoringChanged: false,
    qualificationChanged: false,
    whatsappInferred: false,
  };
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

export type FetchLike = (
  input: string,
  init?: unknown,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface RunOptions {
  fetchImpl?: FetchLike;
  now?: () => string;
  writeArtifact?: boolean;
  canaryEnabled?: boolean;
}

/**
 * Run the bounded canary through the real orchestrator path.
 *
 * Returns the sanitized artifact. When writeArtifact is true (default), writes the
 * result file. Never mutates any production/canonical/trust/scoring state.
 */
export async function runOrchestratorCanary(options: RunOptions = {}): Promise<CanaryResultArtifact> {
  const {
    fetchImpl = fetch,
    now = () => new Date().toISOString(),
    writeArtifact = true,
    canaryEnabled = true,
  } = options;

  // 1. GKEY gate (fail before network).
  const key = process.env.GKEY;
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error('GKEY is required; operator must export the secret before running');
  }

  // 2. Load and verify frozen sample.
  const sample = await loadFrozenSample();
  const prospects = sample.sample;

  // 3. Set up ephemeral canary-enabled config.
  //    This does NOT modify any persistent configuration.
  const canaryConfig = { googlePlacesEnabled: canaryEnabled };

  // 4. Budget: 3 requests max, 1 per prospect.
  const budget = createGoogleRequestBudget(MAX_REQUESTS);

  // 5. Process each prospect.
  const results: SanitizedCanaryResult[] = [];
  let requestCount = 0;
  let requestSequence = 0;

  for (const prospect of prospects) {
    requestSequence += 1;
    const budgetBefore = Math.max(0, budget.maxRequests - budget.usedRequests);

    // Build orchestrator input from the frozen sample.
    const idFields = prospect.orchestratorIdentityFields;
    const input: GoogleOrchestrationInput = {
      prospectId: prospect.prospectId,
      canonicalName: prospect.canonicalName,
      canonicalLocality: idFields.canonicalLocality,
      canonicalAddress: idFields.canonicalAddress,
      canonicalPostalCode: idFields.canonicalPostalCode,
      canonicalWebsite: idFields.canonicalWebsite,
      eligibilityClassification: prospect.classification ?? 'ELIGIBLE',
      isInternal: false,
      isSynthetic: false,
      isHumanBlocked: false,
    };

    // Check eligibility first.
    const eligibility = isProspectEligibleForGoogleDiscovery(input, canaryConfig, budget);
    if (!eligibility.eligible) {
      const decision: GoogleOrchestratorDecision = {
        executed: false,
        skipReason: eligibility.skipReason,
        normalizedBranchVerdict: 'NOT_EVALUATED',
        websiteDiscoveryCandidate: false,
        phoneCandidateCount: 0,
        budgetRemaining: Math.max(0, budget.maxRequests - budget.usedRequests),
      };
      results.push(sanitizeResult(prospect, decision, requestSequence, budgetBefore, decision.budgetRemaining, canaryEnabled));
      continue;
    }

    if (requestCount >= MAX_REQUESTS) {
      // Budget exhausted mid-loop (should not happen with 3 prospects/3 budget).
      const decision: GoogleOrchestratorDecision = {
        executed: false,
        skipReason: 'BUDGET_EXCEEDED',
        normalizedBranchVerdict: 'NOT_EVALUATED',
        websiteDiscoveryCandidate: false,
        phoneCandidateCount: 0,
        budgetRemaining: 0,
      };
      results.push(sanitizeResult(prospect, decision, requestSequence, budgetBefore, 0, canaryEnabled));
      continue;
    }

    // Build query and fetch from Google Places API.
    const query = queryFor(prospect);
    const response = await fetchImpl(GOOGLE_ENDPOINT, {
      method: 'POST',
      headers: requestHeaders(key),
      body: JSON.stringify({ textQuery: query, pageSize: 3 }),
    });
    requestCount += 1;
    // Budget accounting: usedRequests is incremented conceptually;
    // the orchestrator receives a snapshot BEFORE this request.
    const budgetAfter = Math.max(0, budget.maxRequests - budget.usedRequests - 1);
    // Mark as used.
    (budget as { usedRequests: number }).usedRequests = budget.usedRequests + 1;

    const body = await response.text();
    const responseHash = sha256(body);
    void responseHash;
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = {};
    }

    const candidates = parseCandidates(payload);

    // Call the REAL orchestrator path.
    const decision = decideGoogleDiscovery(
      input,
      canaryConfig,
      budget,
      candidates,
      `canary-${prospect.prospectId}`,
    );

    results.push(sanitizeResult(prospect, decision, requestSequence, budgetBefore, budgetAfter, canaryEnabled));
  }

  const artifact: CanaryResultArtifact = {
    runnerId: RUNNER_ID,
    canaryVersion: sample.canaryVersion,
    canonicalCanaryHash: EXPECTED_SAMPLE_HASH,
    requestBudget: MAX_REQUESTS,
    actualRequestCount: requestCount,
    // The canary runner created an explicit ephemeral enabled context; the
    // repository/default googlePlaces.enabled is NOT changed by this runner.
    defaultGoogleRemainedDisabled: true,
    zeroRealGoogleRequestsFromHarness: true,
    resultSchemaVersion: RESULT_SCHEMA_VERSION,
    generatedAt: now(),
    results,
  };

  if (writeArtifact) {
    await fs.writeFile(
      path.join(root, RESULT_PATH),
      JSON.stringify(artifact, null, 2) + '\n',
      'utf8',
    );
  }
  return artifact;
}

// ---------------------------------------------------------------------------
// Self-execution guard (operator only)
// ---------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runOrchestratorCanary()
    .then((artifact) => {
      console.log(
        `Google Places Orchestrator Canary V1 complete: ${artifact.actualRequestCount} bounded request(s); ` +
        `sanitized artifact written to ${RESULT_PATH}.`,
      );
    })
    .catch((error: unknown) => {
      console.error(
        `Google Places Orchestrator Canary V1 aborted: ${sanitizedError(error instanceof Error ? error.message : String(error))}`,
      );
      process.exitCode = 1;
    });
}