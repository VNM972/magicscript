import { mkdir } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { MagicScriptApi, type ClaimedJob } from './api';
import { loadAmenMailConfig } from './email/config';
import { fetchAmenInboxSince, sendAmenEmail } from './email/amen';
import { runKimi, parseJsonOutput } from './kimi';
import { buildPrompt } from './prompts';

const baseUrl = process.env.MAGICSCRIPT_API_BASE_URL?.replace(/\/$/, '');
const runnerToken = process.env.MAGICSCRIPT_RUNNER_TOKEN;
const executable = process.env.KIMI_EXECUTABLE || 'kimi';
const pollIntervalMs =
  Number.parseInt(process.env.MAGICSCRIPT_POLL_INTERVAL_MS ?? '5000', 10) || 5000;
const inboxPollIntervalMs =
  Number.parseInt(process.env.MAGICSCRIPT_INBOX_POLL_MS ?? '60000', 10) || 60_000;
const swarmMaxConcurrency =
  Number.parseInt(process.env.MAGICSCRIPT_SWARM_MAX_CONCURRENCY ?? '8', 10) || 8;
const runnerRoot = resolve(
  process.env.MAGICSCRIPT_RUNNER_WORK_DIR || join(tmpdir(), 'magicscript-runner'),
);
const runnerHostname = hostname();
const runnerId =
  process.env.MAGICSCRIPT_RUNNER_ID?.trim() ||
  `${runnerHostname}-${process.pid}`;
const runnerVersion = '0.2.0';

const emailProvider = process.env.MAGICSCRIPT_EMAIL_PROVIDER?.trim() || 'disabled';
const sendingEnabled = process.env.MAGICSCRIPT_SENDING_ENABLED === 'true';
const amenConfigured =
  emailProvider === 'amen-smtp' &&
  Boolean(process.env.MAGICSCRIPT_EMAIL_USERNAME?.trim()) &&
  Boolean(process.env.MAGICSCRIPT_EMAIL_PASSWORD?.trim()) &&
  Boolean(process.env.MAGICSCRIPT_FROM_EMAIL?.trim());

if (!baseUrl) {
  throw new Error('MAGICSCRIPT_API_BASE_URL is required');
}

if (!runnerToken) {
  throw new Error('MAGICSCRIPT_RUNNER_TOKEN is required');
}

const api = new MagicScriptApi(baseUrl, runnerToken, runnerId);

async function heartbeat(
  status: 'IDLE' | 'BUSY' | 'ERROR',
  currentJobId?: string | null,
): Promise<void> {
  try {
    await api.heartbeat({
      hostname: runnerHostname,
      status,
      version: runnerVersion,
      currentJobId: currentJobId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Heartbeat warning: ${message}\n`);
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function selectValidatedContact(claim: ClaimedJob) {
  return claim.contacts
    .filter((contact) => contact.isValidated && !contact.isSuppressed)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
}

async function executeAmenSend(claim: ClaimedJob): Promise<Record<string, unknown>> {
  if (!sendingEnabled) {
    throw new Error('Real email sending is disabled');
  }

  if (emailProvider !== 'amen-smtp') {
    throw new Error(`${claim.job.kind} claimed with unsupported provider: ${emailProvider}`);
  }

  if (!amenConfigured) {
    throw new Error('Amen email credentials are not configured');
  }

  const contact = selectValidatedContact(claim);
  if (!contact) {
    throw new Error('No validated unsuppressed contact is available');
  }

  const message = claim.outreachDraft;
  if (!message || message.status !== 'VERIFIED') {
    throw new Error('No VERIFIED outreach message is available');
  }

  if (!message.subject?.trim() || !message.body_text?.trim()) {
    throw new Error('Verified outreach message is missing subject or body');
  }

  const result = await sendAmenEmail(loadAmenMailConfig(), {
    to: contact.email,
    subject: message.subject,
    text: message.body_text,
    inReplyTo:
      claim.job.kind === 'SEND_FOLLOW_UP'
        ? claim.threadParentMessageId ?? undefined
        : undefined,
    references:
      claim.job.kind === 'SEND_FOLLOW_UP' && claim.threadParentMessageId
        ? [claim.threadParentMessageId]
        : undefined,
  });

  return {
    provider: 'amen-smtp',
    providerMessageId: result.messageId,
    recipient: contact.email,
    accepted: result.accepted,
    rejected: result.rejected,
    deliveredExternally: result.accepted.length > 0,
  };
}

async function executeAgentJob(claim: ClaimedJob, jobDir: string): Promise<unknown> {
  const prompt = buildPrompt(claim);
  const raw = await runKimi({
    executable,
    cwd: jobDir,
    prompt,
    timeoutMs: 20 * 60_000,
    swarmMaxConcurrency,
  });

  return parseJsonOutput(raw);
}

async function runOne(): Promise<boolean> {
  const claim = await api.claim();
  if (!claim) return false;

  const jobDir = join(runnerRoot, claim.job.id);
  await mkdir(jobDir, { recursive: true });
  await heartbeat('BUSY', claim.job.id);

  const heartbeatTimer = setInterval(() => {
    void heartbeat('BUSY', claim.job.id);
  }, 15_000);

  try {
    const output =
      claim.job.kind === 'SEND_EMAIL' || claim.job.kind === 'SEND_FOLLOW_UP'
        ? await executeAmenSend(claim)
        : await executeAgentJob(claim, jobDir);

    await api.succeed(claim.job.id, output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await api.fail(claim.job.id, message);
  } finally {
    clearInterval(heartbeatTimer);
    await heartbeat('IDLE', null);
  }

  return true;
}

let inboxPollRunning = false;
let inboxCursor = new Date(Date.now() - 5 * 60_000);

async function pollAmenInbox(): Promise<void> {
  if (!amenConfigured || inboxPollRunning) return;

  inboxPollRunning = true;
  const since = new Date(inboxCursor.getTime() - 2 * 60_000);

  try {
    const messages = await fetchAmenInboxSince(loadAmenMailConfig(), since);
    const now = new Date();

    for (const message of messages) {
      if (!message.inReplyTo || !message.text.trim()) continue;

      await api.inboundEmail({
        inReplyToProviderMessageId: message.inReplyTo,
        providerMessageId: message.messageId,
        fromEmail: message.fromEmail,
        rawText: message.text,
        receivedAt: message.date,
      });
    }

    inboxCursor = now;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Amen inbox poll warning: ${message}\n`);
  } finally {
    inboxPollRunning = false;
  }
}

async function main(): Promise<void> {
  await mkdir(runnerRoot, { recursive: true });
  process.stdout.write(
    `Magic Script runner started. id=${runnerId} API=${baseUrl} workDir=${runnerRoot}\n`,
  );
  process.stdout.write(
    `Email provider=${emailProvider} sending=${sendingEnabled ? 'ENABLED' : 'DISABLED'} Amen IMAP=${amenConfigured ? 'READY' : 'NOT_CONFIGURED'}\n`,
  );

  await heartbeat('IDLE', null);

  if (amenConfigured) {
    void pollAmenInbox();
    setInterval(() => {
      void pollAmenInbox();
    }, inboxPollIntervalMs);
  }

  for (;;) {
    try {
      const worked = await runOne();
      if (!worked) {
        await heartbeat('IDLE', null);
        await sleep(pollIntervalMs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`Runner loop error: ${message}\n`);
      await heartbeat('ERROR', null);
      await sleep(Math.max(pollIntervalMs, 10_000));
    }
  }
}

await main();
