import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  assertMissionAuthorized,
  blockMission,
  canStartMission,
  captureMissionImplementationBinding,
  checkpointMission,
  completeMission,
  getNextAuthorizedMission,
  implementationBindingFromFileHashes,
  recordReviewerPass,
  startMission,
  type ProjectState,
  validateProjectState,
  validateReviewerImplementationBindings,
} from '../project';

function fixture(): ProjectState {
  return {
    schemaVersion: 1,
    project: { id: 'fixture', name: 'Fixture', version: '1.0.0', revision: 1, phase: 'BUILD' },
    currentMissionId: null,
    nextAuthorizedMissionId: 'WP-C',
    workPackages: [
      {
        id: 'WP-A', title: 'Done dependency', priority: 'P0', status: 'DONE', classification: 'VERIFIED',
        dependencies: [], requiredPermissions: ['LOCAL_READ'], requiredRuntimeSafety: [],
        doneCriteria: [{ id: 'a-done', description: 'A done', status: 'MET', evidenceRefs: ['E-TEST'] }],
        evidenceRefs: ['E-TEST'], blockerRefs: [], checkpointRefs: [],
      },
      {
        id: 'WP-B', title: 'Lower priority', priority: 'P2', status: 'READY', classification: 'OBSERVED',
        dependencies: ['WP-A'], requiredPermissions: ['LOCAL_WRITE'], requiredRuntimeSafety: [],
        doneCriteria: [{ id: 'b-done', description: 'B done', status: 'UNMET', evidenceRefs: [] }],
        evidenceRefs: [], blockerRefs: [], checkpointRefs: [],
      },
      {
        id: 'WP-C', title: 'Deterministic next', priority: 'P1', status: 'READY', classification: 'OBSERVED',
        dependencies: ['WP-A'], requiredPermissions: ['LOCAL_TEST'], requiredRuntimeSafety: [],
        doneCriteria: [{ id: 'c-done', description: 'C done', status: 'UNMET', evidenceRefs: [] }],
        evidenceRefs: [], blockerRefs: [], checkpointRefs: [],
      },
      {
        id: 'WP-PAUSED', title: 'Paused', priority: 'P0', status: 'PAUSED', classification: 'UNRESOLVED',
        dependencies: [], requiredPermissions: ['LOCAL_READ'], requiredRuntimeSafety: [],
        doneCriteria: [{ id: 'paused-done', description: 'Paused done', status: 'UNKNOWN', evidenceRefs: [] }],
        evidenceRefs: [], blockerRefs: [], checkpointRefs: [],
      },
      {
        id: 'WP-BLOCKED', title: 'Blocked', priority: 'P0', status: 'BLOCKED', classification: 'OBSERVED',
        dependencies: [], requiredPermissions: ['LOCAL_READ'], requiredRuntimeSafety: [],
        doneCriteria: [{ id: 'blocked-done', description: 'Blocked done', status: 'UNMET', evidenceRefs: [] }],
        evidenceRefs: [], blockerRefs: ['B-OPEN'], checkpointRefs: [],
      },
    ],
    frozenDecisions: [],
    permissions: [
      { id: 'LOCAL_READ', allowed: true, classification: 'VERIFIED', evidenceRefs: ['E-POLICY'] },
      { id: 'LOCAL_WRITE', allowed: true, classification: 'VERIFIED', evidenceRefs: ['E-POLICY'] },
      { id: 'LOCAL_TEST', allowed: true, classification: 'VERIFIED', evidenceRefs: ['E-POLICY'] },
      { id: 'REMOTE_PUSH', allowed: false, classification: 'VERIFIED', evidenceRefs: ['E-POLICY'] },
      { id: 'PRODUCTION_DEPLOY', allowed: false, classification: 'VERIFIED', evidenceRefs: ['E-POLICY'] },
      { id: 'REAL_OUTREACH', allowed: false, classification: 'VERIFIED', evidenceRefs: ['E-POLICY'] },
      { id: 'REAL_EMAIL_SEND', allowed: false, classification: 'VERIFIED', evidenceRefs: ['E-POLICY'] },
      { id: 'REAL_WHATSAPP_SEND', allowed: false, classification: 'VERIFIED', evidenceRefs: ['E-POLICY'] },
      { id: 'PAID_API', allowed: false, classification: 'VERIFIED', evidenceRefs: ['E-POLICY'] },
    ],
    runtimeSafety: [
      { id: 'RS-EMAIL', control: 'REAL_EMAIL_SEND', state: 'DISABLED', classification: 'VERIFIED', evidenceRefs: ['E-CONFIG'], summary: 'disabled' },
      { id: 'RS-DEPLOY', control: 'PRODUCTION_DEPLOY', state: 'DISABLED', classification: 'VERIFIED', evidenceRefs: ['E-CONFIG'], summary: 'disabled' },
    ],
    blockers: [
      { id: 'B-OPEN', status: 'OPEN', classification: 'OBSERVED', summary: 'open', evidenceRefs: ['E-TEST'] },
    ],
    evidence: [
      { id: 'E-TEST', classification: 'VERIFIED', kind: 'TEST', reference: 'core/tests/project-control.test.ts', summary: 'test' },
      { id: 'E-POLICY', classification: 'VERIFIED', kind: 'CONFIG', reference: 'CLAUDE.md', summary: 'policy' },
      { id: 'E-CONFIG', classification: 'VERIFIED', kind: 'CONFIG', reference: 'core/config.ts', summary: 'runtime config' },
    ],
    checkpoints: [],
    history: [],
  };
}

