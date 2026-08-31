import {
  D1EventStore,
  D1JobQueue,
  D1ProspectRepository,
  HunterClient,
  InseeSireneClient,
  RechercheEntreprisesClient,
  OrchestratorEngine,
  canTransition,
  currentSirenePeriod,
  domainFromWebsite,
  getNextAction,
  isMagicScriptTargetActivity,
  rechercheEntrepriseActivity,
  rechercheEntrepriseLocation,
  rechercheEntrepriseMatchingEtablissement,
  rechercheEntrepriseName,
  rechercheEntrepriseSourceUrl,
  loadConfig,
  scoreProspect,
  shouldEscalateOutreachFactCheck,
  sireneBusinessName,
  sireneLocation,
  sirenePublicSourceUrl,
  type D1DatabaseLike,
  type JobStatus,
  type MagicScriptJob,
  type Prospect,
  type ProspectContact,
  type ProspectOpportunity,
} from '@magicscript/core';

interface Env {
  DB?: D1DatabaseLike;
  MAGICSCRIPT_AUTOPILOT_ENABLED?: string;
  MAGICSCRIPT_SENDING_ENABLED?: string;
  MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED?: string;
  MAGICSCRIPT_DAILY_SEND_LIMIT?: string;
  MAGICSCRIPT_MAX_FOLLOWUPS?: string;
  MAGICSCRIPT_FOLLOWUP_1_DAYS?: string;
  MAGICSCRIPT_FOLLOWUP_2_DAYS?: string;
  MAGICSCRIPT_JOB_LEASE_MINUTES?: string;
  MAGICSCRIPT_MIN_CONTACT_CONFIDENCE?: string;
  MAGICSCRIPT_MIN_OUTREACH_CONFIDENCE?: string;
  MAGICSCRIPT_AUTO_PROTOTYPE_SCORE?: string;
  MAGICSCRIPT_MIN_QUALIFY_SCORE?: string;
  MAGICSCRIPT_DATABASE_PROVIDER?: string;
  MAGICSCRIPT_EMAIL_PROVIDER?: string;
  MAGICSCRIPT_TEST_EMAIL_MODE?: string;
  MAGICSCRIPT_TEST_RECIPIENT?: string;
  MAGICSCRIPT_CONTROL_CENTER_ORIGIN?: string;
  MAGICSCRIPT_API_TOKEN?: string;
  MAGICSCRIPT_RUNNER_TOKEN?: string;
  MAGICSCRIPT_TARGET_LOCATION?: string;
  MAGICSCRIPT_DISCOVERY_BATCH_SIZE?: string;
  HUNTER_API_KEY?: string;
  HUNTER_MONTHLY_CREDIT_BUDGET?: string;
  INSEE_SIRENE_API_KEY?: string;
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

interface ContactResult {
  contacts: Array<{
    email: string;
    sourceUrl: string;
    sourceType: ProspectContact['sourceType'];
    confidence: number;
    verified: boolean;
  }>;
}

interface OutreachResult {
  subject: string;
  body: string;
  factsUsed?: string[];
  sourceRefs?: string[];
  confidence: number;
  readyToSend: boolean;
  blockingReasons?: string[];
}

interface FactCheckResult {
  approved: boolean;
  confidence: number;
  reasons?: string[];
}

interface ExternalSendResult {
  provider: 'amen-smtp';
  providerMessageId: string;
  recipient: string;
  originalRecipient?: string;
  testMode?: boolean;
  accepted?: string[];
  rejected?: string[];
  deliveredExternally: boolean;
}

interface ClassificationResult {
  classification:
    | 'NO_INTEREST'
    | 'AUTO_REPLY'
    | 'INFORMATION_REQUEST'
    | 'POSITIVE_INTEREST'
    | 'PRICING_REQUESTED'
    | 'MEETING_REQUESTED'
    | 'CUSTOM_REQUEST'
    | 'COMPLAINT_OR_LEGAL';
  confidence: number;
  summary: string;
  doNotContact?: boolean;
}

interface InformationResponseResult {
  subject: string;
  body: string;
  factsUsed?: string[];
  sourceRefs?: string[];
  confidence: number;
  readyToSend: boolean;
  humanRequired: boolean;
  blockingReasons?: string[];
}

interface InformationResponseFactCheckResult {
  approved: boolean;
  confidence: number;
  reasons?: string[];
}

interface PrototypeStrategyResult {
  objective: string;
  targetCustomer: string;
  primaryAsset: string;
  primaryFriction: string;
  valueProposition: string;
  hero: {
    headlineDirection: string;
    supportingMessage: string;
    primaryCta: string;
  };
  sections: string[];
  commercialProof: string[];
  factsAllowed: string[];
  factsForbiddenOrUnverified: string[];
  mobilePriorities: string[];
  conversionStrategy: string;
  confidence: number;
  humanRequired?: boolean;
  blockingReasons?: string[];
}

interface PrototypeBuildResult {
  workDir: string;
  buildPassed: boolean;
  agentSummary?: string;
  buildOutput?: string;
  filesCreated?: number;
}

interface PrototypeDeployResult {
  deployed: boolean;
  deploymentUrl: string;
  projectName: string;
  branch: string;
  output?: string;
}

interface PrototypeQaResult {
  pass: boolean;
  safeForOutreach: boolean;
  blockingFindings: string[];
  warnings?: string[];
  recommendedFixes?: string[];
  technicalBuildPassed?: boolean;
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

async function handleTerminalJobFailure(
  prospectId: string,
  kind: MagicScriptJob['kind'],
  error: string,
  db: D1DatabaseLike,
): Promise<void> {
  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(prospectId);
  if (!prospect) return;

  const terminalStates = new Set([
    'DISQUALIFIED',
    'DO_NOT_CONTACT',
    'CLOSED_WON',
    'CLOSED_LOST',
  ]);

  if (terminalStates.has(prospect.state)) return;

  if (
    kind === 'RUN_RESEARCH_SWARM' &&
    prospect.state === 'RESEARCHING' &&
    canTransition(prospect.state, 'DISQUALIFIED')
  ) {
    await repo.transitionProspect(
      prospect.id,
      'DISQUALIFIED',
      'Research automation exhausted technical retries',
    );

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type: 'automation.terminal_failure_archived',
      payload: { kind, error },
      createdAt: new Date().toISOString(),
    });
    return;
  }

  if (
    kind === 'DISCOVER_CONTACT' &&
    (prospect.state === 'CONTACT_DISCOVERY' ||
      prospect.state === 'CONTACT_INVALID') &&
    canTransition(prospect.state, 'DISQUALIFIED')
  ) {
    await repo.transitionProspect(
      prospect.id,
      'DISQUALIFIED',
      'Contact discovery exhausted technical retries',
    );

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type: 'automation.terminal_failure_archived',
      payload: { kind, error },
      createdAt: new Date().toISOString(),
    });
    return;
  }

  if (
    prospect.state !== 'HUMAN_ACTION_REQUIRED' &&
    canTransition(prospect.state, 'HUMAN_ACTION_REQUIRED')
  ) {
    await repo.transitionProspect(
      prospect.id,
      'HUMAN_ACTION_REQUIRED',
      `Automation job ${kind} exhausted retries`,
    );
  }

  await createEscalation(
    db,
    prospect.id,
    'MANUAL_REVIEW_REQUIRED',
    `Automation job ${kind} could not recover after retries: ${error.slice(0, 1200)}`,
  );

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'system',
    type: 'automation.terminal_failure',
    payload: { kind, error },
    createdAt: new Date().toISOString(),
  });
}

async function recoverStaleJobs(
  env: Env,
  db: D1DatabaseLike,
): Promise<{ recovered: number; deadLettered: number }> {
  const leaseMinutes = Math.max(
    5,
    Number.parseInt(env.MAGICSCRIPT_JOB_LEASE_MINUTES ?? '30', 10) || 30,
  );
  const cutoff = new Date(Date.now() - leaseMinutes * 60_000).toISOString();
  const now = new Date().toISOString();

  const stale = await db
    .prepare(
      `SELECT
         id,
         prospect_id,
         kind,
         attempts,
         max_attempts,
         claimed_by
       FROM jobs
       WHERE status = 'RUNNING'
         AND claimed_at IS NOT NULL
         AND claimed_at < ?
       ORDER BY claimed_at ASC
       LIMIT 100`,
    )
    .bind(cutoff)
    .all<{
      id: string;
      prospect_id: string | null;
      kind: MagicScriptJob['kind'];
      attempts: number;
      max_attempts: number;
      claimed_by: string | null;
    }>();

  let recovered = 0;
  let deadLettered = 0;

  for (const job of stale.results ?? []) {
    const exhausted = job.attempts >= job.max_attempts;

    if (exhausted) {
      await db
        .prepare(
          `UPDATE jobs
           SET status = 'DEAD_LETTER',
               last_error = ?,
               updated_at = ?
           WHERE id = ? AND status = 'RUNNING'`,
        )
        .bind(
          `Runner lease expired after ${leaseMinutes} minutes`,
          now,
          job.id,
        )
        .run();

      deadLettered += 1;

      if (job.prospect_id) {
        await handleTerminalJobFailure(
          job.prospect_id,
          job.kind,
          `Runner lease expired after ${leaseMinutes} minutes`,
          db,
        );
      }
    } else {
      await db
        .prepare(
          `UPDATE jobs
           SET status = 'PENDING',
               claimed_by = NULL,
               claimed_at = NULL,
               run_after = ?,
               last_error = ?,
               updated_at = ?
           WHERE id = ? AND status = 'RUNNING'`,
        )
        .bind(
          now,
          `Recovered after runner lease expired (${leaseMinutes} minutes)`,
          now,
          job.id,
        )
        .run();

      recovered += 1;
    }

    if (job.claimed_by) {
      await db
        .prepare(
          `UPDATE runners
           SET status = 'ERROR',
               current_job_id = NULL,
               last_seen_at = ?
           WHERE runner_id = ?`,
        )
        .bind(now, job.claimed_by)
        .run();
    }
  }

  return { recovered, deadLettered };
}

async function reconcileAutopilot(
  env: Env,
  db: D1DatabaseLike,
): Promise<{ scanned: number; planned: number; blocked: number }> {
  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED !== 'true') {
    return { scanned: 0, planned: 0, blocked: 0 };
  }

  const repo = new D1ProspectRepository(db);
  const prospects = (await repo.listProspects()).slice(0, 250);
  let planned = 0;
  let blocked = 0;

  for (const prospect of prospects) {
    const action = getNextAction(prospect.state);

    if (
      action === 'WAIT' ||
      action === 'STOP' ||
      action === 'ARCHIVE' ||
      action === 'SCHEDULE_FOLLOW_UP'
    ) {
      continue;
    }

    const plan = await orchestrator(env, db).planProspect(prospect.id);
    if (plan.queuedJobId) {
      planned += 1;
    } else if (plan.reason) {
      blocked += 1;
    }
  }

  return {
    scanned: prospects.length,
    planned,
    blocked,
  };
}

async function getProviderState(
  db: D1DatabaseLike,
  provider: string,
  key: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      'SELECT value FROM provider_state WHERE provider = ? AND key = ? LIMIT 1',
    )
    .bind(provider, key)
    .first<{ value: string | null }>();

  return row?.value ?? null;
}

async function setProviderState(
  db: D1DatabaseLike,
  provider: string,
  key: string,
  value: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO provider_state (provider, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(provider, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    )
    .bind(provider, key, value, new Date().toISOString())
    .run();
}

async function discoverViaRechercheEntreprises(
  env: Env,
  db: D1DatabaseLike,
): Promise<{
  attempted: boolean;
  created: string[];
  skipped: string[];
  scanned: number;
  page: number;
  totalPages: number;
}> {
  const batchSize =
    Number.parseInt(env.MAGICSCRIPT_DISCOVERY_BATCH_SIZE ?? '20', 10) || 20;
  const perPage = Math.max(1, Math.min(batchSize, 25));
  const storedPage = Number.parseInt(
    (await getProviderState(
      db,
      'recherche-entreprises',
      'martinique-page',
    )) ?? '1',
    10,
  );
  const pageNumber =
    Number.isFinite(storedPage) && storedPage > 0 ? storedPage : 1;

  const client = new RechercheEntreprisesClient();
  const page = await client.search({
    departement: '972',
    sections: ['F', 'G', 'I', 'L', 'M', 'N', 'R', 'S'],
    page: pageNumber,
    perPage,
  });

  const candidates: DiscoveryResult['prospects'] = [];

  for (const result of page.results) {
    if (candidates.length >= batchSize) break;
    if (result.etat_administratif && result.etat_administratif !== 'A') continue;
    if (
      result.siege?.etat_administratif &&
      result.siege.etat_administratif !== 'A'
    ) {
      continue;
    }

    const localEstablishment =
      rechercheEntrepriseMatchingEtablissement(result, '972');
    if (!localEstablishment) continue;

    const companyName = rechercheEntrepriseName(
      result,
      localEstablishment,
    );
    if (!companyName || !result.siren) continue;

    candidates.push({
      companyName,
      activity: rechercheEntrepriseActivity(
        result,
        localEstablishment,
      ),
      location: rechercheEntrepriseLocation(
        result,
        localEstablishment,
      ),
      sourceUrl: rechercheEntrepriseSourceUrl(
        result,
        localEstablishment,
      ),
    });
  }

  const processed = await processDiscoveryResult(
    { prospects: candidates },
    env,
    db,
  );

  const nextPage = page.page >= page.totalPages ? 1 : page.page + 1;
  await setProviderState(
    db,
    'recherche-entreprises',
    'martinique-page',
    String(nextPage),
  );

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    actor: 'system',
    type: 'discovery.recherche_entreprises_batch',
    payload: {
      page: page.page,
      nextPage,
      totalPages: page.totalPages,
      scanned: page.results.length,
      candidates: candidates.length,
      created: processed.created.length,
      skipped: processed.skipped.length,
      authRequired: false,
      monetaryCost: 0,
    },
    createdAt: new Date().toISOString(),
  });

  return {
    attempted: true,
    created: processed.created,
    skipped: processed.skipped,
    scanned: page.results.length,
    page: page.page,
    totalPages: page.totalPages,
  };
}

