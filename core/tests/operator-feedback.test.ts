import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOperatorFeedbackEvent,
  operatorFeedbackEventIssues,
  serializeOperatorFeedbackEvent,
} from '../feedback/operator-feedback-contract';
import { InMemoryOperatorFeedbackStore } from '../persistence/operator-feedback-store';

const linkage = {
  prospectId: 'prospect-1', proposalId: 'proposal-1', channel: 'EMAIL' as const,
  outreachDraftId: 'draft-1', revision: 2, contentRef: 'content-ref-1',
  quality: { gateVersion: 'CP04_QUALITY_V1', status: 'READY' as const, score: 92, revision: 2, fingerprint: 'quality-fingerprint-1' },
};

function event(signal: 'ACCEPTED_UNCHANGED' | 'EDITED' | 'REJECTED' = 'ACCEPTED_UNCHANGED') {
  return createOperatorFeedbackEvent({
    eventId: `feedback-${signal.toLowerCase()}`,
    signal,
    actor: 'operator-1',
    actionAt: '2026-09-01T12:00:00Z',
    linkage,
    payload: signal === 'EDITED'
      ? { signal, editedFields: ['body'] }
      : signal === 'REJECTED'
        ? { signal, reason: { code: 'CONTENT_QUALITY', detail: 'Value proposition required clarification' } }
        : { signal },
  });
}

test('validates versioned feedback and structured rejection reasons', () => {
  const accepted = event();
  assert.deepEqual(operatorFeedbackEventIssues(accepted), []);
  assert.equal(event('REJECTED').payload.signal, 'REJECTED');
  assert.throws(() => createOperatorFeedbackEvent({ ...event(), payload: { signal: 'REJECTED', reason: { code: 'OTHER', detail: '' } } }), /STRUCTURED_REJECTION_REASON_REQUIRED/);
});

test('requires CP04 linkage and matching signal payload', () => {
  const invalid = structuredClone(event());
  (invalid as { payload: unknown }).payload = { signal: 'EDITED', editedFields: ['body'] };
  assert.ok(operatorFeedbackEventIssues(invalid).includes('PAYLOAD_SIGNAL_MISMATCH'));
  const missing = structuredClone(event());
  (missing as { linkage?: unknown }).linkage = undefined;
  assert.ok(operatorFeedbackEventIssues(missing).includes('CP04_LINKAGE_REQUIRED'));
});

test('in-memory persistence is immutable and returns raw events only', async () => {
  const store = new InMemoryOperatorFeedbackStore();
  const original = event();
  await store.save(original);
  assert.equal(serializeOperatorFeedbackEvent(await store.get(original.eventId) as typeof original), serializeOperatorFeedbackEvent(original));
  const changed = { ...original, actor: 'another-operator' as const };
  await assert.rejects(() => store.save(changed), /IMMUTABLE_OPERATOR_FEEDBACK_CONFLICT/);
  assert.equal((await store.listByProspect('prospect-1')).length, 1);
});
