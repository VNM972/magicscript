import assert from 'node:assert/strict';
import test from 'node:test';
import { approveOutreachDraft, confirmManualMobile, createOutreachDraft, editOutreachDraft, InMemoryOutreachDraftStore } from '../outreach/engine';
import { confirmManualMobileContacted, DeterministicFakeEmailTransport, InMemoryContactedProjectionStore, InMemoryInitialSendReservationStore, sendApprovedInitialEmail } from '../outreach/send';
const readyQuality = { gateVersion: 'AGENT3_COMMERCIAL_QUALITY_GATE_V1', status: 'READY' as const, decision: 'READY_FOR_OPERATOR' as const, score: 100, blockers: [], warnings: [], attempt: 1, revision: 1, fingerprint: 'placeholder' };


test('creates deterministic grounded email with proposal link', async () => {
  const store = new InMemoryOutreachDraftStore();
  const input = { proposalId: 'proposal-a', prospectId: 'prospect-a', businessName: 'Café Rivage', channel: 'EMAIL' as const, recipient: 'bonjour@cafe.test', observation: 'une proposition peut clarifier le parcours de réservation', proposalLink: 'https://proposal.test/p/a', bookingLink: 'https://proposal.test/book/a', sourceRefs: ['agent1:opportunity-a'], now: '2026-01-01T00:00:00.000Z' };
  const first = await createOutreachDraft(input, store);
  const replay = await createOutreachDraft({ ...input, now: '2027-01-01T00:00:00.000Z' }, store);
  assert.equal(first.id, replay.id);
  assert.equal(first.contentHash, replay.contentHash);
  assert.match(first.body, /https:\/\/proposal\.test\/p\/a/);
  assert.equal(first.status, 'READY_FOR_OPERATOR');
});

test('requires approval and exact hash before manual mobile confirmation', async () => {
  const store = new InMemoryOutreachDraftStore();
  const draft = await createOutreachDraft({ proposalId: 'proposal-m', prospectId: 'prospect-m', businessName: 'Atelier Belle', channel: 'MOBILE', recipient: '+596696000001', observation: 'une proposition peut rendre le parcours mobile plus lisible', proposalLink: 'https://proposal.test/p/m', sourceRefs: ['agent1:opportunity-m'] }, store);
  await assert.rejects(() => confirmManualMobile(store, draft.id, draft.contentHash, 'operator@example.test'), /approved/);
  const approved = await approveOutreachDraft(store, draft.id, draft.contentHash, 'operator@example.test');
  const confirmed = await confirmManualMobile(store, approved.id, approved.contentHash, 'operator@example.test');
  assert.equal(confirmed.status, 'MOBILE_CONFIRMED');
  assert.equal(confirmed.subject, null);
  assert.doesNotMatch(confirmed.body, /WhatsApp|SMS/i);
  assert.equal(await confirmManualMobile(store, approved.id, approved.contentHash, 'operator'), confirmed);
  const contacted = new InMemoryContactedProjectionStore();
  await confirmManualMobileContacted({ draft: approved, approvedRevision: approved.revision, approvedFingerprint: approved.contentHash, proposalReady: true, operatorId: 'operator', now: '2026-01-01T00:00:00.000Z', contacted });
  await confirmManualMobileContacted({ draft: approved, approvedRevision: approved.revision, approvedFingerprint: approved.contentHash, proposalReady: true, operatorId: 'operator', now: '2026-01-01T00:00:01.000Z', contacted });
  assert.equal(contacted.get('proposal-m', 'MOBILE')?.operatorId, 'operator');
});

