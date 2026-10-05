import type { D1DatabaseLike } from './d1-types';
import { BuilderError } from '../builder/contracts';
import { immutableRecordEqual, type BuildCorrectionRequestV1, type BuildCorrectionStore, type VisualQaReportStore, type VisualQaReportV1 } from '../visual-qa/contracts';

export class D1VisualQaReportStore implements VisualQaReportStore {
  constructor(private readonly db: D1DatabaseLike) {}
  private parse(row: Record<string, unknown> | null): VisualQaReportV1 | null {
    if (!row) return null;
    const report = JSON.parse(row.report_json as string) as VisualQaReportV1;
    const columns = { id: report.id, qa_version: report.version, build_artifact_id: report.buildArtifactId, design_artifact_id: report.designArtifactId, design_request_id: report.designRequestId, prospect_id: report.prospectId, attempt: report.attempt, decision: report.decision, created_at: report.createdAt };
    if (Object.entries(columns).some(([key, value]) => row[key] !== value) || !Number.isInteger(report.attempt) || report.attempt < 1 || report.attempt > 3) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'QA report disagrees with relational linkage');
    return report;
  }
  async get(id: string) { return this.parse(await this.db.prepare('SELECT * FROM v2_visual_qa_reports WHERE id = ? LIMIT 1').bind(id).first()); }
  async getForBuildAttempt(buildArtifactId: string, attempt: number) { return this.parse(await this.db.prepare('SELECT * FROM v2_visual_qa_reports WHERE build_artifact_id = ? AND attempt = ? LIMIT 1').bind(buildArtifactId, attempt).first()); }
  async save(report: VisualQaReportV1) {
    if (!Number.isInteger(report.attempt) || report.attempt < 1 || report.attempt > 3) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'Invalid QA report attempt');
    const existing = await this.get(report.id) ?? await this.getForBuildAttempt(report.buildArtifactId, report.attempt);
    if (existing) { if (!immutableRecordEqual(existing, report)) throw new BuilderError('BUILD_REVISION_CONFLICT', 'QA report is first-write immutable'); return; }
    await this.db.prepare(`INSERT INTO v2_visual_qa_reports (id, qa_version, build_artifact_id, design_artifact_id, design_request_id, prospect_id, attempt, decision, report_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`).bind(report.id, report.version, report.buildArtifactId, report.designArtifactId, report.designRequestId, report.prospectId, report.attempt, report.decision, JSON.stringify(report), report.createdAt).run();
    const saved = await this.getForBuildAttempt(report.buildArtifactId, report.attempt);
    if (!saved || !immutableRecordEqual(saved, report)) throw new BuilderError('BUILD_REVISION_CONFLICT', 'QA attempt already has a conflicting immutable report');
  }
}
export class D1BuildCorrectionStore implements BuildCorrectionStore {
  constructor(private readonly db: D1DatabaseLike) {}
  async get(id: string) {
    const row = await this.db.prepare('SELECT * FROM v2_build_corrections WHERE id = ? LIMIT 1').bind(id).first<Record<string, unknown>>();
    if (!row) return null;
    const request = JSON.parse(row.correction_json as string) as BuildCorrectionRequestV1;
    const columns = { id: request.id, correction_version: request.version, build_artifact_id: request.buildArtifactId, design_artifact_id: request.designArtifactId, prospect_id: request.prospectId, qa_report_id: request.qaReportId, target_build_revision: request.targetBuildRevision, next_build_revision: request.nextBuildRevision, created_at: request.createdAt };
    if (Object.entries(columns).some(([key, value]) => row[key] !== value)) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'Correction JSON disagrees with relational linkage');
    return request;
  }
  async save(request: BuildCorrectionRequestV1) {
    const existing = await this.get(request.id);
    if (existing) { if (!immutableRecordEqual(existing, request)) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'Correction request is first-write immutable'); return; }
    await this.db.prepare(`INSERT INTO v2_build_corrections (id, correction_version, build_artifact_id, design_artifact_id, prospect_id, qa_report_id, target_build_revision, next_build_revision, correction_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`).bind(request.id, request.version, request.buildArtifactId, request.designArtifactId, request.prospectId, request.qaReportId, request.targetBuildRevision, request.nextBuildRevision, JSON.stringify(request), request.createdAt).run();
    const saved = await this.get(request.id);
    if (!saved || !immutableRecordEqual(saved, request)) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'Correction already exists with conflicting content');
  }
}
