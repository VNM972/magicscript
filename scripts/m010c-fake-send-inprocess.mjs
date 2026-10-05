import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

const directoryLoader = `data:text/javascript,${encodeURIComponent(`
import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, extname, resolve as pathResolve } from 'node:path';
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !extname(specifier)) {
    const base = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);
    for (const suffix of ['.ts', '.js', '/index.ts', '/index.js']) {
      try { await access(base + suffix); return { url: pathToFileURL(base + suffix).href, shortCircuit: true }; } catch {}
    }
  }
  return nextResolve(specifier, context);
}
`)}`;
register(directoryLoader, import.meta.url);
const { default: worker } = await import('../apps/api-worker/src/index.ts');

class D1Statement {
  constructor(owner, sql, values = []) {
    this.owner = owner;
    this.sql = sql;
    this.values = values;
  }
  bind(...values) { return new D1Statement(this.owner, this.sql, values); }
  async first(column) {
    if (this.owner.failFakeDeliveryInsert && /INSERT\s+INTO\s+v2_fake_transport_deliveries/i.test(this.sql)) {
      throw new Error('injected fake-delivery persistence failure');
    }
    const row = this.owner.db.prepare(this.sql).get(...this.values) ?? null;
    return column && row ? row[column] ?? null : row;
  }
  async all() {
    return { success: true, results: this.owner.db.prepare(this.sql).all(...this.values), meta: {} };
  }
  async run() {
    if (this.owner.failFakeDeliveryInsert && /INSERT\s+INTO\s+v2_fake_transport_deliveries/i.test(this.sql)) {
      throw new Error('injected fake-delivery persistence failure');
    }
    const result = this.owner.db.prepare(this.sql).run(...this.values);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
  async raw(options = {}) {
    const statement = this.owner.db.prepare(this.sql);
    const columns = statement.columns().map((column) => column.name);
    const rows = statement.all(...this.values).map((row) => columns.map((column) => row[column]));
    return options.columnNames ? [columns, ...rows] : rows;
  }
}

class D1Database {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.failFakeDeliveryInsert = false;
  }
  prepare(sql) { return new D1Statement(this, sql); }
  async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); }
}

function createDatabase() {
  const database = new D1Database();
  database.db.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  database.db.exec(readFileSync(new URL('../database/migration-v2-proposal-v1.sql', import.meta.url), 'utf8'));
  database.db.exec(readFileSync(new URL('../database/migration-v2-outreach-draft-v1.sql', import.meta.url), 'utf8'));
  return database;
}

let db = createDatabase();

const env = {
  DB: db,
  MAGICSCRIPT_DATABASE_PROVIDER: 'd1',
  MAGICSCRIPT_API_TOKEN: 'm010c-api-token',
  MAGICSCRIPT_RUNNER_TOKEN: 'm010c-runner-token',
  MAGICSCRIPT_STACK_ID: 'm010c-stack',
  MAGICSCRIPT_SENDING_ENABLED: 'true',
  MAGICSCRIPT_EMAIL_PROVIDER: 'fake',
  MAGICSCRIPT_FAKE_TRANSPORT: 'true',
  MAGICSCRIPT_TEST_EMAIL_MODE: 'true',
  MAGICSCRIPT_TEST_RECIPIENT: 'sink@example.test',
  MAGICSCRIPT_FAKE_TRANSPORT_FAILURE_PROSPECT_ID: 'prospect-failure',
};

process.env.MAGICSCRIPT_API_BASE_URL = 'http://m010c.local';
process.env.MAGICSCRIPT_API_TOKEN = env.MAGICSCRIPT_API_TOKEN;
process.env.MAGICSCRIPT_RUNNER_TOKEN = env.MAGICSCRIPT_RUNNER_TOKEN;
process.env.MAGICSCRIPT_RUNNER_ID = 'm010c-runner';
process.env.MAGICSCRIPT_STACK_ID = env.MAGICSCRIPT_STACK_ID;
process.env.MAGICSCRIPT_SENDING_ENABLED = env.MAGICSCRIPT_SENDING_ENABLED;
process.env.MAGICSCRIPT_EMAIL_PROVIDER = env.MAGICSCRIPT_EMAIL_PROVIDER;
process.env.MAGICSCRIPT_FAKE_TRANSPORT = env.MAGICSCRIPT_FAKE_TRANSPORT;
process.env.MAGICSCRIPT_TEST_EMAIL_MODE = env.MAGICSCRIPT_TEST_EMAIL_MODE;
process.env.MAGICSCRIPT_TEST_RECIPIENT = env.MAGICSCRIPT_TEST_RECIPIENT;
process.env.MAGICSCRIPT_FAKE_TRANSPORT_FAILURE_PROSPECT_ID = env.MAGICSCRIPT_FAKE_TRANSPORT_FAILURE_PROSPECT_ID;
process.env.MAGICSCRIPT_POLL_INTERVAL_MS = '10';

