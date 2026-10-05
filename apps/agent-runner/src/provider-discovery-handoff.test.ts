import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runnerRoot = mkdtempSync(join(tmpdir(), 'magicscript-provider-discovery-'));
process.env.MAGICSCRIPT_API_BASE_URL = 'http://runner-fixture.test';
process.env.MAGICSCRIPT_RUNNER_TOKEN = 'fixture-runner-token';
process.env.MAGICSCRIPT_RUNNER_ID = 'provider-discovery-test-runner';
process.env.MAGICSCRIPT_STACK_ID = 'provider-discovery-test-stack';
process.env.MAGICSCRIPT_RUNNER_WORK_DIR = runnerRoot;
process.env.MAGICSCRIPT_AGENT_PROVIDER = 'ollama';
process.env.MAGICSCRIPT_EMAIL_PROVIDER = 'disabled';
process.env.MAGICSCRIPT_SENDING_ENABLED = 'false';

const { runOne } = await import('./index');

test('legacy model discovery jobs fail closed before generation or canonical submission', async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ path: string; body?: Record<string, unknown> }> = [];
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      const path = url.pathname;
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined;
      requests.push({ path, body });
      if (path === '/api/runner/jobs/claim') {
        return Response.json({
          job: {
            id: 'legacy-model-discovery-job',
            kind: 'DISCOVER_PROSPECTS',
            prospectId: undefined,
            payload: { location: 'Martinique', limit: 5 },
            status: 'RUNNING',
            attempts: 1,
            maxAttempts: 3,
          },
          prospect: null,
          contacts: [],
        });
      }
      if (path === '/api/runner/heartbeat' || path.endsWith('/fail')) {
        return Response.json({ ok: true });
      }
      return new Response('unexpected runner request', { status: 500 });
    };

    assert.equal(await runOne(), true);
    const failure = requests.find(({ path }) => path.endsWith('/fail'));
    assert.ok(failure);
    assert.match(String(failure.body?.error), /Model-generated discovery is disabled/);
    assert.equal(requests.some(({ path }) => path === '/api/agent1/batches'), false);
    assert.equal(requests.some(({ path }) => path.endsWith('/succeed')), false);
    assert.equal(requests.some(({ path }) => path.includes('11434') || path.includes('generate')), false);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(runnerRoot, { recursive: true, force: true });
  }
  t.diagnostic('Legacy DISCOVER_PROSPECTS jobs cannot invoke the model or canonical ingestion.');
});
