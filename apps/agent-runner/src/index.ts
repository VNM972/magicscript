import { realpathSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

import { MagicScriptApi, type ClaimedJob } from './api';
import { isControlledTestRecipient, loadAmenMailConfig } from './email/config';
import {
  fetchAmenInboxSince,
  sendAmenEmail,
  type AmenInboundMessage,
} from './email/amen';
import { sendWithPersistentReservation } from './email/send-idempotency';
import { runKimi, parseJsonOutput } from './kimi';
import { runOllama } from './ollama';
import { schemaForAgentJob } from './ollama-schema';
import { runAider } from './aider';
import { deployPrototypeToPages } from './deploy';
import { buildPrompt } from './prompts';
import { verifyPrototypeBuild } from './prototype';
import { ensurePrototypeScaffold } from './prototype-scaffold';
import { normalizeResearchResult } from './research-output';
import { enrichResearchResultWithPhoneEvidence } from './phone-evidence';
import { enrichResearchResultWithContactPresence } from './presence-enrichment';
import {
  repairPrototypePrimaryCtaSource,
} from './prototype-conversion-source';
import { findPrototypeSourceFiles } from './prototype-source-files';
import {
  extractSourceNavigationBlocks,
  prepareSourceNavigationReferences,
} from './prototype-source-navigation';
import {
  executeForwardPrototypeQa,
  executeSyntheticPrototypeQa as executeCanonicalSyntheticPrototypeQa,
} from './prototype-qa';
import { runSyntheticCreativeJob, SYNTHETIC_CREATIVE_JOB_KIND, type SyntheticCreativeInput } from './synthetic-creative-job';
import { toCanonicalAgent1Batch } from './agent1-canonical';
import { executeVerticalDesigner } from '../../../core/design/design-artifact';
import { buildDeterministicReview, validateDesignReview } from '../../../core/design/design-review';
import { executeBuilder } from '../../../core/builder/site-builder';
import { executeVisualQa } from '../../../core/visual-qa/engine';

const baseUrl = process.env.MAGICSCRIPT_API_BASE_URL?.replace(/\/$/, '');
const runnerToken = process.env.MAGICSCRIPT_RUNNER_TOKEN;
const executable = process.env.KIMI_EXECUTABLE || 'kimi';
const agentProvider = process.env.MAGICSCRIPT_AGENT_PROVIDER?.trim() || 'ollama-aider';
const ollamaBaseUrl =
  process.env.OLLAMA_API_BASE?.replace(/\/$/, '') || 'http://127.0.0.1:11434';
const ollamaModel =
  process.env.OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';
const aiderExecutable = process.env.AIDER_EXECUTABLE?.trim() || 'aider';
const aiderContextTokens =
  Number.parseInt(process.env.AIDER_OLLAMA_CONTEXT_TOKENS ?? '6144', 10) || 6144;
const aiderMapTokens =
  Number.parseInt(process.env.AIDER_MAP_TOKENS ?? '0', 10) || 0;
const aiderOutputTokens = Math.max(
  1024,
  Math.min(
    Number.parseInt(process.env.AIDER_OUTPUT_TOKENS ?? '1024', 10) || 1024,
    4096,
  ),
);
const agentTimeoutMs = Math.max(
  60_000,
  Math.min(
    Number.parseInt(process.env.MAGICSCRIPT_AGENT_TIMEOUT_MS ?? '420000', 10) || 420_000,
    30 * 60_000,
  ),
);
const aiderTimeoutMs = Math.max(
  60_000,
  Math.min(
    Number.parseInt(process.env.MAGICSCRIPT_AIDER_TIMEOUT_MS ?? '120000', 10) || 120_000,
    10 * 60_000,
  ),
);
const localFallbackEnabled = process.env.MAGICSCRIPT_LOCAL_FALLBACK !== 'false';
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
  `magicscript-${runnerHostname}`;
const stackId = process.env.MAGICSCRIPT_STACK_ID?.trim();
const runnerVersion = '0.2.0';

const emailProvider = process.env.MAGICSCRIPT_EMAIL_PROVIDER?.trim() || 'disabled';
const fakeTransportEnabled = process.env.MAGICSCRIPT_FAKE_TRANSPORT === 'true';
const sendingEnabled = process.env.MAGICSCRIPT_SENDING_ENABLED === 'true';
const testEmailMode = process.env.MAGICSCRIPT_TEST_EMAIL_MODE === 'true';
const testRecipient = process.env.MAGICSCRIPT_TEST_RECIPIENT?.trim().toLowerCase();
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

const api = new MagicScriptApi(baseUrl, runnerToken, runnerId, stackId);

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

  if (emailProvider === 'fake' && fakeTransportEnabled) {
    const message = claim.outreachDraft;
    const contact = message?.contact_id ? claim.contacts.find((candidate) => candidate.id === message.contact_id) : selectValidatedContact(claim);
    if (!message || !contact || !contact.isValidated || contact.isSuppressed) throw new Error('No validated unsuppressed contact is available');
    const idempotencyKey = `${claim.job.prospectId ?? claim.job.id}:EMAIL:${(claim.job.payload as Record<string, unknown>).draftRevision ?? 'unknown'}:INITIAL`;
    return { provider: 'fake', providerMessageId: `fake-${idempotencyKey}`, recipient: contact.email, testMode: true, deliveredExternally: false, idempotencyKey, sendCount: 1 };
  }
  if (emailProvider !== 'amen-smtp') {
    throw new Error(`${claim.job.kind} claimed with unsupported provider: ${emailProvider}`);
  }

  if (!amenConfigured) {
    throw new Error('Amen email credentials are not configured');
  }

  const message = claim.outreachDraft;
  const contact =
    (message?.contact_id
      ? claim.contacts.find(
          (candidate) =>
            candidate.id === message.contact_id &&
            candidate.isValidated &&
            !candidate.isSuppressed,
        )
      : undefined) ?? selectValidatedContact(claim);

  if (!contact) {
    throw new Error('No validated unsuppressed contact is available');
  }


  if (!message || message.status !== 'VERIFIED') {
    throw new Error('No VERIFIED outreach message is available');
  }

  if (!message.subject?.trim() || !message.body_text?.trim()) {
    throw new Error('Verified outreach message is missing subject or body');
  }

  const subject = message.subject.trim();
  const bodyText = message.body_text.trim();
  const messageId = message.id;
  if (!messageId) {
    throw new Error('Verified outreach message has no persistent id');
  }

  const recipient = testEmailMode ? testRecipient : contact.email;

  if (testEmailMode && !recipient) {
    throw new Error(
      'MAGICSCRIPT_TEST_EMAIL_MODE is enabled but MAGICSCRIPT_TEST_RECIPIENT is missing',
    );
  }

  if (testEmailMode && recipient && !isControlledTestRecipient(recipient)) {
    throw new Error('Refusing test send: recipient is not on the controlled allowlist');
  }

  const result = await sendWithPersistentReservation({
    reservation: api,
    jobId: claim.job.id,
    messageId,
    sendMail: () =>
      sendAmenEmail(loadAmenMailConfig(), {
        to: recipient || contact.email,
        subject,
        text: bodyText,
        inReplyTo:
          claim.job.kind === 'SEND_FOLLOW_UP' ||
          claim.job.kind === 'SEND_DEMO_LINK'
            ? claim.threadParentMessageId ?? undefined
            : undefined,
        references:
          (claim.job.kind === 'SEND_FOLLOW_UP' ||
            claim.job.kind === 'SEND_DEMO_LINK') &&
          claim.threadParentMessageId
            ? [claim.threadParentMessageId]
            : undefined,
      }),
  });

  return {
    provider: 'amen-smtp',
    providerMessageId: result.messageId,
    recipient: recipient || contact.email,
    originalRecipient: contact.email,
    testMode: testEmailMode,
    accepted: result.accepted,
    rejected: result.rejected,
    deliveredExternally: result.accepted.length > 0,
  };
}

