import test from 'node:test';
import assert from 'node:assert/strict';
import { getSwarmSnapshot } from './api';

test('swarm reads canonical jobs and routing without inventing activity', async (t) => {
  const paths: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    assert.equal(init.method ?? 'GET', 'GET');
    assert.equal(init.cache, 'no-store');
    const url = new URL(input);
    paths.push(url.pathname + url.search);
    return Response.json(url.pathname === '/api/jobs' ? { jobs: [
      { id: 'running', status: 'RUNNING', prospectId: 'known' },
      { id: 'finished', status: 'SUCCEEDED', prospectId: 'known' },
      { id: 'unrouted', status: 'RUNNING', prospectId: 'missing' },
      { id: 'system', status: 'RUNNING' },
    ] } : { prospects: [{ id: 'known', hubId: 'BTP' }] });
  });
  const snapshot = await getSwarmSnapshot();
  assert.equal(snapshot.connected, true);
  assert.equal(snapshot.runningJobCount, 3);
  assert.equal(snapshot.units.find((unit) => unit.key === 'BTP')?.activeJobCount, 1);
  assert.equal(snapshot.units.find((unit) => unit.key === 'UNKNOWN')?.activeJobCount, 2);
  assert.deepEqual(paths, ['/api/jobs?status=RUNNING', '/api/prospects']);
});

test('an API failure shows unknown activity, not a healthy idle swarm', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const snapshot = await getSwarmSnapshot();
  assert.equal(snapshot.connected, false);
  assert.equal(snapshot.runningJobCount, null);
  assert.ok(snapshot.units.length > 0, 'configured topology remains visible');
});

test('an empty successful snapshot is idle and malformed data is unavailable', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ jobs: [], prospects: [] }));
  const idle = await getSwarmSnapshot();
  assert.equal(idle.connected, true);
  assert.equal(idle.runningJobCount, 0);
  assert.ok(idle.units.every((unit) => unit.activeJobCount === 0));
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ jobs: null }));
  assert.equal((await getSwarmSnapshot()).connected, false);
});
