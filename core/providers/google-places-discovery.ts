/**
 * Google Places Structured Discovery (V1).
 *
 * Provider role: STRUCTURED_DISCOVERY_CANDIDATE.
 *
 * Google may provide:
 *   - Google Place ID
 *   - provider business name
 *   - formatted address
 *   - website URI
 *   - phone candidates (never automatically trusted)
 *   - identity signals using the V3-proven deterministic identity contract
 *   - branch/location signals
 *   - request/provenance metadata
 *
 * Google MUST NOT automatically create or modify:
 *   - trustedPhone
 *   - phone trust state
 *   - contactability
 *   - scoring
 *   - qualification
 *
 * Phone MUST NOT influence identity binding per V3 contract.
 *
 * The adapter is disabled by default (enabled = false). Real Google execution
 * is operator-controlled. Mocked responses suffice for complete integration tests.
 *
 * Google governance: only permitted derived fields are persisted. Raw Google
 * responses, raw Google phones, raw Google addresses, and GKEY are never
 * persisted. Google content not protected by existing governance is ephemeral.
 */

import { evaluateGoogleIdentity, GOOGLE_PLACES_PROVIDER } from '../google-places-trust';
import type { GoogleIdentityVerdict, GoogleIdentityInput, GoogleIdentityCandidate } from '../google-places-trust';
import { classifyPhoneType, normalizePhoneE164 } from '../phone/phone-record';
import type { PhoneType, PhoneSourceKind } from '../phone/phone-record';

export const GOOGLE_PLACES_DISCOVERY_SCHEMA_VERSION = 'google-places-structured-discovery.v1';
export const GOOGLE_PLACES_PROVIDER_ROLE = 'STRUCTURED_DISCOVERY_CANDIDATE';

export type DiscoveryIdentityVerdict = 'VERIFIED' | 'AMBIGUOUS' | 'REJECTED' | 'NOT_EVALUATED';

export interface GoogleDiscoveryResult {
  prospectId: string;
  placeId: string | null;
  providerType: typeof GOOGLE_PLACES_PROVIDER;
  providerRole: typeof GOOGLE_PLACES_PROVIDER_ROLE;
  identityVerdict: DiscoveryIdentityVerdict;
  identityReasonCodes: string[];
  branchVerdict: 'MATCH' | 'MISMATCH' | 'UNKNOWN' | 'NOT_EVALUATED';
  branchReasonCodes: string[];
  websiteCandidate: string | null;
  phoneCandidates: GooglePhoneCandidate[];
  requestMetadata: GoogleDiscoveryRequestMetadata;
  schemaVersion: typeof GOOGLE_PLACES_DISCOVERY_SCHEMA_VERSION;
}

export interface GooglePhoneCandidate {
  normalizedPhone: string;
  displayPhone: string;
  phoneType: PhoneType;
  sourceKind: PhoneSourceKind;
  sourceUrl: string;
  identityBinding: 'VERIFIED';
  branchBinding: 'MATCH' | 'MISMATCH' | 'NOT_EVALUATED';
  branchLabel: string | null;
  trustStatus: 'UNVERIFIED';
  trustReasonCodes: string[];
}

export interface GoogleDiscoveryRequestMetadata {
  providerType: typeof GOOGLE_PLACES_PROVIDER;
  queryHash: string;
  responseHash: string;
  httpStatus: number;
  rawPlaceCount: number;
  identityContractVersion: string;
}

export interface GoogleDiscoveryIdentityInput {
  canonicalName: string;
  canonicalLocality: string | null;
  canonicalAddress: string | null;
  canonicalPostalCode: string | null;
  canonicalWebsite: string | null;
}

export interface GoogleDiscoveryCandidateResponse {
  placeId: string;
  name?: string;
  formattedAddress?: string;
  phone?: string;
  website?: string;
}

const domain = (value: string | null | undefined): string => {
  if (!value) return '';
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname
      .toLowerCase()
      .replace(/^www\./, '');
  } catch {
    return '';
  }
};

const GOOGLE = 'https://www.google.com' as const;

