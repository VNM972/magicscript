import type { EventStore } from '../events/event-store';
import type { MagicScriptEvent } from '../types/events';
import type { D1DatabaseLike } from './d1-types';

interface EventRow {
  id: string;
  prospect_id: string | null;
  actor: MagicScriptEvent['actor'];
  type: string;
  payload_json: string;
  created_at: string;
}

function fromRow(row: EventRow): MagicScriptEvent {
  return {
    id: row.id,
    prospectId: row.prospect_id ?? undefined,
    actor: row.actor,
    type: row.type,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export class D1EventStore implements EventStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async append<TPayload>(event: MagicScriptEvent<TPayload>): Promise<void> {
    await this.db.prepare(
      'INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(
      event.id,
      event.prospectId ?? null,
      event.actor,
      event.type,
      JSON.stringify(event.payload),
      event.createdAt,
    ).run();
  }

  async listByProspect(prospectId: string): Promise<MagicScriptEvent[]> {
    const result = await this.db
      .prepare('SELECT * FROM events WHERE prospect_id = ? ORDER BY created_at ASC')
      .bind(prospectId)
      .all<EventRow>();

    return (result.results ?? []).map(fromRow);
  }

  async listRecent(limit = 100): Promise<MagicScriptEvent[]> {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const result = await this.db
      .prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT ?')
      .bind(safeLimit)
      .all<EventRow>();

    return (result.results ?? []).map(fromRow);
  }
}
