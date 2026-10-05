import type { OutreachDraftInputV1, OutreachDraftV1, OutreachGroundingV1 } from './contracts';
import { OUTREACH_DRAFT_VERSION } from './contracts';

export interface OutreachDraftStore {
  get(id: string): Promise<OutreachDraftV1 | null>;
  listByCanonicalKey(key: string): Promise<OutreachDraftV1[]>;
  save(draft: OutreachDraftV1): Promise<void>;
  saveIfCurrent?(draft: OutreachDraftV1, expectedHash: string): Promise<boolean>;
}

export interface OutreachAuditSink {
  append(event: { id: string; prospectId?: string; actor: 'human' | 'system'; type: string; payload: Record<string, unknown>; createdAt: string }): Promise<void>;
}

export class InMemoryOutreachDraftStore implements OutreachDraftStore {
  private readonly drafts = new Map<string, OutreachDraftV1>();
  async get(id: string) { return this.drafts.get(id) ?? null; }
  async listByCanonicalKey(key: string) { return [...this.drafts.values()].filter((draft) => draft.id.startsWith(`${key}:`)).sort((a, b) => a.revision - b.revision); }
  async save(draft: OutreachDraftV1) { this.drafts.set(draft.id, draft); }
  async saveIfCurrent(draft: OutreachDraftV1, expectedHash: string) {
    const current = this.drafts.get(draft.id);
    if (!current || current.contentHash !== expectedHash) return false;
    this.drafts.set(draft.id, draft);
    return true;
  }
}

