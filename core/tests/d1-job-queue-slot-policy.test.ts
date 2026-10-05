import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { admitContactOpportunityPack, D1V2AdmissionStore } from '../admission/v2-admission';
import type { ContactOpportunityPackV2 } from '../admission/contact-opportunity-pack';
import { createDesignHandoff } from '../design/design-handoff';
import type { JobKind } from '../jobs/types';
import { D1DesignRequestStore } from '../persistence/d1-design-request-store';
import { D1JobQueue } from '../persistence/d1-job-queue';
import { D1ProductionSlotStore } from '../persistence/d1-production-slot-store';
import { D1ProspectRepository } from '../persistence/d1-prospect-repository';
import type { D1DatabaseLike, D1PreparedStatementLike } from '../persistence/d1-types';
import { buildDeterministicArtifact } from '../design/design-artifact';
import { D1DesignArtifactStore } from '../persistence/d1-design-artifact-store';
import { D1BuildArtifactStore } from '../persistence/d1-build-artifact-store';
import { D1BuildCorrectionStore, D1VisualQaReportStore } from '../persistence/d1-visual-qa-store';
import { correctionJobFor, type VisualQaReportV1 } from '../visual-qa/contracts';
import { createBuildCorrectionRequest } from '../visual-qa/engine';
import type { BuildArtifactV1 } from '../builder/contracts';

const now = '2026-10-01T10:02:00.000Z';
const originalFetch = globalThis.fetch;
before(() => { globalThis.fetch = async () => { throw new Error('External operations forbidden'); }; });
after(() => { globalThis.fetch = originalFetch; });

