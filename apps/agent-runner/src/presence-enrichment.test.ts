import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichResearchResultWithContactPresence, selectContactPresenceCandidateUrls } from './presence-enrichment';

test('presence candidates are bounded and secure', () => {
  assert.deepEqual(selectContactPresenceCandidateUrls({ websiteUrl: 'https://example.fr/', sources: [{ url: 'https://example.fr/contact' }, { url: 'https://example.fr/about' }, { url: 'https://evil.example/x' }] }), ['https://example.fr/', 'https://example.fr/contact', 'https://example.fr/about']);
});

test('presence enrichment records deterministic audit evidence', async () => {
  const result = await enrichResearchResultWithContactPresence({ companyName: 'Example', websiteUrl: 'https://example.fr/', city: 'Fort-de-France', sources: [] }, async (url) => ({ ok: true, url, finalUrl: url, text: '<a href="mailto:hello@example.fr">Email</a><form></form>', contentType: 'text/html' }));
  const presence = result.contactPresence as any;
  assert.equal(presence.status, 'VERIFIED');
  assert.equal(presence.email.status, 'VERIFIED');
  assert.equal(presence.contactForm.status, 'VERIFIED');
  assert.equal(presence.email.evidence[0].sourceUrl, 'https://example.fr/');
  assert.equal(presence.sourcesProcessed, 1);
});

test('fetch failures produce explicit unknown presence without sending', async () => {
  const result = await enrichResearchResultWithContactPresence({ websiteUrl: 'https://example.fr/' }, async () => ({ ok: false, reason: 'fixture fetch failure' }));
  const presence = result.contactPresence as any;
  assert.equal(presence.status, 'UNKNOWN');
  assert.equal(presence.email.status, 'UNKNOWN');
  assert.equal(presence.phone.status, 'UNKNOWN');
  assert.equal(presence.sourcesProcessed, 0);
});
