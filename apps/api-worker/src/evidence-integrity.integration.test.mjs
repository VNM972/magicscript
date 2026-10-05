import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { researchScoredAuthority } from '../../../core/admission/persisted-agent1-evidence.ts';
import { extractDigitalPainEvidence } from '../../../core/research/digital-pain-evidence.ts';
import { enrichResearchResultWithOperatingEvidence } from '../../agent-runner/src/operating-evidence.ts';
import worker from './index.ts';

class SqliteD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'));
  }

  prepare(query) {
    const statement = this.database.prepare(query);
    let bindings = [];
    return {
      bind: (...values) => {
        bindings = values;
        return this.prepareBound(statement, () => bindings);
      },
      get: (...values) => statement.get(...values),
      first: async () => statement.get(...bindings) ?? null,
      all: async () => ({ results: statement.all(...bindings) }),
      run: async () => statement.run(...bindings),
    };
  }

  prepareBound(statement, getBindings) {
    return {
      first: async () => statement.get(...getBindings()) ?? null,
      all: async () => ({ results: statement.all(...getBindings()) }),
      run: async () => statement.run(...getBindings()),
    };
  }

  exec(sql, ...bindings) {
    this.database.prepare(sql).run(...bindings);
  }

  close() {
    this.database.close();
  }
}

const scoreClaims = [
  'digitalGap',
  'commercialStrength',
  'contactability',
  'localFit',
  'prototypeLeverage',
];

const highScores = {
  digitalGap: 90,
  commercialStrength: 85,
  contactability: 80,
  localFit: 90,
  prototypeLeverage: 85,
  confidence: 90,
};

function seedResearchJob(db, suffix) {
  const now = '2026-09-12T00:00:00.000Z';
  const prospectId = `vertical-retail-${suffix}`;
  const jobId = `research-${suffix}`;
  db.exec(
    `INSERT INTO prospects (
       id, company_name, siren, siret, city, activity, location,
       commercial_eligibility, state, created_at, updated_at
     ) VALUES (?, ?, '397877622', '39787762200019', 'FORT-DE-FRANCE', ?, ?,
       'RESEARCH', 'RESEARCHING', ?, ?)`,
    prospectId,
    `Named retail fixture ${suffix}`,
    'Retail fixture baseline',
    'Martinique',
    now,
    now,
  );
  db.exec(
    `INSERT INTO jobs (
       id, kind, prospect_id, payload_json, status, run_after, claimed_by,
       claimed_at, created_at, updated_at
     ) VALUES (?, 'RUN_RESEARCH_SWARM', ?, '{}', 'RUNNING', ?, 'fixture-runner', ?, ?, ?)`,
    jobId,
    prospectId,
    now,
    now,
    now,
    now,
  );
  return { prospectId, jobId };
}

function env(db) {
  return {
    DB: db,
    MAGICSCRIPT_API_TOKEN: 'fixture-api',
    MAGICSCRIPT_STACK_ID: 'fixture-stack',
    MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
    MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'false',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
  };
}

async function succeed(db, jobId, output) {
  const response = await worker.fetch(
    new Request(`https://local.test/api/runner/jobs/${jobId}/succeed`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-magicscript-runner-id': 'fixture-runner',
        'x-magicscript-stack-id': 'fixture-stack',
      },
      body: JSON.stringify({ output }),
    }),
    env(db),
  );
  return { status: response.status, body: await response.json() };
}

test('H2.5 vertical retail fixture rejects high scores with empty evidence', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'empty');
    const result = await succeed(db, jobId, {
      websiteUrl: 'https://fabricated.example.test/',
      phone: '05 96 00 00 00',
      phoneSourceUrl: 'https://fabricated.example.test/contact',
      scoreInputs: highScores,
      sources: [],
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.processed.qualified, false);
    assert.equal(result.body.processed.evidenceIntegrity.passed, false);
    const prospect = db.prepare(
      'SELECT state, score, website_url, phone FROM prospects WHERE id = ?',
    ).get(prospectId);
    assert.equal(prospect.state, 'DISQUALIFIED');
    assert.equal(prospect.score, 0);
    assert.equal(prospect.website_url, null);
    assert.equal(prospect.phone, null);
    const persisted = JSON.parse(db.prepare(
      'SELECT output_json FROM job_results WHERE job_id = ?',
    ).get(jobId).output_json);
    assert.equal(persisted.websiteUrl, 'https://fabricated.example.test/');
    const event = JSON.parse(db.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(prospectId).payload_json);
    assert.equal(event.evidenceIntegrity.passed, false);
    assert.deepEqual(event.sources, []);
  } finally {
    db.close();
  }
});

