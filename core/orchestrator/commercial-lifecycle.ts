import type { Prospect, ProspectState } from '../types/prospect';
import { canTransition } from '../state/prospect-state-machine';

export type ExplicitInterestClassification =
  | 'POSITIVE_INTEREST'
  | 'INFORMATION_REQUEST'
  | 'PRICING_REQUESTED'
  | 'MEETING_REQUESTED'
  | 'CUSTOM_REQUEST';

export type CommercialEvent =
  | 'MEETING_BOOKED'
  | 'QUOTE_DRAFTED'
  | 'QUOTE_ACCEPTED'
  | 'DEPOSIT_CONFIRMED'
  | 'STOP';

export type CommercialEscalationCategory =
  | 'INTERESTED'
  | 'MEETING_BOOKED'
  | 'QUOTE_PENDING'
  | 'COMMITTED';

export interface CommercialTransition {
  to: ProspectState;
  reason: string;
  humanRequired: boolean;
}

export interface CommercialBriefing {
  kind: 'COMMERCIAL_BRIEFING';
  owner: 'stephane';
  source: 'inbound_message' | 'meeting_booking';
  company: string;
  contact?: string;
  activity?: string;
  location?: string;
  prototype?: {
    id?: string;
    url?: string;
  };
  salesRoom?: string;
  message?: string;
  summary: string;
  primaryGap?: string;
  facts: string[];
  unknowns: string[];
  engagementHistory: Array<{
    type: string;
    createdAt: string;
  }>;
  blockers: string[];
  nextAction: 'HUMAN_REVIEW';
  draftReply?: string;
  confidence?: number;
}

export interface CommercialBriefingInput {
  source: CommercialBriefing['source'];
  prospect: Pick<
    Prospect,
    | 'companyName'
    | 'activity'
    | 'location'
    | 'websiteUrl'
    | 'primaryFriction'
    | 'primaryAsset'
  >;
  contact?: string;
  message?: string;
  summary: string;
  prototype?: CommercialBriefing['prototype'];
  salesRoom?: string;
  engagementHistory?: CommercialBriefing['engagementHistory'];
  confidence?: number;
}

export function isExplicitInterestClassification(
  classification: string,
): classification is ExplicitInterestClassification {
  return new Set<ExplicitInterestClassification>([
    'POSITIVE_INTEREST',
    'INFORMATION_REQUEST',
    'PRICING_REQUESTED',
    'MEETING_REQUESTED',
    'CUSTOM_REQUEST',
  ]).has(classification as ExplicitInterestClassification);
}

export function stateForInboundClassification(
  classification: string,
): ProspectState | null {
  return isExplicitInterestClassification(classification) ? 'INTERESTED' : null;
}

export function commercialTransition(
  current: ProspectState,
  event: CommercialEvent,
  proof?: {
    quoteAcceptanceProofReference?: string;
    paymentConfirmationReference?: string;
  },
): CommercialTransition {
  const target =
    event === 'MEETING_BOOKED'
      ? 'MEETING_BOOKED'
      : event === 'QUOTE_DRAFTED'
        ? 'QUOTE_PENDING'
        : event === 'QUOTE_ACCEPTED'
          ? 'COMMITTED'
          : event === 'DEPOSIT_CONFIRMED'
            ? 'WON'
            : 'DO_NOT_CONTACT';

  if (event === 'QUOTE_ACCEPTED' && !proof?.quoteAcceptanceProofReference?.trim()) {
    throw new Error('QUOTE_ACCEPTED requires a quote acceptance proof reference');
  }

  if (event === 'DEPOSIT_CONFIRMED' && !proof?.paymentConfirmationReference?.trim()) {
    throw new Error('DEPOSIT_CONFIRMED requires a payment confirmation reference');
  }

  if (!canTransition(current, target)) {
    throw new Error(`Invalid commercial transition: ${current} -> ${target}`);
  }

  const reasons: Record<CommercialEvent, string> = {
    MEETING_BOOKED: 'Meeting booking was confirmed by a trusted internal event',
    QUOTE_DRAFTED: 'Quote draft prepared for human validation',
    QUOTE_ACCEPTED: 'Quote acceptance recorded; deposit is still pending',
    DEPOSIT_CONFIRMED: 'Deposit confirmation proof recorded',
    STOP: 'Prospect requested no further follow-up',
  };

  return {
    to: target,
    reason: reasons[event],
    humanRequired: target !== 'WON' && target !== 'DO_NOT_CONTACT',
  };
}

