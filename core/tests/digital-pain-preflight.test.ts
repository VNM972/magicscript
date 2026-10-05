import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { readFileSync } from 'node:fs';
import { acceptedDigitalPainEvidence, noticeType } from '../research/digital-pain-evidence';
import type { DigitalPainEvidence, DigitalPainObservation } from '../research/digital-pain-evidence';
import { inspectSuppliedDigitalPainPreflight } from '../research/digital-pain-preflight';
import type { NonAuthoritativeDigitalPainPreflightResult, SuppliedDigitalPainPreflightInput } from '../research/digital-pain-preflight';

const origin = 'https://example.invalid/';
const inspect = (title?: string, h1?: readonly string[]) =>
  inspectSuppliedDigitalPainPreflight({ origin, content: { kind: 'TITLE_H1', title, h1 } });
const inspectInvalid = (input: unknown) =>
  inspectSuppliedDigitalPainPreflight(input as SuppliedDigitalPainPreflightInput);

for (const [phrase, condition] of [
  ['Site en construction', 'SITE_UNDER_CONSTRUCTION'],
  ['Notre site est en cours de refonte', 'SITE_REBUILDING'],
] as const) {
  for (const locator of ['title', 'h1'] as const) {
    test(condition + ' recognized in supplied ' + locator, () => {
      assert.deepEqual(locator === 'title' ? inspect(phrase) : inspect(undefined, [phrase]), {
        authority: 'NON_AUTHORITATIVE', state: 'LIKELY_CANONICAL_PAIN', condition,
        reason: 'CANONICAL_NOTICE_MATCHED', matchedText: phrase,
      });
    });
  }
}

test('ordinary readable title/H1 means only NO_PAIN_SIGNAL', () => {
  assert.deepEqual(inspect('Restaurant Example', ['Bienvenue']), {
    authority: 'NON_AUTHORITATIVE', state: 'NO_PAIN_SIGNAL', condition: null,
    reason: 'NO_CANONICAL_NOTICE', matchedText: null,
  });
});

test('generic maintenance is not canonical pain', () => {
  for (const phrase of ['Maintenance', 'Site en maintenance', 'Website maintenance']) {
    assert.equal(inspect(phrase, [phrase]).state, 'NO_PAIN_SIGNAL');
  }
});

test('generic coming soon is not canonical pain', () => {
  for (const phrase of ['Coming soon', 'Bientôt disponible', 'Under construction']) {
    assert.equal(inspect(phrase, [phrase]).state, 'NO_PAIN_SIGNAL');
  }
});

test('construction/rebuilding conflict has no precedence, including multiple H1s', () => {
  for (const result of [
    inspect('Site en construction', ['Notre site est en cours de refonte']),
    inspect('Notre site est en cours de refonte', ['Site en construction']),
    inspect(undefined, ['Site en construction', 'Notre site est en cours de refonte']),
  ]) {
    assert.equal(result.state, 'UNKNOWN');
    assert.equal(result.reason, 'CONFLICTING_NOTICES');
    assert.equal(result.condition, null);
    assert.equal(result.matchedText, null);
  }
});

test('missing or empty content stays UNKNOWN', () => {
  for (const input of [
    { origin }, { origin, content: null },
    { origin, content: { kind: 'TITLE_H1' } },
    { origin, content: { kind: 'TITLE_H1', title: '  ', h1: [] } },
  ]) {
    const result = inspectInvalid(input);
    assert.equal(result.state, 'UNKNOWN');
    assert.equal(result.reason, 'MISSING_CONTENT');
  }
});

test('missing factual origin cannot create a hint, even with a canonical title', () => {
  for (const missing of [undefined, null, '', ' ']) {
    assert.equal(inspectInvalid({ origin: missing, content: { kind: 'TITLE_H1', title: 'Site en construction' } }).reason,
      'MISSING_ORIGIN');
  }
});

test('body copy and model narrative are never inspected', () => {
  const content = { kind: 'TITLE_H1', title: 'Restaurant Example', h1: ['Bienvenue'],
    body: 'Site en construction', primaryFriction: 'Notre site est en cours de refonte' };
  assert.equal(inspectInvalid({ origin, content }).state, 'NO_PAIN_SIGNAL');
  assert.equal(inspectInvalid({ origin, content: { kind: 'TITLE_H1', body: 'Site en construction' } }).state, 'UNKNOWN');
  assert.equal(inspectInvalid({ origin, content: { kind: 'MODEL_NARRATIVE', text: 'Site en construction' } }).state, 'UNKNOWN');
});

test('unsupported content shapes, including raw HTML, stay UNKNOWN', () => {
  for (const input of [undefined, null, [], { origin, content: '<title>Site en construction</title>' },
    { origin, content: { kind: 'HTML', html: '<h1>Site en construction</h1>' } },
    { origin, content: { kind: 'TITLE_H1', title: 42 } },
    { origin, content: { kind: 'TITLE_H1', h1: 'Site en construction' } },
    { origin, content: { kind: 'TITLE_H1', h1: [null] } },
    { origin, content: { kind: 'TITLE_H1', h1: new Array(1) } },
  ]) {
    const result = inspectInvalid(input);
    assert.equal(result.state, 'UNKNOWN');
    assert.equal(result.reason, 'UNSUPPORTED_CONTENT');
  }
});

