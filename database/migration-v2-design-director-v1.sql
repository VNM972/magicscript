-- V2-M005 safe upgrade for an existing M004 database.
-- Fresh installations use database/schema.sql instead. D1/SQLite cannot replace
-- the old UNIQUE(design_request_id, version) constraint in place, so this is a
-- transactional table rebuild. Existing M004 rows are copied as revision 1.
PRAGMA foreign_keys = OFF;
BEGIN;
CREATE TABLE v2_design_artifacts_m005 (
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
INSERT INTO v2_design_artifacts_m005
  (id, design_request_id, prospect_id, version, revision, vertical, artifact_json, status, created_at, updated_at)
SELECT id, design_request_id, prospect_id, version, 1, vertical, artifact_json, status, created_at, updated_at
FROM v2_design_artifacts;
DROP TABLE v2_design_artifacts;
ALTER TABLE v2_design_artifacts_m005 RENAME TO v2_design_artifacts;
CREATE INDEX idx_v2_design_artifacts_prospect ON v2_design_artifacts(prospect_id, created_at);
CREATE INDEX idx_v2_design_artifacts_latest ON v2_design_artifacts(design_request_id, revision DESC);
CREATE TABLE IF NOT EXISTS v2_design_reviews (
  id TEXT PRIMARY KEY, design_request_id TEXT NOT NULL, artifact_id TEXT NOT NULL, artifact_revision INTEGER NOT NULL,
  prospect_id TEXT NOT NULL, review_json TEXT NOT NULL, decision TEXT NOT NULL, reviewed_at TEXT NOT NULL,
  FOREIGN KEY (design_request_id) REFERENCES v2_design_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES v2_design_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(design_request_id, artifact_revision)
);
CREATE TABLE IF NOT EXISTS v2_design_corrections (
  id TEXT PRIMARY KEY, design_request_id TEXT NOT NULL, target_artifact_revision INTEGER NOT NULL,
  correction_json TEXT NOT NULL, created_at TEXT NOT NULL,
  FOREIGN KEY (design_request_id) REFERENCES v2_design_requests(id) ON DELETE CASCADE,
  UNIQUE(design_request_id, target_artifact_revision)
);
CREATE INDEX IF NOT EXISTS idx_v2_design_reviews_prospect ON v2_design_reviews(prospect_id, reviewed_at);
COMMIT;
PRAGMA foreign_keys = ON;
