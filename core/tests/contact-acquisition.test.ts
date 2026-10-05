import { strict as assert } from 'node:assert';
import test from 'node:test';
import { acquireContactSources, bindCandidateIdentity, buildContactAcquisitionQueryPlan, classifySourceType, dedupeCandidates, generatedOwnedPathManifest, normalizeCandidateUrl, sameOriginContactLinks } from '../contact-acquisition/agent';

test('REPOSITORY_SEARCH_HOSTS_CLASSIFIED_BEFORE_OWNERSHIP_OR_PATH', () => {
  for (const [host, sourceType] of [['api.tavily.com', 'SEARCH_PROVIDER'], ['www.google.com', 'SEARCH_ENGINE']] as const)
    for (const path of ['/', '/search', '/contact', '/legal']) {
      const url = normalizeCandidateUrl(`HTTPS://${host.toUpperCase()}${path}`)!;
      assert.equal(classifySourceType(url), sourceType);
      assert.equal(classifySourceType(url, true), sourceType);
    }
});

test('SEARCH_HOST_CLASSIFICATION_IS_EXACT', () => {
  for (const host of ['api.tavily.com.example.fr', 'www.google.com.example.fr', 'cafe-api.tavily.com',
    'cafe-www.google.com', 'sub.api.tavily.com', 'sub.www.google.com']) {
    assert.equal(classifySourceType(`https://${host}/`), 'OTHER_PUBLIC_SOURCE');
    assert.equal(classifySourceType(`https://${host}/`, true), 'OWNED_WEBSITE');
  }
});

test('NO_SPECULATIVE_RELATED_SEARCH_OR_CACHE_HOSTS', () => {
  for (const host of ['google.fr', 'googleusercontent.com', 'webcache.google.com', 'tavily.com', 'www.tavily.com'])
    assert.equal(classifySourceType(`https://${host}/`), 'OTHER_PUBLIC_SOURCE');
});

test('ORDINARY_BUSINESS_ROOT_CLASSIFICATION_PRESERVED', () => {
  assert.equal(classifySourceType('https://cafe-alizes.fr/'), 'OTHER_PUBLIC_SOURCE');
  assert.equal(classifySourceType('https://cafe-alizes.fr/', true), 'OWNED_WEBSITE');
});

test('QUERY_PLAN_IS_BOUNDED', () => assert.ok(buildContactAcquisitionQueryPlan({ companyName: 'Example', city: 'Fort-de-France', activity: 'restaurant' }).length <= 10));
test('SEARCH_RESULT_URLS_DEDUPED', () => assert.equal(dedupeCandidates([{ url: 'https://example.fr', sourceType: 'OTHER_PUBLIC_SOURCE', queryOrigin: 'q', identityStatus: 'IDENTITY_VERIFIED', identityEvidence: [], fetchStatus: 'NOT_FETCHED' }, { url: 'https://example.fr/', sourceType: 'OTHER_PUBLIC_SOURCE', queryOrigin: 'q', identityStatus: 'IDENTITY_VERIFIED', identityEvidence: [], fetchStatus: 'NOT_FETCHED' }]).length, 1));
test('SEARCH_PROVIDER_UNAVAILABLE_STAYS_UNKNOWN', async () => { const result = await acquireContactSources({ companyName: 'Example', city: 'Fort-de-France' }); assert.equal(result.status, 'SEARCH_PROVIDER_UNAVAILABLE'); assert.equal(result.blocker?.code, 'SEARCH_PROVIDER_UNAVAILABLE'); });
test('IDENTITY_BOUND_SOURCE_ACCEPTED', () => assert.equal(bindCandidateIdentity({ companyName: 'Example', city: 'Fort-de-France' }, { url: 'https://example.fr/contact', text: 'Example Fort-de-France' }), 'IDENTITY_VERIFIED'));
test('SAME_NAME_WRONG_BUSINESS_REJECTED', () => assert.equal(bindCandidateIdentity({ companyName: 'Example', city: 'Fort-de-France' }, { url: 'https://other.fr', text: 'Example Paris' }), 'IDENTITY_REJECTED'));
test('OWNED_SITE_CONTACT_PAGE_DISCOVERED', async () => { const result = await acquireContactSources({ companyName: 'Example', websiteUrl: 'https://example.fr' }); assert.ok(result.sources.some((source) => source.sourceType === 'OWNED_WEBSITE')); });
test('GENERATED_PATH_RECORDED', () => assert.equal(generatedOwnedPathManifest('https://example.fr', 't').length, 9));
test('GENERATED_PATH_NOT_EQUAL_FETCHED', () => assert.equal(generatedOwnedPathManifest('https://example.fr', 't')[1]?.lifecycle, 'GENERATED'));
test('DISCOVERED_LINK_PRIORITIZED', async () => { const seen:string[]=[]; await (await import('../contact-acquisition/agent')).fetchAndVerifyCandidates({companyName:'Example',websiteUrl:'https://example.fr'},[{url:'https://example.fr',sourceType:'OWNED_WEBSITE',queryOrigin:'canonical.websiteUrl',identityStatus:'IDENTITY_VERIFIED',identityEvidence:[],fetchStatus:'NOT_FETCHED'}],async (url)=>{seen.push(url);return {ok:true,text:url==='https://example.fr'?'Example <a href="/contact-reel">Contact</a>':'Example'};}); assert.ok(seen.indexOf('https://example.fr/contact-reel')<seen.indexOf('https://example.fr/contact'));});
test('DISCOVERED_CONTACT_LINK_FETCHED', () => assert.equal(sameOriginContactLinks('https://example.fr', '<a href="/nous-contacter">Contact</a><a href="https://other.fr/contact">x</a>', 't').length, 1));
test('SAME_ORIGIN_ONLY', () => assert.equal(sameOriginContactLinks('https://example.fr', '<a href="https://other.fr/contact">x</a>', 't').length, 0));
test('NO_EXTERNAL_ACTION', async () => { const result = await acquireContactSources({ companyName: 'Example' }, { provider: { search: async () => [{ url: 'https://example.fr' }] } }); assert.equal(result.sources[0]?.fetchStatus, 'NOT_FETCHED'); });
test('FETCH_STATUS_IS_AUDITED', async () => { const result = await acquireContactSources({ companyName: 'Example' }, { provider: { search: async () => [{ url: 'https://example.fr', title: 'Example Fort-de-France' }] }, fetchPage: async () => ({ ok: true, text: 'Example Fort-de-France' }) }); const fetched = await (await import('../contact-acquisition/agent')).fetchAndVerifyCandidates({ companyName: 'Example', city: 'Fort-de-France' }, result.sources, async () => ({ ok: true, text: 'Example Fort-de-France' })); assert.equal(fetched[0]?.fetchStatus, 'FETCHED'); });
