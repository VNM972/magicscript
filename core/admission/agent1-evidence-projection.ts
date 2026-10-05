import {
  type ContactOpportunityPackV2,
  type PackContact,
} from './contact-opportunity-pack';
import { resolveCommercialFamilyFromNaf, type CommercialFamily } from '../icp/icp-decision';
import { acceptedDigitalPainEvidence, type DigitalPainEvidence } from '../research/digital-pain-evidence';

export const AGENT1_PACK_PROJECTION_VERSION = 'AGENT1_EVIDENCE_TO_PACK_V2_V1' as const;

export type ProjectionReasonCode =
  | 'IDENTITY_NOT_VALIDATED'
  | 'RESEARCH_EVIDENCE_MISSING'
  | 'WEBSITE_STATUS_UNVERIFIED'
  | 'DIGITAL_PAIN_UNPROVEN'
  | 'COMMERCIAL_FAMILY_UNRESOLVED'
  | 'UNSUPPORTED_COMMERCIAL_FAMILY'
  | 'OPERATING_MODEL_UNRESOLVED'
  | 'CONTACT_EVIDENCE_UNVALIDATED';

export interface Agent1QualifiedEvidence {
  prospectId: string;
  /** Legacy qualification metadata is retained for diagnostics, never as V2 authority. */
  qualified: boolean;
  qualificationState: 'QUALIFIED' | 'RESEARCH_COMPLETE' | 'DISCOVERED' | 'OTHER';
  identity: {
    businessName: string;
    legalName?: string;
    siren?: string;
    siret?: string;
    city?: string;
    location?: string;
    sourceRefs: readonly string[];
  };
  research: {
    acceptedSources: readonly { url: string; note: string; supports: readonly string[]; observedAt?: string }[];
    supportedClaims: readonly string[];
    website?: { status: 'VERIFIED_PRESENT' | 'VERIFIED_ABSENT' | 'UNKNOWN'; url?: string };
    digitalPainSignals?: readonly string[];
    digitalPainEvidence?: DigitalPainEvidence;
    websiteQuality?: { isProfessional: boolean; observations?: readonly string[] };
    decisionAuthority?: { isCentrallyManaged: boolean; hasLocalAuthority: boolean; observations?: readonly string[] };
    requiresUnprovenCapability?: boolean;
    outsideCommercialIcp?: boolean;
    outsideIcpReason?: string;
    operatingModel?: 'INDEPENDENT_HOTEL' | 'SEASONAL_AIRBNB_RENTAL' | 'OTHER' | 'UNKNOWN';
  };
  classification: {
    commercialFamily?: CommercialFamily | string;
    nafCode?: string;
    sourceRefs: readonly string[];
  };
  contacts: readonly (PackContact & {
    validated: boolean;
    evidenceRef?: string;
  })[];
}

export interface ProjectionFailure {
  status: 'INSUFFICIENT_EVIDENCE';
  reasons: readonly { code: ProjectionReasonCode; detail: string }[];
}

export type Agent1PackProjection =
  | { status: 'PROJECTABLE'; pack: ContactOpportunityPackV2 }
  | ProjectionFailure;

const CANONICAL_FAMILIES = new Set<CommercialFamily>([
  'RESTAURANTS_BARS_CAFES',
  'BEAUTY_HAIR_BARBER',
  'LOCAL_RETAIL',
  'LOCAL_SERVICES',
]);

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function addReason(reasons: Array<{ code: ProjectionReasonCode; detail: string }>, code: ProjectionReasonCode, detail: string): void {
  if (!reasons.some((reason) => reason.code === code)) reasons.push({ code, detail });
}

/**
 * Deterministically projects only completed Agent 1 evidence. It performs no
 * research, provider calls, inference, or persistence. Unknown evidence fails
 * closed instead of becoming a negative business fact.
 */
