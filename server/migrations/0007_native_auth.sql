-- Additive only: existing audio, Telegram identities and memberships are untouched.
CREATE TABLE IF NOT EXISTS native_challenges (
  id TEXT PRIMARY KEY, proof_hash TEXT NOT NULL, code TEXT NOT NULL,
  rate_key TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  user_id INTEGER, display_name TEXT, used_at INTEGER, denied_at INTEGER
);
CREATE INDEX IF NOT EXISTS native_challenges_rate ON native_challenges(rate_key,created_at);
CREATE TABLE IF NOT EXISTS native_sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS native_sessions_user ON native_sessions(user_id);
