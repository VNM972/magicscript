import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rechercheEntrepriseActivity,
  rechercheEntrepriseLocation,
  rechercheEntrepriseName,
  rechercheEntrepriseSourceUrl,
} from '../providers/recherche-entreprises';

const sample = {
  siren: '123456789',
  nom_complet: 'ENTREPRISE TEST',
  activite_principale: '56.10A',
  siege: {
    adresse: '10 RUE TEST 97200 FORT-DE-FRANCE',
    activite_principale: '56.10A',
  },
};

test('maps a public directory result to Magic Script discovery fields', () => {
  assert.equal(rechercheEntrepriseName(sample), 'ENTREPRISE TEST');
  assert.equal(
    rechercheEntrepriseLocation(sample),
    '10 RUE TEST 97200 FORT-DE-FRANCE',
  );
  assert.equal(rechercheEntrepriseActivity(sample), '56.10A');
});

test('builds a public source URL from the SIREN', () => {
  assert.equal(
    rechercheEntrepriseSourceUrl('123456789'),
    'https://recherche-entreprises.api.gouv.fr/search?q=123456789',
  );
});
