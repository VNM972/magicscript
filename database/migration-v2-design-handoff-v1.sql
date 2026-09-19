-- V2-M003 additive design handoff persistence. No designer execution or backfill.
CREATE TABLE IF NOT EXISTS v2_design_requests (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  version TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  request_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(prospect_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_design_request_active
  ON jobs(kind, prospect_id, json_extract(payload_json, '$.designRequestId'))
  WHERE kind = 'V2_DESIGN_REQUEST' AND status IN ('PENDING', 'RUNNING');