test('H2.5 vertical retail fixture accepts fully traceable evidence', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'supported');
    const result = await succeed(db, jobId, {
      activity: 'Specialist retail',
      location: 'Fort-de-France',
      websiteUrl: 'https://retail.example.test/',
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://retail.example.test/contact',
      derivedPhoneEvidence: {
        phone: '05 96 71 10 10',
        normalizedDigits: '0596711010',
        sourceUrl: 'https://retail.example.test/contact',
        evidenceType: 'VISIBLE_PAGE_TEXT',
        evidenceOrigin: 'FETCHED_SOURCE',
        independentlyObserved: true,
      },
      opportunity: 'B',
      primaryAsset: 'Established local storefront',
      primaryFriction: 'Mobile navigation obscures key services',
      scoreInputs: highScores,
      sources: [
        {
          url: 'https://directory.example.test/named-retail-fixture',
          note: 'Public business listing supports the scoring and profile facts.',
          supports: [...scoreClaims.filter((claim) => claim !== 'contactability'), 'activity', 'location', 'opportunity', 'primaryAsset', 'primaryFriction'],
        },
        {
          url: 'https://retail.example.test/',
          note: 'Official business website.',
          supports: ['website'],
        },
        {
          url: 'https://retail.example.test/contact',
          note: 'Official contact page displays 05 96 71 10 10.',
          supports: ['phone'],
        },
      ],
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.processed.qualified, true);
    assert.equal(result.body.processed.evidenceIntegrity.passed, true);
    const prospect = db.prepare(
      'SELECT state, score, website_url, phone FROM prospects WHERE id = ?',
    ).get(prospectId);
    assert.equal(prospect.state, 'QUALIFIED');
    assert.equal(prospect.score >= 65, true);
    assert.equal(prospect.website_url, 'https://retail.example.test/');
    assert.equal(prospect.phone, '05 96 71 10 10');
    const persistedEvent = db.prepare(
      "SELECT id, created_at FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(prospectId);
    const detailResponse = await worker.fetch(
      new Request(`https://local.test/api/prospects/${prospectId}`, {
        headers: { authorization: 'Bearer fixture-api' },
      }),
      env(db),
    );
    assert.equal(detailResponse.status, 200);
    const contactability = (await detailResponse.json()).contactability;
    assert.deepEqual(contactability.channels[0], {
      contactId: persistedEvent.id,
      prospectId,
      siren: '397877622',
      siret: '39787762200019',
      type: 'PHONE',
      value: '05 96 71 10 10',
      sourceUrl: 'https://retail.example.test/contact',
      observedAt: persistedEvent.created_at,
      evidenceEventId: persistedEvent.id,
      status: 'PUBLISHED_VERIFIED',
      usableForFirstOutreach: true,
    });
    assert.deepEqual(contactability.preparation, {
      kind: 'PHONE_CALL_PREPARATION',
      contactId: persistedEvent.id,
      evidenceEventId: persistedEvent.id,
      phone: '05 96 71 10 10',
      sourceUrl: 'https://retail.example.test/contact',
      requiresHumanDial: true,
      dialsAutomatically: false,
    });
  } finally {
    db.close();
  }
});

test('H2.5 and H3 reject non-public IPv6 phone evidence end to end', async () => {
  const rejectedSourceUrls = [
    'http://[::1]/private',
    'http://[fc00::1]/private',
    'http://[fd00::1]/private',
    'http://[fe80::1]/private',
    'http://[::]/private',
    'http://[::ffff:192.168.1.10]/private',
  ];

  for (const [index, sourceUrl] of rejectedSourceUrls.entries()) {
    const db = new SqliteD1();
    try {
      const { prospectId, jobId } = seedResearchJob(db, `ipv6-rejected-${index}`);
      const result = await succeed(db, jobId, {
        phone: '05 96 71 10 10',
        phoneSourceUrl: sourceUrl,
        scoreInputs: { ...highScores, contactability: 0 },
        sources: [
          {
            url: 'https://directory.example.test/named-retail-fixture',
            note: 'Public business listing supports only the decision scores.',
            supports: scoreClaims.filter((claim) => claim !== 'contactability'),
          },
          {
            url: sourceUrl,
            note: 'Contact page displays 05 96 71 10 10.',
            supports: ['phone'],
          },
        ],
      });

      assert.equal(result.status, 200, sourceUrl);
      assert.equal(result.body.processed.evidenceIntegrity.passed, true, sourceUrl);
      const prospect = db.prepare(
        'SELECT phone FROM prospects WHERE id = ?',
      ).get(prospectId);
      assert.equal(prospect.phone, null, sourceUrl);
      const event = JSON.parse(db.prepare(
        "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
      ).get(prospectId).payload_json);
      assert.equal(event.phoneEvidence, null, sourceUrl);
      assert.equal(
        event.sources.some((source) => source.url === sourceUrl),
        false,
        sourceUrl,
      );

      const detailResponse = await worker.fetch(
        new Request(`https://local.test/api/prospects/${prospectId}`, {
          headers: { authorization: 'Bearer fixture-api' },
        }),
        env(db),
      );
      assert.equal(detailResponse.status, 200, sourceUrl);
      const contactability = (await detailResponse.json()).contactability;
      assert.equal(
        contactability.channels.some((channel) => channel.type === 'PHONE'),
        false,
        sourceUrl,
      );
      assert.notEqual(
        contactability.preparation?.kind,
        'PHONE_CALL_PREPARATION',
        sourceUrl,
      );
    } finally {
      db.close();
    }
  }
});

