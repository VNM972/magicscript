export const OPERATOR_FEEDBACK_EVENT_VERSION = 'OPERATOR_FEEDBACK_EVENT_V1' as const;
export const OPERATOR_FEEDBACK_SCHEMA_VERSION = 1 as const;

export type OperatorFeedbackSignal =
  | 'ACCEPTED_UNCHANGED'
  | 'EDITED'
  | 'SECTION_EDITED'
  | 'CHANNEL_SELECTED'
  | 'SEND_CANCELLED'
  | 'RESPONSE_RECEIVED'
  | 'MEETING_BOOKED'
  | 'REJECTED';

export type FeedbackChannel = 'EMAIL' | 'MOBILE';
export type RejectionReasonCode =
  | 'CONTENT_QUALITY'
  | 'WRONG_PROSPECT'
  | 'WRONG_CHANNEL'
  | 'WRONG_TIMING'
  | 'INSUFFICIENT_VALUE'
  | 'MISSING_AUTHORITY'
  | 'OTHER';

export interface FeedbackQualityLinkage {
  gateVersion: string;
  status: 'READY' | 'NEEDS_CORRECTION' | 'BLOCKED' | 'ABSTAIN';
  score: number | null;
  revision: number;
  fingerprint: string;
}

/** Exact CP04 commercial authority captured at operator-action time. */
export interface FeedbackOutreachLinkage {
  prospectId: string;
  proposalId: string;
  channel: FeedbackChannel;
  outreachDraftId: string;
  revision: number;
  contentRef: string;
  quality: FeedbackQualityLinkage;
}

export interface RejectionReason {
  code: RejectionReasonCode;
  detail: string;
}

export type OperatorFeedbackPayload =
  | { signal: 'ACCEPTED_UNCHANGED' }
  | { signal: 'EDITED'; editedFields: string[] }
  | { signal: 'SECTION_EDITED'; section: string; editedFields?: string[] }
  | { signal: 'CHANNEL_SELECTED'; channel: FeedbackChannel }
  | { signal: 'SEND_CANCELLED'; reason?: string }
  | { signal: 'RESPONSE_RECEIVED'; responseRef?: string }
  | { signal: 'MEETING_BOOKED'; meetingRef?: string }
  | { signal: 'REJECTED'; reason: RejectionReason };

export interface OperatorFeedbackEventV1 {
  readonly schemaVersion: typeof OPERATOR_FEEDBACK_SCHEMA_VERSION;
  readonly eventVersion: typeof OPERATOR_FEEDBACK_EVENT_VERSION;
  readonly eventId: string;
  readonly signal: OperatorFeedbackSignal;
  readonly actor: string;
  readonly actionAt: string;
  readonly linkage: FeedbackOutreachLinkage;
  readonly payload: OperatorFeedbackPayload;
}

export type OperatorFeedbackEventInput = Omit<OperatorFeedbackEventV1, 'schemaVersion' | 'eventVersion'>;

const signals: readonly OperatorFeedbackSignal[] = [
  'ACCEPTED_UNCHANGED', 'EDITED', 'SECTION_EDITED', 'CHANNEL_SELECTED',
  'SEND_CANCELLED', 'RESPONSE_RECEIVED', 'MEETING_BOOKED', 'REJECTED',
];
const rejectionCodes: readonly RejectionReasonCode[] = [
  'CONTENT_QUALITY', 'WRONG_PROSPECT', 'WRONG_CHANNEL', 'WRONG_TIMING',
  'INSUFFICIENT_VALUE', 'MISSING_AUTHORITY', 'OTHER',
];
const iso = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function operatorFeedbackEventIssues(event: unknown): string[] {
  const errors: string[] = [];
  if (!event || typeof event !== 'object' || Array.isArray(event)) return ['EVENT_REQUIRED'];
  const value = event as Partial<OperatorFeedbackEventV1>;
  if (value.schemaVersion !== 1 || value.eventVersion !== OPERATOR_FEEDBACK_EVENT_VERSION) errors.push('UNKNOWN_SCHEMA_VERSION');
  if (!text(value.eventId) || !text(value.actor)) errors.push('IDENTITY_REQUIRED');
  if (!signals.includes(value.signal as OperatorFeedbackSignal)) errors.push('INVALID_SIGNAL');
  if (!iso(value.actionAt)) errors.push('INVALID_ACTION_TIMESTAMP');
  const linkage = value.linkage;
  if (!linkage || !text(linkage.prospectId) || !text(linkage.proposalId) || !text(linkage.outreachDraftId) || !text(linkage.contentRef)) errors.push('CP04_LINKAGE_REQUIRED');
  if (linkage && (!['EMAIL', 'MOBILE'].includes(linkage.channel) || !Number.isInteger(linkage.revision) || linkage.revision < 1)) errors.push('INVALID_CP04_LINKAGE');
  if (!linkage?.quality) errors.push('QUALITY_LINKAGE_REQUIRED');
  if (linkage?.quality && (!text(linkage.quality.gateVersion) || !text(linkage.quality.fingerprint) || !Number.isInteger(linkage.quality.revision) || linkage.quality.revision < 1 || (linkage.quality.score !== null && (!Number.isFinite(linkage.quality.score) || linkage.quality.score < 0 || linkage.quality.score > 100)))) errors.push('INVALID_QUALITY_LINKAGE');
  const payload = value.payload as OperatorFeedbackPayload | undefined;
  if (!payload || payload.signal !== value.signal) errors.push('PAYLOAD_SIGNAL_MISMATCH');
  if (payload?.signal === 'EDITED' && (!Array.isArray(payload.editedFields) || payload.editedFields.length === 0 || payload.editedFields.some(field => !text(field)))) errors.push('EDIT_FIELDS_REQUIRED');
  if (payload?.signal === 'SECTION_EDITED' && !text(payload.section)) errors.push('SECTION_REQUIRED');
  if (payload?.signal === 'CHANNEL_SELECTED' && !['EMAIL', 'MOBILE'].includes(payload.channel)) errors.push('INVALID_SELECTED_CHANNEL');
  if (payload?.signal === 'REJECTED' && (!payload.reason || !rejectionCodes.includes(payload.reason.code) || !text(payload.reason.detail))) errors.push('STRUCTURED_REJECTION_REASON_REQUIRED');
  return [...new Set(errors)];
}

export function assertOperatorFeedbackEvent(event: unknown): asserts event is OperatorFeedbackEventV1 {
  const issues = operatorFeedbackEventIssues(event);
  if (issues.length) throw new Error(`INVALID_OPERATOR_FEEDBACK_EVENT:${issues.join(',')}`);
}

export function createOperatorFeedbackEvent(input: OperatorFeedbackEventInput): OperatorFeedbackEventV1 {
  const event: OperatorFeedbackEventV1 = {
    ...input,
    schemaVersion: OPERATOR_FEEDBACK_SCHEMA_VERSION,
    eventVersion: OPERATOR_FEEDBACK_EVENT_VERSION,
  };
  assertOperatorFeedbackEvent(event);
  return event;
}

export function serializeOperatorFeedbackEvent(event: OperatorFeedbackEventV1): string {
  assertOperatorFeedbackEvent(event);
  return JSON.stringify(event);
}

export function deserializeOperatorFeedbackEvent(value: string): OperatorFeedbackEventV1 {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('MALFORMED_OPERATOR_FEEDBACK_JSON'); }
  assertOperatorFeedbackEvent(parsed);
  return parsed;
}
