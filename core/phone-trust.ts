export const PHONE_TRUST_SCHEMA_VERSION = 'trusted-phone-state.v1';
export type PhoneTrustStatus = 'TRUSTED' | 'REVOKED' | 'AMBIGUOUS' | 'UNTRUSTED';
import type { PhoneSourceOwnership } from './research/evidence-integrity';
export type { PhoneSourceOwnership } from './research/evidence-integrity';
export type CommercialClassification =
  | 'REAL_COMMERCIAL'
  | 'INTERNAL_RELATION'
  | 'EXISTING_MAGIC_SCRIPT_ASSET'
  | 'SYNTHETIC_FIXTURE'
  | 'TECHNICAL_TEST'
  | 'OTHER_NON_COMMERCIAL';

export interface PhoneTrustInput {
  phone: string;
  sourceOwnership: PhoneSourceOwnership;
  entityBound: boolean;
  identityStatus: 'VERIFIED' | 'PROBABLE' | 'AMBIGUOUS' | 'REJECTED' | 'UNKNOWN';
  evidenceEventId?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
}

export interface PhoneTrustState extends PhoneTrustInput {
  normalizedPhone: string;
  trustStatus: PhoneTrustStatus;
  trustReason: string;
  schemaVersion: typeof PHONE_TRUST_SCHEMA_VERSION;
}

export function normalizePhone(value: string): string { return value.replace(/\D/g, '').replace(/^00/, ''); }

export function classifyCommercialEntity(name: string, metadata: Record<string, unknown> = {}): CommercialClassification {
  const text = `${name} ${String(metadata.brandKey ?? '')} ${String(metadata.state ?? '')} ${String(metadata.location ?? '')}`.toLocaleLowerCase('fr-FR');
  if (/whatsapp\s*e2e|technical|techn(?:ical|ique)|test|fixture|synthetic/.test(text)) return 'TECHNICAL_TEST';
  if (/magic\s*script|safiu|internal/.test(text)) return 'EXISTING_MAGIC_SCRIPT_ASSET';
  if (/relation|partner|internal/.test(text)) return 'INTERNAL_RELATION';
  return 'REAL_COMMERCIAL';
}

export function recomputePhoneTrust(input: PhoneTrustInput): PhoneTrustState {
  const normalizedPhone = normalizePhone(input.phone);
  const acceptableOwnership = input.sourceOwnership === 'OWNED_BUSINESS_SOURCE' || input.sourceOwnership === 'DIRECT_STRUCTURED_BUSINESS_SOURCE' || input.sourceOwnership === 'THIRD_PARTY_LISTING_BUSINESS_FIELD';
  if (!normalizedPhone) return { ...input, normalizedPhone, trustStatus: 'UNTRUSTED', trustReason: 'phone is empty or has no digits', schemaVersion: PHONE_TRUST_SCHEMA_VERSION };
  if (input.sourceOwnership === 'THIRD_PARTY_SITE_GLOBAL_CONTACT') return { ...input, normalizedPhone, trustStatus: 'REVOKED', trustReason: 'third-party global/support phone is not target-business evidence', schemaVersion: PHONE_TRUST_SCHEMA_VERSION };
  if (!acceptableOwnership || !input.entityBound) return { ...input, normalizedPhone, trustStatus: 'AMBIGUOUS', trustReason: 'source ownership or entity binding is insufficient', schemaVersion: PHONE_TRUST_SCHEMA_VERSION };
  if (input.identityStatus !== 'VERIFIED') return { ...input, normalizedPhone, trustStatus: 'AMBIGUOUS', trustReason: `identity status ${input.identityStatus} is not VERIFIED`, schemaVersion: PHONE_TRUST_SCHEMA_VERSION };
  return { ...input, normalizedPhone, trustStatus: 'TRUSTED', trustReason: 'entity-bound phone with acceptable source ownership and VERIFIED identity', schemaVersion: PHONE_TRUST_SCHEMA_VERSION };
}

export function trustedPhoneContributesContactability(state: Pick<PhoneTrustState, 'trustStatus'> | null | undefined): boolean { return state?.trustStatus === 'TRUSTED'; }

/**
 * Backward-compatible multi-phone projection.
 *
 * Overrides/extends the legacy single `phone`/`trustedPhone` fields for API and
 * Control Center consumers that still need a string, while keeping per-phone trust and
 * provenance intact. Multiple phone numbers never inflate contactability: precedence is
 * fixed to the ordered preferred mobile / preferred phone.
 *
 * If the caller passes PhoneRecord[] they use the new multi-phone model; if they pass a
 * structured PhoneCollectionResult they get the projected single fields from it directly.
 */
export interface MultiPhoneProjection {
  phones: string[];
  mobileNumbers: string[];
  landlineNumbers: string[];
  unknownNumbers: string[];
  preferredPhone: string | null;
  preferredMobile: string | null;
  whatsappEligible: { phone: string; eligible: boolean; reasonCodes: string[] }[];
  schemaVersion: 'multiphone-projection.v1';
}

export function projectMultiPhone(
  records: ReadonlyArray<{
    normalizedPhone: string;
    displayPhone?: string;
    phoneType: string;
    trustStatus: string;
  }>,
): MultiPhoneProjection {
  const phones = records.map((record) => record.normalizedPhone);
  const mobile = records.filter((r) => r.phoneType === 'MOBILE').map((r) => r.normalizedPhone);
  const landline = records.filter((r) => r.phoneType === 'LANDLINE').map((r) => r.normalizedPhone);
  const unknown = records.filter((r) => r.phoneType === 'UNKNOWN' || r.phoneType === 'FIXED_LINE_OR_MOBILE').map((r) => r.normalizedPhone);
  const ordered = [...records].sort((a, b) => {
    const rank = (r: { phoneType: string; trustStatus: string }) =>
      r.phoneType === 'MOBILE' ? 0 : r.phoneType === 'FIXED_LINE_OR_MOBILE' ? 1 : r.phoneType === 'LANDLINE' ? 2 : 3;
    return rank(a) - rank(b) || (a.trustStatus === 'TRUSTED' ? 0 : 1) - (b.trustStatus === 'TRUSTED' ? 0 : 1) || a.normalizedPhone.localeCompare(b.normalizedPhone);
  });
  const preferredPhone = ordered[0]?.normalizedPhone ?? null;
  const preferredMobile = ordered.find((r) => r.phoneType === 'MOBILE')?.normalizedPhone ?? null;
  return {
    phones,
    mobileNumbers: mobile,
    landlineNumbers: landline,
    unknownNumbers: unknown,
    preferredPhone,
    preferredMobile,
    whatsappEligible: [],
    schemaVersion: 'multiphone-projection.v1',
  };
}
