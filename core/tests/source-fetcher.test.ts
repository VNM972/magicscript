import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchSourcePage, MAX_FETCH_SIZE } from '../research/source-fetcher';

const publicResolution = async (): Promise<readonly string[]> => ['93.184.216.34'];

test('source fetcher rejects literal and DNS-resolved private addresses before request', async () => {
  let requests = 0;
  const request = async (): Promise<Response> => {
    requests += 1;
    return new Response('never');
  };

  const literal = await fetchSourcePage('http://127.0.0.1/private', {
    fetchImpl: request,
    resolveHost: publicResolution,
  });
  const resolved = await fetchSourcePage('https://example.fr/contact', {
    fetchImpl: request,
    resolveHost: async () => ['192.168.1.10'],
  });

  assert.deepEqual(literal, { ok: false, reason: 'INVALID_OR_PRIVATE_URL' });
  assert.deepEqual(resolved, { ok: false, reason: 'INVALID_OR_PRIVATE_URL' });
  assert.equal(requests, 0);
});

test('source fetcher follows bounded redirects and revalidates every host', async () => {
  const requested: string[] = [];
  const result = await fetchSourcePage('https://example.fr/contact', {
    resolveHost: publicResolution,
    fetchImpl: async (url) => {
      requested.push(url);
      return requested.length === 1
        ? new Response(null, { status: 302, headers: { location: 'https://www.example.fr/contact' } })
        : new Response('<a href="tel:0596711010">Call</a>', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
    },
  });

  if (!result.ok) throw new Error(`unexpected fetch failure: ${result.reason}`);
  assert.equal(result.finalUrl, 'https://www.example.fr/contact');
  assert.equal(requested.length, 2);
});

test('source fetcher retries transient 503 once and keeps 403 permanent', async () => {
  let calls = 0;
  const recovered = await fetchSourcePage('https://example.fr/contact', { resolveHost: publicResolution, retryDelayMs: 0, fetchImpl: async () => { calls += 1; return calls === 1 ? new Response('busy', { status: 503 }) : new Response('ok', { status: 200, headers: { 'content-type': 'text/html' } }); } });
  assert.equal(recovered.ok, true); assert.equal(calls, 2);
  calls = 0; const denied = await fetchSourcePage('https://example.fr/contact', { resolveHost: publicResolution, retryDelayMs: 0, fetchImpl: async () => { calls += 1; return new Response('denied', { status: 403 }); } });
  assert.deepEqual(denied, { ok: false, reason: 'HTTP_STATUS_403' }); assert.equal(calls, 1);
});

test('source fetcher rejects private redirect targets and oversized responses', async () => {
  const redirected = await fetchSourcePage('https://example.fr/contact', {
    resolveHost: publicResolution,
    fetchImpl: async () => new Response(null, {
      status: 302,
      headers: { location: 'http://192.168.1.10/private' },
    }),
  });
  const oversized = await fetchSourcePage('https://example.fr/contact', {
    resolveHost: publicResolution,
    fetchImpl: async () => new Response('small', {
      status: 200,
      headers: {
        'content-type': 'text/html',
        'content-length': String(MAX_FETCH_SIZE + 1),
      },
    }),
  });

  assert.deepEqual(redirected, { ok: false, reason: 'REDIRECT_TO_PRIVATE' });
  assert.deepEqual(oversized, { ok: false, reason: 'RESPONSE_TOO_LARGE' });
});