async function discoverViaSirene(
  env: Env,
  db: D1DatabaseLike,
): Promise<{
  attempted: boolean;
  created: string[];
  skipped: string[];
  scanned: number;
}> {
  const apiKey = env.INSEE_SIRENE_API_KEY?.trim();
  if (!apiKey) {
    return { attempted: false, created: [], skipped: [], scanned: 0 };
  }

  const batchSize =
    Number.parseInt(env.MAGICSCRIPT_DISCOVERY_BATCH_SIZE ?? '20', 10) || 20;
  const pageSize = Math.max(50, Math.min(batchSize * 5, 200));
  const storedCursor =
    (await getProviderState(db, 'insee-sirene', 'martinique-cursor')) || '*';

  const client = new InseeSireneClient(apiKey);
  const page = await client.searchEstablishments({
    query:
      'periode(etatAdministratifEtablissement:A) AND codePostalEtablissement:[97200 TO 97299]',
    number: pageSize,
    cursor: storedCursor,
  });

  const nextCursor =
    page.nextCursor && page.nextCursor !== storedCursor
      ? page.nextCursor
      : '*';

  await setProviderState(
    db,
    'insee-sirene',
    'martinique-cursor',
    nextCursor,
  );

  const candidates: DiscoveryResult['prospects'] = [];

  for (const establishment of page.establishments) {
    if (candidates.length >= batchSize) break;

    const period = currentSirenePeriod(establishment);
    if (
      period?.etatAdministratifEtablissement !== 'A' ||
      !isMagicScriptTargetActivity(period.activitePrincipaleEtablissement)
    ) {
      continue;
    }

    const companyName = sireneBusinessName(establishment);
    if (!companyName) continue;

    candidates.push({
      companyName,
      activity: period.activitePrincipaleEtablissement ?? undefined,
      location: sireneLocation(establishment),
      sourceUrl: sirenePublicSourceUrl(establishment.siret),
    });
  }

  const processed = await processDiscoveryResult(
    { prospects: candidates },
    env,
    db,
  );

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    actor: 'system',
    type: 'discovery.sirene_batch',
    payload: {
      scanned: page.establishments.length,
      eligible: candidates.length,
      created: processed.created.length,
      skipped: processed.skipped.length,
      totalAvailable: page.total,
      cursorAdvanced: nextCursor !== '*',
    },
    createdAt: new Date().toISOString(),
  });

  return {
    attempted: true,
    created: processed.created,
    skipped: processed.skipped,
    scanned: page.establishments.length,
  };
}

