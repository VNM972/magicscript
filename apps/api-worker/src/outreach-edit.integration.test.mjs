import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import worker from './index.ts';
import { commercialFixtures } from '../../../core/tests/fixtures/agent3-commercial/fixtures.ts';
import { createCommercialPreparationContext } from '../../../core/outreach/commercial-preparation-context.ts';

class SqliteD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'));
    for (const migration of ['migration-v2-design-handoff-v1.sql', 'migration-v2-design-artifact-v1.sql', 'migration-v2-builder-v1.sql', 'migration-v2-proposal-v1.sql', 'migration-v2-commercial-preparation-context-v1.sql', 'migration-v2-outreach-draft-v1.sql']) {
      this.database.exec(readFileSync(new URL(`../../../database/${migration}`, import.meta.url), 'utf8'));
    }
  }
  prepare(query) {
    const statement = this.database.prepare(query);
    let values = [];
    const bound = (...next) => { values = next; return api; };
    const api = { bind: bound, first: async () => statement.get(...values) ?? null, all: async () => ({ results: statement.all(...values) }), run: async () => statement.run(...values) };
    return api;
  }
  exec(sql, ...values) { return this.database.prepare(sql).run(...values); }
  close() { this.database.close(); }
}

const date = '2026-09-01T12:00:00Z';
const fixture = commercialFixtures[0].context;
const prospectId = fixture.prospect.id;
const proposalId = 'proposal-create-authoritative';
const contactId = 'contact-create-authoritative';
const proposal = {
  id: proposalId, version: 'PROPOSAL_V1', prospectId, designRequestId: 'design-create',
  approvedDesignArtifactId: 'design-artifact-create', approvedDesignRevision: 1,
  buildArtifactId: 'build-create', buildRevision: 1, visualQaReportId: 'qa-create',
  token: 'server-token', entryPath: '/p/server-token', status: 'PROPOSAL_READY', createdAt: date,
  booking: { availabilityPath: '/availability', bookingPath: '/booking' },
  tracking: { sessionCookie: 'cookie', events: ['PROPOSAL_VIEWED'] },
};

function seed(db) {
  db.exec('INSERT INTO prospects (id, company_name, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', prospectId, fixture.prospect.name, 'QUALIFIED', date, date);
  db.exec('INSERT INTO contacts (id, prospect_id, email, is_validated, is_suppressed, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)', contactId, prospectId, 'contact@example.test', date, date);
  db.exec('INSERT INTO v2_design_requests (id, prospect_id, version, pack_id, request_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', 'design-create', prospectId, 'DESIGN_REQUEST_V1', 'pack-create', '{}', date);
  db.exec('INSERT INTO v2_design_artifacts (id, design_request_id, prospect_id, version, revision, vertical, artifact_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)', 'design-artifact-create', 'design-create', prospectId, 'DESIGN_ARTIFACT_V1', 'restaurant', '{}', 'APPROVED', date, date);
  db.exec('INSERT INTO v2_build_artifacts (id, build_version, design_artifact_id, design_request_id, prospect_id, approved_revision, builder_version, source_path, output_path, status, artifact_json, created_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)', 'build-create', 'BUILD_ARTIFACT_V1', 'design-artifact-create', 'design-create', prospectId, 'builder', 'src', 'dist', 'SUCCEEDED', '{}', date, date, date);
  db.exec('INSERT INTO v2_proposals (id, canonical_key, prospect_id, build_artifact_id, token, status, proposal_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', proposalId, 'build-create:PROPOSAL_V1', prospectId, 'build-create', 'server-token', 'PROPOSAL_READY', JSON.stringify(proposal), date);
  const context = createCommercialPreparationContext({ prospectId, proposal, createdAt: date, evaluatedAt: fixture.evaluatedAt, agent1: fixture.agent1, verticalEvidence: fixture.prospect.vertical, commercialState: 'STANDARD', sources: structuredClone(fixture.sources), claims: structuredClone(fixture.claims), requiredClaimIds: [...fixture.requiredClaimIds], derivationRules: structuredClone(fixture.derivationRules), channel: { type: 'EMAIL', contactRef: contactId, sourceRef: 'channel-authority', verifiedAt: date }, contactState: { suppressionAuthorityRef: 'suppression-authority', firstContactAuthorityRef: 'first-contact-authority', sourceRef: 'contact-state-authority', verifiedAt: date }, catalogEntries: structuredClone(fixture.catalog), scopeConfirmed: true });
  db.exec('INSERT INTO v2_commercial_preparation_contexts (context_id, schema_version, context_version, prospect_id, proposal_id, context_json, created_at, evaluated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', context.contextId, 1, context.contextVersion, prospectId, proposalId, JSON.stringify(context), context.createdAt, context.evaluatedAt);
}

