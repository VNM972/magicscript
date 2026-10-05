/**
 * GOOGLE_PLACES_STRUCTURED_DISCOVERY_V1 — BOUNDED LIVE VALIDATION OPERATOR RUNNER.
 *
 * MODE: PREPARE + LOCAL VALIDATION. This runner is executed ONLY by an operator
 * with a real GKEY. The Harness prepares it, validates it locally in mocked mode,
 * and stops before any real Google execution.
 *
 * The runner exercises the REAL adapter path (core/providers/google-places-discovery.ts)
 * against the live Google Places API, using the SAME frozen 10-control V3 sample with
 * its canonical hash gate. No duplicate business logic: identity binding, branch binding,
 * phone typing, and trust semantics all come from the adapter and the phone model.
 *
 * CONTRACTS ENFORCED HERE (never weakened by the adapter):
 *   - GKEY required; absent -> fail BEFORE any request is sent.
 *   - Canonical controls hash MUST match 14dbf9dc... -> fail before network.
 *   - Hard cap of 10 Google requests; at most 1 request per control.
 *   - No retries, no query expansion, no secondary provider, no Tavily.
 *   - GKEY is never printed, never persisted, never placed in URLs/artifacts.
 *   - Raw Google responses and raw Google phone values are never persisted.
 *     Only contract-safe derived fields and in-memory comparisons are written.
 *   - No mutation of D1, prospects.phone, trust states, trustedPhone,
 *     contactability, scoring, qualification, Research, or outreach state.
 *
 * RESULT ARTIFACT: bulk/reports/google-places-structured-discovery-adapter-v1-live-results.json
 */

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  googlePlacesStructuredDiscovery,
  GOOGLE_PLACES_DISCOVERY_SCHEMA_VERSION,
  type GoogleDiscoveryCandidateResponse,
  type GoogleDiscoveryResult,
} from '../core/providers/google-places-discovery';
import {
  normalizePhoneE164,
  classifyPhoneType,
  preferredMobile,
  type PhoneRecord,
} from '../core/phone/phone-record';

export const RUNNER_ID = 'google-places-structured-discovery-adapter-v1';
export const VALIDATION_ID = 'google-places-production-validation-v1';
export const SAMPLE_PATH = 'bulk/reports/google-places-production-validation-v1-sample-v3.json';
export const RESULT_PATH = 'bulk/reports/google-places-structured-discovery-adapter-v1-live-results.json';
export const EXPECTED_SAMPLE_HASH = '14dbf9dcff8540ba11e2edb2dcafa599a8c867fe87080ae81d0e4d37dcca31b2';
export const GOOGLE_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
export const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri';
export const MAX_REQUESTS = 10;
export const QUERY_CONTRACT_VERSION = 'exploratory-parity-address.v1';
export const RESULT_SCHEMA_VERSION = 'google-places-structured-discovery-adapter-live.v1';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface GoldControl {
  prospectId: string;
  name: string;
  commune: string;
  address: string;
  category?: string;
  branchSensitive?: boolean;
  goldSourceUrl?: string;
  goldSourceType?: string;
  goldPhoneRaw?: string;
  goldPhoneNormalized?: string;
  goldIdentity?: string;
  canonicalWebsite?: string | null;
}

export interface V3Sample {
  canonicalControlsHash: string;
  controls: GoldControl[];
}

export type PhoneComparison =
  | 'EXACT_MATCH'
  | 'NORMALIZED_MATCH'
  | 'DIFFERENT_VALID_NUMBER'
  | 'ABSENT'
  | 'NOT_VERIFIABLE';

export interface SanitizedPhoneCandidate {
  phoneType: string;
  source: 'GOOGLE_PLACES';
  trustStatus: 'UNVERIFIED';
  isPreferredMobileCandidate: boolean;
  phoneComparisonToGold: PhoneComparison;
}

export interface SanitizedControlResult {
  prospectId: string;
  canonicalName: string;
  requestSequence: number;
  queryHash: string;
  responseHash: string;
  httpStatus: number;
  rawPlaceCount: number;
  parsedCandidateCount: number;
  identityVerdict: string;
  identityReasonCodes: string[];
  branchVerdict: string;
  branchReasonCodes: string[];
  placeId: string | null;
  websiteCandidatePresent: boolean;
  phoneCandidateCount: number;
  phoneCandidates: SanitizedPhoneCandidate[];
}

