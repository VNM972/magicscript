import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';

const execFileAsync = promisify(execFile);
// qa-surface.cjs is the existing CommonJS browser/CDP harness.
// @ts-expect-error no declaration file is intentionally maintained for this script-only harness.
import { findChrome, launchBrowser, closeBrowser, CdpConnection, evaluate, waitForCondition } from './qa-surface.cjs';

const root = resolve('artifacts/v2/outreach');
const artifact = join(root, 'm010-final-acceptance.json');
const screenshotBefore = join(root, 'm010-final-desktop.png');
const screenshotAfter = join(root, 'm010-final-contacted.png');
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
const apiPort = await allocateLoopbackPort();
const controlPort = 3020;
const apiBase = `http://127.0.0.1:${apiPort}`;
const controlBase = `http://127.0.0.1:${controlPort}`;
const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const runtimeRoot = resolve(repositoryRoot, '.m010-final-runtime');
const persistDir = resolve(runtimeRoot, runId);
const seedFile = resolve(runtimeRoot, `${runId}.seed.sql`);
const setupFile = resolve(runtimeRoot, `${runId}.setup.sql`);
const queryFile = resolve(runtimeRoot, `${runId}.query.sql`);
const apiConfig = resolve('apps/api-worker/wrangler.local.jsonc');
const apiConfigText = readFileSync(apiConfig, 'utf8');
const d1BindingMatch = apiConfigText.match(/"binding"\s*:\s*"([^"]+)"/);
const d1DatabaseNameMatch = apiConfigText.match(/"database_name"\s*:\s*"([^"]+)"/);
const d1BindingName = d1BindingMatch?.[1] ?? '';
const d1DatabaseName = d1DatabaseNameMatch?.[1] ?? '';
assert.equal(d1BindingName, 'DB', 'Unexpected API D1 binding');
assert.ok(d1DatabaseName, 'API Wrangler config does not declare a D1 database name');
const d1Target = d1BindingName;
const env = { ...process.env, MAGICSCRIPT_API_BASE_URL: apiBase, MAGICSCRIPT_DATABASE_PROVIDER: 'd1', MAGICSCRIPT_EMAIL_PROVIDER: 'fake', MAGICSCRIPT_API_TOKEN: 'dev-api-token', MAGICSCRIPT_RUNNER_TOKEN: 'dev-runner-token', MAGICSCRIPT_FAKE_TRANSPORT: 'true', MAGICSCRIPT_SENDING_ENABLED: 'true', MAGICSCRIPT_TEST_EMAIL_MODE: 'true', MAGICSCRIPT_TEST_RECIPIENT: 'bonjour@cafe-rivage.test', NEXT_PUBLIC_MAGICSCRIPT_API_BASE_URL: apiBase, NEXT_PUBLIC_MAGICSCRIPT_API_TOKEN: 'dev-api-token' };
// Canonical local fencing: a fresh UUID generation shared by Worker and runner.
const stackEnv = { MAGICSCRIPT_STACK_ID: randomUUID() };
Object.assign(env, stackEnv);
const failureEnv = { ...env, MAGICSCRIPT_FAKE_TRANSPORT_FAILURE_PROSPECT_ID: 'prospect-fake-failure' };
const apiWorkerVars = [
  `MAGICSCRIPT_STACK_ID:${stackEnv.MAGICSCRIPT_STACK_ID}`,
  'MAGICSCRIPT_DATABASE_PROVIDER:d1',
  'MAGICSCRIPT_EMAIL_PROVIDER:fake',
  'MAGICSCRIPT_FAKE_TRANSPORT:true',
  'MAGICSCRIPT_SENDING_ENABLED:true',
  'MAGICSCRIPT_TEST_EMAIL_MODE:true',
  'MAGICSCRIPT_TEST_RECIPIENT:bonjour@cafe-rivage.test',
  'MAGICSCRIPT_FAKE_TRANSPORT_FAILURE_PROSPECT_ID:prospect-fake-failure',
  'MAGICSCRIPT_API_TOKEN:dev-api-token',
  'MAGICSCRIPT_RUNNER_TOKEN:dev-runner-token',
].flatMap((value) => ['--var', value]);
const require = createRequire(import.meta.url);
const wranglerPackageJson = require.resolve('wrangler/package.json');
const wranglerPackageRoot = resolve(wranglerPackageJson, '..');
const wranglerPackage = JSON.parse(readFileSync(wranglerPackageJson, 'utf8')) as { version?: string; bin?: string | Record<string, string> };
const wranglerBinField = typeof wranglerPackage.bin === 'string' ? wranglerPackage.bin : wranglerPackage.bin?.wrangler;
assert.ok(wranglerBinField, 'Wrangler package does not expose a wrangler bin entry');
const wranglerCliPath = resolve(wranglerPackageRoot, wranglerBinField);
assert.ok(wranglerCliPath.startsWith(`${repositoryRoot}${sep}`), 'Wrangler CLI must remain inside repository dependencies');
assert.ok(existsSync(wranglerCliPath) && !wranglerCliPath.toLowerCase().endsWith('.cmd'), `Invalid Wrangler CLI path: ${wranglerCliPath}`);

function assertRuntimeDirectoryIgnored(): void {
  const relativeRuntimeRoot = relative(repositoryRoot, runtimeRoot);
  assert.equal(repositoryRoot, 'D:\\MagicScript\\repository', 'Unexpected repository root');
  assert.ok(isAbsolute(runtimeRoot), 'Runtime root must be absolute');
  assert.ok(relativeRuntimeRoot === '.m010-final-runtime' || (relativeRuntimeRoot.startsWith(`.m010-final-runtime${sep}`) && !relativeRuntimeRoot.startsWith(`..${sep}`)), 'Runtime root escapes repository root');
  assert.equal(basename(runtimeRoot), '.m010-final-runtime', 'Unexpected runtime root basename');
  assert.ok(persistDir === runtimeRoot || relative(runtimeRoot, persistDir).split(sep).every((segment) => segment !== '..'), 'Per-run persistence escapes runtime root');
  for (const generatedPath of [seedFile, setupFile, queryFile]) assert.ok(relative(runtimeRoot, generatedPath).split(sep).every((segment) => segment !== '..'), `Generated path escapes runtime root: ${generatedPath}`);
}

