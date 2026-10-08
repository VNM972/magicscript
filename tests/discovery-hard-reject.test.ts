import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { hardRejectReason, type HardRejectReason } from '../core/orchestrator/discovery-hard-reject';
import worker from '../apps/api-worker/src/index';

type Input = Parameters<typeof hardRejectReason>[0];
const cases: Array<[string, Input, HardRejectReason | null]> = [
  ['uppercase W', { siret: 'W1234567890001' }, 'ASSOCIATION_LOI_1901'],
  ['lowercase w', { siret: 'w1234567890001' }, 'ASSOCIATION_LOI_1901'],
  ['GE', { companyCategory: 'GE' }, 'GRAND_GROUPE'],
  ['ETI', { companyCategory: 'ETI' }, 'ETI'],
  ['band 21', { companyEmployeeBand: '21' }, 'EFFECTIF_SUP_50'],
  ['band 12', { companyEmployeeBand: '12' }, null],
  ['association', { legalNature: '9220' }, 'ASSOCIATION_LEGAL_NATURE'],
  ['institution', { legalNature: '7381' }, 'INSTITUTION_LEGAL_NATURE'],
  ['public sector', { publicOrParapublic: true }, 'SECTEUR_PUBLIC'],
  ['unconfirmed network', { requiresNetworkAutonomyCheck: true, autonomyEvidence: null }, 'RESEAU_NON_AUTONOME'],
  ['confirmed network', { requiresNetworkAutonomyCheck: true, autonomyEvidence: 'CONFIRMED' }, null],
  ['empty input', {}, null],
];
for (const [name, input, expected] of cases) {
  test(name, () => assert.equal(hardRejectReason(input), expected));
}

test('all excluded bands and legal natures, with adjacent accepted values', () => {
  for (const band of ['21', '22', '31', '32', '41', '42', '51', '52', '53']) {
    assert.equal(hardRejectReason({ companyEmployeeBand: band }), 'EFFECTIF_SUP_50', band);
  }
  for (const legalNature of ['5195', '9210', '9220', '9221', '9222', '9223', '9224', '9230', '9240', '9260']) {
    assert.equal(hardRejectReason({ legalNature }), 'ASSOCIATION_LEGAL_NATURE', legalNature);
  }
  assert.equal(hardRejectReason({ legalNature: '7389' }), 'INSTITUTION_LEGAL_NATURE');
  assert.equal(hardRejectReason({ companyEmployeeBand: '20', legalNature: '5710', companyCategory: 'PME' }), null);
});

test('normalizes every string field and tolerates null or undefined', () => {
  for (const [input, expected] of [
    [{ siret: ' w123 ' }, 'ASSOCIATION_LOI_1901'],
    [{ companyCategory: ' ge ' }, 'GRAND_GROUPE'],
    [{ companyEmployeeBand: ' 21 ' }, 'EFFECTIF_SUP_50'],
    [{ legalNature: ' 9220 ' }, 'ASSOCIATION_LEGAL_NATURE'],
    [{ requiresNetworkAutonomyCheck: true, autonomyEvidence: ' confirmed ' }, null],
    [{ siret: ' ', companyCategory: null, companyEmployeeBand: undefined, legalNature: null, publicOrParapublic: false }, null],
  ] as Array<[Input, HardRejectReason | null]>) assert.equal(hardRejectReason(input), expected);
});

test('first matching rule wins across the full priority chain', () => {
  const rules: Array<[Input, HardRejectReason]> = [
    [{ siret: 'W123' }, 'ASSOCIATION_LOI_1901'],
    [{ companyCategory: 'GE' }, 'GRAND_GROUPE'],
    [{ companyCategory: 'ETI' }, 'ETI'],
    [{ companyEmployeeBand: '21' }, 'EFFECTIF_SUP_50'],
    [{ legalNature: '9220' }, 'ASSOCIATION_LEGAL_NATURE'],
    [{ legalNature: '7381' }, 'INSTITUTION_LEGAL_NATURE'],
    [{ publicOrParapublic: true }, 'SECTEUR_PUBLIC'],
    [{ requiresNetworkAutonomyCheck: true }, 'RESEAU_NON_AUTONOME'],
  ];
  for (let earlier = 0; earlier < rules.length; earlier++) {
    for (let later = earlier + 1; later < rules.length; later++) {
      assert.equal(hardRejectReason({ ...rules[later][0], ...rules[earlier][0] }), rules[earlier][1]);
    }
  }
});

