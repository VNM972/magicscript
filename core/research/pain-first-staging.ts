import { classifySourceType, normalizeCandidateUrl } from '../contact-acquisition/agent';
import { canonicalNoticePhrase } from './digital-pain-evidence';
import { inspectSuppliedDigitalPainPreflight } from './digital-pain-preflight';
import type { NonAuthoritativeDigitalPainPreflightResult } from './digital-pain-preflight';
import { publicHttpUrl } from './evidence-integrity';
import { extractSuppliedFirstPartyIdentity, validRegistration } from './website-seed';

export const MAX_SEARCH_REQUESTS_PER_CYCLE = 2;
export const MAX_RESULTS_PER_QUERY = 10;
export const MAX_HOMEPAGE_FETCHES_PER_QUERY = 3;
export const MAX_REGISTRY_REQUESTS_PER_CANDIDATE = 1;
export const RETRIES = 0;

export type PainFirstConditionClass = 'SITE_UNDER_CONSTRUCTION' | 'SITE_REBUILDING';
export interface PainFirstQueryPlan {
  schemaVersion: 1;
  planId: string;
  conditionClass: PainFirstConditionClass;
  canonicalNoticeType: PainFirstConditionClass;
  canonicalSearchPhrase: string;
  query: string;
  geography: { country: 'MQ'; label: 'Martinique' };
  maxProviderRequests: 1;
}

/** Exactly two provider-neutral query windows, with no expansion. */
export function painFirstQueryPlans(): readonly PainFirstQueryPlan[] {
  return (['SITE_UNDER_CONSTRUCTION', 'SITE_REBUILDING'] as const).map((conditionClass) => {
    const canonicalSearchPhrase = canonicalNoticePhrase(conditionClass);
    return { schemaVersion: 1, planId: `pain-first:1:${conditionClass}:${encodeURIComponent(canonicalSearchPhrase)}:MQ`,
      conditionClass, canonicalNoticeType: conditionClass, canonicalSearchPhrase,
      query: `${canonicalSearchPhrase} Martinique`, geography: { country: 'MQ', label: 'Martinique' },
      maxProviderRequests: 1 };
  });
}

/** Search metadata is bookkeeping only; it has no source, pain, or identity authority. */
export interface PainFirstSearchCandidate {
  schemaVersion: 1;
  queryPlanId: string;
  conditionClass: PainFirstConditionClass;
  providerClass: string;
  resultUrl: string;
  resultTitle?: string;
  resultPosition: number;
  acquiredAt: string;
  providerRunId: string;
  authority: 'NONE';
}

declare const acceptedCandidateBrand: unique symbol;
export type AcceptedPainFirstSearchCandidate = Readonly<{
  state: 'URL_ACCEPTED'; homepageUrl: string; [acceptedCandidateBrand]: true;
}>;
const acceptedCandidates = new WeakMap<object, Readonly<PainFirstSearchCandidate>>();

/** Run-local capability: copied/serialized/forged acceptance results are not capabilities. */
export function candidateFromPainFirstAcceptance(accepted: AcceptedPainFirstSearchCandidate):
  Readonly<PainFirstSearchCandidate> | undefined {
  return acceptedCandidates.get(accepted);
}

export function acceptPainFirstSearchCandidate(candidate: PainFirstSearchCandidate):
  AcceptedPainFirstSearchCandidate | { state: 'URL_REJECTED' } {
  const plan = painFirstQueryPlans().find((item) => item.planId === candidate?.queryPlanId &&
    item.conditionClass === candidate.conditionClass);
  if (!plan || candidate.schemaVersion !== 1 || candidate.authority !== 'NONE' ||
      !candidate.providerClass?.trim() || !candidate.providerRunId?.trim() ||
      !Number.isInteger(candidate.resultPosition) || candidate.resultPosition < 1 ||
      candidate.resultPosition > MAX_RESULTS_PER_QUERY ||
      (candidate.resultTitle !== undefined && (typeof candidate.resultTitle !== 'string' || candidate.resultTitle.length > 200)) ||
      !Number.isFinite(Date.parse(candidate.acquiredAt))) return { state: 'URL_REJECTED' };
  const url = publicHttpUrl(candidate.resultUrl);
  const normalized = normalizeCandidateUrl(candidate.resultUrl);
  if (!url || !normalized || url.search || !['/', '/index.html'].includes(url.pathname) ||
      classifySourceType(normalized) !== 'OTHER_PUBLIC_SOURCE') return { state: 'URL_REJECTED' };
  const accepted = Object.freeze({ state: 'URL_ACCEPTED', homepageUrl: normalized }) as AcceptedPainFirstSearchCandidate;
  acceptedCandidates.set(accepted, Object.freeze({ ...candidate, resultUrl: normalized }));
  return accepted;
}

