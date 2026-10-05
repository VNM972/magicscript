import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { checkServerIdentity } from 'node:tls';
import { readFileSync } from 'node:fs';
import { selectSuppliedIdentityPage, mergeSuppliedIdentityCandidates } from '../research/pain-first-identity-enrichment';
import { extractSuppliedFirstPartyIdentity } from '../research/website-seed';
import { acceptPainFirstSearchCandidate, painFirstQueryPlans } from '../research/pain-first-staging';
import { createPainFirstOfflineHomepageInspector, createPainFirstOfflineIdentityEnricher,
  createPainFirstLiveIdentityEnricher, PAIN_FIRST_MAX_BODY_BYTES } from '../research/pain-first-homepage-transport';
import type { PainFirstHomepageInspection } from '../research/pain-first-homepage-transport';

const origin = 'https://fixture.invalid/';
const link = (href: string, label = 'Mentions légales') => `<a href="${href}">${label}</a>`;
const legal = link('/legal');
const json = (facts: Record<string, unknown>) => '<script type="application/ld+json">' +
  JSON.stringify({ '@type': 'Organization', ...facts }).replace(/</g, '\\u003c') + '</script>';
const partial = json({ name: 'Café Fixture' });
const accepted = () => {
  const value = acceptPainFirstSearchCandidate({ schemaVersion: 1, queryPlanId: painFirstQueryPlans()[0].planId,
    conditionClass: 'SITE_UNDER_CONSTRUCTION', providerClass: 'MANUAL_OPERATOR', providerRunId: 'r60zb-offline',
    resultPosition: 1, resultUrl: origin, acquiredAt: '2026-10-02T12:00:00.000Z', authority: 'NONE' });
  if (value.state !== 'URL_ACCEPTED') throw new Error('fixture rejected');
  return value;
};
const response = (html: string) => new Response(html, { headers: { 'content-type': 'text/html' } });
async function fixture(homepage = partial + legal) {
  const capability = accepted();
  const inspection = await createPainFirstOfflineHomepageInspector(async () =>
    response('<title>Site en construction</title>' + homepage))(capability);
  return { capability, inspection, initial: extractSuppliedFirstPartyIdentity(homepage) };
}

for (const [label, html, expected] of [
  ['explicit legal', legal, '/legal'],
  ['accent normalized', link('/legal', '  MENTIONS LE\u0301GALES  '), '/legal'],
  ['entity normalized', link('/legal', 'Mentions l&eacute;gales'), '/legal'],
  ['information label', link('/info', 'Informations légales'), '/info'],
  ['English exact label', link('/notice', 'legal notice'), '/notice'],
  ['legal priority', link('/contact', 'Contact') + legal, '/legal'],
  ['contact fallback', link('/contact', 'Contact'), '/contact'],
  ['unrelated ignored', link('/about', 'qui sommes-nous'), null],
  ['no guessed path', '<p>mentions légales</p>', null],
  ['external rejected', link('https://elsewhere.invalid/legal'), null],
  ['credentials rejected', link('https://user:password@fixture.invalid/legal'), null],
  ['mailto rejected', link('mailto:legal@fixture.invalid'), null],
  ['tel rejected', link('tel:0123456789'), null],
  ['javascript rejected', link('javascript:alert(1)'), null],
  ['fragment rejected', link('#legal'), null],
  ['assets rejected', link('/terms.pdf'), null],
  ['AVIF media rejected', link('/terms.avif'), null],
  ['binary download rejected', link('/terms.exe'), null],
  ['download endpoint rejected', link('/download/legal'), null],
  ['download rejected', '<a download href="/legal">Mentions légales</a>', null],
  ['nonstandard port rejected', link('https://fixture.invalid:8443/legal'), null],
  ['standard port allowed', link('https://fixture.invalid:443/legal'), '/legal'],
  ['scheme change rejected', link('http://fixture.invalid/legal'), null],
  ['ambiguous legal', legal + link('/other'), 'AMBIGUOUS_LINK'],
  ['ambiguous contact', link('/contact', 'contact') + link('/contact2', 'contact'), 'AMBIGUOUS_LINK'],
  ['deduplicate fragments', legal + link('/legal#business'), '/legal'],
  ['no contact after ineligible legal', link('https://elsewhere.invalid/legal') + link('/contact', 'contact'), null],
  ['inert links ignored', '<template>' + legal + '</template><script>' + legal + '</script>', null],
  ['comment ignored', '<!--' + legal + '-->', null],
  ['attribute text ignored', '<div title=\'' + legal + '\'></div>', null],
  ['base fails closed', '<base href="https://elsewhere.invalid/">' + legal, null],
  ['punctuation not exact', link('/legal', 'mentions !!! legales'), null],
] as const) test(`link: ${label}`, () => {
  const result = selectSuppliedIdentityPage(origin, html);
  assert.deepEqual(result, expected === null ? { state: 'NO_ELIGIBLE_LINK' } :
    expected === 'AMBIGUOUS_LINK' ? { state: expected } : { state: 'SELECTED', url: new URL(expected, origin).href });
});

