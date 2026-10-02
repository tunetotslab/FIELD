import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import worker from "../server/worker.mjs";
import { wavDuration } from "../server/world.mjs";
import {deliverWorld} from '../server/world-delivery.mjs';
import {deliverReportOutcomes} from '../server/moderation.mjs';
const database = new DatabaseSync(":memory:");
const migrationDb = new DatabaseSync(':memory:');
migrationDb.exec("CREATE TABLE sounds(id TEXT PRIMARY KEY,user_id INTEGER,metadata TEXT,published INTEGER DEFAULT 0,created_at INTEGER,group_id TEXT,telegram_delivery_state TEXT)");
migrationDb.prepare('INSERT INTO sounds(id,user_id,metadata,published,created_at) VALUES (?,?,?,1,?)').run('legacy',1,JSON.stringify({location:{placeId:'osm:legacy',city:'Legacy city',country:'Country',countryCode:'AM',lat:40,lng:44}}),1);
migrationDb.exec(readFileSync(new URL('../server/migrations/0003_world.sql',import.meta.url),'utf8'));
assert.equal(migrationDb.prepare('SELECT city_key FROM sounds').get().city_key,'osm:legacy');
assert.equal(migrationDb.prepare('SELECT COUNT(*) n FROM world_cities').get().n,1);
migrationDb.exec(readFileSync(new URL('../server/migrations/0004_report_outcomes.sql',import.meta.url),'utf8'));
migrationDb.exec(readFileSync(new URL('../server/migrations/0005_world_sharing.sql',import.meta.url),'utf8'));
assert.equal(migrationDb.prepare('SELECT COUNT(*) n FROM sounds').get().n,1);
migrationDb.close();
database.exec(
  readFileSync(new URL("../server/schema.sql", import.meta.url), "utf8"),
);
const DB = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          first: async () => database.prepare(sql).get(...args) || null,
          all: async () => ({ results: database.prepare(sql).all(...args) }),
          run: async () => ({
            meta: {
              changes: Number(database.prepare(sql).run(...args).changes),
            },
          }),
        };
      },
      first: async () => database.prepare(sql).get() || null,
      all: async () => ({ results: database.prepare(sql).all() }),
    };
  },
  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.run()));
  },
};
const stored = new Map();
const AUDIO = {
  async head(id) {return stored.has(id) ? {size:stored.get(id).byteLength} : null;},
  async put(id, stream) {
    stored.set(id, await new Response(stream).arrayBuffer());
  },
  async get(id) {
    const bytes = stored.get(id);
    return bytes ? { body: bytes, arrayBuffer: async () => bytes } : null;
  },
  async delete(id) {
    stored.delete(id);
  },
};
const env = {
  DB,
  AUDIO,
  WORLD_ENABLED: "true",
  GROUPS_ENABLED: "true",
  APP_ORIGIN: "https://tunetotslab.github.io",
  BOT_TOKEN: "test-world-token",
  ADMIN_TELEGRAM_ID: "9",
  WEBHOOK_SECRET: "test-world-webhook",
  SUPPORT_EMAIL: "test@example.invalid",
  CITY_DIRECTORY_URL: "https://catalogue.test/geo/v1/",
};
database.prepare('INSERT INTO world_cities(id,location) VALUES (?,?)').run('osm:relation:1',JSON.stringify({placeId:'osm:relation:1',city:'Yerevan',country:'Armenia',countryCode:'AM',lat:40.177,lng:44.503}));
function auth(user) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: user }),
  });
  const data = [...params]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  params.set(
    "hash",
    createHmac(
      "sha256",
      createHmac("sha256", "WebAppData").update(env.BOT_TOKEN).digest(),
    )
      .update(data)
      .digest("hex"),
  );
  return `tma ${params}`;
}
async function request(
  path,
  user = 1,
  { method = "GET", body, ...options } = {},
) {
  const headers = { Origin: env.APP_ORIGIN, Authorization: auth(user) };
  if (body instanceof FormData) {
    const temp = new Request("https://field.test", { method: "POST", body });
    const bytes = await temp.arrayBuffer();
    headers["Content-Type"] = temp.headers.get("Content-Type");
    headers["Content-Length"] = String(bytes.byteLength);
    body = bytes;
  } else if (body) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(body.length);
  }
  return worker.fetch(
    new Request(`https://field.test${path}`, {
      method,
      headers,
      body,
      ...options,
    }),
    env,
  );
}
function wav(seconds = 1) {
  const bytes = new ArrayBuffer(44 + Math.round(seconds * 8000) * 2),
    v = new DataView(bytes),
    u = new Uint8Array(bytes);
  const text = (offset, string) =>
    u.set(new TextEncoder().encode(string), offset);
  text(0, "RIFF");
  v.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, bytes.byteLength - 44, true);
  return bytes;
}
const metadata = {
  id: "client-one",
  title: "Rain",
  emojis: ["🌧️", "🌧️", "🌧️"],
  duration: 1,
  styleId: "bubble",
  effect: "echo",
  waveform: [0.2, 0.5],
  location: {
    placeId: "osm:relation:1",
    city: "Yerevan",
    countryCode: "AM",
    lat: 0,
    lng: 0,
  },
  user_id: 999,
  phone: "private",
  originalBlob: "never-public",
};
function form(data = metadata, audio = wav()) {
  const f = new FormData();
  f.set("metadata", JSON.stringify(data));
  f.set("audio", new Blob([audio], { type: "audio/wav" }), "test.wav");
  return f;
}
const originalFetch = globalThis.fetch;
const telegramMessages=[];
let rejectTelegram=false,unknownTelegram=false;
let geocoderCalls = 0,
  notifications = 0;
