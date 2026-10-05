import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifySourceType } from '../contact-acquisition/agent';
import { canonicalNoticePhrase, noticeType } from '../research/digital-pain-evidence';
import { inspectSuppliedDigitalPainPreflight } from '../research/digital-pain-preflight';
import { extractSuppliedFirstPartyIdentity } from '../research/website-seed';
import { acceptPainFirstSearchCandidate, MAX_HOMEPAGE_FETCHES_PER_QUERY,
  MAX_REGISTRY_REQUESTS_PER_CANDIDATE, MAX_RESULTS_PER_QUERY, MAX_SEARCH_REQUESTS_PER_CYCLE,
  painFirstQueryPlans, painFirstTransition, readyForProspectCreation, registryRequestFromIdentity,
  RETRIES, stagePainFirstSuppliedPage, validRegistryReconciliationRequest } from '../research/pain-first-staging';
import type { PainFirstSearchCandidate, PainFirstStagingState, PainFirstTransitionProof, RegistryIdentityReconciliationResult,
  SuppliedFirstPartyPageObservation } from '../research/pain-first-staging';

const plans = painFirstQueryPlans();
const candidate = (overrides: Partial<PainFirstSearchCandidate> = {}): PainFirstSearchCandidate => ({
  schemaVersion: 1, queryPlanId: plans[0].planId, conditionClass: 'SITE_UNDER_CONSTRUCTION',
  providerClass: 'PUBLIC_URL_SEARCH', resultUrl: 'https://cafe-alizes.fr/', resultPosition: 1,
  acquiredAt: '2026-09-30T12:00:00.000Z', providerRunId: 'offline-1', authority: 'NONE', ...overrides,
});
const ld = (data: object) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body></body></html>`;
const address = { addressLocality: 'Fort-de-France', postalCode: '97200', streetAddress: '12 Rue des Hibiscus' };
const operator = { '@type': 'CafeOrCoffeeShop', name: 'Café des Alizés', siret: '12345678200002', address };
const observation = (overrides: Partial<SuppliedFirstPartyPageObservation> = {}): SuppliedFirstPartyPageObservation => ({
  schemaVersion: 1, requestedUrl: 'https://cafe-alizes.fr/', httpResultClass: 'SUCCESS',
  boundedTitle: 'Site en construction', suppliedHtml: ld(operator), inspectedAt: '2026-09-30T12:01:00.000Z',
  ...overrides,
});
const identity = extractSuppliedFirstPartyIdentity(ld(operator)).identity!;
const request = registryRequestFromIdentity('offline-1', '2026-09-30T12:02:00.000Z', identity)!;
const unique: RegistryIdentityReconciliationResult = { schemaVersion: 1, candidateId: 'offline-1',
  completedAt: '2026-09-30T12:03:00.000Z', state: 'UNIQUE_MATCH', matchCount: 1,
  canonicalSiren: '123456782', canonicalSiret: '12345678200002',
  canonicalEnterpriseName: 'Café des Alizés', canonicalEstablishmentIdentity: 'Café des Alizés Fort-de-France',
  municipality: 'Fort-de-France', postcode: '97200', exactMatchProvenance: { lookupMode: 'SIRET' } };
const proof = { request, result: unique, factualOperatorName: 'Café des Alizés', existingProspect: false };
const painProof = (title = 'Site en construction', h1?: readonly string[]) => ({
  preflight: inspectSuppliedDigitalPainPreflight({ origin: candidate().resultUrl,
    content: { kind: 'TITLE_H1', title, h1 } }),
});
const identityProof = (html = ld(operator)) => ({ identity: extractSuppliedFirstPartyIdentity(html) });

// R54 query-plan cases 1-4.
test('01 construction canonical query', () => { assert.equal(canonicalNoticePhrase('SITE_UNDER_CONSTRUCTION'), 'site en construction');
  assert.equal(plans[0].query, 'site en construction Martinique'); });
test('02 rebuilding canonical query', () => { assert.equal(canonicalNoticePhrase('SITE_REBUILDING'), 'site en cours de refonte');
  assert.equal(plans[1].query, 'site en cours de refonte Martinique'); });
test('03 no maintenance synonym or query expansion', () => { assert.equal(plans.length, 2);
  assert.ok(plans.every((plan) => !/maintenance/i.test(plan.query))); });
test('04 no coming-soon expansion', () => { assert.ok(plans.every((plan) => !/coming soon/i.test(plan.query)));
  assert.equal(noticeType('Coming soon'), undefined); });

// URL cases 5-14. All decisions use the existing public URL and source classification helpers.
test('05 public HTTPS root accepted', () => assert.equal(acceptPainFirstSearchCandidate(candidate()).state, 'URL_ACCEPTED'));
test('06 public HTTP root accepted by existing policy', () => assert.equal(acceptPainFirstSearchCandidate(candidate({ resultUrl: 'http://cafe-alizes.fr/' })).state, 'URL_ACCEPTED'));
for (const [number, label, url] of [
  ['07', 'social', 'https://facebook.com/'], ['08', 'registry', 'https://annuaire-entreprises.data.gouv.fr/'],
  ['09', 'directory', 'https://pagesjaunes.fr/'], ['10', 'marketplace', 'https://booking.com/'],
  ['11', 'private IP', 'https://192.168.1.2/'], ['12', 'localhost', 'http://localhost/'],
  ['13', 'credential URL', 'https://user:pass@cafe-alizes.fr/'], ['14', 'malformed URL', 'http://['],
] as const) test(`${number} ${label} rejected`, () =>
  assert.equal(acceptPainFirstSearchCandidate(candidate({ resultUrl: url })).state, 'URL_REJECTED'));

// R42 cases 15-20.
test('15 construction title positive', () => assert.equal(stagePainFirstSuppliedPage(candidate(), observation()).state, 'IDENTITY_EXTRACTED'));
test('16 construction H1 positive', () => assert.equal(stagePainFirstSuppliedPage(candidate(), observation({ boundedTitle: '', boundedH1: ['Site en construction'] })).state, 'IDENTITY_EXTRACTED'));
test('17 rebuilding title positive', () => { const result = stagePainFirstSuppliedPage(candidate(), observation({ boundedTitle: 'Site en cours de refonte' }));
  assert.equal(result.state, 'IDENTITY_EXTRACTED'); if ('conditionConsistency' in result) { assert.equal(result.conditionConsistency, 'MISMATCH');
    assert.equal(result.queryConditionClass, 'SITE_UNDER_CONSTRUCTION'); assert.equal(result.observedConditionClass, 'SITE_REBUILDING'); } });
test('18 rebuilding H1 positive', () => assert.equal(stagePainFirstSuppliedPage(candidate(), observation({ boundedTitle: '', boundedH1: ['Site en cours de refonte'] })).state, 'IDENTITY_EXTRACTED'));
test('19 no notice is terminal NO_PAIN_SIGNAL', () => assert.equal(stagePainFirstSuppliedPage(candidate(), observation({ boundedTitle: 'Café' })).state, 'NO_PAIN_SIGNAL'));
test('20 conflicting notices are terminal PAIN_UNKNOWN', () => assert.equal(stagePainFirstSuppliedPage(candidate(), observation({ boundedH1: ['Site en cours de refonte'] })).state, 'PAIN_UNKNOWN'));

// First-party identity cases 21-26.
test('21 valid exact SIRET extracted', () => { assert.equal(identity.directSiret, '12345678200002');
  assert.equal(extractSuppliedFirstPartyIdentity(ld(operator)).state, 'IDENTITY_STRONG'); });
test('22 valid exact SIREN extracted', () => { const extracted = extractSuppliedFirstPartyIdentity(ld({ ...operator, siret: undefined, siren: '123456782' }));
  assert.equal(extracted.state, 'IDENTITY_STRONG'); assert.equal(extracted.identity?.directSiren, '123456782'); });
test('23 JSON-LD name and address extracted', () => { const extracted = extractSuppliedFirstPartyIdentity(ld({ ...operator, siret: undefined }));
  assert.equal(extracted.identity?.exactOperatorName, 'Café des Alizés'); assert.equal(extracted.identity?.postcode, '97200');
  assert.equal(extracted.identity?.streetNumber, '12'); });
test('24 unrelated JSON-LD publisher ignored', () => { const extracted = extractSuppliedFirstPartyIdentity(ld({ '@type': 'WebPage',
  publisher: operator })); assert.equal(extracted.state, 'IDENTITY_ABSENT'); });
test('25 conflicting operators are conflict', () => { const extracted = extractSuppliedFirstPartyIdentity(ld({ '@graph': [operator,
  { ...operator, name: 'Autre Entreprise' }] })); assert.equal(extracted.state, 'IDENTITY_CONFLICT'); });
test('26 absent identity stays absent', () => assert.equal(extractSuppliedFirstPartyIdentity('<html><body>Bienvenue</body></html>').state, 'IDENTITY_ABSENT'));

// Registry cases 27-32.
test('27 direct SIRET needs registry unique match', () => { assert.equal(request.lookupMode, 'SIRET');
  assert.equal(validRegistryReconciliationRequest(request), true); assert.equal(readyForProspectCreation(request, unique, proof.factualOperatorName), true); });
test('28 direct SIREN needs a unique local establishment', () => { const extracted = extractSuppliedFirstPartyIdentity(ld({ ...operator, siret: undefined, siren: '123456782' }));
  const direct = registryRequestFromIdentity('offline-1', request.requestedAt, extracted.identity!)!;
  assert.equal(direct.lookupMode, 'SIREN');
  const match = { ...unique, exactMatchProvenance: { lookupMode: 'SIREN' as const } };
  assert.equal(readyForProspectCreation(direct, match, proof.factualOperatorName), true);
  assert.equal(readyForProspectCreation(direct, { ...match, canonicalSiret: undefined }, proof.factualOperatorName), false); });
test('29 exact name/address request needs unique match', () => { const extracted = extractSuppliedFirstPartyIdentity(ld({ ...operator, siret: undefined }));
  const factual = registryRequestFromIdentity('offline-1', request.requestedAt, extracted.identity!)!;
  assert.equal(factual.lookupMode, 'NAME_ADDRESS');
  assert.equal(readyForProspectCreation(factual, { ...unique, exactMatchProvenance: { lookupMode: 'NAME_ADDRESS' } }, proof.factualOperatorName), true); });
test('30 zero match blocks readiness', () => assert.equal(readyForProspectCreation(request,
  { schemaVersion: 1, candidateId: 'offline-1', completedAt: unique.completedAt, state: 'ZERO_MATCH', matchCount: 0 }, proof.factualOperatorName), false));
test('31 multiple matches block readiness', () => assert.equal(readyForProspectCreation(request,
  { schemaVersion: 1, candidateId: 'offline-1', completedAt: unique.completedAt, state: 'MULTIPLE_MATCHES', matchCount: 2 }, proof.factualOperatorName), false));
test('32 provider failure blocks readiness', () => assert.equal(readyForProspectCreation(request,
  { schemaVersion: 1, candidateId: 'offline-1', completedAt: unique.completedAt, state: 'PROVIDER_FAILURE', failureCode: 'OFFLINE' }, proof.factualOperatorName), false));

// State cases 33-37.
test('33 full offline path reaches readiness only with proof', () => { let state = painFirstTransition('SEARCH_CANDIDATE', 'URL_ACCEPTED');
  state = painFirstTransition(state, 'PAGE_OBSERVED'); state = painFirstTransition(state, 'PAIN_SIGNAL_CONFIRMED', painProof());
  state = painFirstTransition(state, 'IDENTITY_EXTRACTED', identityProof()); state = painFirstTransition(state, 'REGISTRY_RECONCILED', proof);
  assert.equal(painFirstTransition(state, 'READY_FOR_PROSPECT_CREATION', proof), 'READY_FOR_PROSPECT_CREATION'); });
test('34 NO_PAIN_SIGNAL never reaches identity extraction', () => assert.throws(() => painFirstTransition('NO_PAIN_SIGNAL', 'IDENTITY_EXTRACTED')));
test('35 identity failure never reaches readiness', () => assert.throws(() => painFirstTransition('IDENTITY_PARTIAL', 'READY_FOR_PROSPECT_CREATION')));
test('36 multiple registry match never reaches readiness', () => assert.throws(() => painFirstTransition('REGISTRY_MULTIPLE_MATCHES', 'READY_FOR_PROSPECT_CREATION')));
test('37 existing prospect does not reach readiness', () => { const existing = { ...proof, existingProspect: true };
  assert.throws(() => painFirstTransition('REGISTRY_RECONCILED', 'READY_FOR_PROSPECT_CREATION', existing));
  assert.equal(painFirstTransition('REGISTRY_RECONCILED', 'EXISTING_PROSPECT', existing), 'EXISTING_PROSPECT'); });

// Authority cases 38-41.
test('38 no DigitalPainObservation is produced', () => { const result = stagePainFirstSuppliedPage(candidate(), observation());
  assert.equal('observations' in result, false); assert.equal('snapshotDigest' in result, false); });
test('39 no VERIFIED website authority is produced', () => { const result = stagePainFirstSuppliedPage(candidate(), observation());
  assert.equal(result.authority, 'NON_AUTHORITATIVE'); assert.equal('websiteStatus' in result, false); });
test('40 no research.scored is produced', () => assert.equal('research' in stagePainFirstSuppliedPage(candidate(), observation()), false));
test('41 no admission authority is produced', () => assert.equal('admission' in stagePainFirstSuppliedPage(candidate(), observation()), false));

test('matcher coverage stays unchanged and no new synonym matches', () => {
  assert.equal(noticeType('site en construction'), 'UNDER_CONSTRUCTION');
  assert.equal(noticeType('site en cours de refonte'), 'REBUILDING');
  for (const phrase of ['maintenance', 'coming soon', 'unavailable', 'redesign', 'site en refonte'])
    assert.equal(noticeType(phrase), undefined);
});
test('URL normalization is bounded to existing canon', () => {
  assert.deepEqual(acceptPainFirstSearchCandidate(candidate({ resultUrl: 'https://cafe-alizes.fr/#contact' })),
    { state: 'URL_ACCEPTED', homepageUrl: 'https://cafe-alizes.fr/' });
  for (const resultUrl of ['https://cafe-alizes.fr/menu', 'https://cafe-alizes.fr/?q=site', 'https://cafe-alizes.fr/fr/'])
    assert.equal(acceptPainFirstSearchCandidate(candidate({ resultUrl })).state, 'URL_REJECTED');
});
test('unusable registry request and false readiness fail closed', () => {
  assert.equal(validRegistryReconciliationRequest({ schemaVersion: 1, source: 'PAIN_FIRST',
    candidateId: 'offline-1', requestedAt: request.requestedAt, lookupMode: 'SIRET', directSiret: '123' }), false);
  assert.equal(readyForProspectCreation(request, { ...unique, postcode: '75001' }, proof.factualOperatorName), false);
  assert.throws(() => painFirstTransition('REGISTRY_RECONCILED', 'READY_FOR_PROSPECT_CREATION'));
});
test('request budget and search metadata bounds', () => {
  assert.deepEqual([MAX_SEARCH_REQUESTS_PER_CYCLE, MAX_RESULTS_PER_QUERY, MAX_HOMEPAGE_FETCHES_PER_QUERY,
    MAX_REGISTRY_REQUESTS_PER_CANDIDATE, RETRIES], [2, 10, 3, 1, 0]);
  assert.equal(acceptPainFirstSearchCandidate(candidate({ resultPosition: 11 })).state, 'URL_REJECTED');
  assert.equal(acceptPainFirstSearchCandidate(candidate({ resultTitle: 'a'.repeat(201) })).state, 'URL_REJECTED');
});

// R55B: canonical URL authority, then evidence-bound transitions only.
test('R55B provider and search roots are excluded by the canonical classifier', () => {
  for (const [resultUrl, sourceType] of [['https://api.tavily.com/', 'SEARCH_PROVIDER'],
    ['https://www.google.com/', 'SEARCH_ENGINE']] as const) {
    assert.equal(classifySourceType(resultUrl), sourceType);
    assert.equal(acceptPainFirstSearchCandidate(candidate({ resultUrl })).state, 'URL_REJECTED');
  }
});

test('R55B ordinary and deceptive hostname roots remain eligible', () => {
  for (const host of ['cafe-alizes.fr', 'api.tavily.com.example.fr', 'www.google.com.example.fr',
    'cafe-api.tavily.com', 'cafe-www.google.com', 'sub.api.tavily.com', 'sub.www.google.com']) {
    assert.equal(classifySourceType(`https://${host}/`), 'OTHER_PUBLIC_SOURCE');
    assert.equal(acceptPainFirstSearchCandidate(candidate({ resultUrl: `https://${host}/` })).state, 'URL_ACCEPTED');
  }
});

