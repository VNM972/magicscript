import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import worker from './index.ts';
import { admitContactOpportunityPack, D1V2AdmissionStore } from '../../../core/admission/v2-admission.ts';
import { decidePackIcp } from '../../../core/icp/icp-decision.ts';
import { createDesignHandoff } from '../../../core/design/design-handoff.ts';
import { buildDeterministicArtifact, validateDesignArtifact } from '../../../core/design/design-artifact.ts';
import { D1DesignRequestStore } from '../../../core/persistence/d1-design-request-store.ts';
import { D1ProspectRepository } from '../../../core/persistence/d1-prospect-repository.ts';
import { InMemoryJobQueue } from '../../../core/jobs/in-memory-queue.ts';
import { extractDigitalPainEvidence } from '../../../core/research/digital-pain-evidence.ts';
import { prospectToCallCopilotContext } from '../../../core/orchestrator/call-copilot.ts';
import { resolveProposalBookingAuthority } from '../../../core/proposal/booking-runtime.ts';
import qaSurface from '../../../scripts/qa-surface.cjs';

const now = '2026-10-01T10:00:00.000Z';
const meetingAt = '2026-10-10T14:00:00.000Z';
const originalFetch = globalThis.fetch;
let externalCalls = 0;
before(() => { globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname === '127.0.0.1') return originalFetch(input, options);
  externalCalls++;
  throw new Error('External request forbidden in Deck fixtures');
}; });
after(() => { globalThis.fetch = originalFetch; assert.equal(externalCalls, 0); });

