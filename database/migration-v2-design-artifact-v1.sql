CREATE TABLE IF NOT EXISTS v2_design_artifacts (
  id TEXT PRIMARY KEY,
  design_request_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL,
  version TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  vertical TEXT NOT NULL,
  artifact_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (design_request_id) REFERENCES v2_design_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(design_request_id, version, revision)
);
CREATE INDEX IF NOT EXISTS idx_v2_design_artifacts_prospect ON v2_design_artifacts(prospect_id, created_at);
