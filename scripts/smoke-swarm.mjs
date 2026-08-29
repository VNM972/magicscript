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

  console.log(
    tick?.provider === 'recherche-entreprises'
      ? `OK Free public directory discovery: ${tick.created ?? 0} created / ${tick.scanned ?? 0} scanned`
      : tick?.queued
        ? `OK Kimi discovery job queued: ${tick.jobId}`
        : `Discovery tick: ${tick?.reason || 'no new work'}`,
  );

  const deadline = Date.now() + timeoutMs;
  let prospects = [];

  while (Date.now() < deadline) {
    const data = await request('/api/prospects');
    prospects = data.prospects || [];

    if (prospects.length > 0) {
      const progressed = prospects.some(
        (prospect) => prospect.state !== 'DISCOVERED',
      );

      if (progressed) break;
    }

    await sleep(3000);
  }

  if (!prospects.length) {
    throw new Error('Discovery created no prospects before smoke-test timeout');
  }

  console.log(`OK ${prospects.length} prospect(s) present`);

  const stateCounts = prospects.reduce((acc, prospect) => {
    acc[prospect.state] = (acc[prospect.state] || 0) + 1;
    return acc;
  }, {});

  console.log('Prospect states:', stateCounts);

  const { jobs = [] } = await request('/api/jobs');
  const deadLetters = jobs.filter((job) => job.status === 'DEAD_LETTER');
  if (deadLetters.length) {
    throw new Error(
      `${deadLetters.length} job(s) reached DEAD_LETTER: ${deadLetters
        .map((job) => `${job.kind}:${job.lastError || 'unknown'}`)
        .join(' | ')}`,
    );
  }

  const { runners = [] } = await request('/api/runners');
  const online = runners.filter((runner) => Date.now() - new Date(runner.last_seen_at).getTime() < 60000);
  if (!online.length) throw new Error('No live runner heartbeat detected');
  console.log(`OK ${online.length} runner(s) online`);

  const usage = await request('/api/providers/usage');
  console.log(`OK Hunter usage ${usage.hunter.used}/${usage.hunter.budget}`);
  const safety = await request('/api/outreach/status');
  console.log(
    `OK Outreach provider=${safety.provider} sending=${safety.sendingEnabled}`,
  );

  console.log('');
  console.log('SWARM SMOKE TEST PASSED');
  console.log('Public discovery + D1 + runner progression verified.');
  console.log('No prospect email was sent externally.');
}

main().catch((error) => {
  console.error('');
  console.error('SWARM SMOKE TEST FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
