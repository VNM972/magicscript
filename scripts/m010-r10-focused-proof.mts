import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtimeRoot = resolve(repositoryRoot, '.m010-final-runtime');
const runId = `m010-r10-focused-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const workspace = resolve(runtimeRoot, runId);
const persistDir = resolve(workspace, 'persist');
const setupFile = resolve(workspace, 'setup.sql');
const seedFile = resolve(workspace, 'seed.sql');
const artifactPath = resolve(runtimeRoot, `${runId}.json`);
const runnerPath = resolve(repositoryRoot, 'scripts/m010-final-acceptance.mts');
const apiConfig = resolve(repositoryRoot, 'apps/api-worker/wrangler.local.jsonc');
const apiCwd = resolve(repositoryRoot, 'apps/api-worker');
const apiPort = await allocateLoopbackPort();
const apiBase = `http://127.0.0.1:${apiPort}`;
const expectedWorkerVars = [
  'MAGICSCRIPT_DATABASE_PROVIDER:d1',
  'MAGICSCRIPT_EMAIL_PROVIDER:fake',
  'MAGICSCRIPT_FAKE_TRANSPORT:true',
  'MAGICSCRIPT_SENDING_ENABLED:true',
  'MAGICSCRIPT_TEST_EMAIL_MODE:true',
  'MAGICSCRIPT_TEST_RECIPIENT:bonjour@cafe-rivage.test',
  'MAGICSCRIPT_API_TOKEN:dev-api-token',
  'MAGICSCRIPT_RUNNER_TOKEN:dev-runner-token',
];
const env = {
  ...process.env,
  MAGICSCRIPT_DATABASE_PROVIDER: 'd1',
  MAGICSCRIPT_EMAIL_PROVIDER: 'fake',
  MAGICSCRIPT_API_TOKEN: 'dev-api-token',
  MAGICSCRIPT_RUNNER_TOKEN: 'dev-runner-token',
  MAGICSCRIPT_FAKE_TRANSPORT: 'true',
  MAGICSCRIPT_SENDING_ENABLED: 'true',
  MAGICSCRIPT_TEST_EMAIL_MODE: 'true',
  MAGICSCRIPT_TEST_RECIPIENT: 'bonjour@cafe-rivage.test',
  NEXT_PUBLIC_MAGICSCRIPT_API_BASE_URL: apiBase,
  NEXT_PUBLIC_MAGICSCRIPT_API_TOKEN: 'dev-api-token',
};
const sensitiveBindingNames = new Set(['MAGICSCRIPT_API_TOKEN', 'MAGICSCRIPT_RUNNER_TOKEN']);

function splitWorkerVar(value: string): [string, string] {
  const separator = value.indexOf(':');
  return separator < 0 ? [value, ''] : [value.slice(0, separator), value.slice(separator + 1)];
}

function maskedWorkerVars(values: string[]): string[] {
  return values.map((value) => {
    const [name, bindingValue] = splitWorkerVar(value);
    return `${name}:${sensitiveBindingNames.has(name) ? '[MASKED]' : bindingValue}`;
  });
}

function maskedBindings(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, sensitiveBindingNames.has(name) ? '[MASKED]' : value]));
}

function redactSensitive(text: string): string {
  let redacted = text.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [MASKED]');
  for (const workerVar of expectedWorkerVars) {
    const [name, value] = splitWorkerVar(workerVar);
    if (sensitiveBindingNames.has(name) && value) redacted = redacted.replaceAll(value, '[MASKED]');
  }
  return redacted;
}

function redactArgv(argv: string[]): string[] {
  return argv.map((value) => {
    const [name] = splitWorkerVar(value);
    return sensitiveBindingNames.has(name) ? `${name}:[MASKED]` : redactSensitive(value);
  });
}

type ProcessCapture = {
  command: string;
  argv: string[];
  cwd: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

const children = new Set<ChildProcess>();

function track(child: ChildProcess): ChildProcess {
  children.add(child);
  child.once('exit', () => {
    children.delete(child);
    child.stdout?.destroy();
    child.stderr?.destroy();
  });
  return child;
}

function waitExit(child: ChildProcess): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolveExit) => child.once('exit', (code, signal) => resolveExit({ code, signal })));
}