test('R55B all currently canonical social classes are excluded', () => {
  for (const host of ['instagram.com', 'facebook.com', 'tiktok.com', 'wa.me', 'whatsapp.com'])
    assert.equal(acceptPainFirstSearchCandidate(candidate({ resultUrl: `https://${host}/` })).state, 'URL_REJECTED');
});

test('R55B URL filter reuses canonical helpers without a parallel host taxonomy', () => {
  const source = readFileSync(new URL('../research/pain-first-staging.ts', import.meta.url), 'utf8');
  for (const helper of ['publicHttpUrl', 'normalizeCandidateUrl', 'classifySourceType'])
    assert.match(source, new RegExp(`${helper}\\(candidate.resultUrl\\)|${helper}\\(normalized\\)`));
  assert.doesNotMatch(source, /api\.tavily\.com|www\.google\.com|google\.fr|googleusercontent\.com|webcache|CACHE_PAGE/);
});

for (const title of ['Site en construction', 'Site en cours de refonte'])
  test(`R55B actual R42 result advances: ${title}`, () => {
    const evidence = painProof(title);
    assert.equal(evidence.preflight.state, 'LIKELY_CANONICAL_PAIN');
    assert.equal(painFirstTransition('PAGE_OBSERVED', 'PAIN_SIGNAL_CONFIRMED', evidence), 'PAIN_SIGNAL_CONFIRMED');
  });

