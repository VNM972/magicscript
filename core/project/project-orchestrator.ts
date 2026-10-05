import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deriveNextAuthorizedMissionIdUnchecked,
  type FactClassification,
  type ProjectImplementationBinding,
  type ProjectImplementationFileFingerprint,
  type ProjectCheckpoint,
  type ProjectMissionStatus,
  type ProjectState,
  type WorkPackage,
  validateProjectState,
} from './project-state';

export const CANONICAL_PROJECT_STATE_PATH = 'project/PROJECT_STATE.json';

export class ProjectStateError extends Error {
  constructor(message: string, readonly reasons: readonly string[] = []) {
    super(reasons.length ? `${message}: ${reasons.join('; ')}` : message);
    this.name = 'ProjectStateError';
  }
}

interface ReviewerPassMissionConfig {
  evidenceId: string;
  verifiedStage: string;
  checkpointSummary: string;
  reviewSummary: string;
  filesChanged: readonly string[];
  tests: readonly string[];
  unresolved: readonly string[];
  nextAction: string;
  implementationPaths?: readonly string[];
}

const REVIEWER_PASS_MISSIONS: Readonly<Record<string, ReviewerPassMissionConfig>> = {
  H3: {
    evidenceId: 'E-H3-REVIEWER-PASS-R3',
    verifiedStage: 'H3-VERIFIED',
    checkpointSummary: 'Independent Reviewer #3 PASS recorded; H3 Verified Phone Contactability canonically closed',
    reviewSummary: 'Independent Reviewer #3 returned PASS_AWAITING_CONTROL_PLANE_TRANSITION for H3',
    filesChanged: [
      'core/project/project-state.ts',
      'core/project/project-orchestrator.ts',
      'scripts/project-control.ts',
      'core/tests/project-control.test.ts',
      CANONICAL_PROJECT_STATE_PATH,
    ],
    tests: ['focused project-control Reviewer PASS and stale/mismatch tests PASS'],
    unresolved: ['B-H4-SCOPE-UNRESOLVED remains OPEN'],
    nextAction: 'Resolve the bounded H4 scope blocker before any H4 authorization',
  },
  H4: {
    evidenceId: 'E-H4-REVIEWER-PASS',
    verifiedStage: 'H4-VERIFIED',
    checkpointSummary: 'Reviewer PASS recorded; H4 Fail-Closed Operator Contactability Projection canonically closed',
    reviewSummary: 'Reviewer returned PASS_AWAITING_CONTROL_PLANE_TRANSITION for H4',
    filesChanged: [
      'apps/control-center/lib/api.ts',
      'apps/control-center/lib/api.test.ts',
      'apps/control-center/components/ProspectPipeline.tsx',
      'apps/control-center/components/ProspectPipeline.test.tsx',
      'core/project/project-orchestrator.ts',
      'core/tests/project-control.test.ts',
      CANONICAL_PROJECT_STATE_PATH,
    ],
    tests: [
      'focused H4 Control Center projection/component tests PASS 29/29',
      'targeted Control Center typecheck PASS',
      'focused project-control Reviewer PASS and stale/mismatch tests PASS',
    ],
    unresolved: [],
    nextAction: 'Record the bounded PILOT-01 controlled real research E2E validation mission; do not execute it',
    implementationPaths: [
      'apps/control-center/lib/api.ts',
      'apps/control-center/lib/api.test.ts',
      'apps/control-center/components/ProspectPipeline.tsx',
      'apps/control-center/components/ProspectPipeline.test.tsx',
    ],
  },
};

function cloneState(state: ProjectState): ProjectState {
  return structuredClone(state);
}

function withDerivedNext(state: ProjectState): ProjectState {
  return { ...state, nextAuthorizedMissionId: deriveNextAuthorizedMissionIdUnchecked(state) };
}

function checked(state: ProjectState): ProjectState {
  const errors = validateProjectState(state);
  if (errors.length) throw new ProjectStateError('Invalid project state', errors);
  return state;
}

