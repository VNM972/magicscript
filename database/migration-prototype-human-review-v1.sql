-- HVAL-M1: add canonical human review projection to existing prototypes.
-- Apply explicitly to an already-created local/runtime database; this file is
-- not automatically executed by the worker.
ALTER TABLE prototypes ADD COLUMN human_review_status TEXT
  CHECK (human_review_status IS NULL OR human_review_status IN ('VALIDATED', 'REJECTED'));
ALTER TABLE prototypes ADD COLUMN human_reviewed_at TEXT;
ALTER TABLE prototypes ADD COLUMN human_reviewed_by TEXT;
