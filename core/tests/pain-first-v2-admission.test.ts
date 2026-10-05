import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { projectPainFirstEvidenceToContactOpportunityPackV2, type PainFirstAgent1Evidence } from '../admission/pain-first-agent1-projection';
import { projectAgent1EvidenceToContactOpportunityPackV2 } from '../admission/agent1-evidence-projection';
import { admitContactOpportunityPack, InMemoryV2AdmissionStore, D1V2AdmissionStore } from '../admission/v2-admission';
import { normalizePack, type AdmissionResult, type ContactOpportunityPackV2 } from '../admission/contact-opportunity-pack';
import { decidePackIcp } from '../icp/icp-decision';
import { createDesignRequest } from '../design/design-request';
import { buildDeterministicArtifact } from '../design/design-artifact';
import { resolveLocalServicesFromOperatingFacts } from '../icp/local-service-archetypes';
import { extractDigitalPainEvidence } from '../research/digital-pain-evidence';
import { acceptPainFirstSearchCandidate, painFirstQueryPlans } from '../research/pain-first-staging';
import type { D1DatabaseLike, D1PreparedStatementLike } from '../persistence/d1-types';

const acquiredAt = '2026-10-01T10:00:00.000Z';
const observedAt = '2026-10-01T10:01:00.000Z';
const receivedAt = '2026-10-01T10:02:00.000Z';
const originalFetch = globalThis.fetch;
let externalCalls = 0;
before(() => { globalThis.fetch = async () => { externalCalls++; throw new Error('External operations forbidden'); }; });
after(() => { globalThis.fetch = originalFetch; assert.equal(externalCalls, 0); });

function fixture(host = 'cafe-alignment.example', condition: 'SITE_REBUILDING' | 'SITE_UNDER_CONSTRUCTION' = 'SITE_REBUILDING'): PainFirstAgent1Evidence {
  const url = `https://${host}/`;
  const plan = painFirstQueryPlans().find((item) => item.conditionClass === condition)!;
  const candidate = acceptPainFirstSearchCandidate({ schemaVersion: 1, queryPlanId: plan.planId,
    conditionClass: condition, providerClass: 'OFFLINE_FIXTURE', resultUrl: url, resultPosition: 1,
    acquiredAt, providerRunId: 'r62z-offline', authority: 'NONE' });
  assert.equal(candidate.state, 'URL_ACCEPTED');
  if (candidate.state !== 'URL_ACCEPTED') throw new Error('Fixture URL rejected');
  const source = { url, note: 'Accepted supplied owned homepage', supports: ['website', 'digitalGap'], observedAt };
  const html = condition === 'SITE_REBUILDING' ? '<h1>Site en cours de refonte</h1>' : '<title>Site en construction</title>';
  return { candidateId: host, candidate, evidence: {
    identity: { businessName: 'Café Alignment', city: 'Fort-de-France', location: 'Martinique', sourceRefs: [url] },
    classification: { commercialFamily: 'RESTAURANTS_BARS_CAFES', sourceRefs: [url] },
    research: { acceptedSources: [source], supportedClaims: ['website', 'digitalGap'],
      website: { status: 'VERIFIED_PRESENT', url },
      decisionAuthority: { isCentrallyManaged: false, hasLocalAuthority: true, observations: ['Supplied verified independent operator evidence'] },
      digitalPainEvidence: extractDigitalPainEvidence([source], [{ url, html, observedAt,
        snapshotDigest: `sha256:${createHash('sha256').update(html).digest('hex')}` }]),
    },
    contacts: [{ channel: 'EMAIL', value: `Owner@${host}`, sourceUrl: url, sourceType: 'OWNED_WEBSITE', validated: true, evidenceRef: url }],
  } };
}

function project(input = fixture()): ContactOpportunityPackV2 {
  const result = projectPainFirstEvidenceToContactOpportunityPackV2(input, receivedAt);
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status !== 'PROJECTABLE') throw new Error(JSON.stringify(result));
  return result.pack;
}

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

