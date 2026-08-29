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
  assert.equal(isMagicScriptTargetActivity('56.10A'), true);
  assert.equal(isMagicScriptTargetActivity('43.22B'), true);
  assert.equal(isMagicScriptTargetActivity('96.02A'), true);
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
