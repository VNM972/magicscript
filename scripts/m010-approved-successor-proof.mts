import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertRuntimeDirectoryIgnored, seedDatabase, command, collectOutput, waitHttp, wranglerArgs,
  apiConfig, persistDir, apiPort, apiBase, apiWorkerVars, env, apiJson, createDraft,
  draftAction, query, queryOne, expectJson, stopChildren, removeWithWindowsRetry,
  seedFile, setupFile, queryFile, runtimeRoot, runId,
} from './m010-final-acceptance.mts';

const artifact = resolve(runtimeRoot, `${runId}.approved-successor.json`);
const evidence: Record<string, any> = { status: 'NOT_RUN', fullM010AcceptanceExecuted: false, runId, cleanup: {} };
const stackId = (env as NodeJS.ProcessEnv).MAGICSCRIPT_STACK_ID;
evidence.stack = { id: stackId, generation: stackId, storage: 'shared process environment and Worker --var', heartbeatStatus: 'NOT_RUN', claimStatus: 'NOT_RUN' };
let workerOutput: { read: () => string } | undefined;
const draftRow = (id: string) => queryOne(`SELECT * FROM v2_outreach_drafts WHERE id='${id}'`, id);
const approvalRows = (id: string) => query(`SELECT * FROM events WHERE type='OUTREACH_OPERATOR_APPROVED' AND json_extract(payload_json,'$.draftId')='${id}' ORDER BY id`);
async function zeroEffects() {
  const counts = await queryOne(`SELECT
    (SELECT COUNT(*) FROM v2_fake_transport_deliveries) AS deliveries,
    (SELECT COUNT(*) FROM events WHERE type='OUTREACH_SENT') AS sent,
    (SELECT COUNT(*) FROM v2_contacted) AS contacted,
    (SELECT COUNT(*) FROM v2_outreach_send_reservations) AS reservations,
    (SELECT COUNT(*) FROM jobs WHERE kind='SEND_EMAIL') AS jobs`, 'effects');
  for (const [name, value] of Object.entries(counts)) assert.equal(Number(value), 0, name);
  return counts;
}

