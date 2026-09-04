import test from 'node:test';
import assert from 'node:assert/strict';

import { canTransition } from '../state/prospect-state-machine';
import { InMemoryJobQueue } from '../jobs/in-memory-queue';
import type { MagicScriptJob } from '../jobs/types';

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

test('failed claimed jobs release ownership before retry or dead-letter', async () => {
  const queue = new InMemoryJobQueue();

  await queue.enqueue({
    id: 'retry-job',
    kind: 'BUILD_PROTOTYPE',
    payload: {},
    maxAttempts: 2,
    runAfter: '2026-08-29T00:00:00.000Z',
  });
  const retryClaim = await queue.next(new Date('2026-08-29T12:00:00.000Z'), 'runner-a');
  await queue.markFailed(retryClaim!.id, 'interrupted');
  const retry = (await queue.list())[0];
  assert.equal(retry?.status, 'PENDING');
  assert.equal(retry?.claimedBy, undefined);
  assert.equal(retry?.claimedAt, undefined);

  await queue.enqueue({
    id: 'dead-letter-job',
    kind: 'BUILD_PROTOTYPE',
    payload: {},
    maxAttempts: 1,
    runAfter: '2026-08-29T00:00:00.000Z',
  });
  const deadClaim = await queue.next(new Date('2026-08-29T12:00:00.000Z'), 'runner-b');
  await queue.markFailed(deadClaim!.id, 'timed out');
  const dead = (await queue.list()).find((job) => job.id === 'dead-letter-job');
  assert.equal(dead?.status, 'DEAD_LETTER');
  assert.equal(dead?.claimedBy, undefined);
  assert.equal(dead?.claimedAt, undefined);
});

test('graceful release requeues a running job without consuming an attempt', async () => {
  const queue = new InMemoryJobQueue();

  await queue.enqueue({
    id: 'graceful-release-job',
    kind: 'BUILD_PROTOTYPE',
    payload: {},
    maxAttempts: 1,
    runAfter: '2026-08-29T00:00:00.000Z',
  });

  const claim = await queue.next(
    new Date('2026-08-29T12:00:00.000Z'),
    'runner-current',
  );
  assert.equal(claim?.attempts, 1);

  const wrongOwner = await queue.releaseClaim(
    claim!.id,
    'runner-stale',
    'stale shutdown',
  );
  assert.equal(wrongOwner, null);

  const released = await queue.releaseClaim(
    claim!.id,
    'runner-current',
    'graceful shutdown',
    new Date('2026-08-29T12:01:00.000Z'),
  );
  assert.equal(released?.status, 'PENDING');
  assert.equal(released?.attempts, 0);
  assert.equal(released?.claimedBy, undefined);
  assert.equal(released?.claimedAt, undefined);
});

test('graceful release keeps an uncertain SMTP attempt terminal', async () => {
  const queue = new InMemoryJobQueue();

  await queue.enqueue({
    id: 'sending-release-job',
    kind: 'SEND_EMAIL',
    payload: {},
    maxAttempts: 3,
    runAfter: '2026-08-29T00:00:00.000Z',
  });
  const claim = await queue.next(
    new Date('2026-08-29T12:00:00.000Z'),
    'runner-current',
  );
  const internal = (
    queue as unknown as { jobs: Map<string, MagicScriptJob> }
  ).jobs;
  internal.set(claim!.id, { ...claim!, status: 'SENDING' });

  const released = await queue.releaseClaim(
    claim!.id,
    'runner-current',
    'shutdown during SMTP reservation',
  );
  assert.equal(released?.status, 'SEND_UNKNOWN');
  assert.equal(released?.attempts, 1);
  assert.equal(released?.claimedBy, undefined);
});
