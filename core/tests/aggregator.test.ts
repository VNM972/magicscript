import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateOperatorFeedback, AGGREGATION_MINIMUM_EVIDENCE_EVENTS } from '../feedback/aggregator';
import { createOperatorFeedbackEvent } from '../feedback/operator-feedback-contract';

const base = { prospectId: 'p1', proposalId: 'pr1', channel: 'EMAIL' as const, outreachDraftId: 'd1', revision: 1, contentRef: 'c1', quality: { gateVersion: 'q1', status: 'READY' as const, score: 90, revision: 1, fingerprint: 'f1' } };
function event(id: string, signal: 'ACCEPTED_UNCHANGED' | 'EDITED' | 'REJECTED' | 'RESPONSE_RECEIVED' | 'MEETING_BOOKED', channel: 'EMAIL' | 'MOBILE' = 'EMAIL') {
  return createOperatorFeedbackEvent({ eventId: id, signal, actor: 'operator', actionAt: `2026-09-0${id.slice(-1)}T12:00:00Z`, linkage: { ...base, channel }, payload: signal === 'EDITED' ? { signal, editedFields: ['body'] } : signal === 'REJECTED' ? { signal, reason: { code: 'WRONG_CHANNEL', detail: 'not suitable' } } : { signal } });
}

test('aggregation is order independent and duplicate safe', () => {
  const events = [event('e1', 'ACCEPTED_UNCHANGED'), event('e2', 'EDITED'), event('e3', 'EDITED')];
  assert.deepEqual(aggregateOperatorFeedback(events), aggregateOperatorFeedback([events[2], events[0], events[1], events[1]]));
  const edited = aggregateOperatorFeedback(events).find(i => i.pattern.includes('edited_field=body'))!;
  assert.equal(edited.eventCount, 2);
  assert.deepEqual(edited.eventIds, ['e2', 'e3']);
});

test('structured rejection and channel/response/meeting observations remain separate', () => {
  const insights = aggregateOperatorFeedback([event('e1', 'REJECTED'), event('e2', 'RESPONSE_RECEIVED', 'MOBILE'), event('e3', 'MEETING_BOOKED', 'MOBILE')]);
  assert.equal(insights.find(i => i.pattern.includes('rejection_reason=WRONG_CHANNEL'))?.eventCount, 1);
  assert.equal(insights.find(i => i.pattern.includes('channel=MOBILE'))?.eventCount, 2);
  assert.ok(insights.some(i => i.pattern.includes('signal=MEETING_BOOKED')));
  assert.ok(insights.some(i => i.pattern.includes('signal=RESPONSE_RECEIVED')));
});

test('insufficient evidence is preserved and not recommendation eligible', () => {
  const insight = aggregateOperatorFeedback([event('e1', 'ACCEPTED_UNCHANGED')]).find(i => i.pattern.includes('signal=ACCEPTED_UNCHANGED'))!;
  assert.equal(insight.eventCount, 1);
  assert.equal(insight.evidenceSufficient, false);
  assert.equal(insight.recommendationEligible, false);
  assert.equal(AGGREGATION_MINIMUM_EVIDENCE_EVENTS, 3);
});
