import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { intakeManualPainFirstUrls, preselectPainFirstSearchResults } from './manual-pain-first-intake';
import { acceptPainFirstSearchCandidate, MAX_HOMEPAGE_FETCHES_PER_QUERY, painFirstQueryPlans, painFirstTransition, RETRIES } from './pain-first-staging';
import type { PainFirstSearchCandidate } from './pain-first-staging';

const acquiredAt = '2026-10-01T12:00:00.000Z';
const plans = painFirstQueryPlans();
const intake = (urlsText = 'https://cafe-alizes.fr/', conditionClass = 'SITE_UNDER_CONSTRUCTION') =>
  intakeManualPainFirstUrls([{ conditionClass, urlsText }], acquiredAt);
const first = () => intake().candidates[0];
const source = readFileSync(new URL('./manual-pain-first-intake.ts', import.meta.url), 'utf8');
const onlyCandidateKeys = ['schemaVersion', 'queryPlanId', 'conditionClass', 'providerClass', 'providerRunId',
  'resultUrl', 'resultPosition', 'acquiredAt', 'authority'].sort();

test('01 construction query displayed exactly by the shared plans', () => assert.equal(plans[0].query, 'site en construction Martinique'));
test('02 rebuilding query displayed exactly by the shared plans', () => assert.equal(plans[1].query, 'site en cours de refonte Martinique'));
test('03 valid construction URL creates a bound manual candidate', () => {
  assert.equal(first().conditionClass, 'SITE_UNDER_CONSTRUCTION');
  assert.equal(first().queryPlanId, plans[0].planId);
  assert.equal(first().providerClass, 'MANUAL_OPERATOR');
});
test('04 valid rebuilding URL creates a bound manual candidate', () => {
  const candidate = intake('https://salon-alizes.fr/', 'SITE_REBUILDING').candidates[0];
  assert.equal(candidate.conditionClass, 'SITE_REBUILDING'); assert.equal(candidate.queryPlanId, plans[1].planId);
});
for (const [number, condition] of [['05', 'WRONG_CONDITION'], ['06', 'WEBSITE_VERIFIED_ABSENT'], ['07', 'BROKEN_PRIMARY_ACTION']] as const)
  test(`${number} ${condition} rejected`, () => {
    const result = intake('https://cafe-alizes.fr/', condition);
    assert.equal(result.acceptedCount, 0); assert.equal(result.rejections[0].reason, 'CONDITION_REJECTED');
  });