/**
 * Deterministic identity evaluation for a Google candidate response.
 * Delegates to the V3-proven evaluateGoogleIdentity and maps verdicts.
 * Phone is never an input: it cannot increase identity confidence.
 */
export function bindGoogleIdentity(
  target: GoogleDiscoveryIdentityInput,
  candidate: GoogleDiscoveryCandidateResponse,
): { verdict: DiscoveryIdentityVerdict; reasonCodes: string[] } {
  const googleCandidate: GoogleIdentityCandidate = {
    name: candidate.name ?? null,
    address: candidate.formattedAddress ?? null,
    website: candidate.website ?? null,
  };
  const googleTarget: GoogleIdentityInput = {
    canonicalName: target.canonicalName,
    canonicalLocality: target.canonicalLocality,
    canonicalAddress: target.canonicalAddress,
    canonicalPostalCode: target.canonicalPostalCode,
    canonicalWebsite: target.canonicalWebsite,
  };
  const result = evaluateGoogleIdentity(googleTarget, googleCandidate);
  if (result.verdict === 'REJECTED') return { verdict: 'REJECTED', reasonCodes: ['BUSINESS_NAME_CONFLICT', 'LOCALITY_CONFLICT', 'ADDRESS_CONFLICT', 'WEBSITE_DOMAIN_CONFLICT', result.reason].filter((c) => result.reason.includes(c.toLowerCase().replace(/_/g, ' ')) || c === 'BUSINESS_NAME_CONFLICT' || c === 'LOCALITY_CONFLICT' || c === 'ADDRESS_CONFLICT' || c === 'WEBSITE_DOMAIN_CONFLICT') };
  if (result.verdict === 'AMBIGUOUS') return { verdict: 'AMBIGUOUS', reasonCodes: ['INSUFFICIENT_CORROBORATION', result.reason] };
  return { verdict: 'VERIFIED', reasonCodes: ['DETERMINISTIC_SIGNALS_COMPATIBLE'] };
}

/**
 * Build phone candidates from a verified Google entity. Phone is never used for
 * identity: it is extracted only after identity succeeds and is bound with
 * GOOGLE_PHONE_CANDIDATE trust (never TRUSTED). If the candidate is not VERIFIED,
 * phones are not returned.
 */
export function googlePhoneCandidates(
  candidate: GoogleDiscoveryCandidateResponse,
  identityVerdict: DiscoveryIdentityVerdict,
  prospectId: string,
  branchLabel: string | null,
): GooglePhoneCandidate[] {
  if (identityVerdict !== 'VERIFIED' || !candidate.phone) return [];
  const normalized = normalizePhoneE164(candidate.phone);
  if (!normalized) return [];
  const type = classifyPhoneType(candidate.phone);
  return [
    {
      normalizedPhone: normalized,
      displayPhone: candidate.phone,
      phoneType: type,
      sourceKind: 'GOOGLE_PLACES_CANDIDATE',
      sourceUrl: GOOGLE,
      identityBinding: 'VERIFIED',
      branchBinding: 'NOT_EVALUATED',
      branchLabel,
      trustStatus: 'UNVERIFIED',
      trustReasonCodes: [
        'GOOGLE_PHONE_CANDIDATE',
        'GOOGLE_ALONE_NEVER_TRUSTED',
      ],
    },
  ];
}

/**
 * Run Google Places structured discovery entirely in memory over a candidate
 * response and identity target. No real Google API call is made by this function.
 *
 * The adapter is disabled by default; real execution requires explicit operator
 * authorization.
 */
