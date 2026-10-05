import type { Prospect, ProspectState } from '../types/prospect';

/** Hard product policy: no more than twenty prospects may be in active production. */
export const MAX_ACTIVE_PRODUCTION_PROSPECTS = 20 as const;

export const DECK_COMMERCIAL_STAGES = [
  'A_CONTACTER',
  'ENVOYES',
  'EN_ATTENTE',
  'RDV',
  'DEVIS',
  'RELANCES',
  'GAGNES',
  'PERDUS',
  'ARCHIVES',
] as const;
export type DeckCommercialStage = typeof DECK_COMMERCIAL_STAGES[number];

export type DeckProjectionReason =
  | 'UNSUPPORTED_STATE'
  | 'INCONSISTENT_STATE'
  | 'ARCHIVE_AUTHORITY_MISSING'
  | 'ACTIVE_SLOT_AVAILABLE'
  | 'ACTIVE_SLOT_NOT_REQUIRED'
  | 'ACTIVE_WINDOW_FULL'
  | 'NOT_PRODUCTION_STATE';

/**
 * These are the existing canonical states in which the pre-contact production
 * chain is live. Contacted and later states deliberately release their slot.
 * This is a projection/policy predicate; it never changes Prospect.state.
 */
export const ACTIVE_PRODUCTION_STATES: readonly ProspectState[] = [
  'PROTOTYPE_REQUIRED',
  'PROTOTYPE_STRATEGY_GENERATED',
  'PROTOTYPE_BUILDING',
  'PROTOTYPE_QA',
  'PROTOTYPE_READY',
  'PROTOTYPE_DEPLOYING',
  'PROTOTYPE_DEPLOYED',
  'DEMO_REPLY_READY',
];

const KNOWN_STATES: readonly string[] = [
  'INGESTED', 'SAS_PENDING', 'DISCOVERED', 'RESEARCHING', 'RESEARCH_COMPLETE',
  'QUALIFIED', 'DISQUALIFIED', 'CONTACT_DISCOVERY', 'CONTACT_FOUND',
  'CONTACT_INVALID', 'OUTREACH_READY', 'OUTREACH_DRAFTED', 'OUTREACH_VERIFIED',
  'EMAIL_SENT', 'CONTACTED', 'WAITING_REPLY', 'FOLLOW_UP_DUE', 'FOLLOW_UP_SENT',
  'REPLY_RECEIVED', 'POSITIVE_REPLY', 'INTERESTED', 'MEETING_BOOKED',
  'QUOTE_PENDING', 'COMMITTED', 'WON', 'DORMANT', 'NEGATIVE_REPLY', 'BOUNCED',
  'DO_NOT_CONTACT', 'PROTOTYPE_REQUIRED', 'PROTOTYPE_STRATEGY_GENERATED',
  'PROTOTYPE_BUILDING', 'PROTOTYPE_QA', 'PROTOTYPE_READY', 'PROTOTYPE_DEPLOYING',
  'PROTOTYPE_DEPLOYED', 'DEMO_REPLY_READY', 'DEMO_REPLY_SENT', 'HOT_LEAD',
  'MEETING_REQUESTED', 'PRICING_REQUESTED', 'CUSTOM_REQUEST',
  'HUMAN_ACTION_REQUIRED', 'CLOSED_WON', 'CLOSED_LOST',
  'INFORMATION_REQUEST_RECEIVED', 'INFORMATION_RESPONSE_DRAFTED',
  'INFORMATION_RESPONSE_VERIFIED',
];

export interface DeckCommercialProjection {
  prospectId: string;
  commercialStage: DeckCommercialStage | null;
  currentMeaningfulState: ProspectState | null;
  latestMeaningfulAction?: string;
  nextMeaningfulOperatorAction?: string;
  activeSlot: boolean;
  productionEligible: boolean;
  productionEligibilityReason: DeckProjectionReason;
  proposal?: { ready: boolean; entryPath?: string };
  contactability?: { available: boolean; channels?: readonly string[] };
}

export interface DeckCommercialProjectionInput {
  prospect: Pick<Prospect, 'id' | 'state'>;
  latestMeaningfulAction?: string;
  nextMeaningfulOperatorAction?: string;
  activeSlot?: boolean;
  productionEligible?: boolean;
  productionEligibilityReason?: DeckProjectionReason;
  proposal?: DeckCommercialProjection['proposal'];
  contactability?: DeckCommercialProjection['contactability'];
}

