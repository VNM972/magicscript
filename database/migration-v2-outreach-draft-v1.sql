CREATE TABLE IF NOT EXISTS v2_outreach_drafts (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'MOBILE')),
  recipient_ref TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  proposal_link TEXT NOT NULL,
  booking_link TEXT,
  grounding_json TEXT NOT NULL,
  revision INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  quality_gate_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'READY_FOR_OPERATOR', 'APPROVED', 'SENT', 'MOBILE_CONFIRMED', 'SUPERSEDED')),
  created_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  action_at TEXT,
  action_by TEXT,
  approved_revision INTEGER,
  approved_hash TEXT,
  UNIQUE (proposal_id, prospect_id, channel, revision),
  UNIQUE (proposal_id, prospect_id, channel, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_v2_outreach_drafts_prospect ON v2_outreach_drafts(prospect_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v2_outreach_send_reservations (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel = 'EMAIL'),
  draft_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind = 'INITIAL'),
  status TEXT NOT NULL CHECK (status IN ('RESERVED', 'SENT', 'FAILED')),
  message_id TEXT,
  provider_message_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (proposal_id, channel, revision, kind)
);
CREATE TABLE IF NOT EXISTS v2_contacted (
  prospect_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'MOBILE')),
  contacted_at TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  message_id TEXT,
  operator_id TEXT NOT NULL,
  PRIMARY KEY (proposal_id, channel)
);
CREATE TABLE IF NOT EXISTS v2_fake_transport_deliveries (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL UNIQUE,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  proposal_link TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  send_count INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE')),
  created_at TEXT NOT NULL
);
