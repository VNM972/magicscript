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

async function enqueueDiscoveryIfNeeded(
  env: Env,
  db: D1DatabaseLike,
): Promise<{ queued: boolean; reason?: string; jobId?: string }> {
  if (env.MAGICSCRIPT_AUTOPILOT_ENABLED !== 'true') {
    return { queued: false, reason: 'Autopilot disabled' };
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
  const limit = Number.parseInt(env.MAGICSCRIPT_DISCOVERY_BATCH_SIZE ?? '20', 10) || 20;
  const queue = new D1JobQueue(db);
  const job = await queue.enqueue({
    id: crypto.randomUUID(),
    kind: 'DISCOVER_PROSPECTS',
    payload: { location, limit },
    maxAttempts: 3,
    runAfter: new Date().toISOString(),
  });

  return { queued: true, jobId: job.id };
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
      await repo.transitionProspect(current.id, 'CONTACT_FOUND', 'Validated professional email found');
      await repo.transitionProspect(current.id, 'OUTREACH_READY', 'Contact passed automatic validation');
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
    await repo.transitionProspect(
      job.prospectId,
      'DISQUALIFIED',
      'No reliable contact after two discovery passes',
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

  if ((rejected?.count ?? 0) >= 2 && prospect.state === 'OUTREACH_DRAFTED') {
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

  await db
    .prepare(
      `INSERT INTO human_escalations (
        id, prospect_id, category, summary, status, source_event_id, created_at, resolved_at
      ) VALUES (?, ?, ?, ?, 'OPEN', NULL, ?, NULL)`,
    )
    .bind(crypto.randomUUID(), prospectId, category, summary, new Date().toISOString())
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

  let humanRequired = false;

  switch (result.classification) {
    case 'NO_INTEREST': {
      await repo.transitionProspect(prospect.id, 'NEGATIVE_REPLY', 'Reply classified as no interest');

      if (result.doNotContact === true && reply.email) {
        await db
          .prepare(
            `INSERT INTO suppression_list (email, reason, source, created_at)
             VALUES (?, 'recipient_opt_out', 'reply_classifier', ?)
             ON CONFLICT(email) DO NOTHING`,
          )
          .bind(reply.email.toLowerCase(), new Date().toISOString())
          .run();

        await db
          .prepare('UPDATE contacts SET is_suppressed = 1, updated_at = ? WHERE lower(email) = lower(?)')
          .bind(new Date().toISOString(), reply.email)
          .run();

        await repo.transitionProspect(prospect.id, 'DO_NOT_CONTACT', 'Recipient requested no further contact');
      } else {
        await repo.transitionProspect(prospect.id, 'CLOSED_LOST', 'Prospect declined');
      }
      break;
    }

    case 'AUTO_REPLY':
      await repo.transitionProspect(prospect.id, 'WAITING_REPLY', 'Automated reply detected');
      break;

    case 'POSITIVE_INTEREST':
      await repo.transitionProspect(prospect.id, 'POSITIVE_REPLY', 'Positive commercial interest detected');
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
    },
    createdAt: new Date().toISOString(),
  });

  return {
    prospectId: prospect.id,
    classification: result.classification,
    humanRequired,
  };
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

  if (request.method === 'POST' && url.pathname === '/api/email/inbound') {
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

  if (request.method === 'POST' && url.pathname === '/api/autopilot/tick') {
    return json(await enqueueDiscoveryIfNeeded(env, requireDb(env)));
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

    await requireDb(env)
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

    return json({ ok: true, runnerId, lastSeenAt: now });
  }

  if (request.method === 'POST' && url.pathname === '/api/runner/jobs/claim') {
    const db = requireDb(env);
    const queue = new D1JobQueue(db);
    const runnerId = request.headers.get('x-magicscript-runner-id')?.trim() || undefined;
    const runnerKinds: MagicScriptJob['kind'][] = [
      'DISCOVER_PROSPECTS',
      'RUN_RESEARCH_SWARM',
      'DISCOVER_CONTACT',
      'GENERATE_OUTREACH',
      'FACT_CHECK_OUTREACH',
      'CLASSIFY_REPLY',
    ];
    const job = await queue.next(new Date(), runnerId, runnerKinds);

    if (!job) {
      return new Response(null, { status: 204 });
    }

    const repo = new D1ProspectRepository(db);
    await transitionOnClaim(job, repo);

    const prospect = job.prospectId ? await repo.getProspect(job.prospectId) : null;
    const contacts = job.prospectId ? await repo.listContacts(job.prospectId) : [];
    const outreachDraft = job.prospectId
      ? await db
          .prepare(
            "SELECT id, subject, body_text, confidence FROM outreach_messages WHERE prospect_id = ? AND status = 'DRAFT' ORDER BY created_at DESC LIMIT 1",
          )
          .bind(job.prospectId)
          .first<Record<string, unknown>>()
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

    return json({
      job,
      prospect,
      contacts,
      outreachDraft,
      researchContext,
      latestReply,
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
    await enqueueDiscoveryIfNeeded(env, env.DB);
  },
};
