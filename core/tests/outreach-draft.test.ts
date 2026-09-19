import assert from 'node:assert/strict';
import test from 'node:test';
import { approveOutreachDraft, confirmManualMobile, createOutreachDraft, editOutreachDraft, InMemoryOutreachDraftStore } from '../outreach/engine';
import { confirmManualMobileContacted, DeterministicFakeEmailTransport, InMemoryContactedProjectionStore, InMemoryInitialSendReservationStore, sendApprovedInitialEmail } from '../outreach/send';

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
  const first = await createOutreachDraft({ proposalId: 'p-r', prospectId: 's-r', businessName: 'Test', channel: 'EMAIL', recipient: 'a@test.test', observation: 'fact', proposalLink: 'https://proposal.test/p/r', sourceRefs: ['ref'] }, store);
  const second = await editOutreachDraft(store, first.id, { subject: first.subject, body: `${first.body}\nEdited` });
  assert.equal(first.revision, 1);
  assert.equal(second.revision, 2);
  assert.equal((await store.get(first.id))?.body, first.body);
  await assert.rejects(() => approveOutreachDraft(store, second.id, 1, second.contentHash, 'operator'), /stale/);
  const approved = await approveOutreachDraft(store, second.id, 2, second.contentHash, 'operator');
  assert.equal(approved.status, 'APPROVED');
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
