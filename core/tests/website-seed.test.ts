import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { HunterClient, domainFromWebsite, normalizeHunterDomainFinderResponse } from '../providers/hunter';
import { inspectSuppliedWebsiteSeed, validateProviderDomain } from '../research/website-seed';
import type { WebsiteSeedIdentity } from '../research/website-seed';
import { inspectSuppliedDigitalPainPreflight } from '../research/digital-pain-preflight';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/website-seed-r48.json', import.meta.url), 'utf8')) as {
  identity: WebsiteSeedIdentity; providerResponse: unknown; homepageHtml: string;
};
const candidate = normalizeHunterDomainFinderResponse(fixture.providerResponse, 1);
const ld = (value: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(value)}</script></head><body></body></html>`;
const address = { '@type': 'PostalAddress', addressLocality: 'Fort-de-France', postalCode: '97200',
  streetAddress: '12 Rue des Hibiscus' };
const operator = { '@type': 'CafeOrCoffeeShop', name: 'Café des Alizés', address };
const inspect = (homepageHtml: string, identity: WebsiteSeedIdentity = fixture.identity) =>
  inspectSuppliedWebsiteSeed({ identity, providerResult: candidate, homepageHtml });

test('Domain Finder sends one GET with factual company, limit=1 and no email endpoint', async () => {
  const calls: URL[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url);
    assert.equal(init?.method, 'GET'); assert.equal(init?.redirect, 'error');
    return new Response(JSON.stringify(fixture.providerResponse), { status: 200 });
  };
  const client = new HunterClient('synthetic-key', 'https://api.hunter.io/v2', transport);
  const result = await client.domainFinder({ company: 'Café des Alizés' });
  assert.equal(result.state, 'CANDIDATE_DOMAIN'); assert.equal(result.requestCount, 1);
  if (result.state === 'CANDIDATE_DOMAIN') {
    assert.equal(result.domain, 'cafe-des-alizes.fr');
    assert.equal(result.candidateUrl, 'https://cafe-des-alizes.fr/');
  }
  assert.equal(result.authority, 'NON_AUTHORITATIVE'); assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, '/v2/domain-finder');
  assert.equal(calls[0].searchParams.get('company'), 'Café des Alizés');
  assert.equal(calls[0].searchParams.get('limit'), '1');
  assert.equal(calls[0].searchParams.get('api_key'), 'synthetic-key');
  assert.equal(calls[0].searchParams.size, 3);
  assert.doesNotMatch(calls[0].pathname, /email|domain-search/);
});

test('Domain Finder response shapes fail closed without deriving from other provider fields', () => {
  for (const [body, state] of [
    [{ data: [] }, 'PROVIDER_NO_RESULT'],
    [{ data: { domain: 'brand.fr' } }, 'PROVIDER_FAILURE'],
    [{ data: [{ company: 'Brand', email: 'a@brand.fr' }] }, 'PROVIDER_FAILURE'],
    [{ data: [{ domain: 'brand.fr' }], errors: [{ details: 'failure' }] }, 'PROVIDER_FAILURE'],
    [{ data: [{ domain: 'brand.fr' }, { domain: 'different.fr' }] }, 'AMBIGUOUS_PROVIDER_RESULT'],
    [{ data: [{ domain: 'BRAND.fr' }, { domain: 'brand.fr' }] }, 'CANDIDATE_DOMAIN'],
    [{ data: [{ domain: 'Bücher.fr' }, { domain: 'xn--bcher-kva.fr' }] }, 'CANDIDATE_DOMAIN'],
    [{ data: [{ domain: 'https://brand.fr/' }] }, 'INVALID_PROVIDER_DOMAIN'],
  ] as const) assert.equal(normalizeHunterDomainFinderResponse(body).state, state);
});

test('HTTP, parse, transport failure never retry or fall back', async () => {
  for (const transportResult of [
    () => new Response('failure', { status: 429 }),
    () => new Response('not JSON', { status: 200 }),
    () => { throw new Error('synthetic transport failure'); },
  ]) {
    const calls: string[] = [];
    const transport: typeof fetch = async (input) => { calls.push(String(input)); return transportResult(); };
    const result = await new HunterClient('synthetic-key', 'https://api.hunter.io/v2', transport)
      .domainFinder({ company: 'Café des Alizés' });
    assert.equal(result.state, 'PROVIDER_FAILURE'); assert.equal(result.requestCount, 1);
    assert.equal(calls.length, 1); assert.equal(new URL(calls[0]).pathname, '/v2/domain-finder');
  }
  let calls = 0;
  const result = await new HunterClient('synthetic-key', 'https://api.hunter.io/v2', async () => {
    calls++; throw new Error('must not call');
  }).domainFinder({ company: ' ' });
  assert.equal(result.state, 'PROVIDER_FAILURE'); assert.equal(result.requestCount, 0); assert.equal(calls, 0);
});

test('public domain syntax and canonical social, registry, directory exclusions', () => {
  assert.equal(validateProviderDomain('Bücher.fr'), 'xn--bcher-kva.fr');
  assert.equal(validateProviderDomain('www.Exemple.fr'), 'www.exemple.fr');
  for (const value of ['', 'localhost', 'foo.local', '127.0.0.1', '10.0.0.1', '192.168.0.1',
    '172.16.0.1', '169.254.1.1', '0x7f000001', 'foo@bar.fr', 'bar.fr/path', 'bar.fr?q=1',
    'bar.fr#x', 'http://bar.fr', 'https://bar.fr', 'ftp://bar.fr', 'xn--.fr', 'a..fr',
    'facebook.com', 'instagram.com', 'pagesjaunes.fr', 'pappers.fr',
    'annuaire-entreprises.data.gouv.fr', 'booking.com']) {
    assert.equal(validateProviderDomain(value), null, value);
    assert.equal(normalizeHunterDomainFinderResponse({ data: [{ domain: value }] }).state,
      'INVALID_PROVIDER_DOMAIN', value);
  }
});

test('existing Hunter website-domain helper retains its prior normalization', () => {
  assert.equal(domainFromWebsite('https://www.Exemple.fr/contact'), 'exemple.fr');
  assert.equal(domainFromWebsite('www.Exemple.fr'), 'exemple.fr');
  assert.equal(domainFromWebsite(''), undefined);
});

test('SIRET_EXACT_NAME qualifies only an offline non-authoritative seed', () => {
  const result = inspect(fixture.homepageHtml);
  assert.equal(result.state, 'ACCEPTED_SEED'); assert.equal(result.authority, 'NON_AUTHORITATIVE');
  if (result.state !== 'ACCEPTED_SEED') return;
  assert.equal(result.matchMethod, 'SIRET_EXACT_NAME');
  assert.deepEqual(result.matchedFields, ['siret', 'name']);
  assert.equal(result.providerLookupState, 'CANDIDATE_DOMAIN');
  assert.deepEqual(Object.keys(result).sort(), ['authority', 'candidateIdentityKey', 'candidateUrl',
    'domain', 'inspection', 'matchMethod', 'matchedFields', 'provider', 'providerLookupState', 'state']);
  assert.equal('observations' in result, false); assert.equal('status' in result, false);
});

test('SIREN_EXACT_LOCAL_IDENTITY qualifies only exact local fields', () => {
  const result = inspect(ld({ ...operator, siren: fixture.identity.siren }));
  assert.equal(result.state, 'ACCEPTED_SEED');
  if (result.state === 'ACCEPTED_SEED') assert.equal(result.matchMethod, 'SIREN_EXACT_LOCAL_IDENTITY');
});

test('NAME_FULL_ADDRESS_EXACT requires no first-party registration number', () => {
  const result = inspect(ld(operator));
  assert.equal(result.state, 'ACCEPTED_SEED');
  if (result.state === 'ACCEPTED_SEED') assert.equal(result.matchMethod, 'NAME_FULL_ADDRESS_EXACT');
});

test('plain labeled footer can carry one operator identity', () => {
  const html = `<html><body><footer><p>Entreprise: Café des Alizés</p><p>SIRET: 12345678200002</p></footer></body></html>`;
  assert.equal(inspect(html).state, 'ACCEPTED_SEED');
});

test('name alone, name plus municipality, domain only, and title alone are insufficient', () => {
  for (const html of [ld({ '@type': 'Organization', name: 'Café des Alizés' }),
    ld({ '@type': 'Restaurant', name: 'Café des Alizés', address: { addressLocality: 'Fort-de-France' } }),
    '<html><head><title>Café des Alizés</title></head><body></body></html>',
    '<html><body><a href="https://cafe-des-alizes.fr/">Café des Alizés</a></body></html>']) {
    assert.equal(inspect(html).state, 'FIRST_PARTY_IDENTITY_INSUFFICIENT');
  }
});

test('wrong SIRET and wrong SIREN are explicit conflicts even beside partial matches', () => {
  for (const html of [
    ld({ ...operator, siret: '12345678200003' }),
    ld({ ...operator, siren: '123456783' }),
    ld({ ...operator, siret: fixture.identity.siret, siren: '123456783' }),
  ]) assert.equal(inspect(html).state, 'FIRST_PARTY_IDENTITY_CONFLICT');
});

test('one matching name cannot hide a contradictory operator name in the same block', () => {
  assert.equal(inspect(ld({ ...operator, legalName: 'Autre Société', siret: fixture.identity.siret })).state,
    'FIRST_PARTY_IDENTITY_CONFLICT');
});

test('conflicting postcode or street in operator block beats matching SIRET', () => {
  for (const field of [{ postalCode: '97201' }, { streetAddress: '14 Rue des Hibiscus' },
    { streetAddress: '12 Rue des Palmiers' }]) {
    assert.equal(inspect(ld({ ...operator, siret: fixture.identity.siret,
      address: { ...address, ...field } })).state, 'FIRST_PARTY_IDENTITY_CONFLICT');
  }
});

test('missing postcode and missing required street number stay insufficient', () => {
  const { postalCode: _postcode, ...noPostcode } = address;
  assert.equal(inspect(ld({ ...operator, siren: fixture.identity.siren, address: noPostcode })).state,
    'FIRST_PARTY_IDENTITY_INSUFFICIENT');
  assert.equal(inspect(ld({ ...operator, address: { ...address, streetAddress: 'Rue des Hibiscus' } })).state,
    'FIRST_PARTY_IDENTITY_INSUFFICIENT');
});

test('unrelated organization cannot supply missing facts to operator', () => {
  const html = ld({ '@graph': [
    { '@type': 'Organization', name: 'Unrelated Business', address },
    { '@type': 'Restaurant', name: 'Café des Alizés' },
  ] });
  assert.equal(inspect(html).state, 'FIRST_PARTY_IDENTITY_INSUFFICIENT');
});

test('agency credit, testimonial and widget cannot become operator identity', () => {
  for (const html of [
    `<html><body><footer><div class="agency-credit"><p>Entreprise: Café des Alizés</p><p>SIRET: 12345678200002</p></div></footer></body></html>`,
    `<html><body><blockquote>Entreprise: Café des Alizés; SIRET: 12345678200002</blockquote></body></html>`,
    `<html><body><div class="third-party-widget"><p>Entreprise: Café des Alizés</p><p>SIRET: 12345678200002</p></div></body></html>`,
  ]) assert.equal(inspect(html).state, 'FIRST_PARTY_IDENTITY_INSUFFICIENT');
});

test('multiple plausible operator blocks do not combine or select heuristically', () => {
  const html = ld({ '@graph': [
    { ...operator, siren: fixture.identity.siren },
    { '@type': 'Organization', name: 'Café des Alizés' },
  ] });
  assert.equal(inspect(html).state, 'FIRST_PARTY_IDENTITY_INSUFFICIENT');
  assert.equal(inspect(ld({ ...operator, name: 'Café des Alizé' })).state,
    'FIRST_PARTY_IDENTITY_INSUFFICIENT');
});

test('offline composition reuses supplied title/H1 for R42 with zero network/DNS/model calls', (t) => {
  const forbidden = () => { throw new Error('offline test must not use transport'); };
  const spies = [t.mock.method(globalThis, 'fetch', forbidden),
    t.mock.method(http, 'get', forbidden), t.mock.method(http, 'request', forbidden),
    t.mock.method(https, 'get', forbidden), t.mock.method(https, 'request', forbidden),
    t.mock.method(dns, 'lookup', forbidden), t.mock.method(dns, 'resolve', forbidden),
    t.mock.method(dns.promises, 'lookup', forbidden), t.mock.method(dns.promises, 'resolve', forbidden)];
  const result = inspect(fixture.homepageHtml);
  assert.equal(result.state, 'ACCEPTED_SEED');
  if (result.state !== 'ACCEPTED_SEED') return;
  const title = fixture.homepageHtml.match(/<title>([^<]+)<\/title>/i)?.[1];
  const h1 = [...fixture.homepageHtml.matchAll(/<h1>([^<]+)<\/h1>/gi)].map((match) => match[1]);
  const preflight = inspectSuppliedDigitalPainPreflight({ origin: result.candidateUrl,
    content: { kind: 'TITLE_H1', title, h1 },
    seedProvenance: { kind: 'CANDIDATE_URL', reference: result.candidateUrl } });
  assert.equal(preflight.authority, 'NON_AUTHORITATIVE');
  assert.equal(preflight.state, 'LIKELY_CANONICAL_PAIN');
  assert.equal(preflight.condition, 'SITE_UNDER_CONSTRUCTION');
  for (const spy of spies) assert.equal(spy.mock.callCount(), 0);
});
