import {
  projectAgent1EvidenceToContactOpportunityPackV2,
  type Agent1PackProjection,
  type Agent1QualifiedEvidence,
} from './agent1-evidence-projection';
import { normalizeDomain } from './contact-opportunity-pack';
import { normalizeCandidateUrl } from '../contact-acquisition/agent';
import { acceptedDigitalPainEvidence } from '../research/digital-pain-evidence';
import {
  candidateFromPainFirstAcceptance,
  type AcceptedPainFirstSearchCandidate,
} from '../research/pain-first-staging';

export interface PainFirstAgent1Evidence {
  candidateId: string;
  candidate: AcceptedPainFirstSearchCandidate;
  /** Completed evidence supplied by existing authorities; staging facts alone are insufficient. */
  evidence: Omit<Agent1QualifiedEvidence, 'prospectId' | 'qualified' | 'qualificationState'>;
}

type PainFirstProjectionFailure = {
  status: 'INSUFFICIENT_EVIDENCE';
  reasons: readonly {
    code: 'PAIN_FIRST_SOURCE_MISMATCH' | 'COMMERCIAL_FAMILY_UNRESOLVED' | 'DECISION_AUTHORITY_UNRESOLVED' | 'DIGITAL_PAIN_UNPROVEN';
    detail: string;
  }[];
};

/**
 * Offline bridge to the canonical Agent1 projector, without registry reconciliation
 * or prospect creation. The resulting pack must still pass POST /api/v2/admission.
 * No ICP verdict, contact validation, or legal identity is inferred here.
 */
export function projectPainFirstEvidenceToContactOpportunityPackV2(
  input: PainFirstAgent1Evidence,
  receivedAt = new Date().toISOString(),
): Agent1PackProjection | PainFirstProjectionFailure {
  const candidate = candidateFromPainFirstAcceptance(input.candidate);
  const evidence = input.evidence;
  if (!candidate || evidence.research.website?.status !== 'VERIFIED_PRESENT' ||
      normalizeCandidateUrl(evidence.research.website.url ?? '') !== input.candidate.homepageUrl) {
    return { status: 'INSUFFICIENT_EVIDENCE', reasons: [{ code: 'PAIN_FIRST_SOURCE_MISMATCH',
      detail: 'Accepted staged URL and verified Agent1 website must identify the same homepage.' }] };
  }
  if ((evidence.classification.commercialFamily || evidence.classification.nafCode) &&
      !evidence.classification.sourceRefs.some((ref) => ref.trim())) {
    return { status: 'INSUFFICIENT_EVIDENCE', reasons: [{ code: 'COMMERCIAL_FAMILY_UNRESOLVED',
      detail: 'Supplied commercial-family evidence references are required.' }] };
  }
  const authority = evidence.research.decisionAuthority;
  // Absence remains unknown; supplied authority must still be complete and valid.
  if (authority !== undefined && (!authority || typeof authority !== 'object' || Array.isArray(authority) ||
      typeof authority.isCentrallyManaged !== 'boolean' || typeof authority.hasLocalAuthority !== 'boolean')) {
    return { status: 'INSUFFICIENT_EVIDENCE', reasons: [{ code: 'DECISION_AUTHORITY_UNRESOLVED',
      detail: 'Supplied decision-authority evidence must contain both boolean fields.' }] };
  }
  const pain = acceptedDigitalPainEvidence(evidence.research.digitalPainEvidence, evidence.research.acceptedSources, true);
  if (pain.status !== 'VERIFIED' || !pain.observations.every((observation) =>
    normalizeCandidateUrl(observation.sourceUrl) === input.candidate.homepageUrl &&
    (observation.type === 'UNDER_CONSTRUCTION' || observation.type === 'REBUILDING'))) {
    return { status: 'INSUFFICIENT_EVIDENCE', reasons: [{ code: 'DIGITAL_PAIN_UNPROVEN',
      detail: 'Accepted canonical notice evidence on the staged homepage is required.' }] };
  }
  const projection = projectAgent1EvidenceToContactOpportunityPackV2({
    ...evidence, prospectId: input.candidateId, qualified: false, qualificationState: 'OTHER',
  }, receivedAt, { allowUnresolvedCommercialFamily: true });
  if (projection.status !== 'PROJECTABLE') return projection;

  // Diagnostic provenance uses existing fields, never new authority or a D1 schema.
  const provenance = JSON.stringify({ sourcingLane: 'PAIN_FIRST', candidateId: input.candidateId,
    stagedWebsiteUrl: input.candidate.homepageUrl, domain: normalizeDomain(input.candidate.homepageUrl),
    acquiredAt: candidate.acquiredAt, digitalPainEvidence: pain.observations.map((observation) => ({
      observedCondition: observation.type === 'REBUILDING' ? 'SITE_REBUILDING' : 'SITE_UNDER_CONSTRUCTION',
      sourceUrl: observation.sourceUrl, snapshotDigest: observation.snapshotDigest,
      locator: observation.locator, observedAt: observation.observedAt,
    })) });
  return { ...projection, pack: { ...projection.pack,
    source: { ...projection.pack.source, provenance },
    evidence: projection.pack.evidence?.map((source) =>
      normalizeCandidateUrl(source.url) === input.candidate.homepageUrl
        ? { ...source, note: `${source.note}\n${provenance}` } : source),
  } };
}
