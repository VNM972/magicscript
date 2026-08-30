import test from 'node:test';
import assert from 'node:assert/strict';

import { canTransition } from '../state/prospect-state-machine';
import { InMemoryJobQueue } from '../jobs/in-memory-queue';

test('prototype QA can requeue a correction build', () => {
  assert.equal(canTransition('PROTOTYPE_QA', 'PROTOTYPE_REQUIRED'), true);
  assert.equal(canTransition('PROTOTYPE_REQUIRED', 'PROTOTYPE_STRATEGY_GENERATED'), true);
  assert.equal(canTransition('PROTOTYPE_STRATEGY_GENERATED', 'PROTOTYPE_BUILDING'), true);
});

test('prototype QA can advance to ready', () => {
  assert.equal(canTransition('PROTOTYPE_QA', 'PROTOTYPE_READY'), true);
  assert.equal(canTransition('PROTOTYPE_READY', 'PROTOTYPE_DEPLOYING'), true);
});

test('runner affinity prevents another runner from claiming a prototype job', async () => {
  const queue = new InMemoryJobQueue();

  await queue.enqueue({
    id: 'prototype-job',
    kind: 'RUN_PROTOTYPE_QA',
    prospectId: 'prospect-1',
    payload: {
      requiredRunnerId: 'runner-a',
    },
    maxAttempts: 3,
    runAfter: '2026-08-29T00:00:00.000Z',
  });

  const wrongRunner = await queue.next(
    new Date('2026-08-29T12:00:00.000Z'),
    'runner-b',
    ['RUN_PROTOTYPE_QA'],
  );
  assert.equal(wrongRunner, null);

  const correctRunner = await queue.next(
    new Date('2026-08-29T12:00:00.000Z'),
    'runner-a',
    ['RUN_PROTOTYPE_QA'],
  );
  assert.equal(correctRunner?.id, 'prototype-job');
  assert.equal(correctRunner?.claimedBy, 'runner-a');
});

test('demo reply can return to waiting state after send', () => {
  assert.equal(canTransition('DEMO_REPLY_READY', 'DEMO_REPLY_SENT'), true);
  assert.equal(canTransition('DEMO_REPLY_SENT', 'WAITING_REPLY'), true);
});