for (const [title, h1, terminal] of [['Café des Alizés', undefined, 'NO_PAIN_SIGNAL'],
  ['', undefined, 'PAIN_UNKNOWN'], ['Site en construction', ['Site en cours de refonte'], 'PAIN_UNKNOWN']] as const)
  test(`R55B actual R42 non-positive result terminates: ${terminal} ${title}`, () => {
    const evidence = painProof(title, h1);
    assert.equal(painFirstTransition('PAGE_OBSERVED', terminal, evidence), terminal);
    assert.throws(() => painFirstTransition('PAGE_OBSERVED', 'PAIN_SIGNAL_CONFIRMED', evidence), /R42_RESULT_MISMATCH/);
    assert.throws(() => painFirstTransition(terminal, 'PAIN_SIGNAL_CONFIRMED', evidence), /ILLEGAL_TRANSITION/);
  });

test('R55B forged pain advancement and unsupported observed condition fail', () => {
  assert.throws(() => painFirstTransition('PAGE_OBSERVED', 'PAIN_SIGNAL_CONFIRMED'), /R42_PROOF_REQUIRED/);
  assert.throws(() => painFirstTransition('PAGE_OBSERVED', 'PAIN_SIGNAL_CONFIRMED', proof), /R42_PROOF_REQUIRED/);
  const forged = { preflight: { ...painProof().preflight, condition: 'CACHE_PAGE' } } as unknown as PainFirstTransitionProof;
  assert.throws(() => painFirstTransition('PAGE_OBSERVED', 'PAIN_SIGNAL_CONFIRMED', forged), /R42_RESULT_MISMATCH/);
});