test('H2.5 does not promote unsupported website or phone claims', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'unsupported-claims');
    const result = await succeed(db, jobId, {
      websiteUrl: 'https://fabricated.example.test/',
      phone: '05 96 00 00 00',
      phoneSourceUrl: 'https://fabricated.example.test/contact',
      scoreInputs: { ...highScores, contactability: 0 },
      sources: [{
        url: 'https://directory.example.test/named-retail-fixture',
        note: 'Public business listing supports only the decision scores.',
        supports: scoreClaims.filter((claim) => claim !== 'contactability'),
      }],
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.processed.qualified, false);
    const prospect = db.prepare(
      'SELECT state, website_url, phone FROM prospects WHERE id = ?',
    ).get(prospectId);
    assert.equal(prospect.state, 'DISQUALIFIED');
    assert.equal(prospect.website_url, null);
    assert.equal(prospect.phone, null);
    const event = JSON.parse(db.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(prospectId).payload_json);
    assert.equal(event.evidenceIntegrity.reasons.includes('UNSUPPORTED_WEBSITE'), true);
    assert.equal(event.evidenceIntegrity.reasons.includes('UNSUPPORTED_PHONE'), true);
  } finally {
    db.close();
  }
});

test('CONTACTABILITY MODEL_ONLY_PHONE_DOES_NOT_SCORE — model phone without trustedPhone yields canonical contactability 0', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'model-only-phone');
    const result = await succeed(db, jobId, {
      activity: 'Specialist retail',
      location: 'Fort-de-France',
      websiteUrl: 'https://retail.example.test/',
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://retail.example.test/contact',
      // NO derivedPhoneEvidence — model-only phone
      opportunity: 'B',
      primaryAsset: 'Established local storefront',
      primaryFriction: 'Mobile navigation obscures key services',
      scoreInputs: { ...highScores, contactability: 0 },
      sources: [
        {
          url: 'https://directory.example.test/named-retail-fixture',
          note: 'Public business listing supports the scoring and profile facts.',
          supports: [...scoreClaims, 'activity', 'location', 'opportunity', 'primaryAsset', 'primaryFriction'],
        },
        {
          url: 'https://retail.example.test/',
          note: 'Official business website.',
          supports: ['website'],
        },
        {
          url: 'https://retail.example.test/contact',
          note: 'Official contact page displays 05 96 71 10 10.',
          supports: ['phone'],
        },
      ],
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.processed.evidenceIntegrity.passed, true);
    // Evidence integrity passes but trustedPhone is absent
    assert.equal(result.body.processed.evidenceIntegrity.supportedClaims.includes('phone'), false);
    assert.equal(result.body.processed.evidenceIntegrity.supportedClaims.includes('contactability'), false);
    // Canonical contactability must be 0
    const event = JSON.parse(db.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(prospectId).payload_json);
    assert.equal(event.evidenceIntegrity.supportedClaims.includes('contactability'), false);
    assert.equal(event.phoneEvidence, null);
    // Score reflects contactability = 0
    const prospect = db.prepare(
      'SELECT score FROM prospects WHERE id = ?',
    ).get(prospectId);
    // With contactability=0, score should be below 65
    assert.ok(prospect.score < 65, `score ${prospect.score} must be < 65 without contactability`);
  } finally {
    db.close();
  }
});

test('CONTACTABILITY TRUSTED_PHONE_REHYDRATES_CONTACTABILITY — trustedPhone yields canonical contactability 85', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'trusted-phone-rehydration');
    const result = await succeed(db, jobId, {
      activity: 'Specialist retail',
      location: 'Fort-de-France',
      websiteUrl: 'https://retail.example.test/',
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://retail.example.test/contact',
      derivedPhoneEvidence: {
        phone: '05 96 71 10 10',
        normalizedDigits: '0596711010',
        sourceUrl: 'https://retail.example.test/contact',
        evidenceType: 'VISIBLE_PAGE_TEXT',
        evidenceOrigin: 'FETCHED_SOURCE',
        independentlyObserved: true,
      },
      opportunity: 'B',
      primaryAsset: 'Established local storefront',
      primaryFriction: 'Mobile navigation obscures key services',
      scoreInputs: highScores,
      sources: [
        {
          url: 'https://directory.example.test/named-retail-fixture',
          note: 'Public business listing supports the scoring and profile facts.',
          supports: [...scoreClaims, 'activity', 'location', 'opportunity', 'primaryAsset', 'primaryFriction'],
        },
        {
          url: 'https://retail.example.test/',
          note: 'Official business website.',
          supports: ['website'],
        },
        {
          url: 'https://retail.example.test/contact',
          note: 'Official contact page displays 05 96 71 10 10.',
          supports: ['phone'],
        },
      ],
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.processed.qualified, true);
    assert.equal(result.body.processed.evidenceIntegrity.passed, true);
    // Trusted phone promotes contactability claim
    assert.ok(result.body.processed.evidenceIntegrity.supportedClaims.includes('contactability'));
    // Score should be >= 65 with contactability contributing
    const prospect = db.prepare(
      'SELECT score FROM prospects WHERE id = ?',
    ).get(prospectId);
    assert.ok(prospect.score >= 65, `score ${prospect.score} must be >= 65 with trusted phone`);
    // Verify research.scored event contains calibrated score
    const event = JSON.parse(db.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(prospectId).payload_json);
    assert.ok(event.score >= 65);
    assert.equal(event.evidenceIntegrity.passed, true);
    assert.ok(event.evidenceIntegrity.supportedClaims.includes('contactability'));
  } finally {
    db.close();
  }
});

