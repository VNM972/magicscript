import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compactOvernightSessionState,
  createOvernightSessionState,
  refineReadyBacklog,
  selectBestReadyPackage,
  validateMissionProposal,
  validateOvernightSessionState,
} from '../overnight';

const verifier = {
  id: 'verify-local',
  requiredChecks: ['targeted-test', 'proof-record'],
  maxDurationMinutes: 30,
} as const;

const input = {
  spec: {
    id: 'overnight',
    objective: 'Run safe local work packages',
    allowedScope: ['core', 'tests', 'runtime-state'],
    environmentFingerprint: 'env-v1',
  },
  backlog: [
    {
      id: 'WP-01',
      title: 'Hardening',
      priority: 'P0' as const,
      status: 'DONE' as const,
      objective: 'Close safety gaps',
      scope: ['core'],
      dependencies: [],
      verifier,
    },
    {
      id: 'WP-02',
      title: 'Runtime',
      priority: 'P1' as const,
      status: 'READY' as const,
      objective: 'Make runtime resumable',
      scope: ['runtime-state'],
      dependencies: ['WP-01'],
      verifier,
      subtasks: [
        { id: 'state', title: 'State', objective: 'Persist state', scope: ['runtime-state'] },
        { id: 'resume', title: 'Resume', objective: 'Verify resume', scope: ['runtime-state'] },
      ],
    },
    {
      id: 'WP-03',
      title: 'Waiting',
      priority: 'P1' as const,
      status: 'READY' as const,
      objective: 'Wait for dependency',
      scope: ['core'],
      dependencies: ['WP-99'],
      verifier,
    },
  ],
} satisfies Parameters<typeof refineReadyBacklog>[0];

test('refines READY backlog into small deterministic packages', () => {
  const result = refineReadyBacklog(input);
  assert.deepEqual(result.packages.map((item) => item.id), ['WP-02:resume', 'WP-02:state']);
  assert.deepEqual(result.deferred, ['WP-03']);
  assert.equal(selectBestReadyPackage(result.packages)?.id, 'WP-02:resume');
});

test('rejects scope expansion and verifier weakening', () => {
  const result = validateMissionProposal(input, {
    sourceId: 'WP-02',
    title: 'Expanded',
    objective: 'Do more',
    scope: ['runtime-state', 'production'],
    verifier: { id: 'other', requiredChecks: ['targeted-test'], maxDurationMinutes: 60 },
    environmentFingerprint: 'changed-env',
    environmentChanges: ['enable-production'],
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasons.includes('ENVIRONMENT is immutable'), true);
  assert.equal(result.reasons.includes('scope expands beyond SPEC and source backlog item'), true);
  assert.equal(result.reasons.includes('VERIFIER required check removed'), true);
  assert.equal(result.reasons.includes('VERIFIER timeout increased'), true);
});

test('rejects UNKNOWN to PASS promotion', () => {
  const unknownInput = {
    ...input,
    backlog: input.backlog.map((item) =>
      item.id === 'WP-02' ? { ...item, reviewStatus: 'UNKNOWN' as const } : item,
    ),
  };
  const result = validateMissionProposal(unknownInput, {
    sourceId: 'WP-02',
    title: 'Review',
    objective: 'Review only',
    scope: ['runtime-state'],
    verifier,
    expectedReviewStatus: 'PASS',
  });

  assert.equal(result.accepted, false);
  assert.equal(
    result.reasons.includes('UNKNOWN or blocked review cannot become PASS through refinement'),
    true,
  );
});

test('compacts active state without deleting proof references', () => {
  const state = createOvernightSessionState({
    sessionId: 'session-1',
    startedAt: '2026-09-02T20:00:00.000Z',
    baseHead: 'abc',
    baseBranch: 'main',
    safetyState: 'EMAIL_DISABLED',
    next: 'WP-02',
  });
  const compacted = compactOvernightSessionState({
    ...state,
    ready: ['WP-02', 'WP-02'],
    proofs: [{ id: 'p1', kind: 'test', reference: 'report.json', summary: 'pass' }],
  });

  assert.deepEqual(compacted.ready, ['WP-02']);
  assert.equal(compacted.proofs[0]?.reference, 'report.json');
  assert.deepEqual(validateOvernightSessionState(compacted), []);
});