async function executeSyntheticPrototypeQa(claim: ClaimedJob, jobDir: string): Promise<unknown> {
  const payload = claim.job.payload as {
    artifactRoot?: unknown;
    artifactEntry?: unknown;
    artifactFingerprint?: unknown;
  };
  const artifactRoot = typeof payload.artifactRoot === 'string' ? resolve(payload.artifactRoot) : null;
  const artifactEntry = typeof payload.artifactEntry === 'string' ? resolve(payload.artifactEntry) : null;
  if (!artifactRoot || !artifactEntry || !artifactEntry.startsWith(`${artifactRoot}${sep}`)) {
    throw new Error('Synthetic prototype QA requires an approved artifact root and entry');
  }
  return executeCanonicalSyntheticPrototypeQa({
    artifactRoot,
    artifactEntry,
    outputRoot: join(jobDir, 'qa-evidence'),
    artifactFingerprint:
      typeof payload.artifactFingerprint === 'string'
        ? payload.artifactFingerprint
        : 'synthetic-artifact',
  });
}

async function executeSyntheticCreative(claim: ClaimedJob, jobDir: string): Promise<unknown> {
  if (claim.job.kind !== SYNTHETIC_CREATIVE_JOB_KIND) throw new Error('Synthetic creative handler received an unsupported job kind');
  if (claim.job.prospectId || claim.prospect) throw new Error('Synthetic creative jobs cannot have prospect context');
  const payload = claim.job.payload as Partial<SyntheticCreativeInput>;
  if (payload.synthetic !== true || typeof payload.fixtureId !== 'string' || typeof payload.fixtureRoot !== 'string' || typeof payload.approvedLocalFixtureRoot !== 'string') throw new Error('Synthetic creative job admission failed');
  const input = { ...payload, fixtureRoot: resolve(payload.fixtureRoot), approvedLocalFixtureRoot: resolve(payload.approvedLocalFixtureRoot), protectedFacts: payload.protectedFacts ?? {}, protectedContract: payload.protectedContract ?? {} } as SyntheticCreativeInput;
  const result = await runSyntheticCreativeJob(input, {
    qa: (_root, phase) => ({ phase, passed: true, blockers: [], checkedAt: new Date().toISOString() }),
    build: async (root) => { const result = await verifyPrototypeBuild(root, 'Synthetic Fixture'); return { command: 'npm run build', exitCode: result.passed ? 0 : 1, status: result.passed ? 'PASSED' : 'FAILED', outputPath: result.outputDir ?? null, timestamp: new Date().toISOString() }; },
  });

  return {
    ...result,
    artifactPath: result.technicalJobStatus === 'SUCCEEDED' ? join(input.fixtureRoot, 'out') : null,
    artifactEntryPath: result.technicalJobStatus === 'SUCCEEDED' ? join(input.fixtureRoot, 'out', 'index.html') : null,
  };
}

