-- V2-M002 explicit admission projection.
-- Safe additive migration only: no historical rows are backfilled or migrated.
ALTER TABLE prospects ADD COLUMN v2_domain TEXT;

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
