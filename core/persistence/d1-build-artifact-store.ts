import type { D1DatabaseLike } from './d1-types';
import { BuilderError, canonicalBuildValue, effectiveBuildRevision, effectiveQaAttempt, type BuildArtifactStore, type BuildArtifactV1 } from '../builder/contracts';

type BuildRow = { artifact_json: string; build_revision: number; [key: string]: unknown };

export class D1BuildArtifactStore implements BuildArtifactStore {
  constructor(private readonly db: D1DatabaseLike) {}
  async get(id: string): Promise<BuildArtifactV1 | null> {
    const row = await this.db.prepare('SELECT * FROM v2_build_artifacts WHERE id = ? LIMIT 1').bind(id).first<BuildRow>();
    if (!row) return null;
    const artifact = JSON.parse(row.artifact_json) as BuildArtifactV1;
    const revision = effectiveBuildRevision(artifact);
    if (!Number.isSafeInteger(row.build_revision) || row.build_revision < 1 || revision !== row.build_revision) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Build JSON revision disagrees with relational revision');
    const columns: Record<string, unknown> = { id: artifact.id, build_version: artifact.version, design_artifact_id: artifact.approvedDesignArtifactId, design_request_id: artifact.designRequestId, prospect_id: artifact.prospectId, approved_revision: artifact.approvedRevision, builder_version: artifact.builderVersion, source_path: artifact.sourcePath, output_path: artifact.outputPath, status: artifact.status, source_hash: artifact.sourceHash ?? null, created_at: artifact.createdAt, completed_at: artifact.completedAt };
    if (Object.entries(columns).some(([key, value]) => row[key] !== value)) throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Build JSON disagrees with relational identity');
    return { ...artifact, buildRevision: revision, qaAttempt: effectiveQaAttempt(artifact) };
  }
  async save(artifact: BuildArtifactV1): Promise<void> {
    const revision = effectiveBuildRevision(artifact); const attempt = effectiveQaAttempt(artifact);
    const normalized = { ...artifact, buildRevision: revision, qaAttempt: attempt };
    const existing = await this.get(artifact.id);
    if (existing) { if (canonicalBuildValue(existing) !== canonicalBuildValue(normalized)) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Build artifact is first-write immutable'); return; }
    await this.db.prepare(`INSERT INTO v2_build_artifacts (id, build_version, design_artifact_id, design_request_id, prospect_id, approved_revision, build_revision, builder_version, source_path, output_path, status, source_hash, artifact_json, created_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`).bind(artifact.id, artifact.version, artifact.approvedDesignArtifactId, artifact.designRequestId, artifact.prospectId, artifact.approvedRevision, revision, artifact.builderVersion, artifact.sourcePath, artifact.outputPath, artifact.status, artifact.sourceHash ?? null, JSON.stringify(normalized), artifact.createdAt, artifact.completedAt, artifact.completedAt).run();
    const saved = await this.get(artifact.id);
    if (!saved || canonicalBuildValue(saved) !== canonicalBuildValue(normalized)) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Build identity/revision is already persisted with conflicting content');
  }
}
