CREATE TABLE IF NOT EXISTS v2_proposals (
  id TEXT PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  prospect_id TEXT NOT NULL,
  build_artifact_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status = 'PROPOSAL_READY'),
  proposal_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (build_artifact_id) REFERENCES v2_build_artifacts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_v2_proposals_prospect ON v2_proposals(prospect_id, created_at DESC);
