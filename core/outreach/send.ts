import type { OutreachDraftV1 } from './contracts';

export type InitialSendReservationStatus = 'RESERVED' | 'SENT' | 'FAILED';
export interface InitialSendReservation {
  key: string;
  proposalId: string;
  draftId: string;
  revision: number;
  fingerprint: string;
  status: InitialSendReservationStatus;
  providerMessageId: string | null;
  createdAt: string;
}
export interface FakeTransportPayload {
  recipient: string;
  subject: string | null;
  body: string;
  proposalLink: string;
  draftId: string;
  revision: number;
  fingerprint: string;
  idempotencyKey: string;
}
export interface FakeTransportResult { success: boolean; providerMessageId: string; payload: FakeTransportPayload; sendCount: number; }
export interface InitialSendReservationStore {
  reserve(input: Omit<InitialSendReservation, 'status' | 'providerMessageId'>): Promise<{ reservation: InitialSendReservation; created: boolean }>;
  mark(reservationKey: string, status: InitialSendReservationStatus, providerMessageId?: string): Promise<InitialSendReservation>;
}
export interface ContactedProjectionStore {
  confirm(input: { proposalId: string; prospectId: string; channel: 'EMAIL' | 'MOBILE'; draftId: string; revision: number; fingerprint: string; messageId?: string; operatorId: string; contactedAt: string }): Promise<void>;
}

export class InMemoryInitialSendReservationStore implements InitialSendReservationStore {
  private readonly rows = new Map<string, InitialSendReservation>();
  private lock: Promise<void> = Promise.resolve();
  async reserve(input: Omit<InitialSendReservation, 'status' | 'providerMessageId'>) {
    let result!: { reservation: InitialSendReservation; created: boolean };
    const previous = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const current = this.rows.get(input.key);
      if (current) result = { reservation: current, created: false };
      else {
        const reservation: InitialSendReservation = { ...input, status: 'RESERVED', providerMessageId: null };
        this.rows.set(input.key, reservation);
        result = { reservation, created: true };
      }
    } finally { release(); }
    return result;
  }
  async mark(key: string, status: InitialSendReservationStatus, providerMessageId?: string) {
    const row = this.rows.get(key);
    if (!row) throw new Error('unknown send reservation');
    const next = { ...row, status, providerMessageId: providerMessageId ?? row.providerMessageId };
    this.rows.set(key, next);
    return next;
  }
  list(): InitialSendReservation[] { return [...this.rows.values()]; }
}

export class InMemoryContactedProjectionStore implements ContactedProjectionStore {
  private readonly rows = new Map<string, { proposalId: string; prospectId: string; channel: 'EMAIL' | 'MOBILE'; draftId: string; revision: number; fingerprint: string; messageId?: string; operatorId: string; contactedAt: string }>();
  async confirm(input: Parameters<ContactedProjectionStore['confirm']>[0]) { const key = `${input.proposalId}:${input.channel}`; if (!this.rows.has(key)) this.rows.set(key, input); }
  get(proposalId: string, channel: 'EMAIL' | 'MOBILE') { return this.rows.get(`${proposalId}:${channel}`) ?? null; }
}

export class DeterministicFakeEmailTransport {
  private readonly deliveries: FakeTransportResult[] = [];
  private readonly shouldSucceed: boolean;
  constructor(shouldSucceed = true) { this.shouldSucceed = shouldSucceed; }
  async send(payload: FakeTransportPayload): Promise<FakeTransportResult> {
    const prior = this.deliveries.find((item) => item.payload.idempotencyKey === payload.idempotencyKey);
    if (prior) return prior;
    const result = { success: this.shouldSucceed, providerMessageId: `fake-${payload.idempotencyKey}`, payload, sendCount: 1 };
    this.deliveries.push(result);
    return result;
  }
  list(): FakeTransportResult[] { return [...this.deliveries]; }
}

export async function confirmManualMobileContacted(input: { draft: OutreachDraftV1; approvedRevision: number; approvedFingerprint: string; proposalReady: boolean; operatorId: string; now: string; contacted: ContactedProjectionStore }): Promise<OutreachDraftV1> {
  if (!input.proposalReady) throw new Error('Proposal is not ready');
  if (input.draft.channel !== 'MOBILE' || input.draft.status !== 'APPROVED') throw new Error('approved mobile draft required');
  if (input.draft.quality && (input.draft.quality.status !== 'READY' || input.draft.quality.revision !== input.draft.revision || input.draft.quality.fingerprint !== input.draft.contentHash)) throw new Error('approved mobile draft has stale quality gate');
  if (input.draft.revision !== input.approvedRevision || input.draft.contentHash !== input.approvedFingerprint) throw new Error('stale approval or fingerprint mismatch');
  await input.contacted.confirm({ proposalId: input.draft.proposalId, prospectId: input.draft.prospectId, channel: 'MOBILE', draftId: input.draft.id, revision: input.draft.revision, fingerprint: input.draft.contentHash, operatorId: input.operatorId, contactedAt: input.now });
  return { ...input.draft, status: 'MOBILE_CONFIRMED', actionAt: input.now, actionBy: input.operatorId };
}

export async function sendApprovedInitialEmail(input: { draft: OutreachDraftV1; approvedRevision: number; approvedFingerprint: string; proposalReady: boolean; suppressed?: boolean; doNotContact?: boolean; operatorId: string; now: string; reservations: InitialSendReservationStore; transport: DeterministicFakeEmailTransport; contacted: ContactedProjectionStore }): Promise<FakeTransportResult> {
  const { draft } = input;
  if (!input.proposalReady) throw new Error('Proposal is not ready');
  if (input.suppressed || input.doNotContact) throw new Error('Recipient is suppressed or do-not-contact');
  if (draft.channel !== 'EMAIL' || draft.status !== 'APPROVED') throw new Error('draft is not approved for email');
  if (draft.quality && (draft.quality.status !== 'READY' || draft.quality.revision !== draft.revision || draft.quality.fingerprint !== draft.contentHash)) throw new Error('draft has stale quality gate');
  if (draft.revision !== input.approvedRevision || draft.contentHash !== input.approvedFingerprint) throw new Error('stale approval or fingerprint mismatch');
  const key = `${draft.proposalId}:EMAIL:${draft.revision}:INITIAL`;
  const { reservation } = await input.reservations.reserve({ key, proposalId: draft.proposalId, draftId: draft.id, revision: draft.revision, fingerprint: draft.contentHash, createdAt: input.now });
  if (reservation.status === 'SENT' && reservation.providerMessageId) return { success: true, providerMessageId: reservation.providerMessageId, payload: { recipient: draft.recipientRef, subject: draft.subject, body: draft.body, proposalLink: draft.proposalLink, draftId: draft.id, revision: draft.revision, fingerprint: draft.contentHash, idempotencyKey: key }, sendCount: 1 };
  const result = await input.transport.send({ recipient: draft.recipientRef, subject: draft.subject, body: draft.body, proposalLink: draft.proposalLink, draftId: draft.id, revision: draft.revision, fingerprint: draft.contentHash, idempotencyKey: key });
  if (!result.success) { await input.reservations.mark(key, 'FAILED'); return result; }
  await input.reservations.mark(key, 'SENT', result.providerMessageId);
  await input.contacted.confirm({ proposalId: draft.proposalId, prospectId: draft.prospectId, channel: 'EMAIL', draftId: draft.id, revision: draft.revision, fingerprint: draft.contentHash, messageId: result.providerMessageId, operatorId: input.operatorId, contactedAt: input.now });
  return result;
}
