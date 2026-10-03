import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../server/worker.mjs";
import {
  nativeBotUpdate,
  nativeUser,
  digest,
  purgeExpiredNativeAuth,
} from "../server/native-auth.mjs";
const db = new DatabaseSync(":memory:");
db.exec(readFileSync(new URL("../server/schema.sql", import.meta.url), "utf8"));
const DB = {
  prepare(sql) {
    const bind = (...args) => ({
      first: async () => db.prepare(sql).get(...args) || null,
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      run: async () => ({
        meta: { changes: Number(db.prepare(sql).run(...args).changes) },
      }),
    });
    return { ...bind(), bind };
  },
};
const env = {
  DB,
  NATIVE_AUTH_ENABLED: "true",
  APP_ORIGIN: "https://tunetotslab.github.io",
  BOT_TOKEN: "test-token",
  WEBHOOK_SECRET: "native-secret",
  GROUPS_ENABLED: "true",
  WORLD_ENABLED: "true",
};
const sent = [];
const telegram = async (method, body) => {
  sent.push({ method, body });
  return {};
};
async function request(path, body = {}, options = {}) {
  const headers = {
    Origin: "capacitor://localhost",
    "Content-Type": "application/json",
    "CF-Connecting-IP": "192.0.2.1",
    ...options.headers,
  };
  return worker.fetch(
    new Request(`https://field.test${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
      headers,
    }),
    env,
  );
}
const challenge = async () => {
  const r = await request("/auth/native/challenge");
  assert.equal(r.status, 201);
  return r.json();
};
const first = await challenge();
assert.match(first.id, /^[a-f0-9]{32}$/);
assert.match(first.proof, /^[A-Za-z0-9_-]{43}$/);
assert.match(first.code, /^\d{6}$/);
assert.equal(
  first.url,
  `https://t.me/field_sound_bot?start=field_ios_${first.id}`,
);
assert(!first.url.includes(first.proof));
assert.equal(
  (
    await request("/auth/native/status", {
      id: first.id,
      proof: "a".repeat(43),
    })
  ).status,
  410,
);
assert.equal((await request("/auth/native/exchange", first)).status, 409);
const makeUpdate = (id, user, action = "approve", chat = "private") => ({
  callback_query: {
    id: "q",
    data: `ios:${action}:${id}`,
    from: { id: user, first_name: `User ${user}` },
    message: { chat: { id: user, type: chat } },
  },
});
await nativeBotUpdate(
  makeUpdate(first.id, 999, "approve", "group"),
  env,
  telegram,
);
assert.equal(
  db.prepare("SELECT user_id FROM native_challenges WHERE id=?").get(first.id)
    .user_id,
  null,
);
await nativeBotUpdate(
  {
    message: {
      text: `/start field_ios_${first.id}`,
      from: { id: 7 },
      chat: { id: 7, type: "private" },
    },
  },
  env,
  telegram,
);
assert(sent.at(-1).body.text.includes(first.code));
assert(!JSON.stringify(sent).includes(first.proof));
await nativeBotUpdate(makeUpdate(first.id, 7), env, telegram);
await nativeBotUpdate(makeUpdate(first.id, 8), env, telegram);
assert.equal(
  db.prepare("SELECT user_id FROM native_challenges WHERE id=?").get(first.id)
    .user_id,
  7,
  "Forwarded public link cannot replace approved identity",
);
const status = await (await request("/auth/native/status", first)).json();
assert.deepEqual(status, {
  state: "approved",
  userId: 7,
  displayName: "User 7",
});
assert.equal(status.token, undefined);
const exchanges = await Promise.all([
  request("/auth/native/exchange", first),
  request("/auth/native/exchange", first),
]);
assert.deepEqual(exchanges.map((r) => r.status).sort(), [200, 410]);
const session = await exchanges.find((r) => r.status === 200).json();
assert.match(session.token, /^field_[A-Za-z0-9_-]{43}$/);
assert.equal(session.userId, 7);
assert(
  !JSON.stringify(db.prepare("SELECT * FROM native_sessions").get()).includes(
    session.token,
  ),
);
const bearer = new Request("https://field.test/groups", {
  headers: { Authorization: `Bearer ${session.token}` },
});
assert.equal(await nativeUser(bearer, env), 7);
db.prepare(
  "INSERT INTO field_groups(id,name,join_code,owner_user_id,created_at,updated_at) VALUES ('g','Existing course','CODE123',7,?,?)",
).run(Date.now(), Date.now());
db.prepare(
  "INSERT INTO field_group_members(group_id,user_id,role,joined_at) VALUES ('g',7,'owner',?)",
).run(Date.now());
const groupRequest = new Request("https://field.test/groups", {
  headers: {
    Origin: "capacitor://localhost",
    Authorization: `Bearer ${session.token}`,
  },
});
const groups = await worker.fetch(groupRequest, env);
assert.equal(groups.status, 200);
assert.equal((await groups.json())[0].name, "Existing course");
assert.equal(
  groups.headers.get("Access-Control-Allow-Origin"),
  "capacitor://localhost",
);
assert.equal(groups.headers.get("Cache-Control"), "no-store");
assert.equal(
  (
    await request(
      "/donations",
      { amount: 5 },
      { headers: { Authorization: `Bearer ${session.token}` } },
    )
  ).status,
  403,
);
assert.equal(
  (
    await request(
      "/auth/native/logout",
      {},
      { headers: { Authorization: `Bearer ${session.token}` } },
    )
  ).status,
  200,
);
await assert.rejects(() => nativeUser(bearer, env));
assert.equal((await worker.fetch(groupRequest, env)).status, 401);
const cancelled = await challenge();
await nativeBotUpdate(makeUpdate(cancelled.id, 7, "deny"), env, telegram);
assert.equal((await request("/auth/native/status", cancelled)).status, 410);
const expired = await challenge();
db.prepare("UPDATE native_challenges SET expires_at=? WHERE id=?").run(
  Date.now() - 1,
  expired.id,
);
assert.equal((await request("/auth/native/status", expired)).status, 410);
assert.equal(
  (
    await request(
      "/auth/native/challenge",
      {},
      { headers: { Origin: "https://evil.test" } },
    )
  ).status,
  403,
);
assert.equal(
  (await request("/auth/native/challenge", { padding: "x".repeat(2500) }))
    .status,
  400,
);
assert.equal(
  (
    await worker.fetch(
      new Request("https://field.test/telegram/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeUpdate(first.id, 22)),
      }),
      env,
    )
  ).status,
  403,
);
const forgery = await challenge();
const update = makeUpdate(forgery.id, 44);
update.callback_query.message.chat.id = 55;
await nativeBotUpdate(update, env, telegram);
assert.equal(
  db.prepare("SELECT user_id FROM native_challenges WHERE id=?").get(forgery.id)
    .user_id,
  null,
);
const disabled = { ...env, NATIVE_AUTH_ENABLED: "false" };
assert.equal((await worker.fetch(groupRequest, disabled)).status, 403);
await assert.rejects(() => nativeUser(bearer, disabled));
assert.equal((await digest(session.token)).length, 64);
const count = db.prepare("SELECT COUNT(*) n FROM native_challenges").get().n;
for (let i = count; i < 10; i++) await challenge();
assert.equal((await request("/auth/native/challenge")).status, 429);
assert.equal(
  db.prepare("SELECT COUNT(*) n FROM field_group_members").get().n,
  1,
);

// Scheduled cleanup removes only old auth receipts, never user content/ACL/payments.
db.prepare(
  "INSERT INTO sounds(id,user_id,metadata,created_at) VALUES ('keep-audio',7,'{}',?)",
).run(Date.now());
db.prepare(
  "INSERT INTO donations(id,user_id,amount,created_at) VALUES ('keep-payment',7,5,?)",
).run(Date.now());
db.prepare(
  "INSERT INTO native_sessions(token_hash,user_id,created_at,expires_at) VALUES ('stale-session',7,1,1)",
).run();
db.prepare("UPDATE native_challenges SET expires_at=1 WHERE id=?").run(
  expired.id,
);
await purgeExpiredNativeAuth(env);
assert.equal(
  db
    .prepare(
      "SELECT COUNT(*) n FROM native_sessions WHERE token_hash='stale-session'",
    )
    .get().n,
  0,
);
assert.equal(
  db
    .prepare("SELECT COUNT(*) n FROM native_challenges WHERE id=?")
    .get(expired.id).n,
  0,
);
assert.equal(
  db.prepare("SELECT COUNT(*) n FROM native_sessions").get().n,
  1,
  "Recently revoked session receipt retains its grace period",
);
for (const table of [
  "sounds",
  "donations",
  "field_groups",
  "field_group_members",
])
  assert.equal(
    db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,
    1,
    `${table} must survive auth cleanup`,
  );
console.log(
  "PASS actual SQLite native login: private approval, identity lock, proof secrecy, atomic one-use exchange, hashed/expiring/revocable sessions, same group ACL, CORS, expiry/cancel, webhook/body/rate protection, Telegram donations isolation and auth cleanup preserves user audio/ACL/payments",
);

// Browser-only deployment shares Telegram identity/ACL and global World data.
env.NATIVE_AUTH_ENABLED = "false";
env.STANDALONE_AUTH_ENABLED = "true";
const browserRequest = (path, body = {}, options = {}) =>
  request(path, body, {
    ...options,
    headers: {
      Origin: env.APP_ORIGIN,
      "CF-Connecting-IP": "192.0.2.2",
      ...options.headers,
    },
  });
assert.equal((await browserRequest("/auth/native/challenge")).status, 503);
assert.equal((await request("/auth/browser/challenge")).status, 403);
const webResponse = await browserRequest("/auth/browser/challenge");
assert.equal(webResponse.status, 201);
const web = await webResponse.json();
assert.equal(web.url, `https://t.me/field_sound_bot?start=field_web_${web.id}`);
assert(!web.url.includes(web.proof));
await nativeBotUpdate(
  {
    message: {
      text: `/start field_web_${web.id}`,
      from: { id: 7 },
      chat: { id: 7, type: "private" },
    },
  },
  env,
  telegram,
);
assert(sent.at(-1).body.text.includes(web.code));
assert.equal((await browserRequest("/auth/browser/exchange", web)).status, 409);
await nativeBotUpdate(makeUpdate(web.id, 7), env, telegram);
const webSession = await (
  await browserRequest("/auth/browser/exchange", web)
).json();
assert.equal(webSession.userId, 7);
const headers = {
  Origin: env.APP_ORIGIN,
  Authorization: `Bearer ${webSession.token}`,
};
const webGroups = await worker.fetch(
  new Request("https://field.test/groups", { headers }),
  env,
);
assert.equal(webGroups.status, 200);
assert.equal((await webGroups.json())[0].id, "g");
const location = {
  placeId: "osm:relation:1",
  city: "Yerevan",
  country: "Armenia",
  countryCode: "AM",
  lat: 40.177,
  lng: 44.503,
};
db.prepare("INSERT INTO world_cities(id,location) VALUES (?,?)").run(
  location.placeId,
  JSON.stringify(location),
);
db.prepare(
  "UPDATE sounds SET published=1,city_key=?,metadata=? WHERE id=?",
).run(
  location.placeId,
  JSON.stringify({ title: "Existing Telegram sound", location }),
  "keep-audio",
);
const webCities = await worker.fetch(
  new Request("https://field.test/world/cities", { headers }),
  env,
);
assert.equal(webCities.status, 200);
assert.equal((await webCities.json())[0].id, location.placeId);
assert.equal(webCities.headers.get("Cache-Control"), "no-store");
assert.equal(
  (await browserRequest("/donations", { amount: 5 }, { headers })).status,
  403,
);
assert.equal((await browserRequest("/auth/browser/status", web)).status, 410);
assert.equal(
  (await browserRequest("/auth/browser/logout", {}, { headers })).status,
  200,
);
assert.equal(
  (
    await worker.fetch(
      new Request("https://field.test/groups", { headers }),
      env,
    )
  ).status,
  401,
);
console.log(
  "PASS browser-only login, private bot approval, existing Telegram Group/World identity, no auth cache, disabled native origin, replay/logout and Stars isolation",
);
