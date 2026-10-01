// Deploy only from this GitHub repository. Secrets are Cloudflare Worker secrets.
import links from '../shared/links.json' with { type: 'json' };
import { helpText, linksText } from './bot-help.mjs';
const amounts = [5, 10, 25, 50, 75, 100, 1000, 10000, 100000];
const locales = ['en', 'ru', 'hy', 'zh-TW'];
export const BOT_COMMANDS = {
  en: [['start', 'Open FIELD'], ['open', 'Open FIELD'], ['daily', 'Daily Sound'], ['donate', 'Donate'], ['about', 'About FIELD'], ['help', 'How to FIELD'], ['links', 'Links'], ['language', 'Language'], ['paysupport', 'Payment support']],
  ru: [['start', 'Открыть FIELD'], ['open', 'Открыть FIELD'], ['daily', 'Звук дня'], ['donate', 'Донат'], ['about', 'О FIELD'], ['help', 'Как пользоваться FIELD'], ['links', 'Ссылки'], ['language', 'Язык'], ['paysupport', 'Поддержка платежей']],
  hy: [['start', 'Բացել FIELD'], ['open', 'Բացել FIELD'], ['daily', 'Օրվա ձայնը'], ['donate', 'Նվիրատվություն'], ['about', 'FIELD-ի մասին'], ['help', 'Ինչպես օգտագործել FIELD'], ['links', 'Հղումներ'], ['language', 'Լեզու'], ['paysupport', 'Վճարումների աջակցություն']],
  'zh-TW': [['start', '開啟 FIELD'], ['open', '開啟 FIELD'], ['daily', '每日聲音'], ['donate', '贊助'], ['about', '關於 FIELD'], ['help', 'FIELD 使用方式'], ['links', '連結'], ['language', '語言'], ['paysupport', '付款支援']],
};
const BOT_COPY = {
  en: { greeting: 'Hi, field creature. This is FIELD — a tiny recorder for collecting the world before it disappears.\n\nRecord a tram squeak, a suspicious fridge, rain in a pipe, or your friend’s strange laugh. Keep it or let the sound travel.\n\nPerfect content is not required. Strange sounds are welcome.', open: '🎙 OPEN FIELD', daily: '🎲 DAILY SOUND', donate: '⭐ DONATE', about: '🌱 ABOUT FIELD', help: '❓ HOW TO FIELD', links: '🔗 LINKS', language: '🌐 LANGUAGE', today: "TODAY'S SOUND MISSION", record: '🎙 RECORD IT IN FIELD', another: '🎲 GIVE ME ANOTHER', languageTitle: 'Choose your FIELD language:', paid: '⭐ FIELD invoice ready — choose an amount:', aboutText: 'FIELD is a pocket machine for noticing the world. Record up to 60 seconds, twist the FX, add three emojis, and keep the find in Library or release it to World Map. You do not need to be a musician. Strange sounds are enough.', helpText: 'Hear something → record it → transform it → add three emojis → keep it or share it. Tap OPEN FIELD to enter the Mini App. Your private recordings stay on your device.', linksText: 'Tune Tots Lab and FIELD:', support: 'FIELD payment support' },
  ru: { greeting: 'Привет, полевое существо. Это FIELD — маленький диктофон для коллекционирования мира, пока он не исчез.\n\nЗапиши скрип трамвая, подозрительный холодильник, дождь в трубе или странный смех друга. Оставь себе или отпусти звук путешествовать.\n\nИдеальный контент не нужен. Странные звуки приветствуются.', open: '🎙 ОТКРЫТЬ FIELD', daily: '🎲 ЗВУК ДНЯ', donate: '⭐ ДОНАТ', about: '🌱 О FIELD', help: '❓ КАК ПОЛЬЗОВАТЬСЯ', links: '🔗 ССЫЛКИ', language: '🌐 ЯЗЫК', today: 'ЗВУКОВАЯ МИССИЯ ДНЯ', record: '🎙 ЗАПИСАТЬ В FIELD', another: '🎲 ДРУГОЕ ЗАДАНИЕ', languageTitle: 'Выберите язык FIELD:', paid: '⭐ Счёт FIELD готов — выберите сумму:', aboutText: 'FIELD — карманная машина для замечания мира. Записывай до 60 секунд, крути FX, добавляй три эмодзи и оставляй находку в Library или отпускай на World Map. Музыкантом быть не нужно. Странных звуков достаточно.', helpText: 'Услышал → записал → изменил → добавил три эмодзи → оставил или поделился. Нажми ОТКРЫТЬ FIELD, чтобы войти в Mini App. Приватные записи остаются на твоём устройстве.', linksText: 'Tune Tots Lab и FIELD:', support: 'Поддержка платежей FIELD' },
  hy: { greeting: 'Բարև, դաշտային արարած։ Սա FIELD-ն է՝ փոքրիկ ձայնագրիչ՝ աշխարհը հավաքելու համար, քանի դեռ այն չի անհետացել։\n\nՁայնագրիր տրամվայի ճռռոցը, կասկածելի սառնարանը, խողովակի անձրևը կամ ընկերոջդ տարօրինակ ծիծաղը։ Պահիր կամ թող ձայնը ճանապարհորդի։\n\nԿատարյալ բովանդակություն պետք չէ։ Տարօրինակ ձայները ողջունելի են։', open: '🎙 ԲԱՑԵԼ FIELD', daily: '🎲 ՕՐՎԱ ՁԱՅՆԸ', donate: '⭐ ՆՎԻՐԱՏՎՈՒԹՅՈՒՆ', about: '🌱 FIELD-Ի ՄԱՍԻՆ', help: '❓ ԻՆՉՊԵՍ ՕԳՏԱԳՈՐԾԵԼ', links: '🔗 ՀՂՈՒՄՆԵՐ', language: '🌐 ԼԵԶՈՒ', today: 'ՕՐՎԱ ՁԱՅՆԱՅԻՆ ԱՌԱՔԵԼՈՒԹՅՈՒՆԸ', record: '🎙 ՁԱՅՆԱԳՐԵԼ FIELD-ՈՒՄ', another: '🎲 ՄՅՈՒՍ ԱՌԱՋԱԴՐԱՆՔԸ', languageTitle: 'Ընտրեք FIELD-ի լեզուն՝', paid: '⭐ FIELD-ի հաշիվը պատրաստ է․ ընտրեք գումարը', aboutText: 'FIELD-ը գրպանի մեքենա է աշխարհը նկատելու համար։ Ձայնագրիր մինչև 60 վայրկյան, փոխիր FX-ը, ավելացրու երեք էմոջի և պահիր Library-ում կամ թողարկիր World Map-ում։ Երաժիշտ լինել պետք չէ։', helpText: 'Լսիր → ձայնագրիր → փոխիր → ավելացրու երեք էմոջի → պահիր կամ կիսվիր։ Սեղմիր ԲԱՑԵԼ FIELD՝ Mini App մտնելու համար։', linksText: 'Tune Tots Lab և FIELD՝', support: 'FIELD վճարումների աջակցություն' },
  'zh-TW': { greeting: '嗨，田野生物。這是 FIELD——一台在世界消失以前，收集世界聲音的小錄音機。\n\n錄下電車的吱呀聲、可疑的冰箱、管子裡的雨聲，或朋友奇怪的笑聲。留給自己，或讓聲音開始旅行。\n\n不需要完美內容。奇怪的聲音受到歡迎。', open: '🎙 開啟 FIELD', daily: '🎲 每日聲音', donate: '⭐ 贊助', about: '🌱 關於 FIELD', help: '❓ FIELD 使用方式', links: '🔗 連結', language: '🌐 語言', today: '今日聲音任務', record: '🎙 在 FIELD 錄下它', another: '🎲 換一個任務', languageTitle: '選擇 FIELD 語言：', paid: '⭐ FIELD 發票準備好了，選擇金額：', aboutText: 'FIELD 是一台用來注意世界的口袋機器。錄下最多 60 秒，轉動 FX，加上三個 emoji，把發現留在 Library 或送到 World Map。不需要成為音樂家。奇怪的聲音就夠了。', helpText: '聽見 → 錄下 → 變形 → 加上三個 emoji → 留下或分享。點擊開啟 FIELD 進入 Mini App。', linksText: 'Tune Tots Lab 與 FIELD：', support: 'FIELD 付款支援' },
};
const dailyMissions = ['Find a sound that looks completely silent.', 'Record the farthest sound you can hear.', 'Find a rhythm nobody is intentionally playing.', 'Record water, but not from a tap.', 'Find a machine older than you.', 'Record the least beautiful sound of today.'];
const encoder = new TextEncoder();
async function hmac(key, value) {
  const imported = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(value)));
}
export async function authenticate(raw, token, now = Date.now()) {
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) throw new Error('Unauthorized');
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw new Error('Unauthorized');
  params.delete('hash');
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > 3600 || authDate > now / 1000 + 30) throw new Error('Unauthorized');
  const data = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const expected = await hmac(await hmac('WebAppData', token), data);
  const actual = new Uint8Array(hash.match(/../g).map(x => parseInt(x,16)));
  let diff = 0; for (let i=0;i<32;i++) diff |= expected[i] ^ actual[i];
  if (diff) throw new Error('Unauthorized');
  const user = JSON.parse(params.get('user') || '{}');
  if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Error('Unauthorized');
  return user.id;
}
async function telegram(env, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result = await response.json();
  if (!result.ok) throw new Error('Telegram unavailable');
  return result.result;
}
export function validAmount(amount) { return Number.isInteger(amount) && amount >= 1 && amount <= 100000; }
const json = (value, status = 200) => Response.json(value,{status});

