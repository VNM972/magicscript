export type ProspectOpportunity = 'A' | 'B' | 'C' | 'D';

export type ProspectState =
  | 'INGESTED'
  | 'SAS_PENDING'
  | 'DISCOVERED'
  | 'RESEARCHING'
  | 'RESEARCH_COMPLETE'
  | 'QUALIFIED'
  | 'DISQUALIFIED'
  | 'CONTACT_DISCOVERY'
  | 'CONTACT_FOUND'
  | 'CONTACT_INVALID'
  | 'OUTREACH_READY'
  | 'OUTREACH_DRAFTED'
  | 'OUTREACH_VERIFIED'
  | 'EMAIL_SENT'
  | 'CONTACTED'
  | 'WAITING_REPLY'
  | 'FOLLOW_UP_DUE'
  | 'FOLLOW_UP_SENT'
  | 'REPLY_RECEIVED'
  | 'POSITIVE_REPLY'
  | 'INTERESTED'
  | 'MEETING_BOOKED'
  | 'QUOTE_PENDING'
  | 'COMMITTED'
  | 'WON'
  | 'DORMANT'
  | 'NEGATIVE_REPLY'
  | 'BOUNCED'
  | 'DO_NOT_CONTACT'
  | 'PROTOTYPE_REQUIRED'
  | 'PROTOTYPE_STRATEGY_GENERATED'
  | 'PROTOTYPE_BUILDING'
  | 'PROTOTYPE_QA'
  | 'PROTOTYPE_READY'
  | 'PROTOTYPE_DEPLOYING'
  | 'PROTOTYPE_DEPLOYED'
  | 'DEMO_REPLY_READY'
  | 'DEMO_REPLY_SENT'
  | 'HOT_LEAD'
  | 'MEETING_REQUESTED'
  | 'PRICING_REQUESTED'
  | 'CUSTOM_REQUEST'
  | 'HUMAN_ACTION_REQUIRED'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'
  | 'INFORMATION_REQUEST_RECEIVED'
  | 'INFORMATION_RESPONSE_DRAFTED'
  | 'INFORMATION_RESPONSE_VERIFIED'
  | 'POOL';

export interface Prospect {
  id: string;
  companyName: string;
  legalName?: string;
  siren?: string;
  siret?: string;
  city?: string;
  sourceUrl?: string;
  activityTaxonomy?: 'NAF_2008';
  commercialEligibility?:
    | 'HIGH_PRIORITY'
    | 'RESEARCH'
    | 'LOW_PRIORITY'
    | 'REJECT';
  brandKey?: string;
  brandCollisionGroup?: string;
  initialResearchRepresentative?: boolean;
  activity?: string;
  location?: string;
  websiteUrl?: string;
  v2Domain?: string;
  phone?: string;
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
