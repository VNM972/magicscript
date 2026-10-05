/**
 * Deterministic per-phone contact model (V1).
 *
 * A prospect may legitimately retain MULTIPLE phone numbers (several mobiles, a
 * mobile + a landline, several landlines, verified + unverified from different
 * sources). This module models each phone as an independent record with its own type,
 * source, provenance and trust state. Trust is per phone, never prospect-wide.
 *
 * SECURITY INVARIANT:
 *   - A phone's type is only ever UNKNOWN when it cannot be determined reliably.
 *     It is never guessed merely to improve prioritization.
 *   - Trust is attached individually to (phone + provenance + entity/branch binding).
 *   - Mobility (MOBILE) NEVER implies WhatsApp capability. WhatsApp remains an
 *     independently verified capability in its own field.
 *   - A LANDLINE is never selected for SMS/WhatsApp.
 *
 * Phone-number normalization and type-classification uses libphonenumber-js/max
 * for authoritative E.164 formatting and type detection.
 *
 * The caller MAY supply an ISO country code (FR, MQ, etc.) when the number is
 * in local format. Numbers already in international format (+33…) need no
 * country context because the library detects the country calling code automatically.
 */

/**
 * Phone normalization and type classification.
 *
 * Uses libphonenumber-js (max metadata variant) for authoritative
 * international-standard E.164 formatting and phone type detection.
 * Falls back only for in-memory normalization: the raw number string is
 * always preserved as displayPhone for the operator; the E.164 result from
 * the library is stored as the canonical normalized form.
 *
 * When no country code is available and the number is in local format without
 * an international prefix, normalization may fail: the phone is recorded as
 * having a parsing failure, not as a bogus +0... value.
 */

import { parsePhoneNumber, type PhoneNumber, type CountryCode } from 'libphonenumber-js/max';

export const PHONE_RECORD_SCHEMA_VERSION = 'phone-record.v1';

export type PhoneType =
  | 'MOBILE'
  | 'LANDLINE'
  | 'FIXED_LINE_OR_MOBILE'
  | 'UNKNOWN';

export type PhoneRecordTrustStatus =
  | 'TRUSTED'
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'REJECTED'
  | 'AMBIGUOUS';

export type PhoneSourceKind =
  | 'FIRST_PARTY_OFFICIAL_SITE'
  | 'AUTHORITATIVE_GOVERNMENT_SOURCE'
  | 'GOOGLE_PLACES_CANDIDATE'
  | 'THIRD_PARTY_LISTING_BUSINESS_FIELD'
  | 'OTHER_VERIFIED_SOURCE'
  | 'UNKNOWN';

export type PhoneIdentityBinding =
  | 'VERIFIED'
  | 'AMBIGUOUS'
  | 'REJECTED'
  | 'UNKNOWN';

export type PhoneBranchBinding =
  | 'MATCH'
  | 'MISMATCH'
  | 'UNKNOWN'
  | 'NOT_EVALUATED';

export interface PhoneRecord {
  prospectId: string;
  normalizedPhone: string;
  displayPhone: string;
  phoneType: PhoneType;
  sourceKind: PhoneSourceKind;
  sourceUrl?: string;
  identityBinding: PhoneIdentityBinding;
  branchBinding: PhoneBranchBinding;
  branchLabel?: string;
  trustStatus: PhoneRecordTrustStatus;
  trustReasonCodes: string[];
  acquiredAt: string;
  lastVerifiedAt?: string;
  schemaVersion: typeof PHONE_RECORD_SCHEMA_VERSION;
}

export interface PhoneCapabilities {
  whatsappUsable: boolean;
  smsEligible: boolean;
  whatsappReasonCodes: string[];
}

export interface PhoneCollectionResult {
  phones: PhoneRecord[];
  preferredPhone: PhoneRecord | null;
  preferredMobile: PhoneRecord | null;
  deduplicated: boolean;
}

export type PhoneParseResult =
  | { ok: true; e164: string; type: PhoneType; possible: boolean }
  | { ok: false; reason: string };

