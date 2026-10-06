ALTER TABLE meetings ADD COLUMN cal_uid TEXT;
ALTER TABLE meetings ADD COLUMN metadata TEXT;
CREATE UNIQUE INDEX idx_meetings_cal_uid ON meetings(cal_uid) WHERE cal_uid IS NOT NULL;
