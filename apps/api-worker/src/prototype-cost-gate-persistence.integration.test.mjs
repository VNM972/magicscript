import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

function createDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'));

  db.prepare(`
    INSERT INTO prospects (
      id, company_name, opportunity, state, score, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'p-cost-gate',
    'Cost Gate Prospect',
    'A',
    'INTERESTED',
    80,
    '2026-09-04T09:00:00.000Z',
    '2026-09-04T09:00:00.000Z',
  );

  return db;
}

test('persists an UNKNOWN-cost NO-GO evaluation without inventing a monetary amount', () => {
  const db = createDatabase();

  db.prepare(`
    INSERT INTO prototype_cost_gate_evaluations (
      id,
      prospect_id,
      decision,
      authorization,
      policy_score,
      compute_class,
      external_cost_kind,
      external_cost_amount_eur,
      external_cost_source,
      external_cost_reason,
      reason_codes_json,
      evaluated_at,
      reevaluate_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'gate-1',
    'p-cost-gate',
    'NO-GO',
    'NONE',
    20,
    'HIGH',
    'UNKNOWN',
    null,
    null,
    'No priced external provider',
    JSON.stringify(['QUALIFIED_INTEREST', 'COMPUTE_HIGH']),
    '2026-09-04T09:00:00.000Z',
    '2026-10-04T09:00:00.000Z',
  );

  const row = db.prepare(`
    SELECT *
    FROM prototype_cost_gate_evaluations
    WHERE id = ?
  `).get('gate-1');

  assert.equal(row.external_cost_kind, 'UNKNOWN');
  assert.equal(row.external_cost_amount_eur, null);
  assert.equal(row.external_cost_source, null);
  assert.equal(row.external_cost_reason, 'No priced external provider');
  assert.equal(row.decision, 'NO-GO');
  assert.equal(row.authorization, 'NONE');

  db.close();
});

test('keeps evaluation history append-only and returns the newest evaluation first', () => {
  const db = createDatabase();

  const insert = db.prepare(`
    INSERT INTO prototype_cost_gate_evaluations (
      id,
      prospect_id,
      decision,
      authorization,
      policy_score,
      compute_class,
      external_cost_kind,
      external_cost_amount_eur,
      external_cost_source,
      external_cost_reason,
      reason_codes_json,
      evaluated_at,
      reevaluate_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    'gate-old',
    'p-cost-gate',
    'NO-GO',
    'NONE',
    30,
    'MEDIUM',
    'UNKNOWN',
    null,
    null,
    'No cost evidence',
    JSON.stringify(['QUALIFIED_INTEREST']),
    '2026-09-04T09:00:00.000Z',
    '2026-10-04T09:00:00.000Z',
  );

  insert.run(
    'gate-new',
    'p-cost-gate',
    'GO',
    'FULL',
    82,
    'LOW',
    'UNKNOWN',
    null,
    null,
    'No priced external provider',
    JSON.stringify(['QUALIFIED_INTEREST', 'ENGAGEMENT_INTENT']),
    '2026-09-10T09:00:00.000Z',
    null,
  );

  const rows = db.prepare(`
    SELECT id, decision
    FROM prototype_cost_gate_evaluations
    WHERE prospect_id = ?
    ORDER BY evaluated_at DESC
  `).all('p-cost-gate');

  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'gate-new');
  assert.equal(rows[0].decision, 'GO');
  assert.equal(rows[1].id, 'gate-old');

  assert.throws(
    () => {
      db.prepare(`
        UPDATE prototype_cost_gate_evaluations
        SET decision = 'LIGHT'
        WHERE id = 'gate-old'
      `).run();
    },
    /immutable/,
  );

  db.close();
});

test('database constraints reject inconsistent decision and authorization pairs', () => {
  const db = createDatabase();

  assert.throws(() => {
    db.prepare(`
      INSERT INTO prototype_cost_gate_evaluations (
        id,
        prospect_id,
        decision,
        authorization,
        policy_score,
        compute_class,
        external_cost_kind,
        external_cost_reason,
        reason_codes_json,
        evaluated_at,
        reevaluate_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'gate-invalid',
      'p-cost-gate',
      'GO',
      'NONE',
      90,
      'LOW',
      'UNKNOWN',
      'No cost evidence',
      '[]',
      '2026-09-04T09:00:00.000Z',
      null,
    );
  });

  db.close();
});
