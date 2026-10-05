import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1DesignArtifactStore } from '../persistence/d1-design-artifact-store';
import type { D1DatabaseLike } from '../persistence/d1-types';
import { buildDeterministicArtifact, DESIGN_ARTIFACT_VERSION, executeVerticalDesigner, validateDesignArtifact } from '../design/design-artifact';
import type { DesignRequestV1 } from '../design/design-request';

test('D1 design persistence maps every field, reads back, upserts uniquely and rejects malformed writes', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE prospects (id TEXT PRIMARY KEY);
      CREATE TABLE v2_design_requests (id TEXT PRIMARY KEY);
      INSERT INTO prospects VALUES ('p-store');
      INSERT INTO v2_design_requests VALUES ('dr-store');`);
    db.exec(readFileSync(new URL('../../database/migration-v2-design-artifact-v1.sql', import.meta.url), 'utf8'));
    const d1: D1DatabaseLike = {
      prepare(query) {
        let values: unknown[] = [];
        return {
          bind(...bound) { values = bound; return this; },
          async first<T>() { return (db.prepare(query).get(...values as never[]) ?? null) as T | null; },
          async all<T>() { return { results: db.prepare(query).all(...values as never[]) as T[] }; },
          async run() { const result = db.prepare(query).run(...values as never[]); return { success: true, meta: { changes: result.changes } }; },
        };
      },
    };
    const store = new D1DesignArtifactStore(d1);
    const request: DesignRequestV1 = {
      id: 'dr-store', version: 'DESIGN_REQUEST_V1', prospectId: 'p-store',
      admission: { packId: 'pack-store', schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2' },
      identity: { businessName: 'Maison Test', city: 'Le Diamant' },
      opportunity: { businessContext: 'Local business', digitalFriction: 'Unclear next action' },
      designInput: { businessVertical: 'GENERAL_LOCAL_BUSINESS', evidence: [{ url: 'https://example.test/', note: 'Supplied evidence', supports: ['website'] }] },
      createdAt: '2026-10-01T00:00:00.000Z',
    };
    const artifact = validateDesignArtifact(buildDeterministicArtifact(request, '2026-10-02T00:00:00.000Z'), request);
    const count = () => db.prepare('SELECT COUNT(*) AS n FROM v2_design_artifacts').get()!.n;
    assert.equal(await store.get(request.id, DESIGN_ARTIFACT_VERSION), null);
    await store.save(artifact);
    assert.equal(count(), 1);
    assert.deepEqual({ ...db.prepare('SELECT * FROM v2_design_artifacts').get() }, {
      id: artifact.id, design_request_id: artifact.designRequestId, prospect_id: artifact.prospectId,
      version: artifact.version, revision: artifact.revision, vertical: artifact.verticalProfile,
      artifact_json: JSON.stringify(artifact), status: artifact.status,
      created_at: artifact.createdAt, updated_at: artifact.createdAt,
    });
    assert.deepEqual(await store.get(request.id, artifact.version, artifact.revision), artifact);
    await store.save(artifact);
    assert.equal(count(), 1);
    const updated = { ...artifact, status: 'APPROVED' as const, createdAt: '2026-10-02T01:00:00.000Z' };
    await store.save(updated);
    assert.equal(count(), 1);
    assert.deepEqual(await store.get(request.id, artifact.version), updated);
    const row = db.prepare('SELECT created_at, updated_at, status FROM v2_design_artifacts').get()!;
    assert.equal(row.created_at, artifact.createdAt);
    assert.equal(row.updated_at, updated.createdAt);
    assert.equal(row.status, 'APPROVED');
    assert.deepEqual(await executeVerticalDesigner({ request, artifacts: store, generate: async () => { throw new Error('Replay must not generate'); } }), updated);
    await assert.rejects(store.save({ ...artifact, id: 'missing-parent', designRequestId: 'missing' }), /FOREIGN KEY constraint failed/);
    await assert.rejects(store.save({ ...artifact, verticalProfile: null as never }), /NOT NULL constraint failed/);
    await assert.rejects(store.save({ ...artifact, revision: 2 }), /UNIQUE constraint failed/);
    const next = { ...artifact, id: `artifact-${request.id}-${artifact.version}-r2`, revision: 2 };
    await store.save(next);
    assert.equal(count(), 2);
    assert.deepEqual(await store.get(request.id, artifact.version, 2), next);
  } finally { db.close(); }
});
