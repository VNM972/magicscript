import type { OutreachChannel } from './contracts';
import { ABSTENTION_DECISIONS, COMMERCIAL_PLAYBOOK_VERSION, type AbstentionReason, type CommercialDecision } from './commercial-policy';
import { catalogEntryIsCanonical, type CommercialCatalogEntry } from './commercial-catalog';

export type ClaimStatus = 'SUPPORTED' | 'QUALIFIED' | 'UNSUPPORTED' | 'CONFLICTED';
export interface EvidenceSource {
  id: string;
  prospectId: string;
  version: string;
  kind: 'OBSERVATION' | 'OPPORTUNITY' | 'OPERATOR_CONFIRMATION' | 'ARTIFACT';
  fact: string;
  observedAt: string | null;
  verifiedAt: string | null;
  trust: 'DATA_ONLY';
}
interface ClaimBase {
  id: string;
  text: string;
  sourceRefs: string[];
  evidenceExcerptOrFact: string;
  observedAt: string | null;
  verifiedAt: string | null;
  scope: { prospectId: string; subject: string };
  limits: string[];
  status: ClaimStatus;
  qualification: string | null;
  freshness: { policyId: string; validUntil: string } | null;
  timeSensitive: boolean;
  capability: { id: string; use: 'DEMONSTRATIVE' | 'LIVE' } | null;
}
export type CommercialClaim = ClaimBase & (
  | { supportType: 'OBSERVED'; rule: null; confirmation: null }
  | { supportType: 'DERIVED_WITH_RULE'; rule: { id: string; version: string; premiseClaimIds: string[] }; confirmation: null }
  | { supportType: 'OPERATOR_CONFIRMED'; rule: null; confirmation: { actor: string; confirmedAt: string; sourceRef: string } }
);
export interface PreparedCommercialArtifact {
  id: string;
  version: string;
  prospectId: string;
  type: 'PROPOSAL' | 'PROTOTYPE';
  status: 'READY' | 'NOT_READY';
  canonicalLink: string;
  capabilities: { id: string; status: 'DEMONSTRATIVE' | 'LIVE'; sourceRef: string }[];
}
export interface CommercialContext {
  playbookVersion: typeof COMMERCIAL_PLAYBOOK_VERSION;
  prospect: { id: string; name: string; contactName: string | null; vertical: string };
  agent1: {
    sourceRef: string; version: string; decision: 'ADMITTED' | 'NOT_ADMITTED' | 'UNKNOWN';
    opportunity: { text: string; supportingClaimIds: string[] } | null;
  };
  commercialState?: 'STANDARD' | 'SITE_UNDER_CONSTRUCTION';
  channel: OutreachChannel;
  authorizedChannels: { channel: OutreachChannel; contactRef: string; sourceRef: string; verifiedAt: string }[];
  whatsAppAvailability: 'CONFIRMED' | 'UNKNOWN' | 'UNAVAILABLE';
  contactState: { suppression: 'CLEAR' | 'SUPPRESSED' | 'OPPOSED' | 'UNKNOWN'; firstContact: 'NOT_CONTACTED' | 'CONTACTED' | 'DUPLICATE' | 'UNKNOWN'; sourceRef: string; verifiedAt: string };
  artifact: PreparedCommercialArtifact | null;
  sources: EvidenceSource[];
  claims: CommercialClaim[];
  requiredClaimIds: string[];
  derivationRules: { id: string; version: string; description: string }[];
  catalog: CommercialCatalogEntry[];
  priceAuthorization: { actor: string; at: string; offerIds: string[] } | null;
  scopeConfirmed: boolean;
  evaluatedAt: string;
}
export type CommercialOutcome =
  | { decision: 'GENERATE'; reason: null }
  | { decision: Exclude<CommercialDecision, 'GENERATE'>; reason: AbstentionReason };

export function abstain(reason: AbstentionReason): CommercialOutcome {
  return { decision: ABSTENTION_DECISIONS[reason], reason };
}
export function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
}
export function validCanonicalLink(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password && !u.hash; } catch { return false; }
}

