import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { transformWithOxc } from "vite";
import { indexedDB } from "fake-indexeddb";
import worker from "../server/worker.mjs";
import { digest } from "../server/native-auth.mjs";
const db = new DatabaseSync(":memory:");
db.exec(
  await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
);
db.exec(
  await readFile(
    new URL("../server/migrations/0008_private_library.sql", import.meta.url),
    "utf8",
  ),
);
db.prepare(
  "INSERT INTO sounds(id,user_id,metadata,published,created_at) VALUES (?,?,?,?,?)",
).run("existing-world", 7, "{}", 1, 1);
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
const objects = new Map();
let puts = 0,
  failPut = false,
  delayGet;
const env = {
  DB,
  APP_ORIGIN: "https://tunetotslab.github.io",
  BOT_TOKEN: "test-token",
  STANDALONE_AUTH_ENABLED: "true",
  LIBRARY_SYNC_ENABLED: "true",
  WORLD_ENABLED: "true",
  GROUPS_ENABLED: "true",
  AUDIO: {
    async put(key, bytes) {
      if (failPut) {
        failPut = false;
        throw Error("R2 unavailable");
      }
      puts++;
      objects.set(key, new Uint8Array(bytes));
    },
    async get(key) {
      if (delayGet) await delayGet();
      const bytes = objects.get(key);
      return bytes ? { body: bytes.slice(), size: bytes.length } : null;
    },
  },
};
const tokens = { 7: "field_" + "a".repeat(43), 8: "field_" + "b".repeat(43) };
for (const user of [7, 8])
  db.prepare(
    "INSERT INTO native_sessions(token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)",
  ).run(await digest(tokens[user]), user, Date.now(), Date.now() + 3600000);
async function request(path, options = {}, user = 7) {
  const headers = new Headers(options.headers);
  headers.set("Origin", env.APP_ORIGIN);
  if (user) headers.set("Authorization", `Bearer ${tokens[user]}`);
  return worker.fetch(
    new Request("https://field.test" + path, { ...options, headers }),
    env,
  );
}
assert.equal((await request("/library", {}, 0)).status, 401);
assert.equal(
  (
    await worker.fetch(
      new Request("https://field.test/library", {
        headers: {
          Origin: "https://wrong.test",
          Authorization: `Bearer ${tokens[7]}`,
        },
      }),
      env,
    )
  ).status,
  403,
);
assert.equal((await request("/library", {}, 8)).status, 200);
env.LIBRARY_SYNC_ENABLED = "false";
assert.equal((await request("/library")).status, 503);
env.LIBRARY_SYNC_ENABLED = "true";
const modules = new Map();
async function moduleUrl(path) {
  if (modules.has(path)) return modules.get(path);
  if (path.endsWith("/config.ts"))
    return 'data:text/javascript,export const API_URL="https://field.test"';
  let { code } = await transformWithOxc(
    await readFile(new URL(path, import.meta.url), "utf8"),
    path,
  );
  for (const match of [...code.matchAll(/from ["'](\.[^"']+)["']/g)]) {
    let next = new URL(match[1] + ".ts", new URL(path, import.meta.url));
    if (!existsSync(next))
      next = new URL(match[1] + "/index.ts", new URL(path, import.meta.url));
    code = code.replace(
      match[0],
      `from ${JSON.stringify(await moduleUrl(next.href))}`,
    );
  }
  const url =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  modules.set(path, url);
  return url;
}
const load = async (path) =>
  import(await moduleUrl(new URL(path, import.meta.url).href));
globalThis.indexedDB = indexedDB;
globalThis.window = new EventTarget();
window.Telegram = { WebApp: { initData: "" } };
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});
globalThis.fetch = async (url, options) => {
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const headers = new Headers(options.headers);
  headers.set("Origin", env.APP_ORIGIN);
  const r = await worker.fetch(new Request(url, { ...options, headers }), env);
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return r;
};
const session = await load("../src/auth/session.ts");
const { createSoundRepository } = await load("../src/storage/db.ts");
const { createLibrarySync } = await load("../src/storage/librarySync.ts");
const signIn = async (user) => {
  await session.setSession(
    user
      ? {
          token: tokens[user],
          expiresAt: Date.now() + 3600000,
          userId: user,
          displayName: `Owner ${user}`,
          provider: "telegram",
        }
      : undefined,
  );
};
await signIn(7);
const rawA = createSoundRepository("library-phone-a"),
  rawB = createSoundRepository("library-phone-b");
