import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { D1ProspectRepository } from '../../../core/persistence/d1-prospect-repository.ts';
import { evaluateResearchEvidenceIntegrity } from '../../../core/research/evidence-integrity.ts';
import worker from './index.ts';
import { scoreCommercialEligibility } from '../../../core/scoring/commercial-eligibility.ts';

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

function prospect(id, siren, siret) {
  return {
    id,
    companyName: 'AU BONHEUR DES DAMES',
    legalName: 'AU BONHEUR DES DAMES',
    siren,
    siret,
    city: 'LA TRINITE',
    sourceUrl: `https://annuaire-entreprises.data.gouv.fr/etablissement/${siret}`,
    activityTaxonomy: 'NAF_2008',
    commercialEligibility: 'HIGH_PRIORITY',
    activity: '47.51Z',
    location: '97220 LA TRINITE',
    state: 'DISCOVERED',
    score: 79,
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
  };
}

test('D1 preserves exact legal identities for same-name prospects', async () => {
  const db = new FixtureD1();
  try {
    const repository = new D1ProspectRepository(db);
    await repository.saveProspect(
      prospect('p-one', '397877622', '39787762200019'),
    );
    await repository.saveProspect(
      prospect('p-two', '999999999', '99999999900011'),
    );
    const saved = await repository.listProspects();
    assert.equal(saved.length, 2);
    assert.deepEqual(
      new Set(saved.map((item) => `${item.siren}|${item.siret}`)),
      new Set(['397877622|39787762200019', '999999999|99999999900011']),
    );
    assert.ok(
      saved.every(
        (item) =>
          item.activityTaxonomy === 'NAF_2008' &&
          item.sourceUrl?.endsWith(item.siret),
      ),
    );
  } finally {
    db.close();
  }
});

test('D1 rejects duplicate SIREN and SIRET under a different prospect id', async () => {
  const db = new FixtureD1();
  try {
    const repository = new D1ProspectRepository(db);
    await repository.saveProspect(
      prospect('p-one', '397877622', '39787762200019'),
    );

    await assert.rejects(
      repository.saveProspect(
        prospect('p-duplicate', '397877622', '39787762200019'),
      ),
      /UNIQUE constraint failed/,
    );
  } finally {
    db.close();
  }
});

test('API keeps same-name contactability identity-bound and prepare-only', async () => {
  const db = new FixtureD1();
  try {
    const repository = new D1ProspectRepository(db);
    await repository.saveProspect({
      ...prospect('p-one', '397877622', '39787762200019'),
      state: 'QUALIFIED',
    });
    await repository.saveProspect(
      prospect('p-two', '999999999', '99999999900011'),
    );
    db.database.prepare(
      `INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at)
       VALUES (?, ?, 'research-agent', 'discovery.prospect_created', ?, ?)`,
    ).run(
      'gate-p-one',
      'p-one',
      JSON.stringify({ gateVersion: 'COMMERCIAL_ELIGIBILITY_V2.6.0' }),
      '2026-09-08T10:00:00.000Z',
    );
    await repository.saveContact({
      id: 'contact-one',
      prospectId: 'p-one',
      email: 'published@example.fr',
      sourceUrl: 'https://example.fr/contact',
      sourceType: 'official_site',
      confidence: 95,
      isValidated: true,
      isSuppressed: false,
      createdAt: '2026-09-08T11:00:00.000Z',
      updatedAt: '2026-09-08T11:00:00.000Z',
    });
    await repository.saveContact({
      id: 'contact-two',
      prospectId: 'p-two',
      email: 'guessed@example.fr',
      sourceUrl: 'https://example.fr',
      sourceType: 'official_site',
      confidence: 95,
      isValidated: false,
      isSuppressed: false,
      createdAt: '2026-09-08T12:00:00.000Z',
      updatedAt: '2026-09-08T12:00:00.000Z',
    });

    const response = await worker.fetch(
      new Request('http://local.test/api/prospects', {
        headers: { authorization: 'Bearer fixture-api' },
      }),
      {
        DB: db,
        MAGICSCRIPT_API_TOKEN: 'fixture-api',
        MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
        MAGICSCRIPT_SENDING_ENABLED: 'false',
        MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
        MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
      },
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    const first = payload.prospects.find((item) => item.id === 'p-one');
    const second = payload.prospects.find((item) => item.id === 'p-two');

    assert.equal(first.contactability.identity.siren, '397877622');
    assert.equal(first.contactability.channels[0].value, 'published@example.fr');
    assert.equal(
      first.contactability.channels[0].sourceUrl,
      'https://example.fr/contact',
    );
    assert.equal(first.contactability.preparation.requiresHumanSend, true);
    assert.equal(first.contactability.preparation.sendsAutomatically, false);
    assert.equal(first.commercialView.category, 'CURRENT');
    assert.equal(second.contactability.identity.siren, '999999999');
    assert.equal(second.contactability.channels[0].value, 'guessed@example.fr');
    assert.equal(second.contactability.preparation, null);
    assert.equal(second.commercialView.category, 'LEGACY');
    assert.deepEqual(payload.prospectViewCounts, {
      CURRENT: 1,
      LEGACY: 1,
      INTERNAL: 0,
      REJECTED: 0,
    });

    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM outreach_messages').get()
        .count,
      0,
    );
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM jobs').get().count,
      0,
    );
  } finally {
    db.close();
  }
});

