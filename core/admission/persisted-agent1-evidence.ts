import type { ProspectState } from '../types/prospect';
import { publicHttpUrl, type AcceptedResearchSource, type ResearchEvidenceClaim, type TrustedResearchPhone } from '../research/evidence-integrity';
import { classifyPhoneType, normalizePhoneE164 } from '../phone/phone-record';
import { resolveCommercialFamilyFromNaf, type CommercialFamily } from '../icp/icp-decision';
import { resolveLocalServicesFromOperatingFacts } from '../icp/local-service-archetypes';
import { classifySourceType } from '../contact-acquisition/agent';
import { acceptedDigitalPainEvidence, type DigitalPainEvidence } from '../research/digital-pain-evidence';
import { acceptedOperatingEvidence, type OperatingEvidence } from '../research/operating-evidence';
import { normalizeEmail } from './contact-opportunity-pack';
import type { Agent1QualifiedEvidence } from './agent1-evidence-projection';

export interface PersistedAgent1Prospect {
  id: string;
  companyName: string;
  legalName?: string;
  siren?: string;
  siret?: string;
  city?: string;
  location?: string;
  websiteUrl?: string;
  phone?: string;
  state: ProspectState;
  score?: number;
  /** Producer-backed NAF/APE activity from the persisted prospects row. */
  activity?: string;
}

export interface PersistedContactPresenceField {
  status?: string;
  values?: readonly unknown[];
  evidence?: readonly { value?: unknown; sourceUrl?: unknown }[];
}

export interface PersistedContactPresence {
  website?: PersistedContactPresenceField;
  email?: PersistedContactPresenceField;
  contactForm?: PersistedContactPresenceField;
  social?: PersistedContactPresenceField;
}

export interface PersistedAgent1Research {
  acceptedSources: readonly AcceptedResearchSource[];
  supportedClaims: readonly ResearchEvidenceClaim[];
  trustedWebsiteUrl?: string;
  trustedPhone?: TrustedResearchPhone;
  /** Explicit bounded absence authority supplied by persisted evidence. */
  websiteAbsent?: boolean;
  /** Persisted scored contact-presence authority from accepted research. */
  contactPresence?: PersistedContactPresence;
  /** Research integrity must pass before narrative claims can cross the bridge. */
  evidenceIntegrityPassed?: boolean;
  digitalPainSignals?: readonly string[];
  digitalPainEvidence?: DigitalPainEvidence;
  operatingEvidence?: OperatingEvidence;
  websiteQuality?: Agent1QualifiedEvidence['research']['websiteQuality'];
  decisionAuthority?: Agent1QualifiedEvidence['research']['decisionAuthority'];
  requiresUnprovenCapability?: boolean;
  outsideCommercialIcp?: boolean;
  outsideIcpReason?: string;
  operatingModel?: Agent1QualifiedEvidence['research']['operatingModel'];
}

export interface PersistedAgent1Contact {
  email: string;
  sourceUrl?: string;
  sourceType?: string;
  isValidated: boolean;
  isSuppressed: boolean;
}

export interface PersistedAgent1Authorities {
  prospect: PersistedAgent1Prospect;
  latestResearchRun: { status: 'SUCCEEDED' | 'FAILED' | 'RUNNING'; result?: Record<string, unknown> };
  scoredEvidence: PersistedAgent1Research;
  validatedContacts: readonly PersistedAgent1Contact[];
  nafCode?: string;
  commercialFamily?: CommercialFamily;
}

export type PersistedAgent1EvidenceResult =
  | { status: 'PROJECTABLE'; evidence: Agent1QualifiedEvidence }
  | { status: 'INSUFFICIENT_EVIDENCE'; reasons: readonly { code: string; detail: string }[] };

const families = new Set<CommercialFamily>([
  'RESTAURANTS_BARS_CAFES', 'BEAUTY_HAIR_BARBER', 'LOCAL_RETAIL', 'LOCAL_SERVICES',
]);

function hasClaim(research: PersistedAgent1Research, claim: ResearchEvidenceClaim): boolean {
  return research.supportedClaims.includes(claim);
}

function sourceFor(research: PersistedAgent1Research, claim: string, ref?: string): AcceptedResearchSource | undefined {
  return research.acceptedSources.find((source) =>
    (!ref || source.url === ref) && source.supports.includes(claim as ResearchEvidenceClaim));
}