/** Transport output supplied by a future caller. No fetch or source acceptance occurs here. */
export interface SuppliedFirstPartyPageObservation {
  schemaVersion: 1;
  requestedUrl: string;
  finalUrl?: string;
  httpResultClass: 'SUCCESS' | 'REDIRECT' | 'CLIENT_ERROR' | 'SERVER_ERROR' |
    'NETWORK_ERROR' | 'TIMEOUT' | 'UNSUPPORTED';
  contentType?: string;
  boundedTitle?: string;
  boundedH1?: readonly string[];
  suppliedHtml?: string;
  identitySafeSubset?: string;
  inspectedAt: string;
}

export type PainFirstPageStagingResult =
  | { state: 'FETCH_FAILED' | 'PAIN_UNKNOWN' | 'NO_PAIN_SIGNAL'; authority: 'NON_AUTHORITATIVE' }
  | { state: 'PAIN_SIGNAL_CONFIRMED' | 'IDENTITY_ABSENT' | 'IDENTITY_PARTIAL' | 'IDENTITY_CONFLICT';
      authority: 'NON_AUTHORITATIVE'; queryConditionClass: PainFirstConditionClass;
      observedConditionClass: PainFirstConditionClass; conditionConsistency: 'MATCH' | 'MISMATCH' }
  | { state: 'IDENTITY_EXTRACTED'; authority: 'NON_AUTHORITATIVE';
      queryConditionClass: PainFirstConditionClass; observedConditionClass: PainFirstConditionClass;
      conditionConsistency: 'MATCH' | 'MISMATCH'; identity: NonNullable<ReturnType<typeof extractSuppliedFirstPartyIdentity>['identity']> };

/** R42 is invoked once, only for a supplied successful homepage observation. */
export function stagePainFirstSuppliedPage(candidate: PainFirstSearchCandidate,
  observation: SuppliedFirstPartyPageObservation,
  options?: { stopAfterPainSignal: true }): PainFirstPageStagingResult {
  const accepted = acceptPainFirstSearchCandidate(candidate);
  if (accepted.state !== 'URL_ACCEPTED') throw new Error('URL_REJECTED');
  const requested = normalizeCandidateUrl(observation?.requestedUrl);
  const final = observation?.finalUrl === undefined ? requested : normalizeCandidateUrl(observation.finalUrl);
  if (observation?.schemaVersion !== 1 || observation.httpResultClass !== 'SUCCESS' ||
      !requested || requested !== accepted.homepageUrl || final !== requested ||
      !Number.isFinite(Date.parse(observation.inspectedAt)) ||
      (observation.boundedTitle !== undefined && (typeof observation.boundedTitle !== 'string' || observation.boundedTitle.length > 512)) ||
      (observation.boundedH1 !== undefined && (!Array.isArray(observation.boundedH1) || observation.boundedH1.length > 4 ||
        observation.boundedH1.some((text) => typeof text !== 'string' || text.length > 512))) ||
      (observation.suppliedHtml !== undefined && (typeof observation.suppliedHtml !== 'string' || observation.suppliedHtml.length > 250_000)) ||
      (observation.identitySafeSubset !== undefined && (typeof observation.identitySafeSubset !== 'string' || observation.identitySafeSubset.length > 250_000)) ||
      (observation.contentType && !/^text\/html(?:\s*;|$)/i.test(observation.contentType))) {
    return { state: 'FETCH_FAILED', authority: 'NON_AUTHORITATIVE' };
  }
  const preflight = inspectSuppliedDigitalPainPreflight({ origin: requested,
    seedProvenance: { kind: 'CANDIDATE_URL', reference: requested },
    content: { kind: 'TITLE_H1', title: observation.boundedTitle, h1: observation.boundedH1 } });
  if (preflight.state === 'NO_PAIN_SIGNAL') return {
    state: painFirstTransition('PAGE_OBSERVED', 'NO_PAIN_SIGNAL', { preflight }) as 'NO_PAIN_SIGNAL',
    authority: 'NON_AUTHORITATIVE' };
  if (preflight.state === 'UNKNOWN') return {
    state: painFirstTransition('PAGE_OBSERVED', 'PAIN_UNKNOWN', { preflight }) as 'PAIN_UNKNOWN',
    authority: 'NON_AUTHORITATIVE' };
  painFirstTransition('PAGE_OBSERVED', 'PAIN_SIGNAL_CONFIRMED', { preflight });
  const audit = { authority: 'NON_AUTHORITATIVE' as const,
    queryConditionClass: candidate.conditionClass, observedConditionClass: preflight.condition,
    conditionConsistency: candidate.conditionClass === preflight.condition ? 'MATCH' as const : 'MISMATCH' as const };
  if (options?.stopAfterPainSignal) return { ...audit, state: 'PAIN_SIGNAL_CONFIRMED' };
  const extracted = extractSuppliedFirstPartyIdentity(observation.suppliedHtml ?? observation.identitySafeSubset ?? '');
  if (extracted.state !== 'IDENTITY_STRONG') {
    painFirstTransition('PAIN_SIGNAL_CONFIRMED', extracted.state, { identity: extracted });
    return { ...audit, state: extracted.state };
  }
  painFirstTransition('PAIN_SIGNAL_CONFIRMED', 'IDENTITY_EXTRACTED', { identity: extracted });
  if (!extracted.identity) throw new Error('IDENTITY_PROOF_REQUIRED');
  return { ...audit, state: 'IDENTITY_EXTRACTED', identity: extracted.identity };
}

