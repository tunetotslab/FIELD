import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker, { authenticate, validAmount } from '../server/worker.mjs';
import links from '../shared/links.json' with { type: 'json' };
import { aboutText, helpText, linksText } from '../server/bot-help.mjs';
import { DAILY_MISSION_COUNT, dailyMission, dailyMissionNumber } from '../server/daily-missions.mjs';
import { normalizeGroupCode, validGroupName } from '../server/groups.mjs';
const token = 'test-token-not-a-real-secret';
const now = Date.now();
const params = new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:12345}),query_id:'test-query'});
const data = [...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
const key = createHmac('sha256','WebAppData').update(token).digest();
params.set('hash',createHmac('sha256',key).update(data).digest('hex'));
assert.equal(await authenticate(params.toString(),token,now),12345);
await assert.rejects(authenticate(params.toString().replace('12345','99999'),token,now));
await assert.rejects(authenticate(params.toString(),token,now+3601000));
await assert.rejects(authenticate(params.toString()+'&user=%7B%22id%22%3A5%7D',token,now));
for (const amount of [1,5,6,99,100,1000,10000,99999,100000]) assert.ok(validAmount(amount));
for (const amount of [0,-1,100001,999999,1000000,1000001,5.5,'10',Infinity]) assert.ok(!validAmount(amount));
assert.equal(normalizeGroupCode(' tt-ab2 3_cd '), 'TTAB23CD');
assert.ok(validGroupName('Tune Tots 2026'));
assert.ok(!validGroupName('x'));
assert.ok(!validGroupName('x'.repeat(61)));
assert.equal(DAILY_MISSION_COUNT, 100);
for (const locale of ['en', 'ru', 'hy', 'zh-TW']) {
  const localized = Array.from({ length: DAILY_MISSION_COUNT }, (_, index) => dailyMission(locale, index));
  assert.equal(new Set(localized).size, DAILY_MISSION_COUNT, `${locale} daily missions must not repeat within one cycle`);
  assert.ok(localized.every(text => text.length > 20), `${locale} daily missions must contain a real prompt`);
}
assert.match(dailyMissionNumber(42), /^\d{3}$/);
const env = {APP_ORIGIN:'https://tunetotslab.github.io',BOT_TOKEN:token,WEBHOOK_SECRET:'test-only'};
assert.equal((await worker.fetch(new Request('https://example.com/donations',{method:'POST',headers:{Origin:env.APP_ORIGIN},body:'{}'}),env)).status,401);
assert.equal((await worker.fetch(new Request('https://example.com/telegram/webhook',{method:'POST',body:'{}'}),env)).status,403);
assert.equal((await worker.fetch(new Request('https://example.com/donations',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}),env)).status,403);
console.log('PASS signed Telegram auth, tampering, expiry, duplicate keys, donation amounts, unauthorized routes and webhook');

