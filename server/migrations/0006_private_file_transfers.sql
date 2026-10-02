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
