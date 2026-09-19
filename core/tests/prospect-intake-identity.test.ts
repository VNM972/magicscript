import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalProspectDomain,
  classifyDoNotProspectIdentity,
} from '../orchestrator/prospect-intake-identity';

test('known project matching follows stable SIRET, SIREN, then domain identity', () => {
  assert.deepEqual(
    classifyDoNotProspectIdentity({
      companyName: 'Un libellé sans rapport',
      siren: '831275631',
      siret: '83127563100024',
    }),
    { entityKey: 'SUNELEK', decision: 'KNOWN_PROJECT', matchedBy: 'SIRET' },
  );
  assert.deepEqual(
    classifyDoNotProspectIdentity({
      companyName: 'Autre établissement SUNELEK',
      siren: '831275631',
      siret: '83127563199999',
    }),
    { entityKey: 'SUNELEK', decision: 'KNOWN_PROJECT', matchedBy: 'SIREN' },
  );
  assert.deepEqual(
    classifyDoNotProspectIdentity({
      companyName: 'Libellé externe',
      websiteUrl: 'https://www.sunelek-caraibes.com/contact',
    }),
    { entityKey: 'SUNELEK', decision: 'KNOWN_PROJECT', matchedBy: 'DOMAIN' },
  );
});

test('display aliases are exact defensive matches, not contains rules', () => {
  assert.equal(
    classifyDoNotProspectIdentity({ companyName: 'SUNELEK Caraïbes' })
      ?.matchedBy,
    'DISPLAY_ALIAS',
  );
  assert.equal(
    classifyDoNotProspectIdentity({ companyName: 'Partenaire de SUNELEK' }),
    null,
  );
});

test('Magic Script stable business identity is INTERNAL', () => {
  assert.deepEqual(
    classifyDoNotProspectIdentity({
      companyName: 'MIRE STEPHANE',
      siren: '504 451 477',
      siret: '504 451 477 00039',
    }),
    { entityKey: 'MAGIC_SCRIPT', decision: 'INTERNAL', matchedBy: 'SIRET' },
  );
  assert.equal(canonicalProspectDomain('https://www.magicscript.fr/a'), 'magicscript.fr');
});
