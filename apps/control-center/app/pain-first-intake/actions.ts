'use server';

import { acceptPainFirstSearchCandidate } from '../../../../core/research/pain-first-staging';
import type { PainFirstSearchCandidate, PainFirstConditionClass, SuppliedFirstPartyPageObservation } from '../../../../core/research/pain-first-staging';
import { createPainFirstLiveHomepageInspector, createPainFirstLiveIdentityEnricher } from '../../../../core/research/pain-first-homepage-transport';
import type { PainFirstIdentityEnrichment } from '../../../../core/research/pain-first-homepage-transport';
import { extractSuppliedFirstPartyIdentity } from '../../../../core/research/website-seed';

export type PainFirstIdentityDiagnostic = {
  identityState: ReturnType<typeof extractSuppliedFirstPartyIdentity>['state'];
  initialIdentityState: ReturnType<typeof extractSuppliedFirstPartyIdentity>['state'];
  enrichmentOutcome: PainFirstIdentityEnrichment['outcome'];
  identityPage?: string;
  identityPageTransportClass?: PainFirstIdentityEnrichment['identityPageTransportClass'];
  siren?: string; siret?: string; operatorName?: string;
  municipality?: string; postcode?: string; street?: string; streetNumber?: string;
};

export type PainFirstInspectDiagnostic =
  | { state: 'INVALID'; reason: 'URL_REJECTED' }
  | { state: 'INSPECTION_FAILED' }
  | { state: 'INSPECTED'; pageState: 'PAGE_OBSERVED' | 'FETCH_FAILED';
      observation: Pick<SuppliedFirstPartyPageObservation, 'httpResultClass' | 'boundedTitle' | 'boundedH1'>;
      staging: { state: 'PAIN_SIGNAL_CONFIRMED' | 'NO_PAIN_SIGNAL' | 'PAIN_UNKNOWN' | 'FETCH_FAILED';
        authority: 'NON_AUTHORITATIVE'; queryConditionClass?: PainFirstConditionClass;
        observedConditionClass?: PainFirstConditionClass; conditionConsistency?: 'MATCH' | 'MISMATCH' };
      identity?: PainFirstIdentityDiagnostic };

/** The wire carries bookkeeping only. Acceptance is recreated in this server run. */
export async function inspectPainFirstCandidate(candidate: PainFirstSearchCandidate): Promise<PainFirstInspectDiagnostic> {
  let accepted;
  try {
    // Runtime shape checks precede the canonical validator, which expects typed strings.
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
        Object.keys(candidate).some((key) => !['schemaVersion', 'queryPlanId', 'conditionClass',
          'providerClass', 'resultUrl', 'resultTitle', 'resultPosition', 'acquiredAt', 'providerRunId', 'authority'].includes(key)) ||
        !['queryPlanId', 'conditionClass', 'providerClass', 'resultUrl', 'acquiredAt', 'providerRunId', 'authority']
          .every((key) => typeof candidate[key as keyof PainFirstSearchCandidate] === 'string')) {
      return { state: 'INVALID', reason: 'URL_REJECTED' };
    }
    accepted = acceptPainFirstSearchCandidate(candidate);
  } catch {
    return { state: 'INVALID', reason: 'URL_REJECTED' };
  }
  if (accepted.state !== 'URL_ACCEPTED') return { state: 'INVALID', reason: 'URL_REJECTED' };

  try {
    // R58Z owns transport and R42 staging, including stopAfterPainSignal: true.
    const inspection = await createPainFirstLiveHomepageInspector()(accepted);
    const { observation, staging } = inspection;
    if (!['PAIN_SIGNAL_CONFIRMED', 'NO_PAIN_SIGNAL', 'PAIN_UNKNOWN', 'FETCH_FAILED'].includes(staging.state)) {
      return { state: 'INSPECTION_FAILED' };
    }
    let identity: PainFirstIdentityDiagnostic | undefined;
    if (observation.httpResultClass === 'SUCCESS' && staging.state === 'PAIN_SIGNAL_CONFIRMED' &&
        (staging.observedConditionClass === 'SITE_UNDER_CONSTRUCTION' || staging.observedConditionClass === 'SITE_REBUILDING')) {
      // R55 candidate facts from the homepage, then at most one explicit identity page.
      const extracted = extractSuppliedFirstPartyIdentity(observation.suppliedHtml ?? observation.identitySafeSubset ?? '');
      const enriched = await createPainFirstLiveIdentityEnricher()(accepted, inspection, extracted);
      identity = { identityState: enriched.finalIdentity.state, initialIdentityState: extracted.state,
        enrichmentOutcome: enriched.outcome,
        ...(enriched.identityPageTransportClass ? { identityPageTransportClass: enriched.identityPageTransportClass } : {}),
        ...(enriched.identityPage ? { identityPage: enriched.identityPage } : {}) };
      const facts = enriched.finalIdentity.identity;
      if (facts) {
        const fields = { siren: facts.directSiren, siret: facts.directSiret, operatorName: facts.exactOperatorName,
          municipality: facts.municipality, postcode: facts.postcode, street: facts.street, streetNumber: facts.streetNumber };
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) identity[key as keyof typeof fields] = value.slice(0, 512);
        }
      }
    }
    return { state: 'INSPECTED', pageState: inspection.pageState,
      ...(identity ? { identity } : {}),
      observation: { httpResultClass: observation.httpResultClass,
        ...(observation.boundedTitle !== undefined ? { boundedTitle: observation.boundedTitle } : {}),
        ...(observation.boundedH1 !== undefined ? { boundedH1: observation.boundedH1 } : {}) },
      staging: { state: staging.state as 'PAIN_SIGNAL_CONFIRMED' | 'NO_PAIN_SIGNAL' | 'PAIN_UNKNOWN' | 'FETCH_FAILED',
        authority: staging.authority,
        ...('queryConditionClass' in staging ? { queryConditionClass: staging.queryConditionClass,
          observedConditionClass: staging.observedConditionClass, conditionConsistency: staging.conditionConsistency } : {}) } };
  } catch {
    // Never serialize internal transport exceptions or security diagnostics.
    return { state: 'INSPECTION_FAILED' };
  }
}
