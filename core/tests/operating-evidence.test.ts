import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOperatingEvidence, acceptedOperatingEvidence } from '../research/operating-evidence';
import type { AcceptedResearchSource } from '../research/evidence-integrity';

const owned: AcceptedResearchSource = { url: 'https://example.com/', note: 'Official page', supports: ['activity'] };
const page = (body: string, url = owned.url) => [{ url, html: `<script type="application/ld+json">${body}</script>` }];
const restaurant = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Restaurant', url: owned.url, name: 'Unrelated name', audience: { audienceType: 'general public' } });

test('explicit accepted owned JSON-LD records operating and audience facts with URL provenance', () => {
  const evidence = extractOperatingEvidence([owned], page(restaurant));
  assert.equal(evidence.status, 'VERIFIED');
  assert.deepEqual(evidence.facts.map((fact) => [fact.kind, fact.value, fact.sourceUrl]), [
    ['SCHEMA_ORG_TYPE', 'Restaurant', owned.url],
    ['AUDIENCE_TYPE', 'general public', owned.url],
  ]);
  assert.deepEqual(acceptedOperatingEvidence(evidence, [owned]), evidence);
});

test('ambiguous, name-only, NAF-only, and unsupported page content remain UNKNOWN', () => {
  for (const html of [
    '<h1>Restaurant Example</h1>',
    '<p>NAF 56.10A</p>',
    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Restaurant"}</script>',
    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","url":"https://example.com/"}</script>',
  ]) assert.equal(extractOperatingEvidence([owned], [{ url: owned.url, html }]).status, 'UNKNOWN');
});

test('no accepted source, registry-only source, and unaccepted page fail closed', () => {
  const registry: AcceptedResearchSource = { url: 'https://annuaire-entreprises.data.gouv.fr/etablissement/123', note: 'Registry', supports: ['activity'] };
  assert.equal(extractOperatingEvidence([], page(restaurant)).status, 'UNKNOWN');
  assert.equal(extractOperatingEvidence([registry], page(restaurant, registry.url)).status, 'UNKNOWN');
  assert.equal(extractOperatingEvidence([owned], page(restaurant, 'https://other.example/')).status, 'UNKNOWN');
});

test('entity on another origin and facts not bound to accepted activity are rejected', () => {
  const other = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Restaurant', url: 'https://other.example/' });
  assert.equal(extractOperatingEvidence([owned], page(other)).status, 'UNKNOWN');
  const websiteOnly: AcceptedResearchSource = { ...owned, supports: ['website'] };
  assert.equal(extractOperatingEvidence([websiteOnly], page(restaurant)).status, 'UNKNOWN');
  assert.equal(acceptedOperatingEvidence(extractOperatingEvidence([owned], page(restaurant)), [websiteOnly]).status, 'UNKNOWN');
});

test('accepted owned electrical-service text becomes a source-bound SERVICE_TYPE', () => {
  const evidence = extractOperatingEvidence([owned], [{ url: owned.url, html: '<main><h1>Installation électrique</h1><p>Nous assurons le dépannage électrique.</p></main>' }]);
  assert.equal(evidence.status, 'VERIFIED');
  assert.deepEqual(evidence.facts[0], {
    kind: 'SERVICE_TYPE', value: 'ELECTRICAL_INSTALLATION', sourceUrl: owned.url,
    evidenceType: 'OWNED_PAGE_TEXT', sourceType: 'OWNED_WEBSITE', integrityStatus: 'ACCEPTED', supportingText: 'Installation électrique',
  });
  assert.deepEqual(acceptedOperatingEvidence(evidence, [owned]), evidence);
});

test('only explicit supported owned-page service descriptions become visible-text facts', () => {
  const cases = [
    ['<h1>Auto-école</h1><p>Formation à la conduite</p>', 'DRIVING_SCHOOL'],
    ['<h1>Photographe mariage</h1>', 'WEDDING_EVENT_PHOTOGRAPHY'],
    ['<h1>Installation et maintenance de climatisation</h1>', 'HVAC_REFRIGERATION'],
    ['<h1>Installation et maintenance de froid</h1>', 'HVAC_REFRIGERATION'],
    ['<h1>Paysagiste et entretien de jardins</h1>', 'LANDSCAPING_TREE_SERVICES'],
  ] as const;
  for (const [html, archetype] of cases) {
    const evidence = extractOperatingEvidence([owned], [{ url: owned.url, html }]);
    assert.equal(evidence.status, 'VERIFIED', archetype);
    assert.ok(evidence.facts.some((fact) => fact.kind === 'SERVICE_TYPE' && fact.value === archetype && fact.evidenceType === 'OWNED_PAGE_TEXT'), archetype);
  }
});

