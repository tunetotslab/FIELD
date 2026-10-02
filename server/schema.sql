CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  charge_id TEXT UNIQUE,
  paid_at INTEGER,
  username TEXT,
  display_name TEXT,
  admin_notified_at INTEGER
);
CREATE INDEX IF NOT EXISTS donations_user_date ON donations(user_id, created_at);
CREATE INDEX IF NOT EXISTS donations_paid_date ON donations(paid_at DESC) WHERE paid_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS bot_users (
  user_id INTEGER PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'en',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sounds (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  metadata TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  group_id TEXT,
  telegram_delivery_state TEXT,
  city_key TEXT,
  client_id TEXT,
  moderation_state TEXT NOT NULL DEFAULT 'visible'
);

CREATE TABLE IF NOT EXISTS field_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id INTEGER NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS field_groups_owner ON field_groups(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS field_group_members (
  group_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES field_groups(id)
);
CREATE INDEX IF NOT EXISTS field_group_members_user ON field_group_members(user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS telegram_group_bindings (
  group_id TEXT PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  message_thread_id INTEGER,
  chat_title TEXT,
  connected_by INTEGER NOT NULL,
  connected_at INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES field_groups(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS telegram_group_destination
  ON telegram_group_bindings(chat_id, COALESCE(message_thread_id, 0));
CREATE INDEX IF NOT EXISTS sounds_group_date ON sounds(group_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sounds_world_client ON sounds(user_id, client_id) WHERE group_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sounds_group_client ON sounds(user_id, group_id, client_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sounds_world_city_date ON sounds(city_key, created_at DESC, id DESC) WHERE published=1 AND moderation_state='visible' AND group_id IS NULL;
CREATE TABLE IF NOT EXISTS world_cities (id TEXT PRIMARY KEY, location TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS city_search_cache (id TEXT PRIMARY KEY, results TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS service_limits (id TEXT PRIMARY KEY, last_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sound_reports (
  id TEXT PRIMARY KEY, sound_id TEXT NOT NULL, reporter_id INTEGER NOT NULL,
  reason TEXT NOT NULL, created_at INTEGER NOT NULL, resolved_at INTEGER,
  notified_at INTEGER, reporter_language TEXT NOT NULL DEFAULT 'en',
  resolution TEXT, resolution_notified_at INTEGER, resolution_notify_started_at INTEGER,
  UNIQUE(sound_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS sound_reports_pending ON sound_reports(resolved_at, created_at);
CREATE INDEX IF NOT EXISTS report_outcomes_pending ON sound_reports(resolution_notified_at, resolved_at) WHERE resolution IS NOT NULL;
CREATE TABLE IF NOT EXISTS sound_likes(sound_id TEXT NOT NULL REFERENCES sounds(id),user_id INTEGER NOT NULL,PRIMARY KEY(sound_id,user_id));
CREATE TABLE IF NOT EXISTS world_telegram_deliveries(sound_id TEXT PRIMARY KEY REFERENCES sounds(id),chat_id TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',message_id INTEGER,last_error TEXT,updated_at INTEGER NOT NULL);
-- Delivery receipts only: private WAV bytes never enter D1/R2 or World.
CREATE TABLE IF NOT EXISTS private_file_transfers (
  user_id INTEGER NOT NULL,
  client_id TEXT NOT NULL,
  audio_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('sending','delivered','failed','uncertain')),
  message_id INTEGER,
  telegram_file_id TEXT,
  bot_username TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, client_id)
);
CREATE INDEX IF NOT EXISTS private_file_transfer_rate ON private_file_transfers(user_id,created_at);
