import {
  D1EventStore,
  D1JobQueue,
  D1ProspectRepository,
  OrchestratorEngine,
  loadConfig,
  scoreProspect,
  type D1DatabaseLike,
  type JobStatus,
  type MagicScriptJob,
  type Prospect,
  type ProspectOpportunity,
} from '@magicscript/core';

interface Env {
  DB?: D1DatabaseLike;
  MAGICSCRIPT_AUTOPILOT_ENABLED?: string;
  MAGICSCRIPT_SENDING_ENABLED?: string;
  MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED?: string;
  MAGICSCRIPT_DAILY_SEND_LIMIT?: string;
  MAGICSCRIPT_MAX_FOLLOWUPS?: string;
  MAGICSCRIPT_MIN_CONTACT_CONFIDENCE?: string;
  MAGICSCRIPT_MIN_OUTREACH_CONFIDENCE?: string;
  MAGICSCRIPT_AUTO_PROTOTYPE_SCORE?: string;
  MAGICSCRIPT_MIN_QUALIFY_SCORE?: string;
  MAGICSCRIPT_DATABASE_PROVIDER?: string;
  MAGICSCRIPT_EMAIL_PROVIDER?: string;
  MAGICSCRIPT_CONTROL_CENTER_ORIGIN?: string;
  MAGICSCRIPT_API_TOKEN?: string;
  MAGICSCRIPT_RUNNER_TOKEN?: string;
  MAGICSCRIPT_TARGET_LOCATION?: string;
  MAGICSCRIPT_DISCOVERY_BATCH_SIZE?: string;
}

interface ResearchResult {
  activity?: string;
  location?: string;
  websiteUrl?: string;
  opportunity?: ProspectOpportunity;
  primaryAsset?: string;
  primaryFriction?: string;
  primaryCta?: string;
  scoreInputs: {
    digitalGap: number;
    commercialStrength: number;
    contactability: number;
    localFit: number;
    prototypeLeverage: number;
    confidence: number;
  };
  sources?: Array<{ url: string; note?: string }>;
}

interface DiscoveryResult {
  prospects: Array<{
    companyName: string;
    activity?: string;
    location?: string;
    websiteUrl?: string;
    sourceUrl: string;
  }>;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function corsHeaders(env: Env, request: Request): HeadersInit {
  const configuredOrigin = env.MAGICSCRIPT_CONTROL_CENTER_ORIGIN?.trim();
  const requestOrigin = request.headers.get('origin');

  if (!configuredOrigin || !requestOrigin || requestOrigin !== configuredOrigin) {
    return {};
  }

  return {
    'access-control-allow-origin': configuredOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'vary': 'Origin',
  };
}

function withCors(response: Response, env: Env, request: Request): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(env, request))) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function requireDb(env: Env): D1DatabaseLike {
  if (!env.DB) {
    throw new Error('D1 binding DB is not configured');
  }
  return env.DB;
}

