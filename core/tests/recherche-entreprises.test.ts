import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RechercheEntreprisesClient,
  rechercheEntrepriseActivity,
  rechercheEntrepriseLocation,
  rechercheEntrepriseMatchingEtablissement,
  rechercheEntrepriseName,
  rechercheEntrepriseSourceUrl,
} from '../providers/recherche-entreprises';

const sample = {
  siren: '123456789',
  nom_complet: 'ENTREPRISE TEST',
  activite_principale: '70.22Z',
  siege: {
    siret: '12345678900010',
    adresse: '10 RUE SIEGE 75001 PARIS',
    code_postal: '75001',
    departement: '75',
    activite_principale: '70.22Z',
  },
  matching_etablissements: [
    {
      siret: '12345678900028',
      adresse: '12 RUE LOCALE 97200 FORT-DE-FRANCE',
      code_postal: '97200',
      departement: '972',
      libelle_commune: 'FORT-DE-FRANCE',
      activite_principale: '56.10A',
      etat_administratif: 'A',
      nom_commercial: 'CHEZ TEST',
    },
  ],
};

test('selects the Martinique establishment instead of an off-island head office', () => {
  const establishment = rechercheEntrepriseMatchingEtablissement(sample, '972');

  assert.equal(establishment?.siret, '12345678900028');
  assert.equal(rechercheEntrepriseName(sample, establishment), 'CHEZ TEST');
  assert.equal(
    rechercheEntrepriseLocation(sample, establishment),
    '12 RUE LOCALE 97200 FORT-DE-FRANCE',
  );
  assert.equal(
    rechercheEntrepriseActivity(sample, establishment),
    '56.10A',
  );
});

test('builds the official local establishment source URL', () => {
  const establishment = rechercheEntrepriseMatchingEtablissement(sample, '972');

  assert.equal(
    rechercheEntrepriseSourceUrl(sample, establishment),
    'https://annuaire-entreprises.data.gouv.fr/etablissement/12345678900028',
  );
});

test('builds a no-key establishment-filtered search request', async () => {
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
  assert.equal(url.searchParams.get('include'), 'matching_etablissements');
  assert.equal(url.searchParams.get('limite_matching_etablissements'), '10');
  assert.equal(url.searchParams.has('categorie_entreprise'), false);
  assert.equal(url.searchParams.has('activite_principale'), false);
  assert.match(capturedUserAgent, /MagicScript\/0\.2/);
});

test('binds the default fetch to the worker global', async () => {
  const originalFetch = globalThis.fetch;
  let receivedThis: unknown;

  globalThis.fetch = function (this: typeof globalThis) {
    receivedThis = this;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          results: [],
          total_results: 0,
          page: 1,
          per_page: 1,
          total_pages: 1,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  } as typeof fetch;

  try {
    const client = new RechercheEntreprisesClient('https://example.test');
    await client.search({ departement: '972', perPage: 1 });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(receivedThis, globalThis);
});

test('rejects a matching establishment outside Martinique', () => {
  const establishment = rechercheEntrepriseMatchingEtablissement(
    {
      ...sample,
      matching_etablissements: [
        {
          siret: '12345678900010',
          code_postal: '75001',
          departement: '75',
          etat_administratif: 'A',
        },
      ],
    },
    '972',
  );

  assert.equal(establishment, undefined);
});

async function capturedSearch(input: Parameters<RechercheEntreprisesClient['search']>[0]) {
  let capturedUrl = '';
  const client = new RechercheEntreprisesClient('https://example.test', async (url) => {
    capturedUrl = String(url);
    return Response.json({ results: [], total_results: 0, page: 1, total_pages: 1 });
  });
  await client.search(input);
  return new URL(capturedUrl).searchParams;
}

test('serializes the optional PME category without adding an activity restriction', async () => {
  const params = await capturedSearch({ departement: '972', companyCategory: 'PME' });
  assert.equal(params.get('categorie_entreprise'), 'PME');
  assert.equal(params.has('activite_principale'), false);
});

test('serializes every exact activity code as a comma-separated list', async () => {
  const codes = ['56.10A', '56.10B', '56.10C', '56.21Z', '56.29A', '56.29B', '56.30Z'];
  const params = await capturedSearch({ departement: '972', activityCodes: codes });
  assert.equal(params.get('activite_principale'), codes.join(','));
  assert.deepEqual(params.get('activite_principale')?.split(','), codes);
  assert.equal(params.has('categorie_entreprise'), false);
});

test('exact retail codes stay exact with PME and emit no division wildcard', async () => {
  const codes = ['47.11A', '47.78C', '47.99B'] as const;
  const params = await capturedSearch({ departement: '972', companyCategory: 'PME', activityCodes: codes });
  assert.equal(params.get('categorie_entreprise'), 'PME');
  assert.equal(params.get('activite_principale'), '47.11A,47.78C,47.99B');
  assert.doesNotMatch(params.toString(), /\*|%2A/i);
  assert.equal(params.has('section_activite_principale'), false);
});

test('omitted and empty new options preserve the original provider query', async () => {
  const input = { departement: '972', sections: ['F', 'G', 'I'], page: 2, perPage: 7 };
  const original = await capturedSearch(input);
  const empty = await capturedSearch({ ...input, companyCategory: '', activityCodes: [] });
  assert.deepEqual([...empty], [...original]);
  assert.deepEqual([...original], [
    ['departement', '972'], ['etat_administratif', 'A'], ['page', '2'], ['per_page', '7'],
    ['minimal', 'true'], ['include', 'matching_etablissements'], ['limite_matching_etablissements', '10'],
    ['section_activite_principale', 'F,G,I'],
  ]);
});
