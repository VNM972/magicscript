import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCommercialScope } from '../orchestrator/commercial-scope';

test('classifies the validated fixed-price showcase boundaries', () => {
  assert.deepEqual(
    classifyCommercialScope({
      siteKind: 'SHOWCASE',
      pageCount: 1,
      lightweightFeatures: [],
      complexRequirements: [],
    }),
    {
      packageId: 'STARTER',
      status: 'FIXED',
      reason: 'Single-page showcase site without advanced functionality.',
    },
  );

  assert.equal(
    classifyCommercialScope({
      siteKind: 'SHOWCASE',
      pageCount: 5,
      lightweightFeatures: [],
      complexRequirements: [],
    }).packageId,
    'ESSENTIEL',
  );

  assert.equal(
    classifyCommercialScope({
      siteKind: 'SHOWCASE',
      pageCount: 8,
      lightweightFeatures: [],
      complexRequirements: [],
    }).packageId,
    'BUSINESS',
  );

  assert.equal(
    classifyCommercialScope({
      siteKind: 'SHOWCASE',
      pageCount: 4,
      lightweightFeatures: ['THIRD_PARTY_BOOKING'],
      complexRequirements: [],
    }).packageId,
    'BUSINESS',
  );
});

test('keeps richer showcase work at Premium FROM pricing', () => {
  const ninePages = classifyCommercialScope({
    siteKind: 'SHOWCASE',
    pageCount: 9,
    lightweightFeatures: [],
    complexRequirements: [],
  });

  const multipleFeatures = classifyCommercialScope({
    siteKind: 'SHOWCASE',
    pageCount: 5,
    lightweightFeatures: ['SIMPLE_BLOG', 'LIGHT_INTEGRATION'],
    complexRequirements: [],
  });

  assert.equal(ninePages.packageId, 'PREMIUM');
  assert.equal(ninePages.status, 'FROM');
  assert.equal(multipleFeatures.packageId, 'PREMIUM');
  assert.equal(multipleFeatures.status, 'FROM');
});

test('routes complex requirements to CUSTOM instead of inventing a price', () => {
  for (const result of [
    classifyCommercialScope({
      siteKind: 'ECOMMERCE',
      pageCount: 5,
      lightweightFeatures: [],
      complexRequirements: [],
    }),
    classifyCommercialScope({
      siteKind: 'CUSTOM_APPLICATION',
      pageCount: 3,
      lightweightFeatures: [],
      complexRequirements: [],
    }),
    classifyCommercialScope({
      siteKind: 'SHOWCASE',
      pageCount: 4,
      lightweightFeatures: [],
      complexRequirements: ['CLIENT_PORTAL'],
    }),
  ]) {
    assert.equal(result.packageId, 'CUSTOM');
    assert.equal(result.status, 'CUSTOM');
  }
});

test('fails closed when the structured scope is insufficient', () => {
  const missingKind = classifyCommercialScope({
    siteKind: null,
    pageCount: 4,
    lightweightFeatures: [],
    complexRequirements: [],
  });

  const missingPages = classifyCommercialScope({
    siteKind: 'SHOWCASE',
    pageCount: null,
    lightweightFeatures: [],
    complexRequirements: [],
  });

  const invalidPages = classifyCommercialScope({
    siteKind: 'SHOWCASE',
    pageCount: 0,
    lightweightFeatures: [],
    complexRequirements: [],
  });

  assert.equal(missingKind.status, 'UNKNOWN');
  assert.equal(missingKind.packageId, null);

  assert.equal(missingPages.status, 'UNKNOWN');
  assert.equal(missingPages.packageId, null);

  assert.equal(invalidPages.status, 'UNKNOWN');
  assert.equal(invalidPages.packageId, null);
});