function verifiedValues(field: PersistedContactPresenceField | undefined): string[] {
  if (field?.status !== 'VERIFIED' || !Array.isArray(field.values)) return [];
  return field.values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function schemeLessWebsiteHost(value: string): string | undefined {
  const host = value.trim().toLowerCase().replace(/\.$/, '');
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ? host : undefined;
}

export function ownedWebsiteFromPresence(research: PersistedAgent1Research): { url?: string; conflict: boolean } {
  const direct: string[] = [];
  const recovered: string[] = [];
  for (const value of verifiedValues(research.contactPresence?.website)) {
    const parsed = publicHttpUrl(value);
    if (parsed) {
      if (classifySourceType(value, true) === 'OWNED_WEBSITE') direct.push(value);
      continue;
    }
    const host = schemeLessWebsiteHost(value);
    if (!host || research.evidenceIntegrityPassed !== true || !hasClaim(research, 'website')) continue;
    for (const source of research.acceptedSources) {
      const accepted = publicHttpUrl(source.url);
      if (accepted?.hostname.toLowerCase().replace(/\.$/, '') !== host || !source.supports.includes('website')) continue;
      if (classifySourceType(source.url, true) === 'OWNED_WEBSITE') recovered.push(`${accepted.origin}/`);
    }
  }
  const origins = [...new Set([...direct, ...recovered].map((url) => new URL(url).origin))];
  return {
    url: origins.length === 1 ? (direct.length === 1 && !recovered.length ? direct[0] : `${origins[0]}/`) : undefined,
    conflict: origins.length > 1,
  };
}

function presenceSource(field: PersistedContactPresenceField | undefined, value: string): string | undefined {
  const evidence = field?.evidence?.find((item) => item.value === value && typeof item.sourceUrl === 'string');
  return typeof evidence?.sourceUrl === 'string' ? evidence.sourceUrl : undefined;
}

function failure(reasons: { code: string; detail: string }[]): PersistedAgent1EvidenceResult {
  return reasons.length ? { status: 'INSUFFICIENT_EVIDENCE', reasons } : { status: 'INSUFFICIENT_EVIDENCE', reasons: [{ code: 'INSUFFICIENT_EVIDENCE', detail: 'Persisted Agent 1 evidence is incomplete.' }] };
}

/**
 * Pure adapter from persisted Agent 1 authorities to the projector contract.
 * It performs no persistence, provider calls, inference, or side effects.
 */
export function buildAgent1QualifiedEvidence(input: PersistedAgent1Authorities): PersistedAgent1EvidenceResult {
  const { prospect, scoredEvidence: research } = input;
  const reasons: { code: string; detail: string }[] = [];
  if (prospect.state === 'DO_NOT_CONTACT') reasons.push({ code: 'CONTACT_EVIDENCE_UNVALIDATED', detail: 'A do-not-contact prospect cannot supply a V2 contact opportunity.' });
  if (input.latestResearchRun.status !== 'SUCCEEDED' || !input.latestResearchRun.result) reasons.push({ code: 'RESEARCH_NOT_SUCCEEDED', detail: 'Only the latest successful RUN_RESEARCH_SWARM result is authoritative.' });
  if (!research.acceptedSources.length || !research.supportedClaims.length) reasons.push({ code: 'RESEARCH_EVIDENCE_MISSING', detail: 'Persisted accepted research evidence is required.' });

  const presenceWebsite = ownedWebsiteFromPresence(research);
  if (presenceWebsite.conflict) reasons.push({ code: 'WEBSITE_AUTHORITY_CONFLICT', detail: 'Conflicting VERIFIED owned websites have no canonical precedence.' });
  // VERIFIED nested contact presence is the stronger website authority when it
  // survives source classification as an owned site. Do not let a stale
  // legacy trustedWebsiteUrl win merely because it is read first.
  const websiteUrl = presenceWebsite.url ?? (research.trustedWebsiteUrl && hasClaim(research, 'website')
    ? research.trustedWebsiteUrl
    : undefined);
  const websiteAuthorityAccepted = Boolean(presenceWebsite.url) || Boolean(research.trustedWebsiteUrl && hasClaim(research, 'website'));
  const typedPain = research.evidenceIntegrityPassed === true
    ? acceptedDigitalPainEvidence(research.digitalPainEvidence, research.acceptedSources, Boolean(websiteUrl))
    : { status: 'UNKNOWN' as const, observations: [] };
  const hasVerifiedAbsence = typedPain.status === 'VERIFIED' &&
    typedPain.observations.some((observation) => observation.type === 'WEBSITE_VERIFIED_ABSENT');
  const website = websiteUrl
    ? { status: 'VERIFIED_PRESENT' as const, url: websiteUrl }
    : hasVerifiedAbsence
      ? { status: 'VERIFIED_ABSENT' as const }
      : { status: 'UNKNOWN' as const };
  if (website.status === 'UNKNOWN' || !websiteAuthorityAccepted && website.status === 'VERIFIED_PRESENT') reasons.push({ code: 'WEBSITE_STATUS_UNVERIFIED', detail: 'Website presence or bounded absence is not proven by accepted evidence.' });
  if (hasVerifiedAbsence && research.websiteQuality?.isProfessional === true) reasons.push({ code: 'WEBSITE_AUTHORITY_CONFLICT', detail: 'Verified absence conflicts with a professional owned-site assessment.' });

  const pain = typedPain.status === 'VERIFIED'
    ? typedPain.observations.map((observation) => observation.observation)
    : [];
  if (!pain.length) {
    reasons.push({ code: 'DIGITAL_PAIN_UNPROVEN', detail: 'Digital pain must be grounded in an accepted persisted claim.' });
  }

  // D1's authoritative producer-backed NAF value is prospects.activity. Keep
  // resolution canonical and only use the explicit adapter field as a
  // compatibility fallback for callers that already separated it.
  const nafCode = prospect.activity ?? input.nafCode;
  const nafFamily = resolveCommercialFamilyFromNaf(nafCode);
  const suppliedFamily = input.commercialFamily && families.has(input.commercialFamily) ? input.commercialFamily : undefined;
  const operatingEvidence = research.evidenceIntegrityPassed === true
    ? acceptedOperatingEvidence(research.operatingEvidence, research.acceptedSources)
    : { status: 'UNKNOWN' as const, facts: [] };
  const serviceFamily = operatingEvidence.status === 'VERIFIED'
    ? resolveLocalServicesFromOperatingFacts(operatingEvidence.facts)
    : undefined;
  const family = nafFamily === 'LOCAL_RETAIL' ? nafFamily : suppliedFamily ?? serviceFamily;
  if (!family) reasons.push({ code: 'COMMERCIAL_FAMILY_UNRESOLVED', detail: 'No canonical family is established by existing authority.' });
  if (nafCode?.trim().toUpperCase().replace(/\s+/g, '') === '55.20Z' && (!research.operatingModel || research.operatingModel === 'UNKNOWN')) {
    reasons.push({ code: 'OPERATING_MODEL_UNRESOLVED', detail: 'NAF 55.20Z requires grounded operating-model evidence.' });
  }

  const contacts: Agent1QualifiedEvidence['contacts'][number][] = [];
  for (const contact of input.validatedContacts) {
    if (!contact.isValidated || contact.isSuppressed || !normalizeEmail(contact.email)) continue;
    contacts.push({ channel: 'EMAIL', value: contact.email, sourceUrl: contact.sourceUrl, sourceType: contact.sourceType, validated: true, evidenceRef: contact.sourceUrl });
  }
  for (const email of verifiedValues(research.contactPresence?.email)) {
    if (research.evidenceIntegrityPassed === false || !normalizeEmail(email)) continue;
    if (input.validatedContacts.some((contact) => contact.isSuppressed && normalizeEmail(contact.email) === normalizeEmail(email))) continue;
    if (input.validatedContacts.some((contact) => contact.isValidated && !contact.isSuppressed && normalizeEmail(contact.email) === normalizeEmail(email))) continue;
    contacts.push({ channel: 'EMAIL', value: email, sourceUrl: presenceSource(research.contactPresence?.email, email), validated: true, evidenceRef: presenceSource(research.contactPresence?.email, email) });
  }
  const phone = research.trustedPhone;
  if (phone && hasClaim(research, 'phone')) {
    const location = `${prospect.location ?? ''} ${prospect.city ?? ''}`;
    const country = /martinique|fort-de-france|972/i.test(location) ? 'MQ' : 'FR';
    const type = classifyPhoneType(phone.phone, country);
    const normalized = normalizePhoneE164(phone.phone, country);
    if (normalized && type === 'MOBILE') contacts.push({ channel: 'MOBILE', value: phone.phone, sourceUrl: phone.sourceUrl, validated: true, evidenceRef: phone.sourceUrl });
    else if (normalized && type === 'LANDLINE') contacts.push({ channel: 'LANDLINE', value: phone.phone, sourceUrl: phone.sourceUrl, validated: true, evidenceRef: phone.sourceUrl });
  }

  if (research.websiteQuality && !hasClaim(research, 'website') && website.status !== 'VERIFIED_PRESENT') reasons.push({ code: 'UNSUPPORTED_WEBSITE_QUALITY', detail: 'Website quality must be supported by accepted website evidence.' });
  if (research.decisionAuthority && !hasClaim(research, 'activity') && !hasClaim(research, 'opportunity')) reasons.push({ code: 'UNSUPPORTED_DECISION_AUTHORITY', detail: 'Decision authority requires explicit accepted evidence.' });
  if (research.requiresUnprovenCapability && !hasClaim(research, 'opportunity')) reasons.push({ code: 'UNSUPPORTED_CAPABILITY', detail: 'Capability requirement requires explicit accepted evidence.' });
  if (reasons.length) return failure(reasons);

  const evidence: Agent1QualifiedEvidence = {
    prospectId: prospect.id,
    // Legacy qualification remains observable, but does not authorize V2 projection.
    qualified: prospect.state === 'QUALIFIED',
    qualificationState: prospect.state === 'QUALIFIED' ? 'QUALIFIED' : prospect.state === 'RESEARCH_COMPLETE' ? 'RESEARCH_COMPLETE' : prospect.state === 'DISCOVERED' ? 'DISCOVERED' : 'OTHER',
    identity: { businessName: prospect.companyName, legalName: prospect.legalName, siren: prospect.siren, siret: prospect.siret, city: prospect.city, location: prospect.location, sourceRefs: research.acceptedSources.map((source) => source.url) },
    research: {
      acceptedSources: research.acceptedSources,
      supportedClaims: research.supportedClaims,
      website,
      digitalPainSignals: pain,
      digitalPainEvidence: typedPain,
      websiteQuality: research.websiteQuality,
      decisionAuthority: research.decisionAuthority,
      requiresUnprovenCapability: research.requiresUnprovenCapability,
      outsideCommercialIcp: research.outsideCommercialIcp,
      outsideIcpReason: research.outsideIcpReason,
      operatingModel: research.operatingModel,
    },
    classification: { commercialFamily: family, nafCode, sourceRefs: research.acceptedSources.map((source) => source.url) },
    contacts,
  };
  return { status: 'PROJECTABLE', evidence };
}

/** Build scored authority from a persisted research.scored event without trusting arbitrary fields. */
export function researchScoredAuthority(result: Record<string, unknown>): PersistedAgent1Research {
  const integrity = result.evidenceIntegrity && typeof result.evidenceIntegrity === 'object' ? result.evidenceIntegrity as Record<string, unknown> : {};
  const sources = Array.isArray(result.sources) ? result.sources as AcceptedResearchSource[] : [];
  const supportedClaims = Array.isArray(integrity.supportedClaims) ? integrity.supportedClaims.filter((value): value is ResearchEvidenceClaim => typeof value === 'string') : [];
  const digitalPainEvidence = integrity.passed === true
    ? acceptedDigitalPainEvidence(result.digitalPainEvidence, sources)
    : { status: 'UNKNOWN' as const, observations: [] };
  const operatingEvidence = integrity.passed === true
    ? acceptedOperatingEvidence(result.operatingEvidence, sources)
    : { status: 'UNKNOWN' as const, facts: [] };
  return {
    acceptedSources: sources,
    supportedClaims,
    trustedWebsiteUrl: typeof result.websiteUrl === 'string' ? result.websiteUrl : undefined,
    trustedPhone: result.phoneEvidence && typeof result.phoneEvidence === 'object' ? result.phoneEvidence as TrustedResearchPhone : undefined,
    contactPresence: result.contactPresence && typeof result.contactPresence === 'object' ? result.contactPresence as PersistedContactPresence : undefined,
    evidenceIntegrityPassed: integrity.passed === true,
    digitalPainEvidence,
    operatingEvidence,
    digitalPainSignals: digitalPainEvidence.status === 'VERIFIED'
      ? digitalPainEvidence.observations.map((observation) => observation.observation)
      : undefined,
    websiteAbsent: result.websiteAbsent === true,
    websiteQuality: result.websiteQuality && typeof result.websiteQuality === 'object' ? result.websiteQuality as Agent1QualifiedEvidence['research']['websiteQuality'] : undefined,
    decisionAuthority: result.decisionAuthority && typeof result.decisionAuthority === 'object' ? result.decisionAuthority as Agent1QualifiedEvidence['research']['decisionAuthority'] : undefined,
    requiresUnprovenCapability: result.requiresUnprovenCapability === true,
    outsideCommercialIcp: result.outsideCommercialIcp === true,
    outsideIcpReason: typeof result.outsideIcpReason === 'string' ? result.outsideIcpReason : undefined,
    operatingModel: result.operatingModel === 'INDEPENDENT_HOTEL' || result.operatingModel === 'SEASONAL_AIRBNB_RENTAL' || result.operatingModel === 'OTHER' || result.operatingModel === 'UNKNOWN' ? result.operatingModel : undefined,
  };
}