class FixtureD1 {
  database = new DatabaseSync(':memory:');
  constructor() {
    this.database.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  }
  prepare(sql: string) {
    let values: Array<string | number | null> = [];
    const statement = {
      bind: (...args: typeof values) => { values = args; return statement; },
      first: async <T>() => (this.database.prepare(sql).get(...values) ?? null) as T | null,
      all: async <T>() => ({ results: this.database.prepare(sql).all(...values) as T[] }),
      run: async () => this.database.prepare(sql).run(...values),
    };
    return statement;
  }
  events() {
    return this.database.prepare("SELECT payload_json FROM events WHERE type = 'discovery.hard_rejected' ORDER BY rowid")
      .all().map((row) => JSON.parse(String(row.payload_json)));
  }
  names() {
    return this.database.prepare('SELECT company_name FROM prospects ORDER BY rowid').all().map((row) => row.company_name);
  }
  close() { this.database.close(); }
}

const safeEnv = (db: FixtureD1) => ({
  DB: db, MAGICSCRIPT_API_TOKEN: 'fixture-api', MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
  MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'false', MAGICSCRIPT_SENDING_ENABLED: 'false',
  MAGICSCRIPT_EMAIL_PROVIDER: 'disabled', MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
});
const request = (path: string, body: unknown = {}) => new Request(`http://local.test/api/${path}`, {
  method: 'POST', headers: { authorization: 'Bearer fixture-api', 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const identity = (index: number) => {
  const siren = String(810000000 + index);
  return { siren, siret: `${siren}00010`, companyName: `Commerce Test ${index}` };
};

test('Recherche Entreprises hook logs raw exclusions and retains an eligible business', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  const reasons = ['GRAND_GROUPE', 'ETI', 'EFFECTIF_SUP_50', 'ASSOCIATION_LEGAL_NATURE', 'INSTITUTION_LEGAL_NATURE', 'SECTEUR_PUBLIC', 'RESEAU_NON_AUTONOME'];
  const overrides = [
    { categorie_entreprise: 'GE' }, { categorie_entreprise: 'ETI' }, { tranche_effectif_salarie: '21' },
    { nature_juridique: '9220' }, { nature_juridique: '7381' }, { est_service_public: true },
    { nom_raison_sociale: 'Autre Raison Sociale' }, {},
  ];
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      const results = overrides.map((extra, index) => {
        const { siren, siret, companyName } = identity(index + 1);
        const siege = { siret, activite_principale: '96.02A', est_siege: true, etat_administratif: 'A', departement: '972', code_postal: '97200', libelle_commune: 'FORT-DE-FRANCE' };
        return { siren, nom_complet: companyName, nom_raison_sociale: companyName, etat_administratif: 'A', activite_principale: '96.02A', categorie_entreprise: 'PME', tranche_effectif_salarie: '01', nombre_etablissements_ouverts: 1, nature_juridique: '5710', siege, matching_etablissements: [siege], ...extra };
      });
      return Response.json({ results: calls++ === 0 ? results : [], total_results: 8, page: 1, per_page: 20, total_pages: 1 });
    };
    const response = await worker.fetch(request('discovery/manual-intake'), safeEnv(db));
    assert.equal(response.status, 200);
    assert.deepEqual(db.events().map((event) => event.reason), reasons);
    assert.deepEqual(db.names(), [identity(8).companyName]);
    assert.deepEqual(db.events()[0], { reason: 'GRAND_GROUPE', siret: identity(1).siret, companyName: identity(1).companyName });
  } finally { globalThis.fetch = originalFetch; db.close(); }
});

