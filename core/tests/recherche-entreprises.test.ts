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


test('builds an authenticated-free filtered search request', async () => {
  const { RechercheEntreprisesClient } = await import(
    '../providers/recherche-entreprises'
  );

  let capturedUrl = '';
  let capturedUserAgent = '';

  const client = new RechercheEntreprisesClient(
    'https://example.test',
    async (input, init) => {
      capturedUrl = String(input);
      const headers = new Headers(init?.headers);
      capturedUserAgent = headers.get('user-agent') ?? '';

      return new Response(
        JSON.stringify({
          results: [],
          total_results: 0,
          page: 2,
          per_page: 25,
          total_pages: 1,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  );

  await client.search({
    departement: '972',
    sections: ['F', 'G', 'I'],
    page: 2,
    perPage: 100,
  });

  const url = new URL(capturedUrl);

  assert.equal(url.searchParams.get('departement'), '972');
  assert.equal(url.searchParams.get('etat_administratif'), 'A');
  assert.equal(url.searchParams.get('section_activite_principale'), 'F,G,I');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('per_page'), '25');
  assert.equal(url.searchParams.get('minimal'), 'true');
  assert.equal(url.searchParams.get('include'), 'siege');
  assert.match(capturedUserAgent, /MagicScript\/0\.2/);
});