test('R55B actual strong identity advances', () => {
  const evidence = identityProof();
  assert.equal(evidence.identity.state, 'IDENTITY_STRONG');
  assert.equal(painFirstTransition('PAIN_SIGNAL_CONFIRMED', 'IDENTITY_EXTRACTED', evidence), 'IDENTITY_EXTRACTED');
});

for (const [html, terminal] of [[ld({ '@type': 'CafeOrCoffeeShop', name: 'Café des Alizés' }), 'IDENTITY_PARTIAL'],
  [ld({ '@graph': [operator, { ...operator, name: 'Autre Entreprise' }] }), 'IDENTITY_CONFLICT'],
  ['<html><body>Bienvenue</body></html>', 'IDENTITY_ABSENT']] as const)
  test(`R55B actual identity result terminates: ${terminal}`, () => {
    const evidence = identityProof(html);
    assert.equal(evidence.identity.state, terminal);
    assert.equal(painFirstTransition('PAIN_SIGNAL_CONFIRMED', terminal, evidence), terminal);
    assert.equal(stagePainFirstSuppliedPage(candidate(), observation({ suppliedHtml: html })).state, terminal);
    assert.throws(() => painFirstTransition('PAIN_SIGNAL_CONFIRMED', 'IDENTITY_EXTRACTED', evidence), /IDENTITY_RESULT_MISMATCH/);
    assert.throws(() => painFirstTransition(terminal, 'REGISTRY_RECONCILED', proof), /ILLEGAL_TRANSITION/);
  });