function isKnownState(state: string): state is ProspectState {
  return KNOWN_STATES.includes(state);
}

export function isActiveProductionState(state: string): state is ProspectState {
  return isKnownState(state) && ACTIVE_PRODUCTION_STATES.includes(state);
}

export function projectDeckCommercialStage(state: string): DeckCommercialStage | null {
  if (!isKnownState(state)) return null;
  if (state === 'WON' || state === 'CLOSED_WON') return 'GAGNES';
  if (state === 'CLOSED_LOST' || state === 'NEGATIVE_REPLY' || state === 'BOUNCED' || state === 'DO_NOT_CONTACT' || state === 'DISQUALIFIED') return 'PERDUS';
  if (state === 'DORMANT') return 'RELANCES';
  if (state === 'MEETING_BOOKED' || state === 'MEETING_REQUESTED') return 'RDV';
  if (state === 'QUOTE_PENDING' || state === 'COMMITTED') return 'DEVIS';
  if (state === 'WAITING_REPLY' || state === 'FOLLOW_UP_DUE' || state === 'FOLLOW_UP_SENT' || state === 'INTERESTED' || state === 'HOT_LEAD' || state === 'REPLY_RECEIVED' || state === 'PRICING_REQUESTED' || state === 'CUSTOM_REQUEST' || state === 'HUMAN_ACTION_REQUIRED') return 'RELANCES';
  if (state === 'EMAIL_SENT' || state === 'CONTACTED' || state === 'DEMO_REPLY_SENT') return 'ENVOYES';
  return 'A_CONTACTER';
}

export function projectDeckCommercialPipeline(input: DeckCommercialProjectionInput): DeckCommercialProjection {
  const state = input.prospect.state;
  const stage = projectDeckCommercialStage(state);
  const known = isKnownState(state);
  const active = input.activeSlot ?? isActiveProductionState(state);
  const eligible = input.productionEligible ?? active;
  const reason = input.productionEligibilityReason ?? (eligible ? 'ACTIVE_SLOT_AVAILABLE' : active ? 'ACTIVE_WINDOW_FULL' : 'NOT_PRODUCTION_STATE');
  const safeStage = known && state !== ('ARCHIVED' as string) ? stage : null;
  return {
    prospectId: input.prospect.id,
    commercialStage: safeStage,
    currentMeaningfulState: known ? state : null,
    ...(input.latestMeaningfulAction ? { latestMeaningfulAction: input.latestMeaningfulAction } : {}),
    ...(input.nextMeaningfulOperatorAction ? { nextMeaningfulOperatorAction: input.nextMeaningfulOperatorAction } : {}),
    activeSlot: active,
    productionEligible: known && safeStage !== null && eligible,
    productionEligibilityReason: !known || state === ('ARCHIVED' as string) ? 'UNSUPPORTED_STATE' : reason,
    ...(input.proposal ? { proposal: input.proposal } : {}),
    ...(input.contactability ? { contactability: input.contactability } : {}),
  };
}

export function projectDeckCommercialStages(prospects: readonly Pick<Prospect, 'id' | 'state'>[]): DeckCommercialProjection[] {
  const active = prospects.filter((prospect) => isActiveProductionState(prospect.state));
  const activeIds = new Set(active.slice(0, MAX_ACTIVE_PRODUCTION_PROSPECTS).map((prospect) => prospect.id));
  return prospects.map((prospect) => projectDeckCommercialPipeline({
    prospect,
    activeSlot: isActiveProductionState(prospect.state),
    productionEligible: !isActiveProductionState(prospect.state) || activeIds.has(prospect.id),
    productionEligibilityReason: !isActiveProductionState(prospect.state)
      ? 'NOT_PRODUCTION_STATE'
      : activeIds.has(prospect.id) ? 'ACTIVE_SLOT_AVAILABLE' : 'ACTIVE_WINDOW_FULL',
  }));
}

export function activeProductionCount(states: readonly string[]): number {
  return states.filter(isActiveProductionState).length;
}

export function hasActiveProductionCapacity(states: readonly string[]): boolean {
  return activeProductionCount(states) < MAX_ACTIVE_PRODUCTION_PROSPECTS;
}
