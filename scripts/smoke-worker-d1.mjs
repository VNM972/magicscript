const baseUrl = (
  process.env.MAGICSCRIPT_API_BASE_URL || 'http://127.0.0.1:8787'
).replace(/\/$/, '');
const apiToken = process.env.MAGICSCRIPT_API_TOKEN || 'dev-api-token';

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
  console.log(`Magic Script Worker + D1 smoke -> ${baseUrl}`);

  const health = await request('/health');

  if (!health?.ok) throw new Error('Worker health check failed');
  if (!health.databaseConfigured) throw new Error('D1 binding is not configured');
  if (!health.autopilotEnabled) throw new Error('Local autopilot must be enabled');

  const externalTransportActive =
    health.sendingEnabled && health.emailProvider !== 'dry-run';

  if (externalTransportActive) {
    throw new Error(
      `Worker smoke refuses external email provider: ${health.emailProvider}`,
    );
  }

  console.log('OK Worker healthy');
  console.log('OK local D1 binding configured');
  console.log(`OK email safety provider=${health.emailProvider}`);

  const tick = await request('/api/autopilot/tick', {
    method: 'POST',
    body: '{}',
  });

  if (
    tick?.provider !== 'recherche-entreprises' &&
    tick?.provider !== 'insee-sirene' &&
    tick?.provider !== 'kimi'
  ) {
    throw new Error(
      `Unexpected discovery result: ${JSON.stringify(tick)}`,
    );
  }

  console.log(
    `OK discovery provider=${tick.provider} created=${tick.created ?? 0} scanned=${tick.scanned ?? 0}`,
  );

  const { prospects = [] } = await request('/api/prospects');

  if (!prospects.length) {
    throw new Error('Discovery completed but D1 contains no prospects');
  }

  const localProspects = prospects.filter((prospect) =>
    String(prospect.location || '').includes('972'),
  );

  if (!localProspects.length) {
    throw new Error(
      'D1 contains prospects, but none has a verified Martinique location',
    );
  }

  const { jobs = [] } = await request('/api/jobs');
  const researchJobs = jobs.filter(
    (job) => job.kind === 'RUN_RESEARCH_SWARM',
  );

  if (!researchJobs.length) {
    throw new Error(
      'Structured discovery did not enqueue the normal Research Swarm stage',
    );
  }

  const usage = await request('/api/providers/usage');

  console.log(`OK D1 prospects=${prospects.length}`);
  console.log(`OK verified 972 prospects=${localProspects.length}`);
  console.log(`OK queued research jobs=${researchJobs.length}`);
  console.log(
    `OK primary directory cost=${usage.rechercheEntreprises?.monetaryCost ?? 'unknown'} authRequired=${usage.rechercheEntreprises?.authRequired ?? 'unknown'}`,
  );
  console.log('');
  console.log('WORKER + D1 SMOKE PASSED');
  console.log('No Kimi runner, Hunter key or mailbox credential was required.');
  console.log('No external email was sent.');
}

main().catch((error) => {
  console.error('');
  console.error('WORKER + D1 SMOKE FAILED');
  console.error(
    error instanceof Error ? error.stack || error.message : String(error),
  );
  process.exitCode = 1;
});
