ALTER TABLE prospects ADD COLUMN entry_source TEXT NOT NULL DEFAULT 'V2_PIPELINE'
  CHECK (entry_source IN ('V2_PIPELINE', 'MANUAL'));
ALTER TABLE prospects ADD COLUMN demo_url TEXT;
ALTER TABLE prospects ADD COLUMN demo_ready INTEGER NOT NULL DEFAULT 0
  CHECK (demo_ready IN (0, 1))
  CHECK (demo_ready = 0 OR (demo_url IS NOT NULL AND
    (demo_url GLOB 'http://[a-zA-Z0-9]*' OR demo_url GLOB 'https://[a-zA-Z0-9]*') AND
    demo_url NOT GLOB '*[ ' || char(9) || char(10) || char(13) || ']*'));
