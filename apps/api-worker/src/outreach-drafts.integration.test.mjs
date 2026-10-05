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

test('server-authoritative CREATE ignores caller content and persists CP04 linkage', async () => {
  const db = new SqliteD1();
  try {
    seed(db);
    const response = await create(db);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, 'READY_FOR_OPERATOR');
    const row = db.database.prepare('SELECT * FROM v2_outreach_drafts WHERE id = ?').get(result.draftId);
    assert.equal(row.status, 'READY_FOR_OPERATOR');
    assert.equal(row.prospect_id, prospectId);
    assert.equal(row.proposal_id, proposalId);
    assert.equal(row.recipient_ref, contactId);
    assert.equal(row.revision, 1);
    assert.equal(row.proposal_link, 'https://demo.example.test/p/server-token');
    assert.notEqual(row.body, 'forged body');
    const linkage = JSON.parse(row.quality_gate_json);
    assert.equal(linkage.decision, 'READY_FOR_OPERATOR');
    assert.equal(linkage.status, 'READY');
    assert.equal(linkage.contextId, db.database.prepare('SELECT context_id FROM v2_commercial_preparation_contexts').get().context_id);
    assert.equal(linkage.proposalId, proposalId);
    assert.equal(linkage.prospectId, prospectId);
    assert.equal(linkage.canonicalLink, row.proposal_link);
    assert.ok(linkage.cp04ContentRef);
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'outreach.v2_draft_created'").get().count, 1);
  } finally { db.close(); }
});

test('CREATE fails closed for missing context, mismatched authority, non-ready proposal, and unauthorized contact', async () => {
  const missing = new SqliteD1();
  try { seed(missing); missing.exec('DELETE FROM v2_commercial_preparation_contexts'); const response = await create(missing); assert.equal(response.status, 409); assert.match(await response.text(), /COMMERCIAL_CONTEXT_NOT_FOUND/); } finally { missing.close(); }
  const mismatch = new SqliteD1();
  try { seed(mismatch); const forged = JSON.parse(mismatch.database.prepare('SELECT proposal_json FROM v2_proposals WHERE id = ?').get(proposalId).proposal_json); forged.prospectId = 'other-prospect'; mismatch.exec('UPDATE v2_proposals SET proposal_json = ? WHERE id = ?', JSON.stringify(forged), proposalId); const response = await create(mismatch); assert.equal(response.status, 409); assert.match(await response.text(), /INVALID_PROPOSAL_AUTHORITY/); } finally { mismatch.close(); }
  const notReady = new SqliteD1();
  try { seed(notReady); notReady.exec('DELETE FROM v2_proposals WHERE id = ?', proposalId); const response = await create(notReady); assert.equal(response.status, 409); assert.match(await response.text(), /PROPOSAL_NOT_READY/); } finally { notReady.close(); }
  const unauthorized = new SqliteD1();
  try { seed(unauthorized); const response = await create(unauthorized, { recipientRef: 'missing-contact' }); assert.equal(response.status, 409); assert.match(await response.text(), /CHANNEL_NOT_AUTHORIZED/); } finally { unauthorized.close(); }
});

test('CREATE fails closed for suppressed contact and CP03 prerequisite abstention', async () => {
  const suppressed = new SqliteD1();
  try { seed(suppressed); suppressed.exec('UPDATE contacts SET is_suppressed = 1 WHERE id = ?', contactId); const response = await create(suppressed); assert.equal(response.status, 409); assert.match(await response.text(), /COMMERCIAL_PREPARATION_/); assert.equal(suppressed.database.prepare('SELECT COUNT(*) AS count FROM v2_outreach_drafts').get().count, 0); } finally { suppressed.close(); }
  const contacted = new SqliteD1();
  try { seed(contacted); contacted.exec('INSERT INTO v2_contacted (prospect_id, proposal_id, channel, contacted_at, draft_id, revision, fingerprint, operator_id) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', prospectId, proposalId, 'EMAIL', date, 'prior', 'prior-hash', 'human'); const response = await create(contacted); assert.equal(response.status, 409); assert.match(await response.text(), /COMMERCIAL_PREPARATION_/); assert.equal(contacted.database.prepare('SELECT COUNT(*) AS count FROM v2_outreach_drafts').get().count, 0); } finally { contacted.close(); }
});
