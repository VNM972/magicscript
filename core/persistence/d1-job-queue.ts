import { jobKindPrioritySql } from '../jobs/priority';
import { canPromoteWithWebDesignReview } from '../prototypes/web-design-review';
import type { JobQueue, JobStatus, MagicScriptJob } from '../jobs/types';
import type { D1DatabaseLike } from './d1-types';
import { D1ProductionSlotStore } from './d1-production-slot-store';
import { D1BuildArtifactStore } from './d1-build-artifact-store';
import { D1BuildCorrectionStore, D1VisualQaReportStore } from './d1-visual-qa-store';
import { D1DesignRequestStore } from './d1-design-request-store';
import { validateBuildCorrectionContext } from '../builder/contracts';
import type { DesignArtifactV1 } from '../design/design-artifact';

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
    const productionKinds: readonly MagicScriptJob['kind'][] = [
      'GENERATE_PROTOTYPE_STRATEGY', 'BUILD_PROTOTYPE', 'RUN_PROTOTYPE_QA',
      'DEPLOY_PROTOTYPE', 'SEND_DEMO_LINK', 'V2_DESIGN_REQUEST', 'V2_DESIGN_REVIEW',
      'V2_DESIGN_REVISION', 'V2_BUILD_SITE', 'V2_VISUAL_QA', 'V2_BUILD_CORRECTION',
    ];
    if (input.kind === 'V2_BUILD_CORRECTION') {
      const slot = input.prospectId ? await new D1ProductionSlotStore(this.db).getActiveProductionSlot(input.prospectId) : null;
      if (!slot?.acquiredAt || slot.prospectId !== input.prospectId) throw new Error('ACTIVE_PRODUCTION_SLOT_INELIGIBLE');
      const values = input.payload as Record<string, unknown>;
      if (!values || typeof values.correctionRequestId !== 'string') throw new Error('INVALID_CORRECTION_REQUEST');
      const request = await new D1BuildCorrectionStore(this.db).get(values.correctionRequestId);
      if (!request || request.prospectId !== input.prospectId) throw new Error('INVALID_CORRECTION_REQUEST');
      const targetBuild = await new D1BuildArtifactStore(this.db).get(request.buildArtifactId);
      const qaReport = await new D1VisualQaReportStore(this.db).get(request.qaReportId);
      const designRequest = await new D1DesignRequestStore(this.db).get(request.prospectId, 'DESIGN_REQUEST_V1');
      const designRow = await this.db.prepare('SELECT artifact_json, status FROM v2_design_artifacts WHERE id = ? LIMIT 1')
        .bind(request.designArtifactId).first<{ artifact_json: string; status: DesignArtifactV1['status'] }>();
      if (!targetBuild || !qaReport || !designRequest || !designRow) throw new Error('INVALID_CORRECTION_REQUEST');
      const approvedDesignArtifact = { ...JSON.parse(designRow.artifact_json) as DesignArtifactV1, status: designRow.status };
      const revision = validateBuildCorrectionContext({ request, targetBuild, qaReport, designRequest, approvedDesignArtifact });
      const expected = { correctionRequestId: request.id, buildArtifactId: targetBuild.id,
        targetBuildRevision: revision.targetBuildRevision, nextBuildRevision: revision.nextBuildRevision,
        qaReportId: qaReport.id, designRequestId: designRequest.id, approvedDesignArtifactId: approvedDesignArtifact.id };
      if (input.id !== `job-${request.prospectId}-build-correction-${targetBuild.id}-r${revision.nextBuildRevision}`
        || Object.entries(expected).some(([key, value]) => values[key] !== value)) throw new Error('INVALID_CORRECTION_REQUEST');
      const existingRow = await this.db.prepare('SELECT * FROM jobs WHERE id = ? LIMIT 1').bind(input.id).first<JobRow>();
      const existing = existingRow ? fromRow(existingRow) : null;
      if (existing) {
        if (existing.kind !== input.kind || existing.prospectId !== input.prospectId
          || Object.entries(expected).some(([key, value]) => (existing.payload as Record<string, unknown>)[key] !== value)) {
          throw new Error('INVALID_CORRECTION_REQUEST');
        }
        return existing as MagicScriptJob<TPayload>;
      }
    } else if (input.prospectId && productionKinds.includes(input.kind)) {
      const admission = await new D1ProductionSlotStore(this.db)
        .acquireActiveProductionSlot(input.prospectId, input.kind);
      if (admission.outcome === 'CAPACITY_FULL' || admission.outcome === 'INELIGIBLE' || admission.outcome === 'INVALID') {
        throw new Error(`ACTIVE_PRODUCTION_SLOT_${admission.outcome}`);
      }
    }
    let payload = input.payload;
    if (input.kind === 'DEPLOY_PROTOTYPE' && input.prospectId) {
      const prototype = await this.db
        .prepare(
          `SELECT id, status FROM prototypes
           WHERE prospect_id = ?
           ORDER BY updated_at DESC LIMIT 1`,
        )
        .bind(input.prospectId)
        .first<{ id: string; status: string }>();
      if (prototype) {
        payload = { ...(input.payload as Record<string, unknown>), prototypeId: prototype.id } as TPayload;
        if (prototype.status === 'DEPLOYED') {
          const completed = await this.db.prepare(
            `SELECT * FROM jobs WHERE kind = 'DEPLOY_PROTOTYPE' AND prospect_id = ?
             AND status = 'SUCCEEDED' ORDER BY updated_at DESC LIMIT 1`,
          ).bind(input.prospectId).first<JobRow>();
          if (completed) return fromRow(completed) as MagicScriptJob<TPayload>;
        }
        const existing = await this.db.prepare(
          `SELECT * FROM jobs WHERE kind = 'DEPLOY_PROTOTYPE' AND prospect_id = ?
           AND status IN ('PENDING', 'RUNNING', 'SENDING')
           AND (json_extract(payload_json, '$.prototypeId') = ?
                OR json_extract(payload_json, '$.prototypeId') IS NULL)
           ORDER BY created_at ASC LIMIT 1`,
        ).bind(input.prospectId, prototype.id).first<JobRow>();
        if (existing) return fromRow(existing) as MagicScriptJob<TPayload>;
      }
    }
    const job: MagicScriptJob<TPayload> = {
      ...input,
      payload,
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

    // Reuse the canonical review predicate, then fence the atomic claim against
    // the exact persisted snapshot. A changed/latest replacement review cannot
    // consume an attempt or reach the runner using an earlier approval.
    const mayDeploy = !kinds || kinds.includes('DEPLOY_PROTOTYPE');
    const snapshots = mayDeploy
      ? await this.db.prepare(
          `SELECT p.id, p.qa_findings_json
           FROM prototypes p JOIN prospects prospect ON prospect.id = p.prospect_id
           WHERE p.status = 'READY' AND p.qa_status = 'PASS' AND prospect.state = 'PROTOTYPE_READY' AND COALESCE(p.human_review_status, '') <> 'REJECTED'
             AND p.id = (SELECT latest.id FROM prototypes latest
                         WHERE latest.prospect_id = p.prospect_id
                         ORDER BY latest.updated_at DESC LIMIT 1)`,
        ).all<{ id: string; qa_findings_json: string | null }>()
      : { results: [] };
    const approved = (snapshots.results ?? []).filter((row) =>
      canPromoteWithWebDesignReview(row.qa_findings_json),
    );
    const deployFilter = mayDeploy ? ` AND (kind <> 'DEPLOY_PROTOTYPE' OR EXISTS (
      SELECT 1 FROM prototypes p
      JOIN prospects prospect ON prospect.id = p.prospect_id
      JOIN json_each(?) approval ON json_extract(approval.value, '$.id') = p.id
      WHERE p.prospect_id = jobs.prospect_id
        AND p.status = 'READY' AND prospect.state = 'PROTOTYPE_READY'
        AND p.qa_findings_json = json_extract(approval.value, '$.qa_findings_json')
        AND p.id = (SELECT latest.id FROM prototypes latest
                    WHERE latest.prospect_id = jobs.prospect_id
                    ORDER BY latest.updated_at DESC LIMIT 1)
    ))` : '';

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
        WHERE status = 'PENDING' AND run_after <= ?${kindFilter}${affinityFilter}${prospectFilter}${deployFilter}
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
      ...(mayDeploy ? [JSON.stringify(approved)] : []),
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