test('Sirene hook rejects raw size/legal/network evidence and retains an eligible business', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  const reasons = ['GRAND_GROUPE', 'ETI', 'EFFECTIF_SUP_50', 'ASSOCIATION_LEGAL_NATURE', 'INSTITUTION_LEGAL_NATURE', 'RESEAU_NON_AUTONOME'];
  const overrides = [
    { categorieEntreprise: 'GE' }, { categorieEntreprise: 'ETI' }, { trancheEffectifsUniteLegale: '21' },
    { categorieJuridiqueUniteLegale: '9220' }, { categorieJuridiqueUniteLegale: '7389' },
    { denominationUniteLegale: 'Autre Raison Sociale' }, {},
  ];
  try {
    let sireneCalls = 0;
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === 'recherche-entreprises.api.gouv.fr') return Response.json({}, { status: 503 });
      assert.equal(url.pathname.endsWith('/siret'), true);
      sireneCalls++;
      return Response.json({ header: { total: 7, curseur: '*', curseurSuivant: '*' }, etablissements: overrides.map((extra, index) => {
        const { siren, siret, companyName } = identity(index + 1);
        return { siren, siret, etablissementSiege: true, adresseEtablissement: { codePostalEtablissement: '97200', libelleCommuneEtablissement: 'FORT-DE-FRANCE' },
          periodesEtablissement: [{ etatAdministratifEtablissement: 'A', enseigne1Etablissement: companyName, activitePrincipaleEtablissement: '96.02A' }],
          uniteLegale: { denominationUniteLegale: companyName, categorieEntreprise: 'PME', trancheEffectifsUniteLegale: '01', categorieJuridiqueUniteLegale: '5710', nombreEtablissementsOuverts: 1, ...extra } };
      }) });
    };
    const response = await worker.fetch(request('autopilot/tick'), { ...safeEnv(db), MAGICSCRIPT_AUTOPILOT_ENABLED: 'true', INSEE_SIRENE_API_KEY: 'fixture-only' });
    assert.equal(response.status, 200);
    assert.equal(sireneCalls, 1);
    assert.deepEqual(db.events().map((event) => event.reason), reasons);
    assert.deepEqual(db.names(), [identity(7).companyName]);
  } finally { globalThis.fetch = originalFetch; db.close(); }
});

test('Agent 1 hook reads raw fields before defaults and preserves accepted/confirmed candidates', async () => {
  const db = new FixtureD1();
  const originalFetch = globalThis.fetch;
  const inputs: Input[] = [
    { companyCategory: 'GE' }, { companyCategory: 'ETI' }, { companyEmployeeBand: '21' },
    { legalNature: '9220' }, { legalNature: '7381' }, { publicOrParapublic: true },
    { requiresNetworkAutonomyCheck: true },
    { requiresNetworkAutonomyCheck: true, autonomyEvidence: 'CONFIRMED' }, {},
  ];
  try {
    globalThis.fetch = async () => { throw new Error('external fetch prohibited'); };
    const candidates = inputs.map((extra, index) => ({
      ...identity(index + 1), city: 'FORT-DE-FRANCE', activity: '96.02A', sourceUrl: `https://example.test/evidence/${index}`,
      evidence: [{ url: `https://example.test/evidence/${index}`, note: 'Fixture registry evidence', supports: ['IDENTITY'] }], ...extra,
    }));
    const response = await worker.fetch(request('agent1/batches', {
      schemaVersion: 'AGENT1_CANDIDATE_BATCH_V1', batchId: 'hard-reject-fixture', provenance: 'fixture',
      collectedAt: '2026-10-08T00:00:00Z', origin: 'manual', candidates,
    }), safeEnv(db));
    assert.equal(response.status, 200);
    assert.deepEqual(db.events().map((event) => event.reason), ['GRAND_GROUPE', 'ETI', 'EFFECTIF_SUP_50', 'ASSOCIATION_LEGAL_NATURE', 'INSTITUTION_LEGAL_NATURE', 'SECTEUR_PUBLIC', 'RESEAU_NON_AUTONOME']);
    assert.deepEqual(db.names(), [identity(8).companyName, identity(9).companyName]);
    const body = await response.json() as { created: string[] };
    assert.equal(body.created.length, 2);
  } finally { globalThis.fetch = originalFetch; db.close(); }
});

test('Agent 1 existing validator rejects W identifiers before the discovery hook', async () => {
  const db = new FixtureD1();
  try {
    const response = await worker.fetch(request('agent1/batches', {
      schemaVersion: 'AGENT1_CANDIDATE_BATCH_V1', batchId: 'invalid-w-fixture', provenance: 'fixture',
      collectedAt: '2026-10-08T00:00:00Z', origin: 'manual', candidates: [{
        companyName: 'Association Fixture', siret: 'W1234567890001', sourceUrl: 'https://example.test/',
        evidence: [{ url: 'https://example.test/', note: 'Fixture', supports: ['IDENTITY'] }],
      }],
    }), safeEnv(db));
    assert.equal(response.status, 400);
    assert.deepEqual(db.events(), []);
    assert.deepEqual(db.names(), []);
  } finally { db.close(); }
});
