import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { D1ProspectRepository } from '../../../core/persistence/d1-prospect-repository.ts';
import worker from './index.ts';

class FixtureD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(
      readFileSync(
        new URL('../../../database/schema.sql', import.meta.url),
        'utf8',
      ),
    );
  }

  prepare(sql) {
    let values = [];
    const result = {
      bind: (...args) => {
        values = args;
        return result;
      },
      first: async () => this.database.prepare(sql).get(...values) ?? null,
      all: async () => ({ results: this.database.prepare(sql).all(...values) }),
      run: async () => this.database.prepare(sql).run(...values),
    };
    return result;
  }

  close() {
    this.database.close();
  }
}

function directoryResult({
  siren,
  siret,
  name,
  activity = '56.10A',
  publicEntity = false,
}) {
  return {
    siren,
    nom_complet: name,
    nom_raison_sociale: name,
    etat_administratif: 'A',
    activite_principale: activity,
    categorie_entreprise: 'PME',
    tranche_effectif_salarie: '01',
    nombre_etablissements_ouverts: 1,
    nature_juridique: '5710',
    date_creation: '2025-01-01',
    est_service_public: publicEntity,
    siege: {
      siret,
      activite_principale: activity,
      est_siege: true,
      etat_administratif: 'A',
      code_postal: '97200',
      libelle_commune: 'FORT-DE-FRANCE',
      departement: '972',
      adresse: '1 RUE TEST 97200 FORT-DE-FRANCE',
    },
    matching_etablissements: [
      {
        siret,
        activite_principale: activity,
        est_siege: true,
        etat_administratif: 'A',
        code_postal: '97200',
        libelle_commune: 'FORT-DE-FRANCE',
        departement: '972',
        adresse: '1 RUE TEST 97200 FORT-DE-FRANCE',
      },
    ],
  };
}

const safeEnv = (db) => ({
  DB: db,
  MAGICSCRIPT_API_TOKEN: 'fixture-api',
  MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
  MAGICSCRIPT_SENDING_ENABLED: 'false',
  MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
});

const preflightUrl = 'http://local.test/api/internal/provider-preflight/recherche-entreprises';
const preflightRequest = (token = 'fixture-api') => new Request(preflightUrl, {
  headers: { authorization: `Bearer ${token}` },
});

