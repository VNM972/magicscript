import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from './index.ts';
import { D1JobQueue } from '../../../core/persistence/d1-job-queue.ts';
import { buildDeterministicArtifact } from '../../../core/design/design-artifact.ts';
import { executeBuilder, BuilderError, InMemoryBuildArtifactStore } from '../../../core/builder/site-builder.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { executeBuildCorrection } from '../../../core/builder/site-builder.ts';
import { D1BuildArtifactStore } from '../../../core/persistence/d1-build-artifact-store.ts';
import { D1BuildCorrectionStore, D1VisualQaReportStore } from '../../../core/persistence/d1-visual-qa-store.ts';
import { createBuildCorrectionRequest } from '../../../core/visual-qa/engine.ts';
import { correctionJobFor } from '../../../core/visual-qa/contracts.ts';

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
      run: async () => { this.beforeWrite?.(sql); return statement().run(...values); },
    };
    return result;
  }
  close() { this.database.close(); }
}

const review = status => JSON.stringify({ webDesignReview: { status, owner: 'web-design', verifier: 'local-test', blockers: [] } });
function seed(db, qa = review('PASS'), state = 'PROTOTYPE_READY', status = 'READY', suffix = '', qaStatus = null) {
  db.database.prepare('INSERT INTO prospects (id, company_name, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('p'+suffix, 'Isolated admission fixture', state, '2026-09-01', '2026-09-01');
  db.database.prepare('INSERT INTO prototypes (id, prospect_id, repo_path, status, qa_status, qa_findings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('prototype'+suffix, 'p'+suffix, 'isolated-fixture', status, qaStatus, qa, '2026-09-01', '2026-09-01');
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
      seed(db, qa, 'PROTOTYPE_READY', 'READY', '', 'PASS'); assert.equal(await new D1JobQueue(db).next(new Date(), 'runner-a', ['DEPLOY_PROTOTYPE']), null); pending(db);
    } finally { db.close(); }
  });
}
for (const status of ['PASS', 'PASS_WITH_NOTES']) {
  test(`${status} permits one atomic claim`, async () => {
    const db = new FixtureD1(); try {
      seed(db, review(status), 'PROTOTYPE_READY', 'READY', '', 'PASS'); const queue = new D1JobQueue(db);
      const job = await queue.next(new Date(), 'runner-a', ['DEPLOY_PROTOTYPE']);
      assert.equal(job.id, 'deploy'); assert.equal(job.attempts, 1); assert.equal(job.claimedBy, 'runner-a');
      assert.equal(await queue.next(new Date(), 'runner-b', ['DEPLOY_PROTOTYPE']), null);
    } finally { db.close(); }
  });
}
for (const [state, status] of [['HUMAN_ACTION_REQUIRED','READY'],['PROTOTYPE_READY','BUILT']]) {
  test(`review cannot bypass ${state}/${status}`, async () => {
    const db = new FixtureD1(); try { seed(db, review('PASS'), state, status, '', 'PASS');
      assert.equal(await new D1JobQueue(db).next(), null); pending(db);
    } finally { db.close(); }
  });
}
test('latest review takes precedence and blocked jobs do not starve eligible work', async () => {
  const db = new FixtureD1(); try {
    seed(db, review('PASS'), 'PROTOTYPE_READY', 'READY', '', 'PASS'); seed(db, review('PASS'), 'PROTOTYPE_READY', 'READY', '-valid', 'PASS');
    db.database.prepare('INSERT INTO prototypes (id, prospect_id, repo_path, status, qa_status, qa_findings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('newer', 'p', 'fixture', 'READY', 'PASS', review('BLOCKED'), '2026-09-02', '2026-09-02');
    assert.equal((await new D1JobQueue(db).next()).id, 'deploy-valid'); pending(db);
  } finally { db.close(); }
});
test('review changed after selection cannot consume an attempt', async () => {
  const db = new FixtureD1(); try { seed(db, review('PASS'), 'PROTOTYPE_READY', 'READY', '', 'PASS');
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
  const db = new FixtureD1(); try { seed(db, review('PASS'), 'PROTOTYPE_READY', 'READY', '', 'PASS');
    db.database.exec(`UPDATE jobs SET payload_json = '{"requiredRunnerId":"runner-b"}'`);
    const queue = new D1JobQueue(db);
    assert.equal(await queue.next(new Date(), 'runner-a'), null);
    assert.equal(await queue.next(new Date(), 'runner-b', undefined, 'other'), null); pending(db);
  } finally { db.close(); }
});
test('API deploy capability OFF with valid review leaves deploy pending and makes no request', async () => {
  const db = new FixtureD1(); const originalFetch = globalThis.fetch; let calls = 0;
  try { seed(db, review('PASS'), 'PROTOTYPE_READY', 'READY', '', 'PASS'); globalThis.fetch = async () => { calls++; throw Error('External request forbidden'); };
    assert.equal((await claim(envFor(db))).status, 204); pending(db); assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; db.close(); }
});
test('API deploy admission ON still denies missing review before claim', async () => {
  const db = new FixtureD1(); try { seed(db, null, 'PROTOTYPE_READY', 'READY', '', 'PASS');
    assert.equal((await claim({...envFor(db), MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED:'true'})).status, 204); pending(db);
  } finally { db.close(); }
});
test('API valid review and enabled admission returns the approved job without external execution', async () => {
  const db = new FixtureD1(); const originalFetch = globalThis.fetch; let calls = 0;
  try { seed(db, review('PASS'), 'PROTOTYPE_READY', 'READY', '', 'PASS'); globalThis.fetch = async () => { calls++; throw Error('External request forbidden'); };
    const response = await claim({...envFor(db), MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED:'true'});
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.job.id, 'deploy'); assert.equal(body.job.attempts, 1);
    assert.equal(db.database.prepare('SELECT state FROM prospects WHERE id = ?').get('p').state, 'PROTOTYPE_DEPLOYING');
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; db.close(); }
});

function seedDesignClaim(db, kind = 'V2_DESIGN_REVIEW', slotOwner = 'p', state = 'INGESTED') {
  seed(db, null, state);
  const request = { id: 'request-p', prospectId: 'p', version: 'DESIGN_REQUEST_V1' };
  const artifact = { id: 'artifact-p-r1', designRequestId: request.id, prospectId: 'p', revision: 1 };
  db.database.prepare('INSERT INTO v2_design_requests (id, prospect_id, version, pack_id, request_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(request.id, 'p', request.version, 'pack-p', JSON.stringify(request), '2026-09-01');
  db.database.prepare('INSERT INTO v2_design_artifacts (id, design_request_id, prospect_id, version, revision, vertical, artifact_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(artifact.id, request.id, 'p', 'DESIGN_ARTIFACT_V1', 1, 'GENERAL_LOCAL_BUSINESS', JSON.stringify(artifact), 'GENERATED', '2026-09-01', '2026-09-01');
  db.database.prepare('UPDATE jobs SET kind = ?, payload_json = ? WHERE id = ?')
    .run(kind, JSON.stringify({ designRequestId: request.id, artifactId: artifact.id, artifactRevision: 1 }), 'deploy');
  if (slotOwner && slotOwner !== 'p') {
    db.database.prepare('INSERT INTO prospects (id, company_name, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(slotOwner, 'Foreign slot fixture', 'INGESTED', '2026-09-01', '2026-09-01');
  }
  if (slotOwner) db.database.prepare('UPDATE active_production_slots SET prospect_id = ?, acquired_at = ? WHERE slot_id = 1')
    .run(slotOwner, '2026-09-01');
}

for (const [kind, state] of [['V2_DESIGN_REVIEW', 'INGESTED'], ['V2_DESIGN_REQUEST', 'INGESTED'], ['V2_BUILD_SITE', 'INGESTED'], ['V2_DESIGN_REVIEW', 'PROTOTYPE_REQUIRED']]) {
  test(`production admission preserves ${state}/${kind} with its owned slot`, async () => {
    const db = new FixtureD1(); const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => { throw Error('External request forbidden'); };
      if (kind === 'V2_BUILD_SITE') seedBuildClaim(db, 'APPROVED', 'DRAFT', state);
      else seedDesignClaim(db, kind, 'p', state);
      const slots = db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all();
      const response = await claim(envFor(db)); const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.equal(body.job.id, 'deploy'); assert.equal(body.job.prospectId, 'p'); assert.equal(body.job.attempts, 1);
      assert.equal(body.designRequest.id, 'request-p');
      if (kind === 'V2_DESIGN_REVIEW') assert.equal(body.designArtifact.id, 'artifact-p-r1');
      if (kind === 'V2_BUILD_SITE') {
        assert.equal(body.designArtifact.id, 'artifact-p-r1');
        assert.equal(body.designArtifact.status, 'APPROVED');
      }
      assert.equal((await claim(envFor(db))).status, 204);
      assert.equal(db.database.prepare('SELECT attempts FROM jobs WHERE id = ?').get('deploy').attempts, 1);
      assert.equal(db.database.prepare('SELECT state FROM prospects WHERE id = ?').get('p').state, state);
      assert.deepEqual(db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all(), slots);
      assert.equal(db.database.prepare('SELECT count(*) AS total FROM job_results').get().total, 0);
    } finally { globalThis.fetch = originalFetch; db.close(); }
  });
}

for (const [kind, scenario] of [
  ['V2_DESIGN_REVIEW', 'missing'], ['V2_DESIGN_REVIEW', 'foreign'], ['V2_DESIGN_REVIEW', 'released'],
  ['V2_BUILD_SITE', 'missing'], ['V2_BUILD_SITE', 'foreign'], ['V2_BUILD_SITE', 'released'],
  ['V2_DESIGN_REVISION', 'unrelated'],
]) {
  test(`INGESTED production admission denies ${kind}/${scenario} continuation without consuming an attempt`, async () => {
    const db = new FixtureD1(); try {
      seedDesignClaim(db, kind,
        scenario === 'missing' ? null : scenario === 'foreign' ? 'other' : 'p');
      if (scenario === 'released') db.database.exec("UPDATE active_production_slots SET prospect_id = NULL, acquired_at = NULL, release_reason = 'released' WHERE slot_id = 1");
      const slots = db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all();
      const response = await claim(envFor(db)); const body = await response.json();
      assert.equal(response.status, 409); assert.equal(body.reason, 'ACTIVE_PRODUCTION_SLOT_REQUIRED');
      pending(db); assert.equal(db.database.prepare('SELECT claimed_at FROM jobs WHERE id = ?').get('deploy').claimed_at, null);
      assert.deepEqual(db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all(), slots);
      assert.equal(db.database.prepare('SELECT count(*) AS total FROM job_results').get().total, 0);
    } finally { db.close(); }
  });
}

for (const kind of ['V2_DESIGN_REVIEW', 'V2_BUILD_SITE']) test(`INGESTED ${kind} continuation retains the active production capacity guard`, async () => {
  const db = new FixtureD1(); try {
    seedDesignClaim(db, kind);
    for (let i = 0; i < 21; i++) db.database.prepare('INSERT INTO prospects (id, company_name, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(`active-${i}`, 'Capacity fixture', 'PROTOTYPE_REQUIRED', '2026-09-01', '2026-09-01');
    const response = await claim(envFor(db)); const body = await response.json();
    assert.equal(response.status, 409); assert.equal(body.reason, 'ACTIVE_PRODUCTION_WINDOW_INCONSISTENT'); pending(db);
  } finally { db.close(); }
});

function seedBuildClaim(db, rowStatus, jsonStatus, state = 'PROTOTYPE_REQUIRED') {
  // Use the existing build-admitted lifecycle to exercise the projection boundary.
  seedDesignClaim(db, 'V2_BUILD_SITE', 'p', state);
  const request = {
    id: 'request-p', prospectId: 'p', version: 'DESIGN_REQUEST_V1',
    admission: { packId: 'pack-p', schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2' },
    identity: { businessName: 'Isolated build fixture' },
    opportunity: { businessContext: 'Local business', digitalFriction: 'Unclear next action' },
    designInput: { businessVertical: 'GENERAL_LOCAL_BUSINESS', evidence: [
      { url: 'https://example.test/', note: 'Supplied fixture evidence', supports: ['identity'] },
    ] },
    createdAt: '2026-09-01T00:00:00.000Z',
  };
  const artifact = { ...buildDeterministicArtifact(request, request.createdAt), id: 'artifact-p-r1', status: jsonStatus };
  db.database.prepare('UPDATE v2_design_requests SET request_json = ? WHERE id = ?').run(JSON.stringify(request), request.id);
  db.database.prepare('UPDATE v2_design_artifacts SET artifact_json = ?, status = ? WHERE id = ?')
    .run(JSON.stringify(artifact), rowStatus, artifact.id);
  db.database.prepare('UPDATE jobs SET payload_json = ? WHERE id = ?')
    .run(JSON.stringify({ designRequestId: request.id, approvedDesignArtifactId: artifact.id, approvedRevision: 1, builderVersion: 'builder-v1' }), 'deploy');
  return { request, artifact };
}

for (const [rowStatus, jsonStatus] of [['APPROVED', 'DRAFT'], ['DRAFT', 'APPROVED'], ['APPROVED', 'APPROVED'], ['DRAFT', 'DRAFT']]) {
  test(`build claim projects SQL ${rowStatus} over JSON ${jsonStatus} without changing design or persistence`, async () => {
    const db = new FixtureD1(); const root = await mkdtemp(join(tmpdir(), 'r69zb-projection-'));
    try {
      const { artifact } = seedBuildClaim(db, rowStatus, jsonStatus);
      const persisted = db.database.prepare('SELECT * FROM v2_design_artifacts').get();
      const slots = db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all();
      const response = await claim(envFor(db)); const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.deepEqual(body.designArtifact, { ...artifact, status: rowStatus });
      assert.equal(body.job.id, 'deploy'); assert.equal(body.job.prospectId, 'p');
      assert.equal(body.job.attempts, 1); assert.equal(body.job.claimedBy, 'runner-a');
      assert.equal((await claim(envFor(db))).status, 204);
      assert.equal(db.database.prepare('SELECT attempts FROM jobs WHERE id = ?').get('deploy').attempts, 1);
      assert.deepEqual(db.database.prepare('SELECT * FROM v2_design_artifacts').get(), persisted);
      assert.deepEqual(db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all(), slots);
      assert.equal(db.database.prepare('SELECT state FROM prospects WHERE id = ?').get('p').state, 'PROTOTYPE_REQUIRED');
      assert.equal(db.database.prepare('SELECT count(*) AS n FROM job_results').get().n, 0);
      const input = { artifact: body.designArtifact, designRequest: body.designRequest, root };
      if (rowStatus === 'APPROVED') {
        const store = new InMemoryBuildArtifactStore();
        const built = await executeBuilder({ ...input, store });
        assert.equal(built.status, 'SUCCEEDED'); assert.equal(built.approvedDesignArtifactId, artifact.id);
        assert.deepEqual(await executeBuilder({ ...input, store }), built);
        assert.equal((await store.list()).length, 1);
      } else {
        await assert.rejects(executeBuilder(input), error => error instanceof BuilderError && error.code === 'INVALID_APPROVAL_STATE' && error.message === 'Artifact status DRAFT is not APPROVED');
      }
    } finally { db.close(); await rm(root, { recursive: true, force: true }); }
  });
}

test('build claim preserves missing-artifact rejection and foreign-artifact linkage rejection', async () => {
  for (const missing of [true, false]) {
    const db = new FixtureD1();
    try {
      const { artifact } = seedBuildClaim(db, 'APPROVED', 'DRAFT');
      if (missing) db.database.exec('DELETE FROM v2_design_artifacts');
      else db.database.prepare('UPDATE v2_design_artifacts SET artifact_json = ?').run(JSON.stringify({ ...artifact, prospectId: 'foreign' }));
      const response = await claim(envFor(db)); const body = await response.json();
      assert.equal(response.status, 200);
      if (missing) assert.equal(body.designArtifact, null);
      else assert.equal(body.designArtifact.prospectId, 'foreign');
      await assert.rejects(executeBuilder({ artifact: body.designArtifact, designRequest: body.designRequest }),
        error => error instanceof BuilderError && error.code === (missing ? 'MISSING_DESIGN_ARTIFACT' : 'INVALID_DESIGN_ARTIFACT'));
    } finally { db.close(); }
  }
});

async function seedCorrectionClaim(db, root, operation = 'ENSURE_LOCAL_FAVICON_V1') {
  const { request, artifact } = seedBuildClaim(db, 'APPROVED', 'DRAFT', 'INGESTED');
  const approved = { ...artifact, status: 'APPROVED' };
  const build = await executeBuilder({ artifact: approved, designRequest: request, root, now: () => new Date('2026-09-01T00:00:00.000Z') });
  if (operation === 'NORMALIZE_PUBLIC_VERTICAL_LABEL_V1') {
    // Reproduce a historical parent emitted before public-label normalization.
    const html = readFileSync(join(build.sourcePath, 'index.html'), 'utf8').replace('<p class="eyebrow">Entreprise locale</p>', '<p class="eyebrow">GENERAL_LOCAL_BUSINESS</p>');
    for (const directory of [build.sourcePath, build.outputPath]) writeFileSync(join(directory, 'index.html'), html);
    const hash = createHash('sha256');
    readdirSync(build.sourcePath).filter(name => name !== 'dist').sort().forEach((name, i) => { if (i) hash.update('\n'); hash.update(`${name}\n`); hash.update(readFileSync(join(build.sourcePath, name))); });
    build.sourceHash = hash.digest('hex');
  }
  await new D1BuildArtifactStore(db).save(build);
  const report = {
    id: `qa-${build.id}-r1-a1`, version: 'VISUAL_QA_REPORT_V1', buildArtifactId: build.id,
    designArtifactId: artifact.id, designArtifactRevision: 1, designRequestId: request.id,
    prospectId: 'p', buildVersion: build.version, buildRevision: 1, attempt: 1, decision: 'CORRECTION_REQUIRED',
    issues: [{ category: 'BUILD_RENDER', severity: 'MAJOR', message: 'GET /favicon.ico → 404', expectedCorrection: 'Keep this exact source issue; prose is not executable.' }],
    inspection: { viewports: [], expectedSections: [], observedSections: [], primaryCta: approved.strategy.primaryCta, brokenAssets: [], internalLinkErrors: [], consoleErrors: ['GET /favicon.ico → 404'], unresolvedMarkers: [], headings: [] },
    createdAt: '2026-09-01T00:01:00.000Z',
  };
  if (operation === 'NORMALIZE_PUBLIC_VERTICAL_LABEL_V1') {
    report.issues = [{ category: 'PLACEHOLDER', severity: 'CRITICAL', message: 'Unresolved or unsafe rendered marker: GENERAL_LOCAL_BUSINESS', expectedCorrection: 'Remove debug/template content without inventing facts.' }];
    report.inspection.unresolvedMarkers = ['GENERAL_LOCAL_BUSINESS'];
    report.inspection.consoleErrors = [];
  }
  await new D1VisualQaReportStore(db).save(report);
  const correction = createBuildCorrectionRequest(report, operation, { build, design: approved, request });
  await new D1BuildCorrectionStore(db).save(correction);
  const job = correctionJobFor(correction);
  db.database.prepare('UPDATE jobs SET id = ?, kind = ?, payload_json = ? WHERE id = ?').run(job.id, job.kind, JSON.stringify(job.payload), 'deploy');
  return { build, report, correction, job, request, artifact };
}

function succeedCorrection(db, id, output) {
  return worker.fetch(new Request(`http://local.test/api/runner/jobs/${encodeURIComponent(id)}/succeed`, {
    method: 'POST', headers: { authorization: 'Bearer fixture-runner', 'x-magicscript-runner-id': 'runner-a', 'x-magicscript-stack-id': 'stack-a', 'content-type': 'application/json' },
    body: JSON.stringify({ output }),
  }), envFor(db));
}

test('correction claim hydrates canonical records and projects APPROVED over DRAFT without changing r1 or slot', async () => {
  const db = new FixtureD1(); const root = await mkdtemp(join(tmpdir(), 'r73zb-api-'));
  try {
    const fixture = await seedCorrectionClaim(db, root);
    const before = db.database.prepare('SELECT * FROM v2_build_artifacts').get();
    const designBefore = db.database.prepare('SELECT * FROM v2_design_artifacts').get();
    const slots = db.database.prepare('SELECT * FROM active_production_slots').all();
    const response = await claim(envFor(db)); const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.job.id, fixture.job.id);
    assert.equal(body.designArtifact.status, 'APPROVED');
    const context = body.buildCorrectionContext;
    assert.deepEqual(context.correctionRequest, fixture.correction);
    assert.equal(context.targetBuild.id, fixture.build.id);
    assert.deepEqual(context.qaReport, fixture.report);
    assert.equal(context.approvedDesignArtifact.status, 'APPROVED');
    assert.equal(context.existingCorrectedBuild, null);
    assert.equal(context.productionSlot.prospectId, 'p');
    assert.deepEqual(db.database.prepare('SELECT * FROM v2_build_artifacts').get(), before);
    assert.deepEqual(db.database.prepare('SELECT * FROM v2_design_artifacts').get(), designBefore);
    assert.deepEqual(db.database.prepare('SELECT * FROM active_production_slots').all(), slots);
  } finally { db.close(); await rm(root, { recursive: true, force: true }); }
});

test('correction success persists r2 and job result before SUCCEEDED, remains idempotent, and never queues QA', async () => {
  const db = new FixtureD1(); const root = await mkdtemp(join(tmpdir(), 'r73zb-api-success-'));
  try {
    const fixture = await seedCorrectionClaim(db, root);
    const r1 = db.database.prepare('SELECT * FROM v2_build_artifacts').get();
    const slots = db.database.prepare('SELECT * FROM active_production_slots').all();
    const body = await (await claim(envFor(db))).json(); const context = body.buildCorrectionContext;
    const corrected = await executeBuildCorrection({ ...context, request: context.correctionRequest });
    let observedOrder = false;
    db.beforeWrite = sql => {
      if (/UPDATE jobs\s+SET status = 'SUCCEEDED'/.test(sql)) {
        assert.equal(db.database.prepare('SELECT id FROM v2_build_artifacts WHERE id = ?').get(corrected.id).id, corrected.id);
        assert.equal(db.database.prepare('SELECT job_id FROM job_results WHERE job_id = ?').get(fixture.job.id).job_id, fixture.job.id);
        observedOrder = true;
      }
    };
    const response = await succeedCorrection(db, fixture.job.id, corrected);
    assert.equal(response.status, 200, JSON.stringify(await response.json())); assert.equal(observedOrder, true);
    assert.equal(db.database.prepare('SELECT status FROM jobs WHERE id = ?').get(fixture.job.id).status, 'SUCCEEDED');
    assert.equal(db.database.prepare('SELECT count(*) AS n FROM v2_build_artifacts').get().n, 2);
    assert.deepEqual(db.database.prepare('SELECT * FROM v2_build_artifacts WHERE id = ?').get(fixture.build.id), r1);
    assert.deepEqual(db.database.prepare('SELECT * FROM active_production_slots').all(), slots);
    assert.equal(db.database.prepare("SELECT count(*) AS n FROM jobs WHERE kind = 'V2_VISUAL_QA'").get().n, 0);
    assert.equal(db.database.prepare('SELECT count(*) AS n FROM v2_visual_qa_reports').get().n, 1);
    db.database.prepare("UPDATE jobs SET status = 'PENDING', claimed_by = NULL WHERE id = ?").run(fixture.job.id);
    const replay = await (await claim(envFor(db))).json();
    assert.equal(replay.buildCorrectionContext.existingCorrectedBuild.id, corrected.id);
    assert.deepEqual(await executeBuildCorrection({ ...replay.buildCorrectionContext, request: replay.buildCorrectionContext.correctionRequest }), corrected);
    assert.equal((await succeedCorrection(db, fixture.job.id, corrected)).status, 200);
    assert.equal(db.database.prepare('SELECT count(*) AS n FROM v2_build_artifacts').get().n, 2);
    assert.equal(db.database.prepare('SELECT count(*) AS n FROM job_results').get().n, 1);
    const canonical = db.database.prepare('SELECT * FROM v2_build_artifacts WHERE id = ?').get(corrected.id);
    db.database.prepare("UPDATE jobs SET status = 'RUNNING', claimed_by = 'runner-a' WHERE id = ?").run(fixture.job.id);
    assert.notEqual((await succeedCorrection(db, fixture.job.id, { ...corrected, completedAt: 'changed' })).status, 200);
    assert.deepEqual(db.database.prepare('SELECT * FROM v2_build_artifacts WHERE id = ?').get(corrected.id), canonical);
  } finally { db.close(); await rm(root, { recursive: true, force: true }); }
});

for (const field of ['correctionRequestId', 'buildArtifactId', 'qaReportId', 'designRequestId', 'approvedDesignArtifactId', 'targetBuildRevision', 'nextBuildRevision']) {
  test(`correction claim rejects conflicting payload ${field}`, async () => {
    const db = new FixtureD1(); const root = await mkdtemp(join(tmpdir(), 'r73zb-api-link-'));
    try {
      const fixture = await seedCorrectionClaim(db, root);
      const payload = { ...fixture.job.payload, [field]: field.includes('Revision') ? 99 : 'foreign' };
      db.database.prepare('UPDATE jobs SET payload_json = ? WHERE id = ?').run(JSON.stringify(payload), fixture.job.id);
      assert.notEqual((await claim(envFor(db))).status, 200);
      assert.equal(db.database.prepare('SELECT status FROM jobs WHERE id = ?').get(fixture.job.id).status, 'PENDING');
      assert.equal(db.database.prepare('SELECT count(*) AS n FROM v2_build_artifacts').get().n, 1);
    } finally { db.close(); await rm(root, { recursive: true, force: true }); }
  });
}

for (const operation of ['ENSURE_LOCAL_FAVICON_V1', 'NORMALIZE_PUBLIC_VERTICAL_LABEL_V1']) {
for (const defect of ['identity', 'attempt', 'lineage', 'bytes', 'forged-styles', 'forged-manifest', 'missing-proof', 'released-slot', 'result-conflict', 'path', 'foreign-design', 'correction-identity', 'parent-hash', 'unknown-operation', ...(operation === 'ENSURE_LOCAL_FAVICON_V1' ? ['missing-favicon', 'missing-favicon-link'] : ['raw-marker', 'wrong-label', 'favicon-mutation'])]) {
  test(`correction success ${operation} rejects ${defect} before persistence or success`, async () => {
    const db = new FixtureD1(); const root = await mkdtemp(join(tmpdir(), 'r73zb-api-reject-'));
    try {
      const fixture = await seedCorrectionClaim(db, root, operation);
      const context = (await (await claim(envFor(db))).json()).buildCorrectionContext;
      const corrected = await executeBuildCorrection({ ...context, request: context.correctionRequest });
      const output = structuredClone(corrected);
      if (defect === 'identity') output.id += '-foreign';
      if (defect === 'attempt') output.qaAttempt = 3;
      if (defect === 'lineage') output.previousBuildArtifactId = 'foreign';
      if (defect === 'path') output.outputPath += '-foreign';
      if (defect === 'foreign-design') output.approvedDesignArtifactId = 'foreign';
      if (defect === 'correction-identity') output.correctionRequestId = 'foreign';
      if (defect === 'parent-hash') output.metadata.outputIntegrity.parentSourceFiles['styles.css'] = Buffer.from('changed parent').toString('base64');
      if (defect === 'unknown-operation') db.database.prepare('UPDATE v2_build_corrections SET correction_json = ? WHERE id = ?').run(JSON.stringify({ ...fixture.correction, operation: 'UNKNOWN' }), fixture.correction.id);
      if (defect === 'bytes') output.metadata.outputIntegrity.sourceFiles['styles.css'] = Buffer.from('arbitrary CSS').toString('base64');
      if (['forged-styles', 'forged-manifest', 'missing-favicon', 'missing-favicon-link', 'raw-marker', 'wrong-label', 'favicon-mutation'].includes(defect)) {
        const proof = output.metadata.outputIntegrity;
        if (defect === 'missing-favicon') { delete proof.sourceFiles['favicon.ico']; delete proof.outputFiles['favicon.ico']; }
        else {
          const name = defect === 'forged-styles' ? 'styles.css' : defect === 'forged-manifest' ? 'build-manifest.json' : 'index.html';
          const original = Buffer.from(proof.sourceFiles[name], 'base64').toString();
          const content = defect === 'forged-styles' ? 'arbitrary CSS' : defect === 'forged-manifest' ? JSON.stringify({ ...JSON.parse(original), unauthorized: 'arbitrary manifest change' })
            : defect === 'missing-favicon-link' ? original.replace(/<link rel="icon"[^>]*>/, '')
            : defect === 'favicon-mutation' ? original.replace('</head>', '<link rel="icon" href="./favicon.ico"></head>')
            : original.replace('Entreprise locale', defect === 'raw-marker' ? 'GENERAL_LOCAL_BUSINESS' : 'Wrong public label');
          assert.notEqual(content, original);
          proof.sourceFiles[name] = proof.outputFiles[name] = Buffer.from(content).toString('base64');
        }
        const hash = createHash('sha256');
        Object.keys(proof.sourceFiles).sort().forEach((file, i) => { if (i) hash.update('\n'); hash.update(`${file}\n`); hash.update(Buffer.from(proof.sourceFiles[file], 'base64')); });
        output.sourceHash = hash.digest('hex');
      }
      if (defect === 'missing-proof') delete output.metadata.outputIntegrity;
      if (defect === 'released-slot') db.database.exec('UPDATE active_production_slots SET prospect_id = NULL, acquired_at = NULL WHERE slot_id = 1');
      if (defect === 'result-conflict') db.database.prepare('INSERT INTO job_results (job_id, output_json, created_at) VALUES (?, ?, ?)').run(fixture.job.id, JSON.stringify({ id: 'foreign' }), '2026-09-01');
      assert.notEqual((await succeedCorrection(db, fixture.job.id, output)).status, 200);
      assert.equal(db.database.prepare('SELECT count(*) AS n FROM v2_build_artifacts').get().n, 1);
      assert.equal(db.database.prepare('SELECT count(*) AS n FROM job_results').get().n, defect === 'result-conflict' ? 1 : 0);
      assert.equal(db.database.prepare('SELECT status FROM jobs WHERE id = ?').get(fixture.job.id).status, 'RUNNING');
    } finally { db.close(); await rm(root, { recursive: true, force: true }); }
  });
}
test(`correction success ${operation} accepts exact output and preserves parent/design/QA/slot`, async () => {
  const db = new FixtureD1(); const root = await mkdtemp(join(tmpdir(), 'r78zb-api-success-'));
  try {
    const fixture = await seedCorrectionClaim(db, root, operation);
    const before = Object.fromEntries(['v2_build_artifacts', 'v2_design_artifacts', 'v2_visual_qa_reports', 'active_production_slots'].map(table => [table, db.database.prepare(`SELECT * FROM ${table}`).all()]));
    const context = (await (await claim(envFor(db))).json()).buildCorrectionContext;
    const output = await executeBuildCorrection({ ...context, request: context.correctionRequest });
    if (operation === 'NORMALIZE_PUBLIC_VERTICAL_LABEL_V1') {
      assert.equal(output.metadata.outputIntegrity.sourceFiles['favicon.ico'], undefined);
      const html = Buffer.from(output.metadata.outputIntegrity.sourceFiles['index.html'], 'base64').toString();
      assert(!html.includes('GENERAL_LOCAL_BUSINESS')); assert(html.includes('<p class="eyebrow">Entreprise locale</p>')); assert(!html.includes('rel="icon"'));
    }
    const response = await succeedCorrection(db, fixture.job.id, output);
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
    assert.equal(db.database.prepare('SELECT status FROM jobs WHERE id = ?').get(fixture.job.id).status, 'SUCCEEDED');
    assert.deepEqual(db.database.prepare('SELECT * FROM v2_build_artifacts WHERE id = ?').all(fixture.build.id), before.v2_build_artifacts);
    for (const table of ['v2_design_artifacts', 'v2_visual_qa_reports', 'active_production_slots']) assert.deepEqual(db.database.prepare(`SELECT * FROM ${table}`).all(), before[table]);
  } finally { db.close(); await rm(root, { recursive: true, force: true }); }
});
}
