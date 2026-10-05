import { claimIssues, decideCommercialPrerequisites, type CommercialContext, type CommercialOutcome } from './commercial-contract';
import { ANTI_GENERIC_POLICY, ABSTENTION_DECISIONS } from './commercial-policy';
import { channelPolicyIssues, commercialContentRef, evaluateCommercialOracles, generatedMessageText, type CommercialMessageCandidate, type CommercialOracleResult } from './commercial-oracles';

export const QUALITY_GATE_VERSION = 'AGENT3_COMMERCIAL_QUALITY_GATE_V1' as const;
export const QUALITY_THRESHOLD = 80;
export const MAX_REGENERATION_ATTEMPTS = 1;

export type QualityGateDecision = 'READY_FOR_OPERATOR' | 'REGENERATE' | 'ABSTAIN' | 'BLOCKED';
export type QualityDimension = 'SPECIFICITY' | 'COMMERCIAL_RELEVANCE' | 'HUMANNESS' | 'CHANNEL_FIT' | 'CTA_QUALITY' | 'CONCISION' | 'ANTI_GENERIC';
export const QUALITY_DIMENSION_WEIGHTS: Readonly<Record<QualityDimension, number>> = {
  SPECIFICITY: 20, COMMERCIAL_RELEVANCE: 20, HUMANNESS: 15, CHANNEL_FIT: 15, CTA_QUALITY: 10, CONCISION: 10, ANTI_GENERIC: 10,
};

export interface BoundedSemanticAssessment {
  specificity?: 0 | 1 | 2 | 3 | 4;
  commercialRelevance?: 0 | 1 | 2 | 3 | 4;
  humanness?: 0 | 1 | 2 | 3 | 4;
  channelFit?: 0 | 1 | 2 | 3 | 4;
  ctaQuality?: 0 | 1 | 2 | 3 | 4;
  antiGenericQuality?: 0 | 1 | 2 | 3 | 4;
  /** Concision remains bounded and deterministic when omitted. */
  concision?: 0 | 1 | 2 | 3 | 4;
  assessor?: string;
}

export interface QualityGateInput {
  context: CommercialContext;
  candidate: CommercialMessageCandidate | null;
  expectedOutcome: CommercialOutcome;
  transportActions?: readonly string[];
  semanticAssessment?: BoundedSemanticAssessment;
  regenerationAttempt?: number;
}

export interface QualityDimensionResult { score: 0 | 1 | 2 | 3 | 4; weight: number; weighted: number; explanation: string; }
export interface ObjectiveCheckResult { id: string; pass: boolean; detail: string; }
export interface CommercialQualityGateResult {
  qualityGateVersion: typeof QUALITY_GATE_VERSION;
  contentIdentity: { revision: number | null; fingerprint: string | null };
  decision: QualityGateDecision;
  blockers: string[];
  warnings: string[];
  objectiveCheckResults: ObjectiveCheckResult[];
  qualityDimensions: Record<QualityDimension, QualityDimensionResult>;
  totalScore: number;
  regenerationAllowed: boolean;
  abstentionReason: string | null;
  evidence: string[];
}

