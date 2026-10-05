export const OUTREACH_DRAFT_VERSION = 'OUTREACH_DRAFT_V1' as const;
export type OutreachChannel = 'EMAIL' | 'MOBILE';
export type OutreachDraftStatus = 'DRAFT' | 'READY_FOR_OPERATOR' | 'APPROVED' | 'SENT' | 'MOBILE_CONFIRMED' | 'SUPERSEDED';
export type OutreachQualityStatus = 'READY' | 'NEEDS_CORRECTION' | 'BLOCKED' | 'ABSTAIN';
export interface OutreachQualityBinding {
  gateVersion: string;
  status: OutreachQualityStatus;
  decision: 'READY_FOR_OPERATOR' | 'REGENERATE' | 'BLOCKED' | 'ABSTAIN';
  score: number | null;
  blockers: string[];
  warnings: string[];
  attempt: number;
  revision: number;
  fingerprint: string;
}

export interface OutreachGroundingV1 {
  observation: string;
  opportunity: string | null;
  sourceRefs: string[];
}

export interface OutreachDraftV1 {
  id: string;
  version: typeof OUTREACH_DRAFT_VERSION;
  proposalId: string;
  prospectId: string;
  channel: OutreachChannel;
  recipientRef: string;
  subject: string | null;
  body: string;
  proposalLink: string;
  bookingLink: string | null;
  grounding: OutreachGroundingV1;
  revision: number;
  contentHash: string;
  quality: OutreachQualityBinding | null;
  status: OutreachDraftStatus;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  actionAt: string | null;
  actionBy: string | null;
}

export interface OutreachDraftInputV1 {
  proposalId: string;
  prospectId: string;
  businessName: string;
  channel: OutreachChannel;
  recipient: string;
  observation: string;
  opportunity?: string | null;
  proposalLink: string;
  bookingLink?: string | null;
  sourceRefs: string[];
  quality?: OutreachQualityBinding | null;
  now?: string;
}