async function post(pack: unknown, db: FixtureD1) {
  // Keep the worker's web-platform compilation environment out of core's typecheck.
  const { default: worker } = await import(new URL('../../apps/api-worker/src/index.ts', import.meta.url).href);
  return worker.fetch(new Request('http://fixture.test/api/v2/admission', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer fixture-only' }, body: JSON.stringify(pack),
  }), { DB: db, MAGICSCRIPT_API_TOKEN: 'fixture-only', MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_AUTOPILOT_ENABLED: 'false', MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'false',
    MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false', MAGICSCRIPT_EMAIL_PROVIDER: 'disabled' });
}

test('PAIN_FIRST delegates to the existing Agent1 projection without fabricating evidence', () => {
  const input = fixture();
  const pack = project(input);
  const canonical = projectAgent1EvidenceToContactOpportunityPackV2({ ...input.evidence,
    prospectId: input.candidateId, qualified: false, qualificationState: 'OTHER' }, receivedAt);
  assert.equal(canonical.status, 'PROJECTABLE');
  if (canonical.status !== 'PROJECTABLE') return;
  assert.deepEqual(pack.identity, canonical.pack.identity);
  assert.deepEqual(pack.contacts, canonical.pack.contacts);
  assert.deepEqual(pack.opportunity, canonical.pack.opportunity);
  assert.equal(pack.schemaVersion, 'CONTACT_OPPORTUNITY_PACK_V2');
  assert.equal(decidePackIcp(pack).outcome, 'ADMIT');
});

test('authority alignment: supported family with absent authority is projectable without inventing independence', () => {
  for (const explicitUndefined of [false, true]) {
    const input = fixture();
    delete input.evidence.research.decisionAuthority;
    if (explicitUndefined) input.evidence.research.decisionAuthority = undefined;
    const pack = project(input);
    assert.equal(pack.opportunity.icp?.decisionAuthority, undefined);
    assert.equal(Object.hasOwn(pack.opportunity.icp!, 'decisionAuthority'), false);
    assert.equal(input.evidence.research.decisionAuthority, undefined);
    assert.equal(decidePackIcp(pack).outcome, 'ADMIT');
  }
});

test('family alignment: unresolved family and absent authority reach pure typed ICP without invented values', () => {
  const input = fixture();
  delete input.evidence.classification.commercialFamily;
  delete input.evidence.research.decisionAuthority;
  assert.ok(input.evidence.classification.sourceRefs.some((ref) => ref.trim()));
  const pack = project(input);
  assert.equal(Object.hasOwn(pack.opportunity.icp!, 'commercialFamily'), false);
  assert.equal(Object.hasOwn(pack.opportunity.icp!, 'decisionAuthority'), false);
  assert.equal(decidePackIcp(pack).outcome, 'ADMIT');
});

test('authority alignment: empty classification references fail before authority and pain checks', () => {
  for (const sourceRefs of [[], ['   ']]) {
    const input = fixture();
    input.evidence.classification.sourceRefs = sourceRefs;
    input.evidence.research.decisionAuthority = { isCentrallyManaged: true } as NonNullable<typeof input.evidence.research.decisionAuthority>;
    delete input.evidence.research.digitalPainEvidence;
    const result = projectPainFirstEvidenceToContactOpportunityPackV2(input, receivedAt);
    assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
    if (result.status !== 'INSUFFICIENT_EVIDENCE') throw new Error('Unexpected pack');
    assert.deepEqual(result.reasons, [{ code: 'COMMERCIAL_FAMILY_UNRESOLVED',
      detail: 'Supplied commercial-family evidence references are required.' }]);
    assert.equal('pack' in result, false);
  }
});

for (const [label, authority] of [
  ['null', null], ['empty object', {}],
  ['missing local authority', { isCentrallyManaged: true }],
  ['missing central status', { hasLocalAuthority: true }],
  ['nonboolean central status', { isCentrallyManaged: 'false', hasLocalAuthority: true }],
  ['nonboolean local authority', { isCentrallyManaged: true, hasLocalAuthority: 'true' }],
  ['null local authority', { isCentrallyManaged: true, hasLocalAuthority: null }],
  ['scalar', true], ['string', 'independent'], ['array', []],
  ['array with boolean fields', Object.assign([], { isCentrallyManaged: false, hasLocalAuthority: true })],
] as const) test(`authority alignment: supplied ${label} remains insufficient evidence`, () => {
  const input = fixture();
  input.evidence.research.decisionAuthority = authority as unknown as typeof input.evidence.research.decisionAuthority;
  const result = projectPainFirstEvidenceToContactOpportunityPackV2(input, receivedAt);
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status !== 'INSUFFICIENT_EVIDENCE') throw new Error('Unexpected pack');
  assert.deepEqual(result.reasons.map((reason) => reason.code), ['DECISION_AUTHORITY_UNRESOLVED']);
  assert.equal('pack' in result, false);
});

test('authority alignment: valid supplied authority and observations are forwarded unchanged', () => {
  for (const isCentrallyManaged of [false, true]) for (const hasLocalAuthority of [false, true]) {
    const input = fixture();
    const authority = { isCentrallyManaged, hasLocalAuthority, observations: ['Supplied chain/franchise evidence'] };
    input.evidence.research.decisionAuthority = authority;
    const before = structuredClone(authority);
    assert.strictEqual(project(input).opportunity.icp?.decisionAuthority, authority);
    assert.deepEqual(authority, before);
  }
});

test('authority alignment: central true and local false remain rejected by decidePackIcp', () => {
  const input = fixture();
  input.evidence.research.decisionAuthority = { isCentrallyManaged: true, hasLocalAuthority: false };
  const decision = decidePackIcp(project(input));
  assert.equal(decision.outcome, 'REJECT');
  assert.equal(decision.reasonCode, 'NO_LOCAL_DECISION_AUTHORITY');
});