function reviewerScopePaths(state: ProjectState, missionId: string): readonly string[] {
  const mission = state.workPackages.find((item) => item.id === missionId);
  if (!mission) throw new ProjectStateError(`Mission ${missionId} does not exist`);
  const configuredPaths = REVIEWER_PASS_MISSIONS[missionId]?.implementationPaths;
  if (configuredPaths) {
    return [...configuredPaths].sort((left, right) => left.localeCompare(right));
  }
  const evidence = new Map(state.evidence.map((item) => [item.id, item]));
  const paths = [...new Set(mission.evidenceRefs
    .filter((evidenceId) => evidenceId.startsWith(`E-${missionId}-`))
    .map((evidenceId) => evidence.get(evidenceId))
    .filter((item) => item?.kind === 'CODE' || item?.kind === 'TEST')
    .map((item) => item!.reference))]
    .sort((left, right) => left.localeCompare(right));
  if (paths.length === 0) {
    throw new ProjectStateError(`Mission ${missionId} has no repository-native implementation evidence scope`);
  }
  return paths;
}

export function implementationBindingFromFileHashes(
  fileFingerprints: readonly ProjectImplementationFileFingerprint[],
): ProjectImplementationBinding {
  const files = fileFingerprints
    .map((file) => ({ path: file.path.replaceAll('\\', '/'), sha256: file.sha256.toLowerCase() }))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (files.length === 0 || new Set(files.map((file) => file.path)).size !== files.length ||
      files.some((file) => !file.path || file.path.startsWith('/') || file.path.split('/').includes('..') ||
        !/^[a-f0-9]{64}$/.test(file.sha256))) {
    throw new ProjectStateError('Malformed implementation file fingerprints');
  }
  const digest = createHash('sha256')
    .update(files.map((file) => `${file.path}\0${file.sha256}\n`).join(''), 'utf8')
    .digest('hex');
  return { algorithm: 'SHA-256', digest, files };
}

export async function captureMissionImplementationBinding(
  state: ProjectState,
  missionId: string,
  repositoryRoot = process.cwd(),
): Promise<ProjectImplementationBinding> {
  checked(state);
  const root = path.resolve(repositoryRoot);
  const files = await Promise.all(reviewerScopePaths(state, missionId).map(async (filePath) => {
    const absolutePath = path.resolve(root, filePath);
    const relativePath = path.relative(root, absolutePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new ProjectStateError(`Implementation evidence is outside repository: ${filePath}`);
    }
    const content = await readFile(absolutePath);
    return {
      path: filePath,
      sha256: createHash('sha256').update(content).digest('hex'),
    };
  }));
  return implementationBindingFromFileHashes(files);
}

export async function validateReviewerImplementationBindings(
  state: ProjectState,
  repositoryRoot = process.cwd(),
): Promise<readonly string[]> {
  const errors: string[] = [];
  for (const evidence of state.evidence.filter((item) => item.reviewerPass)) {
    const review = evidence.reviewerPass!;
    try {
      const current = await captureMissionImplementationBinding(state, review.missionId, repositoryRoot);
      if (current.digest !== review.implementation.digest ||
          JSON.stringify(current.files) !== JSON.stringify(review.implementation.files)) {
        errors.push(`stale implementation binding: ${evidence.id}`);
      }
    } catch (error) {
      errors.push(`unable to verify implementation binding ${evidence.id}: ${String(error)}`);
    }
  }
  return errors;
}

export async function loadProjectState(
  statePath = path.resolve(CANONICAL_PROJECT_STATE_PATH),
): Promise<ProjectState> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(statePath, 'utf8'));
  } catch (error) {
    throw new ProjectStateError(`Unable to load project state at ${statePath}`, [String(error)]);
  }
  const errors = validateProjectState(parsed);
  if (errors.length) throw new ProjectStateError(`Invalid project state at ${statePath}`, errors);
  const state = parsed as ProjectState;
  const bindingErrors = await validateReviewerImplementationBindings(
    state,
    path.resolve(path.dirname(statePath), '..'),
  );
  if (bindingErrors.length) {
    throw new ProjectStateError(`Invalid project state at ${statePath}`, bindingErrors);
  }
  return state;
}

