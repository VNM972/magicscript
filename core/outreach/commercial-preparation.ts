import { claimIssues, decideCommercialPrerequisites, type CommercialContext } from './commercial-contract';
import { commercialContentRef, type CommercialMessageCandidate } from './commercial-oracles';
import { evaluateCommercialQualityGate, MAX_REGENERATION_ATTEMPTS, type BoundedSemanticAssessment, type CommercialQualityGateResult } from './commercial-quality-gate';
import { COMMERCIAL_PLAYBOOK_VERSION } from './commercial-policy';
import { SITE_UNDER_CONSTRUCTION_STATE, resolveVerticalProfile, type CommercialState } from './commercial-profiles';

export const CP03_PREPARATION_VERSION = 'AGENT3_COMMERCIAL_PREPARATION_V1' as const;
export type PreparationDecision = 'READY_FOR_OPERATOR' | 'ABSTAIN' | 'BLOCKED';
export interface DemoBookingPolicy { exposesCanonicalBookingCta: boolean; fallbackAppointmentUrl?: string | null; fallbackExplicitlyPermitted?: boolean; }
export interface PreparationContext extends CommercialContext {
  commercialState?: CommercialState;
  demoBooking?: DemoBookingPolicy;
  exemplarIds?: readonly string[];
}
export interface GeneratorRequest { context: PreparationContext; correctionReasons: readonly string[]; attempt: number; }
export interface GeneratorResult { candidate: CommercialMessageCandidate; semanticAssessment: BoundedSemanticAssessment; path: string; }
export interface CommercialGeneratorAdapter { readonly id: string; generate(request: GeneratorRequest): GeneratorResult; }
export interface PreparationTrace { preparationVersion: typeof CP03_PREPARATION_VERSION; generatorPath: string | null; playbookVersion: string; verticalProfile: string; verticalProfileVersion: string; commercialState: CommercialState; exemplarIds: readonly string[]; contextVersion: string; claimsUsed: string[]; attempts: number; qualityGateVersion: string | null; finalFingerprint: string | null; }
export interface CommercialPreparationResult { decision: PreparationDecision; candidate: CommercialMessageCandidate | null; subject: string | null; body: string | null; channel: CommercialContext['channel']; claimsUsed: string[]; qualityGate: CommercialQualityGateResult | null; correctionHistory: { attempt: number; reasons: string[] }[]; trace: PreparationTrace; }

const OPPOSITION = 'Si vous préférez ne plus recevoir de message, dites-le-moi simplement.';
const clean = (value: string) => value.replace(/\s+/gu, ' ').trim();
function usableClaims(context: PreparationContext) { return context.claims.filter(claim => !claimIssues(claim, context).length && (claim.status === 'SUPPORTED' || claim.status === 'QUALIFIED')); }
function underConstructionClaim(context: PreparationContext) { return usableClaims(context).find(claim => /under construction|coming soon|awaiting (?:publication|build)|en construction|bient[oô]t en ligne|en attente de publication/iu.test(`${claim.text} ${claim.evidenceExcerptOrFact}`)); }
function selectedClaims(context: PreparationContext): string[] { const athena = context.commercialState === SITE_UNDER_CONSTRUCTION_STATE; const claims = usableClaims(context); if (athena) { const special = underConstructionClaim(context); return special ? [special.id] : []; } const ids = context.agent1.opportunity?.supportingClaimIds ?? []; return ids.filter(id => claims.some(claim => claim.id === id)); }
function assertFormatting(candidate: CommercialMessageCandidate): void { if (/[\*_]{2}|^\s*[-*]\s+/mu.test(candidate.body)) throw new Error('CP03_PROSPECT_FORMATTING'); }
function buildCandidate(request: GeneratorRequest, mode: 'EMAIL' | 'MOBILE'): GeneratorResult {
  const c = request.context; const claims = usableClaims(c); const claimIds = selectedClaims(c); const claim = claims.find(item => claimIds.includes(item.id)) ?? claims[0];
  if (!claim) throw new Error('NO_SUPPORTED_VALUE');
  const assertedClaims = [...new Set([...claimIds, ...c.requiredClaimIds])].map(id => claims.find(item => item.id === id)).filter((item): item is (typeof claims)[number] => !!item);
  const state = c.commercialState ?? 'STANDARD'; const athena = state === SITE_UNDER_CONSTRUCTION_STATE;
  const observation = assertedClaims.map(item => clean(item.text)).join(' '); const name = c.prospect.name;
  const link = c.artifact!.canonicalLink; const profile = resolveVerticalProfile(c.prospect.vertical);
  const opening = athena ? `Bonjour, ici Magic Script. Votre site est actuellement en attente de construction. ${observation}.` : `Bonjour, ici Magic Script. En regardant ${name}, un point concret ressort : ${observation}.`;
  const relevance = athena ? `Nous avons préparé une alternative concrète à regarder maintenant : ${link}` : `Nous avons préparé une démo spécifique à votre activité pour regarder ce point : ${link}`;
  const booking = c.demoBooking?.exposesCanonicalBookingCta !== false ? '' : (c.demoBooking?.fallbackExplicitlyPermitted && c.demoBooking.fallbackAppointmentUrl ? ` Si vous préférez, vous pouvez aussi choisir un créneau : ${c.demoBooking.fallbackAppointmentUrl}` : '');
  const body = mode === 'EMAIL'
    ? `${opening}\n\n${relevance}${booking}\n\nSi le sujet vous parle, souhaitez-vous y jeter un œil et me dire ce que vous en pensez ?\n\n${OPPOSITION}`
    : `Bonjour, ici Magic Script. ${athena ? 'Votre site est actuellement en attente de construction.' : `J’ai relevé ce détail chez ${name} : ${observation}.`} Nous avons préparé une démo : ${link}${booking}\n\nVous voulez la regarder ?\n${OPPOSITION}`;
  const candidate: CommercialMessageCandidate = { channel: mode, subject: mode === 'EMAIL' ? `Une démo préparée pour ${name}` : null, body, transportSignature: null, composition: mode === 'EMAIL' ? 'EMAIL_ORIGINAL' : 'MOBILE_ORIGINAL', assertions: assertedClaims.map(item => ({ claimId: item.id, text: item.text })), catalogMentions: [], revision: request.attempt, contentRef: '', approval: null };
  candidate.contentRef = commercialContentRef(candidate);
  assertFormatting(candidate);
  return { candidate, semanticAssessment: { specificity: 4, commercialRelevance: 4, humanness: 4, channelFit: 4, ctaQuality: 4, concision: 4, antiGenericQuality: 4, assessor: 'CP03_DETERMINISTIC_ADAPTER' }, path: `deterministic-${mode.toLowerCase()}-${profile.id.toLowerCase()}` };
}
export const emailGeneratorAdapter: CommercialGeneratorAdapter = { id: 'CP03_EMAIL_NATIVE_V1', generate: request => buildCandidate(request, 'EMAIL') };
export const mobileGeneratorAdapter: CommercialGeneratorAdapter = { id: 'CP03_MOBILE_NATIVE_V1', generate: request => buildCandidate(request, 'MOBILE') };
export const deterministicCommercialAdapters = { EMAIL: emailGeneratorAdapter, MOBILE: mobileGeneratorAdapter } as const;