for (const [label, alter, outcome, reasonCode] of [
  ['capability', (x: PainFirstAgent1Evidence) => { x.evidence.research.requiresUnprovenCapability = true; }, 'CAPABILITY_GATED', 'UNPROVEN_REQUIRED_CAPABILITY'],
  ['quality', (x: PainFirstAgent1Evidence) => { x.evidence.research.websiteQuality = { isProfessional: true }; }, 'QUALITY_GATED', 'WEBSITE_QUALITY_GATE_CLOSED'],
  ['exclusion', (x: PainFirstAgent1Evidence) => { x.evidence.research.outsideCommercialIcp = true; }, 'REJECT', 'OUTSIDE_COMMERCIAL_ICP'],
  ['contactability', (x: PainFirstAgent1Evidence) => { x.evidence.contacts = []; }, 'NEEDS_CONTACT_DISCOVERY', 'NO_QUALIFYING_CONTACT'],
] as const) test(`authority alignment: central true and local true still face the ${label} gate`, () => {
  const input = fixture();
  input.evidence.research.decisionAuthority = { isCentrallyManaged: true, hasLocalAuthority: true };
  assert.equal(decidePackIcp(project(input)).outcome, 'ADMIT');
  alter(input);
  const decision = decidePackIcp(project(input));
  assert.equal(decision.outcome, outcome);
  assert.equal(decision.reasonCode, reasonCode);
});

for (const [label, alter, reasonCode] of [
  ['typed pain removed', (x: PainFirstAgent1Evidence) => { delete x.evidence.research.digitalPainEvidence; }, 'DIGITAL_PAIN_UNPROVEN'],
  ['accepted pain source removed', (x: PainFirstAgent1Evidence) => { x.evidence.research.acceptedSources = []; }, 'DIGITAL_PAIN_UNPROVEN'],
  ['contact validation removed', (x: PainFirstAgent1Evidence) => { x.evidence.contacts = x.evidence.contacts.map((contact) => ({ ...contact, validated: false })); }, 'CONTACT_EVIDENCE_UNVALIDATED'],
  ['contact evidence removed', (x: PainFirstAgent1Evidence) => { x.evidence.contacts = x.evidence.contacts.map((contact) => ({ ...contact, evidenceRef: undefined })); }, 'CONTACT_EVIDENCE_UNVALIDATED'],
] as const) test(`authority alignment: absent authority with ${label} still blocks projection`, () => {
  const input = fixture();
  delete input.evidence.research.decisionAuthority;
  alter(input);
  const result = projectPainFirstEvidenceToContactOpportunityPackV2(input, receivedAt);
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status !== 'INSUFFICIENT_EVIDENCE') throw new Error('Unexpected pack');
  assert.deepEqual(result.reasons.map((reason) => reason.code), [reasonCode]);
  assert.equal('pack' in result, false);
});

for (const [label, channel, value] of [
  ['invalid email', 'EMAIL', 'ask the owner'],
  ['landline mislabeled MOBILE', 'MOBILE', '0596511236'],
] as const) test(`authority alignment: absent authority does not qualify ${label}`, () => {
  const input = fixture();
  delete input.evidence.research.decisionAuthority;
  input.evidence.contacts = [{ channel, value, validated: true, evidenceRef: input.candidate.homepageUrl }];
  const decision = decidePackIcp(project(input));
  assert.equal(decision.outcome, 'NEEDS_CONTACT_DISCOVERY');
  assert.equal(decision.reasonCode, 'NO_QUALIFYING_CONTACT');
});

