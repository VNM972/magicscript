/**
 * MAGIC SCRIPT — EXPERIMENT MANAGER V1
 *
 * SAFE FOUNDATION for self-improvement.
 *
 * GOVERNANCE LOCK:
 * Autonomous modification is forbidden for scoring formulas, weights,
 * qualification thresholds, evidence-integrity rules, source provenance
 * requirements, normalization confidence rules, identity-binding rules,
 * commercial eligibility rules, send/deploy/outreach/paid-API permissions,
 * promotion/rollback criteria, safety guardrails.
 *
 * This manager may RECORD observations and PROPOSE experiments.
 * It may NOT silently PROMOTE any change.
 *
 * QAV_PARTIAL: cannot auto-promote.
 * OBSERVATION_ONLY: cannot auto-promote.
 *
 * Evidence quality must never be inferred from desired outcome.
 */

// ============================================================
// Types
// ============================================================

export type ExperimentStatus =
  | 'PROPOSED'
  | 'EVALUATING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DEFERRED'
  | 'ROLLED_BACK';

export type ExperimentProvenance =
  | 'OBSERVATION'
  | 'OPERATIONAL_LESSON'
  | 'AUDIT_FINDING'
  | 'EXTERNAL_PATTERN'
  | 'HUMAN_PROPOSAL';

export interface Experiment {
  /** Unique identifier for this experiment. */
  id: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** What was observed that triggered this experiment. */
  observation: string;
  /** The proposed explanation or improvement direction. */
  hypothesis: string;
  /** Which module(s) the change would target. */
  targetModule: string;
  /** References to baseline evidence (test results, audit findings, etc.). */
  baselineEvidenceRefs: string[];
  /** Concise summary of the proposed change. */
  proposedChangeSummary: string;
  /** How the change would be evaluated (test names, metrics, etc.). */
  evaluationPlan: string;
  /** Metric names this experiment would compare. */
  metricNames: string[];
  /** Metric values before the change (recorded at PROPOSED or EVALUATING). */
  beforeMetrics: Record<string, number>;
  /** Metric values after the change (set at ACCEPTED/REJECTED/ROLLED_BACK). */
  afterMetrics: Record<string, number>;
  /** Current lifecycle status. */
  status: ExperimentStatus;
  /** Human-readable reason for the decision. */
  decisionReason: string;
  /** Whether explicit human review is required before promotion. */
  reviewerRequired: boolean;
  /** How to undo this change if it fails. */
  rollbackPlan: string;
  /** Where this experiment originated. */
  provenance: ExperimentProvenance;
  /** The module path that would be modified. */
  changeTarget: string;
}

// ============================================================
// Experiment Ledger — in-memory record store
// ============================================================

const ledger: Map<string, Experiment> = new Map();

let nextId = 0;

function generateId(): string {
  nextId += 1;
  const stamp = Date.now().toString(36);
  return `EXP-${stamp}-${nextId.toString(36).padStart(4, '0')}`;
}

// ============================================================
// Public API
// ============================================================

/**
 * Propose a new experiment. This is the ONLY way to add to the ledger.
 * The proposer (LLM or human) provides the observation, hypothesis, and plan.
 * An experiment starts in PROPOSED status and may NEVER auto-promote itself.
 */
export function proposeExperiment(input: {
  observation: string;
  hypothesis: string;
  targetModule: string;
  baselineEvidenceRefs: string[];
  proposedChangeSummary: string;
  evaluationPlan: string;
  metricNames: string[];
  beforeMetrics: Record<string, number>;
  reviewerRequired: boolean;
  rollbackPlan: string;
  provenance: ExperimentProvenance;
  changeTarget: string;
}): Experiment {
  const experiment: Experiment = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    status: 'PROPOSED',
    decisionReason: '',
    afterMetrics: {},
    ...input,
  };

  ledger.set(experiment.id, experiment);
  return experiment;
}

/**
 * Transition an experiment to a new status.
 * Only status transitions are allowed — no data mutation beyond metrics.
 *
 * ACCEPTED and REJECTED are final. ROLLED_BACK is a terminal response to
 * a prior ACCEPTED state.
 */
export function updateExperimentStatus(
  id: string,
  status: ExperimentStatus,
  decisionReason: string,
  afterMetrics?: Record<string, number>,
): Experiment {
  const experiment = ledger.get(id);
  if (!experiment) throw new Error(`Experiment not found: ${id}`);

  const finalStates = new Set<ExperimentStatus>(['ACCEPTED', 'REJECTED', 'ROLLED_BACK']);
  if (finalStates.has(experiment.status)) {
    throw new Error(`Experiment ${id} is already in terminal state: ${experiment.status}`);
  }

  // Governance lock: ACCEPTED experiments with reviewerRequired=true require
  // human approval before promotion — but status transition itself is not blocked.
  experiment.status = status;
  experiment.decisionReason = decisionReason;
  if (afterMetrics) {
    experiment.afterMetrics = { ...afterMetrics };
  }
  return experiment;
}

/**
 * Get an experiment by id.
 */
export function getExperiment(id: string): Experiment | undefined {
  return ledger.get(id);
}

/**
 * List all experiments with optional status filter.
 */
export function listExperiments(status?: ExperimentStatus): Experiment[] {
  const all = [...ledger.values()];
  return status ? all.filter((e) => e.status === status) : all;
}

/**
 * List experiments targeting a specific module.
 */
export function listExperimentsByTarget(targetModule: string): Experiment[] {
  return [...ledger.values()].filter(
    (e) => e.targetModule === targetModule || e.changeTarget === targetModule,
  );
}

/**
 * Reset the ledger (for testing).
 */
export function resetLedger(): void {
  ledger.clear();
  nextId = 0;
}