ALTER TABLE sounds ADD COLUMN city_key TEXT;
ALTER TABLE sounds ADD COLUMN client_id TEXT;
ALTER TABLE sounds ADD COLUMN moderation_state TEXT NOT NULL DEFAULT 'visible';
CREATE UNIQUE INDEX sounds_world_client ON sounds(user_id, client_id) WHERE group_id IS NULL;
CREATE UNIQUE INDEX sounds_group_client ON sounds(user_id, group_id, client_id) WHERE group_id IS NOT NULL;
CREATE INDEX sounds_world_city_date ON sounds(city_key, created_at DESC, id DESC) WHERE published=1 AND moderation_state='visible' AND group_id IS NULL;
CREATE TABLE world_cities (id TEXT PRIMARY KEY, location TEXT NOT NULL);
CREATE TABLE city_search_cache (id TEXT PRIMARY KEY, results TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE service_limits (id TEXT PRIMARY KEY, last_at INTEGER NOT NULL);
CREATE TABLE sound_reports (
  id TEXT PRIMARY KEY, sound_id TEXT NOT NULL, reporter_id INTEGER NOT NULL,
  reason TEXT NOT NULL, created_at INTEGER NOT NULL, resolved_at INTEGER,
  notified_at INTEGER, UNIQUE(sound_id, reporter_id)
);
CREATE INDEX sound_reports_pending ON sound_reports(resolved_at, created_at);
-- Preserve any pre-launch World rows already resolved to a named city.
UPDATE sounds SET city_key=json_extract(metadata,'$.location.placeId')
  WHERE group_id IS NULL AND json_valid(metadata) AND json_extract(metadata,'$.location.placeId') IS NOT NULL;
INSERT OR IGNORE INTO world_cities(id,location)
  SELECT city_key,json_extract(metadata,'$.location') FROM sounds WHERE city_key IS NOT NULL AND group_id IS NULL;
