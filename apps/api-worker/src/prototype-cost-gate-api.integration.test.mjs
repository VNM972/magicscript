import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from './index.ts';

class SqliteD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(
      readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'),
    );
  }

  prepare(query) {
    const statement = this.database.prepare(query);
    let bindings = [];

    return {
      bind: (...values) => {
        bindings = values;
        return {
          first: async () => statement.get(...bindings) ?? null,
          all: async () => ({ results: statement.all(...bindings) }),
          run: async () => statement.run(...bindings),
        };
      },
      first: async () => statement.get(...bindings) ?? null,
      all: async () => ({ results: statement.all(...bindings) }),
      run: async () => statement.run(...bindings),
    };
  }

  exec(sql, ...bindings) {
    this.database.prepare(sql).run(...bindings);
  }

  close() {
    this.database.close();
  }
}

function request(path, method, body, env, token = 'wp07-api-token') {
  return worker.fetch(
    new Request(`https://local.test${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
}

async function json(response) {
  return {
    status: response.status,
    body: await response.json(),
  };
}

function createEnv(db) {
  return {
    DB: db,
    MAGICSCRIPT_API_TOKEN: 'wp07-api-token',
    MAGICSCRIPT_PUBLIC_BASE_URL: 'https://magicscript.fr',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  };
}

function insertInterestedProspect(db) {
  db.exec(
    `INSERT INTO prospects (
      id,
      company_name,
      opportunity,
      state,
      score,
      primary_friction,
      primary_asset,
      primary_cta,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'p-wp07-go',
    'WP07 GO Prospect',
    'A',
    'INTERESTED',
    85,
    'No credible digital presence',
    'Official logo',
    'Request a quote',
    '2026-09-04T09:00:00.000Z',
    '2026-09-04T09:00:00.000Z',
  );

  db.exec(
    `INSERT INTO events (
      id,
      prospect_id,
      actor,
      type,
      payload_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    'wp07-message',
    'p-wp07-go',
    'prospect',
    'sales_room.message_received',
    JSON.stringify({
      idempotencyKey: 'wp07-qualified-interest',
      nextOwner: 'stephane',
    }),
    '2026-09-04T09:05:00.000Z',
  );

  insertResearchScope(db, 'p-wp07-go', 5);
}

function insertResearchScope(db, prospectId, blockCount) {
  const jobId = `research-${prospectId}`;

  db.exec(
    `INSERT INTO jobs (
      id,
      kind,
      prospect_id,
      payload_json,
      status,
      attempts,
      max_attempts,
      run_after,
      last_error,
      claimed_by,
      claimed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId,
    'RUN_RESEARCH_SWARM',
    prospectId,
    JSON.stringify({}),
    'SUCCEEDED',
    1,
    3,
    '2026-09-04T08:00:00.000Z',
    null,
    null,
    null,
    '2026-09-04T08:00:00.000Z',
    '2026-09-04T08:05:00.000Z',
  );

  db.exec(
    `INSERT INTO job_results (
      job_id,
      output_json,
      created_at
    ) VALUES (?, ?, ?)`,
    jobId,
    JSON.stringify({
      sourceNavigationBlocks: Array.from(
        { length: blockCount },
        (_, index) => ({
          label: `Bloc ${index + 1}`,
          kind:
            index === blockCount - 1
              ? 'conversion_cta'
              : 'content_block',
        }),
      ),
    }),
    '2026-09-04T08:05:00.000Z',
  );
}

test('WP-07 evaluates and persists GO without starting prototype work', async () => {
  const db = new SqliteD1();
  insertInterestedProspect(db);
  const env = createEnv(db);

  const jobsBefore = db.database
    .prepare(`
      SELECT COUNT(*) AS count
      FROM jobs
      WHERE kind IN ('GENERATE_PROTOTYPE_STRATEGY', 'BUILD_PROTOTYPE')
    `)
    .get().count;

  const evaluated = await json(
    await request(
      '/api/prospects/p-wp07-go/prototype-cost-gate/evaluate',
      'POST',
      {},
      env,
    ),
  );

  assert.equal(evaluated.status, 200);
  assert.equal(evaluated.body.ok, true);
  assert.equal(evaluated.body.evaluation.prospectId, 'p-wp07-go');
  assert.equal(evaluated.body.evaluation.decision, 'GO');
  assert.equal(evaluated.body.evaluation.authorization, 'FULL');
  assert.equal(evaluated.body.evaluation.computeClass, 'MEDIUM');
  assert.equal(evaluated.body.evaluation.estimatedExternalCost.kind, 'UNKNOWN');
  assert.equal(evaluated.body.evaluation.computeClass, 'MEDIUM');
  assert.ok(
    evaluated.body.evaluation.reasonCodes.includes(
      'COMPUTE_FROM_RESEARCH_SCOPE',
    ),
  );
  assert.ok(
    evaluated.body.evaluation.reasonCodes.includes(
      'RESEARCH_SCOPE_BLOCKS_5',
    ),
  );
  assert.equal(evaluated.body.evaluation.reevaluateAt, null);

  const persistedCount = db.database
    .prepare(`
      SELECT COUNT(*) AS count
      FROM prototype_cost_gate_evaluations
      WHERE prospect_id = ?
    `)
    .get('p-wp07-go').count;

  assert.equal(persistedCount, 1);

  const jobsAfter = db.database
    .prepare(`
      SELECT COUNT(*) AS count
      FROM jobs
      WHERE kind IN ('GENERATE_PROTOTYPE_STRATEGY', 'BUILD_PROTOTYPE')
    `)
    .get().count;

  assert.equal(jobsBefore, 0);
  assert.equal(jobsAfter, 0);

  const current = await json(
    await request(
      '/api/prospects/p-wp07-go/prototype-cost-gate',
      'GET',
      undefined,
      env,
    ),
  );

  assert.equal(current.status, 200);
  assert.equal(current.body.ok, true);
  assert.equal(current.body.evaluation.decision, 'GO');
  assert.equal(
    current.body.evaluation.id,
    evaluated.body.evaluation.id,
  );

  const prospectState = db.database
    .prepare('SELECT state FROM prospects WHERE id = ?')
    .get('p-wp07-go').state;

  assert.equal(prospectState, 'INTERESTED');

  db.close();
});

test('WP-07 refuses evaluation outside eligible Cost Gate states without persisting anything', async () => {
  const db = new SqliteD1();

  db.exec(
    `INSERT INTO prospects (
      id,
      company_name,
      opportunity,
      state,
      score,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'p-wp07-ineligible',
    'WP07 Ineligible',
    'A',
    'QUALIFIED',
    95,
    '2026-09-04T09:00:00.000Z',
    '2026-09-04T09:00:00.000Z',
  );

  const env = createEnv(db);

  const response = await json(
    await request(
      '/api/prospects/p-wp07-ineligible/prototype-cost-gate/evaluate',
      'POST',
      {},
      env,
    ),
  );

  assert.equal(response.status, 409);

  const count = db.database
    .prepare(`
      SELECT COUNT(*) AS count
      FROM prototype_cost_gate_evaluations
      WHERE prospect_id = ?
    `)
    .get('p-wp07-ineligible').count;

  assert.equal(count, 0);

  db.close();
});

test('WP-07 reevaluates MEETING_BOOKED without creating prototype work', async () => {
  const db = new SqliteD1();

  db.exec(
    `INSERT INTO prospects (
      id,
      company_name,
      opportunity,
      state,
      score,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'p-wp07-meeting',
    'WP07 Meeting',
    'A',
    'MEETING_BOOKED',
    95,
    '2026-09-04T09:00:00.000Z',
    '2026-09-04T09:00:00.000Z',
  );

  insertResearchScope(db, 'p-wp07-meeting', 2);

  const env = createEnv(db);

  const response = await json(
    await request(
      '/api/prospects/p-wp07-meeting/prototype-cost-gate/evaluate',
      'POST',
      {},
      env,
    ),
  );

  assert.equal(response.body.ok, true);
  assert.equal(response.body.evaluation.prospectId, 'p-wp07-meeting');
  assert.equal(response.body.evaluation.decision, 'LIGHT');
  assert.equal(response.body.evaluation.authorization, 'LIGHT');
  assert.equal(response.body.evaluation.computeClass, 'LOW');
  assert.equal(response.body.evaluation.reevaluateAt, null);
  assert.ok(
    response.body.evaluation.reasonCodes.includes('MEETING_BOOKED_SIGNAL'),
  );

  const evaluationCount = db.database
    .prepare(`
      SELECT COUNT(*) AS count
      FROM prototype_cost_gate_evaluations
      WHERE prospect_id = ?
    `)
    .get('p-wp07-meeting').count;

  assert.equal(evaluationCount, 1);

  const prototypeJobCount = db.database
    .prepare(`
      SELECT COUNT(*) AS count
      FROM jobs
      WHERE prospect_id = ?
        AND kind IN ('GENERATE_PROTOTYPE_STRATEGY', 'BUILD_PROTOTYPE')
    `)
    .get('p-wp07-meeting').count;

  assert.equal(prototypeJobCount, 0);

  const state = db.database
    .prepare('SELECT state FROM prospects WHERE id = ?')
    .get('p-wp07-meeting').state;

  assert.equal(state, 'MEETING_BOOKED');

  db.close();
});

test('WP-07 uses UNKNOWN compute when verified research scope is unavailable and never authorizes FULL', async () => {
  const db = new SqliteD1();
  insertInterestedProspect(db);

  db.exec('DELETE FROM job_results');
  db.exec("DELETE FROM jobs WHERE kind = 'RUN_RESEARCH_SWARM'");

  const env = createEnv(db);

  const response = await json(
    await request(
      '/api/prospects/p-wp07-go/prototype-cost-gate/evaluate',
      'POST',
      {},
      env,
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.body.evaluation.computeClass,
    'UNKNOWN',
  );
  assert.notEqual(
    response.body.evaluation.authorization,
    'FULL',
  );
  assert.ok(
    response.body.evaluation.reasonCodes.includes(
      'COMPUTE_SCOPE_UNKNOWN',
    ),
  );
  assert.ok(
    response.body.evaluation.reasonCodes.includes(
      'COMPUTE_UNKNOWN',
    ),
  );

  db.close();
});

test('WP-07 rejects caller-supplied compute class and external cost', async () => {
  const db = new SqliteD1();
  insertInterestedProspect(db);
  const env = createEnv(db);

  const response = await json(
    await request(
      '/api/prospects/p-wp07-go/prototype-cost-gate/evaluate',
      'POST',
      {
        computeClass: 'LOW',
        estimatedExternalCost: {
          kind: 'KNOWN',
          amountEur: 0,
          source: 'caller-controlled',
        },
      },
      env,
    ),
  );

  assert.equal(response.status, 400);
  assert.match(
    response.body.error,
    /inputs are derived internally/,
  );

  const count = db.database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM prototype_cost_gate_evaluations
       WHERE prospect_id = ?`,
    )
    .get('p-wp07-go').count;

  assert.equal(count, 0);

  db.close();
});

test('WP-07 persists NO-GO with an exact 30-day reevaluation and no prototype job', async () => {
  const db = new SqliteD1();

  db.exec(
    `INSERT INTO prospects (
      id,
      company_name,
      opportunity,
      state,
      score,
      website_url,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'p-wp07-nogo',
    'WP07 NO-GO Prospect',
    'D',
    'INTERESTED',
    20,
    'https://existing.example.test',
    '2026-09-04T09:00:00.000Z',
    '2026-09-04T09:00:00.000Z',
  );

  insertResearchScope(db, 'p-wp07-nogo', 9);

  const env = createEnv(db);

  const response = await json(
    await request(
      '/api/prospects/p-wp07-nogo/prototype-cost-gate/evaluate',
      'POST',
      {},
      env,
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.evaluation.decision, 'NO-GO');
  assert.equal(response.body.evaluation.authorization, 'NONE');
  assert.equal(response.body.evaluation.computeClass, 'HIGH');

  const evaluatedAt = new Date(response.body.evaluation.evaluatedAt).getTime();
  const reevaluateAt = new Date(response.body.evaluation.reevaluateAt).getTime();

  assert.equal(reevaluateAt - evaluatedAt, 30 * 24 * 60 * 60 * 1000);

  const prototypeJobs = db.database
    .prepare(`
      SELECT COUNT(*) AS count
      FROM jobs
      WHERE kind IN ('GENERATE_PROTOTYPE_STRATEGY', 'BUILD_PROTOTYPE')
    `)
    .get().count;

  assert.equal(prototypeJobs, 0);

  db.close();
});

test('WP-07 exposes the latest Cost Gate evaluation through the prospects projection', async () => {
  const db = new SqliteD1();
  insertInterestedProspect(db);
  const env = createEnv(db);

  const evaluated = await json(
    await request(
      '/api/prospects/p-wp07-go/prototype-cost-gate/evaluate',
      'POST',
      {},
      env,
    ),
  );

  assert.equal(evaluated.status, 200);

  const list = await json(
    await request('/api/prospects', 'GET', undefined, env),
  );

  assert.equal(list.status, 200);

  const prospect = list.body.prospects.find(
    (candidate) => candidate.id === 'p-wp07-go',
  );

  assert.ok(prospect);
  assert.equal(prospect.prototypeCostGate.decision, 'GO');
  assert.equal(prospect.prototypeCostGate.authorization, 'FULL');
  assert.equal(
    prospect.prototypeCostGate.id,
    evaluated.body.evaluation.id,
  );

  db.close();
});


function insertPrototypeClaimProspect(db, id, state) {
  db.exec(
    `INSERT INTO prospects (
      id,
      company_name,
      opportunity,
      state,
      score,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    `Claim ${id}`,
    'A',
    state,
    90,
    '2026-09-04T09:00:00.000Z',
    '2026-09-04T09:00:00.000Z',
  );
}

function insertPrototypeClaimGate(
  db,
  id,
  prospectId,
  authorization,
) {
  const decision =
    authorization === 'FULL'
      ? 'GO'
      : authorization === 'LIGHT'
        ? 'LIGHT'
        : 'NO-GO';

  const policyScore =
    authorization === 'FULL'
      ? 80
      : authorization === 'LIGHT'
        ? 55
        : 20;

  const reevaluateAt =
    authorization === 'NONE'
      ? '2026-10-04T09:00:00.000Z'
      : null;

  db.exec(
    `INSERT INTO prototype_cost_gate_evaluations (
      id,
      prospect_id,
      decision,
      authorization,
      policy_score,
      compute_class,
      external_cost_kind,
      external_cost_amount_eur,
      external_cost_source,
      external_cost_reason,
      reason_codes_json,
      evaluated_at,
      reevaluate_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    prospectId,
    decision,
    authorization,
    policyScore,
    'LOW',
    'UNKNOWN',
    null,
    null,
    'No priced external provider evidence',
    JSON.stringify(['TEST_CLAIM_GATE']),
    '2026-09-04T09:10:00.000Z',
    reevaluateAt,
  );
}

function insertPendingPrototypeClaimJob(
  db,
  id,
  prospectId,
  kind,
  authorization,
) {
  const payload =
    authorization === undefined
      ? {}
      : { prototypeAuthorization: authorization };

  db.exec(
    `INSERT INTO jobs (
      id,
      kind,
      prospect_id,
      payload_json,
      status,
      attempts,
      max_attempts,
      run_after,
      last_error,
      claimed_by,
      claimed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    kind,
    prospectId,
    JSON.stringify(payload),
    'PENDING',
    0,
    3,
    '2026-09-04T09:00:00.000Z',
    null,
    null,
    null,
    '2026-09-04T09:00:00.000Z',
    '2026-09-04T09:00:00.000Z',
  );
}

test('WP-07 claim guard dead-letters prototype work when Cost Gate evaluation is missing', async () => {
  const db = new SqliteD1();
  const env = createEnv(db);

  insertPrototypeClaimProspect(
    db,
    'p-claim-missing',
    'PROTOTYPE_REQUIRED',
  );

  insertPendingPrototypeClaimJob(
    db,
    'job-claim-missing',
    'p-claim-missing',
    'GENERATE_PROTOTYPE_STRATEGY',
    'FULL',
  );

  const response = await request(
    '/api/runner/jobs/claim',
    'POST',
    undefined,
    env,
  );

  assert.equal(response.status, 409);

  const job = db.database
    .prepare(
      'SELECT status, attempts, last_error FROM jobs WHERE id = ?',
    )
    .get('job-claim-missing');

  assert.equal(job.status, 'DEAD_LETTER');
  assert.equal(job.attempts, 1);
  assert.match(
    job.last_error,
    /Cost Gate evaluation is missing/,
  );

  db.close();
});

test('WP-07 claim guard dead-letters prototype work when authorization is NONE', async () => {
  const db = new SqliteD1();
  const env = createEnv(db);

  insertPrototypeClaimProspect(
    db,
    'p-claim-none',
    'PROTOTYPE_REQUIRED',
  );

  insertPrototypeClaimGate(
    db,
    'gate-claim-none',
    'p-claim-none',
    'NONE',
  );

  insertPendingPrototypeClaimJob(
    db,
    'job-claim-none',
    'p-claim-none',
    'GENERATE_PROTOTYPE_STRATEGY',
    undefined,
  );

  const response = await request(
    '/api/runner/jobs/claim',
    'POST',
    undefined,
    env,
  );

  assert.equal(response.status, 409);

  const job = db.database
    .prepare(
      'SELECT status, last_error FROM jobs WHERE id = ?',
    )
    .get('job-claim-none');

  assert.equal(job.status, 'DEAD_LETTER');
  assert.match(job.last_error, /authorization is NONE/);

  db.close();
});

test('WP-07 claim guard allows LIGHT authorization for scoped prototype build', async () => {
  const db = new SqliteD1();
  const env = createEnv(db);

  insertPrototypeClaimProspect(
    db,
    'p-claim-light-build',
    'PROTOTYPE_STRATEGY_GENERATED',
  );

  insertPrototypeClaimGate(
    db,
    'gate-claim-light-build',
    'p-claim-light-build',
    'LIGHT',
  );

  insertPendingPrototypeClaimJob(
    db,
    'job-claim-light-strategy',
    'p-claim-light-build',
    'GENERATE_PROTOTYPE_STRATEGY',
    'LIGHT',
  );

  db.exec(
    `UPDATE jobs
     SET status = 'SUCCEEDED',
         attempts = 1,
         updated_at = ?
     WHERE id = ?`,
    '2026-09-04T09:20:00.000Z',
    'job-claim-light-strategy',
  );

  db.exec(
    `INSERT INTO job_results (
      job_id,
      output_json,
      created_at
    ) VALUES (?, ?, ?)`,
    'job-claim-light-strategy',
    JSON.stringify({
      objective: 'Create a lean commercial prototype',
      targetCustomer: 'Prospect Magic Script',
      primaryAsset: 'Verified expertise',
      primaryFriction: 'Conversion',
      valueProposition: 'Make the next step clear',
      hero: {
        headlineDirection: 'Present the verified value clearly',
        supportingMessage: 'Personalized demonstration',
        primaryCta: 'Request a quote',
      },
      sections: ['Presentation', 'Expertise', 'Contact'],
      sourceNavigationBlocks: [],
      sourceNavigationNote: 'No source navigation required for this fixture.',
      commercialProof: [],
      factsAllowed: [],
      factsForbiddenOrUnverified: [],
      mobilePriorities: ['Primary CTA visible'],
      conversionStrategy: 'Route the primary CTA to the Magic Script Sales Room',
      confidence: 100,
      humanRequired: false,
      blockingReasons: [],
    }),
    '2026-09-04T09:20:00.000Z',
  );
  insertPendingPrototypeClaimJob(
    db,
    'job-claim-light-build',
    'p-claim-light-build',
    'BUILD_PROTOTYPE',
    'LIGHT',
  );

  const response = await request(
    '/api/runner/jobs/claim',
    'POST',
    undefined,
    env,
  );
  assert.equal(response.status, 200);

  const claimed = await response.json();

  assert.equal(claimed.job.id, 'job-claim-light-build');
  assert.equal(
    claimed.job.payload.prototypeAuthorization,
    'LIGHT',
  );

  db.close();
});

test('WP-07 claim guard rejects legacy prototype jobs without authorization marker', async () => {
  const db = new SqliteD1();
  const env = createEnv(db);

  insertPrototypeClaimProspect(
    db,
    'p-claim-legacy',
    'PROTOTYPE_REQUIRED',
  );

  insertPrototypeClaimGate(
    db,
    'gate-claim-legacy',
    'p-claim-legacy',
    'FULL',
  );

  insertPendingPrototypeClaimJob(
    db,
    'job-claim-legacy',
    'p-claim-legacy',
    'GENERATE_PROTOTYPE_STRATEGY',
    undefined,
  );

  const response = await request(
    '/api/runner/jobs/claim',
    'POST',
    undefined,
    env,
  );

  assert.equal(response.status, 409);

  const job = db.database
    .prepare(
      'SELECT status, last_error FROM jobs WHERE id = ?',
    )
    .get('job-claim-legacy');

  assert.equal(job.status, 'DEAD_LETTER');
  assert.match(job.last_error, /payload=MISSING/);

  db.close();
});

test('WP-07 claim guard allows matching FULL prototype strategy work', async () => {
  const db = new SqliteD1();
  const env = createEnv(db);

  insertPrototypeClaimProspect(
    db,
    'p-claim-full',
    'PROTOTYPE_REQUIRED',
  );

  insertPrototypeClaimGate(
    db,
    'gate-claim-full',
    'p-claim-full',
    'FULL',
  );

  insertPendingPrototypeClaimJob(
    db,
    'job-claim-full',
    'p-claim-full',
    'GENERATE_PROTOTYPE_STRATEGY',
    'FULL',
  );

  const response = await request(
    '/api/runner/jobs/claim',
    'POST',
    undefined,
    env,
  );

  assert.equal(response.status, 200);

  const job = db.database
    .prepare(
      'SELECT status, attempts FROM jobs WHERE id = ?',
    )
    .get('job-claim-full');

  assert.equal(job.status, 'RUNNING');
  assert.equal(job.attempts, 1);

  db.close();
});

test('WP-07 claim guard allows matching LIGHT prototype strategy work', async () => {
  const db = new SqliteD1();
  const env = createEnv(db);

  insertPrototypeClaimProspect(
    db,
    'p-claim-light-strategy',
    'PROTOTYPE_REQUIRED',
  );

  insertPrototypeClaimGate(
    db,
    'gate-claim-light-strategy',
    'p-claim-light-strategy',
    'LIGHT',
  );

  insertPendingPrototypeClaimJob(
    db,
    'job-claim-light-strategy',
    'p-claim-light-strategy',
    'GENERATE_PROTOTYPE_STRATEGY',
    'LIGHT',
  );

  const response = await request(
    '/api/runner/jobs/claim',
    'POST',
    undefined,
    env,
  );

  assert.equal(response.status, 200);

  const job = db.database
    .prepare(
      'SELECT status, attempts FROM jobs WHERE id = ?',
    )
    .get('job-claim-light-strategy');

  assert.equal(job.status, 'RUNNING');
  assert.equal(job.attempts, 1);

  db.close();
});


test('WP-07 automatically reevaluates Cost Gate when a meeting is booked', async () => {
  const db = new SqliteD1();
  insertInterestedProspect(db);
  const env = createEnv(db);

  const before = db.database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM prototype_cost_gate_evaluations
       WHERE prospect_id = ?`,
    )
    .get('p-wp07-go').count;

  assert.equal(before, 0);

  const response = await json(
    await request(
      '/api/prospects/p-wp07-go/meeting-booked',
      'POST',
      {
        bookingId: 'wp07-auto-booking',
        scheduledAt: '2026-09-10T14:00:00.000Z',
      },
      env,
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.state, 'MEETING_BOOKED');

  const gate = await json(
    await request(
      '/api/prospects/p-wp07-go/prototype-cost-gate',
      'GET',
      undefined,
      env,
    ),
  );

  assert.equal(gate.status, 200);
  assert.ok(gate.body.evaluation);
  assert.ok(
    gate.body.evaluation.reasonCodes.includes(
      'MEETING_BOOKED_SIGNAL',
    ),
  );

  const autoEvent = db.database
    .prepare(
      `SELECT id
       FROM events
       WHERE prospect_id = ?
         AND type = 'prototype_cost_gate.auto_evaluated'
         AND json_extract(payload_json, '$.source') =
           'MEETING_BOOKED'
       LIMIT 1`,
    )
    .get('p-wp07-go');

  assert.ok(autoEvent);

  const prototypeJobs = db.database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM jobs
       WHERE prospect_id = ?
         AND kind IN (
           'GENERATE_PROTOTYPE_STRATEGY',
           'BUILD_PROTOTYPE'
         )`,
    )
    .get('p-wp07-go').count;

  assert.equal(prototypeJobs, 0);

  db.close();
});

test('WP-07 routes the final J+30 follow-up through SEND_FOLLOW_UP and dormants only after real SENT plus J+7', async () => {
  const db = new SqliteD1();

  db.exec(
    `INSERT INTO prospects (
      id,
      company_name,
      opportunity,
      state,
      score,
      website_url,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'p-wp07-j30',
    'WP07 J30 Prospect',
    'D',
    'INTERESTED',
    20,
    'https://existing.example.test',
    '2026-07-01T09:00:00.000Z',
    '2026-07-01T09:00:00.000Z',
  );

  db.exec(
    `INSERT INTO contacts (
      id,
      prospect_id,
      email,
      confidence,
      is_validated,
      is_suppressed,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'contact-wp07-j30',
    'p-wp07-j30',
    'wp07-j30@example.test',
    100,
    1,
    0,
    '2026-07-01T09:00:00.000Z',
    '2026-07-01T09:00:00.000Z',
  );

  db.exec(
    `INSERT INTO events (
      id,
      prospect_id,
      actor,
      type,
      payload_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    'event-wp07-j30-interest',
    'p-wp07-j30',
    'system',
    'commercial.interest_detected',
    JSON.stringify({}),
    '2026-07-01T09:05:00.000Z',
  );

  db.exec(
    `INSERT INTO prototype_cost_gate_evaluations (
      id,
      prospect_id,
      decision,
      authorization,
      policy_score,
      compute_class,
      external_cost_kind,
      external_cost_amount_eur,
      external_cost_source,
      external_cost_reason,
      reason_codes_json,
      evaluated_at,
      reevaluate_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'gate-wp07-j30-initial',
    'p-wp07-j30',
    'NO-GO',
    'NONE',
    10,
    'HIGH',
    'UNKNOWN',
    null,
    null,
    'No internal priced external provider evidence available',
    JSON.stringify(['QUALIFIED_INTEREST']),
    '2026-07-01T09:05:00.000Z',
    '2026-07-31T09:05:00.000Z',
  );

  const env = {
    ...createEnv(db),
    MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  };

  const firstDrain = await json(
    await request(
      '/api/system/drain',
      'POST',
      {
        limit: 1,
        nowUtc: '2026-09-04T12:00:00.000Z',
      },
      env,
    ),
  );

  assert.equal(firstDrain.status, 200);
  assert.equal(
    firstDrain.body.prototypeCostGateJ30.prepared,
    1,
  );
  assert.equal(
    firstDrain.body.prototypeCostGateJ30.reevaluated,
    1,
  );

  const prospectState = db.database
    .prepare(
      'SELECT state FROM prospects WHERE id = ?',
    )
    .get('p-wp07-j30').state;

  assert.equal(prospectState, 'INTERESTED');

  const finalDrafts = db.database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM outreach_messages
       WHERE prospect_id = ?
         AND kind = 'FOLLOW_UP'
         AND status = 'VERIFIED'`,
    )
    .get('p-wp07-j30').count;

  assert.equal(finalDrafts, 1);

  const sendJobs = db.database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM jobs
       WHERE prospect_id = ?
         AND kind = 'SEND_FOLLOW_UP'`,
    )
    .get('p-wp07-j30').count;

  assert.equal(sendJobs, 1);

  const j30Events = db.database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM events
       WHERE prospect_id = ?
         AND type =
           'prototype_cost_gate.j30_followup_draft_prepared'`,
    )
    .get('p-wp07-j30').count;

  assert.equal(j30Events, 1);

  const dormantEvents = db.database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM events
       WHERE prospect_id = ?
         AND type = 'commercial.dormant'`,
    )
    .get('p-wp07-j30').count;

  assert.equal(dormantEvents, 0);

  const prototypeJobs = db.database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM jobs
       WHERE prospect_id = ?
         AND kind IN (
           'GENERATE_PROTOTYPE_STRATEGY',
           'BUILD_PROTOTYPE'
         )`,
    )
    .get('p-wp07-j30').count;

  assert.equal(prototypeJobs, 0);

  const secondDrain = await json(
    await request(
      '/api/system/drain',
      'POST',
      {
        limit: 1,
        nowUtc: '2026-10-10T12:00:00.000Z',
      },
      env,
    ),
  );

  assert.equal(secondDrain.status, 200);

  const draftsAfterSecondDrain = db.database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM outreach_messages
       WHERE prospect_id = ?
         AND kind = 'FOLLOW_UP'
         AND status = 'VERIFIED'`,
    )
    .get('p-wp07-j30').count;

  assert.equal(draftsAfterSecondDrain, 1);

  db.exec(
    `UPDATE outreach_messages
     SET status = 'DRY_RUN',
         sent_at = ?
     WHERE prospect_id = ?
       AND kind = 'FOLLOW_UP'`,
    '2026-10-10T12:00:00.000Z',
    'p-wp07-j30',
  );

  db.exec(
    `UPDATE jobs
     SET status = 'SUCCEEDED',
         updated_at = ?
     WHERE prospect_id = ?
       AND kind = 'SEND_FOLLOW_UP'`,
    '2026-10-10T12:00:00.000Z',
    'p-wp07-j30',
  );

  const dryRunDrain = await json(
    await request(
      '/api/system/drain',
      'POST',
      {
        limit: 1,
        nowUtc: '2026-10-18T12:00:00.000Z',
      },
      env,
    ),
  );

  assert.equal(dryRunDrain.status, 200);

  const stateAfterDryRun = db.database
    .prepare(
      'SELECT state FROM prospects WHERE id = ?',
    )
    .get('p-wp07-j30').state;

  assert.equal(stateAfterDryRun, 'INTERESTED');

  db.exec(
    `UPDATE outreach_messages
     SET status = 'SENT',
         sent_at = ?
     WHERE prospect_id = ?
       AND kind = 'FOLLOW_UP'`,
    '2026-10-10T12:00:00.000Z',
    'p-wp07-j30',
  );

  const sentDrain = await json(
    await request(
      '/api/system/drain',
      'POST',
      {
        limit: 1,
        nowUtc: '2026-10-18T12:00:00.000Z',
      },
      env,
    ),
  );

  assert.equal(sentDrain.status, 200);
  assert.equal(
    sentDrain.body.prototypeCostGateJ30.dormant,
    1,
  );

  const stateAfterRealSend = db.database
    .prepare(
      'SELECT state FROM prospects WHERE id = ?',
    )
    .get('p-wp07-j30').state;

  assert.equal(stateAfterRealSend, 'DORMANT');

  const dormantEvent = db.database
    .prepare(
      `SELECT payload_json
       FROM events
       WHERE prospect_id = ?
         AND type = 'commercial.dormant'
         AND json_extract(
           payload_json,
           '$.source'
         ) = 'PROTOTYPE_COST_GATE_J30'
       LIMIT 1`,
    )
    .get('p-wp07-j30');

  assert.ok(dormantEvent);

  db.close();
});

test('WP-08 claim hands BUILD_PROTOTYPE the canonical Sales Room conversion URL', async () => {
  const db = new SqliteD1();
  const env = createEnv(db);

  insertPrototypeClaimProspect(
    db,
    'p-wp08-conversion',
    'PROTOTYPE_STRATEGY_GENERATED',
  );

  insertPrototypeClaimGate(
    db,
    'gate-wp08-conversion',
    'p-wp08-conversion',
    'FULL',
  );

  insertPendingPrototypeClaimJob(
    db,
    'job-wp08-strategy',
    'p-wp08-conversion',
    'GENERATE_PROTOTYPE_STRATEGY',
    'FULL',
  );

  db.exec(
    `UPDATE jobs
     SET status = 'SUCCEEDED',
         attempts = 1,
         updated_at = ?
     WHERE id = ?`,
    '2026-09-04T09:20:00.000Z',
    'job-wp08-strategy',
  );

  db.exec(
    `INSERT INTO job_results (
      job_id,
      output_json,
      created_at
    ) VALUES (?, ?, ?)`,
    'job-wp08-strategy',
    JSON.stringify({
      objective: 'Transformer l intÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªt en ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©change qualifiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©',
      targetCustomer: 'Prospect Magic Script',
      primaryAsset: 'Expertise vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rifiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e',
      primaryFriction: 'Conversion',
      valueProposition: 'Faciliter la prise de contact',
      hero: {
        headlineDirection: 'PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©senter clairement la valeur',
        supportingMessage: 'DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©monstration personnalisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e',
        primaryCta: 'Demander un devis',
      },
      sections: ['PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sentation', 'Expertise', 'Contact'],
      sourceNavigationBlocks: [],
      sourceNavigationNote: 'Aucune navigation source requise pour ce fixture.',
      commercialProof: [],
      factsAllowed: [],
      factsForbiddenOrUnverified: [],
      mobilePriorities: ['CTA principal visible'],
      conversionStrategy: 'Orienter le CTA principal vers la Sales Room Magic Script',
      confidence: 100,
      humanRequired: false,
      blockingReasons: [],
    }),
    '2026-09-04T09:20:00.000Z',
  );

  insertPendingPrototypeClaimJob(
    db,
    'job-wp08-conversion',
    'p-wp08-conversion',
    'BUILD_PROTOTYPE',
    'FULL',
  );

  const prospectDetail = await json(
    await request(
      '/api/prospects/p-wp08-conversion',
      'GET',
      undefined,
      env,
    ),
  );

  assert.equal(prospectDetail.status, 200);
  assert.ok(
    prospectDetail.body.commercialLinks.salesRoomUrl,
  );

  const claimed = await json(
    await request(
      '/api/runner/jobs/claim',
      'POST',
      undefined,
      env,
    ),
  );

  assert.equal(claimed.status, 200);
  assert.equal(
    claimed.body.job.id,
    'job-wp08-conversion',
  );

  assert.deepEqual(
    claimed.body.prototypeConversion,
    {
      salesRoomUrl:
        prospectDetail.body.commercialLinks.salesRoomUrl,
      salesRoomSlug:
        prospectDetail.body.commercialLinks.salesRoomSlug,
      ctaTarget: 'SALES_ROOM',
    },
  );

  db.close();
});

test('WP-07 evaluates a cold PROTOTYPE_REQUIRED prospect without inventing commercial interest', async () => {
  const db = new SqliteD1();

  insertPrototypeClaimProspect(
    db,
    'p-wp07-cold-gate',
    'PROTOTYPE_REQUIRED',
  );

  insertResearchScope(
    db,
    'p-wp07-cold-gate',
    2,
  );

  const env = createEnv(db);

  const response = await json(
    await request(
      '/api/prospects/p-wp07-cold-gate/prototype-cost-gate/evaluate',
      'POST',
      {},
      env,
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(
    response.body.evaluation.prospectId,
    'p-wp07-cold-gate',
  );
  assert.notEqual(
    response.body.evaluation.authorization,
    'NONE',
  );

  const persisted = db.database
    .prepare(`
      SELECT
        decision,
        authorization,
        reason_codes_json
      FROM prototype_cost_gate_evaluations
      WHERE prospect_id = ?
      ORDER BY evaluated_at DESC
      LIMIT 1
    `)
    .get('p-wp07-cold-gate');

  assert.ok(persisted);
  assert.notEqual(persisted.authorization, 'NONE');

  const reasons = JSON.parse(persisted.reason_codes_json);
  assert.ok(
    reasons.includes('QUALIFIED_PROTOTYPE_NEED'),
  );
  assert.equal(
    reasons.includes('QUALIFIED_INTEREST'),
    false,
  );

  const prospect = db.database
    .prepare(`
      SELECT state
      FROM prospects
      WHERE id = ?
    `)
    .get('p-wp07-cold-gate');

  assert.equal(
    prospect.state,
    'PROTOTYPE_REQUIRED',
  );

  db.close();
});