class FixtureD1 {
  database = new DatabaseSync(':memory:');
  constructor() { this.database.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8')); }
  prepare(sql) {
    let values = [];
    const statement = {
      bind: (...args) => { values = args; return statement; },
      first: async () => this.database.prepare(sql).get(...values) ?? null,
      all: async () => ({ results: this.database.prepare(sql).all(...values) }),
      run: async () => { this.database.prepare(sql).run(...values); return { success: true }; },
    };
    return statement;
  }
  changes() { return this.database.prepare('SELECT total_changes() AS count').get().count; }
  close() { this.database.close(); }
}

function pack(context = 'Independent accommodation with direct enquiries', family) {
  const url = 'https://deck-fixture.example/';
  const source = { url, note: 'Supplied owned homepage notice', supports: ['website', 'digitalGap'], observedAt: now };
  const html = '<h1>Site en cours de refonte</h1>';
  const pain = extractDigitalPainEvidence([source], [{ url, html, observedAt: now,
    snapshotDigest: `sha256:${createHash('sha256').update(html).digest('hex')}` }]);
  assert.equal(pain.status, 'VERIFIED');
  return {
    schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2', packId: 'pack-deck-fixture',
    source: { agent: 'AGENT_1', provenance: 'offline-deck-fixture', receivedAt: now },
    identity: { businessName: 'Independent Deck Fixture', websiteUrl: url, city: 'Fort-de-France', location: 'Martinique' },
    contacts: [{ channel: 'EMAIL', value: 'owner@deck-fixture.example', sourceUrl: url, sourceType: 'OWNED_WEBSITE' }],
    opportunity: { observedOpportunity: 'Restore the direct enquiry journey', digitalFriction: pain.observations[0].observation,
      businessContext: context, icp: { hasWebsite: true, digitalPainSignals: [pain.observations[0].observation],
        requiresUnprovenCapability: false, ...(family ? { commercialFamily: family } : {}) } },
    evidence: [source],
  };
}

const envFor = db => ({ DB: db, MAGICSCRIPT_API_TOKEN: 'fixture-only', MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
  MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'false', MAGICSCRIPT_SENDING_ENABLED: 'false',
  MAGICSCRIPT_EMAIL_PROVIDER: 'disabled', MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false' });
async function get(db, path = '/api/v2/deck') {
  const changes = db.changes();
  const response = await worker.fetch(new Request(`http://fixture.test${path}`, {
    headers: { authorization: 'Bearer fixture-only' },
  }), envFor(db));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(db.changes(), changes, 'Deck/context reads must not mutate fixture data');
  return result;
}

async function seed(db, input = pack(), { proposal = true, booked = false } = {}) {
  assert.equal(decidePackIcp(input).outcome, 'ADMIT');
  const admission = await admitContactOpportunityPack(input, new D1V2AdmissionStore(db), now);
  assert.equal(admission.admitted, true);
  const id = admission.canonicalProspectId;
  const handoff = await createDesignHandoff(id, admission.normalizedPack, {
    prospects: new D1ProspectRepository(db), requests: new D1DesignRequestStore(db), jobs: new InMemoryJobQueue(),
    now: () => new Date(now),
  });
  assert.equal(handoff.job.kind, 'V2_DESIGN_REQUEST');
  const design = validateDesignArtifact(buildDeterministicArtifact(handoff.request, now), handoff.request);
  // Required downstream data already exists; these rows are fixtures, not new lifecycle behavior.
  db.database.prepare('UPDATE prospects SET state = ?, phone = ? WHERE id = ?')
    .run(booked ? 'MEETING_BOOKED' : 'PROTOTYPE_DEPLOYED', '+596696123456', id);
  db.database.prepare('INSERT INTO contacts (id, prospect_id, email, is_validated, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)')
    .run('fixture-email', id, input.contacts[0].value, now, now);
  if (!booked) db.database.prepare('UPDATE active_production_slots SET prospect_id = ?, acquired_at = ? WHERE slot_id = 1').run(id, now);
  const proposalValue = {
    id: 'proposal-fixture', version: 'PROPOSAL_V1', prospectId: id, designRequestId: handoff.request.id,
    approvedDesignArtifactId: design.id, approvedDesignRevision: 1, buildArtifactId: 'build-fixture', buildRevision: 1,
    visualQaReportId: 'qa-fixture', token: 'fixture-token', entryPath: '/p/fixture-token', status: 'PROPOSAL_READY', createdAt: now,
    booking: { availabilityPath: '/api/public/proposals/fixture-token/availability', bookingPath: '/api/public/proposals/fixture-token/booking' },
    tracking: { sessionCookie: 'fixture-cookie', events: ['PROPOSAL_VIEWED', 'RETURN_VISIT', 'SHARE_CLICKED'] },
  };
  if (proposal) db.database.prepare('INSERT INTO v2_proposals (id, canonical_key, prospect_id, build_artifact_id, token, status, proposal_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(proposalValue.id, 'build-fixture:PROPOSAL_V1', id, proposalValue.buildArtifactId, proposalValue.token, proposalValue.status, JSON.stringify(proposalValue), now);
  if (booked) db.database.prepare('INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('meeting-fixture', id, 'fixture', 'commercial.meeting_booked', JSON.stringify({ bookingId: 'booking-fixture', scheduledAt: meetingAt }), now);
  return { input, admission, request: handoff.request, design, proposal: proposalValue, id };
}

function expectedItem(fixture, vertical, booked = false) {
  return {
    entry_source: 'V2_PIPELINE', demo_url: null, demo_ready: false,
    prospectId: fixture.id, businessName: fixture.input.identity.businessName, location: 'Fort-de-France', vertical,
    opportunity: fixture.input.opportunity.businessContext, friction: fixture.input.opportunity.digitalFriction,
    contactability: { label: 'Email + Mobile', email: 'owner@deck-fixture.example', mobile: '+596696123456' },
    commercialStage: booked ? 'RDV' : 'A_CONTACTER', currentMeaningfulState: booked ? 'MEETING_BOOKED' : 'PROTOTYPE_DEPLOYED',
    activeSlot: !booked, productionEligible: !booked,
    proposal: { id: 'proposal-fixture', entryPath: '/p/fixture-token', readyAt: now },
    engagement: { viewed: false, returned: false, shared: false, meetingBooked: booked, meetingAt: booked ? meetingAt : null },
  };
}

test('entry source migration preserves existing rows and constrains manual readiness', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE prospects (id TEXT PRIMARY KEY, state TEXT); INSERT INTO prospects VALUES ('kept', 'DO_NOT_CONTACT')");
    const original = db.prepare('SELECT id, state FROM prospects').all();
    db.exec(readFileSync(new URL('../../../database/migration-v2-entry-source-demo-ready-v1.sql', import.meta.url), 'utf8'));
    assert.deepEqual(db.prepare('SELECT id, state FROM prospects').all(), original);
    assert.deepEqual({ ...db.prepare('SELECT entry_source, demo_url, demo_ready FROM prospects').get() },
      { entry_source: 'V2_PIPELINE', demo_url: null, demo_ready: 0 });
    assert.throws(() => db.exec("UPDATE prospects SET entry_source = 'OTHER'"), /CHECK constraint/);
    assert.throws(() => db.exec('UPDATE prospects SET demo_ready = 2'), /CHECK constraint/);
    assert.throws(() => db.exec('UPDATE prospects SET demo_ready = 1'), /CHECK constraint/);
    for (const url of ['/relative', 'javascript:alert(1)', 'https://', 'https://bad host/']) {
      assert.throws(() => db.prepare('UPDATE prospects SET demo_url = ?, demo_ready = 1').run(url), /CHECK constraint/);
    }
    db.exec("UPDATE prospects SET entry_source = 'MANUAL', demo_url = 'https://demo.example/', demo_ready = 1");
    assert.deepEqual(db.prepare('SELECT id, state FROM prospects').all(), original);
  } finally { db.close(); }
});

test('V2 without a ready proposal retains its existing admission path', async () => {
  const db = new FixtureD1(); try {
    const fixture = await seed(db, pack(), { proposal: false });
    const expected = expectedItem(fixture, 'GENERAL_LOCAL_BUSINESS');
    delete expected.proposal;
    assert.deepEqual((await get(db)).items, [expected]);
  } finally { db.close(); }
});

test('manual ready demo is visible without V2 evidence and without consuming production capacity', async () => {
  const db = new FixtureD1(); try {
    const fixture = await seed(db);
    db.database.prepare(`INSERT INTO prospects (id, company_name, state, created_at, updated_at, entry_source, demo_url, demo_ready)
      VALUES ('manual', 'Manual Fixture', 'DISCOVERED', ?, ?, 'MANUAL', 'https://demo.example/', 1)`).run(now, now);
    const deck = await get(db);
    assert.deepEqual(deck.items.find(item => item.prospectId === fixture.id), expectedItem(fixture, 'GENERAL_LOCAL_BUSINESS'));
    const manual = deck.items.find(item => item.prospectId === 'manual');
    assert.equal(manual.entry_source, 'MANUAL'); assert.equal(manual.demo_ready, true);
    assert.equal(manual.demo_url, 'https://demo.example/'); assert.equal(manual.commercialStage, 'A_CONTACTER');
    assert.equal(manual.activeSlot, false); assert.equal(manual.productionEligible, false);
    assert.equal(manual.proposal, undefined); assert.equal(manual.vertical, null);
    assert.equal(deck.activeSlotCount, 1);
    const inventory = await get(db, '/api/prospects');
    assert.equal(inventory.prospects.length, 2);
    assert.equal(inventory.prospects.find(item => item.id === 'manual').entry_source, 'MANUAL');
    assert.equal(inventory.prospects.find(item => item.id === 'manual').demo_ready, true);
    for (const update of ["demo_ready = 0", "demo_ready = 1, state = 'DO_NOT_CONTACT'", "state = 'DISCOVERED', entry_source = 'V2_PIPELINE'"]) {
      db.database.exec(`UPDATE prospects SET ${update} WHERE id = 'manual'`);
      assert.deepEqual((await get(db)).items, [expectedItem(fixture, 'GENERAL_LOCAL_BUSINESS')]);
      const listed = (await get(db, '/api/prospects')).prospects;
      assert.equal(listed.some(item => item.id === 'manual'), !update.includes('DO_NOT_CONTACT'));
    }
    // A URL that passes SQLite's prefix check still must parse at the API boundary.
    db.database.exec("UPDATE prospects SET entry_source = 'MANUAL', demo_url = 'https://bad:port/' WHERE id = 'manual'");
    assert.deepEqual((await get(db)).items, [expectedItem(fixture, 'GENERAL_LOCAL_BUSINESS')]);
  } finally { db.close(); }
});

test('manual historical email trace completes the sheet without jobs or changes to V2', async () => {
  const db = new FixtureD1(); try {
    const fixture = await seed(db);
    const id = '26ea281c-6930-42d6-81da-553769dfd522';
    db.database.prepare(`INSERT INTO prospects (id,company_name,siret,state,entry_source,demo_url,demo_ready,created_at,updated_at)
      VALUES (?, 'Ananke Tattoo', '44971406200097', 'DISCOVERED', 'MANUAL', 'https://ananke-demo.netlify.app', 1, ?, ?)`).run(id, now, now);
    db.database.prepare('INSERT INTO events (id,prospect_id,actor,type,payload_json,created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('ananke-discovery', id, 'research-agent', 'discovery.prospect_created',
        JSON.stringify({ agent1Context: { evidence: [{ url: 'https://www.instagram.com/ananke_tattoo/' }] } }), now);
    const otherBefore = db.database.prepare('SELECT * FROM prospects WHERE id=?').get(fixture.id);
    const jobsBefore = db.database.prepare('SELECT * FROM jobs').all();
    db.database.exec(readFileSync(new URL('../../../database/data-ananke-manual-outreach-20261005.sql', import.meta.url), 'utf8'));
    const deck = await get(db);
    assert.deepEqual(deck.items.find(item => item.prospectId === fixture.id), expectedItem(fixture, 'GENERAL_LOCAL_BUSINESS'));
    const item = deck.items.find(item => item.prospectId === id);
    assert.deepEqual(item.contactability, { label: 'Email + Mobile', email: 'c.r.sorel@gmail.com', mobile: '+596696227605' });
    assert.equal(item.instagram, 'https://www.instagram.com/ananke_tattoo/');
    assert.equal(item.nextFollowUpDueAt, '2026-10-08T13:45:00.000Z');
    assert.deepEqual(item.outreach, { status: 'CONTACTED', channel: 'EMAIL', contactedAt: '2026-10-05T13:45:00Z' });
    assert.equal(item.commercialStage, 'RELANCES'); assert.equal(item.currentMeaningfulState, 'WAITING_REPLY');
    assert.equal(item.demo_url, 'https://ananke-demo.netlify.app'); assert.equal(item.demo_ready, true);
    assert.equal(item.activeSlot, false); assert.equal(item.proposal, undefined);
    const message = db.database.prepare('SELECT * FROM outreach_messages WHERE prospect_id=?').get(id);
    assert.equal(message.provider_message_id, null); assert.match(message.body_text, /contenu non archivé dans Magic Script/);
    assert.equal(db.database.prepare("SELECT actor FROM events WHERE prospect_id=? AND type='outreach.sent_manual'").get(id).actor, 'OPERATOR');
    assert.deepEqual(db.database.prepare('SELECT * FROM prospects WHERE id=?').get(fixture.id), otherBefore);
    assert.deepEqual(db.database.prepare('SELECT * FROM jobs').all(), jobsBefore);
    db.database.prepare(`INSERT INTO v2_admission_contacts (id,prospect_id,channel,raw_value,normalized_value,validation_status,created_at)
      VALUES ('ig', ?, 'INSTAGRAM', '@canonical_manual', 'https://instagram.com/canonical_manual/', 'DERIVED_VALID', ?)`).run(id, now);
    assert.equal((await get(db)).items.find(item => item.prospectId === id).instagram, 'https://www.instagram.com/canonical_manual/');
    db.database.exec("UPDATE v2_admission_contacts SET raw_value='javascript:alert(1)', normalized_value='javascript:alert(1)' WHERE id='ig'");
    assert.equal((await get(db)).items.find(item => item.prospectId === id).instagram, 'https://www.instagram.com/ananke_tattoo/');
    db.database.prepare('INSERT INTO replies (id,prospect_id,raw_text,received_at,created_at) VALUES (?, ?, ?, ?, ?)')
      .run('manual-reply', id, 'Replied', now, now);
    assert.equal((await get(db)).items.find(item => item.prospectId === id).nextFollowUpDueAt, null);
    db.database.exec('DELETE FROM replies');
    db.database.exec("UPDATE outreach_messages SET sent_at='invalid-date'");
    const invalid = (await get(db)).items.find(item => item.prospectId === id);
    assert.equal(invalid.nextFollowUpDueAt, null); assert.equal(invalid.outreach, undefined);
  } finally { db.close(); }
});

test('generic Deck validates factual operator, pain, contact, design and Proposal context without inventing family', async () => {
  const db = new FixtureD1(); try {
    const fixture = await seed(db);
    const before = JSON.stringify(fixture);
    const deck = await get(db);
    assert.deepEqual(deck, { items: [expectedItem(fixture, 'GENERAL_LOCAL_BUSINESS')], activeSlotCount: 1, capacity: 20 });
    assert.equal(fixture.request.designInput.businessVertical, 'GENERAL_LOCAL_BUSINESS');
    assert.equal(fixture.design.verticalProfile, 'GENERAL_LOCAL_BUSINESS');
    assert.deepEqual(fixture.request.designInput.evidence, fixture.input.evidence);
    for (const value of [fixture.input.opportunity.icp, fixture.admission.normalizedPack.opportunity.icp, fixture.request, deck.items[0]]) {
      assert.equal(Object.hasOwn(value, 'commercialFamily'), false);
    }
    assert.equal(JSON.stringify(fixture), before);
    assert.deepEqual(fixture.design.buildGuidance.sectionOrder, ['hero', 'offer', 'reassurance', 'contact']);
    assert.doesNotMatch(JSON.stringify(deck), /LOCAL_SERVICES|RESTAURANTS_BARS_CAFES|BEAUTY_HAIR_BARBER|fake testimonial|lorem ipsum/);
    const context = await get(db, '/api/proposals/fixture-token');
    assert.equal(context.proposal.buildArtifactId, fixture.proposal.buildArtifactId);
    assert.deepEqual(context.proposal.booking, fixture.proposal.booking);
  } finally { db.close(); }
});

test('generic booked Deck preserves meeting preparation and usable Call Copilot facts without starting a session', async () => {
  const db = new FixtureD1(); try {
    const fixture = await seed(db, pack(), { booked: true });
    const deck = await get(db);
    assert.deepEqual(deck.items, [expectedItem(fixture, 'GENERAL_LOCAL_BUSINESS', true)]);
    assert.equal(deck.activeSlotCount, 0);
    const authority = resolveProposalBookingAuthority(fixture.proposal, 'fixture-token');
    assert.equal(authority.prospectId, deck.items[0].prospectId);
    const prospect = await new D1ProspectRepository(db).getProspect(fixture.id);
    const context = prospectToCallCopilotContext(prospect, { meetingId: 'meeting-fixture', prototypeUrl: fixture.proposal.entryPath });
    assert.equal(context.companyName, deck.items[0].businessName);
    assert.equal(context.primaryFriction, deck.items[0].friction);
    assert.equal(context.websiteUrl, fixture.request.identity.websiteUrl);
    assert.equal(context.meetingId, 'meeting-fixture');
    assert.equal(context.activity, undefined);
    assert.equal('commercialFamily' in context, false);
    assert.doesNotMatch(JSON.stringify(deck), /cold.call|autonomous|call recommendation/i);
  } finally { db.close(); }
});

test('generic Deck safely omits unavailable Proposal and family-specific content', async () => {
  const db = new FixtureD1(); try {
    await seed(db, pack(), { proposal: false });
    const deck = await get(db);
    assert.equal(deck.items.length, 1);
    assert.equal(Object.hasOwn(deck.items[0], 'proposal'), false);
    assert.equal(Object.hasOwn(deck.items[0], 'commercialFamily'), false);
    assert.equal(deck.items[0].engagement.meetingBooked, false);
    assert.equal(deck.items[0].contactability.label, 'Email + Mobile');
  } finally { db.close(); }
});

for (const [context, family, vertical] of [
  ['Independent restaurant', 'RESTAURANTS_BARS_CAFES', 'RESTAURANTS_BARS_CAFES'],
  ['Independent beauty salon', 'BEAUTY_HAIR_BARBER', 'BEAUTY_HAIR_BARBER'],
  ['Independent electrical service', 'LOCAL_SERVICES', 'LOCAL_SERVICES'],
]) test(`supported ${family} Deck remains byte-for-byte equivalent to its existing projection`, async () => {
  const db = new FixtureD1(); try {
    const fixture = await seed(db, pack(context, family));
    assert.deepEqual((await get(db)).items, [expectedItem(fixture, vertical)]);
    assert.equal(fixture.input.opportunity.icp.commercialFamily, family);
  } finally { db.close(); }
});

for (const [label, alter] of [
  ['no canonical admission', db => db.database.exec('DELETE FROM v2_admissions')],
  ['rejected admission', db => db.database.exec("UPDATE v2_admissions SET result = 'REJECTED'")],
  ['missing design', db => db.database.exec('DELETE FROM v2_design_requests')],
  ['no qualifying contact', db => db.database.exec("UPDATE v2_admission_contacts SET validation_status = 'INVALID'")],
  ['unknown design vertical', (_, request) => { request.designInput.businessVertical = 'UNKNOWN'; }],
  ['mismatched prospect', (_, request) => { request.prospectId = 'other'; }],
  ['mismatched pack', (_, request) => { request.admission.packId = 'other'; }],
  ['mismatched schema', (_, request) => { request.admission.schemaVersion = 'other'; }],
  ['mismatched design version', (_, request) => { request.version = 'OTHER'; }],
]) test(`generic Deck cannot bypass ${label}`, async () => {
  const db = new FixtureD1(); try {
    const fixture = await seed(db);
    alter(db, fixture.request);
    db.database.prepare('UPDATE v2_design_requests SET request_json = ?').run(JSON.stringify(fixture.request));
    assert.deepEqual((await get(db)).items, []);
  } finally { db.close(); }
});

for (const [label, evidence, outcome] of [
  ['explicit excluded prospect', { outsideCommercialIcp: true }, 'REJECT'],
  ['unproven capability', { requiresUnprovenCapability: true }, 'CAPABILITY_GATED'],
  ['unsupported retail authority', { commercialFamily: 'LOCAL_RETAIL' }, 'REJECT'],
]) test(`Deck support does not admit ${label} through the canonical API`, async () => {
  const db = new FixtureD1(); try {
    const input = pack(); Object.assign(input.opportunity.icp, evidence);
    assert.equal(decidePackIcp(input).outcome, outcome);
    const changes = db.changes();
    const response = await worker.fetch(new Request('http://fixture.test/api/v2/admission', {
      method: 'POST', headers: { authorization: 'Bearer fixture-only', 'content-type': 'application/json' }, body: JSON.stringify(input),
    }), envFor(db));
    assert.equal(response.status, 422);
    assert.equal((await response.json()).icp.outcome, outcome);
    assert.equal(db.changes(), changes);
    assert.deepEqual((await get(db)).items, []);
  } finally { db.close(); }
});

test('real Chrome renders the canonical generic Deck row and booked meeting filter', { timeout: 45000 }, async () => {
  const db = new FixtureD1(); let server; let browser; let cdp;
  const blocked = [];
  try {
    const fixture = await seed(db);
    const deck = await get(db);
    const component = fileURLToPath(new URL('../../control-center/components/DeckPipeline.tsx', import.meta.url));
    const bundle = await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import DeckPipeline from ${JSON.stringify(component)}; window.renderDeck = items => createRoot(document.getElementById('deck')).render(React.createElement(DeckPipeline, { items })); fetch('/fixture-deck').then(r => r.json()).then(d => window.renderDeck(d.items));`,
      resolveDir: fileURLToPath(new URL('../../../', import.meta.url)), loader: 'jsx' },
      bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: {
        'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_MAGICSCRIPT_API_BASE_URL': '""',
        'process.env.MAGICSCRIPT_API_BASE_URL': '""', 'process.env.NEXT_PUBLIC_MAGICSCRIPT_API_TOKEN': '""', 'process.env.MAGICSCRIPT_API_TOKEN': '""',
      } });
    server = createServer((request, response) => {
      if (request.method !== 'GET') { blocked.push(request.method); response.writeHead(405).end(); return; }
      if (request.url === '/bundle.js') { response.setHeader('content-type', 'application/javascript'); response.end(bundle.outputFiles[0].text); }
      else if (request.url === '/fixture-deck') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(deck)); }
      else if (request.url.startsWith('/api/v2/outreach/')) { response.setHeader('content-type', 'application/json'); response.end('null'); }
      else if (request.url === '/') response.end('<!doctype html><html><body><main id="deck"></main><script src="/bundle.js"></script></body></html>');
      else response.writeHead(404).end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await qaSurface.launchBrowser(qaSurface.findChrome());
    cdp = new qaSurface.CdpConnection(browser.version.webSocketDebuggerUrl); await cdp.ready;
    const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const pages = await (await fetch(`http://127.0.0.1:${browser.debuggingPort}/json/list`)).json();
    cdp.close(); cdp = new qaSurface.CdpConnection(pages.find(page => page.id === target.targetId).webSocketDebuggerUrl); await cdp.ready;
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    cdp.on('Fetch.requestPaused', message => {
      const event = message.params;
      const allowed = event.request.url.startsWith(`${origin}/`) && event.request.method === 'GET';
      if (!allowed) blocked.push(event.request.url);
      void cdp.send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed
        ? { requestId: event.requestId } : { requestId: event.requestId, errorReason: 'BlockedByClient' });
    });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await cdp.send('Page.navigate', { url: `${origin}/` });
    await qaSurface.waitForCondition(cdp, undefined, "Boolean(document.querySelector('.prospect-row'))");
    const row = await qaSurface.evaluate(cdp, undefined, "document.querySelector('.prospect-row').innerText");
    assert.match(row, /Independent Deck Fixture/); assert.match(row, /GENERAL_LOCAL_BUSINESS/); assert.match(row, /Email \+ Mobile/);
    assert.match(row, /Consulter la Proposal/); assert.doesNotMatch(row, /LOCAL_SERVICES|BEAUTY_HAIR_BARBER|RESTAURANTS_BARS_CAFES/);
    assert.equal(await qaSurface.evaluate(cdp, undefined, "document.querySelector('.prospect-row a').getAttribute('href')"), fixture.proposal.entryPath);
    db.database.prepare("UPDATE prospects SET state = 'MEETING_BOOKED' WHERE id = ?").run(fixture.id);
    db.database.exec('UPDATE active_production_slots SET prospect_id = NULL');
    db.database.prepare('INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('browser-meeting', fixture.id, 'fixture', 'commercial.meeting_booked', JSON.stringify({ scheduledAt: meetingAt }), now);
    deck.items = (await get(db)).items;
    await cdp.send('Page.reload');
    await qaSurface.waitForCondition(cdp, undefined, "Boolean(document.querySelector('.pipeline-filter'))");
    await qaSurface.evaluate(cdp, undefined, "[...document.querySelectorAll('.pipeline-filter')].find(b => b.textContent.startsWith('RDV')).click()");
    await qaSurface.waitForCondition(cdp, undefined, "Boolean(document.querySelector('.prospect-row'))");
    const booked = await qaSurface.evaluate(cdp, undefined, "document.querySelector('.prospect-row').innerText");
    assert.match(booked, /Rendez-vous prévu/); assert.match(booked, /GENERAL_LOCAL_BUSINESS/); assert.match(booked, /Consulter la Proposal/);
    assert.deepEqual(blocked, []);
  } finally {
    cdp?.close(); await qaSurface.closeBrowser(browser);
    if (server) await new Promise(resolve => server.close(resolve)); db.close();
  }
});
