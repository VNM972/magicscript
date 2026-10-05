import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve('artifacts/v2/outreach');
const artifactPath = join(root, 'm010-health-diagnostic.json');
const persistDir = resolve('.m010-health-d1');
const apiConfig = resolve('apps/api-worker/wrangler.local.jsonc');
const apiPort = 8787;
const apiUrl = `http://127.0.0.1:${apiPort}/health`;
const cwd = resolve('apps/api-worker');
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = [
  'wrangler',
  'dev',
  '--config',
  apiConfig,
  '--persist-to',
  persistDir,
  '--port',
  String(apiPort),
  '--ip',
  '127.0.0.1',
  '--var',
  'MAGICSCRIPT_EMAIL_PROVIDER:fake',
];

const modeEnv = {
  MAGICSCRIPT_DATABASE_PROVIDER: 'd1',
  MAGICSCRIPT_EMAIL_PROVIDER: 'fake',
  MAGICSCRIPT_SENDING_ENABLED: 'true',
  MAGICSCRIPT_FAKE_TRANSPORT: 'true',
  MAGICSCRIPT_TEST_EMAIL_MODE: 'true',
  MAGICSCRIPT_TEST_RECIPIENT_CONFIGURED: true,
  MAGICSCRIPT_API_TOKEN_CONFIGURED: true,
  MAGICSCRIPT_RUNNER_TOKEN_CONFIGURED: true,
  NEXT_PUBLIC_MAGICSCRIPT_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
};

function redact(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(MAGICSCRIPT_API_TOKEN|MAGICSCRIPT_RUNNER_TOKEN|MAGICSCRIPT_TEST_RECIPIENT|[A-Z0-9_]*(?:KEY|SECRET|PASSWORD|TOKEN))=\S+/g, '$1=[REDACTED]')
    .replace(/bonjour@cafe-rivage\.test/gi, '[REDACTED-TEST-RECIPIENT]');
}

function collect(stream: NodeJS.ReadableStream | null): { value: () => string } {
  let text = '';
  stream?.setEncoding?.('utf8');
  stream?.on('data', (chunk) => { text += String(chunk); });
  return { value: () => redact(text).slice(-12000) };
}

function waitForExit(child: ChildProcess): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolveExit) => child.once('exit', (code, signal) => resolveExit({ code, signal })));
}

async function waitHealth(timeoutMs = 30000): Promise<{ status: number; body: string } | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(apiUrl);
      return { status: response.status, body: await response.text() };
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  return null;
}

async function stop(child: ChildProcess | undefined): Promise<{ code: number | null; signal: NodeJS.Signals | null } | null> {
  if (!child) return null;
  if (child.exitCode !== null || child.signalCode !== null) return { code: child.exitCode, signal: child.signalCode };
  child.kill();
  return await Promise.race([
    waitForExit(child),
    new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit) => setTimeout(() => resolveExit({ code: child.exitCode, signal: child.signalCode }), 3000)),
  ]);
}

async function main(): Promise<void> {
  await mkdir(root, { recursive: true });
  let api: ChildProcess | undefined;
  let result: Record<string, unknown>;
  const startedAt = new Date().toISOString();
  const startup = { command, args, cwd, config: apiConfig, persistDir, apiUrl, modeEnv };
  try {
    api = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        MAGICSCRIPT_DATABASE_PROVIDER: 'd1',
        MAGICSCRIPT_EMAIL_PROVIDER: 'fake',
        MAGICSCRIPT_API_TOKEN: 'dev-api-token',
        MAGICSCRIPT_RUNNER_TOKEN: 'dev-runner-token',
        MAGICSCRIPT_FAKE_TRANSPORT: 'true',
        MAGICSCRIPT_SENDING_ENABLED: 'true',
        MAGICSCRIPT_TEST_EMAIL_MODE: 'true',
        MAGICSCRIPT_TEST_RECIPIENT: 'bonjour@cafe-rivage.test',
        NEXT_PUBLIC_MAGICSCRIPT_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
        NEXT_PUBLIC_MAGICSCRIPT_API_TOKEN: 'dev-api-token',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32',
    });
    const stdout = collect(api.stdout);
    const stderr = collect(api.stderr);
    const health = await waitHealth();
    const processBeforeCleanup = { code: api.exitCode, signal: api.signalCode };
    const stopped = await stop(api);
    result = {
      status: health?.status === 200 ? 'PASS' : health ? 'BLOCKED' : 'FAIL',
      startedAt,
      healthHttpStatus: health?.status ?? null,
      healthBody: health?.body ?? null,
      stdout: stdout.value(),
      stderr: stderr.value(),
      processExitCode: stopped?.code ?? processBeforeCleanup.code,
      processSignal: stopped?.signal ?? processBeforeCleanup.signal,
      startup,
      cleanup: { attempted: true, persistenceRemoved: false },
    };
    await rm(persistDir, { recursive: true, force: true });
    (result.cleanup as Record<string, unknown>).persistenceRemoved = true;
  } catch (error) {
    const stopped = await stop(api);
    result = {
      status: 'FAIL',
      startedAt,
      healthHttpStatus: null,
      healthBody: null,
      stdout: '',
      stderr: '',
      processExitCode: stopped?.code ?? api?.exitCode ?? null,
      processSignal: stopped?.signal ?? api?.signalCode ?? null,
      startup,
      error: redact(error instanceof Error ? error.message : String(error)),
      cleanup: { attempted: true, persistenceRemoved: false },
    };
    await rm(persistDir, { recursive: true, force: true });
    (result.cleanup as Record<string, unknown>).persistenceRemoved = true;
  }
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(redact(error instanceof Error ? error.message : String(error))); process.exitCode = 1; });
