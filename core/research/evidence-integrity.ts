export const RESEARCH_SCORE_KEYS = [
  'digitalGap',
  'commercialStrength',
  'contactability',
  'localFit',
  'prototypeLeverage',
  'confidence',
] as const;

export const RESEARCH_EVIDENCE_CLAIMS = [
  'digitalGap',
  'commercialStrength',
  'contactability',
  'localFit',
  'prototypeLeverage',
  'activity',
  'location',
  'website',
  'websiteAbsent',
  'publicListing',
  'bookingPlatform',
  'menuProvider',
  'eventPlatform',
  'phone',
  'opportunity',
  'primaryAsset',
  'primaryFriction',
  'brandAsset',
] as const;

export type ResearchScoreKey = (typeof RESEARCH_SCORE_KEYS)[number];
export type ResearchEvidenceClaim = (typeof RESEARCH_EVIDENCE_CLAIMS)[number];

export interface AcceptedResearchSource {
  url: string;
  note: string;
  supports: readonly ResearchEvidenceClaim[];
}

export interface ResearchEvidenceIntegrityInput {
  scoreInputs?: unknown;
  sources?: unknown;
  websiteUrl?: unknown;
  phone?: unknown;
  phoneSourceUrl?: unknown;
  /** Optional set of claims that have been deterministically derived from
   *  source-backed facts rather than directly annotated by the research
   *  swarm. These are accepted as if a source explicitly supported them. */
  derivedClaims?: readonly ResearchEvidenceClaim[];
  /** INDEPENDENT phone evidence extracted by the trusted runner from fetched
   *  source material (page text, tel: hrefs, or JSON-LD). */
  derivedPhoneEvidence?: unknown;
}

export type PhoneSourceOwnership =
  | 'OWNED_BUSINESS_SOURCE'
  | 'DIRECT_STRUCTURED_BUSINESS_SOURCE'
  | 'THIRD_PARTY_LISTING_BUSINESS_FIELD'
  | 'THIRD_PARTY_SITE_GLOBAL_CONTACT'
  | 'AMBIGUOUS_SOURCE_OWNERSHIP'
  | 'UNKNOWN';

export interface TrustedResearchPhone {
  phone: string;
  normalizedDigits: string;
  sourceUrl: string;
  evidenceType: PhoneEvidenceType;
  evidenceOrigin: 'FETCHED_SOURCE';
  independentlyObserved: true;
  sourceOwnership?: PhoneSourceOwnership;
  entityBound?: true;
}

export interface ResearchPhoneEvidenceIntegrityResult {
  acceptedSources: readonly AcceptedResearchSource[];
  rejectedSourceCount: number;
  trustedPhone?: TrustedResearchPhone;
  reason?: 'MALFORMED_PHONE_EVIDENCE' | 'UNSUPPORTED_PHONE' | 'DERIVED_PHONE_DISAGREES_WITH_MODEL';
}

export interface ResearchEvidenceIntegrityResult {
  passed: boolean;
  reasons: readonly string[];
  acceptedSources: readonly AcceptedResearchSource[];
  rejectedSourceCount: number;
  supportedClaims: readonly ResearchEvidenceClaim[];
  scoreInputs: Record<ResearchScoreKey, number>;
  trustedWebsiteUrl?: string;
  trustedPhone?: TrustedResearchPhone;
}

