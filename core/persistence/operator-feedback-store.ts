import type { D1DatabaseLike } from './d1-types';
import {
  deserializeOperatorFeedbackEvent,
  serializeOperatorFeedbackEvent,
  assertOperatorFeedbackEvent,
  type OperatorFeedbackEventV1,
} from '../feedback/operator-feedback-contract';

export interface OperatorFeedbackStore {
  save(event: OperatorFeedbackEventV1): Promise<void>;
  get(eventId: string): Promise<OperatorFeedbackEventV1 | null>;
  listByProspect(prospectId: string): Promise<OperatorFeedbackEventV1[]>;
}

interface FeedbackRow { event_json: string }

export class D1OperatorFeedbackStore implements OperatorFeedbackStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async save(event: OperatorFeedbackEventV1): Promise<void> {
    assertOperatorFeedbackEvent(event);
    const serialized = serializeOperatorFeedbackEvent(event);
    await this.db.prepare(`
      INSERT INTO v2_operator_feedback_events
        (event_id, schema_version, event_version, signal, prospect_id, proposal_id, action_at, event_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO NOTHING
    `).bind(event.eventId, event.schemaVersion, event.eventVersion, event.signal, event.linkage.prospectId, event.linkage.proposalId, event.actionAt, serialized).run();
    const stored = await this.get(event.eventId);
    if (!stored) throw new Error('OPERATOR_FEEDBACK_NOT_PERSISTED');
    if (serializeOperatorFeedbackEvent(stored) !== serialized) throw new Error('IMMUTABLE_OPERATOR_FEEDBACK_CONFLICT');
  }

  async get(eventId: string): Promise<OperatorFeedbackEventV1 | null> {
    const row = await this.db.prepare('SELECT event_json FROM v2_operator_feedback_events WHERE event_id = ? LIMIT 1').bind(eventId).first<FeedbackRow>();
    return row ? deserializeOperatorFeedbackEvent(row.event_json) : null;
  }

  async listByProspect(prospectId: string): Promise<OperatorFeedbackEventV1[]> {
    const rows = await this.db.prepare('SELECT event_json FROM v2_operator_feedback_events WHERE prospect_id = ? ORDER BY action_at ASC, event_id ASC').bind(prospectId).all<FeedbackRow>();
    return (rows.results ?? []).map(row => deserializeOperatorFeedbackEvent(row.event_json));
  }
}

export class InMemoryOperatorFeedbackStore implements OperatorFeedbackStore {
  private readonly values = new Map<string, string>();

  async save(event: OperatorFeedbackEventV1): Promise<void> {
    assertOperatorFeedbackEvent(event);
    const serialized = serializeOperatorFeedbackEvent(event);
    const existing = this.values.get(event.eventId);
    if (existing && existing !== serialized) throw new Error('IMMUTABLE_OPERATOR_FEEDBACK_CONFLICT');
    this.values.set(event.eventId, serialized);
  }

  async get(eventId: string): Promise<OperatorFeedbackEventV1 | null> {
    const value = this.values.get(eventId);
    return value ? deserializeOperatorFeedbackEvent(value) : null;
  }

  async listByProspect(prospectId: string): Promise<OperatorFeedbackEventV1[]> {
    return [...this.values.values()]
      .map(deserializeOperatorFeedbackEvent)
      .filter(event => event.linkage.prospectId === prospectId)
      .sort((a, b) => a.actionAt.localeCompare(b.actionAt) || a.eventId.localeCompare(b.eventId));
  }
}
