-- Execute the entire file as one D1 batch / Wrangler D1 migration transaction.
-- D1 owns the atomic transaction; explicit BEGIN/COMMIT and TEMP are unsupported.
-- Dependent rows are copied byte-for-byte before
-- rebuilding the parent, then restored after its ON DELETE CASCADE actions.
-- Foreign keys remain enabled throughout; legacy artifact_json is untouched.
CREATE TABLE r73z_visual_qa_backup AS SELECT * FROM v2_visual_qa_reports;
CREATE TABLE r73z_corrections_backup AS SELECT * FROM v2_build_corrections;

CREATE TABLE v2_build_artifacts_revision_v1 (
  id TEXT PRIMARY KEY, build_version TEXT NOT NULL, design_artifact_id TEXT NOT NULL, design_request_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL, approved_revision INTEGER NOT NULL,
  build_revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(build_revision) = 'integer' AND build_revision >= 1),
  builder_version TEXT NOT NULL, source_path TEXT NOT NULL,
  output_path TEXT NOT NULL, status TEXT NOT NULL, source_hash TEXT, artifact_json TEXT NOT NULL,
  created_at TEXT NOT NULL, completed_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (design_artifact_id) REFERENCES v2_design_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (design_request_id) REFERENCES v2_design_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(design_artifact_id, builder_version, build_revision)
);
INSERT INTO v2_build_artifacts_revision_v1
  (id, build_version, design_artifact_id, design_request_id, prospect_id, approved_revision, build_revision,
   builder_version, source_path, output_path, status, source_hash, artifact_json, created_at, completed_at, updated_at)
SELECT id, build_version, design_artifact_id, design_request_id, prospect_id, approved_revision,
   CASE WHEN json_type(artifact_json, '$.buildRevision') IS NULL THEN 1
        WHEN json_type(artifact_json, '$.buildRevision') = 'integer'
             AND json_extract(artifact_json, '$.buildRevision') <= 9007199254740991
        THEN json_extract(artifact_json, '$.buildRevision') ELSE 0 END,
   builder_version, source_path, output_path, status, source_hash, artifact_json, created_at, completed_at, updated_at
FROM v2_build_artifacts;
DROP TABLE v2_build_artifacts;
ALTER TABLE v2_build_artifacts_revision_v1 RENAME TO v2_build_artifacts;
CREATE INDEX idx_v2_build_artifacts_prospect ON v2_build_artifacts(prospect_id, created_at);
INSERT INTO v2_visual_qa_reports SELECT * FROM r73z_visual_qa_backup;
INSERT INTO v2_build_corrections SELECT * FROM r73z_corrections_backup;
DROP TABLE r73z_corrections_backup;
DROP TABLE r73z_visual_qa_backup;
CREATE TABLE r73z_foreign_key_guard (violations INTEGER CHECK (violations = 0));
INSERT INTO r73z_foreign_key_guard SELECT count(*) FROM pragma_foreign_key_check;
DROP TABLE r73z_foreign_key_guard;
