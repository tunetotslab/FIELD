import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import worker from "../server/worker.mjs";
import { wavDuration } from "../server/world.mjs";

const db = new DatabaseSync(":memory:");
db.exec(readFileSync(new URL("../server/schema.sql", import.meta.url), "utf8"));
// An additive receipt table cannot change existing user sound rows.
const legacy = new DatabaseSync(":memory:");
legacy.exec(
  "CREATE TABLE sounds(id TEXT); INSERT INTO sounds VALUES ('preserved')",
);
legacy.exec(
  readFileSync(
    new URL(
      "../server/migrations/0006_private_file_transfers.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
assert.equal(legacy.prepare("SELECT id FROM sounds").get().id, "preserved");
legacy.close();
const DB = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          first: async () => db.prepare(sql).get(...args) || null,
          run: async () => ({
            meta: { changes: Number(db.prepare(sql).run(...args).changes) },
          }),
        };
      },
    };
  },
};
const env = {
  DB,
  BOT_TOKEN: "test-private-file-token",
  APP_ORIGIN: "https://tunetotslab.github.io",
  AUDIO: {
    put() {
      throw Error("Private exports must not enter R2");
    },
    get() {
      throw Error("Private exports must not read World");
    },
  },
};
function auth(user = 1) {
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
function wav(seconds = 1) {
  const bytes = new ArrayBuffer(44 + seconds * 8000 * 2),
    view = new DataView(bytes),
    out = new Uint8Array(bytes);
  const text = (offset, value) =>
    out.set(new TextEncoder().encode(value), offset);
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, bytes.byteLength - 44, true);
  out.fill(20, 44);
  return bytes;
}
const calls = [];
let mode = "ok",
  preparedRejected = false;
const previousFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/api.telegram.org\/bot/);
  calls.push({ url: String(url), options });
  if (String(url).endsWith("/sendDocument")) {
    if (mode === "network") throw Error("Ambiguous network failure");
    if (mode === "reject") return Response.json({ ok: false, error_code: 403 });
    if (mode === "invalid")
      return Response.json({ ok: true, result: { message_id: 7 } });
    return Response.json({
      ok: true,
      result: {
        message_id: 7,
        from: { username: "FIELDtestbot" },
        document: { file_id: "private-cached-file" },
      },
    });
  }
  assert.ok(String(url).endsWith("/savePreparedInlineMessage"));
  return Response.json(
    preparedRejected
      ? { ok: false, error_code: 400 }
      : { ok: true, result: { id: "prepared-123" } },
  );
};
const documents = () =>
  calls.filter((call) => call.url.endsWith("/sendDocument"));
async function request({
  user = 1,
  id = randomUUID(),
  action = "export",
  bytes = wav(),
  origin = env.APP_ORIGIN,
  authorized = true,
  title = "Saved rain",
  extra = {},
} = {}) {
  const form = new FormData();
  form.set(
    "metadata",
    JSON.stringify({ clientId: id, action, title, ...extra }),
  );
  form.set("audio", new Blob([bytes], { type: "audio/wav" }), "saved.wav");
  return worker.fetch(
    new Request("https://field.test/files/telegram", {
      method: "POST",
      headers: {
        Origin: origin,
        ...(authorized ? { Authorization: auth(user) } : {}),
      },
      body: form,
    }),
    env,
  );
}
assert.equal((await request({ authorized: false })).status, 401);
assert.equal((await request({ origin: "https://evil.test" })).status, 403);
assert.equal(documents().length, 0);
assert.equal((await request({ bytes: new Uint8Array([1, 2, 3]) })).status, 400);
assert.equal((await request({ bytes: new ArrayBuffer(25000001) })).status, 413);
const full = wav(61);
assert.throws(() => wavDuration(full));
assert.equal(wavDuration(full, Infinity), 61);
const id = randomUUID();
let response = await request({
  id,
  bytes: full,
  extra: { chat_id: -999, user_id: 999 },
});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  delivered: true,
  botUrl: "https://t.me/FIELDtestbot",
});
assert.equal(documents().at(-1).options.body.get("chat_id"), "1");
assert.deepEqual(
  await documents().at(-1).options.body.get("document").arrayBuffer(),
  full,
);
response = await request({ id, bytes: full, action: "share" });
assert.equal(response.status, 200);
assert.equal((await response.json()).preparedMessageId, "prepared-123");
assert.equal(documents().length, 1);
const prepared = JSON.parse(calls.at(-1).options.body);
assert.equal(prepared.user_id, 1);
assert.equal(prepared.result.document_file_id, "private-cached-file");
assert.equal(prepared.result.type, "document");
assert.equal((await request({ id, bytes: wav() })).status, 409);
assert.equal(documents().length, 1);
assert.equal((await request({ id, user: 2, bytes: full })).status, 200);
assert.equal(documents().length, 2);
assert.equal(documents().at(-1).options.body.get("chat_id"), "2");
const concurrent = randomUUID();
const beforeConcurrent = documents().length;
const simultaneous = await Promise.all([
  request({ id: concurrent }),
  request({ id: concurrent }),
]);
assert.ok(simultaneous.some((r) => r.status === 200));
assert.equal(documents().length, beforeConcurrent + 1);
mode = "reject";
const retry = randomUUID();
assert.equal((await request({ id: retry })).status, 403);
assert.equal(
  db
    .prepare("SELECT state FROM private_file_transfers WHERE client_id=?")
    .get(retry).state,
  "failed",
);
mode = "ok";
assert.equal((await request({ id: retry })).status, 200);
for (const failure of ["network", "invalid"]) {
  mode = failure;
  const uncertain = randomUUID();
  const first = await request({ id: uncertain });
  assert.equal(first.status, 409);
  assert.equal((await first.json()).code, "FILE_UNCERTAIN");
  const before = documents().length;
  mode = "ok";
  assert.equal((await request({ id: uncertain })).status, 409);
  assert.equal(documents().length, before);
  assert.equal(
    db
      .prepare("SELECT state FROM private_file_transfers WHERE client_id=?")
      .get(uncertain).state,
    "uncertain",
  );
}
preparedRejected = true;
response = await request({ user: 3, action: "share" });
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  delivered: true,
  botUrl: "https://t.me/FIELDtestbot",
});
preparedRejected = false;
for (let n = 0; n < 10; n++)
  assert.equal((await request({ user: 4 })).status, 200);
const beforeRate = documents().length;
response = await request({ user: 4 });
assert.equal(response.status, 429);
assert.equal((await response.json()).code, "FILE_RATE");
assert.equal(documents().length, beforeRate);
assert.equal(db.prepare("SELECT COUNT(*) n FROM sounds").get().n, 0);
assert.equal(db.prepare("SELECT COUNT(*) n FROM world_cities").get().n, 0);
globalThis.fetch = previousFetch;
db.close();
console.log(
  "PASS private Telegram WAV relay: signed recipient only, unchanged full bytes, no R2/World, auth/origin/size checks, SQLite migration, concurrent/idempotent retries, explicit rejection, uncertain no-resend, native cached-file sharing and rate limit",
);