const a = createLibrarySync(rawA),
  b = createLibrarySync(rawB);
const sound = (id, title = id) => ({
  id,
  title,
  createdAt: 1,
  duration: 90,
  emojis: ["🌲", "🌲", "🌲"],
  visibility: "private",
  styleId: "grotesk",
  favorite: false,
  waveform: [0.2, 0.1],
  audioBlob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" }),
  originalBlob: new Blob([new Uint8Array([9, 8, 7])], { type: "audio/mp4" }),
  effect: "echo",
  effectChain: [
    { effect: "echo", mix: 70, pitchSemitones: 7, echoDelayMs: 340 },
  ],
  editState: { trimStart: 0.2, trimEnd: 80, fadeIn: true },
  dailyChallenge: "daily-one",
  unknownMetadata: { keep: "legacy" },
});
await rawA.save(sound("legacy"));
await a.sync();
assert.equal(
  db.prepare("SELECT COUNT(*) n FROM private_library").get().n,
  0,
  "Never automatically bind old unowned audio",
);
await a.adoptExisting();
await a.sync();
assert.equal(a.status().error, undefined);
await b.sync();
let restored = (await b.getAll())[0];
assert.equal(restored.title, "legacy");
assert.equal(
  restored.duration,
  90,
  "Private backup does not apply public 60-second cap",
);
assert.deepEqual(
  new Uint8Array(await restored.audioBlob.arrayBuffer()),
  new Uint8Array([1, 2, 3, 4]),
);
assert.deepEqual(
  new Uint8Array(await restored.originalBlob.arrayBuffer()),
  new Uint8Array([9, 8, 7]),
);
assert.deepEqual(restored.effectChain, sound("").effectChain);
assert.deepEqual(restored.editState, sound("").editState);
assert.deepEqual(restored.unknownMetadata, { keep: "legacy" });
assert.equal(restored.dailyChallenge, "daily-one");
assert.equal(
  db.prepare("SELECT COUNT(*) n FROM sounds").get().n,
  1,
  "Private sync never creates World/Group rows",
);
const beforeMetadata = puts;
await b.save({ ...restored, title: "Renamed on phone B", favorite: true });
await b.sync();
await a.sync();
assert.equal(
  puts,
  beforeMetadata,
  "Metadata changes do not reupload original/render",
);
assert.equal((await a.getAll())[0].title, "Renamed on phone B");
assert((await a.getAll())[0].favorite);
navigator.onLine = false;
await a.save({ ...(await a.getAll())[0], title: "Offline saved" });
await a.sync();
assert.equal(
  JSON.parse(
    db.prepare("SELECT metadata FROM private_library WHERE user_id=7").get()
      .metadata,
  ).title,
  "Renamed on phone B",
);
navigator.onLine = true;
await a.sync();
await b.sync();
assert.equal((await b.getAll())[0].title, "Offline saved");
await a.save({ ...(await a.getAll())[0], title: "Offline edit A" });
await b.save({ ...(await b.getAll())[0], title: "Concurrent edit B" });
await b.sync();
await a.sync();
await b.sync();
assert.deepEqual((await a.getAll()).map((r) => r.title).sort(), [
  "Concurrent edit B",
  "Offline edit A",
]);
assert.deepEqual((await b.getAll()).map((r) => r.title).sort(), [
  "Concurrent edit B",
  "Offline edit A",
]);
for (const row of await a.getAll())
  assert.deepEqual(
    new Uint8Array(await row.originalBlob.arrayBuffer()),
    new Uint8Array([9, 8, 7]),
  );