for (const [label, ids] of [
  ['both IDs', { siren: '123456782', siret: '12345678200002' }],
  ['no SIREN', { siret: '12345678200002' }],
  ['no SIRET', { siren: '123456782' }],
  ['neither ID', {}],
] as const) test(`${label}: canonical primitive and existing route admit INGESTED with contacts, metadata and normal handoff`, async () => {
  const input = fixture(); Object.assign(input.evidence.identity, ids);
  const pack = project(input);
  const primitive = await admitContactOpportunityPack(pack, new InMemoryV2AdmissionStore(), receivedAt);
  assert.equal(primitive.admitted, true); assert.equal(primitive.state, 'INGESTED');
  const db = new FixtureD1();
  try {
    const response = await post(pack, db); assert.equal(response.status, 201, await response.clone().text());
    const admission = await response.json() as AdmissionResult;
    assert.equal(admission.state, 'INGESTED');
    const id = admission.canonicalProspectId!;
    const row = db.database.prepare('SELECT state, siren, siret, v2_domain FROM prospects WHERE id = ?').get(id)!;
    assert.equal(row.state, 'INGESTED'); assert.equal(row.siren, pack.identity.siren ?? null); assert.equal(row.siret, pack.identity.siret ?? null);
    assert.equal(row.v2_domain, 'cafe-alignment.example');
    const contacts = db.database.prepare('SELECT * FROM v2_admission_contacts WHERE prospect_id = ?').all(id);
    assert.equal(contacts.length, 1); assert.equal(contacts[0].normalized_value, 'owner@cafe-alignment.example');
    assert.equal(contacts[0].validation_status, 'DERIVED_VALID'); assert.equal(contacts[0].source_url, input.candidate.homepageUrl);
    const metadata = db.database.prepare('SELECT * FROM v2_admissions WHERE prospect_id = ?').get(id)!;
    assert.equal(metadata.pack_id, pack.packId); assert.equal(metadata.schema_version, pack.schemaVersion);
    assert.equal(metadata.result, 'ADMITTED'); assert.equal(metadata.reason_code, 'ADMITTED');
    const request = JSON.parse(db.database.prepare('SELECT request_json FROM v2_design_requests WHERE prospect_id = ?').get(id)!.request_json as string);
    assert.equal(request.identity.siren, pack.identity.siren); assert.equal(request.identity.siret, pack.identity.siret);
    assert.ok(request.designInput.evidence[0].note.includes('"sourcingLane":"PAIN_FIRST"'));
    const provenance = JSON.parse(pack.source.provenance);
    assert.equal(provenance.stagedWebsiteUrl, input.candidate.homepageUrl); assert.equal(provenance.acquiredAt, acquiredAt);
    assert.equal(provenance.digitalPainEvidence[0].observedCondition, 'SITE_REBUILDING');
    assert.equal(provenance.digitalPainEvidence[0].observedAt, observedAt);
    assert.equal(provenance.digitalPainEvidence[0].snapshotDigest, input.evidence.research.digitalPainEvidence!.observations[0].snapshotDigest);
    const jobs = db.database.prepare('SELECT kind FROM jobs').all();
    assert.deepEqual(jobs.map((job) => job.kind), ['V2_DESIGN_REQUEST']);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM active_production_slots WHERE prospect_id = ?').get(id)!.total, 1);
    const persisted = await new D1V2AdmissionStore(db).getByProspectId(id);
    assert.equal(persisted?.packId, pack.packId); assert.equal(persisted?.contacts[0].normalizedValue, 'owner@cafe-alignment.example');
    assert.equal((await post(pack, db)).status, 422);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM jobs').get()!.total, 1);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM active_production_slots WHERE prospect_id = ?').get(id)!.total, 1);
  } finally { db.close(); }
});

for (const [label, channel, value, qualifies] of [
  ['EMAIL', 'EMAIL', 'contact@offline.example', true],
  ['MOBILE', 'MOBILE', '+596696123456', true],
  ['landline', 'LANDLINE', '0596511236', false],
  ['contact form', 'CONTACT_FORM', 'https://offline.example/contact', false],
  ['social', 'INSTAGRAM', '@offline', false],
  ['WhatsApp marker', 'WHATSAPP', 'WhatsApp available', false],
  ['WhatsApp mobile without MOBILE record', 'WHATSAPP', '+596696123456', false],
  ['free-text EMAIL', 'EMAIL', 'ask the owner', false],
  ['landline mislabeled MOBILE', 'MOBILE', '0596511236', false],
] as const) test(`${label}: canonical contact gate is preserved`, async () => {
  const input = fixture(); input.evidence.contacts = [{ channel, value, validated: true, evidenceRef: 'supplied-contact' }];
  const pack = project(input); const db = new FixtureD1();
  try {
    const response = await post(pack, db);
    assert.equal(response.status, qualifies ? 201 : 422, await response.clone().text());
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM prospects').get()!.total, qualifies ? 1 : 0);
    if (qualifies && channel === 'MOBILE') assert.equal(normalizePack(pack).contacts[0].phoneType, 'MOBILE');
  } finally { db.close(); }
});

test('no qualifying contact cannot create a prospect or job', async () => {
  const input = fixture(); input.evidence.contacts = [];
  const db = new FixtureD1(); try {
    assert.equal((await post(project(input), db)).status, 422);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM prospects').get()!.total, 0);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM jobs').get()!.total, 0);
  } finally { db.close(); }
});

for (const [label, alter] of [
  ['outside ICP', (x: PainFirstAgent1Evidence) => { x.evidence.research.outsideCommercialIcp = true; }],
  ['central authority', (x: PainFirstAgent1Evidence) => { x.evidence.research.decisionAuthority = { isCentrallyManaged: true, hasLocalAuthority: false }; }],
  ['professional quality', (x: PainFirstAgent1Evidence) => { x.evidence.research.websiteQuality = { isProfessional: true }; }],
  ['unproven capability', (x: PainFirstAgent1Evidence) => { x.evidence.research.requiresUnprovenCapability = true; }],
  ['retail without official NAF', (x: PainFirstAgent1Evidence) => { x.evidence.classification.commercialFamily = 'LOCAL_RETAIL'; }],
] as const) test(`${label}: non-ADMIT cannot cross existing boundary`, async () => {
  const input = fixture(); alter(input); const pack = project(input);
  assert.notEqual(decidePackIcp(pack).outcome, 'ADMIT');
  const store = new InMemoryV2AdmissionStore(); assert.equal((await admitContactOpportunityPack(pack, store)).admitted, false);
  const db = new FixtureD1(); try {
    assert.equal((await post(pack, db)).status, 422);
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM prospects').get()!.total, 0);
  } finally { db.close(); }
});