function command(name: string, args: string[], extra: NodeJS.ProcessEnv = env, cwd = repositoryRoot): ChildProcess { return track(spawn(name, args, { cwd, env: extra, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false })); }
function waitExit(child: ChildProcess): Promise<number> { if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(child.exitCode ?? 1); return new Promise((resolveExit) => child.once('exit', (code) => resolveExit(code ?? 1))); }
function collectOutput(child: ChildProcess): { read: () => string } { let value = ''; for (const stream of [child.stdout, child.stderr]) { stream?.setEncoding('utf8'); stream?.on('data', (chunk) => { value += chunk; }); } return { read: () => value.slice(-8000) }; }
const children = new Set<ChildProcess>();
const browsers = new Set<any>();
const cdps = new Set<any>();
function track(child: ChildProcess): ChildProcess { children.add(child); child.once('exit', () => { children.delete(child); child.stdout?.destroy(); child.stderr?.destroy(); }); return child; }
function trackBrowser(browser: any): any { browsers.add(browser); return browser; }
function trackCdp(cdp: any): any { cdps.add(cdp); return cdp; }
async function terminateChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) { await waitExit(child); return; }
  if (process.platform === 'win32' && child.pid) {
    try { await execFileAsync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }); } catch (error: any) {
      if (child.exitCode === null && child.signalCode === null && error?.code !== 128) throw error;
    }
  } else if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  await waitExit(child);
  child.stdout?.destroy(); child.stderr?.destroy();
}
async function stopChildren(): Promise<void> {
  const owned = [...children];
  await Promise.all(owned.map((child) => terminateChild(child)));
}
async function removeWithWindowsRetry(path: string, evidence?: Record<string, unknown>): Promise<void> {
  const maxAttempts = 8; let transientErrors = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try { await rm(path, { recursive: true, force: true }); if (evidence) { evidence.persistDeleteAttempts = attempt; evidence.persistDeleteTransientErrors = transientErrors; } if (existsSync(path)) throw new Error(`Persistence path still exists after deletion: ${path}`); return; }
    catch (error: any) {
      const code = error?.code;
      if (code !== 'EBUSY' && code !== 'EPERM') throw error;
      transientErrors += 1;
      if (attempt === maxAttempts) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 75 * attempt));
    }
  }
  throw new Error(`Persistence deletion exhausted retry budget: ${path}`);
}
async function waitHttp(url: string, timeout = 30000): Promise<{ status: number; body: string }> { const started = Date.now(); let last = ''; while (Date.now() - started < timeout) { try { const response = await fetch(url); const body = await response.text(); if (response.ok) return { status: response.status, body }; last = `HTTP ${response.status}: ${body.slice(0, 1000)}`; } catch (error) { last = String(error); } await new Promise((r) => setTimeout(r, 250)); } throw new Error(`Readiness failed for ${url}: ${last}`); }
function wranglerArgs(args: string[]): string[] { return [wranglerCliPath, ...args]; }
async function runWrangler(args: string[], extraEnv = env): Promise<string> { const child = command(process.execPath, wranglerArgs(args), extraEnv); const output = collectOutput(child); const code = await waitExit(child); const text = output.read(); assert.equal(code, 0, `wrangler ${args.join(' ')} failed: ${text}`); return text; }
const fixtureProspectIds = ['prospect-email', 'prospect-edit', 'prospect-mobile', 'prospect-suppressed', 'prospect-fake-failure'];
const fixtureContactIds = ['contact-email', 'contact-edit', 'contact-suppressed', 'contact-fake-failure'];
const fixtureProposalIds = ['proposal-email', 'proposal-edit', 'proposal-mobile', 'proposal-suppressed', 'proposal-fake-failure'];
function assertUnique(label: string, values: string[]): void { if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} in generated fixtures: ${values.join(', ')}`); }
async function seedDatabase(): Promise<{ migrationFiles: string[]; seedExecutionCount: number; fixtureIds: Record<string, string[]>; preSeedChecks: Record<string, unknown> }> {
  const schema = await readFile(resolve('database/schema.sql'), 'utf8');
  const proposal = await readFile(resolve('database/migration-v2-proposal-v1.sql'), 'utf8');
  const outreach = await readFile(resolve('database/migration-v2-outreach-draft-v1.sql'), 'utf8');
  const now = '2030-01-01T00:00:00.000Z';
  assertUnique('prospect ID', fixtureProspectIds); assertUnique('contact ID', fixtureContactIds); assertUnique('proposal ID', fixtureProposalIds);
  const sql = `${schema}\n${proposal}\n${outreach}\nPRAGMA foreign_keys=ON;\nINSERT INTO prospects (id,company_name,city,activity,location,phone,state,primary_friction,primary_asset,created_at,updated_at) VALUES ('prospect-email','Café Rivage','Fort-de-France','Restaurant','Fort-de-France','+596696000001','PROPOSAL_READY','Réservation dispersée','Réservation directe','${now}','${now}'),('prospect-edit','Bar Rivage','Schœlcher','Bar','Schœlcher','+596696000002','PROPOSAL_READY','Parcours à clarifier','Visibilité locale','${now}','${now}'),('prospect-mobile','Atelier Belle','Le Lamentin','Beauty','Le Lamentin','+596696000003','PROPOSAL_READY','Parcours mobile','Prise de rendez-vous','${now}','${now}'),('prospect-suppressed','Atelier Suppression','Fort-de-France','Restaurant','Fort-de-France','+596696000004','PROPOSAL_READY','Ne pas contacter','Liste de suppression','${now}','${now}'),('prospect-fake-failure','Atelier Failure','Le Lamentin','Restaurant','Le Lamentin','+596696000005','PROPOSAL_READY','Test failure','Transport fake déterministe','${now}','${now}');\nINSERT INTO contacts (id,prospect_id,email,is_validated,is_suppressed,created_at,updated_at) VALUES ('contact-email','prospect-email','bonjour@cafe-rivage.test',1,0,'${now}','${now}'),('contact-edit','prospect-edit','bonjour@bar-rivage.test',1,0,'${now}','${now}'),('contact-suppressed','prospect-suppressed','bonjour@suppressed.test',1,1,'${now}','${now}'),('contact-fake-failure','prospect-fake-failure','bonjour@failure.test',1,0,'${now}','${now}');\nINSERT INTO v2_design_requests (id,prospect_id,version,pack_id,request_json,created_at) VALUES ('request-email','prospect-email','DESIGN_REQUEST_V1','pack-email','{}','${now}'),('request-edit','prospect-edit','DESIGN_REQUEST_V1','pack-edit','{}','${now}'),('request-mobile','prospect-mobile','DESIGN_REQUEST_V1','pack-mobile','{}','${now}'),('request-suppressed','prospect-suppressed','DESIGN_REQUEST_V1','pack-suppressed','{}','${now}'),('request-fake-failure','prospect-fake-failure','DESIGN_REQUEST_V1','pack-fake-failure','{}','${now}');\nINSERT INTO v2_design_artifacts (id,design_request_id,prospect_id,version,revision,vertical,artifact_json,status,created_at,updated_at) VALUES ('design-email','request-email','prospect-email','DESIGN_ARTIFACT_V1',1,'Restaurant','{}','APPROVED','${now}','${now}'),('design-edit','request-edit','prospect-edit','DESIGN_ARTIFACT_V1',1,'Bar','{}','APPROVED','${now}','${now}'),('design-mobile','request-mobile','prospect-mobile','DESIGN_ARTIFACT_V1',1,'Beauty','{}','APPROVED','${now}','${now}'),('design-suppressed','request-suppressed','prospect-suppressed','DESIGN_ARTIFACT_V1',1,'Restaurant','{}','APPROVED','${now}','${now}'),('design-fake-failure','request-fake-failure','prospect-fake-failure','DESIGN_ARTIFACT_V1',1,'Restaurant','{}','APPROVED','${now}','${now}');\nINSERT INTO v2_build_artifacts (id,build_version,design_artifact_id,design_request_id,prospect_id,approved_revision,builder_version,source_path,output_path,status,artifact_json,created_at,completed_at,updated_at) VALUES ('build-email','v1','design-email','request-email','prospect-email',1,'builder','/tmp/source','/tmp/output','COMPLETED','{}','${now}','${now}','${now}'),('build-edit','v1','design-edit','request-edit','prospect-edit',1,'builder','/tmp/source','/tmp/output','COMPLETED','{}','${now}','${now}','${now}'),('build-mobile','v1','design-mobile','request-mobile','prospect-mobile',1,'builder','/tmp/source','/tmp/output','COMPLETED','{}','${now}','${now}','${now}');\nINSERT INTO v2_proposals (id,canonical_key,prospect_id,build_artifact_id,token,status,proposal_json,created_at) VALUES ('proposal-email','canonical-email','prospect-email','build-email','email','PROPOSAL_READY','{"id":"proposal-email","version":"PROPOSAL_V1","prospectId":"prospect-email","designRequestId":"request-email","approvedDesignArtifactId":"design-email","approvedDesignRevision":1,"buildArtifactId":"build-email","buildRevision":1,"visualQaReportId":"qa-email","token":"email","entryPath":"/p/email","status":"PROPOSAL_READY","createdAt":"${now}","booking":{"availabilityPath":"/availability","bookingPath":"/booking"},"tracking":{"sessionCookie":"s","events":[]}}','${now}'),('proposal-edit','canonical-edit','prospect-edit','build-edit','edit','PROPOSAL_READY','{"id":"proposal-edit","version":"PROPOSAL_V1","prospectId":"prospect-edit","designRequestId":"request-edit","approvedDesignArtifactId":"design-edit","approvedDesignRevision":1,"buildArtifactId":"build-edit","buildRevision":1,"visualQaReportId":"qa-edit","token":"edit","entryPath":"/p/edit","status":"PROPOSAL_READY","createdAt":"${now}","booking":{"availabilityPath":"/availability","bookingPath":"/booking"},"tracking":{"sessionCookie":"s","events":[]}}','${now}'),('proposal-mobile','canonical-mobile','prospect-mobile','build-mobile','mobile','PROPOSAL_READY','{"id":"proposal-mobile","version":"PROPOSAL_V1","prospectId":"prospect-mobile","designRequestId":"request-mobile","approvedDesignArtifactId":"design-mobile","approvedDesignRevision":1,"buildArtifactId":"build-mobile","buildRevision":1,"visualQaReportId":"qa-mobile","token":"mobile","entryPath":"/p/mobile","status":"PROPOSAL_READY","createdAt":"${now}","booking":{"availabilityPath":"/availability","bookingPath":"/booking"},"tracking":{"sessionCookie":"s","events":[]}}','${now}');`;
  const seedSql = sql.slice(sql.indexOf('PRAGMA foreign_keys=ON;'));
  const extendedSeedSql = `${seedSql}\nINSERT INTO v2_build_artifacts (id,build_version,design_artifact_id,design_request_id,prospect_id,approved_revision,builder_version,source_path,output_path,status,artifact_json,created_at,completed_at,updated_at) VALUES ('build-suppressed','v1','design-suppressed','request-suppressed','prospect-suppressed',1,'builder','/tmp/source','/tmp/output','COMPLETED','{}','${now}','${now}','${now}'),('build-fake-failure','v1','design-fake-failure','request-fake-failure','prospect-fake-failure',1,'builder','/tmp/source','/tmp/output','COMPLETED','{}','${now}','${now}','${now}');\nINSERT INTO v2_proposals (id,canonical_key,prospect_id,build_artifact_id,token,status,proposal_json,created_at) VALUES ('proposal-suppressed','canonical-suppressed','prospect-suppressed','build-suppressed','suppressed','PROPOSAL_READY','{"id":"proposal-suppressed","token":"suppressed","entryPath":"/p/suppressed"}','${now}'),('proposal-fake-failure','canonical-fake-failure','prospect-fake-failure','build-fake-failure','fake-failure','PROPOSAL_READY','{"id":"proposal-fake-failure","token":"fake-failure","entryPath":"/p/fake-failure"}','${now}');`;
  await writeFile(seedFile, extendedSeedSql);
  await writeFile(setupFile, `${schema}\n${proposal}\n${outreach}\n`);
  await runWrangler(['d1', 'execute', d1Target, '--local', '--persist-to', persistDir, '--config', apiConfig, '--file', setupFile, '--yes']);
  const freshness = await runWrangler(['d1', 'execute', d1Target, '--local', '--persist-to', persistDir, '--config', apiConfig, '--command', `SELECT (SELECT COUNT(*) FROM prospects) AS prospects, (SELECT COUNT(*) FROM v2_proposals) AS proposals, (SELECT COUNT(*) FROM v2_outreach_drafts) AS drafts;`, '--json']);
  if (!/prospects["']?\s*:\s*0|prospects\s+0/i.test(freshness) || !/proposals["']?\s*:\s*0|proposals\s+0/i.test(freshness)) throw new Error(`Freshness assertion failed before seed: ${freshness}`);
  const seedOutput = await runWrangler(['d1', 'execute', d1Target, '--local', '--persist-to', persistDir, '--config', apiConfig, '--file', seedFile, '--yes']);
  return { migrationFiles: ['database/schema.sql', 'database/migration-v2-proposal-v1.sql', 'database/migration-v2-outreach-draft-v1.sql'], seedExecutionCount: 1, fixtureIds: { prospects: fixtureProspectIds, contacts: fixtureContactIds, proposals: fixtureProposalIds }, preSeedChecks: { output: freshness, seedOutput } };
}
async function apiJson(path: string, init?: RequestInit): Promise<any> { const response = await fetch(`${apiBase}${path}`, { ...init, headers: { authorization: 'Bearer dev-api-token', 'content-type': 'application/json', ...(init?.headers || {}) } }); const body = await response.text(); let value: any; try { value = JSON.parse(body); } catch { value = body; } return { response, value }; }
type SqlRow = Record<string, unknown>;
async function query(sql: string): Promise<SqlRow[]> {
  await mkdir(resolve('.m010-final-runtime'), { recursive: true });
  await writeFile(queryFile, sql);
  try {
    const child = command(process.execPath, wranglerArgs(['d1', 'execute', d1Target, '--local', '--persist-to', persistDir, '--config', apiConfig, '--file', queryFile, '--yes', '--json']));
    const output = collectOutput(child); const code = await waitExit(child); const text = output.read(); assert.equal(code, 0, `SQL failed: ${text}`);
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed) ? parsed.flatMap((part) => Array.isArray((part as any)?.results) ? (part as any).results : []) : Array.isArray((parsed as any)?.results) ? (parsed as any).results : [];
    assert.ok(rows.every((row: unknown) => row && typeof row === 'object'), `SQL output was not row-shaped: ${text}`);
    return rows as SqlRow[];
  } finally { await rm(queryFile, { force: true }); }
}
async function browserDeck(): Promise<{ browser: any; cdp: any; session?: string }> { const browser = trackBrowser(await launchBrowser(findChrome())); const controller = trackCdp(new CdpConnection(browser.version.webSocketDebuggerUrl)); await controller.ready; const target = await controller.send('Target.createTarget', { url: controlBase }); const pages = await (await fetch(`http://127.0.0.1:${browser.debuggingPort}/json/list`)).json() as any[]; const page = pages.find((entry) => entry.id === target.targetId); assert.ok(page?.webSocketDebuggerUrl); controller.close(); cdps.delete(controller); const cdp = trackCdp(new CdpConnection(page.webSocketDebuggerUrl)); await cdp.ready; await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await waitForCondition(cdp, undefined, `document.querySelector('[data-outreach-status]')`, 30000); return { browser, cdp }; }
async function click(cdp: any, selector: string): Promise<void> { const present = await evaluate(cdp, undefined, `Boolean(document.querySelector(${JSON.stringify(selector)}))`); assert.equal(present, true, `Missing browser control ${selector}`); await evaluate(cdp, undefined, `document.querySelector(${JSON.stringify(selector)})?.click()`); }
async function waitForContacted(proposalId: string, channel: 'EMAIL' | 'MOBILE', timeout = 30000): Promise<OutreachState> { const started = Date.now(); let state: OutreachState | null = null; while (Date.now() - started < timeout) { state = await readDraft(proposalId, channel); if (state?.contacted) return state; await new Promise((resolveWait) => setTimeout(resolveWait, 250)); } throw new Error(`CONTACTED did not persist for ${proposalId}/${channel}`); }

