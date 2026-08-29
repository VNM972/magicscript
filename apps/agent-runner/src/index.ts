import { mkdir } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { MagicScriptApi } from './api';
import { runKimi, parseJsonOutput } from './kimi';
import { buildPrompt } from './prompts';

const baseUrl = process.env.MAGICSCRIPT_API_BASE_URL?.replace(/\/$/, '');
const runnerToken = process.env.MAGICSCRIPT_RUNNER_TOKEN;
const executable = process.env.KIMI_EXECUTABLE || 'kimi';
const pollIntervalMs =
  Number.parseInt(process.env.MAGICSCRIPT_POLL_INTERVAL_MS ?? '5000', 10) || 5000;
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
    const prompt = buildPrompt(claim);
    const raw = await runKimi({
      executable,
      cwd: jobDir,
      prompt,
      timeoutMs: 20 * 60_000,
      swarmMaxConcurrency,
    });
    const output = parseJsonOutput(raw);
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

async function main(): Promise<void> {
  await mkdir(runnerRoot, { recursive: true });
  process.stdout.write(
    `Magic Script runner started. id=${runnerId} API=${baseUrl} workDir=${runnerRoot}\n`,
  );
  await heartbeat('IDLE', null);

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
