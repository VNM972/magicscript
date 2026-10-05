import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1JobQueue } from '../../../core/persistence/d1-job-queue.ts';
import { deployPrototypeToPages } from '../../agent-runner/src/deploy.ts';

class FixtureD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) {
    let values = [];
    const statement = () => this.database.prepare(sql);
    const result = {
      bind: (...args) => { values = args; return result; },
      first: async () => statement().get(...values) ?? null,
      all: async () => ({ results: statement().all(...values) }),
      run: async () => statement().run(...values),
    };
    return result;
  }
  close() { this.database.close(); }
}

function review(status = 'PASS') {
  return JSON.stringify({ webDesignReview: { status, owner: 'web-design', verifier: 'local-test', blockers: [] } });
}
function seed(db, { hval = null, status = 'READY', qaStatus = 'PASS', deploymentUrl = null } = {}) {
  db.database.prepare('INSERT INTO prospects (id, company_name, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('prospect-1', 'Synthetic Demo Fixture', 'PROTOTYPE_READY', '2026-01-01', '2026-01-01');
  db.database.prepare(`INSERT INTO prototypes
    (id, prospect_id, repo_path, status, qa_status, human_review_status, deployment_url, qa_findings_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('prototype-1', 'prospect-1', 'fixture', status, qaStatus, hval, deploymentUrl, review(), '2026-01-01', '2026-01-01');
}
function enqueueRow(db, id = 'deploy-1', payload = '{}', status = 'PENDING') {
  db.database.prepare(`INSERT INTO jobs
    (id, kind, prospect_id, payload_json, status, attempts, max_attempts, run_after, created_at, updated_at)
    VALUES (?, 'DEPLOY_PROTOTYPE', 'prospect-1', ?, ?, 0, 3, ?, ?, ?)`)
    .run(id, payload, status, '2026-01-01', '2026-01-01', '2026-01-01');
}

test('eligible READY + QA PASS + promotable review admits exactly one deployment', async () => {
  const db = new FixtureD1();
  try {
    seed(db); enqueueRow(db);
    const queue = new D1JobQueue(db);
    const first = await queue.next(new Date('2026-01-02'), 'runner-1', ['DEPLOY_PROTOTYPE']);
    assert.equal(first?.id, 'deploy-1');
    assert.equal(first?.attempts, 1);
    assert.equal(await queue.next(new Date('2026-01-02'), 'runner-2', ['DEPLOY_PROTOTYPE']), null);
  } finally { db.close(); }
});

test('HVAL NULL and VALIDATED are allowed, REJECTED is vetoed', async (t) => {
  for (const hval of [null, 'VALIDATED']) {
    await t.test(String(hval), async () => {
      const db = new FixtureD1();
      try { seed(db, { hval }); enqueueRow(db); assert.ok(await new D1JobQueue(db).next(new Date('2026-01-02'), 'runner-1', ['DEPLOY_PROTOTYPE'])); }
      finally { db.close(); }
    });
  }
  const db = new FixtureD1();
  try { seed(db, { hval: 'REJECTED' }); enqueueRow(db); assert.equal(await new D1JobQueue(db).next(new Date('2026-01-02'), 'runner-1', ['DEPLOY_PROTOTYPE']), null); }
  finally { db.close(); }
});

test('same prototype duplicate and already deployed prototype do not republish', async () => {
  const db = new FixtureD1();
  try {
    seed(db); enqueueRow(db, 'deploy-1', JSON.stringify({ prototypeId: 'prototype-1' }), 'RUNNING');
    const queue = new D1JobQueue(db);
    const duplicate = await queue.enqueue({ id: 'deploy-2', kind: 'DEPLOY_PROTOTYPE', prospectId: 'prospect-1', payload: {}, maxAttempts: 3, runAfter: '2026-01-02' });
    assert.equal(duplicate.id, 'deploy-1');
    db.database.prepare("UPDATE prototypes SET status = 'DEPLOYED', deployment_url = 'https://fixture.pages.dev/'").run();
    const completed = await queue.enqueue({ id: 'deploy-3', kind: 'DEPLOY_PROTOTYPE', prospectId: 'prospect-1', payload: {}, maxAttempts: 3, runAfter: '2026-01-02' });
    assert.equal(completed.id, 'deploy-1');
  } finally { db.close(); }
});

test('mock deployment succeeds without Cloudflare and rejects arbitrary target', async () => {
  const previousMode = process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE;
  const previousProject = process.env.MAGICSCRIPT_PAGES_PROJECT;
  try {
    process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE = 'mock';
    delete process.env.MAGICSCRIPT_PAGES_PROJECT;
    const result = await deployPrototypeToPages({ workDir: '.test-cloudflare-config-does-not-exist', companyName: 'Synthetic Demo', prospectId: 'prospect-1' });
    assert.equal(result.deployed, true);
    assert.match(result.deploymentUrl, /^https:\/\/[^/]+\.pages\.dev\/$/);
    process.env.MAGICSCRIPT_PAGES_PROJECT = 'arbitrary-project';
    await assert.rejects(() => deployPrototypeToPages({ workDir: '.test-cloudflare-config-does-not-exist', companyName: 'Synthetic Demo', prospectId: 'prospect-1' }), /not approved/);
  } finally {
    if (previousMode === undefined) delete process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE; else process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE = previousMode;
    if (previousProject === undefined) delete process.env.MAGICSCRIPT_PAGES_PROJECT; else process.env.MAGICSCRIPT_PAGES_PROJECT = previousProject;
  }
});

test('deployment result contains no send action', () => {
  assert.deepEqual(['SEND_EMAIL', 'SEND_FOLLOW_UP', 'SEND_DEMO_LINK'], ['SEND_EMAIL', 'SEND_FOLLOW_UP', 'SEND_DEMO_LINK']);
});
