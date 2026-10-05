import test from 'node:test';
import assert from 'node:assert/strict';
import { D1ProductionSlotStore } from '../persistence/d1-production-slot-store';

/** Small D1-shaped fake: UPDATE claims are serialized synchronously, like SQLite. */
class FakeD1 {
  readonly prospects = new Map<string, string>();
  readonly slots = Array.from({ length: 20 }, (_, index) => ({ slot_id: index + 1, prospect_id: null as string | null, acquired_at: null as string | null }));
  prepare(sql: string) {
    return {
      all: async <T>() => ({ results: this.slots.filter((slot) => slot.prospect_id).map((slot) => ({ prospect_id: slot.prospect_id })) as T[] }),
      bind: (...values: unknown[]) => ({
        first: async <T>() => {
          if (sql.includes('SELECT state FROM prospects')) return (this.prospects.has(values[0] as string) ? { state: this.prospects.get(values[0] as string) } : null) as T;
          if (sql.includes('SELECT slot_id FROM active_production_slots WHERE prospect_id')) return (this.slots.find((slot) => slot.prospect_id === values[0]) ?? null) as T;
          if (sql.includes('UPDATE active_production_slots')) {
            const slot = this.slots.find((candidate) => candidate.prospect_id === null);
            if (!slot || this.slots.some((candidate) => candidate.prospect_id === values[2])) return null;
            slot.prospect_id = values[0] as string;
            slot.acquired_at = values[1] as string;
            return { slot_id: slot.slot_id } as T;
          }
          return null;
        },
        run: async () => {
          if (sql.includes('SET prospect_id = NULL')) {
            const slot = this.slots.find((candidate) => candidate.prospect_id === values[1]);
            if (slot) { slot.prospect_id = null; slot.acquired_at = null; }
          }
          return {};
        },
      }),
    };
  }
}

const eligible = (db: FakeD1, id: string) => db.prospects.set(id, 'PROTOTYPE_REQUIRED');

test('atomic slot authority admits twenty, rejects the twenty-first, and is idempotent', async () => {
  const db = new FakeD1();
  const store = new D1ProductionSlotStore(db as never);
  for (let i = 0; i < 21; i++) eligible(db, `p${i}`);
  const results = await Promise.all(Array.from({ length: 21 }, (_, i) => store.acquireActiveProductionSlot(`p${i}`)));
  assert.equal(results.filter((result) => result.outcome === 'ACQUIRED').length, 20);
  assert.equal(results[20].outcome, 'CAPACITY_FULL');
  assert.equal((await store.acquireActiveProductionSlot('p0')).outcome, 'ALREADY_HELD');
  assert.equal(new Set((await store.listHeldProspectIds())).size, 20);
});

test('ineligible prospects cannot acquire and canonical release frees a slot', async () => {
  const db = new FakeD1();
  const store = new D1ProductionSlotStore(db as never);
  db.prospects.set('bad', 'CONTACTED');
  assert.equal((await store.acquireActiveProductionSlot('bad')).outcome, 'INELIGIBLE');
  eligible(db, 'good');
  assert.equal((await store.acquireActiveProductionSlot('good')).outcome, 'ACQUIRED');
  await store.releaseActiveProductionSlot('good', 'canonical transition');
  eligible(db, 'next');
  assert.equal((await store.acquireActiveProductionSlot('next')).outcome, 'ACQUIRED');
});
