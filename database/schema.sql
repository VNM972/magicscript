PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  legal_name TEXT,
  activity TEXT,
  location TEXT,
  website_url TEXT,
  opportunity TEXT CHECK (opportunity IN ('A', 'B', 'C', 'D')),
  state TEXT NOT NULL,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  primary_friction TEXT,
  primary_asset TEXT,
  primary_cta TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prospects_state ON prospects(state);
CREATE INDEX IF NOT EXISTS idx_prospects_score ON prospects(score);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  email TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT,
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  is_validated INTEGER NOT NULL DEFAULT 0,
  is_suppressed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(prospect_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_prospect ON contacts(prospect_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  prospect_id TEXT,
  actor TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_prospect_created
  ON events(prospect_id, created_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  prospect_id TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_run_after
  ON jobs(status, run_after);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('INITIAL', 'FOLLOW_UP', 'REPLY')),
  subject TEXT,
  body_text TEXT NOT NULL,
  facts_json TEXT NOT NULL DEFAULT '[]',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  confidence INTEGER,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outreach_prospect
  ON outreach_messages(prospect_id, created_at DESC);

CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  contact_id TEXT,
  provider_message_id TEXT,
  raw_text TEXT NOT NULL,
  classification TEXT,
  confidence INTEGER,
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS suppression_list (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  prospect_id TEXT,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  error_text TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_prospect
  ON agent_runs(prospect_id, started_at DESC);

CREATE TABLE IF NOT EXISTS prototypes (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  deployment_url TEXT,
  status TEXT NOT NULL,
  qa_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS human_escalations (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  source_event_id TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_escalations_status
  ON human_escalations(status, created_at DESC);
