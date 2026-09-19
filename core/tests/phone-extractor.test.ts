import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractPhoneEvidence,
  extractPhoneFromJsonLd,
  extractPhoneFromVisibleText,
  normalizePhoneDigits,
} from '../research/phone-extractor';

const SOURCE = 'https://example.fr/contact';

test('extractor prioritizes tel href over JSON-LD and visible text', () => {
  const evidence = extractPhoneEvidence(`
    <a href="tel:+596 596 71 10 10">Call</a>
    <script type="application/ld+json">{"telephone":"0596000000"}</script>
    <p>Accueil: 05 96 22 22 22</p>
  `, SOURCE);

  assert.equal(evidence?.evidenceType, 'TEL_HREF');
  assert.equal(evidence?.phone, '+596596711010');
  assert.equal(evidence?.normalizedDigits, '596596711010');
  assert.equal(evidence?.evidenceOrigin, 'FETCHED_SOURCE');
  assert.equal(evidence?.independentlyObserved, true);
});

test('extractor reads nested JSON-LD telephone deterministically', () => {
  const evidence = extractPhoneFromJsonLd(
    JSON.stringify({ '@graph': [{ '@type': 'LocalBusiness', telephone: '05 96 71 10 10' }] }),
    SOURCE,
  );
  assert.equal(evidence?.evidenceType, 'JSON_LD_TELEPHONE');
  assert.equal(evidence?.normalizedDigits, '0596711010');
});

test('visible-text extraction ignores scripts, styles, and tel-anchor labels', () => {
  const evidence = extractPhoneFromVisibleText(`
    <script>const fake = '06 12 34 56 78';</script>
    <style>.fake { content: '05 96 00 00 00'; }</style>
    <a href="tel:0596111111">05 96 11 11 11</a>
    <p>Standard: 05 96 71 10 10</p>
  `, SOURCE);
  assert.equal(evidence?.evidenceType, 'VISIBLE_PAGE_TEXT');
  assert.equal(evidence?.normalizedDigits, '0596711010');
});

test('extractor rejects non-phone text and normalization is stable', () => {
  assert.equal(extractPhoneEvidence('<p>SIRET 123 456 789 00012</p>', SOURCE), null);
  assert.equal(normalizePhoneDigits('00 596 596 71 10 10'), '596596711010');
});