async function enqueueDiscoveryIfNeeded(
  env: Env,
  db: D1DatabaseLike,
): Promise<{
  queued: boolean;
  reason?: string;
  jobId?: string;
  provider?: 'recherche-entreprises' | 'insee-sirene' | 'kimi';
  created?: number;
  scanned?: number;
}> {
  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED !== 'true') {
    return { queued: false, reason: 'Autopilot disabled' };
  }

  // First choice: official open API, no key and no monetary API cost.
  try {
    const directory = await discoverViaRechercheEntreprises(env, db);
    if (directory.created.length > 0) {
      return {
        queued: false,
        provider: 'recherche-entreprises',
        created: directory.created.length,
        scanned: directory.scanned,
        reason: 'Open API Recherche d’entreprises discovery completed',
      };
    }
  } catch (error) {
    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      actor: 'system',
      type: 'discovery.recherche_entreprises_failed',
      payload: {
        message: error instanceof Error ? error.message : String(error),
        fallback: env.INSEE_SIRENE_API_KEY?.trim() ? 'insee-sirene' : 'kimi',
      },
      createdAt: new Date().toISOString(),
    });
  }

  // Optional second structured source if an INSEE key exists.
  if (env.INSEE_SIRENE_API_KEY?.trim()) {
    try {
      const sirene = await discoverViaSirene(env, db);
      if (sirene.attempted && sirene.created.length > 0) {
        return {
          queued: false,
          provider: 'insee-sirene',
          created: sirene.created.length,
          scanned: sirene.scanned,
          reason: 'Free INSEE Sirene discovery completed',
        };
      }
    } catch (error) {
      await new D1EventStore(db).append({
        id: crypto.randomUUID(),
        actor: 'system',
        type: 'discovery.sirene_failed',
        payload: {
          message: error instanceof Error ? error.message : String(error),
          fallback: 'kimi',
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  const existing = await db
    .prepare(
      "SELECT id FROM jobs WHERE kind = 'DISCOVER_PROSPECTS' AND status IN ('PENDING','RUNNING') LIMIT 1",
    )
    .first<{ id: string }>();

  if (existing) {
    return {
      queued: false,
      reason: 'Discovery job already active',
      jobId: existing.id,
    };
  }

  const location = env.MAGICSCRIPT_TARGET_LOCATION?.trim() || 'Martinique';
  const limit =
    Number.parseInt(env.MAGICSCRIPT_DISCOVERY_BATCH_SIZE ?? '20', 10) || 20;
  const queue = new D1JobQueue(db);
  const job = await queue.enqueue({
    id: crypto.randomUUID(),
    kind: 'DISCOVER_PROSPECTS',
    payload: { location, limit },
    maxAttempts: 3,
    runAfter: new Date().toISOString(),
  });

  return { queued: true, jobId: job.id, provider: 'kimi' };
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
    prospect.state === 'PROTOTYPE_STRATEGY_GENERATED'
  ) {
    await repo.transitionProspect(prospect.id, 'PROTOTYPE_BUILDING', 'Prototype job claimed');
  } else if (
    job.kind === 'DEPLOY_PROTOTYPE' &&
    prospect.state === 'PROTOTYPE_READY'
  ) {
    await repo.transitionProspect(
      prospect.id,
      'PROTOTYPE_DEPLOYING',
      'Prototype deployment job claimed',
    );
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

function currentPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

async function hunterCreditsUsed(
  db: D1DatabaseLike,
  period = currentPeriod(),
): Promise<number> {
  const row = await db
    .prepare(
      "SELECT units FROM provider_usage WHERE provider = 'hunter' AND period = ? LIMIT 1",
    )
    .bind(period)
    .first<{ units: number }>();

  return row?.units ?? 0;
}

async function incrementHunterCredits(
  db: D1DatabaseLike,
  units = 1,
  period = currentPeriod(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO provider_usage (provider, period, units, updated_at)
       VALUES ('hunter', ?, ?, ?)
       ON CONFLICT(provider, period) DO UPDATE SET
         units = provider_usage.units + excluded.units,
         updated_at = excluded.updated_at`,
    )
    .bind(period, units, new Date().toISOString())
    .run();
}

async function tryHunterContactFallback(
  prospect: Prospect,
  env: Env,
  db: D1DatabaseLike,
  minConfidence: number,
): Promise<ProspectContact | null> {
  const apiKey = env.HUNTER_API_KEY?.trim();
  if (!apiKey) return null;

  const budget =
    Number.parseInt(env.HUNTER_MONTHLY_CREDIT_BUDGET ?? '40', 10) || 40;
  const used = await hunterCreditsUsed(db);
  if (used >= budget) {
    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'contact-agent',
      type: 'contact.hunter_budget_exhausted',
      payload: { used, budget, period: currentPeriod() },
      createdAt: new Date().toISOString(),
    });
    return null;
  }

  const domain = domainFromWebsite(prospect.websiteUrl);
  const lookup = domain
    ? { domain }
    : { company: prospect.companyName };

  const hunter = new HunterClient(apiKey);

  const count = await hunter.emailCount(lookup);
  if (count.total <= 0) {
    return null;
  }

  const search = await hunter.domainSearch({
    ...lookup,
    limit: 10,
  });

  if (search.emails.length > 0) {
    await incrementHunterCredits(db, 1);
  }

  const ranked = [...search.emails]
    .filter((candidate) => candidate.value?.trim())
    .sort((a, b) => {
      const genericA = a.type === 'generic' ? 1 : 0;
      const genericB = b.type === 'generic' ? 1 : 0;
      if (genericA !== genericB) return genericB - genericA;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });

  for (const candidate of ranked) {
    const email = candidate.value.trim().toLowerCase();
    const confidence = Math.max(
      0,
      Math.min(100, Number(candidate.confidence) || 0),
    );
    const sourceUrl = candidate.sources?.find((source) => source.uri)?.uri;

    if (confidence < minConfidence || !sourceUrl) continue;

    const suppressed = await db
      .prepare(
        'SELECT email FROM suppression_list WHERE lower(email) = lower(?) LIMIT 1',
      )
      .bind(email)
      .first<{ email: string }>();

    if (suppressed) continue;

    const now = new Date().toISOString();
    const contact: ProspectContact = {
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      email,
      sourceUrl,
      sourceType: 'other_public_source',
      confidence,
      isValidated: true,
      isSuppressed: false,
      createdAt: now,
      updatedAt: now,
    };

    await new D1ProspectRepository(db).saveContact(contact);

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'contact-agent',
      type: 'contact.hunter_fallback_found',
      payload: {
        email,
        confidence,
        type: candidate.type ?? null,
        sourceUrl,
        creditsUsedThisPeriod: await hunterCreditsUsed(db),
        creditBudget: budget,
      },
      createdAt: now,
    });

    return contact;
  }

  return null;
}

async function processContactResult(
  job: MagicScriptJob,
  result: ContactResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; validContact: boolean; retrying: boolean }> {
  if (!job.prospectId) throw new Error('Contact job has no prospectId');

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  const minConfidence = configFromEnv(env).minContactConfidence;
  let best: ProspectContact | null = null;

  for (const candidate of result.contacts ?? []) {
    if (!candidate.email?.trim() || !candidate.sourceUrl?.trim()) continue;

    const suppressed = await db
      .prepare('SELECT email FROM suppression_list WHERE lower(email) = lower(?) LIMIT 1')
      .bind(candidate.email.trim())
      .first<{ email: string }>();

    const confidence = Math.max(0, Math.min(100, Number(candidate.confidence) || 0));
    const now = new Date().toISOString();
    const contact: ProspectContact = {
      id: crypto.randomUUID(),
      prospectId: job.prospectId,
      email: candidate.email.trim().toLowerCase(),
      sourceUrl: candidate.sourceUrl,
      sourceType: candidate.sourceType ?? 'other_public_source',
      confidence,
      isValidated: candidate.verified === true && confidence >= minConfidence && !suppressed,
      isSuppressed: Boolean(suppressed),
      createdAt: now,
      updatedAt: now,
    };

    await repo.saveContact(contact);

    if (
      contact.isValidated &&
      !contact.isSuppressed &&
      (!best || (contact.confidence ?? 0) > (best.confidence ?? 0))
    ) {
      best = contact;
    }
  }

  const current = await repo.getProspect(job.prospectId);
  if (!current) throw new Error('Prospect disappeared during contact processing');

  if (best) {
    if (current.state === 'CONTACT_DISCOVERY') {
      await repo.transitionProspect(
        current.id,
        'CONTACT_FOUND',
        'Validated professional email found',
      );
      await repo.transitionProspect(
        current.id,
        'PROTOTYPE_REQUIRED',
        'Validated contact qualifies for a pre-outreach prototype',
      );
    }

    if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
      await orchestrator(env, db).planProspect(job.prospectId);
    }

    return { prospectId: job.prospectId, validContact: true, retrying: false };
  }

  if (current.state === 'CONTACT_DISCOVERY') {
    await repo.transitionProspect(current.id, 'CONTACT_INVALID', 'No reliable professional email found');
  }

  const prior = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM jobs WHERE prospect_id = ? AND kind = 'DISCOVER_CONTACT' AND status = 'SUCCEEDED'",
    )
    .bind(job.prospectId)
    .first<{ count: number }>();

  const alreadyRetried = (prior?.count ?? 0) >= 1;
  const afterInvalid = await repo.getProspect(job.prospectId);

  if (alreadyRetried && afterInvalid?.state === 'CONTACT_INVALID') {
    const hunterContact = await tryHunterContactFallback(
      afterInvalid,
      env,
      db,
      minConfidence,
    );

    if (hunterContact) {
      await repo.transitionProspect(
        job.prospectId,
        'CONTACT_DISCOVERY',
        'Hunter free API fallback returned a sourced professional email',
      );
      await repo.transitionProspect(
        job.prospectId,
        'CONTACT_FOUND',
        'Hunter fallback contact passed confidence and source gates',
      );
      await repo.transitionProspect(
        job.prospectId,
        'PROTOTYPE_REQUIRED',
        'Validated fallback contact qualifies for a pre-outreach prototype',
      );

      if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
        await orchestrator(env, db).planProspect(job.prospectId);
      }

      return {
        prospectId: job.prospectId,
        validContact: true,
        retrying: false,
      };
    }

    await repo.transitionProspect(
      job.prospectId,
      'DISQUALIFIED',
      'No reliable contact after public-source retries and Hunter fallback',
    );
    return { prospectId: job.prospectId, validContact: false, retrying: false };
  }

  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    await orchestrator(env, db).planProspect(job.prospectId);
  }

  return { prospectId: job.prospectId, validContact: false, retrying: true };
}

async function processOutreachResult(
  job: MagicScriptJob,
  result: OutreachResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; messageId: string }> {
  if (!job.prospectId) throw new Error('Outreach job has no prospectId');
  if (!result.readyToSend) {
    throw new Error(
      `Outreach draft blocked: ${(result.blockingReasons ?? ['unknown reason']).join('; ')}`,
    );
  }
  if (!result.subject?.trim() || !result.body?.trim()) {
    throw new Error('Outreach draft is missing subject or body');
  }

  const contact = await db
    .prepare(
      `SELECT id FROM contacts
       WHERE prospect_id = ? AND is_validated = 1 AND is_suppressed = 0
       ORDER BY confidence DESC LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ id: string }>();

  if (!contact) throw new Error('No validated unsuppressed contact for outreach');

  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO outreach_messages (
        id, prospect_id, contact_id, kind, subject, body_text,
        facts_json, source_refs_json, confidence, status,
        provider_message_id, sent_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'INITIAL', ?, ?, ?, ?, ?, 'DRAFT', NULL, NULL, ?, ?)`,
    )
    .bind(
      messageId,
      job.prospectId,
      contact.id,
      result.subject.trim(),
      result.body.trim(),
      JSON.stringify(result.factsUsed ?? []),
      JSON.stringify(result.sourceRefs ?? []),
      Math.max(0, Math.min(100, Number(result.confidence) || 0)),
      now,
      now,
    )
    .run();

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (prospect?.state === 'OUTREACH_READY') {
    await repo.transitionProspect(prospect.id, 'OUTREACH_DRAFTED', 'Outreach draft generated');
  }

  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    await orchestrator(env, db).planProspect(job.prospectId);
  }

  return { prospectId: job.prospectId, messageId };
}

async function processFactCheckResult(
  job: MagicScriptJob,
  result: FactCheckResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; approved: boolean; escalated: boolean }> {
  if (!job.prospectId) throw new Error('Fact-check job has no prospectId');

  const draft = await db
    .prepare(
      "SELECT id FROM outreach_messages WHERE prospect_id = ? AND status = 'DRAFT' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(job.prospectId)
    .first<{ id: string }>();

  if (!draft) throw new Error('No outreach draft found for fact-check');

  const confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));
  const approved =
    result.approved === true && confidence >= configFromEnv(env).minOutreachConfidence;

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  if (approved) {
    await db
      .prepare("UPDATE outreach_messages SET status = 'VERIFIED', confidence = ?, updated_at = ? WHERE id = ?")
      .bind(confidence, new Date().toISOString(), draft.id)
      .run();

    if (prospect.state === 'OUTREACH_DRAFTED') {
      await repo.transitionProspect(prospect.id, 'OUTREACH_VERIFIED', 'Outreach fact-check passed');
    }

    if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
      await orchestrator(env, db).planProspect(job.prospectId);
    }

    return { prospectId: job.prospectId, approved: true, escalated: false };
  }

  await db
    .prepare("UPDATE outreach_messages SET status = 'REJECTED', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), draft.id)
    .run();

  const rejected = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM outreach_messages WHERE prospect_id = ? AND status = 'REJECTED'",
    )
    .bind(job.prospectId)
    .first<{ count: number }>();

  const rejectedCount = Number(rejected?.count ?? 0);

  if (
    shouldEscalateOutreachFactCheck(rejectedCount) &&
    prospect.state === 'OUTREACH_DRAFTED'
  ) {
    await repo.transitionProspect(
      prospect.id,
      'HUMAN_ACTION_REQUIRED',
      'Two outreach drafts failed automatic fact-check',
    );

    await db
      .prepare(
        `INSERT INTO human_escalations (
          id, prospect_id, category, summary, status, source_event_id, created_at, resolved_at
        ) VALUES (?, ?, 'MANUAL_REVIEW_REQUIRED', ?, 'OPEN', NULL, ?, NULL)`,
      )
      .bind(
        crypto.randomUUID(),
        prospect.id,
        `Outreach automation blocked after repeated fact-check failures: ${(result.reasons ?? []).join('; ')}`,
        new Date().toISOString(),
      )
      .run();

    return { prospectId: job.prospectId, approved: false, escalated: true };
  }

  if (prospect.state === 'OUTREACH_DRAFTED') {
    await repo.transitionProspect(prospect.id, 'OUTREACH_READY', 'Outreach fact-check rejected draft');
  }

  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    await orchestrator(env, db).planProspect(job.prospectId);
  }

  return { prospectId: job.prospectId, approved: false, escalated: false };
}

async function createEscalation(
  db: D1DatabaseLike,
  prospectId: string,
  category: string,
  summary: string,
): Promise<void> {
  const existing = await db
    .prepare(
      "SELECT id FROM human_escalations WHERE prospect_id = ? AND category = ? AND status = 'OPEN' LIMIT 1",
    )
    .bind(prospectId, category)
    .first<{ id: string }>();

  if (existing) return;

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(prospectId);

  const lines: string[] = [];

  if (prospect) {
    if (prospect.companyName) lines.push(`Company: ${prospect.companyName}`);
    if (prospect.activity) lines.push(`Activity: ${prospect.activity}`);
    if (prospect.location) lines.push(`Location: ${prospect.location}`);
    if (prospect.score !== undefined) lines.push(`Score: ${prospect.score}`);
    if (prospect.opportunity) lines.push(`Opportunity: ${prospect.opportunity}`);
    if (prospect.primaryAsset) lines.push(`Primary asset: ${prospect.primaryAsset}`);
    if (prospect.primaryFriction) lines.push(`Primary friction: ${prospect.primaryFriction}`);
    if (prospect.primaryCta) lines.push(`Primary CTA: ${prospect.primaryCta}`);
    if (prospect.websiteUrl) lines.push(`Website: ${prospect.websiteUrl}`);
  }

  if (summary) {
    lines.push(`Reason: ${summary}`);
  }

  let recommendedAction = 'Review escalation and take appropriate action.';
  switch (category) {
    case 'MANUAL_REVIEW_REQUIRED':
      recommendedAction = 'Review the blocked outreach draft and decide whether to edit, approve, or abandon.';
      break;
    case 'HOT_LEAD':
      recommendedAction = 'Engage with the prospect who requested more information.';
      break;
    case 'PRICING_REQUESTED':
      recommendedAction = 'Provide pricing information to the prospect.';
      break;
    case 'MEETING_REQUESTED':
      recommendedAction = 'Schedule a meeting with the prospect.';
      break;
    case 'CUSTOM_REQUEST':
      recommendedAction = 'Discuss customization requirements with the prospect.';
      break;
    case 'LEGAL_REVIEW_REQUIRED':
      recommendedAction = 'Review the complaint or legal issue and consult legal counsel if needed.';
      break;
    default:
      recommendedAction = 'Review escalation and take appropriate action.';
  }
  lines.push(`Recommended action: ${recommendedAction}`);

  const briefSummary = lines.join(' | ');

  await db
    .prepare(
      `INSERT INTO human_escalations (
        id, prospect_id, category, summary, status, source_event_id, created_at, resolved_at
      ) VALUES (?, ?, ?, ?, 'OPEN', NULL, ?, NULL)`,
    )
    .bind(crypto.randomUUID(), prospectId, category, briefSummary, new Date().toISOString())
    .run();
}

async function processClassificationResult(
  job: MagicScriptJob,
  result: ClassificationResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; classification: string; humanRequired: boolean }> {
  if (!job.prospectId) throw new Error('Classification job has no prospectId');

  const reply = await db
    .prepare(
      `SELECT r.id, r.contact_id, r.raw_text, c.email
       FROM replies r
       LEFT JOIN contacts c ON c.id = r.contact_id
       WHERE r.prospect_id = ? AND r.classification IS NULL
       ORDER BY r.received_at DESC LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ id: string; contact_id: string | null; raw_text: string; email: string | null }>();

  if (!reply) throw new Error('No unclassified reply found');

  const confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));
  await db
    .prepare('UPDATE replies SET classification = ?, confidence = ? WHERE id = ?')
    .bind(result.classification, confidence, reply.id)
    .run();

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  if (prospect.state !== 'REPLY_RECEIVED') {
    throw new Error(`Cannot classify reply while prospect is ${prospect.state}`);
  }

  const testOutbound = reply.contact_id
    ? await db
        .prepare(
          `SELECT id
           FROM outreach_messages
           WHERE prospect_id = ?
             AND contact_id = ?
             AND status = 'TEST_SENT'
           ORDER BY sent_at DESC
           LIMIT 1`,
        )
        .bind(prospect.id, reply.contact_id)
        .first<{ id: string }>()
    : null;

  const isControlledTestReply = Boolean(testOutbound);
  let humanRequired = false;

  switch (result.classification) {
    case 'NO_INTEREST': {
      await repo.transitionProspect(prospect.id, 'NEGATIVE_REPLY', 'Reply classified as no interest');

      if (
        result.doNotContact === true &&
        reply.email &&
        !isControlledTestReply
      ) {
        await db
          .prepare(
            `INSERT INTO suppression_list (email, reason, source, created_at)
             VALUES (?, 'recipient_opt_out', 'reply_classifier', ?)
             ON CONFLICT(email) DO NOTHING`,
          )
          .bind(reply.email.toLowerCase(), new Date().toISOString())
          .run();

        await db
          .prepare(
            'UPDATE contacts SET is_suppressed = 1, updated_at = ? WHERE lower(email) = lower(?)',
          )
          .bind(new Date().toISOString(), reply.email)
          .run();

        await repo.transitionProspect(
          prospect.id,
          'DO_NOT_CONTACT',
          'Recipient requested no further contact',
        );
      } else if (result.doNotContact === true && isControlledTestReply) {
        await repo.transitionProspect(
          prospect.id,
          'DO_NOT_CONTACT',
          'Controlled test reply requested no further contact; suppression skipped',
        );
      } else {
        await repo.transitionProspect(prospect.id, 'CLOSED_LOST', 'Prospect declined');
      }
      break;
    }

    case 'AUTO_REPLY':
      await repo.transitionProspect(prospect.id, 'WAITING_REPLY', 'Automated reply detected');
      break;

    case 'POSITIVE_INTEREST':
      await repo.transitionProspect(
        prospect.id,
        'POSITIVE_REPLY',
        'Positive commercial interest detected',
      );
      await repo.transitionProspect(
        prospect.id,
        'PROTOTYPE_REQUIRED',
        'Positive interest qualifies the prospect for an automatic prototype',
      );
      if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
        await orchestrator(env, db).planProspect(prospect.id);
      }
      break;

    case 'INFORMATION_REQUEST':
      await repo.transitionProspect(prospect.id, 'HOT_LEAD', 'Prospect requested additional information');
      await createEscalation(db, prospect.id, 'HOT_LEAD', result.summary);
      humanRequired = true;
      break;

    case 'PRICING_REQUESTED':
      await repo.transitionProspect(prospect.id, 'PRICING_REQUESTED', 'Prospect requested pricing');
      await createEscalation(db, prospect.id, 'PRICING_REQUESTED', result.summary);
      humanRequired = true;
      break;

    case 'MEETING_REQUESTED':
      await repo.transitionProspect(prospect.id, 'MEETING_REQUESTED', 'Prospect requested a meeting');
      await createEscalation(db, prospect.id, 'MEETING_REQUESTED', result.summary);
      humanRequired = true;
      break;

    case 'CUSTOM_REQUEST':
      await repo.transitionProspect(prospect.id, 'CUSTOM_REQUEST', 'Prospect requested customization');
      await createEscalation(db, prospect.id, 'CUSTOM_REQUEST', result.summary);
      humanRequired = true;
      break;

    case 'COMPLAINT_OR_LEGAL':
      await repo.transitionProspect(prospect.id, 'HUMAN_ACTION_REQUIRED', 'Complaint or legal issue detected');
      await createEscalation(db, prospect.id, 'LEGAL_REVIEW_REQUIRED', result.summary);
      humanRequired = true;
      break;
  }

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'response-agent',
    type: 'reply.classified',
    payload: {
      classification: result.classification,
      confidence,
      summary: result.summary,
      humanRequired,
      doNotContact: result.doNotContact === true,
      controlledTestReply: isControlledTestReply,
      suppressionSkipped:
        result.doNotContact === true && isControlledTestReply,
    },
    createdAt: new Date().toISOString(),
  });

  return {
    prospectId: prospect.id,
    classification: result.classification,
    humanRequired,
  };
}

