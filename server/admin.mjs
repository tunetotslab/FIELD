const ADMIN_TIME_ZONE = 'Asia/Yerevan';

export function isAdmin(env, userId) {
  return Number.isSafeInteger(userId) && userId === Number(env.ADMIN_TELEGRAM_ID);
}

export function adminKeyboard(env) {
  return { inline_keyboard: [
    [{ text: '⭐ Stats', callback_data: 'admin:stats' }, { text: '🧾 Transactions', callback_data: 'admin:transactions' }],
    [{ text: '🎙 Open FIELD', web_app: { url: env.APP_URL } }],
  ] };
}

function dayStart(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ADMIN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  // Armenia is UTC+4 and has no daylight-saving clock changes.
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - 4 * 60 * 60 * 1000;
}

export function formatAdminDate(timestamp) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: ADMIN_TIME_ZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.day} ${parts.month} · ${parts.hour}:${parts.minute}`;
}

function person(row) {
  if (row.username) return `@${row.username}`;
  if (row.display_name) return row.display_name;
  return `user ${row.user_id}`;
}

function shortCharge(chargeId) {
  if (!chargeId || chargeId.length <= 16) return chargeId || '—';
  return `${chargeId.slice(0, 8)}…${chargeId.slice(-6)}`;
}

async function totals(env, now = Date.now()) {
  const [all, today] = await Promise.all([
    env.DB.prepare('SELECT COALESCE(SUM(amount), 0) AS stars, COUNT(*) AS donations FROM donations WHERE paid_at IS NOT NULL').first(),
    env.DB.prepare('SELECT COALESCE(SUM(amount), 0) AS stars, COUNT(*) AS donations FROM donations WHERE paid_at IS NOT NULL AND paid_at >= ?').bind(dayStart(now)).first(),
  ]);
  return {
    totalStars: Number(all?.stars || 0), totalDonations: Number(all?.donations || 0),
    todayStars: Number(today?.stars || 0), todayDonations: Number(today?.donations || 0),
  };
}

async function latest(env, limit) {
  const { results = [] } = await env.DB.prepare(
    'SELECT amount, user_id, username, display_name, paid_at, charge_id FROM donations WHERE paid_at IS NOT NULL ORDER BY paid_at DESC LIMIT ?',
  ).bind(limit).all();
  return results;
}

async function telegramBalance(telegram) {
  try {
    const balance = await telegram('getMyStarBalance', {});
    return Number(balance?.amount || 0) + Number(balance?.nanostar_amount || 0) / 1_000_000_000;
  } catch { return null; }
}

function transactionLines(rows, includeCharge = false) {
  if (!rows.length) return 'No successful payments yet.';
  return rows.map((row, index) => {
    const charge = includeCharge ? `\n   ${shortCharge(row.charge_id)}` : '';
    return `${index + 1}. +${row.amount} ⭐ · ${person(row)}\n   ${formatAdminDate(row.paid_at)}${charge}`;
  }).join('\n\n');
}

export async function sendAdminStats(env, telegram, chatId) {
  const [summary, rows, balance] = await Promise.all([totals(env), latest(env, 5), telegramBalance(telegram)]);
  const balanceLine = balance === null ? '' : `\nTelegram balance: ${balance.toLocaleString('en-US')} ⭐`;
  const text = `⭐ FIELD STATS\n\nToday: ${summary.todayStars.toLocaleString('en-US')} ⭐\nTotal: ${summary.totalStars.toLocaleString('en-US')} ⭐\nDonations today: ${summary.todayDonations}\nTotal donations: ${summary.totalDonations}${balanceLine}\n\nLAST 5\n\n${transactionLines(rows)}`;
  return telegram('sendMessage', { chat_id: chatId, text, reply_markup: adminKeyboard(env) });
}

export async function sendAdminTransactions(env, telegram, chatId) {
  const rows = await latest(env, 10);
  return telegram('sendMessage', { chat_id: chatId, text: `🧾 LAST 10 FIELD DONATIONS\n\n${transactionLines(rows, true)}`, reply_markup: adminKeyboard(env) });
}

export async function sendAdminPaymentNotification(env, telegram, payment) {
  const summary = await totals(env, payment.paid_at);
  const text = `🌱 FIELD JUST GOT FED!\n\n+${payment.amount} ⭐\n👤 ${person(payment)}\n🕒 ${formatAdminDate(payment.paid_at)}\n\nTotal received: ${summary.totalStars.toLocaleString('en-US')} ⭐\nDonations: ${summary.totalDonations}\n\ntiny microphones are happy 🎙🌱`;
  return telegram('sendMessage', { chat_id: Number(env.ADMIN_TELEGRAM_ID), text, reply_markup: adminKeyboard(env) });
}