export function projectAgent1EvidenceToContactOpportunityPackV2(
  input: Agent1QualifiedEvidence,
  receivedAt = new Date().toISOString(),
  /** PAIN_FIRST may leave taxonomy unresolved; all evidence and ICP gates still apply. */
  options: { allowUnresolvedCommercialFamily?: boolean } = {},
): Agent1PackProjection {
  const reasons: Array<{ code: ProjectionReasonCode; detail: string }> = [];
  if (!nonEmpty(input.prospectId) || !nonEmpty(input.identity.businessName) || input.identity.sourceRefs.length === 0) {
    addReason(reasons, 'IDENTITY_NOT_VALIDATED', 'Business identity and at least one identity evidence reference are required.');
  }
  if (input.research.acceptedSources.length === 0 || input.research.supportedClaims.length === 0) {
    addReason(reasons, 'RESEARCH_EVIDENCE_MISSING', 'Accepted research sources and supported claims are required.');
  }

  const website = input.research.website;
  if (!website || website.status === 'UNKNOWN') {
    addReason(reasons, 'WEBSITE_STATUS_UNVERIFIED', 'Website presence or verified absence must come from website research.');
  }
  const typedPain = acceptedDigitalPainEvidence(input.research.digitalPainEvidence, input.research.acceptedSources, website?.status === 'VERIFIED_PRESENT');
  if (typedPain.status !== 'VERIFIED') {
    addReason(reasons, 'DIGITAL_PAIN_UNPROVEN', 'A validated typed digital pain observation is required.');
  }
  if (website?.status === 'VERIFIED_ABSENT' && (typedPain.observations[0]?.type !== 'WEBSITE_VERIFIED_ABSENT' || input.research.websiteQuality?.isProfessional === true)) {
    addReason(reasons, 'WEBSITE_STATUS_UNVERIFIED', 'Website absence conflicts with typed pain or the professional-site assessment.');
  }

  const nafFamily = resolveCommercialFamilyFromNaf(input.classification.nafCode);
  let commercialFamily: CommercialFamily | undefined;
  if (nafFamily === 'LOCAL_RETAIL') commercialFamily = nafFamily;
  else if (nonEmpty(input.classification.commercialFamily) && CANONICAL_FAMILIES.has(input.classification.commercialFamily as CommercialFamily)) {
    commercialFamily = input.classification.commercialFamily as CommercialFamily;
  }
  if (!commercialFamily && options.allowUnresolvedCommercialFamily !== true) {
    addReason(reasons, 'COMMERCIAL_FAMILY_UNRESOLVED', 'No existing canonical family authority supports this classification.');
  }
  const isAccommodationCode = input.classification.nafCode?.trim().toUpperCase().replace(/\s+/g, '') === '55.20Z';
  if (isAccommodationCode && (!input.research.operatingModel || input.research.operatingModel === 'UNKNOWN')) {
    addReason(reasons, 'OPERATING_MODEL_UNRESOLVED', 'NAF 55.20Z requires a proven operating model; the code alone is insufficient.');
  }
  const outsideCommercialIcp = input.research.outsideCommercialIcp === true || input.research.operatingModel === 'SEASONAL_AIRBNB_RENTAL';
  if (input.contacts.some((contact) => !contact.validated || !nonEmpty(contact.evidenceRef))) {
    addReason(reasons, 'CONTACT_EVIDENCE_UNVALIDATED', 'Only contacts validated by the real contact-discovery evidence may be projected.');
  }
  if (reasons.length > 0) return { status: 'INSUFFICIENT_EVIDENCE', reasons };

  const evidence = input.research.acceptedSources.map((source) => ({
    url: source.url,
    note: source.note,
    supports: source.supports,
    ...(source.observedAt ? { observedAt: source.observedAt } : {}),
  }));
  const verifiedWebsite = website ?? { status: 'UNKNOWN' as const };
  const digitalPainSignals = typedPain.observations.map((observation) => observation.observation);
  const websiteUrl = verifiedWebsite.status === 'VERIFIED_PRESENT' ? verifiedWebsite.url : undefined;
  const pack: ContactOpportunityPackV2 = {
    schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2',
    packId: `agent1-${input.prospectId}`,
    source: { agent: 'AGENT_1', provenance: `qualified-prospect:${input.prospectId}`, receivedAt },
    identity: {
      businessName: input.identity.businessName.trim(),
      ...(input.identity.legalName ? { legalName: input.identity.legalName } : {}),
      ...(input.identity.siren ? { siren: input.identity.siren } : {}),
      ...(input.identity.siret ? { siret: input.identity.siret } : {}),
      ...(input.identity.city ? { city: input.identity.city } : {}),
      ...(input.identity.location ? { location: input.identity.location } : {}),
      ...(websiteUrl ? { websiteUrl } : {}),
    },
    contacts: input.contacts.map(({ validated: _validated, evidenceRef: _evidenceRef, ...contact }) => contact),
    opportunity: {
      digitalFriction: digitalPainSignals.join('; '),
      agent1Verdict: 'QUALIFIED',
      icp: {
        ...(commercialFamily ? { commercialFamily } : {}),
        ...(input.classification.nafCode ? { nafCode: input.classification.nafCode } : {}),
        ...(input.research.websiteQuality ? { websiteQuality: input.research.websiteQuality } : {}),
        ...(input.research.decisionAuthority ? { decisionAuthority: input.research.decisionAuthority } : {}),
        digitalPainSignals,
        requiresUnprovenCapability: input.research.requiresUnprovenCapability === true,
        outsideCommercialIcp,
      },
    },
    evidence,
  };
  return { status: 'PROJECTABLE', pack };
}