// Exercise the actual webhook: inline buttons must reach the same pages as commands.
const originalFetch = globalThis.fetch;
const sent = [];
globalThis.fetch = async (url, options) => {
  sent.push({ method: String(url).split('/').at(-1), ...JSON.parse(options.body) });
  return Response.json({ ok: true, result: true });
};
try {
  for (const language_code of ['en', 'ru', 'hy', 'zh-TW']) {
    for (const page of ['help', 'links', 'about']) {
      for (const inline of [false, true]) {
        sent.length = 0;
        const from = { id: 12345, language_code };
        const update = inline
          ? { callback_query: { id: 'test', from, data: `bot:${page}`, message: { chat: { id: 12345 } } } }
          : { message: { from, chat: { id: 12345 }, text: `/${page}` } };
        const response = await worker.fetch(new Request('https://example.com/telegram/webhook', {
          method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': env.WEBHOOK_SECRET }, body: JSON.stringify(update),
        }), env);
        assert.equal(response.status, 200);
        const result = sent.find(item => item.method === 'sendMessage');
        assert.ok(result, `${language_code}/${page} must reply`);
        if (page === 'help') assert.equal(result.text, helpText[language_code]);
        if (page === 'links') {
          assert.ok(result.text.startsWith(linksText[language_code]));
          const urls = result.reply_markup.inline_keyboard.flat().map(button => button.url);
          for (const url of Object.values(links)) {
            if (url.startsWith('mailto:')) assert.ok(result.text.includes(url.slice(7)));
            else assert.ok(urls.includes(url), `Missing link: ${url}`);
          }
        }
        if (page === 'about') assert.equal(result.text, aboutText[language_code]);
      }
    }
    sent.length = 0;
    const update = { callback_query: { id: 'daily-test', from: { id: 12345, language_code }, data: 'bot:daily:42', message: { chat: { id: 12345 } } } };
    const response = await worker.fetch(new Request('https://example.com/telegram/webhook', {
      method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': env.WEBHOOK_SECRET }, body: JSON.stringify(update),
    }), env);
    assert.equal(response.status, 200);
    const daily = sent.find(item => item.method === 'sendMessage');
    assert.ok(daily.text.includes(dailyMission(language_code, 42)), `${language_code} daily mission must use the selected language`);
    assert.ok(daily.text.includes(`#${dailyMissionNumber(42)}`));
    assert.equal(daily.reply_markup.inline_keyboard[1][0].callback_data, 'bot:daily:79');
  }
  sent.length = 0;
  const selectedLanguageEnv = { ...env, DB: { prepare: () => ({ bind() { return this; }, async first() { return { language: 'ru' }; } }) } };
  const selectedResponse = await worker.fetch(new Request('https://example.com/telegram/webhook', {
    method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': env.WEBHOOK_SECRET }, body: JSON.stringify({
      callback_query: { id: 'selected-language', from: { id: 12345, language_code: 'en' }, data: 'bot:daily:7', message: { chat: { id: 12345 } } },
    }),
  }), selectedLanguageEnv);
  assert.equal(selectedResponse.status, 200);
  assert.ok(sent.find(item => item.method === 'sendMessage').text.includes(dailyMission('ru', 7)), 'explicitly selected bot language must override Telegram profile language');
} finally { globalThis.fetch = originalFetch; }
console.log('PASS localized daily missions, help, links and about via commands and inline buttons; all app links included');

class AdminTestDB {
  constructor() { this.rows = [{ id:'invoice-1', user_id:77, amount:25, created_at:now, charge_id:null, paid_at:null, username:null, display_name:null, admin_notified_at:null }]; }
  prepare(sql) {
    const db = this;
    return { args: [], bind(...args) { this.args = args; return this; },
      async first() {
        if (sql.startsWith('SELECT language')) return null;
        if (sql.includes('WHERE id = ?')) return db.rows.find(row => row.id === this.args[0]) || null;
        if (sql.includes('WHERE charge_id = ?')) return db.rows.find(row => row.charge_id === this.args[0]) || null;
        if (sql.includes('COALESCE(SUM(amount)') && sql.includes('paid_at >= ?')) {
          const paid = db.rows.filter(row => row.paid_at !== null && row.paid_at >= this.args[0]);
          return { stars: paid.reduce((sum, row) => sum + row.amount, 0), donations: paid.length };
        }
        if (sql.includes('COALESCE(SUM(amount)')) {
          const paid = db.rows.filter(row => row.paid_at !== null);
          return { stars: paid.reduce((sum, row) => sum + row.amount, 0), donations: paid.length };
        }
        return null;
      },
      async all() {
        if (sql.includes('WHERE paid_at IS NOT NULL')) return { results: db.rows.filter(row => row.paid_at !== null).sort((a,b) => b.paid_at - a.paid_at).slice(0, this.args[0]) };
        return { results: [] };
      },
      async run() {
        if (sql.startsWith('UPDATE donations SET charge_id')) {
          const [charge_id, paid_at, username, display_name, id] = this.args;
          const row = db.rows.find(item => item.id === id && item.charge_id === null);
          if (!row) return { meta:{ changes:0 } };
          if (db.rows.some(item => item.charge_id === charge_id)) throw new Error('UNIQUE');
          Object.assign(row,{charge_id,paid_at,username,display_name});
          return { meta:{ changes:1 } };
        }
        if (sql.startsWith('UPDATE donations SET admin_notified_at')) {
          const [admin_notified_at,id] = this.args;
          const row = db.rows.find(item => item.id === id && item.admin_notified_at === null);
          if (!row) return { meta:{ changes:0 } };
          row.admin_notified_at = admin_notified_at;
          return { meta:{ changes:1 } };
        }
        return { meta:{ changes:0 } };
      }
    };
  }
}

