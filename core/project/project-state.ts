export const PROJECT_STATE_SCHEMA_VERSION = 1 as const;

export type FactClassification = 'VERIFIED' | 'OBSERVED' | 'INFERRED' | 'UNRESOLVED';
export type ProjectMissionStatus =
  | 'READY'
  | 'ACTIVE'
  | 'PAUSED'
  | 'BLOCKED'
  | 'DONE'
  | 'UNRESOLVED';
export type ProjectPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type CriterionStatus = 'MET' | 'UNMET' | 'UNKNOWN';
export type RuntimeSafetyState = 'ENABLED' | 'DISABLED' | 'UNKNOWN';
export type BlockerStatus = 'OPEN' | 'RESOLVED' | 'UNKNOWN';

export const PROJECT_PERMISSION_IDS = [
  'LOCAL_READ',
  'LOCAL_WRITE',
  'LOCAL_TEST',
  'REMOTE_PUSH',
  'PRODUCTION_DEPLOY',
  'REAL_OUTREACH',
  'REAL_EMAIL_SEND',
  'REAL_WHATSAPP_SEND',
  'PAID_API',
] as const;

export type ProjectPermissionId = (typeof PROJECT_PERMISSION_IDS)[number];

export interface ProjectIdentity {
  id: string;
  name: string;
  version: string;
  revision: number;
  phase: string;
}

export interface ProjectImplementationFileFingerprint {
  path: string;
  sha256: string;
}

export interface ProjectImplementationBinding {
  algorithm: 'SHA-256';
  digest: string;
  files: readonly ProjectImplementationFileFingerprint[];
}

export interface ReviewerPassBinding {
  authority: 'REVIEWER';
  missionId: string;
  decision: 'PASS';
  result: 'PASS_AWAITING_CONTROL_PLANE_TRANSITION';
  reviewedRevision: number;
  reviewedCheckpointId: string;
  implementation: ProjectImplementationBinding;
  recordedAt: string;
}

export interface ProjectEvidence {
  id: string;
  classification: FactClassification;
  kind: 'CODE' | 'CONFIG' | 'TEST' | 'DATABASE' | 'GIT' | 'REPORT';
  reference: string;
  summary: string;
  reviewerPass?: ReviewerPassBinding;
}

export interface ProjectPermission {
  id: ProjectPermissionId;
  allowed: boolean;
  classification: FactClassification;
  evidenceRefs: readonly string[];
}

export interface RuntimeSafetyObservation {
  id: string;
  control: ProjectPermissionId;
  state: RuntimeSafetyState;
  classification: FactClassification;
  evidenceRefs: readonly string[];
  summary: string;
}

export interface ProjectBlocker {
  id: string;
  status: BlockerStatus;
  classification: FactClassification;
  summary: string;
  evidenceRefs: readonly string[];
}

export interface DoneCriterion {
  id: string;
  description: string;
  status: CriterionStatus;
  evidenceRefs: readonly string[];
}

export interface WorkPackage {
  id: string;
  title: string;
  priority: ProjectPriority;
  status: ProjectMissionStatus;
  classification: FactClassification;
  dependencies: readonly string[];
  requiredPermissions: readonly ProjectPermissionId[];
  requiredRuntimeSafety: readonly {
    control: ProjectPermissionId;
    state: RuntimeSafetyState;
  }[];
  doneCriteria: readonly DoneCriterion[];
  evidenceRefs: readonly string[];
  blockerRefs: readonly string[];
  checkpointRefs: readonly string[];
}

export interface FrozenDecision {
  id: string;
  classification: FactClassification;
  statement: string;
  evidenceRefs: readonly string[];
}

export interface ProjectCheckpoint {
  id: string;
  revision: number;
  missionId: string;
  stage: string;
  createdAt: string;
  summary: string;
  filesChanged: readonly string[];
  tests: readonly string[];
  unresolved: readonly string[];
  nextAction: string;
}