test('generic, corporate-only, unsupported, hidden and unaccepted text stays UNKNOWN', () => {
  for (const html of [
    '<h1>Nos services</h1>', '<h1>Photographie corporate</h1>', '<h1>Expertise comptable</h1>',
    '<script>installation électrique</script><nav>Élagage</nav>',
    '<h1>Restaurant</h1><p>Installation électrique</p>',
    '<h1>Photographie corporate</h1><p>Event photography</p>',
  ]) assert.equal(extractOperatingEvidence([owned], [{ url: owned.url, html }]).status, 'UNKNOWN', html);
  const electrical = [{ url: owned.url, html: '<h1>Installation électrique</h1>' }];
  assert.equal(extractOperatingEvidence([{ ...owned, supports: ['website'] }], electrical).status, 'UNKNOWN');
  assert.equal(extractOperatingEvidence([], electrical).status, 'UNKNOWN');
  assert.equal(extractOperatingEvidence([owned], [{ ...electrical[0], url: 'https://other.example/' }]).status, 'UNKNOWN');
});

test('scoring rebind rejects forged or unsupported visible-text facts', () => {
  const fact = extractOperatingEvidence([owned], [{ url: owned.url, html: '<h1>Installation électrique</h1>' }]).facts[0]!;
  assert.equal(acceptedOperatingEvidence({ status: 'VERIFIED', facts: [{ ...fact, supportingText: 'Nos services' }] }, [owned]).status, 'UNKNOWN');
  assert.equal(acceptedOperatingEvidence({ status: 'VERIFIED', facts: [{ ...fact, value: 'DRIVING_SCHOOL' }] }, [owned]).status, 'UNKNOWN');
  assert.equal(acceptedOperatingEvidence({ status: 'VERIFIED', facts: [fact] }, [{ ...owned, supports: ['website'] }]).status, 'UNKNOWN');
});

test('R51 exact owned operator BeautySalon and HairSalon JSON-LD establish only Beauty family', () => {
  for (const type of ['BeautySalon', 'HairSalon']) {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': ['LocalBusiness', type], url: owned.url })}</script>`;
    const evidence = extractOperatingEvidence([owned], [{ url: owned.url, html }]);
    assert.equal(evidence.commercialFamily, 'BEAUTY_HAIR_BARBER', type);
    assert.equal(acceptedOperatingEvidence(evidence, [owned]).commercialFamily, 'BEAUTY_HAIR_BARBER', type);
    assert.equal(acceptedOperatingEvidence({ ...evidence, commercialFamily: 'RESTAURANTS_BARS_CAFES', facts: evidence.facts.map((fact) => ({ ...fact, operatorUrl: undefined })) }, [owned]).commercialFamily, undefined);
  }
});

test('R51 Beauty hints, third parties, unrelated nodes and conflicting operator facts fail closed', () => {
  const beauty = { '@context': 'https://schema.org', '@type': 'BeautySalon', url: owned.url };
  const html = (node: unknown) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`;
  for (const body of [
    '<h1>Beauty Coiffure Barber Hair</h1>',
    '<p>Le modèle indique que cette entreprise est un salon.</p>',
    html({ ...beauty, url: 'https://example.com/unrelated-salon' }),
  ]) assert.equal(extractOperatingEvidence([owned], [{ url: owned.url, html: body }]).commercialFamily, undefined);
  const subpage: AcceptedResearchSource = { ...owned, url: 'https://example.com/unrelated-salon' };
  const subpageEvidence = extractOperatingEvidence([subpage], [{ url: subpage.url, html: html({ ...beauty, url: subpage.url }) }]);
  assert.equal(subpageEvidence.commercialFamily, undefined);
  assert.equal(acceptedOperatingEvidence({ status: 'VERIFIED', facts: [{ kind: 'SCHEMA_ORG_TYPE', value: 'BeautySalon', evidenceType: 'JSON_LD', sourceUrl: subpage.url, operatorUrl: subpage.url }] }, [subpage]).commercialFamily, undefined);
  const directory: AcceptedResearchSource = { url: 'https://annuaire-entreprises.data.gouv.fr/etablissement/beauty', note: 'Directory', supports: ['activity'] };
  assert.equal(extractOperatingEvidence([directory], [{ url: directory.url, html: html({ ...beauty, url: directory.url }) }]).commercialFamily, undefined);
  const social: AcceptedResearchSource = { url: 'https://www.facebook.com/beauty-fixture', note: 'Social category BeautySalon', supports: ['activity'] };
  assert.equal(extractOperatingEvidence([social], [{ url: social.url, html: html({ ...beauty, url: social.url }) }]).commercialFamily, undefined);
  const conflict = extractOperatingEvidence([owned], [{ url: owned.url, html: html([beauty, { ...beauty, '@type': 'Restaurant' }]) }]);
  assert.equal(conflict.commercialFamily, undefined);
  assert.equal(acceptedOperatingEvidence(conflict, [owned]).commercialFamily, undefined);
});

test('R52 accepted owned operator FOOD types establish only the canonical FOOD family', () => {
  for (const type of ['Restaurant', 'CafeOrCoffeeShop', 'BarOrPub', 'FastFoodRestaurant']) {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': ['LocalBusiness', type], url: owned.url })}</script>`;
    const evidence = extractOperatingEvidence([owned], [{ url: owned.url, html }]);
    assert.equal(evidence.commercialFamily, 'RESTAURANTS_BARS_CAFES', type);
    assert.equal(acceptedOperatingEvidence(evidence, [owned]).commercialFamily, 'RESTAURANTS_BARS_CAFES', type);
    assert.equal(acceptedOperatingEvidence({ ...evidence, facts: evidence.facts.map((fact) => ({ ...fact, operatorUrl: undefined })) }, [owned]).commercialFamily, undefined);
  }
  const multi = extractOperatingEvidence([owned], page(JSON.stringify({ '@context': 'https://schema.org', '@type': ['Restaurant', 'BarOrPub'], url: owned.url })));
  assert.equal(multi.commercialFamily, 'RESTAURANTS_BARS_CAFES');
  assert.equal(acceptedOperatingEvidence(multi, [owned]).commercialFamily, 'RESTAURANTS_BARS_CAFES');
});