try {
  assertRuntimeDirectoryIgnored();
  await mkdir(runtimeRoot, { recursive: true });
  assert.equal(existsSync(persistDir), false, 'proof requires fresh persistence');
  evidence.setup = await seedDatabase();
  evidence.schema = {};
  for (const table of ['v2_fake_transport_deliveries', 'v2_outreach_send_reservations', 'v2_outreach_drafts', 'v2_contacted', 'outreach_messages', 'events', 'jobs', 'prospects', 'contacts', 'runners']) {
    evidence.schema[table] = await query(`PRAGMA table_info(${table})`);
  }
  const api = command(process.execPath, wranglerArgs(['dev', '--config', apiConfig, '--persist-to', persistDir, '--port', String(apiPort), '--ip', '127.0.0.1', ...apiWorkerVars]), env, resolve('apps/api-worker'));
  const apiOutput = collectOutput(api);
  workerOutput = apiOutput;
  const health = await waitHttp(`${apiBase}/health`);
  assert.ok(stackId, 'canonical stack generation must be configured');
  assert.equal(JSON.parse(health.body).stackId, stackId);
  evidence.stack.apiGeneration = JSON.parse(health.body).stackId;
  assert.equal(JSON.parse(health.body).effectiveOutboundMode, 'fake');
  evidence.health = { status: health.status, effectiveOutboundMode: 'fake', apiPort };
  const created = await createDraft('proposal-email', 'EMAIL', 'contact-email', '/p/email', 'Bonjour — proposition /p/email', 'Proposition Café Rivage');
  const r1 = created.draft;
  assert.equal(r1.revision, 1);
  await draftAction(r1.id, 'approve', { revision: r1.revision, fingerprint: r1.content_hash });
  const approvedR1 = await draftRow(r1.id);
  const r1Approval = await approvalRows(r1.id);
  assert.equal(approvedR1.status, 'APPROVED');
  assert.equal(approvedR1.approved_revision, 1);
  assert.equal(approvedR1.approved_hash, r1.content_hash);
  assert.equal(r1Approval.length, 1);
  const approval = JSON.parse(String(r1Approval[0].payload_json));
  assert.equal(approval.draftId, r1.id); assert.equal(approval.revision, 1); assert.equal(approval.fingerprint, r1.content_hash);
  evidence.r1BeforeEdit = approvedR1; evidence.r1ApprovalBefore = r1Approval;
  const edited = await draftAction(r1.id, 'edit', { subject: 'Proposition Café Rivage révisée', body: 'Version révisée — /p/email' });
  const r2 = await draftRow(edited.draftId);
  evidence.r1AfterEdit = await draftRow(r1.id);
  assert.deepEqual(evidence.r1AfterEdit, approvedR1);
  assert.deepEqual((await expectJson(`/api/v2/outreach/drafts/${encodeURIComponent(r1.id)}`)).draft, approvedR1);
  assert.deepEqual((await expectJson(`/api/v2/outreach/drafts/${encodeURIComponent(r2.id as string)}`)).draft, r2);
  assert.equal(r2.revision, 2); assert.notEqual(r2.content_hash, r1.content_hash);
  assert.equal(r2.status, 'READY_FOR_OPERATOR');
  for (const field of ['approved_revision', 'approved_hash', 'approved_at', 'approved_by', 'action_at', 'action_by']) assert.equal(r2[field], null, field);
  evidence.r2BeforeApproval = r2;
  const stale = await apiJson(`/api/v2/outreach/drafts/${encodeURIComponent(r2.id as string)}/send-email`, { method: 'POST', body: JSON.stringify({ revision: r1.revision, fingerprint: r1.content_hash }) });
  assert.equal(stale.response.status, 409);
  assert.deepEqual(stale.value, { error: 'Only an exactly approved email draft can be sent' });
  evidence.stale = { oldApproval: { draftId: r1.id, revision: r1.revision, fingerprint: r1.content_hash }, status: stale.response.status, body: stale.value, effects: await zeroEffects() };
  evidence.r1ApprovalAfterRejection = await approvalRows(r1.id);
  assert.deepEqual(evidence.r1ApprovalAfterRejection, r1Approval);
  assert.deepEqual(await draftRow(r1.id), approvedR1);
  const wrongApproval = await apiJson(`/api/v2/outreach/drafts/${encodeURIComponent(r2.id as string)}/approve`, { method: 'POST', body: JSON.stringify({ revision: r1.revision, fingerprint: r1.content_hash }) });
  assert.equal(wrongApproval.response.status, 409);
  assert.equal(wrongApproval.value.error, 'Exact revision and fingerprint are required');
  assert.deepEqual(await draftRow(r2.id as string), r2);
  evidence.wrongApproval = { status: wrongApproval.response.status, body: wrongApproval.value };
  evidence.exactR2Approval = await draftAction(r2.id as string, 'approve', { revision: r2.revision, fingerprint: r2.content_hash });
  const approvedR2 = await draftRow(r2.id as string);
  assert.equal(approvedR2.status, 'APPROVED'); assert.equal(approvedR2.approved_revision, 2); assert.equal(approvedR2.approved_hash, r2.content_hash);
  evidence.r2Approval = await approvalRows(r2.id as string);
  assert.equal(evidence.r2Approval.length, 1);
  evidence.beforeExplicitSend = await zeroEffects();
  const queued = await draftAction(r2.id as string, 'send-email', {}, 202);
  assert.equal(queued.status, 'SEND_QUEUED');
  const job = await queryOne(`SELECT kind, payload_json FROM jobs WHERE id='${queued.jobId}'`, 'operator job');
  const payload = JSON.parse(String(job.payload_json));
  assert.equal(job.kind, 'SEND_EMAIL'); assert.equal(payload.provenance, 'operator-send');
  assert.equal(payload.v2DraftId, r2.id); assert.equal(payload.draftRevision, 2); assert.equal(payload.fingerprint, r2.content_hash);
  evidence.validSend = { httpStatus: 202, queued, job };
  const runnerArgs = [resolve('scripts/run-tsx-with-preload.cjs'), resolve('apps/agent-runner/src/index.ts')];
  const requiredEnv = ['MAGICSCRIPT_API_BASE_URL', 'MAGICSCRIPT_RUNNER_TOKEN', 'MAGICSCRIPT_STACK_ID'];
  const pathEnv = [...requiredEnv, 'MAGICSCRIPT_API_TOKEN', 'MAGICSCRIPT_EMAIL_PROVIDER', 'MAGICSCRIPT_FAKE_TRANSPORT', 'MAGICSCRIPT_SENDING_ENABLED', 'MAGICSCRIPT_TEST_EMAIL_MODE', 'MAGICSCRIPT_TEST_RECIPIENT'];
  const runnerEnv: NodeJS.ProcessEnv = env;
  evidence.runner = { executable: process.execPath, cwd: resolve('.'), argv: runnerArgs, tsRuntime: 'repo-local tsx via scripts/run-tsx-with-preload.cjs', indexImport: './api', envRequired: requiredEnv, envPresent: Object.fromEntries(pathEnv.map((name) => [name, runnerEnv[name] ? 'CONFIGURED' : 'MISSING'])), apiBaseUrl: runnerEnv.MAGICSCRIPT_API_BASE_URL, apiPort, stdout: '', stderr: '', readiness: 'NOT_RUN' };
  for (const name of pathEnv) assert.ok(runnerEnv[name], `${name} is required by this proof`);
  assert.equal(runnerEnv.MAGICSCRIPT_API_BASE_URL, apiBase);
  evidence.firstBrokenStage = 'RUNNER_STARTUP';
  const runner = command(process.execPath, runnerArgs, env);
  runner.stdout?.on('data', (chunk) => { evidence.runner.stdout += String(chunk); });
  runner.stderr?.on('data', (chunk) => { evidence.runner.stderr += String(chunk); });
  const runnerOutput = collectOutput(runner);
  const deadline = Date.now() + 45_000;
  let delivered: any;
  do {
    if (evidence.runner.stdout.includes(`API=${apiBase} `)) {
      evidence.runner.startup = 'PASS';
      evidence.firstBrokenStage = 'R2_JOB_PROCESSING';
    }
    assert.doesNotMatch(runnerOutput.read(), /Heartbeat warning:|Runner loop error:|Job .* failed:/);
    delivered = await expectJson(`/api/v2/outreach/drafts/${encodeURIComponent(r2.id as string)}`);
    if (delivered.contacted) break;
    assert.equal(runner.exitCode, null, runnerOutput.read());
    await new Promise((done) => setTimeout(done, 250));
  } while (Date.now() < deadline);
  assert.ok(delivered.contacted, `fake delivery did not complete: ${runnerOutput.read()} ${apiOutput.read()}`);
  assert.match(evidence.runner.stdout, /Magic Script runner started\./);
  assert.doesNotMatch(runnerOutput.read(), /ERR_UNSUPPORTED_ESM_URL_SCHEME/);
  evidence.runner.readiness = 'PASS';
  assert.ok(evidence.runner.stdout.includes(`API=${apiBase} `), 'runner must use the same dynamic API');
  evidence.runner.apiConnection = 'PASS';
  assert.ok(evidence.runner.stdout.includes(`stack=${stackId} `), 'runner must use the canonical stack generation');
  assert.doesNotMatch(evidence.runner.stdout, /stack=unfenced/);
  evidence.runner.fencing = 'ACTIVE';
  assert.match(apiOutput.read(), /POST \/api\/runner\/heartbeat 200/);
  assert.match(apiOutput.read(), /POST \/api\/runner\/jobs\/claim 200/);
  evidence.stack.heartbeatStatus = 200;
  evidence.stack.claimStatus = 200;
  const delivery = await queryOne(`SELECT * FROM v2_fake_transport_deliveries WHERE draft_id='${r2.id}'`, 'fake delivery');
  assert.equal(delivery.outcome, 'SUCCESS'); assert.equal(delivery.revision, 2); assert.equal(delivery.fingerprint, r2.content_hash);
  assert.equal(delivery.body, r2.body); assert.equal(delivery.subject, r2.subject);
  assert.equal(delivered.contacted.draft_id, r2.id); assert.equal(delivered.contacted.revision, 2); assert.equal(delivered.contacted.fingerprint, r2.content_hash);
  evidence.validSend.delivery = delivery; evidence.validSend.contacted = delivered.contacted;
  const counts = await queryOne(`SELECT
    (SELECT COUNT(*) FROM v2_fake_transport_deliveries) AS deliveries,
    (SELECT COUNT(*) FROM v2_fake_transport_deliveries WHERE draft_id='${r2.id}') AS r2Deliveries,
    (SELECT COUNT(*) FROM v2_fake_transport_deliveries WHERE draft_id='${r1.id}') AS staleR1Deliveries,
    (SELECT COUNT(*) FROM events WHERE type='OUTREACH_SENT') AS sent,
    (SELECT COUNT(*) FROM v2_contacted) AS contacted`, 'delivery counts');
  for (const name of ['deliveries', 'r2Deliveries', 'sent', 'contacted']) assert.equal(Number(counts[name]), 1, name);
  assert.equal(Number(counts.staleR1Deliveries), 0);
  evidence.validSend.counts = counts;
  evidence.validSend.consumedJob = await queryOne(`SELECT id, status FROM jobs WHERE id='${queued.jobId}'`, 'consumed job');
  assert.equal(evidence.validSend.consumedJob.status, 'SUCCEEDED');
  evidence.r1Final = await draftRow(r1.id); evidence.r1ApprovalFinal = await approvalRows(r1.id);
  assert.deepEqual(evidence.r1Final, approvedR1); assert.deepEqual(evidence.r1ApprovalFinal, r1Approval);
  evidence.status = 'PASS';
  evidence.firstBrokenStage = null;
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error); process.exitCode = 1;
  evidence.workerOutput = workerOutput?.read().replaceAll('dev-api-token', '[MASKED]').replaceAll('dev-runner-token', '[MASKED]');
  if (evidence.runner) {
    try {
      evidence.failureCounts = await queryOne(`SELECT
        (SELECT COUNT(*) FROM v2_fake_transport_deliveries) AS deliveries,
        (SELECT COUNT(*) FROM events WHERE type='OUTREACH_SENT') AS sent,
        (SELECT COUNT(*) FROM v2_contacted) AS contacted`, 'failure counts');
    } catch (captureError) { evidence.failureCountsError = String(captureError); }
  }
} finally {
  try {
    await stopChildren();
    await rm(seedFile, { force: true }); await rm(setupFile, { force: true }); await rm(queryFile, { force: true });
    assertRuntimeDirectoryIgnored();
    await removeWithWindowsRetry(persistDir, evidence.cleanup);
    evidence.cleanup.success = !existsSync(persistDir);
    assert.equal(evidence.cleanup.success, true);
  } catch (error) { evidence.cleanup.error = String(error); evidence.status = 'FAIL'; process.exitCode = 1; }
  const redact = (text: string) => [env.MAGICSCRIPT_API_TOKEN, env.MAGICSCRIPT_RUNNER_TOKEN].reduce((value, token) => token ? value.replaceAll(token, '[MASKED]') : value, text);
  evidence.workerOutput = workerOutput?.read();
  for (const [field, route] of [['heartbeatStatus', 'heartbeat'], ['claimStatus', 'jobs/claim']]) {
    const status = evidence.workerOutput?.match(new RegExp(`POST /api/runner/${route} (\\d{3})`));
    if (status) evidence.stack[field] = Number(status[1]);
  }
  await writeFile(artifact, `${redact(JSON.stringify(evidence, null, 2))}\n`);
  console.log(redact(JSON.stringify({ status: evidence.status, error: evidence.error, artifact, cleanup: evidence.cleanup })));
}
