import {
  D1EventStore,
  D1JobQueue,
  D1ProspectRepository,
  OrchestratorEngine,
  loadConfig,
  type D1DatabaseLike,
  type JobStatus,
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
  MAGICSCRIPT_DATABASE_PROVIDER?: string;
  MAGICSCRIPT_EMAIL_PROVIDER?: string;
  MAGICSCRIPT_CONTROL_CENTER_ORIGIN?: string;
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
    'access-control-allow-headers': 'content-type',
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

async function overview(db: D1DatabaseLike): Promise<Record<string, number>> {
  const queries = {
    prospects: 'SELECT COUNT(*) AS count FROM prospects',
    qualified: "SELECT COUNT(*) AS count FROM prospects WHERE state NOT IN ('DISCOVERED','RESEARCHING','RESEARCH_COMPLETE','DISQUALIFIED')",
    emailsSent: "SELECT COUNT(*) AS count FROM outreach_messages WHERE status = 'SENT'",
    replies: 'SELECT COUNT(*) AS count FROM replies',
    hotLeads: "SELECT COUNT(*) AS count FROM prospects WHERE state IN ('HOT_LEAD','MEETING_REQUESTED','PRICING_REQUESTED','CUSTOM_REQUEST','HUMAN_ACTION_REQUIRED')",
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
      autopilotEnabled: env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true',
      sendingEnabled: env.MAGICSCRIPT_SENDING_ENABLED === 'true',
      prototypeDeployEnabled: env.MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED === 'true',
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/overview') {
    return json(await overview(requireDb(env)));
  }

  if (request.method === 'GET' && url.pathname === '/api/prospects') {
    const repo = new D1ProspectRepository(requireDb(env));
    return json({ prospects: await repo.listProspects() });
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

  if (request.method === 'POST' && url.pathname === '/api/orchestrator/plan') {
    const body = (await request.json()) as { prospectId?: string };
    if (!body.prospectId) {
      return json({ error: 'prospectId is required' }, { status: 400 });
    }

    const db = requireDb(env);
    const engine = new OrchestratorEngine({
      config: loadConfig({
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
      }),
      prospects: new D1ProspectRepository(db),
      events: new D1EventStore(db),
      jobs: new D1JobQueue(db),
    });

    return json(await engine.planProspect(body.prospectId));
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
