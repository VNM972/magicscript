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
      bind: (...values) => {
        const nextBindings = values;
        return {
          first: async () => statement.get(...nextBindings) ?? null,
          all: async () => ({ results: statement.all(...nextBindings) }),
          run: async () => statement.run(...nextBindings),
        };
      },
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

function request(path, method, body, env) {
  return worker.fetch(
    new Request(`https://local.test${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  );
}

async function jsonResponse(response) {
  return { status: response.status, body: await response.json() };
}

function seedProspect(db, id, state, createdAt) {
  db.exec(
    `INSERT INTO prospects (
       id, company_name, activity, location, state, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    `Company ${id}`,
    'Sécurité',
    'Fort-de-France',
    state,
    createdAt,
    createdAt,
  );
  db.exec(
    `INSERT INTO contacts (
       id, prospect_id, email, confidence, is_validated, is_suppressed, created_at, updated_at
     ) VALUES (?, ?, ?, 100, 1, 0, ?, ?)`,
    `contact-${id}`,
    id,
    `${id}@example.test`,
    createdAt,
    createdAt,
  );
}

test('WP-01 integrates inbound interest, booking, commercial milestones and safe follow-up drafts', async () => {
  const db = new SqliteD1();
  const createdAt = '2026-09-01T10:00:00.000Z';
  seedProspect(db, 'p-main', 'WAITING_REPLY', createdAt);
  db.exec(
    `INSERT INTO outreach_messages (
       id, prospect_id, contact_id, kind, body_text, status,
       provider_message_id, sent_at, created_at, updated_at
     ) VALUES (?, ?, ?, 'INITIAL', 'fixture outbound', 'TEST_SENT', ?, ?, ?, ?)`,
    'outbound-main',
    'p-main',
    'contact-p-main',
    'fixture-outbound-main',
    createdAt,
    createdAt,
    createdAt,
  );

  const env = {
    DB: db,
    MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  };

  const inbound = await jsonResponse(
    await request(
      '/api/email/inbound',
      'POST',
      {
        inReplyToProviderMessageId: 'fixture-outbound-main',
        providerMessageId: 'fixture-reply-main',
        fromEmail: 'contact@example.test',
        rawText: 'Oui, je veux en savoir plus et échanger avec Stéphane.',
      },
      env,
    ),
  );
  assert.equal(inbound.status, 200);

  db.exec(
    `INSERT INTO jobs (
       id, kind, prospect_id, payload_json, status, run_after, claimed_by,
       claimed_at, created_at, updated_at
     ) VALUES (?, 'CLASSIFY_REPLY', ?, '{}', 'RUNNING', ?, ?, ?, ?, ?)`,
    'classify-main',
    'p-main',
    createdAt,
    'fixture-runner',
    createdAt,
    createdAt,
    createdAt,
  );

  const classified = await jsonResponse(
    await worker.fetch(
      new Request('https://local.test/api/runner/jobs/classify-main/succeed', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-magicscript-runner-id': 'fixture-runner' },
        body: JSON.stringify({
          output: {
            classification: 'POSITIVE_INTEREST',
            confidence: 99,
            summary: 'Le prospect demande un échange humain.',
          },
        }),
      }),
      env,
    ),
  );
  assert.equal(classified.status, 200);
  assert.equal(db.prepare(`SELECT state FROM prospects WHERE id = ?`).get('p-main').state, 'INTERESTED');
  assert.equal(
    db.prepare(`SELECT COUNT(*) AS count FROM jobs WHERE prospect_id = ? AND kind IN ('BUILD_PROTOTYPE', 'GENERATE_PROTOTYPE_STRATEGY')`).get('p-main').count,
    0,
  );
  assert.equal(db.prepare(`SELECT category FROM human_escalations WHERE prospect_id = ? AND status = 'OPEN'`).get('p-main').category, 'INTERESTED');
  const interestEvent = db.prepare(`SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'commercial.interest_detected'`).get('p-main');
  const interestPayload = JSON.parse(interestEvent.payload_json);
  assert.equal(interestPayload.nextOwner, 'stephane');
  assert.equal(interestPayload.autoPrototype, false);
  assert.equal(interestPayload.briefing.message, 'Oui, je veux en savoir plus et échanger avec Stéphane.');

  const booked = await jsonResponse(
    await request(
      '/api/prospects/p-main/meeting-booked',
      'POST',
      { bookingId: 'booking-main', scheduledAt: '2026-09-10T14:00:00.000Z', prospectTimezone: 'America/Martinique' },
      env,
    ),
  );
  assert.equal(booked.status, 200);
  assert.equal(booked.body.state, 'MEETING_BOOKED');
  assert.equal(booked.body.briefing.owner, 'stephane');

  const quoteDrafted = await jsonResponse(
    await request('/api/prospects/p-main/commercial-event', 'POST', { event: 'QUOTE_DRAFTED' }, env),
  );
  assert.equal(quoteDrafted.body.state, 'QUOTE_PENDING');
  const quoteAccepted = await jsonResponse(
    await request('/api/prospects/p-main/commercial-event', 'POST', { event: 'QUOTE_ACCEPTED', quoteId: 'quote-main' }, env),
  );
  assert.equal(quoteAccepted.body.state, 'COMMITTED');
  assert.equal(db.prepare(`SELECT state FROM prospects WHERE id = ?`).get('p-main').state, 'COMMITTED');
  const missingProof = await jsonResponse(
    await request('/api/prospects/p-main/commercial-event', 'POST', { event: 'DEPOSIT_CONFIRMED' }, env),
  );
  assert.equal(missingProof.status, 400);
  const deposit = await jsonResponse(
    await request('/api/prospects/p-main/commercial-event', 'POST', { event: 'DEPOSIT_CONFIRMED', paymentConfirmationReference: 'fixture-payment-main' }, env),
  );
  assert.equal(deposit.body.state, 'WON');

  seedProspect(db, 'p-followup', 'INTERESTED', '2026-08-20T10:00:00.000Z');
  db.exec(
    `INSERT INTO replies (
       id, prospect_id, contact_id, raw_text, received_at, created_at
     ) VALUES (?, ?, ?, 'fixture interest', ?, ?)`,
    'reply-followup',
    'p-followup',
    'contact-p-followup',
    '2026-08-20T10:00:00.000Z',
    '2026-08-20T10:00:00.000Z',
  );
  db.exec(
    `INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at)
     VALUES (?, ?, 'response-agent', 'commercial.interest_detected', '{}', ?)`,
    'interest-followup',
    'p-followup',
    '2026-08-20T10:00:00.000Z',
  );
  const drained = await jsonResponse(await request('/api/system/drain', 'POST', { limit: 1 }, {
    ...env,
    MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
  }));
  assert.equal(drained.status, 200);
  assert.equal(db.prepare(`SELECT state FROM prospects WHERE id = ?`).get('p-followup').state, 'DORMANT');
  assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM outreach_messages WHERE prospect_id = ? AND kind = 'FOLLOW_UP' AND status = 'DRAFT'`).get('p-followup').count, 2);
  assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM jobs WHERE kind LIKE 'SEND_%'`).get().count, 0);

  db.close();
});