function trace(context: PreparationContext, generatorPath: string | null, state: CommercialState, attempts: number, gate: CommercialQualityGateResult | null, claims: string[], exemplars: readonly string[]): PreparationTrace { return { preparationVersion: CP03_PREPARATION_VERSION, generatorPath, playbookVersion: context.playbookVersion, verticalProfile: resolveVerticalProfile(context.prospect.vertical).id, verticalProfileVersion: resolveVerticalProfile(context.prospect.vertical).version, commercialState: state, exemplarIds: exemplars, contextVersion: `${context.agent1.sourceRef}@${context.agent1.version}`, claimsUsed: claims, attempts, qualityGateVersion: gate?.qualityGateVersion ?? null, finalFingerprint: gate?.contentIdentity.fingerprint ?? null }; }

export function prepareCommercialOutreach(context: PreparationContext, adapter: CommercialGeneratorAdapter = deterministicCommercialAdapters[context.channel]): CommercialPreparationResult {
  const state = context.commercialState ?? 'STANDARD'; const profile = resolveVerticalProfile(context.prospect.vertical); const exemplars = context.exemplarIds ?? profile.exemplarIds;
  const baseTrace = trace(context, null, state, 0, null, [], exemplars); const prerequisite = decideCommercialPrerequisites(context);
  if (prerequisite.decision !== 'GENERATE') return { decision: prerequisite.decision === 'DO_NOT_CONTACT' ? 'BLOCKED' : 'ABSTAIN', candidate: null, subject: null, body: null, channel: context.channel, claimsUsed: [], qualityGate: null, correctionHistory: [], trace: baseTrace };
  if (state === SITE_UNDER_CONSTRUCTION_STATE && !underConstructionClaim(context)) return { decision: 'ABSTAIN', candidate: null, subject: null, body: null, channel: context.channel, claimsUsed: [], qualityGate: null, correctionHistory: [], trace: baseTrace };
  if (!context.artifact?.canonicalLink || context.artifact.status !== 'READY' || context.artifact.prospectId !== context.prospect.id) return { decision: 'BLOCKED', candidate: null, subject: null, body: null, channel: context.channel, claimsUsed: [], qualityGate: null, correctionHistory: [], trace: baseTrace };
  const corrections: { attempt: number; reasons: string[] }[] = []; let lastGate: CommercialQualityGateResult | null = null; let last: GeneratorResult | null = null;
  for (let attempt = 1; attempt <= MAX_REGENERATION_ATTEMPTS + 1; attempt++) {
    const generated = adapter.generate({ context, correctionReasons: corrections.at(-1)?.reasons ?? [], attempt }); last = generated;
    lastGate = evaluateCommercialQualityGate({ context, candidate: generated.candidate, expectedOutcome: { decision: 'GENERATE', reason: null }, semanticAssessment: generated.semanticAssessment, regenerationAttempt: attempt - 1 });
    if (lastGate.decision === 'READY_FOR_OPERATOR') return { decision: 'READY_FOR_OPERATOR', candidate: generated.candidate, subject: generated.candidate.subject, body: generated.candidate.body, channel: context.channel, claimsUsed: generated.candidate.assertions.map(a => a.claimId), qualityGate: lastGate, correctionHistory: corrections, trace: trace(context, generated.path, state, attempt, lastGate, generated.candidate.assertions.map(a => a.claimId), exemplars) };
    if (attempt === MAX_REGENERATION_ATTEMPTS + 1 || !lastGate.regenerationAllowed) break;
    corrections.push({ attempt, reasons: [...lastGate.blockers, ...lastGate.warnings] });
  }
  return { decision: lastGate?.decision === 'BLOCKED' ? 'BLOCKED' : 'ABSTAIN', candidate: last?.candidate ?? null, subject: last?.candidate.subject ?? null, body: last?.candidate.body ?? null, channel: context.channel, claimsUsed: last?.candidate.assertions.map(a => a.claimId) ?? [], qualityGate: lastGate, correctionHistory: corrections, trace: trace(context, last?.path ?? null, state, corrections.length + (last ? 1 : 0), lastGate, last?.candidate.assertions.map(a => a.claimId) ?? [], exemplars) };
}
