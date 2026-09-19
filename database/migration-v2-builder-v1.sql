CREATE TABLE IF NOT EXISTS v2_build_artifacts (
  id TEXT PRIMARY KEY,
  build_version TEXT NOT NULL,
  design_artifact_id TEXT NOT NULL,
  design_request_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL,
  approved_revision INTEGER NOT NULL,
  builder_version TEXT NOT NULL,
  source_path TEXT NOT NULL,
  output_path TEXT NOT NULL,
  status TEXT NOT NULL,
  source_hash TEXT,
  artifact_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (design_artifact_id) REFERENCES v2_design_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (design_request_id) REFERENCES v2_design_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(design_artifact_id, builder_version)
);
CREATE INDEX IF NOT EXISTS idx_v2_build_artifacts_prospect ON v2_build_artifacts(prospect_id, created_at);
