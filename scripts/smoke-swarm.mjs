const baseUrl = (process.env.MAGICSCRIPT_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const apiToken = process.env.MAGICSCRIPT_API_TOKEN || 'dev-api-token';
const timeoutMs = Number.parseInt(process.env.MAGICSCRIPT_SMOKE_TIMEOUT_MS || '900000', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('authorization', `Bearer ${apiToken}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path} failed ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

async function main() {
  console.log(`Magic Script smoke test -> ${baseUrl}`);
  const health = await request('/health');
  if (!health?.ok) throw new Error('Health check failed');
  if (!health.databaseConfigured) throw new Error('D1 is not configured');
  if (!health.autopilotEnabled) throw new Error('Local autopilot must be enabled for smoke test');
  if (health.sendingEnabled && health.emailProvider !== 'dry-run') throw new Error(`Smoke test refuses external email provider: ${health.emailProvider}`);
  console.log('OK API healthy');
  console.log('OK D1 configured');
  console.log('OK Autopilot enabled locally');
  console.log(`OK Email transport safety: ${health.emailProvider}${health.sendingEnabled ? ' (internal dry-run enabled)' : ' (disabled)'}`);

  const tick = await request('/api/autopilot/tick', {
    method: 'POST',
    body: '{}',
  });

  let discoveryComplete =
    tick?.provider === 'recherche-entreprises' ||
    tick?.provider === 'insee-sirene';

  if (discoveryComplete) {
    console.log(
      `OK Structured discovery provider=${tick.provider} created=${tick.created ?? 0} scanned=${tick.scanned ?? 0}`,
    );
  } else {
    console.log(
      tick?.queued
        ? `OK Kimi discovery job queued: ${tick.jobId}`
        : `Discovery fallback: ${tick?.reason || 'already active'}`,
    );
  }

  const deadline = Date.now() + timeoutMs;

  while (!discoveryComplete && Date.now() < deadline) {
    const { jobs = [] } = await request('/api/jobs');
    const discovery = jobs
      .filter((job) => job.kind === 'DISCOVER_PROSPECTS')
      .sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      )[0];

    if (!discovery) {
      const { prospects = [] } = await request('/api/prospects');
      if (prospects.length > 0) {
        discoveryComplete = true;
        break;
      }

      await sleep(3000);
      continue;
    }

    console.log(
      `Kimi discovery status=${discovery.status} attempts=${discovery.attempts}/${discovery.maxAttempts}`,
    );

    if (discovery.status === 'SUCCEEDED') {
      discoveryComplete = true;
      break;
    }

    if (discovery.status === 'DEAD_LETTER') {
      throw new Error(
        `Discovery DEAD_LETTER: ${discovery.lastError || 'unknown error'}`,
      );
    }

    await sleep(5000);
  }

  if (!discoveryComplete) {
    throw new Error(
      `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for discovery`,
    );
  }

  const { prospects = [] } = await request('/api/prospects');
  if (!prospects.length) throw new Error('Discovery completed but created no prospects');
  console.log(`OK ${prospects.length} prospect(s) present`);

  const { runners = [] } = await request('/api/runners');
  const online = runners.filter((runner) => Date.now() - new Date(runner.last_seen_at).getTime() < 60000);
  if (!online.length) throw new Error('No live runner heartbeat detected');
  console.log(`OK ${online.length} runner(s) online`);

  const usage = await request('/api/providers/usage');
  console.log(`OK Hunter usage ${usage.hunter.used}/${usage.hunter.budget}`);
  console.log('');
  console.log('SWARM SMOKE TEST PASSED');
  console.log('No real email was sent.');
}

main().catch((error) => {
  console.error('');
  console.error('SWARM SMOKE TEST FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
