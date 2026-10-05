import { MAX_ACTIVE_PRODUCTION_PROSPECTS, isActiveProductionState } from '../orchestrator/deck-commercial-pipeline';
import type { ProspectState } from '../types/prospect';
import type { JobKind } from '../jobs/types';
import type { D1DatabaseLike } from './d1-types';

export type ActiveProductionSlotResult =
  | { outcome: 'ACQUIRED'; slotId: number }
  | { outcome: 'ALREADY_HELD'; slotId: number }
  | { outcome: 'CAPACITY_FULL' }
  | { outcome: 'INELIGIBLE' }
  | { outcome: 'INVALID' };

export interface ActiveProductionSlot {
  slotId: number;
  prospectId: string;
  acquiredAt: string;
}

/** Persistent admission authority. The claim itself is one atomic UPDATE. */
export class D1ProductionSlotStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async acquireActiveProductionSlot(prospectId: string, jobKind?: JobKind): Promise<ActiveProductionSlotResult> {
    if (!prospectId.trim()) return { outcome: 'INVALID' };

    const prospect = await this.db
      .prepare('SELECT state FROM prospects WHERE id = ? LIMIT 1')
      .bind(prospectId)
      .first<{ state: ProspectState }>();
    if (!prospect) return { outcome: 'INVALID' };
    if (!isActiveProductionState(prospect.state)) {
      // Canonical V2 admission starts design while the prospect remains INGESTED.
      // Only its first design job may establish a slot; other jobs retain the
      // existing lifecycle gate, even if this prospect already holds a slot.
      if (prospect.state !== 'INGESTED' || jobKind !== 'V2_DESIGN_REQUEST') return { outcome: 'INELIGIBLE' };
      const admission = await this.db
        .prepare("SELECT prospect_id FROM v2_admissions WHERE prospect_id = ? AND result = 'ADMITTED' LIMIT 1")
        .bind(prospectId)
        .first<{ prospect_id: string }>();
      if (!admission) return { outcome: 'INELIGIBLE' };
    }

    const held = await this.db
      .prepare('SELECT slot_id FROM active_production_slots WHERE prospect_id = ? LIMIT 1')
      .bind(prospectId)
      .first<{ slot_id: number }>();
    if (held) return { outcome: 'ALREADY_HELD', slotId: held.slot_id };

    const now = new Date().toISOString();
    let claimed: { slot_id: number } | null = null;
    try {
      claimed = await this.db
        .prepare(
          `UPDATE active_production_slots
           SET prospect_id = ?, acquired_at = ?, release_reason = NULL
           WHERE slot_id = (
             SELECT slot_id FROM active_production_slots
             WHERE prospect_id IS NULL ORDER BY slot_id LIMIT 1
           )
             AND NOT EXISTS (
               SELECT 1 FROM active_production_slots WHERE prospect_id = ?
             )
           RETURNING slot_id`,
        )
        .bind(prospectId, now, prospectId)
        .first<{ slot_id: number }>();
    } catch {
      // A concurrent claim may win the UNIQUE(prospect_id) race. Re-read the
      // authority so callers receive the stable idempotent result.
      const concurrent = await this.db
        .prepare('SELECT slot_id FROM active_production_slots WHERE prospect_id = ? LIMIT 1')
        .bind(prospectId)
        .first<{ slot_id: number }>();
      if (concurrent) return { outcome: 'ALREADY_HELD', slotId: concurrent.slot_id };
    }

    if (claimed) return { outcome: 'ACQUIRED', slotId: claimed.slot_id };
    return { outcome: 'CAPACITY_FULL' };
  }

  async releaseActiveProductionSlot(prospectId: string, reason: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE active_production_slots
         SET prospect_id = NULL, acquired_at = NULL, release_reason = ?
         WHERE prospect_id = ?`,
      )
      .bind(reason, prospectId)
      .run();
  }

  async getActiveProductionSlot(prospectId: string): Promise<ActiveProductionSlot | null> {
    const row = await this.db
      .prepare('SELECT slot_id, prospect_id, acquired_at FROM active_production_slots WHERE prospect_id = ? LIMIT 1')
      .bind(prospectId)
      .first<{ slot_id: number; prospect_id: string; acquired_at: string }>();
    return row ? { slotId: row.slot_id, prospectId: row.prospect_id, acquiredAt: row.acquired_at } : null;
  }

  async listHeldProspectIds(): Promise<string[]> {
    const rows = await this.db
      .prepare('SELECT prospect_id FROM active_production_slots WHERE prospect_id IS NOT NULL ORDER BY slot_id')
      .all<{ prospect_id: string }>();
    return (rows.results ?? []).map((row) => row.prospect_id);
  }

  static readonly capacity = MAX_ACTIVE_PRODUCTION_PROSPECTS;
}
