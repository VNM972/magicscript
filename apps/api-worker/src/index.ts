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
  resolveSwarmHub,
  loadConfig,
  scoreProspect,
  scoreEngagementFromMagicScriptEvents,
evaluatePrototypeCostGate,
  shouldEscalateOutreachFactCheck,
  shouldAcceptFactCheckWithVerifiedDeploymentLink,
  buildPersonalizedEntryLinks,
  buildSalesRoomEventPayload,
  buildSalesRoomSlug,
  canPromoteWithWebDesignReview,
  deriveSalesRoomState,
  sireneBusinessName,
  sireneLocation,
  sirenePublicSourceUrl,
  type WebDesignReview,
  webDesignReviewBlockReason,
  webDesignReviewStatus,
  buildCommercialBriefing,
  commercialTransition,
  planInterestFollowups,
  stateForInboundClassification,
  addCalendarDays,
  buildH24ReminderPlan,
  buildMeetingConfirmationEmail,
  dateKeyInTimeZone,
  DEFAULT_AVAILABILITY,
  formatInTimeZone,
  generateAvailability,
  getWeekRangeUtc,
  slotForStart,
  assertTimeZone,
  zonedLocalToUtc,
  type AvailabilityConfig,
  type CommunicationMode,
  type MeetingConfirmationEmail,
  type MeetingStatus,
  type CommercialBriefing,
  type CommercialEvent,
  type D1DatabaseLike,
  type JobStatus,
  type MagicScriptJob,
  type Prospect,
  type ProspectContact,
  type ProspectOpportunity,
  type SalesRoomStatus,
  type HandoffPacket,
  validateHandoff,
  applyCallCopilotAction,
  buildCallCopilotSnapshot,
  buildEndOfCallReview,
  prospectToCallCopilotContext,
  CALL_COPILOT_ENGINE_VERSION,
  CALL_COPILOT_RULES_VERSION,
  CALL_COPILOT_PROMPT_VERSION,
  type CallCopilotAction,
  type CallCopilotSnapshot,
  buildQuoteDossier,
  mergeQuoteDossier,
  resolveQuoteDossierConflict,
  validateQuoteDossier,
extractCommercialScopeFromProspectTexts,
applyCommercialScopeProfile,
buildCanonicalQuote,
resolvePricingPackage,
classifyCommercialScope,
  validateQuoteAcceptanceProof,
  type QuoteDossierConflictField,
  type DossierField,
  type QuoteDossier,
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
  MAGICSCRIPT_PUBLIC_BASE_URL?: string;
  MAGICSCRIPT_SALES_ROOM_REVIEW_DAYS?: string;
  MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED?: string;
  MAGICSCRIPT_AVAILABILITY_TIMEZONE?: string;
  MAGICSCRIPT_AVAILABILITY_START?: string;
  MAGICSCRIPT_AVAILABILITY_END?: string;
  MAGICSCRIPT_AVAILABILITY_HORIZON_DAYS?: string;
  MAGICSCRIPT_SMS_ENABLED?: string;
  MAGICSCRIPT_API_TOKEN?: string;
  MAGICSCRIPT_RUNNER_TOKEN?: string;
  MAGICSCRIPT_QUOTE_VAT_NOTE?: string;
  MAGICSCRIPT_QUOTE_CGV_REFERENCE?: string;
  MAGICSCRIPT_STACK_ID?: string;
  MAGICSCRIPT_RUNNER_PROSPECT_ID?: string;
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
  brandAsset?: {
    status: 'OFFICIAL_LOGO_FOUND' | 'PUBLIC_LOGO_CANDIDATE' | 'NOT_FOUND' | 'UNKNOWN';
    sourceUrl?: string;
    assetUrl?: string;
    reuseDecision:
      | 'REUSE_IF_RIGHTS_CLEAR'
      | 'DO_NOT_REUSE'
      | 'CREATE_ONLY_IF_NO_USABLE_IDENTITY'
      | 'UNKNOWN';
    note: string;
  };
  sourceNavigationBlocks?: Array<{
    label: string;
    kind: 'navigation' | 'content_block' | 'conversion_cta';
  }>;
  sourceNavigationNote?: string;
  contactPlan?: {
    recommendedChannel:
      | 'official_email'
      | 'contact_form'
      | 'phone'
      | 'official_social_dm'
      | 'professional_directory'
      | 'unknown';
    targetRole:
      | 'owner_or_manager'
      | 'direction'
      | 'commercial'
      | 'reception'
      | 'generic_business_contact'
      | 'unknown';
    publicContactName?: string;
    routeReason: string;
    nextAction: string;
    sourceRefs: string[];
    confidence: number;
  };
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

const externalSendKinds: readonly MagicScriptJob['kind'][] = [
  'SEND_EMAIL',
  'SEND_FOLLOW_UP',
  'SEND_DEMO_LINK',
  'SEND_INFORMATION_RESPONSE',
];

function isExternalSendKind(kind: MagicScriptJob['kind']): boolean {
  return externalSendKinds.includes(kind);
}

function messageKindForSendJob(kind: MagicScriptJob['kind']): 'INITIAL' | 'FOLLOW_UP' | 'REPLY' {
  return kind === 'SEND_EMAIL' ? 'INITIAL' : kind === 'SEND_FOLLOW_UP' ? 'FOLLOW_UP' : 'REPLY';
}

function persistedSendMessageId(job: MagicScriptJob): string | undefined {
  const messageId =
    job.payload && typeof job.payload === 'object'
      ? (job.payload as Record<string, unknown>).sendMessageId
      : undefined;
  return typeof messageId === 'string' && messageId.trim() ? messageId.trim() : undefined;
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
  brandAsset?: {
    status: 'OFFICIAL_LOGO_FOUND' | 'PUBLIC_LOGO_CANDIDATE' | 'NOT_FOUND' | 'UNKNOWN';
    sourceUrl?: string;
    assetUrl?: string;
    reuseDecision:
      | 'REUSE_IF_RIGHTS_CLEAR'
      | 'DO_NOT_REUSE'
      | 'CREATE_ONLY_IF_NO_USABLE_IDENTITY'
      | 'UNKNOWN';
    note: string;
  };
  hero: {
    headlineDirection: string;
    supportingMessage: string;
    primaryCta: string;
  };
  sections: string[];
  sourceNavigationBlocks: Array<{
    label: string;
    kind: 'navigation' | 'content_block' | 'conversion_cta';
  }>;
  sourceNavigationNote: string;
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
  webDesignReview?: WebDesignReview;
}