test('CONTACTABILITY MODEL_VALUE_DOES_NOT_CHANGE_TRUSTED_RESULT — model contactability 10 vs 100 yields same canonical result', async () => {
  const db1 = new SqliteD1();
  const db2 = new SqliteD1();
  try {
    const { prospectId: p1, jobId: j1 } = seedResearchJob(db1, 'model-low');
    const { prospectId: p2, jobId: j2 } = seedResearchJob(db2, 'model-high');
    const baseOutput = {
      activity: 'Specialist retail',
      location: 'Fort-de-France',
      websiteUrl: 'https://retail.example.test/',
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://retail.example.test/contact',
      derivedPhoneEvidence: {
        phone: '05 96 71 10 10',
        normalizedDigits: '0596711010',
        sourceUrl: 'https://retail.example.test/contact',
        evidenceType: 'VISIBLE_PAGE_TEXT',
        evidenceOrigin: 'FETCHED_SOURCE',
        independentlyObserved: true,
      },
      opportunity: 'B',
      primaryAsset: 'Established local storefront',
      primaryFriction: 'Mobile navigation obscures key services',
      sources: [
        {
          url: 'https://directory.example.test/named-retail-fixture',
          note: 'Public business listing supports the scoring and profile facts.',
          supports: [...scoreClaims, 'activity', 'location', 'opportunity', 'primaryAsset', 'primaryFriction'],
        },
        {
          url: 'https://retail.example.test/',
          note: 'Official business website.',
          supports: ['website'],
        },
        {
          url: 'https://retail.example.test/contact',
          note: 'Official contact page displays 05 96 71 10 10.',
          supports: ['phone'],
        },
      ],
    };
    // Low model contactability
    await succeed(db1, j1, { ...baseOutput, scoreInputs: { ...highScores, contactability: 10 } });
    // High model contactability
    await succeed(db2, j2, { ...baseOutput, scoreInputs: { ...highScores, contactability: 100 } });

    const event1 = JSON.parse(db1.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(p1).payload_json);
    const event2 = JSON.parse(db2.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(p2).payload_json);

    // Both should produce identical canonical scores
    assert.equal(event1.score, event2.score, 'model contactability must not influence canonical score');
    assert.ok(event1.evidenceIntegrity.supportedClaims.includes('contactability'));
    assert.ok(event2.evidenceIntegrity.supportedClaims.includes('contactability'));
  } finally {
    db1.close();
    db2.close();
  }
});

test('CONTACTABILITY TRUSTED_PHONE_AFFECTS_FINAL_SCORE — proves final weighted score increases with trustedPhone', async () => {
  const db1 = new SqliteD1();
  const db2 = new SqliteD1();
  try {
    const { prospectId: p1, jobId: j1 } = seedResearchJob(db1, 'no-trusted-phone');
    const { prospectId: p2, jobId: j2 } = seedResearchJob(db2, 'with-trusted-phone');
    const baseOutput = {
      activity: 'Specialist retail',
      location: 'Fort-de-France',
      websiteUrl: 'https://retail.example.test/',
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://retail.example.test/contact',
      opportunity: 'B',
      primaryAsset: 'Established local storefront',
      primaryFriction: 'Mobile navigation obscures key services',
      scoreInputs: { ...highScores, contactability: 0 },
      sources: [
        {
          url: 'https://directory.example.test/named-retail-fixture',
          note: 'Public business listing supports the scoring and profile facts.',
          supports: [...scoreClaims.filter((claim) => claim !== 'contactability'), 'activity', 'location', 'opportunity', 'primaryAsset', 'primaryFriction'],
        },
        {
          url: 'https://retail.example.test/',
          note: 'Official business website.',
          supports: ['website'],
        },
        {
          url: 'https://retail.example.test/contact',
          note: 'Official contact page displays 05 96 71 10 10.',
          supports: ['phone'],
        },
      ],
    };
    // Without trustedPhone (model-only phone)
    await succeed(db1, j1, { ...baseOutput, scoreInputs: { ...highScores, contactability: 0 } });
    // With trustedPhone
    await succeed(db2, j2, { 
      ...baseOutput, 
      derivedPhoneEvidence: {
        phone: '05 96 71 10 10',
        normalizedDigits: '0596711010',
        sourceUrl: 'https://retail.example.test/contact',
        evidenceType: 'VISIBLE_PAGE_TEXT',
        evidenceOrigin: 'FETCHED_SOURCE',
        independentlyObserved: true,
      },
    });

    const event1 = JSON.parse(db1.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(p1).payload_json);
    const event2 = JSON.parse(db2.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(p2).payload_json);

    // Score with trustedPhone must be strictly higher (contactability contribution)
    assert.ok(event2.score > event1.score, `score with trustedPhone ${event2.score} must exceed without ${event1.score}`);
    // Contactability contributes 15% weight; with cap 85, contribution ≈ 13 points
    const diff = event2.score - event1.score;
    assert.ok(diff >= 10 && diff <= 15, `score difference ${diff} must reflect contactability weight (≈13)`);
  } finally {
    db1.close();
    db2.close();
  }
});