function clean(value: string, field: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${field} is required`);
  return result;
}

function assertHttpUrl(value: string, field: string): void {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${field} must be an absolute HTTP(S) URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error(`${field} must be a public HTTP(S) URL`);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function contentHash(input: { proposalId: string; prospectId: string; channel: string; recipientRef: string; subject: string | null; body: string; proposalLink: string; bookingLink: string | null; grounding: OutreachGroundingV1 }): string {
  let hash = 2166136261;
  for (const character of stable(input)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0').repeat(8);
}

function message(input: OutreachDraftInputV1): { subject: string | null; body: string } {
  const business = clean(input.businessName, 'businessName');
  const observation = clean(input.observation, 'observation');
  assertHttpUrl(input.proposalLink, 'proposalLink');
  if (input.bookingLink) assertHttpUrl(input.bookingLink, 'bookingLink');
  const body = `Bonjour,\n\nEn regardant ${business}, nous avons relevé : ${observation}.\n\nNous avons préparé une proposition concrète pour votre activité : ${input.proposalLink}\n\nSi le sujet vous parle, nous pouvons en discuter quelques minutes${input.bookingLink ? ` : ${input.bookingLink}` : ''}.\n\nBien à vous,\nMagic Script`;
  if (input.channel === 'EMAIL') {
    const recipient = clean(input.recipient, 'recipient');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('recipient is not a valid email');
    return { subject: `Une proposition pour ${business}`, body };
  }
  const recipient = clean(input.recipient, 'recipient');
  if (!/^[+\d][\d ()-]{6,}$/.test(recipient)) throw new Error('recipient is not a valid mobile number');
  return { subject: null, body };
}

export async function createOutreachDraft(input: OutreachDraftInputV1, store: OutreachDraftStore): Promise<OutreachDraftV1> {
  const sourceRefs = [...new Set(input.sourceRefs.map((ref) => clean(ref, 'sourceRef')))].sort();
  if (sourceRefs.length === 0) throw new Error('at least one factual source reference is required');
  const { subject, body } = message(input);
  const grounding: OutreachGroundingV1 = { observation: input.observation.trim(), opportunity: input.opportunity?.trim() || null, sourceRefs };
  const canonical = { proposalId: clean(input.proposalId, 'proposalId'), prospectId: clean(input.prospectId, 'prospectId'), channel: input.channel, recipientRef: input.recipient.trim(), subject, body, proposalLink: input.proposalLink, bookingLink: input.bookingLink?.trim() || null, grounding };
  const hash = contentHash(canonical);
  const key = `${canonical.proposalId}:${canonical.prospectId}:${canonical.channel}`;
  const prior = await store.listByCanonicalKey(key);
  const same = prior.find((draft) => draft.contentHash === hash);
  if (same) return same;
  const revision = (prior.at(-1)?.revision ?? 0) + 1;
  const now = input.now ?? new Date().toISOString();
  const draft: OutreachDraftV1 = { id: `${key}:r${revision}`, version: OUTREACH_DRAFT_VERSION, ...canonical, revision, contentHash: hash, quality: input.quality ? { ...input.quality, revision, fingerprint: hash } : null, status: 'READY_FOR_OPERATOR', createdAt: now, approvedAt: null, approvedBy: null, actionAt: null, actionBy: null };
  await store.save(draft);
  return draft;
}

export async function editOutreachDraft(store: OutreachDraftStore, draftId: string, changes: Pick<OutreachDraftV1, 'subject' | 'body'>, now = new Date().toISOString(), audit?: OutreachAuditSink, actor = 'human'): Promise<OutreachDraftV1> {
  const draft = await store.get(draftId);
  if (!draft) throw new Error('unknown outreach draft');
  if (!['DRAFT', 'READY_FOR_OPERATOR', 'APPROVED'].includes(draft.status)) throw new Error('outreach draft is not editable');
  const body = clean(changes.body, 'body');
  const canonical = { proposalId: draft.proposalId, prospectId: draft.prospectId, channel: draft.channel, recipientRef: draft.recipientRef, subject: changes.subject?.trim() || null, body, proposalLink: draft.proposalLink, bookingLink: draft.bookingLink, grounding: draft.grounding };
  const nextRevision = draft.revision + 1;
  const next: OutreachDraftV1 = { ...draft, ...canonical, id: `${draft.proposalId}:${draft.prospectId}:${draft.channel}:r${nextRevision}`, revision: nextRevision, contentHash: contentHash(canonical), quality: null, status: 'DRAFT', createdAt: now, approvedAt: null, approvedBy: null, actionAt: null, actionBy: null };
  if (draft.status === 'APPROVED' && next.contentHash === draft.contentHash) throw new Error('approved successor requires changed content');
  if (await store.get(next.id)) throw new Error('successor revision already exists');
  await store.save(next);
  await audit?.append({ id: crypto.randomUUID(), prospectId: draft.prospectId, actor: actor as 'human', type: 'OUTREACH_DRAFT_EDITED', payload: { proposalId: draft.proposalId, prospectId: draft.prospectId, channel: draft.channel, draftId: next.id, previousDraftId: draft.id, revision: next.revision, fingerprint: next.contentHash }, createdAt: now });
  return next;
}

export async function approveOutreachDraft(store: OutreachDraftStore, draftId: string, expectedRevisionOrHash: number | string, expectedHashOrApprovedBy: string, approvedByOrNow?: string, nowOrAudit: string | OutreachAuditSink = new Date().toISOString(), audit?: OutreachAuditSink): Promise<OutreachDraftV1> {
  const draft = await store.get(draftId);
  const legacy = typeof expectedRevisionOrHash === 'string';
  const expectedRevision = legacy ? draft?.revision ?? 0 : expectedRevisionOrHash;
  const expectedHash = legacy ? expectedRevisionOrHash : expectedHashOrApprovedBy;
  const approvedBy = legacy ? expectedHashOrApprovedBy : approvedByOrNow ?? '';
  const now = typeof nowOrAudit === 'string' ? nowOrAudit : new Date().toISOString();
  const eventSink = typeof nowOrAudit === 'string' ? audit : nowOrAudit;
  if (!draft || draft.revision !== expectedRevision || draft.contentHash !== expectedHash) throw new Error('stale or unknown outreach draft');
  if (draft.status !== 'READY_FOR_OPERATOR') throw new Error('outreach draft is not awaiting approval');
  if (draft.quality && (draft.quality.status !== 'READY' || draft.quality.revision !== draft.revision || draft.quality.fingerprint !== draft.contentHash)) throw new Error('outreach draft is not quality-gated for this exact revision');
  const approved = { ...draft, status: 'APPROVED' as const, approvedAt: now, approvedBy: clean(approvedBy, 'approvedBy') };
  if (store.saveIfCurrent && !(await store.saveIfCurrent(approved, expectedHash))) throw new Error('stale or unknown outreach draft');
  if (!store.saveIfCurrent) await store.save(approved);
  await eventSink?.append({ id: crypto.randomUUID(), prospectId: approved.prospectId, actor: 'human', type: 'OUTREACH_OPERATOR_APPROVED', payload: { proposalId: approved.proposalId, prospectId: approved.prospectId, channel: approved.channel, draftId: approved.id, revision: approved.revision, fingerprint: approved.contentHash, operator: approvedBy }, createdAt: now });
  return approved;
}

export async function confirmManualMobile(store: OutreachDraftStore, draftId: string, expectedRevisionOrHash: number | string, expectedHashOrConfirmedBy: string, confirmedByOrNow?: string, now = new Date().toISOString()): Promise<OutreachDraftV1> {
  const draft = await store.get(draftId);
  const expectedRevision = typeof expectedRevisionOrHash === 'number' ? expectedRevisionOrHash : draft?.revision ?? 0;
  const expectedHash = typeof expectedRevisionOrHash === 'string' ? expectedRevisionOrHash : expectedHashOrConfirmedBy;
  const confirmedBy = typeof expectedRevisionOrHash === 'string' ? expectedHashOrConfirmedBy : confirmedByOrNow ?? '';
  if (!draft || draft.revision !== expectedRevision || draft.contentHash !== expectedHash) throw new Error('stale or unknown outreach draft');
  if (draft.channel !== 'MOBILE' || !['APPROVED', 'MOBILE_CONFIRMED'].includes(draft.status)) throw new Error('manual mobile confirmation requires an approved mobile draft');
  if (draft.status === 'MOBILE_CONFIRMED') return draft;
  const confirmed = { ...draft, status: 'MOBILE_CONFIRMED' as const, actionAt: now, actionBy: clean(confirmedBy, 'confirmedBy') };
  if (store.saveIfCurrent && !(await store.saveIfCurrent(confirmed, expectedHash))) throw new Error('stale or unknown outreach draft');
  if (!store.saveIfCurrent) await store.save(confirmed);
  return confirmed;
}