/**
 * Parse and normalize a phone number using the authoritative library.
 *
 * Returns E.164-formatted string, phone type (MOBILE / LANDLINE /
 * FIXED_LINE_OR_MOBILE / UNKNOWN), and a possible/valid flag.
 *
 * When the library cannot parse (missing country for a local number, malformed),
 * returns a structured failure.
 */
export function parsePhone(
  value: string,
  countryCode?: string | null,
): PhoneParseResult {
  let parsed: PhoneNumber;
  try {
    parsed = countryCode
      ? parsePhoneNumber(value, countryCode as CountryCode)
      : parsePhoneNumber(value);
  } catch {
    return { ok: false, reason: 'PARSE_FAILED' };
  }
  if (!parsed || !parsed.number || !parsed.isPossible()) {
    return { ok: false, reason: 'IMPOSSIBLE_OR_EMPTY' };
  }
  const e164 = parsed.number;
  const libType: string | undefined = parsed.getType();
  const type = mapPhoneType(libType ?? null);
  return { ok: true, e164, type, possible: parsed.isPossible() };
}

/**
 * Normalize to E.164 using the authoritative library.
 *
 * Simplifies typical callers that only need the E.164 string and accept
 * the default product behavior: pass MQ for Martinique local numbers, FR for
 * France local numbers, and no country for international-format numbers.
 */
export function normalizePhoneE164(value: string, countryCode?: string | null): string {
  if (!value) return '';
  const result = parsePhone(value, countryCode);
  return result.ok ? result.e164 : '';
}

/**
 * Classify a phone type using the authoritative library.
 *
 * Accepts the raw phone string and optionally an ISO country code.
 * Maps the library's type to the Magic Script product model.
 *
 * The mapping guarantees:
 *   - library MOBILE                           → MOBILE
 *   - library FIXED_LINE                       → LANDLINE
 *   - library FIXED_LINE_OR_MOBILE             → FIXED_LINE_OR_MOBILE
 *   - everything else not verifiably these     → UNKNOWN
 *
 * Nothing is ever guessed into MOBILE or LANDLINE merely to improve ranking.
 * VOIP, TOLL_FREE, PREMIUM_RATE, PERSONAL_NUMBER etc. all stay UNKNOWN.
 */
export function classifyPhoneType(value: string, countryCode?: string | null): PhoneType {
  if (!value) return 'UNKNOWN';
  const result = parsePhone(value, countryCode);
  if (!result.ok) return 'UNKNOWN';
  return result.type;
}

/** Map authoritative library phone types to the product model. */
function mapPhoneType(libType: string | null): PhoneType {
  if (!libType) return 'UNKNOWN';
  switch (libType) {
    case 'MOBILE': return 'MOBILE';
    case 'FIXED_LINE': return 'LANDLINE';
    case 'FIXED_LINE_OR_MOBILE': return 'FIXED_LINE_OR_MOBILE';
    default: return 'UNKNOWN';
  }
}

/** A LANDLINE is never eligible for SMS/WhatsApp by default. */
export function phoneCapabilities(record: PhoneRecord): PhoneCapabilities {
  if (record.trustStatus === 'REJECTED' || record.identityBinding === 'REJECTED') {
    return {
      whatsappUsable: false,
      smsEligible: false,
      whatsappReasonCodes: ['PHONE_REJECTED'],
    };
  }
  if (record.phoneType === 'LANDLINE') {
    return {
      whatsappUsable: false,
      smsEligible: false,
      whatsappReasonCodes: ['LANDLINE_NOT_WHATSAPP_CAPABLE'],
    };
  }
  // MOBILE does not imply WhatsApp; only the separate capability system can prove it.
  if (record.phoneType === 'MOBILE') {
    return {
      whatsappUsable: false,
      smsEligible: true,
      whatsappReasonCodes: ['MOBILE_DOES_NOT_IMPLY_WHATSAPP'],
    };
  }
  return {
    whatsappUsable: false,
    smsEligible: false,
    whatsappReasonCodes: ['CAPABILITY_UNPROVEN'],
  };
}

