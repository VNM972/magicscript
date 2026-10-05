import type { OutreachDraftStore } from '../outreach/engine';
import type { OutreachDraftV1 } from '../outreach/contracts';
import type { D1DatabaseLike } from './d1-types';

interface DraftRow {
  id: string;
  proposal_id: string;
  prospect_id: string;
  channel: OutreachDraftV1['channel'];
  recipient_ref: string;
  subject: string | null;
  body: string;
  proposal_link: string;
  booking_link: string | null;
  grounding_json: string;
  revision: number;
  content_hash: string;
  quality_gate_json: string | null;
  status: OutreachDraftV1['status'];
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  action_at: string | null;
  action_by: string | null;
}

function fromRow(row: DraftRow): OutreachDraftV1 {
  return {
    id: row.id,
    version: 'OUTREACH_DRAFT_V1',
    proposalId: row.proposal_id,
    prospectId: row.prospect_id,
    channel: row.channel,
    recipientRef: row.recipient_ref,
    subject: row.subject,
    body: row.body,
    proposalLink: row.proposal_link,
    bookingLink: row.booking_link,
    grounding: JSON.parse(row.grounding_json),
    revision: row.revision,
    contentHash: row.content_hash,
    quality: row.quality_gate_json ? JSON.parse(row.quality_gate_json) : null,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    actionAt: row.action_at,
    actionBy: row.action_by,
  };
}

export class D1OutreachDraftStore implements OutreachDraftStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async get(id: string): Promise<OutreachDraftV1 | null> {
    const row = await this.db.prepare('SELECT * FROM v2_outreach_drafts WHERE id = ? LIMIT 1').bind(id).first<DraftRow>();
    return row ? fromRow(row) : null;
  }

  async listByCanonicalKey(key: string): Promise<OutreachDraftV1[]> {
    const separator = key.lastIndexOf(':');
    if (separator < 1) return [];
    const proposalId = key.slice(0, separator);
    const prospectAndChannel = key.slice(separator + 1);
    const channelSeparator = prospectAndChannel.lastIndexOf(':');
    if (channelSeparator < 1) return [];
    const prospectId = prospectAndChannel.slice(0, channelSeparator);
    const channel = prospectAndChannel.slice(channelSeparator + 1);
    const result = await this.db.prepare(
      'SELECT * FROM v2_outreach_drafts WHERE proposal_id = ? AND prospect_id = ? AND channel = ? ORDER BY revision ASC',
    ).bind(proposalId, prospectId, channel).all<DraftRow>();
    return (result.results ?? []).map(fromRow).sort((a, b) => a.revision - b.revision);
  }

  async save(draft: OutreachDraftV1): Promise<void> {
    await this.db.prepare(`
      INSERT INTO v2_outreach_drafts
        (id, proposal_id, prospect_id, channel, recipient_ref, subject, body, proposal_link, booking_link,
         grounding_json, revision, content_hash, quality_gate_json, status, created_at, approved_at, approved_by, action_at, action_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).bind(
      draft.id, draft.proposalId, draft.prospectId, draft.channel, draft.recipientRef, draft.subject, draft.body,
      draft.proposalLink, draft.bookingLink, JSON.stringify(draft.grounding), draft.revision, draft.contentHash, JSON.stringify(draft.quality),
      draft.status, draft.createdAt, draft.approvedAt, draft.approvedBy, draft.actionAt, draft.actionBy,
    ).run();
  }

  async saveIfCurrent(draft: OutreachDraftV1, expectedHash: string): Promise<boolean> {
    const result = await this.db.prepare(`
      UPDATE v2_outreach_drafts SET status = ?, approved_at = ?, approved_by = ?, action_at = ?, action_by = ?
      WHERE id = ? AND content_hash = ?
    `).bind(draft.status, draft.approvedAt, draft.approvedBy, draft.actionAt, draft.actionBy, draft.id, expectedHash).run();
    return Boolean(result.meta && (result.meta.changes as number | undefined) === 1);
  }
}