test('unusable extracted text stays UNKNOWN even alongside a recognized notice', () => {
  for (const text of ['<b>Site en construction</b>', '\u0000Site en construction', '\uFFFD']) {
    const result = inspect(undefined, ['Site en construction', text]);
    assert.equal(result.state, 'UNKNOWN');
    assert.equal(result.reason, 'UNUSABLE_CONTENT');
  }
});

test('factual origin identifiers and narrow provenance are preserved without verification', () => {
  const seedProvenance = { kind: 'FACTUAL_ORIGIN', reference: 'offline-fixture:42',
    integrityStatus: 'ACCEPTED', observedAt: 'authority timestamp', status: 'VERIFIED' };
  const result = inspectInvalid({ origin: 'offline-fixture:42', seedProvenance,
    content: { kind: 'TITLE_H1', title: 'Site en construction' } });
  assert.deepEqual(result.seedProvenance, { kind: 'FACTUAL_ORIGIN', reference: 'offline-fixture:42' });
  assert.equal(result.authority, 'NON_AUTHORITATIVE');
  assert.equal(inspectInvalid({ origin, seedProvenance: { kind: 'MODEL', reference: 'narrative' } }).state, 'UNKNOWN');
});

test('absence and broken-action hints remain unsupported', () => {
  assert.equal(inspectInvalid({ origin, websiteAbsent: true }).state, 'UNKNOWN');
  assert.equal(inspectInvalid({ origin, content: { kind: 'TITLE_H1', title: 'We do not have a website' },
    brokenPrimaryAction: { href: 'http://[', status: 404 } }).state, 'NO_PAIN_SIGNAL');
});

test('result has neither canonical authority shape nor assignable authority type', () => {
  type AuthorityField = 'observedAt' | 'snapshotSha256' | 'snapshotDigest' | 'integrityStatus' |
    'status' | 'observations' | 'type' | 'sourceType' | 'sourceUrl' | 'evidenceType' | 'inspectionMethod';
  const noAuthorityKeys: Extract<keyof NonAuthoritativeDigitalPainPreflightResult, AuthorityField> extends never ? true : false = true;
  const notObservation: NonAuthoritativeDigitalPainPreflightResult extends DigitalPainObservation ? false : true = true;
  const notEvidence: NonAuthoritativeDigitalPainPreflightResult extends DigitalPainEvidence ? false : true = true;
  assert.ok(noAuthorityKeys && notObservation && notEvidence);
  for (const result of [inspect('Site en construction'), inspect('Restaurant'), inspect()]) {
    assert.deepEqual(Object.keys(result).sort(), ['authority', 'condition', 'matchedText', 'reason', 'state']);
    assert.deepEqual(acceptedDigitalPainEvidence(result, []), { status: 'UNKNOWN', observations: [] });
  }
});

test('exact canonical matcher phrases and normalization remain unchanged', () => {
  for (const phrase of ['Notre site est en construction', 'Ce site internet est en construction',
    'Site web en construction', 'Our website is under construction', 'Website under construction',
    '  SITE   EN CONSTRUCTION!!  ']) {
    assert.equal(noticeType(phrase), 'UNDER_CONSTRUCTION');
    assert.equal(inspect(phrase).condition, 'SITE_UNDER_CONSTRUCTION');
    assert.equal(inspect(phrase).matchedText, phrase);
  }
  for (const phrase of ['Ce site web est en cours de refonte', 'Site internet en cours de refonte',
    'We are rebuilding our website', 'We are rebuilding the website']) {
    assert.equal(noticeType(phrase), 'REBUILDING');
    assert.equal(inspect(phrase).condition, 'SITE_REBUILDING');
  }
  for (const phrase of ['Our site is under construction', 'Site en refonte', 'Site en construction - Restaurant',
    'Le menu explique que le site est en construction', 'Site en construction?', 'Coming soon']) {
    assert.equal(noticeType(phrase), undefined);
    assert.equal(inspect(phrase).state, 'NO_PAIN_SIGNAL');
  }
});

test('supplied inspection makes zero HTTP or DNS calls and imports only the pure matcher', (t) => {
  const forbidden = () => { throw new Error('offline preflight must not use transport'); };
  const spies = [t.mock.method(globalThis, 'fetch', forbidden),
    t.mock.method(http, 'get', forbidden), t.mock.method(http, 'request', forbidden),
    t.mock.method(https, 'get', forbidden), t.mock.method(https, 'request', forbidden),
    t.mock.method(dns, 'lookup', forbidden), t.mock.method(dns, 'resolve', forbidden),
    t.mock.method(dns.promises, 'lookup', forbidden), t.mock.method(dns.promises, 'resolve', forbidden)];
  for (const result of [inspect('Site en construction'), inspect('Notre site est en cours de refonte'),
    inspect('Restaurant'), inspect(), inspect('Site en construction', ['Notre site est en cours de refonte'])]) {
    assert.equal(result.authority, 'NON_AUTHORITATIVE');
    assert.equal(result instanceof Promise, false);
  }
  for (const spy of spies) assert.equal(spy.mock.callCount(), 0);
  const source = readFileSync(new URL('../research/digital-pain-preflight.ts', import.meta.url), 'utf8');
  assert.deepEqual(source.match(/^import .*$/gm), ["import { noticeType } from './digital-pain-evidence';"]);
  assert.doesNotMatch(source, /\b(?:fetch|require|import)\s*\(|\b(?:http|https|dns|browser|model)\s*\.|\bnew\s+(?:URL|WebSocket|Worker)\s*\(/);
});
