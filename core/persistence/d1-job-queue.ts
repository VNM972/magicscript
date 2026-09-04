import { jobKindPrioritySql } from '../jobs/priority';
import type { JobQueue, JobStatus, MagicScriptJob } from '../jobs/types';
import type { D1DatabaseLike } from './d1-types';

interface JobRow {
  id: string;
  kind: MagicScriptJob['kind'];
  prospect_id: string | null;
  payload_json: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_after: string;
  last_error: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: JobRow): MagicScriptJob {
  return {
    id: row.id,
    kind: row.kind,
    prospectId: row.prospect_id ?? undefined,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastError: row.last_error ?? undefined,
    claimedBy: row.claimed_by ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
  };
}

export class D1JobQueue implements JobQueue {
  constructor(private readonly db: D1DatabaseLike) {}

  async enqueue<TPayload>(
    input: Omit<
      MagicScriptJob<TPayload>,
      'status' | 'attempts' | 'createdAt' | 'updatedAt' | 'claimedBy' | 'claimedAt'
    >,
  ): Promise<MagicScriptJob<TPayload>> {
    const now = new Date().toISOString();
    const job: MagicScriptJob<TPayload> = {
      ...input,
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.prepare(
      `INSERT INTO jobs (
        id, kind, prospect_id, payload_json, status, attempts,
        max_attempts, run_after, last_error, claimed_by, claimed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    ).bind(
      job.id,
      job.kind,
      job.prospectId ?? null,
      JSON.stringify(job.payload),
      job.status,
      job.attempts,
      job.maxAttempts,
      job.runAfter,
      null,
      job.createdAt,
      job.updatedAt,
    ).run();

    return job;
  }

  async next(
    now = new Date(),
    claimedBy?: string,
    allowedKinds?: readonly MagicScriptJob['kind'][],
    prospectId?: string,
  ): Promise<MagicScriptJob | null> {
    const claimedAt = now.toISOString();
    const kinds = allowedKinds?.length ? [...allowedKinds] : null;
    const kindFilter = kinds
      ? ` AND kind IN (${kinds.map(() => '?').join(', ')})`
      : '';
    const affinityFilter = claimedBy
      ? " AND (json_extract(payload_json, '$.requiredRunnerId') IS NULL OR json_extract(payload_json, '$.requiredRunnerId') = ?)"
      : " AND json_extract(payload_json, '$.requiredRunnerId') IS NULL";
    const prospectFilter = prospectId ? ' AND prospect_id = ?' : '';

    const sql = `UPDATE jobs
      SET status = 'RUNNING',
          attempts = attempts + 1,
          claimed_by = ?,
          claimed_at = ?,
          last_error = NULL,
          updated_at = ?
      WHERE id = (
        SELECT id
        FROM jobs
        WHERE status = 'PENDING' AND run_after <= ?${kindFilter}${affinityFilter}${prospectFilter}
        ORDER BY ${jobKindPrioritySql('kind')} ASC, created_at ASC
        LIMIT 1
      )
      AND status = 'PENDING'
      RETURNING *`;

    const bindings: unknown[] = [
      claimedBy ?? null,
      claimedAt,
      claimedAt,
      claimedAt,
      ...(kinds ?? []),
      ...(claimedBy ? [claimedBy] : []),
      ...(prospectId ? [prospectId] : []),
    ];

    const row = await this.db
      .prepare(sql)
      .bind(...bindings)
      .first<JobRow>();

    return row ? fromRow(row) : null;
  }

  async markSucceeded(id: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE jobs
         SET status = 'SUCCEEDED',
             claimed_by = NULL,
             claimed_at = NULL,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  async markFailed(id: string, error: string, retryAfter = new Date()): Promise<void> {
    const row = await this.db
      .prepare('SELECT * FROM jobs WHERE id = ? LIMIT 1')
      .bind(id)
      .first<JobRow>();

    if (!row) throw new Error(`Job not found: ${id}`);

    if (row.status === 'SUCCEEDED' || row.status === 'DEAD_LETTER' || row.status === 'SEND_UNKNOWN') {
      return;
    }

    const status: JobStatus = row.status === 'SENDING'
      ? 'SEND_UNKNOWN'
      : row.attempts >= row.max_attempts
        ? 'DEAD_LETTER'
        : 'PENDING';

    await this.db
      .prepare(
        `UPDATE jobs
         SET status = ?,
             run_after = ?,
             last_error = ?,
             claimed_by = CASE WHEN ? IN ('PENDING', 'SEND_UNKNOWN', 'DEAD_LETTER') THEN NULL ELSE claimed_by END,
             claimed_at = CASE WHEN ? IN ('PENDING', 'SEND_UNKNOWN', 'DEAD_LETTER') THEN NULL ELSE claimed_at END,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        status,
        retryAfter.toISOString(),
        error,
        status,
        status,
        new Date().toISOString(),
        id,
      )
      .run();
  }

  async releaseClaim(
    id: string,
    claimedBy: string,
    reason: string,
    runAfter = new Date(),
  ): Promise<MagicScriptJob | null> {
    const now = new Date().toISOString();
    const row = await this.db
      .prepare(
        `UPDATE jobs
         SET status = CASE WHEN status = 'SENDING' THEN 'SEND_UNKNOWN' ELSE 'PENDING' END,
             attempts = CASE
               WHEN status = 'RUNNING' AND attempts > 0 THEN attempts - 1
               ELSE attempts
             END,
             run_after = ?,
             last_error = ?,
             claimed_by = NULL,
             claimed_at = NULL,
             updated_at = ?
         WHERE id = ?
           AND claimed_by = ?
           AND status IN ('RUNNING', 'SENDING')
         RETURNING *`,
      )
      .bind(runAfter.toISOString(), reason, now, id, claimedBy)
      .first<JobRow>();

    return row ? fromRow(row) : null;
  }

  async list(status?: JobStatus): Promise<MagicScriptJob[]> {
    const result = status
      ? await this.db
          .prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at ASC')
          .bind(status)
          .all<JobRow>()
      : await this.db.prepare('SELECT * FROM jobs ORDER BY created_at ASC').all<JobRow>();

    return (result.results ?? []).map(fromRow);
  }
}
