import { claimIssues, decideCommercialPrerequisites, type CommercialContext, type CommercialOutcome } from './commercial-contract';
import { ABSTENTION_DECISIONS, CHANNEL_POLICIES, type CommercialDecision } from './commercial-policy';
import { catalogEntryIsCanonical } from './commercial-catalog';

export const COMMERCIAL_ORACLE_IDS = [
  'CHANNEL_ALLOWED', 'CONTACT_NOT_SUPPRESSED', 'FIRST_CONTACT_ALLOWED',
  'PROPOSAL_BELONGS_TO_PROSPECT', 'CANONICAL_LINK_EXACT', 'NO_PLACEHOLDERS',
  'LENGTH_WITHIN_LIMIT', 'CLAIMS_RESOLVE', 'CATALOG_REFERENCE_ALLOWED',
  'EXPECTED_ABSTENTION', 'NO_TRANSPORT_ACTION', 'REVISION_APPROVAL_NOT_TRANSFERRED',
] as const;
export type CommercialOracleId = typeof COMMERCIAL_ORACLE_IDS[number];
export interface CommercialMessageCandidate {
  channel: CommercialContext['channel'];
  subject: string | null;
  /** EMAIL transport signature is a separate field; MOBILE identity/opposition stay in body. */
  body: string;
  transportSignature: string | null;
  composition: 'EMAIL_ORIGINAL' | 'MOBILE_ORIGINAL' | 'SHORTENED_EMAIL';
  /** Exact approved claim text spans; semantic extraction/paraphrase judgment belongs to CP02. */
  assertions: { claimId: string; text: string }[];
  catalogMentions: { offerId: string; name: string; priceMode: 'FIXED' | 'FROM' | 'QUOTE'; amountCents: number | null; capabilityMentions: string[]; additionalTerms: string[] }[];
  revision: number;
  contentRef: string;
  approval: { revision: number; contentRef: string } | null;
}
export interface CommercialOracleInput {
  context: CommercialContext;
  outcome: CommercialOutcome;
  expectedOutcome: CommercialOutcome;
  candidate: CommercialMessageCandidate | null;
  /** Observed harness events, never a callback or transport client. Empty means no recorded action. */
  transportActions: readonly string[];
}
export interface CommercialOracleResult { id: CommercialOracleId; pass: boolean; detail: string }

/** Collision-free canonical content identity for this offline oracle, not M010 approval provenance. */
export function commercialContentRef(message: Omit<CommercialMessageCandidate, 'contentRef' | 'approval'>): string {
  return JSON.stringify([message.channel, message.subject, message.body, message.transportSignature,
    message.composition, message.assertions.map(a => [a.claimId, a.text]),
    message.catalogMentions.map(m => [m.offerId, m.name, m.priceMode, m.amountCents, m.capabilityMentions, m.additionalTerms]), message.revision]);
}

export function countCommercialWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}
/** Remove exact, declared factual assertion spans before conversational syntax checks. */
export function generatedMessageText(candidate: CommercialMessageCandidate): string {
  let text = candidate.body;
  for (const assertion of candidate.assertions) {
    if (!assertion.text) continue;
    const escaped = assertion.text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    text = text.replace(new RegExp(escaped, 'gu'), ' ');
  }
  return text;
}
export function channelPolicyIssues(candidate: CommercialMessageCandidate): string[] {
  const issues: string[] = [];
  if (countCommercialWords(candidate.body) > CHANNEL_POLICIES[candidate.channel].maxWords || !candidate.body.trim()) issues.push('LENGTH');
  if (candidate.channel === 'EMAIL') {
    if (!candidate.subject?.trim() || candidate.composition !== 'EMAIL_ORIGINAL') issues.push('EMAIL_STRUCTURE');
  } else {
    if (candidate.subject !== null || candidate.transportSignature !== null || candidate.composition !== 'MOBILE_ORIGINAL') issues.push('MOBILE_STRUCTURE');
    if (!/^Bonjour[,\s].*Magic Script[.!]/u.test(candidate.body.split('\n')[0] ?? '')) issues.push('MOBILE_IMMEDIATE_IDENTITY');
    if ((generatedMessageText(candidate).match(/\?/g) ?? []).length !== 1) issues.push('MOBILE_ONE_QUESTION');
    if (/\b(?:Cordialement|Bien à vous|Objet\s*:)/iu.test(candidate.body)) issues.push('MOBILE_EMAIL_SIGNOFF');
  }
  return issues;
}

