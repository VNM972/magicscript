import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import type { ClaimedJob } from './api';
import type { PrototypeBuildCheck } from './prototype';
import {
  validatePrototypeConversionSource,
  type PrototypeConversionExpectation,
} from './prototype-conversion-source';
import {
  extractSourceNavigationBlocks,
  findMissingSourceNavigationBlocks,
  type SourceNavigationBlock,
} from './prototype-source-navigation';
import { buildDeterministicWebDesignReview } from './prototype-web-design-review';

interface SourcePreparationResult {
  patched: boolean;
  blockCount: number;
}

export interface PrototypeQaDependencies {
  ensureScaffold: (
    workDir: string,
    companyName?: string,
  ) => Promise<unknown>;
  prepareSourceNavigation: (
    workDir: string,
    blocks: readonly SourceNavigationBlock[],
  ) => Promise<SourcePreparationResult>;
  executeAgent: (
    claim: ClaimedJob,
    workDir: string,
  ) => Promise<unknown>;
  verifyBuild: (
    workDir: string,
    companyName?: string,
  ) => Promise<PrototypeBuildCheck>;
  readSourceSnapshot: (
    workDir: string,
    complete?: boolean,
  ) => Promise<string>;
}

export interface PrototypeQaContext {
  prototypeConversion?: PrototypeConversionExpectation | null;
  primaryCtaLabels: readonly string[];
  sourceNavigationBlocks: readonly SourceNavigationBlock[];
}

function contextFromClaim(
  claim: ClaimedJob,
  primaryCtaLabels: readonly string[],
): PrototypeQaContext {
  return {
    prototypeConversion: claim.prototypeConversion,
    primaryCtaLabels,
    sourceNavigationBlocks: extractSourceNavigationBlocks(
      claim.prototypeStrategy?.sourceNavigationBlocks,
    ),
  };
}

export async function preparePrototypeForQa(
  claim: ClaimedJob,
  workDir: string,
  dependencies: Pick<
    PrototypeQaDependencies,
    'ensureScaffold' | 'prepareSourceNavigation'
  >,
): Promise<SourcePreparationResult> {
  await dependencies.ensureScaffold(workDir, claim.prospect?.companyName);
  return dependencies.prepareSourceNavigation(
    workDir,
    extractSourceNavigationBlocks(
      claim.prototypeStrategy?.sourceNavigationBlocks,
    ),
  );
}

/**
 * Non-mutating source inspection path for historical/backfill QA. Persistence
 * and lifecycle callbacks intentionally remain outside this function.
 */
export async function runPrototypeQaInspection(
  claim: ClaimedJob,
  workDir: string,
  primaryCtaLabels: readonly string[],
  dependencies: Pick<
    PrototypeQaDependencies,
    'executeAgent' | 'verifyBuild' | 'readSourceSnapshot'
  >,
): Promise<Record<string, unknown>> {
  const agentOutput = (await dependencies.executeAgent(
    claim,
    workDir,
  )) as Record<string, unknown>;
  const build = await dependencies.verifyBuild(
    workDir,
    claim.prospect?.companyName,
  );
  const sourceSnapshot = await dependencies.readSourceSnapshot(workDir, true);
  const context = contextFromClaim(claim, primaryCtaLabels);

  const qaSchemaIsValid =
    typeof agentOutput.pass === 'boolean' &&
    typeof agentOutput.safeForOutreach === 'boolean' &&
    Array.isArray(agentOutput.blockingFindings);
  const warnings = Array.isArray(agentOutput.warnings)
    ? agentOutput.warnings.map(String)
    : [];
  if (!qaSchemaIsValid) {
    warnings.push(
      'QA agent returned an invalid QA schema; deterministic prototype checks were used.',
    );
  }

  const blockingFindings =
    qaSchemaIsValid && Array.isArray(agentOutput.blockingFindings)
      ? agentOutput.blockingFindings.map(String)
      : [];

  blockingFindings.push(
    ...validatePrototypeConversionSource(
      sourceSnapshot,
      context.prototypeConversion,
      context.primaryCtaLabels,
    ),
  );

  const missingSourceBlocks = findMissingSourceNavigationBlocks(
    sourceSnapshot,
    context.sourceNavigationBlocks,
  );
  if (missingSourceBlocks.length > 0) {
    blockingFindings.push(
      `Missing verified source-navigation blocks: ${missingSourceBlocks
        .map((block) => `${block.kind}:${block.label}`)
        .join(', ')}`,
    );
  }

  if (/mailto:/i.test(sourceSnapshot)) {
    blockingFindings.push(
      'Prototype contains a mailto link; demo contact paths must remain disconnected.',
    );
  }

  if (!build.passed) {
    blockingFindings.push(
      `Deterministic npm build failed: ${build.output.slice(-3000)}`,
    );
  }

  const webDesignReview = buildDeterministicWebDesignReview({
    buildPassed: build.passed,
    blockingFindings,
    qaSchemaIsValid,
  });

  return {
    ...agentOutput,
    pass: build.passed && blockingFindings.length === 0,
    safeForOutreach: build.passed && blockingFindings.length === 0,
    blockingFindings,
    warnings,
    technicalBuildPassed: build.passed,
    staticOutputReady: build.staticOutputReady,
    outputDir: build.outputDir,
    webDesignReview,
  };
}