function utcDayStart(date = new Date()): string {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

async function sendCapacity(
  env: Env,
  db: D1DatabaseLike,
): Promise<{ limit: number; sent: number; inFlight: number; available: number }> {
  const limit = Math.max(0, configFromEnv(env).dailySendLimit);
  const since = utcDayStart();

  const sentRow = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM outreach_messages
       WHERE status IN ('SENT', 'DRY_RUN', 'TEST_SENT')
         AND sent_at >= ?`,
    )
    .bind(since)
    .first<{ count: number }>();

  const inFlightRow = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM jobs
       WHERE kind IN ('SEND_EMAIL', 'SEND_FOLLOW_UP', 'SEND_DEMO_LINK', 'SEND_INFORMATION_RESPONSE')
         AND status = 'RUNNING'
         AND claimed_at >= ?`,
    )
    .bind(since)
    .first<{ count: number }>();

  const sent = Number(sentRow?.count ?? 0);
  const inFlight = Number(inFlightRow?.count ?? 0);

  return {
    limit,
    sent,
    inFlight,
    available: Math.max(0, limit - sent - inFlight),
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function followUpBody(sequence: number, prospect: Prospect): string {
  const companyName = prospect.companyName ?? 'votre entreprise';
  const primaryAsset = prospect.primaryAsset ?? 'votre activité';
  if (sequence <= 1) {
    return [
      'Bonjour,',
      '',
      `Je me permets de revenir sur mon message précédent concernant ${companyName}.`,
      `Si le sujet de votre présence digitale est d’actualité, je peux vous montrer très concrètement comment Magic Script pourrait mettre en valeur ${primaryAsset}.`,
      '',
      'Si ce n’est pas pertinent pour vous, dites-le-moi simplement et je ne vous relancerai plus.',
      '',
      'Bien à vous,',
      'Magic Script',
    ].join('\n');
  }

  return [
    'Bonjour,',
    '',
    `Dernier petit message de ma part concernant mon précédent email pour ${companyName}.`,
    `Si vous souhaitez voir l’idée plus concrète, je peux vous partager une démonstration adaptée à ${primaryAsset}.`,
    '',
    'Sinon, aucun souci : je clôture ici et ne vous relancerai plus.',
    '',
    'Bien à vous,',
    'Magic Script',
  ].join('\n');
}

async function scheduleDueFollowUps(
  env: Env,
  db: D1DatabaseLike,
): Promise<{ scheduled: number; skipped: number }> {
  const config = configFromEnv(env);

  if (!config.autopilotEnabled || !config.sendingEnabled || config.maxFollowups <= 0) {
    return { scheduled: 0, skipped: 0 };
  }

  const firstDelay =
    Number.parseInt(env.MAGICSCRIPT_FOLLOWUP_1_DAYS ?? '3', 10) || 3;
  const secondDelay =
    Number.parseInt(env.MAGICSCRIPT_FOLLOWUP_2_DAYS ?? '5', 10) || 5;

  const candidates = await db
    .prepare(
      `SELECT
         p.id AS prospect_id,
         MAX(om.sent_at) AS last_sent_at,
         SUM(
           CASE
             WHEN om.kind = 'FOLLOW_UP' AND om.status IN ('SENT', 'DRY_RUN', 'TEST_SENT')
             THEN 1
             ELSE 0
           END
         ) AS followup_count
       FROM prospects p
       JOIN outreach_messages om ON om.prospect_id = p.id
       WHERE p.state = 'WAITING_REPLY'
         AND om.sent_at IS NOT NULL
         AND om.status IN ('SENT', 'DRY_RUN', 'TEST_SENT')
         AND NOT EXISTS (
           SELECT 1 FROM replies r WHERE r.prospect_id = p.id
         )
       GROUP BY p.id`,
    )
    .all<{
      prospect_id: string;
      last_sent_at: string;
      followup_count: number;
    }>();

  let scheduled = 0;
  let skipped = 0;
  const repo = new D1ProspectRepository(db);

  for (const candidate of candidates.results ?? []) {
    const followupCount = Number(candidate.followup_count ?? 0);
    if (followupCount >= config.maxFollowups) {
      skipped += 1;
      continue;
    }

    const delayDays = followupCount === 0 ? firstDelay : secondDelay;
    const dueAt = addDays(new Date(candidate.last_sent_at), delayDays);
    if (dueAt.getTime() > Date.now()) {
      skipped += 1;
      continue;
    }

    const existingJob = await db
      .prepare(
        `SELECT id
         FROM jobs
         WHERE prospect_id = ?
           AND kind = 'SEND_FOLLOW_UP'
           AND status IN ('PENDING', 'RUNNING')
         LIMIT 1`,
      )
      .bind(candidate.prospect_id)
      .first<{ id: string }>();

    if (existingJob) {
      skipped += 1;
      continue;
    }

    const parent = await db
      .prepare(
        `SELECT contact_id, subject
         FROM outreach_messages
         WHERE prospect_id = ?
           AND sent_at IS NOT NULL
           AND status IN ('SENT', 'DRY_RUN', 'TEST_SENT')
         ORDER BY sent_at DESC
         LIMIT 1`,
      )
      .bind(candidate.prospect_id)
      .first<{ contact_id: string; subject: string | null }>();

    if (!parent) {
      skipped += 1;
      continue;
    }

    const contact = await db
      .prepare(
        `SELECT id, email
         FROM contacts
         WHERE id = ?
           AND is_validated = 1
           AND is_suppressed = 0
         LIMIT 1`,
      )
      .bind(parent.contact_id)
      .first<{ id: string; email: string }>();

    if (!contact) {
      skipped += 1;
      continue;
    }

    const suppressed = await db
      .prepare(
        'SELECT email FROM suppression_list WHERE lower(email) = lower(?) LIMIT 1',
      )
      .bind(contact.email)
      .first<{ email: string }>();

    if (suppressed) {
      skipped += 1;
      continue;
    }

    const prospect = await repo.getProspect(candidate.prospect_id);
    if (!prospect || prospect.state !== 'WAITING_REPLY') {
      skipped += 1;
      continue;
    }

    const now = new Date().toISOString();
    const sequence = followupCount + 1;
    const subject = parent.subject?.trim() || 'Votre présence digitale';

    await db
      .prepare(
        `INSERT INTO outreach_messages (
          id, prospect_id, contact_id, kind, subject, body_text,
          facts_json, source_refs_json, confidence, status,
          provider_message_id, sent_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'FOLLOW_UP', ?, ?, '[]', '[]', 100, 'VERIFIED', NULL, NULL, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        prospect.id,
        contact.id,
        subject,
        followUpBody(sequence, prospect),
        now,
        now,
      )
      .run();

    await repo.transitionProspect(
      prospect.id,
      'FOLLOW_UP_DUE',
      `Follow-up ${sequence} due after ${delayDays} day(s)`,
    );

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type: 'followup.scheduled',
      payload: {
        sequence,
        delayDays,
        dueAt: dueAt.toISOString(),
      },
      createdAt: now,
    });

    await orchestrator(env, db).planProspect(prospect.id);
    scheduled += 1;
  }

  return { scheduled, skipped };
}

async function processDryRunSendJob(
  job: MagicScriptJob,
  env: Env,
  db: D1DatabaseLike,
): Promise<Record<string, unknown>> {
  if (!job.prospectId) throw new Error(`${job.kind} job has no prospectId`);

  if (
    job.kind !== 'SEND_EMAIL' &&
    job.kind !== 'SEND_FOLLOW_UP' &&
    job.kind !== 'SEND_DEMO_LINK' &&
    job.kind !== 'SEND_INFORMATION_RESPONSE'
  ) {
    throw new Error(`Unsupported dry-run send job: ${job.kind}`);
  }

  const config = configFromEnv(env);
  if (!config.sendingEnabled) {
    throw new Error('Email sending is disabled');
  }

  const messageKind =
    job.kind === 'SEND_EMAIL'
      ? 'INITIAL'
      : job.kind === 'SEND_FOLLOW_UP'
        ? 'FOLLOW_UP'
        : 'REPLY';

  const message = await db
    .prepare(
      `SELECT
         om.id,
         om.subject,
         om.body_text,
         om.contact_id,
         c.email
       FROM outreach_messages om
       JOIN contacts c ON c.id = om.contact_id
       WHERE om.prospect_id = ?
         AND om.kind = ?
         AND om.status = 'VERIFIED'
         AND c.is_validated = 1
         AND c.is_suppressed = 0
       ORDER BY om.created_at DESC
       LIMIT 1`,
    )
    .bind(job.prospectId, messageKind)
    .first<{
      id: string;
      subject: string | null;
      body_text: string;
      contact_id: string;
      email: string;
    }>();

  if (!message) {
    throw new Error(`No verified ${messageKind} message with a valid contact`);
  }

  const suppressed = await db
    .prepare('SELECT email FROM suppression_list WHERE lower(email) = lower(?) LIMIT 1')
    .bind(message.email)
    .first<{ email: string }>();

  if (suppressed) {
    throw new Error('Recipient is present in suppression list');
  }

  if (config.emailProvider !== 'dry-run') {
    throw new Error(
      `Email provider "${config.emailProvider}" is not configured for deterministic dry-run sending`,
    );
  }

  const now = new Date().toISOString();
  const providerMessageId = `dryrun-${crypto.randomUUID()}`;

  await db
    .prepare(
      `UPDATE outreach_messages
       SET status = 'DRY_RUN',
           provider_message_id = ?,
           sent_at = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(providerMessageId, now, now, message.id)
    .run();

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  if (job.kind === 'SEND_EMAIL' && prospect.state === 'OUTREACH_VERIFIED') {
    await repo.transitionProspect(
      prospect.id,
      'EMAIL_SENT',
      'Dry-run email accepted by safe provider',
    );
    await repo.transitionProspect(
      prospect.id,
      'WAITING_REPLY',
      'Dry-run email moved to waiting state',
    );
  }

  if (job.kind === 'SEND_FOLLOW_UP' && prospect.state === 'FOLLOW_UP_DUE') {
    await repo.transitionProspect(
      prospect.id,
      'FOLLOW_UP_SENT',
      'Dry-run follow-up accepted by safe provider',
    );
    await repo.transitionProspect(
      prospect.id,
      'WAITING_REPLY',
      'Dry-run follow-up moved to waiting state',
    );
  }

  if (job.kind === 'SEND_DEMO_LINK' && prospect.state === 'DEMO_REPLY_READY') {
    await repo.transitionProspect(
      prospect.id,
      'DEMO_REPLY_SENT',
      'Dry-run demo reply accepted by safe provider',
    );
    await repo.transitionProspect(
      prospect.id,
      'WAITING_REPLY',
      'Dry-run demo reply moved to waiting state',
    );
  }

  if (job.kind === 'SEND_INFORMATION_RESPONSE' && prospect.state === 'INFORMATION_RESPONSE_VERIFIED') {
    await repo.transitionProspect(
      prospect.id,
      'WAITING_REPLY',
      'Dry-run information response moved to waiting state',
    );
  }

  const eventType =
    job.kind === 'SEND_EMAIL'
      ? 'email.dry_run'
      : job.kind === 'SEND_FOLLOW_UP'
        ? 'followup.dry_run'
        : job.kind === 'SEND_DEMO_LINK'
          ? 'demo_reply.dry_run'
          : 'information_response.dry_run';

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'system',
    type: eventType,
    payload: {
      messageId: message.id,
      providerMessageId,
      recipient: message.email,
      kind: messageKind,
    },
    createdAt: now,
  });

  return {
    provider: 'dry-run',
    providerMessageId,
    recipient: message.email,
    deliveredExternally: false,
    kind: messageKind,
  };
}

async function processEscalationJob(
  job: MagicScriptJob,
  db: D1DatabaseLike,
): Promise<Record<string, unknown>> {
  if (!job.prospectId) throw new Error('ESCALATE_TO_HUMAN job has no prospectId');

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  const category =
    prospect.state === 'MEETING_REQUESTED'
      ? 'MEETING_REQUESTED'
      : prospect.state === 'PRICING_REQUESTED'
        ? 'PRICING_REQUESTED'
        : prospect.state === 'CUSTOM_REQUEST'
          ? 'CUSTOM_REQUEST'
          : prospect.state === 'HOT_LEAD'
            ? 'HOT_LEAD'
            : 'MANUAL_REVIEW_REQUIRED';

  await createEscalation(
    db,
    prospect.id,
    category,
    `Magic Script requires human action for prospect in state ${prospect.state}.`,
  );

  return { escalated: true, category, state: prospect.state };
}

async function drainDeterministicJobs(
  env: Env,
  db: D1DatabaseLike,
  limit = 10,
): Promise<{ processed: number; failed: number }> {
  const queue = new D1JobQueue(db);
  const config = configFromEnv(env);

  let processed = 0;
  let failed = 0;

  for (let index = 0; index < Math.max(1, Math.min(limit, 50)); index += 1) {
    const allowedKinds: MagicScriptJob['kind'][] = ['ESCALATE_TO_HUMAN'];

    if (config.sendingEnabled && config.emailProvider === 'dry-run') {
      const capacity = await sendCapacity(env, db);
      if (capacity.available > 0) {
        allowedKinds.unshift('SEND_EMAIL', 'SEND_FOLLOW_UP', 'SEND_DEMO_LINK', 'SEND_INFORMATION_RESPONSE');
      }
    }

    const job = await queue.next(new Date(), 'cloudflare-system', allowedKinds);
    if (!job) break;

    try {
      let output: Record<string, unknown>;
      if (
        job.kind === 'SEND_EMAIL' ||
        job.kind === 'SEND_FOLLOW_UP' ||
        job.kind === 'SEND_DEMO_LINK' ||
        job.kind === 'SEND_INFORMATION_RESPONSE'
      ) {
        output = await processDryRunSendJob(job, env, db);
      } else {
        output = await processEscalationJob(job, db);
      }

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

      await queue.markSucceeded(job.id);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await queue.markFailed(
        job.id,
        message,
        new Date(Date.now() + 60_000),
      );
      failed += 1;
    }
  }

  return { processed, failed };
}

async function processExternalSendResult(
  job: MagicScriptJob,
  result: ExternalSendResult,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; providerMessageId: string }> {
  if (!job.prospectId) throw new Error(`${job.kind} job has no prospectId`);

  if (
    job.kind !== 'SEND_EMAIL' &&
    job.kind !== 'SEND_FOLLOW_UP' &&
    job.kind !== 'SEND_DEMO_LINK' &&
    job.kind !== 'SEND_INFORMATION_RESPONSE'
  ) {
    throw new Error(`Unsupported external send job: ${job.kind}`);
  }

  if (
    result.provider !== 'amen-smtp' ||
    !result.providerMessageId?.trim() ||
    result.deliveredExternally !== true
  ) {
    throw new Error('Amen SMTP runner did not report a successful external send');
  }

  const messageKind =
    job.kind === 'SEND_EMAIL'
      ? 'INITIAL'
      : job.kind === 'SEND_FOLLOW_UP'
        ? 'FOLLOW_UP'
        : 'REPLY'; // covers SEND_DEMO_LINK and SEND_INFORMATION_RESPONSE

  const message = await db
    .prepare(
      `SELECT id
       FROM outreach_messages
       WHERE prospect_id = ?
         AND kind = ?
         AND status = 'VERIFIED'
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(job.prospectId, messageKind)
    .first<{ id: string }>();

  if (!message) {
    throw new Error(`No VERIFIED ${messageKind} message found after Amen SMTP send`);
  }

  const now = new Date().toISOString();

  const persistedStatus = result.testMode === true ? 'TEST_SENT' : 'SENT';

  await db
    .prepare(
      `UPDATE outreach_messages
       SET status = ?,
           provider_message_id = ?,
           sent_at = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      persistedStatus,
      result.providerMessageId.trim(),
      now,
      now,
      message.id,
    )
    .run();

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  if (job.kind === 'SEND_EMAIL' && prospect.state === 'OUTREACH_VERIFIED') {
    await repo.transitionProspect(
      prospect.id,
      'EMAIL_SENT',
      'Amen SMTP accepted the outbound email',
    );
    await repo.transitionProspect(
      prospect.id,
      'WAITING_REPLY',
      'Outbound email sent; waiting for reply',
    );
  }

  if (job.kind === 'SEND_FOLLOW_UP' && prospect.state === 'FOLLOW_UP_DUE') {
    await repo.transitionProspect(
      prospect.id,
      'FOLLOW_UP_SENT',
      'Amen SMTP accepted the follow-up',
    );
    await repo.transitionProspect(
      prospect.id,
      'WAITING_REPLY',
      'Follow-up sent; waiting for reply',
    );
  }

  if (job.kind === 'SEND_DEMO_LINK' && prospect.state === 'DEMO_REPLY_READY') {
    await repo.transitionProspect(
      prospect.id,
      'DEMO_REPLY_SENT',
      'Amen SMTP accepted the demo reply',
    );
    await repo.transitionProspect(
      prospect.id,
      'WAITING_REPLY',
      'Demo link sent; waiting for prospect feedback',
    );
  }

  if (job.kind === 'SEND_INFORMATION_RESPONSE' && prospect.state === 'INFORMATION_RESPONSE_VERIFIED') {
    await repo.transitionProspect(
      prospect.id,
      'WAITING_REPLY',
      'Information response sent; waiting for reply',
    );
  }

  const eventType =
    job.kind === 'SEND_EMAIL'
      ? 'email.sent'
      : job.kind === 'SEND_FOLLOW_UP'
        ? 'followup.sent'
        : job.kind === 'SEND_DEMO_LINK'
          ? 'demo_reply.sent'
          : 'information_response.sent';

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'system',
    type: eventType,
    payload: {
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      recipient: result.recipient,
      originalRecipient: result.originalRecipient ?? null,
      testMode: result.testMode === true,
      accepted: result.accepted ?? [],
      rejected: result.rejected ?? [],
      kind: messageKind,
    },
    createdAt: now,
  });

  return {
    prospectId: prospect.id,
    providerMessageId: result.providerMessageId,
  };
}