export function buildCommercialBriefing(input: CommercialBriefingInput): CommercialBriefing {
  const facts = [
    input.prospect.activity ? `Activité : ${input.prospect.activity}` : null,
    input.prospect.location ? `Commune : ${input.prospect.location}` : null,
    input.prospect.websiteUrl ? `Site : ${input.prospect.websiteUrl}` : null,
    input.prospect.primaryAsset ? `Actif principal : ${input.prospect.primaryAsset}` : null,
  ].filter((fact): fact is string => Boolean(fact));

  const unknowns = [
    input.contact ? null : 'Interlocuteur',
    input.prospect.activity ? null : 'Activité exacte',
    input.prospect.location ? null : 'Localisation',
    input.prospect.primaryFriction ? null : 'Friction digitale principale',
    input.prototype?.url ? null : 'Lien prototype vérifié',
  ].filter((value): value is string => Boolean(value));

  return {
    kind: 'COMMERCIAL_BRIEFING',
    owner: 'stephane',
    source: input.source,
    company: input.prospect.companyName,
    ...(input.contact ? { contact: input.contact } : {}),
    ...(input.message ? { message: input.message } : {}),
    summary: input.summary,
    ...(input.prospect.activity ? { activity: input.prospect.activity } : {}),
    ...(input.prospect.location ? { location: input.prospect.location } : {}),
    ...(input.prototype ? { prototype: input.prototype } : {}),
    ...(input.salesRoom ? { salesRoom: input.salesRoom } : {}),
    ...(input.prospect.primaryFriction
      ? { primaryGap: input.prospect.primaryFriction }
      : {}),
    facts,
    unknowns,
    engagementHistory: input.engagementHistory ?? [],
    blockers: [],
    nextAction: 'HUMAN_REVIEW',
    confidence: input.confidence,
  };
}

export type InterestFollowupAction =
  | { kind: 'PREPARE_DRAFT'; sequence: 1 | 2; dueAt: string }
  | { kind: 'MARK_DORMANT'; at: string };

export interface InterestFollowupInput {
  state: ProspectState;
  interestAt: string;
  now: string;
  firstDraftPrepared: boolean;
  secondDraftPrepared: boolean;
  hasNewInbound: boolean;
}

export function planInterestFollowups(
  input: InterestFollowupInput,
): InterestFollowupAction[] {
  if (input.state !== 'INTERESTED' || input.hasNewInbound) return [];

  const interestTime = new Date(input.interestAt).getTime();
  const nowTime = new Date(input.now).getTime();
  if (!Number.isFinite(interestTime) || !Number.isFinite(nowTime) || nowTime < interestTime) {
    return [];
  }

  const firstDueAt = new Date(interestTime + 2 * 24 * 60 * 60 * 1000).toISOString();
  const secondDueAt = new Date(interestTime + 7 * 24 * 60 * 60 * 1000).toISOString();
  const actions: InterestFollowupAction[] = [];

  if (nowTime >= interestTime + 2 * 24 * 60 * 60 * 1000 && !input.firstDraftPrepared) {
    actions.push({ kind: 'PREPARE_DRAFT', sequence: 1, dueAt: firstDueAt });
  }

  if (nowTime >= interestTime + 7 * 24 * 60 * 60 * 1000 && !input.secondDraftPrepared) {
    actions.push({ kind: 'PREPARE_DRAFT', sequence: 2, dueAt: secondDueAt });
  }

  if (nowTime >= interestTime + 7 * 24 * 60 * 60 * 1000) {
    actions.push({ kind: 'MARK_DORMANT', at: input.now });
  }

  return actions;
}
