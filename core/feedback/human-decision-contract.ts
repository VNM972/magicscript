import {
  assertPlaybookChangeProposal,
  PLAYBOOK_CHANGE_PROPOSAL_VERSION,
  type PlaybookChangeProposal,
} from './playbook-change-proposal-contract';

export const HUMAN_DECISION_SCHEMA_VERSION = 1 as const;
export const HUMAN_DECISION_VERSION = 'PLAYBOOK_CHANGE_HUMAN_DECISION_V1' as const;

export type HumanDecision = 'APPROVE' | 'REJECT' | 'KEEP_TESTING';

export interface HumanDecisionRationale {
  readonly code?: string;
  readonly summary?: string;
  readonly detail?: string;
}

export interface PlaybookChangeHumanDecision {
  readonly schemaVersion: typeof HUMAN_DECISION_SCHEMA_VERSION;
  readonly decisionVersion: typeof HUMAN_DECISION_VERSION;
  readonly decisionId: string;
  readonly proposalId: string;
  readonly proposalVersion: typeof PLAYBOOK_CHANGE_PROPOSAL_VERSION;
  readonly expectedProposalStatus: 'PENDING_HUMAN_REVIEW';
  readonly proposalFingerprint: string;
  readonly decision: HumanDecision;
  readonly humanActor: string;
  readonly decidedAt: string;
  readonly rationale?: HumanDecisionRationale;
  readonly originatingInsightIds: readonly string[];
  readonly rawFeedbackEventIds: readonly string[];
  readonly applied: false;
}

export type CreateHumanDecisionInput = Omit<
  PlaybookChangeHumanDecision,
  'schemaVersion' | 'decisionVersion' | 'proposalId' | 'proposalVersion' |
  'expectedProposalStatus' | 'proposalFingerprint' | 'originatingInsightIds' |
  'rawFeedbackEventIds' | 'applied'
>;

const decisions: readonly HumanDecision[] = ['APPROVE', 'REJECT', 'KEEP_TESTING'];
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const iso = (value: unknown): value is string =>
  text(value) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

/** Fingerprint of the complete proposal revision, not merely its proposal ID. */
export function playbookChangeProposalFingerprint(proposal: PlaybookChangeProposal): string {
  assertPlaybookChangeProposal(proposal);
  const canonical = JSON.stringify(canonicalize(proposal));
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `playbook-proposal-fingerprint-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function humanDecisionIssues(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['DECISION_REQUIRED'];
  const decision = value as Partial<PlaybookChangeHumanDecision>;
  const errors: string[] = [];
  if (decision.schemaVersion !== 1 || decision.decisionVersion !== HUMAN_DECISION_VERSION) errors.push('UNKNOWN_SCHEMA_VERSION');
  if (!text(decision.decisionId) || !text(decision.proposalId) || !text(decision.proposalVersion) || !text(decision.proposalFingerprint)) errors.push('IDENTITY_REQUIRED');
  if (decision.proposalVersion !== PLAYBOOK_CHANGE_PROPOSAL_VERSION) errors.push('PROPOSAL_VERSION_MISMATCH');
  if (decision.expectedProposalStatus !== 'PENDING_HUMAN_REVIEW') errors.push('INVALID_EXPECTED_PROPOSAL_STATUS');
  if (!decisions.includes(decision.decision as HumanDecision)) errors.push('INVALID_DECISION');
  if (!text(decision.humanActor)) errors.push('HUMAN_ACTOR_REQUIRED');
  if (!iso(decision.decidedAt)) errors.push('INVALID_DECISION_TIMESTAMP');
  if (!Array.isArray(decision.originatingInsightIds) || !decision.originatingInsightIds.length || decision.originatingInsightIds.some(id => !text(id))) errors.push('INSIGHT_PROVENANCE_REQUIRED');
  if (!Array.isArray(decision.rawFeedbackEventIds) || !decision.rawFeedbackEventIds.length || decision.rawFeedbackEventIds.some(id => !text(id))) errors.push('EVENT_PROVENANCE_REQUIRED');
  if (decision.applied !== false) errors.push('DECISION_MUST_REMAIN_UNAPPLIED');
  return [...new Set(errors)];
}

export function assertHumanDecision(value: unknown): asserts value is PlaybookChangeHumanDecision {
  const issues = humanDecisionIssues(value);
  if (issues.length) throw new Error(`INVALID_PLAYBOOK_CHANGE_HUMAN_DECISION:${issues.join(',')}`);
}

export function createPlaybookChangeHumanDecision(
  proposal: PlaybookChangeProposal,
  input: CreateHumanDecisionInput,
): PlaybookChangeHumanDecision {
  assertPlaybookChangeProposal(proposal);
  if (proposal.status !== 'PENDING_HUMAN_REVIEW') throw new Error('PROPOSAL_NOT_AWAITING_HUMAN_REVIEW');
  if (!text(input.humanActor)) throw new Error('HUMAN_ACTOR_REQUIRED');
  if (!iso(input.decidedAt)) throw new Error('INVALID_DECISION_TIMESTAMP');
  if (!decisions.includes(input.decision)) throw new Error('INVALID_DECISION');
  const decision: PlaybookChangeHumanDecision = {
    ...input,
    schemaVersion: HUMAN_DECISION_SCHEMA_VERSION,
    decisionVersion: HUMAN_DECISION_VERSION,
    proposalId: proposal.proposalId,
    proposalVersion: proposal.proposalVersion,
    expectedProposalStatus: proposal.status,
    proposalFingerprint: playbookChangeProposalFingerprint(proposal),
    originatingInsightIds: [...proposal.originatingInsightIds],
    rawFeedbackEventIds: [...proposal.rawFeedbackEventIds],
    applied: false,
  };
  assertHumanDecision(decision);
  return decision;
}

export function serializeHumanDecision(decision: PlaybookChangeHumanDecision): string {
  assertHumanDecision(decision);
  return JSON.stringify(decision);
}

export function deserializeHumanDecision(value: string): PlaybookChangeHumanDecision {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('MALFORMED_HUMAN_DECISION_JSON'); }
  assertHumanDecision(parsed);
  return parsed;
}