for (const [label, alter] of [
  ['canonical pain missing', (x: PainFirstAgent1Evidence) => { x.evidence.research.digitalPainEvidence = undefined; x.evidence.research.digitalPainSignals = ['PAIN_SIGNAL_CONFIRMED']; }],
  ['family references missing', (x: PainFirstAgent1Evidence) => { x.evidence.classification.sourceRefs = []; }],
  ['identity references missing', (x: PainFirstAgent1Evidence) => { x.evidence.identity.sourceRefs = []; }],
  ['unvalidated contact', (x: PainFirstAgent1Evidence) => { x.evidence.contacts = [{ channel: 'EMAIL', value: 'a@offline.example', validated: false, evidenceRef: 'source' }]; }],
  ['contact evidence missing', (x: PainFirstAgent1Evidence) => { x.evidence.contacts = [{ channel: 'EMAIL', value: 'a@offline.example', validated: true }]; }],
  ['website differs', (x: PainFirstAgent1Evidence) => { x.evidence.research.website = { status: 'VERIFIED_PRESENT', url: 'https://other.example/' }; }],
  ['copied acceptance', (x: PainFirstAgent1Evidence) => { x.candidate = { ...x.candidate }; }],
] as const) test(`${label}: missing evidence is never invented`, () => {
  const input = fixture(); alter(input);
  assert.equal(projectPainFirstEvidenceToContactOpportunityPackV2(input, receivedAt).status, 'INSUFFICIENT_EVIDENCE');
});

test('pack stripped of typed ICP is rejected by the existing route', async () => {
  const pack = project(); delete pack.opportunity.icp;
  const db = new FixtureD1(); try {
    const response = await post(pack, db); assert.equal(response.status, 422);
    assert.equal((await response.json() as { reasonCode: string }).reasonCode, 'NO_ICP_EVIDENCE');
    assert.equal(db.database.prepare('SELECT count(*) AS total FROM prospects').get()!.total, 0);
  } finally { db.close(); }
});

for (const key of ['domain', 'EMAIL', 'MOBILE'] as const) test(`${key} exact normalized dedup without IDs is preserved in memory and D1`, async () => {
  const first = project(fixture('first.example')); const second = project(fixture('second.example'));
  if (key === 'domain') second.identity.websiteUrl = 'https://www.first.example/';
  if (key === 'EMAIL') { first.contacts = [{ channel: 'EMAIL', value: ' Owner@Same.example ' }]; second.contacts = [{ channel: 'EMAIL', value: 'owner@same.example' }]; }
  if (key === 'MOBILE') { first.contacts = [{ channel: 'MOBILE', value: '+596 696 12 34 56' }]; second.contacts = [{ channel: 'MOBILE', value: '0696123456' }]; }
  const db = new FixtureD1(); try {
    for (const store of [new InMemoryV2AdmissionStore(), new D1V2AdmissionStore(db)]) {
      const admitted = await admitContactOpportunityPack(first, store, receivedAt); assert.equal(admitted.admitted, true);
      const duplicate = await admitContactOpportunityPack(second, store, receivedAt);
      assert.equal(duplicate.reasonCode, 'DUPLICATE'); assert.equal(duplicate.canonicalProspectId, admitted.canonicalProspectId);
    }
  } finally { db.close(); }
});

test('similar business names alone do not dedup', async () => {
  const first = project(fixture('one.example')); const second = project(fixture('two.example'));
  second.identity.businessName += 's';
  const db = new FixtureD1(); try {
    for (const store of [new InMemoryV2AdmissionStore(), new D1V2AdmissionStore(db)]) {
      assert.equal((await admitContactOpportunityPack(first, store)).admitted, true);
      assert.equal((await admitContactOpportunityPack(second, store)).admitted, true);
    }
  } finally { db.close(); }
});

test('construction evidence uses the same canonical bridge', () => {
  const pack = project(fixture('construction.example', 'SITE_UNDER_CONSTRUCTION'));
  assert.equal(decidePackIcp(pack).outcome, 'ADMIT');
  assert.equal(JSON.parse(pack.source.provenance).digitalPainEvidence[0].observedCondition, 'SITE_UNDER_CONSTRUCTION');
});

