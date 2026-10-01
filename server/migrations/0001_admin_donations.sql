ALTER TABLE donations ADD COLUMN username TEXT;
ALTER TABLE donations ADD COLUMN display_name TEXT;
ALTER TABLE donations ADD COLUMN admin_notified_at INTEGER;
CREATE INDEX IF NOT EXISTS donations_paid_date ON donations(paid_at DESC) WHERE paid_at IS NOT NULL;
