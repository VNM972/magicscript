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

test('operator exclusions cover all sixteen businesses and their legal aliases', () => {
  const names = [
    'SNEMM', "Société Nationale d'Entraide de la Médaille Militaire",
    "SOCIETE NATIONALE D'ENTRAIDE DE LA MEDAILLE MILITAIRE (SNEMM)",
    "L'Univers du Pneu", 'NORD PNEU CARAIBES',
    "Guy Hoquet L'Immobilier", 'MENHIR IMMOBILIER FRANCHISE',
    'La Balade du Soleil', 'SOMARLOC', 'SOCIETE MARTINIQUAISE DE LOCATION (SOMARLOC)',
    'YOUYOU MARKET', 'SASU-YOUYOU-MARKET', 'APAVE', 'APAVE EXPLOITATION FRANCE',
    'APAVE INFRASTRUCTURES ET CONSTRUCTION FRANCE',
    'GROUPE FONTAINE COMPTABILITE ET ADMINISTRATION',
    'SOC FIDUCIAIRE NAT JURIDIQUE FISCALE', 'FIDUCIAL SOFIRAL AVOCATS',
    'SOC FIDUCIAIRE NAT JURIDIQUE FISCALE (FIDUCIAL SOFIRAL AVOCATS)',
    'STATION VITO', 'ENVIE D AILLEURS', 'E D A FEELING', 'JEAN-PIERRE EUVRARD',
    'RODOLPHO ALEXANDER', 'LADYBUG', 'KAY JUJU', "Aux Deux Gouttes d'Eau",
  ];
  for (const name of names) {
    assert.equal(classifyDoNotProspectIdentity({ companyName: name })?.decision, 'OPERATOR_EXCLUDED', name);
    assert.equal(classifyDoNotProspectIdentity({ legalName: name })?.decision, 'OPERATOR_EXCLUDED', name);
  }
});

test('stable operator identities match renamed businesses and other establishments', () => {
  const sirets = [
    '52192424100016', '51870544700010', '44471474500015', '84274162100010',
    '75355242100012', '51391970400017', '41113428100012', '83030240200011',
    '82113215600018', '92024781400014',
  ];
  for (const siret of sirets) {
    assert.equal(classifyDoNotProspectIdentity({ siret })?.decision, 'OPERATOR_EXCLUDED');
    const match = classifyDoNotProspectIdentity({ companyName: 'Nouveau libellé', siren: siret.slice(0, 9), siret: `${siret.slice(0, 9)}99999` });
    assert.equal(match?.decision, 'OPERATOR_EXCLUDED');
    assert.equal(match?.matchedBy, 'SIREN');
  }
  for (const websiteUrl of ['https://www.snemm.fr/contact', 'https://labaladedusoleil.com/', 'https://find-us.apave.com/fr/martinique']) {
    assert.equal(classifyDoNotProspectIdentity({ websiteUrl })?.decision, 'OPERATOR_EXCLUDED');
  }
});

test('operator aliases and domains never exclude unrelated names or shared registries', () => {
  for (const companyName of ['Partenaire de SNEMM', 'LADYBUG CAFE', 'KAY JUJU BIS', 'STATION VITOIS']) {
    assert.equal(classifyDoNotProspectIdentity({ companyName }), null);
  }
  for (const websiteUrl of ['https://annuaire-entreprises.data.gouv.fr/etablissement/123', 'https://recherche-entreprises.api.gouv.fr/search?q=autre', 'https://snemm.fr.example.test/']) {
    assert.equal(classifyDoNotProspectIdentity({ websiteUrl }), null);
  }
});

test('BEAUTY_FIXTURE remains an internal synthetic identity', () => {
  for (const candidate of [{ companyName: 'BEAUTY_FIXTURE' }, { siren: '623456789' }, { siret: '62345678900003' }]) {
    assert.equal(classifyDoNotProspectIdentity(candidate)?.decision, 'INTERNAL');
    assert.equal(classifyDoNotProspectIdentity(candidate)?.entityKey, 'BEAUTY_FIXTURE');
  }
});
