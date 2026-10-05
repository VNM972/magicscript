import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { acceptedDigitalPainEvidence, extractDigitalPainEvidence, inspectBrokenPrimaryAction } from '../research/digital-pain-evidence';
import type { AcceptedResearchSource } from '../research/evidence-integrity';

const source: AcceptedResearchSource = { url: 'https://example.com/', note: 'Accepted owned homepage', supports: ['website'] };
const scoredSource: AcceptedResearchSource = { ...source, supports: ['website', 'digitalGap'] };
const onePage = (html: string, url = source.url) => ({ url, html, snapshotDigest: `sha256:${createHash('sha256').update(html).digest('hex')}` });
const page = (html: string, url = source.url) => [onePage(html, url)];

test('explicit accepted owned homepage notice captures canonical pain with factual provenance', () => {
  const evidence = extractDigitalPainEvidence([source], page('<title>Site en construction</title><h1>Site en construction</h1>'));
  assert.equal(evidence.status, 'VERIFIED');
  assert.equal(evidence.observations[0]?.type, 'UNDER_CONSTRUCTION');
  assert.equal(evidence.observations[0]?.locator, 'title');
  assert.match(evidence.observations[0]?.snapshotDigest ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(acceptedDigitalPainEvidence(evidence, [scoredSource]), evidence);
  const rebuilding = extractDigitalPainEvidence([source], page('<h1>Notre site est en cours de refonte</h1>'));
  assert.equal(rebuilding.observations[0]?.type, 'REBUILDING');
});

test('navigation, CTA, subjective criticism, company name and NAF never become pain', () => {
  for (const html of [
    '<nav>Accueil Services Contact</nav>',
    '<h1>Contactez-nous</h1>',
    '<h1>Site ancien et laid</h1>',
    '<h1>Restaurant Example 56.10A</h1>',
    '<p>Site en construction</p>',
  ]) assert.equal(extractDigitalPainEvidence([source], page(html)).status, 'UNKNOWN');
});

test('registry, no accepted source, unaccepted redirect and non-homepage remain UNKNOWN', () => {
  const notice = '<h1>Site en construction</h1>';
  const registry: AcceptedResearchSource = { url: 'https://annuaire-entreprises.data.gouv.fr/etablissement/123', note: 'Registry', supports: ['website'] };
  assert.equal(extractDigitalPainEvidence([registry], page(notice, registry.url)).status, 'UNKNOWN');
  assert.equal(extractDigitalPainEvidence([], page(notice)).status, 'UNKNOWN');
  assert.equal(extractDigitalPainEvidence([source], page(notice, 'https://other.example/')).status, 'UNKNOWN');
  assert.equal(extractDigitalPainEvidence([{ ...source, url: 'https://example.com/contact' }], page(notice, 'https://example.com/contact')).status, 'UNKNOWN');
  assert.equal(extractDigitalPainEvidence([source], []).status, 'UNKNOWN');
});

test('scoring boundary rejects unaccepted or incompatible observations', () => {
  const evidence = extractDigitalPainEvidence([source], page('<h1>Site en construction</h1>'));
  assert.equal(acceptedDigitalPainEvidence(evidence, [source]).status, 'VERIFIED');
  assert.equal(acceptedDigitalPainEvidence(evidence, []).status, 'UNKNOWN');
  assert.equal(acceptedDigitalPainEvidence({ ...evidence, observations: [{ ...evidence.observations[0]!, observation: 'Contactez-nous' }] }, [scoredSource]).status, 'UNKNOWN');
  assert.equal(extractDigitalPainEvidence([source], page('<h1>Site en construction</h1><title>Notre site est en cours de refonte</title>')).status, 'UNKNOWN');
});

test('verified first-party absence requires exact statement, identity and no owned-site conflict', () => {
  const profile: AcceptedResearchSource = { url: 'https://www.facebook.com/lebon', note: 'Public business profile', supports: ['websiteAbsent'] };
  const identity = { companyName: 'Le Bon', city: 'Fort-de-France' };
  const html = '<title>Le Bon | Facebook</title><main>Le Bon, Fort-de-France. Nous n’avons pas de site internet.</main>';
  assert.equal(extractDigitalPainEvidence([profile], page(html, profile.url), identity).status, 'UNKNOWN');
  const explicit = html.replace('n’avons', "n'avons");
  const proof = extractDigitalPainEvidence([profile], page(explicit, profile.url), identity);
  assert.equal(proof.status, 'VERIFIED');
  assert.equal(acceptedDigitalPainEvidence(proof, [profile]).status, 'VERIFIED');
  assert.equal(extractDigitalPainEvidence([profile, source], page(explicit, profile.url), identity).status, 'UNKNOWN');
  assert.equal(acceptedDigitalPainEvidence(proof, [profile, source]).status, 'UNKNOWN');
  assert.equal(extractDigitalPainEvidence([profile], [], identity).status, 'UNKNOWN');
  assert.equal(extractDigitalPainEvidence([profile], page(explicit, profile.url), { ...identity, city: 'Paris' }).status, 'UNKNOWN');
});

test('safe primary action checks prove only reproducible hard failures', async () => {
  const actionPage = (href: string, extra = '') => onePage('<a class="primary-cta" href="' + href + '">Contact</a>' + extra);
  for (const status of [404, 410, 500]) {
    let checks = 0;
    const proof = await inspectBrokenPrimaryAction(source, actionPage('/contact'), async () => {
      checks += 1;
      return { ok: false, reason: 'HTTP_STATUS_' + status, finalUrl: 'https://example.com/contact', redirectCount: 0 };
    }, async () => {});
    assert.equal(checks, 2);
    assert.equal(proof.status, 'VERIFIED');
    assert.equal(acceptedDigitalPainEvidence(proof, [source]).status, 'VERIFIED');
  }
  const malformed = await inspectBrokenPrimaryAction(source, actionPage('http://['), async () => { throw Error('must not fetch'); });
  assert.equal(malformed.status, 'VERIFIED');
  for (const reason of ['HTTP_STATUS_401', 'HTTP_STATUS_403', 'TIMEOUT']) {
    const result = await inspectBrokenPrimaryAction(source, actionPage('/contact'), async () => ({ ok: false, reason, redirectCount: 0 }));
    assert.equal(result.status, 'UNKNOWN');
  }
  let calls = 0;
  const single = await inspectBrokenPrimaryAction(source, actionPage('/contact'), async () => {
    calls += 1;
    return calls === 1 ? { ok: false, reason: 'HTTP_STATUS_500', redirectCount: 0 } : { ok: true, url: source.url, finalUrl: source.url, text: '', contentType: 'text/html' };
  }, async () => {});
  assert.equal(single.status, 'UNKNOWN');
  assert.equal((await inspectBrokenPrimaryAction(source, actionPage('/contact', '<script src="app.js"></script>'), async () => ({ ok: false, reason: 'HTTP_STATUS_404', redirectCount: 0 }))).status, 'UNKNOWN');
  assert.equal((await inspectBrokenPrimaryAction(source, actionPage('/contact', '<a href="/email">Email</a>'), async () => ({ ok: false, reason: 'HTTP_STATUS_404', redirectCount: 0 }))).status, 'UNKNOWN');
  assert.equal((await inspectBrokenPrimaryAction(source, onePage('<form><button>Contact</button></form>'), async () => ({ ok: false, reason: 'HTTP_STATUS_404', redirectCount: 0 }))).status, 'UNKNOWN');
});