for (const scenario of ['canonical slot', 'missing slot', 'unrelated job'] as const) test(`PAIN_FIRST first design runner claim: ${scenario}`, async () => {
  const db = new FixtureD1();
  try {
    const response = await post(project(), db);
    assert.equal(response.status, 201, await response.clone().text());
    const id = (await response.json() as AdmissionResult).canonicalProspectId!;
    if (scenario === 'missing slot') db.database.prepare('UPDATE active_production_slots SET prospect_id = NULL, acquired_at = NULL WHERE prospect_id = ?').run(id);
    if (scenario === 'unrelated job') db.database.prepare("UPDATE jobs SET kind = 'BUILD_PROTOTYPE' WHERE prospect_id = ?").run(id);
    const { default: worker } = await import(new URL('../../apps/api-worker/src/index.ts', import.meta.url).href);
    const claim = await worker.fetch(new Request('http://fixture.test/api/runner/jobs/claim', {
      method: 'POST', headers: { authorization: 'Bearer fixture-only', 'x-magicscript-runner-id': 'offline-slot-proof', 'x-magicscript-stack-id': 'offline-stack' },
    }), { DB: db, MAGICSCRIPT_API_TOKEN: 'fixture-only', MAGICSCRIPT_STACK_ID: 'offline-stack', MAGICSCRIPT_SENDING_ENABLED: 'false',
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'false', MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'false',
      MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false', MAGICSCRIPT_EMAIL_PROVIDER: 'disabled' });
    assert.equal(claim.status, scenario === 'canonical slot' ? 200 : 409, await claim.clone().text());
    const job = db.database.prepare('SELECT kind, status, attempts FROM jobs WHERE prospect_id = ?').get(id)!;
    assert.equal(job.status, scenario === 'canonical slot' ? 'RUNNING' : 'PENDING');
    assert.equal(job.attempts, scenario === 'canonical slot' ? 1 : 0);
    assert.equal(db.database.prepare('SELECT state FROM prospects WHERE id = ?').get(id)!.state, 'INGESTED');
    if (scenario === 'canonical slot') assert.equal(job.kind, 'V2_DESIGN_REQUEST');
    else assert.equal((await claim.json() as { reason: string }).reason, 'ACTIVE_PRODUCTION_SLOT_REQUIRED');
  } finally { db.close(); }
});

function unresolvedFamilyFixture(): PainFirstAgent1Evidence {
  const input = fixture('holiday-house.example');
  input.evidence.identity.businessName = 'Maison Horizon';
  input.evidence.classification = { sourceRefs: [] };
  delete input.evidence.research.decisionAuthority;
  input.evidence.research.operatingModel = 'OTHER';
  input.evidence.research.acceptedSources = input.evidence.research.acceptedSources.map((source) => ({
    ...source, note: 'Supplied first-party activity: holiday-stay house rental. Rebuilding notice; clearer offer and contact journey provide website value.',
    supports: [...source.supports, 'activity'],
  }));
  input.evidence.research.supportedClaims = [...input.evidence.research.supportedClaims, 'activity'];
  return input;
}

test('family alignment: observed holiday-stay activity without taxonomy projects without classification, legal IDs or authority', () => {
  const input = unresolvedFamilyFixture();
  const before = structuredClone(input.evidence);
  const pack = project(input);
  assert.equal(decidePackIcp(pack).outcome, 'ADMIT');
  assert.equal(Object.hasOwn(pack.opportunity.icp!, 'commercialFamily'), false);
  assert.equal(Object.hasOwn(pack.opportunity.icp!, 'decisionAuthority'), false);
  assert.equal(Object.hasOwn(pack.identity, 'siren'), false);
  assert.equal(Object.hasOwn(pack.identity, 'siret'), false);
  assert.equal(pack.opportunity.icp?.outsideCommercialIcp, false);
  assert.equal(pack.opportunity.icp?.requiresUnprovenCapability, false);
  assert.ok(pack.evidence?.[0].supports.includes('activity'));
  assert.deepEqual(input.evidence, before);
});

test('family alignment: NAF 55.20Z with observed OTHER model carries no fabricated supported family', () => {
  const input = unresolvedFamilyFixture();
  input.evidence.classification = { nafCode: '55.20Z', sourceRefs: [input.candidate.homepageUrl] };
  const pack = project(input);
  assert.equal(pack.opportunity.icp?.nafCode, '55.20Z');
  assert.equal(Object.hasOwn(pack.opportunity.icp!, 'commercialFamily'), false);
  assert.equal(decidePackIcp(pack).outcome, 'ADMIT');
});

test('family alignment: 55.20Z unknown operating-model protection is unchanged', () => {
  const input = unresolvedFamilyFixture();
  input.evidence.classification = { nafCode: '55.20Z', sourceRefs: [input.candidate.homepageUrl] };
  input.evidence.research.operatingModel = 'UNKNOWN';
  const result = projectPainFirstEvidenceToContactOpportunityPackV2(input, receivedAt);
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status !== 'INSUFFICIENT_EVIDENCE') throw new Error('Unexpected pack');
  assert.deepEqual(result.reasons.map((reason) => reason.code), ['OPERATING_MODEL_UNRESOLVED']);
});

for (const commercialFamily of ['RESTAURANTS_BARS_CAFES', 'BEAUTY_HAIR_BARBER', 'LOCAL_RETAIL', 'LOCAL_SERVICES'] as const)
test(`family alignment: supported ${commercialFamily} remains identical to default Agent1 projection`, () => {
  const input = fixture();
  input.evidence.classification.commercialFamily = commercialFamily;
  if (commercialFamily === 'LOCAL_RETAIL') input.evidence.classification.nafCode = '47.78C';
  const canonical = projectAgent1EvidenceToContactOpportunityPackV2({ ...input.evidence,
    prospectId: input.candidateId, qualified: false, qualificationState: 'OTHER' }, receivedAt);
  assert.equal(canonical.status, 'PROJECTABLE');
  if (canonical.status !== 'PROJECTABLE') throw new Error('Canonical fixture rejected');
  const pack = project(input);
  assert.deepEqual(pack.opportunity, canonical.pack.opportunity);
  assert.equal(pack.opportunity.icp?.commercialFamily, commercialFamily);
  assert.equal(decidePackIcp(pack).outcome, 'ADMIT');
});

test('family alignment: default Agent1 callers retain unresolved-family rejection', () => {
  const input = unresolvedFamilyFixture();
  const result = projectAgent1EvidenceToContactOpportunityPackV2({ ...input.evidence,
    prospectId: input.candidateId, qualified: false, qualificationState: 'OTHER' }, receivedAt);
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status !== 'INSUFFICIENT_EVIDENCE') throw new Error('Unexpected default pack');
  assert.deepEqual(result.reasons.map((reason) => reason.code), ['COMMERCIAL_FAMILY_UNRESOLVED']);
});

