import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBenchmark, evaluateIdentity, queryFor, sha256, SAMPLE_PATH, RESULT_PATH, FIELD_MASK, EXPECTED_SAMPLE_HASH, validateTextSearchRequest } from './run-google-places-structured-provider-benchmark.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const samplePath = path.join(root, SAMPLE_PATH); const resultPath = path.join(root, RESULT_PATH);
const originalSample = await fs.readFile(samplePath, 'utf8'); const sample = JSON.parse(originalSample); const target = sample.sample[0];
const response = (body, ok = true, status = 200) => ({ ok, status, async text() { return JSON.stringify(body); } });
const emptyFetch = async () => response({ places: [] });

test('GOOGLE_KEY_REQUIRED', async () => { const old = process.env.GKEY; delete process.env.GKEY; await assert.rejects(() => runBenchmark({ fetchImpl: emptyFetch }), /GKEY is required/); if (old === undefined) delete process.env.GKEY; else process.env.GKEY = old; });
test('GOOGLE_KEY_NEVER_LOGGED', async () => { process.env.GKEY = 'fixture-google-secret'; let logged = ''; const oldLog = console.log; console.log = (...args) => { logged += args.join(' '); }; try { await assert.rejects(() => runBenchmark({ fetchImpl: async () => response({ error: 'fixture' }, false, 403) })); } finally { console.log = oldLog; } assert.equal(logged.includes('fixture-google-secret'), false); });
test('FROZEN_SAMPLE_HASH_VERIFIED', () => { assert.equal(sha256(JSON.stringify(sample.sample)), EXPECTED_SAMPLE_HASH); assert.equal(sample.sampleHash, EXPECTED_SAMPLE_HASH); });
test('SAMPLE_UNCHANGED', async () => assert.equal(await fs.readFile(samplePath, 'utf8'), originalSample));
test('TEXT_SEARCH_REQUEST_VALID', () => assert.doesNotThrow(() => validateTextSearchRequest({ textQuery: queryFor(target), pageSize: 3 })));
test('FIELD_MASK_MINIMAL', () => assert.equal(FIELD_MASK, 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri'));
test('IDENTITY_EXACT_MATCH', () => { const verdict = evaluateIdentity(target, { name: target.canonicalName, address: target.canonicalAddress, website: null }); assert.equal(verdict.verdict, 'VERIFIED'); });
test('WRONG_LOCALITY_REJECTED', () => assert.equal(evaluateIdentity(target, { name: target.canonicalName, address: 'Schoelcher 97233, Martinique', website: null }).verdict, 'REJECTED'));
test('AMBIGUOUS_FAILS_CLOSED', () => assert.notEqual(evaluateIdentity(target, { name: 'Coffee', address: null, website: null }).verdict, 'VERIFIED'));
test('PHONE_DOES_NOT_AFFECT_IDENTITY', () => { const a = evaluateIdentity(target, { name: 'Wrong', address: target.canonicalAddress, website: null, nationalPhone: null }); const b = evaluateIdentity(target, { name: 'Wrong', address: target.canonicalAddress, website: null, nationalPhone: '+596000000' }); assert.equal(a.verdict, b.verdict); });
test('RESULT_SANITIZED', async () => { process.env.GKEY = 'fixture-google-secret'; try { const artifact = await runBenchmark({ fetchImpl: emptyFetch }); const output = await fs.readFile(resultPath, 'utf8'); assert.equal(artifact.requestCount, 10); assert.equal(output.includes('fixture-google-secret'), false); assert.equal(output.includes('X-Goog-Api-Key'), false); assert.equal(output.includes('places:searchText'), false); } finally { await fs.rm(resultPath, { force: true }); } });
test('NO_CANONICAL_MUTATION', async () => assert.equal(await fs.readFile(samplePath, 'utf8'), originalSample));
test('ZERO_TAVILY_USAGE', async () => { const files = await fs.readdir(path.join(root, 'bulk', 'reports')); assert.equal(files.some((name) => name.toLowerCase().includes('tavily') && name.toLowerCase().includes('google')), false); });
test('REQUEST_BODY_AND_HEADERS_ARE_GOOGLE_CONTRACT', async () => { process.env.GKEY = 'fixture-google-secret'; let captured; try { await runBenchmark({ fetchImpl: async (url, options) => { if (!captured) captured = { url, options }; return response({ places: [] }); } }); } finally { await fs.rm(resultPath, { force: true }); } assert.equal(captured.url, 'https://places.googleapis.com/v1/places:searchText'); assert.equal(captured.options.method, 'POST'); assert.deepEqual(JSON.parse(captured.options.body), { textQuery: queryFor(target), pageSize: 3 }); assert.equal(captured.options.headers['X-Goog-FieldMask'], FIELD_MASK); assert.equal(captured.options.headers['X-Goog-Api-Key'], 'fixture-google-secret'); });