const claims = new Set<string>(RESEARCH_EVIDENCE_CLAIMS);
const scoreEvidenceClaims = RESEARCH_SCORE_KEYS.filter(
  (key): key is Exclude<ResearchScoreKey, 'confidence'> => key !== 'confidence',
);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function rejectedIpv4Literal(host: string): boolean {
  return (
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^0\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

function parseIpv6Words(host: string): number[] | null {
  const literal = host.startsWith('[') && host.endsWith(']')
    ? host.slice(1, -1)
    : host;
  if (!literal.includes(':')) return null;

  const halves = literal.split('::');
  if (halves.length > 2) return null;
  const parseHalf = (half: string): number[] | null => {
    if (!half) return [];
    const rawWords = half.split(':');
    if (rawWords.some((word) => !/^[0-9a-f]{1,4}$/i.test(word))) return null;
    return rawWords.map((word) => Number.parseInt(word, 16));
  };
  const left = parseHalf(halves[0] ?? '');
  const right = parseHalf(halves[1] ?? '');
  if (!left || !right) return null;

  if (halves.length === 1) return left.length === 8 ? left : null;
  const omittedWordCount = 8 - left.length - right.length;
  if (omittedWordCount < 1) return null;
  return [...left, ...Array<number>(omittedWordCount).fill(0), ...right];
}

function rejectedIpv6Literal(host: string): boolean {
  const words = parseIpv6Words(host);
  if (!words) return false;

  const unspecified = words.every((word) => word === 0);
  const loopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  const uniqueLocal = (words[0]! & 0xfe00) === 0xfc00;
  const linkLocal = (words[0]! & 0xffc0) === 0xfe80;
  const ipv4Mapped =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  const mappedIpv4 = ipv4Mapped
    ? `${words[6]! >> 8}.${words[6]! & 0xff}.${words[7]! >> 8}.${words[7]! & 0xff}`
    : null;

  return (
    unspecified || loopback || uniqueLocal || linkLocal ||
    (mappedIpv4 !== null && rejectedIpv4Literal(mappedIpv4))
  );
}

export function isRejectedHostAddress(host: string): boolean {
  const lower = host.toLowerCase();
  const mappedIpv4 = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  return (
    !lower || lower === 'localhost' || lower.endsWith('.local') ||
    rejectedIpv4Literal(lower) || rejectedIpv6Literal(lower) ||
    (mappedIpv4 !== undefined && rejectedIpv4Literal(mappedIpv4))
  );
}

export function publicHttpUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username || url.password || isRejectedHostAddress(host)
    ) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function normalizeSources(value: unknown): {
  accepted: AcceptedResearchSource[];
  rejected: number;
} {
  if (!Array.isArray(value)) return { accepted: [], rejected: value === undefined ? 0 : 1 };
  const accepted: AcceptedResearchSource[] = [];
  let rejected = 0;
  const seen = new Set<string>();

  for (const item of value) {
    const source = record(item);
    const url = publicHttpUrl(source?.url);
    const note = typeof source?.note === 'string' ? source.note.trim() : '';
    const rawSupports = source && Array.isArray(source.supports) ? source.supports : [];
    const supports = [...new Set(rawSupports.filter(
      (claim): claim is ResearchEvidenceClaim => typeof claim === 'string' && claims.has(claim),
    ))];
    if (!url || !note || supports.length === 0) {
      rejected += 1;
      continue;
    }
    const normalizedUrl = url.toString();
    const key = `${normalizedUrl}|${supports.join(',')}|${note}`;
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push({ url: normalizedUrl, note, supports });
  }
  return { accepted, rejected };
}

/**
 * Evaluate phone evidence integrity.
 *
 * SECURITY INVARIANT: A model claim MUST NOT manufacture the evidence used to
 * validate itself.
 *
 * trustedPhone is created ONLY when independent deterministic phone evidence
 * (from fetched page text, tel: hrefs, or JSON-LD) is provided via the
 * `derivedPhoneEvidence` input. Model-authored fields (phone, phoneSourceUrl,
 * source.note, source.supports, derivedClaims) alone NEVER produce trustedPhone.
 *
 * Requirements for trustedPhone:
 *   1. derivedPhoneEvidence.independentlyObserved === true
 *   2. derivedPhoneEvidence.evidenceOrigin === 'FETCHED_SOURCE'
 *   3. Valid evidenceType (TEL_HREF / JSON_LD_TELEPHONE / VISIBLE_PAGE_TEXT)
 *   4. Valid public sourceUrl exactly matching an accepted source supporting phone
 *   5. Valid phone syntax (8–15 digits) and matching normalizedDigits
 *
 * If the model phone and the independent phone disagree, the independent phone
 * is preferred and the discrepancy is recorded in `reason`.
 */
export function evaluateResearchPhoneEvidenceIntegrity(
  input: Pick<ResearchEvidenceIntegrityInput, 'sources' | 'phone' | 'phoneSourceUrl' | 'derivedClaims' | 'derivedPhoneEvidence'>,
): ResearchPhoneEvidenceIntegrityResult {
  const sources = normalizeSources(input.sources);
  const derived = input.derivedPhoneEvidence as Record<string, unknown> | undefined;

  // V1: source-backed independent phone evidence (from fetch + extraction)
  const hasIndependentEvidence =
    typeof derived === 'object' &&
    derived !== null &&
    derived.independentlyObserved === true &&
    derived.evidenceOrigin === 'FETCHED_SOURCE' &&
    typeof derived.phone === 'string' &&
    typeof derived.normalizedDigits === 'string' &&
    typeof derived.sourceUrl === 'string' &&
    typeof derived.evidenceType === 'string';

  if (hasIndependentEvidence) {
    const evidencePhone = (derived as { phone: string; normalizedDigits: string; sourceUrl: string; evidenceType: string }).phone;
    const evidenceDigits = (derived as { phone: string; normalizedDigits: string; sourceUrl: string; evidenceType: string }).normalizedDigits;
    const evidenceSourceUrl = (derived as { phone: string; normalizedDigits: string; sourceUrl: string; evidenceType: string }).sourceUrl;
    const evidenceType = (derived as { phone: string; normalizedDigits: string; sourceUrl: string; evidenceType: string }).evidenceType;
    const sourceOwnership = (derived as { sourceOwnership?: PhoneSourceOwnership }).sourceOwnership;
    const entityBound = (derived as { entityBound?: boolean }).entityBound;

    // Validate phone syntax and bind the normalized representation to the
    // independently observed value. Callers cannot attest one phone while
    // supplying the digits of another.
    const normalizedEvidencePhone = normalizePhoneDigits(evidencePhone);
    if (
      !looksLikePhone(evidencePhone) ||
      normalizedEvidencePhone.length < 8 ||
      normalizedEvidencePhone.length > 15 ||
      evidenceDigits !== normalizedEvidencePhone
    ) {
      return {
        acceptedSources: sources.accepted,
        rejectedSourceCount: sources.rejected,
        reason: 'MALFORMED_PHONE_EVIDENCE',
      };
    }

    // Validate evidence source URL is public
    const evidenceUrl = publicHttpUrl(evidenceSourceUrl);
    if (!evidenceUrl) {
      return {
        acceptedSources: sources.accepted,
        rejectedSourceCount: sources.rejected,
        reason: 'MALFORMED_PHONE_EVIDENCE',
      };
    }

    // Validate evidence type
    const validTypes = new Set(['TEL_HREF', 'JSON_LD_TELEPHONE', 'VISIBLE_PAGE_TEXT']);
    if (!validTypes.has(evidenceType) ||
      sourceOwnership === 'THIRD_PARTY_SITE_GLOBAL_CONTACT' ||
      sourceOwnership === 'AMBIGUOUS_SOURCE_OWNERSHIP' ||
      sourceOwnership === 'UNKNOWN' ||
      entityBound === false) {
      return {
        acceptedSources: sources.accepted,
        rejectedSourceCount: sources.rejected,
        reason: 'MALFORMED_PHONE_EVIDENCE',
      };
    }

    // The deterministic runner appends the fetched page as an accepted phone
    // source. Model-authored supports alone cannot reach this branch because
    // derivedPhoneEvidence is stripped before runner enrichment.
    if (!sources.accepted.some((source) =>
      source.url === evidenceUrl.toString() && source.supports.includes('phone')
    )) {
      return {
        acceptedSources: sources.accepted,
        rejectedSourceCount: sources.rejected,
        reason: 'UNSUPPORTED_PHONE',
      };
    }

    const trustedPhone: TrustedResearchPhone = {
      phone: evidencePhone,
      normalizedDigits: evidenceDigits,
      sourceUrl: evidenceUrl.toString(),
      evidenceType: evidenceType as TrustedResearchPhone['evidenceType'],
      evidenceOrigin: 'FETCHED_SOURCE',
      independentlyObserved: true,
      ...(sourceOwnership ? { sourceOwnership } : {}),
      ...(entityBound === true ? { entityBound: true as const } : {}),
    };

    // If a model phone was also provided and disagrees, record discrepancy
    const modelPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
    const modelDigits = modelPhone.replace(/\D/g, '');
    if (modelPhone && modelDigits !== evidenceDigits) {
      return {
        acceptedSources: sources.accepted,
        rejectedSourceCount: sources.rejected,
        trustedPhone,
        reason: 'DERIVED_PHONE_DISAGREES_WITH_MODEL',
      };
    }

    return {
      acceptedSources: sources.accepted,
      rejectedSourceCount: sources.rejected,
      trustedPhone,
    };
  }

  // No independent evidence: model-only path is fail-closed.
  if (typeof input.phone !== 'string' || !input.phone.trim()) {
    return {
      acceptedSources: sources.accepted,
      rejectedSourceCount: sources.rejected,
    };
  }

  const phone = input.phone.trim();
  const digits = phone.replace(/\D/g, '');
  const phoneSource = publicHttpUrl(input.phoneSourceUrl);

  if (digits.length < 8 || digits.length > 15 || !phoneSource) {
    return {
      acceptedSources: sources.accepted,
      rejectedSourceCount: sources.rejected,
      reason: 'MALFORMED_PHONE_EVIDENCE',
    };
  }

  // All available inputs (phone, phoneSourceUrl, source.url, source.note,
  // source.supports, derivedClaims) originate from the LLM research swarm and
  // alone cannot break the model-claim → evidence circuit.
  return {
    acceptedSources: sources.accepted,
    rejectedSourceCount: sources.rejected,
    reason: 'UNSUPPORTED_PHONE',
  };
}

function normalizeScores(value: unknown): {
  values: Record<ResearchScoreKey, number>;
  valid: boolean;
} {
  const source = record(value);
  const values = Object.fromEntries(RESEARCH_SCORE_KEYS.map((key) => [key, 0])) as Record<ResearchScoreKey, number>;
  let valid = Boolean(source);
  for (const key of RESEARCH_SCORE_KEYS) {
    const score = source?.[key];
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
      valid = false;
      continue;
    }
    values[key] = score;
  }
  return { values, valid };
}

