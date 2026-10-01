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

ALTER TABLE sounds ADD COLUMN group_id TEXT REFERENCES field_groups(id);
ALTER TABLE sounds ADD COLUMN telegram_delivery_state TEXT;
CREATE INDEX IF NOT EXISTS sounds_group_date ON sounds(group_id, created_at DESC);
