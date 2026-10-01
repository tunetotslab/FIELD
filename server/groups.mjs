const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeGroupCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validGroupName(value) {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 60;
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return `TT${[...bytes].map(byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')}`;
}

export async function createFieldGroup(env, ownerUserId, rawName) {
  if (!validGroupName(rawName)) throw new Error('Invalid group name');
  const name = rawName.trim();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const group = { id: crypto.randomUUID(), name, joinCode: randomCode(), createdAt: Date.now() };
    try {
      await env.DB.prepare(
        'INSERT INTO field_groups (id,name,owner_user_id,join_code,created_at,updated_at) VALUES (?,?,?,?,?,?)',
      ).bind(group.id, name, ownerUserId, group.joinCode, group.createdAt, group.createdAt).run();
      await env.DB.prepare(
        "INSERT INTO field_group_members (group_id,user_id,role,joined_at) VALUES (?,?,'owner',?)",
      ).bind(group.id, ownerUserId, group.createdAt).run();
      return group;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error('Could not create group');
}

export async function groupsForUser(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT g.id,g.name,m.role,
      CASE WHEN m.role='owner' THEN g.join_code ELSE NULL END AS joinCode,
      b.chat_title AS telegramTitle,b.message_thread_id AS messageThreadId
     FROM field_group_members m
     JOIN field_groups g ON g.id = m.group_id
     LEFT JOIN telegram_group_bindings b ON b.group_id = g.id
     WHERE m.user_id = ? AND g.active = 1
     ORDER BY m.joined_at DESC`,
  ).bind(userId).all();
  return results;
}

export async function joinFieldGroup(env, userId, rawCode) {
  const code = normalizeGroupCode(rawCode);
  if (code.length !== 9) return null;
  const group = await env.DB.prepare(
    'SELECT id,name FROM field_groups WHERE join_code = ? AND active = 1',
  ).bind(code).first();
  if (!group) return null;
  await env.DB.prepare(
    "INSERT INTO field_group_members (group_id,user_id,role,joined_at) VALUES (?,?,'member',?) ON CONFLICT(group_id,user_id) DO NOTHING",
  ).bind(group.id, userId, Date.now()).run();
  return group;
}

export async function isGroupMember(env, groupId, userId) {
  return Boolean(await env.DB.prepare(
    'SELECT 1 AS allowed FROM field_group_members m JOIN field_groups g ON g.id=m.group_id WHERE m.group_id=? AND m.user_id=? AND g.active=1',
  ).bind(groupId, userId).first());
}

export async function connectTelegramDestination(env, telegram, { code, userId, chat, messageThreadId }) {
  if (!chat || chat.type === 'private') throw new Error('Use this command in a group');
  const group = await env.DB.prepare(
    'SELECT id,name,owner_user_id FROM field_groups WHERE join_code=? AND active=1',
  ).bind(normalizeGroupCode(code)).first();
  if (!group) throw new Error('Group code not found');
  const fieldAdmin = Number(env.ADMIN_TELEGRAM_ID) === userId;
  if (!fieldAdmin && group.owner_user_id !== userId) throw new Error('Only the FIELD group owner can connect it');
  const member = await telegram('getChatMember', { chat_id: chat.id, user_id: userId });
  if (!['creator', 'administrator'].includes(member.status)) throw new Error('Telegram group admin required');
  await env.DB.prepare(
    `INSERT INTO telegram_group_bindings
      (group_id,chat_id,message_thread_id,chat_title,connected_by,connected_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(group_id) DO UPDATE SET
      chat_id=excluded.chat_id,message_thread_id=excluded.message_thread_id,
      chat_title=excluded.chat_title,connected_by=excluded.connected_by,
      connected_at=excluded.connected_at`,
  ).bind(group.id, chat.id, messageThreadId || null, chat.title || null, userId, Date.now()).run();
  return group;
}

export async function disconnectTelegramDestination(env, telegram, { userId, chat, messageThreadId }) {
  if (!chat || chat.type === 'private') throw new Error('Use this command in a group');
  const member = await telegram('getChatMember', { chat_id: chat.id, user_id: userId });
  if (!['creator', 'administrator'].includes(member.status)) throw new Error('Telegram group admin required');
  const result = await env.DB.prepare(
    'DELETE FROM telegram_group_bindings WHERE chat_id=? AND message_thread_id IS ?',
  ).bind(chat.id, messageThreadId || null).run();
  return Number(result.meta?.changes || 0) > 0;
}