function collectStream(stream: NodeJS.ReadableStream | null): { read: () => string } {
  let value = '';
  stream?.setEncoding?.('utf8');
  stream?.on('data', (chunk) => { value += String(chunk); });
  return { read: () => value };
}

async function terminateChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    await waitExit(child);
    return;
  }
  if (process.platform === 'win32' && child.pid) {
    try {
      await execFileAsync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    } catch (error: any) {
      if (child.exitCode === null && child.signalCode === null && error?.code !== 128) throw error;
    }
  } else if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
  }
  await waitExit(child);
  child.stdout?.destroy();
  child.stderr?.destroy();
}

async function stopChildren(): Promise<void> {
  await Promise.all([...children].map((child) => terminateChild(child)));
}

async function removeWithWindowsRetry(path: string, cleanup: Record<string, unknown>): Promise<void> {
  const maxAttempts = 8;
  let transientErrors = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true });
      cleanup.deleteAttempts = attempt;
      cleanup.deleteTransientErrors = transientErrors;
      if (existsSync(path)) throw new Error(`Workspace still exists after deletion: ${path}`);
      return;
    } catch (error: any) {
      if (error?.code !== 'EBUSY' && error?.code !== 'EPERM') throw error;
      transientErrors += 1;
      if (attempt === maxAttempts) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 75 * attempt));
    }
  }
  throw new Error(`Workspace deletion exhausted retry budget: ${path}`);
}

function assertBoundedPaths(): void {
  assert.equal(repositoryRoot, 'D:\\MagicScript\\repository', 'Unexpected repository root');
  assert.ok(isAbsolute(runtimeRoot) && isAbsolute(workspace) && isAbsolute(persistDir), 'Runtime paths must be absolute');
  assert.equal(basename(runtimeRoot), '.m010-final-runtime', 'Unexpected runtime root');
  const workspaceRelative = relative(runtimeRoot, workspace);
  assert.ok(workspaceRelative.length > 0 && !workspaceRelative.startsWith(`..${sep}`) && !isAbsolute(workspaceRelative), 'Focused workspace escapes runtime root');
  assert.equal(dirname(artifactPath), runtimeRoot, 'Evidence artifact must be retained beside the transient workspace');
  for (const path of [persistDir, setupFile, seedFile]) {
    const childRelative = relative(workspace, path);
    assert.ok(childRelative.length > 0 && !childRelative.startsWith(`..${sep}`) && !isAbsolute(childRelative), `Transient path escapes focused workspace: ${path}`);
  }
}

