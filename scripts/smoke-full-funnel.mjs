const baseUrl = (process.env.MAGICSCRIPT_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const apiToken = process.env.MAGICSCRIPT_API_TOKEN || 'dev-api-token';
const timeoutMs = Number.parseInt(
  process.env.MAGICSCRIPT_FULL_SMOKE_TIMEOUT_MS || '1200000',
  10,
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('authorization', `Bearer ${apiToken}`);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `${init.method || 'GET'} ${path} failed ${response.status}: ${await response.text()}`,
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

async function main() {
  const smokeStartedAt = new Date().toISOString();
  console.log(`Magic Script FULL funnel smoke -> ${baseUrl}`);

  const health = await request('/health');
  if (!health?.ok || !health.databaseConfigured) {
    throw new Error('API/D1 is not ready');
  }
  if (!health.autopilotEnabled) {
    throw new Error('Autopilot must be enabled for the full funnel smoke test');
  }

  const safeTransport =
    health.emailProvider === 'dry-run' ||
    (health.testEmailMode === true && health.testRecipientConfigured === true);

  if (!safeTransport) {
    throw new Error(
      `Full smoke refuses transport provider=${health.emailProvider} testMode=${health.testEmailMode}`,
    );
  }

  console.log(
    `OK safe transport provider=${health.emailProvider} testMode=${health.testEmailMode}`,
  );

  await request('/api/autopilot/tick', {
    method: 'POST',
    body: '{}',
  });

  const terminal = new Set([
    'DISQUALIFIED',
    'DO_NOT_CONTACT',
    'CLOSED_WON',
    'CLOSED_LOST',
  ]);

  const deadline = Date.now() + timeoutMs;
  let lastSummary = '';

  while (Date.now() < deadline) {
    const [{ prospects = [] }, { jobs = [] }, { events = [] }] =
      await Promise.all([
        request('/api/prospects'),
        request('/api/jobs'),
        request('/api/events?limit=200'),
      ]);

    const safeSendEvent = events.find(
      (event) =>
        event.createdAt >= smokeStartedAt &&
        (event.type === 'email.dry_run' ||
          (event.type === 'email.sent' && event.payload?.testMode === true)),
    );

    const waiting = prospects.find(
      (prospect) => prospect.state === 'WAITING_REPLY',
    );

    if (safeSendEvent && waiting) {
      console.log(
        `OK safe outbound simulation reached WAITING_REPLY for ${waiting.companyName}`,
      );
      console.log(
        `OK event=${safeSendEvent.type} prospect=${safeSendEvent.prospectId || 'n/a'}`,
      );
      console.log('');
      console.log('FULL FUNNEL SMOKE PASSED');
      console.log(
        'Discovery -> research -> scoring -> contact -> outreach -> fact-check -> safe send verified.',
      );
      return;
    }

    const deadLetters = jobs.filter(
      (job) =>
        job.status === 'DEAD_LETTER' &&
        (!job.createdAt || job.createdAt >= smokeStartedAt),
    );
    if (deadLetters.length) {
      throw new Error(
        `DEAD_LETTER: ${deadLetters
          .map((job) => `${job.kind}: ${job.lastError || 'unknown'}`)
          .join(' | ')}`,
      );
    }

    const counts = prospects.reduce((acc, prospect) => {
      acc[prospect.state] = (acc[prospect.state] || 0) + 1;
      return acc;
    }, {});

    const summary = JSON.stringify(counts);
    if (summary !== lastSummary) {
      console.log('Pipeline:', counts);
      lastSummary = summary;
    }

    if (
      prospects.length > 0 &&
      prospects.every((prospect) => terminal.has(prospect.state))
    ) {
      throw new Error(
        'All discovered prospects reached terminal states before one safe outreach completed',
      );
    }

    await request('/api/autopilot/reconcile', {
      method: 'POST',
      body: '{}',
    });
    await request('/api/system/drain', {
      method: 'POST',
      body: JSON.stringify({ limit: 10 }),
    });

    await sleep(5000);
  }

  throw new Error(
    `Timed out after ${Math.round(timeoutMs / 1000)}s before a safe send reached WAITING_REPLY`,
  );
}

main().catch((error) => {
  console.error('');
  console.error('FULL FUNNEL SMOKE FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
