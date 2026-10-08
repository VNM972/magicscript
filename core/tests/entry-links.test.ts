import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPersonalizedEntryLinks } from '../personalization/entry-links';

const prospectId = '2609319c-5578-4a37-99bb-1b0923a2f81f';
const prototypeUrl = 'https://pauline-coiffure-demo.pages.dev/';

test('builds two safe links from a deployed, QA-passed prototype', () => {
  const result = buildPersonalizedEntryLinks({
    prospectId,
    companyName: 'PAULINE COIFFURE',
    prototypeUrl,
    prototypeStatus: 'DEPLOYED',
    qaStatus: 'PASS',
    personalizedBaseUrl: 'https://magicscript.fr',
  });

  assert.equal(result.personalizedEntryEnabled, true);
  assert.equal(result.prototypeUrl, prototypeUrl);
  assert.equal(result.salesRoomSlug, 'pauline-coiffure');
  assert.equal(result.prototypeEntryUrl, 'https://magicscript.fr/demo/pauline-coiffure');
  assert.equal(result.salesRoomUrl, 'https://magicscript.fr/p/pauline-coiffure');
  assert.equal(result.personalizedUrl, 'https://magicscript.fr/p/pauline-coiffure');
  assert.deepEqual(result.links.map((link) => link.label), [
    'Voir votre proposition',
    'Accéder à la Sales Room',
  ]);
});

test('allows a loopback base for local/mock validation', () => {
  const result = buildPersonalizedEntryLinks({
    prospectId,
    companyName: 'PAULINE COIFFURE',
    prototypeUrl,
    prototypeStatus: 'DEPLOYED',
    qaStatus: 'PASS',
    personalizedBaseUrl: 'http://127.0.0.1:6912/',
  });

  assert.equal(result.personalizedUrl, 'http://127.0.0.1:6912/p/pauline-coiffure');
});

test('does not enable the entry without a validated deployment', () => {
  const result = buildPersonalizedEntryLinks({
    prospectId,
    companyName: 'PAULINE COIFFURE',
    prototypeUrl,
    prototypeStatus: 'BUILT',
    qaStatus: 'PASS',
    personalizedBaseUrl: 'https://magicscript.fr',
  });

  assert.equal(result.personalizedEntryEnabled, false);
  assert.equal(result.prototypeUrl, null);
  assert.deepEqual(result.links, []);
});

test('does not enable the entry for a failed QA or unsafe prototype URL', () => {
  const failedQa = buildPersonalizedEntryLinks({
    prospectId,
    companyName: 'PAULINE COIFFURE',
    prototypeUrl,
    prototypeStatus: 'DEPLOYED',
    qaStatus: 'FAIL',
    personalizedBaseUrl: 'https://magicscript.fr',
  });
  const unsafeUrl = buildPersonalizedEntryLinks({
    prospectId,
    companyName: 'PAULINE COIFFURE',
    prototypeUrl: 'http://example.com/demo',
    prototypeStatus: 'DEPLOYED',
    qaStatus: 'PASS',
    personalizedBaseUrl: 'https://magicscript.fr',
  });

  assert.equal(failedQa.personalizedEntryEnabled, false);
  assert.equal(unsafeUrl.personalizedEntryEnabled, false);
});

test('keeps the demo link but waits for a configured Magic Script base URL', () => {
  const result = buildPersonalizedEntryLinks({
    prospectId,
    companyName: 'PAULINE COIFFURE',
    prototypeUrl,
    prototypeStatus: 'DEPLOYED',
    qaStatus: 'PASS',
  });

  assert.equal(result.personalizedEntryEnabled, false);
  assert.equal(result.prototypeUrl, prototypeUrl);
  assert.deepEqual(result.links, [{ label: 'Voir votre proposition', url: prototypeUrl }]);
});

test('rejects a non-opaque prospect identifier and never places it in a URL', () => {
  const result = buildPersonalizedEntryLinks({
    prospectId: 'stephanemire75@gmail.com',
    companyName: 'PAULINE COIFFURE',
    prototypeUrl,
    prototypeStatus: 'DEPLOYED',
    qaStatus: 'PASS',
    personalizedBaseUrl: 'https://magicscript.fr',
  });

  assert.equal(result.personalizedEntryEnabled, false);
  assert.equal(result.personalizedUrl, null);
  assert.equal(result.links.length, 1);
});

test('uses a deterministic collision suffix without exposing the full prospect id', () => {
  const result = buildPersonalizedEntryLinks({
    prospectId,
    companyName: 'PAULINE COIFFURE',
    prototypeUrl,
    prototypeStatus: 'DEPLOYED',
    qaStatus: 'PASS',
    personalizedBaseUrl: 'https://magicscript.fr',
    allCompanyNames: ['PAULINE COIFFURE', 'PAULINE COIFFURE'],
  });

  assert.match(result.salesRoomSlug ?? '', /^pauline-coiffure-/i);
  assert.doesNotMatch(result.salesRoomUrl ?? '', new RegExp(prospectId));
});
