import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker, { authenticate, validAmount } from '../server/worker.mjs';
import links from '../shared/links.json' with { type: 'json' };
import { helpText, linksText } from '../server/bot-help.mjs';
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
        if (page === 'about') assert.ok(result.text.includes('60'));
      }
    }
  }
} finally { globalThis.fetch = originalFetch; }
console.log('PASS localized help, links and about via commands and inline buttons; all app links included');