/** Structural/provenance checks only. Does not prove semantic entailment of free text. */
export function claimIssues(claim: CommercialClaim, context: CommercialContext, visiting = new Set<string>()): string[] {
  const errors: string[] = [];
  const add = (condition: boolean, code: string) => { if (condition) errors.push(code); };
  if (visiting.has(claim.id)) return ['CYCLIC_DERIVATION'];
  const next = new Set(visiting).add(claim.id);
  add(!claim.id.trim() || !claim.text.trim() || !claim.evidenceExcerptOrFact.trim() || !claim.scope.subject.trim(), 'EMPTY_CLAIM');
  add(claim.scope.prospectId !== context.prospect.id, 'CLAIM_WRONG_PROSPECT');
  add(claim.status === 'UNSUPPORTED' || claim.status === 'CONFLICTED', `CLAIM_${claim.status}`);
  add(!['SUPPORTED', 'QUALIFIED', 'UNSUPPORTED', 'CONFLICTED'].includes(claim.status), 'INVALID_CLAIM_STATUS');
  add(claim.status === 'QUALIFIED' && (!claim.qualification?.trim() || !claim.text.includes(claim.qualification)), 'QUALIFICATION_MISSING');
  const sources = claim.sourceRefs.map(ref => context.sources.find(s => s.id === ref));
  add(!sources.length || sources.some(s => !s || s.prospectId !== context.prospect.id || !s.fact.trim() || !s.version.trim() || s.trust !== 'DATA_ONLY'), 'ORPHAN_CLAIM');
  add(!sources.some(s => s?.fact.includes(claim.evidenceExcerptOrFact)), 'EVIDENCE_EXCERPT_MISMATCH');
  for (const date of [claim.observedAt, claim.verifiedAt]) add(date !== null && (!validTimestamp(date) || Date.parse(date) > Date.parse(context.evaluatedAt)), 'INVALID_CLAIM_DATE');
  if (claim.timeSensitive) {
    add(!claim.freshness || !claim.freshness.policyId.trim() || !validTimestamp(claim.freshness.validUntil)
      || Date.parse(claim.freshness.validUntil) < Date.parse(context.evaluatedAt)
      || !(claim.verifiedAt || claim.observedAt), 'FRESHNESS_REQUIRED');
  }
  if (claim.supportType === 'OBSERVED') {
    add(claim.rule !== null || claim.confirmation !== null || !sources.some(s => s && (s.kind === 'OBSERVATION' || s.kind === 'ARTIFACT') && s.fact.includes(claim.evidenceExcerptOrFact)), 'OPPORTUNITY_NOT_OBSERVATION');
  } else if (claim.supportType === 'DERIVED_WITH_RULE') {
    const rule = claim.rule;
    add(claim.confirmation !== null || !rule || !context.derivationRules.some(r => r.id === rule.id && r.version === rule.version && !!r.description.trim()) || !rule.premiseClaimIds.length, 'NAMED_RULE_REQUIRED');
    for (const id of rule?.premiseClaimIds ?? []) {
      const premise = context.claims.find(c => c.id === id);
      add(!premise || claimIssues(premise, context, next).length > 0, 'UNSUPPORTED_PREMISE');
    }
  } else if (claim.supportType === 'OPERATOR_CONFIRMED') {
    const c = claim.confirmation;
    add(claim.rule !== null || !c || !c.actor.trim() || !validTimestamp(c.confirmedAt) || Date.parse(c.confirmedAt) > Date.parse(context.evaluatedAt)
      || !claim.sourceRefs.includes(c.sourceRef) || !sources.some(s => s?.id === c.sourceRef && s.kind === 'OPERATOR_CONFIRMATION' && s.fact.includes(claim.evidenceExcerptOrFact)), 'ATTRIBUTED_DATED_CONFIRMATION_REQUIRED');
  } else errors.push('INVALID_SUPPORT_TYPE');
  if (claim.capability) {
    const cap = context.artifact?.capabilities.find(c => c.id === claim.capability!.id);
    add(!cap || !claim.sourceRefs.includes(cap.sourceRef) || (claim.capability.use === 'LIVE' && cap.status !== 'LIVE'), 'DEMO_IS_NOT_LIVE');
  }
  return errors;
}