test('R52 generic, third-party, unrelated and conflicting FOOD hints fail closed', () => {
  const html = (node: unknown) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`;
  for (const type of ['FoodEstablishment', 'Organization', 'LocalBusiness', 'Bakery', 'Winery', 'Brewery', 'Distillery', 'IceCreamShop', 'FoodEvent', 'FoodService', 'Catering', 'Store']) {
    assert.equal(extractOperatingEvidence([owned], [{ url: owned.url, html: html({ '@context': 'https://schema.org', '@type': type, url: owned.url }) }]).commercialFamily, undefined, type);
  }
  for (const body of ['<h1>Restaurant Bar Café</h1>', '<p>Our model calls this a restaurant.</p>', '<p>56.10A 56.30Z FOOD</p>', html({ '@context': 'https://schema.org', '@type': 'Restaurant', url: 'https://example.com/other-operator' })]) {
    assert.equal(extractOperatingEvidence([owned], [{ url: owned.url, html: body }]).commercialFamily, undefined, body);
  }
  for (const url of [
    'https://annuaire-entreprises.data.gouv.fr/etablissement/food',
    'https://www.facebook.com/food-fixture',
    'https://www.instagram.com/',
    'https://www.google.com/',
    'https://www.tripadvisor.com/',
    'https://www.thefork.fr/',
    'https://www.ubereats.com/',
    'https://deliveroo.fr/',
    'https://directory.example.test/',
    'https://marketplace.example.test/',
  ]) {
    const source: AcceptedResearchSource = { url, note: 'Third-party listing', supports: ['activity'] };
    const evidence = extractOperatingEvidence([source], [{ url, html: html({ '@context': 'https://schema.org', '@type': 'Restaurant', url }) }]);
    assert.equal(evidence.commercialFamily, undefined, url);
    assert.equal(acceptedOperatingEvidence({ status: 'VERIFIED', facts: [{ kind: 'SCHEMA_ORG_TYPE', value: 'Restaurant', evidenceType: 'JSON_LD', sourceUrl: url, operatorUrl: url }] }, [source]).commercialFamily, undefined, url);
  }
  const otherOperator = extractOperatingEvidence([owned], page(JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'Restaurant', url: owned.url },
    { '@context': 'https://schema.org', '@type': 'BarOrPub', url: 'https://example.com/other-operator' },
  ])));
  assert.equal(otherOperator.commercialFamily, undefined);
  const duplicateTypeOtherOperator = extractOperatingEvidence([owned], page(JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'Restaurant', url: owned.url },
    { '@context': 'https://schema.org', '@type': 'Restaurant', url: 'https://example.com/other-operator' },
  ])));
  assert.equal(duplicateTypeOtherOperator.commercialFamily, undefined);
  assert.equal(acceptedOperatingEvidence(duplicateTypeOtherOperator, [owned]).commercialFamily, undefined);
  const conflict = extractOperatingEvidence([owned], page(JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'Restaurant', url: owned.url },
    { '@context': 'https://schema.org', '@type': 'BeautySalon', url: owned.url },
  ])));
  assert.equal(conflict.commercialFamily, undefined);
  assert.equal(acceptedOperatingEvidence(conflict, [owned]).commercialFamily, undefined);
});