export async function writeProjectState(
  state: ProjectState,
  statePath = path.resolve(CANONICAL_PROJECT_STATE_PATH),
): Promise<void> {
  checked(state);
  const temporaryPath = `${statePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, statePath);
}

export function getCurrentMission(state: ProjectState): WorkPackage | null {
  checked(state);
  return state.currentMissionId
    ? state.workPackages.find((mission) => mission.id === state.currentMissionId) ?? null
    : null;
}

export function missionAuthorizationReasons(state: ProjectState, missionId: string): readonly string[] {
  const structuralErrors = validateProjectState(state);
  if (structuralErrors.length) return [`project state invalid: ${structuralErrors.join('; ')}`];
  const mission = state.workPackages.find((item) => item.id === missionId);
  if (!mission) return [`mission ${missionId} does not exist`];
  if (state.currentMissionId) return [`mission ${state.currentMissionId} is already ACTIVE`];
  if (mission.status !== 'READY') return [`mission status is ${mission.status}, not READY`];

  const reasons: string[] = [];
  for (const dependencyId of mission.dependencies) {
    if (state.workPackages.find((item) => item.id === dependencyId)?.status !== 'DONE') {
      reasons.push(`dependency ${dependencyId} is not DONE`);
    }
  }
  for (const permissionId of mission.requiredPermissions) {
    if (!state.permissions.find((item) => item.id === permissionId)?.allowed) {
      reasons.push(`permission ${permissionId} is not allowed`);
    }
  }
  for (const blockerId of mission.blockerRefs) {
    const blocker = state.blockers.find((item) => item.id === blockerId);
    if (blocker?.status !== 'RESOLVED') reasons.push(`blocker ${blockerId} is ${blocker?.status ?? 'missing'}`);
  }
  for (const requirement of mission.requiredRuntimeSafety) {
    const observation = state.runtimeSafety.find((item) => item.control === requirement.control);
    if (observation?.state !== requirement.state) {
      reasons.push(`runtime safety ${requirement.control} is ${observation?.state ?? 'UNKNOWN'}, requires ${requirement.state}`);
    }
  }
  return reasons;
}

export function canStartMission(state: ProjectState, missionId: string): boolean {
  return missionAuthorizationReasons(state, missionId).length === 0;
}

export function assertMissionAuthorized(state: ProjectState, missionId: string): void {
  const reasons = missionAuthorizationReasons(state, missionId);
  if (reasons.length) throw new ProjectStateError(`Mission ${missionId} is not authorized`, reasons);
}

export function getNextAuthorizedMission(state: ProjectState): WorkPackage | null {
  checked(state);
  return state.nextAuthorizedMissionId
    ? state.workPackages.find((mission) => mission.id === state.nextAuthorizedMissionId) ?? null
    : null;
}

function nextRevision(state: ProjectState): number {
  return state.project.revision + 1;
}

function historyId(revision: number, action: string, missionId: string): string {
  return `H-${String(revision).padStart(4, '0')}-${action}-${missionId}`;
}

export interface CheckpointMissionInput {
  missionId: string;
  stage: string;
  at: string;
  summary: string;
  filesChanged: readonly string[];
  tests: readonly string[];
  unresolved: readonly string[];
  nextAction: string;
}

export function checkpointMission(state: ProjectState, input: CheckpointMissionInput): ProjectState {
  checked(state);
  const mission = state.workPackages.find((item) => item.id === input.missionId);
  if (!mission) throw new ProjectStateError(`Mission ${input.missionId} does not exist`);
  const revision = nextRevision(state);
  const checkpoint: ProjectCheckpoint = {
    id: `CP-${String(revision).padStart(4, '0')}-${input.stage}`,
    revision,
    missionId: input.missionId,
    stage: input.stage,
    createdAt: input.at,
    summary: input.summary,
    filesChanged: [...new Set(input.filesChanged)],
    tests: [...new Set(input.tests)],
    unresolved: [...new Set(input.unresolved)],
    nextAction: input.nextAction,
  };
  if (state.checkpoints.some((item) => item.id === checkpoint.id)) {
    throw new ProjectStateError(`Checkpoint ${checkpoint.id} already exists`);
  }
  const updated = cloneState(state);
  updated.project.revision = revision;
  updated.checkpoints = [...updated.checkpoints, checkpoint];
  updated.workPackages = updated.workPackages.map((item) => item.id === mission.id
    ? { ...item, checkpointRefs: [...item.checkpointRefs, checkpoint.id] }
    : item);
  updated.history = [...updated.history, {
    id: historyId(revision, 'CHECKPOINT', mission.id),
    revision,
    at: input.at,
    action: 'CHECKPOINT',
    missionId: mission.id,
    fromStatus: mission.status,
    toStatus: mission.status,
    checkpointId: checkpoint.id,
  }];
  return checked(withDerivedNext(updated));
}

export interface ReviewerPassInput {
  missionId: string;
  authority: string;
  decision: string;
  result: string;
  reviewedRevision: number;
  reviewedCheckpointId: string;
  reviewedImplementationFingerprint: string;
  currentImplementation: ProjectImplementationBinding;
  at: string;
}

export function recordReviewerPass(state: ProjectState, input: ReviewerPassInput): ProjectState {
  checked(state);
  const config = REVIEWER_PASS_MISSIONS[input.missionId];
  if (!config) throw new ProjectStateError(`Reviewer PASS is not supported for mission ${input.missionId}`);
  if (input.authority !== 'REVIEWER') throw new ProjectStateError('Reviewer completion requires REVIEWER authority');
  if (input.decision !== 'PASS') throw new ProjectStateError('Reviewer completion requires decision PASS');
  if (input.result !== 'PASS_AWAITING_CONTROL_PLANE_TRANSITION') {
    throw new ProjectStateError('Reviewer completion has an invalid review result');
  }
  if (state.currentMissionId !== null) {
    throw new ProjectStateError(`Mission ${state.currentMissionId} is already ACTIVE`);
  }
  const mission = state.workPackages.find((item) => item.id === input.missionId);
  if (!mission) throw new ProjectStateError(`Mission ${input.missionId} does not exist`);
  if (mission.status !== 'READY') {
    throw new ProjectStateError(`Mission ${input.missionId} is ${mission.status}, not READY`);
  }
  if (state.project.revision !== input.reviewedRevision) {
    throw new ProjectStateError(
      `Stale review revision: reviewed=${input.reviewedRevision} current=${state.project.revision}`,
    );
  }
  const reviewedCheckpoint = state.checkpoints.find((item) => item.id === input.reviewedCheckpointId);
  if (!reviewedCheckpoint || reviewedCheckpoint.missionId !== input.missionId ||
      reviewedCheckpoint.revision !== input.reviewedRevision ||
      !mission.checkpointRefs.includes(input.reviewedCheckpointId)) {
    throw new ProjectStateError('Mismatched reviewed checkpoint');
  }
  const currentImplementation = implementationBindingFromFileHashes(input.currentImplementation.files);
  if (currentImplementation.digest !== input.currentImplementation.digest ||
      currentImplementation.digest !== input.reviewedImplementationFingerprint) {
    throw new ProjectStateError('Mismatched reviewed implementation binding');
  }
  const expectedPaths = reviewerScopePaths(state, input.missionId);
  if (JSON.stringify(currentImplementation.files.map((file) => file.path)) !== JSON.stringify(expectedPaths)) {
    throw new ProjectStateError('Mismatched reviewed implementation scope');
  }

  const evidenceId = config.evidenceId;
  if (state.evidence.some((item) => item.id === evidenceId)) {
    throw new ProjectStateError(`Review evidence ${evidenceId} already exists`);
  }
  const revision = nextRevision(state);
  const checkpoint: ProjectCheckpoint = {
    id: `CP-${String(revision).padStart(4, '0')}-${input.missionId}-VERIFIED`,
    revision,
    missionId: input.missionId,
    stage: config.verifiedStage,
    createdAt: input.at,
    summary: config.checkpointSummary,
    filesChanged: [...config.filesChanged],
    tests: [...config.tests],
    unresolved: [...config.unresolved],
    nextAction: config.nextAction,
  };
  const updated = cloneState(state);
  updated.project.revision = revision;
  updated.evidence = [...updated.evidence, {
    id: evidenceId,
    classification: 'VERIFIED',
    kind: 'REPORT',
    reference: `${CANONICAL_PROJECT_STATE_PATH}#evidence/${evidenceId}`,
    summary: config.reviewSummary,
    reviewerPass: {
      authority: 'REVIEWER',
      missionId: input.missionId,
      decision: 'PASS',
      result: 'PASS_AWAITING_CONTROL_PLANE_TRANSITION',
      reviewedRevision: input.reviewedRevision,
      reviewedCheckpointId: input.reviewedCheckpointId,
      implementation: currentImplementation,
      recordedAt: input.at,
    },
  }];
  updated.checkpoints = [...updated.checkpoints, checkpoint];
  updated.workPackages = updated.workPackages.map((item) => item.id === input.missionId
    ? {
        ...item,
        status: 'DONE',
        classification: 'VERIFIED',
        doneCriteria: item.doneCriteria.map((criterion) => ({
          ...criterion,
          status: 'MET',
          evidenceRefs: [...new Set([...criterion.evidenceRefs, evidenceId])],
        })),
        evidenceRefs: [...new Set([...item.evidenceRefs, evidenceId])],
        checkpointRefs: [...item.checkpointRefs, checkpoint.id],
      }
    : item);
  updated.history = [...updated.history, {
    id: historyId(revision, 'REVIEW_PASS', input.missionId),
    revision,
    at: input.at,
    action: 'REVIEW_PASS',
    missionId: input.missionId,
    fromStatus: mission.status,
    toStatus: 'DONE',
    checkpointId: checkpoint.id,
  }];
  return checked(withDerivedNext(updated));
}