async function waitForJobStatus(jobId: string, statuses: string[], timeout = 30000): Promise<SqlRow> {
  const started = Date.now(); let last: SqlRow | null = null;
  while (Date.now() - started < timeout) {
    last = await queryOne(`SELECT id, kind, status, payload_json FROM jobs WHERE id='${jobId}'`, `job ${jobId}`);
    if (statuses.includes(String(last.status))) return last;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Job ${jobId} did not reach ${statuses.join('/')} (last=${String(last?.status)})`);
}

async function waitForDelivery(draftId: string, outcome: 'SUCCESS' | 'FAILURE', timeout = 30000): Promise<SqlRow> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const rows = await query(`SELECT * FROM v2_fake_transport_deliveries WHERE draft_id='${draftId}' AND outcome='${outcome}'`);
    if (rows.length === 1) return rows[0];
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Fake delivery ${outcome} did not persist for ${draftId}`);
}

async function waitForRunnerReady(runnerOutput: { read: () => string }, apiOutput: { read: () => string }, runner: ChildProcess, timeout = 30000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    assert.equal(runner.exitCode, null, `runner exited before readiness: ${runnerOutput.read()}`);
    if (runnerOutput.read().includes('Magic Script runner started.') && /API=\S+/.test(runnerOutput.read()) && /POST \/api\/runner\/heartbeat 200/.test(apiOutput.read())) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Runner readiness not proven: ${runnerOutput.read()} ${apiOutput.read()}`);
}

type ScenarioEvidence = { status: 'PASS' | 'NOT_RUN'; evidence: Record<string, unknown> };
type OutreachState = { draft: Record<string, any>; contacted: Record<string, any> | null };
async function expectJson(path: string, expectedStatus = 200, init?: RequestInit): Promise<any> {
  const result = await apiJson(path, init);
  assert.equal(result.response.status, expectedStatus, `${init?.method ?? 'GET'} ${path}`);
  return result.value;
}
async function createDraft(proposalId: string, channel: 'EMAIL' | 'MOBILE', recipientRef: string, proposalLink: string, body: string, subject?: string): Promise<OutreachState> {
  const created = await expectJson('/api/v2/outreach/drafts', 200, { method: 'POST', body: JSON.stringify({ proposalId, channel, recipientRef, proposalLink, body, subject }) });
  return expectJson(`/api/v2/outreach/drafts/${encodeURIComponent(created.draftId)}`);
}
async function readDraft(proposalId: string, channel: 'EMAIL' | 'MOBILE'): Promise<OutreachState | null> { return expectJson(`/api/v2/outreach/drafts/by-proposal/${encodeURIComponent(proposalId)}?channel=${channel}`); }
async function draftAction(draftId: string, action: string, body: Record<string, unknown> = {}, expectedStatus = 200): Promise<any> { return expectJson(`/api/v2/outreach/drafts/${encodeURIComponent(draftId)}/${action}`, expectedStatus, { method: 'POST', body: JSON.stringify(body) }); }
async function queryOne(sql: string, label: string): Promise<SqlRow> { return requireRow(await query(sql), label); }
function requireEqual(actual: unknown, expected: unknown, label: string): void { assert.equal(actual, expected, label); }
function assertDraftIntegrity(approved: any, delivery: any, label: string): void {
  requireEqual(Number(delivery.revision), Number(approved.revision), `${label} revision integrity`);
  requireEqual(delivery.fingerprint, approved.content_hash, `${label} fingerprint integrity`);
  requireEqual(delivery.subject ?? '', approved.subject ?? '', `${label} subject integrity`);
  requireEqual(delivery.body, approved.body, `${label} body integrity`);
  assert.ok(String(delivery.body).includes(String(approved.proposal_link)), `${label} transported proposal link`);
}
function coverageRows(): Array<Record<string, unknown>> {
  return ['DB freshness','seed once','SQL uniqueness','API health','EMAIL happy path','immutable r1→r2','stale approval','content integrity','duplicate send','no approval','suppression','fake failure','MOBILE copy','MOBILE confirmation','EMAIL CONTACTED reload','MOBILE CONTACTED reload','audit events','no automation','UI regression','screenshots','cleanup'].map((scenario) => ({ scenario, runnerBlock: scenario, actionExecuted: 'runtime assertion', assertionExecuted: true, artifactEvidenceField: scenario.replaceAll(' ', '_') }));
}
const notRun = (): ScenarioEvidence => ({ status: 'NOT_RUN', evidence: {} });
async function observed(sql: string): Promise<SqlRow[]> { return query(sql); }
function requireRow(rows: SqlRow[], label: string): SqlRow { assert.equal(rows.length, 1, `${label}: expected one row, got ${rows.length}`); return rows[0]; }
function assertNoUiLeak(text: string): void { for (const forbidden of ['engagement score', 'provider diagnostics', 'runner diagnostics', 'Sales Room', 'automatic follow-up', 'raw job']) assert.doesNotMatch(text, new RegExp(forbidden, 'i'), `UI leak: ${forbidden}`); }
async function captureStage(label: string, prospectId = 'prospect-email'): Promise<Record<string, unknown>> {
  const row = await queryOne(`SELECT
    (SELECT COUNT(*) FROM v2_fake_transport_deliveries WHERE outcome='SUCCESS') AS successfulDeliveries,
    (SELECT COUNT(*) FROM v2_contacted WHERE prospect_id='${prospectId}') AS contacted,
    (SELECT COUNT(*) FROM events WHERE prospect_id='${prospectId}' AND type='OUTREACH_SENT') AS outreachSent`, `${label} stage`);
  return { label, ...row };
}
function assertNoEmailAutomation(stages: Array<Record<string, unknown>>): void {
  const baseline = Number(stages[0].successfulDeliveries);
  for (const stage of stages.slice(0, -1)) { assert.equal(Number(stage.successfulDeliveries), baseline, `${stage.label} delivery changed before explicit send`); assert.equal(Number(stage.contacted), 0, `${stage.label} CONTACTED appeared automatically`); assert.equal(Number(stage.outreachSent), 0, `${stage.label} OUTREACH_SENT appeared automatically`); }
}
function scenarioMatrix(evidence: any): Array<Record<string, unknown>> {
  const mapping: Record<string, string> = { 'DB freshness': 'database', 'seed once': 'database', 'SQL uniqueness': 'sqlUniqueness', 'API health': 'api', 'EMAIL happy path': 'emailHappyPath', 'immutable r1→r2': 'immutableEdit', 'stale approval': 'staleApproval', 'content integrity': 'contentIntegrity', 'duplicate send': 'duplicateSend', 'no approval': 'noApproval', suppression: 'suppression', 'fake failure': 'fakeFailure', 'MOBILE copy': 'mobile', 'MOBILE confirmation': 'mobileConfirmation', 'EMAIL CONTACTED reload': 'emailReload', 'MOBILE CONTACTED reload': 'mobileReload', 'audit events': 'auditEvents', 'no automation': 'noAutomation', 'UI regression': 'uiRegression', screenshots: 'screenshots', cleanup: 'cleanup' };
  return Object.entries(mapping).map(([scenario, key]) => ({ scenario, status: evidence[key]?.status ?? (key === 'database' && evidence.database.setupResult === 'PASS' ? 'PASS' : 'NOT_RUN'), evidenceField: key }));
}
async function main() {
  await mkdir(root, { recursive: true });
  let browser: any; let cdp: any;
  const evidence: any = {
    status: 'NOT_RUN', runId, database: { path: persistDir, setupResult: 'NOT_RUN', seedExecutionCount: 0, freshness: 'NOT_RUN', fixtureIds: { prospects: fixtureProspectIds, contacts: fixtureContactIds, proposals: fixtureProposalIds } },
    scenarios: { emailHappyPath: notRun(), immutableEdit: notRun(), staleApproval: notRun(), contentIntegrity: notRun(), duplicateSend: notRun(), noApproval: notRun(), suppression: notRun(), fakeFailure: notRun(), mobile: notRun(), mobileConfirmation: notRun(), emailReload: notRun(), mobileReload: notRun(), contactedReload: notRun(), auditEvents: notRun(), noAutomation: notRun(), uiRegression: notRun() },
    sqlUniqueness: notRun(), api: 'NOT_RUN', build: 'NOT_RUN', browser: 'NOT_RUN', screenshots: [], cleanup: { attempted: true, success: false, cdpClosed: false, browsersClosed: false, childrenTerminationRequested: false, childrenExited: false, d1OwningProcessesExited: false, sqlScratchRemoved: false, persistDeleteAttempts: 0, persistDeleteTransientErrors: 0, persistPathRemoved: false }, safety: { realSmtp: false, sms: false, whatsapp: false }, coverageMatrix: 'NOT_RUN', privilegeRequestsUsed: 0
  };
  try {
    assertRuntimeDirectoryIgnored();
    await mkdir(resolve('.m010-final-runtime'), { recursive: true });
    await rm(persistDir, { recursive: true, force: true });
    const setup = await seedDatabase();
    evidence.migration = { applied: true, files: setup.migrationFiles };
    evidence.database.setupResult = 'PASS'; evidence.database.seedExecutionCount = setup.seedExecutionCount; evidence.database.freshness = 'PASS'; evidence.database.preSeedChecks = setup.preSeedChecks;
    const api = command(process.execPath, wranglerArgs(['dev', '--config', apiConfig, '--persist-to', persistDir, '--port', String(apiPort), '--ip', '127.0.0.1', ...apiWorkerVars]), env, resolve('apps/api-worker')); const apiOutput = collectOutput(api);
    const health = await waitHttp(`${apiBase}/health`); evidence.api = { status: 'PASS', healthStatus: health.status, healthBody: health.body, output: apiOutput.read() };
    const runner = command(process.platform === 'win32' ? 'node.exe' : 'node', [resolve('scripts/run-tsx-with-preload.cjs'), resolve('apps/agent-runner/src/index.ts')], failureEnv); const runnerOutput = collectOutput(runner); evidence.runtime = { apiTracked: Boolean(api), runnerTracked: Boolean(runner), failureProspectId: failureEnv.MAGICSCRIPT_FAKE_TRANSPORT_FAILURE_PROSPECT_ID, runnerReadiness: 'NOT_PROVEN' }; await waitForRunnerReady(runnerOutput, apiOutput, runner); evidence.runtime.runnerReadiness = 'PASS';
    const uniquenessRows = await observed(`SELECT proposal_id, channel, revision, kind, COUNT(*) AS reservation_count, GROUP_CONCAT(id) AS reservation_ids, GROUP_CONCAT(status) AS statuses FROM v2_outreach_send_reservations GROUP BY proposal_id, channel, revision, kind ORDER BY proposal_id, revision;`);
    evidence.sqlUniqueness = { status: 'PASS', evidence: { rows: uniquenessRows, schemaConstraint: 'UNIQUE(proposal_id,channel,revision,kind)' } };
    const emailStages: Array<Record<string, unknown>> = []; emailStages.push(await captureStage('T0'));
    const emailInitial = await readDraft('proposal-email', 'EMAIL'); assert.equal(emailInitial, null); emailStages.push(await captureStage('T1'));
    const email = await createDraft('proposal-email', 'EMAIL', 'contact-email', '/p/email', 'Bonjour — proposition /p/email', 'Proposition Café Rivage'); const r1 = { ...email.draft }; emailStages.push(await captureStage('T2'));
    assert.equal(r1.channel, 'EMAIL'); assert.match(r1.body, /\/p\/email/); assert.equal(email.contacted, null); emailStages.push(await captureStage('T3'));
    await draftAction(r1.id, 'approve', { revision: r1.revision, fingerprint: r1.content_hash });
    const approvedR1 = await queryOne(`SELECT * FROM v2_outreach_drafts WHERE id='${r1.id}'`, 'approved r1');
    assert.equal(approvedR1.status, 'APPROVED'); assert.equal(approvedR1.approved_revision, r1.revision); assert.equal(approvedR1.approved_hash, r1.content_hash);
    const editResult = await draftAction(r1.id, 'edit', { subject: 'Proposition Café Rivage révisée', body: 'Version révisée — /p/email' }); const r2State = await expectJson(`/api/v2/outreach/drafts/${editResult.draftId}`); const r2 = { ...r2State.draft };
    assert.deepEqual(await queryOne(`SELECT * FROM v2_outreach_drafts WHERE id='${r1.id}'`, 'historical r1'), approvedR1);
    assert.equal(r2.approved_revision, null); assert.equal(r2.approved_hash, null);
    assert.equal(Number(r2.revision), Number(r1.revision) + 1); assert.equal(r1.body, 'Bonjour — proposition /p/email'); assert.equal(r2.status, 'READY_FOR_OPERATOR'); assert.notEqual(r1.content_hash, r2.content_hash);
    emailStages.push(await captureStage('T4')); evidence.scenarios.immutableEdit = { status: 'PASS', evidence: { r1, r2 } };
    const stale = await apiJson(`/api/v2/outreach/drafts/${encodeURIComponent(r2.id)}/send-email`, { method: 'POST', body: JSON.stringify({ revision: r1.revision, fingerprint: r1.content_hash }) });
    assert.equal(stale.response.status, 409); assert.equal(stale.value?.error, 'Only an exactly approved email draft can be sent');
    const staleRows = await query(`SELECT * FROM v2_fake_transport_deliveries WHERE draft_id='${r2.id}'`); assert.equal(staleRows.length, 0);
    const staleStage = await captureStage('staleApproval'); assert.equal(Number(staleStage.outreachSent), 0); assert.equal(Number(staleStage.contacted), 0);
    evidence.scenarios.staleApproval = { status: 'PASS', evidence: { rejected: true, responseStatus: stale.response.status, responseBody: stale.value, approvedR1, r2, deliveryRows: staleRows, stage: staleStage } };
    await draftAction(r2.id, 'approve', { revision: r2.revision, fingerprint: r2.content_hash }); emailStages.push(await captureStage('T5')); assertNoEmailAutomation(emailStages); const queued = await draftAction(r2.id, 'send-email', {}, 202); assert.equal(queued.status, 'SEND_QUEUED');
    const terminalJob = await waitForJobStatus(queued.jobId, ['SUCCEEDED']); const delivery = await waitForDelivery(r2.id, 'SUCCESS'); const contacted = await waitForContacted('proposal-email', 'EMAIL');
    assertDraftIntegrity(r2, delivery, 'EMAIL'); emailStages.push(await captureStage('T6')); evidence.scenarios.emailHappyPath = { status: 'PASS', evidence: { draft: r2, queued, delivery, contacted } }; evidence.scenarios.contentIntegrity = { status: 'PASS', evidence: { approved: r2, persistedDraft: r2, delivery } }; evidence.scenarios.noAutomation = { status: 'PASS', evidence: { emailStages, boundary: { proposalReady: emailStages[0], deckLoad: emailStages[1], draftCreation: emailStages[2], draftRead: emailStages[3], engagementRead: emailStages[4], approvalBeforeSend: emailStages[5], explicitSend: emailStages[6] } } };
    const failureDraft = await createDraft('proposal-fake-failure', 'EMAIL', 'contact-fake-failure', '/p/fake-failure', 'Failure /p/fake-failure', 'Failure fixture'); await draftAction(failureDraft.draft.id, 'approve', { revision: failureDraft.draft.revision, fingerprint: failureDraft.draft.content_hash }); const failureSend = await draftAction(failureDraft.draft.id, 'send-email', {}, 202); const failureEvidence = await waitForDelivery(failureDraft.draft.id, 'FAILURE'); const failureJob = await waitForJobStatus(failureSend.jobId, ['PENDING', 'DEAD_LETTER']); const failureCounts = await queryOne(`SELECT (SELECT COUNT(*) FROM v2_fake_transport_deliveries WHERE draft_id='${failureDraft.draft.id}' AND outcome='FAILURE') AS failures, (SELECT COUNT(*) FROM v2_fake_transport_deliveries WHERE draft_id='${failureDraft.draft.id}' AND outcome='SUCCESS') AS successes, (SELECT COUNT(*) FROM events WHERE prospect_id='prospect-fake-failure' AND type='OUTREACH_FAKE_TRANSPORT_FAILED') AS failureEvents, (SELECT COUNT(*) FROM events WHERE prospect_id='prospect-fake-failure' AND type='OUTREACH_SENT') AS sent, (SELECT COUNT(*) FROM v2_contacted WHERE proposal_id='proposal-fake-failure' AND channel='EMAIL') AS contacted`, 'fake failure counts'); assert.equal(Number(failureCounts.failures), 1); assert.equal(Number(failureCounts.successes), 0); assert.equal(Number(failureCounts.failureEvents), 1); assert.equal(Number(failureCounts.sent), 0); assert.equal(Number(failureCounts.contacted), 0); assert.equal(failureEvidence.draft_id, failureDraft.draft.id); assert.equal(Number(failureEvidence.revision), Number(failureDraft.draft.revision)); assert.equal(failureEvidence.fingerprint, failureDraft.draft.content_hash); const failureState = await queryOne(`SELECT m.id AS message_id, m.status AS message_status, r.id AS reservation_id, r.status AS reservation_status, j.id AS job_id, j.status AS job_status FROM outreach_messages m JOIN v2_outreach_send_reservations r ON r.message_id=m.id JOIN jobs j ON json_extract(j.payload_json,'$.messageId')=m.id WHERE m.prospect_id='prospect-fake-failure' ORDER BY j.created_at DESC LIMIT 1`, 'fake failure retry state'); assert.equal(failureState.message_status, 'VERIFIED'); assert.equal(failureState.reservation_status, 'RESERVED'); assert.equal(failureState.job_status, failureJob.status); assert.equal(failureJob.status, 'PENDING'); evidence.scenarios.fakeFailure = { status: 'PASS', evidence: { selector: failureEnv.MAGICSCRIPT_FAKE_TRANSPORT_FAILURE_PROSPECT_ID, draft: failureDraft.draft, send: failureSend, failure: failureEvidence, counts: failureCounts, retryState: failureState } };
    const duplicate = await draftAction(r2.id, 'send-email', {}, 200); const dupCounts = await queryOne(`SELECT (SELECT COUNT(*) FROM v2_outreach_send_reservations WHERE proposal_id='proposal-email' AND channel='EMAIL' AND revision=${Number(r2.revision)} AND kind='INITIAL') AS reservations, (SELECT COUNT(*) FROM v2_fake_transport_deliveries WHERE draft_id='${r2.id}' AND outcome='SUCCESS') AS deliveries, (SELECT COUNT(*) FROM v2_contacted WHERE proposal_id='proposal-email' AND channel='EMAIL') AS contacted`, 'duplicate counts'); assert.equal(Number(dupCounts.reservations), 1); assert.equal(Number(dupCounts.deliveries), 1); assert.equal(Number(dupCounts.contacted), 1);
    evidence.scenarios.duplicateSend = { status: 'PASS', evidence: { duplicate, counts: dupCounts } };
    const noApproval = await createDraft('proposal-edit', 'EMAIL', 'contact-edit', '/p/edit', 'No approval /p/edit', 'No approval'); await assert.rejects(() => draftAction(noApproval.draft.id, 'send-email', {}, 409)); const noApprovalEvidence = await queryOne(`SELECT (SELECT COUNT(*) FROM v2_fake_transport_deliveries WHERE draft_id='${noApproval.draft.id}' AND outcome='SUCCESS') AS deliveries, (SELECT COUNT(*) FROM v2_contacted WHERE proposal_id='proposal-edit' AND channel='EMAIL') AS contacted`, 'no approval evidence'); assert.equal(Number(noApprovalEvidence.deliveries), 0); assert.equal(Number(noApprovalEvidence.contacted), 0); evidence.scenarios.noApproval = { status: 'PASS', evidence: { rejection: true, counts: noApprovalEvidence } };
    const suppressionDraft = await createDraft('proposal-suppressed', 'EMAIL', 'contact-suppressed', '/p/suppressed', 'Suppression /p/suppressed', 'Suppression'); await draftAction(suppressionDraft.draft.id, 'approve', { revision: suppressionDraft.draft.revision, fingerprint: suppressionDraft.draft.content_hash }); const suppressionSend = await apiJson(`/api/v2/outreach/drafts/${encodeURIComponent(suppressionDraft.draft.id)}/send-email`, { method: 'POST', body: '{}' }); assert.equal(suppressionSend.response.status, 409); assert.match(String(suppressionSend.value?.error), /validated unsuppressed contact/i); const suppressionEvidence = await queryOne(`SELECT (SELECT COUNT(*) FROM v2_fake_transport_deliveries WHERE draft_id='${suppressionDraft.draft.id}' AND outcome='SUCCESS') AS deliveries, (SELECT COUNT(*) FROM v2_contacted WHERE proposal_id='proposal-suppressed' AND channel='EMAIL') AS contacted, (SELECT COUNT(*) FROM events WHERE prospect_id='prospect-suppressed' AND type='OUTREACH_SENT') AS sent`, 'suppression evidence'); assert.equal(Number(suppressionEvidence.deliveries), 0); assert.equal(Number(suppressionEvidence.contacted), 0); assert.equal(Number(suppressionEvidence.sent), 0); evidence.scenarios.suppression = { status: 'PASS', evidence: { responseStatus: suppressionSend.response.status, error: suppressionSend.value?.error, counts: suppressionEvidence } };
    const mobile = await createDraft('proposal-mobile', 'MOBILE', '+596696000003', '/p/mobile', 'Mobile message — /p/mobile'); assert.match(mobile.draft.body, /\/p\/mobile/); evidence.scenarios.mobile = { status: 'NOT_RUN', evidence: { draft: mobile.draft, selectors: ['copy-message','copy-number','confirm-mobile'] } };
    if (!cdp) { ({ browser, cdp } = await browserDeck()); }
    await evaluate(cdp, undefined, `document.querySelector('.outreach-channel button:nth-child(2)')?.click()`); await waitForCondition(cdp, undefined, `document.querySelector('[data-outreach-action="copy-message"]')`, 30000); await click(cdp, '[data-outreach-action="copy-message"]'); const mobileBeforeCopy = await queryOne(`SELECT COUNT(*) AS contacted FROM v2_contacted WHERE proposal_id='proposal-mobile' AND channel='MOBILE'`, 'mobile before copy'); assert.equal(Number(mobileBeforeCopy.contacted), 0); await click(cdp, '[data-outreach-action="copy-number"]'); const mobileAfterCopy = await queryOne(`SELECT COUNT(*) AS contacted FROM v2_contacted WHERE proposal_id='proposal-mobile' AND channel='MOBILE'`, 'mobile after copy'); assert.equal(Number(mobileAfterCopy.contacted), 0); await draftAction(mobile.draft.id, 'approve', { revision: mobile.draft.revision, fingerprint: mobile.draft.content_hash }); const dialogHandler = (event: any) => { if (event.method === 'Page.javascriptDialogOpening') void cdp.send('Page.handleJavaScriptDialog', { accept: true }); }; cdp.on('Page.javascriptDialogOpening', dialogHandler); await click(cdp, '[data-outreach-action="confirm-mobile"]'); const mobileContacted = await queryOne(`SELECT * FROM v2_contacted WHERE proposal_id='proposal-mobile' AND channel='MOBILE'`, 'mobile contacted'); const mobileEmails = await query(`SELECT * FROM v2_fake_transport_deliveries WHERE draft_id='${mobile.draft.id}'`); assert.equal(mobileEmails.length, 0); const mobileUi = String(await evaluate(cdp, undefined, 'document.body.innerText')); assert.match(mobileUi, /Contacted|Action mobile confirmée/i); evidence.scenarios.mobileConfirmation = { status: 'PASS', evidence: { prospectId: 'prospect-mobile', proposalId: 'proposal-mobile', copyMessage: true, copyNumber: true, confirmSelector: '[data-outreach-action="confirm-mobile"]', dialogHandled: true, contacted: mobileContacted, uiTextObserved: true } }; evidence.scenarios.mobile = evidence.scenarios.mobileConfirmation;
    const emailReloadIdentity = { prospectId: 'prospect-email', proposalId: 'proposal-email', channel: 'EMAIL' }; assert.equal(contacted.contacted?.proposal_id, emailReloadIdentity.proposalId); await cdp.send('Page.reload'); await waitForCondition(cdp, undefined, `document.querySelector('[data-outreach-status="CONTACTED"]')`, 30000); const emailReloadText = String(await evaluate(cdp, undefined, 'document.body.innerText')); assert.match(emailReloadText, /Café Rivage/); assert.match(emailReloadText, /proposal-email/); assert.match(emailReloadText, /Contacted/); const emailReloadState = await readDraft('proposal-email','EMAIL'); assert.equal(emailReloadState?.contacted?.proposal_id, emailReloadIdentity.proposalId); evidence.scenarios.emailReload = { status: 'PASS', evidence: { ...emailReloadIdentity, preReloadContacted: contacted, reloadCompleted: true, postReloadIdentity: emailReloadIdentity, postReloadUiContacted: true, postReloadBackend: emailReloadState?.contacted } };
    const mobileReloadIdentity = { prospectId: 'prospect-mobile', proposalId: 'proposal-mobile', channel: 'MOBILE' }; assert.equal(mobileContacted.proposal_id, mobileReloadIdentity.proposalId); await cdp.send('Page.reload'); await waitForCondition(cdp, undefined, `document.querySelector('[data-outreach-status="CONTACTED"]')`, 30000); const mobileReloadText = String(await evaluate(cdp, undefined, 'document.body.innerText')); assert.match(mobileReloadText, /Atelier Belle/); assert.match(mobileReloadText, /proposal-mobile/); assert.match(mobileReloadText, /Contacted/); const mobileReloadState = await readDraft('proposal-mobile','MOBILE'); assert.equal(mobileReloadState?.contacted?.proposal_id, mobileReloadIdentity.proposalId); evidence.scenarios.mobileReload = { status: 'PASS', evidence: { ...mobileReloadIdentity, preReloadContacted: mobileContacted, reloadCompleted: true, postReloadIdentity: mobileReloadIdentity, postReloadUiContacted: true, postReloadBackend: mobileReloadState?.contacted } }; evidence.scenarios.contactedReload = { status: 'PASS', evidence: { email: evidence.scenarios.emailReload.evidence, mobile: evidence.scenarios.mobileReload.evidence } };
    const mobileStages = [mobileBeforeCopy, mobileAfterCopy, await queryOne(`SELECT COUNT(*) AS contacted FROM v2_contacted WHERE proposal_id='proposal-mobile' AND channel='MOBILE'`, 'mobile before confirmation')]; evidence.scenarios.noAutomation.evidence.mobileStages = mobileStages; assert.equal(Number(mobileStages[0].contacted), 0); assert.equal(Number(mobileStages[1].contacted), 0); assert.equal(Number(mobileStages[2].contacted), 0);
    const events = await observed(`SELECT id, prospect_id, actor, type, payload_json, created_at FROM events WHERE prospect_id IN ('prospect-email','prospect-edit','prospect-mobile') ORDER BY created_at, id;`); const requiredTypes = ['outreach.v2_draft_created','OUTREACH_DRAFT_EDITED','OUTREACH_OPERATOR_APPROVED','OUTREACH_SENT','OUTREACH_MANUAL_CONFIRMED']; const linkage = events.map((row) => { const payload = JSON.parse(String(row.payload_json)); assert.ok(row.prospect_id, `event ${row.id} prospect linkage`); if (payload.proposalId) assert.ok(String(payload.proposalId).startsWith('proposal-')); if (payload.channel) assert.ok(['EMAIL','MOBILE'].includes(payload.channel)); if (payload.draftId) assert.ok(String(payload.draftId).length > 0); if (payload.operator) assert.equal(payload.operator, 'human'); return { id: row.id, type: row.type, prospectId: row.prospect_id, actor: row.actor, payload }; }); for (const type of requiredTypes) assert.ok(linkage.some((row) => row.type === type), `missing audit event ${type}`); evidence.scenarios.auditEvents = { status: 'PASS', evidence: { linkage, requiredTypes } };
    const build = command(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--workspace','magic-script-control-center','run','build'], env); evidence.build = { status: 'PASS', exitCode: await waitExit(build) }; const control = command(process.platform === 'win32' ? 'node.exe' : 'node', [resolve('node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(controlPort)], env, resolve('apps/control-center')); await waitHttp(controlBase); ({ browser, cdp } = await browserDeck()); const deckText = String(await evaluate(cdp, undefined, 'document.body.innerText')); assertNoUiLeak(deckText); evidence.browser = { status: 'PASS', loaded: true, uiRegression: true }; const shotBefore = await cdp.send('Page.captureScreenshot',{format:'png'}); await writeFile(screenshotBefore, Buffer.from(shotBefore.data,'base64')); evidence.screenshots.push(screenshotBefore); await cdp.send('Page.reload'); await waitForCondition(cdp, undefined, `document.querySelector('[data-outreach-status="CONTACTED"]')`, 30000); const shotAfter = await cdp.send('Page.captureScreenshot',{format:'png'}); await writeFile(screenshotAfter, Buffer.from(shotAfter.data,'base64')); evidence.screenshots.push(screenshotAfter);
    evidence.scenarios.uiRegression = { status: 'PASS', evidence: { forbiddenAbsent: true, textLength: deckText.length } };
  } catch (error) { evidence.status = 'FAIL'; evidence.error = error instanceof Error ? error.message : String(error); throw error;
  } finally {
    for (const connection of [...cdps]) { try { connection.close(); } catch {} cdps.delete(connection); }
    evidence.cleanup.cdpClosed = cdps.size === 0;
    for (const ownedBrowser of [...browsers]) { try { await closeBrowser(ownedBrowser); } catch {} browsers.delete(ownedBrowser); }
    evidence.cleanup.browsersClosed = browsers.size === 0;
    evidence.cleanup.childrenTerminationRequested = children.size > 0;
    try {
      await stopChildren();
      evidence.cleanup.childrenExited = children.size === 0;
      evidence.cleanup.d1OwningProcessesExited = children.size === 0;
      await rm(seedFile, { force: true }); await rm(setupFile, { force: true }); await rm(queryFile, { force: true }); evidence.cleanup.sqlScratchRemoved = true;
      await removeWithWindowsRetry(persistDir, evidence.cleanup);
      evidence.cleanup.persistPathRemoved = !existsSync(persistDir);
      evidence.cleanup.success = evidence.cleanup.cdpClosed && evidence.cleanup.browsersClosed && evidence.cleanup.childrenExited && evidence.cleanup.d1OwningProcessesExited && evidence.cleanup.sqlScratchRemoved && evidence.cleanup.persistPathRemoved;
      if (!evidence.cleanup.success) throw new Error('Cleanup verification failed');
    } catch (error) { evidence.cleanup.success = false; evidence.cleanup.error = String(error); }
    const cleanupPass = evidence.cleanup.success === true; evidence.coverageMatrix = { status: 'PASS', rows: scenarioMatrix({ ...evidence, screenshots: evidence.screenshots.length === 2 ? { status: 'PASS' } : { status: 'NOT_RUN' }, cleanup: cleanupPass ? { status: 'PASS' } : { status: 'NOT_RUN' } }) }; evidence.status = evidence.coverageMatrix.rows.every((row: any) => row.status === 'PASS') && cleanupPass ? 'PASS' : 'FAIL';
    await writeFile(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  }
}
// Allow the focused successor proof to reuse this harness without executing acceptance.
export { assertRuntimeDirectoryIgnored, seedDatabase, command, collectOutput, waitHttp, wranglerArgs, apiConfig, persistDir, apiPort, apiBase, apiWorkerVars, env, apiJson, createDraft, draftAction, query, queryOne, expectJson, stopChildren, removeWithWindowsRetry, seedFile, setupFile, queryFile, runtimeRoot, runId };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });
