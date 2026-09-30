// Deploy only from this GitHub repository. Secrets are Cloudflare Worker secrets.
const amounts = [5, 10, 25, 50, 75, 100, 1000, 10000, 1000000];
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
export function validAmount(amount) { return Number.isInteger(amount) && amount >= 1 && amount <= 1000000; }
const json = (value, status = 200) => Response.json(value,{status});

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