export interface LiveResultArtifact {
  runnerId: typeof RUNNER_ID;
  validationId: typeof VALIDATION_ID;
  canonicalControlsHash: string;
  requestBudget: number;
  actualRequestCount: number;
  queryContractVersion: typeof QUERY_CONTRACT_VERSION;
  resultSchemaVersion: typeof RESULT_SCHEMA_VERSION;
  identityContractVersion: string;
  zeroRealGoogleRequestsFromHarness: boolean;
  generatedAt: string;
  results: SanitizedControlResult[];
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
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

/** Proven V3 query semantics: canonical name, commune, Martinique, canonical address. */
export function queryFor(control: GoldControl): string {
  return [control.name, control.commune, 'Martinique', control.address].filter(Boolean).join(', ');
}

/** Parse the Google searchText payload into the adapter's candidate shape. */
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

/** Normalize gold phone (in-memory, E.164 path) for comparison. */
export function normalizeGold(value: string | undefined): string | null {
  if (!value) return null;
  const e = normalizePhoneE164(value, null);
  if (e) return e;
  const digits = value.replace(/\D/g, '');
  return digits ? `+${digits.replace(/^00/, '')}` : null;
}

/**
 * Compare a normalized Google phone candidate against the gold phone, purely in memory.
 * No raw phone content is persisted — only the derived comparison label.
 */
export function comparePhoneToGold(
  googleNormalized: string,
  goldNormalized: string | null,
): PhoneComparison {
  if (!goldNormalized) return 'NOT_VERIFIABLE';
  if (googleNormalized === goldNormalized) return 'EXACT_MATCH';
  const goldDigits = goldNormalized.replace(/\D/g, '');
  const googleDigits = googleNormalized.replace(/\D/g, '');
  if (goldDigits && googleDigits && goldDigits === googleDigits) return 'NORMALIZED_MATCH';
  return 'DIFFERENT_VALID_NUMBER';
}

/** Verify the frozen sample and its canonical hash BEFORE any network activity. */
export async function loadFrozenSample(): Promise<V3Sample> {
  const raw = await fs.readFile(path.join(root, SAMPLE_PATH), 'utf8');
  const sample = JSON.parse(raw) as V3Sample;
  const actual = sha256(JSON.stringify(sample.controls));
  if (!Array.isArray(sample.controls) || sample.controls.length !== 10) {
    throw new Error('Frozen Google validation V3 integrity failed: controls must number exactly 10');
  }
  if (sample.canonicalControlsHash !== EXPECTED_SAMPLE_HASH || actual !== EXPECTED_SAMPLE_HASH) {
    throw new Error('Frozen Google validation V3 integrity failed: canonical controls hash mismatch (failing before network)');
  }
  return sample;
}

function sanitizedError(message: string): string {
  return message.replace(/GKEY/gi, 'secret').replace(/X-Goog-Api-Key/gi, 'secret-header');
}

/**
 * Deterministically project the adapter's phone candidates onto the sanitized schema.
 * Only contract-safe derived fields are returned; raw phone content stays in memory.
 */
export function sanitizePhoneCandidates(
  result: GoogleDiscoveryResult,
  goldNormalized: string | null,
): SanitizedPhoneCandidate[] {
  if (!result.phoneCandidates.length) return [];
  const records: PhoneRecord[] = result.phoneCandidates.map((candidate) => ({
    prospectId: result.prospectId,
    normalizedPhone: candidate.normalizedPhone,
    displayPhone: candidate.displayPhone,
    phoneType: candidate.phoneType,
    sourceKind: candidate.sourceKind,
    identityBinding: candidate.identityBinding,
    branchBinding: candidate.branchBinding,
    trustStatus: candidate.trustStatus,
    trustReasonCodes: candidate.trustReasonCodes,
    acquiredAt: '',
    schemaVersion: 'phone-record.v1' as const,
  }));
  const preferred = preferredMobile(records);
  const preferredSet = preferred ? new Set([preferred.normalizedPhone]) : new Set<string>();
  return result.phoneCandidates.map((candidate) => ({
    phoneType: candidate.phoneType,
    source: 'GOOGLE_PLACES' as const,
    trustStatus: 'UNVERIFIED' as const,
    isPreferredMobileCandidate:
      candidate.phoneType === 'MOBILE' && preferredSet.has(candidate.normalizedPhone),
    phoneComparisonToGold: comparePhoneToGold(candidate.normalizedPhone, goldNormalized),
  }));
}

export function buildIdentityContractVersion(): string {
  return GOOGLE_PLACES_DISCOVERY_SCHEMA_VERSION;
}

function requestHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': key,
    'X-Goog-FieldMask': FIELD_MASK,
  };
}

export interface RunOptions {
  fetchImpl?: FetchLike;
  now?: () => string;
  writeArtifact?: boolean;
}

