export const PLAYBOOK_CHANGE_PROPOSAL_SCHEMA_VERSION = 1 as const;
export const PLAYBOOK_CHANGE_PROPOSAL_VERSION = 'PLAYBOOK_CHANGE_PROPOSAL_V1' as const;

export type PlaybookChangeProposalStatus = 'DRAFT' | 'PENDING_HUMAN_REVIEW';
export type ProposalTargetType =
  | 'CHANNEL_MESSAGING'
  | 'EDITED_FIELD'
  | 'EDITED_SECTION'
  | 'REJECTION_REASON_GUIDANCE';

export interface ProposalTargetScope {
  readonly type: ProposalTargetType;
  readonly component: string;
  readonly value: string;
}

export interface ProposalObservationWindow {
  readonly from: string;
  readonly to: string;
}

export interface PlaybookChangeProposal {
  readonly schemaVersion: typeof PLAYBOOK_CHANGE_PROPOSAL_SCHEMA_VERSION;
  readonly proposalVersion: typeof PLAYBOOK_CHANGE_PROPOSAL_VERSION;
  readonly proposalId: string;
  readonly status: PlaybookChangeProposalStatus;
  readonly originatingInsightIds: readonly string[];
  /** Exact raw CP05-A1 event identifiers carried by the originating insight(s). */
  readonly rawFeedbackEventIds: readonly string[];
  readonly targetScope: ProposalTargetScope;
  readonly currentBehaviorQuestioned: string;
  readonly proposedChange: string;
  readonly reason: string;
  readonly supportingObservation: string;
  readonly supportingCounts: Readonly<Record<string, number>>;
  readonly sampleSize: number;
  readonly evidenceSufficient: true;
  readonly expectedBenefit: string;
  readonly knownRisks: readonly string[];
  readonly reversibility: string;
  readonly applicationStatement: 'NOT_APPLIED_PENDING_HUMAN_REVIEW';
  /** Deterministic creation time taken from the observed evidence window. */
  readonly createdAt: string;
  readonly observationWindow: ProposalObservationWindow | null;
}

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const iso = (value: unknown): value is string =>
  text(value) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));

export function playbookChangeProposalIssues(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['PROPOSAL_REQUIRED'];
  const proposal = value as Partial<PlaybookChangeProposal>;
  const errors: string[] = [];
  if (proposal.schemaVersion !== 1 || proposal.proposalVersion !== PLAYBOOK_CHANGE_PROPOSAL_VERSION) errors.push('UNKNOWN_SCHEMA_VERSION');
  if (!text(proposal.proposalId) || !text(proposal.status)) errors.push('IDENTITY_AND_STATUS_REQUIRED');
  if (!['DRAFT', 'PENDING_HUMAN_REVIEW'].includes(proposal.status as string)) errors.push('INVALID_STATUS');
  if (!Array.isArray(proposal.originatingInsightIds) || !proposal.originatingInsightIds.length || proposal.originatingInsightIds.some(id => !text(id))) errors.push('INSIGHT_PROVENANCE_REQUIRED');
  if (!Array.isArray(proposal.rawFeedbackEventIds) || !proposal.rawFeedbackEventIds.length || proposal.rawFeedbackEventIds.some(id => !text(id))) errors.push('EVENT_PROVENANCE_REQUIRED');
  if (!proposal.targetScope || !text(proposal.targetScope.component) || !text(proposal.targetScope.value)) errors.push('TARGET_SCOPE_REQUIRED');
  if (!text(proposal.currentBehaviorQuestioned) || !text(proposal.proposedChange) || !text(proposal.reason) || !text(proposal.supportingObservation)) errors.push('PROPOSAL_EXPLANATION_REQUIRED');
  if (!Number.isInteger(proposal.sampleSize) || (proposal.sampleSize ?? 0) < 1) errors.push('SAMPLE_SIZE_REQUIRED');
  if (proposal.evidenceSufficient !== true) errors.push('EVIDENCE_MUST_BE_SUFFICIENT');
  if (!text(proposal.expectedBenefit) || !Array.isArray(proposal.knownRisks) || proposal.knownRisks.some(risk => !text(risk)) || !text(proposal.reversibility)) errors.push('GUARDRAILS_REQUIRED');
  if (proposal.applicationStatement !== 'NOT_APPLIED_PENDING_HUMAN_REVIEW') errors.push('MUST_REMAIN_UNAPPLIED');
  if (!iso(proposal.createdAt)) errors.push('INVALID_CREATION_TIMESTAMP');
  if (proposal.observationWindow && (!iso(proposal.observationWindow.from) || !iso(proposal.observationWindow.to))) errors.push('INVALID_OBSERVATION_WINDOW');
  return [...new Set(errors)];
}

export function assertPlaybookChangeProposal(value: unknown): asserts value is PlaybookChangeProposal {
  const issues = playbookChangeProposalIssues(value);
  if (issues.length) throw new Error(`INVALID_PLAYBOOK_CHANGE_PROPOSAL:${issues.join(',')}`);
}