export type RegistryIdentityReconciliationRequest = {
  schemaVersion: 1; source: 'PAIN_FIRST'; candidateId: string; requestedAt: string;
} & (
  | { lookupMode: 'SIRET'; directSiret: string }
  | { lookupMode: 'SIREN'; directSiren: string }
  | { lookupMode: 'NAME_ADDRESS'; exactOperatorName: string; municipality?: string;
      postcode?: string; street?: string; streetNumber?: string }
);

export function validRegistryReconciliationRequest(request: RegistryIdentityReconciliationRequest): boolean {
  if (request?.schemaVersion !== 1 || request.source !== 'PAIN_FIRST' || !request.candidateId?.trim() ||
      !Number.isFinite(Date.parse(request.requestedAt))) return false;
  if (request.lookupMode === 'SIRET') return typeof request.directSiret === 'string' &&
    !('directSiren' in request) && !('exactOperatorName' in request) && validRegistration(request.directSiret, 14);
  if (request.lookupMode === 'SIREN') return typeof request.directSiren === 'string' &&
    !('directSiret' in request) && !('exactOperatorName' in request) && validRegistration(request.directSiren, 9);
  return request.lookupMode === 'NAME_ADDRESS' && !('directSiret' in request) && !('directSiren' in request) &&
    Boolean(request.exactOperatorName?.trim() &&
    request.postcode?.trim() && (request.municipality?.trim() || request.street?.trim()));
}

export function registryRequestFromIdentity(candidateId: string, requestedAt: string,
  identity: NonNullable<ReturnType<typeof extractSuppliedFirstPartyIdentity>['identity']>):
  RegistryIdentityReconciliationRequest | null {
  const base = { schemaVersion: 1 as const, source: 'PAIN_FIRST' as const, candidateId, requestedAt };
  const request: RegistryIdentityReconciliationRequest = identity.directSiret
    ? { ...base, lookupMode: 'SIRET', directSiret: identity.directSiret }
    : identity.directSiren ? { ...base, lookupMode: 'SIREN', directSiren: identity.directSiren }
      : { ...base, lookupMode: 'NAME_ADDRESS', exactOperatorName: identity.exactOperatorName ?? '',
        municipality: identity.municipality, postcode: identity.postcode,
        street: identity.street, streetNumber: identity.streetNumber };
  return validRegistryReconciliationRequest(request) ? request : null;
}