for (const [name, homepage, expected] of [
  ['PARTIAL', partial + legal, 1], ['ABSENT', legal, 1],
  ['STRONG', json({ name: 'Café Fixture', siren: '123456782' }) + legal, 0],
  ['CONFLICT', json({ name: 'Café Fixture', siren: '000000000' }) + legal, 0],
] as const) test(`gate: IDENTITY_${name}`, async () => {
  const { capability, inspection, initial } = await fixture(homepage);
  let calls = 0;
  const result = await createPainFirstOfflineIdentityEnricher(async () => { calls++; return response(partial); })(capability, inspection, initial);
  assert.equal(calls, expected);
  assert.equal(result.outcome, expected ? 'SUCCESS' : 'NOT_NEEDED');
  assert.equal(result.identityPageTransportClass, expected ? 'SUCCESS' : undefined);
});
for (const state of ['NO_PAIN_SIGNAL', 'PAIN_UNKNOWN', 'FETCH_FAILED'] as const)
  test(`gate: ${state}`, async () => {
    const { capability, inspection, initial } = await fixture();
    const gated: PainFirstHomepageInspection = { ...inspection, staging: { state, authority: 'NON_AUTHORITATIVE' } };
    let calls = 0;
    const result = await createPainFirstOfflineIdentityEnricher(async () => { calls++; throw new Error('must not fetch'); })(capability, gated, initial);
    assert.equal(result.outcome, 'NOT_NEEDED'); assert.equal(calls, 0);
  });
test('gate: failed transport, missing HTML, missing link and ambiguous link consume no request', async () => {
  for (const condition of ['failed', 'no-html', 'no-link', 'ambiguous']) {
    const { capability, inspection, initial } = await fixture(condition === 'ambiguous' ? partial + legal + link('/other') : partial + legal);
    if (condition === 'failed') inspection.observation.httpResultClass = 'NETWORK_ERROR';
    if (condition === 'no-html') delete inspection.observation.suppliedHtml;
    if (condition === 'no-link') inspection.observation.suppliedHtml = partial;
    let calls = 0;
    const result = await createPainFirstOfflineIdentityEnricher(async () => { calls++; throw new Error('must not fetch'); })(capability, inspection, initial);
    assert.equal(calls, 0);
    assert.equal('identityPageTransportClass' in result, false);
    assert.equal(result.outcome, condition === 'failed' ? 'NOT_NEEDED' : condition === 'ambiguous' ? 'AMBIGUOUS_LINK' : 'NO_ELIGIBLE_LINK');
  }
});

