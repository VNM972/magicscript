export const GOOGLE_PLACES_TRUST_SCHEMA_VERSION = 'direct-structured-provider-evidence.v1';
export const GOOGLE_PLACES_PROVIDER = 'GOOGLE_PLACES_NEW' as const;

export type GoogleIdentityVerdict = 'VERIFIED' | 'AMBIGUOUS' | 'REJECTED' | 'NOT_FOUND';

export interface GoogleIdentitySignals {
  businessName: 'MATCH' | 'COMPATIBLE' | 'MISSING' | 'CONFLICT';
  locality: 'MATCH' | 'COMPATIBLE' | 'MISSING' | 'CONFLICT';
  addressOrPostalCode: 'MATCH' | 'COMPATIBLE' | 'MISSING' | 'CONFLICT';
  websiteDomain: 'MATCH' | 'COMPATIBLE' | 'MISSING' | 'CONFLICT';
}

/** Provider response evidence only. This is deliberately not a trusted-phone record. */
export interface DirectStructuredProviderEvidence {
  providerPlaceId: string;
  providerType: typeof GOOGLE_PLACES_PROVIDER;
  acquiredAt: string;
  canonicalProspectId: string;
  identitySignals: GoogleIdentitySignals;
  identityVerdict: GoogleIdentityVerdict;
  phoneNormalized: string | null;
  provenance: {
    provider: typeof GOOGLE_PLACES_PROVIDER;
    queryHash: string;
    responseHash: string;
    fieldMask: string;
    sourceRunId: string;
  };
  responseIntegrity: {
    requestCount: number;
    httpStatus: number;
    payloadHashAlgorithm: 'sha256';
  };
  schemaVersion: typeof GOOGLE_PLACES_TRUST_SCHEMA_VERSION;
}

export interface GoogleIdentityInput {
  canonicalName: string;
  canonicalLocality?: string | null;
  canonicalAddress?: string | null;
  canonicalPostalCode?: string | null;
  canonicalWebsite?: string | null;
}

export interface GoogleIdentityCandidate {
  name?: string | null;
  address?: string | null;
  website?: string | null;
}

function normalized(value: unknown): string {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function domain(value: string | null | undefined): string {
  try { return new URL(value ?? '').hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function postal(value: unknown): string | null { return String(value ?? '').match(/\b(97\d{3})\b/)?.[1] ?? null; }

/** Phone is intentionally not an input: it can never increase identity confidence. */
export function evaluateGoogleIdentity(target: GoogleIdentityInput, candidate: GoogleIdentityCandidate): { verdict: GoogleIdentityVerdict; reason: string; signals: GoogleIdentitySignals } {
  const targetName = normalized(target.canonicalName); const candidateName = normalized(candidate.name);
  const targetLocality = normalized(target.canonicalLocality); const candidateAddress = normalized(candidate.address);
  const targetPostal = target.canonicalPostalCode ?? postal(target.canonicalAddress); const candidatePostal = postal(candidate.address);
  const targetDomain = domain(target.canonicalWebsite); const candidateDomain = domain(candidate.website);
  const name = !candidateName ? 'MISSING' : candidateName === targetName ? 'MATCH' : candidateName.includes(targetName) || targetName.includes(candidateName) ? 'COMPATIBLE' : 'CONFLICT';
  const locality = !targetLocality ? 'MISSING' : candidateAddress.includes(targetLocality) ? 'MATCH' : 'CONFLICT';
  const addressOrPostalCode = !targetPostal ? (candidateAddress ? 'COMPATIBLE' : 'MISSING') : !candidatePostal ? 'MISSING' : candidatePostal === targetPostal ? 'MATCH' : 'CONFLICT';
  const websiteDomain = !targetDomain || !candidateDomain ? 'MISSING' : targetDomain === candidateDomain || targetDomain.endsWith(`.${candidateDomain}`) || candidateDomain.endsWith(`.${targetDomain}`) ? 'MATCH' : 'CONFLICT';
  const signals = { businessName: name, locality, addressOrPostalCode, websiteDomain } as GoogleIdentitySignals;
  if (!candidateName && !candidateAddress && !candidateDomain) return { verdict: 'AMBIGUOUS', reason: 'candidate lacks identity evidence', signals };
  if ([name, locality, addressOrPostalCode, websiteDomain].includes('CONFLICT')) return { verdict: 'REJECTED', reason: 'material identity conflict', signals };
  if (name === 'MISSING' || (name !== 'MATCH' && locality !== 'MATCH' && addressOrPostalCode !== 'MATCH')) return { verdict: 'AMBIGUOUS', reason: 'insufficient deterministic corroboration', signals };
  return { verdict: 'VERIFIED', reason: 'deterministic compatible identity signals', signals };
}

export function googleEvidenceMayBeDisplayed(evidence: Pick<DirectStructuredProviderEvidence, 'identityVerdict' | 'canonicalProspectId' | 'phoneNormalized'>, prospectId: string): boolean {
  return evidence.canonicalProspectId === prospectId && evidence.identityVerdict === 'VERIFIED';
}

/** V1 safety gate: Google phones are never promoted automatically. */
export function googlePhoneMayBecomeTrustedPhone(): false { return false; }