export type RegistryIdentityReconciliationResult = {
  schemaVersion: 1; candidateId: string; completedAt: string;
} & (
  | { state: 'ZERO_MATCH'; matchCount: 0 }
  | { state: 'MULTIPLE_MATCHES'; matchCount: number }
  | { state: 'PROVIDER_FAILURE'; failureCode: string }
  | { state: 'UNIQUE_MATCH'; matchCount: 1; canonicalSiren: string; canonicalSiret?: string;
      canonicalEnterpriseName: string; canonicalEstablishmentIdentity: string;
      municipality: string; postcode: string;
      exactMatchProvenance: { lookupMode: 'SIRET' | 'SIREN' | 'NAME_ADDRESS' } }
);

export function validRegistryReconciliationResult(result: RegistryIdentityReconciliationResult): boolean {
  if (result?.schemaVersion !== 1 || !result.candidateId?.trim() ||
      !Number.isFinite(Date.parse(result.completedAt))) return false;
  switch (result.state) {
    case 'ZERO_MATCH': return result.matchCount === 0;
    case 'MULTIPLE_MATCHES': return Number.isInteger(result.matchCount) && result.matchCount >= 2;
    case 'PROVIDER_FAILURE': return Boolean(result.failureCode?.trim());
    case 'UNIQUE_MATCH': return result.matchCount === 1 &&
      ['SIRET', 'SIREN', 'NAME_ADDRESS'].includes(result.exactMatchProvenance?.lookupMode) &&
      typeof result.canonicalSiren === 'string' && validRegistration(result.canonicalSiren, 9) &&
      (result.canonicalSiret === undefined || typeof result.canonicalSiret === 'string' &&
        validRegistration(result.canonicalSiret, 14) && result.canonicalSiret.slice(0, 9) === result.canonicalSiren) &&
      Boolean(result.canonicalEnterpriseName?.trim() && result.canonicalEstablishmentIdentity?.trim() &&
        result.municipality?.trim() && /^972\d{2}$/.test(result.postcode));
    default: return false;
  }
}

export function readyForProspectCreation(request: RegistryIdentityReconciliationRequest,
  result: RegistryIdentityReconciliationResult, factualOperatorName: string): boolean {
  if (!validRegistryReconciliationRequest(request) || !validRegistryReconciliationResult(result) ||
      result.candidateId !== request.candidateId ||
      result.state !== 'UNIQUE_MATCH' || result.matchCount !== 1 ||
      result.exactMatchProvenance?.lookupMode !== request.lookupMode ||
      !factualOperatorName?.trim() || !result.canonicalEnterpriseName?.trim() ||
      !result.canonicalEstablishmentIdentity?.trim() || !result.municipality?.trim() ||
      !/^972\d{2}$/.test(result.postcode) || !validRegistration(result.canonicalSiren, 9) ||
      !result.canonicalSiret || !validRegistration(result.canonicalSiret, 14) ||
      result.canonicalSiret.slice(0, 9) !== result.canonicalSiren) return false;
  return request.lookupMode === 'SIRET' ? result.canonicalSiret === request.directSiret :
    request.lookupMode === 'SIREN' ? result.canonicalSiren === request.directSiren : true;
}

export type PainFirstStagingState = 'SEARCH_CANDIDATE' | 'URL_ACCEPTED' | 'PAGE_OBSERVED' |
  'PAIN_SIGNAL_CONFIRMED' | 'IDENTITY_EXTRACTED' | 'REGISTRY_RECONCILED' |
  'READY_FOR_PROSPECT_CREATION' | 'URL_REJECTED' | 'FETCH_FAILED' | 'NO_PAIN_SIGNAL' |
  'PAIN_UNKNOWN' | 'IDENTITY_ABSENT' | 'IDENTITY_PARTIAL' | 'IDENTITY_CONFLICT' |
  'REGISTRY_ZERO_MATCH' | 'REGISTRY_MULTIPLE_MATCHES' | 'REGISTRY_FAILURE' | 'EXISTING_PROSPECT';

