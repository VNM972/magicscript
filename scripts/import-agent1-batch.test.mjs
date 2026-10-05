import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { AGENT1_BATCH_ENDPOINT, importAgent1Batch, toAgent1Batch } from './import-agent1-batch.mjs';
import { validateAgent1CandidateBatch } from '../core/types/agent1-batch.ts';

const samplePath = new URL('./examples/agent1-ananke-sample.json', import.meta.url);
const sample = JSON.parse(await readFile(samplePath, 'utf8'));

test('operator sample becomes a canonical manual batch without manufacturing identity or phone authority', () => {
  const batch = toAgent1Batch(sample, '2026-10-05T12:00:00.000Z');
  assert.equal(validateAgent1CandidateBatch(batch).accepted, true);
  assert.equal(batch.batchId, sample.batchId);
  assert.equal(batch.provenance, sample.provenance);
  assert.equal(batch.collectedAt, '2026-10-05T12:00:00.000Z');
  assert.equal(batch.origin, 'manual');
  assert.equal(batch.schemaVersion, 'AGENT1_CANDIDATE_BATCH_V1');
  assert.equal(batch.candidates.length, 1);
  assert.equal(batch.candidates[0].siren, '449714062');
  assert.equal(batch.candidates[0].siret, '44971406200097');
  for (const field of ['websiteUrl', 'instagram', 'phone', 'reviewCount', 'reviewScore', 'state']) {
    assert.equal(Object.hasOwn(batch.candidates[0], field), false, field);
  }
});

test('missing batch ID is generated deterministically across reruns and metadata is preserved', () => {
  const input = { ...sample, batchId: undefined };
  assert.equal(toAgent1Batch(input, '2026-10-05T12:00:00Z').batchId, toAgent1Batch(input, '2026-10-06T12:00:00Z').batchId);
  assert.notEqual(toAgent1Batch(input).batchId, toAgent1Batch({ ...input, provenance: 'different-source' }).batchId);
  assert.equal(toAgent1Batch({ ...sample, collectedAt: '2026-09-28T12:00:00Z' }).collectedAt, '2026-09-28T12:00:00Z');
});

test('canonical validation rejects missing required fields, invalid URLs and unsupported optional values', () => {
  for (const change of [
    { companyName: '' }, { sourceUrl: 'file:///local' }, { evidence: [] },
    { websiteUrl: 'javascript:alert(1)' }, { siren: '123' }, { score: 101 },
    { evidence: [{ url: 'https://example.test', note: '', supports: ['companyName'] }] },
  ]) assert.throws(() => toAgent1Batch({ ...sample, candidates: [{ ...sample.candidates[0], ...change }] }), /Invalid batch/);
  assert.throws(() => toAgent1Batch({ ...sample, provenance: '' }), /provenance is required/);
  assert.throws(() => toAgent1Batch({ ...sample, candidates: [] }), /non-empty array/);
});

test('POST uses loopback authentication and reports accepted creation and duplicate accurately', async () => {
  let previous;
  const logs = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, AGENT1_BATCH_ENDPOINT);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer dev-api-token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(options.redirect, 'error');
    const batch = JSON.parse(options.body);
    assert.equal(validateAgent1CandidateBatch(batch).accepted, true);
    const duplicate = previous === batch.batchId;
    previous = batch.batchId;
    return Response.json({ ok: true, duplicate, created: ['fixture-prospect'], decisions: [{ companyName: 'Ananke Tattoo', decision: 'CREATED' }] });
  };
  const first = await importAgent1Batch(samplePath, { fetchImpl, log: (line) => logs.push(line) });
  const second = await importAgent1Batch(samplePath, { fetchImpl, log: (line) => logs.push(line) });
  assert.equal(first.status, 200);
  assert.equal(first.outcome, 'accepted');
  assert.equal(first.createdCount, 1);
  assert.equal(second.outcome, 'duplicate');
  assert.equal(second.createdCount, 0);
  assert.ok(logs.includes('Prospects created: 0'));
  assert.ok(!logs.some((line) => line.includes('dev-api-token')));
});

test('HTTP 200 with every candidate excluded is reported as rejection with zero creations', async () => {
  const result = await importAgent1Batch(samplePath, {
    fetchImpl: async () => Response.json({ ok: true, created: [], decisions: [{ companyName: 'Ananke Tattoo', decision: 'EXCLUDED', reason: 'INVALID_IDENTITY' }] }),
    log: () => {},
  });
  assert.equal(result.status, 200);
  assert.equal(result.outcome, 'rejected');
  assert.equal(result.createdCount, 0);
  assert.equal(result.payload.decisions[0].reason, 'INVALID_IDENTITY');
});

test('HTTP rejection is returned and transport failure performs no retry', async () => {
  const rejected = await importAgent1Batch(samplePath, { fetchImpl: async () => Response.json({ error: 'Unauthorized' }, { status: 401 }), log: () => {} });
  assert.equal(rejected.status, 401);
  assert.equal(rejected.outcome, 'rejected');
  let calls = 0;
  await assert.rejects(importAgent1Batch(samplePath, { fetchImpl: async () => { calls += 1; throw new Error('connection refused'); }, log: () => {} }), /connection refused/);
  assert.equal(calls, 1);
});
