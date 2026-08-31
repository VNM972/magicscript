import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryJobQueue } from '../jobs/in-memory-queue';

test('commercial prototype work outranks background discovery', async () => {
  const queue = new InMemoryJobQueue();
  const runAfter = '2026-08-31T00:00:00.000Z';

  await queue.enqueue({
    id: 'discovery',
    kind: 'DISCOVER_PROSPECTS',
    payload: {},
    maxAttempts: 3,
    runAfter,
  });

  await queue.enqueue({
    id: 'eden-prototype',
    kind: 'GENERATE_PROTOTYPE_STRATEGY',
    prospectId: 'eden',
    payload: {},
    maxAttempts: 3,
    runAfter,
  });

  const next = await queue.next(new Date('2026-08-31T12:00:00.000Z'), 'runner-1');

  assert.equal(next?.id, 'eden-prototype');
  assert.equal(next?.kind, 'GENERATE_PROTOTYPE_STRATEGY');
});
