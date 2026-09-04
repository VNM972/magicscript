export const OVERNIGHT_STATE_SCHEMA_VERSION = 1 as const;

export type OvernightTrackStatus =
  | 'READY'
  | 'WAITING'
  | 'BLOCKED'
  | 'MITIGATED'
  | 'DONE';

export interface OvernightProof {
  id: string;
  kind: string;
  reference: string;
  summary: string;
}

export interface OvernightSessionState {
  schemaVersion: typeof OVERNIGHT_STATE_SCHEMA_VERSION;
  sessionId: string;
  startedAt: string;
  baseHead: string;
  baseBranch: string;
  safetyState: string;
  done: readonly string[];
  ready: readonly string[];
  waiting: readonly string[];
  blocked: readonly string[];
  mitigated: readonly string[];
  filesTouched: readonly string[];
  proofs: readonly OvernightProof[];
  next: string | null;
}

export interface NewOvernightSessionInput {
  sessionId: string;
  startedAt: string;
  baseHead: string;
  baseBranch: string;
  safetyState: string;
  next?: string | null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function createOvernightSessionState(
  input: NewOvernightSessionInput,
): OvernightSessionState {
  return {
    schemaVersion: OVERNIGHT_STATE_SCHEMA_VERSION,
    sessionId: input.sessionId,
    startedAt: input.startedAt,
    baseHead: input.baseHead,
    baseBranch: input.baseBranch,
    safetyState: input.safetyState,
    done: [],
    ready: [],
    waiting: [],
    blocked: [],
    mitigated: [],
    filesTouched: [],
    proofs: [],
    next: input.next ?? null,
  };
}

export function validateOvernightSessionState(state: OvernightSessionState): readonly string[] {
  const errors: string[] = [];
  if (state.schemaVersion !== OVERNIGHT_STATE_SCHEMA_VERSION) errors.push('unsupported schemaVersion');
  if (!state.sessionId.trim()) errors.push('sessionId is required');
  if (!state.startedAt.trim()) errors.push('startedAt is required');
  if (!state.baseHead.trim()) errors.push('baseHead is required');
  if (!state.baseBranch.trim()) errors.push('baseBranch is required');
  if (!state.safetyState.trim()) errors.push('safetyState is required');
  if (!Array.isArray(state.proofs)) errors.push('proofs must be an array');
  return errors;
}

/**
 * Compacts active control state only. Proof references and their summaries are
 * retained; this function never deletes evidence artifacts.
 */
export function compactOvernightSessionState(
  state: OvernightSessionState,
): OvernightSessionState {
  return {
    ...state,
    done: unique(state.done),
    ready: unique(state.ready),
    waiting: unique(state.waiting),
    blocked: unique(state.blocked),
    mitigated: unique(state.mitigated),
    filesTouched: unique(state.filesTouched),
    proofs: state.proofs.filter(
      (proof) => proof.id.trim() && proof.kind.trim() && proof.reference.trim(),
    ),
  };
}