test('R55B forged identity advancement fails', () => {
  assert.throws(() => painFirstTransition('PAIN_SIGNAL_CONFIRMED', 'IDENTITY_EXTRACTED'), /IDENTITY_PROOF_REQUIRED/);
  assert.throws(() => painFirstTransition('PAIN_SIGNAL_CONFIRMED', 'IDENTITY_EXTRACTED', painProof()), /IDENTITY_PROOF_REQUIRED/);
  assert.throws(() => painFirstTransition('PAIN_SIGNAL_CONFIRMED', 'IDENTITY_EXTRACTED',
    { identity: { state: 'IDENTITY_STRONG' } }), /IDENTITY_PROOF_REQUIRED/);
});

for (const [result, terminal] of [
  [unique, 'REGISTRY_RECONCILED'],
  [{ schemaVersion: 1, candidateId: request.candidateId, completedAt: unique.completedAt, state: 'ZERO_MATCH', matchCount: 0 }, 'REGISTRY_ZERO_MATCH'],
  [{ schemaVersion: 1, candidateId: request.candidateId, completedAt: unique.completedAt, state: 'MULTIPLE_MATCHES', matchCount: 2 }, 'REGISTRY_MULTIPLE_MATCHES'],
  [{ schemaVersion: 1, candidateId: request.candidateId, completedAt: unique.completedAt, state: 'PROVIDER_FAILURE', failureCode: 'OFFLINE' }, 'REGISTRY_FAILURE'],
] satisfies [RegistryIdentityReconciliationResult, PainFirstStagingState][])
  test(`R55B typed registry result maps exactly: ${result.state}`, () => {
    const evidence = { ...proof, result };
    assert.equal(painFirstTransition('IDENTITY_EXTRACTED', terminal, evidence), terminal);
    if (terminal !== 'REGISTRY_RECONCILED') {
      assert.throws(() => painFirstTransition('IDENTITY_EXTRACTED', 'REGISTRY_RECONCILED', evidence), /REGISTRY_RESULT_MISMATCH/);
      assert.throws(() => painFirstTransition(terminal, 'READY_FOR_PROSPECT_CREATION', evidence), /ILLEGAL_TRANSITION/);
    }
  });