async function processPrototypeBuildResult(
  job: MagicScriptJob,
  result: PrototypeBuildResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; prototypeId: string }> {
  if (!job.prospectId) throw new Error('BUILD_PROTOTYPE job has no prospectId');
  if (!result.workDir?.trim()) throw new Error('Prototype builder returned no workDir');
  if (result.buildPassed !== true) {
    throw new Error(
      `Prototype build failed: ${result.buildOutput?.slice(-2000) || 'no build output'}`,
    );
  }

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  const existing = await db
    .prepare(
      `SELECT id FROM prototypes
       WHERE prospect_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ id: string }>();

  const now = new Date().toISOString();
  const prototypeId = existing?.id ?? crypto.randomUUID();

  if (existing) {
    await db
      .prepare(
        `UPDATE prototypes
         SET repo_path = ?,
             runner_id = ?,
             status = 'BUILT',
             build_manifest_json = ?,
             last_error = NULL,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        result.workDir,
        job.claimedBy ?? null,
        JSON.stringify(result),
        now,
        prototypeId,
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO prototypes (
          id, prospect_id, repo_path, runner_id, deployment_url,
          status, qa_status, build_manifest_json, qa_findings_json,
          last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, NULL, 'BUILT', NULL, ?, NULL, NULL, ?, ?)`,
      )
      .bind(
        prototypeId,
        job.prospectId,
        result.workDir,
        job.claimedBy ?? null,
        JSON.stringify(result),
        now,
        now,
      )
      .run();
  }

  const current = await repo.getProspect(job.prospectId);
  if (current?.state === 'PROTOTYPE_BUILDING') {
    await repo.transitionProspect(
      current.id,
      'PROTOTYPE_QA',
      'Prototype build completed successfully',
    );
  }

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: job.prospectId,
    actor: 'prototype-agent',
    type: 'prototype.built',
    payload: {
      prototypeId,
      workDir: result.workDir,
      runnerId: job.claimedBy ?? null,
    },
    createdAt: now,
  });

  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    const plan = await orchestrator(env, db).planProspect(job.prospectId);
    if (plan.queuedJobId && job.claimedBy) {
      await db
        .prepare(
          `UPDATE jobs
           SET payload_json = json_set(payload_json, '$.requiredRunnerId', ?),
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(job.claimedBy, new Date().toISOString(), plan.queuedJobId)
        .run();
    }
  }

  return { prospectId: job.prospectId, prototypeId };
}

