import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from './index.ts';
import { D1JobQueue } from '../../../core/persistence/d1-job-queue.ts';

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
      first: async () => {
        if (sql.startsWith('UPDATE jobs') && this.beforeClaim) {
          const hook = this.beforeClaim; this.beforeClaim = null; hook();
        }
        return statement().get(...values) ?? null;
      },
      all: async () => ({ results: statement().all(...values) }),
      run: async () => statement().run(...values),
    };
    return result;
  }
  close() { this.database.close(); }
}

const review = status => JSON.stringify({ webDesignReview: { status, owner: 'web-design', verifier: 'local-test', blockers: [] } });
function seed(db, qa = review('PASS'), state = 'PROTOTYPE_READY', status = 'READY', suffix = '') {
  db.database.prepare('INSERT INTO prospects (id, company_name, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('p'+suffix, 'Isolated admission fixture', state, '2026-09-01', '2026-09-01');
  db.database.prepare('INSERT INTO prototypes (id, prospect_id, repo_path, status, qa_findings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('prototype'+suffix, 'p'+suffix, 'isolated-fixture', status, qa, '2026-09-01', '2026-09-01');
  db.database.prepare('INSERT INTO jobs (id, kind, prospect_id, payload_json, status, run_after, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('deploy'+suffix, 'DEPLOY_PROTOTYPE', 'p'+suffix, '{}', 'PENDING', '2026-09-01', '2026-09-01', '2026-09-01');
}
function pending(db, id = 'deploy') {
  assert.deepEqual({ ...db.database.prepare('SELECT status, attempts, claimed_by FROM jobs WHERE id = ?').get(id) },
    { status: 'PENDING', attempts: 0, claimed_by: null });
}
function claim(env, stack = 'stack-a') {
  const headers = { authorization: 'Bearer fixture-runner', 'x-magicscript-runner-id': 'runner-a' };
  if (stack !== undefined && stack !== null) headers['x-magicscript-stack-id'] = stack;
  return worker.fetch(new Request('http://local.test/api/runner/jobs/claim', { method: 'POST', headers }), env);
}
const envFor = db => ({ DB: db, MAGICSCRIPT_RUNNER_TOKEN: 'fixture-runner', MAGICSCRIPT_STACK_ID: 'stack-a',
  MAGICSCRIPT_SENDING_ENABLED: 'false', MAGICSCRIPT_EMAIL_PROVIDER: 'disabled', MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false' });

for (const expected of [undefined, '', '   ']) {
  test(`missing API stack ${JSON.stringify(expected)} rejects before persistence`, async () => {
    let accessed = false;
    const env = { ...envFor({ prepare() { accessed = true; throw Error('D1 must not be reached'); } }), MAGICSCRIPT_STACK_ID: expected };
    assert.equal((await claim(env)).status, 503); assert.equal(accessed, false);
  });
}
for (const provided of [null, '', '   ', 'stack-b']) {
  test(`missing/mismatched runner stack ${JSON.stringify(provided)} rejects before persistence`, async () => {
    let accessed = false;
    const env = envFor({ prepare() { accessed = true; throw Error('D1 must not be reached'); } });
    assert.equal((await claim(env, provided)).status, 409); assert.equal(accessed, false);
  });
}
test('matching identity reaches an empty isolated queue', async () => {
  const db = new FixtureD1(); try { assert.equal((await claim(envFor(db))).status, 204); } finally { db.close(); }
});

for (const qa of [null, '{broken', '{}', review('BLOCKED'), review('WAITING_EXTERNAL'), review('UNKNOWN'),
  JSON.stringify({webDesignReview:{status:'PASS'}}), JSON.stringify({webDesignReview:{status:'PASS',owner:'a',verifier:'b',blockers:['failed']}})]) {
  test(`invalid Web Design review is unclaimable: ${qa}`, async () => {
    const db = new FixtureD1(); try {
      seed(db, qa); assert.equal(await new D1JobQueue(db).next(new Date(), 'runner-a', ['DEPLOY_PROTOTYPE']), null); pending(db);
    } finally { db.close(); }
  });
}
for (const status of ['PASS', 'PASS_WITH_NOTES']) {
  test(`${status} permits one atomic claim`, async () => {
    const db = new FixtureD1(); try {
      seed(db, review(status)); const queue = new D1JobQueue(db);
      const job = await queue.next(new Date(), 'runner-a', ['DEPLOY_PROTOTYPE']);
      assert.equal(job.id, 'deploy'); assert.equal(job.attempts, 1); assert.equal(job.claimedBy, 'runner-a');
      assert.equal(await queue.next(new Date(), 'runner-b', ['DEPLOY_PROTOTYPE']), null);
    } finally { db.close(); }
  });
}
for (const [state, status] of [['HUMAN_ACTION_REQUIRED','READY'],['PROTOTYPE_READY','BUILT']]) {
  test(`review cannot bypass ${state}/${status}`, async () => {
    const db = new FixtureD1(); try { seed(db, review('PASS'), state, status);
      assert.equal(await new D1JobQueue(db).next(), null); pending(db);
    } finally { db.close(); }
  });
}
test('latest review takes precedence and blocked jobs do not starve eligible work', async () => {
  const db = new FixtureD1(); try {
    seed(db); seed(db, review('PASS'), 'PROTOTYPE_READY', 'READY', '-valid');
    db.database.prepare('INSERT INTO prototypes (id, prospect_id, repo_path, status, qa_findings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('newer', 'p', 'fixture', 'READY', review('BLOCKED'), '2026-09-02', '2026-09-02');
    assert.equal((await new D1JobQueue(db).next()).id, 'deploy-valid'); pending(db);
  } finally { db.close(); }
});
test('review changed after selection cannot consume an attempt', async () => {
  const db = new FixtureD1(); try { seed(db);
    db.beforeClaim = () => db.database.prepare('UPDATE prototypes SET qa_findings_json = ? WHERE id = ?').run(review('BLOCKED'), 'prototype');
    assert.equal(await new D1JobQueue(db).next(), null); pending(db);
  } finally { db.close(); }
});
test('non-deploy work progresses with no approved review', async () => {
  const db = new FixtureD1(); try { seed(db, null);
    db.database.exec("INSERT INTO jobs (id,kind,payload_json,status,run_after,created_at,updated_at) VALUES ('local','RUN_RESEARCH_SWARM','{}','PENDING','2026-09-01','2026-09-01','2026-09-01')");
    assert.equal((await new D1JobQueue(db).next()).id, 'local'); pending(db);
  } finally { db.close(); }
});
test('affinity and prospect filters still constrain approved deploys', async () => {
  const db = new FixtureD1(); try { seed(db);
    db.database.exec(`UPDATE jobs SET payload_json = '{"requiredRunnerId":"runner-b"}'`);
    const queue = new D1JobQueue(db);
    assert.equal(await queue.next(new Date(), 'runner-a'), null);
    assert.equal(await queue.next(new Date(), 'runner-b', undefined, 'other'), null); pending(db);
  } finally { db.close(); }
});
test('API deploy capability OFF with valid review leaves deploy pending and makes no request', async () => {
  const db = new FixtureD1(); const originalFetch = globalThis.fetch; let calls = 0;
  try { seed(db); globalThis.fetch = async () => { calls++; throw Error('External request forbidden'); };
    assert.equal((await claim(envFor(db))).status, 204); pending(db); assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; db.close(); }
});
test('API deploy admission ON still denies missing review before claim', async () => {
  const db = new FixtureD1(); try { seed(db, null);
    assert.equal((await claim({...envFor(db), MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED:'true'})).status, 204); pending(db);
  } finally { db.close(); }
});
test('API valid review and enabled admission returns the approved job without external execution', async () => {
  const db = new FixtureD1(); const originalFetch = globalThis.fetch; let calls = 0;
  try { seed(db); globalThis.fetch = async () => { calls++; throw Error('External request forbidden'); };
    const response = await claim({...envFor(db), MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED:'true'});
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.job.id, 'deploy'); assert.equal(body.job.attempts, 1);
    assert.equal(db.database.prepare('SELECT state FROM prospects WHERE id = ?').get('p').state, 'PROTOTYPE_DEPLOYING');
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; db.close(); }
});
