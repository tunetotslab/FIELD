import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { transformWithOxc } from "vite";
import { indexedDB } from "fake-indexeddb";
const modules = new Map();
async function moduleUrl(path) {
  if (modules.has(path)) return modules.get(path);
  if(path.endsWith('/config.ts')) return 'data:text/javascript,export const API_URL="https://field.test"';
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
const { createSessionStore, browserSessionStorage } = await load(
  "../src/auth/session.ts",
);
const { createSoundRepository } = await load("../src/storage/db.ts");
const repository = createSoundRepository("browser-private-test");
const bytes = new Uint8Array([4, 3, 2, 1]);
await repository.save({
  id: "private",
  title: "Keep",
  createdAt: 1,
  audioBlob: new Blob([bytes]),
  originalBlob: new Blob([bytes]),
  waveform: [0.2],
  emojis: ["🌲", "🌲", "🌲"],
  duration: 1,
  visibility: "private",
  effect: "original",
});
const first = createSessionStore();
assert(!first.isAuthenticated());
const identity = {
  token: "field_" + "a".repeat(43),
  userId: 7,
  displayName: "Nikola",
  provider: "telegram",
  expiresAt: Date.now() + 60000,
};
await first.setSession(identity);
const reopened = createSessionStore();
await reopened.restoreSession();
assert.equal(reopened.currentUserId(), 7);
assert.equal(
  reopened.authenticationHeaders().Authorization,
  `Bearer ${identity.token}`,
);
assert.deepEqual(
  new Uint8Array(await (await repository.getAll())[0].audioBlob.arrayBuffer()),
  bytes,
);
window.Telegram = {
  WebApp: {
    initData: new URLSearchParams({
      user: JSON.stringify({ id: 9 }),
    }).toString(),
  },
};
assert.equal(reopened.currentUserId(), 9);
assert(reopened.authenticationHeaders().Authorization.startsWith("tma "));
window.Telegram = { WebApp: { initData: "" } };
let finish;
globalThis.fetch = () =>
  new Promise((resolve) => {
    finish = resolve;
  });
const oldRequest = reopened.authenticatedFetch(
  "https://field.test/world/cities",
);
await reopened.setSession({
  ...identity,
  userId: 8,
  token: "field_" + "b".repeat(43),
});
finish(new Response(null, { status: 401 }));
await oldRequest;
assert.equal(
  reopened.currentUserId(),
  8,
  "A stale request must not expire a new account",
);
globalThis.fetch = async () => new Response(null, { status: 401 });
await reopened.authenticatedFetch("https://field.test/groups");
assert(!reopened.isAuthenticated());
const afterExpiry = createSessionStore();
await afterExpiry.restoreSession();
assert(!afterExpiry.isAuthenticated());
assert.equal(
  (await repository.getAll()).length,
  1,
  "Session invalidation must preserve audio",
);
await first.setSession(identity);
await first.setSession(undefined);
assert.deepEqual(
  new Uint8Array(
    await (await repository.getAll())[0].originalBlob.arrayBuffer(),
  ),
  bytes,
);
await browserSessionStorage.write({ ...identity, expiresAt: 1 });
await afterExpiry.restoreSession();
assert(!afterExpiry.currentSession());
await assert.rejects(() => first.setSession({ ...identity, token: "bad" }));
console.log(
  "PASS browser account survives reopening; TMA priority; stale and matching 401; expiry/logout preserve private audio bytes; invalid credentials rejected",
);