globalThis.fetch = async (url, options) => {
  if (String(url).includes('catalogue.test')) {
    geocoderCalls++;
    return Response.json([
      [1,'Yerevan','Yerevan',['yerevan','ереван','երևան'],40.177,44.503,1000000,'Yerevan',{en:'Yerevan',ru:'Ереван',hy:'Երևան'}],
      [2,'Yerevan District','Yerevan District',['yerevan district'],41,45,100,'Other',{en:'Yerevan District',ru:'Ереванский район'}]
    ]);
  }
  if (String(url).includes("api.telegram.org")) {
    if(unknownTelegram)throw Error('Simulated ambiguous network timeout');
    if(rejectTelegram)return Response.json({ok:false,description:'Forbidden: bot not in chat'});
    notifications++;
    telegramMessages.push({url:String(url),body:options.body instanceof FormData?Object.fromEntries(options.body):JSON.parse(options.body)});
    return Response.json({ ok: true, result: {message_id:77} });
  }
  throw Error(`Unexpected fetch ${url}`);
};
try {
  assert.equal(wavDuration(wav(60)), 60);
  assert.throws(() => wavDuration(wav(60.1)));
  assert.throws(() => wavDuration(new ArrayBuffer(44)));
  const malformed = wav();
  new DataView(malformed).setUint32(40, 999999, true);
  assert.throws(() => wavDuration(malformed));
  const city = await request("/cities?q=Yerevan&country=AM");
  assert.equal(city.status, 200);
  const [canonical] = await city.json();
  assert.equal(canonical.placeId, "osm:relation:1");
  assert.equal((await request("/cities?q=Yerevan&country=AM")).status, 200);
  assert.equal(geocoderCalls, 1);
  const resolved=await request('/cities/resolve',1,{method:'POST',body:JSON.stringify({...metadata.location,placeId:'osm:old',lat:0,lng:0})});
  assert.equal(resolved.status,200);
  assert.equal((await resolved.json()).placeId,canonical.placeId);
  const translatedLegacy=await request('/cities/resolve',2,{method:'POST',body:JSON.stringify({...metadata.location,placeId:'osm:older',language:'ru'})});
  assert.equal(translatedLegacy.status,200);
  assert.equal((await translatedLegacy.json()).placeId,canonical.placeId,'English legacy name resolves while UI/results are Russian and multiple prefixes match');
  assert.equal((await request("/cities?q=Dilijan&country=AM",2)).status, 200);
  assert.equal(geocoderCalls, 1);
  const response = await request("/world", 1, { method: "POST", body: form() });
  assert.equal(response.status, 201);
  const published = await response.json(),
    id = published.id;
  assert.equal(stored.size, 1);
  const retainedAudio=stored.get(id);
  stored.delete(id);
  assert.equal((await request('/world',1,{method:'POST',body:form()})).status,503,'Existing D1 row without R2 audio must never report success');
  assert.equal(database.prepare('SELECT COUNT(*) n FROM sounds').get().n,1,'Missing audio check preserves metadata');
  stored.set(id,retainedAudio);
  assert.deepEqual(await (await request(`/world/${id}/likes`,2,{method:'POST'})).json(),{likes:1,liked:1});
  assert.equal((await (await request(`/world/${id}/likes`,2,{method:'POST'})).json()).likes,1);
  assert.equal((await (await request(`/world/${id}/likes`,1,{method:'POST'})).json()).likes,2);
  assert.equal((await (await request(`/world/${id}/likes`,2,{method:'DELETE'})).json()).likes,1);
  assert.equal((await (await request(`/world/${id}/likes`,2,{method:'DELETE'})).json()).likes,1);
  const ticket=await (await request(`/world/${id}/download`,2,{method:'POST'})).json();
  const download=await worker.fetch(new Request(ticket.url),env);
  assert.equal(download.status,200);
  assert.ok(download.headers.get('Content-Disposition').startsWith('attachment;'));
  assert.equal((await download.arrayBuffer()).byteLength,wav().byteLength);
  const tampered=new URL(ticket.url);tampered.searchParams.set('signature','0'.repeat(64));
  assert.equal((await worker.fetch(new Request(tampered),env)).status,403);
  tampered.searchParams.set('expires',String(Date.now()-1));
  assert.equal((await worker.fetch(new Request(tampered),env)).status,403);
  await deliverWorld({...env,WORLD_TELEGRAM_CHAT:'@Fieldapp',APP_URL:'https://field.test'});
  const delivered=telegramMessages.filter(m=>m.body.chat_id==='@Fieldapp');
  assert.equal(delivered.length,1);
  assert.ok(delivered[0].body.document instanceof File);
  await deliverWorld({...env,WORLD_TELEGRAM_CHAT:'@Fieldapp'});
  assert.equal(telegramMessages.filter(m=>m.body.chat_id==='@Fieldapp').length,1);
  assert.equal(published.location.lat, 40.177);
  assert.equal(published.location.lng, 44.503);
  assert.equal(published.effect, "echo");
  assert.equal(published.styleId, "bubble");
  assert.deepEqual(published.waveform, [0.2, 0.5]);
  for (const secret of [
    "user_id",
    "phone",
    "originalBlob",
    "audioBlob",
    "favorite",
    "groupId",
  ])
    assert.ok(!(secret in published));
  assert.equal(
    (await request("/world", 1, { method: "POST", body: form() })).status,
    200,
  );
  assert.equal(stored.size, 1);
  assert.equal(
    (
      await request("/world", 2, {
        method: "POST",
        body: form({ ...metadata, id: "too-long", duration: 1 }, wav(61)),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/world", 2, {
        method: "POST",
        body: form({
          ...metadata,
          id: "wrong-city",
          location: { ...metadata.location, placeId: "arbitrary" },
        }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/world", 2, {
        method: "POST",
        body: form({ ...metadata, id: "bad-duration", duration: 2 }),
      })
    ).status,
    400,
  );
  assert.equal((await request(`/audio/${id}`, 2)).status, 200);
  assert.equal(
    (await request(`/world/${id}`, 2, { method: "DELETE" })).status,
    404,
  );
  assert.equal(
    (await request("/world?city=osm%3Arelation%3A1&cursor=bad")).status,
    400,
  );
  // Stable keyset pagination: equal timestamps, no overlap, city count independent of page.
  for (let i = 0; i < 45; i++)
    database
      .prepare(
        "INSERT INTO sounds (id,user_id,metadata,published,created_at,city_key) VALUES (?,?,?,1,?,?)",
      )
      .run(
        `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        3,
        JSON.stringify({ ...published, title: `Fixture ${i}` }),
        1000,
        canonical.placeId,
      );
  const cities = await (await request("/world/cities", 2)).json();
  assert.equal(cities[0].count, 46);
  assert.deepEqual(await (await request('/world/cities',1)).json(),cities,'All users get the same cities and complete counts');
  assert.deepEqual(await (await request('/world/cities',3)).json(),cities,'Repeated loads do not lose older cities');
  let cursor = null;
  const ids = [];
  do {
    const page = await (
      await request(
        `/world?city=${encodeURIComponent(canonical.placeId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        2,
      )
    ).json();
    assert.ok(page.items.length <= 20);
    ids.push(...page.items.map((s) => s.id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(ids.length, 46);
  assert.equal(new Set(ids).size, 46);
  const reports = () =>
    request(`/world/${id}/reports`, 2, {
      method: "POST",
      body: JSON.stringify({ reason: "privacy" }),
    });
  assert.equal((await reports()).status, 201);
  const sent = notifications;
  assert.equal((await reports()).status, 201);
  assert.equal(notifications, sent);
  assert.equal(
    database.prepare("SELECT COUNT(*) n FROM sound_reports").get().n,
    1,
  );
  async function moderation(user, action) {
    return worker.fetch(
      new Request("https://field.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": env.WEBHOOK_SECRET },
        body: JSON.stringify({
          callback_query: {
            id: "test",
            from: { id: user },
            data: `mod:${action}:${id}`,
            message: { chat: { id: user, type: "private" } },
          },
        }),
      }),
      env,
    );
  }
  await moderation(2, "hide");
  assert.equal((await request(`/audio/${id}`, 2)).status, 200);
  await moderation(9, "hide");
  assert.equal((await worker.fetch(new Request(ticket.url),env)).status,404);
  assert.equal((await request(`/world/${id}/likes`,2,{method:'POST'})).status,404);
  assert.equal(telegramMessages.filter(m=>m.body.chat_id===2).length,1);
  assert.ok(telegramMessages.find(m=>m.body.chat_id===2).body.text.includes('hidden'));
  assert.ok(database.prepare('SELECT resolution_notified_at FROM sound_reports').get().resolution_notified_at);
  assert.equal((await request(`/audio/${id}`, 2)).status, 404);
  assert.equal((await (await request("/world/cities", 2)).json())[0].count, 45);
  await moderation(9, "delete");
  assert.equal(telegramMessages.filter(m=>m.body.chat_id===2).length,1);
  assert.ok(!stored.has(id));
  assert.equal(
    (await request("/world", 1, { method: "POST", body: form() })).status,
    409,
  );
  const second = await (
    await request("/world", 1, {
      method: "POST",
      body: form({ ...metadata, id: "client-two" }),
    })
  ).json();
  assert.equal(
    (await request(`/world/${second.id}`, 1, { method: "DELETE" })).status,
    200,
  );
  assert.equal((await request(`/audio/${second.id}`, 2)).status, 404);
  assert.ok(!stored.has(second.id));
  // World delete can never remove a closed-course record.
  database
    .prepare(
      "INSERT INTO sounds(id,user_id,metadata,group_id,created_at) VALUES (?,?,?,?,?)",
    )
    .run("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", 1, "{}", "group-one", 1);
  assert.equal(
    (
      await request("/world/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", 1, {
        method: "DELETE",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request("https://field.test/world/cities", {
          headers: { Origin: env.APP_ORIGIN },
        }),
        env,
      )
    ).status,
    401,
  );
  console.log(
    "PASS World real SQLite/R2 adapter: signed auth, PCM duration, city privacy/cache/no cross-user throttle, idempotency, identical global counts, 46-row pagination, second-user playback, owner removal, reports, moderator ACL, hidden audio, course isolation",
  );
  const groupId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  database
    .prepare(
      "INSERT INTO field_groups (id,name,owner_user_id,join_code,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    )
    .run(groupId, "Test course", 1, "TESTCODE1", 1, 1);
  database
    .prepare(
      "INSERT INTO field_group_members (group_id,user_id,role,joined_at) VALUES (?,?,?,?)",
    )
    .run(groupId, 1, "owner", 1);
  database
    .prepare(
      "INSERT INTO field_group_members (group_id,user_id,role,joined_at) VALUES (?,?,?,?)",
    )
    .run(groupId, 2, "member", 1);
  assert.equal((await request(`/groups/${groupId}/sounds`, 4)).status, 404);
  const group = await (
    await request(`/groups/${groupId}/sounds`, 1, {
      method: "POST",
      body: form({ ...metadata, id: "course-test" }),
    })
  ).json();
  assert.equal(group.telegramDeliveryState, "unconnected");
  assert.ok(stored.has(group.id));
  assert.equal((await request(`/audio/${group.id}`, 2)).status, 200);
  assert.equal((await request(`/audio/${group.id}`, 4)).status, 404);
  const duplicate = await (
    await request(`/groups/${groupId}/sounds`, 1, {
      method: "POST",
      body: form({ ...metadata, id: "course-test" }),
    })
  ).json();
  assert.equal(duplicate.id, group.id);
  database
    .prepare(
      "INSERT INTO telegram_group_bindings(group_id,chat_id,connected_by,connected_at) VALUES (?,?,?,?)",
    )
    .run(groupId, -100, 1, 1);
  assert.equal(
    (
      await request(`/groups/${groupId}/sounds/${group.id}/retry`, 2, {
        method: "POST",
      })
    ).status,
    404,
  );
  const retried = await (
    await request(`/groups/${groupId}/sounds/${group.id}/retry`, 1, {
      method: "POST",
    })
  ).json();
  assert.equal(retried.telegramDeliveryState, "delivered");
  const alreadySent = notifications;
  await request(`/groups/${groupId}/sounds/${group.id}/retry`, 1, {
    method: "POST",
  });
  assert.equal(notifications, alreadySent);
  assert.equal((await request(`/world/${group.id}/download`,2,{method:'POST'})).status,404);
  assert.equal((await request(`/world/${group.id}/likes`,2,{method:'POST'})).status,404);
  // Only public files enter the durable mirror, never course documents.
  await deliverWorld({...env,WORLD_TELEGRAM_CHAT:'@Fieldapp'});
  assert.equal(database.prepare('SELECT COUNT(*) n FROM world_telegram_deliveries d JOIN sounds s ON s.id=d.sound_id WHERE s.group_id IS NOT NULL').get().n,0);
  // Definite rejection retries; unknown send outcome must not auto-resend.
  const mirrorId=database.prepare("SELECT id FROM sounds WHERE group_id IS NULL AND published=1 AND moderation_state='visible' LIMIT 1").get().id;
  stored.set(mirrorId,wav());
  database.prepare("UPDATE world_telegram_deliveries SET state='queued',updated_at=0 WHERE sound_id=?").run(mirrorId);
  rejectTelegram=true;await deliverWorld({...env,WORLD_TELEGRAM_CHAT:'@Fieldapp'});
  assert.equal(database.prepare('SELECT state FROM world_telegram_deliveries WHERE sound_id=?').get(mirrorId).state,'failed');
  rejectTelegram=false;
  // Recovery processes bounded batches fairly; 45 older fixture rows may precede this retry.
  for(let attempt=0;attempt<7 && database.prepare('SELECT state FROM world_telegram_deliveries WHERE sound_id=?').get(mirrorId).state!=='delivered';attempt++)await deliverWorld({...env,WORLD_TELEGRAM_CHAT:'@Fieldapp'});
  assert.equal(database.prepare('SELECT state FROM world_telegram_deliveries WHERE sound_id=?').get(mirrorId).state,'delivered');
  database.prepare("UPDATE world_telegram_deliveries SET state='queued',updated_at=0 WHERE sound_id=?").run(mirrorId);
  unknownTelegram=true;await deliverWorld({...env,WORLD_TELEGRAM_CHAT:'@Fieldapp'});unknownTelegram=false;
  assert.equal(database.prepare('SELECT state FROM world_telegram_deliveries WHERE sound_id=?').get(mirrorId).state,'uncertain');
  const before=telegramMessages.filter(m=>m.body.chat_id==='@Fieldapp').length;
  await deliverWorld({...env,WORLD_TELEGRAM_CHAT:'@Fieldapp'});
  assert.equal(telegramMessages.filter(m=>m.body.chat_id==='@Fieldapp').length,before);
  async function syncCommand(user,chat={id:user,type:'private'}) {
    return worker.fetch(new Request('https://field.test/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.WEBHOOK_SECRET},body:JSON.stringify({message:{from:{id:user},chat,text:'/worldsync'}})}),{...env,WORLD_TELEGRAM_CHAT:'@Fieldapp'});
  }
  const beforeCommand=telegramMessages.length;
  await syncCommand(4);await syncCommand(9,{id:-100,type:'supergroup'});
  assert.equal(telegramMessages.length,beforeCommand);
  await syncCommand(9);
  assert.ok(telegramMessages.slice(beforeCommand).some(m=>m.body.chat_id===9 && m.body.text?.startsWith('FIELD World → @Fieldapp')));
  database.prepare("INSERT INTO sound_reports(id,sound_id,reporter_id,reason,created_at,resolved_at,resolution,reporter_language) VALUES ('outcome-test',?,4,'other',1,2,'keep','ru')").run(mirrorId);
  await deliverReportOutcomes(env,async()=>{throw Error('Bot blocked');});
  assert.equal(database.prepare("SELECT resolution_notified_at FROM sound_reports WHERE id='outcome-test'").get().resolution_notified_at,null);
  await deliverReportOutcomes(env,async(method,body)=>{assert.equal(body.chat_id,4);assert.ok(body.text.includes('не обнаружил нарушений'));});
  assert.ok(database.prepare("SELECT resolution_notified_at FROM sound_reports WHERE id='outcome-test'").get().resolution_notified_at);
  console.log('PASS legacy city repair, expiring scoped WAV download, shared idempotent likes, private report outcomes/retry, public-only Telegram mirror/deduplication/rejected versus uncertain delivery');
  console.log(
    "PASS course regression: member-only audio, outsider rejected, idempotent upload, owner-only Telegram retry, delivered document never resent",
  );
} finally {
  globalThis.fetch = originalFetch;
  database.close();
}
