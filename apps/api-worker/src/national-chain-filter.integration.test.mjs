import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { findNationalChainKeyword, NATIONAL_CHAIN_KEYWORDS, NATIONAL_CHAIN_GROUP_BRANDS, processDiscoveryResult } from './index.ts';
import { scoreCommercialEligibility } from '../../../core/scoring/commercial-eligibility.ts';

class FixtureD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'));
    this.statements = [];
  }

  prepare(sql) {
    this.statements.push(sql);
    let values = [];
    const statement = {
      bind: (...args) => { values = args; return statement; },
      first: async () => this.database.prepare(sql).get(...values) ?? null,
      all: async () => ({ results: this.database.prepare(sql).all(...values) }),
      run: async () => this.database.prepare(sql).run(...values),
    };
    return statement;
  }

  close() { this.database.close(); }
}

const safeEnv = (db) => ({
  DB: db, MAGICSCRIPT_API_TOKEN: 'fixture-api',
  MAGICSCRIPT_AUTOPILOT_ENABLED: 'false', MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'false',
  MAGICSCRIPT_SENDING_ENABLED: 'false', MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
});

function candidate(companyName, index = 1, overrides = {}) {
  const siren = String(810000000 + index);
  const siret = `${siren}00010`;
  const identity = {
    companyName, siren, siret, city: 'FORT-DE-FRANCE',
    sourceUrl: `https://annuaire-entreprises.data.gouv.fr/etablissement/${siret}`,
  };
  return {
    ...identity,
    eligibility: scoreCommercialEligibility({
      ...identity, localActivity: '96.02A', companyCategory: 'PME',
      companyEmployeeBand: '01', isHeadOffice: true, numberOpenEstablishments: 1,
      legalNature: '5710', asOfDate: '2026-10-05',
    }),
    ...overrides,
  };
}

test('normalized whole-word policy covers operator examples and preserves the four recap names', () => {
  assert.deepEqual(NATIONAL_CHAIN_KEYWORDS, ['FRANCHISE', 'FRANCHISEE', 'RESEAU', 'NATIONAL']);
  assert.deepEqual(NATIONAL_CHAIN_GROUP_BRANDS, ['ATLANTIC']);
  for (const [name, expected] of [
    ["Guy Hoquet L'Immobilier", undefined],
    ['MENHIR IMMOBILIER FRANCHISE', 'FRANCHISE'],
    ['Commerce franchisé', 'FRANCHISE'],
    ['Commerce franchisée', 'FRANCHISEE'],
    ['Commerce franchisee', 'FRANCHISEE'],
    ['RÉSEAU AUTOMOBILE MARTINIQUE', 'RESEAU'],
    ['Groupe Atlantic', 'GROUPE ATLANTIC'],
    ['Le Réseau des Artisans', 'RESEAU'],
    ['Commerce NATIONAL', 'NATIONAL'],
    ['Association nationale', undefined],
    ['Commerce international', undefined],
    ['Groupe Artisans Locaux', undefined],
    ['Atlantic', undefined],
    ['Ananke', undefined], ["Sun'Fly", undefined],
    ['FUTURE MARTINIQUE', undefined], ['Candide', undefined],
  ]) assert.equal(findNationalChainKeyword({ companyName: name }), expected, name);

  for (const fields of [
    { legalName: 'Commerce FRANCHISE' }, { displayName: 'Commerce RÉSEAU' },
    { alias: 'Commerce NATIONAL' }, { aliases: ['Nom local', 'GROUPE ATLANTIC'] },
  ]) assert.ok(findNationalChainKeyword({ companyName: 'Commerce local', ...fields }));
});

test('automatic exclusion logs one event per candidate, increments audit count, and precedes brand collision writes', async () => {
  const db = new FixtureD1();
  try {
    const observed = [];
    const result = await processDiscoveryResult({ prospects: [
      candidate('RÉSEAU AUTOMOBILE MARTINIQUE'),
      candidate('Commerce local', 2, { aliases: ['MENHIR IMMOBILIER FRANCHISE'] }),
    ] }, safeEnv(db), db, { filterNationalChains: true, onDecision: (...args) => observed.push(args) });
    assert.equal(result.created.length, 0);
    assert.equal(result.skipped.length, 2);
    assert.equal(result.nationalChainExcludedCount, 2);
    assert.ok(result.decisions.every((decision) => decision.decision === 'EXCLUDED' && decision.reason === 'POSSIBLE_NATIONAL_CHAIN'));
    assert.ok(observed.every((args) => args[3] === false));
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count, 0);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM jobs').get().count, 0);
    assert.ok(!db.statements.some((sql) => /WHERE brand_key|UPDATE prospects/.test(sql)));
    const events = db.database.prepare("SELECT prospect_id, payload_json FROM events WHERE type = 'discovery.prospect_excluded' ORDER BY rowid").all();
    assert.equal(events.length, 2);
    assert.ok(events.every((event) => event.prospect_id === null));
    assert.deepEqual(events.map((event) => JSON.parse(event.payload_json).nationalChainExcludedCount), [1, 2]);
    assert.ok(events.every((event) => JSON.parse(event.payload_json).reason === 'POSSIBLE_NATIONAL_CHAIN'));
  } finally { db.close(); }
});