await a.save(sound("new-private", "New account recording"));
await a.sync();
await b.sync();
assert((await b.getAll()).some((r) => r.title === "New account recording"));
const row = (await a.getAll()).find((r) => r.title === "New account recording");
const id = row.librarySync.recordId;
assert.equal(
  (
    await request(
      `/library/${id}/render?revision=${row.librarySync.revision}`,
      {},
      8,
    )
  ).status,
  404,
);
assert.equal((await request(`/audio/${id}`, {}, 8)).status, 404);
assert.equal((await request("/library?user=7", {}, 8)).status, 200);
assert.deepEqual((await (await request("/library", {}, 8)).json()).items, []);
assert.equal(
  (await request(`/library/${id}/render?revision=stale`)).status,
  404,
);
const bad = new FormData();
bad.set(
  "manifest",
  JSON.stringify({
    baseRevision: row.librarySync.revision,
    mutationId: crypto.randomUUID(),
    metadata: { ...sound(""), title: "x" },
    renderHash: "a".repeat(64),
  }),
);
bad.set("render", new Blob(["tampered"]));
assert.equal(
  (await request(`/library/${id}`, { method: "POST", body: bad })).status,
  400,
);
assert.equal(
  (
    await request(`/library/${id}`, {
      method: "POST",
      body: new FormData(),
      headers: { "Content-Length": "25000001" },
    })
  ).status,
  413,
);
// Retry after a committed upload whose HTTP acknowledgement was lost.
const realFetch = globalThis.fetch;
let loseResponse = true;
globalThis.fetch = async (url, options) => {
  const result = await realFetch(url, options);
  if (
    loseResponse &&
    options.method === "POST" &&
    String(url).includes("/library/")
  ) {
    loseResponse = false;
    throw TypeError("Connection lost after commit");
  }
  return result;
};
await a.save(sound("lost-response"));
await a.sync();
assert.equal(a.status().error, 0);
const lost = (await a.getAll()).find((r) => r.id === "lost-response");
const committed = db
  .prepare("SELECT * FROM private_library WHERE user_id=7 AND id=?")
  .get(lost.librarySync.recordId);
assert(committed);
globalThis.fetch = realFetch;
const beforeRetry = puts;
await a.sync();
assert.equal(a.status().error, undefined);
assert.equal(
  puts,
  beforeRetry,
  "Lost response is reconciled without duplicate audio",
);
assert.equal(
  (await a.getAll()).find((r) => r.id === "lost-response").librarySync.revision,
  committed.revision,
);
const replay = new FormData();
replay.set(
  "manifest",
  JSON.stringify({ baseRevision: null, mutationId: committed.mutation_id }),
);
assert.equal(
  (await request(`/library/${committed.id}`, { method: "POST", body: replay }))
    .status,
  200,
  "Exact mutation replay is idempotent",
);
const stale = new FormData();
stale.set(
  "manifest",
  JSON.stringify({
    baseRevision: crypto.randomUUID(),
    mutationId: crypto.randomUUID(),
  }),
);
assert.equal(
  (await request(`/library/${committed.id}`, { method: "DELETE", body: stale }))
    .status,
  409,
  "Stale revision cannot delete current audio",
);
const signed = new URLSearchParams({
  auth_date: String(Math.floor(Date.now() / 1000)),
  user: JSON.stringify({ id: 7 }),
  query_id: "library-test",
});
const signedData = [...signed.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `${k}=${v}`)
  .join("\n");
const secret = createHmac("sha256", "WebAppData")
  .update(env.BOT_TOKEN)
  .digest();
