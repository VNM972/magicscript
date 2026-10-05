PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  legal_name TEXT,
  siren TEXT,
  siret TEXT,
  city TEXT,
  source_url TEXT,
  activity_taxonomy TEXT CHECK (activity_taxonomy IS NULL OR activity_taxonomy = 'NAF_2008'),
  commercial_eligibility TEXT CHECK (commercial_eligibility IS NULL OR commercial_eligibility IN ('HIGH_PRIORITY', 'RESEARCH', 'LOW_PRIORITY', 'REJECT')),
  brand_key TEXT,
  brand_collision_group TEXT,
  initial_research_representative INTEGER CHECK (initial_research_representative IS NULL OR initial_research_representative IN (0, 1)),
  activity TEXT,
  location TEXT,
  website_url TEXT,
  phone TEXT,
  v2_domain TEXT,
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

-- Fixed persistent authority for the active pre-contact production window.
-- Exactly twenty rows are seeded; one prospect can hold at most one row.
CREATE TABLE IF NOT EXISTS active_production_slots (
  slot_id INTEGER PRIMARY KEY CHECK (slot_id BETWEEN 1 AND 20),
  prospect_id TEXT UNIQUE,
  acquired_at TEXT,
  release_reason TEXT,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
);
INSERT OR IGNORE INTO active_production_slots (slot_id) VALUES
  (1), (2), (3), (4), (5), (6), (7), (8), (9), (10),
  (11), (12), (13), (14), (15), (16), (17), (18), (19), (20);

-- Append-only current phone trust projection. Historical phone/evidence events remain in events.
CREATE TABLE IF NOT EXISTS phone_trust_states (
  prospect_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  trust_status TEXT NOT NULL CHECK (trust_status IN ('TRUSTED', 'REVOKED', 'AMBIGUOUS', 'UNTRUSTED')),
  trust_reason TEXT NOT NULL,
  source_ownership TEXT NOT NULL,
  entity_bound INTEGER NOT NULL CHECK (entity_bound IN (0, 1)),
  identity_status TEXT NOT NULL,
  evidence_event_id TEXT,
  source_url TEXT,
  source_type TEXT,
  canonicalization_event_id TEXT,
  effective_at TEXT NOT NULL,
  revoked_at TEXT,
  schema_version TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_phone_trust_status ON phone_trust_states(trust_status);
CREATE INDEX IF NOT EXISTS idx_phone_trust_normalized ON phone_trust_states(normalized_phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_legal_identity
  ON prospects(siren, siret)
  WHERE siren IS NOT NULL AND siret IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_brand_key ON prospects(brand_key);

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

-- V2 admission projection. These tables are append/insert-only for explicit packs;
-- no historical V1 prospect is backfilled into INGESTED.
CREATE TABLE IF NOT EXISTS v2_admission_contacts (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'MOBILE', 'LANDLINE', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'CONTACT_FORM')),
  raw_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('DERIVED_VALID', 'INVALID')),
  source_url TEXT,
  source_type TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(prospect_id, channel, normalized_value)
);
CREATE INDEX IF NOT EXISTS idx_v2_admission_contacts_normalized ON v2_admission_contacts(channel, normalized_value);

CREATE TABLE IF NOT EXISTS v2_admissions (
  prospect_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL UNIQUE,
  schema_version TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('ADMITTED', 'REJECTED')),
  reason_code TEXT NOT NULL,
  received_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

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