const dimensionKeys: Record<QualityDimension, keyof BoundedSemanticAssessment | null> = {
  SPECIFICITY: 'specificity', COMMERCIAL_RELEVANCE: 'commercialRelevance', HUMANNESS: 'humanness', CHANNEL_FIT: 'channelFit', CTA_QUALITY: 'ctaQuality', CONCISION: 'concision', ANTI_GENERIC: 'antiGenericQuality',
};
const blockerPatterns: readonly [string, RegExp][] = [
  ['FAKE_PRIOR_RELATIONSHIP', /\b(?:comme convenu|comme prévu|comme d'habitude|as agreed|as discussed|great to see you again)\b/iu],
  ['INVENTED_URGENCY', /\b(?:derni[eè]re chance|aujourd'hui seulement|last chance|act now|urgent|d[eé]cidez aujourd'hui)\b/iu],
  ['INVENTED_COMMERCIAL_LOSS', /\b(?:vous perdez|vous avez perdu|perdez des clients|losing customers|lost revenue)\b/iu],
  ['FABRICATED_RESULT', /\b(?:doublez|doubler|garanti|garantit|double your|guaranteed)\b/iu],
  ['UNSUPPORTED_FAMILIARITY', /\b(?:j'adore venir|je connais bien|i love visiting|i know your business well)\b/iu],
  ['INVENTED_FEATURE', /\b(?:r[eé]servation connect[eé]e|paiement en ligne inclus|live booking included|automated booking)\b/iu],
];
const rewritePatterns: readonly [string, RegExp][] = [
  ['DIGITAL_WORLD_CLICHE', /\b(?:dans le monde digital|dans le monde num[eé]rique|in today's digital world)\b/iu],
  ['VAGUE_ONLINE_PRESENCE', /\b(?:passez au niveau sup[eé]rieur|am[eé]liorer votre pr[eé]sence en ligne|take your online presence)\b/iu],
  ['GENERIC_COMPLIMENT', /\b(?:votre superbe entreprise|superbe [ée]quipe|amazing business|exceptional company)\b/iu],
  ['EXCESSIVE_ADJECTIVES', /\b(?:innovant|exceptionnel|incontournable|revolutionary|world-class)\b(?:[^.!?]*\b(?:innovant|exceptionnel|incontournable|revolutionary|world-class)\b){2,}/iu],
  ['CATALOG_COPY', /\b(?:nos offres|toutes nos prestations|all our services|our complete range)\b/iu],
];

function scoreValue(value: number | undefined): 0 | 1 | 2 | 3 | 4 { return value === 1 || value === 2 || value === 3 || value === 4 ? value : 0; }
function textOf(candidate: CommercialMessageCandidate): string { return `${candidate.subject ?? ''}\n${candidate.body}`; }
function hasOpposition(candidate: CommercialMessageCandidate): boolean { return /\b(?:ne plus recevoir|stop|opposition|d[eé]sinscrire|no longer wish|unsubscribe)\b/iu.test(candidate.body); }
function hasCompetingCtas(candidate: CommercialMessageCandidate): boolean {
  const signals = generatedMessageText(candidate).match(/\b(?:r[eé]pondez|appelez|appelez-moi|r[eé]servez|d[eé]couvrez|reply|call|book|discover)\b/giu) ?? [];
  return signals.length > 1;
}
function qualityDimensions(assessment: BoundedSemanticAssessment | undefined, candidate: CommercialMessageCandidate | null): Record<QualityDimension, QualityDimensionResult> {
  const out = {} as Record<QualityDimension, QualityDimensionResult>;
  for (const dimension of Object.keys(QUALITY_DIMENSION_WEIGHTS) as QualityDimension[]) {
    const score = scoreValue(assessment?.[dimensionKeys[dimension] as keyof BoundedSemanticAssessment] as number | undefined);
    out[dimension] = { score, weight: QUALITY_DIMENSION_WEIGHTS[dimension], weighted: score * QUALITY_DIMENSION_WEIGHTS[dimension] / 4, explanation: candidate ? (assessment ? 'Bounded assessment supplied by caller.' : 'No semantic assessment supplied; fail-closed at zero.') : 'No candidate.' };
  }
  return out;
}

export function evaluateCommercialQualityGate(input: QualityGateInput): CommercialQualityGateResult {
  const attempt = input.regenerationAttempt ?? 0;
  const prerequisite = decideCommercialPrerequisites(input.context);
  const identity = input.candidate ? { revision: input.candidate.revision, fingerprint: commercialContentRef(input.candidate) } : { revision: null, fingerprint: null };
  const oracleInput = { context: input.context, outcome: prerequisite, expectedOutcome: input.expectedOutcome, candidate: input.candidate, transportActions: input.transportActions ?? [] };
  const oracleResults = evaluateCommercialOracles(oracleInput);
  const objectiveCheckResults = oracleResults.map((result: CommercialOracleResult) => ({ id: result.id, pass: result.pass, detail: result.detail }));
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (prerequisite.decision !== 'GENERATE') {
    return { qualityGateVersion: QUALITY_GATE_VERSION, contentIdentity: identity, decision: 'ABSTAIN', blockers: [], warnings: [], objectiveCheckResults, qualityDimensions: qualityDimensions(input.semanticAssessment, input.candidate), totalScore: 0, regenerationAllowed: false, abstentionReason: prerequisite.reason, evidence: [`Prerequisite authority requires ${ABSTENTION_DECISIONS[prerequisite.reason]}.`] };
  }
  if (!input.candidate) blockers.push('CANDIDATE_REQUIRED');
  for (const result of oracleResults) if (!result.pass && result.id !== 'EXPECTED_ABSTENTION') blockers.push(result.id);
  if (input.candidate) {
    blockers.push(...channelPolicyIssues(input.candidate));
    const text = textOf(input.candidate);
    for (const [code, pattern] of blockerPatterns) if (pattern.test(text)) blockers.push(code);
    if (input.context.channel === 'EMAIL' && !hasOpposition(input.candidate)) blockers.push('MISSING_OPPOSITION_WORDING');
    if (input.context.channel === 'MOBILE' && !hasOpposition(input.candidate)) blockers.push('MISSING_OPPOSITION_WORDING');
    if (hasCompetingCtas(input.candidate)) blockers.push('COMPETING_CTAS');
    for (const [code, pattern] of rewritePatterns) if (pattern.test(text)) warnings.push(code);
    if (/(?:\b(?:prix|EUR|remise|discount|discounted|offre annuelle|annual care|HT|TTC)\b|€)/iu.test(text)) {
      const authorizedCatalogText = input.candidate.catalogMentions.length > 0 && !input.candidate.catalogMentions.some(mention => mention.additionalTerms.length);
      if (!authorizedCatalogText) blockers.push('UNAUTHORIZED_COMMERCIAL_TERM');
    }
    if (input.context.claims.some(claim => claimIssues(claim, input.context).some(issue => issue.includes('UNSUPPORTED') || issue.includes('CONFLICTED')))) blockers.push('PERSONALIZED_CLAIM_NOT_USABLE');
    if (input.candidate.channel === 'MOBILE' && input.context.whatsAppAvailability !== 'CONFIRMED' && /whatsapp/iu.test(text)) blockers.push('WHATSAPP_NOT_CONFIRMED');
  }
  const dimensions = qualityDimensions(input.semanticAssessment, input.candidate);
  const totalScore = Math.round((Object.values(dimensions) as QualityDimensionResult[]).reduce((sum, item) => sum + item.weighted, 0));
  const assessment = input.semanticAssessment;
  if (assessment && input.candidate) {
    if (Object.values(dimensions).some(item => item.score < 2)) warnings.push('DIMENSION_BELOW_MINIMUM');
    if (dimensions.SPECIFICITY.score < 3) warnings.push('SPECIFICITY_BELOW_MINIMUM');
    if (dimensions.COMMERCIAL_RELEVANCE.score < 3) warnings.push('COMMERCIAL_RELEVANCE_BELOW_MINIMUM');
    if (dimensions.CHANNEL_FIT.score < 3) warnings.push('CHANNEL_FIT_BELOW_MINIMUM');
  }
  const thresholdPass = totalScore >= QUALITY_THRESHOLD && dimensions.SPECIFICITY.score >= 3 && dimensions.COMMERCIAL_RELEVANCE.score >= 3 && dimensions.CHANNEL_FIT.score >= 3 && Object.values(dimensions).every(item => item.score >= 2);
  const rewriteOnly = blockers.length === 0 && warnings.some(w => ['COMPETING_CTAS', ...rewritePatterns.map(([code]) => code), 'DIMENSION_BELOW_MINIMUM', 'SPECIFICITY_BELOW_MINIMUM', 'COMMERCIAL_RELEVANCE_BELOW_MINIMUM', 'CHANNEL_FIT_BELOW_MINIMUM'].includes(w));
  const regenerationAllowed = rewriteOnly && attempt < MAX_REGENERATION_ATTEMPTS;
  const decision: QualityGateDecision = blockers.length ? 'BLOCKED' : regenerationAllowed ? 'REGENERATE' : thresholdPass ? 'READY_FOR_OPERATOR' : 'REGENERATE';
  return { qualityGateVersion: QUALITY_GATE_VERSION, contentIdentity: identity, decision, blockers: [...new Set(blockers)], warnings: [...new Set(warnings)], objectiveCheckResults, qualityDimensions: dimensions, totalScore, regenerationAllowed, abstentionReason: null, evidence: [decision === 'READY_FOR_OPERATOR' ? 'Exact candidate passed deterministic blockers and canonical quality threshold.' : `Decision ${decision} follows blocker, bounded regeneration, and threshold precedence.`] };
}

export const COMMERCIAL_QUALITY_POLICY = { version: QUALITY_GATE_VERSION, threshold: QUALITY_THRESHOLD, maximumRegenerationAttempts: MAX_REGENERATION_ATTEMPTS, antiGenericPolicy: ANTI_GENERIC_POLICY, transportIndependent: true, prospectScoring: false } as const;