async function processPrototypeQaResult(
  job: MagicScriptJob,
  result: PrototypeQaResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; passed: boolean; escalated: boolean }> {
  if (!job.prospectId) throw new Error('RUN_PROTOTYPE_QA job has no prospectId');

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);
  if (prospect.state !== 'PROTOTYPE_QA') {
    throw new Error(`Cannot process prototype QA while prospect is ${prospect.state}`);
  }

  const prototype = await db
    .prepare(
      `SELECT id, runner_id FROM prototypes
       WHERE prospect_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ id: string; runner_id: string | null }>();

  if (!prototype) throw new Error('Prototype row not found for QA result');

  const passed =
    result.pass === true &&
    result.safeForOutreach === true &&
    result.technicalBuildPassed !== false;
  const now = new Date().toISOString();

  if (passed) {
    await db
      .prepare(
        `UPDATE prototypes
         SET status = 'READY',
             qa_status = 'PASS',
             qa_findings_json = ?,
             last_error = NULL,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(JSON.stringify(result), now, prototype.id)
      .run();

    await repo.transitionProspect(
      prospect.id,
      'PROTOTYPE_READY',
      'Prototype passed fact, mobile, conversion and technical QA',
    );

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'qa-agent',
      type: 'prototype.qa_passed',
      payload: { prototypeId: prototype.id },
      createdAt: now,
    });

    if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
      const plan = await orchestrator(env, db).planProspect(prospect.id);
      if (plan.queuedJobId && prototype.runner_id) {
        await db
          .prepare(
            `UPDATE jobs
             SET payload_json = json_set(payload_json, '$.requiredRunnerId', ?),
                 updated_at = ?
             WHERE id = ?`,
          )
          .bind(prototype.runner_id, new Date().toISOString(), plan.queuedJobId)
          .run();
      }
    }

    return { prospectId: prospect.id, passed: true, escalated: false };
  }

  await db
    .prepare(
      `UPDATE prototypes
       SET status = 'QA_FAILED',
           qa_status = 'FAIL',
           qa_findings_json = ?,
           last_error = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      JSON.stringify(result),
      (result.blockingFindings ?? []).join('; ').slice(0, 4000),
      now,
      prototype.id,
    )
    .run();

  const priorQaRuns = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM jobs
       WHERE prospect_id = ?
         AND kind = 'RUN_PROTOTYPE_QA'
         AND status = 'SUCCEEDED'`,
    )
    .bind(job.prospectId)
    .first<{ count: number }>();

  if (Number(priorQaRuns?.count ?? 0) >= 2) {
    await repo.transitionProspect(
      prospect.id,
      'HUMAN_ACTION_REQUIRED',
      'Prototype failed three automatic QA cycles',
    );

    await createEscalation(
      db,
      prospect.id,
      'MANUAL_REVIEW_REQUIRED',
      `Prototype QA remains blocked after automatic retries: ${(
        result.blockingFindings ?? []
      )
        .join('; ')
        .slice(0, 1500)}`,
    );

    return { prospectId: prospect.id, passed: false, escalated: true };
  }

  await repo.transitionProspect(
    prospect.id,
    'PROTOTYPE_REQUIRED',
    'Prototype QA failed; automatic correction cycle required',
  );

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'qa-agent',
    type: 'prototype.qa_failed',
    payload: {
      prototypeId: prototype.id,
      blockingFindings: result.blockingFindings ?? [],
      recommendedFixes: result.recommendedFixes ?? [],
    },
    createdAt: now,
  });

  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    const plan = await orchestrator(env, db).planProspect(prospect.id);
    if (plan.queuedJobId && prototype.runner_id) {
      await db
        .prepare(
          `UPDATE jobs
           SET payload_json = json_set(payload_json, '$.requiredRunnerId', ?),
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(prototype.runner_id, new Date().toISOString(), plan.queuedJobId)
        .run();
    }
  }

  return { prospectId: prospect.id, passed: false, escalated: false };
}

async function processPrototypeDeployResult(
  job: MagicScriptJob,
  result: PrototypeDeployResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; deploymentUrl: string }> {
  if (!job.prospectId) throw new Error('DEPLOY_PROTOTYPE job has no prospectId');
  if (result.deployed !== true || !result.deploymentUrl?.trim()) {
    throw new Error('Prototype deploy runner did not return a deployment URL');
  }

  const deployment = new URL(result.deploymentUrl);
  if (
    deployment.protocol !== 'https:' ||
    !deployment.hostname.endsWith('.pages.dev')
  ) {
    throw new Error('Prototype deployment URL is not an approved pages.dev URL');
  }

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);
  if (prospect.state !== 'PROTOTYPE_DEPLOYING') {
    throw new Error(
      `Cannot complete prototype deployment while prospect is ${prospect.state}`,
    );
  }

  const prototype = await db
    .prepare(
      `SELECT id FROM prototypes
       WHERE prospect_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ id: string }>();

  if (!prototype) throw new Error('Prototype row not found for deployment');

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE prototypes
       SET deployment_url = ?,
           status = 'DEPLOYED',
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(deployment.toString(), now, prototype.id)
    .run();

  await repo.transitionProspect(
    prospect.id,
    'PROTOTYPE_DEPLOYED',
    'Cloudflare Pages preview deployed',
  );

  const contact = await db
    .prepare(
      `SELECT id
       FROM contacts
       WHERE prospect_id = ?
         AND is_validated = 1
         AND is_suppressed = 0
       ORDER BY confidence DESC
       LIMIT 1`,
    )
    .bind(prospect.id)
    .first<{ id: string }>();

  if (!contact) {
    await repo.transitionProspect(
      prospect.id,
      'HUMAN_ACTION_REQUIRED',
      'Prototype deployed but no valid contact remains',
    );
    await createEscalation(
      db,
      prospect.id,
      'MANUAL_REVIEW_REQUIRED',
      'Prototype is deployed but Magic Script could not resolve a valid recipient.',
    );
    return { prospectId: prospect.id, deploymentUrl: deployment.toString() };
  }

  const initialOutreach = await db
    .prepare(
      `SELECT id, subject
       FROM outreach_messages
       WHERE prospect_id = ?
         AND kind = 'INITIAL'
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .bind(prospect.id)
    .first<{ id: string; subject: string | null }>();

  if (!initialOutreach) {
    await repo.transitionProspect(
      prospect.id,
      'OUTREACH_READY',
      'Prototype deployed; initial outreach can now include the verified demo URL',
    );

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type: 'prototype.deployed_for_initial_outreach',
      payload: {
        prototypeId: prototype.id,
        deploymentUrl: deployment.toString(),
        projectName: result.projectName,
        branch: result.branch,
      },
      createdAt: now,
    });

    if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
      await orchestrator(env, db).planProspect(prospect.id);
    }

    return { prospectId: prospect.id, deploymentUrl: deployment.toString() };
  }

  const reply = await db
    .prepare(
      `SELECT contact_id
       FROM replies
       WHERE prospect_id = ?
       ORDER BY received_at DESC
       LIMIT 1`,
    )
    .bind(prospect.id)
    .first<{ contact_id: string | null }>();

  const replyContactId = reply?.contact_id ?? contact.id;
  const subject = initialOutreach.subject?.trim()
    ? initialOutreach.subject.startsWith('Re:')
      ? initialOutreach.subject
      : `Re: ${initialOutreach.subject}`
    : 'Votre démonstration Magic Script';

  const body = [
    'Bonjour,',
    '',
    'Comme convenu, voici la démonstration préparée pour votre activité :',
    deployment.toString(),
    '',
    'L’objectif est de vous montrer concrètement une piste d’amélioration de votre présence digitale à partir des éléments publics que nous avons pu vérifier.',
    '',
    'Dites-moi simplement ce que vous en pensez.',
    '',
    'Bien à vous,',
    'Magic Script',
  ].join('\n');

  await db
    .prepare(
      `INSERT INTO outreach_messages (
        id, prospect_id, contact_id, kind, subject, body_text,
        facts_json, source_refs_json, confidence, status,
        provider_message_id, sent_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'REPLY', ?, ?, '[]', ?, 100, 'VERIFIED', NULL, NULL, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      prospect.id,
      replyContactId,
      subject,
      body,
      JSON.stringify([deployment.toString()]),
      now,
      now,
    )
    .run();

  await repo.transitionProspect(
    prospect.id,
    'DEMO_REPLY_READY',
    'Verified demo link reply prepared',
  );

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'system',
    type: 'prototype.deployed',
    payload: {
      prototypeId: prototype.id,
      deploymentUrl: deployment.toString(),
      projectName: result.projectName,
      branch: result.branch,
    },
    createdAt: now,
  });

  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    await orchestrator(env, db).planProspect(prospect.id);
  }

  return { prospectId: prospect.id, deploymentUrl: deployment.toString() };
}

async function processInformationResponseGeneration(
  job: MagicScriptJob,
  result: InformationResponseResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; messageId: string }> {
  if (!job.prospectId) throw new Error('GENERATE_INFORMATION_RESPONSE job has no prospectId');

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  // Check if human review is required or not ready to send
  if (result.humanRequired || !result.readyToSend) {
    await repo.transitionProspect(
      prospect.id,
      'HUMAN_ACTION_REQUIRED',
      'Information response requires human review',
    );

    await createEscalation(
      db,
      prospect.id,
      'MANUAL_REVIEW_REQUIRED',
      'Information response blocked: ' + (result.blockingReasons?.join('; ') || 'Missing required fields or not ready to send'),
    );

    return { prospectId: job.prospectId, messageId: '' };
  }

  // Only for automatically eligible responses, validate subject/body
  const subject = result.subject?.trim();
  const body = result.body?.trim();
  if (!subject || !body) {
    // Fail closed: escalate to human rather than throwing
    await repo.transitionProspect(
      prospect.id,
      'HUMAN_ACTION_REQUIRED',
      'Information response generation missing subject or body',
    );

    await createEscalation(
      db,
      prospect.id,
      'MANUAL_REVIEW_REQUIRED',
      'Information response generation missing subject or body',
    );

    return { prospectId: job.prospectId, messageId: '' };
  }

  const contact = await db
    .prepare(
      `SELECT id FROM contacts
       WHERE prospect_id = ? AND is_validated = 1 AND is_suppressed = 0
       ORDER BY confidence DESC LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ id: string }>();

  if (!contact) {
    throw new Error('No validated unsuppressed contact for information response');
  }

  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO outreach_messages (
        id, prospect_id, contact_id, kind, subject, body_text,
        facts_json, source_refs_json, confidence, status,
        provider_message_id, sent_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'REPLY', ?, ?, ?, ?, ?, 'DRAFT', NULL, NULL, ?, ?)`,
    )
    .bind(
      messageId,
      prospect.id,
      contact.id,
      subject,
      body,
      JSON.stringify(result.factsUsed ?? []),
      JSON.stringify(result.sourceRefs ?? []),
      Math.max(0, Math.min(100, Number(result.confidence) || 0)),
      now,
      now,
    )
    .run();

  await repo.transitionProspect(
    prospect.id,
    'INFORMATION_RESPONSE_DRAFTED',
    'Information response draft generated',
  );

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'system',
    type: 'information_response.generated',
    payload: { messageId, readyToSend: result.readyToSend, humanRequired: result.humanRequired },
    createdAt: now,
  });

  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    await orchestrator(env, db).planProspect(prospect.id);
  }

  return { prospectId: job.prospectId, messageId };
}

async function processInformationResponseFactCheck(
  job: MagicScriptJob,
  result: InformationResponseFactCheckResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; approved: boolean; escalated: boolean }> {
  if (!job.prospectId) throw new Error('FACT_CHECK_INFORMATION_RESPONSE job has no prospectId');

  const draft = await db
    .prepare(
      "SELECT id FROM outreach_messages WHERE prospect_id = ? AND kind = 'REPLY' AND status = 'DRAFT' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(job.prospectId)
    .first<{ id: string }>();

  if (!draft) throw new Error('No information response draft found for fact-check');

  const confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));
  const minConfidence = configFromEnv(env).minOutreachConfidence;
  const approved = result.approved === true && confidence >= minConfidence;

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  if (approved) {
    await db
      .prepare("UPDATE outreach_messages SET status = 'VERIFIED', confidence = ?, updated_at = ? WHERE id = ?")
      .bind(confidence, new Date().toISOString(), draft.id)
      .run();

    if (prospect.state === 'INFORMATION_RESPONSE_DRAFTED') {
      await repo.transitionProspect(prospect.id, 'INFORMATION_RESPONSE_VERIFIED', 'Information response fact-check passed');
    }

    if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
      await orchestrator(env, db).planProspect(prospect.id);
    }

    return { prospectId: job.prospectId, approved: true, escalated: false };
  }

  await db
    .prepare("UPDATE outreach_messages SET status = 'REJECTED', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), draft.id)
    .run();

  if (prospect.state === 'INFORMATION_RESPONSE_DRAFTED') {
    await repo.transitionProspect(
      prospect.id,
      'HUMAN_ACTION_REQUIRED',
      'Information response fact-check failed',
    );

    await createEscalation(
      db,
      prospect.id,
      'MANUAL_REVIEW_REQUIRED',
      'Information response fact-check failed: ' + (result.reasons ?? []).join('; '),
    );

    return { prospectId: job.prospectId, approved: false, escalated: true };
  }

  return { prospectId: job.prospectId, approved: false, escalated: false };
}