export interface ProjectHistoryEntry {
  id: string;
  revision: number;
  at: string;
  action: 'START' | 'CHECKPOINT' | 'COMPLETE' | 'BLOCK' | 'REVIEW_PASS';
  missionId: string;
  fromStatus: ProjectMissionStatus;
  toStatus: ProjectMissionStatus;
  checkpointId?: string;
}

export interface ProjectState {
  schemaVersion: typeof PROJECT_STATE_SCHEMA_VERSION;
  project: ProjectIdentity;
  currentMissionId: string | null;
  nextAuthorizedMissionId: string | null;
  workPackages: readonly WorkPackage[];
  frozenDecisions: readonly FrozenDecision[];
  permissions: readonly ProjectPermission[];
  runtimeSafety: readonly RuntimeSafetyObservation[];
  blockers: readonly ProjectBlocker[];
  evidence: readonly ProjectEvidence[];
  checkpoints: readonly ProjectCheckpoint[];
  history: readonly ProjectHistoryEntry[];
}

const classifications = new Set<FactClassification>([
  'VERIFIED', 'OBSERVED', 'INFERRED', 'UNRESOLVED',
]);
const missionStatuses = new Set<ProjectMissionStatus>([
  'READY', 'ACTIVE', 'PAUSED', 'BLOCKED', 'DONE', 'UNRESOLVED',
]);
const priorities = new Set<ProjectPriority>(['P0', 'P1', 'P2', 'P3', 'P4']);
const criterionStatuses = new Set<CriterionStatus>(['MET', 'UNMET', 'UNKNOWN']);
const blockerStatuses = new Set<BlockerStatus>(['OPEN', 'RESOLVED', 'UNKNOWN']);
const runtimeStates = new Set<RuntimeSafetyState>(['ENABLED', 'DISABLED', 'UNKNOWN']);
const permissionIds = new Set<string>(PROJECT_PERMISSION_IDS);
const priorityRank: Record<ProjectPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

function duplicateIds<T extends { id: string }>(label: string, values: readonly T[], errors: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (!value.id?.trim()) errors.push(`${label} id is required`);
    else if (seen.has(value.id)) errors.push(`duplicate ${label} id: ${value.id}`);
    seen.add(value.id);
  }
}

function validReference(reference: string): boolean {
  return reference.length > 0 &&
    !reference.includes('\\') &&
    !reference.startsWith('/') &&
    !reference.split('/').includes('..');
}

function validSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function unresolvedAuthorizationReasons(state: ProjectState, mission: WorkPackage): string[] {
  const reasons: string[] = [];
  const packages = new Map(state.workPackages.map((item) => [item.id, item]));
  const permissions = new Map(state.permissions.map((item) => [item.id, item]));
  const blockers = new Map(state.blockers.map((item) => [item.id, item]));
  const runtime = new Map(state.runtimeSafety.map((item) => [item.control, item]));

  if (mission.status !== 'READY') reasons.push(`mission status is ${mission.status}, not READY`);
  for (const dependencyId of mission.dependencies) {
    const dependency = packages.get(dependencyId);
    if (!dependency || dependency.status !== 'DONE') reasons.push(`dependency ${dependencyId} is not DONE`);
  }
  for (const permissionId of mission.requiredPermissions) {
    const permission = permissions.get(permissionId);
    if (!permission?.allowed) reasons.push(`permission ${permissionId} is not allowed`);
  }
  for (const blockerId of mission.blockerRefs) {
    const blocker = blockers.get(blockerId);
    if (!blocker || blocker.status !== 'RESOLVED') reasons.push(`blocker ${blockerId} is not RESOLVED`);
  }
  for (const requirement of mission.requiredRuntimeSafety) {
    const observation = runtime.get(requirement.control);
    if (!observation || observation.state !== requirement.state) {
      reasons.push(
        `runtime safety ${requirement.control} is ${observation?.state ?? 'UNKNOWN'}, requires ${requirement.state}`,
      );
    }
  }
  return reasons;
}