test('family alignment: unknown or legacy labels never become a supported family', () => {
  for (const commercialFamily of ['UNKNOWN', 'OTHER', 'HOSPITALITY', 'HOLIDAY_RENTAL']) {
    const input = unresolvedFamilyFixture();
    input.evidence.classification = { commercialFamily, sourceRefs: [input.candidate.homepageUrl] };
    const pack = project(input);
    assert.equal(Object.hasOwn(pack.opportunity.icp!, 'commercialFamily'), false);
    assert.equal(decidePackIcp(pack).outcome, 'ADMIT');
  }
});

for (const [label, alter, outcome, reasonCode] of [
  ['explicit exclusion', (x: PainFirstAgent1Evidence) => { x.evidence.research.outsideCommercialIcp = true; }, 'REJECT', 'OUTSIDE_COMMERCIAL_ICP'],
  ['evidenced Airbnb dependence', (x: PainFirstAgent1Evidence) => {
    x.evidence.research.operatingModel = 'SEASONAL_AIRBNB_RENTAL';
    x.evidence.research.acceptedSources = x.evidence.research.acceptedSources.map((source) => ({ ...source,
      note: 'Supplied first-party evidence: seasonal rental exclusively booked through Airbnb.' }));
  }, 'REJECT', 'OUTSIDE_COMMERCIAL_ICP'],
  ['evidenced Booking dependence', (x: PainFirstAgent1Evidence) => {
    x.evidence.research.operatingModel = 'SEASONAL_AIRBNB_RENTAL';
    x.evidence.research.acceptedSources = x.evidence.research.acceptedSources.map((source) => ({ ...source,
      note: 'Supplied first-party evidence: seasonal rental exclusively booked through Booking.' }));
  }, 'REJECT', 'OUTSIDE_COMMERCIAL_ICP'],
  ['unproven booking capability', (x: PainFirstAgent1Evidence) => { x.evidence.research.requiresUnprovenCapability = true; }, 'CAPABILITY_GATED', 'UNPROVEN_REQUIRED_CAPABILITY'],
  ['professional quality', (x: PainFirstAgent1Evidence) => { x.evidence.research.websiteQuality = { isProfessional: true }; }, 'QUALITY_GATED', 'WEBSITE_QUALITY_GATE_CLOSED'],
  ['central without local authority', (x: PainFirstAgent1Evidence) => { x.evidence.research.decisionAuthority = { isCentrallyManaged: true, hasLocalAuthority: false }; }, 'REJECT', 'NO_LOCAL_DECISION_AUTHORITY'],
] as const) test(`family alignment: unresolved family cannot override ${label}`, async () => {
  const input = unresolvedFamilyFixture(); alter(input);
  const pack = project(input);
  assert.equal(Object.hasOwn(pack.opportunity.icp!, 'commercialFamily'), false);
  const decision = decidePackIcp(pack);
  assert.equal(decision.outcome, outcome);
  assert.equal(decision.reasonCode, reasonCode);
  // Fail before even reading an admission store, with no database or prospect writes.
  const result = await admitContactOpportunityPack(pack, {
    findDuplicate: async () => { throw new Error('Unexpected admission store access'); },
    create: async () => { throw new Error('Unexpected prospect creation'); },
    getByProspectId: async () => { throw new Error('Unexpected admission store access'); },
  }, receivedAt);
  assert.equal(result.admitted, false);
});