test('provider preflight requires a configured API token and rejects an invalid token', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls += 1; throw new Error('must not fetch'); };
    const missing = await worker.fetch(new Request(preflightUrl), safeEnv(db));
    const invalid = await worker.fetch(preflightRequest('wrong-token'), safeEnv(db));
    const unconfigured = await worker.fetch(preflightRequest(), {
      ...safeEnv(db), MAGICSCRIPT_API_TOKEN: undefined,
    });
    assert.deepEqual([missing.status, invalid.status, unconfigured.status], [401, 401, 401]);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('provider preflight uses the first-wave request and returns metadata without D1 mutation', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  try {
    db.database.prepare("INSERT INTO provider_state (provider, key, value, updated_at) VALUES (?, ?, ?, ?)")
      .run('recherche-entreprises', 'martinique-first-wave-page', '7', '2026-09-27T00:00:00.000Z');
    const changesBefore = db.database.prepare('SELECT total_changes() AS changes').get().changes;
    let providerCalls = 0;
    globalThis.fetch = async (input, init) => {
      providerCalls += 1;
      const url = new URL(String(input));
      assert.equal(url.origin + url.pathname, 'https://recherche-entreprises.api.gouv.fr/search');
      assert.deepEqual([...url.searchParams], [
        ['departement', '972'], ['etat_administratif', 'A'], ['page', '1'],
        ['per_page', '5'], ['minimal', 'true'], ['include', 'matching_etablissements'],
        ['limite_matching_etablissements', '10'], ['section_activite_principale', 'G,I,S'],
      ]);
      assert.equal(init?.method, undefined);
      assert.equal(new Headers(init?.headers).get('accept'), 'application/json');
      assert.equal(new Headers(init?.headers).get('user-agent'), 'MagicScript/0.2 (+https://magicscript.fr)');
      return Response.json({
        results: [directoryResult({ siren: '123456789', siret: '12345678900010', name: 'PRIVATE BUSINESS' })],
        total_results: 1, page: 1, per_page: 5, total_pages: 1,
      });
    };
    const response = await worker.fetch(preflightRequest(), safeEnv(db));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true, provider: 'recherche-entreprises', phase: 'first-wave-page-1',
      httpStatus: 200, schemaValid: true, resultCount: 1,
    });
    assert.equal(providerCalls, 1);
    assert.equal(db.database.prepare('SELECT total_changes() AS changes').get().changes, changesBefore);
    assert.equal(db.database.prepare("SELECT value FROM provider_state WHERE provider = 'recherche-entreprises' AND key = 'martinique-first-wave-page'").get().value, '7');
    for (const table of ['prospects', 'jobs', 'events']) {
      assert.equal(db.database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0);
    }
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('provider preflight preserves upstream HTTP failure status and reference', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  try {
    const changesBefore = db.database.prepare('SELECT total_changes() AS changes').get().changes;
    globalThis.fetch = async () => Response.json(
      { erreur: 'internal error; reference = test123' }, { status: 503 },
    );
    const response = await worker.fetch(preflightRequest(), safeEnv(db));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      ok: false, provider: 'recherche-entreprises', phase: 'first-wave-page-1',
      httpStatus: 503, errorType: 'PROVIDER_HTTP',
      errorName: 'RechercheEntreprisesApiError',
      errorMessage: 'internal error; reference = test123',
      providerBodySummary: 'internal error; reference = test123',
    });
    assert.equal(db.database.prepare('SELECT total_changes() AS changes').get().changes, changesBefore);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('provider preflight identifies pre-response transport failures without inventing status', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  try {
    const changesBefore = db.database.prepare('SELECT total_changes() AS changes').get().changes;
    globalThis.fetch = async () => { throw new TypeError('internal error; reference = transport123'); };
    const response = await worker.fetch(preflightRequest(), safeEnv(db));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      ok: false, provider: 'recherche-entreprises', phase: 'first-wave-page-1',
      httpStatus: null, errorType: 'TRANSPORT_RUNTIME', errorName: 'TypeError',
      errorMessage: 'internal error; reference = transport123',
    });
    assert.equal(db.database.prepare('SELECT total_changes() AS changes').get().changes, changesBefore);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('safe manual intake is identity-bound, local-only, and operator-visible before CURRENT', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  try {
    const repository = new D1ProspectRepository(db);
    await repository.saveProspect({
      id: 'existing-history',
      companyName: 'EXISTING BUSINESS',
      legalName: 'EXISTING BUSINESS',
      siren: '111111111',
      siret: '11111111100011',
      city: 'FORT-DE-FRANCE',
      sourceUrl:
        'https://annuaire-entreprises.data.gouv.fr/etablissement/11111111100011',
      activity: '56.10A',
      location: '97200 FORT-DE-FRANCE',
      state: 'DISCOVERED',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
    });

    let servedInitialPage = false;
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get('page'));
      const results = page === 1 && !servedInitialPage && url.searchParams.get('activite_principale')?.startsWith('56.10A')
        ? [
            directoryResult({
              siren: '831275631',
              siret: '83127563100024',
              name: 'SUNeLEK - WhatsApp E2E',
            }),
            directoryResult({
              siren: '504451477',
              siret: '50445147700039',
              name: 'MIRE STEPHANE',
            }),
            directoryResult({
              siren: '111111111',
              siret: '11111111100011',
              name: 'DUPLICATE SIRET',
            }),
            directoryResult({
              siren: '111111111',
              siret: '11111111199999',
              name: 'DUPLICATE SIREN',
            }),
            directoryResult({
              siren: '222222222',
              siret: undefined,
              name: 'IDENTITE INCOMPLETE',
            }),
            directoryResult({
              siren: '333333333',
              siret: '33333333300033',
              name: 'SERVICE PUBLIC',
              publicEntity: true,
            }),
            directoryResult({
              siren: '444444444',
              siret: '44444444400044',
              name: 'ENTREPRISE LOCALE LEGITIME',
            }),
          ]
        : [];
      if (results.length) servedInitialPage = true;
      return Response.json({
        results,
        total_results: 7,
        page,
        per_page: 20,
        total_pages: 2,
      });
    };

    const response = await worker.fetch(
      new Request('http://local.test/api/discovery/manual-intake', {
        method: 'POST',
        headers: { authorization: 'Bearer fixture-api' },
      }),
      safeEnv(db),
    );
    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.deepEqual(payload.safety, {
      autopilotEnabled: false,
      sendingEnabled: false,
      prototypeDeploymentEnabled: false,
      paidApiUsed: false,
      realContactOccurred: false,
      remoteMutationOccurred: false,
      fallbackProviderUsed: false,
    });
    assert.deepEqual(payload.funnel, {
      pagesScanned: 2,
      rawScanned: 7,
      targetActivityCandidates: 3,
      knownProjectExcluded: 1,
      internalExcluded: 1,
      duplicatesExcluded: 2,
      invalidExcluded: 1,
      outOfScopeExcluded: 0,
      otherExcluded: 0,
      newProspectsCreated: 1,
    });
    const publicRejection = db.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.hard_rejected' AND json_extract(payload_json, '$.siret') = ?")
      .get('33333333300033');
    assert.equal(JSON.parse(publicRejection.payload_json).reason, 'SECTEUR_PUBLIC');
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects WHERE siret = ?').get('33333333300033').count, 0);
    assert.equal(payload.createdProspects[0].siren, '444444444');
    assert.equal(payload.createdProspects[0].siret, '44444444400044');
    assert.equal(payload.createdProspects[0].lifecycle, 'DISCOVERED');
    assert.match(payload.createdProspects[0].sourceUrl, /44444444400044$/);
    assert.deepEqual(payload.exclusionProof.sunelek, {
      discoveredByProvider: true,
      intakeDecision: 'KNOWN_PROJECT',
      matchedBy: 'SIRET',
      persistedAsNew: false,
      operatorAvailable: false,
    });
    assert.deepEqual(payload.exclusionProof.magicScript, {
      discoveredByProvider: true,
      intakeDecision: 'INTERNAL',
      matchedBy: 'SIRET',
      persistedAsNew: false,
      operatorAvailable: false,
    });

    const prospectsResponse = await worker.fetch(
      new Request('http://local.test/api/prospects', {
        headers: { authorization: 'Bearer fixture-api' },
      }),
      safeEnv(db),
    );
    const prospectsPayload = await prospectsResponse.json();
    const created = prospectsPayload.prospects.find(
      (prospect) => prospect.siren === '444444444',
    );
    assert.equal(created.siret, '44444444400044');
    assert.match(created.sourceUrl, /44444444400044$/);
    assert.equal(created.contactability.status, 'MISSING');
    assert.deepEqual(created.commercialView, {
      category: 'LEGACY',
      gateVersion: 'COMMERCIAL_ELIGIBILITY_V2.6.0',
      reason: 'CURRENT_GATE_PRE_ACTIVE',
    });

    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count,
      2,
      'the historical record is preserved and exactly one new record is added',
    );
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM jobs').get().count,
      0,
    );
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM outreach_messages').get()
        .count,
      0,
    );
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM prototypes').get().count,
      0,
    );
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('manual intake stops at ten creations and never schedules downstream work', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  try {
    globalThis.fetch = async (input) => {
      providerCalls += 1;
      const url = new URL(String(input));
      const page = Number(url.searchParams.get('page'));
      const results = Array.from({ length: 20 }, (_, index) => {
        const siren = String(600000000 + index);
        return directoryResult({
          siren,
          siret: `${siren}${String(index + 1).padStart(5, '0')}`,
          name: `ENTREPRISE TEST ${index + 1}`,
          activity: '47.78C',
        });
      });
      return Response.json({
        results,
        total_results: 60,
        page,
        per_page: 20,
        total_pages: 3,
      });
    };

    const response = await worker.fetch(
      new Request('http://local.test/api/discovery/manual-intake', {
        method: 'POST',
        headers: { authorization: 'Bearer fixture-api' },
      }),
      {
        ...safeEnv(db),
        MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
        MAGICSCRIPT_SENDING_ENABLED: 'true',
        MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'true',
      },
    );
    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(providerCalls, 3);
    assert.equal(payload.funnel.pagesScanned, 1);
    assert.equal(payload.funnel.rawScanned, 60);
    assert.equal(payload.funnel.newProspectsCreated, 10);
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count,
      10,
    );
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM jobs').get().count,
      0,
    );
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM outreach_messages').get()
        .count,
      0,
    );
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM prototypes').get().count,
      0,
    );
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('manual intake stops after three pages or sixty raw businesses without weakening identity', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  try {
    globalThis.fetch = async (input) => {
      providerCalls += 1;
      const url = new URL(String(input));
      const page = Number(url.searchParams.get('page'));
      const perPage = Number(url.searchParams.get('per_page'));
      const results = Array.from({ length: perPage }, (_, index) =>
        directoryResult({
          siren: String(700000000 + page * 100 + index),
          siret: undefined,
          name: `IDENTITE INCOMPLETE ${page}-${index}`,
        }),
      );
      return Response.json({
        results,
        total_results: 60,
        page,
        per_page: perPage,
        total_pages: 3,
      });
    };

    const response = await worker.fetch(
      new Request('http://local.test/api/discovery/manual-intake', {
        method: 'POST',
        headers: { authorization: 'Bearer fixture-api' },
      }),
      safeEnv(db),
    );
    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(providerCalls, 4);
    assert.equal(payload.funnel.pagesScanned, 1);
    assert.equal(payload.funnel.rawScanned, 60);
    assert.equal(payload.funnel.invalidExcluded, 60);
    assert.equal(payload.funnel.newProspectsCreated, 0);
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count,
      0,
    );
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('first-wave selection outranks provider order, then uses bounded research fallback', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  const make = (id, activity) => {
    const siren = String(800000000 + id);
    return directoryResult({ siren, siret: `${siren}00010`, name: `LOCAL BUSINESS ${id}`, activity });
  };
  let providerCalls = 0;
  try {
    await new D1ProspectRepository(db).saveProspect({
      id: 'existing-local', companyName: 'EXISTING LOCAL', siren: '800000090',
      siret: '80000009000010', city: 'FORT-DE-FRANCE',
      sourceUrl: 'https://annuaire-entreprises.data.gouv.fr/etablissement/80000009000010',
      state: 'DISCOVERED', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    });
    const offIsland = make(80, '47.78C');
    offIsland.matching_etablissements[0].departement = '75';
    offIsland.matching_etablissements[0].code_postal = '75000';
    const networkRetail = make(1, '47.72A');
    networkRetail.nom_raison_sociale = 'NETWORK GROUP';
    const publicEntity = make(81, '47.78C');
    publicEntity.est_service_public = true;
    const priorityResults = [make(2, '47.78C'), offIsland, make(3, '45.31Z'),
      networkRetail, make(4, '56.10A'), make(5, '45.20A'), publicEntity];
    const broadResults = [make(6, '56.10A'), make(7, '96.02B'), make(90, '47.78C'),
      make(8, '45.31Z'), make(9, '47.11A'), make(10, '95.29Z'),
      make(11, '47.78C'), make(12, '96.02A')];
    globalThis.fetch = async (input) => {
      providerCalls += 1;
      const url = new URL(String(input));
      assert.equal(url.searchParams.get('departement'), '972');
      const priority = url.searchParams.get('activite_principale')?.startsWith('56.10A');
      return Response.json({
        results: priority ? priorityResults : url.searchParams.has('activite_principale') ? [] : broadResults,
        total_results: 15, page: 1, per_page: 20, total_pages: 1,
      });
    };
    const response = await worker.fetch(
      new Request('http://local.test/api/discovery/manual-intake', {
        method: 'POST', headers: { authorization: 'Bearer fixture-api' },
      }), safeEnv(db),
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(providerCalls, 4);
    assert.equal(payload.funnel.pagesScanned, 1);
    assert.equal(payload.funnel.newProspectsCreated, 10);
    assert.ok(payload.decisions.some((decision) => decision.reason === 'DUPLICATE_SIRET'));
    assert.ok(payload.decisions.some((decision) => decision.reason === 'OUT_OF_SCOPE'));
    const created = payload.decisions.filter((decision) => decision.decision === 'CREATED').map((decision) => decision.companyName);
    assert.ok(created.includes('LOCAL BUSINESS 6'), `LOCAL BUSINESS 6 doit etre cree, recu: ${created.join(',')}`);
    assert.ok(!created.includes('LOCAL BUSINESS 1'));
    assert.ok(created.indexOf('LOCAL BUSINESS 6') < created.indexOf('LOCAL BUSINESS 3'));
    assert.ok(created.indexOf('LOCAL BUSINESS 7') < created.indexOf('LOCAL BUSINESS 3'));
    assert.ok(!created.includes('LOCAL BUSINESS 80'));
    assert.ok(!created.includes('LOCAL BUSINESS 81'));
    const networkEvent = db.database.prepare(
      "SELECT payload_json FROM events WHERE type = 'discovery.hard_rejected' AND json_extract(payload_json, '$.siret') = ?",
    ).get(networkRetail.siege.siret);
    assert.equal(JSON.parse(networkEvent.payload_json).reason, 'RESEAU_NON_AUTONOME');
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects WHERE siret = ?').get(networkRetail.siege.siret).count, 0);
    const publicEvent = db.database.prepare(
      "SELECT payload_json FROM events WHERE type = 'discovery.hard_rejected' AND json_extract(payload_json, '$.siret') = ?",
    ).get(publicEntity.siege.siret);
    assert.equal(JSON.parse(publicEvent.payload_json).reason, 'SECTEUR_PUBLIC');
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects WHERE siret = ?').get(publicEntity.siege.siret).count, 0);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM jobs').get().count, 0);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('a later stratum supplies first-wave candidates before earlier weaker priority results', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  const make = (id, activity) => {
    const siren = String(900000000 + id);
    return directoryResult({ siren, siret: `${siren}00010`, name: `FIRM ${id}`, activity });
  };
  let calls = 0;
  try {
    globalThis.fetch = async (input) => {
      calls += 1;
      const url = new URL(String(input));
      const activityCodes = url.searchParams.get('activite_principale');
      const priority = activityCodes !== null;
      const page = Number(url.searchParams.get('page'));
      const results = priority
        ? activityCodes.startsWith('56.10A') ? [make(1, '47.78C'), make(2, '56.10A')]
          : activityCodes.startsWith('96.02A') ? [make(3, '47.78C'), make(4, '56.10A')] : []
        : [make(5, '96.02B'), make(6, '45.31Z'), make(7, '47.11A'),
          make(8, '45.31Z'), make(9, '45.20A'), make(10, '47.78C')];
      return Response.json({ results, total_results: 10, page,
        per_page: 20, total_pages: priority ? 2 : 1 });
    };
    const response = await worker.fetch(
      new Request('http://local.test/api/discovery/manual-intake', {
        method: 'POST', headers: { authorization: 'Bearer fixture-api' },
      }), safeEnv(db),
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(calls, 4);
    assert.equal(payload.funnel.newProspectsCreated, 10);
    const created = payload.decisions.filter((decision) => decision.decision === 'CREATED').map((decision) => decision.companyName);
    assert.ok(created.slice(0, 2).includes('FIRM 4'), `FIRM 4 (tier 1 strate 1) doit etre dans les 2 premiers, recu: ${created.slice(0, 2).join(',')}`);
    assert.ok(created.includes('FIRM 5') && created.includes('FIRM 2'), `FIRM 5 et FIRM 2 doivent etre crees, recu: ${created.join(',')}`);
    assert.ok(created.indexOf('FIRM 2') < created.indexOf('FIRM 1'));
    const batch = db.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.recherche_entreprises_batch'").get();
    assert.equal(JSON.parse(batch.payload_json).priorityPagesScanned, 3);
    assert.equal(JSON.parse(batch.payload_json).nextPage, 2);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

const diagnosticFixture = (id, options = {}) => {
  const siren = String(810000000 + id);
  return directoryResult({
    siren,
    siret: `${siren}00010`,
    name: options.name ?? `DIAGNOSTIC BUSINESS ${id}`,
    activity: options.activity ?? '47.78C',
    publicEntity: options.publicEntity ?? false,
  });
};

async function withDiagnosticBatch({ priorityPages = [[]], broadPages = [[]], flag, seed }, verify) {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  try {
    if (seed) await seed(db);
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      const activityCodes = url.searchParams.get('activite_principale');
      const page = Number(url.searchParams.get('page'));
      const stratum = activityCodes?.startsWith('56.10A') ? 0 : activityCodes?.startsWith('96.02A') ? 1 : 2;
      const results = activityCodes ? priorityPages[stratum] ?? [] : broadPages[page - 1] ?? [];
      return Response.json({
        results, total_results: results.length, page,
        per_page: Number(url.searchParams.get('per_page')), total_pages: activityCodes ? 1 : broadPages.length,
      });
    };
    const response = await worker.fetch(
      new Request('http://local.test/api/discovery/manual-intake', {
        method: 'POST', headers: { authorization: 'Bearer fixture-api' },
      }),
      { ...safeEnv(db), MAGICSCRIPT_DISCOVERY_CANDIDATE_DIAGNOSTICS: flag },
    );
    assert.equal(response.status, 200);
    const batchRow = db.database.prepare(
      "SELECT payload_json FROM events WHERE type = 'discovery.recherche_entreprises_batch' ORDER BY rowid ASC LIMIT 1",
    ).get();
    assert.ok(batchRow);
    await verify(JSON.parse(batchRow.payload_json), db, await response.json());
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
}

test('candidate diagnostics default off leaves the aggregate batch event unchanged', async () => {
  await withDiagnosticBatch({ priorityPages: [[diagnosticFixture(1)]] }, (batch) => {
    assert.equal(batch.created, 1);
    assert.equal(batch.candidates, 1);
    assert.equal(Object.hasOwn(batch, 'candidateDiagnostics'), false);
  });
});

test('opt-in candidate diagnostic captures created tier and final eligibility', async () => {
  await withDiagnosticBatch({ priorityPages: [[diagnosticFixture(2)]], flag: 'true' }, (batch, db) => {
    const [decision] = batch.candidateDiagnostics.candidateDecisions;
    const created = db.database.prepare("SELECT commercial_eligibility, score FROM prospects WHERE company_name = 'DIAGNOSTIC BUSINESS 2'").get();
    assert.equal(decision.tier, 1);
    assert.equal(decision.finalEligibilityClass, created.commercial_eligibility);
    assert.equal(decision.finalEligibilityScore, created.score);
    assert.equal(decision.outcome, 'CREATED');
    assert.equal(decision.canonicalReason, 'CREATED');
    assert.equal(decision.persistenceAttempted, true);
  });
});

test('canonical rejected candidate retains final class score and reason without save attempt', async () => {
  await withDiagnosticBatch({ priorityPages: [[diagnosticFixture(3, { publicEntity: true })]], flag: 'true' }, (batch, db) => {
    assert.deepEqual(batch.candidateDiagnostics.candidateDecisions, []);
    const event = db.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.hard_rejected'").get();
    assert.deepEqual(JSON.parse(event.payload_json), {
      reason: 'SECTEUR_PUBLIC', siret: '81000000300010', companyName: 'DIAGNOSTIC BUSINESS 3',
    });
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count, 0);
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'discovery.prospect_created'").get().count, 0);
  });
});

test('duplicate candidate records canonical dedupe outcome without persistence attempt', async () => {
  const candidate = diagnosticFixture(4);
  await withDiagnosticBatch({
    priorityPages: [[candidate]], flag: 'true',
    seed: async (db) => new D1ProspectRepository(db).saveProspect({
      id: 'existing-duplicate', companyName: 'EXISTING DUPLICATE',
      siren: candidate.siren, siret: candidate.siege.siret,
      city: 'FORT-DE-FRANCE', sourceUrl: `https://annuaire-entreprises.data.gouv.fr/etablissement/${candidate.siege.siret}`,
      state: 'DISCOVERED', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    }),
  }, (batch) => {
    const [decision] = batch.candidateDiagnostics.candidateDecisions;
    assert.equal(decision.dedupeOutcome, 'DUPLICATE_SIRET');
    assert.equal(decision.canonicalReason, 'DUPLICATE_SIRET');
    assert.equal(decision.outcome, 'DEDUPED');
    assert.equal(decision.persistenceAttempted, false);
  });
});

test('repeated SIRET retains distinct stratified query occurrences', async () => {
  const candidate = diagnosticFixture(5);
  await withDiagnosticBatch({ priorityPages: [[candidate], [candidate]], flag: 'true' }, (batch) => {
    const decisions = batch.candidateDiagnostics.candidateDecisions;
    assert.equal(decisions.length, 2);
    assert.deepEqual(decisions.map((item) => item.occurrence), [1, 2]);
    assert.deepEqual(decisions.map((item) => item.sourcePage), [1, 1]);
    assert.deepEqual(decisions.map((item) => item.sourceWindow), ['FOOD_SERVICE', 'HAIR_BEAUTY']);
    assert.equal(decisions[0].stableIdentity, decisions[1].stableIdentity);
    assert.deepEqual(decisions.map((item) => item.outcome), ['CREATED', 'DEDUPED']);
  });
});

test('repeated SIRET remains separate across priority and broad fallback windows', async () => {
  const candidate = diagnosticFixture(55);
  await withDiagnosticBatch({ priorityPages: [[candidate]], broadPages: [[candidate]], flag: 'true' }, (batch) => {
    const decisions = batch.candidateDiagnostics.candidateDecisions;
    assert.equal(decisions.length, 2);
    assert.deepEqual(decisions.map((item) => item.occurrence), [1, 2]);
    assert.deepEqual(decisions.map((item) => item.sourceWindow), ['FOOD_SERVICE', 'BROAD_FALLBACK']);
    assert.deepEqual(decisions.map((item) => item.sourcePage), [1, 1]);
    assert.equal(decisions[0].stableIdentity, decisions[1].stableIdentity);
    assert.deepEqual(decisions.map((item) => item.outcome), ['CREATED', 'DEDUPED']);
  });
});

test('brand collision diagnostic reflects final effective classification and constraints', async () => {
  const candidate = diagnosticFixture(6, { name: 'COLLISION SALON' });
  await withDiagnosticBatch({
    priorityPages: [[candidate]], flag: 'true',
    seed: async (db) => new D1ProspectRepository(db).saveProspect({
      id: 'existing-brand', companyName: 'COLLISION SALON', brandKey: 'COLLISION SALON',
      siren: '999000001', siret: '99900000100010', city: 'FORT-DE-FRANCE',
      sourceUrl: 'https://annuaire-entreprises.data.gouv.fr/etablissement/99900000100010',
      state: 'DISCOVERED', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    }),
  }, (batch, db) => {
    const [decision] = batch.candidateDiagnostics.candidateDecisions;
    const created = db.database.prepare("SELECT commercial_eligibility, score FROM prospects WHERE siret = ?").get(candidate.siege.siret);
    assert.equal(decision.outcome, 'CREATED');
    assert.equal(decision.finalEligibilityClass, 'RESEARCH');
    assert.equal(decision.finalEligibilityClass, created.commercial_eligibility);
    assert.equal(decision.finalEligibilityScore, created.score);
    assert.ok(decision.constraints.includes('BRAND_COLLISION_DEFERRED'));
  });
});

test('creation cap marks unprocessed normalized candidates as skipped', async () => {
  const candidates = Array.from({ length: 12 }, (_, index) => diagnosticFixture(100 + index));
  await withDiagnosticBatch({ priorityPages: [candidates], flag: 'true' }, (batch) => {
    const decisions = batch.candidateDiagnostics.candidateDecisions;
    assert.equal(decisions.filter((item) => item.outcome === 'CREATED').length, 10);
    const skipped = decisions.filter((item) => item.outcome === 'SKIPPED');
    assert.equal(skipped.length, 2);
    assert.ok(skipped.every((item) => item.canonicalReason === 'CAP_REACHED' && item.persistenceAttempted === false));
  });
});

test('below diagnostic bounds retained count equals all normalized candidates', async () => {
  await withDiagnosticBatch({
    priorityPages: [[diagnosticFixture(8, { activity: '47.78C' })]],
    broadPages: [[diagnosticFixture(9)]], flag: 'true',
  }, (batch) => {
    const diagnostics = batch.candidateDiagnostics;
    assert.equal(diagnostics.complete, true);
    assert.equal(diagnostics.total, 2);
    assert.equal(diagnostics.retained, 2);
    assert.deepEqual(diagnostics.candidateDecisions.map((item) => item.sourceWindow), ['FOOD_SERVICE', 'BROAD_FALLBACK']);
  });
});

test('oversize candidate diagnostic payload reports explicit incomplete evidence', async () => {
  const pages = Array.from({ length: 3 }, (_, page) =>
    Array.from({ length: 25 }, (_, index) => diagnosticFixture(1000 + page * 25 + index, {
      activity: '47.78C', name: `BOUNDED DIAGNOSTIC ${page} ${index} ${'X'.repeat(90)}`,
    })),
  );
  const broad = [Array.from({ length: 25 }, (_, index) => diagnosticFixture(2000 + index, {
    activity: '47.78C', name: `BROAD DIAGNOSTIC ${index} ${'Y'.repeat(90)}`,
  }))];
  await withDiagnosticBatch({ priorityPages: pages, broadPages: broad, flag: 'true' }, (batch) => {
    const diagnostics = batch.candidateDiagnostics;
    assert.equal(diagnostics.total, 45);
    assert.equal(diagnostics.complete, false);
    assert.equal(diagnostics.reason, 'PAYLOAD_LIMIT');
    assert.ok(diagnostics.retained < diagnostics.total);
    assert.equal(diagnostics.retained, diagnostics.candidateDecisions.length);
    assert.ok(new TextEncoder().encode(JSON.stringify(diagnostics)).length <= 16_384);
  });
});

test('false diagnostic flag persists no rejected candidate identity', async () => {
  const rejected = diagnosticFixture(10, { name: 'SOLE TRADER PRIVATE NAME', publicEntity: true });
  await withDiagnosticBatch({ priorityPages: [[rejected]], flag: 'false' }, (batch, db) => {
    const event = db.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.recherche_entreprises_batch'").get().payload_json;
    assert.equal(Object.hasOwn(batch, 'candidateDiagnostics'), false);
    for (const privateValue of [rejected.siege.siret, rejected.nom_complet, 'FORT-DE-FRANCE']) {
      assert.equal(event.includes(privateValue), false);
    }
  });
});

const foodCodes = '56.10A,56.10B,56.10C,56.21Z,56.29A,56.29B,56.30Z';
const beautyCodes = '96.02A,96.02B';
// Frozen NAF rev. 2 division 47, checked against INSEE's official nomenclature.
const retailCodes = '47.11A,47.11B,47.11C,47.11D,47.11E,47.11F,47.19A,47.19B,47.21Z,47.22Z,47.23Z,47.24Z,47.25Z,47.26Z,47.29Z,47.30Z,47.41Z,47.42Z,47.43Z,47.51Z,47.52A,47.52B,47.53Z,47.54Z,47.59A,47.59B,47.61Z,47.62Z,47.63Z,47.64Z,47.65Z,47.71Z,47.72A,47.72B,47.73Z,47.74Z,47.75Z,47.76Z,47.77Z,47.78A,47.78B,47.78C,47.79Z,47.81Z,47.82Z,47.89Z,47.91A,47.91B,47.99A,47.99B';
const stratifiedWindows = ['FOOD_SERVICE', 'HAIR_BEAUTY', 'LOCAL_RETAIL', 'BROAD_FALLBACK'];
const stratifiedKeys = [
  'martinique-first-wave-food-page', 'martinique-first-wave-beauty-page',
  'martinique-first-wave-retail-page', 'martinique-page',
];
const tenEligible = (offset = 3000, activity = '47.78C') =>
  Array.from({ length: 10 }, (_, index) => diagnosticFixture(offset + index, { activity }));

async function withStratifiedCycle({ supply = {}, positions = [2, 7, 11, 13], flag = 'true', failWindow, seed } = {}, verify) {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  const calls = [];
  const stateWrites = [];
  const state = () => Object.fromEntries(db.database.prepare(
    "SELECT key, value FROM provider_state WHERE provider = 'recherche-entreprises' ORDER BY key",
  ).all().map((row) => [row.key, row.value]));
  try {
    for (const [index, key] of stratifiedKeys.entries()) {
      db.database.prepare('INSERT INTO provider_state (provider, key, value, updated_at) VALUES (?, ?, ?, ?)')
        .run('recherche-entreprises', key, String(positions[index]), '2026-09-27T00:00:00.000Z');
    }
    // The obsolete shared cursor is never read or advanced by Strategy C.
    db.database.prepare('INSERT INTO provider_state (provider, key, value, updated_at) VALUES (?, ?, ?, ?)')
      .run('recherche-entreprises', 'martinique-first-wave-page', '99', '2026-09-27T00:00:00.000Z');
    if (seed) await seed(db);
    const prepare = db.prepare.bind(db);
    db.prepare = (sql) => {
      const statement = prepare(sql);
      if (sql.includes('INSERT INTO provider_state')) {
        const bind = statement.bind;
        const run = statement.run;
        let key;
        statement.bind = (...values) => { key = values[1]; return bind(...values); };
        statement.run = async () => {
          const before = state();
          const result = await run();
          stateWrites.push({ key, before, after: state() });
          return result;
        };
      }
      return statement;
    };
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.origin + url.pathname, 'https://recherche-entreprises.api.gouv.fr/search');
      const codes = url.searchParams.get('activite_principale');
      const window = codes === foodCodes ? 'FOOD_SERVICE' : codes === beautyCodes ? 'HAIR_BEAUTY'
        : codes === retailCodes ? 'LOCAL_RETAIL' : 'BROAD_FALLBACK';
      calls.push({ window, url });
      assert.ok(calls.length <= 4, 'a discovery cycle has at most four provider calls');
      if (window === failWindow) return Response.json({ erreur: 'fixture failure' }, { status: 503 });
      const perPage = Number(url.searchParams.get('per_page'));
      const results = [...(supply[window] ?? [])];
      // Fill raw provider pages with invalid identities to exhaust the existing
      // manual raw-scan bound in one cycle without creating eligible supply.
      while (results.length < perPage) {
        results.push(directoryResult({ siren: '820000000', siret: undefined, name: 'INVALID RAW IDENTITY' }));
      }
      return Response.json({ results, total_results: 300, page: Number(url.searchParams.get('page')),
        per_page: perPage, total_pages: 20 });
    };
    const response = await worker.fetch(new Request('http://local.test/api/discovery/manual-intake', {
      method: 'POST', headers: { authorization: 'Bearer fixture-api' },
    }), { ...safeEnv(db), MAGICSCRIPT_DISCOVERY_CANDIDATE_DIAGNOSTICS: flag });
    const payload = await response.json();
    const batches = db.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.recherche_entreprises_batch'")
      .all().map((row) => JSON.parse(row.payload_json));
    if (!failWindow) {
      assert.equal(response.status, 200);
      assert.equal(batches.length, 1);
      assert.equal(payload.funnel.pagesScanned, 1);
    }
    await verify({ calls, stateWrites, state: state(), batch: batches[0], payload, response, db });
    for (const table of ['jobs', 'outreach_messages', 'prototypes', 'v2_admissions']) {
      assert.equal(db.database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0);
    }
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
}

test('R26 issues exactly three PME strata in order with exact codes and one unrestricted fallback', async () => {
  await withStratifiedCycle({}, ({ calls, batch, payload }) => {
    assert.deepEqual(calls.map((call) => call.window), stratifiedWindows);
    const exactLists = [foodCodes, beautyCodes, retailCodes];
    assert.equal(retailCodes.split(',').length, 50);
    assert.equal(new Set(retailCodes.split(',')).size, 50);
    for (const [index, call] of calls.entries()) {
      const params = call.url.searchParams;
      assert.equal(params.get('departement'), '972');
      assert.equal(params.get('etat_administratif'), 'A');
      assert.equal(params.get('minimal'), 'true');
      assert.equal(params.get('include'), 'matching_etablissements');
      assert.equal(params.get('limite_matching_etablissements'), '10');
      assert.equal(params.has('tranche_effectif_salarie'), false);
      assert.equal(params.has('nature_juridique'), false);
      assert.equal(params.has('est_siege'), false);
      if (index < 3) {
        assert.equal(params.get('categorie_entreprise'), 'PME');
        assert.equal(params.get('activite_principale'), exactLists[index]);
        assert.equal(params.has('section_activite_principale'), false);
        assert.ok(params.get('activite_principale').split(',').every((code) => /^\d{2}\.\d{2}[A-Z]$/.test(code)));
      } else {
        assert.equal(params.get('section_activite_principale'), 'F,G,I,L,M,N,R,S');
        assert.equal(params.has('categorie_entreprise'), false);
        assert.equal(params.has('activite_principale'), false);
      }
    }
    assert.equal(batch.priorityPagesScanned, 3);
    assert.equal(payload.funnel.newProspectsCreated, 0);
  });
});

for (const [index, window] of stratifiedWindows.slice(0, 3).entries()) {
  test(`R26 ${window} cursor advancement changes only its own provider-state position`, async () => {
    await withStratifiedCycle({ supply: { LOCAL_RETAIL: tenEligible() } }, ({ calls, stateWrites, state }) => {
      assert.deepEqual(calls.map((call) => Number(call.url.searchParams.get('page'))), [2, 7, 11]);
      assert.equal(stateWrites.length, 3);
      const write = stateWrites[index];
      assert.equal(write.key, stratifiedKeys[index]);
      assert.equal(write.after[write.key], String(Number(write.before[write.key]) + 1));
      assert.deepEqual(Object.keys(write.before).filter((key) => write.before[key] !== write.after[key]), [write.key]);
      assert.equal(state['martinique-page'], '13');
      assert.equal(state['martinique-first-wave-page'], '99');
    });
  });
}

test('R26 broad cursor advances independently after one insufficient-supply fallback', async () => {
  await withStratifiedCycle({}, ({ calls, stateWrites, state }) => {
    assert.equal(Number(calls[3].url.searchParams.get('page')), 13);
    const write = stateWrites[3];
    assert.equal(write.key, 'martinique-page');
    assert.deepEqual(Object.keys(write.before).filter((key) => write.before[key] !== write.after[key]), ['martinique-page']);
    assert.equal(state['martinique-page'], '14');
    assert.deepEqual(stratifiedKeys.slice(0, 3).map((key) => state[key]), ['3', '8', '12']);
  });
});

test('R26 each query cursor wraps independently at its final provider page', async () => {
  await withStratifiedCycle({ positions: [20, 7, 20, 20] }, ({ calls, state }) => {
    assert.deepEqual(calls.map((call) => Number(call.url.searchParams.get('page'))), [20, 7, 20, 20]);
    assert.deepEqual(stratifiedKeys.map((key) => state[key]), ['1', '8', '1', '1']);
  });
});

test('R26 failed priority collection preserves cursors and creates no prospects', async () => {
  await withStratifiedCycle({ failWindow: 'HAIR_BEAUTY', supply: { FOOD_SERVICE: tenEligible(3100, '56.10A') } }, ({ calls, stateWrites, state, response, db }) => {
    assert.equal(response.status, 500);
    assert.deepEqual(calls.map((call) => call.window), ['FOOD_SERVICE', 'HAIR_BEAUTY']);
    assert.equal(stateWrites.length, 0);
    assert.deepEqual(stratifiedKeys.map((key) => state[key]), ['2', '7', '11', '13']);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count, 0);
  });
});

test('R26 sufficient merged strong supply suppresses fallback and provider order cannot choose winners', async () => {
  const lowerScoreFood = diagnosticFixture(3200, { activity: '56.10A' });
  lowerScoreFood.tranche_effectif_salarie = 'NN';
  const beauty = tenEligible(3300, '96.02B');
  await withStratifiedCycle({ supply: { FOOD_SERVICE: [lowerScoreFood], HAIR_BEAUTY: beauty } }, ({ calls, payload, batch }) => {
    assert.deepEqual(calls.map((call) => call.window), stratifiedWindows.slice(0, 3));
    const created = payload.decisions.filter((decision) => decision.decision === 'CREATED');
    assert.equal(created.length, 10);
    assert.ok(created.every((decision) => beauty.some((item) => item.siren === decision.siren)));
    const food = batch.candidateDiagnostics.candidateDecisions[0];
    assert.equal(food.sourceWindow, 'FOOD_SERVICE');
    assert.equal(food.outcome, 'SKIPPED');
    assert.equal(food.canonicalReason, 'CAP_REACHED');
  });
});

test('R26 cross-query duplicate identities cannot suppress needed fallback or consume capacity twice', async () => {
  const duplicate = diagnosticFixture(3400, { activity: '56.10A' });
  await withStratifiedCycle({ supply: {
    FOOD_SERVICE: [duplicate], HAIR_BEAUTY: [duplicate], LOCAL_RETAIL: [duplicate],
    BROAD_FALLBACK: tenEligible(3500),
  } }, ({ calls, payload, batch, db }) => {
    assert.equal(calls.length, 4);
    assert.equal(payload.funnel.newProspectsCreated, 10);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects WHERE siren = ?').get(duplicate.siren).count, 1);
    const occurrences = batch.candidateDiagnostics.candidateDecisions.filter((decision) => decision.stableIdentity === duplicate.siege.siret);
    assert.deepEqual(occurrences.map((decision) => decision.sourceWindow), stratifiedWindows.slice(0, 3));
    assert.deepEqual(occurrences.map((decision) => decision.outcome), ['CREATED', 'DEDUPED', 'DEDUPED']);
  });
});

test('R26 merged Tier 1 RESEARCH precedes weaker Tier 2/3 and canonical REJECT cannot fill the cap', async () => {
  const networkBeauty = diagnosticFixture(3600, { activity: '96.02A' });
  networkBeauty.nom_raison_sociale = 'NETWORK GROUP';
  const rejected = diagnosticFixture(3601, { activity: '56.10A', publicEntity: true });
  const weak = diagnosticFixture(3602, { activity: '45.20A' });
  const tier2 = diagnosticFixture(3603, { activity: '56.10A' });
  await withStratifiedCycle({ supply: {
    FOOD_SERVICE: [weak, tier2, rejected], HAIR_BEAUTY: [networkBeauty],
    BROAD_FALLBACK: [diagnosticFixture(3604, { activity: '47.78C' })],
  } }, ({ payload, batch, db }) => {
    const created = payload.decisions.filter((decision) => decision.decision === 'CREATED').map((decision) => decision.siren);
    assert.deepEqual(created, [tier2.siren, '810003604', weak.siren]);
    for (const [candidate, reason] of [[networkBeauty, 'RESEAU_NON_AUTONOME'], [rejected, 'SECTEUR_PUBLIC']]) {
      const event = db.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.hard_rejected' AND json_extract(payload_json, '$.siret') = ?")
        .get(candidate.siege.siret);
      assert.equal(JSON.parse(event.payload_json).reason, reason);
      assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects WHERE siren = ?').get(candidate.siren).count, 0);
      assert.equal(batch.candidateDiagnostics.candidateDecisions.some((item) => item.stableIdentity === candidate.siege.siret), false);
    }
    assert.equal(payload.funnel.newProspectsCreated, 3);
  });
});

test('R26 LOW_PRIORITY and REJECT supply triggers one fallback with no forced creation', async () => {
  const low = diagnosticFixture(3700, { activity: '47.78C' });
  low.categorie_entreprise = 'PME';
  low.tranche_effectif_salarie = '01';
  low.nombre_etablissements_ouverts = 20;
  low.matching_etablissements[0].est_siege = false;
  low.siege.siret = `${low.siren}00020`;
  const rejected = diagnosticFixture(3701, { publicEntity: true });
  await withStratifiedCycle({ supply: { LOCAL_RETAIL: [low, rejected], BROAD_FALLBACK: [low, rejected] } }, ({ calls, payload, batch, db }) => {
    assert.equal(calls.length, 4);
    assert.equal(payload.funnel.newProspectsCreated, 0);
    const decisions = batch.candidateDiagnostics.candidateDecisions;
    assert.equal(decisions.length, 2);
    assert.ok(decisions.some((decision) => decision.finalEligibilityClass === 'LOW_PRIORITY'));
    assert.ok(decisions.every((decision) => decision.finalEligibilityClass === 'LOW_PRIORITY'));
    assert.ok(decisions.every((decision) => decision.outcome === 'REJECTED' && !decision.persistenceAttempted));
    const events = db.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.hard_rejected'").all();
    assert.equal(events.length, 2);
    assert.ok(events.every((event) => {
      const rejection = JSON.parse(event.payload_json);
      return rejection.reason === 'SECTEUR_PUBLIC' && rejection.siret === rejected.siege.siret;
    }));
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count, 0);
  });
});

test('R26 R22 attribution retains all four query windows and their own source pages within bounds', async () => {
  await withStratifiedCycle({ supply: Object.fromEntries(stratifiedWindows.map((window, index) =>
    [window, [diagnosticFixture(3800 + index)]])) }, ({ batch }) => {
    const diagnostics = batch.candidateDiagnostics;
    assert.equal(diagnostics.complete, true);
    assert.equal(diagnostics.total, 4);
    assert.equal(diagnostics.retained, 4);
    assert.deepEqual(diagnostics.candidateDecisions.map((decision) => decision.sourceWindow), stratifiedWindows);
    assert.deepEqual(diagnostics.candidateDecisions.map((decision) => decision.sourcePage), [2, 7, 11, 13]);
    assert.deepEqual(diagnostics.candidateDecisions.map((decision) => decision.occurrence), [1, 2, 3, 4]);
    assert.ok(new TextEncoder().encode(JSON.stringify(diagnostics)).length <= 16_384);
  });
});