test('R55B forged registry advancement and wrong-candidate evidence fail', () => {
  assert.throws(() => painFirstTransition('IDENTITY_EXTRACTED', 'REGISTRY_RECONCILED'), /REGISTRY_PROOF_REQUIRED/);
  assert.throws(() => painFirstTransition('IDENTITY_EXTRACTED', 'REGISTRY_RECONCILED', identityProof()), /REGISTRY_PROOF_REQUIRED/);
  assert.throws(() => painFirstTransition('IDENTITY_EXTRACTED', 'REGISTRY_RECONCILED',
    { ...proof, result: { ...unique, candidateId: 'other-candidate' } }), /REGISTRY_PROOF_REQUIRED/);
});

for (const [field, value] of [['canonicalSiren', ''], ['canonicalEstablishmentIdentity', ''],
  ['municipality', ''], ['postcode', '75001'], ['canonicalSiret', undefined], ['canonicalEnterpriseName', '']] as const)
  test(`R55B readiness fails without complete canonical evidence: ${field}`, () => {
    const evidence = { ...proof, result: { ...unique, [field]: value } };
    assert.equal(readyForProspectCreation(request, evidence.result, proof.factualOperatorName), false);
    assert.throws(() => painFirstTransition('REGISTRY_RECONCILED', 'READY_FOR_PROSPECT_CREATION', evidence), /REGISTRY_PROOF_REQUIRED/);
  });

