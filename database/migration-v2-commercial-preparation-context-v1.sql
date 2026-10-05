CREATE TABLE IF NOT EXISTS v2_commercial_preparation_contexts (
  context_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  context_version TEXT NOT NULL CHECK (context_version = 'COMMERCIAL_PREPARATION_CONTEXT_V1'),
  prospect_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  context_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  UNIQUE (proposal_id, context_id),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (proposal_id) REFERENCES v2_proposals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_v2_commercial_contexts_proposal ON v2_commercial_preparation_contexts(proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_v2_commercial_contexts_prospect ON v2_commercial_preparation_contexts(prospect_id, created_at DESC);
