import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from './index.ts';

class FixtureD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'));
  }

  prepare(sql) {
    let values = [];
    const result = {
      bind: (...args) => { values = args; return result; },
      first: async () => this.database.prepare(sql).get(...values) ?? null,
      all: async () => ({ results: this.database.prepare(sql).all(...values) }),
      run: async () => this.database.prepare(sql).run(...values),
    };
    return result;
  }

  close() { this.database.close(); }
}

function directoryResult({ siren, siret, name, activity = '47.78C', publicEntity = false }) {
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
    matching_etablissements: [{
      siret,
      activite_principale: activity,
      est_siege: true,
      etat_administratif: 'A',
      code_postal: '97200',
      libelle_commune: 'FORT-DE-FRANCE',
      departement: '972',
      adresse: '1 RUE TEST 97200 FORT-DE-FRANCE',
    }],
  };
}

const tick = (db, overrides = {}) => worker.fetch(
  new Request('http://local.test/api/autopilot/tick', {
    method: 'POST',
    headers: { authorization: 'Bearer fixture-api', 'content-type': 'application/json' },
    body: '{}',
  }),
  {
    DB: db,
    MAGICSCRIPT_API_TOKEN: 'fixture-api',
    MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
    MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'false',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
    MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
    MAGICSCRIPT_DISCOVERY_BATCH_SIZE: '5',
    ...overrides,
  },
);

test('successful provider scan with all candidates out of scope ends with zero eligible candidates and no fallback job', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  try {
    const rejected = directoryResult({ siren: '800000001', siret: '80000000100010', name: 'OUT OF SCOPE INSTITUTION', publicEntity: true });
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({ results: [rejected], total_results: 1, page: 1, per_page: 5, total_pages: 1 });
    };

    const response = await tick(db);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      queued: false,
      reason: 'MARTINIQUE_SUPPLY_LOW',
      provider: 'recherche-entreprises',
      created: 0,
      scanned: 2,
    });
    assert.equal(calls, 2);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count, 0);
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind = 'DISCOVER_PROSPECTS'").get().count, 0);
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'agent1.batch_received'").get().count, 0);
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'discovery.martinique_supply_low'").get().count, 1);
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'discovery.recherche_entreprises_failed'").get().count, 0);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('a partial provider batch persists exactly two real identities from a requested batch of five', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  try {
    const providerRecords = [
      directoryResult({ siren: '800000001', siret: '80000000100010', name: 'PROVIDER SHOP ONE' }),
      directoryResult({ siren: '900000003', siret: '90000000300010', name: 'PROVIDER SHOP TWO', activity: '56.10A' }),
    ];
    globalThis.fetch = async () => Response.json({ results: providerRecords, total_results: 2, page: 1, per_page: 5, total_pages: 1 });

    const response = await tick(db);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.provider, 'recherche-entreprises');
    assert.equal(result.created, 2);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count, 2);
    const persisted = db.database.prepare('SELECT company_name, siren, siret, source_url FROM prospects ORDER BY siren').all();
    assert.deepEqual(persisted.map(({ company_name, siren, siret }) => [company_name, siren, siret]), [
      ['PROVIDER SHOP ONE', '800000001', '80000000100010'],
      ['PROVIDER SHOP TWO', '900000003', '90000000300010'],
    ]);
    for (const record of persisted) {
      assert.equal(record.source_url, `https://annuaire-entreprises.data.gouv.fr/etablissement/${record.siret}`);
    }
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind = 'DISCOVER_PROSPECTS'").get().count, 0);
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'agent1.batch_received'").get().count, 0);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('provider transport failure remains distinct and does not enqueue model discovery', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('outbound socket denied'); };
    const response = await tick(db);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { queued: false });
    const failure = db.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.recherche_entreprises_failed'").get();
    assert.ok(failure);
    assert.match(JSON.parse(failure.payload_json).message, /outbound socket denied/);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM jobs').get().count, 0);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count, 0);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test('canonical intake continues to reject placeholder registry identities', async () => {
  const db = new FixtureD1();
  try {
    const response = await worker.fetch(new Request('http://local.test/api/agent1/batches', {
      method: 'POST',
      headers: { authorization: 'Bearer fixture-api', 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'AGENT1_CANDIDATE_BATCH_V1',
        batchId: 'placeholder-identity-regression',
        provenance: 'runner-fixture',
        collectedAt: '2026-09-28T00:00:00.000Z',
        origin: 'runtime',
        candidates: [{
          companyName: 'UNVERIFIED GENERATED BUSINESS',
          siren: '123456789',
          siret: '12345678901234',
          city: 'FORT-DE-FRANCE',
          activity: '56.10A',
          sourceUrl: 'https://www.mairie.fr/le-mairie-de-fort-de-france-123456789',
          evidence: [{ url: 'https://www.laboulangerieducap.com', note: 'Model-provided business evidence', supports: ['companyName', 'activity'] }],
        }],
      }),
    }), {
      DB: db,
      MAGICSCRIPT_API_TOKEN: 'fixture-api',
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
      MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'false',
      MAGICSCRIPT_SENDING_ENABLED: 'false',
      MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
      MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.created, []);
    assert.ok(result.decisions.some((decision) => decision.reason === 'INVALID_IDENTITY'));
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count, 0);
  } finally {
    db.close();
  }
});
