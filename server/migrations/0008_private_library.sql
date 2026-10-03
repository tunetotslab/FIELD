-- Additive private account archive. Never modify World/Group rows or local audio.
CREATE TABLE IF NOT EXISTS private_library (
  user_id INTEGER NOT NULL,
  id TEXT NOT NULL,
  revision TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  metadata TEXT NOT NULL,
  render_hash TEXT NOT NULL,
  original_hash TEXT,
  render_type TEXT NOT NULL,
  original_type TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS private_library_blobs (
  user_id INTEGER NOT NULL,
  hash TEXT NOT NULL,
  size INTEGER NOT NULL,
  PRIMARY KEY (user_id, hash)
);
