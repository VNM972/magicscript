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

function request(path, method, body, env, token = 'wp05-api-token') {
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
  return { status: response.status, body: await response.json() };
}

test('WP-05 projects persisted engagement without mutating lifecycle state', async () => {
  const db = new SqliteD1();
  const now = '2026-09-03T12:00:00.000Z';
  db.exec(
    `INSERT INTO prospects (id, company_name, activity, location, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'prospect-score',
    'Prospect Score',
    'Conseil',
    'Fort-de-France',
    'PROTOTYPE_DEPLOYED',
    now,
    now,
  );
  db.exec(
    `INSERT INTO prototypes (
       id, prospect_id, repo_path, deployment_url, status, qa_status,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'DEPLOYED', 'PASS', ?, ?)`,
    'prototype-score',
    'prospect-score',
    'prototypes/prospect-score',
    'https://prototype.example.test/',
    now,
    now,
  );

  const insertEvent = (id, type, payload, createdAt = now) => {
    db.exec(
      `INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at)
       VALUES (?, ?, 'system', ?, ?, ?)`,
      id,
      'prospect-score',
      type,
      JSON.stringify(payload),
      createdAt,
    );
  };
  insertEvent('room-view', 'sales_room.accessed', { idempotencyKey: 'room-view-1' });
  insertEvent('share-1', 'sales_room.share_clicked', { idempotencyKey: 'share-1', channel: 'email' });
  insertEvent('share-2', 'sales_room.share_clicked', { idempotencyKey: 'share-2', channel: 'email' });
  insertEvent('share-3', 'sales_room.share_clicked', { idempotencyKey: 'share-3', channel: 'email' });

  const env = {
    DB: db,
    MAGICSCRIPT_API_TOKEN: 'wp05-api-token',
    MAGICSCRIPT_PUBLIC_BASE_URL: 'https://magicscript.fr',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  };

  const passive = await json(await request('/api/prospects', 'GET', undefined, env));
  assert.equal(passive.status, 200);
  assert.equal(passive.body.prospects[0].state, 'PROTOTYPE_DEPLOYED');
  assert.equal(passive.body.prospects[0].engagement.score_total, 24);
  assert.equal(passive.body.prospects[0].engagement.activity_score, 24);
  assert.equal(passive.body.prospects[0].engagement.intent_score, 0);
  assert.equal(passive.body.prospects[0].engagement.trend, 'RISING');

  insertEvent('message-1', 'sales_room.message_received', {
    idempotencyKey: 'message-score-1',
    nextOwner: 'stephane',
  });
  db.exec("UPDATE prospects SET state = 'INTERESTED' WHERE id = 'prospect-score'");

  const withIntent = await json(await request('/api/prospects', 'GET', undefined, env));
  assert.equal(withIntent.status, 200);
  const prospect = withIntent.body.prospects[0];
  assert.equal(prospect.state, 'INTERESTED');
  assert.equal(prospect.engagement.score_total, 59);
  assert.equal(prospect.engagement.activity_score, 24);
  assert.equal(prospect.engagement.intent_score, 35);
  assert.equal(prospect.engagement.top_contributors[0].signal, 'MESSAGE_SENT');
  assert.equal(prospect.engagement.top_contributors[0].sourceType, 'sales_room.message_received');
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind LIKE 'SEND_%'").get().count, 0);
  db.close();
});