async function countConsecutivePrototypeQaFailures(
  db: D1DatabaseLike,
  prospectId: string,
): Promise<number> {
  const rows = await db
    .prepare(
      `SELECT jr.output_json
       FROM job_results jr
       JOIN jobs j ON j.id = jr.job_id
       WHERE j.prospect_id = ?
         AND j.kind = 'RUN_PROTOTYPE_QA'
         AND j.status = 'SUCCEEDED'
       ORDER BY j.created_at DESC
       LIMIT 10`,
    )
    .bind(prospectId)
    .all<{ output_json: string }>();

  let consecutiveFailures = 0;
  for (const row of rows.results ?? []) {
    let previous: Partial<PrototypeQaResult>;
    try {
      previous = JSON.parse(row.output_json) as Partial<PrototypeQaResult>;
    } catch {
      break;
    }

    const failed =
      previous.pass === false ||
      previous.safeForOutreach === false ||
      previous.technicalBuildPassed === false ||
      !canPromoteWithWebDesignReview(previous);

    if (!failed) break;
    consecutiveFailures += 1;
  }

  return consecutiveFailures;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function corsHeaders(env: Env, request: Request): HeadersInit {
  const configuredOrigins = [
    env.MAGICSCRIPT_CONTROL_CENTER_ORIGIN?.trim(),
    env.MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED === 'true'
      ? env.MAGICSCRIPT_PUBLIC_BASE_URL?.trim()
      : undefined,
  ].filter((origin): origin is string => Boolean(origin));
  const requestOrigin = request.headers.get('origin');

  if (!requestOrigin || !configuredOrigins.includes(requestOrigin)) {
    return {};
  }

  return {
    'access-control-allow-origin': requestOrigin,
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

function requireRunnerStack(request: Request, env: Env): Response | null {
  const expected = env.MAGICSCRIPT_STACK_ID?.trim();
  if (!expected) return null;

  const provided = request.headers.get('x-magicscript-stack-id')?.trim();
  return provided === expected
    ? null
    : json(
        {
          error: 'Runner request belongs to a stale or unknown stack generation',
        },
        { status: 409 },
      );
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
    prototypeCostGate: async (prospectId) => {
      let evaluation =
        await getLatestPrototypeCostGate(db, prospectId);

      if (!evaluation) {
        const prospect =
          await new D1ProspectRepository(db).getProspect(prospectId);

        if (prospect?.state === 'PROTOTYPE_REQUIRED') {
          evaluation =
            await evaluateAndPersistPrototypeCostGate(
              db,
              prospect,
            );
        }
      }

      return evaluation?.authorization ?? null;
    },
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
    'WON',
    'DORMANT',
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

async function releaseRunnerClaims(
  db: D1DatabaseLike,
  runnerId: string,
  reason: string,
): Promise<MagicScriptJob[]> {
  const rows = await db
    .prepare(
      `SELECT id
       FROM jobs
       WHERE claimed_by = ?
         AND status IN ('RUNNING', 'SENDING')
       ORDER BY claimed_at ASC`,
    )
    .bind(runnerId)
    .all<{ id: string }>();

  const queue = new D1JobQueue(db);
  const released: MagicScriptJob[] = [];

  for (const row of rows.results ?? []) {
    const job = await queue.releaseClaim(row.id, runnerId, reason, new Date());
    if (!job) continue;

    released.push(job);
    if (
      job.prospectId &&
      (job.status === 'SEND_UNKNOWN' || job.status === 'DEAD_LETTER')
    ) {
      await handleTerminalJobFailure(
        job.prospectId,
        job.kind,
        job.lastError ?? reason,
        db,
      );
    }
  }

  return released;
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
         status,
         attempts,
         max_attempts,
         claimed_by
       FROM jobs
       WHERE status IN ('RUNNING', 'SENDING')
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
      status: JobStatus;
      attempts: number;
      max_attempts: number;
      claimed_by: string | null;
    }>();

  let recovered = 0;
  let deadLettered = 0;

  for (const job of stale.results ?? []) {
    if (job.status === 'SENDING') {
      const error = 'SMTP send attempt became uncertain after the runner lease expired';
      await db
        .prepare(
          `UPDATE jobs
           SET status = 'SEND_UNKNOWN',
               claimed_by = NULL,
               claimed_at = NULL,
               last_error = ?,
               updated_at = ?
           WHERE id = ? AND status = 'SENDING'`,
        )
        .bind(error, now, job.id)
        .run();

      deadLettered += 1;

      if (job.prospect_id) {
        await handleTerminalJobFailure(job.prospect_id, job.kind, error, db);
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

      continue;
    }

    const exhausted = job.attempts >= job.max_attempts;

    if (exhausted) {
      await db
        .prepare(
          `UPDATE jobs
           SET status = 'DEAD_LETTER',
               claimed_by = NULL,
               claimed_at = NULL,
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
        reason: 'Open API Recherche dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢entreprises discovery completed',
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
      "SELECT COUNT(*) AS count FROM prospects WHERE state NOT IN ('SAS_PENDING','DISCOVERED','RESEARCHING','RESEARCH_COMPLETE','DISQUALIFIED')",
    emailsSent: "SELECT COUNT(*) AS count FROM outreach_messages WHERE status = 'SENT'",
    replies: 'SELECT COUNT(*) AS count FROM replies',
    hotLeads:
      "SELECT COUNT(*) AS count FROM prospects WHERE state IN ('INTERESTED','MEETING_BOOKED','QUOTE_PENDING','COMMITTED','HOT_LEAD','MEETING_REQUESTED','PRICING_REQUESTED','CUSTOM_REQUEST','HUMAN_ACTION_REQUIRED')",
    interested: "SELECT COUNT(*) AS count FROM prospects WHERE state = 'INTERESTED'",
    meetingsBooked: "SELECT COUNT(*) AS count FROM prospects WHERE state = 'MEETING_BOOKED'",
    quotePending: "SELECT COUNT(*) AS count FROM prospects WHERE state = 'QUOTE_PENDING'",
    committed: "SELECT COUNT(*) AS count FROM prospects WHERE state = 'COMMITTED'",
    won: "SELECT COUNT(*) AS count FROM prospects WHERE state = 'WON'",
    dormant: "SELECT COUNT(*) AS count FROM prospects WHERE state = 'DORMANT'",
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
      brandAsset: result.brandAsset ?? {
        status: 'UNKNOWN',
        reuseDecision: 'CREATE_ONLY_IF_NO_USABLE_IDENTITY',
        note: 'Aucun actif de marque structurÃƒÆ’Ã‚Â© dans cette sortie de recherche.',
      },
    },
    createdAt: new Date().toISOString(),
  });

  if (qualified && env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true') {
    await orchestrator(env, db).planProspect(job.prospectId);
  }

  return { prospectId: job.prospectId, score: scoring.score, qualified };
}

async function processScoringResult(
  job: MagicScriptJob,
  output: unknown,
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prospectId: string; score: number; qualified: boolean }> {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new Error('Scoring job requires a persisted research object');
  }

  const research = output as Partial<ResearchResult>;
  const scoreInputs = research.scoreInputs;
  const scoreKeys: Array<keyof ResearchResult['scoreInputs']> = [
    'digitalGap',
    'commercialStrength',
    'contactability',
    'localFit',
    'prototypeLeverage',
    'confidence',
  ];

  if (
    !scoreInputs ||
    scoreKeys.some(
      (key) =>
        typeof scoreInputs[key] !== 'number' ||
        !Number.isFinite(scoreInputs[key]),
    )
  ) {
    throw new Error('Scoring job requires complete persisted scoreInputs');
  }

  return processResearchResult(job, research as ResearchResult, env, db);
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
    }

    const afterContact = await repo.getProspect(job.prospectId);
    if (afterContact?.state === 'CONTACT_FOUND') {
      await repo.transitionProspect(
        afterContact.id,
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

  const deployedPrototype = await db
    .prepare(
      `SELECT deployment_url
       FROM prototypes
       WHERE prospect_id = ?
         AND status = 'DEPLOYED'
         AND deployment_url IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ deployment_url: string }>();

  if (!deployedPrototype?.deployment_url) {
    throw new Error('Initial outreach is blocked until a prototype is deployed');
  }

  const deploymentUrl = new URL(deployedPrototype.deployment_url).toString();
  if (!result.body.includes(deploymentUrl)) {
    throw new Error('Outreach draft is missing the exact deployed prototype URL');
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
      "SELECT id, body_text FROM outreach_messages WHERE prospect_id = ? AND status = 'DRAFT' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(job.prospectId)
    .first<{ id: string; body_text: string }>();

  if (!draft) throw new Error('No outreach draft found for fact-check');

  const deployedPrototype = await db
    .prepare(
      `SELECT deployment_url
       FROM prototypes
       WHERE prospect_id = ?
         AND status = 'DEPLOYED'
         AND deployment_url IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ deployment_url: string }>();

  if (!deployedPrototype?.deployment_url) {
    throw new Error('Initial outreach fact-check requires a deployed prototype');
  }

  let deploymentUrl: string;
  try {
    deploymentUrl = new URL(deployedPrototype.deployment_url).toString();
  } catch {
    throw new Error('Stored deployed prototype URL is invalid');
  }

  const confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));
  const approved =
    shouldAcceptFactCheckWithVerifiedDeploymentLink(
      result.approved === true,
      result.reasons ?? [],
      draft.body_text ?? '',
      deploymentUrl,
    ) && confidence >= configFromEnv(env).minOutreachConfidence;

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
      `SELECT COUNT(*) AS count
       FROM outreach_messages
       WHERE prospect_id = ?
         AND status = 'REJECTED'
         AND created_at >= COALESCE(
           (
             SELECT MAX(updated_at)
             FROM prototypes
             WHERE prospect_id = ?
               AND deployment_url IS NOT NULL
           ),
           '1970-01-01T00:00:00.000Z'
         )`,
    )
    .bind(job.prospectId, job.prospectId)
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
    case 'INTERESTED':
      recommendedAction = 'StÃƒÆ’Ã‚Â©phane doit examiner le message et reprendre personnellement le contact.';
      break;
    case 'MEETING_BOOKED':
      recommendedAction = 'StÃƒÆ’Ã‚Â©phane doit prÃƒÆ’Ã‚Â©parer puis tenir le rendez-vous ÃƒÆ’Ã‚Â  partir du briefing.';
      break;
    case 'QUOTE_PENDING':
      recommendedAction = 'PrÃƒÆ’Ã‚Â©parer ou valider humainement le devis avant tout envoi.';
      break;
    case 'COMMITTED':
      recommendedAction = 'VÃƒÆ’Ã‚Â©rifier humainement la rÃƒÆ’Ã‚Â©ception de lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢acompte avant de lancer la production.';
      break;
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

async function prepareCommercialBriefing(
  env: Env,
  db: D1DatabaseLike,
  prospect: Prospect,
  input: {
    source: CommercialBriefing['source'];
    contact?: string;
    message?: string;
    summary: string;
    confidence?: number;
  },
): Promise<CommercialBriefing> {
  const eventStore = new D1EventStore(db);
  const events = await eventStore.listByProspect(prospect.id);
  const prototype = await db
    .prepare(
      `SELECT id, status, qa_status, deployment_url
       FROM prototypes
       WHERE prospect_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(prospect.id)
    .first<{
      id: string;
      status: string;
      qa_status: string | null;
      deployment_url: string | null;
    }>();

  const prototypeLinks = buildPersonalizedEntryLinks({
    prospectId: prospect.id,
    companyName: prospect.companyName,
    prototypeUrl: prototype?.deployment_url ?? null,
    prototypeStatus: prototype?.status ?? null,
    qaStatus: prototype?.qa_status ?? null,
    personalizedBaseUrl: env.MAGICSCRIPT_PUBLIC_BASE_URL,
  });

  return buildCommercialBriefing({
    source: input.source,
    prospect,
    contact: input.contact,
    message: input.message,
    summary: input.summary,
    confidence: input.confidence,
    prototype: prototype
      ? {
          id: prototype.id,
          ...(prototypeLinks.prototypeUrl ? { url: prototypeLinks.prototypeUrl } : {}),
        }
      : undefined,
    ...(prototypeLinks.personalizedUrl
      ? { salesRoom: prototypeLinks.personalizedUrl }
      : {}),
    engagementHistory: events
      .filter((event) =>
        [
          'email.reply_received',
          'reply.classified',
          'commercial.interest_detected',
          'commercial.meeting_requested',
          'commercial.meeting_booked',
          'commercial.followup_draft_prepared',
          'sales_room.message_received',
          'sales_room.share_clicked',
        ].includes(event.type),
      )
      .slice(-20)
      .map((event) => ({ type: event.type, createdAt: event.createdAt })),
  });
}

function commercialEscalationSummary(
  briefing: CommercialBriefing,
  classification?: string,
): string {
  return [
    'Priority: HIGH',
    classification ? `Intent: ${classification}` : null,
    `Next action: StÃƒÆ’Ã‚Â©phane doit traiter le dossier humainement (${briefing.nextAction})`,
    `Briefing: ${briefing.company} Ãƒâ€šÃ‚Â· ${briefing.summary}`,
    briefing.message ? `Message reÃƒÆ’Ã‚Â§u: ${briefing.message.slice(0, 800)}` : null,
    briefing.primaryGap ? `Gap principal: ${briefing.primaryGap}` : null,
    briefing.unknowns.length ? `UNKNOWN: ${briefing.unknowns.join(', ')}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(' | ');
}

interface SalesRoomSummary {
  prospectId: string;
  companyName: string;
  slug: string;
  status: SalesRoomStatus;
  prototypeUrl: string | null;
  prototypeEntryPath: string;
  salesRoomPath: string;
  salesRoomUrl: string | null;
  ctaTarget: 'SALES_ROOM';
  createdAt: string;
  lastActivityAt: string;
  reviewDueAt: string | null;
  reviewDue: boolean;
  shareClicks: number;
  lastResolutionError: string | null;
}

function positiveIntegerOrDefault(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function prospectCompanyNames(db: D1DatabaseLike): Promise<string[]> {
  const result = await db
    .prepare('SELECT company_name FROM prospects WHERE company_name IS NOT NULL')
    .all<{ company_name: string }>();
  return (result.results ?? []).map((row) => row.company_name).filter(Boolean);
}

async function listSalesRoomSummaries(
  env: Env,
  db: D1DatabaseLike,
): Promise<SalesRoomSummary[]> {
  const result = await db
    .prepare(
      `SELECT
         pr.id AS prototype_id,
         pr.prospect_id,
         pr.deployment_url,
         pr.created_at AS prototype_created_at,
         pr.updated_at AS prototype_updated_at,
         p.company_name
       FROM prototypes pr
       JOIN prospects p ON p.id = pr.prospect_id
       WHERE pr.status = 'DEPLOYED'
         AND pr.qa_status = 'PASS'
         AND pr.updated_at = (
           SELECT MAX(newer.updated_at)
           FROM prototypes newer
           WHERE newer.prospect_id = pr.prospect_id
         )
       ORDER BY pr.updated_at DESC
       LIMIT 100`,
    )
    .all<{
      prototype_id: string;
      prospect_id: string;
      deployment_url: string | null;
      prototype_created_at: string;
      prototype_updated_at: string;
      company_name: string;
    }>();
  const names = await prospectCompanyNames(db);
  const eventStore = new D1EventStore(db);
  const reviewDays = positiveIntegerOrDefault(
    env.MAGICSCRIPT_SALES_ROOM_REVIEW_DAYS,
    30,
  );
  const summaries: SalesRoomSummary[] = [];

  for (const row of result.results ?? []) {
    const slug = buildSalesRoomSlug(row.company_name, row.prospect_id, names);
    const events = await eventStore.listByProspect(row.prospect_id);
    const state = deriveSalesRoomState({
      createdAt: row.prototype_created_at || row.prototype_updated_at,
      events,
      reviewAfterDays: reviewDays,
    });
    const links = buildPersonalizedEntryLinks({
      prospectId: row.prospect_id,
      companyName: row.company_name,
      salesRoomSlug: slug,
      salesRoomStatus: state.status,
      prototypeUrl: row.deployment_url,
      prototypeStatus: 'DEPLOYED',
      qaStatus: 'PASS',
      personalizedBaseUrl: env.MAGICSCRIPT_PUBLIC_BASE_URL,
    });
    summaries.push({
      prospectId: row.prospect_id,
      companyName: row.company_name,
      slug,
      status: state.status,
      prototypeUrl: links.prototypeUrl,
      prototypeEntryPath: `/demo/${encodeURIComponent(slug)}`,
      salesRoomPath: `/p/${encodeURIComponent(slug)}`,
      salesRoomUrl: links.salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
      createdAt: state.createdAt,
      lastActivityAt: state.lastActivityAt,
      reviewDueAt: state.reviewDueAt,
      reviewDue: state.reviewDue,
      shareClicks: state.shareClicks,
      lastResolutionError: state.lastResolutionError,
    });
  }

  return summaries;
}

type SalesRoomRecordedEvent =
  | 'SALES_ROOM_ACCESSED'
  | 'SHARE_CLICKED'
  | 'SALES_ROOM_RESOLUTION_FAILED';

function salesRoomEventType(value: unknown): SalesRoomRecordedEvent | null {
  return value === 'SALES_ROOM_ACCESSED' ||
    value === 'SHARE_CLICKED' ||
    value === 'SALES_ROOM_RESOLUTION_FAILED'
    ? value
    : null;
}

function safeSalesRoomSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+){0,15}$/.test(slug) ? slug : null;
}

function publicSalesRoomIngestionGuard(request: Request, env: Env): Response | null {
  if (env.MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED !== 'true') {
    return json(
      { error: 'Public Sales Room ingestion is not configured' },
      { status: 503 },
    );
  }

  const requestOrigin = request.headers.get('origin');
  const configuredBaseUrl = env.MAGICSCRIPT_PUBLIC_BASE_URL?.trim();
  if (requestOrigin && configuredBaseUrl) {
    let expectedOrigin: string;
    try {
      expectedOrigin = new URL(configuredBaseUrl).origin;
    } catch {
      return json({ error: 'Public Sales Room origin is not configured' }, { status: 503 });
    }
    if (requestOrigin !== expectedOrigin) {
      return json({ error: 'Origin not allowed' }, { status: 403 });
    }
  }

  return null;
}

function boundedString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
  required = false,
): string | null {
  const value = typeof body[field] === 'string' ? body[field].trim() : '';
  if (!value && required) throw new Error(`${field} is required`);
  if (value.length > maxLength) throw new Error(`${field} is too long`);
  return value || null;
}

function publicSalesRoomRequestIdempotencyKey(body: Record<string, unknown>): string {
  const key = boundedString(body, 'idempotencyKey', 160, true);
  if (!key || !/^[a-zA-Z0-9._:-]+$/.test(key)) {
    throw new Error('idempotencyKey is invalid');
  }
  return key;
}

interface CommercialQuoteRow {
  id: string;
  prospect_id: string;
  quote_id: string;
  quote_number: string;
  quote_version_hash: string;
  valid_until: string;
  cgv_reference: string;
  total_cents: number;
  currency: string;
}

interface QuoteAcceptanceProofRow {
  id: string;
  prospect_id: string;
  quote_id: string;
  quote_version_hash: string;
  idempotency_key: string;
}

function canonicalQuoteLegalConfig(env: Env): {
  vatNote: string;
  cgvReference: string;
} {
  const vatNote = env.MAGICSCRIPT_QUOTE_VAT_NOTE?.trim();
  const cgvReference = env.MAGICSCRIPT_QUOTE_CGV_REFERENCE?.trim();
  if (!vatNote || !cgvReference) {
    throw new Error('Canonical quote legal configuration is incomplete');
  }
  return { vatNote, cgvReference };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function addQuoteDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid quote issue date');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function commercialQuoteByProspectAndHash(
  db: D1DatabaseLike,
  prospectId: string,
  quoteVersionHash: string,
): Promise<CommercialQuoteRow | null> {
  return db
    .prepare(
      `SELECT
         id,
         prospect_id,
         quote_id,
         quote_number,
         quote_version_hash,
         valid_until,
         cgv_reference,
         total_cents,
         currency
       FROM commercial_quotes
       WHERE prospect_id = ? AND quote_version_hash = ?
       LIMIT 1`,
    )
    .bind(prospectId, quoteVersionHash)
    .first<CommercialQuoteRow>();
}

async function latestCommercialQuoteForProspect(
  db: D1DatabaseLike,
  prospectId: string,
): Promise<CommercialQuoteRow | null> {
  return db
    .prepare(
      `SELECT
         id,
         prospect_id,
         quote_id,
         quote_number,
         quote_version_hash,
         valid_until,
         cgv_reference,
         total_cents,
         currency
       FROM commercial_quotes
       WHERE prospect_id = ?
       ORDER BY published_at DESC, created_at DESC
       LIMIT 1`,
    )
    .bind(prospectId)
    .first<CommercialQuoteRow>();
}

async function quoteAcceptanceProofByIdempotencyKey(
  db: D1DatabaseLike,
  idempotencyKey: string,
): Promise<QuoteAcceptanceProofRow | null> {
  return db
    .prepare(
      `SELECT id, prospect_id, quote_id, quote_version_hash, idempotency_key
       FROM quote_acceptance_proofs
       WHERE idempotency_key = ?
       LIMIT 1`,
    )
    .bind(idempotencyKey)
    .first<QuoteAcceptanceProofRow>();
}

function quoteIsExpired(validUntil: string, now: Date): boolean {
  const expiry = new Date(`${validUntil}T23:59:59.999Z`);
  return !Number.isFinite(expiry.getTime()) || expiry.getTime() < now.getTime();
}

async function acceptPublicSalesRoomQuote(
  env: Env,
  db: D1DatabaseLike,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const context = await activeSalesRoomContext(env, db, body.slug);
  if (!context) throw new Error('Sales Room not found');

  const idempotencyKey = publicSalesRoomRequestIdempotencyKey(body);
  const signerName = boundedString(body, 'signerName', 160, true);
  const signerEmail = boundedString(body, 'signerEmail', 320, true);
  const signerCompanyName = boundedString(body, 'signerCompanyName', 240, true);

  if (body.consentGiven !== true) {
    throw new Error('Bon pour accord consent is required');
  }

  const existingProof = await quoteAcceptanceProofByIdempotencyKey(db, idempotencyKey);
  if (existingProof) {
    if (existingProof.prospect_id !== context.prospect.id) {
      throw new Error('idempotencyKey already belongs to another prospect');
    }

    const current = await new D1ProspectRepository(db).getProspect(context.prospect.id);
    return {
      ok: true,
      duplicate: true,
      proofReference: `quote-acceptance-proof:${existingProof.id}`,
      prospectId: context.prospect.id,
      state: current?.state ?? context.prospect.state,
    };
  }

  const quote = await latestCommercialQuoteForProspect(db, context.prospect.id);
  if (!quote) {
    throw new Error('Commercial quote not found');
  }

  if (quote.currency !== 'EUR') {
    throw new Error('Commercial quote currency is invalid');
  }

  if (!Number.isInteger(quote.total_cents) || quote.total_cents <= 0) {
    throw new Error('Commercial quote amount is invalid');
  }

  const now = new Date();
  if (quoteIsExpired(quote.valid_until, now)) {
    throw new Error('Commercial quote has expired');
  }

  const acceptedAt = now.toISOString();
  const proofId = crypto.randomUUID();

  const proof = {
    quoteId: quote.quote_id,
    quoteNumber: quote.quote_number,
    quoteVersionHash: quote.quote_version_hash,
    signerName: signerName ?? '',
    signerEmail: signerEmail ?? '',
    signerCompanyName: signerCompanyName ?? '',
    acceptedAt,
    consentGiven: true,
    consentLabel: 'BON_POUR_ACCORD' as const,
    cgvReference: quote.cgv_reference,
    totalCents: quote.total_cents,
    currency: 'EUR' as const,
    source: 'SALES_ROOM' as const,
  };

  const validation = validateQuoteAcceptanceProof(proof);
  if (!validation.accepted) {
    throw new Error(`Quote acceptance proof rejected: ${validation.reasons.join('; ')}`);
  }

  if (context.prospect.state !== 'QUOTE_PENDING') {
    throw new Error(`Quote acceptance rejected from state ${context.prospect.state}`);
  }

  try {
    await db
      .prepare(
        `INSERT INTO quote_acceptance_proofs (
          id,
          prospect_id,
          quote_id,
          quote_number,
          quote_version_hash,
          signer_name,
          signer_email,
          signer_company_name,
          accepted_at,
          consent_given,
          consent_label,
          cgv_reference,
          total_cents,
          currency,
          source,
          idempotency_key,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'BON_POUR_ACCORD', ?, ?, 'EUR', 'SALES_ROOM', ?, ?)`,
      )
      .bind(
        proofId,
        context.prospect.id,
        proof.quoteId,
        proof.quoteNumber,
        proof.quoteVersionHash,
        proof.signerName,
        proof.signerEmail,
        proof.signerCompanyName,
        proof.acceptedAt,
        proof.cgvReference,
        proof.totalCents,
        idempotencyKey,
        acceptedAt,
      )
      .run();
  } catch (error) {
    const raced = await quoteAcceptanceProofByIdempotencyKey(db, idempotencyKey);
    if (!raced || raced.prospect_id !== context.prospect.id) {
      throw error;
    }

    const current = await new D1ProspectRepository(db).getProspect(context.prospect.id);
    return {
      ok: true,
      duplicate: true,
      proofReference: `quote-acceptance-proof:${raced.id}`,
      prospectId: context.prospect.id,
      state: current?.state ?? context.prospect.state,
    };
  }

  const proofReference = `quote-acceptance-proof:${proofId}`;

  const transition = commercialTransition(
    context.prospect.state,
    'QUOTE_ACCEPTED',
    { quoteAcceptanceProofReference: proofReference },
  );

  const repo = new D1ProspectRepository(db);
  await repo.transitionProspect(
    context.prospect.id,
    transition.to,
    transition.reason,
  );

  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: context.prospect.id,
    actor: 'system',
    type: 'commercial.quote_accepted',
    payload: {
      quoteId: quote.quote_id,
      quoteNumber: quote.quote_number,
      quoteVersionHash: quote.quote_version_hash,
      quoteAcceptanceProofReference: proofReference,
      idempotencyKey,
      source: 'SALES_ROOM',
      humanValidationRequired: false,
    },
    createdAt: acceptedAt,
  });

  return {
    ok: true,
    duplicate: false,
    proofReference,
    prospectId: context.prospect.id,
    quoteId: quote.quote_id,
    quoteVersionHash: quote.quote_version_hash,
    state: transition.to,
  };
}
async function activeSalesRoomContext(
  env: Env,
  db: D1DatabaseLike,
  rawSlug: unknown,
): Promise<{ room: SalesRoomSummary; prospect: Prospect } | null> {
  const slug = safeSalesRoomSlug(rawSlug);
  if (!slug) return null;
  const room = (await listSalesRoomSummaries(env, db)).find(
    (candidate) => candidate.slug === slug && candidate.status === 'ACTIVE',
  );
  if (!room) return null;
  const prospect = await new D1ProspectRepository(db).getProspect(room.prospectId);
  return prospect ? { room, prospect } : null;
}

async function recordPublicSalesRoomMeetingRequest(
  env: Env,
  db: D1DatabaseLike,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const context = await activeSalesRoomContext(env, db, body.slug);
  if (!context) throw new Error('Sales Room not found');
  const idempotencyKey = publicSalesRoomRequestIdempotencyKey(body);
  const duplicate = await db
    .prepare(
      `SELECT id, prospect_id
       FROM events
       WHERE type = 'commercial.meeting_requested'
         AND json_extract(payload_json, '$.idempotencyKey') = ?
       LIMIT 1`,
    )
    .bind(idempotencyKey)
    .first<{ id: string; prospect_id: string | null }>();
  if (duplicate) {
    return {
      ok: true,
      duplicate: true,
      eventId: duplicate.id,
      prospectId: duplicate.prospect_id,
      state: context.prospect.state,
      meetingBooked: false,
    };
  }

  const repo = new D1ProspectRepository(db);
  if (context.prospect.state !== 'INTERESTED') {
    if (!canTransition(context.prospect.state, 'INTERESTED')) {
      throw new Error(`Sales Room intent rejected from state ${context.prospect.state}`);
    }
    await repo.transitionProspect(
      context.prospect.id,
      'INTERESTED',
      'Sales Room exchange request received; human scheduling remains required',
    );
  }

  const eventId = crypto.randomUUID();
  await new D1EventStore(db).append({
    id: eventId,
    prospectId: context.prospect.id,
    actor: 'system',
    type: 'commercial.meeting_requested',
    payload: {
      ...buildSalesRoomEventPayload({ slug: context.room.slug }),
      idempotencyKey,
      nextOwner: 'stephane',
      humanValidationRequired: true,
      meetingBooked: false,
    },
    createdAt: new Date().toISOString(),
  });
  await refreshPrototypeCostGateAfterObjectiveSignal(
    db,
    context.prospect.id,
    'MEETING_REQUESTED',
  );

  await createEscalation(
    db,
    context.prospect.id,
    'INTERESTED',
    `Demande dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã‚Â©change reÃƒÆ’Ã‚Â§ue depuis la Sales Room ${context.room.slug}. StÃƒÆ’Ã‚Â©phane doit reprendre contact humainement ; aucun rendez-vous nÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢est rÃƒÆ’Ã‚Â©servÃƒÆ’Ã‚Â©.`,
  );

  return {
    ok: true,
    eventId,
    prospectId: context.prospect.id,
    state: 'INTERESTED',
    meetingBooked: false,
  };
}

async function recordPublicSalesRoomMessage(
  env: Env,
  db: D1DatabaseLike,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const context = await activeSalesRoomContext(env, db, body.slug);
  if (!context) throw new Error('Sales Room not found');
  const idempotencyKey = publicSalesRoomRequestIdempotencyKey(body);
  const name = boundedString(body, 'name', 160);
  const email = boundedString(body, 'email', 254);
  const message = boundedString(body, 'message', 4000, true);
  if (!message) throw new Error('message is required');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('email is invalid');
  }
  const communicationMode: CommunicationMode | undefined =
    body.communicationMode === undefined ? undefined : body.communicationMode === 'email' ? 'email' : undefined;
  if (body.communicationMode !== undefined && !communicationMode) {
    throw new Error('communicationMode must be email');
  }
  if (communicationMode === 'email' && !email) throw new Error('email is required for email mode');
  if (context.prospect.state !== 'INTERESTED' && !canTransition(context.prospect.state, 'INTERESTED')) {
    throw new Error(`Sales Room message rejected from state ${context.prospect.state}`);
  }

  const duplicate = await db
    .prepare(
      `SELECT id, json_extract(payload_json, '$.replyId') AS reply_id
       FROM events
       WHERE type = 'sales_room.message_received'
         AND json_extract(payload_json, '$.idempotencyKey') = ?
       LIMIT 1`,
    )
    .bind(idempotencyKey)
    .first<{ id: string; reply_id: string | null }>();
  if (duplicate) {
    return {
      ok: true,
      duplicate: true,
      eventId: duplicate.id,
      replyId: duplicate.reply_id,
      prospectId: context.prospect.id,
      state: context.prospect.state,
      briefingReady: true,
    };
  }

  const replyId = crypto.randomUUID();
  const now = new Date().toISOString();
  const rawText = name ? `${name}\n\n${message}` : message;
  await db
    .prepare(
      `INSERT INTO replies (
        id, prospect_id, contact_id, provider_message_id, from_email,
        raw_text, classification, confidence, received_at, created_at
      ) VALUES (?, ?, NULL, NULL, ?, ?, NULL, NULL, ?, ?)`,
    )
    .bind(replyId, context.prospect.id, email, rawText, now, now)
    .run();

  const briefing = await processExplicitInterest(
    context.prospect,
    'CUSTOM_REQUEST',
    {
      classification: 'CUSTOM_REQUEST',
      confidence: 100,
      summary: 'Message explicite reÃƒÆ’Ã‚Â§u depuis la Sales Room ; traitement humain requis.',
    },
    { id: replyId, raw_text: rawText, email },
    env,
    db,
    false,
  );
  const eventId = crypto.randomUUID();
  await new D1EventStore(db).append({
    id: eventId,
    prospectId: context.prospect.id,
    actor: 'system',
    type: 'sales_room.message_received',
    payload: {
      ...buildSalesRoomEventPayload({ slug: context.room.slug }),
      idempotencyKey,
      replyId,
      hasEmail: Boolean(email),
      messageLength: message.length,
      nextOwner: 'stephane',
      humanValidationRequired: true,
      externalResponseCreated: false,
      ...(communicationMode ? { communicationMode } : {}),
    },
    createdAt: now,
  });
  await refreshPrototypeCostGateAfterObjectiveSignal(
    db,
    context.prospect.id,
    'SALES_ROOM_MESSAGE',
    now,
  );

  if (communicationMode) {
    await recordCommunicationMode(db, context.prospect.id, context.room.slug, communicationMode, idempotencyKey, now);
  }

  return {
    ok: true,
    eventId,
    replyId,
    prospectId: context.prospect.id,
    state: 'INTERESTED',
    briefingReady: Boolean(briefing),
    externalResponseCreated: false,
  };
}

async function recordSalesRoomEvent(
  env: Env,
  db: D1DatabaseLike,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const type = salesRoomEventType(body.type);
  const slug = safeSalesRoomSlug(body.slug);
  if (!type || !slug) throw new Error('type, slug and idempotencyKey are required');
  const idempotencyKey = publicSalesRoomRequestIdempotencyKey(body);

  const duplicate = await db
    .prepare(
      `SELECT id, prospect_id
       FROM events
       WHERE type IN ('sales_room.accessed', 'sales_room.share_clicked', 'sales_room.resolution_failed')
         AND json_extract(payload_json, '$.idempotencyKey') = ?
       LIMIT 1`,
    )
    .bind(idempotencyKey)
    .first<{ id: string; prospect_id: string | null }>();
  if (duplicate) {
    return { ok: true, duplicate: true, eventId: duplicate.id, prospectId: duplicate.prospect_id };
  }

  const summaries = await listSalesRoomSummaries(env, db);
  const room = summaries.find((candidate) => candidate.slug === slug);
  const now = new Date().toISOString();
  const internalType =
    type === 'SHARE_CLICKED'
      ? 'sales_room.share_clicked'
      : type === 'SALES_ROOM_ACCESSED'
        ? 'sales_room.accessed'
        : 'sales_room.resolution_failed';
  const reason =
    type === 'SALES_ROOM_RESOLUTION_FAILED' &&
    typeof body.reason === 'string' &&
    ['UNKNOWN_SLUG', 'DISABLED', 'MISSING_DATA', 'INVALID_ROUTE'].includes(body.reason)
      ? body.reason
      : undefined;
  const payload = {
    ...buildSalesRoomEventPayload({
      slug,
      channel: typeof body.channel === 'string' ? body.channel.slice(0, 32) : undefined,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId.slice(0, 120) : undefined,
      reason,
    }),
    idempotencyKey,
    prospectResolved: Boolean(room),
  };
  const eventId = crypto.randomUUID();
  await new D1EventStore(db).append({
    id: eventId,
    ...(room ? { prospectId: room.prospectId } : {}),
    actor: 'system',
    type: internalType,
    payload,
    createdAt: now,
  });

  if (type === 'SALES_ROOM_RESOLUTION_FAILED' && room) {
    await createEscalation(
      db,
      room.prospectId,
      'MANUAL_REVIEW_REQUIRED',
      `Sales Room indisponible pour ${room.companyName} (${reason ?? 'UNRESOLVED'})`,
    );
  }

  return {
    ok: true,
    eventId,
    prospectId: room?.prospectId ?? null,
    resolved: Boolean(room),
  };
}

type MeetingRow = {
  id: string;
  prospect_id: string;
  sales_room_slug: string;
  communication_mode: CommunicationMode;
  start_at_utc: string;
  end_at_utc: string;
  prospect_timezone: string;
  phone: string;
  status: MeetingStatus;
  confirmed_at: string;
  cancelled_at: string | null;
  rescheduled_from_id: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  company_name?: string;
  prospect_state?: string;
};

function availabilityConfigFromEnv(env: Env): AvailabilityConfig {
  return {
    ...DEFAULT_AVAILABILITY,
    timeZone: env.MAGICSCRIPT_AVAILABILITY_TIMEZONE?.trim() || DEFAULT_AVAILABILITY.timeZone,
    startTime: env.MAGICSCRIPT_AVAILABILITY_START?.trim() || DEFAULT_AVAILABILITY.startTime,
    endTime: env.MAGICSCRIPT_AVAILABILITY_END?.trim() || DEFAULT_AVAILABILITY.endTime,
    horizonDays: positiveIntegerOrDefault(
      env.MAGICSCRIPT_AVAILABILITY_HORIZON_DAYS,
      DEFAULT_AVAILABILITY.horizonDays,
    ),
  };
}

function normalizedPhone(body: Record<string, unknown>): string {
  const phone = boundedString(body, 'phone', 40, true);
  if (!phone || !/^[0-9+().\s-]{6,40}$/.test(phone)) {
    throw new Error('phone is invalid');
  }
  return phone;
}

function meetingView(row: MeetingRow): Record<string, unknown> {
  return {
    meetingId: row.id,
    prospectId: row.prospect_id,
    companyName: row.company_name ?? null,
    salesRoomSlug: row.sales_room_slug,
    communicationMode: row.communication_mode,
    startAtUtc: row.start_at_utc,
    endAtUtc: row.end_at_utc,
    prospectTimezone: row.prospect_timezone,
    prospectTime: formatInTimeZone(row.start_at_utc, row.prospect_timezone),
    parisTime: formatInTimeZone(row.start_at_utc, 'Europe/Paris'),
    phone: row.phone,
    status: row.status,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    rescheduledFromId: row.rescheduled_from_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getMeetingByIdempotency(
  db: D1DatabaseLike,
  idempotencyKey: string,
): Promise<MeetingRow | null> {
  return db
    .prepare('SELECT * FROM meetings WHERE idempotency_key = ? LIMIT 1')
    .bind(idempotencyKey)
    .first<MeetingRow>();
}

async function getMeetingById(
  db: D1DatabaseLike,
  meetingId: string,
): Promise<MeetingRow | null> {
  return db
    .prepare(
      `SELECT m.*, p.company_name, p.state AS prospect_state
       FROM meetings m
       JOIN prospects p ON p.id = m.prospect_id
       WHERE m.id = ?
       LIMIT 1`,
    )
    .bind(meetingId)
    .first<MeetingRow>();
}

async function listMeetingsInRange(
  db: D1DatabaseLike,
  startAtUtc: string,
  endAtUtc: string,
): Promise<MeetingRow[]> {
  const result = await db
    .prepare(
      `SELECT m.*, p.company_name, p.state AS prospect_state
       FROM meetings m
       JOIN prospects p ON p.id = m.prospect_id
       WHERE m.start_at_utc >= ? AND m.start_at_utc < ?
       ORDER BY m.start_at_utc ASC, m.created_at ASC`,
    )
    .bind(startAtUtc, endAtUtc)
    .all<MeetingRow>();
  return result.results ?? [];
}

async function occupiedMeetingStarts(
  db: D1DatabaseLike,
  startAtUtc: string,
  endAtUtc: string,
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT start_at_utc
       FROM meetings
       WHERE status = 'CONFIRMED'
         AND start_at_utc >= ?
         AND start_at_utc < ?`,
    )
    .bind(startAtUtc, endAtUtc)
    .all<{ start_at_utc: string }>();
  return (result.results ?? []).map((row) => row.start_at_utc);
}

async function recordCommunicationMode(
  db: D1DatabaseLike,
  prospectId: string,
  slug: string,
  mode: CommunicationMode,
  idempotencyKey: string,
  now: string,
): Promise<void> {
  const existing = await db
    .prepare(
      `SELECT id FROM events
       WHERE type = 'commercial.communication_mode_selected'
         AND json_extract(payload_json, '$.idempotencyKey') = ?
       LIMIT 1`,
    )
    .bind(idempotencyKey)
    .first<{ id: string }>();
  if (existing) return;
  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId,
    actor: 'system',
    type: 'commercial.communication_mode_selected',
    payload: {
      slug,
      communicationMode: mode,
      idempotencyKey,
      nextOwner: 'stephane',
    },
    createdAt: now,
  });
}

async function prepareMeetingArtifacts(
  env: Env,
  db: D1DatabaseLike,
  row: MeetingRow,
  prospect: Prospect,
  contactName: string | undefined,
  rescheduledFromId?: string,
): Promise<{ briefing: CommercialBriefing; confirmationEmail: MeetingConfirmationEmail }> {
  const current = await new D1ProspectRepository(db).getProspect(prospect.id);
  if (!current) throw new Error('Prospect not found for meeting booking');
  if (current.state !== 'MEETING_BOOKED') {
    const transition = commercialTransition(current.state, 'MEETING_BOOKED');
    await new D1ProspectRepository(db).transitionProspect(
      current.id,
      transition.to,
      transition.reason,
    );
  }

  const briefing = await prepareCommercialBriefing(env, db, current, {
    source: 'meeting_booking',
    contact: contactName?.trim() || row.phone,
    summary: 'Rendez-vous tÃƒÆ’Ã‚Â©lÃƒÆ’Ã‚Â©phonique effectivement rÃƒÆ’Ã‚Â©servÃƒÆ’Ã‚Â© ; briefing commercial ÃƒÆ’Ã‚Â  traiter par StÃƒÆ’Ã‚Â©phane.',
  });
  const confirmationEmail = buildMeetingConfirmationEmail({
    company: current.companyName,
    contactName,
    startAtUtc: row.start_at_utc,
    endAtUtc: row.end_at_utc,
    prospectTimeZone: row.prospect_timezone,
    phone: row.phone,
  });
  const now = new Date().toISOString();
  const eventStore = new D1EventStore(db);
  await eventStore.append({
    id: crypto.randomUUID(),
    prospectId: current.id,
    actor: 'system',
    type: 'commercial.meeting_booked',
    payload: {
      meetingId: row.id,
      salesRoomSlug: row.sales_room_slug,
      communicationMode: row.communication_mode,
      startAtUtc: row.start_at_utc,
      endAtUtc: row.end_at_utc,
      prospectTimezone: row.prospect_timezone,
      prospectTime: formatInTimeZone(row.start_at_utc, row.prospect_timezone),
      parisTime: formatInTimeZone(row.start_at_utc, 'Europe/Paris'),
      phone: row.phone,
      nextOwner: 'stephane',
      briefing,
      ...(rescheduledFromId ? { rescheduledFromId } : {}),
    },
    createdAt: now,
  });
  await refreshPrototypeCostGateAfterObjectiveSignal(
    db,
    current.id,
    'MEETING_BOOKED',
    now,
  );

  await eventStore.append({
    id: crypto.randomUUID(),
    prospectId: current.id,
    actor: 'system',
    type: 'meeting.confirmation_email_draft',
    payload: {
      meetingId: row.id,
      status: 'DRAFT',
      dryRun: true,
      externalSend: false,
      subject: confirmationEmail.subject,
      body: confirmationEmail.body,
    },
    createdAt: now,
  });
  await createEscalation(
    db,
    current.id,
    'MEETING_BOOKED',
    `${commercialEscalationSummary(briefing)} | Martinique: ${formatInTimeZone(row.start_at_utc, row.prospect_timezone)} | Paris: ${formatInTimeZone(row.start_at_utc, 'Europe/Paris')} | TÃƒÆ’Ã‚Â©lÃƒÆ’Ã‚Â©phone: ${row.phone}`,
  );
  return { briefing, confirmationEmail };
}

async function bookPublicSalesRoomMeeting(
  env: Env,
  db: D1DatabaseLike,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const context = await activeSalesRoomContext(env, db, body.slug);
  if (!context) throw new Error('Sales Room not found');
  const idempotencyKey = publicSalesRoomRequestIdempotencyKey(body);
  const existing = await getMeetingByIdempotency(db, idempotencyKey);
  if (existing) {
    if (existing.prospect_id !== context.prospect.id) throw new Error('idempotencyKey is already used');
    return { ok: true, duplicate: true, meeting: meetingView(existing), state: context.prospect.state };
  }
  if (body.communicationMode !== 'phone') throw new Error('communicationMode must be phone');
  const prospectTimezone = typeof body.prospectTimezone === 'string' && body.prospectTimezone.trim()
    ? body.prospectTimezone.trim()
    : DEFAULT_AVAILABILITY.timeZone;
  assertTimeZone(prospectTimezone);
  const phone = normalizedPhone(body);
  const config = availabilityConfigFromEnv(env);
  const nowUtc = new Date().toISOString();
  const startAtUtc = typeof body.startAtUtc === 'string' ? body.startAtUtc.trim() : '';
  const slot = slotForStart({
    startAtUtc,
    nowUtc,
    config,
    prospectTimeZone: prospectTimezone,
  });
  if (!slot) throw new Error('SLOT_UNAVAILABLE');

  const rescheduledFromId = typeof body.rescheduledFromMeetingId === 'string'
    ? body.rescheduledFromMeetingId.trim()
    : '';
  const activeMeeting = await db
    .prepare(
      `SELECT * FROM meetings
       WHERE prospect_id = ? AND status = 'CONFIRMED'
       ORDER BY start_at_utc ASC LIMIT 1`,
    )
    .bind(context.prospect.id)
    .first<MeetingRow>();
  let previousMeeting: MeetingRow | null = null;
  if (rescheduledFromId) {
    previousMeeting = await getMeetingById(db, rescheduledFromId);
    if (!previousMeeting || previousMeeting.prospect_id !== context.prospect.id || previousMeeting.status !== 'CONFIRMED') {
      throw new Error('rescheduledFromMeetingId is not an active meeting');
    }
    if (activeMeeting && activeMeeting.id !== previousMeeting.id) throw new Error('ACTIVE_MEETING_EXISTS');
  } else if (activeMeeting) {
    throw new Error('ACTIVE_MEETING_EXISTS');
  }

  const repo = new D1ProspectRepository(db);
  const current = await repo.getProspect(context.prospect.id);
  if (!current) throw new Error('Prospect not found');
  if (current.state !== 'MEETING_BOOKED' && current.state !== 'INTERESTED') {
    if (!canTransition(current.state, 'INTERESTED')) {
      throw new Error(`Meeting booking rejected from state ${current.state}`);
    }
    await repo.transitionProspect(current.id, 'INTERESTED', 'Phone communication mode selected; slot confirmation pending');
  }

  const now = new Date().toISOString();
  const meeting: MeetingRow = {
    id: crypto.randomUUID(),
    prospect_id: context.prospect.id,
    sales_room_slug: context.room.slug,
    communication_mode: 'phone',
    start_at_utc: slot.startAtUtc,
    end_at_utc: slot.endAtUtc,
    prospect_timezone: prospectTimezone,
    phone,
    status: 'CONFIRMED',
    confirmed_at: now,
    cancelled_at: null,
    rescheduled_from_id: previousMeeting?.id ?? null,
    idempotency_key: idempotencyKey,
    created_at: now,
    updated_at: now,
    company_name: context.prospect.companyName,
  };
  try {
    await db
      .prepare(
        `INSERT INTO meetings (
          id, prospect_id, sales_room_slug, communication_mode,
          start_at_utc, end_at_utc, prospect_timezone, phone, status,
          confirmed_at, cancelled_at, rescheduled_from_id, idempotency_key,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        meeting.id,
        meeting.prospect_id,
        meeting.sales_room_slug,
        meeting.communication_mode,
        meeting.start_at_utc,
        meeting.end_at_utc,
        meeting.prospect_timezone,
        meeting.phone,
        meeting.status,
        meeting.confirmed_at,
        meeting.cancelled_at,
        meeting.rescheduled_from_id,
        meeting.idempotency_key,
        meeting.created_at,
        meeting.updated_at,
      )
      .run();
  } catch (error) {
    const replay = await getMeetingByIdempotency(db, idempotencyKey);
    if (replay && replay.prospect_id === context.prospect.id) {
      return { ok: true, duplicate: true, meeting: meetingView(replay), state: context.prospect.state };
    }
    throw new Error('SLOT_UNAVAILABLE');
  }

  if (previousMeeting) {
    await db
      .prepare(
        `UPDATE meetings
         SET status = 'RESCHEDULED', cancelled_at = ?, updated_at = ?
         WHERE id = ? AND status = 'CONFIRMED'`,
      )
      .bind(now, now, previousMeeting.id)
      .run();
    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: context.prospect.id,
      actor: 'system',
      type: 'commercial.meeting_rescheduled',
      payload: {
        meetingId: meeting.id,
        rescheduledFromId: previousMeeting.id,
        nextOwner: 'stephane',
      },
      createdAt: now,
    });
  }
  await recordCommunicationMode(db, context.prospect.id, context.room.slug, 'phone', idempotencyKey, now);
  const artifacts = await prepareMeetingArtifacts(
    env,
    db,
    meeting,
    context.prospect,
    typeof body.name === 'string' ? body.name.trim() : undefined,
    previousMeeting?.id,
  );
  const saved = await getMeetingById(db, meeting.id);
  return {
    ok: true,
    meeting: meetingView(saved ?? meeting),
    state: 'MEETING_BOOKED',
    briefing: artifacts.briefing,
    confirmationEmail: {
      ...artifacts.confirmationEmail,
      dryRun: true,
      externalSend: false,
    },
  };
}

async function cancelPublicSalesRoomMeeting(
  db: D1DatabaseLike,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const slug = safeSalesRoomSlug(body.slug);
  const meetingId = boundedString(body, 'meetingId', 120, true);
  const idempotencyKey = publicSalesRoomRequestIdempotencyKey(body);
  if (!slug || !meetingId) throw new Error('slug and meetingId are required');
  const duplicate = await db
    .prepare(
      `SELECT id FROM events
       WHERE type = 'commercial.meeting_cancelled'
         AND json_extract(payload_json, '$.idempotencyKey') = ?
       LIMIT 1`,
    )
    .bind(idempotencyKey)
    .first<{ id: string }>();
  const meeting = await getMeetingById(db, meetingId);
  if (!meeting || meeting.sales_room_slug !== slug) throw new Error('Meeting not found');
  if (duplicate || meeting.status === 'CANCELLED' || meeting.status === 'RESCHEDULED') {
    return { ok: true, duplicate: true, meeting: meetingView(meeting) };
  }
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE meetings
       SET status = 'CANCELLED', cancelled_at = ?, updated_at = ?
       WHERE id = ? AND status = 'CONFIRMED'`,
    )
    .bind(now, now, meeting.id)
    .run();
  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: meeting.prospect_id,
    actor: 'system',
    type: 'commercial.meeting_cancelled',
    payload: {
      meetingId: meeting.id,
      slug,
      idempotencyKey,
      nextOwner: 'stephane',
    },
    createdAt: now,
  });
  const remaining = await db
    .prepare("SELECT id FROM meetings WHERE prospect_id = ? AND status = 'CONFIRMED' LIMIT 1")
    .bind(meeting.prospect_id)
    .first<{ id: string }>();
  const prospect = await new D1ProspectRepository(db).getProspect(meeting.prospect_id);
  if (prospect?.state === 'MEETING_BOOKED' && !remaining) {
    await new D1ProspectRepository(db).transitionProspect(
      prospect.id,
      'INTERESTED',
      'Meeting cancelled; prospect remains available for human follow-up',
    );
  }
  return { ok: true, meeting: meetingView((await getMeetingById(db, meeting.id)) ?? meeting), state: remaining ? 'MEETING_BOOKED' : 'INTERESTED' };
}

async function listPublicSalesRoomAvailability(
  env: Env,
  db: D1DatabaseLike,
  url: URL,
): Promise<Record<string, unknown>> {
  const context = await activeSalesRoomContext(env, db, url.searchParams.get('slug'));
  if (!context) throw new Error('Sales Room not found');
  const config = availabilityConfigFromEnv(env);
  const fromDate = url.searchParams.get('from')?.trim() || dateKeyInTimeZone(new Date(), config.timeZone);
  const days = Math.min(31, Math.max(1, Number.parseInt(url.searchParams.get('days') ?? '', 10) || config.horizonDays));
  const prospectTimeZone = url.searchParams.get('timeZone')?.trim() || config.timeZone;
  assertTimeZone(prospectTimeZone);
  const rangeStart = zonedLocalToUtc(fromDate, '00:00', config.timeZone);
  const rangeEnd = zonedLocalToUtc(addCalendarDays(fromDate, days), '00:00', config.timeZone);
  const occupied = await occupiedMeetingStarts(db, rangeStart, rangeEnd);
  return {
    ok: true,
    slug: context.room.slug,
    timeZone: prospectTimeZone,
    availabilityTimeZone: config.timeZone,
    durationMinutes: config.durationMinutes,
    slots: generateAvailability({
      fromDate,
      nowUtc: new Date().toISOString(),
      config,
      occupiedStarts: occupied,
      days,
      prospectTimeZone,
    }),
  };
}

async function listControlCenterMeetings(
  db: D1DatabaseLike,
  url: URL,
): Promise<Record<string, unknown>> {
  const range = url.searchParams.get('from') && url.searchParams.get('to')
    ? {
        startAtUtc: new Date(url.searchParams.get('from') as string).toISOString(),
        endAtUtc: new Date(url.searchParams.get('to') as string).toISOString(),
      }
    : getWeekRangeUtc(new Date().toISOString(), 'Europe/Paris');
  const meetings = await listMeetingsInRange(db, range.startAtUtc, range.endAtUtc);
  const views = await Promise.all(
    meetings.map(async (meeting) => {
      const briefing = await db
        .prepare(
          `SELECT id FROM events
           WHERE type = 'commercial.meeting_booked'
             AND json_extract(payload_json, '$.meetingId') = ?
           LIMIT 1`,
        )
        .bind(meeting.id)
        .first<{ id: string }>();
      return { ...meetingView(meeting), briefingAvailable: Boolean(briefing) };
    }),
  );
  return { ok: true, timeZone: 'Europe/Paris', meetings: views };
}

async function scheduleMeetingReminders(
  db: D1DatabaseLike,
  nowUtc = new Date().toISOString(),
): Promise<{ prepared: number; skipped: number }> {
  const now = new Date(nowUtc);
  if (!Number.isFinite(now.getTime())) throw new Error('nowUtc is invalid');
  const horizon = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await db
    .prepare(
      `SELECT m.*, p.company_name, p.state AS prospect_state
       FROM meetings m JOIN prospects p ON p.id = m.prospect_id
       WHERE m.status = 'CONFIRMED' AND m.communication_mode = 'phone'
         AND m.start_at_utc >= ? AND m.start_at_utc < ?
       ORDER BY m.start_at_utc ASC`,
    )
    .bind(nowUtc, horizon)
    .all<MeetingRow>();
  let prepared = 0;
  let skipped = 0;
  for (const row of rows.results ?? []) {
    const existing = await db
      .prepare(
        `SELECT id FROM events
         WHERE type = 'meeting.reminder_draft'
           AND json_extract(payload_json, '$.meetingId') = ?
         LIMIT 1`,
      )
      .bind(row.id)
      .first<{ id: string }>();
    const plan = buildH24ReminderPlan({
      company: row.company_name ?? row.prospect_id,
      startAtUtc: row.start_at_utc,
      endAtUtc: row.end_at_utc,
      prospectTimeZone: row.prospect_timezone,
      communicationMode: row.communication_mode,
      status: row.status,
      nowUtc,
      alreadyPrepared: Boolean(existing),
    });
    if (!plan) {
      skipped += 1;
      continue;
    }
    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: row.prospect_id,
      actor: 'system',
      type: 'meeting.reminder_draft',
      payload: {
        meetingId: row.id,
        dryRun: true,
        externalSend: false,
        ...plan,
      },
      createdAt: nowUtc,
    });
    prepared += 1;
  }
  return { prepared, skipped };
}

async function processExplicitInterest(
  prospect: Prospect,
  classification: string,
  result: ClassificationResult,
  reply: { id: string; raw_text: string; email: string | null },
  env: Env,
  db: D1DatabaseLike,
  refreshCostGate = true,
): Promise<CommercialBriefing> {
  const targetState = stateForInboundClassification(classification);
  if (!targetState) {
    throw new Error(`Classification is not an explicit interest: ${classification}`);
  }

  const repo = new D1ProspectRepository(db);
  if (prospect.state !== targetState) {
    await repo.transitionProspect(
      prospect.id,
      targetState,
      `Explicit inbound interest detected (${classification}); human review required`,
    );
  }

  const briefing = await prepareCommercialBriefing(env, db, prospect, {
    source: 'inbound_message',
    contact: reply.email ?? undefined,
    message: reply.raw_text,
    summary: result.summary,
    confidence: result.confidence,
  });
  const now = new Date().toISOString();
  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'response-agent',
    type: 'commercial.interest_detected',
    payload: {
      replyId: reply.id,
      classification,
      priority: 'HIGH',
      humanRequired: true,
      autoPrototype: false,
      nextOwner: 'stephane',
      briefing,
    },
    createdAt: now,
  });
  if (refreshCostGate) {
    await refreshPrototypeCostGateAfterObjectiveSignal(
      db,
      prospect.id,
      'INBOUND_INTEREST',
      now,
    );
  }

  await createEscalation(
    db,
    prospect.id,
    'INTERESTED',
    commercialEscalationSummary(briefing, classification),
  );

  return briefing;
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
    case 'INFORMATION_REQUEST':
    case 'PRICING_REQUESTED':
    case 'MEETING_REQUESTED':
    case 'CUSTOM_REQUEST':
      await processExplicitInterest(prospect, result.classification, result, reply, env, db);
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
         AND status IN ('RUNNING', 'SENDING')
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
  const primaryAsset = prospect.primaryAsset ?? 'votre activitÃƒÆ’Ã‚Â©';
  if (sequence <= 1) {
    return [
      'Bonjour,',
      '',
      `Je me permets de revenir sur mon message prÃƒÆ’Ã‚Â©cÃƒÆ’Ã‚Â©dent concernant ${companyName}.`,
      `Si le sujet de votre prÃƒÆ’Ã‚Â©sence digitale est dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢actualitÃƒÆ’Ã‚Â©, je peux vous montrer trÃƒÆ’Ã‚Â¨s concrÃƒÆ’Ã‚Â¨tement comment Magic Script pourrait mettre en valeur ${primaryAsset}.`,
      '',
      'Si ce nÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢est pas pertinent pour vous, dites-le-moi simplement et je ne vous relancerai plus.',
      '',
      'Bien ÃƒÆ’Ã‚Â  vous,',
      'Magic Script',
    ].join('\n');
  }

  return [
    'Bonjour,',
    '',
    `Dernier petit message de ma part concernant mon prÃƒÆ’Ã‚Â©cÃƒÆ’Ã‚Â©dent email pour ${companyName}.`,
    `Si vous souhaitez voir lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢idÃƒÆ’Ã‚Â©e plus concrÃƒÆ’Ã‚Â¨te, je peux vous partager une dÃƒÆ’Ã‚Â©monstration adaptÃƒÆ’Ã‚Â©e ÃƒÆ’Ã‚Â  ${primaryAsset}.`,
    '',
    'Sinon, aucun souci : je clÃƒÆ’Ã‚Â´ture ici et ne vous relancerai plus.',
    '',
    'Bien ÃƒÆ’Ã‚Â  vous,',
    'Magic Script',
  ].join('\n');
}

function interestFollowUpBody(sequence: 1 | 2, prospect: Prospect): string {
  const companyName = prospect.companyName || 'votre entreprise';
  if (sequence === 1) {
    return [
      'Bonjour,',
      '',
      `Je reviens vers vous ÃƒÆ’Ã‚Â  la suite de votre message concernant ${companyName}.`,
      'StÃƒÆ’Ã‚Â©phane peut reprendre directement le sujet avec vous et rÃƒÆ’Ã‚Â©pondre ÃƒÆ’Ã‚Â  vos questions.',
      '',
      'Si vous souhaitez poursuivre, indiquez-moi simplement le meilleur moment pour ÃƒÆ’Ã‚Â©changer.',
      '',
      'Bien ÃƒÆ’Ã‚Â  vous,',
      'Magic Script',
    ].join('\n');
  }

  return [
    'Bonjour,',
    '',
    `Dernier message de ma part concernant votre demande pour ${companyName}.`,
    'Si le projet est toujours dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢actualitÃƒÆ’Ã‚Â©, StÃƒÆ’Ã‚Â©phane pourra vous rÃƒÆ’Ã‚Â©pondre directement.',
    '',
    'Sans retour de votre part, nous clÃƒÆ’Ã‚Â´turerons simplement le suivi.',
    '',
    'Bien ÃƒÆ’Ã‚Â  vous,',
    'Magic Script',
  ].join('\n');
}

async function schedulePrototypeCostGateJ30Drafts(
  env: Env,
  db: D1DatabaseLike,
  nowUtc = new Date().toISOString(),
): Promise<{
  prepared: number;
  reevaluated: number;
  dormant: number;
  skipped: number;
}> {
  const config = configFromEnv(env);

  if (!config.autopilotEnabled) {
    return {
      prepared: 0,
      reevaluated: 0,
      dormant: 0,
      skipped: 0,
    };
  }

  const nowTime = new Date(nowUtc).getTime();

  if (!Number.isFinite(nowTime)) {
    throw new Error('nowUtc is invalid');
  }

  const repo = new D1ProspectRepository(db);
  const eventStore = new D1EventStore(db);

  let prepared = 0;
  let reevaluated = 0;
  let dormant = 0;
  let skipped = 0;

  const finalFollowupCutoff = new Date(
    nowTime - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const sentFinalFollowups = await db
    .prepare(
      `SELECT
         e.prospect_id,
         json_extract(
           e.payload_json,
           '$.messageId'
         ) AS message_id,
         om.sent_at
       FROM events e
       JOIN outreach_messages om
         ON om.id = json_extract(
           e.payload_json,
           '$.messageId'
         )
       WHERE e.type =
         'prototype_cost_gate.j30_followup_draft_prepared'
         AND e.prospect_id IS NOT NULL
         AND om.status = 'SENT'
         AND om.sent_at IS NOT NULL
         AND om.sent_at <= ?
       ORDER BY om.sent_at ASC
       LIMIT 250`,
    )
    .bind(finalFollowupCutoff)
    .all<{
      prospect_id: string;
      message_id: string;
      sent_at: string;
    }>();

  for (const candidate of sentFinalFollowups.results ?? []) {
    const prospect = await repo.getProspect(
      candidate.prospect_id,
    );

    if (!prospect || prospect.state !== 'INTERESTED') {
      skipped += 1;
      continue;
    }

    const newInboundOrObjectiveSignal = await db
      .prepare(
        `SELECT id
         FROM events
         WHERE prospect_id = ?
           AND created_at > ?
           AND type IN (
             'email.reply_received',
             'commercial.interest_detected',
             'sales_room.message_received',
             'commercial.meeting_requested',
             'commercial.meeting_booked'
           )
         LIMIT 1`,
      )
      .bind(
        prospect.id,
        candidate.sent_at,
      )
      .first<{ id: string }>();

    if (newInboundOrObjectiveSignal) {
      skipped += 1;
      continue;
    }

    if (!canTransition(prospect.state, 'DORMANT')) {
      skipped += 1;
      continue;
    }

    await repo.transitionProspect(
      prospect.id,
      'DORMANT',
      'No response 7 days after the final J+30 Cost Gate follow-up',
    );

    await eventStore.append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type: 'commercial.dormant',
      payload: {
        reason:
          'No inbound response 7 days after final J+30 Cost Gate follow-up',
        source: 'PROTOTYPE_COST_GATE_J30',
        messageId: candidate.message_id,
        historyPreserved: true,
      },
      createdAt: nowUtc,
    });

    dormant += 1;
  }

  const candidates = await db
    .prepare(
      `SELECT DISTINCT prospect_id
       FROM prototype_cost_gate_evaluations
       WHERE decision = 'NO-GO'
         AND reevaluate_at IS NOT NULL
         AND reevaluate_at <= ?
       ORDER BY reevaluate_at ASC
       LIMIT 250`,
    )
    .bind(nowUtc)
    .all<{ prospect_id: string }>();

  for (const candidate of candidates.results ?? []) {
    const alreadyPrepared = await db
      .prepare(
        `SELECT id
         FROM events
         WHERE prospect_id = ?
           AND type =
             'prototype_cost_gate.j30_followup_draft_prepared'
         LIMIT 1`,
      )
      .bind(candidate.prospect_id)
      .first<{ id: string }>();

    if (alreadyPrepared) {
      skipped += 1;
      continue;
    }

    const prospect = await repo.getProspect(
      candidate.prospect_id,
    );

    if (!prospect || prospect.state !== 'INTERESTED') {
      skipped += 1;
      continue;
    }

    const latestGate =
      await getLatestPrototypeCostGate(
        db,
        prospect.id,
      );

    if (
      !latestGate ||
      latestGate.decision !== 'NO-GO' ||
      !latestGate.reevaluate_at ||
      new Date(
        latestGate.reevaluate_at,
      ).getTime() > nowTime
    ) {
      skipped += 1;
      continue;
    }

    const contact = await db
      .prepare(
        `SELECT id
         FROM contacts
         WHERE prospect_id = ?
           AND is_validated = 1
           AND is_suppressed = 0
         ORDER BY
           confidence DESC,
           updated_at DESC
         LIMIT 1`,
      )
      .bind(prospect.id)
      .first<{ id: string }>();

    if (!contact) {
      skipped += 1;
      continue;
    }

    const activeSendJob = await db
      .prepare(
        `SELECT id
         FROM jobs
         WHERE prospect_id = ?
           AND kind = 'SEND_FOLLOW_UP'
           AND status IN (
             'PENDING',
             'RUNNING',
             'SENDING',
             'SEND_UNKNOWN'
           )
         LIMIT 1`,
      )
      .bind(prospect.id)
      .first<{ id: string }>();

    if (activeSendJob) {
      skipped += 1;
      continue;
    }

    const reevaluation =
      await evaluateAndPersistPrototypeCostGate(
        db,
        prospect,
        nowUtc,
      );

    reevaluated += 1;

    await eventStore.append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type: 'prototype_cost_gate.j30_reevaluated',
      payload: {
        previousEvaluationId: latestGate.id,
        evaluationId: reevaluation.id,
        decision: reevaluation.decision,
        authorization: reevaluation.authorization,
      },
      createdAt: nowUtc,
    });

    if (reevaluation.decision !== 'NO-GO') {
      skipped += 1;
      continue;
    }

    const messageId = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO outreach_messages (
          id,
          prospect_id,
          contact_id,
          kind,
          subject,
          body_text,
          facts_json,
          source_refs_json,
          confidence,
          status,
          provider_message_id,
          sent_at,
          created_at,
          updated_at
        ) VALUES (
          ?,
          ?,
          ?,
          'FOLLOW_UP',
          ?,
          ?,
          '[]',
          '[]',
          100,
          'VERIFIED',
          NULL,
          NULL,
          ?,
          ?
        )`,
      )
      .bind(
        messageId,
        prospect.id,
        contact.id,
        'Dernier suivi de votre demande Magic Script',
        interestFollowUpBody(2, prospect),
        nowUtc,
        nowUtc,
      )
      .run();

    const sendJob = await new D1JobQueue(db).enqueue({
      id: crypto.randomUUID(),
      kind: 'SEND_FOLLOW_UP',
      prospectId: prospect.id,
      payload: {
        source: 'PROTOTYPE_COST_GATE_J30',
        messageId,
        gateEvaluationId: reevaluation.id,
      },
      maxAttempts: 3,
      runAfter: nowUtc,
    });

    await eventStore.append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type:
        'prototype_cost_gate.j30_followup_draft_prepared',
      payload: {
        gateEvaluationId: reevaluation.id,
        dueAt: latestGate.reevaluate_at,
        messageId,
        sendJobId: sendJob.id,
        status: 'VERIFIED',
        automaticFinalRecontact: true,
        existingSendGuardsRequired: true,
      },
      createdAt: nowUtc,
    });

    prepared += 1;
  }

  return {
    prepared,
    reevaluated,
    dormant,
    skipped,
  };
}

async function scheduleInterestFollowupDrafts(
  env: Env,
  db: D1DatabaseLike,
): Promise<{ prepared: number; dormant: number; skipped: number }> {
  const config = configFromEnv(env);
  if (!config.autopilotEnabled) {
    return { prepared: 0, dormant: 0, skipped: 0 };
  }

  const candidates = await db
    .prepare(
      `SELECT id
       FROM prospects
       WHERE state = 'INTERESTED'
       ORDER BY updated_at ASC
       LIMIT 250`,
    )
    .all<{ id: string }>();
  const repo = new D1ProspectRepository(db);
  const eventStore = new D1EventStore(db);
  let prepared = 0;
  let dormant = 0;
  let skipped = 0;

  for (const candidate of candidates.results ?? []) {
    const prospect = await repo.getProspect(candidate.id);
    if (!prospect || prospect.state !== 'INTERESTED') {
      skipped += 1;
      continue;
    }

    const history = await eventStore.listByProspect(prospect.id);
    const interestEvent = [...history]
      .reverse()
      .find((event) => event.type === 'commercial.interest_detected');
    if (!interestEvent) {
      skipped += 1;
      continue;
    }

    const latestCostGate =
      await getLatestPrototypeCostGate(
        db,
        prospect.id,
      );

    if (latestCostGate?.decision === 'NO-GO') {
      skipped += 1;
      continue;
    }

    const hasNewInbound = history.some(
      (event) =>
        event.type === 'email.reply_received' &&
        new Date(event.createdAt).getTime() > new Date(interestEvent.createdAt).getTime(),
    );
    const preparedSequences = new Set(
      history
        .filter((event) => event.type === 'commercial.followup_draft_prepared')
        .map((event) =>
          event.payload && typeof event.payload === 'object'
            ? Number((event.payload as Record<string, unknown>).sequence)
            : NaN,
        )
        .filter((sequence): sequence is 1 | 2 => sequence === 1 || sequence === 2),
    );
    const actions = planInterestFollowups({
      state: prospect.state,
      interestAt:
        latestCostGate &&
        new Date(latestCostGate.evaluated_at).getTime() >
          new Date(interestEvent.createdAt).getTime()
          ? latestCostGate.evaluated_at
          : interestEvent.createdAt,
      now: new Date().toISOString(),
      firstDraftPrepared: preparedSequences.has(1),
      secondDraftPrepared: preparedSequences.has(2),
      hasNewInbound,
    });

    if (actions.length === 0) {
      skipped += 1;
      continue;
    }

    const contact = await db
      .prepare(
        `SELECT contact_id
         FROM replies
         WHERE prospect_id = ? AND contact_id IS NOT NULL
         ORDER BY received_at DESC
         LIMIT 1`,
      )
      .bind(prospect.id)
      .first<{ contact_id: string }>();

    for (const action of actions) {
      if (action.kind === 'PREPARE_DRAFT') {
        if (!contact || preparedSequences.has(action.sequence)) continue;

        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO outreach_messages (
              id, prospect_id, contact_id, kind, subject, body_text,
              facts_json, source_refs_json, confidence, status,
              provider_message_id, sent_at, created_at, updated_at
            ) VALUES (?, ?, ?, 'FOLLOW_UP', ?, ?, '[]', '[]', 100, 'DRAFT', NULL, NULL, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            prospect.id,
            contact.contact_id,
            'Suivi de votre demande Magic Script',
            interestFollowUpBody(action.sequence, prospect),
            now,
            now,
          )
          .run();

        await eventStore.append({
          id: crypto.randomUUID(),
          prospectId: prospect.id,
          actor: 'system',
          type: 'commercial.followup_draft_prepared',
          payload: {
            sequence: action.sequence,
            dueAt: action.dueAt,
            status: 'DRAFT',
            humanValidationRequired: true,
            externalSendAllowed: false,
          },
          createdAt: now,
        });
        preparedSequences.add(action.sequence);
        prepared += 1;
      }

      if (action.kind === 'MARK_DORMANT') {
        const current = await repo.getProspect(prospect.id);
        if (current?.state === 'INTERESTED' && !hasNewInbound && canTransition(current.state, 'DORMANT')) {
          await repo.transitionProspect(current.id, 'DORMANT', 'No response after the interest follow-up window');
          await eventStore.append({
            id: crypto.randomUUID(),
            prospectId: current.id,
            actor: 'system',
            type: 'commercial.dormant',
            payload: {
              reason: 'No inbound response after J+7',
              historyPreserved: true,
            },
            createdAt: new Date().toISOString(),
          });
          dormant += 1;
        }
      }
    }
  }

  return { prepared, dormant, skipped };
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
           AND status IN ('PENDING', 'RUNNING', 'SENDING', 'SEND_UNKNOWN')
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
    const subject = parent.subject?.trim() || 'Votre prÃƒÆ’Ã‚Â©sence digitale';

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
    prospect.state === 'MEETING_BOOKED'
      ? 'MEETING_BOOKED'
      : prospect.state === 'INTERESTED'
        ? 'INTERESTED'
        : prospect.state === 'QUOTE_PENDING'
          ? 'QUOTE_PENDING'
          : prospect.state === 'COMMITTED'
            ? 'COMMITTED'
            : prospect.state === 'MEETING_REQUESTED'
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

  const messageKind = messageKindForSendJob(job.kind);
  const sendMessageId = persistedSendMessageId(job);

  if (!sendMessageId) {
    throw new Error('External send job has no persistent SMTP reservation');
  }

  const message = await db
    .prepare(
      `SELECT id, status, provider_message_id
       FROM outreach_messages
       WHERE id = ? AND prospect_id = ? AND kind = ?
       LIMIT 1`,
    )
    .bind(sendMessageId, job.prospectId, messageKind)
    .first<{
      id: string;
      status: string;
      provider_message_id: string | null;
    }>();

  if (!message) {
    throw new Error(`Reserved ${messageKind} message not found after Amen SMTP send`);
  }

  const persistedStatus = result.testMode === true ? 'TEST_SENT' : 'SENT';
  const providerMessageId = result.providerMessageId.trim();

  if (message.status === 'SENT' || message.status === 'TEST_SENT') {
    if (message.provider_message_id !== providerMessageId) {
      throw new Error('SMTP success conflicts with the persisted provider Message-ID');
    }

    return {
      prospectId: job.prospectId,
      providerMessageId,
    };
  }

  if (message.status !== 'SENDING') {
    throw new Error(`Reserved outreach message is not sendable: ${message.status}`);
  }

  const now = new Date().toISOString();

  const persisted = await db
    .prepare(
      `UPDATE outreach_messages
       SET status = ?,
           provider_message_id = ?,
           sent_at = ?,
           updated_at = ?
       WHERE id = ? AND status = 'SENDING'
       RETURNING id`,
    )
    .bind(
      persistedStatus,
      providerMessageId,
      now,
      now,
      message.id,
    )
    .first<{ id: string }>();

  if (!persisted) {
    const current = await db
      .prepare('SELECT status, provider_message_id FROM outreach_messages WHERE id = ? LIMIT 1')
      .bind(message.id)
      .first<{ status: string; provider_message_id: string | null }>();

    if (
      current &&
      (current.status === 'SENT' || current.status === 'TEST_SENT') &&
      current.provider_message_id === providerMessageId
    ) {
      return {
        prospectId: job.prospectId,
        providerMessageId,
      };
    }

    throw new Error('SMTP success could not persist its reserved message state');
  }

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
      providerMessageId,
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
    providerMessageId,
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

  const webDesignReady = canPromoteWithWebDesignReview(result);
  const gateReason = webDesignReady ? null : webDesignReviewBlockReason(result);
  const persistedResult: PrototypeQaResult = webDesignReady
    ? result
    : {
        ...result,
        blockingFindings: [
          ...(result.blockingFindings ?? []),
          ...(result.blockingFindings ?? []).includes(gateReason ?? '')
            ? []
            : [gateReason ?? 'Web Design review did not pass'],
        ],
      };
  const passed =
    result.pass === true &&
    result.safeForOutreach === true &&
    result.technicalBuildPassed !== false &&
    webDesignReady;
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
      .bind(JSON.stringify(persistedResult), now, prototype.id)
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
      JSON.stringify(persistedResult),
      (persistedResult.blockingFindings ?? []).join('; ').slice(0, 4000),
      now,
      prototype.id,
    )
    .run();

  const priorConsecutiveQaFailures = await countConsecutivePrototypeQaFailures(
    db,
    job.prospectId,
  );

  if (priorConsecutiveQaFailures >= 2) {
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
        persistedResult.blockingFindings ?? []
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
      blockingFindings: persistedResult.blockingFindings ?? [],
      recommendedFixes: persistedResult.recommendedFixes ?? [],
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
      `SELECT id, qa_findings_json FROM prototypes
       WHERE prospect_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(job.prospectId)
    .first<{ id: string; qa_findings_json: string | null }>();

  if (!prototype) throw new Error('Prototype row not found for deployment');

  if (!canPromoteWithWebDesignReview(prototype.qa_findings_json)) {
    throw new Error(
      `Cannot deploy prototype before BU Web Design gate: ${webDesignReviewBlockReason(
        prototype.qa_findings_json,
      )}`,
    );
  }

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
         AND status IN ('SENT', 'DRY_RUN', 'TEST_SENT')
       ORDER BY sent_at ASC, created_at ASC
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
    : 'Votre dÃƒÆ’Ã‚Â©monstration Magic Script';

  const body = [
    'Bonjour,',
    '',
    'Comme convenu, voici la dÃƒÆ’Ã‚Â©monstration prÃƒÆ’Ã‚Â©parÃƒÆ’Ã‚Â©e pour votre activitÃƒÆ’Ã‚Â© :',
    deployment.toString(),
    '',
    'LÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢objectif est de vous montrer concrÃƒÆ’Ã‚Â¨tement une piste dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢amÃƒÆ’Ã‚Â©lioration de votre prÃƒÆ’Ã‚Â©sence digitale ÃƒÆ’Ã‚Â  partir des ÃƒÆ’Ã‚Â©lÃƒÆ’Ã‚Â©ments publics que nous avons pu vÃƒÆ’Ã‚Â©rifier.',
    '',
    'Dites-moi simplement ce que vous en pensez.',
    '',
    'Bien ÃƒÆ’Ã‚Â  vous,',
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
  const arrayFields = [
    'sections',
    'sourceNavigationBlocks',
    'commercialProof',
    'factsAllowed',
    'factsForbiddenOrUnverified',
    'mobilePriorities',
  ];
  for (const field of arrayFields) {
    const value = result[field as keyof PrototypeStrategyResult];
    if (!Array.isArray(value)) {
      throw new Error(`Prototype strategy result field ${field} must be an array`);
    }
  }

  if (
    !result.sourceNavigationNote ||
    typeof result.sourceNavigationNote !== 'string' ||
    !result.sourceNavigationNote.trim()
  ) {
    throw new Error('Prototype strategy result missing sourceNavigationNote');
  }

  for (const [index, block] of result.sourceNavigationBlocks.entries()) {
    if (
      !block ||
      typeof block !== 'object' ||
      typeof block.label !== 'string' ||
      !block.label.trim() ||
      !['navigation', 'content_block', 'conversion_cta'].includes(block.kind)
    ) {
      throw new Error(
        `Prototype strategy result sourceNavigationBlocks[${index}] is invalid`,
      );
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

type VerifiedSourceNavigationBlock = {
  label: string;
  kind: 'navigation' | 'content_block' | 'conversion_cta';
};

function isVerifiedSourceNavigationBlock(
  value: unknown,
): value is VerifiedSourceNavigationBlock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const block = value as Record<string, unknown>;
  return (
    typeof block.label === 'string' &&
    Boolean(block.label.trim()) &&
    ['navigation', 'content_block', 'conversion_cta'].includes(String(block.kind))
  );
}

async function enforceVerifiedSourceNavigation(
  output: unknown,
  prospectId: string | undefined,
  db: D1DatabaseLike,
): Promise<unknown> {
  if (!prospectId || !output || typeof output !== 'object' || Array.isArray(output)) {
    return output;
  }

  const strategy = output as Record<string, unknown>;
  const researchRow = await db
    .prepare(
      `SELECT jr.output_json
       FROM job_results jr
       JOIN jobs j ON j.id = jr.job_id
       WHERE j.prospect_id = ? AND j.kind = 'RUN_RESEARCH_SWARM'
       ORDER BY jr.created_at DESC
       LIMIT 1`,
    )
    .bind(prospectId)
    .first<{ output_json: string }>();

  if (!researchRow) return output;

  let research: Record<string, unknown>;
  try {
    research = JSON.parse(researchRow.output_json) as Record<string, unknown>;
  } catch {
    return output;
  }

  const verifiedBlocks = Array.isArray(research.sourceNavigationBlocks)
    ? research.sourceNavigationBlocks.filter(isVerifiedSourceNavigationBlock)
    : [];

  if (verifiedBlocks.length === 0) return output;

  const existingBlocks = Array.isArray(strategy.sourceNavigationBlocks)
    ? strategy.sourceNavigationBlocks.filter(isVerifiedSourceNavigationBlock)
    : [];

  const seen = new Set(verifiedBlocks.map((block) => block.label.trim().toLocaleLowerCase()));
  const mergedBlocks = [
    ...verifiedBlocks,
    ...existingBlocks.filter((block) => !seen.has(block.label.trim().toLocaleLowerCase())),
  ];

  return {
    ...strategy,
    sourceNavigationBlocks: mergedBlocks,
    sourceNavigationNote:
      typeof strategy.sourceNavigationNote === 'string' && strategy.sourceNavigationNote.trim()
        ? strategy.sourceNavigationNote
        : 'Les blocs de navigation vÃƒÆ’Ã‚Â©rifiÃƒÆ’Ã‚Â©s du site source sont obligatoires et repris comme structure de dÃƒÆ’Ã‚Â©monstration.',
  };
}

async function processRunnerSuccess(
  job: MagicScriptJob,
  output: unknown,
  env: Env,
  db: D1DatabaseLike,
): Promise<unknown> {
  const persistedOutput =
    job.kind === 'GENERATE_PROTOTYPE_STRATEGY'
      ? await enforceVerifiedSourceNavigation(output, job.prospectId, db)
      : output;

  await db
    .prepare(
      `INSERT INTO job_results (job_id, output_json, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(job_id) DO UPDATE SET
         output_json = excluded.output_json,
         created_at = excluded.created_at`,
    )
    .bind(job.id, JSON.stringify(persistedOutput), new Date().toISOString())
    .run();

  if (job.kind === 'DISCOVER_PROSPECTS') {
    return processDiscoveryResult(output as DiscoveryResult, env, db);
  }

  if (job.kind === 'RUN_RESEARCH_SWARM') {
    return processResearchResult(job, output as ResearchResult, env, db);
  }

  if (job.kind === 'RUN_SCORING') {
    return processScoringResult(job, output, env, db);
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
    return processPrototypeStrategyGeneration(
      job,
      persistedOutput as PrototypeStrategyResult,
      env,
      db,
    );
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

interface CallCopilotSessionRow {
  id: string;
  prospect_id: string;
  meeting_id: string | null;
  status: 'ACTIVE' | 'ENDED';
  snapshot_json: string;
  engine_version: string;
  rules_version: string;
  prompt_version: string;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

interface QuoteDossierRow {
  id: string;
  linkage_key: string;
  prospect_id: string;
  meeting_id: string | null;
  source_copilot_session_id: string | null;
  status: 'DRAFT' | 'HUMAN_VALIDATED';
  dossier_json: string;
  human_validated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface QuoteDossierEditableInput {
  commercialNeed?: string | null;
  requestedScope?: string | null;
  timing?: string | null;
  decisionContext?: string | null;
  openQuestions?: string[];
}

interface QuoteDossierConflictResolution {
  field: QuoteDossierConflictField;
  value: string;
}

function parseCallCopilotAction(value: unknown): CallCopilotAction {
  if (!value || typeof value !== 'object') throw new Error('action is required');
  const action = value as Record<string, unknown>;
  const type = action.type;
  const allowed = new Set([
    'PROSPECT_RESPONSE',
    'SELECT_PREDICTION',
    'OPERATOR_NOTE',
    'VALIDATE_KNOWLEDGE',
    'REJECT_KNOWLEDGE',
    'SET_DECISION_AUTHORITY',
    'FEEDBACK',
  ]);
  if (typeof type !== 'string' || !allowed.has(type)) throw new Error('Unsupported Call Copilot action');
  return action as unknown as CallCopilotAction;
}

function assertCallCopilotActionBounds(action: CallCopilotAction): void {
  const value = 'text' in action ? action.text : 'value' in action ? action.value : 'key' in action ? action.key : '';
  if (typeof value === 'string' && value.length > 8_000) throw new Error('Call Copilot input is too long');
  if ('key' in action && typeof action.key === 'string' && action.key.length > 200) throw new Error('Call Copilot key is too long');
  if ('value' in action && typeof action.value === 'string' && action.value.length > 8_000) throw new Error('Call Copilot value is too long');
  if ('predictionId' in action && (typeof action.predictionId !== 'string' || !/^prediction-[1-3]$/.test(action.predictionId))) throw new Error('Invalid prediction id');
}

async function callCopilotContext(
  env: Env,
  db: D1DatabaseLike,
  prospect: Prospect,
  meetingId?: string,
) {
  const prototype = await db
    .prepare(
      `SELECT id, status, qa_status, deployment_url
       FROM prototypes
       WHERE prospect_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(prospect.id)
    .first<{ id: string; status: string; qa_status: string | null; deployment_url: string | null }>();
  const rooms = await listSalesRoomSummaries(env, db);
  const room = rooms.find((item) => item.prospectId === prospect.id);
  const links = buildPersonalizedEntryLinks({
    prospectId: prospect.id,
    companyName: prospect.companyName,
    salesRoomSlug: room?.slug,
    salesRoomStatus: room?.status ?? 'ACTIVE',
    prototypeUrl: prototype?.deployment_url ?? null,
    prototypeStatus: prototype?.status ?? null,
    qaStatus: prototype?.qa_status ?? null,
    personalizedBaseUrl: env.MAGICSCRIPT_PUBLIC_BASE_URL,
  });
  const events = await new D1EventStore(db).listByProspect(prospect.id);
  const engagement = scoreEngagementFromMagicScriptEvents(events, new Date().toISOString());
  const confirmedFacts = [
    { key: 'company_name', value: prospect.companyName },
    prospect.activity ? { key: 'activity', value: prospect.activity } : null,
    prospect.location ? { key: 'location', value: prospect.location } : null,
    prospect.websiteUrl ? { key: 'website', value: prospect.websiteUrl } : null,
  ].filter((fact): fact is { key: string; value: string } => Boolean(fact));
  const unknowns = [
    prospect.primaryFriction ? null : 'Friction digitale principale',
    links.prototypeUrl ? null : 'Lien prototype',
    links.salesRoomUrl ? null : 'Lien Sales Room',
    'Prix',
    'DÃƒÆ’Ã‚Â©lai',
  ].filter((value): value is string => Boolean(value));
  return prospectToCallCopilotContext(prospect, {
    meetingId,
    prototypeUrl: links.prototypeEntryUrl ?? links.prototypeUrl ?? undefined,
    salesRoomUrl: links.salesRoomUrl ?? undefined,
    primaryNeed: prospect.primaryFriction,
    confirmedFacts,
    unknowns,
    engagementSummary: `${engagement.score_total}/100 Ãƒâ€šÃ‚Â· activitÃƒÆ’Ã‚Â© ${engagement.activity_score} Ãƒâ€šÃ‚Â· intention ${engagement.intent_score} Ãƒâ€šÃ‚Â· ${engagement.trend}`,
    engagementHistory: engagement.top_contributors.map((item) => `${item.signal} Ãƒâ€šÃ‚Â· ${item.occurredAt}`),
  });
}

type PrototypeCostGateRow = {
  id: string;
  prospect_id: string;
  decision: 'GO' | 'LIGHT' | 'NO-GO';
  authorization: 'FULL' | 'LIGHT' | 'NONE';
  policy_score: number;
  compute_class: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  external_cost_kind: 'KNOWN' | 'UNKNOWN';
  external_cost_amount_eur: number | null;
  external_cost_source: string | null;
  external_cost_reason: string | null;
  reason_codes_json: string;
  evaluated_at: string;
  reevaluate_at: string | null;
};

function prototypeCostGateResponse(row: PrototypeCostGateRow) {
  return {
    id: row.id,
    prospectId: row.prospect_id,
    decision: row.decision,
    authorization: row.authorization,
    policyScore: row.policy_score,
    computeClass: row.compute_class,
    estimatedExternalCost:
      row.external_cost_kind === 'KNOWN'
        ? {
            kind: 'KNOWN' as const,
            amountEur: row.external_cost_amount_eur,
            source: row.external_cost_source,
          }
        : {
            kind: 'UNKNOWN' as const,
            reason: row.external_cost_reason,
          },
    reasonCodes: JSON.parse(row.reason_codes_json) as string[],
    evaluatedAt: row.evaluated_at,
    reevaluateAt: row.reevaluate_at,
  };
}

async function getLatestPrototypeCostGate(
  db: D1DatabaseLike,
  prospectId: string,
): Promise<PrototypeCostGateRow | null> {
  return db
    .prepare(
      `SELECT *
       FROM prototype_cost_gate_evaluations
       WHERE prospect_id = ?
       ORDER BY evaluated_at DESC
       LIMIT 1`,
    )
    .bind(prospectId)
    .first<PrototypeCostGateRow>();
}
async function derivePrototypeComputeClassFromResearch(
  db: D1DatabaseLike,
  prospectId: string,
): Promise<{
  computeClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  blockCount: number;
  source: 'RESEARCH_SCOPE' | 'UNKNOWN';
}> {
  const row = await db
    .prepare(
      `SELECT jr.output_json
       FROM job_results jr
       JOIN jobs j ON j.id = jr.job_id
       WHERE j.prospect_id = ?
         AND j.kind = 'RUN_RESEARCH_SWARM'
         AND j.status = 'SUCCEEDED'
       ORDER BY jr.created_at DESC
       LIMIT 1`,
    )
    .bind(prospectId)
    .first<{ output_json: string }>();

  if (!row?.output_json) {
    return {
      computeClass: 'UNKNOWN',
      blockCount: 0,
      source: 'UNKNOWN',
    };
  }

  let research: Record<string, unknown>;

  try {
    research = JSON.parse(row.output_json) as Record<string, unknown>;
  } catch {
    return {
      computeClass: 'UNKNOWN',
      blockCount: 0,
      source: 'UNKNOWN',
    };
  }

  const verifiedBlocks = Array.isArray(research.sourceNavigationBlocks)
    ? research.sourceNavigationBlocks.filter(
        isVerifiedSourceNavigationBlock,
      )
    : [];

  const blockCount = verifiedBlocks.length;

  if (blockCount === 0) {
    return {
      computeClass: 'UNKNOWN',
      blockCount: 0,
      source: 'UNKNOWN',
    };
  }

  return {
    computeClass:
      blockCount >= 9
        ? 'HIGH'
        : blockCount >= 5
          ? 'MEDIUM'
          : 'LOW',
    blockCount,
    source: 'RESEARCH_SCOPE',
  };
}

async function evaluateAndPersistPrototypeCostGate(
  db: D1DatabaseLike,
  prospect: Prospect,
  evaluatedAt = new Date().toISOString(),
): Promise<PrototypeCostGateRow> {
  const computeEvidence =
    await derivePrototypeComputeClassFromResearch(
      db,
      prospect.id,
    );

  const computeClass = computeEvidence.computeClass;

  const estimatedExternalCost = {
    kind: 'UNKNOWN' as const,
    reason:
      'No internal priced external provider evidence available',
  };

  const events = await new D1EventStore(db).listByProspect(prospect.id);
  const engagement = scoreEngagementFromMagicScriptEvents(events, evaluatedAt);

  const result = evaluatePrototypeCostGate({
    state: prospect.state,
    opportunity: prospect.opportunity ?? null,
    prospectScore: prospect.score ?? null,
    websiteUrl: prospect.websiteUrl ?? null,
    primaryFriction: prospect.primaryFriction ?? null,
    primaryAsset: prospect.primaryAsset ?? null,
    primaryCta: prospect.primaryCta ?? null,
    engagement,
    computeClass,
    estimatedExternalCost,
    evaluatedAt,
  });

  const reasonCodes = [
    ...result.reasonCodes,
    ...(computeEvidence.source === 'RESEARCH_SCOPE'
      ? [
          'COMPUTE_FROM_RESEARCH_SCOPE',
          `RESEARCH_SCOPE_BLOCKS_${computeEvidence.blockCount}`,
        ]
      : ['COMPUTE_SCOPE_UNKNOWN']),
  ];

  const evaluationId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO prototype_cost_gate_evaluations (
        id,
        prospect_id,
        decision,
        authorization,
        policy_score,
        compute_class,
        external_cost_kind,
        external_cost_amount_eur,
        external_cost_source,
        external_cost_reason,
        reason_codes_json,
        evaluated_at,
        reevaluate_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      evaluationId,
      prospect.id,
      result.decision,
      result.authorization,
      result.policyScore,
      result.computeClass,
      result.estimatedExternalCost.kind,
      result.estimatedExternalCost.kind === 'KNOWN'
        ? result.estimatedExternalCost.amountEur
        : null,
      result.estimatedExternalCost.kind === 'KNOWN'
        ? result.estimatedExternalCost.source
        : null,
      result.estimatedExternalCost.kind === 'UNKNOWN'
        ? result.estimatedExternalCost.reason
        : null,
      JSON.stringify(reasonCodes),
      result.evaluatedAt,
      result.reevaluateAt,
    )
    .run();

  const persisted =
    await getLatestPrototypeCostGate(
      db,
      prospect.id,
    );

  if (!persisted) {
    throw new Error(
      'Prototype Cost Gate evaluation could not be reloaded',
    );
  }

  return persisted;
}

async function refreshPrototypeCostGateAfterObjectiveSignal(
  db: D1DatabaseLike,
  prospectId: string,
  source: string,
  evaluatedAt = new Date().toISOString(),
): Promise<PrototypeCostGateRow | null> {
  const prospect =
    await new D1ProspectRepository(db).getProspect(prospectId);

  if (
    !prospect ||
    (prospect.state !== 'INTERESTED' &&
      prospect.state !== 'MEETING_BOOKED')
  ) {
    return null;
  }

  try {
    const evaluation =
      await evaluateAndPersistPrototypeCostGate(
        db,
        prospect,
        evaluatedAt,
      );

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId,
      actor: 'system',
      type: 'prototype_cost_gate.auto_evaluated',
      payload: {
        source,
        evaluationId: evaluation.id,
        decision: evaluation.decision,
        authorization: evaluation.authorization,
      },
      createdAt: evaluatedAt,
    });

    return evaluation;
  } catch (error) {
    try {
      await new D1EventStore(db).append({
        id: crypto.randomUUID(),
        prospectId,
        actor: 'system',
        type: 'prototype_cost_gate.evaluation_failed',
        payload: {
          source,
          error:
            error instanceof Error
              ? error.message
              : String(error),
          prototypeWorkRemainsFailClosed: true,
        },
        createdAt: evaluatedAt,
      });
    } catch {
    }

    return null;
  }
}

async function getCallCopilotSession(db: D1DatabaseLike, sessionId: string): Promise<CallCopilotSessionRow | null> {
  return db
    .prepare('SELECT * FROM call_copilot_sessions WHERE id = ? LIMIT 1')
    .bind(sessionId)
    .first<CallCopilotSessionRow>();
}

function callCopilotSnapshot(row: CallCopilotSessionRow): CallCopilotSnapshot {
  return JSON.parse(row.snapshot_json) as CallCopilotSnapshot;
}

function quoteDossierFromRow(row: QuoteDossierRow): QuoteDossier {
  return JSON.parse(row.dossier_json) as QuoteDossier;
}

function quoteDossierResponse(row: QuoteDossierRow): QuoteDossier {
  const dossier = quoteDossierFromRow(row);
  return {
    ...dossier,
    status: row.status,
    humanValidatedAt: row.human_validated_at,
  };
}

function quoteDossierLinkageKey(prospectId: string, meetingId: string | null): string {
  return `${prospectId}:${meetingId ?? 'prospect'}`;
}

async function getQuoteDossierById(
  db: D1DatabaseLike,
  dossierId: string,
): Promise<QuoteDossierRow | null> {
  return db
    .prepare('SELECT * FROM quote_dossiers WHERE id = ? LIMIT 1')
    .bind(dossierId)
    .first<QuoteDossierRow>();
}

async function getQuoteDossierByLinkage(
  db: D1DatabaseLike,
  linkageKey: string,
): Promise<QuoteDossierRow | null> {
  return db
    .prepare('SELECT * FROM quote_dossiers WHERE linkage_key = ? LIMIT 1')
    .bind(linkageKey)
    .first<QuoteDossierRow>();
}

async function applySalesRoomCommercialScopeToQuoteDossier(
  db: D1DatabaseLike,
  prospectId: string,
  dossier: QuoteDossier,
  now: string,
): Promise<QuoteDossier> {
  const rows = await db
    .prepare(
      `SELECT r.raw_text
       FROM events e
       JOIN replies r
         ON r.id = json_extract(e.payload_json, '$.replyId')
       WHERE e.prospect_id = ?
         AND e.type = 'sales_room.message_received'
       ORDER BY r.received_at ASC, r.created_at ASC`,
    )
    .bind(prospectId)
    .all<{ raw_text: string }>();

  const prospectTexts = (rows.results ?? [])
    .map((row) => row.raw_text)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (prospectTexts.length === 0) return dossier;

  const extraction = extractCommercialScopeFromProspectTexts(prospectTexts);

  return applyCommercialScopeProfile(
    dossier,
    extraction.profile,
    now,
  );
}
function isQuoteDossierLinkageConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed:\s*quote_dossiers\.linkage_key/i.test(error.message)
  );
}

function manualField(value: string | null): DossierField {
  return {
    value: value?.trim() || null,
    evidenceStatus: 'OPERATOR_NOTE',
    provenance: 'explicit_manual_edit',
    sourceRef: null,
  };
}

function applyQuoteDossierEdits(
  current: QuoteDossier,
  edits: QuoteDossierEditableInput,
  now: string,
): QuoteDossier {
  const conflicts = [...current.conflicts];

  function scalar(
    key: 'commercialNeed' | 'requestedScope' | 'timing' | 'decisionContext',
    value: string | null | undefined,
  ): DossierField {
    const existing = current[key];
    if (value === undefined) return existing;
    const next = manualField(value);
    if (existing.evidenceStatus === 'CONFIRMED' && existing.value !== next.value) {
      conflicts.push(
        `${key}: ${existing.provenance}: ${existing.value ?? 'UNKNOWN'} / explicit_manual_edit: ${next.value ?? 'UNKNOWN'}`,
      );
      return { ...existing, evidenceStatus: 'CONFLICT' };
    }
    return next;
  }

  return {
    ...current,
    commercialNeed: scalar('commercialNeed', edits.commercialNeed),
    requestedScope: scalar('requestedScope', edits.requestedScope),
    timing: scalar('timing', edits.timing),
    decisionContext: scalar('decisionContext', edits.decisionContext),
    openQuestions:
      edits.openQuestions === undefined
        ? current.openQuestions
        : edits.openQuestions.map((value) => value.trim()).filter(Boolean),
    status: current.status,
    humanValidatedAt: current.humanValidatedAt,
    conflicts: [...new Set(conflicts.filter(Boolean))],
    updatedAt: now,
  };
}

async function publishCanonicalQuote(
  env: Env,
  db: D1DatabaseLike,
  dossierId: string,
): Promise<Record<string, unknown>> {
  const row = await getQuoteDossierById(db, dossierId);
  if (!row) throw new Error('Quote dossier not found');

  const prospect = await new D1ProspectRepository(db).getProspect(row.prospect_id);
  if (!prospect) throw new Error('Prospect not found');

  const dossier = quoteDossierFromRow(row);
  if (dossier.conflicts.length > 0) {
    throw new Error('Quote dossier conflicts must be resolved before publication');
  }
  if (
    dossier.companyIdentity.evidenceStatus === 'CONFLICT' ||
    !dossier.companyIdentity.value?.trim() ||
    dossier.companyIdentity.value.trim() !== prospect.companyName.trim()
  ) {
    throw new Error('Complete company identity is required for quote publication');
  }

  const scope = classifyCommercialScope(dossier.commercialScope);
  if (scope.status !== 'FIXED' || !scope.packageId) {
    throw new Error('Only fixed commercial scope can be published');
  }

  const pricing = resolvePricingPackage(scope.packageId);
  const legal = canonicalQuoteLegalConfig(env);
  const now = new Date().toISOString();
  const issueDate = dossier.updatedAt.slice(0, 10);
  const canonicalQuote = buildCanonicalQuote({
    quoteId: `quote-${prospect.id}`,
    quoteNumber: `MS-${prospect.id}`,
    issueDate,
    validUntil: addQuoteDays(issueDate, 30),
    deliveryDeadline: addQuoteDays(issueDate, 30),
    companyName: prospect.companyName,
    legalName: prospect.legalName,
    pricing,
    legal,
  });
  const canonicalJson = JSON.stringify(canonicalQuote);
  const quoteVersionHash = `sha256:${await sha256Hex(canonicalJson)}`;
  const existing = await commercialQuoteByProspectAndHash(
    db,
    prospect.id,
    quoteVersionHash,
  );
  if (existing) {
    return {
      ok: true,
      duplicate: true,
      prospectId: prospect.id,
      quoteId: existing.quote_id,
      quoteNumber: existing.quote_number,
      quoteVersionHash: existing.quote_version_hash,
      state: prospect.state,
    };
  }

  let transition;
  try {
    transition = commercialTransition(prospect.state, 'QUOTE_DRAFTED');
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Quote publication transition rejected',
    );
  }

  const quoteRowId = `commercial-quote:${prospect.id}:${quoteVersionHash.slice(-16)}`;
  try {
    await db
      .prepare(
        `INSERT INTO commercial_quotes (
           id,
           prospect_id,
           quote_id,
           quote_number,
           quote_version_hash,
           canonical_json,
           issue_date,
           valid_until,
           delivery_deadline,
           cgv_reference,
           subtotal_cents,
           total_cents,
           currency,
           deposit_percent,
           balance_percent,
           published_at,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', 50, 50, ?, ?)`,
      )
      .bind(
        quoteRowId,
        prospect.id,
        canonicalQuote.quoteId,
        canonicalQuote.quoteNumber,
        quoteVersionHash,
        canonicalJson,
        canonicalQuote.issueDate,
        canonicalQuote.validUntil,
        canonicalQuote.deliveryDeadline,
        canonicalQuote.cgvReference,
        canonicalQuote.subtotalCents,
        canonicalQuote.totalCents,
        now,
        now,
      )
      .run();
  } catch (error) {
    const raced = await commercialQuoteByProspectAndHash(
      db,
      prospect.id,
      quoteVersionHash,
    );
    if (!raced) throw error;
    return {
      ok: true,
      duplicate: true,
      prospectId: prospect.id,
      quoteId: raced.quote_id,
      quoteNumber: raced.quote_number,
      quoteVersionHash: raced.quote_version_hash,
      state: prospect.state,
    };
  }

  const updated = await new D1ProspectRepository(db).transitionProspect(
    prospect.id,
    transition.to,
    transition.reason,
  );
  await new D1EventStore(db).append({
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    actor: 'system',
    type: 'commercial.quote_published',
    payload: {
      quoteId: canonicalQuote.quoteId,
      quoteNumber: canonicalQuote.quoteNumber,
      quoteVersionHash,
      totalCents: canonicalQuote.totalCents,
      currency: 'EUR',
      depositPercent: 50,
      balancePercent: 50,
      source: 'SALES_ROOM',
      humanValidationRequired: false,
    },
    createdAt: now,
  });

  return {
    ok: true,
    duplicate: false,
    prospectId: prospect.id,
    quoteId: canonicalQuote.quoteId,
    quoteNumber: canonicalQuote.quoteNumber,
    quoteVersionHash,
    totalCents: canonicalQuote.totalCents,
    currency: 'EUR',
    depositPercent: 50,
    balancePercent: 50,
    state: updated.state,
  };
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env, request) });
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    const healthConfig = configFromEnv(env);
    const effectiveOutboundMode =
      !healthConfig.sendingEnabled || healthConfig.emailProvider === 'disabled'
        ? 'disabled'
        : healthConfig.emailProvider === 'dry-run'
          ? 'dry-run'
          : 'external';

    return json({
      ok: true,
      service: 'magicscript-api',
      databaseConfigured: Boolean(env.DB),
      apiAuthConfigured: Boolean(env.MAGICSCRIPT_API_TOKEN),
      runnerAuthConfigured: Boolean(env.MAGICSCRIPT_RUNNER_TOKEN),
      stackId: env.MAGICSCRIPT_STACK_ID ?? null,
      autopilotEnabled: env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true',
      sendingEnabled: healthConfig.sendingEnabled,
      emailProvider: healthConfig.emailProvider,
      effectiveOutboundMode,
      testEmailMode: env.MAGICSCRIPT_TEST_EMAIL_MODE === 'true',
      testRecipientConfigured: Boolean(env.MAGICSCRIPT_TEST_RECIPIENT?.trim()),
      prototypeDeployEnabled: env.MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED === 'true',
    });
  }

  const publicSalesRoomWrite =
    request.method === 'POST' &&
    (url.pathname === '/api/public/sales-room-message' ||
      url.pathname === '/api/public/sales-room-meeting-requested' ||
      url.pathname === '/api/public/sales-room-event' ||
      url.pathname === '/api/public/sales-room-booking' ||
      url.pathname === '/api/public/sales-room-meeting-cancel' ||
      url.pathname === '/api/public/sales-room-quote-accept');
  const publicSalesRoomRead =
    request.method === 'GET' && url.pathname === '/api/public/sales-room-availability';

  if (publicSalesRoomWrite) {
    const blocked = publicSalesRoomIngestionGuard(request, env);
    if (blocked) return blocked;
  } else if (publicSalesRoomRead) {
    // Availability is a public read; no external mutation is possible here.
  } else if (url.pathname.startsWith('/api/runner/')) {
    const unauthorized = requireRunnerAuth(request, env);
    if (unauthorized) return unauthorized;
    const staleStack = requireRunnerStack(request, env);
    if (staleStack) return staleStack;
  } else if (url.pathname.startsWith('/api/')) {
    const unauthorized = requireApiAuth(request, env);
    if (unauthorized) return unauthorized;
  }

  if (request.method === 'POST' && url.pathname === '/api/call-copilot') {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const prospectId = typeof body.prospectId === 'string' ? body.prospectId.trim() : '';
    const meetingId = typeof body.meetingId === 'string' ? body.meetingId.trim() : '';
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (!prospectId) return json({ error: 'prospectId is required' }, { status: 400 });
    if (idempotencyKey.length > 200) return json({ error: 'idempotencyKey is too long' }, { status: 400 });
    const db = requireDb(env);
    if (idempotencyKey) {
      const duplicate = await db
        .prepare('SELECT * FROM call_copilot_sessions WHERE idempotency_key = ? LIMIT 1')
        .bind(idempotencyKey)
        .first<CallCopilotSessionRow>();
      if (duplicate) return json({ ok: true, duplicate: true, session: callCopilotSnapshot(duplicate), status: duplicate.status });
    }
    const prospect = await new D1ProspectRepository(db).getProspect(prospectId);
    if (!prospect) return json({ error: 'Prospect not found' }, { status: 404 });
    if (meetingId) {
      const meeting = await getMeetingById(db, meetingId);
      if (!meeting || meeting.prospect_id !== prospect.id || meeting.status !== 'CONFIRMED') {
        return json({ error: 'Confirmed meeting not found for prospect' }, { status: 409 });
      }
    }
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const snapshot = buildCallCopilotSnapshot(
      await callCopilotContext(env, db, prospect, meetingId || undefined),
      now,
      sessionId,
    );
    await db
      .prepare(
        `INSERT INTO call_copilot_sessions (
          id, prospect_id, meeting_id, status, snapshot_json,
          engine_version, rules_version, prompt_version, idempotency_key,
          created_at, updated_at
        ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        sessionId,
        prospect.id,
        meetingId || null,
        JSON.stringify(snapshot),
        CALL_COPILOT_ENGINE_VERSION,
        CALL_COPILOT_RULES_VERSION,
        CALL_COPILOT_PROMPT_VERSION,
        idempotencyKey || null,
        now,
        now,
      )
      .run();
    return json({ ok: true, duplicate: false, session: snapshot, status: 'ACTIVE' });
  }

  const callCopilotSessionMatch = url.pathname.match(/^\/api\/call-copilot\/([^/]+)$/);
  if (request.method === 'GET' && callCopilotSessionMatch) {
    const row = await getCallCopilotSession(requireDb(env), decodeURIComponent(callCopilotSessionMatch[1]));
    if (!row) return json({ error: 'Call Copilot session not found' }, { status: 404 });
    return json({ ok: true, status: row.status, session: callCopilotSnapshot(row) });
  }

  const callCopilotActionsMatch = url.pathname.match(/^\/api\/call-copilot\/([^/]+)\/actions$/);
  if (request.method === 'POST' && callCopilotActionsMatch) {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const db = requireDb(env);
    const sessionId = decodeURIComponent(callCopilotActionsMatch[1]);
    const row = await getCallCopilotSession(db, sessionId);
    if (!row) return json({ error: 'Call Copilot session not found' }, { status: 404 });
    if (row.status !== 'ACTIVE') return json({ error: 'Call Copilot session is not active' }, { status: 409 });
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (idempotencyKey.length > 200) return json({ error: 'idempotencyKey is too long' }, { status: 400 });
    if (idempotencyKey) {
      const duplicate = await db
        .prepare('SELECT id FROM call_copilot_actions WHERE session_id = ? AND idempotency_key = ? LIMIT 1')
        .bind(sessionId, idempotencyKey)
        .first<{ id: string }>();
      if (duplicate) return json({ ok: true, duplicate: true, session: callCopilotSnapshot(row) });
    }
    try {
      const action = parseCallCopilotAction(body.action ?? body);
      assertCallCopilotActionBounds(action);
      const now = new Date().toISOString();
      const updated = applyCallCopilotAction(callCopilotSnapshot(row), action, now);
      await db
        .prepare(
          `INSERT INTO call_copilot_actions (
             id, session_id, action_type, payload_json, idempotency_key, created_at
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), sessionId, action.type, JSON.stringify(action), idempotencyKey || null, now)
        .run();
      await db
        .prepare('UPDATE call_copilot_sessions SET snapshot_json = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(updated), now, sessionId)
        .run();
      return json({ ok: true, duplicate: false, session: updated });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Call Copilot action rejected' }, { status: 400 });
    }
  }

  const callCopilotReviewMatch = url.pathname.match(/^\/api\/call-copilot\/([^/]+)\/review$/);
  if (request.method === 'GET' && callCopilotReviewMatch) {
    const row = await getCallCopilotSession(requireDb(env), decodeURIComponent(callCopilotReviewMatch[1]));
    if (!row) return json({ error: 'Call Copilot session not found' }, { status: 404 });
    return json({ ok: true, status: row.status, review: buildEndOfCallReview(callCopilotSnapshot(row)) });
  }

  if (request.method === 'POST' && url.pathname === '/api/quote-dossiers') {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const prospectId = typeof body.prospectId === 'string' ? body.prospectId.trim() : '';
    const requestedMeetingId = typeof body.meetingId === 'string' ? body.meetingId.trim() : '';
    const sourceCopilotSessionId =
      typeof body.sourceCopilotSessionId === 'string'
        ? body.sourceCopilotSessionId.trim()
        : '';
    if (!prospectId) return json({ error: 'prospectId is required' }, { status: 400 });

    const db = requireDb(env);
    const prospect = await new D1ProspectRepository(db).getProspect(prospectId);
    if (!prospect) return json({ error: 'Prospect not found' }, { status: 404 });

    let effectiveMeetingId = requestedMeetingId || null;
    let snapshot: CallCopilotSnapshot | undefined;
    if (sourceCopilotSessionId) {
      const session = await getCallCopilotSession(db, sourceCopilotSessionId);
      if (!session || session.prospect_id !== prospectId) {
        return json({ error: 'Call Copilot session not found for prospect' }, { status: 409 });
      }
      if (requestedMeetingId && session.meeting_id !== requestedMeetingId) {
        return json({ error: 'Call Copilot session does not belong to meeting' }, { status: 409 });
      }
      if (!requestedMeetingId && session.meeting_id) effectiveMeetingId = session.meeting_id;
      snapshot = callCopilotSnapshot(session);
    }

    if (effectiveMeetingId) {
      const meeting = await getMeetingById(db, effectiveMeetingId);
      if (!meeting || meeting.prospect_id !== prospectId) {
        return json({ error: 'Meeting not found for prospect' }, { status: 409 });
      }
    }

    const linkageKey = quoteDossierLinkageKey(prospectId, effectiveMeetingId);
    const existing = await getQuoteDossierByLinkage(db, linkageKey);
    if (existing?.status === 'HUMAN_VALIDATED') {
      return json({ ok: true, duplicate: true, dossier: quoteDossierResponse(existing) });
    }

    const now = new Date().toISOString();
    const dossier = buildQuoteDossier({
      id: existing?.id ?? crypto.randomUUID(),
      prospectId,
      companyName: prospect.companyName,
      meetingId: effectiveMeetingId,
      sourceCopilotSessionId: sourceCopilotSessionId || snapshot?.session_id || null,
      activity: prospect.activity,
      primaryFriction: prospect.primaryFriction,
      snapshot,
      now,
    });
    const mergedBase = existing ? mergeQuoteDossier(quoteDossierFromRow(existing), dossier) : dossier;
    const merged = await applySalesRoomCommercialScopeToQuoteDossier(
      db,
      prospectId,
      mergedBase,
      now,
    );

    if (existing) {
      await db
        .prepare(
          `UPDATE quote_dossiers
           SET source_copilot_session_id = ?, dossier_json = ?, updated_at = ?
           WHERE id = ? AND status = 'DRAFT'`,
        )
        .bind(merged.sourceCopilotSessionId, JSON.stringify(merged), now, existing.id)
        .run();
      const updated = await getQuoteDossierById(db, existing.id);
      if (!updated) return json({ error: 'Quote dossier could not be reloaded' }, { status: 500 });
      return json({ ok: true, duplicate: true, dossier: quoteDossierResponse(updated) });
    }

    try {
      await db
        .prepare(
          `INSERT INTO quote_dossiers (
            id, linkage_key, prospect_id, meeting_id, source_copilot_session_id,
            status, dossier_json, human_validated_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, NULL, ?, ?)`,
        )
        .bind(
          merged.id,
          linkageKey,
          prospectId,
          effectiveMeetingId,
          merged.sourceCopilotSessionId,
          JSON.stringify(merged),
          now,
          now,
        )
        .run();
    } catch (error) {
      if (!isQuoteDossierLinkageConflict(error)) throw error;
      const raced = await getQuoteDossierByLinkage(db, linkageKey);
      if (!raced) throw error;
      return json({ ok: true, duplicate: true, dossier: quoteDossierResponse(raced) });
    }

    const created = await getQuoteDossierById(db, merged.id);
    if (!created) return json({ error: 'Quote dossier could not be reloaded' }, { status: 500 });
    return json({ ok: true, duplicate: false, dossier: quoteDossierResponse(created) });
  }

  const quoteDossierMatch = url.pathname.match(/^\/api\/quote-dossiers\/([^/]+)$/);
  if (request.method === 'GET' && quoteDossierMatch) {
    const row = await getQuoteDossierById(requireDb(env), decodeURIComponent(quoteDossierMatch[1]));
    if (!row) return json({ error: 'Quote dossier not found' }, { status: 404 });
    return json({ ok: true, dossier: quoteDossierResponse(row) });
  }

  if (request.method === 'PATCH' && quoteDossierMatch) {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const edits = body.edits;
    if (!edits || typeof edits !== 'object' || Array.isArray(edits)) {
      return json({ error: 'edits is required' }, { status: 400 });
    }
    const row = await getQuoteDossierById(requireDb(env), decodeURIComponent(quoteDossierMatch[1]));
    if (!row) return json({ error: 'Quote dossier not found' }, { status: 404 });
    if (row.status === 'HUMAN_VALIDATED') {
      return json({ error: 'Human-validated dossier requires explicit re-opening' }, { status: 409 });
    }
    const input = edits as Record<string, unknown>;
    const allowed = new Set(['commercialNeed', 'requestedScope', 'timing', 'decisionContext', 'openQuestions']);
    if (Object.keys(input).some((key) => !allowed.has(key))) {
      return json({ error: 'Unsupported dossier edit field' }, { status: 400 });
    }
    const scalarFields = ['commercialNeed', 'requestedScope', 'timing', 'decisionContext'] as const;
    for (const field of scalarFields) {
      const value = input[field];
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return json({ error: `Invalid dossier edit value for ${field}` }, { status: 400 });
      }
    }
    if (
      input.openQuestions !== undefined &&
      (!Array.isArray(input.openQuestions) ||
        !input.openQuestions.every((value) => typeof value === 'string'))
    ) {
      return json({ error: 'Invalid dossier edit value for openQuestions' }, { status: 400 });
    }
    const resolution = body.resolution;
    let parsedResolution: QuoteDossierConflictResolution | undefined;
    if (resolution !== undefined) {
      if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) {
        return json({ error: 'Invalid dossier conflict resolution' }, { status: 400 });
      }
      const candidate = resolution as Record<string, unknown>;
      const fields: QuoteDossierConflictField[] = ['commercialNeed', 'requestedScope', 'timing', 'decisionContext'];
      if (
        typeof candidate.field !== 'string' ||
        !fields.includes(candidate.field as QuoteDossierConflictField) ||
        typeof candidate.value !== 'string' ||
        !candidate.value.trim()
      ) {
        return json({ error: 'Invalid dossier conflict resolution' }, { status: 400 });
      }
      parsedResolution = { field: candidate.field as QuoteDossierConflictField, value: candidate.value };
    }
    const now = new Date().toISOString();
    let updated = applyQuoteDossierEdits(
      quoteDossierFromRow(row),
      input as QuoteDossierEditableInput,
      now,
    );
    if (parsedResolution) {
      updated = resolveQuoteDossierConflict(updated, parsedResolution.field, parsedResolution.value, now);
    }
    await requireDb(env)
      .prepare(
        `UPDATE quote_dossiers
         SET dossier_json = ?, updated_at = ?
         WHERE id = ? AND status = 'DRAFT'`,
      )
      .bind(JSON.stringify(updated), now, row.id)
      .run();
    const reloaded = await getQuoteDossierById(requireDb(env), row.id);
    if (!reloaded) return json({ error: 'Quote dossier could not be reloaded' }, { status: 500 });
    return json({ ok: true, dossier: quoteDossierResponse(reloaded) });
  }

  const quoteDossierValidationMatch = url.pathname.match(
    /^\/api\/quote-dossiers\/([^/]+)\/validate$/,
  );
  if (request.method === 'POST' && quoteDossierValidationMatch) {
    const db = requireDb(env);
    const dossierId = decodeURIComponent(quoteDossierValidationMatch[1]);
    const row = await getQuoteDossierById(db, dossierId);
    if (!row) return json({ error: 'Quote dossier not found' }, { status: 404 });
    try {
      const now = new Date().toISOString();
      const validated = validateQuoteDossier(quoteDossierFromRow(row), now);
      await db
        .prepare(
          `UPDATE quote_dossiers
           SET status = 'HUMAN_VALIDATED', dossier_json = ?, human_validated_at = ?, updated_at = ?
           WHERE id = ? AND status = 'DRAFT'`,
        )
        .bind(JSON.stringify(validated), now, now, dossierId)
        .run();
      const reloaded = await getQuoteDossierById(db, dossierId);
      if (!reloaded) return json({ error: 'Quote dossier could not be reloaded' }, { status: 500 });
      return json({ ok: true, dossier: quoteDossierResponse(reloaded) });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Quote dossier validation rejected' },
        { status: 409 },
      );
    }
  }

  const quoteDossierPublicationMatch = url.pathname.match(
    /^\/api\/quote-dossiers\/([^/]+)\/publish$/,
  );
  if (request.method === 'POST' && quoteDossierPublicationMatch) {
    try {
      return json(
        await publishCanonicalQuote(
          env,
          requireDb(env),
          decodeURIComponent(quoteDossierPublicationMatch[1]),
        ),
      );
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Canonical quote publication rejected',
        },
        { status: 409 },
      );
    }
  }

  const prototypeCostGateMatch = url.pathname.match(
    /^\/api\/prospects\/([^/]+)\/prototype-cost-gate$/,
  );

  if (request.method === 'GET' && prototypeCostGateMatch) {
    const prospectId = decodeURIComponent(prototypeCostGateMatch[1]);
    const db = requireDb(env);
    const prospect = await new D1ProspectRepository(db).getProspect(prospectId);

    if (!prospect) {
      return json({ error: 'Prospect not found' }, { status: 404 });
    }

    const row = await getLatestPrototypeCostGate(db, prospectId);

    return json({
      ok: true,
      evaluation: row ? prototypeCostGateResponse(row) : null,
    });
  }

  const prototypeCostGateEvaluateMatch = url.pathname.match(
    /^\/api\/prospects\/([^/]+)\/prototype-cost-gate\/evaluate$/,
  );

  if (request.method === 'POST' && prototypeCostGateEvaluateMatch) {
    const prospectId = decodeURIComponent(prototypeCostGateEvaluateMatch[1]);
    const db = requireDb(env);
    const repo = new D1ProspectRepository(db);
    const prospect = await repo.getProspect(prospectId);

    if (!prospect) {
      return json({ error: 'Prospect not found' }, { status: 404 });
    }

    if (
      prospect.state !== 'PROTOTYPE_REQUIRED' &&
      prospect.state !== 'INTERESTED' &&
      prospect.state !== 'MEETING_BOOKED'
    ) {
      return json(
        {
          error:
            'Prototype Cost Gate only evaluates PROTOTYPE_REQUIRED, INTERESTED or MEETING_BOOKED prospects',
          state: prospect.state,
        },
        { status: 409 },
      );
    }

    let body: Record<string, unknown> = {};
    const rawBody = await request.text();

    if (rawBody.trim()) {
      try {
        const parsed = JSON.parse(rawBody) as unknown;

        if (
          !parsed ||
          typeof parsed !== 'object' ||
          Array.isArray(parsed)
        ) {
          return json(
            {
              error:
                'Prototype Cost Gate request body must be an object',
            },
            { status: 400 },
          );
        }

        body = parsed as Record<string, unknown>;
      } catch {
        return json(
          { error: 'Valid JSON body is required' },
          { status: 400 },
        );
      }
    }

    if (Object.keys(body).length > 0) {
      return json(
        {
          error:
            'Prototype Cost Gate inputs are derived internally; request body must be empty',
        },
        { status: 400 },
      );
    }

    const persisted =
      await evaluateAndPersistPrototypeCostGate(
        db,
        prospect,
      );

    return json({
      ok: true,
      evaluation: prototypeCostGateResponse(persisted),
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/overview') {
    return json(await overview(requireDb(env)));
  }

  if (request.method === 'GET' && url.pathname === '/api/prospects') {
    const db = requireDb(env);
    const repo = new D1ProspectRepository(db);
    const prospects = await repo.listProspects();
    const eventStore = new D1EventStore(db);
    const computedAt = new Date().toISOString();
    const engagementByProspect = new Map(
      await Promise.all(
        prospects.map(async (prospect) => [
          prospect.id,
          scoreEngagementFromMagicScriptEvents(
            await eventStore.listByProspect(prospect.id),
            computedAt,
          ),
        ] as const),
      ),
    );
    const prototypeCostGateByProspect = new Map(
      await Promise.all(
        prospects.map(async (prospect) => [
          prospect.id,
          await getLatestPrototypeCostGate(db, prospect.id),
        ] as const),
      ),
    );
    return json({
      prospects: prospects.map((prospect) => {
        const hub = resolveSwarmHub(prospect);
        return {
          ...prospect,
          hubId: hub.id,
          businessUnit: hub.businessUnit,
          masterOfWork: hub.masterOfWork,
          engagement: engagementByProspect.get(prospect.id),
          prototypeCostGate: (() => {
            const gateRow = prototypeCostGateByProspect.get(prospect.id);
            return gateRow ? prototypeCostGateResponse(gateRow) : null;
          })(),
        };
      }),
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/sales-rooms') {
    return json({ salesRooms: await listSalesRoomSummaries(env, requireDb(env)) });
  }

  if (request.method === 'GET' && url.pathname === '/api/public/sales-room-availability') {
    try {
      return json(await listPublicSalesRoomAvailability(env, requireDb(env), url));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Availability unavailable';
      return json({ error: message }, { status: message === 'Sales Room not found' ? 404 : 400 });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/sales-rooms/events') {
    const body = (await request.json()) as Record<string, unknown>;
    try {
      return json(await recordSalesRoomEvent(env, requireDb(env), body));
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Sales Room event rejected' },
        { status: 400 },
      );
    }
  }

  if (
    request.method === 'POST' &&
    (url.pathname === '/api/public/sales-room-message' ||
      url.pathname === '/api/public/sales-room-meeting-requested' ||
      url.pathname === '/api/public/sales-room-event' ||
      url.pathname === '/api/public/sales-room-booking' ||
      url.pathname === '/api/public/sales-room-meeting-cancel' ||
      url.pathname === '/api/public/sales-room-quote-accept')
  ) {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
      const db = requireDb(env);
      const result =
        url.pathname === '/api/public/sales-room-message'
          ? await recordPublicSalesRoomMessage(env, db, body)
          : url.pathname === '/api/public/sales-room-meeting-requested'
            ? await recordPublicSalesRoomMeetingRequest(env, db, body)
            : url.pathname === '/api/public/sales-room-event'
              ? await recordSalesRoomEvent(env, db, body)
              : url.pathname === '/api/public/sales-room-booking'
                ? await bookPublicSalesRoomMeeting(env, db, body)
                : url.pathname === '/api/public/sales-room-meeting-cancel'
                  ? await cancelPublicSalesRoomMeeting(db, body)
                  : await acceptPublicSalesRoomQuote(env, db, body);
      return json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sales Room action rejected';
      const status = message === 'Sales Room not found' || message === 'Meeting not found'
        ? 404
        : ['SLOT_UNAVAILABLE', 'ACTIVE_MEETING_EXISTS', 'rescheduledFromMeetingId is not an active meeting'].includes(message)
          ? 409
          : 400;
      return json({ error: message }, { status });
    }
  }

  const salesRoomStatusMatch = url.pathname.match(
    /^\/api\/sales-rooms\/([^/]+)\/(disable|enable)$/,
  );
  if (request.method === 'POST' && salesRoomStatusMatch) {
    const slug = safeSalesRoomSlug(decodeURIComponent(salesRoomStatusMatch[1]));
    if (!slug) return json({ error: 'Invalid Sales Room slug' }, { status: 400 });
    const db = requireDb(env);
    const summaries = await listSalesRoomSummaries(env, db);
    const room = summaries.find((candidate) => candidate.slug === slug);
    if (!room) return json({ error: 'Sales Room not found' }, { status: 404 });

    const targetStatus: SalesRoomStatus =
      salesRoomStatusMatch[2] === 'disable' ? 'DISABLED' : 'ACTIVE';
    if (room.status === targetStatus) {
      return json({ ok: true, duplicate: true, slug, status: targetStatus });
    }

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: room.prospectId,
      actor: 'human',
      type: targetStatus === 'DISABLED' ? 'sales_room.disabled' : 'sales_room.enabled',
      payload: {
        ...buildSalesRoomEventPayload({ slug }),
        status: targetStatus,
        owner: 'stephane',
      },
      createdAt: new Date().toISOString(),
    });
    return json({ ok: true, slug, status: targetStatus });
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/prospects/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/prospects/'.length));
    const db = requireDb(env);
    const repo = new D1ProspectRepository(db);
    const prospect = await repo.getProspect(id);
    if (!prospect) return json({ error: 'Prospect not found' }, { status: 404 });
    const prototype = await db
      .prepare(
        `SELECT id, prospect_id, repo_path, runner_id, status, qa_status,
                deployment_url, build_manifest_json, qa_findings_json,
                updated_at
         FROM prototypes
         WHERE prospect_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .bind(id)
      .first<Record<string, unknown>>();
    const salesRoom = (await listSalesRoomSummaries(env, db)).find(
      (candidate) => candidate.prospectId === prospect.id,
    );
    const commercialLinks = buildPersonalizedEntryLinks({
      prospectId: prospect.id,
      companyName: prospect.companyName,
      salesRoomSlug: salesRoom?.slug,
      salesRoomStatus: salesRoom?.status ?? 'ACTIVE',
      prototypeUrl: typeof prototype?.deployment_url === 'string' ? prototype.deployment_url : null,
      prototypeStatus: typeof prototype?.status === 'string' ? prototype.status : null,
      qaStatus: typeof prototype?.qa_status === 'string' ? prototype.qa_status : null,
      personalizedBaseUrl: env.MAGICSCRIPT_PUBLIC_BASE_URL,
    });

    return json({
      prospect,
      contacts: await repo.listContacts(id),
      prototype,
      salesRoom: salesRoom ?? null,
      commercialLinks,
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/meetings') {
    return json(await listControlCenterMeetings(requireDb(env), url));
  }

  const meetingBookedMatch = url.pathname.match(
    /^\/api\/prospects\/([^/]+)\/meeting-booked$/,
  );
  if (request.method === 'POST' && meetingBookedMatch) {
    const prospectId = decodeURIComponent(meetingBookedMatch[1]);
    const body = (await request.json()) as {
      bookingId?: string;
      scheduledAt?: string;
      prospectTimezone?: string;
    };
    const bookingId = body.bookingId?.trim();
    const scheduledAt = body.scheduledAt?.trim();
    if (!bookingId || !scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime())) {
      return json(
        { error: 'bookingId and a valid scheduledAt are required' },
        { status: 400 },
      );
    }

    const db = requireDb(env);
    const repo = new D1ProspectRepository(db);
    const prospect = await repo.getProspect(prospectId);
    if (!prospect) return json({ error: 'Prospect not found' }, { status: 404 });

    const eventStore = new D1EventStore(db);
    const history = await eventStore.listByProspect(prospect.id);
    const eventType = 'commercial.meeting_booked';
    const duplicate = history.find(
      (event) =>
        event.type === eventType &&
        event.payload &&
        typeof event.payload === 'object' &&
        (event.payload as Record<string, unknown>).bookingId === bookingId,
    );
    if (duplicate) {
      return json({ ok: true, duplicate: true, prospectId, state: prospect.state });
    }

    let transition;
    try {
      transition = commercialTransition(prospect.state, 'MEETING_BOOKED');
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Meeting booking rejected' },
        { status: 409 },
      );
    }

    await repo.transitionProspect(prospect.id, transition.to, transition.reason);
    const briefing = await prepareCommercialBriefing(env, db, prospect, {
      source: 'meeting_booking',
      summary: 'Rendez-vous effectivement rÃƒÆ’Ã‚Â©servÃƒÆ’Ã‚Â© ; briefing commercial ÃƒÆ’Ã‚Â  traiter par StÃƒÆ’Ã‚Â©phane.',
    });
    const now = new Date().toISOString();
    await eventStore.append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'system',
      type: eventType,
      payload: {
        bookingId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        prospectTimezone: body.prospectTimezone?.trim() || null,
        nextOwner: 'stephane',
        briefing,
      },
      createdAt: now,
    });
    await refreshPrototypeCostGateAfterObjectiveSignal(
      db,
      prospect.id,
      'MEETING_BOOKED',
      now,
    );

    await createEscalation(
      db,
      prospect.id,
      'MEETING_BOOKED',
      commercialEscalationSummary(briefing),
    );

    return json({
      ok: true,
      prospectId: prospect.id,
      state: transition.to,
      briefing,
    });
  }

  const commercialEventMatch = url.pathname.match(
    /^\/api\/prospects\/([^/]+)\/commercial-event$/,
  );
  if (request.method === 'POST' && commercialEventMatch) {
    const prospectId = decodeURIComponent(commercialEventMatch[1]);
    const body = (await request.json()) as {
      event?: string;
      quoteId?: string;
      paymentConfirmationReference?: string;
    };
    const allowedEvents = new Set<CommercialEvent>([
      'QUOTE_DRAFTED',
      'QUOTE_ACCEPTED',
      'DEPOSIT_CONFIRMED',
      'STOP',
    ]);
    if (!body.event || !allowedEvents.has(body.event as CommercialEvent)) {
      return json({ error: 'Unsupported commercial event' }, { status: 400 });
    }

    const event = body.event as CommercialEvent;
    if (event === 'DEPOSIT_CONFIRMED' && !body.paymentConfirmationReference?.trim()) {
      return json(
        { error: 'paymentConfirmationReference is required for DEPOSIT_CONFIRMED' },
        { status: 400 },
      );
    }

    const db = requireDb(env);
    const repo = new D1ProspectRepository(db);
    const prospect = await repo.getProspect(prospectId);
    if (!prospect) return json({ error: 'Prospect not found' }, { status: 404 });

    const eventStore = new D1EventStore(db);
    const eventType = `commercial.${event.toLowerCase()}`;
    const history = await eventStore.listByProspect(prospect.id);
    const duplicate = history.find((item) => item.type === eventType);
    if (duplicate) {
      return json({ ok: true, duplicate: true, prospectId, state: prospect.state });
    }

    let transition;
    try {
      transition = commercialTransition(prospect.state, event, {
        paymentConfirmationReference: body.paymentConfirmationReference,
      });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Commercial event rejected' },
        { status: 409 },
      );
    }

    await repo.transitionProspect(prospect.id, transition.to, transition.reason);
    const now = new Date().toISOString();
    await eventStore.append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'human',
      type: eventType,
      payload: {
        quoteId: body.quoteId?.trim() || null,
        paymentConfirmationReference:
          event === 'DEPOSIT_CONFIRMED'
            ? body.paymentConfirmationReference?.trim()
            : null,
        humanValidationRequired: event !== 'DEPOSIT_CONFIRMED',
      },
      createdAt: now,
    });

    if (transition.to === 'QUOTE_PENDING' || transition.to === 'COMMITTED') {
      await createEscalation(
        db,
        prospect.id,
        transition.to,
        transition.reason,
      );
    }

    return json({ ok: true, prospectId: prospect.id, state: transition.to });
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
    const db = requireDb(env);
    const result = await db
      .prepare(
        `SELECT
           pr.id,
           pr.prospect_id,
           p.company_name,
           pr.status,
           pr.qa_status,
           pr.qa_findings_json,
           pr.deployment_url,
           pr.runner_id,
           pr.updated_at
         FROM prototypes pr
         JOIN prospects p ON p.id = pr.prospect_id
         ORDER BY pr.updated_at DESC
         LIMIT 50`,
      )
      .all<Record<string, unknown>>();
    const salesRooms = await listSalesRoomSummaries(env, db);
    const salesRoomsByProspect = new Map(
      salesRooms.map((room) => [room.prospectId, room]),
    );

    const prototypes = (result.results ?? []).map((prototype) => {
      const prospectId =
        typeof prototype.prospect_id === 'string' ? prototype.prospect_id : '';
      const companyName =
        typeof prototype.company_name === 'string' ? prototype.company_name : '';
      const salesRoom = salesRoomsByProspect.get(prospectId);
      const links = buildPersonalizedEntryLinks({
        prospectId,
        companyName,
        salesRoomSlug: salesRoom?.slug,
        salesRoomStatus: salesRoom?.status ?? 'ACTIVE',
        prototypeUrl:
          typeof prototype.deployment_url === 'string'
            ? prototype.deployment_url
            : null,
        prototypeStatus:
          typeof prototype.status === 'string' ? prototype.status : null,
        qaStatus:
          typeof prototype.qa_status === 'string' ? prototype.qa_status : null,
        personalizedBaseUrl: env.MAGICSCRIPT_PUBLIC_BASE_URL,
      });

      const { qa_findings_json: _qaFindings, ...publicPrototype } = prototype;
      return {
        ...publicPrototype,
        web_design_status: webDesignReviewStatus(_qaFindings),
        web_design_ready: canPromoteWithWebDesignReview(_qaFindings),
        prototype_url: links.prototypeUrl,
        personalized_url: links.personalizedUrl,
        prototype_entry_url: links.prototypeEntryUrl,
        sales_room_url: links.salesRoomUrl,
        sales_room_slug: links.salesRoomSlug,
        sales_room_status: links.salesRoomStatus,
        sales_room_review_due: salesRoom?.reviewDue ?? false,
        sales_room_review_due_at: salesRoom?.reviewDueAt ?? null,
        sales_room_last_activity_at: salesRoom?.lastActivityAt ?? null,
        sales_room_share_clicks: salesRoom?.shareClicks ?? 0,
        personalized_entry_enabled: links.personalizedEntryEnabled,
      };
    });

    return json({ prototypes });
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
        `SELECT id, prospect_id, category, summary, status, source_event_id, created_at, resolved_at,
                CASE category
                  WHEN 'MEETING_BOOKED' THEN 'URGENT'
                  WHEN 'INTERESTED' THEN 'HIGH'
                  WHEN 'COMMITTED' THEN 'HIGH'
                  WHEN 'QUOTE_PENDING' THEN 'HIGH'
                  WHEN 'DORMANT' THEN 'NORMAL'
                  ELSE 'NORMAL'
                END AS priority
         FROM human_escalations
         WHERE status = 'OPEN'
         ORDER BY CASE category
                    WHEN 'MEETING_BOOKED' THEN 1
                    WHEN 'INTERESTED' THEN 2
                    WHEN 'COMMITTED' THEN 3
                    WHEN 'QUOTE_PENDING' THEN 4
                    WHEN 'DORMANT' THEN 5
                    ELSE 10
                  END,
                  created_at DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all<Record<string, unknown>>();

    return json({ escalations: result.results ?? [] });
  }


  const resolveEscalationMatch = url.pathname.match(
    /^\/api\/escalations\/([^/]+)\/resolve$/,
  );
  if (request.method === 'POST' && resolveEscalationMatch) {
    const escalationId = decodeURIComponent(resolveEscalationMatch[1]);
    const body = (await request.json()) as {
      resumeState?:
        | 'CONTACT_DISCOVERY'
        | 'PROTOTYPE_REQUIRED'
        | 'OUTREACH_READY'
        | 'CLOSED_LOST';
      note?: string;
    };

    if (!body.resumeState) {
      return json({ error: 'resumeState is required' }, { status: 400 });
    }

    const db = requireDb(env);
    const escalation = await db
      .prepare(
        `SELECT id, prospect_id, status
         FROM human_escalations
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(escalationId)
      .first<{ id: string; prospect_id: string; status: string }>();

    if (!escalation) {
      return json({ error: 'Escalation not found' }, { status: 404 });
    }

    if (escalation.status !== 'OPEN') {
      return json({ error: 'Escalation is already resolved' }, { status: 409 });
    }

    const repo = new D1ProspectRepository(db);
    const prospect = await repo.getProspect(escalation.prospect_id);
    if (!prospect) {
      return json({ error: 'Prospect not found' }, { status: 404 });
    }

    if (!canTransition(prospect.state, body.resumeState)) {
      return json(
        {
          error: `Cannot resume prospect from ${prospect.state} to ${body.resumeState}`,
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    await repo.transitionProspect(
      prospect.id,
      body.resumeState,
      body.note?.trim() || `Human review resolved to ${body.resumeState}`,
    );

    await db
      .prepare(
        `UPDATE human_escalations
         SET status = 'RESOLVED',
             resolved_at = ?
         WHERE id = ? AND status = 'OPEN'`,
      )
      .bind(now, escalation.id)
      .run();

    await new D1EventStore(db).append({
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      actor: 'human',
      type: 'human_review.resolved',
      payload: {
        escalationId: escalation.id,
        resumeState: body.resumeState,
        note: body.note?.trim() || null,
      },
      createdAt: now,
    });

    if (
      env.MAGICSCRIPT_AUTOPILOT_ENABLED === 'true' &&
      body.resumeState !== 'CLOSED_LOST'
    ) {
      await orchestrator(env, db).planProspect(prospect.id);
    }

    return json({
      ok: true,
      escalationId: escalation.id,
      prospectId: prospect.id,
      state: body.resumeState,
    });
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
      prospect.state === 'FOLLOW_UP_SENT' ||
      prospect.state === 'INTERESTED' ||
      prospect.state === 'DORMANT'
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
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      nowUtc?: string;
    };
    const prototypeCostGateJ30 =
      await schedulePrototypeCostGateJ30Drafts(
        env,
        db,
        body.nowUtc,
      );
    const interestFollowups =
      await scheduleInterestFollowupDrafts(env, db);
    const followups = await scheduleDueFollowUps(env, db);
    const meetingReminders =
      await scheduleMeetingReminders(db);
    const drained =
      await drainDeterministicJobs(
        env,
        db,
        body.limit ?? 10,
      );
    return json({
      recovery,
      prototypeCostGateJ30,
      interestFollowups,
      followups,
      meetingReminders,
      ...drained,
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/system/meeting-reminders') {
    const body = (await request.json().catch(() => ({}))) as { nowUtc?: string };
    return json(await scheduleMeetingReminders(requireDb(env), body.nowUtc));
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
    const currentJobId =
      typeof body.currentJobId === 'string' && body.currentJobId.trim()
        ? body.currentJobId.trim()
        : null;

    const db = requireDb(env);

    // A fresh IDLE heartbeat is also the recovery point after a runner
    // process restart. Release every active claim owned by this runner, not
    // only the job id cached in runners.current_job_id.
    if (status === 'IDLE' && !currentJobId) {
      await releaseRunnerClaims(
        db,
        runnerId,
        'Runner became idle; previous active claim released for safe recovery',
      );
    }

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
        currentJobId,
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

  if (request.method === 'POST' && url.pathname === '/api/runner/shutdown') {
    const runnerId = request.headers.get('x-magicscript-runner-id')?.trim();
    if (!runnerId) return json({ error: 'runnerId is required' }, { status: 400 });

    const db = requireDb(env);
    const releasedJobs = await releaseRunnerClaims(
      db,
      runnerId,
      'Runner shutdown requested; job released for safe recovery',
    );

    await db
      .prepare(
        `UPDATE runners
         SET status = 'ERROR', current_job_id = NULL, last_seen_at = ?
         WHERE runner_id = ?`,
      )
      .bind(new Date().toISOString(), runnerId)
      .run();

    return json({
      ok: true,
      runnerId,
      releasedJobId: releasedJobs[0]?.id ?? null,
      releasedJobIds: releasedJobs.map((job) => job.id),
    });
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

    const runnerProspectId = env.MAGICSCRIPT_RUNNER_PROSPECT_ID?.trim() || undefined;
    const job = await queue.next(new Date(), runnerId, runnerKinds, runnerProspectId);

    if (!job) {
      return new Response(null, { status: 204 });
    }

    if (
      job.kind === 'GENERATE_PROTOTYPE_STRATEGY' ||
      job.kind === 'BUILD_PROTOTYPE'
    ) {
      let gateBlockReason: string | null = null;

      if (!job.prospectId) {
        gateBlockReason =
          'Prototype job has no prospectId for Cost Gate verification';
      } else {
        const evaluation =
          await getLatestPrototypeCostGate(db, job.prospectId);

        const payloadAuthorization =
          job.payload && typeof job.payload === 'object'
            ? (job.payload as Record<string, unknown>)
                .prototypeAuthorization
            : undefined;

        if (!evaluation) {
          gateBlockReason =
            'Prototype Cost Gate evaluation is missing';
        } else if (evaluation.authorization === 'NONE') {
          gateBlockReason =
            'Prototype Cost Gate authorization is NONE';
        } else if (
          payloadAuthorization !== evaluation.authorization
        ) {
          gateBlockReason =
            `Prototype Cost Gate authorization mismatch: persisted=${evaluation.authorization}, payload=${String(payloadAuthorization ?? 'MISSING')}`;
        }
      }

      if (gateBlockReason) {
        const now = new Date().toISOString();

        await db
          .prepare(
            `UPDATE jobs
             SET status = 'DEAD_LETTER',
                 last_error = ?,
                 claimed_by = NULL,
                 claimed_at = NULL,
                 updated_at = ?
             WHERE id = ?
               AND status = 'RUNNING'`,
          )
          .bind(
            `Prototype Cost Gate blocked claimed job: ${gateBlockReason}`,
            now,
            job.id,
          )
          .run();

        return json(
          {
            error: 'Prototype Cost Gate blocked claimed job',
            reason: gateBlockReason,
          },
          { status: 409 },
        );
      }
    }

    const queuedHandoff =
      job.payload && typeof job.payload === 'object'
        ? (job.payload as Record<string, unknown>).handoff
        : undefined;
    if (queuedHandoff !== undefined) {
      const handoffValidation = validateHandoff(queuedHandoff as Partial<HandoffPacket>);
      if (!handoffValidation.accepted) {
        await queue.markFailed(
          job.id,
          `Invalid queued handoff: ${handoffValidation.reasons.join('; ')}`,
        );
        return json(
          { error: 'Invalid queued handoff', reasons: handoffValidation.reasons },
          { status: 400 },
        );
      }
    }

// Declare prototypeStrategy outside the BUILD_PROTOTYPE block so it's in scope for the return statement
let prototypeStrategy: PrototypeStrategyResult | null = null;

// For BUILD_PROTOTYPE jobs, validate that we have a successful strategy before proceeding
if ((job.kind === 'BUILD_PROTOTYPE' || job.kind === 'RUN_PROTOTYPE_QA') && job.prospectId) {
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

    let prototypeConversion: {
      salesRoomUrl: string | null;
      salesRoomSlug: string | null;
      ctaTarget: 'SALES_ROOM';
    } | null = null;

    if (
      job.prospectId &&
      prospect &&
      (
        job.kind === 'BUILD_PROTOTYPE' ||
        job.kind === 'RUN_PROTOTYPE_QA'
      )
    ) {
      const existingRoom = (
        await listSalesRoomSummaries(env, db)
      ).find(
        (candidate) =>
          candidate.prospectId === prospect.id,
      );

      const conversionLinks =
        buildPersonalizedEntryLinks({
          prospectId: prospect.id,
          companyName: prospect.companyName,
          salesRoomSlug: existingRoom?.slug,
          salesRoomStatus:
            existingRoom?.status ?? 'ACTIVE',
          personalizedBaseUrl:
            env.MAGICSCRIPT_PUBLIC_BASE_URL,
        });

      prototypeConversion = {
        salesRoomUrl:
          conversionLinks.salesRoomStatus ===
          'DISABLED'
            ? null
            : conversionLinks.salesRoomUrl,
        salesRoomSlug:
          conversionLinks.salesRoomSlug,
        ctaTarget: 'SALES_ROOM',
      };
    }

    return json({
      job,
      prospect,
      contacts,
      outreachDraft,
      researchContext,
      latestReply,
      threadParentMessageId,
      prototypeContext,
      prototypeConversion,
      prototypeStrategy,
    });
  }

  const sendStartMatch = url.pathname.match(/^\/api\/runner\/jobs\/([^/]+)\/send-start$/);
  if (request.method === 'POST' && sendStartMatch) {
    const jobId = decodeURIComponent(sendStartMatch[1]);
    const body = (await request.json()) as { messageId?: string };
    const messageId = body.messageId?.trim();
    const db = requireDb(env);

    if (!messageId) return json({ error: 'messageId is required' }, { status: 400 });

    const job = await db
      .prepare('SELECT id, kind, prospect_id, status, claimed_by FROM jobs WHERE id = ? LIMIT 1')
      .bind(jobId)
      .first<{
        id: string;
        kind: MagicScriptJob['kind'];
        prospect_id: string | null;
        status: JobStatus;
        claimed_by: string | null;
      }>();

    if (!job) return json({ error: 'Job not found' }, { status: 404 });
    const runnerId = request.headers.get('x-magicscript-runner-id')?.trim();
    if (!runnerId) return json({ error: 'runnerId is required' }, { status: 400 });
    if (job.claimed_by !== runnerId) {
      return json({ error: 'Job is no longer owned by this runner' }, { status: 409 });
    }
    if (!isExternalSendKind(job.kind)) {
      return json({ error: 'Job is not an external send job' }, { status: 400 });
    }

    if (job.status !== 'RUNNING') {
      const status =
        job.status === 'SENDING' || job.status === 'SEND_UNKNOWN' || job.status === 'SUCCEEDED'
          ? job.status
          : undefined;
      return json(
        { error: 'Job is not available for a new SMTP send', ...(status ? { status } : {}) },
        { status: 409 },
      );
    }

    if (!job.prospect_id) return json({ error: 'Send job has no prospectId' }, { status: 400 });

    const message = await db
      .prepare(
        `SELECT id
         FROM outreach_messages
         WHERE id = ?
           AND prospect_id = ?
           AND kind = ?
           AND status = 'VERIFIED'
         LIMIT 1`,
      )
      .bind(messageId, job.prospect_id, messageKindForSendJob(job.kind))
      .first<{ id: string }>();

    if (!message) {
      return json({ error: 'Message is not a VERIFIED message for this send job' }, { status: 409 });
    }

    const started = await db
      .prepare(
        `UPDATE jobs
         SET status = 'SENDING',
             payload_json = json_set(payload_json, '$.sendMessageId', ?),
             updated_at = ?
         WHERE id = ? AND status = 'RUNNING'
         RETURNING id`,
      )
      .bind(message.id, new Date().toISOString(), job.id)
      .first<{ id: string }>();

    if (!started) {
      return json(
        { error: 'Job was claimed by another send attempt', status: 'SEND_UNKNOWN' },
        { status: 409 },
      );
    }

    const reservedMessage = await db
      .prepare(
        `UPDATE outreach_messages
         SET status = 'SENDING',
             updated_at = ?
         WHERE id = ? AND status = 'VERIFIED'
         RETURNING id`,
      )
      .bind(new Date().toISOString(), message.id)
      .first<{ id: string }>();

    if (!reservedMessage) {
      return json(
        { error: 'Message reservation became uncertain; SMTP send is blocked', status: 'SEND_UNKNOWN' },
        { status: 409 },
      );
    }

    return json({ ok: true, status: 'STARTED' });
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

    const runnerId = request.headers.get('x-magicscript-runner-id')?.trim();
    if (!runnerId) return json({ error: 'runnerId is required' }, { status: 400 });
    if (
      (row.status !== 'RUNNING' && row.status !== 'SENDING') ||
      row.claimed_by !== runnerId
    ) {
      return json(
        { error: 'Job is no longer owned by this runner', status: row.status },
        { status: 409 },
      );
    }

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
    const runnerId = request.headers.get('x-magicscript-runner-id')?.trim();
    if (!runnerId) return json({ error: 'runnerId is required' }, { status: 400 });
    const ownedJob = await db
      .prepare('SELECT status, claimed_by FROM jobs WHERE id = ? LIMIT 1')
      .bind(jobId)
      .first<{ status: JobStatus; claimed_by: string | null }>();
    if (!ownedJob) return json({ error: 'Job not found' }, { status: 404 });
    if (
      (ownedJob.status !== 'RUNNING' && ownedJob.status !== 'SENDING') ||
      ownedJob.claimed_by !== runnerId
    ) {
      return json(
        { error: 'Job is no longer owned by this runner', status: ownedJob.status },
        { status: 409 },
      );
    }
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
    await schedulePrototypeCostGateJ30Drafts(
      env,
      env.DB,
    );
    await scheduleInterestFollowupDrafts(env, env.DB);
    await scheduleDueFollowUps(env, env.DB);
    await scheduleMeetingReminders(env.DB);
    await drainDeterministicJobs(env, env.DB, 10);
  },
};