test('edits create immutable revisions and approval binds exact revision and fingerprint', async () => {
  const store = new InMemoryOutreachDraftStore();
  const first = await createOutreachDraft({ proposalId: 'p-r', prospectId: 's-r', businessName: 'Test', channel: 'EMAIL', recipient: 'a@test.test', observation: 'fact', proposalLink: 'https://proposal.test/p/r', sourceRefs: ['ref'], quality: readyQuality }, store);
  assert.equal(first.status, 'READY_FOR_OPERATOR');
  const approved = await approveOutreachDraft(store, first.id, first.revision, first.contentHash, 'operator');
  assert.equal(approved.status, 'APPROVED');
  const second = await editOutreachDraft(store, first.id, { subject: first.subject, body: `${first.body}\nEdited` });
  assert.equal(first.revision, 1);
  assert.equal(second.revision, 2);
  assert.equal((await store.get(first.id))?.body, first.body);
  assert.equal(second.status, 'DRAFT');
  await assert.rejects(() => approveOutreachDraft(store, second.id, 1, second.contentHash, 'operator'), /stale/);
  await assert.rejects(() => approveOutreachDraft(store, second.id, 2, second.contentHash, 'operator'), /not awaiting approval/);
});
test('approved source remains historical and its approval cannot authorize a successor', async () => {
  const store = new InMemoryOutreachDraftStore();
  const first = await createOutreachDraft({ proposalId: 'p-history', prospectId: 's-history', businessName: 'Test', channel: 'EMAIL', recipient: 'a@test.test', observation: 'fact', proposalLink: 'https://proposal.test/p/history', sourceRefs: ['ref'], quality: readyQuality }, store);
  const approved = await approveOutreachDraft(store, first.id, first.revision, first.contentHash, 'operator');
  const snapshot = structuredClone(approved);
  await assert.rejects(() => editOutreachDraft(store, first.id, { subject: first.subject, body: first.body }), /changed content/);
  const second = await editOutreachDraft(store, first.id, { subject: first.subject, body: `${first.body}\nEdited` });
  assert.deepEqual(await store.get(first.id), snapshot);
  assert.equal(second.revision, 2);
  assert.notEqual(second.contentHash, first.contentHash);
  assert.equal(second.status, 'DRAFT');
  assert.equal(second.approvedAt, null);
  assert.equal(second.approvedBy, null);
  await assert.rejects(() => editOutreachDraft(store, first.id, { subject: first.subject, body: 'Another edit' }), /already exists/);
  const transport = new DeterministicFakeEmailTransport();
  const contacted = new InMemoryContactedProjectionStore();
  const reservations = new InMemoryInitialSendReservationStore();
  const input = { draft: second, approvedRevision: first.revision, approvedFingerprint: first.contentHash, proposalReady: true, operatorId: 'operator', now: '2026-01-01T00:00:00.000Z', transport, contacted, reservations };
  await assert.rejects(() => sendApprovedInitialEmail(input), /not approved/);
  await assert.rejects(() => approveOutreachDraft(store, second.id, first.revision, first.contentHash, 'operator'), /stale/);
  await assert.rejects(() => approveOutreachDraft(store, second.id, second.revision, second.contentHash, 'operator'), /not awaiting approval/);
  assert.equal(transport.list().length, 0);
  assert.equal(reservations.list().length, 0);
  assert.equal(contacted.get('p-history', 'EMAIL'), null);
});
test('atomic fake initial send is idempotent and successful email creates CONTACTED', async () => {
  const store = new InMemoryOutreachDraftStore();
  const draft = await createOutreachDraft({ proposalId: 'p-send', prospectId: 's-send', businessName: 'Test', channel: 'EMAIL', recipient: 'a@test.test', observation: 'fact', proposalLink: 'https://proposal.test/p/send', sourceRefs: ['ref'] }, store);
  const approved = await approveOutreachDraft(store, draft.id, draft.revision, draft.contentHash, 'operator');
  const reservations = new InMemoryInitialSendReservationStore();
  const contacted = new InMemoryContactedProjectionStore();
  const transport = new DeterministicFakeEmailTransport();
  const input = { draft: approved, approvedRevision: 1, approvedFingerprint: approved.contentHash, proposalReady: true, operatorId: 'operator', now: '2026-01-01T00:00:00.000Z', reservations, transport, contacted };
  const [first, second] = await Promise.all([sendApprovedInitialEmail(input), sendApprovedInitialEmail(input)]);
  assert.equal(first.providerMessageId, second.providerMessageId);
  assert.equal(reservations.list().length, 1);
  assert.equal(transport.list().length, 1);
  assert.equal(contacted.get('p-send', 'EMAIL')?.fingerprint, approved.contentHash);
});

test('fake transport failure does not create CONTACTED', async () => {
  const store = new InMemoryOutreachDraftStore();
  const draft = await createOutreachDraft({ proposalId: 'p-fail', prospectId: 's-fail', businessName: 'Test', channel: 'EMAIL', recipient: 'a@test.test', observation: 'fact', proposalLink: 'https://proposal.test/p/fail', sourceRefs: ['ref'] }, store);
  const approved = await approveOutreachDraft(store, draft.id, draft.revision, draft.contentHash, 'operator');
  const contacted = new InMemoryContactedProjectionStore();
  const result = await sendApprovedInitialEmail({ draft: approved, approvedRevision: 1, approvedFingerprint: approved.contentHash, proposalReady: true, operatorId: 'operator', now: new Date().toISOString(), reservations: new InMemoryInitialSendReservationStore(), transport: new DeterministicFakeEmailTransport(false), contacted });
  assert.equal(result.success, false);
  assert.equal(contacted.get('p-fail', 'EMAIL'), null);
});

test('rejects missing factual grounding and unsafe links', async () => {
  const store = new InMemoryOutreachDraftStore();
  await assert.rejects(() => createOutreachDraft({ proposalId: 'p', prospectId: 's', businessName: 'Test', channel: 'EMAIL', recipient: 'a@test.test', observation: 'fact', proposalLink: 'http://localhost/p', sourceRefs: [] }, store));
});
