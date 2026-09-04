import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activityLimitFor,
  decayMultiplier,
  scoreEngagement,
  scoreEngagementFromMagicScriptEvents,
  type EngagementEvent,
} from '../orchestrator/engagement-score';

const NOW = '2026-09-03T12:00:00.000Z';

function event(
  signal: EngagementEvent['signal'],
  occurredAt: string,
  id: string,
  extra: Partial<EngagementEvent> = {},
): EngagementEvent {
  return { signal, occurredAt, id, ...extra };
}

test('passive activity is scored but cannot create intent', () => {
  const result = scoreEngagement([
    event('PROTOTYPE_VIEWED', NOW, 'prototype-1'),
    event('SALES_ROOM_VIEWED', NOW, 'room-1'),
    event('RETURN_VISIT', NOW, 'return-1'),
    event('DEMO_OPENED', NOW, 'demo-1'),
    event('SHARE_CLICKED', NOW, 'share-1'),
    event('CONTACT_CLICKED', NOW, 'contact-1'),
  ], NOW);

  assert.equal(result.intent_score, 0);
  assert.equal(result.activity_score, 40);
  assert.equal(result.score_total, 40);
  assert.equal(result.last_meaningful_event, 'PROTOTYPE_VIEWED');
});

test('each passive signal alone contributes activity only', () => {
  for (const [index, signal] of ([
    'PROTOTYPE_VIEWED',
    'SALES_ROOM_VIEWED',
    'RETURN_VISIT',
    'DEMO_OPENED',
    'SHARE_CLICKED',
    'CONTACT_CLICKED',
  ] as const).entries()) {
    const result = scoreEngagement([event(signal, NOW, `passive-${index}`)], NOW);
    assert.ok(result.score_total > 0);
    assert.equal(result.intent_score, 0);
  }
});

test('intent is separate from activity and remains explainable', () => {
  const result = scoreEngagement([
    event('SALES_ROOM_VIEWED', NOW, 'room-1', { sourceType: 'sales_room.accessed' }),
    event('MESSAGE_SENT', NOW, 'message-1', { sourceType: 'sales_room.message_received' }),
  ], NOW);

  assert.equal(result.activity_score, 8);
  assert.equal(result.intent_score, 35);
  assert.equal(result.score_total, 43);
  assert.equal(result.trend, 'RISING');
  assert.equal(result.top_contributors[0]?.signal, 'MESSAGE_SENT');
  assert.equal(result.top_contributors[0]?.sourceType, 'sales_room.message_received');
  assert.match(result.top_contributors[0]?.reason ?? '', /poids 35/);
});

test('meeting request and confirmed meeting are distinct intent signals', () => {
  const requested = scoreEngagement([event('MEETING_REQUESTED', NOW, 'request-1')], NOW);
  const booked = scoreEngagement([event('MEETING_BOOKED', NOW, 'booking-1')], NOW);

  assert.equal(requested.intent_score, 45);
  assert.equal(booked.intent_score, 60);
  assert.equal(requested.activity_score, 0);
  assert.equal(booked.activity_score, 0);
});

test('passive spam is capped without deleting the raw event input', () => {
  const events = Array.from({ length: 100 }, (_, index) =>
    event('SHARE_CLICKED', NOW, `share-${index}`),
  );
  const result = scoreEngagement(events, NOW);

  assert.equal(result.activity_score, 16);
  assert.equal(result.intent_score, 0);
  assert.equal(result.score_total, 16);
  assert.equal(result.top_contributors.length, 2);
  assert.deepEqual(activityLimitFor('SHARE_CLICKED'), { max: 2, window: 'day' });
});

test('replayed event identity does not inflate the score', () => {
  const result = scoreEngagement([
    event('MEETING_REQUESTED', NOW, 'meeting-request-1', { dedupeKey: 'request-key' }),
    event('MEETING_REQUESTED', NOW, 'replay-1', { dedupeKey: 'request-key' }),
    event('SHARE_CLICKED', NOW, 'share-1'),
    event('SHARE_CLICKED', NOW, 'share-1'),
  ], NOW);

  assert.equal(result.intent_score, 45);
  assert.equal(result.activity_score, 8);
  assert.equal(result.score_total, 53);
});

test('decay applies at J0, J5, J10, J20 and J40', () => {
  const dates = [
    '2026-09-03T12:00:00.000Z',
    '2026-08-29T12:00:00.000Z',
    '2026-08-24T12:00:00.000Z',
    '2026-08-14T12:00:00.000Z',
    '2026-07-25T12:00:00.000Z',
  ];
  const result = scoreEngagement(
    dates.map((date, index) => event('PROTOTYPE_VIEWED', date, `prototype-${index}`)),
    NOW,
  );

  assert.deepEqual(dates.map((_, index) => result.top_contributors[index]?.contribution), [5, 4, 3, 2, 1]);
  assert.equal(result.activity_score, 15);
  assert.equal(decayMultiplier(0), 1);
  assert.equal(decayMultiplier(5), 0.8);
  assert.equal(decayMultiplier(10), 0.6);
  assert.equal(decayMultiplier(20), 0.4);
  assert.equal(decayMultiplier(40), 0.2);
});

test('trend is deterministic for rising, stable and cooling activity', () => {
  const rising = scoreEngagement([
    event('PROTOTYPE_VIEWED', '2026-09-03T12:00:00.000Z', 'new'),
    event('PROTOTYPE_VIEWED', '2026-08-14T12:00:00.000Z', 'old'),
  ], NOW);
  const stable = scoreEngagement([
    event('PROTOTYPE_VIEWED', '2026-08-29T12:00:00.000Z', 'recent'),
    event('PROTOTYPE_VIEWED', '2026-08-24T12:00:00.000Z', 'previous'),
  ], NOW);
  const cooling = scoreEngagement([
    event('PROTOTYPE_VIEWED', '2026-08-14T12:00:00.000Z', 'old-only'),
  ], NOW);

  assert.equal(rising.trend, 'RISING');
  assert.equal(stable.trend, 'STABLE');
  assert.equal(cooling.trend, 'COOLING');
});

test('score is bounded at 100 and recomputation is identical', () => {
  const events = [
    event('MEETING_BOOKED', NOW, 'booking-1'),
    event('MEETING_REQUESTED', NOW, 'request-1'),
    event('MESSAGE_SENT', NOW, 'message-1'),
    event('CONTACT_CLICKED', NOW, 'contact-1'),
  ];
  const first = scoreEngagement(events, NOW);
  const second = scoreEngagement(events, NOW);

  assert.equal(first.score_total, 100);
  assert.deepEqual(first, second);
});

test('persisted event names map to analytics signals without inventing outbound messages', () => {
  const result = scoreEngagementFromMagicScriptEvents([
    {
      id: 'event-1',
      prospectId: 'prospect-1',
      actor: 'system',
      type: 'sales_room.message_received',
      payload: { idempotencyKey: 'message-key' },
      createdAt: NOW,
    },
    {
      id: 'event-2',
      prospectId: 'prospect-1',
      actor: 'system',
      type: 'sales_room.share_clicked',
      payload: { idempotencyKey: 'share-key' },
      createdAt: NOW,
    },
  ], NOW);

  assert.equal(result.intent_score, 35);
  assert.equal(result.activity_score, 8);
  assert.equal(result.top_contributors[0]?.signal, 'MESSAGE_SENT');
  assert.equal(result.top_contributors[0]?.sourceType, 'sales_room.message_received');
});
