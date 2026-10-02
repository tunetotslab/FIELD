ALTER TABLE sound_reports ADD COLUMN reporter_language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE sound_reports ADD COLUMN resolution TEXT;
ALTER TABLE sound_reports ADD COLUMN resolution_notified_at INTEGER;
ALTER TABLE sound_reports ADD COLUMN resolution_notify_started_at INTEGER;
CREATE INDEX report_outcomes_pending ON sound_reports(resolution_notified_at, resolved_at) WHERE resolution IS NOT NULL;
