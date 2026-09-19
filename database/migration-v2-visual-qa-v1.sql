CREATE TABLE IF NOT EXISTS v2_visual_qa_reports (
  id TEXT PRIMARY KEY, qa_version TEXT NOT NULL, build_artifact_id TEXT NOT NULL, design_artifact_id TEXT NOT NULL,
  design_request_id TEXT NOT NULL, prospect_id TEXT NOT NULL, attempt INTEGER NOT NULL, decision TEXT NOT NULL,
  report_json TEXT NOT NULL, created_at TEXT NOT NULL,
  FOREIGN KEY (build_artifact_id) REFERENCES v2_build_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (design_artifact_id) REFERENCES v2_design_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (design_request_id) REFERENCES v2_design_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(build_artifact_id, attempt)
);
CREATE TABLE IF NOT EXISTS v2_build_corrections (
  id TEXT PRIMARY KEY, correction_version TEXT NOT NULL, build_artifact_id TEXT NOT NULL, design_artifact_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL, qa_report_id TEXT NOT NULL, target_build_revision INTEGER NOT NULL, next_build_revision INTEGER NOT NULL,
  correction_json TEXT NOT NULL, created_at TEXT NOT NULL,
  FOREIGN KEY (build_artifact_id) REFERENCES v2_build_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (design_artifact_id) REFERENCES v2_design_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (qa_report_id) REFERENCES v2_visual_qa_reports(id) ON DELETE CASCADE,
  UNIQUE(build_artifact_id, target_build_revision)
);