async function allocateLoopbackPort(): Promise<number> {
  const server = createServer();
  try {
    await new Promise<void>((resolveReady, rejectReady) => {
      server.once('error', rejectReady);
      server.listen(0, '127.0.0.1', () => resolveReady());
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object', 'Loopback port allocation returned no address');
    return address.port;
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
}

function parseRunnerWorkerVars(source: string): string[] {
  const block = source.match(/const apiWorkerVars = \[([\s\S]*?)\]\.flatMap\(\(value\) => \['--var', value\]\);/);
  assert.ok(block, 'Current runner apiWorkerVars block was not found');
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function resolveWrangler(): { packageJson: string; version: string; cliPath: string } {
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve('wrangler/package.json');
  const packageRoot = resolve(packageJson, '..');
  const manifest = JSON.parse(readFileSync(packageJson, 'utf8')) as { version?: string; bin?: string | Record<string, string> };
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.wrangler;
  assert.ok(bin, 'Wrangler package does not expose its CLI');
  const cliPath = resolve(packageRoot, bin);
  assert.ok(cliPath.startsWith(`${repositoryRoot}${sep}`), 'Wrangler CLI is outside repository dependencies');
  assert.ok(existsSync(cliPath) && !cliPath.toLowerCase().endsWith('.cmd'), `Invalid Wrangler CLI path: ${cliPath}`);
  return { packageJson, version: manifest.version ?? 'unknown', cliPath };
}

async function runProcess(command: string, argv: string[], cwd: string): Promise<ProcessCapture> {
  const child = track(spawn(command, argv, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false }));
  const stdout = collectStream(child.stdout);
  const stderr = collectStream(child.stderr);
  const exit = await waitExit(child);
  return { command, argv: redactArgv(argv), cwd, code: exit.code, signal: exit.signal, stdout: redactSensitive(stdout.read()), stderr: redactSensitive(stderr.read()) };
}

function resultRows(raw: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.flatMap((part) => Array.isArray((part as any)?.results) ? (part as any).results : []);
  }
  return Array.isArray((parsed as any)?.results) ? (parsed as any).results : [];
}

async function waitForHttp(url: string, timeoutMs = 30_000): Promise<{ status: number; body: string }> {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      return { status: response.status, body: await response.text() };
    } catch (error) {
      lastError = String(error);
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw new Error(`HTTP readiness failed for ${url}: ${lastError}`);
}

function parseWranglerBindings(output: string, names: string[]): { status: 'CAPTURED' | 'NOT_PROVEN'; values: Record<string, string>; missing: string[] } {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, '');
  const values: Record<string, string> = {};
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = plain.match(new RegExp(`env\\.${escaped}\\s*\\(\\s*["']([^"']*)["']\\s*\\)`));
    if (match) values[name] = match[1];
  }
  const missing = names.filter((name) => values[name] === undefined);
  return { status: missing.length === 0 ? 'CAPTURED' : 'NOT_PROVEN', values, missing };
}

async function waitForWranglerBindings(read: () => string, names: string[], timeoutMs = 5_000): Promise<ReturnType<typeof parseWranglerBindings>> {
  const started = Date.now();
  let observed = parseWranglerBindings(read(), names);
  while (observed.status !== 'CAPTURED' && Date.now() - started < timeoutMs) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    observed = parseWranglerBindings(read(), names);
  }
  return observed;
}