function h3ReviewFixture(): ProjectState {
  const state = fixture();
  state.project.revision = 10;
  state.workPackages = state.workPackages.map((item) => item.id === 'WP-C'
    ? {
        ...item,
        id: 'H3',
        title: 'BUILDER — Verified Phone Contactability',
        status: 'READY',
        classification: 'VERIFIED',
        doneCriteria: [
          { id: 'H3-EMAIL', description: 'Email remains verified', status: 'MET', evidenceRefs: ['E-H3-TESTS'] },
          { id: 'H3-PHONE', description: 'Phone is verified', status: 'UNMET', evidenceRefs: [] },
        ],
        evidenceRefs: ['E-H3-CODE', 'E-H3-TESTS'],
        checkpointRefs: ['CP-0010-H3-MISSION-READY'],
      }
    : item.id === 'WP-B'
      ? { ...item, status: 'PAUSED' }
      : item);
  state.evidence = [...state.evidence,
    {
      id: 'E-H3-CODE', classification: 'VERIFIED', kind: 'CODE',
      reference: 'core/orchestrator/contactability.ts', summary: 'H3 implementation',
    },
    {
      id: 'E-H3-TESTS', classification: 'VERIFIED', kind: 'TEST',
      reference: 'core/tests/contactability.test.ts', summary: 'H3 tests',
    },
  ];
  state.checkpoints = [{
    id: 'CP-0010-H3-MISSION-READY', revision: 10, missionId: 'H3', stage: 'H3-MISSION-READY',
    createdAt: '2026-09-13T05:04:08.855Z', summary: 'H3 ready', filesChanged: [], tests: [],
    unresolved: ['H3 implementation pending'], nextAction: 'Builder H3',
  }];
  state.nextAuthorizedMissionId = 'H3';
  return state;
}

const H4_IMPLEMENTATION_PATHS = [
  'apps/control-center/components/ProspectPipeline.test.tsx',
  'apps/control-center/components/ProspectPipeline.tsx',
  'apps/control-center/lib/api.test.ts',
  'apps/control-center/lib/api.ts',
];

function h4ReviewFixture(): ProjectState {
  const state = h3ReviewFixture();
  state.project.revision = 12;
  state.workPackages = state.workPackages.map((item) => item.id === 'H3'
    ? {
        ...item,
        id: 'H4',
        title: 'BUILDER — Fail-Closed Operator Contactability Projection',
        doneCriteria: [
          { id: 'H4-SCOPE', description: 'Four-file scope', status: 'UNKNOWN', evidenceRefs: [] },
          { id: 'H4-FAIL-CLOSED', description: 'Fail-closed projection', status: 'UNKNOWN', evidenceRefs: [] },
        ],
        evidenceRefs: [],
        checkpointRefs: ['CP-0012-H4-MISSION-READY'],
      }
    : item);
  state.checkpoints = [{
    id: 'CP-0012-H4-MISSION-READY', revision: 12, missionId: 'H4', stage: 'H4-MISSION-READY',
    createdAt: '2026-09-13T10:20:12.508Z', summary: 'H4 ready', filesChanged: [], tests: [],
    unresolved: ['H4 implementation pending'], nextAction: 'Builder H4',
  }];
  state.nextAuthorizedMissionId = 'H4';
  return state;
}

function reviewedImplementation() {
  return implementationBindingFromFileHashes([
    { path: 'core/orchestrator/contactability.ts', sha256: 'a'.repeat(64) },
    { path: 'core/tests/contactability.test.ts', sha256: 'b'.repeat(64) },
  ]);
}