for (const transportClass of ['SUCCESS', 'REDIRECT', 'CLIENT_ERROR', 'SERVER_ERROR',
  'NETWORK_ERROR', 'TIMEOUT', 'UNSUPPORTED'] as const)
  test(`R60ZC2: actual second-page ${transportClass}, unchanged outcome and no extra request or retry`, async () => {
    const capability = accepted();
    const homepage = partial + link('/legal?private=query') + link('/contact', 'contact');
    const calls: [string, RequestInit][] = [];
    const transport = async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      if (calls.length === 1) return response('<title>Site en construction</title>' + homepage);
      assert.equal(calls.length, 2);
      if (transportClass === 'NETWORK_ERROR') throw new Error('PRIVATE_SOCKET_DIAGNOSTIC');
      if (transportClass === 'TIMEOUT') return new Promise<Response>(() => {});
      if (transportClass === 'UNSUPPORTED') return new Response('PRIVATE_BODY', { headers: { 'content-type': 'application/pdf' } });
      if (transportClass !== 'SUCCESS') return new Response('PRIVATE_BODY', {
        status: { REDIRECT: 302, CLIENT_ERROR: 404, SERVER_ERROR: 503 }[transportClass],
        headers: { location: '/other' },
      });
      return response(json({ siret: '12345678200002', description: 'PRIVATE_JSONLD' }) + '<p>PRIVATE_HTML</p>');
    };
    const inspection = await createPainFirstOfflineHomepageInspector(transport)(capability);
    const before = structuredClone(inspection);
    const initial = extractSuppliedFirstPartyIdentity(homepage);
    const enrich = createPainFirstOfflineIdentityEnricher(transport, { timeoutMs: 15 });
    const result = await enrich(capability, inspection, initial);
    assert.equal(result.identityPageTransportClass, transportClass);
    assert.equal(result.outcome, transportClass === 'SUCCESS' ? 'SUCCESS' : 'FETCH_FAILED');
    assert.equal(result.identityPage, '/legal');
    assert.deepEqual(result.finalIdentity, transportClass === 'SUCCESS'
      ? mergeSuppliedIdentityCandidates(initial, extractSuppliedFirstPartyIdentity(json({ siret: '12345678200002' }))) : initial);
    assert.deepEqual(inspection, before);
    assert.deepEqual(Object.keys(result).sort(), ['finalIdentity', 'identityPage', 'identityPageTransportClass', 'outcome']);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|suppliedHtml|application\/ld\+json|httpStatus|statusCode|dns|selectedIp|socket|proxy|stack|TLS/);
    assert.deepEqual(calls.map(([url, init]) => [url, init.method, init.redirect, init.credentials]),
      [[origin, 'GET', 'manual', 'omit'], ['https://fixture.invalid/legal?private=query', 'GET', 'manual', 'omit']]);
    await assert.rejects(enrich(capability, inspection, initial), /BUDGET_EXHAUSTED/);
    await assert.rejects(createPainFirstOfflineIdentityEnricher(transport)(capability, inspection, initial), /BUDGET_EXHAUSTED/);
    assert.equal(calls.length, 2);
  });

test('transport: exactly one extra GET, bounded path projection and consumed capability across instances', async () => {
  const { capability, inspection, initial } = await fixture(partial + link('/legal?private=query#business'));
  const calls: [string, RequestInit][] = [];
  const transport = async (url: string, init: RequestInit) => { calls.push([url, init]); return response(json({ siret: '12345678200002' })); };
  const enrich = createPainFirstOfflineIdentityEnricher(transport);
  const result = await enrich(capability, inspection, initial);
  assert.equal(result.outcome, 'SUCCESS'); assert.equal(result.identityPage, '/legal');
  assert.equal(result.finalIdentity.identity?.directSiret, '12345678200002');
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'https://fixture.invalid/legal?private=query');
  assert.equal(calls[0][1].method, 'GET'); assert.equal(calls[0][1].redirect, 'manual'); assert.equal(calls[0][1].credentials, 'omit');
  await assert.rejects(enrich(capability, inspection, initial), /BUDGET_EXHAUSTED/);
  await assert.rejects(createPainFirstOfflineIdentityEnricher(transport)(capability, inspection, initial), /BUDGET_EXHAUSTED/);
  assert.equal(calls.length, 1);
});
for (const name of ['redirect', 'failure', 'MIME', 'oversized', 'download', 'timeout'] as const)
  test(`transport: ${name} stops without retry or fallback`, async () => {
    const { capability, inspection, initial } = await fixture(partial + legal + link('/contact', 'contact'));
    let calls = 0;
    const result = await createPainFirstOfflineIdentityEnricher(async () => {
      calls++;
      if (name === 'failure') throw new Error('network');
      if (name === 'timeout') return new Promise<Response>(() => {});
      if (name === 'redirect') return new Response(null, { status: 302, headers: { location: '/other' } });
      if (name === 'MIME') return new Response(partial, { headers: { 'content-type': 'application/pdf' } });
      if (name === 'download') return new Response(partial, { headers: { 'content-type': 'text/html', 'content-disposition': 'attachment' } });
      return response('x'.repeat(PAIN_FIRST_MAX_BODY_BYTES + 1));
    }, { timeoutMs: 15 })(capability, inspection, initial);
    assert.equal(calls, 1); assert.equal(result.outcome, 'FETCH_FAILED'); assert.deepEqual(result.finalIdentity, initial);
  });