class FixtureD1 implements D1DatabaseLike {
  readonly database = new DatabaseSync(':memory:');
  constructor() { this.database.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')); }
  prepare(sql: string): D1PreparedStatementLike {
    let values: SQLInputValue[] = [];
    const statement: D1PreparedStatementLike = {
      bind: (...args) => { values = args as SQLInputValue[]; return statement; },
      first: async <T>() => (this.database.prepare(sql).get(...values) ?? null) as T | null,
      all: async <T>() => ({ results: this.database.prepare(sql).all(...values) as T[] }),
      run: async () => { this.database.prepare(sql).run(...values); return { success: true }; },
    };
    return statement;
  }
  close() { this.database.close(); }
}

function pack(name: string): ContactOpportunityPackV2 {
  return { schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2', packId: `pack-${name}`,
    source: { agent: 'AGENT_1', provenance: 'offline-slot-fixture', receivedAt: now },
    identity: { businessName: name, websiteUrl: `https://${name}.example`, city: 'Fort-de-France' },
    contacts: [{ channel: 'EMAIL', value: `owner@${name}.example` }],
    opportunity: { businessContext: 'Local café', digitalFriction: 'Site rebuilding' } };
}

async function admit(db: FixtureD1, name = 'cafe') {
  const result = await admitContactOpportunityPack(pack(name), new D1V2AdmissionStore(db), now);
  assert.equal(result.admitted, true);
  return { id: result.canonicalProspectId!, pack: result.normalizedPack! };
}

const input = (id: string, kind: JobKind, suffix = '') => ({
  id: `job-${id}-${kind}${suffix}`, kind, prospectId: id, payload: {}, maxAttempts: 3, runAfter: now,
});
const dependencies = (db: FixtureD1) => ({ prospects: new D1ProspectRepository(db),
  requests: new D1DesignRequestStore(db), jobs: new D1JobQueue(db), now: () => new Date(now) });
const productionKinds: JobKind[] = ['GENERATE_PROTOTYPE_STRATEGY', 'BUILD_PROTOTYPE', 'RUN_PROTOTYPE_QA',
  'DEPLOY_PROTOTYPE', 'SEND_DEMO_LINK', 'V2_DESIGN_REVIEW', 'V2_DESIGN_REVISION',
  'V2_BUILD_SITE', 'V2_VISUAL_QA'];

test('D1 canonical INGESTED design handoff claims one slot and remains idempotent', async () => {
  const db = new FixtureD1();
  try {
    const admission = await admit(db);
    const deps = dependencies(db);
    const first = await createDesignHandoff(admission.id, admission.pack, deps);
    const slot = await new D1ProductionSlotStore(db).getActiveProductionSlot(admission.id);
    assert.ok(slot);
    const repeat = await createDesignHandoff(admission.id, admission.pack, deps);
    assert.equal(first.job.kind, 'V2_DESIGN_REQUEST');
    assert.equal(repeat.alreadyExisted, true);
    assert.equal(repeat.job.id, first.job.id);
    assert.equal((await deps.jobs.list()).length, 1);
    assert.deepEqual(await new D1ProductionSlotStore(db).getActiveProductionSlot(admission.id), slot);
    assert.equal((await new D1ProductionSlotStore(db).acquireActiveProductionSlot(admission.id, 'V2_DESIGN_REQUEST')).outcome, 'ALREADY_HELD');
    assert.equal((await deps.prospects.getProspect(admission.id))!.state, 'INGESTED');
  } finally { db.close(); }
});

for (const held of [false, true]) test(`INGESTED rejects every unrelated production kind with slot held=${held}`, async () => {
  const db = new FixtureD1();
  try {
    const admission = await admit(db);
    const queue = new D1JobQueue(db);
    if (held) await createDesignHandoff(admission.id, admission.pack, dependencies(db));
    for (const kind of productionKinds) {
      await assert.rejects(queue.enqueue(input(admission.id, kind)), /ACTIVE_PRODUCTION_SLOT_INELIGIBLE/);
    }
    assert.equal((await queue.list()).length, held ? 1 : 0);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM active_production_slots WHERE prospect_id IS NOT NULL').get()!.total, held ? 1 : 0);
    assert.equal((await new D1ProductionSlotStore(db).acquireActiveProductionSlot(admission.id)).outcome, 'INELIGIBLE');
  } finally { db.close(); }
});

test('design entry rejects missing or rejected V2 admission, wrong lifecycle and missing prospect', async () => {
  const db = new FixtureD1();
  try {
    const admission = await admit(db);
    const queue = new D1JobQueue(db);
    db.database.prepare("UPDATE v2_admissions SET result = 'REJECTED' WHERE prospect_id = ?").run(admission.id);
    await assert.rejects(queue.enqueue(input(admission.id, 'V2_DESIGN_REQUEST')), /ACTIVE_PRODUCTION_SLOT_INELIGIBLE/);
    db.database.prepare('DELETE FROM v2_admissions WHERE prospect_id = ?').run(admission.id);
    await assert.rejects(queue.enqueue(input(admission.id, 'V2_DESIGN_REQUEST')), /ACTIVE_PRODUCTION_SLOT_INELIGIBLE/);
    for (const state of ['DISCOVERED', 'CONTACTED']) {
      db.database.prepare('UPDATE prospects SET state = ? WHERE id = ?').run(state, admission.id);
      await assert.rejects(queue.enqueue(input(admission.id, 'V2_DESIGN_REQUEST')), /ACTIVE_PRODUCTION_SLOT_INELIGIBLE/);
    }
    await assert.rejects(queue.enqueue(input('missing', 'V2_DESIGN_REQUEST')), /ACTIVE_PRODUCTION_SLOT_INVALID/);
    assert.equal((await queue.list()).length, 0);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM active_production_slots WHERE prospect_id IS NOT NULL').get()!.total, 0);
  } finally { db.close(); }
});

test('INGESTED design entry enforces twenty-slot capacity and reuses held slots at capacity', async () => {
  const db = new FixtureD1();
  try {
    const queue = new D1JobQueue(db);
    let firstId = '';
    for (let i = 0; i < 21; i++) {
      const admission = await admit(db, `cafe${i}`);
      if (i === 0) firstId = admission.id;
      if (i < 20) await queue.enqueue(input(admission.id, 'V2_DESIGN_REQUEST'));
      else await assert.rejects(queue.enqueue(input(admission.id, 'V2_DESIGN_REQUEST')), /ACTIVE_PRODUCTION_SLOT_CAPACITY_FULL/);
    }
    assert.equal((await queue.list()).length, 20);
    assert.equal(new Set(await new D1ProductionSlotStore(db).listHeldProspectIds()).size, 20);
    assert.equal((await new D1ProductionSlotStore(db).acquireActiveProductionSlot(firstId, 'V2_DESIGN_REQUEST')).outcome, 'ALREADY_HELD');
    assert.equal(db.database.prepare("SELECT count(*) AS total FROM prospects WHERE state = 'INGESTED'").get()!.total, 21);
  } finally { db.close(); }
});

test('legacy active production enqueue and direct duplicate-ID rejection remain unchanged', async () => {
  const db = new FixtureD1();
  try {
    const admission = await admit(db);
    db.database.prepare("UPDATE prospects SET state = 'PROTOTYPE_REQUIRED' WHERE id = ?").run(admission.id);
    const queue = new D1JobQueue(db);
    const job = input(admission.id, 'BUILD_PROTOTYPE');
    assert.equal((await queue.enqueue(job)).kind, 'BUILD_PROTOTYPE');
    await assert.rejects(queue.enqueue(job), /UNIQUE constraint failed: jobs.id/);
    assert.equal((await queue.list()).length, 1);
    assert.equal(new Set(await new D1ProductionSlotStore(db).listHeldProspectIds()).size, 1);
  } finally { db.close(); }
});

async function correctionFixture(db: FixtureD1) {
  const admission = await admit(db);
  const handoff = await createDesignHandoff(admission.id, admission.pack, dependencies(db));
  const request = await new D1DesignRequestStore(db).get(admission.id, 'DESIGN_REQUEST_V1');
  assert.ok(request);
  const design = { ...buildDeterministicArtifact(request, now), status: 'DRAFT' as const };
  await new D1DesignArtifactStore(db).save(design);
  db.database.prepare("UPDATE v2_design_artifacts SET status = 'APPROVED' WHERE id = ?").run(design.id);
  const build: BuildArtifactV1 = { id: `build-${design.id}-builder-v1`, version: 'BUILD_ARTIFACT_V1',
    approvedDesignArtifactId: design.id, designRequestId: request.id, prospectId: admission.id,
    approvedRevision: 1, buildRevision: 1, qaAttempt: 1, builderVersion: 'builder-v1',
    sourcePath: 'fixture/source', outputPath: 'fixture/dist', status: 'SUCCEEDED', framework: 'STATIC_HTML_CSS',
    sourceHash: 'a'.repeat(64), createdAt: now, completedAt: now,
    metadata: { entryFile: 'index.html', buildCommand: 'fixture', missingAssetRequirements: [] } };
  await new D1BuildArtifactStore(db).save(build);
  const report: VisualQaReportV1 = { id: `qa-${build.id}-r1-a1`, version: 'VISUAL_QA_REPORT_V1',
    buildArtifactId: build.id, designArtifactId: design.id, designArtifactRevision: 1,
    designRequestId: request.id, prospectId: admission.id, buildVersion: build.version, buildRevision: 1,
    attempt: 1, decision: 'CORRECTION_REQUIRED', createdAt: now,
    issues: [{ category: 'BUILD_RENDER', severity: 'MAJOR', message: 'GET /favicon.ico 404', expectedCorrection: 'Fix favicon.' }],
    inspection: { viewports: [], expectedSections: [], observedSections: [], primaryCta: '', brokenAssets: [],
      internalLinkErrors: [], consoleErrors: [], unresolvedMarkers: [], headings: [] } };
  await new D1VisualQaReportStore(db).save(report);
  const correction = createBuildCorrectionRequest(report, 'ENSURE_LOCAL_FAVICON_V1',
    { build, design: { ...design, status: 'APPROVED' }, request });
  await new D1BuildCorrectionStore(db).save(correction);
  return { admission, handoff, job: correctionJobFor(correction, now), correction };
}

test('INGESTED correction continues owned held slot, validates persisted payload and replays without acquisition', async () => {
  const db = new FixtureD1();
  try {
    const { admission, job } = await correctionFixture(db);
    const queue = new D1JobQueue(db);
    const slotsBefore = db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all();
    const held = await new D1ProductionSlotStore(db).getActiveProductionSlot(admission.id);
    assert.equal((await queue.enqueue(job)).id, job.id);
    assert.equal((await queue.enqueue(job)).id, job.id);
    assert.deepEqual(db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all(), slotsBefore);
    assert.deepEqual(await new D1ProductionSlotStore(db).getActiveProductionSlot(admission.id), held);
    assert.equal((await queue.list()).length, 2);
    assert.equal((await new D1ProspectRepository(db).getProspect(admission.id))!.state, 'INGESTED');
    for (const key of Object.keys(job.payload)) {
      await assert.rejects(queue.enqueue({ ...job, payload: { ...job.payload, [key]: 'foreign' } }), /INVALID_CORRECTION_REQUEST/);
    }
    await assert.rejects(queue.enqueue({ ...job, id: 'foreign-id' }), /INVALID_CORRECTION_REQUEST/);
  } finally { db.close(); }
});

for (const mode of ['missing', 'foreign', 'released'] as const) test(`correction rejects ${mode} slot without acquiring one`, async () => {
  const db = new FixtureD1();
  try {
    const { admission, job } = await correctionFixture(db);
    const slots = new D1ProductionSlotStore(db);
    await slots.releaseActiveProductionSlot(admission.id, 'fixture-release');
    if (mode === 'missing') db.database.prepare('DELETE FROM active_production_slots WHERE slot_id = 1').run();
    if (mode === 'foreign') {
      const foreign = await admit(db, 'foreign-cafe');
      await slots.acquireActiveProductionSlot(foreign.id, 'V2_DESIGN_REQUEST');
    }
    const slotsBefore = db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all();
    await assert.rejects(new D1JobQueue(db).enqueue(job), /ACTIVE_PRODUCTION_SLOT_INELIGIBLE/);
    assert.deepEqual(db.database.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all(), slotsBefore);
    assert.equal((await new D1JobQueue(db).list()).length, 1);
  } finally { db.close(); }
});

test('correction queue rejects unsupported persisted operation and foreign persisted linkage', async () => {
  const db = new FixtureD1();
  try {
    const { job, correction } = await correctionFixture(db);
    const queue = new D1JobQueue(db);
    for (const patch of [{ operation: 'EXECUTE_QA_PROSE' }, { prospectId: 'foreign' },
      { qaReportId: 'foreign' }, { designArtifactId: 'foreign' }, { targetBuildRevision: 8 },
      { nextBuildRevision: 9 }]) {
      db.database.prepare('UPDATE v2_build_corrections SET correction_json = ? WHERE id = ?')
        .run(JSON.stringify({ ...correction, ...patch }), correction.id);
      await assert.rejects(queue.enqueue(job), (error: any) =>
        ['INVALID_CORRECTION_REQUEST', 'BUILD_REVISION_CONFLICT', 'UNSUPPORTED_CORRECTION'].includes(error.code)
        || /INVALID_CORRECTION_REQUEST/.test(error.message));
    }
    assert.equal((await queue.list()).length, 1);
  } finally { db.close(); }
});