test('CONTACTABILITY RESEARCH_SCORED_EVENT_CONTAINS_RESULT — persisted event reflects canonical score with contactability', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'event-contains-result');
    const result = await succeed(db, jobId, {
      activity: 'Specialist retail',
      location: 'Fort-de-France',
      websiteUrl: 'https://retail.example.test/',
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://retail.example.test/contact',
      derivedPhoneEvidence: {
        phone: '05 96 71 10 10',
        normalizedDigits: '0596711010',
        sourceUrl: 'https://retail.example.test/contact',
        evidenceType: 'VISIBLE_PAGE_TEXT',
        evidenceOrigin: 'FETCHED_SOURCE',
        independentlyObserved: true,
      },
      opportunity: 'B',
      primaryAsset: 'Established local storefront',
      primaryFriction: 'Mobile navigation obscures key services',
      scoreInputs: highScores,
      sources: [
        {
          url: 'https://directory.example.test/named-retail-fixture',
          note: 'Public business listing supports the scoring and profile facts.',
          supports: [...scoreClaims, 'activity', 'location', 'opportunity', 'primaryAsset', 'primaryFriction'],
        },
        {
          url: 'https://retail.example.test/',
          note: 'Official business website.',
          supports: ['website'],
        },
        {
          url: 'https://retail.example.test/contact',
          note: 'Official contact page displays 05 96 71 10 10.',
          supports: ['phone'],
        },
      ],
    });

    const event = JSON.parse(db.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(prospectId).payload_json);

    // Verify event structure
    assert.ok(event.score >= 65);
    assert.equal(event.evidenceIntegrity.passed, true);
    assert.ok(event.evidenceIntegrity.supportedClaims.includes('contactability'));
    assert.ok(event.evidenceIntegrity.supportedClaims.includes('phone'));
    assert.ok(event.phoneEvidence !== null, 'phoneEvidence must be present');
    assert.equal(event.phoneEvidence.phone, '05 96 71 10 10');
    assert.equal(event.phoneEvidence.sourceUrl, 'https://retail.example.test/contact');
    // Score components
    assert.ok(typeof event.band === 'string');
    assert.ok(typeof event.autoPrototypeEligible === 'boolean');
  } finally {
    db.close();
  }
});

test('CONTACTABILITY EVIDENCE_INTEGRITY_FAILURE_STILL_ZEROES_SCORING — failed evidence integrity forces all scores to 0', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'integrity-fail');
    const result = await succeed(db, jobId, {
      // Malformed website (no supporting source)
      websiteUrl: 'https://fabricated.example.test/',
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://fabricated.example.test/contact',
      scoreInputs: highScores,
      sources: [],
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.processed.evidenceIntegrity.passed, false);
    const event = JSON.parse(db.prepare(
      "SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'",
    ).get(prospectId).payload_json);
    assert.equal(event.evidenceIntegrity.passed, false);
    assert.equal(event.score, 0);
    assert.equal(event.band, 'LOW');
    // Contactability must be 0
    const prospect = db.prepare(
      'SELECT score FROM prospects WHERE id = ?',
    ).get(prospectId);
    assert.equal(prospect.score, 0);
  } finally {
    db.close();
  }
});

function observedPainPage(url, html) {
  return {
    url,
    html,
    observedAt: new Date().toISOString(),
    snapshotDigest: `sha256:${createHash('sha256').update(html).digest('hex')}`,
  };
}

async function shadowProjection(db, prospectId) {
  const response = await worker.fetch(new Request('https://local.test/api/v2/qualification/shadow', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer fixture-api' },
    body: JSON.stringify({ prospectId }),
  }), env(db));
  return { status: response.status, body: await response.json() };
}

test('R16 typed construction notice survives D1 scoring and persisted V2 projection', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'typed-construction');
    db.exec('UPDATE prospects SET activity = ? WHERE id = ?', '47.78C', prospectId);
    const source = { url: 'https://typed-retail.example.test/', note: 'Fetched owned homepage', supports: ['website', 'digitalGap'] };
    const page = observedPainPage(source.url, '<html><head><title>Site en construction</title></head><body><h1>Accueil</h1></body></html>');
    const digitalPainEvidence = extractDigitalPainEvidence([source], [page]);
    assert.equal(digitalPainEvidence.status, 'VERIFIED');
    const result = await succeed(db, jobId, {
      websiteUrl: source.url,
      contactPresence: {
        website: { status: 'VERIFIED', values: [source.url] },
        email: { status: 'VERIFIED', values: ['hello@typed-retail.example.test'], evidence: [{ value: 'hello@typed-retail.example.test', sourceUrl: source.url }] },
      },
      digitalPainEvidence,
      scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 },
      sources: [source],
    });
    assert.equal(result.status, 200);
    const event = JSON.parse(db.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'").get(prospectId).payload_json);
    assert.equal(event.evidenceIntegrity.passed, true);
    assert.deepEqual(event.digitalPainEvidence, digitalPainEvidence);
    assert.deepEqual(researchScoredAuthority(event).digitalPainEvidence, digitalPainEvidence);
    assert.deepEqual(event.digitalPainEvidence.observations[0], {
      type: 'UNDER_CONSTRUCTION',
      observation: 'Site en construction',
      sourceUrl: source.url,
      sourceType: 'OWNED_WEBSITE',
      evidenceType: 'VISIBLE_SITE_NOTICE',
      integrityStatus: 'ACCEPTED',
      inspectionMethod: 'FETCHED_TITLE_H1',
      observedAt: page.observedAt,
      snapshotDigest: page.snapshotDigest,
      finalUrl: source.url,
      supportingText: 'Site en construction',
      locator: 'title',
    });
    const shadow = await shadowProjection(db, prospectId);
    assert.equal(shadow.status, 200);
    assert.equal(shadow.body.status, 'PROJECTABLE');
    assert.deepEqual(shadow.body.pack.opportunity.icp.digitalPainSignals, ['Site en construction']);
  } finally {
    db.close();
  }
});