export function googlePlacesStructuredDiscovery(
  target: GoogleDiscoveryIdentityInput,
  candidates: GoogleDiscoveryCandidateResponse[],
  requestMetadata: Omit<GoogleDiscoveryRequestMetadata, 'providerType' | 'identityContractVersion'>,
  options: { enabled?: boolean; prospectId: string } = { prospectId: '' },
): GoogleDiscoveryResult {
  if (options.enabled !== true) {
    return {
      prospectId: options.prospectId,
      placeId: null,
      providerType: GOOGLE_PLACES_PROVIDER,
      providerRole: GOOGLE_PLACES_PROVIDER_ROLE,
      identityVerdict: 'NOT_EVALUATED',
      identityReasonCodes: ['GOOGLE_DISABLED'],
      branchVerdict: 'NOT_EVALUATED',
      branchReasonCodes: ['GOOGLE_DISABLED'],
      websiteCandidate: null,
      phoneCandidates: [],
      requestMetadata: {
        ...requestMetadata,
        providerType: GOOGLE_PLACES_PROVIDER,
        identityContractVersion: GOOGLE_PLACES_DISCOVERY_SCHEMA_VERSION,
      },
      schemaVersion: GOOGLE_PLACES_DISCOVERY_SCHEMA_VERSION,
    };
  }

  // Evaluate each candidate; select the first VERIFIED one deterministically.
  const evaluated = candidates.map((candidate) => ({
    candidate,
    identity: bindGoogleIdentity(target, candidate),
  }));
  const verified = evaluated.filter((e) => e.identity.verdict === 'VERIFIED');
  const selected = verified.length === 1 ? verified[0] : null;
  const ambiguous = evaluated.some((e) => e.identity.verdict === 'AMBIGUOUS');
  const rejected = evaluated.every((e) => e.identity.verdict === 'REJECTED');

  let identityVerdict: DiscoveryIdentityVerdict;
  let identityReasonCodes: string[];
  if (selected) {
    identityVerdict = 'VERIFIED';
    identityReasonCodes = selected.identity.reasonCodes;
  } else if (verified.length > 1) {
    identityVerdict = 'AMBIGUOUS';
    identityReasonCodes = ['MULTIPLE_VERIFIED_CANDIDATES'];
  } else if (ambiguous) {
    identityVerdict = 'AMBIGUOUS';
    identityReasonCodes = ['INSUFFICIENT_CORROBORATION'];
  } else if (rejected) {
    identityVerdict = 'REJECTED';
    identityReasonCodes = evaluated.flatMap((e) => e.identity.reasonCodes);
  } else {
    identityVerdict = 'REJECTED';
    identityReasonCodes = ['ALL_CANDIDATES_FAIL_IDENTITY'];
  }

  const branchVerdict = selected
    ? selected.candidate.website
      ? domain(selected.candidate.website) === domain(target.canonicalWebsite)
        ? 'MATCH'
        : 'MISMATCH'
      : 'UNKNOWN'
    : 'NOT_EVALUATED';

  const phoneCandidates = selected
    ? googlePhoneCandidates(selected.candidate, 'VERIFIED', options.prospectId, target.canonicalLocality)
    : [];

  const websiteCandidate =
    selected && selected.candidate.website
      ? selected.candidate.website
      : null;

  const branchReasonCodes =
    branchVerdict === 'MISMATCH'
      ? ['WEBSITE_DOMAIN_MISMATCH_EVEN_AFTER_IDENTITY_MATCH']
      : [];

  return {
    prospectId: options.prospectId,
    placeId: selected?.candidate.placeId ?? null,
    providerType: GOOGLE_PLACES_PROVIDER,
    providerRole: GOOGLE_PLACES_PROVIDER_ROLE,
    identityVerdict,
    identityReasonCodes,
    branchVerdict,
    branchReasonCodes,
    websiteCandidate,
    phoneCandidates,
    requestMetadata: {
      ...requestMetadata,
      providerType: GOOGLE_PLACES_PROVIDER,
      identityContractVersion: GOOGLE_PLACES_DISCOVERY_SCHEMA_VERSION,
    },
    schemaVersion: GOOGLE_PLACES_DISCOVERY_SCHEMA_VERSION,
  };
}

/** Safe gate: Google alone never satisfies the trusted-phone gate. */
export function googleDiscoveryMaySeedOwnedSite(identityVerdict: DiscoveryIdentityVerdict): boolean {
  return identityVerdict === 'VERIFIED';
}

/** Safe gate: unverified Google entities cannot seed owned-site discovery. */
export function googleDiscoveryUnverifiedCanSeedOwnedSite(identityVerdict: DiscoveryIdentityVerdict): boolean {
  return false;
}