test('API overview and detail expose the same H2.5-bound PHONE provenance', async () => {
  const db = new FixtureD1();
  try {
    const repository = new D1ProspectRepository(db);
    await repository.saveProspect({
      ...prospect('p-phone', '397877622', '39787762200019'),
      phone: '05 96 71 10 10',
      state: 'QUALIFIED',
    });
    const integrity = evaluateResearchEvidenceIntegrity({
      scoreInputs: {
        digitalGap: 90,
        commercialStrength: 85,
        contactability: 80,
        localFit: 90,
        prototypeLeverage: 85,
        confidence: 90,
      },
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://example.fr/contact',
      derivedPhoneEvidence: {
        phone: '05 96 71 10 10',
        normalizedDigits: '0596711010',
        sourceUrl: 'https://example.fr/contact',
        evidenceType: 'VISIBLE_PAGE_TEXT',
        evidenceOrigin: 'FETCHED_SOURCE',
        independentlyObserved: true,
      },
      sources: [
        {
          url: 'https://directory.example.fr/p-phone',
          note: 'Public listing supports the scored observations.',
          supports: [
            'digitalGap',
            'commercialStrength',
            'contactability',
            'localFit',
            'prototypeLeverage',
          ],
        },
        {
          url: 'https://example.fr/contact',
          note: 'Official contact page displays 05 96 71 10 10.',
          supports: ['phone'],
        },
      ],
    });
    assert.equal(integrity.passed, true);
    assert.ok(integrity.trustedPhone);
    db.database.prepare(
      `INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at)
       VALUES (?, ?, 'scoring-agent', 'research.scored', ?, ?)`,
    ).run(
      'research-scored-phone-1',
      'p-phone',
      JSON.stringify({
        sources: integrity.acceptedSources,
        evidenceIntegrity: {
          passed: integrity.passed,
          reasons: integrity.reasons,
          rejectedSourceCount: integrity.rejectedSourceCount,
          supportedClaims: integrity.supportedClaims,
        },
        phoneEvidence: integrity.trustedPhone,
      }),
      '2026-09-08T10:30:00.000Z',
    );

    const env = {
      DB: db,
      MAGICSCRIPT_API_TOKEN: 'fixture-api',
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
      MAGICSCRIPT_SENDING_ENABLED: 'false',
      MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
      MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
    };
    const request = (path) =>
      worker.fetch(
        new Request(`http://local.test${path}`, {
          headers: { authorization: 'Bearer fixture-api' },
        }),
        env,
      );
    const overviewResponse = await request('/api/prospects');
    const detailResponse = await request('/api/prospects/p-phone');
    assert.equal(overviewResponse.status, 200);
    assert.equal(detailResponse.status, 200);

    const overview = (await overviewResponse.json()).prospects[0].contactability;
    const detail = (await detailResponse.json()).contactability;
    assert.deepEqual(overview, detail);
    assert.deepEqual(overview.channels[0], {
      contactId: 'research-scored-phone-1',
      prospectId: 'p-phone',
      siren: '397877622',
      siret: '39787762200019',
      type: 'PHONE',
      value: '05 96 71 10 10',
      sourceUrl: 'https://example.fr/contact',
      observedAt: '2026-09-08T10:30:00.000Z',
      evidenceEventId: 'research-scored-phone-1',
      status: 'PUBLISHED_VERIFIED',
      usableForFirstOutreach: true,
    });
    assert.deepEqual(overview.preparation, {
      kind: 'PHONE_CALL_PREPARATION',
      contactId: 'research-scored-phone-1',
      evidenceEventId: 'research-scored-phone-1',
      phone: '05 96 71 10 10',
      sourceUrl: 'https://example.fr/contact',
      requiresHumanDial: true,
      dialsAutomatically: false,
    });
    assert.doesNotMatch(JSON.stringify(overview), /whatsapp/i);
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM outreach_messages').get()
        .count,
      0,
    );
    assert.equal(
      db.database.prepare('SELECT COUNT(*) AS count FROM jobs').get().count,
      0,
    );
  } finally {
    db.close();
  }
});

test('first-wave association demotion preserves the prospect in D1', async () => {
  const db = new FixtureD1();
  try {
    const repository = new D1ProspectRepository(db);
    const row = prospect('association-h1', '111111111', '11111111100011');
    const eligibility = scoreCommercialEligibility({
      ...row,
      localActivity: '47.51Z',
      legalNature: '9220',
      companyCategory: 'PME',
      companyEmployeeBand: '03',
      isHeadOffice: true,
      numberOpenEstablishments: 1,
      companyCreationDate: '2026-09-01',
      asOfDate: '2026-09-08',
    });
    assert.equal(eligibility.classification, 'RESEARCH');
    await repository.saveProspect({ ...row, commercialEligibility: eligibility.classification });
    const saved = await repository.listProspects();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, row.id);
    assert.equal(saved[0].siren, row.siren);
    assert.equal(saved[0].commercialEligibility, 'RESEARCH');
  } finally {
    db.close();
  }
});