function sameOrigin(left: string, right: URL): boolean {
  const parsed = publicHttpUrl(left);
  return parsed?.origin === right.origin;
}

export function evaluateResearchEvidenceIntegrity(
  input: ResearchEvidenceIntegrityInput,
): ResearchEvidenceIntegrityResult {
  const reasons: string[] = [];
  const phoneIntegrity = evaluateResearchPhoneEvidenceIntegrity({
    ...input,
    derivedClaims: input.derivedClaims,
  });
  const sources = {
    accepted: [...phoneIntegrity.acceptedSources],
    rejected: phoneIntegrity.rejectedSourceCount,
  };
  const scores = normalizeScores(input.scoreInputs);
  const supported = new Set<ResearchEvidenceClaim>(
    sources.accepted.flatMap((source) => [...source.supports]),
  );

  // Merge deterministically derived claims — these are claims that the system
  // can reason about from source-backed facts without an explicit annotation.
  if (Array.isArray(input.derivedClaims)) {
    for (const claim of input.derivedClaims) {
      if (claims.has(claim)) supported.add(claim);
    }
  }

  // SECURITY INVARIANT: phone and contactability claims must NOT be accepted
  // from model-authored source.supports or derivedClaims alone. They are only
  // valid when independent deterministic phone evidence exists (trustedPhone).
  // This gate runs AFTER the derived-claims merge so that even a derived
  // phone/contactability claim cannot bypass the independent-evidence requirement.
  if (phoneIntegrity.trustedPhone) {
    // Independent evidence exists — promote phone and contactability regardless
    // of whether they were in source.supports or derivedClaims.
    supported.add('phone');
    supported.add('contactability');
  } else {
    // No independent evidence — strip any phone/contactability that may have
    // been added by source.supports or derivedClaims.
    supported.delete('phone');
    supported.delete('contactability');
  }

  if (sources.accepted.length === 0) reasons.push('MISSING_ACCEPTED_SOURCES');
  if (!scores.valid) reasons.push('MALFORMED_SCORE_INPUTS');
  for (const key of scoreEvidenceClaims) {
    if (scores.values[key] > 0 && !supported.has(key)) reasons.push(`UNSUPPORTED_SCORE:${key}`);
  }

  let trustedWebsiteUrl: string | undefined;
  if (typeof input.websiteUrl === 'string' && input.websiteUrl.trim()) {
    const website = publicHttpUrl(input.websiteUrl);
    if (!website) reasons.push('MALFORMED_WEBSITE');
    else if (sources.accepted.some((source) =>
      source.supports.includes('website') && sameOrigin(source.url, website),
    )) trustedWebsiteUrl = website.toString();
    else reasons.push('UNSUPPORTED_WEBSITE');
  }

  if (phoneIntegrity.reason) reasons.push(phoneIntegrity.reason);

  const blockingReasons = reasons.filter((reason) =>
    reason === 'MISSING_ACCEPTED_SOURCES' ||
    reason === 'MALFORMED_SCORE_INPUTS' ||
    reason.startsWith('UNSUPPORTED_SCORE:'),
  );
  return {
    passed: blockingReasons.length === 0,
    reasons,
    acceptedSources: sources.accepted,
    rejectedSourceCount: sources.rejected,
    supportedClaims: RESEARCH_EVIDENCE_CLAIMS.filter((claim) => supported.has(claim)),
    scoreInputs: scores.values,
    ...(trustedWebsiteUrl ? { trustedWebsiteUrl } : {}),
    ...(phoneIntegrity.trustedPhone
      ? { trustedPhone: phoneIntegrity.trustedPhone }
      : {}),
  };
}

export function hasSupportedResearchClaim(
  result: ResearchEvidenceIntegrityResult,
  claim: ResearchEvidenceClaim,
): boolean {
  return result.supportedClaims.includes(claim);
}
import { looksLikePhone, normalizePhoneDigits, type PhoneEvidenceType } from './phone-extractor';
