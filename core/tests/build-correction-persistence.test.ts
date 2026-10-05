import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { buildDeterministicArtifact } from '../design/design-artifact';
import type { DesignRequestV1 } from '../design/design-request';
import { buildArtifactIdFor, type BuildArtifactV1 } from '../builder/contracts';
import { D1BuildArtifactStore } from '../persistence/d1-build-artifact-store';
import { D1BuildCorrectionStore, D1VisualQaReportStore } from '../persistence/d1-visual-qa-store';
import type { D1DatabaseLike, D1PreparedStatementLike } from '../persistence/d1-types';
import { correctionJobFor, type BrowserQaEvidence, type VisualQaReportV1 } from '../visual-qa/contracts';
import { createBuildCorrectionRequest, executeVisualQa } from '../visual-qa/engine';

const now = '2026-10-03T10:00:00.000Z';
const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../database/migration-v2-build-revision-v1.sql', import.meta.url), 'utf8');
const request = { id: 'dr-correction-fixture-DESIGN_REQUEST_V1', version: 'DESIGN_REQUEST_V1', prospectId: 'prospect-correction-fixture', admission: { packId: 'pack-fixture', schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2' }, identity: { businessName: 'Fixture Café' }, opportunity: { businessContext: 'Local café' }, designInput: { businessVertical: 'RESTAURANT', evidence: [] }, createdAt: now } as DesignRequestV1;
const design = { ...buildDeterministicArtifact(request, now), status: 'APPROVED' as const };
const build = (revision = 1, attempt = revision): BuildArtifactV1 => ({ id: buildArtifactIdFor(design.id, 'builder-v1', revision), version: 'BUILD_ARTIFACT_V1', approvedDesignArtifactId: design.id, designRequestId: request.id, prospectId: request.prospectId, approvedRevision: 1, buildRevision: revision, qaAttempt: attempt, builderVersion: 'builder-v1', sourcePath: revision === 1 ? '/fixture/source' : `/fixture/build-r${revision}/source`, outputPath: revision === 1 ? '/fixture/dist' : `/fixture/build-r${revision}/dist`, status: 'SUCCEEDED', framework: 'STATIC_HTML_CSS', sourceHash: 'a'.repeat(64), createdAt: now, completedAt: now, metadata: { entryFile: 'index.html', buildCommand: 'fixture', missingAssetRequirements: [] } });
const evidence: BrowserQaEvidence = { viewports: [{ name: 'MOBILE', width: 390, height: 844, horizontalOverflow: 0, heroVisible: true, primaryCtaVisible: true, contentVisible: true, controlsWithinViewport: true }], observedSections: design.buildGuidance.sectionOrder, consoleErrors: ['GET /favicon.ico 404'] };

class FixtureD1 implements D1DatabaseLike {
  readonly database = new DatabaseSync(':memory:');
  constructor(legacy = false) {
    this.database.exec(legacy ? schema.replace(" build_revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(build_revision) = 'integer' AND build_revision >= 1),", '').replace('UNIQUE(design_artifact_id, builder_version, build_revision)', 'UNIQUE(design_artifact_id, builder_version)') : schema);
    this.database.prepare('INSERT INTO prospects (id, company_name, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(request.prospectId, 'Fixture Café', 'INGESTED', now, now);
    this.database.prepare('INSERT INTO v2_design_requests (id, prospect_id, version, pack_id, request_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(request.id, request.prospectId, request.version, 'pack-fixture', JSON.stringify(request), now);
    // Relational APPROVED with legacy serialized DRAFT is deliberately preserved.
    this.database.prepare('INSERT INTO v2_design_artifacts (id, design_request_id, prospect_id, version, revision, vertical, artifact_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(design.id, request.id, request.prospectId, design.version, 1, design.verticalProfile, JSON.stringify({ ...design, status: 'DRAFT' }), 'APPROVED', now, now);
  }
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
const qa = (target: BuildArtifactV1, store?: D1VisualQaReportStore) => executeVisualQa({ build: target, design, request, evidence, now: () => new Date(now), store });
const prepareCorrection = (report: VisualQaReportV1, target = build()) => createBuildCorrectionRequest(report, 'ENSURE_LOCAL_FAVICON_V1', { build: target, design, request });

test('legacy build normalizes r1/a1 while preserving original JSON, identity, path and immutable row', async () => {
  const db = new FixtureD1();
  try {
    const store = new D1BuildArtifactStore(db); const legacy = build(); delete legacy.buildRevision; delete legacy.qaAttempt;
    await store.save(legacy);
    // Simulate an existing legacy row without rewriting its JSON during reads/replays.
    db.database.prepare('UPDATE v2_build_artifacts SET artifact_json = ? WHERE id = ?').run(JSON.stringify(legacy), legacy.id);
    const before = db.database.prepare('SELECT * FROM v2_build_artifacts WHERE id = ?').get(legacy.id);
    const normalized = await store.get(legacy.id);
    assert.equal(normalized?.buildRevision, 1); assert.equal(normalized?.qaAttempt, 1);
    assert.equal(normalized?.id, legacy.id); assert.equal(normalized?.sourcePath, legacy.sourcePath);
    await store.save(legacy); assert.deepEqual(db.database.prepare('SELECT * FROM v2_build_artifacts WHERE id = ?').get(legacy.id), before);
    await assert.rejects(store.save({ ...legacy, sourceHash: 'b'.repeat(64) }), { code: 'BUILD_REVISION_CONFLICT' });
    for (const revision of [0, -1, 1.2, NaN, null]) await assert.rejects(store.save({ ...legacy, buildRevision: revision as number }), { code: 'BUILD_REVISION_CONFLICT' });
    db.database.prepare('UPDATE v2_build_artifacts SET build_revision = 2 WHERE id = ?').run(legacy.id);
    await assert.rejects(store.get(legacy.id), { code: 'BUILD_REVISION_CONFLICT' });
  } finally { db.close(); }
});

test('same design/builder r1 and r2 coexist; duplicate revision/content and forged JSON linkage reject', async () => {
  const db = new FixtureD1();
  try {
    const store = new D1BuildArtifactStore(db); const r1 = build(); const r2 = { ...build(2), previousBuildArtifactId: r1.id, correctionRequestId: 'correction-fixture' };
    await store.save(r1); const before = db.database.prepare('SELECT * FROM v2_build_artifacts WHERE id = ?').get(r1.id);
    await store.save(r2); await store.save(r2);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM v2_build_artifacts').get()!.total, 2);
    assert.deepEqual(db.database.prepare('SELECT * FROM v2_build_artifacts WHERE id = ?').get(r1.id), before);
    await assert.rejects(store.save({ ...r2, id: 'other-id-same-revision' }), { code: 'BUILD_REVISION_CONFLICT' });
    await assert.rejects(store.save({ ...r2, qaAttempt: 3 }), { code: 'BUILD_REVISION_CONFLICT' });
    db.database.prepare('UPDATE v2_build_artifacts SET artifact_json = ? WHERE id = ?').run(JSON.stringify({ ...r2, prospectId: 'foreign' }), r2.id);
    await assert.rejects(store.get(r2.id), { code: 'BUILD_INTEGRITY_MISMATCH' });
  } finally { db.close(); }
});

test('QA allocates a1/a2/a3 by build, report IDs use build revision, caller mismatch/range fail closed', async () => {
  for (const revision of [1, 2, 3]) {
    const target = build(revision); const report = await qa(target);
    assert.equal(report.id, `qa-${target.id}-r${revision}-a${revision}`); assert.equal(report.attempt, revision); assert.equal(report.designArtifactRevision, 1);
    assert.equal(report.decision, revision < 3 ? 'CORRECTION_REQUIRED' : 'VISUAL_QA_LIMIT_REACHED');
    await assert.rejects(executeVisualQa({ build: target, design, request, evidence, attempt: revision === 1 ? 2 : 1 }), /allocated attempt/);
    if (revision === 3) assert.throws(() => prepareCorrection(report, target), (error: unknown) => error instanceof Error && (('code' in error && error.code === 'INVALID_CORRECTION_REQUEST') || error.message.includes('INVALID_CORRECTION_REQUEST')));
  }
  for (const attempt of [0, 4, 1.5, NaN]) await assert.rejects(qa({ ...build(), qaAttempt: attempt }), (error: unknown) => error instanceof Error && (('code' in error && error.code === 'INVALID_CORRECTION_REQUEST') || error.message.includes('INVALID_CORRECTION_REQUEST')));
  const legacy = build(); delete legacy.buildRevision; delete legacy.qaAttempt; assert.equal((await qa(legacy)).attempt, 1);
});

test('correction preparation requires explicit operation/full exact linkage and preserves issue prose verbatim', async () => {
  const target = build(); const report = await qa(target); const prepared = prepareCorrection(report);
  assert.equal(prepared.id, `correction-${report.id}`); assert.equal(prepared.issue.expectedCorrection, report.issues[0].expectedCorrection); assert.equal(prepared.createdAt, report.createdAt);
  assert.deepEqual(correctionJobFor(prepared, now).payload, { correctionRequestId: prepared.id, buildArtifactId: target.id, targetBuildRevision: 1, nextBuildRevision: 2, qaReportId: report.id, designRequestId: request.id, approvedDesignArtifactId: design.id });
  assert.throws(() => createBuildCorrectionRequest(report, 'SHELL_EXEC' as never, { build: target, design, request }), { code: 'UNSUPPORTED_CORRECTION' });
  assert.throws(() => createBuildCorrectionRequest(report, undefined as never, { build: target, design, request }), { code: 'UNSUPPORTED_CORRECTION' });
  for (const altered of [{ ...report, prospectId: 'foreign' }, { ...report, buildArtifactId: 'foreign' }, { ...report, designArtifactId: 'foreign' }, { ...report, designRequestId: 'foreign' }, { ...report, buildRevision: 2 }, { ...report, designArtifactRevision: 2 }, { ...report, decision: 'PASS' as const }, { ...report, attempt: 3 }]) assert.throws(() => prepareCorrection(altered), (error: unknown) => error instanceof Error && 'code' in error && ['INVALID_CORRECTION_REQUEST', 'BUILD_REVISION_CONFLICT'].includes(String(error.code)));
  assert.throws(() => createBuildCorrectionRequest(report, 'ENSURE_LOCAL_FAVICON_V1', { build: target, design, request }, { ...report.issues[0], expectedCorrection: 'arbitrary shell or edit instructions' }), (error: unknown) => error instanceof Error && (('code' in error && error.code === 'INVALID_CORRECTION_REQUEST') || error.message.includes('INVALID_CORRECTION_REQUEST')));
  assert.throws(() => correctionJobFor({ ...prepared, designRequestId: undefined }), (error: unknown) => error instanceof Error && (('code' in error && error.code === 'INVALID_CORRECTION_REQUEST') || error.message.includes('INVALID_CORRECTION_REQUEST')));
});

test('reports and correction requests are immutable; canonical build+attempt replay preserves historical IDs', async () => {
  const db = new FixtureD1();
  try {
    const builds = new D1BuildArtifactStore(db); const reports = new D1VisualQaReportStore(db); const corrections = new D1BuildCorrectionStore(db);
    const r1 = build(); const r2 = build(2); await builds.save(r1); await builds.save(r2);
    const report = { ...await qa(r1), id: 'historical-r1-report-id' }; await reports.save(report); await reports.save(report);
    const correction = prepareCorrection(report); await corrections.save(correction); await corrections.save(correction);
    assert.deepEqual(await qa(r1, reports), report);
    const replay = await executeVisualQa({ build: r1, design, request, evidence: { ...evidence, consoleErrors: [] }, store: reports }); assert.deepEqual(replay, report);
    await assert.rejects(reports.save({ ...report, decision: 'PASS' }), { code: 'BUILD_REVISION_CONFLICT' });
    await assert.rejects(reports.save({ ...report, id: 'same-build-attempt-new-id' }), { code: 'BUILD_REVISION_CONFLICT' });
    await assert.rejects(reports.save({ ...report, attempt: 2 }), { code: 'BUILD_REVISION_CONFLICT' });
    await assert.rejects(corrections.save({ ...correction, nextBuildRevision: 3 }), (error: unknown) => error instanceof Error && (('code' in error && error.code === 'INVALID_CORRECTION_REQUEST') || error.message.includes('INVALID_CORRECTION_REQUEST')));
    const report2 = await qa(r2, reports); assert.equal(report2.attempt, 2); assert.deepEqual(await reports.get(report.id), report);
    db.database.prepare('UPDATE v2_visual_qa_reports SET report_json = ? WHERE id = ?').run(JSON.stringify({ ...report, prospectId: 'foreign' }), report.id);
    await assert.rejects(reports.get(report.id), (error: unknown) => error instanceof Error && (('code' in error && error.code === 'INVALID_CORRECTION_REQUEST') || error.message.includes('INVALID_CORRECTION_REQUEST')));
    db.database.prepare('UPDATE v2_build_corrections SET correction_json = ? WHERE id = ?').run(JSON.stringify({ ...correction, qaReportId: 'foreign' }), correction.id);
    await assert.rejects(corrections.get(correction.id), (error: unknown) => error instanceof Error && (('code' in error && error.code === 'INVALID_CORRECTION_REQUEST') || error.message.includes('INVALID_CORRECTION_REQUEST')));
  } finally { db.close(); }
});

test('isolated atomic migration preserves all legacy build/dependent row bytes and foreign keys, permits r1+r2 only', async () => {
  const db = new FixtureD1(true);
  try {
    const legacy = build(); delete legacy.buildRevision; delete legacy.qaAttempt;
    db.database.prepare('INSERT INTO v2_build_artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(legacy.id, legacy.version, design.id, request.id, request.prospectId, 1, legacy.builderVersion, legacy.sourcePath, legacy.outputPath, legacy.status, legacy.sourceHash!, JSON.stringify(legacy), now, now, now);
    const report = { ...await qa(legacy), id: 'legacy-qa-id' }; const reports = new D1VisualQaReportStore(db); await reports.save(report);
    await new D1BuildCorrectionStore(db).save(prepareCorrection(report, legacy));
    db.database.prepare('INSERT INTO v2_proposals (id, canonical_key, prospect_id, build_artifact_id, token, status, proposal_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('proposal-fixture', 'proposal-key', request.prospectId, legacy.id, 'fixture-token', 'DRAFT', '{"fixture":true}', now);
    const before = Object.fromEntries(['v2_build_artifacts', 'v2_visual_qa_reports', 'v2_build_corrections', 'v2_proposals', 'v2_design_artifacts'].map((table) => [table, db.database.prepare(`SELECT * FROM ${table}`).all()]));
    db.database.exec(`BEGIN IMMEDIATE; ${migration} COMMIT;`);
    assert.equal(db.database.isTransaction, false); assert.deepEqual(db.database.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(db.database.prepare('PRAGMA foreign_keys').get()!.foreign_keys, 1);
    for (const table of ['v2_visual_qa_reports', 'v2_build_corrections', 'v2_proposals', 'v2_design_artifacts']) assert.deepEqual(db.database.prepare(`SELECT * FROM ${table}`).all(), before[table]);
    const after = db.database.prepare('SELECT * FROM v2_build_artifacts').all().map((row) => { const { build_revision, ...rest } = row; assert.equal(build_revision, 1); return rest; }); assert.equal(JSON.stringify(after), JSON.stringify(before.v2_build_artifacts));
    const builds = new D1BuildArtifactStore(db); assert.equal((await builds.get(legacy.id))?.buildRevision, 1); await builds.save(build(2));
    await assert.rejects(builds.save({ ...build(2), id: 'duplicate-revision' }), { code: 'BUILD_REVISION_CONFLICT' });
    assert.deepEqual(db.database.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM v2_build_artifacts').get()!.total, 2);
  } finally { db.close(); }
});

test('migration interrupted before commit rolls back parent rebuild and dependent cascade as one unit', () => {
  const db = new FixtureD1(true);
  try {
    const before = db.database.prepare("SELECT sql FROM sqlite_master WHERE name='v2_build_artifacts'").get()!.sql;
    const injectedFailure = `BEGIN IMMEDIATE; ${migration} INSERT INTO r73z_missing_table VALUES (1); COMMIT;`;
    assert.throws(() => db.database.exec(injectedFailure), /no such table/); assert.equal(db.database.isTransaction, true);
    db.database.exec('ROLLBACK;'); assert.equal(db.database.prepare("SELECT sql FROM sqlite_master WHERE name='v2_build_artifacts'").get()!.sql, before);
    assert.deepEqual(db.database.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(db.database.prepare("SELECT count(*) AS total FROM sqlite_master WHERE name='v2_build_artifacts_revision_v1'").get()!.total, 0);
  } finally { db.close(); }
});

test('migration preserves valid explicit JSON revision and rejects invalid explicit revision atomically', () => {
  for (const revision of [2, 0, -1, 1.5, null, '2', 9007199254740992]) {
    const db = new FixtureD1(true);
    try {
      const value = { ...build(), buildRevision: revision };
      db.database.prepare('INSERT INTO v2_build_artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(value.id, value.version, design.id, request.id, request.prospectId, 1, value.builderVersion, value.sourcePath, value.outputPath, value.status, value.sourceHash!, JSON.stringify(value), now, now, now);
      if (revision === 2) {
        db.database.exec(`BEGIN IMMEDIATE; ${migration} COMMIT;`);
        const saved = db.database.prepare('SELECT build_revision, artifact_json FROM v2_build_artifacts').get()!;
        assert.equal(saved.build_revision, 2); assert.equal(saved.artifact_json, JSON.stringify(value));
      } else {
        assert.throws(() => db.database.exec(`BEGIN IMMEDIATE; ${migration} COMMIT;`), /CHECK constraint failed/);
        db.database.exec('ROLLBACK;');
        assert.equal(db.database.prepare('SELECT artifact_json FROM v2_build_artifacts').get()!.artifact_json, JSON.stringify(value));
        assert.equal(db.database.prepare("SELECT count(*) AS total FROM sqlite_master WHERE name LIKE 'r73z_%'").get()!.total, 0);
      }
    } finally { db.close(); }
  }
});

test('native isolated D1 migration batch succeeds and failure rolls the full migration back atomically', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("fixture"); } };', compatibilityDate: '2026-09-04', d1Databases: ['FIXTURE_DB'], d1Persist: false }));
  try {
    const d1 = await mf.getD1Database('FIXTURE_DB');
    const sqlStatements = (sql: string) => sql.replace(/--[^\n]*/g, '').split(';').map((part) => part.trim()).filter(Boolean);
    const legacySchema = schema.replace(" build_revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(build_revision) = 'integer' AND build_revision >= 1),", '').replace('UNIQUE(design_artifact_id, builder_version, build_revision)', 'UNIQUE(design_artifact_id, builder_version)').replace(/CREATE TRIGGER\b[\s\S]*?END;/gi, '');
    await d1.batch(sqlStatements(legacySchema).map((sql) => d1.prepare(sql)));
    await d1.prepare('INSERT INTO prospects (id, company_name, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(request.prospectId, 'Fixture Café', 'INGESTED', now, now).run();
    await d1.prepare('INSERT INTO v2_design_requests (id, prospect_id, version, pack_id, request_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(request.id, request.prospectId, request.version, 'fixture-pack', JSON.stringify(request), now).run();
    await d1.prepare('INSERT INTO v2_design_artifacts (id, design_request_id, prospect_id, version, revision, vertical, artifact_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(design.id, request.id, request.prospectId, design.version, 1, design.verticalProfile, JSON.stringify({ ...design, status: 'DRAFT' }), 'APPROVED', now, now).run();
    const legacy = build(); delete legacy.buildRevision; delete legacy.qaAttempt;
    await d1.prepare('INSERT INTO v2_build_artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(legacy.id, legacy.version, design.id, request.id, request.prospectId, 1, legacy.builderVersion, legacy.sourcePath, legacy.outputPath, legacy.status, legacy.sourceHash!, JSON.stringify(legacy), now, now, now).run();
    const reports = new D1VisualQaReportStore(d1 as unknown as D1DatabaseLike); const corrections = new D1BuildCorrectionStore(d1 as unknown as D1DatabaseLike); const report = await qa(legacy); await reports.save(report); await corrections.save(prepareCorrection(report, legacy));
    const beforeBuild = await d1.prepare('SELECT * FROM v2_build_artifacts').all(); const beforeQa = await d1.prepare('SELECT * FROM v2_visual_qa_reports').all(); const beforeCorrection = await d1.prepare('SELECT * FROM v2_build_corrections').all();
    const statements = sqlStatements(migration).map((sql) => d1.prepare(sql));
    await assert.rejects(d1.batch([...statements, d1.prepare('INSERT INTO r73z_missing_table VALUES (1)')]), /no such table/);
    assert.deepEqual((await d1.prepare('SELECT * FROM v2_build_artifacts').all()).results, beforeBuild.results);
    assert.deepEqual((await d1.prepare('SELECT * FROM v2_visual_qa_reports').all()).results, beforeQa.results);
    assert.deepEqual((await d1.prepare('SELECT * FROM v2_build_corrections').all()).results, beforeCorrection.results);
    assert.equal((await d1.prepare("SELECT count(*) AS total FROM sqlite_master WHERE name LIKE 'r73z_%'").first<{total:number}>())!.total, 0);
    await d1.batch(statements);
    assert.deepEqual((await d1.prepare('SELECT * FROM v2_visual_qa_reports').all()).results, beforeQa.results);
    assert.deepEqual((await d1.prepare('SELECT * FROM v2_build_corrections').all()).results, beforeCorrection.results);
    assert.deepEqual((await d1.prepare('PRAGMA foreign_key_check').all()).results, []);
    const store = new D1BuildArtifactStore(d1 as unknown as D1DatabaseLike); assert.equal((await store.get(legacy.id))?.buildRevision, 1); await store.save(build(2));
    await assert.rejects(store.save({ ...build(2), id: 'duplicate-native-d1-revision' }), { code: 'BUILD_REVISION_CONFLICT' });
    assert.equal((await d1.prepare('SELECT count(*) AS total FROM v2_build_artifacts').first<{total:number}>())!.total, 2);
  } finally { await mf.dispose(); }
});
