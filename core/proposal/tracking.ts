import type { ProposalEventType } from './contracts';

export interface ProposalSessionState { firstViewedAt: string | null; lastViewedAt: string | null; }

export function proposalViewEvent(input: { session: ProposalSessionState; now: string }): ProposalEventType {
  if (!input.session.firstViewedAt) { input.session.firstViewedAt = input.now; input.session.lastViewedAt = input.now; return 'PROPOSAL_VIEWED'; }
  if (input.session.lastViewedAt !== input.now) { input.session.lastViewedAt = input.now; return 'RETURN_VISIT'; }
  return 'PROPOSAL_VIEWED';
}

export function proposalShareEvent(): ProposalEventType { return 'SHARE_CLICKED'; }
