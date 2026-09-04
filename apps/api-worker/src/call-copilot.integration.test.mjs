import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import worker from './index.ts';

class SqliteD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'));
  }

  prepare(query) {
    const statement = this.database.prepare(query);
    let bindings = [];
    const bound = (values) => ({
      first: async () => statement.get(...values) ?? null,
      all: async () => ({ results: statement.all(...values) }),
      run: async () => statement.run(...values),
    });
    return {
      bind: (...values) => bound(values),
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

function request(path, method, body, env, authorized = true) {
  const headers = { 'content-type': 'application/json' };
  if (authorized) headers.authorization = 'Bearer local-copilot-token';
  return worker.fetch(
    new Request(`https://local.test${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
}

async function jsonResponse(response) {
  return { status: response.status, body: await response.json() };
}

function seed(db) {
  const createdAt = '2026-09-03T10:00:00.000Z';
  db.exec(
    `INSERT INTO prospects (id, company_name, activity, location, state, primary_friction, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'p-copilot-api',
    'Copilot Test',
    'Sécurité',
    'Fort-de-France',
    'MEETING_BOOKED',
    'présence digitale',
    createdAt,
    createdAt,
  );
  db.exec(
    `INSERT INTO prototypes (id, prospect_id, repo_path, deployment_url, status, qa_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'DEPLOYED', 'PASS', ?, ?)`,
    'prototype-copilot-api',
    'p-copilot-api',
    'sites/synthetic',
    'https://copilot-test.pages.dev/',
    createdAt,
    createdAt,
  );
  db.exec(
    `INSERT INTO meetings (
       id, prospect_id, sales_room_slug, communication_mode, start_at_utc, end_at_utc,
       prospect_timezone, phone, status, confirmed_at, cancelled_at, rescheduled_from_id,
       idempotency_key, created_at, updated_at
     ) VALUES (?, ?, ?, 'phone', ?, ?, 'America/Martinique', '+596 696 00 00 00', 'CONFIRMED', ?, NULL, NULL, ?, ?, ?)`,
    'meeting-copilot-api',
    'p-copilot-api',
    'copilot-test',
    '2099-01-05T11:00:00.000Z',
    '2099-01-05T11:30:00.000Z',
    createdAt,
    'meeting-copilot-idem',
    createdAt,
    createdAt,
  );
}

test('WP-05.5 API persists a text-only Copilot without changing lifecycle or creating outbound work', async () => {
  const db = new SqliteD1();
  seed(db);
  const env = {
    DB: db,
    MAGICSCRIPT_API_TOKEN: 'local-copilot-token',
    MAGICSCRIPT_PUBLIC_BASE_URL: 'http://127.0.0.1:4173',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  };

  const unauthorized = await jsonResponse(await request('/api/call-copilot', 'POST', { prospectId: 'p-copilot-api' }, env, false));
  assert.equal(unauthorized.status, 401);

  const started = await jsonResponse(await request('/api/call-copilot', 'POST', {
    prospectId: 'p-copilot-api',
    meetingId: 'meeting-copilot-api',
    idempotencyKey: 'copilot-session-idem',
  }, env));
  assert.equal(started.status, 200);
  assert.equal(started.body.session.company_name, 'Copilot Test');
  assert.equal(started.body.session.engine_version, '1.0.0');
  assert.equal(started.body.session.predictions.length, 3);
  const sessionId = started.body.session.session_id;

  const duplicateStart = await jsonResponse(await request('/api/call-copilot', 'POST', {
    prospectId: 'p-copilot-api',
    meetingId: 'meeting-copilot-api',
    idempotencyKey: 'copilot-session-idem',
  }, env));
  assert.equal(duplicateStart.status, 200);
  assert.equal(duplicateStart.body.duplicate, true);
  assert.equal(duplicateStart.body.session.session_id, sessionId);

  const response = await jsonResponse(await request(`/api/call-copilot/${sessionId}/actions`, 'POST', {
    idempotencyKey: 'copilot-response-1',
    action: {
      type: 'PROSPECT_RESPONSE',
      text: 'Le prototype me plaît, mais je veux garder mon domaine et recevoir le devis.',
    },
  }, env));
  assert.equal(response.status, 200);
  assert.equal(response.body.session.multi_signal_buffer.some((item) => item.type === 'prototype_acceptance'), true);
  assert.equal(response.body.session.multi_signal_buffer.some((item) => item.type === 'domain_constraint'), true);
  assert.equal(response.body.session.next_best_action.action, 'MOVE_TO_QUOTE');
  assert.equal(response.body.session.stop_discovery, true);

  const selected = await jsonResponse(await request(`/api/call-copilot/${sessionId}/actions`, 'POST', {
    idempotencyKey: 'copilot-select-1',
    action: { type: 'SELECT_PREDICTION', predictionId: 'prediction-1' },
  }, env));
  assert.equal(selected.status, 200);
  assert.equal(selected.body.session.confirmed_facts.some((fact) => fact.provenance === 'MODEL_PREDICTION'), false);
  assert.equal(selected.body.session.operator_inputs.at(-1).kind, 'OPERATOR_SELECTED_PREDICTION');

  const validated = await jsonResponse(await request(`/api/call-copilot/${sessionId}/actions`, 'POST', {
    idempotencyKey: 'copilot-validate-1',
    action: { type: 'VALIDATE_KNOWLEDGE', key: 'domain', value: 'domaine existant à conserver' },
  }, env));
  assert.equal(validated.status, 200);
  assert.equal(validated.body.session.validated_knowledge.at(-1).factual_status, 'CONFIRMED');

  const duplicateAction = await jsonResponse(await request(`/api/call-copilot/${sessionId}/actions`, 'POST', {
    idempotencyKey: 'copilot-response-1',
    action: { type: 'PROSPECT_RESPONSE', text: 'Cette requête rejouée ne doit pas être ajoutée.' },
  }, env));
  assert.equal(duplicateAction.status, 200);
  assert.equal(duplicateAction.body.duplicate, true);

  const review = await jsonResponse(await request(`/api/call-copilot/${sessionId}/review`, 'GET', undefined, env));
  assert.equal(review.status, 200);
  assert.equal(review.body.review.operator_notes.length, 0);
  assert.equal(review.body.review.requested_changes.length, 1);

  const state = db.database.prepare("SELECT state FROM prospects WHERE id = 'p-copilot-api'").get();
  assert.equal(state.state, 'MEETING_BOOKED');
  assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM jobs').get().count, 0);
  assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM outreach_messages').get().count, 0);
  assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM call_copilot_actions').get().count, 3);
  db.close();
});

test('WP-05.5 API rejects unsafe or invalid Copilot actions without persisting them', async () => {
  const db = new SqliteD1();
  seed(db);
  const env = { DB: db, MAGICSCRIPT_API_TOKEN: 'local-copilot-token' };
  const started = await jsonResponse(await request('/api/call-copilot', 'POST', { prospectId: 'p-copilot-api', idempotencyKey: 'unsafe-session' }, env));
  const sessionId = started.body.session.session_id;
  const invalid = await jsonResponse(await request(`/api/call-copilot/${sessionId}/actions`, 'POST', {
    idempotencyKey: 'unsafe-1',
    action: { type: 'PROSPECT_RESPONSE', text: '<script>alert(1)</script>' + 'x'.repeat(8_001) },
  }, env));
  assert.equal(invalid.status, 400);
  assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM call_copilot_actions').get().count, 0);
  db.close();
});
