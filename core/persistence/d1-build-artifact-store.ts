import type { D1DatabaseLike } from './d1-types';
import type { BuildArtifactStore, BuildArtifactV1 } from '../builder/contracts';

export class D1BuildArtifactStore implements BuildArtifactStore {
  constructor(private readonly db: D1DatabaseLike) {}
  async get(id: string): Promise<BuildArtifactV1 | null> {
    const row = await this.db.prepare('SELECT artifact_json FROM v2_build_artifacts WHERE id = ? LIMIT 1').bind(id).first<{ artifact_json: string }>();
    return row ? JSON.parse(row.artifact_json) as BuildArtifactV1 : null;
  }
  async save(artifact: BuildArtifactV1): Promise<void> {
    const now = artifact.completedAt;
    await this.db.prepare(`INSERT INTO v2_build_artifacts (id, build_version, design_artifact_id, design_request_id, prospect_id, approved_revision, builder_version, source_path, output_path, status, source_hash, artifact_json, created_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, source_hash = excluded.source_hash, artifact_json = excluded.artifact_json, completed_at = excluded.completed_at, updated_at = excluded.updated_at`).bind(artifact.id, artifact.version, artifact.approvedDesignArtifactId, artifact.designRequestId, artifact.prospectId, artifact.approvedRevision, artifact.builderVersion, artifact.sourcePath, artifact.outputPath, artifact.status, artifact.sourceHash ?? null, JSON.stringify(artifact), artifact.createdAt, artifact.completedAt, now).run();
  }
}