function seedProposal(label) {
  const prospectId = `prospect-${label}`;
  const contactId = `contact-${label}`;
  const proposalId = `proposal-${label}`;
  const requestId = `request-${label}`;
  const designId = `design-${label}`;
  const buildId = `build-${label}`;
  const now = '2030-01-01T00:00:00.000Z';
  db.db.prepare('INSERT INTO prospects (id, company_name, city, activity, location, phone, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(prospectId, `Business ${label}`, 'Fort-de-France', 'Restaurant', 'Fort-de-France', `+59669600${label.length.toString().padStart(4, '0')}`, 'OUTREACH_VERIFIED', now, now);
  db.db.prepare('INSERT INTO contacts (id, prospect_id, email, is_validated, is_suppressed, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)').run(contactId, prospectId, `${label}@example.test`, now, now);
  db.db.prepare('INSERT INTO v2_design_requests (id, prospect_id, version, pack_id, request_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(requestId, prospectId, 'DESIGN_REQUEST_V1', `pack-${label}`, '{}', now);
  db.db.prepare('INSERT INTO v2_design_artifacts (id, design_request_id, prospect_id, version, revision, vertical, artifact_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)').run(designId, requestId, prospectId, 'DESIGN_ARTIFACT_V1', 'Restaurant', '{}', 'APPROVED', now, now);
  db.db.prepare('INSERT INTO v2_build_artifacts (id, build_version, design_artifact_id, design_request_id, prospect_id, approved_revision, builder_version, source_path, output_path, status, artifact_json, created_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)').run(buildId, 'v1', designId, requestId, prospectId, 'builder', '/tmp/source', '/tmp/output', 'COMPLETED', '{}', now, now, now);
  db.db.prepare('INSERT INTO v2_proposals (id, canonical_key, prospect_id, build_artifact_id, token, status, proposal_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(proposalId, `canonical-${label}`, prospectId, buildId, label, 'PROPOSAL_READY', JSON.stringify({ id: proposalId, prospectId, token: label, status: 'PROPOSAL_READY' }), now);
  return { prospectId, contactId, proposalId };
}

async function call(path, { method = 'GET', body, runner = false, requestEnv = env } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  headers.set('authorization', `Bearer ${runner ? env.MAGICSCRIPT_RUNNER_TOKEN : env.MAGICSCRIPT_API_TOKEN}`);
  if (runner) {
    headers.set('x-magicscript-runner-id', 'm010c-runner');
    headers.set('x-magicscript-stack-id', env.MAGICSCRIPT_STACK_ID);
  }
  const response = await worker.fetch(new Request(`http://m010c.local${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), requestEnv);
  const text = await response.text();
  let value;
  try { value = text ? JSON.parse(text) : null; } catch { value = text; }
  return { response, value };
}

async function queueEmail(label, prospectState = 'OUTREACH_VERIFIED') {
  const fixture = seedProposal(label);
  db.db.prepare('UPDATE prospects SET state = ? WHERE id = ?').run(prospectState, fixture.prospectId);
  const proposalLink = `https://proposal.example.test/p/${label}`;
  const subject = `Subject ${label}`;
  const body = `Body ${label}`;
  const created = await call('/api/v2/outreach/drafts', { method: 'POST', body: { proposalId: fixture.proposalId, channel: 'EMAIL', recipientRef: fixture.contactId, subject, body, proposalLink } });
  assert.equal(created.response.ok, true, JSON.stringify(created.value));
  const state = await call(`/api/v2/outreach/drafts/${encodeURIComponent(created.value.draftId)}`);
  assert.equal(state.response.ok, true, JSON.stringify(state.value));
  const approved = await call(`/api/v2/outreach/drafts/${encodeURIComponent(created.value.draftId)}/approve`, { method: 'POST', body: { revision: state.value.draft.revision, fingerprint: state.value.draft.content_hash } });
  assert.equal(approved.response.ok, true, JSON.stringify(approved.value));
  const queued = await call(`/api/v2/outreach/drafts/${encodeURIComponent(created.value.draftId)}/send-email`, { method: 'POST', body: {} });
  assert.equal(queued.response.status, 202, JSON.stringify(queued.value));
  const jobPayload = JSON.parse(db.db.prepare('SELECT payload_json FROM jobs WHERE id = ?').get(queued.value.jobId).payload_json);
  const persistedDraft = db.db.prepare('SELECT subject, body, proposal_link, revision, content_hash FROM v2_outreach_drafts WHERE id = ?').get(created.value.draftId);
  const persistedMessage = db.db.prepare('SELECT subject, body_text FROM outreach_messages WHERE id = ?').get(queued.value.messageId);
  return { ...fixture, draftId: created.value.draftId, jobId: queued.value.jobId, messageId: queued.value.messageId, reservationId: jobPayload.v2ReservationId, subject: persistedMessage.subject, body: persistedMessage.body_text, proposalLink: persistedDraft.proposal_link, revision: persistedDraft.revision, fingerprint: persistedDraft.content_hash };
}

const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  if (new URL(request.url).origin === 'http://m010c.local') return worker.fetch(request, env);
  throw new Error(`Unexpected external fetch blocked: ${request.url}`);
};

const { runOne } = await import('../apps/agent-runner/src/index.ts');
let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };

const success = await queueEmail('success');
eq(await runOne(), true, 'real runOne processes successful fake SEND_EMAIL');
const successDelivery = db.db.prepare('SELECT * FROM v2_fake_transport_deliveries WHERE reservation_id = ?').get(success.reservationId);
eq({ recipient: successDelivery.recipient, subject: successDelivery.subject, body: successDelivery.body, proposal_link: successDelivery.proposal_link, draft_id: successDelivery.draft_id, revision: successDelivery.revision, fingerprint: successDelivery.fingerprint, idempotency_key: successDelivery.idempotency_key, send_count: successDelivery.send_count, outcome: successDelivery.outcome }, { recipient: 'success@example.test', subject: success.subject, body: success.body, proposal_link: success.proposalLink, draft_id: success.draftId, revision: success.revision, fingerprint: success.fingerprint, idempotency_key: `${success.prospectId}:EMAIL:${success.revision}:INITIAL`, send_count: 1, outcome: 'SUCCESS' }, 'persisted fake delivery is the observed runtime payload');
eq(db.db.prepare("SELECT COUNT(*) AS count FROM v2_contacted WHERE proposal_id = ? AND channel = 'EMAIL'").get(success.proposalId).count, 1, 'success creates CONTACTED');
eq(db.db.prepare("SELECT COUNT(*) AS count FROM events WHERE prospect_id = ? AND type = 'OUTREACH_SENT'").get(success.prospectId).count, 1, 'success creates OUTREACH_SENT');
const duplicate = await call(`/api/v2/outreach/drafts/${encodeURIComponent(success.draftId)}/send-email`, { method: 'POST', body: {} });
eq(duplicate.value.idempotent, true, 'duplicate canonical send is idempotent');
eq(db.db.prepare('SELECT COUNT(*) AS count FROM v2_fake_transport_deliveries WHERE reservation_id = ?').get(success.reservationId).count, 1, 'duplicate has one fake delivery');

eq(db.db.prepare('SELECT state FROM prospects WHERE id = ?').get(success.prospectId).state, 'WAITING_REPLY', 'legacy lifecycle remains intact');
const v2 = await queueEmail('v2-success', 'PROPOSAL_READY');
eq(await runOne(), true, 'V2 proposal-ready send completes through real handlers');
eq(db.db.prepare('SELECT status FROM jobs WHERE id = ?').get(v2.jobId).status, 'SUCCEEDED', 'V2 job succeeded');
eq(db.db.prepare('SELECT status FROM v2_outreach_send_reservations WHERE id = ?').get(v2.reservationId).status, 'SENT', 'V2 reservation completed');
eq(db.db.prepare('SELECT state FROM prospects WHERE id = ?').get(v2.prospectId).state, 'PROPOSAL_READY', 'V2 does not invent a legacy lifecycle transition');
const contacted = db.db.prepare('SELECT * FROM v2_contacted WHERE proposal_id = ?').get(v2.proposalId);
eq([contacted.prospect_id, contacted.draft_id, contacted.revision, contacted.fingerprint], [v2.prospectId, v2.draftId, v2.revision, v2.fingerprint], 'CONTACTED preserves exact correlation');
const sentEvent = JSON.parse(db.db.prepare("SELECT payload_json FROM events WHERE prospect_id = ? AND type = 'OUTREACH_SENT'").get(v2.prospectId).payload_json);
eq([sentEvent.proposalId, sentEvent.draftId, sentEvent.revision, sentEvent.fingerprint], [v2.proposalId, v2.draftId, v2.revision, v2.fingerprint], 'OUTREACH_SENT preserves exact correlation');
eq((await call(`/api/runner/jobs/${v2.jobId}/succeed`, { method: 'POST', runner: true, body: { output: {} } })).response.status, 409, 'completed callback replay is rejected');
eq((await call(`/api/runner/jobs/${v2.jobId}/send-start`, { method: 'POST', runner: true, body: { messageId: v2.messageId } })).response.status, 409, 'completed send-start cannot resend');
eq((await call(`/api/v2/outreach/drafts/${encodeURIComponent(v2.draftId)}/send-email`, { method: 'POST', body: {} })).value.idempotent, true, 'V2 duplicate is idempotent');
eq(db.db.prepare('SELECT COUNT(*) AS n FROM v2_fake_transport_deliveries WHERE reservation_id = ?').get(v2.reservationId).n, 1, 'V2 delivery remains unique');
eq(db.db.prepare("SELECT COUNT(*) AS n FROM events WHERE prospect_id = ? AND type = 'OUTREACH_SENT'").get(v2.prospectId).n, 1, 'V2 sent event remains unique');
eq(db.db.prepare('SELECT COUNT(*) AS n FROM v2_contacted WHERE proposal_id = ?').get(v2.proposalId).n, 1, 'V2 CONTACTED remains unique');

const failure = await queueEmail('failure');
eq(await runOne(), true, 'real runOne processes deterministic fake failure');
eq(db.db.prepare("SELECT outcome FROM v2_fake_transport_deliveries WHERE reservation_id = ?").get(failure.reservationId).outcome, 'FAILURE', 'failure evidence is persisted');
eq(db.db.prepare("SELECT COUNT(*) AS count FROM v2_contacted WHERE proposal_id = ? AND channel = 'EMAIL'").get(failure.proposalId).count, 0, 'failure creates no CONTACTED');
eq(db.db.prepare("SELECT COUNT(*) AS count FROM events WHERE prospect_id = ? AND type = 'OUTREACH_SENT'").get(failure.prospectId).count, 0, 'failure creates no OUTREACH_SENT');
eq(db.db.prepare("SELECT COUNT(*) AS count FROM events WHERE prospect_id = ? AND type = 'OUTREACH_FAKE_TRANSPORT_FAILED'").get(failure.prospectId).count, 1, 'failure is audited');
db.db.prepare("UPDATE jobs SET run_after = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(failure.jobId);
eq(await runOne(), true, 'failure follows existing retry path');
eq(db.db.prepare('SELECT COUNT(*) AS count FROM v2_fake_transport_deliveries WHERE reservation_id = ?').get(failure.reservationId).count, 1, 'failure replay is not recounted');
eq(db.db.prepare("SELECT COUNT(*) AS count FROM events WHERE prospect_id = ? AND type = 'OUTREACH_FAKE_TRANSPORT_FAILED'").get(failure.prospectId).count, 1, 'failure replay has one audit');

const persistenceFailure = await queueEmail('persistence');
db.failFakeDeliveryInsert = true;
eq(await runOne(), true, 'real runOne fails closed when evidence persistence fails');
db.failFakeDeliveryInsert = false;
eq(db.db.prepare('SELECT COUNT(*) AS count FROM v2_fake_transport_deliveries WHERE reservation_id = ?').get(persistenceFailure.reservationId).count, 0, 'persistence failure creates no delivery');
eq(db.db.prepare("SELECT COUNT(*) AS count FROM v2_contacted WHERE proposal_id = ? AND channel = 'EMAIL'").get(persistenceFailure.proposalId).count, 0, 'persistence failure creates no CONTACTED');
eq(db.db.prepare("SELECT COUNT(*) AS count FROM events WHERE prospect_id = ? AND type = 'OUTREACH_SENT'").get(persistenceFailure.prospectId).count, 0, 'persistence failure creates no OUTREACH_SENT');
eq(db.db.prepare('SELECT status FROM jobs WHERE id = ?').get(persistenceFailure.jobId).status, 'SEND_UNKNOWN', 'unpersisted transport evidence remains SEND_UNKNOWN');
const persistenceFailureDb = db;
db = createDatabase();
env.DB = db;

const gated = await queueEmail('gated');
const claim = await call('/api/runner/jobs/claim', { method: 'POST', runner: true });
eq(claim.value.job.id, gated.jobId, 'provider-gate fixture is claimed by the real handler');
const started = await call(`/api/runner/jobs/${encodeURIComponent(gated.jobId)}/send-start`, { method: 'POST', runner: true, body: { messageId: gated.messageId } });
eq(started.value.status, 'STARTED', 'provider-gate fixture owns a SENDING lease');
const gateAttempt = { provider: 'fake', outcome: 'SUCCESS', recipient: 'gated@example.test', subject: gated.subject, body: gated.body, proposalLink: gated.proposalLink, draftId: gated.draftId, revision: gated.revision, fingerprint: gated.fingerprint, idempotencyKey: `${gated.prospectId}:EMAIL:${gated.revision}:INITIAL`, sendCount: 1 };
for (const [name, requestEnv] of [
  ['amen-provider', { ...env, MAGICSCRIPT_EMAIL_PROVIDER: 'amen-smtp' }],
  ['fake-disabled', { ...env, MAGICSCRIPT_FAKE_TRANSPORT: 'false' }],
  ['test-disabled', { ...env, MAGICSCRIPT_TEST_EMAIL_MODE: 'false' }],
]) {
  const rejected = await call(`/api/runner/jobs/${encodeURIComponent(gated.jobId)}/fake-transport-attempt`, { method: 'POST', runner: true, requestEnv, body: gateAttempt });
  eq(rejected.response.ok, false, `${name} cannot persist fake evidence`);
}
eq(db.db.prepare('SELECT COUNT(*) AS count FROM v2_fake_transport_deliveries WHERE reservation_id = ?').get(gated.reservationId).count, 0, 'provider gates create no fake delivery');
const providerGateDb = db;
db = createDatabase();
env.DB = db;

const realProvider = await queueEmail('real-provider');
env.MAGICSCRIPT_EMAIL_PROVIDER = 'amen-smtp';
process.env.MAGICSCRIPT_EMAIL_PROVIDER = 'amen-smtp';
process.env.MAGICSCRIPT_EMAIL_USERNAME = '';
process.env.MAGICSCRIPT_EMAIL_PASSWORD = '';
process.env.MAGICSCRIPT_FROM_EMAIL = '';
const { runOne: runOneRealProvider } = await import('../apps/agent-runner/src/index.ts?m010c-real-provider');
eq(await runOneRealProvider(), true, 'real-provider branch fails before any provider call when credentials are absent');
eq(db.db.prepare('SELECT COUNT(*) AS count FROM v2_fake_transport_deliveries WHERE reservation_id = ?').get(realProvider.reservationId).count, 0, 'real-provider branch never writes fake evidence');
eq(db.db.prepare("SELECT COUNT(*) AS count FROM v2_contacted WHERE proposal_id = ? AND channel = 'EMAIL'").get(realProvider.proposalId).count, 0, 'real-provider preflight failure creates no CONTACTED');
env.MAGICSCRIPT_EMAIL_PROVIDER = 'fake';
process.env.MAGICSCRIPT_EMAIL_PROVIDER = 'fake';
eq(persistenceFailureDb.db.prepare('SELECT status FROM jobs WHERE id = ?').get(persistenceFailure.jobId).status, 'SEND_UNKNOWN', 'persistence failure remains isolated and unresolved');
eq(providerGateDb.db.prepare('SELECT status FROM jobs WHERE id = ?').get(gated.jobId).status, 'SENDING', 'provider gate fixture remains safely unsent');

globalThis.fetch = nativeFetch;
console.log(JSON.stringify({ ok: true, assertions, scenarios: ['success', 'duplicate', 'failure', 'failure-retry', 'persistence-failure', 'amen-provider-gate', 'fake-disabled-gate', 'test-disabled-gate', 'real-provider-branch'] }));