export interface MissionTransitionInput {
  at: string;
}

export function startMission(
  state: ProjectState,
  missionId: string,
  input: MissionTransitionInput,
): ProjectState {
  checked(state);
  assertMissionAuthorized(state, missionId);
  const revision = nextRevision(state);
  const updated = cloneState(state);
  updated.project.revision = revision;
  updated.currentMissionId = missionId;
  updated.workPackages = updated.workPackages.map((item) => item.id === missionId
    ? { ...item, status: 'ACTIVE' }
    : item);
  updated.history = [...updated.history, {
    id: historyId(revision, 'START', missionId),
    revision,
    at: input.at,
    action: 'START',
    missionId,
    fromStatus: 'READY',
    toStatus: 'ACTIVE',
  }];
  return checked(withDerivedNext(updated));
}

export function completeMission(
  state: ProjectState,
  missionId: string,
  input: MissionTransitionInput,
): ProjectState {
  checked(state);
  const mission = state.workPackages.find((item) => item.id === missionId);
  if (!mission) throw new ProjectStateError(`Mission ${missionId} does not exist`);
  if (mission.status !== 'ACTIVE') throw new ProjectStateError(`Mission ${missionId} is ${mission.status}, not ACTIVE`);
  const incomplete = mission.doneCriteria.filter((criterion) =>
    criterion.status !== 'MET' || criterion.evidenceRefs.length === 0,
  );
  if (incomplete.length) {
    throw new ProjectStateError(`Mission ${missionId} does not meet DONE criteria`, incomplete.map((item) => item.id));
  }
  const revision = nextRevision(state);
  const updated = cloneState(state);
  updated.project.revision = revision;
  updated.currentMissionId = null;
  updated.workPackages = updated.workPackages.map((item) => item.id === missionId
    ? { ...item, status: 'DONE', classification: 'VERIFIED' }
    : item);
  updated.history = [...updated.history, {
    id: historyId(revision, 'COMPLETE', missionId),
    revision,
    at: input.at,
    action: 'COMPLETE',
    missionId,
    fromStatus: mission.status,
    toStatus: 'DONE',
  }];
  return checked(withDerivedNext(updated));
}