/** Validates the typed envelope. Rejected claims may remain as evidence, never as usable claims. */
export function contextIssues(context: CommercialContext): string[] {
  const errors: string[] = [];
  if (context.playbookVersion !== COMMERCIAL_PLAYBOOK_VERSION) errors.push('PLAYBOOK_VERSION');
  if (!context.prospect.id.trim() || !context.prospect.name.trim() || !context.prospect.vertical.trim()) errors.push('PROSPECT_REQUIRED');
  if (!context.agent1.sourceRef.trim() || !context.agent1.version.trim()) errors.push('AGENT1_AUTHORITY_REQUIRED');
  if (!validTimestamp(context.evaluatedAt)) errors.push('EVALUATION_DATE_REQUIRED');
  if (!['EMAIL', 'MOBILE'].includes(context.channel)) errors.push('INVALID_CHANNEL');
  if (new Set(context.sources.map(s => s.id)).size !== context.sources.length || new Set(context.claims.map(c => c.id)).size !== context.claims.length) errors.push('DUPLICATE_REFERENCE');
  for (const s of context.sources) {
    if (!s.id.trim() || !s.version.trim() || !s.fact.trim() || s.trust !== 'DATA_ONLY' || s.prospectId !== context.prospect.id) errors.push('INVALID_SOURCE');
    if ([s.observedAt, s.verifiedAt].some(d => d !== null && (!validTimestamp(d) || Date.parse(d) > Date.parse(context.evaluatedAt)))) errors.push('INVALID_SOURCE_DATE');
  }
  if (!context.contactState.sourceRef.trim() || !validTimestamp(context.contactState.verifiedAt)) errors.push('CONTACT_STATE_PROVENANCE');
  for (const c of context.authorizedChannels) if (!['EMAIL', 'MOBILE'].includes(c.channel) || !c.contactRef.trim() || !c.sourceRef.trim() || !validTimestamp(c.verifiedAt)) errors.push('CHANNEL_PROVENANCE');
  if (context.artifact && (!context.artifact.id.trim() || !context.artifact.version.trim() || !validCanonicalLink(context.artifact.canonicalLink) || !['PROPOSAL', 'PROTOTYPE'].includes(context.artifact.type))) errors.push('ARTIFACT_REFERENCE');
  if (context.catalog.some(e => !catalogEntryIsCanonical(e))) errors.push('CATALOG_AUTHORITY');
  if (context.priceAuthorization && (!context.priceAuthorization.actor.trim() || !validTimestamp(context.priceAuthorization.at) || context.priceAuthorization.offerIds.some(id => !context.catalog.some(e => e.offerId === id)))) errors.push('PRICE_AUTHORIZATION');
  return errors;
}

/** Prerequisite decision only; GENERATE means eligible input, never message quality PASS. */
export function decideCommercialPrerequisites(context: CommercialContext): CommercialOutcome {
  if (context.contactState.suppression !== 'CLEAR') return abstain('SUPPRESSED_OR_OPPOSED');
  if (!context.authorizedChannels.some(c => c.channel === context.channel)) return abstain('INVALID_CHANNEL');
  if (context.contactState.firstContact !== 'NOT_CONTACTED') return abstain('ALREADY_CONTACTED_OR_DUPLICATE');
  if (contextIssues(context).length || context.agent1.decision !== 'ADMITTED') return abstain('INSUFFICIENT_GROUNDING');
  if (!context.artifact || context.artifact.status !== 'READY') return abstain('INSUFFICIENT_GROUNDING');
  if (context.artifact.prospectId !== context.prospect.id) return abstain('CONFLICTED_CONTEXT');
  if (!context.scopeConfirmed) return abstain('OUT_OF_CONFIRMED_SCOPE');
  for (const id of context.requiredClaimIds) {
    const claim = context.claims.find(c => c.id === id);
    if (claim?.status === 'CONFLICTED') return abstain('CONFLICTED_CONTEXT');
    if (!claim || claimIssues(claim, context).length) return abstain('UNSUPPORTED_REQUIRED_CLAIM');
  }
  const usable = context.claims.filter(c => claimIssues(c, context).length === 0);
  if (!usable.some(c => c.status === 'SUPPORTED' || (c.status === 'QUALIFIED' && c.supportType === 'DERIVED_WITH_RULE'))) return abstain('INSUFFICIENT_GROUNDING');
  if (context.commercialState === 'SITE_UNDER_CONSTRUCTION') {
    const hasUnderConstructionEvidence = usable.some(c => /under construction|coming soon|awaiting (?:publication|build)|en construction|bient[oô]t en ligne|en attente de publication/iu.test(`${c.text} ${c.evidenceExcerptOrFact}`));
    if (!hasUnderConstructionEvidence) return abstain('NO_SUPPORTED_VALUE');
  } else if (!context.agent1.opportunity || !context.agent1.opportunity.text.trim() || !context.agent1.opportunity.supportingClaimIds.length
    || context.agent1.opportunity.supportingClaimIds.some(id => !usable.some(c => c.id === id))) return abstain('NO_SUPPORTED_VALUE');
  return { decision: 'GENERATE', reason: null };
}