test('transport: R58Z live binding reused with one validated IP, TLS/SNI, empty proxy and no retry', async () => {
  const { capability, inspection, initial } = await fixture();
  let dnsCalls = 0; let requests = 0;
  const result = await createPainFirstLiveIdentityEnricher({
    resolveHost: async (host, options) => { dnsCalls++; assert.equal(host, 'fixture.invalid');
      assert.deepEqual(options, { all: true, verbatim: true }); return [{ address: '93.184.216.34', family: 4 }]; },
    httpsRequest: (options, onResponse) => {
      requests++; assert.equal(options.method, 'GET'); assert.equal(options.path, '/legal');
      assert.equal(options.port, 443); assert.equal(options.servername, 'fixture.invalid');
      assert.equal(options.rejectUnauthorized, true); assert.equal(options.checkServerIdentity, checkServerIdentity);
      assert.equal(options.autoSelectFamily, false); assert.equal(options.family, 4);
      assert.deepEqual((options.agent as any).options.proxyEnv, {});
      (options.lookup as any)('fixture.invalid', {}, (error: unknown, address: string, family: number) => {
        assert.equal(error, null); assert.equal(address, '93.184.216.34'); assert.equal(family, 4);
      });
      const handle = new EventEmitter() as ClientRequest;
      handle.end = (() => { const message = Readable.from([Buffer.from(json({ siren: '123456782' }))]) as IncomingMessage;
        message.statusCode = 200; message.headers = { 'content-type': 'text/html' }; onResponse(message); handle.emit('close'); return handle; }) as ClientRequest['end'];
      return handle;
    },
  })(capability, inspection, initial);
  assert.equal(result.outcome, 'SUCCESS'); assert.equal(dnsCalls, 1); assert.equal(requests, 1);
});
test('transport: mixed public/private DNS stops before any socket', async () => {
  const { capability, inspection, initial } = await fixture(); let requests = 0;
  const result = await createPainFirstLiveIdentityEnricher({ resolveHost: async () =>
    [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }],
    httpsRequest: () => { requests++; throw new Error('must not connect'); },
  })(capability, inspection, initial);
  assert.equal(result.outcome, 'FETCH_FAILED'); assert.equal(requests, 0);
});