/** Returns independent facts; deliberately no aggregate quality score, readiness or send action. */
export function evaluateCommercialOracles(input: CommercialOracleInput): CommercialOracleResult[] {
  const { context: c, candidate: m } = input;
  const prerequisite = decideCommercialPrerequisites(c);
  const absentAllowed = m === null && input.outcome.decision !== 'GENERATE';
  const messageCheck = (check: (m: CommercialMessageCandidate) => boolean) => m ? check(m) : absentAllowed;
  const result = (id: CommercialOracleId, pass: boolean, detail: string): CommercialOracleResult => ({ id, pass, detail });
  const sameOutcome = (a: CommercialOutcome, b: CommercialOutcome) => a.decision === b.decision && a.reason === b.reason;
  const validOutcome = (o: CommercialOutcome) => o.decision === 'GENERATE' ? o.reason === null
    : !!o.reason && ABSTENTION_DECISIONS[o.reason] === o.decision;
  return [
    result('CHANNEL_ALLOWED', c.authorizedChannels.some(a => a.channel === c.channel) && (!m || m.channel === c.channel), 'Uses upstream channel authorization; MOBILE does not assert WhatsApp.'),
    result('CONTACT_NOT_SUPPRESSED', c.contactState.suppression === 'CLEAR', 'Unknown suppression fails closed.'),
    result('FIRST_CONTACT_ALLOWED', c.contactState.firstContact === 'NOT_CONTACTED', 'No duplicated first contact.'),
    result('PROPOSAL_BELONGS_TO_PROSPECT', !!c.artifact && c.artifact.status === 'READY' && c.artifact.prospectId === c.prospect.id, 'Artifact identity and readiness must match.'),
    result('CANONICAL_LINK_EXACT', messageCheck(msg => {
      const urls = msg.body.match(/https?:\/\/[^\s<>]+/gu) ?? [];
      return !!c.artifact && urls.length === 1 && urls[0] === c.artifact.canonicalLink;
    }), 'Exactly one canonical URL token; no substitution or additional link.'),
    result('NO_PLACEHOLDERS', messageCheck(msg => !/\{\{|\}\}|\$\{|<[^>]+>|\b(?:UNKNOWN|TODO|TBD)\b|\[(?:nom|name|lien|link|url|company)[^\]]*\]/iu.test(`${msg.subject ?? ''}\n${msg.body}`)), 'No unresolved template fields.'),
    result('LENGTH_WITHIN_LIMIT', messageCheck(msg => countCommercialWords(msg.body) > 0 && countCommercialWords(msg.body) <= CHANNEL_POLICIES[msg.channel].maxWords), 'Whitespace-delimited body words, URL counts as one; EMAIL signature separate.'),
    result('CLAIMS_RESOLVE', messageCheck(msg => {
      if (!msg.assertions.length || new Set(msg.assertions.map(a => a.claimId)).size !== msg.assertions.length) return false;
      return c.requiredClaimIds.every(id => msg.assertions.some(a => a.claimId === id)) && msg.assertions.every(a => {
        const claim = c.claims.find(claim => claim.id === a.claimId);
        return !!claim && !claimIssues(claim, c).length && a.text === claim.text && msg.body.includes(a.text);
      });
    }), 'Exact declared assertions resolve; undeclared free-text assertions require CP02 semantic analysis.'),
    result('CATALOG_REFERENCE_ALLOWED', messageCheck(msg => msg.catalogMentions.every(mention => {
      const entry = c.catalog.find(e => e.offerId === mention.offerId);
      return !!entry && catalogEntryIsCanonical(entry) && !!c.priceAuthorization?.offerIds.includes(mention.offerId)
        && mention.name === entry.name && mention.priceMode === entry.priceMode && mention.amountCents === entry.amountCents
        && !mention.additionalTerms.length && mention.capabilityMentions.every(cap => entry.authorizedCapabilities.includes(cap));
    })), 'Structured mentions only; no inferred terms. Free-text extraction is CP02.'),
    result('EXPECTED_ABSTENTION', validOutcome(input.outcome) && validOutcome(input.expectedOutcome) && sameOutcome(input.outcome, input.expectedOutcome)
      && (prerequisite.decision === 'GENERATE' ? true : sameOutcome(input.outcome, prerequisite))
      && (input.outcome.decision === 'GENERATE' ? m !== null : m === null), 'Expected decision/reason, prerequisite precedence, and absence of draft on abstention.'),
    result('NO_TRANSPORT_ACTION', input.transportActions.length === 0, 'Harness trace contains no transport action; module has no transport dependency.'),
    result('REVISION_APPROVAL_NOT_TRANSFERRED', messageCheck(msg => Number.isInteger(msg.revision) && msg.revision > 0 && msg.contentRef === commercialContentRef(msg)
      && (msg.approval === null || (msg.approval.revision === msg.revision && msg.approval.contentRef === msg.contentRef))), 'An old approval cannot describe changed content/revision; does not grant approval.'),
  ];
}

/** Valid vocabulary for external fixture consumers, without implementing a scorer. */
export const COMMERCIAL_DECISIONS: readonly CommercialDecision[] = ['GENERATE', 'DO_NOT_CONTACT', 'INSUFFICIENT_GROUNDING', 'NO_SUPPORTED_VALUE', 'QUALITY_ABSTENTION'];
