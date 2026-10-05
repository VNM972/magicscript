import { classifyPhoneType, normalizePhoneE164, type PhoneType } from '../phone/phone-record';

export const CONTACT_OPPORTUNITY_PACK_VERSION = 'CONTACT_OPPORTUNITY_PACK_V2' as const;
export const V2_ADMISSION_STATE = 'INGESTED' as const;

export type PackContactChannel = 'EMAIL' | 'MOBILE' | 'LANDLINE' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'CONTACT_FORM';
export type AdmissionReasonCode = 'ADMITTED' | 'NO_QUALIFYING_CONTACT' | 'FIXED_PHONE_ONLY' | 'INVALID_CONTACT' | 'DUPLICATE' | 'INVALID_PACK';

export interface PackIdentity {
  businessName: string;
  legalName?: string;
  siren?: string;
  siret?: string;
  websiteUrl?: string;
  domain?: string;
  city?: string;
  location?: string;
}

export interface PackContact {
  channel: PackContactChannel;
  value: string;
  sourceUrl?: string;
  sourceType?: string;
  /** Caller claims are retained as provenance only; admission validation is derived locally. */
  validationStatus?: 'UNVERIFIED' | 'VALIDATED' | 'REJECTED';
}

export interface PackOpportunity {
  observedOpportunity?: string;
  digitalFriction?: string;
  businessContext?: string;
  agent1Verdict?: string;
  /** Typed ICP evidence supplied by Agent 1 for the canonical decision engine. */
  icp?: {
    commercialFamily?: 'RESTAURANTS_BARS_CAFES' | 'BEAUTY_HAIR_BARBER' | 'LOCAL_RETAIL' | 'LOCAL_SERVICES';
    /**
     * Official NAF/APE activity code (e.g. "47.78C") produced deterministically
     * by upstream INSEE / Recherche Entreprises discovery. This is the producer-backed
     * authority for the LOCAL_RETAIL commercial family (NAF division 47 only).
     * Free-text or LLM-inferred values never substitute for this field.
     */
    nafCode?: string;
    websiteQuality?: { isProfessional: boolean; observations?: readonly string[] };
    decisionAuthority?: { isCentrallyManaged: boolean; hasLocalAuthority: boolean; observations?: readonly string[] };
    digitalPainSignals?: readonly string[];
    requiresUnprovenCapability?: boolean;
    bookingPlatformWithNoAdditionalValue?: boolean;
    isCorporatePhotographerWithModernSite?: boolean;
    outsideCommercialIcp?: boolean;
  };
}

export interface ContactOpportunityPackV2 {
  schemaVersion: typeof CONTACT_OPPORTUNITY_PACK_VERSION;
  packId: string;
  source: { agent: 'AGENT_1'; provenance: string; receivedAt: string };
  identity: PackIdentity;
  contacts: readonly PackContact[];
  opportunity: PackOpportunity;
  evidence?: readonly { url: string; note: string; supports: readonly string[]; observedAt?: string }[];
}

export interface NormalizedPackContact extends PackContact {
  normalizedValue: string;
  trustStatus: 'DERIVED_VALID' | 'INVALID';
  phoneType?: PhoneType;
}

export interface NormalizedContactOpportunityPack extends Omit<ContactOpportunityPackV2, 'identity' | 'contacts'> {
  identity: PackIdentity & { domain?: string };
  contacts: readonly NormalizedPackContact[];
}

export interface AdmissionResult {
  admitted: boolean;
  state?: typeof V2_ADMISSION_STATE;
  reasonCode: AdmissionReasonCode;
  canonicalProspectId?: string;
  normalizedPack?: NormalizedContactOpportunityPack;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return emailPattern.test(normalized) && normalized.length <= 254 ? normalized : null;
}

export function normalizeDomain(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch { return null; }
}

function phoneCountry(value: string, identity: PackIdentity): string | undefined {
  if (/^\s*(?:\+|00)/.test(value)) return undefined;
  const location = `${identity.location ?? ''} ${identity.city ?? ''}`.toLowerCase();
  return /martinique|fort-de-france|972/.test(location) ? 'MQ' : 'FR';
}