for (const [number, label, url] of [
  ['08', 'malformed', 'http://['], ['09', 'localhost', 'http://localhost/'],
  ['10', 'private', 'https://192.168.1.2/'], ['11', 'credentials', 'https://user:pass@cafe-alizes.fr/'],
  ['12', 'social', 'https://facebook.com/'], ['13', 'registry', 'https://annuaire-entreprises.data.gouv.fr/'],
] as const) test(`${number} ${label} URL fails individually`, () => {
  const result = intake(`${url}\nhttps://cafe-alizes.fr/`);
  assert.equal(result.rejectedCount, 1); assert.equal(result.rejections[0].reason, 'URL_REJECTED');
  assert.equal(result.acceptedCount, 1); assert.equal(result.candidates[0].resultPosition, 2);
});
test('14 canonical provider and search URLs rejected', () => {
  const result = intake('https://api.tavily.com/\nhttps://www.google.com/');
  assert.equal(result.acceptedCount, 0); assert.equal(result.rejectedCount, 2);
});
test('15 exact normalized URL duplicates removed before staging', () => {
  const result = intake(' HTTPS://CAFE-ALIZES.FR:443/#first \nhttps://cafe-alizes.fr/#second\nhttps://cafe-alizes.fr');
  assert.equal(result.acceptedCount, 1); assert.equal(result.rejectedCount, 2);
  assert.equal(result.candidates[0].resultUrl, 'https://cafe-alizes.fr/');
  assert.ok(result.rejections.every((rejection) => rejection.reason === 'DUPLICATE_URL'));
});
test('16 operator order and submitted positions preserved without ranking', () => {
  const result = intake('https://z-cafe.fr/\nhttp://[\nhttps://a-cafe.fr/\nhttps://m-cafe.fr/');
  assert.deepEqual(result.candidates.map((item) => [item.resultUrl, item.resultPosition]),
    [['https://z-cafe.fr/', 1], ['https://a-cafe.fr/', 3], ['https://m-cafe.fr/', 4]]);
});
test('17 ten inputs per condition enforced independently', () => {
  const result = intakeManualPainFirstUrls(plans.map((plan, index) => ({ conditionClass: plan.conditionClass,
    urlsText: Array.from({ length: 11 }, (_, i) => `https://cafe-${index}-${i}.fr/`).join('\n') })), acquiredAt);
  assert.equal(result.acceptedCount, 20); assert.equal(result.rejectedCount, 2);
  assert.ok(result.rejections.every((item) => item.reason === 'INPUT_LIMIT' && item.resultPosition === 11));
});
test('18 no title required', () => assert.equal('resultTitle' in first(), false));
test('19 no snippet required', () => assert.equal('snippet' in first(), false));
test('20 no external provider metadata required; bookkeeping generated locally', () => {
  assert.deepEqual(Object.keys(first()).sort(), onlyCandidateKeys);
  assert.equal(first().acquiredAt, acquiredAt); assert.equal(first().providerRunId, `manual-operator:${acquiredAt}`);
});
test('21 authority remains NONE', () => assert.equal(first().authority, 'NONE'));
test('22 no DigitalPainObservation created', () => {
  assert.equal('observations' in first(), false); assert.equal('snapshotDigest' in first(), false);
  assert.doesNotMatch(source, /DigitalPainObservation|stagePainFirstSuppliedPage|inspectSuppliedDigitalPainPreflight/);
});
test('23 no VERIFIED website authority created', () => {
  assert.equal('websiteStatus' in first(), false); assert.equal('websiteAuthority' in first(), false);
});
test('24 no research.scored created', () => {
  assert.equal('research' in first(), false); assert.doesNotMatch(source, /research\.scored|RUN_RESEARCH_SWARM/);
});
test('25 no admission authority created', () => {
  assert.equal('admission' in first(), false);
  assert.throws(() => painFirstTransition('SEARCH_CANDIDATE', 'READY_FOR_PROSPECT_CREATION'));
});
test('26 no prospect created', () => {
  assert.equal('prospectId' in first(), false); assert.doesNotMatch(source, /createProspect|ProspectRepository/);
});
test('27 no D1 mutation or network transport', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('NETWORK_FORBIDDEN'); });
  assert.equal(intake().acceptedCount, 1); assert.equal(fetch.mock.callCount(), 0);
  assert.doesNotMatch(source, /\bfetch\s*\(|\bD1\b|\.prepare\s*\(|\.batch\s*\(|node:|providers\//);
});
test('28 accepted candidate consumed unchanged by the existing R55 contract', () => {
  const candidate: PainFirstSearchCandidate = first();
  assert.deepEqual(acceptPainFirstSearchCandidate(candidate), { state: 'URL_ACCEPTED', homepageUrl: candidate.resultUrl });
  assert.equal(painFirstTransition('SEARCH_CANDIDATE', 'URL_ACCEPTED'), 'URL_ACCEPTED');
});
test('R55 canonical filter reused without parallel validation or manual downstream branching', () => {
  assert.match(source, /acceptPainFirstSearchCandidate\(candidate\)/);
  assert.doesNotMatch(source, /new URL\(|classifySourceType\(|publicHttpUrl\(|normalizeCandidateUrl\(/);
  assert.equal(MAX_HOMEPAGE_FETCHES_PER_QUERY, 3); assert.equal(RETRIES, 0);
});
test('rejections and duplicates consume the input budget without fill or replacement', () => {
  const result = intake(['http://[', ...Array(9).fill('https://cafe-alizes.fr/'), 'https://replacement.fr/'].join('\n'));
  assert.equal(result.acceptedCount, 1); assert.equal(result.candidates[0].resultPosition, 2);
  assert.equal(result.rejections.at(-1)?.reason, 'INPUT_LIMIT');
});
test('repeated submission sections cannot bypass the per-condition run limit', () => {
  const result = intakeManualPainFirstUrls(Array.from({ length: 11 }, (_, i) => ({
    conditionClass: 'SITE_UNDER_CONSTRUCTION', urlsText: `https://cafe-${i}.fr/`,
  })), acquiredAt);
  assert.equal(result.acceptedCount, 10); assert.equal(result.rejectedCount, 1);
});
test('duplicates across the two condition windows removed in submission order', () => {
  const result = intakeManualPainFirstUrls(plans.map((plan) => ({ conditionClass: plan.conditionClass,
    urlsText: 'https://cafe-alizes.fr/' })), acquiredAt);
  assert.equal(result.acceptedCount, 1); assert.equal(result.candidates[0].conditionClass, plans[0].conditionClass);
  assert.equal(result.rejections[0].reason, 'DUPLICATE_URL');
});
test('blank lines ignored; CRLF and whitespace normalized', () => {
  const result = intake(' \r\n https://cafe-alizes.fr/ \r\n\r\nhttps://salon-alizes.fr/\r\n');
  assert.deepEqual(result.candidates.map((candidate) => candidate.resultPosition), [1, 2]);
});
test('invalid timestamp fails closed through R55', () => {
  const result = intakeManualPainFirstUrls([{ conditionClass: 'SITE_UNDER_CONSTRUCTION', urlsText: 'https://cafe-alizes.fr/' }], 'invalid');
  assert.equal(result.acceptedCount, 0); assert.equal(result.rejectedCount, 1);
});
test('separate runs retain no candidates or deduplication state', () => {
  assert.deepEqual(intake(), intake()); assert.equal(intakeManualPainFirstUrls([], acquiredAt).acceptedCount, 0);
});

test('R76Z refuses deep-result laundering, stale notices and previously evaluated homepages', () => {
  const hint = (resultUrl: string, noticeText = 'Site en construction') => ({ candidate: { ...first(), resultUrl }, noticeText });
  const result = preselectPainFirstSearchResults([
    hint('https://medi-conciergerie.com/accueil-en-construction/'),
    hint('https://lmcharpente.com/lm-charpente-en-construction/'),
    hint('https://rb-agency.fr/fr/'), hint('https://old-result.fr/', 'Accueil'),
    hint('https://accentimmo.fr/'), hint('https://new-cafe.fr/'),
  ], ['https://accentimmo.fr/']);
  assert.deepEqual(result.candidates.map((c) => c.resultUrl), ['https://new-cafe.fr/']);
  assert.deepEqual(result.rejections.map((r) => r.reason), ['URL_REJECTED', 'URL_REJECTED', 'URL_REJECTED', 'NO_MATCHING_NOTICE_HINT', 'ALREADY_EVALUATED']);
});

test('R76Z identity/locality hints rank only; no hint becomes candidate authority', () => {
  const hint = (resultUrl: string, identityHint = '', localityHint = '') => ({ candidate: { ...first(), resultUrl }, noticeText: 'Site en construction', identityHint, localityHint });
  const result = preselectPainFirstSearchResults([
    hint('https://first.fr/'), hint('https://local.fr/', '', 'Martinique'),
    hint('https://identity.fr/', 'SIRET in search excerpt'), hint('https://both.fr/', 'legal operator', 'Martinique'),
  ], [], 2);
  assert.deepEqual(result.candidates.map((c) => c.resultUrl), ['https://both.fr/', 'https://identity.fr/']);
  assert.equal(result.authority, 'NONE');
  for (const c of result.candidates) assert.deepEqual(Object.keys(c).sort(), onlyCandidateKeys);
  assert.equal(result.rejections.filter((r) => r.reason === 'BATCH_LIMIT').length, 2);
});

test('R76Z retains canonical notice recognition, query limits and stable deduplication', () => {
  const hints = Array.from({ length: 11 }, (_, i) => ({ candidate: { ...first(), resultUrl: `https://cafe-${i}.fr/`, resultPosition: Math.min(i + 1, 10) }, noticeText: 'Site en construction' }));
  const result = preselectPainFirstSearchResults(hints, []);
  assert.equal(result.candidates.length, MAX_HOMEPAGE_FETCHES_PER_QUERY);
  assert.equal(result.rejections.at(0)?.reason, 'INPUT_LIMIT');
  assert.throws(() => preselectPainFirstSearchResults([], [], 6), /INVALID_PRESELECTION_LIMIT/);
  assert.equal(preselectPainFirstSearchResults([{...hints[0],noticeText:'Nouveau site en construction'}], []).candidates.length, 0);
  assert.equal(preselectPainFirstSearchResults([hints[0],hints[0]], []).rejections[0].reason, 'DUPLICATE_URL');
  assert.equal(preselectPainFirstSearchResults([hints[0]], [...Array(12).fill('https://other.fr/'), hints[0].candidate.resultUrl]).candidates.length, 0);
});
