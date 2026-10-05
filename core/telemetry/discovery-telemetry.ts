/**
 * Google Places Structured Discovery + Multi-Phone Telemetry (V1).
 *
 * Bounded observability for structured provider discovery and per-phone events.
 * Never persists prohibited Google content, raw response bodies, or GKEY.
 * All events are deterministic counters/booleans with hashed references, never raw
 * PII or raw response content.
 */

import type { DiscoveryIdentityVerdict } from '../providers/google-places-discovery';

export const DISCOVERY_TELEMETRY_VERSION = 'google-discovery-telemetry.v1';

export interface GoogleDiscoveryTelemetry {
  /** Unique request identifier */
  requestId: string;
  prospectId: string;
  providerType: 'GOOGLE_PLACES_NEW';
  identityVerdict: DiscoveryIdentityVerdict;
  identityReasonHashes: string[];
  branchVerdict: 'MATCH' | 'MISMATCH' | 'UNKNOWN' | 'NOT_EVALUATED';
  websiteCandidatePresent: boolean;
  phoneCandidateCount: number;
  requestHash: string;
  responseHash: string;
  httpStatus: number;
  rawPlaceCount: number;
  schemaVersion: typeof DISCOVERY_TELEMETRY_VERSION;
  acquiredAt: string;
}

export interface PhoneDiscoveryTelemetry {
  prospectId: string;
  normalizedPhoneHash: string;
  phoneType: 'MOBILE' | 'LANDLINE' | 'FIXED_LINE_OR_MOBILE' | 'UNKNOWN';
  sourceKind: string;
  trustStatus: string;
  identityBinding: string;
  branchBinding: string;
  source: 'GOOGLE' | 'FIRST_PARTY_SITE' | 'OTHER';
  isNew: boolean;
  isDeduplicated: boolean;
  schemaVersion: 'phone-discovery-telemetry.v1';
  acquiredAt: string;
}

function stableHash(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function hashReasonCode(code: string): string {
  return stableHash(code).slice(0, 8);
}

export function buildGoogleDiscoveryTelemetry(
  requestId: string,
  prospectId: string,
  identityVerdict: GoogleDiscoveryTelemetry['identityVerdict'],
  identityReasonCodes: string[],
  branchVerdict: GoogleDiscoveryTelemetry['branchVerdict'],
  websiteCandidatePresent: boolean,
  phoneCandidateCount: number,
  requestHash: string,
  responseHash: string,
  httpStatus: number,
  rawPlaceCount: number,
): GoogleDiscoveryTelemetry {
  return {
    requestId,
    prospectId,
    providerType: 'GOOGLE_PLACES_NEW',
    identityVerdict,
    identityReasonHashes: identityReasonCodes.map(hashReasonCode),
    branchVerdict,
    websiteCandidatePresent,
    phoneCandidateCount,
    requestHash,
    responseHash,
    httpStatus,
    rawPlaceCount,
    schemaVersion: DISCOVERY_TELEMETRY_VERSION,
    acquiredAt: new Date().toISOString(),
  };
}