/** XOR marker used solely to avoid the conservative-mobile regex matching a landline. */
const rank = (record: PhoneRecord): number => {
  const trust =
    record.trustStatus === 'TRUSTED'
      ? 0
      : record.trustStatus === 'VERIFIED'
        ? 1
        : record.trustStatus === 'UNVERIFIED'
          ? 2
          : 999;
  const type =
    record.phoneType === 'MOBILE'
      ? 0
      : record.phoneType === 'FIXED_LINE_OR_MOBILE'
        ? 1
        : record.phoneType === 'LANDLINE'
          ? 2
          : 3;
  // 1. TRUSTED MOBILE, 2. VERIFIED MOBILE, 3. OTHER ENTITY-BOUND MOBILE,
  // 4. TRUSTED/VERIFIED FIXED_LINE_OR_MOBILE, 5. LANDLINE, 6. UNKNOWN.
  if (record.phoneType === 'MOBILE') return trust; // 0..2
  if (record.phoneType === 'FIXED_LINE_OR_MOBILE') return 10 + trust;
  if (record.phoneType === 'LANDLINE') return 100 + trust;
  return 1000;
};

/**
 * Order a phone collection deterministically for operator display.
 * Heading categories: preferred displayed first; ties resolve by trust then normalized.
 */
export function orderPhonesForDisplay(records: readonly PhoneRecord[]): PhoneRecord[] {
  return [...records].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.lastVerifiedAt ?? '').localeCompare(b.lastVerifiedAt ?? '') ||
      a.normalizedPhone.localeCompare(b.normalizedPhone),
  );
}

/** Deterministic preferred-mobile selection from an ordered collection. */
export function preferredMobile(records: readonly PhoneRecord[]): PhoneRecord | null {
  return (
    orderPhonesForDisplay(records).find(
      (record) => record.phoneType === 'MOBILE',
    ) ?? null
  );
}

/** Deterministic operator-facing preferred number (may be a landline if no mobile). */
export function preferredPhone(records: readonly PhoneRecord[]): PhoneRecord | null {
  return orderPhonesForDisplay(records)[0] ?? null;
}

/**
 * Deduplicate primarily by normalizedPhone + prospectId (+ binding/type when a
 * second legitimate source supports the same normalized number). Provenance/source
 * multiplicity is folded into trustReasonCodes rather than creating duplicate entries.
 */
export function deduplicatePhones(
  records: readonly PhoneRecord[],
): PhoneRecord[] {
  const seen = new Map<string, PhoneRecord>();
  for (const record of [...records].sort(
    (a, b) => rank(a) - rank(b),
  )) {
    const key = `${record.prospectId}\n${record.normalizedPhone}`;
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, record);
      continue;
    }
    // Merge provenance/trust without duplicating the row: keep the strongest.
    seen.set(key, {
      ...prior,
      identityBinding:
        prior.identityBinding === 'VERIFIED'
          ? 'VERIFIED'
          : record.identityBinding === 'VERIFIED'
            ? 'VERIFIED'
            : prior.identityBinding === 'AMBIGUOUS' ||
                record.identityBinding === 'AMBIGUOUS'
              ? 'AMBIGUOUS'
              : 'UNKNOWN',
      trustStatus:
        prior.trustStatus === 'TRUSTED' || record.trustStatus === 'TRUSTED'
          ? 'TRUSTED'
          : 'UNVERIFIED',
      trustReasonCodes: [
        ...new Set([...prior.trustReasonCodes, ...record.trustReasonCodes]),
      ],
      phoneType:
        prior.phoneType === 'MOBILE' || record.phoneType === 'MOBILE'
          ? 'MOBILE'
          : prior.phoneType === 'UNKNOWN'
            ? record.phoneType
            : prior.phoneType,
    });
  }
  return orderPhonesForDisplay([...seen.values()]);
}

/**
 * Build a multi-phone collection result. Deduplicates, orders for display, derives
 * the preferred mobile and preferred phone, and never counts duplicates as extra weight.
 */
export function buildPhoneCollection(
  records: readonly PhoneRecord[],
): PhoneCollectionResult {
  const deduplicated = deduplicatePhones(records);
  return {
    phones: deduplicated,
    preferredPhone: preferredPhone(deduplicated),
    preferredMobile: preferredMobile(deduplicated),
    deduplicated: deduplicated.length !== records.length,
  };
}