function reviewerPassInput() {
  const currentImplementation = reviewedImplementation();
  return {
    missionId: 'H3',
    authority: 'REVIEWER',
    decision: 'PASS',
    result: 'PASS_AWAITING_CONTROL_PLANE_TRANSITION',
    reviewedRevision: 10,
    reviewedCheckpointId: 'CP-0010-H3-MISSION-READY',
    reviewedImplementationFingerprint: currentImplementation.digest,
    currentImplementation,
    at: '2026-09-13T09:00:00.000Z',
  };
}

function h4ReviewerPassInput() {
  const currentImplementation = implementationBindingFromFileHashes(
    H4_IMPLEMENTATION_PATHS.map((filePath, index) => ({
      path: filePath,
      sha256: String(index + 1).repeat(64),
    })),
  );
  return {
    missionId: 'H4',
    authority: 'REVIEWER',
    decision: 'PASS',
    result: 'PASS_AWAITING_CONTROL_PLANE_TRANSITION',
    reviewedRevision: 12,
    reviewedCheckpointId: 'CP-0012-H4-MISSION-READY',
    reviewedImplementationFingerprint: currentImplementation.digest,
    currentImplementation,
    at: '2026-09-13T11:00:00.000Z',
  };
}

test('validates a valid state and derives one deterministic next mission', () => {
  const state = fixture();
  assert.deepEqual(validateProjectState(state), []);
  assert.equal(getNextAuthorizedMission(state)?.id, 'WP-C');
  assert.equal(canStartMission(state, 'WP-C'), true);
  assert.doesNotThrow(() => assertMissionAuthorized(state, 'WP-C'));
});

test('starts only the authorized mission and records the revision', () => {
  const started = startMission(fixture(), 'WP-C', {
    at: '2026-09-12T00:30:00.000Z',
  });
  assert.equal(started.project.revision, 2);
  assert.equal(started.currentMissionId, 'WP-C');
  assert.equal(started.nextAuthorizedMissionId, null);
  assert.equal(started.workPackages.find((item) => item.id === 'WP-C')?.status, 'ACTIVE');
  assert.equal(started.history.at(-1)?.action, 'START');
  assert.throws(
    () => startMission(started, 'WP-B', { at: '2026-09-12T00:31:00.000Z' }),
    /already ACTIVE/,
  );
});

test('rejects schema, duplicate ids, missing dependencies, lifecycle and references', () => {
  const state = fixture();
  const invalid = structuredClone(state) as unknown as ProjectState & { schemaVersion: number };
  (invalid as { schemaVersion: number }).schemaVersion = 99;
  invalid.workPackages = [
    ...invalid.workPackages,
    { ...invalid.workPackages[1]!, status: 'BROKEN' as never, dependencies: ['MISSING'], evidenceRefs: ['MISSING'] },
  ];
  invalid.nextAuthorizedMissionId = null;
  const errors = validateProjectState(invalid);
  assert.equal(errors.some((item) => item.includes('unsupported schemaVersion')), true);
  assert.equal(errors.some((item) => item.includes('duplicate work package id')), true);
  assert.equal(errors.some((item) => item.includes('missing dependency')), true);
  assert.equal(errors.some((item) => item.includes('invalid lifecycle state')), true);
  assert.equal(errors.some((item) => item.includes('missing evidence')), true);
  assert.equal(errors.some((item) => item.includes('impossible next mission')), true);
});

test('BLOCKED and PAUSED missions never restart implicitly', () => {
  const state = fixture();
  assert.equal(canStartMission(state, 'WP-BLOCKED'), false);
  assert.equal(canStartMission(state, 'WP-PAUSED'), false);
});

test('rejects circular dependencies', () => {
  const state = fixture();
  state.workPackages = state.workPackages.map((item) => item.id === 'WP-A'
    ? { ...item, dependencies: ['WP-C'] }
    : item);
  state.nextAuthorizedMissionId = null;
  assert.equal(validateProjectState(state).some((item) => item.includes('dependency cycle')), true);
});

test('fails closed on contradictory permission and runtime safety state', () => {
  const state = fixture();
  state.permissions = state.permissions.map((item) => item.id === 'REAL_EMAIL_SEND'
    ? { ...item, allowed: true }
    : item);
  assert.equal(validateProjectState(state).some((item) => item.includes('permission/runtime conflict')), true);
  assert.equal(canStartMission(state, 'WP-C'), false);
});

