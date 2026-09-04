import type { ProspectState } from '../types/prospect';
import type { EngagementScoreResult } from './engagement-score';

export type PrototypeCostDecision = 'GO' | 'LIGHT' | 'NO-GO';
export type PrototypeAuthorization = 'FULL' | 'LIGHT' | 'NONE';
export type PrototypeComputeClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export type EstimatedExternalCost =
  | {
      kind: 'KNOWN';
      amountEur: number;
      source: string;
    }
  | {
      kind: 'UNKNOWN';
      reason: string;
    };

export interface PrototypeCostGateInput {
  state: ProspectState;
  opportunity: 'A' | 'B' | 'C' | 'D' | null;
  prospectScore: number | null;
  websiteUrl: string | null;
  primaryFriction: string | null;
  primaryAsset: string | null;
  primaryCta: string | null;
  engagement: EngagementScoreResult;
  computeClass: PrototypeComputeClass;
  estimatedExternalCost: EstimatedExternalCost;
  evaluatedAt: string;
}

export interface PrototypeCostGateResult {
  decision: PrototypeCostDecision;
  authorization: PrototypeAuthorization;
  policyScore: number;
  computeClass: PrototypeComputeClass;
  estimatedExternalCost: EstimatedExternalCost;
  reasonCodes: string[];
  evaluatedAt: string;
  reevaluateAt: string | null;
}

const GO_THRESHOLD = 70;
const LIGHT_THRESHOLD = 45;
const NO_GO_REEVALUATION_DAYS = 30;

function hasValue(value: string | null): boolean {
  return Boolean(value?.trim());
}

function opportunityPoints(opportunity: PrototypeCostGateInput['opportunity']): number {
  switch (opportunity) {
    case 'A':
      return 20;
    case 'B':
      return 14;
    case 'C':
      return 7;
    default:
      return 0;
  }
}

function prospectScorePoints(score: number | null): number {
  if (score === null) return 0;
  if (score >= 80) return 15;
  if (score >= 60) return 10;
  if (score >= 40) return 5;
  return 0;
}

function intentPoints(score: number): number {
  if (score >= 35) return 25;
  if (score >= 20) return 18;
  if (score >= 10) return 10;
  if (score > 0) return 5;
  return 0;
}

function activityPoints(score: number): number {
  if (score >= 20) return 10;
  if (score >= 10) return 6;
  if (score > 0) return 3;
  return 0;
}

function trendPoints(trend: EngagementScoreResult['trend']): number {
  if (trend === 'RISING') return 10;
  if (trend === 'STABLE') return 5;
  return 0;
}

function completenessPoints(input: PrototypeCostGateInput): number {
  const values = [
    input.primaryFriction,
    input.primaryAsset,
    input.primaryCta,
  ];
  const populated = values.filter(hasValue).length;
  return populated === 3 ? 10 : populated * 2;
}

function computePenalty(computeClass: PrototypeComputeClass): number {
  if (computeClass === 'HIGH') return 15;
  if (computeClass === 'UNKNOWN') return 15;
  if (computeClass === 'MEDIUM') return 5;
  return 0;
}

function addDaysIso(value: string, days: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('evaluatedAt must be a valid timestamp');
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function evaluatePrototypeCostGate(
  input: PrototypeCostGateInput,
): PrototypeCostGateResult {
  if (
    input.estimatedExternalCost.kind === 'KNOWN' &&
    (!Number.isFinite(input.estimatedExternalCost.amountEur) ||
      input.estimatedExternalCost.amountEur < 0)
  ) {
    throw new Error('Known external cost must be a non-negative finite amount');
  }

  if (
    input.state !== 'PROTOTYPE_REQUIRED' &&
    input.state !== 'INTERESTED' &&
    input.state !== 'MEETING_BOOKED'
  ) {
    return {
      decision: 'NO-GO',
      authorization: 'NONE',
      policyScore: 0,
      computeClass: input.computeClass,
      estimatedExternalCost: input.estimatedExternalCost,
      reasonCodes: ['FUNNEL_STAGE_NOT_ELIGIBLE'],
      evaluatedAt: input.evaluatedAt,
      reevaluateAt: null,
    };
  }

  const reasons: string[] =
    input.state === 'PROTOTYPE_REQUIRED'
      ? ['QUALIFIED_PROTOTYPE_NEED']
      : ['QUALIFIED_INTEREST'];

  if (input.state === 'MEETING_BOOKED') {
    reasons.push('MEETING_BOOKED_SIGNAL');
  }

  const opportunity = opportunityPoints(input.opportunity);
  if (opportunity > 0) reasons.push(`OPPORTUNITY_${input.opportunity}`);

  const prospect = prospectScorePoints(input.prospectScore);
  if (prospect > 0) reasons.push('PROSPECT_SCORE_SIGNAL');

  const intent = intentPoints(input.engagement.intent_score);
  if (intent > 0) reasons.push('ENGAGEMENT_INTENT');

  const activity = activityPoints(input.engagement.activity_score);
  if (activity > 0) reasons.push('ENGAGEMENT_ACTIVITY');

  const trend = trendPoints(input.engagement.trend);
  if (input.engagement.trend === 'RISING') reasons.push('ENGAGEMENT_RISING');
  if (input.engagement.trend === 'COOLING') reasons.push('ENGAGEMENT_COOLING');

  const completeness = completenessPoints(input);
  if (completeness > 0) reasons.push('COMMERCIAL_CONTEXT_AVAILABLE');

  const websiteNeed = hasValue(input.websiteUrl) ? 0 : 10;
  if (websiteNeed > 0) reasons.push('NO_EXISTING_WEBSITE');

  const penalty = computePenalty(input.computeClass);
  if (penalty > 0) reasons.push(`COMPUTE_${input.computeClass}`);

  const rawScore =
    opportunity +
    prospect +
    intent +
    activity +
    trend +
    completeness +
    websiteNeed -
    penalty;

  const policyScore = Math.max(0, Math.min(100, rawScore));

  const thresholdDecision: PrototypeCostDecision =
    policyScore >= GO_THRESHOLD
      ? 'GO'
      : policyScore >= LIGHT_THRESHOLD
        ? 'LIGHT'
        : 'NO-GO';

  const decision: PrototypeCostDecision =
    input.computeClass === 'UNKNOWN' &&
    thresholdDecision === 'GO'
      ? 'LIGHT'
      : thresholdDecision;

  if (
    input.computeClass === 'UNKNOWN' &&
    thresholdDecision === 'GO'
  ) {
    reasons.push('COMPUTE_UNKNOWN_CAP');
  }

  const authorization: PrototypeAuthorization =
    decision === 'GO' ? 'FULL' : decision === 'LIGHT' ? 'LIGHT' : 'NONE';

  return {
    decision,
    authorization,
    policyScore,
    computeClass: input.computeClass,
    estimatedExternalCost: input.estimatedExternalCost,
    reasonCodes: reasons,
    evaluatedAt: input.evaluatedAt,
    reevaluateAt:
      decision === 'NO-GO'
        ? addDaysIso(input.evaluatedAt, NO_GO_REEVALUATION_DAYS)
        : null,
  };
}