-- CP05-A4 append-only human decisions; proposal revision is bound by fingerprint.
CREATE TABLE IF NOT EXISTS v2_playbook_human_decisions (
  decision_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  proposal_version TEXT NOT NULL,
  proposal_fingerprint TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  decision_json TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_human_decision_proposal_revision
  ON v2_playbook_human_decisions(proposal_id, proposal_fingerprint);
CREATE INDEX IF NOT EXISTS idx_v2_human_decision_proposal
  ON v2_playbook_human_decisions(proposal_id, decided_at);

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
  claimed_by TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_run_after
  ON jobs(status, run_after);

CREATE INDEX IF NOT EXISTS idx_jobs_claimed_by
  ON jobs(claimed_by, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_design_request_active
  ON jobs(kind, prospect_id, json_extract(payload_json, '$.designRequestId'))
  WHERE kind = 'V2_DESIGN_REQUEST' AND status IN ('PENDING', 'RUNNING');

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

CREATE TABLE IF NOT EXISTS v2_build_artifacts (
  id TEXT PRIMARY KEY, build_version TEXT NOT NULL, design_artifact_id TEXT NOT NULL, design_request_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL, approved_revision INTEGER NOT NULL, build_revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(build_revision) = 'integer' AND build_revision >= 1), builder_version TEXT NOT NULL, source_path TEXT NOT NULL,
  output_path TEXT NOT NULL, status TEXT NOT NULL, source_hash TEXT, artifact_json TEXT NOT NULL,
  created_at TEXT NOT NULL, completed_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (design_artifact_id) REFERENCES v2_design_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (design_request_id) REFERENCES v2_design_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(design_artifact_id, builder_version, build_revision)
);
CREATE INDEX IF NOT EXISTS idx_v2_build_artifacts_prospect ON v2_build_artifacts(prospect_id, created_at);

CREATE TABLE IF NOT EXISTS v2_proposals (
  id TEXT PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  prospect_id TEXT NOT NULL,
  build_artifact_id TEXT NOT NULL,
  token TEXT NOT NULL,
  status TEXT NOT NULL,
  proposal_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_proposals_token
  ON v2_proposals(token);

CREATE INDEX IF NOT EXISTS idx_v2_proposals_created_at
  ON v2_proposals(created_at DESC);

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

CREATE TABLE IF NOT EXISTS runners (
  runner_id TEXT PRIMARY KEY,
  hostname TEXT,
  status TEXT NOT NULL,
  version TEXT,
  current_job_id TEXT,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (current_job_id) REFERENCES jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_runners_last_seen
  ON runners(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS job_results (
  job_id TEXT PRIMARY KEY,
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

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
  from_email TEXT,
  raw_text TEXT NOT NULL,
  classification TEXT,
  confidence INTEGER,
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_replies_provider_message
  ON replies(provider_message_id);

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
  runner_id TEXT,
  deployment_url TEXT,
  status TEXT NOT NULL,
  qa_status TEXT,
  human_review_status TEXT CHECK (human_review_status IS NULL OR human_review_status IN ('VALIDATED', 'REJECTED')),
  human_reviewed_at TEXT,
  human_reviewed_by TEXT,
  build_manifest_json TEXT,
  qa_findings_json TEXT,
  last_error TEXT,
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

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  -- Legacy Sales Room linkage retained for existing meetings; Proposal bookings
  -- use the neutral authority key below and do not resolve through Sales Room.
  sales_room_slug TEXT NOT NULL DEFAULT '',
  proposal_id TEXT,
  communication_mode TEXT NOT NULL CHECK (communication_mode IN ('email', 'phone')),
  start_at_utc TEXT NOT NULL,
  end_at_utc TEXT NOT NULL,
  prospect_timezone TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CONFIRMED', 'CANCELLED', 'RESCHEDULED')),
  confirmed_at TEXT NOT NULL,
  cancelled_at TEXT,
  rescheduled_from_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_confirmed_slot
  ON meetings(start_at_utc)
  WHERE status = 'CONFIRMED';

CREATE INDEX IF NOT EXISTS idx_meetings_prospect_status
  ON meetings(prospect_id, status, start_at_utc);

CREATE INDEX IF NOT EXISTS idx_meetings_start_status
  ON meetings(start_at_utc, status);

CREATE TABLE IF NOT EXISTS call_copilot_sessions (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  meeting_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
  snapshot_json TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_copilot_session_idempotency
  ON call_copilot_sessions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_copilot_sessions_prospect
  ON call_copilot_sessions(prospect_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS call_copilot_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES call_copilot_sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_copilot_action_idempotency
  ON call_copilot_actions(session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_copilot_actions_session
  ON call_copilot_actions(session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS quote_dossiers (
  id TEXT PRIMARY KEY,
  linkage_key TEXT NOT NULL UNIQUE,
  prospect_id TEXT NOT NULL,
  meeting_id TEXT,
  source_copilot_session_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'HUMAN_VALIDATED')),
  dossier_json TEXT NOT NULL,
  human_validated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'DRAFT' AND human_validated_at IS NULL)
    OR
    (status = 'HUMAN_VALIDATED' AND human_validated_at IS NOT NULL)
  ),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL,
  FOREIGN KEY (source_copilot_session_id)
    REFERENCES call_copilot_sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_dossiers_prospect
  ON quote_dossiers(prospect_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_dossiers_meeting
  ON quote_dossiers(meeting_id, updated_at DESC);


CREATE TABLE IF NOT EXISTS prototype_cost_gate_evaluations (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('GO', 'LIGHT', 'NO-GO')),
  authorization TEXT NOT NULL CHECK (authorization IN ('FULL', 'LIGHT', 'NONE')),
  policy_score INTEGER NOT NULL CHECK (policy_score BETWEEN 0 AND 100),
  compute_class TEXT NOT NULL CHECK (compute_class IN ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN')),
  external_cost_kind TEXT NOT NULL CHECK (external_cost_kind IN ('KNOWN', 'UNKNOWN')),
  external_cost_amount_eur REAL,
  external_cost_source TEXT,
  external_cost_reason TEXT,
  reason_codes_json TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  reevaluate_at TEXT,
  CHECK (
    (
      external_cost_kind = 'KNOWN'
      AND external_cost_amount_eur IS NOT NULL
      AND external_cost_amount_eur >= 0
      AND external_cost_source IS NOT NULL
      AND external_cost_reason IS NULL
    )
    OR
    (
      external_cost_kind = 'UNKNOWN'
      AND external_cost_amount_eur IS NULL
      AND external_cost_source IS NULL
      AND external_cost_reason IS NOT NULL
    )
  ),
  CHECK (
    (
      decision = 'GO'
      AND authorization = 'FULL'
      AND reevaluate_at IS NULL
    )
    OR
    (
      decision = 'LIGHT'
      AND authorization = 'LIGHT'
      AND reevaluate_at IS NULL
    )
    OR
    (
      decision = 'NO-GO'
      AND authorization = 'NONE'
      AND reevaluate_at IS NOT NULL
    )
  ),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prototype_cost_gate_prospect
  ON prototype_cost_gate_evaluations(prospect_id, evaluated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_prototype_cost_gate_immutable
BEFORE UPDATE ON prototype_cost_gate_evaluations
BEGIN
  SELECT RAISE(ABORT, 'prototype_cost_gate_evaluations are immutable');
END;
CREATE TABLE IF NOT EXISTS commercial_quotes (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  quote_id TEXT NOT NULL,
  quote_number TEXT NOT NULL,
  quote_version_hash TEXT NOT NULL,
  canonical_json TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  delivery_deadline TEXT NOT NULL,
  cgv_reference TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents > 0),
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  currency TEXT NOT NULL CHECK (currency = 'EUR'),
  deposit_percent INTEGER NOT NULL CHECK (deposit_percent = 50),
  balance_percent INTEGER NOT NULL CHECK (balance_percent = 50),
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (quote_id, quote_version_hash),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commercial_quotes_prospect
  ON commercial_quotes(prospect_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_commercial_quotes_quote
  ON commercial_quotes(quote_id, published_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_commercial_quotes_immutable
BEFORE UPDATE ON commercial_quotes
BEGIN
  SELECT RAISE(ABORT, 'commercial_quotes are immutable');
END;
CREATE TABLE IF NOT EXISTS quote_acceptance_proofs (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  quote_id TEXT NOT NULL,
  quote_number TEXT NOT NULL,
  quote_version_hash TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_company_name TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  consent_given INTEGER NOT NULL CHECK (consent_given = 1),
  consent_label TEXT NOT NULL CHECK (consent_label = 'BON_POUR_ACCORD'),
  cgv_reference TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  currency TEXT NOT NULL CHECK (currency = 'EUR'),
  source TEXT NOT NULL CHECK (source = 'SALES_ROOM'),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE (prospect_id, quote_id, quote_version_hash),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quote_acceptance_proofs_prospect
  ON quote_acceptance_proofs(prospect_id, accepted_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_acceptance_proofs_quote
  ON quote_acceptance_proofs(quote_id, quote_version_hash);

CREATE TRIGGER IF NOT EXISTS trg_quote_acceptance_proofs_immutable
BEFORE UPDATE ON quote_acceptance_proofs
BEGIN
  SELECT RAISE(ABORT, 'quote_acceptance_proofs are immutable');
END;

CREATE TABLE IF NOT EXISTS provider_usage (
  provider TEXT NOT NULL,
  period TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, period)
);


CREATE TABLE IF NOT EXISTS provider_state (
  provider TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, key)
);

-- CP05-A1 raw operator feedback is append-only and never interpreted here.
CREATE TABLE IF NOT EXISTS v2_operator_feedback_events (
  event_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  event_version TEXT NOT NULL CHECK (event_version = 'OPERATOR_FEEDBACK_EVENT_V1'),
  signal TEXT NOT NULL CHECK (signal IN ('ACCEPTED_UNCHANGED', 'EDITED', 'SECTION_EDITED', 'CHANNEL_SELECTED', 'SEND_CANCELLED', 'RESPONSE_RECEIVED', 'MEETING_BOOKED', 'REJECTED')),
  prospect_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  action_at TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_v2_operator_feedback_prospect
  ON v2_operator_feedback_events(prospect_id, action_at, event_id);
CREATE TRIGGER IF NOT EXISTS trg_v2_operator_feedback_immutable
BEFORE UPDATE ON v2_operator_feedback_events
BEGIN
  SELECT RAISE(ABORT, 'v2_operator_feedback_events are immutable');
END;
