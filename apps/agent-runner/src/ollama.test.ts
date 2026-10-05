import assert from 'node:assert/strict';
import test from 'node:test';

import { runOllama } from './ollama';

test('Ollama retries a transient fetch failure once and returns the response', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ response: '{"ok":true}' }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await runOllama({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'test-model',
      prompt: 'test',
      retryAttempts: 2,
    });
    assert.equal(result, '{"ok":true}');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Ollama does not retry a generation timeout', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    await new Promise<void>((resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
    return new Response('{}');
  }) as typeof fetch;

  try {
    await assert.rejects(
      runOllama({
        baseUrl: 'http://127.0.0.1:11434',
        model: 'test-model',
        prompt: 'test',
        timeoutMs: 5,
        retryAttempts: 3,
      }),
      /Ollama timed out after 5ms/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Ollama sends a provided JSON Schema with deterministic temperature', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;
  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ response: '{"ok":true}' }), { status: 200 });
  }) as typeof fetch;

  try {
    const schema = {
      type: 'object',
      required: ['ok'],
      properties: { ok: { type: 'boolean' } },
    };
    await runOllama({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'test-model',
      prompt: 'test',
      schema,
    });

    assert.ok(requestBody && typeof requestBody === 'object');
    const sent = requestBody as Record<string, unknown>;
    assert.deepEqual(sent.format, schema);
    assert.equal(
      (sent.options as Record<string, unknown>).temperature,
      0,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