function bearer(request: Request): string | null {
  const value = request.headers.get('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice('Bearer '.length);
}

function isAuthorized(request: Request, secret?: string): boolean {
  if (!secret) return true;
  return bearer(request) === secret;
}

function requireApiAuth(request: Request, env: Env): Response | null {
  return isAuthorized(request, env.MAGICSCRIPT_API_TOKEN)
    ? null
    : json({ error: 'Unauthorized' }, { status: 401 });
}

function requireRunnerAuth(request: Request, env: Env): Response | null {
  return isAuthorized(request, env.MAGICSCRIPT_RUNNER_TOKEN)
    ? null
    : json({ error: 'Unauthorized runner' }, { status: 401 });
}

function configFromEnv(env: Env) {
  return loadConfig({
    MAGICSCRIPT_AUTOPILOT_ENABLED: env.MAGICSCRIPT_AUTOPILOT_ENABLED,
    MAGICSCRIPT_SENDING_ENABLED: env.MAGICSCRIPT_SENDING_ENABLED,
    MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: env.MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED,
    MAGICSCRIPT_DAILY_SEND_LIMIT: env.MAGICSCRIPT_DAILY_SEND_LIMIT,
    MAGICSCRIPT_MAX_FOLLOWUPS: env.MAGICSCRIPT_MAX_FOLLOWUPS,
    MAGICSCRIPT_MIN_CONTACT_CONFIDENCE: env.MAGICSCRIPT_MIN_CONTACT_CONFIDENCE,
    MAGICSCRIPT_MIN_OUTREACH_CONFIDENCE: env.MAGICSCRIPT_MIN_OUTREACH_CONFIDENCE,
    MAGICSCRIPT_AUTO_PROTOTYPE_SCORE: env.MAGICSCRIPT_AUTO_PROTOTYPE_SCORE,
    MAGICSCRIPT_DATABASE_PROVIDER: 'd1',
    MAGICSCRIPT_EMAIL_PROVIDER: env.MAGICSCRIPT_EMAIL_PROVIDER ?? 'disabled',
  });
}

function orchestrator(env: Env, db: D1DatabaseLike): OrchestratorEngine {
  return new OrchestratorEngine({
    config: configFromEnv(env),
    prospects: new D1ProspectRepository(db),
    events: new D1EventStore(db),
    jobs: new D1JobQueue(db),
  });
}

async function overview(db: D1DatabaseLike): Promise<Record<string, number>> {
  const queries = {
    prospects: 'SELECT COUNT(*) AS count FROM prospects',
    qualified:
      "SELECT COUNT(*) AS count FROM prospects WHERE state NOT IN ('DISCOVERED','RESEARCHING','RESEARCH_COMPLETE','DISQUALIFIED')",
    emailsSent: "SELECT COUNT(*) AS count FROM outreach_messages WHERE status = 'SENT'",
    replies: 'SELECT COUNT(*) AS count FROM replies',
    hotLeads:
      "SELECT COUNT(*) AS count FROM prospects WHERE state IN ('HOT_LEAD','MEETING_REQUESTED','PRICING_REQUESTED','CUSTOM_REQUEST','HUMAN_ACTION_REQUIRED')",
    prototypes: 'SELECT COUNT(*) AS count FROM prototypes',
    actionsRequired: "SELECT COUNT(*) AS count FROM human_escalations WHERE status = 'OPEN'",
  };

  const output: Record<string, number> = {};

  for (const [key, sql] of Object.entries(queries)) {
    const row = await db.prepare(sql).first<{ count: number }>();
    output[key] = row?.count ?? 0;
  }

  return output;
}

async function transitionOnClaim(
  job: MagicScriptJob,
  repo: D1ProspectRepository,
): Promise<void> {
  if (!job.prospectId) return;
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) return;

  if (job.kind === 'RUN_RESEARCH_SWARM' && prospect.state === 'DISCOVERED') {
    await repo.transitionProspect(prospect.id, 'RESEARCHING', 'Research job claimed');
  } else if (
    job.kind === 'DISCOVER_CONTACT' &&
    (prospect.state === 'QUALIFIED' || prospect.state === 'CONTACT_INVALID')
  ) {
    await repo.transitionProspect(prospect.id, 'CONTACT_DISCOVERY', 'Contact job claimed');
  } else if (
    job.kind === 'BUILD_PROTOTYPE' &&
    (prospect.state === 'PROTOTYPE_REQUIRED' || prospect.state === 'POSITIVE_REPLY')
  ) {
    await repo.transitionProspect(prospect.id, 'PROTOTYPE_BUILDING', 'Prototype job claimed');
  }
}

async function processDiscoveryResult(
  result: DiscoveryResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ created: string[]; skipped: string[] }> {
  const repo = new D1ProspectRepository(db);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const candidate of result.prospects ?? []) {
    if (!candidate.companyName?.trim() || !candidate.sourceUrl?.trim()) continue;

    const existing = await db
      .prepare(
        `SELECT id FROM prospects
         WHERE lower(company_name) = lower(?)
           AND lower(COALESCE(location, '')) = lower(COALESCE(?, ''))
         LIMIT 1`,
      )
      .bind(candidate.companyName.trim(), candidate.location ?? null)
      .first<{ id: string }>();

    if (existing) {
      skipped.push(existing.id);
      continue;
    }

    const now = new Date().toISOString();
    const prospect: Prospect = {
      id: crypto.randomUUID(),
      companyName: candidate.companyName.trim(),
      activity: candidate.activity,
      location: candidate.location,
      websiteUrl: candidate.websiteUrl,
      state: 'DISCOVERED',
      createdAt: now,
      updatedAt: now,
    };

    await repo.saveProspect(prospect);
    created.push(prospect.id);

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'research-agent',
      type: 'discovery.prospect_created',
      payload: { sourceUrl: candidate.sourceUrl },
      createdAt: now,
    });

    if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
      await orchestrator(env, db).planProspect(prospect.id);
    }
  }

  return { created, skipped };
}