export function deriveNextAuthorizedMissionIdUnchecked(state: ProjectState): string | null {
  if (state.workPackages.some((mission) => mission.status === 'ACTIVE')) return null;
  return [...state.workPackages]
    .filter((mission) => unresolvedAuthorizationReasons(state, mission).length === 0)
    .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority] || left.id.localeCompare(right.id))[0]?.id ?? null;
}

export function validateProjectState(input: unknown): readonly string[] {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return ['project state must be an object'];
  const state = input as Partial<ProjectState>;
  if (state.schemaVersion !== PROJECT_STATE_SCHEMA_VERSION) errors.push('unsupported schemaVersion');
  if (!state.project || typeof state.project !== 'object') return [...errors, 'project identity is required'];
  if (!state.project.id?.trim()) errors.push('project.id is required');
  if (!state.project.name?.trim()) errors.push('project.name is required');
  if (!state.project.version?.trim()) errors.push('project.version is required');
  if (!Number.isInteger(state.project.revision) || state.project.revision < 1) errors.push('project.revision must be a positive integer');
  if (!state.project.phase?.trim()) errors.push('project.phase is required');

  const arrayFields = [
    'workPackages', 'frozenDecisions', 'permissions', 'runtimeSafety', 'blockers',
    'evidence', 'checkpoints', 'history',
  ] as const;
  for (const field of arrayFields) if (!Array.isArray(state[field])) errors.push(`${field} must be an array`);
  if (errors.some((error) => error.endsWith('must be an array'))) return errors;

  const complete = state as ProjectState;
  duplicateIds('work package', complete.workPackages, errors);
  duplicateIds('frozen decision', complete.frozenDecisions, errors);
  duplicateIds('permission', complete.permissions, errors);
  duplicateIds('runtime safety observation', complete.runtimeSafety, errors);
  duplicateIds('blocker', complete.blockers, errors);
  duplicateIds('evidence', complete.evidence, errors);
  duplicateIds('checkpoint', complete.checkpoints, errors);
  duplicateIds('history', complete.history, errors);

  const packages = new Map(complete.workPackages.map((item) => [item.id, item]));
  const evidence = new Set(complete.evidence.map((item) => item.id));
  const blockers = new Set(complete.blockers.map((item) => item.id));
  const checkpoints = new Set(complete.checkpoints.map((item) => item.id));
  const permissions = new Map(complete.permissions.map((item) => [item.id, item]));

  for (const item of complete.evidence) {
    if (!classifications.has(item.classification)) errors.push(`invalid evidence classification: ${item.id}`);
    if (!validReference(item.reference)) errors.push(`invalid evidence reference: ${item.id}`);
    if (item.reviewerPass) {
      const review = item.reviewerPass;
      const implementation = review.implementation;
      if (item.kind !== 'REPORT' || item.classification !== 'VERIFIED') {
        errors.push(`review evidence ${item.id} must be a VERIFIED REPORT`);
      }
      if (review.authority !== 'REVIEWER') errors.push(`invalid review authority: ${item.id}`);
      if (review.decision !== 'PASS') errors.push(`invalid review decision: ${item.id}`);
      if (review.result !== 'PASS_AWAITING_CONTROL_PLANE_TRANSITION') {
        errors.push(`invalid review result: ${item.id}`);
      }
      if (!Number.isInteger(review.reviewedRevision) || review.reviewedRevision < 1 ||
          review.reviewedRevision >= complete.project.revision) {
        errors.push(`invalid reviewed revision: ${item.id}`);
      }
      const reviewedMission = packages.get(review.missionId);
      const reviewedCheckpoint = complete.checkpoints.find((checkpoint) =>
        checkpoint.id === review.reviewedCheckpointId,
      );
      if (!reviewedMission) errors.push(`review ${item.id} references missing mission`);
      if (!reviewedCheckpoint || reviewedCheckpoint.missionId !== review.missionId ||
          reviewedCheckpoint.revision !== review.reviewedRevision) {
        errors.push(`review ${item.id} has mismatched checkpoint binding`);
      }
      if (!implementation || implementation.algorithm !== 'SHA-256' ||
          !validSha256(implementation.digest) || !Array.isArray(implementation.files) ||
          implementation.files.length === 0) {
        errors.push(`review ${item.id} has malformed implementation binding`);
      } else {
        const paths = implementation.files.map((file) => file.path);
        const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right));
        if (new Set(paths).size !== paths.length || paths.some((filePath) => !validReference(filePath)) ||
            paths.some((filePath, index) => filePath !== sortedPaths[index]) ||
            implementation.files.some((file) => !validSha256(file.sha256))) {
          errors.push(`review ${item.id} has malformed implementation files`);
        }
      }
      if (!review.recordedAt?.trim()) errors.push(`review ${item.id} recordedAt is required`);
    }
  }
  const validateEvidenceRefs = (owner: string, refs: readonly string[]) => {
    for (const ref of refs) if (!evidence.has(ref)) errors.push(`${owner} references missing evidence: ${ref}`);
  };
  for (const permission of complete.permissions) {
    if (!permissionIds.has(permission.id)) errors.push(`invalid permission id: ${permission.id}`);
    if (!classifications.has(permission.classification)) errors.push(`invalid permission classification: ${permission.id}`);
    validateEvidenceRefs(`permission ${permission.id}`, permission.evidenceRefs);
  }
  for (const required of PROJECT_PERMISSION_IDS) {
    if (!permissions.has(required)) errors.push(`missing permission: ${required}`);
  }
  if (permissions.get('REAL_OUTREACH')?.allowed === false) {
    if (permissions.get('REAL_EMAIL_SEND')?.allowed) errors.push('contradictory permissions: REAL_OUTREACH=false and REAL_EMAIL_SEND=true');
    if (permissions.get('REAL_WHATSAPP_SEND')?.allowed) errors.push('contradictory permissions: REAL_OUTREACH=false and REAL_WHATSAPP_SEND=true');
  }
  for (const observation of complete.runtimeSafety) {
    if (!permissionIds.has(observation.control)) errors.push(`invalid runtime safety control: ${observation.id}`);
    if (!runtimeStates.has(observation.state)) errors.push(`invalid runtime safety state: ${observation.id}`);
    if (!classifications.has(observation.classification)) errors.push(`invalid runtime safety classification: ${observation.id}`);
    validateEvidenceRefs(`runtime safety ${observation.id}`, observation.evidenceRefs);
    if (permissions.get(observation.control)?.allowed && observation.state !== 'ENABLED') {
      errors.push(`permission/runtime conflict: ${observation.control} allowed while runtime is ${observation.state}`);
    }
  }
  for (const blocker of complete.blockers) {
    if (!blockerStatuses.has(blocker.status)) errors.push(`invalid blocker status: ${blocker.id}`);
    if (!classifications.has(blocker.classification)) errors.push(`invalid blocker classification: ${blocker.id}`);
    validateEvidenceRefs(`blocker ${blocker.id}`, blocker.evidenceRefs);
  }
  for (const decision of complete.frozenDecisions) {
    if (!classifications.has(decision.classification)) errors.push(`invalid frozen decision classification: ${decision.id}`);
    validateEvidenceRefs(`frozen decision ${decision.id}`, decision.evidenceRefs);
  }
  for (const mission of complete.workPackages) {
    if (!missionStatuses.has(mission.status)) errors.push(`invalid lifecycle state: ${mission.id}`);
    if (!classifications.has(mission.classification)) errors.push(`invalid mission classification: ${mission.id}`);
    if (!priorities.has(mission.priority)) errors.push(`invalid mission priority: ${mission.id}`);
    for (const dependency of mission.dependencies) {
      if (!packages.has(dependency)) errors.push(`mission ${mission.id} has missing dependency: ${dependency}`);
      if (dependency === mission.id) errors.push(`mission ${mission.id} depends on itself`);
    }
    for (const permission of mission.requiredPermissions) {
      if (!permissionIds.has(permission)) errors.push(`mission ${mission.id} has invalid permission: ${permission}`);
    }
    for (const requirement of mission.requiredRuntimeSafety) {
      if (!permissionIds.has(requirement.control) || !runtimeStates.has(requirement.state)) {
        errors.push(`mission ${mission.id} has invalid runtime safety requirement`);
      }
    }
    for (const criterion of mission.doneCriteria) {
      if (!criterion.id?.trim() || !criterionStatuses.has(criterion.status)) errors.push(`mission ${mission.id} has invalid DONE criterion`);
      validateEvidenceRefs(`criterion ${mission.id}/${criterion.id}`, criterion.evidenceRefs);
    }
    validateEvidenceRefs(`mission ${mission.id}`, mission.evidenceRefs);
    for (const ref of mission.blockerRefs) if (!blockers.has(ref)) errors.push(`mission ${mission.id} references missing blocker: ${ref}`);
    for (const ref of mission.checkpointRefs) if (!checkpoints.has(ref)) errors.push(`mission ${mission.id} references missing checkpoint: ${ref}`);
    if (mission.status === 'DONE' && mission.doneCriteria.some((criterion) => criterion.status !== 'MET')) {
      errors.push(`DONE mission ${mission.id} has unmet or unknown criteria`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (missionId: string): void => {
    if (visiting.has(missionId)) {
      errors.push(`dependency cycle detected at mission ${missionId}`);
      return;
    }
    if (visited.has(missionId)) return;
    visiting.add(missionId);
    for (const dependency of packages.get(missionId)?.dependencies ?? []) {
      if (packages.has(dependency)) visit(dependency);
    }
    visiting.delete(missionId);
    visited.add(missionId);
  };
  for (const mission of complete.workPackages) visit(mission.id);

  const active = complete.workPackages.filter((mission) => mission.status === 'ACTIVE');
  if (active.length > 1) errors.push('multiple ACTIVE missions');
  if (complete.currentMissionId === null) {
    if (active.length) errors.push('ACTIVE mission exists without currentMissionId');
  } else if (!packages.has(complete.currentMissionId)) {
    errors.push(`invalid active mission: ${complete.currentMissionId}`);
  } else if (packages.get(complete.currentMissionId)?.status !== 'ACTIVE') {
    errors.push(`current mission ${complete.currentMissionId} is not ACTIVE`);
  }
  for (const checkpoint of complete.checkpoints) {
    if (!packages.has(checkpoint.missionId)) errors.push(`checkpoint ${checkpoint.id} references missing mission`);
    if (!Number.isInteger(checkpoint.revision) || checkpoint.revision > complete.project.revision) errors.push(`invalid checkpoint revision: ${checkpoint.id}`);
  }
  for (const entry of complete.history) {
    if (!packages.has(entry.missionId)) errors.push(`history ${entry.id} references missing mission`);
    if (!missionStatuses.has(entry.fromStatus) || !missionStatuses.has(entry.toStatus)) errors.push(`history ${entry.id} has invalid lifecycle state`);
    if (entry.checkpointId && !checkpoints.has(entry.checkpointId)) errors.push(`history ${entry.id} references missing checkpoint`);
    if (!Number.isInteger(entry.revision) || entry.revision > complete.project.revision) errors.push(`invalid history revision: ${entry.id}`);
  }
  const derived = deriveNextAuthorizedMissionIdUnchecked(complete);
  if (complete.nextAuthorizedMissionId !== derived) {
    errors.push(`impossible next mission: stored=${complete.nextAuthorizedMissionId ?? 'null'} derived=${derived ?? 'null'}`);
  }
  return errors;
}
