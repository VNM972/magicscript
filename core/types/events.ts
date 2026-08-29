import type { ProspectState } from './prospect';

export type EventActor =
  | 'orchestrator'
  | 'research-agent'
  | 'contact-agent'
  | 'scoring-agent'
  | 'outreach-agent'
  | 'fact-check-agent'
  | 'response-agent'
  | 'prototype-agent'
  | 'qa-agent'
  | 'system'
  | 'human';

export interface MagicScriptEvent<TPayload = Record<string, unknown>> {
  id: string;
  prospectId?: string;
  actor: EventActor;
  type: string;
  payload: TPayload;
  createdAt: string;
}

export interface ProspectStateChangedPayload {
  from: ProspectState;
  to: ProspectState;
  reason?: string;
}

export interface HumanEscalationPayload {
  category:
    | 'HOT_LEAD'
    | 'MEETING_REQUESTED'
    | 'PRICING_REQUESTED'
    | 'CUSTOM_REQUEST'
    | 'CONTRACT_REQUIRED'
    | 'PAYMENT_REQUIRED'
    | 'LEGAL_REVIEW_REQUIRED'
    | 'MANUAL_REVIEW_REQUIRED';
  summary: string;
  sourceEventId?: string;
}
