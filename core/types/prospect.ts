export type ProspectOpportunity = 'A' | 'B' | 'C' | 'D';

export type ProspectState =
  | 'DISCOVERED'
  | 'RESEARCHING'
  | 'RESEARCH_COMPLETE'
  | 'QUALIFIED'
  | 'DISQUALIFIED'
  | 'CONTACT_DISCOVERY'
  | 'CONTACT_FOUND'
  | 'CONTACT_INVALID'
  | 'OUTREACH_READY'
  | 'EMAIL_SENT'
  | 'WAITING_REPLY'
  | 'FOLLOW_UP_DUE'
  | 'FOLLOW_UP_SENT'
  | 'POSITIVE_REPLY'
  | 'NEGATIVE_REPLY'
  | 'BOUNCED'
  | 'DO_NOT_CONTACT'
  | 'PROTOTYPE_REQUIRED'
  | 'PROTOTYPE_BUILDING'
  | 'PROTOTYPE_QA'
  | 'PROTOTYPE_READY'
  | 'HOT_LEAD'
  | 'MEETING_REQUESTED'
  | 'PRICING_REQUESTED'
  | 'CUSTOM_REQUEST'
  | 'HUMAN_ACTION_REQUIRED'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';

export interface Prospect {
  id: string;
  companyName: string;
  legalName?: string;
  activity?: string;
  location?: string;
  websiteUrl?: string;
  opportunity?: ProspectOpportunity;
  state: ProspectState;
  score?: number;
  primaryFriction?: string;
  primaryAsset?: string;
  primaryCta?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectContact {
  id: string;
  prospectId: string;
  email: string;
  sourceUrl?: string;
  sourceType?: 'official_site' | 'directory' | 'social' | 'other_public_source';
  confidence?: number;
  isValidated: boolean;
  isSuppressed: boolean;
  createdAt: string;
  updatedAt: string;
}
