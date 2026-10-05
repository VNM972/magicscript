import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichResearchResultWithOperatingEvidence } from './operating-evidence';
import { normalizeResearchResult } from './research-output';

const scores = { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 };
const source = { url: 'https://example.com/', note: 'Accepted activity page', supports: ['activity', 'website'] };
const html = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"ProfessionalService","url":"https://example.com/","serviceType":"Accounting"}</script>';

test('runner fetches only accepted owned activity URL and records factual service without assigning family', async () => {
  const visited: string[] = [];
  const result = await enrichResearchResultWithOperatingEvidence({ sources: [source], scoreInputs: scores, websiteUrl: source.url }, async (url) => {
    visited.push(url);
    return { ok: true, url, finalUrl: url, text: html, contentType: 'text/html' };
  });
  assert.deepEqual(visited, [source.url]);
  assert.deepEqual((result.operatingEvidence as { facts: { value: string }[] }).facts.map((fact) => fact.value), ['ProfessionalService', 'Accounting']);
  assert.equal(result.commercialFamily, undefined);
});

test('runner captures accepted owned electrical-service prose with auditable provenance', async () => {
  const result = await enrichResearchResultWithOperatingEvidence({ sources: [source], scoreInputs: scores, websiteUrl: source.url }, async (url) => ({
    ok: true, url, finalUrl: url, text: '<main><h1>Installation électrique</h1></main>', contentType: 'text/html',
  }));
  assert.deepEqual((result.operatingEvidence as { facts: unknown[] }).facts[0], {
    kind: 'SERVICE_TYPE', value: 'ELECTRICAL_INSTALLATION', sourceUrl: source.url,
    evidenceType: 'OWNED_PAGE_TEXT', sourceType: 'OWNED_WEBSITE', integrityStatus: 'ACCEPTED', supportingText: 'Installation électrique',
  });
});

test('unaccepted redirect and absent accepted sources stay UNKNOWN', async () => {
  const redirected = await enrichResearchResultWithOperatingEvidence({ sources: [source], scoreInputs: scores }, async (url) => ({ ok: true, url, finalUrl: 'https://other.example/', text: html, contentType: 'text/html' }));
  assert.equal((redirected.operatingEvidence as { status: string }).status, 'UNKNOWN');
  let fetched = false;
  const empty = await enrichResearchResultWithOperatingEvidence({ sources: [], scoreInputs: scores }, async () => { fetched = true; throw Error('unexpected fetch'); });
  assert.equal(fetched, false);
  assert.equal((empty.operatingEvidence as { status: string }).status, 'UNKNOWN');
});

test('model-authored operating evidence is stripped before independent enrichment', () => {
  const normalized = normalizeResearchResult({ operatingEvidence: { status: 'VERIFIED', facts: [{ kind: 'SCHEMA_ORG_TYPE', value: 'Restaurant', sourceUrl: source.url }] }, digitalPainEvidence: { status: 'VERIFIED', observations: [{ type: 'UNDER_CONSTRUCTION' }] } }, { id: 'p1', companyName: 'Example', state: 'DISCOVERED' } as any);
  assert.equal(normalized.operatingEvidence, undefined);
  assert.equal(normalized.digitalPainEvidence, undefined);
});

test('accepted owned homepage notice is captured and gains a grounded digitalGap claim', async () => {
  const result = await enrichResearchResultWithOperatingEvidence({ sources: [source], scoreInputs: scores }, async (url) => ({ ok: true, url, finalUrl: url, text: '<h1>Site en construction</h1>', contentType: 'text/html' }));
  assert.equal((result.digitalPainEvidence as { status: string }).status, 'VERIFIED');
  assert.ok((result.sources as { supports: string[] }[])[0].supports.includes('digitalGap'));
});

test('failed fetch leaves pain UNKNOWN without adding a claim', async () => {
  const result = await enrichResearchResultWithOperatingEvidence({ sources: [source], scoreInputs: scores }, async () => ({ ok: false, reason: 'TIMEOUT' }));
  assert.equal((result.digitalPainEvidence as { status: string }).status, 'UNKNOWN');
  assert.ok(!(result.sources as { supports: string[] }[])[0].supports.includes('digitalGap'));
});

test('runner persists only independently fetched first-party absence with no site conflict', async () => {
  const profile = { url: 'https://www.facebook.com/lebon', note: 'Business profile', supports: ['websiteAbsent'] };
  const profileHtml = '<title>Le Bon | Facebook</title><main>Le Bon Fort-de-France. Nous n\'avons pas de site internet.</main>';
  const input = { sources: [profile], scoreInputs: scores };
  const found = await enrichResearchResultWithOperatingEvidence(input, async (url) =>
    ({ ok: true, url, finalUrl: url, text: profileHtml, contentType: 'text/html' }),
    { companyName: 'Le Bon', city: 'Fort-de-France' });
  assert.equal((found.digitalPainEvidence as { status: string }).status, 'VERIFIED');
  assert.ok((found.sources as { supports: string[] }[])[0].supports.includes('digitalGap'));
  const conflict = await enrichResearchResultWithOperatingEvidence(
    { ...input, sources: [profile, source] },
    async (url) => ({ ok: true, url, finalUrl: url, text: url === profile.url ? profileHtml : '<h1>Welcome</h1>', contentType: 'text/html' }),
    { companyName: 'Le Bon', city: 'Fort-de-France' });
  assert.equal((conflict.digitalPainEvidence as { status: string }).status, 'UNKNOWN');
});

test('runner safely observes a reproducibly dead primary contact link', async () => {
  const result = await enrichResearchResultWithOperatingEvidence({ sources: [source], scoreInputs: scores },
    async (url) => url === source.url
      ? { ok: true, url, finalUrl: url, text: '<a class="primary-cta" href="/contact">Contact</a>', contentType: 'text/html' }
      : { ok: false, reason: 'HTTP_STATUS_404', finalUrl: url, redirectCount: 0 },
    undefined, async () => {});
  assert.equal((result.digitalPainEvidence as { status: string }).status, 'VERIFIED');
  assert.equal((result.digitalPainEvidence as { observations: { type: string }[] }).observations[0].type, 'BROKEN_PRIMARY_ACTION');
});