async function main(): Promise<void> {
  const evidence: Record<string, any> = {
    status: 'NOT_RUN',
    runId,
    startedAt: new Date().toISOString(),
    paths: { repositoryRoot, runtimeRoot, workspace, persistDir, setupFile, seedFile, artifactPath, apiConfig },
    staticParity: { status: 'NOT_RUN' },
    port: { allocatedByOs: true, loopback: '127.0.0.1', value: apiPort },
    commands: [],
    directD1: { status: 'NOT_RUN' },
    http: { status: 'NOT_RUN', health: null, draftRead: null },
    worker: { status: 'NOT_RUN', process: null, stdout: '', stderr: '' },
    assertions: { status: 'NOT_RUN', passed: [], failed: [] },
    cleanup: { attempted: true, childrenTerminationRequested: false, childrenExited: false, d1OwningProcessesExited: false, workspaceRemoved: false, success: false },
  };
  let failure: unknown;
  let api: ChildProcess | undefined;
  let apiStdout: { read: () => string } | undefined;
  let apiStderr: { read: () => string } | undefined;
  try {
    assertBoundedPaths();
    await mkdir(workspace, { recursive: true });

    const runnerSource = await readFile(runnerPath, 'utf8');
    const runnerWorkerVars = parseRunnerWorkerVars(runnerSource);
    const startupLine = runnerSource.split(/\r?\n/).find((line) => line.includes("wranglerArgs(['dev'")) ?? '';
    const commandLine = runnerSource.split(/\r?\n/).find((line) => line.includes('track(spawn(name, args')) ?? '';
    assert.ok(runnerWorkerVars.length === expectedWorkerVars.length && runnerWorkerVars.every((value, index) => value === expectedWorkerVars[index]), 'Focused Worker bindings differ from the current runner');
    assert.ok(startupLine.includes('process.execPath') && startupLine.includes('--config') && startupLine.includes('--persist-to') && startupLine.includes('...apiWorkerVars') && startupLine.includes("resolve('apps/api-worker')"), 'Current runner startup shape changed');
    assert.ok(commandLine.includes('shell: false'), 'Current runner no longer launches with shell:false');
    const wrangler = resolveWrangler();
    assert.equal(wrangler.version, '4.127.1', 'Installed Wrangler version changed');
    const workerVarArgs = runnerWorkerVars.flatMap((value) => ['--var', value]);
    evidence.staticParity = { status: 'PASS', runnerPath, runnerShaSourceLength: runnerSource.length, runnerWorkerVars: maskedWorkerVars(runnerWorkerVars), expectedWorkerVars: maskedWorkerVars(expectedWorkerVars), startupLine: redactSensitive(startupLine.trim()), commandLine: commandLine.trim(), wrangler };

    const configText = await readFile(apiConfig, 'utf8');
    const binding = configText.match(/"binding"\s*:\s*"([^"]+)"/)?.[1] ?? '';
    const databaseName = configText.match(/"database_name"\s*:\s*"([^"]+)"/)?.[1] ?? '';
    assert.equal(binding, 'DB', 'Unexpected D1 binding');
    assert.ok(databaseName, 'D1 database name is missing');
    const setupSql = `${await readFile(resolve(repositoryRoot, 'database/schema.sql'), 'utf8')}\n${await readFile(resolve(repositoryRoot, 'database/migration-v2-proposal-v1.sql'), 'utf8')}\n${await readFile(resolve(repositoryRoot, 'database/migration-v2-outreach-draft-v1.sql'), 'utf8')}\n`;
    const now = '2030-01-01T00:00:00.000Z';
    const seedSql = `PRAGMA foreign_keys=ON;
INSERT INTO prospects (id,company_name,city,activity,location,phone,state,primary_friction,primary_asset,created_at,updated_at) VALUES ('prospect-email','Café Rivage','Fort-de-France','Restaurant','Fort-de-France','+596696000001','PROPOSAL_READY','Réservation dispersée','Réservation directe','${now}','${now}');
INSERT INTO contacts (id,prospect_id,email,is_validated,is_suppressed,created_at,updated_at) VALUES ('contact-email','prospect-email','bonjour@cafe-rivage.test',1,0,'${now}','${now}');
INSERT INTO v2_design_requests (id,prospect_id,version,pack_id,request_json,created_at) VALUES ('request-email','prospect-email','DESIGN_REQUEST_V1','pack-email','{}','${now}');
INSERT INTO v2_design_artifacts (id,design_request_id,prospect_id,version,revision,vertical,artifact_json,status,created_at,updated_at) VALUES ('design-email','request-email','prospect-email','DESIGN_ARTIFACT_V1',1,'Restaurant','{}','APPROVED','${now}','${now}');
INSERT INTO v2_build_artifacts (id,build_version,design_artifact_id,design_request_id,prospect_id,approved_revision,builder_version,source_path,output_path,status,artifact_json,created_at,completed_at,updated_at) VALUES ('build-email','v1','design-email','request-email','prospect-email',1,'builder','/tmp/source','/tmp/output','COMPLETED','{}','${now}','${now}','${now}');
INSERT INTO v2_proposals (id,canonical_key,prospect_id,build_artifact_id,token,status,proposal_json,created_at) VALUES ('proposal-email','canonical-email','prospect-email','build-email','email','PROPOSAL_READY','{"id":"proposal-email","version":"PROPOSAL_V1","prospectId":"prospect-email","designRequestId":"request-email","approvedDesignArtifactId":"design-email","approvedDesignRevision":1,"buildArtifactId":"build-email","buildRevision":1,"visualQaReportId":"qa-email","token":"email","entryPath":"/p/email","status":"PROPOSAL_READY","createdAt":"${now}","booking":{"availabilityPath":"/availability","bookingPath":"/booking"},"tracking":{"sessionCookie":"s","events":[]}}','${now}');
`;
    await writeFile(setupFile, setupSql, 'utf8');
    await writeFile(seedFile, seedSql, 'utf8');

    const baseD1Args = ['d1', 'execute', binding, '--local', '--persist-to', persistDir, '--config', apiConfig];
    const setup = await runProcess(process.execPath, [wrangler.cliPath, ...baseD1Args, '--file', setupFile, '--yes'], repositoryRoot);
    evidence.commands.push({ stage: 'setup', ...setup });
    assert.equal(setup.code, 0, `D1 setup failed: ${setup.stderr || setup.stdout}`);
    const seed = await runProcess(process.execPath, [wrangler.cliPath, ...baseD1Args, '--file', seedFile, '--yes'], repositoryRoot);
    evidence.commands.push({ stage: 'seed', ...seed });
    assert.equal(seed.code, 0, `D1 seed failed: ${seed.stderr || seed.stdout}`);
    const directSql = "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='v2_outreach_drafts') AS drafts_table_exists, (SELECT COUNT(*) FROM v2_proposals WHERE id='proposal-email') AS proposal_email_count, (SELECT COUNT(*) FROM v2_outreach_drafts) AS draft_count;";
    const direct = await runProcess(process.execPath, [wrangler.cliPath, ...baseD1Args, '--command', directSql, '--json'], repositoryRoot);
    evidence.commands.push({ stage: 'direct-query', ...direct });
    assert.equal(direct.code, 0, `D1 direct query failed: ${direct.stderr || direct.stdout}`);
    const rows = resultRows(direct.stdout);
    evidence.directD1 = { status: 'CAPTURED', binding, databaseName, persistDir, sql: directSql, rows, rawStdout: direct.stdout, rawStderr: direct.stderr };
    assert.equal(Number(rows[0]?.drafts_table_exists), 1, 'v2_outreach_drafts is missing');
    assert.equal(Number(rows[0]?.proposal_email_count), 1, 'proposal-email is missing');
    assert.equal(Number(rows[0]?.draft_count), 0, 'Focused database is not draft-fresh');

    const apiArgv = [wrangler.cliPath, 'dev', '--config', apiConfig, '--persist-to', persistDir, '--port', String(apiPort), '--ip', '127.0.0.1', ...workerVarArgs];
    const configuredBindings = Object.fromEntries(runnerWorkerVars.map(splitWorkerVar));
    evidence.worker = { status: 'STARTING', command: process.execPath, argv: redactArgv(apiArgv), cwd: apiCwd, config: apiConfig, persistDir, configuredBindings: maskedBindings(configuredBindings), observedBindings: { status: 'NOT_PROVEN', values: {}, missing: [] }, process: null, stdout: '', stderr: '' };
    api = track(spawn(process.execPath, apiArgv, { cwd: apiCwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false }));
    apiStdout = collectStream(api.stdout);
    apiStderr = collectStream(api.stderr);
    evidence.worker.process = { pid: api.pid ?? null, exitCodeBeforeRequests: api.exitCode, signalBeforeRequests: api.signalCode };

    const health = await waitForHttp(`${apiBase}/health`);
    const draftResponse = await fetch(`${apiBase}/api/v2/outreach/drafts/by-proposal/proposal-email?channel=EMAIL`, { headers: { authorization: 'Bearer dev-api-token' } });
    const draftBody = await draftResponse.text();
    evidence.http = { status: 'CAPTURED', health: { url: `${apiBase}/health`, status: health.status, body: health.body }, draftRead: { url: `${apiBase}/api/v2/outreach/drafts/by-proposal/proposal-email?channel=EMAIL`, status: draftResponse.status, body: draftBody } };
    const requiredBindingNames = expectedWorkerVars.map((value) => splitWorkerVar(value)[0]);
    const observedBindings = await waitForWranglerBindings(
      () => `${apiStdout?.read() ?? ''}\n${apiStderr?.read() ?? ''}`,
      requiredBindingNames,
    );
    evidence.worker.stdout = redactSensitive(apiStdout.read());
    evidence.worker.stderr = redactSensitive(apiStderr.read());
    evidence.worker.observedBindings = {
      status: observedBindings.status,
      names: Object.keys(observedBindings.values),
      displayedValues: maskedBindings(observedBindings.values),
      missing: observedBindings.missing,
    };
    evidence.worker.status = 'CAPTURED';

    const healthJson = JSON.parse(health.body) as Record<string, unknown>;
    const draftJson = JSON.parse(draftBody) as unknown;
    const bindingNameChecks: Array<[string, () => void]> = requiredBindingNames.map((name) => [
      `Wrangler observed ${name} binding name`,
      () => assert.ok(Object.hasOwn(observedBindings.values, name)),
    ]);
    const checks: Array<[string, () => void]> = [
      ['Wrangler observed all eight required binding names', () => assert.equal(observedBindings.status, 'CAPTURED')],
      ...bindingNameChecks,
      ['health HTTP status is 200', () => assert.equal(health.status, 200)],
      ['health database binding is configured', () => assert.equal(healthJson.databaseConfigured, true)],
      ['health API authentication is configured', () => assert.equal(healthJson.apiAuthConfigured, true)],
      ['health runner authentication is configured', () => assert.equal(healthJson.runnerAuthConfigured, true)],
      ['health email provider is fake', () => assert.equal(healthJson.emailProvider, 'fake')],
      ['health fake transport is enabled', () => assert.equal(healthJson.fakeTransportEnabled, true)],
      ['health sending is enabled', () => assert.equal(healthJson.sendingEnabled, true)],
      ['health test email mode is enabled', () => assert.equal(healthJson.testEmailMode, true)],
      ['health test recipient is configured', () => assert.equal(healthJson.testRecipientConfigured, true)],
      ['health outbound mode is fake', () => assert.equal(healthJson.effectiveOutboundMode, 'fake')],
      ['draft read HTTP status is 200', () => assert.equal(draftResponse.status, 200)],
      ['draft read is JSON null', () => assert.equal(draftJson, null)],
    ];
    evidence.assertions.status = 'RUNNING';
    for (const [name, check] of checks) {
      try {
        check();
        evidence.assertions.passed.push(name);
      } catch (error) {
        evidence.assertions.failed.push({ name, error: String(error) });
      }
    }
    evidence.assertions.status = evidence.assertions.failed.length === 0 ? 'PASS' : 'FAIL';
    assert.equal(evidence.assertions.failed.length, 0, `Focused assertions failed: ${evidence.assertions.failed.map((item: any) => item.name).join(', ')}`);
  } catch (error) {
    failure = error;
    evidence.error = String(error);
  } finally {
    evidence.cleanup.childrenTerminationRequested = children.size > 0;
    try {
      await stopChildren();
      evidence.cleanup.childrenExited = children.size === 0;
      evidence.cleanup.d1OwningProcessesExited = children.size === 0;
      if (api) {
        evidence.worker.process = { ...(evidence.worker.process ?? {}), exitCodeAfterStop: api.exitCode, signalAfterStop: api.signalCode };
      }
      evidence.worker.stdout = apiStdout ? redactSensitive(apiStdout.read()) : evidence.worker.stdout;
      evidence.worker.stderr = apiStderr ? redactSensitive(apiStderr.read()) : evidence.worker.stderr;
      assertBoundedPaths();
      await removeWithWindowsRetry(workspace, evidence.cleanup);
      evidence.cleanup.workspaceRemoved = !existsSync(workspace);
      evidence.cleanup.success = evidence.cleanup.childrenExited && evidence.cleanup.d1OwningProcessesExited && evidence.cleanup.workspaceRemoved;
      if (!evidence.cleanup.success) throw new Error('Focused cleanup verification failed');
    } catch (cleanupError) {
      evidence.cleanup.success = false;
      evidence.cleanup.error = String(cleanupError);
      failure ??= cleanupError;
    }
    evidence.completedAt = new Date().toISOString();
    evidence.status = !failure && evidence.assertions.status === 'PASS' && evidence.cleanup.success ? 'PASS' : 'FAIL';
    await mkdir(runtimeRoot, { recursive: true });
    await writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ status: evidence.status, artifactPath, failedAssertions: evidence.assertions.failed, cleanup: evidence.cleanup }));
  }
  if (failure) throw failure;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
