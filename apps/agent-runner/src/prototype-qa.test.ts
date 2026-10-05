import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { ClaimedJob } from './api';
import {
  executeForwardPrototypeQa,
  runPrototypeQaInspection,
  executeSyntheticPrototypeQa,
  type PrototypeQaDependencies,
} from './prototype-qa';
import {
  extractSourceNavigationBlocks,
  findMissingSourceNavigationBlocks,
  prepareSourceNavigationReferences,
} from './prototype-source-navigation';

function qaClaim(): ClaimedJob {
  return {
    job: {
      id: 'qa-job',
      kind: 'RUN_PROTOTYPE_QA',
      payload: {},
      status: 'RUNNING',
      attempts: 1,
      maxAttempts: 3,
    },
    prospect: {
      id: 'prospect-qa',
      companyName: 'Prototype QA',
      state: 'PROTOTYPE_QA',
    },
    contacts: [],
    prototypeConversion: null,
    prototypeStrategy: {
      sourceNavigationBlocks: [
        { label: 'Accueil', kind: 'navigation' },
        { label: 'Nos services', kind: 'content_block' },
      ],
    },
  };
}

const passingBuild = {
  passed: true,
  output: 'ok',
  filesCreated: 3,
  staticOutputReady: true,
  outputDir: 'out',
};

test('forward QA preparation runs before the non-mutating inspection path', async () => {
  const calls: string[] = [];
  const dependencies: PrototypeQaDependencies = {
    ensureScaffold: async () => {
      calls.push('prepare-scaffold');
    },
    prepareSourceNavigation: async (_workDir, blocks) => {
      calls.push(`prepare-source:${blocks.map((block) => block.kind).join(',')}`);
      return { patched: true, blockCount: blocks.length };
    },
    executeAgent: async () => {
      calls.push('inspect-agent');
      return { pass: true, safeForOutreach: true, blockingFindings: [] };
    },
    verifyBuild: async () => {
      calls.push('inspect-build');
      return passingBuild;
    },
    readSourceSnapshot: async () => {
      calls.push('inspect-source');
      return '<nav>Accueil</nav><section>Nos services</section>';
    },
  };

  const result = await executeForwardPrototypeQa(
    qaClaim(),
    'prototype',
    [],
    dependencies,
  );

  assert.equal(result.pass, true);
  assert.deepEqual(calls, [
    'prepare-scaffold',
    'prepare-source:navigation,content_block',
    'inspect-agent',
    'inspect-build',
    'inspect-source',
  ]);
});

test('historical QA inspection never calls source preparation or changes source', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'magic-script-history-qa-'));
  await mkdir(join(workDir, 'app'), { recursive: true });
  const pagePath = join(workDir, 'app', 'page.tsx');
  const original = '<main><nav>Accueil</nav><section>Nos services</section></main>';
  await writeFile(pagePath, original, 'utf8');
  let repairCalls = 0;
  const dependencies: PrototypeQaDependencies = {
    ensureScaffold: async () => {
      repairCalls += 1;
    },
    prepareSourceNavigation: async () => {
      repairCalls += 1;
      return { patched: true, blockCount: 2 };
    },
    executeAgent: async () => ({
      pass: true,
      safeForOutreach: true,
      blockingFindings: [],
    }),
    verifyBuild: async () => passingBuild,
    readSourceSnapshot: async () => readFile(pagePath, 'utf8'),
  };

  const result = await runPrototypeQaInspection(
    qaClaim(),
    workDir,
    [],
    dependencies,
  );

  assert.equal(result.pass, true);
  assert.equal(repairCalls, 0);
  assert.equal(await readFile(pagePath, 'utf8'), original);
});

test('source reference preparation preserves semantic kind without injecting a card grid', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'magic-script-source-nav-'));
  await mkdir(join(workDir, 'app'), { recursive: true });
  const pagePath = join(workDir, 'app', 'page.tsx');
  await writeFile(
    pagePath,
    'const sourceNavigationBlocks = [{ label: "Ancien", kind: "navigation" }];\nexport default function Page(){return <main />}',
    'utf8',
  );
  const blocks = extractSourceNavigationBlocks(
    qaClaim().prototypeStrategy?.sourceNavigationBlocks,
  );

  const result = await prepareSourceNavigationReferences(workDir, blocks);
  const source = await readFile(pagePath, 'utf8');

  assert.equal(result.patched, true);
  assert.match(source, /kind: "navigation"/);
  assert.match(source, /kind: "content_block"/);
  assert.doesNotMatch(source, /source-nav-grid|source-nav-item/);
});

test('semantic source parity passes without generic grid markup and still blocks omissions', () => {
  const blocks = extractSourceNavigationBlocks(
    qaClaim().prototypeStrategy?.sourceNavigationBlocks,
  );
  assert.deepEqual(
    findMissingSourceNavigationBlocks(
      '<nav><a>Accueil</a></nav><section><h2>Nos services</h2></section>',
      blocks,
    ),
    [],
  );
  assert.deepEqual(
    findMissingSourceNavigationBlocks('<nav>Accueil</nav>', blocks),
    [{ label: 'Nos services', kind: 'content_block' }],
  );
});

test('synthetic adapter reuses canonical inspection and persists structured result', async () => {
  const fixtureRoot = join(process.cwd(), '.magicscript', 'runner', 'synthetic-fixture-001');
  const outputRoot = await mkdtemp(join(tmpdir(), 'magic-script-synthetic-qa-'));
  const result = await executeSyntheticPrototypeQa({
    artifactRoot: fixtureRoot,
    artifactEntry: join(fixtureRoot, 'out', 'index.html'),
    outputRoot,
    artifactFingerprint: 'runtime-fixture-004',
  });

  assert.equal(result.synthetic, true);
  assert.equal(result.pass, true);
  assert.equal(result.safeForOutreach, false);
  assert.equal(result.technicalBuildPassed, true);
  assert.equal(result.staticOutputReady, true);
  assert.equal(result.outputDir, join(fixtureRoot, 'out'));
  assert.equal(typeof result.webDesignReview, 'object');
  const persisted = JSON.parse(await readFile(join(outputRoot, 'qa-result.json'), 'utf8')) as Record<string, unknown>;
  assert.equal(persisted.artifactEntry, join(fixtureRoot, 'out', 'index.html'));
  assert.equal(persisted.safeForOutreach, false);
});

test('historical QA fails closed for missing parity and invalid QA schema', async () => {
  const result = await runPrototypeQaInspection(qaClaim(), 'prototype', [], {
    executeAgent: async () => ({ summary: 'invalid schema' }),
    verifyBuild: async () => passingBuild,
    readSourceSnapshot: async () => '<nav>Accueil</nav>',
  });

  assert.equal(result.pass, false);
  assert.equal(result.safeForOutreach, false);
  assert.match(
    (result.blockingFindings as string[]).join('\n'),
    /content_block:Nos services/,
  );
  assert.equal(
    (result.webDesignReview as { status: string; verifier: string }).status,
    'BLOCKED',
  );
  assert.equal(
    (result.webDesignReview as { status: string; verifier: string }).verifier,
    'runner-deterministic-web-design-v2',
  );
});
