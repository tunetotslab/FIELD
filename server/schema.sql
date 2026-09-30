CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  charge_id TEXT UNIQUE,
  paid_at INTEGER
);
CREATE INDEX IF NOT EXISTS donations_user_date ON donations(user_id, created_at);
CREATE TABLE IF NOT EXISTS sounds (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  metadata TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