function normalizeAdmissionPhone(value: string, identity: PackIdentity): { normalizedValue: string; phoneType: PhoneType } {
  const country = phoneCountry(value, identity);
  const normalizedValue = normalizePhoneE164(value, country);
  const phoneType = normalizedValue ? classifyPhoneType(value, country) : 'UNKNOWN';
  const nationalDigits = value.replace(/\D/g, '');
  if (country !== 'MQ' || phoneType !== 'UNKNOWN' || !/^0[67]\d{8}$/.test(nationalDigits)) return { normalizedValue, phoneType };

  // Martinique identity selects MQ for local numbers, but French-format 06/07
  // mobiles remain legitimate. This bounded fallback never applies to 05/landlines
  // and never overrides a valid MQ mobile or landline classification.
  const frenchType = classifyPhoneType(value, 'FR');
  if (frenchType === 'MOBILE') {
    return {
      normalizedValue: normalizePhoneE164(value, 'FR'),
      phoneType: frenchType,
    };
  }
  return { normalizedValue, phoneType };
}

export function normalizePackContact(contact: PackContact, identity: PackIdentity): NormalizedPackContact {
  if (contact.channel === 'EMAIL') {
    const normalizedValue = normalizeEmail(contact.value);
    return { ...contact, normalizedValue: normalizedValue ?? contact.value.trim().toLowerCase(), trustStatus: normalizedValue ? 'DERIVED_VALID' : 'INVALID' };
  }
  if (contact.channel === 'MOBILE' || contact.channel === 'LANDLINE' || contact.channel === 'WHATSAPP') {
    const { normalizedValue, phoneType } = normalizeAdmissionPhone(contact.value, identity);
    const qualifiesAsMobile = (contact.channel === 'MOBILE' || contact.channel === 'WHATSAPP') && phoneType === 'MOBILE';
    return { ...contact, normalizedValue: normalizedValue || contact.value.trim(), phoneType, trustStatus: qualifiesAsMobile || (contact.channel === 'LANDLINE' && phoneType === 'LANDLINE') ? 'DERIVED_VALID' : 'INVALID' };
  }
  return { ...contact, normalizedValue: contact.value.trim(), trustStatus: 'INVALID' };
}

export function normalizePack(pack: ContactOpportunityPackV2): NormalizedContactOpportunityPack {
  const domain = normalizeDomain(pack.identity.domain ?? pack.identity.websiteUrl ?? '');
  return { ...pack, identity: { ...pack.identity, domain: domain ?? undefined }, contacts: pack.contacts.map((contact) => normalizePackContact(contact, pack.identity)) };
}

export function validatePackShape(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['PACK_NOT_OBJECT'];
  const pack = value as Record<string, unknown>;
  const reasons: string[] = [];
  if (pack.schemaVersion !== CONTACT_OPPORTUNITY_PACK_VERSION) reasons.push('INVALID_SCHEMA_VERSION');
  if (typeof pack.packId !== 'string' || !pack.packId.trim()) reasons.push('MISSING_PACK_ID');
  if (!pack.source || typeof pack.source !== 'object') reasons.push('MISSING_SOURCE');
  if (!pack.identity || typeof pack.identity !== 'object') reasons.push('MISSING_IDENTITY');
  else {
    const identity = pack.identity as Record<string, unknown>;
    const businessName = identity.businessName;
    if (typeof businessName !== 'string' || !businessName.trim()) reasons.push('MISSING_BUSINESS_NAME');
  }
  if (!Array.isArray(pack.contacts)) reasons.push('MISSING_CONTACTS');
  if (!pack.opportunity || typeof pack.opportunity !== 'object') reasons.push('MISSING_OPPORTUNITY');
  return reasons;
}

/**
 * True when a single normalized contact is a qualifying admission channel:
 * a DERIVED_VALID EMAIL, or a DERIVED_VALID MOBILE classified as mobile type.
 * Landline, Instagram, Facebook and contact-form alone never qualify.
 */
export function qualifyPackContact(contact: NormalizedPackContact): boolean {
  return contact.trustStatus === 'DERIVED_VALID' && (contact.channel === 'EMAIL' || (contact.channel === 'MOBILE' && contact.phoneType === 'MOBILE'));
}

export function qualifyingContacts(pack: NormalizedContactOpportunityPack): NormalizedPackContact[] {
  return pack.contacts.filter(qualifyPackContact);
}