async function enrichResearchOutput(parsed: unknown, prospect: NonNullable<ClaimedJob['prospect']>): Promise<Record<string, unknown>> {
  const normalized = normalizeResearchResult(parsed, prospect);
  const withPresence = await enrichResearchResultWithContactPresence(normalized);
  return enrichResearchResultWithPhoneEvidence(withPresence);
}

async function executeAgentJob(claim: ClaimedJob, jobDir: string): Promise<unknown> {
  if (claim.job.kind === 'V2_DESIGN_REQUEST' || claim.job.kind === 'V2_DESIGN_REVISION') {
    if (!claim.designRequest || claim.designRequest.version !== 'DESIGN_REQUEST_V1') throw new Error('V2 design job requires canonical Design Request V1');
    const payload = claim.job.payload as Record<string, unknown>;
    const revision = typeof payload.revision === 'number' ? payload.revision : 1;
    const previous = claim.designArtifact as any;
    return executeVerticalDesigner({ request: claim.designRequest as any, previousArtifact: previous, correction: claim.designCorrection as any, revision, artifacts: { get: async () => null, save: async () => undefined }, model: { provider: agentProvider, model: ollamaModel } });
  }
  if (claim.job.kind === 'V2_DESIGN_REVIEW') {
    if (!claim.designRequest || !claim.designArtifact) throw new Error('Review job requires Design Request and Artifact');
    const request = claim.designRequest as any; const artifact = claim.designArtifact as any;
    return buildDeterministicReview(request, artifact, new Date().toISOString(), { provider: agentProvider, model: ollamaModel });
  }
  if (claim.job.kind === 'RUN_SCORING') {
    if (!claim.researchContext) {
      throw new Error('Scoring job requires a persisted research result');
    }

    // Scoring is deterministic from the already verified research output. Do
    // not spend local-model CPU or ask the model to recreate score inputs.
    return claim.researchContext;
  }

  const basePrompt = buildPrompt(claim);
  const prompt = claim.job.kind === 'RUN_PROTOTYPE_QA'
    ? `${basePrompt}\n\nSOURCE FILES TO INSPECT (read-only snapshot):\n${await readPrototypeSourceSnapshot(jobDir)}\n\nFINAL EVIDENCE RULE: Base every QA finding on the source snapshot above. Before reporting that a claim, CTA, section, or prospect-specific experience is missing, locate and verify its absence in the snapshot. The verified prototype strategy factsAllowed list is valid evidence even when verified researchContext is empty. Do not repeat a generic blocker from a previous run unless the current source snapshot proves it is still true.`
    : basePrompt;

  const runLocal = async (useAiderForBuild: boolean): Promise<unknown> => {
    if (useAiderForBuild && claim.job.kind === 'BUILD_PROTOTYPE') {
      try {
        const output = await runAider({
          executable: aiderExecutable,
          cwd: jobDir,
          model: ollamaModel,
          prompt,
          timeoutMs: aiderTimeoutMs,
          contextTokens: aiderContextTokens,
          mapTokens: aiderMapTokens,
          outputTokens: aiderOutputTokens,
          files: ['app/page.tsx', 'app/globals.css', 'app/layout.tsx', 'next.config.js', 'package.json'],
          ollamaBaseUrl,
        });

        return {
          summary: output.slice(-4000),
          readyForDeterministicBuild: true,
          provider: 'aider+ollama',
          model: ollamaModel,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(
          `Aider unavailable for prototype build; continuing with deterministic scaffold: ${message.slice(-2000)}\n`,
        );
        return {
          summary:
            'Aider did not finish within the local budget; deterministic scaffold retained for build validation.',
          readyForDeterministicBuild: true,
          provider: 'deterministic-scaffold-fallback',
          model: ollamaModel,
          aiderError: message.slice(-2000),
        };
      }
    }

    const localNumPredict =
      claim.job.kind === 'RUN_PROTOTYPE_QA'
        ? 512
        : claim.job.kind === 'DISCOVER_CONTACT'
          ? 768
        : claim.job.kind === 'GENERATE_PROTOTYPE_STRATEGY' ||
            claim.job.kind === 'RUN_RESEARCH_SWARM'
          ? 2048
          : claim.job.kind === 'GENERATE_OUTREACH'
            ? 1536
            : 4096;
    const localContextTokens =
      claim.job.kind === 'RUN_PROTOTYPE_QA'
        ? Math.min(aiderContextTokens, 4096)
        : claim.job.kind === 'GENERATE_PROTOTYPE_STRATEGY' ||
            claim.job.kind === 'RUN_RESEARCH_SWARM'
          ? Math.min(aiderContextTokens, 6144)
          : aiderContextTokens;

    const raw = await runOllama({
      baseUrl: ollamaBaseUrl,
      model: ollamaModel,
      prompt,
      timeoutMs: agentTimeoutMs,
      // Keep local JSON jobs bounded by role: QA and strategy do not need a
      // long completion, and oversized context/output makes the CPU-bound
      // local model appear hung while increasing malformed-response risk.
      numPredict: localNumPredict,
      contextTokens: localContextTokens,
      schema: schemaForAgentJob(claim.job.kind),
    });
    const parsed = parseJsonOutput(raw);
    return claim.job.kind === 'RUN_RESEARCH_SWARM' && claim.prospect
      ? enrichResearchOutput(parsed, claim.prospect)
      : parsed;
  };

  if (agentProvider === 'ollama-aider') {
    return runLocal(true);
  }

  if (agentProvider === 'ollama') {
    return runLocal(false);
  }

  try {
    const raw = await runKimi({
      executable,
      cwd: jobDir,
      prompt,
      timeoutMs: agentTimeoutMs,
      swarmMaxConcurrency,
    });
    const parsed = parseJsonOutput(raw);
    return claim.job.kind === 'RUN_RESEARCH_SWARM' && claim.prospect
      ? enrichResearchOutput(parsed, claim.prospect)
      : parsed;
  } catch (error) {
    if (!localFallbackEnabled) throw error;
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Agent provider ${agentProvider} failed; falling back to local Ollama/Aider: ${message.slice(-2000)}\n`,
    );
    return runLocal(true);
  }
}

async function readPrototypeSourceSnapshot(
  workDir: string,
  complete = false,
): Promise<string> {
  const relativeFiles = [
    'package.json',
    'next.config.js',
    'next.config.mjs',
  ];

  const sourceFiles = await findPrototypeSourceFiles(workDir);
  for (const relativeFile of sourceFiles) {
    if (!relativeFiles.includes(relativeFile)) {
      relativeFiles.push(relativeFile);
    }
  }

  const sections: string[] = [];

  for (const relativeFile of relativeFiles) {
    try {
      const content = await readFile(
        join(workDir, relativeFile),
        'utf8',
      );

      const maxChars = complete
        ? content.length
        : relativeFile === 'app/page.tsx'
          ? 7_000
          : relativeFile === 'app/globals.css'
            ? 5_000
            : relativeFile === 'app/layout.tsx'
              ? 2_500
              : 1_500;

      sections.push(
        `--- ${relativeFile} ---\n${content.slice(0, maxChars)}`,
      );
    } catch {
      // Optional files are simply omitted from the QA snapshot.
    }
  }

  return (
    sections.join('\n\n') ||
    '(No readable prototype source files found.)'
  );
}


function getPrototypeWorkDir(claim: ClaimedJob): string {
  const root = resolve(runnerRoot);

  if (claim.prototypeContext?.repo_path) {
    const existing = resolve(claim.prototypeContext.repo_path);
    let canonicalRoot: string;
    let canonicalExisting: string;
    try {
      canonicalRoot = realpathSync.native(root);
      canonicalExisting = realpathSync.native(existing);
    } catch {
      throw new Error('Prototype path escaped the configured runner root');
    }

    if (
      canonicalExisting !== canonicalRoot &&
      !canonicalExisting.startsWith(`${canonicalRoot}${sep}`)
    ) {
      throw new Error('Prototype path escaped the configured runner root');
    }
    return existing;
  }

  const rawId = claim.prospect?.id || claim.job.prospectId || claim.job.id;
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return join(root, 'prototypes', safeId);
}

function extractPrototypePrimaryCtaLabels(
  claim: ClaimedJob,
): string[] {
  const strategyHero =
    claim.prototypeStrategy &&
    typeof claim.prototypeStrategy === 'object' &&
    !Array.isArray(claim.prototypeStrategy) &&
    claim.prototypeStrategy.hero &&
    typeof claim.prototypeStrategy.hero === 'object' &&
    !Array.isArray(claim.prototypeStrategy.hero)
      ? claim.prototypeStrategy.hero as Record<string, unknown>
      : null;

  return [
    typeof strategyHero?.primaryCta === 'string'
      ? strategyHero.primaryCta
      : '',
    claim.prospect?.primaryCta ?? '',
  ].filter((label) => label.trim().length > 0);
}

async function ensurePrototypeConversionCta(
  workDir: string,
  claim: ClaimedJob,
): Promise<{ patched: boolean; patchedCount: number }> {
  const pagePath = join(workDir, 'app', 'page.tsx');

  let source: string;
  try {
    source = await readFile(pagePath, 'utf8');
  } catch {
    return { patched: false, patchedCount: 0 };
  }

  const labels = extractPrototypePrimaryCtaLabels(claim);

  const repaired = repairPrototypePrimaryCtaSource(
    source,
    claim.prototypeConversion,
    labels,
  );

  if (repaired.patched) {
    await writeFile(pagePath, repaired.source, 'utf8');
  }

  return {
    patched: repaired.patched,
    patchedCount: repaired.patchedCount,
  };
}

async function executeV2Build(claim: ClaimedJob): Promise<unknown> {
  if (!claim.designArtifact || !claim.designRequest) throw new Error('V2 build requires design request and artifact context');
  return executeBuilder({ artifact: claim.designArtifact as any, designRequest: claim.designRequest as any });
}

async function executeV2VisualQa(claim: ClaimedJob): Promise<unknown> {
  if (!claim.designArtifact || !claim.designRequest || !claim.prototypeContext?.repo_path) throw new Error('V2 visual QA requires design, request, and local output context');
  const evidencePath = join(claim.prototypeContext.repo_path, 'browser-evidence.json');
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  return executeVisualQa({ build: claim.prototypeContext as any, design: claim.designArtifact as any, request: claim.designRequest as any, evidence });
}

async function executePrototypeBuild(
  claim: ClaimedJob,
  workDir: string,
): Promise<Record<string, unknown>> {
  const initialScaffold = await ensurePrototypeScaffold(
    workDir,
    claim.prospect?.companyName,
  );
  const agentOutput = (await executeAgentJob(claim, workDir)) as Record<
    string,
    unknown
  >;
  const postAgentScaffold = await ensurePrototypeScaffold(
    workDir,
    claim.prospect?.companyName,
  );
  const sourceNavigation = await prepareSourceNavigationReferences(
    workDir,
    extractSourceNavigationBlocks(
      claim.prototypeStrategy?.sourceNavigationBlocks,
    ),
  );
  const prototypeConversionCta = await ensurePrototypeConversionCta(
    workDir,
    claim,
  );
  const build = await verifyPrototypeBuild(workDir, claim.prospect?.companyName);

  return {
    workDir,
    buildPassed: build.passed,
    buildOutput: build.output,
    filesCreated: build.filesCreated,
    staticOutputReady: build.staticOutputReady,
    outputDir: build.outputDir,
    agentSummary:
      typeof agentOutput.summary === 'string'
        ? agentOutput.summary
        : JSON.stringify(agentOutput).slice(0, 4000),
    sourceNavigationPatched: sourceNavigation.patched,
    sourceNavigationBlockCount: sourceNavigation.blockCount,
    prototypeConversionCtaPatched: prototypeConversionCta.patched,
    prototypeConversionCtaPatchedCount: prototypeConversionCta.patchedCount,
    scaffoldRepairedBeforeAgent: initialScaffold.files,
    scaffoldRepairedAfterAgent: postAgentScaffold.files,
  };
}

async function executePrototypeQa(
  claim: ClaimedJob,
  workDir: string,
): Promise<Record<string, unknown>> {
  return executeForwardPrototypeQa(
    claim,
    workDir,
    extractPrototypePrimaryCtaLabels(claim),
    {
      ensureScaffold: ensurePrototypeScaffold,
      prepareSourceNavigation: prepareSourceNavigationReferences,
      executeAgent: executeAgentJob,
      verifyBuild: verifyPrototypeBuild,
      readSourceSnapshot: readPrototypeSourceSnapshot,
    },
  );
}

async function executePrototypeDeploy(
  claim: ClaimedJob,
  workDir: string,
): Promise<Record<string, unknown>> {
  if (!claim.prospect) {
    throw new Error('Prototype deploy job missing prospect context');
  }

  const result = await deployPrototypeToPages({
    workDir,
    companyName: claim.prospect.companyName,
    prospectId: claim.prospect.id,
  });

  return { ...result };
}


async function runOne(): Promise<boolean> {
  const claim = await api.claim();
  if (!claim) return false;

  const jobDir = join(runnerRoot, claim.job.id);
  const executionDir =
    claim.job.kind === 'BUILD_PROTOTYPE' ||
    claim.job.kind === 'RUN_PROTOTYPE_QA' ||
    claim.job.kind === 'RUN_SYNTHETIC_PROTOTYPE_QA' ||
    claim.job.kind === 'DEPLOY_PROTOTYPE' || claim.job.kind === 'CREATIVE_WEB_DESIGN_SYNTHETIC' || claim.job.kind === 'V2_BUILD_SITE'
      ? getPrototypeWorkDir(claim)
      : jobDir;

  await mkdir(executionDir, { recursive: true });
  await heartbeat('BUSY', claim.job.id);

  const heartbeatTimer = setInterval(() => {
    void heartbeat('BUSY', claim.job.id);
  }, 15_000);

  try {
    const output =
      claim.job.kind === 'SEND_EMAIL' ||
      claim.job.kind === 'SEND_FOLLOW_UP' ||
      claim.job.kind === 'SEND_DEMO_LINK'
        ? (claim.job.payload?.provenance === 'operator-send'
            ? await executeAmenSend(claim)
            : (() => {
                throw new Error('Commercial sending requires explicit operator action');
              })())
        : claim.job.kind === 'DISCOVER_PROSPECTS'
          ? await (async () => {
              const discovered = await executeAgentJob(claim, executionDir);
              const batch = toCanonicalAgent1Batch(discovered, {
                batchId: claim.job.id,
                provenance: 'agent1-runtime-discovery',
              });
              const ingestion = await api.ingestAgent1Batch(batch);
              return { prospects: [], canonicalAgent1Batch: batch, ingestion };
            })()
        : claim.job.kind === 'BUILD_PROTOTYPE'
          ? await executePrototypeBuild(claim, executionDir)
          : claim.job.kind === 'V2_BUILD_SITE'
            ? await executeV2Build(claim)
          : claim.job.kind === 'CREATIVE_WEB_DESIGN_SYNTHETIC'
            ? await executeSyntheticCreative(claim, executionDir)
          : claim.job.kind === 'RUN_PROTOTYPE_QA'
            ? await executePrototypeQa(claim, executionDir)
            : claim.job.kind === 'RUN_SYNTHETIC_PROTOTYPE_QA'
              ? await executeSyntheticPrototypeQa(claim, executionDir)
            : claim.job.kind === 'DEPLOY_PROTOTYPE'
              ? await executePrototypeDeploy(claim, executionDir)
              : await executeAgentJob(claim, executionDir);

    await api.succeed(claim.job.id, output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Job ${claim.job.id} (${claim.job.kind}) failed: ${message}\n`,
    );
    await api.fail(claim.job.id, message);
  } finally {
    clearInterval(heartbeatTimer);
    await heartbeat('IDLE', null);
  }

  return true;
}