test('R55B readiness requires factual name and explicit existing-prospect check', () => {
  assert.throws(() => painFirstTransition('REGISTRY_RECONCILED', 'READY_FOR_PROSPECT_CREATION',
    { ...proof, factualOperatorName: '' }), /REGISTRY_PROOF_REQUIRED/);
  const { existingProspect: _existingProspect, ...unchecked } = proof;
  assert.throws(() => painFirstTransition('REGISTRY_RECONCILED', 'READY_FOR_PROSPECT_CREATION',
    unchecked as PainFirstTransitionProof), /REGISTRY_PROOF_REQUIRED/);
  assert.throws(() => painFirstTransition('REGISTRY_RECONCILED', 'EXISTING_PROSPECT', proof), /REGISTRY_PROOF_REQUIRED/);
});

test('R55B forged READY cannot use pain or identity evidence', () => {
  for (const evidence of [undefined, painProof(), identityProof()])
    assert.throws(() => painFirstTransition('REGISTRY_RECONCILED', 'READY_FOR_PROSPECT_CREATION', evidence), /REGISTRY_PROOF_REQUIRED/);
});

test('R55B every forward state-skipping positive transition fails despite supplied evidence', () => {
  const path: PainFirstStagingState[] = ['SEARCH_CANDIDATE', 'URL_ACCEPTED', 'PAGE_OBSERVED',
    'PAIN_SIGNAL_CONFIRMED', 'IDENTITY_EXTRACTED', 'REGISTRY_RECONCILED', 'READY_FOR_PROSPECT_CREATION'];
  for (let from = 0; from < path.length; from++)
    for (let to = from + 2; to < path.length; to++)
      for (const evidence of [undefined, painProof(), identityProof(), proof])
        assert.throws(() => painFirstTransition(path[from], path[to], evidence), /ILLEGAL_TRANSITION/);
});
