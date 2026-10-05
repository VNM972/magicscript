import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enrichResearchResultWithPhoneEvidence,
  selectPhoneEvidenceCandidateUrls,
} from './phone-evidence';

test('candidate selection is ordered, deduplicated, and bounded to three pages', () => {
  const urls = selectPhoneEvidenceCandidateUrls({
    phoneSourceUrl: 'https://example.fr/contact',
    websiteUrl: 'https://example.fr/',
    sources: [
      { url: 'https://example.fr/contact', note: 'Contact', supports: ['phone'] },
      { url: 'https://example.fr/nous-contacter', note: 'Coordonnées', supports: ['website'] },
      { url: 'https://directory.example/prospect', note: 'Contact listing', supports: ['contactability'] },
      { url: 'https://fourth.example/contact', note: 'Contact', supports: ['phone'] },
    ],
  });

  assert.deepEqual(urls, [
    'https://example.fr/contact',
    'https://example.fr/nous-contacter',
    'https://directory.example/prospect',
  ]);
});

test('model-authored derivedPhoneEvidence is stripped when no fetched phone exists', async () => {
  const result = await enrichResearchResultWithPhoneEvidence({
    phone: '06 12 34 56 78',
    phoneSourceUrl: 'https://example.fr/contact',
    derivedPhoneEvidence: {
      phone: '06 12 34 56 78',
      independentlyObserved: true,
      evidenceOrigin: 'FETCHED_SOURCE',
    },
    sources: [{ url: 'https://example.fr/contact', note: 'Contact', supports: ['phone', 'contactability'] }],
  }, async (url) => ({
    ok: true,
    url,
    finalUrl: url,
    text: '<p>No public phone here.</p>',
    contentType: 'text/html',
  }));

  assert.equal(result.derivedPhoneEvidence, undefined);
});

test('independently fetched content attaches typed evidence and a deterministic source', async () => {
  const result = await enrichResearchResultWithPhoneEvidence({
    phone: '06 12 34 56 78',
    phoneSourceUrl: 'https://example.fr/contact',
    websiteUrl: 'https://example.fr/',
    sources: [{ url: 'https://example.fr/contact', note: 'Contact page', supports: ['website'] }],
  }, async (url) => ({
    ok: true,
    url,
    finalUrl: url,
    text: '<a href="tel:0596711010">Appelez-nous</a>',
    contentType: 'text/html',
  }));

  assert.deepEqual(result.derivedPhoneEvidence, {
    phone: '0596711010',
    normalizedDigits: '0596711010',
    sourceUrl: 'https://example.fr/contact',
    evidenceType: 'TEL_HREF',
    evidenceOrigin: 'FETCHED_SOURCE',
    independentlyObserved: true,
    sourceOwnership: 'OWNED_BUSINESS_SOURCE',
    entityBound: true,
  });
  assert.ok((result.sources as Array<{ supports: string[] }>).some(
    (source) => source.supports.includes('phone'),
  ));
});