test('the four recap names still create prospects through the automatic filter', async () => {
  const db = new FixtureD1();
  try {
    const names = ['Ananke', "Sun'Fly", 'FUTURE MARTINIQUE', 'Candide'];
    const result = await processDiscoveryResult({ prospects: names.map((name, index) => candidate(name, index + 1)) }, safeEnv(db), db, { filterNationalChains: true });
    assert.equal(result.created.length, 4);
    assert.equal(result.nationalChainExcludedCount, 0);
    assert.ok(result.decisions.every((decision) => decision.decision === 'CREATED'));
  } finally { db.close(); }
});

test('exclusions do not consume the creation budget and existing blacklist keeps precedence', async () => {
  const db = new FixtureD1();
  try {
    const result = await processDiscoveryResult({ prospects: [
      candidate('MENHIR IMMOBILIER FRANCHISE'),
      candidate('RÉSEAU AUTOMOBILE MARTINIQUE', 2),
      candidate('Ananke', 3), candidate('Candide', 4),
    ] }, safeEnv(db), db, { filterNationalChains: true, maxCreated: 1 });
    assert.equal(result.created.length, 1);
    assert.equal(result.nationalChainExcludedCount, 1);
    assert.deepEqual(result.decisions.map((decision) => decision.reason), ['OPERATOR_EXCLUDED', 'POSSIBLE_NATIONAL_CHAIN', 'CREATED']);
  } finally { db.close(); }
});

test('manual default preserves creation and response shape even with a keyword', async () => {
  const db = new FixtureD1();
  try {
    const result = await processDiscoveryResult({ prospects: [candidate('Le Réseau des Artisans')] }, safeEnv(db), db, { planAfterCreate: false });
    assert.equal(result.created.length, 1);
    assert.equal(Object.hasOwn(result, 'nationalChainExcludedCount'), false);
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'discovery.prospect_excluded'").get().count, 0);
  } finally { db.close(); }
});

test('provider automatic route enables the filter while the real manual route preserves its policy', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const manual of [false, true]) {
      const db = new FixtureD1();
      try {
        let calls = 0;
        globalThis.fetch = async () => {
          calls += 1;
          const item = {
            siren: '810000001', nom_complet: manual ? 'Le Réseau des Artisans' : 'Artisans Locaux', nom_raison_sociale: manual ? 'Le Réseau des Artisans' : 'Artisans Locaux',
            etat_administratif: 'A', activite_principale: '96.02A', categorie_entreprise: 'PME',
            tranche_effectif_salarie: '01', nombre_etablissements_ouverts: 1, nature_juridique: '5710',
            siege: { siret: '81000000100010', activite_principale: '96.02A', est_siege: true,
              etat_administratif: 'A', departement: '972', code_postal: '97200', libelle_commune: 'FORT-DE-FRANCE' },
          };
          item.matching_etablissements = [{ ...item.siege, liste_enseignes: [item.nom_complet, 'Le Réseau des Artisans'] }];
          return Response.json({ results: calls === 1 ? [item] : [], total_results: 1, page: 1, per_page: 20, total_pages: 1 });
        };
        const response = await worker.fetch(new Request(`http://local.test/api/${manual ? 'discovery/manual-intake' : 'autopilot/tick'}`, {
          method: 'POST', headers: { authorization: 'Bearer fixture-api', 'content-type': 'application/json' }, body: '{}',
        }), { ...safeEnv(db), MAGICSCRIPT_AUTOPILOT_ENABLED: manual ? 'false' : 'true' });
        assert.equal(response.status, 200);
        assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM prospects').get().count, manual ? 1 : 0);
        assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'discovery.prospect_excluded'").get().count, manual ? 0 : 1);
        if (!manual) {
          const event = db.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.recherche_entreprises_batch'").get();
          assert.equal(JSON.parse(event.payload_json).nationalChainExcludedCount, 1);
        }
      } finally { db.close(); }
    }
  } finally { globalThis.fetch = originalFetch; }
});