async function processPrototypeStrategyGeneration(
  job: MagicScriptJob,
  result: PrototypeStrategyResult,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string }> {
  if (!job.prospectId) throw new Error('GENERATE_PROTOTYPE_STRATEGY job has no prospectId');

  const repo = new D1ProspectRepository(db);
  const prospect = await repo.getProspect(job.prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${job.prospectId}`);

  // Require prospect.state === 'PROTOTYPE_REQUIRED'
  if (prospect.state !== 'PROTOTYPE_REQUIRED') {
    throw new Error(`Prospect is not in PROTOTYPE_REQUIRED state: ${prospect.state}`);
  }

  // Validate PrototypeStrategyResult structure
  if (!result.objective || typeof result.objective !== 'string' || !result.objective.trim()) {
    throw new Error('Prototype strategy result missing required field: objective');
  }
  if (!result.targetCustomer || typeof result.targetCustomer !== 'string' || !result.targetCustomer.trim()) {
    throw new Error('Prototype strategy result missing required field: targetCustomer');
  }
  if (!result.primaryAsset || typeof result.primaryAsset !== 'string' || !result.primaryAsset.trim()) {
    throw new Error('Prototype strategy result missing required field: primaryAsset');
  }
  if (!result.primaryFriction || typeof result.primaryFriction !== 'string' || !result.primaryFriction.trim()) {
    throw new Error('Prototype strategy result missing required field: primaryFriction');
  }
  if (!result.valueProposition || typeof result.valueProposition !== 'string' || !result.valueProposition.trim()) {
    throw new Error('Prototype strategy result missing required field: valueProposition');
  }
  if (!result.conversionStrategy || typeof result.conversionStrategy !== 'string' || !result.conversionStrategy.trim()) {
    throw new Error('Prototype strategy result missing required field: conversionStrategy');
  }
  // Validate hero
  if (!result.hero || typeof result.hero !== 'object' || Array.isArray(result.hero)) {
    throw new Error('Prototype strategy result missing required hero object');
  }
  if (!result.hero.headlineDirection || typeof result.hero.headlineDirection !== 'string' || !result.hero.headlineDirection.trim()) {
    throw new Error('Prototype strategy result missing required field: hero.headlineDirection');
  }
  if (!result.hero.supportingMessage || typeof result.hero.supportingMessage !== 'string' || !result.hero.supportingMessage.trim()) {
    throw new Error('Prototype strategy result missing required field: hero.supportingMessage');
  }
  if (!result.hero.primaryCta || typeof result.hero.primaryCta !== 'string' || !result.hero.primaryCta.trim()) {
    throw new Error('Prototype strategy result missing required field: hero.primaryCta');
  }

  // Validate arrays are actually arrays
  const arrayFields = ['sections', 'commercialProof', 'factsAllowed', 'factsForbiddenOrUnverified', 'mobilePriorities'];
  for (const field of arrayFields) {
    const value = result[field as keyof PrototypeStrategyResult];
    if (!Array.isArray(value)) {
      throw new Error(`Prototype strategy result field ${field} must be an array`);
    }
  }

  // Validate confidence is a number between 0 and 100
  const confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));

  const blockingReasons = result.blockingReasons ?? [];

  if (result.humanRequired === true || blockingReasons.length > 0) {
    await repo.transitionProspect(
      prospect.id,
      'HUMAN_ACTION_REQUIRED',
      'Prototype strategy requires human review',
    );

    await createEscalation(
      db,
      prospect.id,
      'MANUAL_REVIEW_REQUIRED',
      'Prototype strategy blocked: ' +
        (blockingReasons.join('; ') || 'Human review required'),
    );

    return { prospectId: job.prospectId };
  }

  // Otherwise, transition to PROTOTYPE_STRATEGY_GENERATED
  // Note: We don't insert any new persistence row, rely on already persisted job_results.output_json
  await repo.transitionProspect(
    prospect.id,
    'PROTOTYPE_STRATEGY_GENERATED',
    'Prototype strategy generated successfully',
  );

  // Emit prototype.strategy_generated event with confidence and strategyJobId
  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'system',
    type: 'prototype.strategy_generated',
    payload: {
      confidence,
      strategyJobId: job.id
    },
    createdAt: new Date().toISOString(),
  });

  // If autopilot enabled, plan next action
  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    await orchestrator(env, db).planProspect(job.prospectId);
  }

  return { prospectId: job.prospectId };
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

  if (job.kind === 'DISCOVER_CONTACT') {
    return processContactResult(job, output as ContactResult, env, db);
  }

  if (job.kind === 'GENERATE_OUTREACH') {
    return processOutreachResult(job, output as OutreachResult, env, db);
  }

  if (job.kind === 'FACT_CHECK_OUTREACH') {
    return processFactCheckResult(job, output as FactCheckResult, env, db);
  }

  if (job.kind === 'CLASSIFY_REPLY') {
    return processClassificationResult(job, output as ClassificationResult, env, db);
  }

  if (job.kind === 'GENERATE_INFORMATION_RESPONSE') {
    return processInformationResponseGeneration(job, output as InformationResponseResult, env, db);
  }

  if (job.kind === 'FACT_CHECK_INFORMATION_RESPONSE') {
    return processInformationResponseFactCheck(job, output as InformationResponseFactCheckResult, env, db);
  }

  if (job.kind === 'GENERATE_PROTOTYPE_STRATEGY') {
    return processPrototypeStrategyGeneration(job, output as PrototypeStrategyResult, env, db);
  }

  if (
    job.kind === 'SEND_EMAIL' ||
    job.kind === 'SEND_FOLLOW_UP' ||
    job.kind === 'SEND_DEMO_LINK' ||
    job.kind === 'SEND_INFORMATION_RESPONSE'
  ) {
    return processExternalSendResult(job, output as ExternalSendResult, db);
  }

  if (job.kind === 'BUILD_PROTOTYPE') {
    return processPrototypeBuildResult(job, output as PrototypeBuildResult, env, db);
  }

  if (job.kind === 'RUN_PROTOTYPE_QA') {
    return processPrototypeQaResult(job, output as PrototypeQaResult, env, db);
  }

  if (job.kind === 'DEPLOY_PROTOTYPE') {
    return processPrototypeDeployResult(
      job,
      output as PrototypeDeployResult,
      env,
      db,
    );
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
      emailProvider: env.MAGICSCRIPT_EMAIL_PROVIDER ?? 'disabled',
      testEmailMode: env.MAGICSCRIPT_TEST_EMAIL_MODE === 'true',
      testRecipientConfigured: Boolean(env.MAGICSCRIPT_TEST_RECIPIENT?.trim()),
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

  if (request.method === 'GET' && url.pathname === '/api/outreach/status') {
    const db = requireDb(env);
    const capacity = await sendCapacity(env, db);
    const waiting = await db
      .prepare("SELECT COUNT(*) AS count FROM prospects WHERE state = 'WAITING_REPLY'")
      .first<{ count: number }>();
    const followupDue = await db
      .prepare("SELECT COUNT(*) AS count FROM prospects WHERE state = 'FOLLOW_UP_DUE'")
      .first<{ count: number }>();
    const config = configFromEnv(env);

    return json({
      sendingEnabled: config.sendingEnabled,
      provider: config.emailProvider,
      daily: capacity,
      maxFollowups: config.maxFollowups,
      followup1Days:
        Number.parseInt(env.MAGICSCRIPT_FOLLOWUP_1_DAYS ?? '3', 10) || 3,
      followup2Days:
        Number.parseInt(env.MAGICSCRIPT_FOLLOWUP_2_DAYS ?? '5', 10) || 5,
      waitingReply: Number(waiting?.count ?? 0),
      followupDue: Number(followupDue?.count ?? 0),
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/prototypes') {
    const result = await requireDb(env)
      .prepare(
        `SELECT
           pr.id,
           pr.prospect_id,
           p.company_name,
           pr.status,
           pr.qa_status,
           pr.deployment_url,
           pr.runner_id,
           pr.updated_at
         FROM prototypes pr
         JOIN prospects p ON p.id = pr.prospect_id
         ORDER BY pr.updated_at DESC
         LIMIT 50`,
      )
      .all<Record<string, unknown>>();

    return json({ prototypes: result.results ?? [] });
  }

  if (request.method === 'GET' && url.pathname === '/api/readiness') {
    const db = requireDb(env);
    const now = new Date();
    const runnerCutoff = new Date(now.getTime() - 60_000).toISOString();

    const runner = await db
      .prepare(
        `SELECT runner_id, status, last_seen_at
         FROM runners
         WHERE last_seen_at >= ?
         ORDER BY last_seen_at DESC
         LIMIT 1`,
      )
      .bind(runnerCutoff)
      .first<{ runner_id: string; status: string; last_seen_at: string }>();

    const unresolvedDeadLetter = await db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM jobs failed
         WHERE failed.status = 'DEAD_LETTER'
           AND NOT EXISTS (
             SELECT 1
             FROM jobs recovered
             WHERE recovered.status = 'SUCCEEDED'
               AND recovered.kind = failed.kind
               AND (
                 recovered.prospect_id = failed.prospect_id
                 OR (recovered.prospect_id IS NULL AND failed.prospect_id IS NULL)
               )
               AND recovered.updated_at > failed.updated_at
           )`,
      )
      .first<{ count: number }>();

    const prospectCount = await db
      .prepare('SELECT COUNT(*) AS count FROM prospects')
      .first<{ count: number }>();

    const safeTransport =
      env.MAGICSCRIPT_EMAIL_PROVIDER === 'dry-run' ||
      (env.MAGICSCRIPT_TEST_EMAIL_MODE === 'true' &&
        Boolean(env.MAGICSCRIPT_TEST_RECIPIENT?.trim()));

    const checks = {
      database: true,
      autopilot: env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true',
      runnerOnline: Boolean(runner),
      safeTransport,
      publicDiscovery: true,
      noDeadLetters: Number(unresolvedDeadLetter?.count ?? 0) === 0,
    };

    return json({
      dryRunReady: Object.values(checks).every(Boolean),
      checks,
      runner: runner ?? null,
      prospects: Number(prospectCount?.count ?? 0),
      timestamp: now.toISOString(),
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/providers/usage') {
    const db = requireDb(env);
    const period = currentPeriod();
    const hunterUsed = await hunterCreditsUsed(db, period);
    const hunterBudget =
      Number.parseInt(env.HUNTER_MONTHLY_CREDIT_BUDGET ?? '40', 10) || 40;

    return json({
      period,
      rechercheEntreprises: {
        configured: true,
        authRequired: false,
        monetaryCost: 0,
        documentedRateLimitPerSecond: 7,
        purpose: 'primary_business_discovery',
      },
      sirene: {
        configured: Boolean(env.INSEE_SIRENE_API_KEY),
        cost: 'free',
        purpose: 'primary_business_discovery',
      },
      hunter: {
        configured: Boolean(env.HUNTER_API_KEY),
        used: hunterUsed,
        budget: hunterBudget,
        remainingInternalBudget: Math.max(0, hunterBudget - hunterUsed),
        purpose: 'contact_fallback_only',
      },
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/runners') {
    const result = await requireDb(env)
      .prepare(
        `SELECT runner_id, hostname, status, version, current_job_id, started_at, last_seen_at
         FROM runners
         ORDER BY last_seen_at DESC`,
      )
      .all<Record<string, unknown>>();

    return json({ runners: result.results ?? [] });
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

  if (
    request.method === 'POST' &&
    (url.pathname === '/api/email/inbound' ||
      url.pathname === '/api/runner/email/inbound')
  ) {
    const body = (await request.json()) as {
      inReplyToProviderMessageId?: string;
      providerMessageId?: string;
      fromEmail?: string;
      rawText?: string;
      receivedAt?: string;
    };

    if (!body.inReplyToProviderMessageId?.trim() || !body.rawText?.trim()) {
      return json(
        { error: 'inReplyToProviderMessageId and rawText are required' },
        { status: 400 },
      );
    }

    const db = requireDb(env);
    const outbound = await db
      .prepare(
        `SELECT id, prospect_id, contact_id
         FROM outreach_messages
         WHERE provider_message_id = ?
         ORDER BY sent_at DESC LIMIT 1`,
      )
      .bind(body.inReplyToProviderMessageId.trim())
      .first<{ id: string; prospect_id: string; contact_id: string }>();

    if (!outbound) {
      return json({ error: 'Related outbound message not found' }, { status: 404 });
    }

    if (body.providerMessageId) {
      const duplicate = await db
        .prepare('SELECT id FROM replies WHERE provider_message_id = ? LIMIT 1')
        .bind(body.providerMessageId)
        .first<{ id: string }>();
      if (duplicate) {
        return json({ ok: true, duplicate: true, replyId: duplicate.id });
      }
    }

    const now = new Date().toISOString();
    const replyId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO replies (
          id, prospect_id, contact_id, provider_message_id, from_email,
          raw_text, classification, confidence, received_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      )
      .bind(
        replyId,
        outbound.prospect_id,
        outbound.contact_id,
        body.providerMessageId ?? null,
        body.fromEmail ?? null,
        body.rawText.trim(),
        body.receivedAt ?? now,
        now,
      )
      .run();

    const repo = new D1ProspectRepository(db);
    const prospect = await repo.getProspect(outbound.prospect_id);
    if (!prospect) throw new Error('Prospect not found for inbound reply');

    if (
      prospect.state === 'EMAIL_SENT' ||
      prospect.state === 'WAITING_REPLY' ||
      prospect.state === 'FOLLOW_UP_DUE' ||
      prospect.state === 'FOLLOW_UP_SENT'
    ) {
      await repo.transitionProspect(prospect.id, 'REPLY_RECEIVED', 'Inbound email reply received');
    }

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type: 'email.reply_received',
      payload: { replyId, providerMessageId: body.providerMessageId ?? null },
      createdAt: now,
    });

    const updated = await repo.getProspect(prospect.id);
    if (updated?.state === 'REPLY_RECEIVED' && env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
      await orchestrator(env, db).planProspect(prospect.id);
    }

    return json({ ok: true, replyId, prospectId: prospect.id });
  }

  if (
    request.method === 'POST' &&
    (url.pathname === '/api/email/bounce' ||
      url.pathname === '/api/runner/email/bounce')
  ) {
    const body = (await request.json()) as {
      inReplyToProviderMessageId?: string;
      recipient?: string;
      reason?: string;
      receivedAt?: string;
    };

    if (!body.inReplyToProviderMessageId?.trim()) {
      return json(
        { error: 'inReplyToProviderMessageId is required' },
        { status: 400 },
      );
    }

    const db = requireDb(env);
    const outbound = await db
      .prepare(
        `SELECT id, prospect_id, contact_id
         FROM outreach_messages
         WHERE provider_message_id = ?
         ORDER BY sent_at DESC
         LIMIT 1`,
      )
      .bind(body.inReplyToProviderMessageId.trim())
      .first<{ id: string; prospect_id: string; contact_id: string }>();

    if (!outbound) {
      return json({ error: 'Related outbound message not found' }, { status: 404 });
    }

    const contact = await db
      .prepare('SELECT email FROM contacts WHERE id = ? LIMIT 1')
      .bind(outbound.contact_id)
      .first<{ email: string }>();

    const bouncedEmail = body.recipient?.trim().toLowerCase() || contact?.email?.toLowerCase();
    const now = body.receivedAt ?? new Date().toISOString();
    const reason = body.reason?.trim() || 'Delivery failure reported by mail server';

    if (bouncedEmail) {
      await db
        .prepare(
          `UPDATE contacts
           SET is_validated = 0,
               is_suppressed = 1,
               updated_at = ?
           WHERE lower(email) = lower(?)`,
        )
        .bind(now, bouncedEmail)
        .run();

      await db
        .prepare(
          `INSERT INTO suppression_list (email, reason, source, created_at)
           VALUES (?, ?, 'hard_bounce', ?)
           ON CONFLICT(email) DO UPDATE SET
             reason = excluded.reason,
             source = excluded.source`,
        )
        .bind(bouncedEmail, reason.slice(0, 1000), now)
        .run();
    }

    const repo = new D1ProspectRepository(db);
    const prospect = await repo.getProspect(outbound.prospect_id);
    if (!prospect) throw new Error('Prospect not found for bounce');

    if (canTransition(prospect.state, 'BOUNCED')) {
      await repo.transitionProspect(
        prospect.id,
        'BOUNCED',
        'Hard bounce detected for outbound email',
      );
    }

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type: 'email.bounced',
      payload: {
        outboundMessageId: outbound.id,
        providerMessageId: body.inReplyToProviderMessageId,
        recipient: bouncedEmail ?? null,
        reason,
      },
      createdAt: now,
    });

    const updated = await repo.getProspect(prospect.id);
    if (updated?.state === 'BOUNCED' && env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
      await orchestrator(env, db).planProspect(prospect.id);
    }

    return json({
      ok: true,
      prospectId: prospect.id,
      recipient: bouncedEmail ?? null,
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/autopilot/tick') {
    return json(await enqueueDiscoveryIfNeeded(env, requireDb(env)));
  }

  if (request.method === 'POST' && url.pathname === '/api/autopilot/reconcile') {
    return json(await reconcileAutopilot(env, requireDb(env)));
  }

  if (request.method === 'POST' && url.pathname === '/api/system/drain') {
    const db = requireDb(env);
    const recovery = await recoverStaleJobs(env, db);
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const followups = await scheduleDueFollowUps(env, db);
    const drained = await drainDeterministicJobs(env, db, body.limit ?? 10);
    return json({ recovery, followups, ...drained });
  }

  if (request.method === 'POST' && url.pathname === '/api/orchestrator/plan') {
    const body = (await request.json()) as { prospectId?: string };
    if (!body.prospectId) {
      return json({ error: 'prospectId is required' }, { status: 400 });
    }

    return json(await orchestrator(env, requireDb(env)).planProspect(body.prospectId));
  }

  if (request.method === 'POST' && url.pathname === '/api/runner/heartbeat') {
    const body = (await request.json()) as {
      runnerId?: string;
      hostname?: string;
      status?: string;
      version?: string;
      currentJobId?: string | null;
    };

    const runnerId =
      body.runnerId?.trim() || request.headers.get('x-magicscript-runner-id')?.trim();

    if (!runnerId) {
      return json({ error: 'runnerId is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const status = body.status?.trim() || 'IDLE';

    const db = requireDb(env);

    await db
      .prepare(
        `INSERT INTO runners (
          runner_id, hostname, status, version, current_job_id, started_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(runner_id) DO UPDATE SET
          hostname = excluded.hostname,
          status = excluded.status,
          version = excluded.version,
          current_job_id = excluded.current_job_id,
          last_seen_at = excluded.last_seen_at`,
      )
      .bind(
        runnerId,
        body.hostname ?? null,
        status,
        body.version ?? null,
        body.currentJobId ?? null,
        now,
        now,
      )
      .run();

    // A BUSY heartbeat renews the job lease. Long-running Kimi/prototype jobs
    // can legitimately exceed the initial lease duration, so claimed_at acts
    // as the latest lease-renewal timestamp while the owning runner is alive.
    if (status === 'BUSY' && body.currentJobId) {
      await db
        .prepare(
          `UPDATE jobs
           SET claimed_at = ?
           WHERE id = ?
             AND status = 'RUNNING'
             AND claimed_by = ?`,
        )
        .bind(now, body.currentJobId, runnerId)
        .run();
    }

    return json({ ok: true, runnerId, lastSeenAt: now });
  }

  if (request.method === 'POST' && url.pathname === '/api/runner/jobs/claim') {
    const db = requireDb(env);
    await recoverStaleJobs(env, db);
    const queue = new D1JobQueue(db);
    const runnerId = request.headers.get('x-magicscript-runner-id')?.trim() || undefined;
    const runnerKinds: MagicScriptJob['kind'][] = [
      'DISCOVER_PROSPECTS',
      'RUN_RESEARCH_SWARM',
      'DISCOVER_CONTACT',
      'GENERATE_OUTREACH',
      'FACT_CHECK_OUTREACH',
      'CLASSIFY_REPLY',
      'GENERATE_PROTOTYPE_STRATEGY',
      'BUILD_PROTOTYPE',
      'RUN_PROTOTYPE_QA',
    ];

    const config = configFromEnv(env);

    if (config.prototypeDeployEnabled) {
      runnerKinds.push('DEPLOY_PROTOTYPE');
    }

    if (config.sendingEnabled && config.emailProvider === 'amen-smtp') {
      const capacity = await sendCapacity(env, db);
      if (capacity.available > 0) {
        runnerKinds.push('SEND_EMAIL', 'SEND_FOLLOW_UP', 'SEND_DEMO_LINK', 'SEND_INFORMATION_RESPONSE');
      }
    }

    const job = await queue.next(new Date(), runnerId, runnerKinds);

    if (!job) {
      return new Response(null, { status: 204 });
    }

// Declare prototypeStrategy outside the BUILD_PROTOTYPE block so it's in scope for the return statement
let prototypeStrategy: PrototypeStrategyResult | null = null;

// For BUILD_PROTOTYPE jobs, validate that we have a successful strategy before proceeding
if (job.kind === 'BUILD_PROTOTYPE' && job.prospectId) {
  const strategyRow = await db
    .prepare(
      `SELECT jr.output_json
       FROM job_results jr
       JOIN jobs j ON j.id = jr.job_id
       WHERE j.prospect_id = ?
         AND j.kind = 'GENERATE_PROTOTYPE_STRATEGY'
         AND j.status = 'SUCCEEDED'
       ORDER BY jr.created_at DESC
       LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ output_json: string }>();

  prototypeStrategy = null;
  if (strategyRow?.output_json) {
    try {
      prototypeStrategy = JSON.parse(strategyRow.output_json) as PrototypeStrategyResult | null;
      // Validate that we got a proper strategy object
      if (!prototypeStrategy ||
          typeof prototypeStrategy !== 'object' ||
          Array.isArray(prototypeStrategy)) {
        prototypeStrategy = null;
      }
    } catch (e) {
      // If we can't parse or validate the strategy, treat as missing
      prototypeStrategy = null;
    }
  }

  // Fail closed: if this is a BUILD_PROTOTYPE job and we don't have a valid strategy, mark job as failed
  if (!prototypeStrategy) {
    await queue.markFailed(
      job.id,
      'BUILD_PROTOTYPE job requires a valid GENERATE_PROTOTYPE_STRATEGY result',
      new Date(Date.now() + 60_000),
    );
    return json({ error: 'Missing or invalid prototype strategy' }, { status: 400 });
  }
}

const repo = new D1ProspectRepository(db);
await transitionOnClaim(job, repo);

    const prospect = job.prospectId ? await repo.getProspect(job.prospectId) : null;
    const contacts = job.prospectId ? await repo.listContacts(job.prospectId) : [];
    const outreachDraft = job.prospectId
      ? await db
          .prepare(
            job.kind === 'SEND_EMAIL'
              ? "SELECT id, contact_id, subject, body_text, confidence, status FROM outreach_messages WHERE prospect_id = ? AND kind = 'INITIAL' AND status = 'VERIFIED' ORDER BY created_at DESC LIMIT 1"
              : job.kind === 'SEND_FOLLOW_UP'
                ? "SELECT id, contact_id, subject, body_text, confidence, status FROM outreach_messages WHERE prospect_id = ? AND kind = 'FOLLOW_UP' AND status = 'VERIFIED' ORDER BY created_at DESC LIMIT 1"
                : job.kind === 'SEND_DEMO_LINK' || job.kind === 'SEND_INFORMATION_RESPONSE'
                  ? "SELECT id, contact_id, subject, body_text, confidence, status FROM outreach_messages WHERE prospect_id = ? AND kind = 'REPLY' AND status = 'VERIFIED' ORDER BY created_at DESC LIMIT 1"
                  : "SELECT id, contact_id, subject, body_text, confidence, status FROM outreach_messages WHERE prospect_id = ? AND status = 'DRAFT' ORDER BY created_at DESC LIMIT 1",
          )
          .bind(job.prospectId)
          .first<Record<string, unknown>>()
      : null;

    const threadParentMessageId =
      job.prospectId && job.kind === 'SEND_FOLLOW_UP'
        ? (
            await db
              .prepare(
                `SELECT provider_message_id
                 FROM outreach_messages
                 WHERE prospect_id = ?
                   AND sent_at IS NOT NULL
                   AND provider_message_id IS NOT NULL
                   AND status IN ('SENT', 'DRY_RUN', 'TEST_SENT')
                 ORDER BY sent_at DESC
                 LIMIT 1`,
              )
              .bind(job.prospectId)
              .first<{ provider_message_id: string }>()
          )?.provider_message_id ?? null
        : job.prospectId && job.kind === 'SEND_DEMO_LINK'
          ? (
              await db
                .prepare(
                  `SELECT provider_message_id
                   FROM replies
                   WHERE prospect_id = ?
                     AND provider_message_id IS NOT NULL
                   ORDER BY received_at DESC
                   LIMIT 1`,
                )
                .bind(job.prospectId)
                .first<{ provider_message_id: string }>()
            )?.provider_message_id ?? null
          : null;

    const researchRow = job.prospectId
      ? await db
          .prepare(
            `SELECT jr.output_json
             FROM job_results jr
             JOIN jobs j ON j.id = jr.job_id
             WHERE j.prospect_id = ? AND j.kind = 'RUN_RESEARCH_SWARM'
             ORDER BY jr.created_at DESC LIMIT 1`,
          )
          .bind(job.prospectId)
          .first<{ output_json: string }>()
      : null;

    const researchContext = researchRow
      ? (JSON.parse(researchRow.output_json) as Record<string, unknown>)
      : null;

    const latestReply = job.prospectId
      ? await db
          .prepare(
            `SELECT id, raw_text, received_at, from_email
             FROM replies
             WHERE prospect_id = ? AND classification IS NULL
             ORDER BY received_at DESC LIMIT 1`,
          )
          .bind(job.prospectId)
          .first<Record<string, unknown>>()
      : null;

    const prototypeContext = job.prospectId
      ? await db
          .prepare(
            `SELECT
               id,
               prospect_id,
               repo_path,
               runner_id,
               status,
               qa_status,
               deployment_url,
               build_manifest_json,
               qa_findings_json
             FROM prototypes
             WHERE prospect_id = ?
             ORDER BY updated_at DESC
             LIMIT 1`,
          )
          .bind(job.prospectId)
          .first<Record<string, unknown>>()
      : null;

    return json({
      job,
      prospect,
      contacts,
      outreachDraft,
      researchContext,
      latestReply,
      threadParentMessageId,
      prototypeContext,
      prototypeStrategy,
    });
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
        claimed_by: string | null;
        claimed_at: string | null;
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
      claimedBy: row.claimed_by ?? undefined,
      claimedAt: row.claimed_at ?? undefined,
    };

    const body = (await request.json()) as { output?: unknown };
    const processed = await processRunnerSuccess(job, body.output, env, db);
    await queue.markSucceeded(job.id);
    await drainDeterministicJobs(env, db, 3);

    if (job.claimedBy) {
      await db
        .prepare(
          "UPDATE runners SET status = 'IDLE', current_job_id = NULL, last_seen_at = ? WHERE runner_id = ?",
        )
        .bind(new Date().toISOString(), job.claimedBy)
        .run();
    }

    return json({ ok: true, processed });
  }

  const failMatch = url.pathname.match(/^\/api\/runner\/jobs\/([^/]+)\/fail$/);
  if (request.method === 'POST' && failMatch) {
    const jobId = decodeURIComponent(failMatch[1]);
    const body = (await request.json()) as { error?: string; retryDelayMs?: number };
    const retryDelayMs = Math.max(1_000, Math.min(body.retryDelayMs ?? 30_000, 15 * 60_000));
    const retryAfter = new Date(Date.now() + retryDelayMs);
    const db = requireDb(env);
    const queue = new D1JobQueue(db);
    await queue.markFailed(
      jobId,
      body.error ?? 'Runner reported failure',
      retryAfter,
    );

    const failedJob = (await queue.list()).find((item) => item.id === jobId);

    if (
      failedJob?.status === 'DEAD_LETTER' &&
      failedJob.prospectId
    ) {
      await handleTerminalJobFailure(
        failedJob.prospectId,
        failedJob.kind,
        failedJob.lastError ?? body.error ?? 'Runner reported terminal failure',
        db,
      );
    }

    if (failedJob?.claimedBy) {
      await db
        .prepare(
          "UPDATE runners SET status = 'IDLE', current_job_id = NULL, last_seen_at = ? WHERE runner_id = ?",
        )
        .bind(new Date().toISOString(), failedJob.claimedBy)
        .run();
    }

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

  async scheduled(_controller: unknown, env: Env): Promise<void> {
    if (!env.DB) return;
    await recoverStaleJobs(env, env.DB);
    await enqueueDiscoveryIfNeeded(env, env.DB);
    await reconcileAutopilot(env, env.DB);
    await scheduleDueFollowUps(env, env.DB);
    await drainDeterministicJobs(env, env.DB, 10);
  },
};