const env = { MAGICSCRIPT_API_TOKEN: 'fixture-api', MAGICSCRIPT_PUBLIC_BASE_URL: 'https://demo.example.test', MAGICSCRIPT_AUTOPILOT_ENABLED: 'false', MAGICSCRIPT_SENDING_ENABLED: 'false' };
async function create(db, input = {}) {
  return worker.fetch(new Request('https://local.test/api/v2/outreach/drafts', { method: 'POST', headers: { authorization: 'Bearer fixture-api', 'content-type': 'application/json' }, body: JSON.stringify({ proposalId, channel: 'EMAIL', recipientRef: contactId, proposalLink: 'https://attacker.test/forged', body: 'forged body', grounding: ['forged'], ...input }) }), { DB: db, ...env });
}


async function edit(db, id, input) {
  return worker.fetch(new Request(`https://local.test/api/v2/outreach/drafts/${encodeURIComponent(id)}/edit`, { method: 'POST', headers: { authorization: 'Bearer fixture-api', 'content-type': 'application/json' }, body: JSON.stringify(input) }), { DB: db, ...env });
}

test('EDIT creates a freshly gated successor with distinct CP04 identity and no inherited approval', async () => {
  const db = new SqliteD1();
  try {
    seed(db);
    const initial = await (await create(db)).json();
    const original = db.database.prepare('SELECT * FROM v2_outreach_drafts WHERE id = ?').get(initial.draftId);
    db.exec("UPDATE v2_outreach_drafts SET status = 'APPROVED', approved_revision = 1, approved_hash = ? WHERE id = ?", original.content_hash, initial.draftId);
    const response = await edit(db, initial.draftId, { subject: `${original.subject} - suite` });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    const successor = db.database.prepare('SELECT * FROM v2_outreach_drafts WHERE id = ?').get(result.draftId);
    const oldLink = JSON.parse(original.quality_gate_json);
    const link = JSON.parse(successor.quality_gate_json);
    assert.equal(successor.status, 'READY_FOR_OPERATOR');
    assert.equal(successor.revision, 2);
    assert.equal(successor.approved_revision, null);
    assert.equal(successor.approved_hash, null);
    assert.equal(successor.approved_at, null);
    assert.equal(link.decision, 'READY_FOR_OPERATOR');
    assert.equal(link.status, 'READY');
    assert.equal(link.revision, 2);
    assert.equal(link.contextId, oldLink.contextId);
    assert.notEqual(link.cp04ContentRef, oldLink.cp04ContentRef);
    assert.notEqual(link.cp04ContentRef, successor.content_hash);
    assert.equal(result.fingerprint, successor.content_hash);
    assert.equal(db.database.prepare('SELECT status, content_hash FROM v2_outreach_drafts WHERE id = ?').get(initial.draftId).status, 'APPROVED');
  } finally { db.close(); }
});

test('EDIT fails closed for CP02 abstention, CP04 block, missing authority and forged link without successor', async () => {
  for (const mutate of [
    db => db.exec('UPDATE contacts SET is_suppressed = 1 WHERE id = ?', contactId),
    db => db.exec('DELETE FROM v2_commercial_preparation_contexts'),
    db => db.exec("UPDATE v2_outreach_drafts SET proposal_link = 'https://attacker.test/p'"),
    () => {},
  ]) {
    const db = new SqliteD1();
    try {
      seed(db);
      const initial = await (await create(db)).json();
      mutate(db);
      const response = await edit(db, initial.draftId, { body: 'Double your revenue guaranteed. No opposition.' });
      assert.equal(response.status, 409);
      assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM v2_outreach_drafts').get().count, 1);
      assert.equal(db.database.prepare('SELECT status FROM v2_outreach_drafts WHERE id = ?').get(initial.draftId).status, 'READY_FOR_OPERATOR');
    } finally { db.close(); }
  }
});