for (const [name, facts, field, expected] of [
  ['SIRET', { siret: '12345678200002' }, 'directSiret', '12345678200002'],
  ['SIREN', { siren: '123456782' }, 'directSiren', '123456782'],
  ['municipality', { address: { addressLocality: 'Fort-de-France' } }, 'municipality', 'Fort-de-France'],
  ['postcode', { address: { postalCode: '97200' } }, 'postcode', '97200'],
  ['street', { address: { streetAddress: '12 Rue des Hibiscus' } }, 'street', 'Rue des Hibiscus'],
  ['street number', { address: { streetAddress: '12 Rue des Hibiscus' } }, 'streetNumber', '12'],
] as const) test(`merge: fills ${name} through existing extractor`, () => {
  const result = mergeSuppliedIdentityCandidates(extractSuppliedFirstPartyIdentity(partial), extractSuppliedFirstPartyIdentity(json(facts)));
  assert.equal(result.identity?.[field], expected); assert.equal(result.identity?.exactOperatorName, 'Café Fixture');
});
test('merge: identical normalized name reinforces homepage fact', () => {
  const result = mergeSuppliedIdentityCandidates(extractSuppliedFirstPartyIdentity(partial),
    extractSuppliedFirstPartyIdentity(json({ name: 'CAFE FIXTURE', siren: '123456782' })));
  assert.equal(result.state, 'IDENTITY_STRONG'); assert.equal(result.identity?.exactOperatorName, 'Café Fixture');
});
for (const name of ['SIREN', 'operator', 'invalid-registration', 'cross-registration', 'municipality', 'postcode', 'street', 'streetNumber'] as const)
  test(`merge: conflicting ${name} fails closed`, () => {
    const homeFacts = { name: 'Café Fixture', siren: '123456782', address: {
      addressLocality: 'Fort-de-France', postalCode: '97200', streetAddress: '12 Rue des Hibiscus' } };
    const pageFacts = name === 'SIREN' ? { ...homeFacts, siren: '732829320' } :
      name === 'operator' ? { name: 'Other Business' } :
      name === 'invalid-registration' ? { name: 'Café Fixture', siret: '12345678200003' } :
      name === 'cross-registration' ? { siret: '73282932000074' } :
      { address: { [({ municipality: 'addressLocality', postcode: 'postalCode', street: 'streetAddress', streetNumber: 'streetNumber' } as Record<string, string>)[name]]:
        ({ municipality: 'Le Lamentin', postcode: '97232', street: 'Rue Autre', streetNumber: '99' } as Record<string, string>)[name] } };
    const result = mergeSuppliedIdentityCandidates(extractSuppliedFirstPartyIdentity(json(homeFacts)), extractSuppliedFirstPartyIdentity(json(pageFacts)));
    assert.deepEqual(result, { state: 'IDENTITY_CONFLICT' });
  });
for (const [name, facts, expected] of [
  ['name only', {}, 'IDENTITY_PARTIAL'], ['name municipality only', { address: { addressLocality: 'Fort-de-France' } }, 'IDENTITY_PARTIAL'],
  ['name postcode only', { address: { postalCode: '97200' } }, 'IDENTITY_PARTIAL'],
  ['name postcode municipality', { address: { postalCode: '97200', addressLocality: 'Fort-de-France' } }, 'IDENTITY_STRONG'],
  ['name SIREN', { siren: '123456782' }, 'IDENTITY_STRONG'], ['SIRET', { siret: '12345678200002' }, 'IDENTITY_STRONG'],
] as const) test(`R55 classification unchanged: ${name}`, () => {
  const merged = mergeSuppliedIdentityCandidates(extractSuppliedFirstPartyIdentity(partial), extractSuppliedFirstPartyIdentity(json(facts)));
  assert.equal(merged.state, expected);
  assert.deepEqual(merged, extractSuppliedFirstPartyIdentity(json({ name: 'Café Fixture', ...facts })));
});
test('authority: bounded enrichment has no lifecycle/provider/registry dependency or staging on second page', () => {
  const helper = readFileSync(new URL('../research/pain-first-identity-enrichment.ts', import.meta.url), 'utf8');
  const transport = readFileSync(new URL('../research/pain-first-homepage-transport.ts', import.meta.url), 'utf8');
  for (const source of [helper, transport]) assert.doesNotMatch(source,
    /(?:from|import\()\s*['"][^'"]*(?:persistence|providers|admission|outreach|prospect|registry)|\.prepare\(|\.execute\(|research\.scored|DigitalPainObservation|scheduleResearch|VERIFIED/);
  assert.equal(transport.match(/stagePainFirstSuppliedPage\(/g)?.length, 1);
  assert.match(transport, /createPainFirstOfflineIdentityEnricher\(createPainFirstBoundHomepageTransport\(options\), options\)/);
});
