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
  created_at INTEGER NOT NULL
);
