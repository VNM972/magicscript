import test from 'node:test';
import assert from 'node:assert/strict';

import { isFixtureOrInternalName, NETLIFY_DEPLOY_FIXTURE_BLOCKLIST } from './deploy-guardrail';

test('deploy guardrail: blocklist tokens are frozen', () => {
  assert.deepEqual([...NETLIFY_DEPLOY_FIXTURE_BLOCKLIST], [
    'SNEMM', 'FIXTURE', 'SYNTHETIC', 'DEMO', 'TEST', 'SAMPLE', 'MOCK', 'EXAMPLE',
  ]);
});

test('deploy guardrail: refuses empty, undefined, null and fixture-like names', () => {
  const refused = ['SNEMM', 'snemm', 'SNEMM SARL', 'FIXTURE-01', 'DEMO SITE',
    'Ma Demo SARL', 'Le Testeur SARL', 'SYNTHETIC_PROSPECT', 'sample data',
    'MOCK-1', 'example.com', '', '   '];
  for (const name of refused) {
    assert.equal(isFixtureOrInternalName(name), true, `doit refuser: ${JSON.stringify(name)}`);
  }
  assert.equal(isFixtureOrInternalName(null), true);
  assert.equal(isFixtureOrInternalName(undefined), true);
});

test('deploy guardrail: accepts real prospect names', () => {
  const accepted = ['PAULINE COIFFURE', 'Ananke Tattoo', 'Caf? des Aliz?s',
    "SUN'FLY", 'FUTURE MARTINIQUE', 'Candide', 'LADYBUG CAFE',
    'KAY JUJU BIS', 'STATION VITOIS', 'MIRE STEPHANE'];
  for (const name of accepted) {
    assert.equal(isFixtureOrInternalName(name), false, `doit accepter: ${JSON.stringify(name)}`);
  }
});