async function processResearchResult(
  job: MagicScriptJob,
  result: ResearchResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; score: number; qualified: boolean }> {
  if (!job.prospectId) throw new Error('Research job has no prospectId');

  const repo = new D1ProspectRepository(db);
  const current = await repo.getProspect(job.prospectId);
  if (!current) throw new Error(`Prospect not found: ${job.prospectId}`);

  const scoring = scoreProspect(result.scoreInputs);
  const updated: Prospect = {
    ...current,
    activity: result.activity ?? current.activity,
    location: result.location ?? current.location,
    websiteUrl: result.websiteUrl ?? current.websiteUrl,
    opportunity: result.opportunity ?? current.opportunity,
    primaryAsset: result.primaryAsset ?? current.primaryAsset,
    primaryFriction: result.primaryFriction ?? current.primaryFriction,
    primaryCta: result.primaryCta ?? current.primaryCta,
    score: scoring.score,
    updatedAt: new Date().toISOString(),
  };

  await repo.saveProspect(updated);

  const afterSave = await repo.getProspect(job.prospectId);
  if (!afterSave) throw new Error('Prospect disappeared during research processing');

  if (afterSave.state === 'RESEARCHING') {
    await repo.transitionProspect(afterSave.id, 'RESEARCH_COMPLETE', 'Research swarm completed');
  }

  const minScore = Number.parseInt(env.MAGICSCRIPT_MIN_QUALIFY_SCORE ?? '65', 10) || 65;
  const qualified = scoring.score >= minScore;

  const ready = await repo.getProspect(job.prospectId);
  if (!ready) throw new Error('Prospect not found after research transition');

  if (ready.state === 'RESEARCH_COMPLETE') {
    await repo.transitionProspect(
      ready.id,
      qualified ? 'QUALIFIED' : 'DISQUALIFIED',
      qualified ? 'Score above qualification threshold' : 'Score below qualification threshold',
    );
  }

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: job.prospectId,
    actor: 'scoring-agent',
    type: 'research.scored',
    payload: {
      score: scoring.score,
      band: scoring.band,
      qualified,
      autoPrototypeEligible: scoring.autoPrototypeEligible,
      sources: result.sources ?? [],
    },
    createdAt: new Date().toISOString(),
  });

  if (qualified && env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    await orchestrator(env, db).planProspect(job.prospectId);
  }

  return { prospectId: job.prospectId, score: scoring.score, qualified };
}