const transitions: Partial<Record<PainFirstStagingState, readonly PainFirstStagingState[]>> = {
  SEARCH_CANDIDATE: ['URL_ACCEPTED', 'URL_REJECTED'],
  URL_ACCEPTED: ['PAGE_OBSERVED', 'FETCH_FAILED'],
  PAGE_OBSERVED: ['PAIN_SIGNAL_CONFIRMED', 'NO_PAIN_SIGNAL', 'PAIN_UNKNOWN'],
  PAIN_SIGNAL_CONFIRMED: ['IDENTITY_EXTRACTED', 'IDENTITY_ABSENT', 'IDENTITY_PARTIAL', 'IDENTITY_CONFLICT'],
  IDENTITY_EXTRACTED: ['REGISTRY_RECONCILED', 'REGISTRY_ZERO_MATCH', 'REGISTRY_MULTIPLE_MATCHES', 'REGISTRY_FAILURE'],
  REGISTRY_RECONCILED: ['READY_FOR_PROSPECT_CREATION', 'EXISTING_PROSPECT'],
};

export type PainFirstTransitionProof =
  | { preflight: NonAuthoritativeDigitalPainPreflightResult }
  | { identity: ReturnType<typeof extractSuppliedFirstPartyIdentity> }
  | { request: RegistryIdentityReconciliationRequest;
      result: RegistryIdentityReconciliationResult; factualOperatorName: string; existingProspect: boolean };

export function painFirstTransition(from: PainFirstStagingState, to: PainFirstStagingState,
  proof?: PainFirstTransitionProof):
  PainFirstStagingState {
  if (!transitions[from]?.includes(to)) throw new Error(`ILLEGAL_TRANSITION:${from}->${to}`);
  if (from === 'PAGE_OBSERVED') {
    if (!proof || !('preflight' in proof) || proof.preflight?.authority !== 'NON_AUTHORITATIVE')
      throw new Error('R42_PROOF_REQUIRED');
    const preflight = proof.preflight;
    const expected = preflight.state === 'LIKELY_CANONICAL_PAIN' &&
      (preflight.condition === 'SITE_UNDER_CONSTRUCTION' || preflight.condition === 'SITE_REBUILDING')
      ? 'PAIN_SIGNAL_CONFIRMED' : preflight.state === 'NO_PAIN_SIGNAL' ? 'NO_PAIN_SIGNAL' :
        preflight.state === 'UNKNOWN' ? 'PAIN_UNKNOWN' : undefined;
    if (!expected || to !== expected) throw new Error('R42_RESULT_MISMATCH');
  }
  if (from === 'PAIN_SIGNAL_CONFIRMED') {
    if (!proof || !('identity' in proof) || !proof.identity ||
        (proof.identity.state === 'IDENTITY_STRONG' && !proof.identity.identity))
      throw new Error('IDENTITY_PROOF_REQUIRED');
    const expected = proof.identity.state === 'IDENTITY_STRONG' ? 'IDENTITY_EXTRACTED' : proof.identity.state;
    if (to !== expected) throw new Error('IDENTITY_RESULT_MISMATCH');
  }
  if (from === 'IDENTITY_EXTRACTED') {
    if (!proof || !('request' in proof) || !validRegistryReconciliationRequest(proof.request) ||
        !validRegistryReconciliationResult(proof.result) ||
        proof.request.candidateId !== proof.result.candidateId) throw new Error('REGISTRY_PROOF_REQUIRED');
    const expected = { UNIQUE_MATCH: 'REGISTRY_RECONCILED', ZERO_MATCH: 'REGISTRY_ZERO_MATCH',
      MULTIPLE_MATCHES: 'REGISTRY_MULTIPLE_MATCHES', PROVIDER_FAILURE: 'REGISTRY_FAILURE' }[proof.result.state];
    if (to !== expected) throw new Error('REGISTRY_RESULT_MISMATCH');
  }
  if (from === 'REGISTRY_RECONCILED' && (!proof || !('request' in proof) ||
    typeof proof.existingProspect !== 'boolean' || !readyForProspectCreation(
    proof.request, proof.result, proof.factualOperatorName) ||
    (proof.existingProspect ? to !== 'EXISTING_PROSPECT' : to !== 'READY_FOR_PROSPECT_CREATION')))
    throw new Error('REGISTRY_PROOF_REQUIRED');
  return to;
}
