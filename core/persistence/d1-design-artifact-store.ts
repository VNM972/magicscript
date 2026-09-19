import type { D1DatabaseLike } from './d1-types';
import type { DesignArtifactStore, DesignArtifactV1 } from '../design/design-artifact';
import { DESIGN_ARTIFACT_VERSION } from '../design/design-artifact';

export class D1DesignArtifactStore implements DesignArtifactStore {
  constructor(private readonly db: D1DatabaseLike) {}
  async get(designRequestId: string, version: typeof DESIGN_ARTIFACT_VERSION, revision = 1): Promise<DesignArtifactV1 | null> {
    const row = await this.db.prepare('SELECT artifact_json FROM v2_design_artifacts WHERE design_request_id = ? AND version = ? AND revision = ? LIMIT 1').bind(designRequestId, version, revision).first<{ artifact_json: string }>();
    return row ? JSON.parse(row.artifact_json) as DesignArtifactV1 : null;
  }
  async save(artifact: DesignArtifactV1): Promise<void> {
    await this.db.prepare(`INSERT INTO v2_design_artifacts (id, design_request_id, prospect_id, version, revision, vertical, artifact_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(design_request_id, version, revision) DO UPDATE SET artifact_json = excluded.artifact_json, status = excluded.status, updated_at = excluded.updated_at`).bind(artifact.id, artifact.designRequestId, artifact.prospectId, artifact.version, artifact.revision, artifact.verticalProfile, JSON.stringify(artifact), artifact.status, artifact.createdAt, artifact.createdAt).run();
  }
}
