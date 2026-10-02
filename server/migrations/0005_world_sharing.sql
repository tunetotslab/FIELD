CREATE TABLE sound_likes(sound_id TEXT NOT NULL REFERENCES sounds(id),user_id INTEGER NOT NULL,PRIMARY KEY(sound_id,user_id));
CREATE TABLE world_telegram_deliveries(sound_id TEXT PRIMARY KEY REFERENCES sounds(id),chat_id TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',message_id INTEGER,last_error TEXT,updated_at INTEGER NOT NULL);