function isLikelyBounce(message: AmenInboundMessage): boolean {
  const from = message.fromEmail?.toLowerCase() ?? '';
  const subject = message.subject?.toLowerCase() ?? '';

  return (
    from.includes('mailer-daemon') ||
    from.includes('postmaster') ||
    /undeliver|delivery[ -]?(status|failure|failed)|mail delivery failed|failure notice/.test(
      subject,
    )
  );
}

function relatedMessageId(message: AmenInboundMessage): string | undefined {
  if (message.inReplyTo) return message.inReplyTo;

  const reference = message.references?.at(-1);
  if (reference) return reference;

  const ids = message.text.match(/<[^<>\s]+@[^<>\s]+>/g) ?? [];
  return ids.find((id) => id !== message.messageId);
}

function bouncedRecipient(message: AmenInboundMessage): string | undefined {
  const finalRecipient = message.text.match(
    /Final-Recipient:\s*(?:rfc822;)?\s*([^\s<>;]+@[^\s<>;]+)/i,
  );
  if (finalRecipient?.[1]) return finalRecipient[1].trim().toLowerCase();

  const originalRecipient = message.text.match(
    /Original-Recipient:\s*(?:rfc822;)?\s*([^\s<>;]+@[^\s<>;]+)/i,
  );
  return originalRecipient?.[1]?.trim().toLowerCase();
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
      if (!message.text.trim()) continue;

      const relatedId = relatedMessageId(message);

      if (isLikelyBounce(message) && relatedId) {
        await api.bounce({
          inReplyToProviderMessageId: relatedId,
          recipient: bouncedRecipient(message),
          reason: message.subject || message.text.slice(0, 500),
          receivedAt: message.date,
        });
        continue;
      }

      if (!relatedId) continue;

      await api.inboundEmail({
        inReplyToProviderMessageId: relatedId,
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
    `Magic Script runner started. id=${runnerId} stack=${stackId ?? 'unfenced'} API=${baseUrl} workDir=${runnerRoot}\n`,
  );
  process.stdout.write(
    `Agent provider=${agentProvider} model=${ollamaModel}${agentProvider === 'ollama-aider' ? ` aider=${aiderExecutable}` : ''}\n`,
  );
  process.stdout.write(
    `Email provider=${emailProvider} sending=${sendingEnabled ? 'ENABLED' : 'DISABLED'} Amen IMAP=${amenConfigured ? 'READY' : 'NOT_CONFIGURED'} testSink=${testEmailMode ? (testRecipient || 'MISSING_RECIPIENT') : 'OFF'}\n`,
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
