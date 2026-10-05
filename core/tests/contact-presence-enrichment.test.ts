import test from 'node:test';
import assert from 'node:assert/strict';
import { bindIdentity, enrichContactPresence, parseContactPresence } from '../contact-presence/enrichment';

test('deterministically extracts contact and presence evidence', () => {
  const html = `<a href="tel:+596 596 71 10 10">call</a><a href="mailto:hello@example.fr">email</a><a href="https://wa.me/596596711010">WhatsApp</a><a href="https://instagram.com/acme">social</a><form action="/contact"><input></form><p>other@example.fr 05 96 22 22 22</p><script type="application/ld+json">{"telephone":"05 96 00 00 00","email":"json@example.fr","sameAs":["https://facebook.com/acme"]}</script>`;
  const result = parseContactPresence(html, 'https://example.fr/contact');
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.phone.values[0], '+596 596 71 10 10');
  assert.deepEqual(result.email.values, ['hello@example.fr', 'json@example.fr', 'other@example.fr']);
  assert.equal(result.whatsapp.status, 'VERIFIED');
  assert.equal(result.social.values.length, 2);
  assert.equal(result.contactForm.status, 'VERIFIED');
});

test('fails closed on identity mismatch and binds matching identity', () => {
  const html = `<script type="application/ld+json">{"@type":"LocalBusiness","name":"Acme Services","url":"https://acme.fr","address":{"addressLocality":"Fort-de-France"}}</script><a href="mailto:x@acme.fr">x</a>`;
  assert.equal(bindIdentity({ companyName: 'Other', domain: 'acme.fr', city: 'Fort-de-France' }, html, 'https://acme.fr').status, 'REJECTED');
  const result = parseContactPresence(html, 'https://acme.fr/contact', { companyName: 'Acme Services', domain: 'acme.fr', city: 'Fort-de-France' });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.email.status, 'VERIFIED');
});

test('TEL_HREF_EXTRACTED', () => { const r = parseContactPresence('<a href="tel:+596 596 71 61 71">Call</a>', 'https://example.fr/contact', { companyName: 'Example', domain: 'example.fr' }); assert.equal(r.phone.status, 'VERIFIED'); });
test('THIRD_PARTY_GLOBAL_PHONE_REJECTED', () => { const r = parseContactPresence('<footer>Support: 02 35 52 82 00</footer>', 'https://leguichetdesformalites.fr/entreprise/example', { companyName: 'Example' }, { sourceOwnership: 'THIRD_PARTY_SITE_GLOBAL_CONTACT', entityBound: true }); assert.equal(r.phone.status, 'UNKNOWN'); assert.ok(r.reasons.includes('THIRD_PARTY_SITE_GLOBAL_CONTACT_REJECTED')); });
test('DIRECTORY_SUPPORT_PHONE_REJECTED', () => { const r = parseContactPresence('<a href="tel:+33 9 39 20 04 83">Nous contacter</a>', 'https://directory.example/listing', { companyName: 'Example' }, { sourceOwnership: 'THIRD_PARTY_SITE_GLOBAL_CONTACT', entityBound: true }); assert.equal(r.phone.values.length, 0); });
test('SITE_FOOTER_PHONE_NOT_TARGET_EVIDENCE', () => { const r = parseContactPresence('<script type="application/ld+json">{"telephone":"0596511236"}</script><footer>02 35 52 82 00</footer>', 'https://directory.example/listing', { companyName: 'Example' }, { sourceOwnership: 'THIRD_PARTY_SITE_GLOBAL_CONTACT', entityBound: true }); assert.equal(r.phone.values.length, 0); });
test('TARGET_LISTING_PHONE_ACCEPTED_WHEN_ENTITY_BOUND', () => { const r = parseContactPresence('<a href="tel:0596511236">ACTIBURO</a>', 'https://listing.example/actiburo', { companyName: 'ACTIBURO' }, { sourceOwnership: 'THIRD_PARTY_LISTING_BUSINESS_FIELD', entityBound: true }); assert.equal(r.phone.status, 'VERIFIED'); });
test('OWNED_SITE_PHONE_PRESERVED', () => { const r = parseContactPresence('<a href="tel:0596511236">Contact ACTIBURO</a>', 'https://www.actiburo.com/contact', { companyName: 'ACTIBURO', domain: 'actiburo.com' }, { sourceOwnership: 'OWNED_BUSINESS_SOURCE', entityBound: true }); assert.equal(r.phone.status, 'VERIFIED'); });
test('ACTIBURO_ROUEN_PHONE_REGRESSION', () => { const r = parseContactPresence('<footer>02 35 52 82 00</footer>', 'https://www.actiburo.com/', { companyName: 'ACTIBURO', domain: 'actiburo.com' }, { sourceOwnership: 'THIRD_PARTY_SITE_GLOBAL_CONTACT', entityBound: true }); assert.equal(r.phone.values.length, 0); });
test('JSON_LD_TARGET_PHONE_PRESERVED', () => { const r = parseContactPresence('<script type="application/ld+json">{"@type":"LocalBusiness","name":"ACTIBURO","telephone":"0596511236"}</script>', 'https://www.actiburo.com', { companyName: 'ACTIBURO', domain: 'actiburo.com' }, { sourceOwnership: 'DIRECT_STRUCTURED_BUSINESS_SOURCE', entityBound: true }); assert.equal(r.phone.status, 'VERIFIED'); });

test('JSONLD_PHONE_EXTRACTED', () => { const r = parseContactPresence('<script type="application/ld+json">{"@type":"LocalBusiness","name":"Example","telephone":"0596 71 61 71"}</script>', 'https://example.fr', { companyName: 'Example', domain: 'example.fr' }); assert.equal(r.phone.status, 'VERIFIED'); });

test('VISIBLE_PHONE_EXTRACTED', () => { const r = parseContactPresence('<footer>0596 71 61 71</footer>', 'https://example.fr', { companyName: 'Example', domain: 'example.fr' }); assert.equal(r.phone.status, 'VERIFIED'); });

test('EXACT_NAME_OVERRIDES_BROAD_CITY_LABEL', () => { const r = parseContactPresence('<script type="application/ld+json">{"@type":"LocalBusiness","name":"CORAIL","address":{"addressLocality":"LE LAMENTIN"},"telephone":"0596 00 00 00"}</script>', 'https://directory.example/corail', { companyName: 'CORAIL', city: 'Martinique' }); assert.equal(r.identity.status, 'VERIFIED'); assert.equal(r.phone.status, 'VERIFIED'); });

test('RANDOM_DIGITS_REJECTED', () => { const r = parseContactPresence('<p>202609081733 12345678901234567890</p>', 'https://example.fr', { companyName: 'Example', domain: 'example.fr' }); assert.notEqual(r.phone.status, 'VERIFIED'); });

test('waterfall is bounded and performs no submission', () => {
  const result = enrichContactPresence([
    { url: 'https://a.test', html: '<p>a@test.fr</p>' },
    { url: 'https://b.test', html: '<p>b@test.fr</p>' },
    { url: 'https://c.test', html: '<p>c@test.fr</p>' },
  ], undefined, { maxSources: 2, maxBytesPerSource: 100 });
  assert.equal(result.sourcesProcessed, 2);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.email.values, ['a@test.fr', 'b@test.fr']);
});