test('checkpoint increments revision and preserves history and UNKNOWN', () => {
  const state = fixture();
  const first = checkpointMission(state, {
    missionId: 'WP-PAUSED', stage: 'STAGE-X', at: '2026-09-12T01:00:00.000Z',
    summary: 'Checkpoint', filesChanged: ['a', 'a'], tests: ['test'], unresolved: ['unknown'], nextAction: 'inspect',
  });
  const second = checkpointMission(first, {
    missionId: 'WP-PAUSED', stage: 'STAGE-Y', at: '2026-09-12T02:00:00.000Z',
    summary: 'Checkpoint 2', filesChanged: [], tests: [], unresolved: [], nextAction: 'continue',
  });
  assert.equal(first.project.revision, 2);
  assert.deepEqual(first.checkpoints[0]?.filesChanged, ['a']);
  assert.equal(second.history.length, 2);
  assert.equal(second.history[0]?.id, first.history[0]?.id);
  assert.equal(second.workPackages.find((item) => item.id === 'WP-PAUSED')?.classification, 'UNRESOLVED');
  assert.equal(second.workPackages.find((item) => item.id === 'WP-PAUSED')?.doneCriteria[0]?.status, 'UNKNOWN');
});

test('DONE requires evidence and dependency completion unlocks the proper next mission', () => {
  const state = fixture();
  state.workPackages = state.workPackages.map((item) => item.id === 'WP-A'
    ? { ...item, status: 'ACTIVE' as const, doneCriteria: [{ ...item.doneCriteria[0]!, evidenceRefs: [] }] }
    : item.id === 'WP-C'
      ? { ...item, dependencies: ['WP-A'] }
      : item);
  state.currentMissionId = 'WP-A';
  state.nextAuthorizedMissionId = null;
  assert.deepEqual(validateProjectState(state), []);
  assert.throws(() => completeMission(state, 'WP-A', { at: '2026-09-12T01:00:00.000Z' }), /does not meet DONE criteria/);

  const evidenced = structuredClone(state);
  evidenced.workPackages = evidenced.workPackages.map((item) => item.id === 'WP-A'
    ? { ...item, doneCriteria: [{ ...item.doneCriteria[0]!, evidenceRefs: ['E-TEST'] }] }
    : item);
  const completed = completeMission(evidenced, 'WP-A', { at: '2026-09-12T01:00:00.000Z' });
  assert.equal(completed.nextAuthorizedMissionId, 'WP-C');
  assert.equal(completed.history.at(-1)?.toStatus, 'DONE');
});

test('blocking a mission records a durable blocker and clears active state', () => {
  const state = fixture();
  state.workPackages = state.workPackages.map((item) => item.id === 'WP-C' ? { ...item, status: 'ACTIVE' as const } : item);
  state.currentMissionId = 'WP-C';
  state.nextAuthorizedMissionId = null;
  const blocked = blockMission(state, 'WP-C', {
    at: '2026-09-12T01:00:00.000Z', blockerId: 'B-NEW', classification: 'UNRESOLVED',
    summary: 'Unknown must remain unknown', evidenceRefs: [],
  });
  assert.equal(blocked.currentMissionId, null);
  assert.equal(blocked.workPackages.find((item) => item.id === 'WP-C')?.status, 'BLOCKED');
  assert.equal(blocked.blockers.find((item) => item.id === 'B-NEW')?.classification, 'UNRESOLVED');
});

test('Reviewer PASS atomically records evidence, closes H3, checkpoints and derives no H4 authorization', () => {
  const completed = recordReviewerPass(h3ReviewFixture(), reviewerPassInput());
  const h3 = completed.workPackages.find((item) => item.id === 'H3');
  const review = completed.evidence.find((item) => item.id === 'E-H3-REVIEWER-PASS-R3');
  assert.equal(completed.project.revision, 11);
  assert.equal(completed.currentMissionId, null);
  assert.equal(completed.nextAuthorizedMissionId, null);
  assert.equal(h3?.status, 'DONE');
  assert.equal(h3?.classification, 'VERIFIED');
  assert.equal(h3?.doneCriteria.every((criterion) => criterion.status === 'MET'), true);
  assert.equal(h3?.doneCriteria.every((criterion) => criterion.evidenceRefs.includes(review!.id)), true);
  assert.equal(review?.reviewerPass?.authority, 'REVIEWER');
  assert.equal(review?.reviewerPass?.reviewedRevision, 10);
  assert.equal(review?.reviewerPass?.reviewedCheckpointId, 'CP-0010-H3-MISSION-READY');
  assert.equal(completed.checkpoints.at(-1)?.id, 'CP-0011-H3-VERIFIED');
  assert.equal(completed.history.at(-1)?.action, 'REVIEW_PASS');
  assert.deepEqual(validateProjectState(completed), []);
});

