export type MissionPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export type MissionStatus =
  | 'READY'
  | 'WAITING'
  | 'BLOCKED'
  | 'MITIGATED'
  | 'DONE';

export type ReviewStatus =
  | 'PASS'
  | 'PASS_WITH_NOTES'
  | 'BLOCKED'
  | 'WAITING_EXTERNAL'
  | 'UNKNOWN';

export interface VerifierContract {
  id: string;
  requiredChecks: readonly string[];
  maxDurationMinutes?: number;
}

export interface MissionSpec {
  id: string;
  objective: string;
  allowedScope: readonly string[];
  environmentFingerprint: string;
}

export interface MissionSubtask {
  id: string;
  title: string;
  objective: string;
  scope: readonly string[];
  verifier?: VerifierContract;
}

export interface BacklogItem {
  id: string;
  title: string;
  priority: MissionPriority;
  status: MissionStatus;
  objective: string;
  scope: readonly string[];
  dependencies: readonly string[];
  verifier: VerifierContract;
  subtasks?: readonly MissionSubtask[];
  reviewStatus?: ReviewStatus;
}

export interface MissionPackage {
  id: string;
  sourceId: string;
  title: string;
  priority: MissionPriority;
  status: 'READY';
  objective: string;
  scope: readonly string[];
  dependencies: readonly string[];
  verifier: VerifierContract;
  sourceReviewStatus?: ReviewStatus;
}

export interface MissionCompilerInput {
  spec: MissionSpec;
  backlog: readonly BacklogItem[];
}

export interface RefinementProposal {
  sourceId: string;
  title: string;
  objective: string;
  scope: readonly string[];
  verifier: VerifierContract;
  environmentFingerprint?: string;
  environmentChanges?: readonly string[];
  expectedReviewStatus?: ReviewStatus;
}

export interface RefinementValidation {
  accepted: boolean;
  reasons: readonly string[];
}

export interface RefinedBacklog {
  packages: readonly MissionPackage[];
  deferred: readonly string[];
}

const priorityRank: Record<MissionPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function copyVerifier(verifier: VerifierContract): VerifierContract {
  return {
    id: verifier.id,
    requiredChecks: [...verifier.requiredChecks],
    ...(verifier.maxDurationMinutes === undefined
      ? {}
      : { maxDurationMinutes: verifier.maxDurationMinutes }),
  };
}

function dependencyReady(item: BacklogItem, completed: ReadonlySet<string>): boolean {
  return item.dependencies.every((dependency) => completed.has(dependency));
}

/**
 * Converts only READY backlog entries into small, independently verifiable
 * packages. It does not execute packages or alter the environment.
 */
export function refineReadyBacklog(input: MissionCompilerInput): RefinedBacklog {
  const completed = new Set(
    input.backlog
      .filter((item) => item.status === 'DONE' || item.status === 'MITIGATED')
      .map((item) => item.id),
  );
  const packages: MissionPackage[] = [];
  const deferred: string[] = [];

  for (const item of input.backlog) {
    if (item.status !== 'READY') continue;
    if (!dependencyReady(item, completed)) {
      deferred.push(item.id);
      continue;
    }

    const subtasks = item.subtasks?.length ? item.subtasks : null;
    if (!subtasks) {
      packages.push({
        id: item.id,
        sourceId: item.id,
        title: item.title,
        priority: item.priority,
        status: 'READY',
        objective: item.objective,
        scope: [...item.scope],
        dependencies: [...item.dependencies],
        verifier: copyVerifier(item.verifier),
        ...(item.reviewStatus === undefined ? {} : { sourceReviewStatus: item.reviewStatus }),
      });
      continue;
    }

    for (const subtask of subtasks) {
      packages.push({
        id: `${item.id}:${subtask.id}`,
        sourceId: item.id,
        title: `${item.title} — ${subtask.title}`,
        priority: item.priority,
        status: 'READY',
        objective: subtask.objective,
        scope: [...subtask.scope],
        dependencies: [...item.dependencies],
        verifier: copyVerifier(subtask.verifier ?? item.verifier),
        ...(item.reviewStatus === undefined ? {} : { sourceReviewStatus: item.reviewStatus }),
      });
    }
  }

  packages.sort((left, right) =>
    priorityRank[left.priority] - priorityRank[right.priority] || left.id.localeCompare(right.id),
  );

  return { packages, deferred };
}

/**
 * Deterministically selects the highest-priority package without changing it.
 */
export function selectBestReadyPackage(
  packages: readonly MissionPackage[],
): MissionPackage | null {
  return [...packages]
    .filter((item) => item.status === 'READY')
    .sort((left, right) =>
      priorityRank[left.priority] - priorityRank[right.priority] || left.id.localeCompare(right.id),
    )[0] ?? null;
}

/**
 * Rejects a proposed refinement if it expands scope, changes the environment,
 * weakens a verifier, increases its timeout, or promotes an unknown review.
 */
export function validateMissionProposal(
  input: MissionCompilerInput,
  proposal: RefinementProposal,
): RefinementValidation {
  const reasons: string[] = [];
  const source = input.backlog.find((item) => item.id === proposal.sourceId);

  if (!source) {
    reasons.push('source backlog item does not exist');
    return { accepted: false, reasons };
  }

  if (!proposal.title.trim() || !proposal.objective.trim()) {
    reasons.push('title and objective are required');
  }

  if (proposal.environmentChanges?.length) {
    reasons.push('ENVIRONMENT is immutable');
  }

  if (
    proposal.environmentFingerprint !== undefined &&
    proposal.environmentFingerprint !== input.spec.environmentFingerprint
  ) {
    reasons.push('environment fingerprint changed');
  }

  const allowedScope = new Set(input.spec.allowedScope);
  const sourceScope = new Set(source.scope);
  if (proposal.scope.some((entry) => !allowedScope.has(entry) || !sourceScope.has(entry))) {
    reasons.push('scope expands beyond SPEC and source backlog item');
  }

  const requiredChecks = new Set(source.verifier.requiredChecks);
  if (source.verifier.id !== proposal.verifier.id) {
    reasons.push('verifier identity changed');
  }
  if ([...requiredChecks].some((check) => !proposal.verifier.requiredChecks.includes(check))) {
    reasons.push('VERIFIER required check removed');
  }
  if (
    source.verifier.maxDurationMinutes !== undefined &&
    proposal.verifier.maxDurationMinutes !== undefined &&
    proposal.verifier.maxDurationMinutes > source.verifier.maxDurationMinutes
  ) {
    reasons.push('VERIFIER timeout increased');
  }

  if (
    proposal.expectedReviewStatus === 'PASS' &&
    (source.reviewStatus === 'UNKNOWN' || source.reviewStatus === 'BLOCKED' || source.reviewStatus === 'WAITING_EXTERNAL')
  ) {
    reasons.push('UNKNOWN or blocked review cannot become PASS through refinement');
  }

  return { accepted: reasons.length === 0, reasons };
}

export function normalizeMissionPackage(input: MissionPackage): MissionPackage {
  return {
    ...input,
    scope: unique(input.scope),
    dependencies: unique(input.dependencies),
    verifier: copyVerifier(input.verifier),
  };
}
