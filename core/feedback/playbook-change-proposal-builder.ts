import type { AggregatedInsight, AggregatedInsightDimension } from './aggregated-insight-contract';
import {
  PLAYBOOK_CHANGE_PROPOSAL_SCHEMA_VERSION,
  PLAYBOOK_CHANGE_PROPOSAL_VERSION,
  type PlaybookChangeProposal,
  type ProposalTargetScope,
} from './playbook-change-proposal-contract';

function hash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `playbook-proposal-${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function target(dimensions: readonly AggregatedInsightDimension[]): ProposalTargetScope | null {
  const dimension = dimensions.length === 1 ? dimensions[0] : null;
  if (!dimension) return null;
  switch (dimension.name) {
    case 'channel':
      return { type: 'CHANNEL_MESSAGING', component: 'messaging', value: dimension.value };
    case 'edited_field':
      return { type: 'EDITED_FIELD', component: 'messaging', value: dimension.value };
    case 'edited_section':
      return { type: 'EDITED_SECTION', component: 'messaging', value: dimension.value };
    case 'rejection_reason':
      return { type: 'REJECTION_REASON_GUIDANCE', component: 'playbook guidance', value: dimension.value };
    default:
      return null;
  }
}

function canonicalInsights(insights: readonly AggregatedInsight[]): AggregatedInsight[] {
  const byId = new Map<string, AggregatedInsight>();
  for (const insight of insights) {
    if (!byId.has(insight.insightId)) byId.set(insight.insightId, insight);
  }
  return [...byId.values()].sort((a, b) => a.insightId.localeCompare(b.insightId));
}

/** Pure CP05-A3 promotion layer. It proposes tests; it never applies playbook changes. */
export function buildPlaybookChangeProposals(insights: readonly AggregatedInsight[]): PlaybookChangeProposal[] {
  const eligible = canonicalInsights(insights).filter(insight => insight.evidenceSufficient && insight.recommendationEligible);
  const proposals: PlaybookChangeProposal[] = [];
  for (const insight of eligible) {
    const scope = target(insight.dimensions);
    if (!scope || !insight.eventIds.length || !insight.observationWindow) continue;
    const eventIds = uniqueSorted(insight.eventIds);
    const insightIds = [insight.insightId];
    const canonical = JSON.stringify({ version: PLAYBOOK_CHANGE_PROPOSAL_VERSION, insightIds, eventIds, scope });
    const createdAt = insight.observationWindow.to;
    proposals.push({
      schemaVersion: PLAYBOOK_CHANGE_PROPOSAL_SCHEMA_VERSION,
      proposalVersion: PLAYBOOK_CHANGE_PROPOSAL_VERSION,
      proposalId: hash(canonical),
      status: 'PENDING_HUMAN_REVIEW',
      originatingInsightIds: insightIds,
      rawFeedbackEventIds: eventIds,
      targetScope: scope,
      currentBehaviorQuestioned: `Observed repeated operator feedback about ${scope.component} scope ${scope.value}.`,
      proposedChange: `Consider testing revised ${scope.component} guidance for ${scope.value} within this bounded scope.`,
      reason: 'A2 aggregated evidence is marked recommendation-eligible; the observation does not establish causality.',
      supportingObservation: insight.pattern,
      supportingCounts: { ...insight.counts },
      sampleSize: insight.eventCount,
      evidenceSufficient: true,
      expectedBenefit: 'Assess whether the bounded guidance better fits operator-observed needs.',
      knownRisks: ['The observation may not generalize beyond this scope.', 'No causal or conversion claim is established.'],
      reversibility: 'Any later human-approved test can be reverted without changing canonical commercial authority.',
      applicationStatement: 'NOT_APPLIED_PENDING_HUMAN_REVIEW',
      createdAt,
      observationWindow: insight.observationWindow,
    });
  }
  return proposals.sort((a, b) => a.proposalId.localeCompare(b.proposalId));
}