async function processRunnerSuccess(
  job: MagicScriptJob,
  output: unknown,
  env: Env,
  db: D1DatabaseLike,
): Promise<unknown> {
  await db
    .prepare(
      `INSERT INTO job_results (job_id, output_json, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(job_id) DO UPDATE SET
         output_json = excluded.output_json,
         created_at = excluded.created_at`,
    )
    .bind(job.id, JSON.stringify(output), new Date().toISOString())
    .run();

  if (job.kind === 'DISCOVER_PROSPECTS') {
    return processDiscoveryResult(output as DiscoveryResult, env, db);
  }

  if (job.kind === 'RUN_RESEARCH_SWARM') {
    return processResearchResult(job, output as ResearchResult, env, db);
  }

  return { stored: true, processed: false };
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env, request) });
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    return json({
      ok: true,
      service: 'magicscript-api',
      databaseConfigured: Boolean(env.DB),
      apiAuthConfigured: Boolean(env.MAGICSCRIPT_API_TOKEN),
      runnerAuthConfigured: Boolean(env.MAGICSCRIPT_RUNNER_TOKEN),
      autopilotEnabled: env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true',
      sendingEnabled: env.MAGICSCRIPT_SENDING_ENABLED === 'true',
      prototypeDeployEnabled: env.MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED === 'true',
    });
  }

  if (url.pathname.startsWith('/api/runner/')) {
    const unauthorized = requireRunnerAuth(request, env);
    if (unauthorized) return unauthorized;
  } else if (url.pathname.startsWith('/api/')) {
    const unauthorized = requireApiAuth(request, env);
    if (unauthorized) return unauthorized;
  }

  if (request.method === 'GET' && url.pathname === '/api/overview') {
    return json(await overview(requireDb(env)));
  }

  if (request.method === 'GET' && url.pathname === '/api/prospects') {
    const repo = new D1ProspectRepository(requireDb(env));
    return json({ prospects: await repo.listProspects() });
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/prospects/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/prospects/'.length));
    const repo = new D1ProspectRepository(requireDb(env));
    const prospect = await repo.getProspect(id);
    if (!prospect) return json({ error: 'Prospect not found' }, { status: 404 });
    return json({ prospect, contacts: await repo.listContacts(id) });
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
    const events = new D1EventStore(requireDb(env));
    return json({ events: await events.listRecent(Number.isFinite(limit) ? limit : 100) });
  }

  if (request.method === 'GET' && url.pathname === '/api/jobs') {
    const statusParam = url.searchParams.get('status');
    const allowedStatuses = new Set<JobStatus>([
      'PENDING',
      'RUNNING',
      'SUCCEEDED',
      'FAILED',
      'DEAD_LETTER',
    ]);

    const status =
      statusParam && allowedStatuses.has(statusParam as JobStatus)
        ? (statusParam as JobStatus)
        : undefined;

    const jobs = new D1JobQueue(requireDb(env));
    return json({ jobs: await jobs.list(status) });
  }

  if (request.method === 'GET' && url.pathname === '/api/escalations') {
    const limit = Math.max(
      1,
      Math.min(Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 100),
    );

    const result = await requireDb(env)
      .prepare(
        "SELECT id, prospect_id, category, summary, status, source_event_id, created_at, resolved_at FROM human_escalations WHERE status = 'OPEN' ORDER BY created_at DESC LIMIT ?",
      )
      .bind(limit)
      .all<Record<string, unknown>>();

    return json({ escalations: result.results ?? [] });
  }

  if (request.method === 'POST' && url.pathname === '/api/autopilot/tick') {
    if (env.MAGICSCRIPT_AUTOPILOT_ENABLED !== 'true') {
      return json({ queued: false, reason: 'Autopilot disabled' });
    }

    const db = requireDb(env);
    const existing = await db
      .prepare(
        "SELECT id FROM jobs WHERE kind = 'DISCOVER_PROSPECTS' AND status IN ('PENDING','RUNNING') LIMIT 1",
      )
      .first<{ id: string }>();

    if (existing) {
      return json({ queued: false, reason: 'Discovery job already active', jobId: existing.id });
    }

    const location = env.MAGICSCRIPT_TARGET_LOCATION?.trim() || 'Martinique';
    const limit = Number.parseInt(env.MAGICSCRIPT_DISCOVERY_BATCH_SIZE ?? '20', 10) || 20;
    const queue = new D1JobQueue(db);
    const now = new Date().toISOString();

    const job = await queue.enqueue({
      id: crypto.randomUUID(),
      kind: 'DISCOVER_PROSPECTS',
      payload: { location, limit },
      maxAttempts: 3,
      runAfter: now,
    });

    return json({ queued: true, job });
  }

  if (request.method === 'POST' && url.pathname === '/api/orchestrator/plan') {
    const body = (await request.json()) as { prospectId?: string };
    if (!body.prospectId) {
      return json({ error: 'prospectId is required' }, { status: 400 });
    }

    return json(await orchestrator(env, requireDb(env)).planProspect(body.prospectId));
  }

  if (request.method === 'POST' && url.pathname === '/api/runner/jobs/claim') {
    const db = requireDb(env);
    const queue = new D1JobQueue(db);
    const job = await queue.next();

    if (!job) {
      return new Response(null, { status: 204 });
    }

    const repo = new D1ProspectRepository(db);
    await transitionOnClaim(job, repo);

    const prospect = job.prospectId ? await repo.getProspect(job.prospectId) : null;
    const contacts = job.prospectId ? await repo.listContacts(job.prospectId) : [];

    return json({ job, prospect, contacts });
  }

  const successMatch = url.pathname.match(/^\/api\/runner\/jobs\/([^/]+)\/succeed$/);
  if (request.method === 'POST' && successMatch) {
    const jobId = decodeURIComponent(successMatch[1]);
    const db = requireDb(env);
    const queue = new D1JobQueue(db);
    const row = await db
      .prepare('SELECT * FROM jobs WHERE id = ? LIMIT 1')
      .bind(jobId)
      .first<{
        id: string;
        kind: MagicScriptJob['kind'];
        prospect_id: string | null;
        payload_json: string;
        status: JobStatus;
        attempts: number;
        max_attempts: number;
        run_after: string;
        created_at: string;
        updated_at: string;
        last_error: string | null;
      }>();

    if (!row) return json({ error: 'Job not found' }, { status: 404 });

    const job: MagicScriptJob = {
      id: row.id,
      kind: row.kind,
      prospectId: row.prospect_id ?? undefined,
      payload: JSON.parse(row.payload_json),
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      runAfter: row.run_after,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastError: row.last_error ?? undefined,
    };

    const body = (await request.json()) as { output?: unknown };
    const processed = await processRunnerSuccess(job, body.output, env, db);
    await queue.markSucceeded(job.id);

    return json({ ok: true, processed });
  }

  const failMatch = url.pathname.match(/^\/api\/runner\/jobs\/([^/]+)\/fail$/);
  if (request.method === 'POST' && failMatch) {
    const jobId = decodeURIComponent(failMatch[1]);
    const body = (await request.json()) as { error?: string; retryDelayMs?: number };
    const retryDelayMs = Math.max(1_000, Math.min(body.retryDelayMs ?? 30_000, 15 * 60_000));
    const retryAfter = new Date(Date.now() + retryDelayMs);
    await new D1JobQueue(requireDb(env)).markFailed(
      jobId,
      body.error ?? 'Runner reported failure',
      retryAfter,
    );

    return json({ ok: true, retryAfter: retryAfter.toISOString() });
  }

  return json({ error: 'Not found' }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const response = await handle(request, env);
      return withCors(response, env, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return withCors(
        json({ error: message }, { status: message.includes('not configured') ? 503 : 500 }),
        env,
        request,
      );
    }
  },
};