signed.set(
  "hash",
  createHmac("sha256", secret).update(signedData).digest("hex"),
);
const tma = await worker.fetch(
  new Request("https://field.test/library", {
    headers: { Origin: env.APP_ORIGIN, Authorization: "tma " + signed },
  }),
  env,
);
assert.equal(tma.status, 200);
assert(
  (await tma.json()).items.some((r) => r.id === committed.id),
  "Signed Telegram and Safari bearer use the same private archive",
);
const beforeObjects = objects.size;
await b.remove(
  (await b.getAll()).find((r) => r.title === "Concurrent edit B").id,
);
await b.sync();
await a.sync();
assert(!(await a.getAll()).some((r) => r.title === "Concurrent edit B"));
assert.equal(objects.size, beforeObjects, "Tombstones never discard R2 source");
assert(
  (await rawB.getAll()).some(
    (r) => r.title === "Concurrent edit B" && r.librarySync.deleted,
  ),
  "Remote deletion retains cached source",
);
await a.save(sound("delete-conflict", "Before concurrent delete"));
await a.sync();
await b.sync();
await a.remove("delete-conflict");
await b.save({
  ...(await b.getAll()).find((r) => r.title === "Before concurrent delete"),
  title: "Keep last concurrent edit",
});
await b.sync();
await a.sync();
await b.sync();
assert((await a.getAll()).some((r) => r.title === "Keep last concurrent edit"));
assert((await b.getAll()).some((r) => r.title === "Keep last concurrent edit"));
assert.equal(
  a.status().error,
  undefined,
  "Concurrent deletion preserves the other edit as a private copy",
);
await a.save({ ...sound("r2-retry"), audioBlob: new Blob(["unique-render"]) });
failPut = true;
await a.sync();
assert.equal(a.status().error, 503);
assert((await a.getAll()).some((r) => r.id === "r2-retry"));
await a.sync();
await b.sync();
assert.equal(a.status().error, undefined);
assert((await b.getAll()).some((r) => r.title === "r2-retry"));
await signIn(8);
a.accountChanged();
assert.deepEqual(await a.getAll(), []);
await assert.rejects(a.save(row), /LIBRARY:403/);
await a.save(sound("owner-eight"));
await a.sync();
assert.equal((await (await request("/library", {}, 8)).json()).items.length, 1);
assert(
  (await rawA.getAll()).some((r) => r.librarySync?.ownerUserId === 7),
  "Account change preserves cached bytes",
);
await signIn(undefined);
a.accountChanged();
assert.deepEqual(await a.getAll(), []);
await signIn(7);
a.accountChanged();
assert(!(await a.getAll()).some((r) => r.title === "owner-eight"));
let unblock, entered;
const enteredPromise = new Promise((resolve) => (entered = resolve));
delayGet = () => {
  entered();
  return new Promise((resolve) => (unblock = resolve));
};
const freshRaw = createSoundRepository("library-account-race"),
  fresh = createLibrarySync(freshRaw);
const pending = fresh.sync();
await enteredPromise;
await signIn(8);
fresh.accountChanged();
unblock();
await pending;
delayGet = undefined;
assert.deepEqual(
  await freshRaw.getAll(),
  [],
  "Late old-account response cannot populate a new account",
);
await signIn(7);
a.accountChanged();
await rawA.save({
  ...sound("known-foreign-legacy"),
  worldPublication: {
    ownerUserId: 8,
    state: "published",
    clientId: crypto.randomUUID(),
  },
});
assert(!(await a.getAll()).some((r) => r.id === "known-foreign-legacy"));
await a.adoptExisting();
assert.equal(
  (await rawA.getAll()).find((r) => r.id === "known-foreign-legacy")
    .librarySync,
  undefined,
  "Never claim a known other-account legacy recording",
);
const quotaHash = "f".repeat(64);
db.prepare("INSERT INTO private_library_blobs VALUES (?,?,?)").run(
  7,
  quotaHash,
  512 * 1024 * 1024,
);
await a.save({ ...sound("quota"), audioBlob: new Blob(["over-quota"]) });
await a.sync();
assert.equal(a.status().error, 507);
assert.equal(
  await (await a.getAll()).find((r) => r.id === "quota").audioBlob.text(),
  "over-quota",
  "Quota failure preserves committed local sound",
);
db.prepare("DELETE FROM private_library_blobs WHERE hash=?").run(quotaHash);
await a.sync();
const savedRow = db
  .prepare(
    "SELECT * FROM private_library WHERE user_id=7 AND deleted=0 LIMIT 1",
  )
  .get();
for (let i = 0; i < 105; i++)
  db.prepare("INSERT INTO private_library VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
    7,
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
    savedRow.metadata,
    savedRow.render_hash,
    savedRow.original_hash,
    savedRow.render_type,
    savedRow.original_type,
    0,
    Date.now(),
  );
const page = await (await request("/library")).json();
assert.equal(page.items.length, 100);
assert(page.cursor);
const next = await (await request("/library?cursor=" + page.cursor)).json();
assert(next.items.length > 0);
assert.equal(
  new Set([...page.items, ...next.items].map((r) => r.id)).size,
  page.items.length + next.items.length,
);
assert.equal(db.prepare("SELECT COUNT(*) n FROM sounds").get().n, 1);
assert(
  [...objects.keys()].every(
    (k) =>
      k.startsWith("private-library/7/") || k.startsWith("private-library/8/"),
  ),
);
console.log(
  "PASS private Library actual client + SQLite/D1/R2/Worker: explicit legacy binding, two-device audio/original/FX/daily recovery, full private duration, metadata dedupe, offline retry, conflict copies and tombstones, retained bytes, R2/quota errors, pagination, auth/account isolation and late-session cancellation; no World/Group/bot publication",
);
db.close();