test('Reviewer PASS closes H4 against the exact four-file implementation fingerprint', () => {
  const completed = recordReviewerPass(h4ReviewFixture(), h4ReviewerPassInput());
  const h4 = completed.workPackages.find((item) => item.id === 'H4');
  const review = completed.evidence.find((item) => item.id === 'E-H4-REVIEWER-PASS');

  assert.equal(completed.project.revision, 13);
  assert.equal(h4?.status, 'DONE');
  assert.equal(h4?.classification, 'VERIFIED');
  assert.equal(h4?.doneCriteria.every((criterion) => criterion.status === 'MET'), true);
  assert.equal(review?.reviewerPass?.authority, 'REVIEWER');
  assert.equal(review?.reviewerPass?.reviewedRevision, 12);
  assert.equal(review?.reviewerPass?.reviewedCheckpointId, 'CP-0012-H4-MISSION-READY');
  assert.deepEqual(review?.reviewerPass?.implementation.files.map((file) => file.path), H4_IMPLEMENTATION_PATHS);
  assert.equal(completed.checkpoints.at(-1)?.id, 'CP-0013-H4-VERIFIED');
  assert.equal(completed.history.at(-1)?.action, 'REVIEW_PASS');
  assert.deepEqual(validateProjectState(completed), []);
});

test('Reviewer completion rejects Builder, wrong mission, non-PASS and stale state bindings', () => {
  const state = h3ReviewFixture();
  const input = reviewerPassInput();
  assert.throws(() => recordReviewerPass(state, { ...input, authority: 'BUILDER' }), /REVIEWER authority/);
  assert.throws(() => recordReviewerPass(state, { ...input, missionId: 'H5' }), /not supported for mission H5/);
  assert.throws(() => recordReviewerPass(state, { ...input, decision: 'REWORK' }), /decision PASS/);
  assert.throws(() => recordReviewerPass(state, { ...input, reviewedRevision: 9 }), /Stale review revision/);
  assert.throws(
    () => recordReviewerPass(state, { ...input, reviewedCheckpointId: 'CP-0009-H2.5-DONE' }),
    /Mismatched reviewed checkpoint/,
  );
  assert.throws(
    () => recordReviewerPass(state, { ...input, reviewedImplementationFingerprint: 'f'.repeat(64) }),
    /Mismatched reviewed implementation binding/,
  );
});

test('H4 Reviewer completion rejects Builder self-certification and stale or mismatched bindings', () => {
  const state = h4ReviewFixture();
  const input = h4ReviewerPassInput();
  assert.throws(() => recordReviewerPass(state, { ...input, authority: 'BUILDER' }), /REVIEWER authority/);
  assert.throws(() => recordReviewerPass(state, { ...input, reviewedRevision: 11 }), /Stale review revision/);
  assert.throws(
    () => recordReviewerPass(state, { ...input, reviewedCheckpointId: 'CP-0010-H3-MISSION-READY' }),
    /Mismatched reviewed checkpoint/,
  );
  assert.throws(
    () => recordReviewerPass(state, { ...input, reviewedImplementationFingerprint: '0'.repeat(64) }),
    /Mismatched reviewed implementation binding/,
  );
});

test('malformed persisted Reviewer evidence fails structural validation', () => {
  const completed = structuredClone(recordReviewerPass(h3ReviewFixture(), reviewerPassInput()));
  const review = completed.evidence.find((item) => item.reviewerPass)?.reviewerPass;
  assert.ok(review);
  review.implementation.files[0]!.sha256 = 'malformed';
  assert.equal(
    validateProjectState(completed).some((error) => error.includes('malformed implementation files')),
    true,
  );
});

test('persisted Reviewer PASS becomes stale when an H3 implementation file changes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'magicscript-h3-review-'));
  try {
    await mkdir(path.join(root, 'core/orchestrator'), { recursive: true });
    await mkdir(path.join(root, 'core/tests'), { recursive: true });
    await writeFile(path.join(root, 'core/orchestrator/contactability.ts'), 'implementation-v1\n');
    await writeFile(path.join(root, 'core/tests/contactability.test.ts'), 'tests-v1\n');
    const state = h3ReviewFixture();
    const currentImplementation = await captureMissionImplementationBinding(state, 'H3', root);
    const completed = recordReviewerPass(state, {
      ...reviewerPassInput(),
      currentImplementation,
      reviewedImplementationFingerprint: currentImplementation.digest,
    });
    assert.deepEqual(await validateReviewerImplementationBindings(completed, root), []);
    await writeFile(path.join(root, 'core/orchestrator/contactability.ts'), 'implementation-v2\n');
    assert.equal(
      (await validateReviewerImplementationBindings(completed, root))
        .some((error) => error.includes('stale implementation binding')),
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