export interface BlockMissionInput extends MissionTransitionInput {
  blockerId: string;
  classification: FactClassification;
  summary: string;
  evidenceRefs: readonly string[];
}

export function blockMission(state: ProjectState, missionId: string, input: BlockMissionInput): ProjectState {
  checked(state);
  const mission = state.workPackages.find((item) => item.id === missionId);
  if (!mission) throw new ProjectStateError(`Mission ${missionId} does not exist`);
  if (mission.status !== 'ACTIVE' && mission.status !== 'READY') {
    throw new ProjectStateError(`Mission ${missionId} cannot be blocked from ${mission.status}`);
  }
  const revision = nextRevision(state);
  const updated = cloneState(state);
  updated.project.revision = revision;
  if (updated.currentMissionId === missionId) updated.currentMissionId = null;
  updated.blockers = [...updated.blockers, {
    id: input.blockerId,
    status: 'OPEN',
    classification: input.classification,
    summary: input.summary,
    evidenceRefs: [...input.evidenceRefs],
  }];
  updated.workPackages = updated.workPackages.map((item) => item.id === missionId
    ? { ...item, status: 'BLOCKED', blockerRefs: [...item.blockerRefs, input.blockerId] }
    : item);
  updated.history = [...updated.history, {
    id: historyId(revision, 'BLOCK', missionId),
    revision,
    at: input.at,
    action: 'BLOCK',
    missionId,
    fromStatus: mission.status,
    toStatus: 'BLOCKED',
  }];
  return checked(withDerivedNext(updated));
}