export async function executeForwardPrototypeQa(
  claim: ClaimedJob,
  workDir: string,
  primaryCtaLabels: readonly string[],
  dependencies: PrototypeQaDependencies,
): Promise<Record<string, unknown>> {
  await preparePrototypeForQa(claim, workDir, dependencies);
  return runPrototypeQaInspection(
    claim,
    workDir,
    primaryCtaLabels,
    dependencies,
  );
}

export interface SyntheticPrototypeQaInput {
  artifactRoot: string;
  artifactEntry: string;
  outputRoot: string;
  artifactFingerprint?: string;
}

async function syntheticSourceSnapshot(workDir: string): Promise<string> {
  const files = [
    'package.json',
    'next.config.js',
    'next.config.mjs',
    'app/page.tsx',
    'app/layout.tsx',
    'app/globals.css',
  ];
  const sections: string[] = [];
  for (const file of files) {
    try {
      sections.push(`--- ${file} ---\\n${await readFile(join(workDir, file), 'utf8')}`);
    } catch {
      // Synthetic fixtures may only provide their static entry.
    }
  }
  if (sections.length === 0) {
    sections.push(`--- artifact entry ---\\n${await readFile(join(workDir, 'out', 'index.html'), 'utf8')}`);
  }
  return sections.join('\\n\\n');
}

/**
 * Adapts a non-commercial synthetic artifact to the canonical QA inspection
 * contract without creating prospect context or rebuilding the fixture.
 */
export async function executeSyntheticPrototypeQa(
  input: SyntheticPrototypeQaInput,
): Promise<Record<string, unknown>> {
  const artifactRoot = resolve(input.artifactRoot);
  const artifactEntry = resolve(input.artifactEntry);
  if (!artifactEntry.startsWith(`${artifactRoot}${sep}`)) {
    throw new Error('Synthetic prototype QA entry must remain inside artifact root');
  }
  const entryStats = await stat(artifactEntry);
  if (!entryStats.isFile() || !/<html\b/i.test(await readFile(artifactEntry, 'utf8'))) {
    throw new Error('Synthetic prototype QA requires an HTML artifact entry');
  }

  const syntheticClaim = {
    job: {
      id: `synthetic-qa-${input.artifactFingerprint ?? 'artifact'}`,
      kind: 'RUN_SYNTHETIC_PROTOTYPE_QA',
      payload: {},
      status: 'RUNNING',
      attempts: 1,
      maxAttempts: 1,
    },
    prospect: null,
    contacts: [],
    prototypeConversion: null,
    prototypeStrategy: null,
  } as ClaimedJob;
  const build = {
    passed: true,
    output: 'Synthetic static artifact already built; canonical QA inspection used without rebuild.',
    filesCreated: 1,
    staticOutputReady: true,
    outputDir: resolve(artifactRoot, 'out'),
  };
  const result = await runPrototypeQaInspection(
    syntheticClaim,
    artifactRoot,
    [],
    {
      executeAgent: async () => ({
        pass: true,
        safeForOutreach: false,
        blockingFindings: [],
        warnings: ['Synthetic QA is non-commercial and not safe for outreach.'],
      }),
      verifyBuild: async () => build,
      readSourceSnapshot: syntheticSourceSnapshot,
    },
  );
  const output = {
    ...result,
    kind: 'RUN_SYNTHETIC_PROTOTYPE_QA',
    synthetic: true,
    artifactRoot,
    artifactEntry,
    artifactFingerprint: input.artifactFingerprint ?? 'synthetic-artifact',
    safeForOutreach: false,
  };
  await mkdir(input.outputRoot, { recursive: true });
  const resultPath = join(input.outputRoot, 'qa-result.json');
  await writeFile(resultPath, JSON.stringify({ ...output, resultPath }, null, 2), 'utf8');
  return { ...output, resultPath };
}