function localeFromCode(code) {
  if (code === 'ru' || code?.startsWith('ru-')) return 'ru';
  if (code === 'hy' || code?.startsWith('hy-')) return 'hy';
  if (code === 'zh-TW' || code?.startsWith('zh')) return 'zh-TW';
  return 'en';
}
function appUrl(env) { return env.APP_URL || `${env.APP_ORIGIN}/FIELD/`; }
function copy(locale) { const lang = locales.includes(locale) ? locale : 'en'; return { ...BOT_COPY[lang], helpText: helpText[lang], linksText: linksText[lang] }; }
function linksKeyboard(locale, env) {
  return { inline_keyboard: [
    [{ text: copy(locale).open, web_app: { url: appUrl(env) } }],
    [{ text: '🌱 Tune Tots Lab · Website', url: links.TUNE_TOTS_WEBSITE }],
    [{ text: '📷 Tune Tots · Instagram', url: links.TUNE_TOTS_INSTAGRAM }, { text: '💬 Tune Tots · Telegram', url: links.TUNE_TOTS_TELEGRAM }],
    [{ text: '🎵 Nikola Chen · Portfolio', url: links.NIKOLA_PORTFOLIO }],
    [{ text: '📷 Nikola · Instagram', url: links.NIKOLA_INSTAGRAM }, { text: '💬 Nikola · Telegram', url: links.NIKOLA_TELEGRAM }],
    [{ text: '↩️', callback_data: 'bot:home' }],
  ] };
}
function homeKeyboard(locale, env) {
  const c = copy(locale);
  return { inline_keyboard: [
    [{ text: c.open, web_app: { url: appUrl(env) } }],
    [{ text: c.daily, callback_data: 'bot:daily' }, { text: c.donate, callback_data: 'bot:donate' }],
    [{ text: c.about, callback_data: 'bot:about' }, { text: c.help, callback_data: 'bot:help' }],
    [{ text: c.links, callback_data: 'bot:links' }, { text: c.language, callback_data: 'bot:language' }],
  ] };
}
function backKeyboard(locale, env) { return { inline_keyboard: [[{ text: copy(locale).open, web_app: { url: appUrl(env) } }, { text: '↩️', callback_data: 'bot:home' }]] }; }
function donationKeyboard(locale) {
  return { inline_keyboard: [
    [{ text: '5 ⭐', callback_data: 'bot:amount:5' }, { text: '10 ⭐', callback_data: 'bot:amount:10' }, { text: '25 ⭐', callback_data: 'bot:amount:25' }],
    [{ text: '50 ⭐', callback_data: 'bot:amount:50' }, { text: '75 ⭐', callback_data: 'bot:amount:75' }, { text: '100 ⭐', callback_data: 'bot:amount:100' }],
    [{ text: '1000 ⭐', callback_data: 'bot:amount:1000' }, { text: '10000 ⭐', callback_data: 'bot:amount:10000' }, { text: '100000 ⭐', callback_data: 'bot:amount:100000' }],
    [{ text: '↩️', callback_data: 'bot:home' }],
  ] };
}
async function storedLocale(env, user) {
  try { return (await env.DB.prepare('SELECT language FROM bot_users WHERE user_id = ?').bind(user).first())?.language || null; }
  catch { return null; }
}
async function saveLocale(env, user, locale) {
  try { await env.DB.prepare('INSERT INTO bot_users (user_id,language,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language,updated_at=excluded.updated_at').bind(user, locale, Date.now()).run(); } catch { /* Migration may not be applied yet. */ }
}
async function sendBot(env, chatId, text, replyMarkup) { return telegram(env, 'sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup }); }
async function answerCallback(env, id) { return telegram(env, 'answerCallbackQuery', { callback_query_id: id }); }
async function botInvoice(env, chatId, userId, amount, locale) {
  if (!validAmount(amount)) throw new Error('Invalid amount');
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO donations (id,user_id,amount,created_at) VALUES (?,?,?,?)').bind(id,userId,amount,Date.now()).run();
  return telegram(env, 'sendInvoice', { chat_id: chatId, title: 'Support FIELD', description: copy(locale).aboutText.slice(0, 255), payload: id, currency: 'XTR', prices: [{ label: 'FIELD donation', amount }] });
}
async function handleBotUpdate(update, env) {
  const message = update.message;
  const callback = update.callback_query;
  const user = message?.from || callback?.from;
  const chatId = message?.chat?.id || callback?.message?.chat?.id;
  if (!user || chatId === undefined) return;
  let locale = await storedLocale(env, user.id) || localeFromCode(user.language_code);
  const data = callback?.data || '';
  if (callback) await answerCallback(env, callback.id);
  if (data.startsWith('lang:')) { locale = data.slice(5); if (!locales.includes(locale)) locale = 'en'; await saveLocale(env, user.id, locale); return sendBot(env, chatId, copy(locale).greeting, homeKeyboard(locale, env)); }
  if (data === 'bot:home') return sendBot(env, chatId, copy(locale).greeting, homeKeyboard(locale, env));
  if (data === 'bot:language') return sendBot(env, chatId, copy(locale).languageTitle, { inline_keyboard: [[{text:'English',callback_data:'lang:en'},{text:'Русский',callback_data:'lang:ru'}],[{text:'Հայերեն',callback_data:'lang:hy'},{text:'繁體中文',callback_data:'lang:zh-TW'}],[{text:'↩️',callback_data:'bot:home'}]] });
  if (data === 'bot:donate') return sendBot(env, chatId, copy(locale).paid, donationKeyboard(locale));
  if (data.startsWith('bot:amount:')) { const amount = Number(data.slice(11)); return botInvoice(env, chatId, user.id, amount, locale); }
  if (data === 'bot:daily') { const mission = dailyMissions[Math.floor(Date.now() / 86400000) % dailyMissions.length]; return sendBot(env, chatId, `${copy(locale).today} #${String(Math.floor(Date.now() / 86400000) % 1000).padStart(3, '0')}\n\n${mission}`, { inline_keyboard: [[{text:copy(locale).record,web_app:{url:appUrl(env)}}],[{text:copy(locale).another,callback_data:'bot:daily'},{text:'↩️',callback_data:'bot:home'}]] }); }
  const command = data.startsWith('bot:') ? data.slice(4) : (message?.text || '').split(/\s+/)[0].replace(/^\//, '').replace(/@.*$/, '');
  if (command === 'donate') return sendBot(env, chatId, copy(locale).paid, donationKeyboard(locale));
  if (command === 'daily') { const mission = dailyMissions[Math.floor(Date.now() / 86400000) % dailyMissions.length]; return sendBot(env, chatId, `${copy(locale).today} #${String(Math.floor(Date.now() / 86400000) % 1000).padStart(3, '0')}\n\n${mission}`, { inline_keyboard: [[{text:copy(locale).record,web_app:{url:appUrl(env)}}],[{text:copy(locale).another,callback_data:'bot:daily'},{text:'↩️',callback_data:'bot:home'}]] }); }
  if (command === 'about') return sendBot(env, chatId, copy(locale).aboutText, backKeyboard(locale, env));
  if (command === 'help') return sendBot(env, chatId, copy(locale).helpText, backKeyboard(locale, env));
  if (command === 'links') return sendBot(env, chatId, `${copy(locale).linksText}\n${links.SUPPORT_EMAIL.replace('mailto:', '')}`, linksKeyboard(locale, env));
  if (command === 'language') return sendBot(env, chatId, copy(locale).languageTitle, { inline_keyboard: [[{text:'English',callback_data:'lang:en'},{text:'Русский',callback_data:'lang:ru'}],[{text:'Հայերեն',callback_data:'lang:hy'},{text:'繁體中文',callback_data:'lang:zh-TW'}]] });
  return sendBot(env, chatId, copy(locale).greeting, homeKeyboard(locale, env));
}

async function webhook(request, env) {
  if (!env.WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return json({error:'Forbidden'},403);
  const update = await request.json();
  const q = update.pre_checkout_query;
  if (q) {
    const order = await env.DB.prepare('SELECT * FROM donations WHERE id = ?').bind(q.invoice_payload).first();
    const ok = Boolean(order && order.user_id === q.from.id && order.amount === q.total_amount && q.currency === 'XTR' && !order.charge_id && Date.now() - order.created_at < 3600000);
    await telegram(env,'answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok,...(!ok ? {error_message:'Invoice expired or invalid. Please open a new donation in FIELD.'}: {})});
  }
  const payment = update.message?.successful_payment;
  if (payment) {
    const order = await env.DB.prepare('SELECT * FROM donations WHERE id = ?').bind(payment.invoice_payload).first();
    if (!order || payment.currency !== 'XTR' || payment.total_amount !== order.amount || update.message.from.id !== order.user_id) return json({error:'Invalid receipt'},400);
    await env.DB.prepare('UPDATE donations SET charge_id = ?, paid_at = ? WHERE id = ? AND charge_id IS NULL').bind(payment.telegram_payment_charge_id, Date.now(), order.id).run();
  }
  if (/^\/paysupport(?:@\w+)?(?:\s|$)/.test(update.message?.text || '')) {
    await telegram(env,'sendMessage',{chat_id:update.message.chat.id,text:`FIELD payment support: ${env.SUPPORT_EMAIL}. Include your Telegram payment receipt. Refund requests are reviewed by Tune Tots Lab.`});
  }
  if (update.callback_query || (update.message && !/^\/paysupport(?:@\w+)?(?:\s|$)/.test(update.message.text || ''))) {
    try { await handleBotUpdate(update, env); } catch { /* A bot-menu delivery failure must not break payment acknowledgements. */ }
  }
  return json({ok:true});
}

async function route(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/telegram/webhook' && request.method === 'POST') return webhook(request,env);
  if (url.pathname === '/health') return json({ok:true});
  if (request.headers.get('Origin') !== env.APP_ORIGIN) return json({error:'Forbidden'},403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204});
  let user;
  try { user = await authenticate((request.headers.get('Authorization') || '').replace(/^tma /,''), env.BOT_TOKEN); }
  catch { return json({error:'Unauthorized'},401); }
  if (url.pathname === '/donations' && request.method === 'POST') {
    if (Number(request.headers.get('Content-Length')) > 2048) return json({error:'Too large'},413);
    const {amount} = await request.json();
    if (!validAmount(amount)) return json({error:'Invalid amount'},400);
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM donations WHERE user_id = ? AND created_at > ?').bind(user,Date.now()-60000).first();
    if (recent.n >= 10) return json({error:'Please wait'},429);
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO donations (id,user_id,amount,created_at) VALUES (?,?,?,?)').bind(id,user,amount,Date.now()).run();
    const link = await telegram(env,'createInvoiceLink',{title:'Support FIELD',description:'Voluntary support for FIELD by Tune Tots Lab. No subscription or prize.',payload:id,currency:'XTR',prices:[{label:'Donation',amount}]});
    return json({url:link});
  }
  // All world reads are authenticated; R2 is private, served only through this worker.
  if (url.pathname === '/world' && request.method === 'POST') {
    if (env.WORLD_ENABLED !== 'true') return json({error:'Publishing unavailable'},503);
    if (!Number(request.headers.get('Content-Length')) || Number(request.headers.get('Content-Length')) > 25000000) return json({error:'Maximum upload 25 MB'},413);
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM sounds WHERE user_id = ? AND created_at > ?').bind(user,Date.now()-86400000).first();
    if (recent.n >= 20) return json({error:'Daily upload limit'},429);
    const form = await request.formData();
    const audio = form.get('audio');
    const data = JSON.parse(String(form.get('metadata')));
    if (!(audio instanceof File) || audio.size > 24000000 || audio.size < 44 || typeof data.title !== 'string' || data.title.length > 80 || !Array.isArray(data.emojis) || data.emojis.length !== 3 || data.emojis.some(x => typeof x !== 'string' || x.length > 32) || !Number.isFinite(data.duration) || data.duration <= 0 || data.duration > 60) return json({error:'Invalid sound'},400);
    const header = new TextDecoder().decode(await audio.slice(0,12).arrayBuffer());
    if (!header.startsWith('RIFF') || header.slice(8) !== 'WAVE') return json({error:'WAV required'},400);
    // Resolve a named city on the server: never accept client GPS coordinates.
    const location = data.location;
    if (!location || typeof location.city !== 'string' || location.city.length > 100 || !/^[A-Z]{2}$/.test(location.countryCode)) return json({error:'City required'},400);
    const geocode = new URL('https://nominatim.openstreetmap.org/search');
    geocode.search = new URLSearchParams({city:location.city,countrycodes:location.countryCode.toLowerCase(),format:'jsonv2',addressdetails:'1',limit:'1'}).toString();
    const cityResponse = await fetch(geocode,{headers:{'User-Agent':`FIELD/1.0 (${env.SUPPORT_EMAIL})`}});
    if (!cityResponse.ok) return json({error:'City lookup unavailable'},503);
    const [city] = await cityResponse.json();
    if (!city) return json({error:'City not found'},400);
    const metadata = {title:data.title,emojis:data.emojis,duration:data.duration,createdAt:Date.now(),visibility:'world',favorite:false,effect:'original',effectMix:0,styleId:'grotesk',waveform:[],location:{city:city.address.city || city.address.town || city.address.village || location.city,country:city.address.country,countryCode:location.countryCode,lat:Number(city.lat),lng:Number(city.lon),placeId:`osm:${city.place_id}`}};
    const id = crypto.randomUUID();
    await env.AUDIO.put(id,audio.stream(),{httpMetadata:{contentType:'audio/wav'}});
    try { await env.DB.prepare('INSERT INTO sounds (id,user_id,metadata,published,created_at) VALUES (?,?,?,1,?)').bind(id,user,JSON.stringify(metadata),Date.now()).run(); }
    catch (error) { await env.AUDIO.delete(id); throw error; }
    return json({id,...metadata},201);
  }
  if (url.pathname.startsWith('/world/') && request.method === 'DELETE') {
    const id = url.pathname.slice(7);
    const row = await env.DB.prepare('SELECT id FROM sounds WHERE id = ? AND user_id = ?').bind(id,user).first();
    if (!row) return json({error:'Not found'},404);
    await env.DB.prepare('UPDATE sounds SET published = 0 WHERE id = ?').bind(id).run();
    await env.AUDIO.delete(id);
    return json({ok:true});
  }
  if (url.pathname === '/world' && request.method === 'GET') {
    const {results} = await env.DB.prepare('SELECT id, metadata FROM sounds WHERE published = 1 ORDER BY created_at DESC LIMIT 200').all();
    return json(results.map(row => ({...JSON.parse(row.metadata),id:row.id})));
  }
  if (url.pathname.startsWith('/audio/') && request.method === 'GET') {
    const id = url.pathname.slice(7);
    const row = await env.DB.prepare('SELECT id FROM sounds WHERE id = ? AND (published = 1 OR user_id = ?)').bind(id,user).first();
    if (!row) return json({error:'Not found'},404);
    const object = await env.AUDIO.get(id);
    return object ? new Response(object.body,{headers:{'Content-Type':'audio/wav','Cache-Control':'private, no-store'}}) : json({error:'Not found'},404);
  }
  return json({error:'Not found'},404);
}
export default { async fetch(request,env) {
  let response;
  try { response = await route(request,env); } catch { response = json({error:'Service unavailable'},503); }
  const headers = new Headers(response.headers);
  headers.set('Cache-Control','no-store');
  if (request.headers.get('Origin') === env.APP_ORIGIN) {
    headers.set('Access-Control-Allow-Origin',env.APP_ORIGIN);
    headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');
    headers.set('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
    headers.set('Vary','Origin');
  }
  return new Response(response.body,{status:response.status,headers});
}};