/** Minimal fetch surface used by the runner; mocks only need status, ok, and text. */
export type FetchLike = (
  input: string,
  init?: unknown,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/**
 * Run the bounded live validation through the real adapter path.
 *
 * Returns the sanitized artifact. When writeArtifact is true (default), writes the
 * NEW sanitized result file. Never mutates any production/canonical/trust/scoring state.
 */
export async function runAdapterValidation(options: RunOptions = {}): Promise<LiveResultArtifact> {
  const { fetchImpl = fetch, now = () => new Date().toISOString(), writeArtifact = true } = options;

  const key = process.env.GKEY;
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error('GKEY is required; operator must export the secret before running');
  }
  // The secret must never appear in any following string we might persist or log.
  const safeKey: string = key;

  const sample = await loadFrozenSample();
  const goldByProspect = new Map<string, string | null>();
  for (const control of sample.controls) {
    goldByProspect.set(control.prospectId, normalizeGold(control.goldPhoneNormalized));
  }

  const results: SanitizedControlResult[] = [];
  let requestCount = 0;

  for (const control of sample.controls) {
    if (requestCount >= MAX_REQUESTS) {
      throw new Error(`Google request budget exceeded (hard cap ${MAX_REQUESTS})`);
    }
    const query = queryFor(control);
    const response = await fetchImpl(GOOGLE_ENDPOINT, {
      method: 'POST',
      headers: requestHeaders(safeKey),
      body: JSON.stringify({ textQuery: query, pageSize: 3 }),
    });
    requestCount += 1;
    const requestSequence = requestCount;

    const body = await response.text();
    const responseHash = sha256(body);
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = {};
    }

    const rawPlaceCount =
      payload && typeof payload === 'object' && 'places' in payload
        ? Array.isArray((payload as { places: unknown }).places)
          ? (payload as { places: unknown[] }).places.length
          : 0
        : 0;
    const candidates = parseCandidates(payload);
    const parsedCandidateCount = candidates.length;

    const identityTarget = {
      canonicalName: control.name,
      canonicalLocality: control.commune,
      canonicalAddress: control.address,
      canonicalPostalCode: extractPostalCode(control.address),
      canonicalWebsite: control.canonicalWebsite ?? null,
    };

    const adapterResult = googlePlacesStructuredDiscovery(
      identityTarget,
      candidates,
      { queryHash: sha256(query), responseHash, httpStatus: response.status, rawPlaceCount },
      { enabled: true, prospectId: control.prospectId },
    );

    const goldNormalized = goldByProspect.get(control.prospectId) ?? null;
    const phoneCandidates = sanitizePhoneCandidates(adapterResult, goldNormalized);

    results.push({
      prospectId: control.prospectId,
      canonicalName: control.name,
      requestSequence,
      queryHash: sha256(query),
      responseHash,
      httpStatus: response.status,
      rawPlaceCount,
      parsedCandidateCount,
      identityVerdict: adapterResult.identityVerdict,
      identityReasonCodes: adapterResult.identityReasonCodes,
      branchVerdict: adapterResult.branchVerdict,
      branchReasonCodes: adapterResult.branchReasonCodes,
      placeId: adapterResult.placeId,
      websiteCandidatePresent: Boolean(adapterResult.websiteCandidate),
      phoneCandidateCount: adapterResult.phoneCandidates.length,
      phoneCandidates,
    });
  }

  const artifact: LiveResultArtifact = {
    runnerId: RUNNER_ID,
    validationId: VALIDATION_ID,
    canonicalControlsHash: EXPECTED_SAMPLE_HASH,
    requestBudget: MAX_REQUESTS,
    actualRequestCount: requestCount,
    queryContractVersion: QUERY_CONTRACT_VERSION,
    resultSchemaVersion: RESULT_SCHEMA_VERSION,
    identityContractVersion: buildIdentityContractVersion(),
    zeroRealGoogleRequestsFromHarness: true,
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

function extractPostalCode(address: string): string | null {
  return String(address ?? '').match(/\b(97\d{3})\b/)?.[1] ?? null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runAdapterValidation()
    .then((artifact) => {
      console.log(
        `Google Places Structured Discovery adapter V1 live validation complete: ${artifact.actualRequestCount} bounded requests; sanitized artifact written to ${RESULT_PATH}.`,
      );
    })
    .catch((error: unknown) => {
      console.error(
        `Google Places Structured Discovery adapter V1 live validation aborted: ${sanitizedError(error instanceof Error ? error.message : String(error))}`,
      );
      process.exitCode = 1;
    });
}