for (const [label, channel, value, qualifies] of [
  ['valid EMAIL', 'EMAIL', 'contact@holiday-house.example', true],
  ['valid MOBILE', 'MOBILE', '+596696123456', true],
  ['landline only', 'LANDLINE', '+596596511236', false],
  ['WhatsApp marker', 'WHATSAPP', 'WhatsApp available', false],
  ['WhatsApp mobile without MOBILE', 'WHATSAPP', '+596696123456', false],
  ['invalid EMAIL', 'EMAIL', 'ask owner', false],
] as const) test(`family alignment: unresolved family preserves ${label} contact gate`, () => {
  const input = unresolvedFamilyFixture();
  input.evidence.contacts = [{ channel, value, validated: true, evidenceRef: input.candidate.homepageUrl }];
  const decision = decidePackIcp(project(input));
  assert.equal(decision.outcome, qualifies ? 'ADMIT' : 'NEEDS_CONTACT_DISCOVERY');
  assert.equal(decision.reasonCode, qualifies ? 'SUPPORTED_EASY_WIN' : 'NO_QUALIFYING_CONTACT');
});

test('family alignment: unresolved family preserves valid authority and rejects malformed supplied authority', () => {
  for (const authority of [{}, { isCentrallyManaged: false }, { isCentrallyManaged: false, hasLocalAuthority: 'true' }, null, []]) {
    const input = unresolvedFamilyFixture();
    input.evidence.research.decisionAuthority = authority as unknown as typeof input.evidence.research.decisionAuthority;
    const result = projectPainFirstEvidenceToContactOpportunityPackV2(input, receivedAt);
    assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
    if (result.status !== 'INSUFFICIENT_EVIDENCE') throw new Error('Unexpected pack');
    assert.deepEqual(result.reasons.map((reason) => reason.code), ['DECISION_AUTHORITY_UNRESOLVED']);
  }
  const input = unresolvedFamilyFixture();
  const authority = { isCentrallyManaged: true, hasLocalAuthority: true, observations: ['Supplied local authority'] };
  input.evidence.research.decisionAuthority = authority;
  const pack = project(input);
  assert.strictEqual(pack.opportunity.icp?.decisionAuthority, authority);
  assert.equal(decidePackIcp(pack).outcome, 'ADMIT');
});

test('family alignment: unresolved family cannot replace accepted digital pain/value evidence', () => {
  const input = unresolvedFamilyFixture();
  delete input.evidence.research.digitalPainEvidence;
  input.evidence.research.digitalPainSignals = ['Website could be better'];
  const result = projectPainFirstEvidenceToContactOpportunityPackV2(input, receivedAt);
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status !== 'INSUFFICIENT_EVIDENCE') throw new Error('Unexpected pack');
  assert.deepEqual(result.reasons.map((reason) => reason.code), ['DIGITAL_PAIN_UNPROVEN']);
});

test('family alignment: LOCAL_RETAIL without official NAF remains rejected', () => {
  const input = unresolvedFamilyFixture();
  input.evidence.classification = { commercialFamily: 'LOCAL_RETAIL', sourceRefs: [input.candidate.homepageUrl] };
  assert.equal(decidePackIcp(project(input)).reasonCode, 'LOCAL_RETAIL_FAIL_CLOSED');
});

test('family alignment: LOCAL_SERVICES remains a bounded archetype resolver, never an accommodation alias', () => {
  for (const value of ['auto-école', 'installation électrique', 'photographe de mariage', 'climatisation', 'paysagiste']) {
    assert.equal(resolveLocalServicesFromOperatingFacts([{ kind: 'SERVICE_TYPE', value, evidenceType: 'JSON_LD' }]), 'LOCAL_SERVICES');
  }
  for (const value of ['holiday-stay villa rental', 'Airbnb seasonal rental', 'unknown service', 'restaurant', 'salon de beauté']) {
    assert.equal(resolveLocalServicesFromOperatingFacts([{ kind: 'SERVICE_TYPE', value, evidenceType: 'JSON_LD' }]), undefined);
  }
});

test('family alignment: pure design request and artifact accept existing neutral design vertical', () => {
  const pack = project(unresolvedFamilyFixture());
  const request = createDesignRequest('fixture-design-only', normalizePack(pack), receivedAt);
  assert.equal(request.designInput.businessVertical, 'GENERAL_LOCAL_BUSINESS');
  const artifact = buildDeterministicArtifact(request, receivedAt);
  assert.equal(artifact.verticalProfile, 'GENERAL_LOCAL_BUSINESS');
  assert.equal(Object.hasOwn(pack.opportunity.icp!, 'commercialFamily'), false);
});