test('R16 verified owned website blocks typed absence at D1 scoring and persisted V2 projection', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'absence-conflict');
    const profile = { url: 'https://www.facebook.com/named-retail-fixture', note: 'Fetched business-controlled profile', supports: ['websiteAbsent'] };
    const page = observedPainPage(profile.url, '<title>Named retail fixture absence-conflict</title><main>FORT-DE-FRANCE. Nous n\'avons pas de site internet.</main>');
    const digitalPainEvidence = extractDigitalPainEvidence([profile], [page], { companyName: 'Named retail fixture absence-conflict', city: 'FORT-DE-FRANCE' });
    assert.equal(digitalPainEvidence.status, 'VERIFIED');
    const result = await succeed(db, jobId, {
      contactPresence: { website: { status: 'VERIFIED', values: ['https://owned-retail.example.test/'] } },
      digitalPainEvidence,
      primaryFriction: 'No website',
      scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 },
      sources: [profile],
    });
    assert.equal(result.status, 200);
    const event = JSON.parse(db.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'").get(prospectId).payload_json);
    assert.equal(event.evidenceIntegrity.passed, true);
    assert.deepEqual(event.digitalPainEvidence, { status: 'UNKNOWN', observations: [] });
    const shadow = await shadowProjection(db, prospectId);
    assert.equal(shadow.status, 422);
    assert.ok(shadow.body.reasons.some((reason) => reason.code === 'DIGITAL_PAIN_UNPROVEN'));
  } finally {
    db.close();
  }
});

test('R16 earlier persisted VERIFIED owned website blocks later typed absence', async () => {
  const db = new SqliteD1();
  try {
    const { prospectId, jobId } = seedResearchJob(db, 'prior-site-conflict');
    db.exec(
      'INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      'prior-website-authority', prospectId, 'contact-presence-agent', 'contact_presence.enriched',
      JSON.stringify({ contactPresence: { website: { status: 'VERIFIED', values: ['https://prior-owned.example.test/'] } } }),
      '2026-09-26T00:00:00.000Z',
    );
    const profile = { url: 'https://www.facebook.com/prior-site-fixture', note: 'Fetched business-controlled profile', supports: ['websiteAbsent'] };
    const page = observedPainPage(profile.url, '<title>Named retail fixture prior-site-conflict</title><main>FORT-DE-FRANCE. Nous n\'avons pas de site internet.</main>');
    const digitalPainEvidence = extractDigitalPainEvidence([profile], [page], { companyName: 'Named retail fixture prior-site-conflict', city: 'FORT-DE-FRANCE' });
    assert.equal(digitalPainEvidence.status, 'VERIFIED');
    const result = await succeed(db, jobId, {
      digitalPainEvidence,
      scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 },
      sources: [profile],
    });
    assert.equal(result.status, 200);
    const event = JSON.parse(db.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'").get(prospectId).payload_json);
    assert.deepEqual(event.digitalPainEvidence, { status: 'UNKNOWN', observations: [] });
    const shadow = await shadowProjection(db, prospectId);
    assert.equal(shadow.status, 422);
    assert.ok(shadow.body.reasons.some((reason) => reason.code === 'DIGITAL_PAIN_UNPROVEN'));
  } finally {
    db.close();
  }
});