const adminEnv = { ...env, APP_URL:'https://tunetotslab.github.io/FIELD/', ADMIN_TELEGRAM_ID:'5232786567', DB:new AdminTestDB() };
const paymentUpdate = { message:{ from:{ id:77, username:'field_friend', first_name:'Field', last_name:'Friend' }, chat:{id:77}, successful_payment:{ invoice_payload:'invoice-1', currency:'XTR', total_amount:25, telegram_payment_charge_id:'charge-abcdefghijklmnopqrstuvwxyz' } } };
const telegramCalls = [];
globalThis.fetch = async (url, options) => {
  const method = String(url).split('/').at(-1);
  const body = JSON.parse(options.body);
  telegramCalls.push({method,...body});
  if (method === 'getMyStarBalance') return Response.json({ok:true,result:{amount:25}});
  return Response.json({ok:true,result:true});
};
try {
  for (let attempt=0; attempt<2; attempt++) {
    const response = await worker.fetch(new Request('https://example.com/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.WEBHOOK_SECRET},body:JSON.stringify(paymentUpdate)}),adminEnv);
    assert.equal(response.status,200);
  }
  const notifications = telegramCalls.filter(call => call.method === 'sendMessage' && call.chat_id === 5232786567 && call.text.includes('FIELD JUST GOT FED'));
  assert.equal(notifications.length,1);
  assert.equal(adminEnv.DB.rows.filter(row => row.paid_at !== null).length,1);
  assert.equal(adminEnv.DB.rows[0].username,'field_friend');

  telegramCalls.length = 0;
  const adminCommand = {message:{from:{id:5232786567,language_code:'ru'},chat:{id:5232786567},text:'/stats'}};
  await worker.fetch(new Request('https://example.com/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.WEBHOOK_SECRET},body:JSON.stringify(adminCommand)}),adminEnv);
  assert.ok(telegramCalls.some(call => call.text?.includes('⭐ FIELD STATS') && call.text.includes('Telegram balance: 25 ⭐')));

  telegramCalls.length = 0;
  const outsiderCommand = {message:{from:{id:999,language_code:'en'},chat:{id:999},text:'/stats'}};
  await worker.fetch(new Request('https://example.com/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.WEBHOOK_SECRET},body:JSON.stringify(outsiderCommand)}),adminEnv);
  assert.ok(telegramCalls.some(call => call.method === 'sendMessage' && !call.text.includes('FIELD STATS')));

  telegramCalls.length = 0;
  const transactionsCallback = {callback_query:{id:'admin-callback',from:{id:5232786567},data:'admin:transactions',message:{chat:{id:5232786567}}}};
  await worker.fetch(new Request('https://example.com/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.WEBHOOK_SECRET},body:JSON.stringify(transactionsCallback)}),adminEnv);
  assert.ok(telegramCalls.some(call => call.text?.includes('LAST 10 FIELD DONATIONS') && call.text.includes('charge-a…uvwxyz')));
} finally { globalThis.fetch = originalFetch; }
console.log('PASS paid-only admin notification, duplicate webhook protection, private stats and transactions');
