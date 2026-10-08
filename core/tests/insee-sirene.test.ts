import test from 'node:test';
import assert from 'node:assert/strict';

import {
  currentSirenePeriod,
  isMagicScriptTargetActivity,
  sireneBusinessName,
  sireneLocation,
} from '../providers/insee-sirene';

test('selects the active SIRENE establishment period', () => {
  const period = currentSirenePeriod({
    siren: '123456789',
    siret: '12345678900011',
    periodesEtablissement: [
      {
        etatAdministratifEtablissement: 'F',
        activitePrincipaleEtablissement: '00.00Z',
      },
      {
        etatAdministratifEtablissement: 'A',
        activitePrincipaleEtablissement: '56.10A',
      },
    ],
  });

  assert.equal(period?.etatAdministratifEtablissement, 'A');
  assert.equal(period?.activitePrincipaleEtablissement, '56.10A');
});

test('filters activities toward Magic Script local-business targets', () => {
  // Cible reelle (Phase C-2) : 45,47,55,56,95,96 + 90.03B exact
  assert.equal(isMagicScriptTargetActivity('56.10A'), true);
  assert.equal(isMagicScriptTargetActivity('47.11A'), true);
  assert.equal(isMagicScriptTargetActivity('45.20A'), true);
  assert.equal(isMagicScriptTargetActivity('55.20Z'), true);
  assert.equal(isMagicScriptTargetActivity('95.22Z'), true);
  assert.equal(isMagicScriptTargetActivity('96.02A'), true);
  assert.equal(isMagicScriptTargetActivity('90.03B'), true); // tatouage/piercing

  // Hors cible
  assert.equal(isMagicScriptTargetActivity('43.22B'), false); // construction
  assert.equal(isMagicScriptTargetActivity('68.20B'), false); // immobilier
  assert.equal(isMagicScriptTargetActivity('71.11Z'), false); // architecte
  assert.equal(isMagicScriptTargetActivity('90.02Z'), false); // SACEM / arts
  assert.equal(isMagicScriptTargetActivity('01.11Z'), false);
  assert.equal(isMagicScriptTargetActivity(undefined), false);
});

test('prefers public trade name and formats Martinique location', () => {
  const establishment = {
    siren: '123456789',
    siret: '12345678900011',
    uniteLegale: {
      denominationUniteLegale: 'EXEMPLE SAS',
    },
    adresseEtablissement: {
      codePostalEtablissement: '97200',
      libelleCommuneEtablissement: 'FORT-DE-FRANCE',
    },
    periodesEtablissement: [
      {
        etatAdministratifEtablissement: 'A',
        enseigne1Etablissement: 'Exemple Local',
        activitePrincipaleEtablissement: '56.10A',
      },
    ],
  };

  assert.equal(sireneBusinessName(establishment), 'Exemple Local');
  assert.equal(sireneLocation(establishment), '97200 FORT-DE-FRANCE');
});