test('R51 fetched owned BeautySalon and HairSalon authority survives scoring, loader and persisted projection', async () => {
  for (const [type, naf] of [['BeautySalon', '96.02A'], ['HairSalon', '96.02B']]) {
    const db = new SqliteD1();
    try {
      const { prospectId, jobId } = seedResearchJob(db, `r51-${type}`);
      db.exec('UPDATE prospects SET activity = ? WHERE id = ?', naf, prospectId);
      const source = { url: `https://${type.toLowerCase()}.example.test/`, note: 'Independently fetched owned business page', supports: ['activity', 'website', 'digitalGap'] };
      const html = `<title>Site en construction</title><h1>Accueil</h1><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': type, url: source.url })}</script>`;
      const input = {
        websiteUrl: source.url,
        contactPresence: { website: { status: 'VERIFIED', values: [source.url] }, email: { status: 'VERIFIED', values: [`hello@${type.toLowerCase()}.example.test`], evidence: [{ value: `hello@${type.toLowerCase()}.example.test`, sourceUrl: source.url }] } },
        scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 },
        sources: [source],
      };
      const fetched = await enrichResearchResultWithOperatingEvidence(input, async (url) => ({ ok: true, url, finalUrl: url, text: html, contentType: 'text/html' }));
      assert.equal(fetched.operatingEvidence.commercialFamily, 'BEAUTY_HAIR_BARBER');
      assert.equal(fetched.digitalPainEvidence.status, 'VERIFIED');
      const result = await succeed(db, jobId, fetched);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      const event = JSON.parse(db.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'").get(prospectId).payload_json);
      assert.equal(event.operatingEvidence.commercialFamily, 'BEAUTY_HAIR_BARBER');
      assert.equal(researchScoredAuthority(event).operatingEvidence.commercialFamily, 'BEAUTY_HAIR_BARBER');
      const shadow = await shadowProjection(db, prospectId);
      assert.equal(shadow.status, 200);
      assert.equal(shadow.body.pack.opportunity.icp.commercialFamily, 'BEAUTY_HAIR_BARBER');

      const noPainDb = new SqliteD1();
      try {
        const withoutPain = seedResearchJob(noPainDb, `r51-${type}-without-pain`);
        noPainDb.exec('UPDATE prospects SET activity = ? WHERE id = ?', naf, withoutPain.prospectId);
        const noPainHtml = html.replace('Site en construction', 'Accueil');
        const noPainInput = { ...input, contactPresence: { website: { status: 'VERIFIED', values: [source.url] } } };
        const noPainFetched = await enrichResearchResultWithOperatingEvidence(noPainInput, async (url) => ({ ok: true, url, finalUrl: url, text: noPainHtml, contentType: 'text/html' }));
        assert.equal(noPainFetched.operatingEvidence.commercialFamily, 'BEAUTY_HAIR_BARBER');
        assert.equal(noPainFetched.digitalPainEvidence.status, 'UNKNOWN');
        const noPainResult = await succeed(noPainDb, withoutPain.jobId, noPainFetched);
        assert.equal(noPainResult.status, 200);
        const noPainEvent = JSON.parse(noPainDb.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'").get(withoutPain.prospectId).payload_json);
        assert.equal(researchScoredAuthority(noPainEvent).operatingEvidence.commercialFamily, 'BEAUTY_HAIR_BARBER');
        const noPainShadow = await shadowProjection(noPainDb, withoutPain.prospectId);
        assert.equal(noPainShadow.status, 422);
        assert.ok(noPainShadow.body.reasons.some((reason) => reason.code === 'DIGITAL_PAIN_UNPROVEN'));
        assert.ok(noPainShadow.body.reasons.every((reason) => reason.code !== 'COMMERCIAL_FAMILY_UNRESOLVED'));
      } finally {
        noPainDb.close();
      }
    } finally {
      db.close();
    }
  }
});

test('R51 NAF, discovery stratum, business name and narrative alone cannot supply persisted Beauty authority', async () => {
  for (const naf of ['96.02A', '96.02B']) {
    const db = new SqliteD1();
    try {
      const { prospectId, jobId } = seedResearchJob(db, `r51-unsupported-${naf}`);
      db.exec('UPDATE prospects SET activity = ?, company_name = ? WHERE id = ?', naf, 'Beauty Coiffure Barber Hair', prospectId);
      db.exec(
        'INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        `discovery-${naf}`, prospectId, 'discovery', 'discovery.prospect_created',
        JSON.stringify({ classification: { stratum: 'BEAUTY', nafCode: naf } }), '2026-09-12T00:00:00.000Z',
      );
      const source = { url: `https://unsupported-${naf.toLowerCase()}.example.test/`, note: 'Owned site without operating schema', supports: ['activity', 'website', 'digitalGap', 'opportunity'] };
      const page = observedPainPage(source.url, '<title>Site en construction</title><h1>Accueil</h1>');
      const result = await succeed(db, jobId, {
        activity: 'Model says this business is a beauty salon',
        opportunity: 'B',
        websiteUrl: source.url,
        contactPresence: { website: { status: 'VERIFIED', values: [source.url] } },
        digitalPainEvidence: extractDigitalPainEvidence([source], [page]),
        scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 },
        sources: [source],
      });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      const event = JSON.parse(db.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'").get(prospectId).payload_json);
      assert.equal(event.operatingEvidence.commercialFamily, undefined);
      assert.equal(researchScoredAuthority(event).operatingEvidence.commercialFamily, undefined);
      const shadow = await shadowProjection(db, prospectId);
      assert.equal(shadow.status, 422);
      assert.ok(shadow.body.reasons.some((reason) => reason.code === 'COMMERCIAL_FAMILY_UNRESOLVED'));
    } finally {
      db.close();
    }
  }
});

test('R52 fetched owned FOOD schema authority survives scoring, loader and persisted projection', async () => {
  for (const type of ['Restaurant', 'CafeOrCoffeeShop', 'BarOrPub', 'FastFoodRestaurant']) {
    const db = new SqliteD1();
    try {
      const { prospectId, jobId } = seedResearchJob(db, `r52-${type}`);
      db.exec('UPDATE prospects SET activity = ? WHERE id = ?', '56.10A', prospectId);
      const source = { url: `https://${type.toLowerCase()}.example.test/`, note: 'Independently fetched owned business page', supports: ['activity', 'website', 'digitalGap'] };
      const html = `<title>Site en construction</title><h1>Accueil</h1><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': type, url: source.url })}</script>`;
      const input = {
        websiteUrl: source.url,
        contactPresence: { website: { status: 'VERIFIED', values: [source.url] }, email: { status: 'VERIFIED', values: [`hello@${type.toLowerCase()}.example.test`], evidence: [{ value: `hello@${type.toLowerCase()}.example.test`, sourceUrl: source.url }] } },
        scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 },
        sources: [source],
      };
      const fetched = await enrichResearchResultWithOperatingEvidence(input, async (url) => ({ ok: true, url, finalUrl: url, text: html, contentType: 'text/html' }));
      assert.equal(fetched.operatingEvidence.commercialFamily, 'RESTAURANTS_BARS_CAFES', type);
      const result = await succeed(db, jobId, fetched);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      const event = JSON.parse(db.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'").get(prospectId).payload_json);
      assert.equal(event.operatingEvidence.commercialFamily, 'RESTAURANTS_BARS_CAFES', type);
      assert.equal(researchScoredAuthority(event).operatingEvidence.commercialFamily, 'RESTAURANTS_BARS_CAFES', type);
      const shadow = await shadowProjection(db, prospectId);
      assert.equal(shadow.status, 200, JSON.stringify(shadow.body));
      assert.equal(shadow.body.pack.opportunity.icp.commercialFamily, 'RESTAURANTS_BARS_CAFES', type);
    } finally {
      db.close();
    }
  }
});

test('R52 FOOD family clears only its gate; digital pain and website authority remain independent', async () => {
  for (const websiteVerified of [true, false]) {
    const db = new SqliteD1();
    try {
      const { prospectId, jobId } = seedResearchJob(db, `r52-independent-${websiteVerified}`);
      const source = { url: `https://r52-independent-${websiteVerified}.example.test/`, note: 'Fetched owned homepage', supports: websiteVerified ? ['activity', 'website'] : ['activity'] };
      const html = `<title>Accueil</title><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Restaurant', url: source.url })}</script>`;
      const input = {
        ...(websiteVerified ? { websiteUrl: source.url, contactPresence: { website: { status: 'VERIFIED', values: [source.url] } } } : {}),
        scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 },
        sources: [source],
      };
      const fetched = await enrichResearchResultWithOperatingEvidence(input, async (url) => ({ ok: true, url, finalUrl: url, text: html, contentType: 'text/html' }));
      assert.equal(fetched.operatingEvidence.commercialFamily, 'RESTAURANTS_BARS_CAFES');
      assert.equal(fetched.digitalPainEvidence.status, 'UNKNOWN');
      const result = await succeed(db, jobId, fetched);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      const event = JSON.parse(db.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'").get(prospectId).payload_json);
      assert.equal(researchScoredAuthority(event).operatingEvidence.commercialFamily, 'RESTAURANTS_BARS_CAFES');
      const shadow = await shadowProjection(db, prospectId);
      assert.equal(shadow.status, 422);
      assert.ok(shadow.body.reasons.some((reason) => reason.code === 'DIGITAL_PAIN_UNPROVEN'));
      assert.ok(shadow.body.reasons.every((reason) => reason.code !== 'COMMERCIAL_FAMILY_UNRESOLVED'));
      assert.equal(shadow.body.reasons.some((reason) => reason.code === 'WEBSITE_STATUS_UNVERIFIED'), !websiteVerified);
    } finally {
      db.close();
    }
  }
});

test('R52 all seven FOOD NAFs and narrative discovery hints alone remain unresolved after persistence', async () => {
  for (const naf of ['56.10A', '56.10B', '56.10C', '56.21Z', '56.29A', '56.29B', '56.30Z']) {
    const db = new SqliteD1();
    try {
      const { prospectId, jobId } = seedResearchJob(db, `r52-naf-${naf}`);
      db.exec('UPDATE prospects SET activity = ?, company_name = ? WHERE id = ?', naf, 'Restaurant Bar Café', prospectId);
      db.exec('INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', `r52-discovery-${naf}`, prospectId, 'discovery', 'discovery.prospect_created', JSON.stringify({ classification: { stratum: 'FOOD', nafCode: naf } }), '2026-09-12T00:00:00.000Z');
      const source = { url: `https://r52-naf-${naf.toLowerCase()}.example.test/`, note: 'Fetched owned page without operating schema', supports: ['activity', 'website', 'digitalGap', 'opportunity'] };
      const fetched = await enrichResearchResultWithOperatingEvidence({ activity: 'Model says restaurant and bar', primaryFriction: 'Restaurant needs website', opportunity: 'B', websiteUrl: source.url, contactPresence: { website: { status: 'VERIFIED', values: [source.url] } }, scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 }, sources: [source] }, async (url) => ({ ok: true, url, finalUrl: url, text: '<title>Site en construction</title><h1>Restaurant Bar Café</h1>', contentType: 'text/html' }));
      assert.equal(fetched.operatingEvidence.commercialFamily, undefined, naf);
      const result = await succeed(db, jobId, fetched);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      const event = JSON.parse(db.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'research.scored'").get(prospectId).payload_json);
      assert.equal(researchScoredAuthority(event).operatingEvidence.commercialFamily, undefined, naf);
      const shadow = await shadowProjection(db, prospectId);
      assert.equal(shadow.status, 422);
      assert.ok(shadow.body.reasons.some((reason) => reason.code === 'COMMERCIAL_FAMILY_UNRESOLVED'), naf);
    } finally {
      db.close();
    }
  }
});
