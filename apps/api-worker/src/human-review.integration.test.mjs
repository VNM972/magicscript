import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './index.ts';

class SqliteD1 {
  constructor(schema = true) {
    this.database = new DatabaseSync(':memory:');
    if (schema) this.database.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'));
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

  exec(sql, ...bindings) { this.database.prepare(sql).run(...bindings); }
  close() { this.database.close(); }
}

const env = (db) => ({
  DB: db,
  MAGICSCRIPT_API_TOKEN: 'human-review-token',
  MAGICSCRIPT_SENDING_ENABLED: 'false',
  MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
});

async function call(db, prototypeId, body) {
  const response = await worker.fetch(new Request(`https://local.test/api/prototypes/${prototypeId}/human-review`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer human-review-token',
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env(db));
  return { status: response.status, body: await response.json() };
}

function createFixture(db, suffix, { status = 'READY', qaStatus = 'PASS', reviewStatus = null } = {}) {
  const prospectId = `prospect-${suffix}`;
  const prototypeId = `prototype-${suffix}`;
  const now = '2026-01-01T00:00:00.000Z';
  db.exec(`INSERT INTO prospects (id, company_name, opportunity, state, created_at, updated_at) VALUES (?, ?, 'A', 'PROTOTYPE_READY', ?, ?)`, prospectId, `Fixture ${suffix}`, now, now);
  db.exec(`INSERT INTO prototypes (id, prospect_id, repo_path, status, qa_status, human_review_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, prototypeId, prospectId, `fixture/${suffix}`, status, qaStatus, reviewStatus, now, now);
  return { prospectId, prototypeId };
}

function eventRows(db, prototypeId) {
  return db.database.prepare(`SELECT * FROM events WHERE type = 'prototype.human_reviewed' AND json_extract(payload_json, '$.prototypeId') = ? ORDER BY created_at`).all(prototypeId);
}

test('HVAL-M1 human review contract covers decisions, duplicates, conflicts, gates, and isolation', async () => {
  const db = new SqliteD1();
  try {
    const fresh = createFixture(db, 'fresh');
    const beforeProspect = db.database.prepare('SELECT state FROM prospects WHERE id = ?').get(fresh.prospectId).state;
    assert.equal((await call(db, fresh.prototypeId, { action: 'VALIDATE' })).status, 200);
    const validated = db.database.prepare('SELECT * FROM prototypes WHERE id = ?').get(fresh.prototypeId);
    assert.equal(validated.human_review_status, 'VALIDATED');
    assert.ok(validated.human_reviewed_at);
    assert.equal(validated.human_reviewed_by, 'human');
    assert.equal(validated.status, 'READY');
    assert.equal(validated.qa_status, 'PASS');
    assert.equal(db.database.prepare('SELECT state FROM prospects WHERE id = ?').get(fresh.prospectId).state, beforeProspect);
    assert.equal(eventRows(db, fresh.prototypeId).length, 1);
    const firstReviewedAt = validated.human_reviewed_at;
    const duplicate = await call(db, fresh.prototypeId, { action: 'VALIDATE' });
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.duplicate, true);
    assert.equal(duplicate.body.next_stage_eligible, true);
    assert.equal(db.database.prepare('SELECT human_reviewed_at FROM prototypes WHERE id = ?').get(fresh.prototypeId).human_reviewed_at, firstReviewedAt);
    assert.equal(eventRows(db, fresh.prototypeId).length, 1);

    const rejected = createFixture(db, 'rejected');
    const reject = await call(db, rejected.prototypeId, { action: 'REJECT' });
    assert.equal(reject.status, 200);
    assert.equal(reject.body.prototype.human_review_status, 'REJECTED');
    assert.equal(reject.body.next_stage_eligible, false);
    assert.equal(eventRows(db, rejected.prototypeId).length, 1);
    assert.equal((await call(db, rejected.prototypeId, { action: 'VALIDATE' })).status, 409);
    assert.equal(eventRows(db, rejected.prototypeId).length, 1);

    const opposite = createFixture(db, 'opposite');
    assert.equal((await call(db, opposite.prototypeId, { action: 'VALIDATE' })).status, 200);
    assert.equal((await call(db, opposite.prototypeId, { action: 'REJECT' })).status, 409);
    assert.equal(eventRows(db, opposite.prototypeId).length, 1);

    const badQa = createFixture(db, 'bad-qa', { qaStatus: 'FAIL' });
    assert.equal((await call(db, badQa.prototypeId, { action: 'VALIDATE' })).status, 409);
    const badStatus = createFixture(db, 'bad-status', { status: 'BUILT' });
    assert.equal((await call(db, badStatus.prototypeId, { action: 'VALIDATE' })).status, 409);
    assert.equal((await call(db, 'missing', { action: 'VALIDATE' })).status, 404);
    assert.equal((await call(db, fresh.prototypeId, { action: 'INVALID' })).status, 400);
    assert.equal((await call(db, fresh.prototypeId, { action: 'VALIDATE', reason: 'extra' })).status, 400);

    const outreachCount = db.database.prepare('SELECT COUNT(*) AS count FROM outreach_messages').get().count;
    const deployment = db.database.prepare('SELECT deployment_url FROM prototypes WHERE id = ?').get(fresh.prototypeId).deployment_url;
    assert.equal(outreachCount, 0);
    assert.equal(deployment, null);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM events WHERE type LIKE \'sales_room.%\'').get().count, 0);
  } finally {
    db.close();
  }
});

test('HVAL-M1 migration adds all three columns to an existing prototypes table', () => {
  const db = new SqliteD1(false);
  try {
    db.database.exec(`CREATE TABLE prospects (id TEXT PRIMARY KEY); CREATE TABLE prototypes (id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL, status TEXT NOT NULL, qa_status TEXT);`);
    db.database.exec(readFileSync(new URL('../../../database/migration-prototype-human-review-v1.sql', import.meta.url), 'utf8'));
    const columns = db.database.prepare('PRAGMA table_info(prototypes)').all().map((row) => row.name);
    assert.deepEqual(columns.slice(-3), ['human_review_status', 'human_reviewed_at', 'human_reviewed_by']);
    assert.throws(() => db.database.prepare(`INSERT INTO prototypes (id, prospect_id, status, qa_status, human_review_status) VALUES ('x', 'p', 'READY', 'PASS', 'PENDING')`).run());
  } finally {
    db.close();
  }
});
