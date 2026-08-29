import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreProspect } from '../scoring/prospect-score';

test('priority prospects can become auto-prototype eligible', () => {
  const result = scoreProspect({
    digitalGap: 95,
    commercialStrength: 90,
    contactability: 90,
    localFit: 90,
    prototypeLeverage: 95,
    confidence: 90,
  });

  assert.equal(result.band, 'PRIORITY');
  assert.equal(result.autoPrototypeEligible, true);
});

test('low confidence blocks automatic prototypes', () => {
  const result = scoreProspect({
    digitalGap: 100,
    commercialStrength: 100,
    contactability: 100,
    localFit: 100,
    prototypeLeverage: 100,
    confidence: 20,
  });

  assert.equal(result.autoPrototypeEligible, false);
});
