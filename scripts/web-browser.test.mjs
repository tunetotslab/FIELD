import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { transformWithOxc } from "vite";
import { createServer } from "node:http";
import worker from "../server/worker.mjs";
import { libraryRoute } from "../server/library.mjs";
import { DatabaseSync } from "node:sqlite";
import { webkit, chromium, devices } from "playwright";
// Use only a local build, isolated browser profile and test fixtures. No real
// Telegram messages, production uploads or existing personal browser storage.
const engine =
  process.env.FIELD_QA_BROWSER ||
  (process.env.FIELD_QA_CHROME ? "chromium" : "webkit");
assert(
  ["webkit", "chromium"].includes(engine),
  "FIELD_QA_BROWSER must be webkit or chromium",
);
const mobileProfile = devices[engine === "chromium" ? "Pixel 5" : "iPhone 12"];
console.log(
  `Audit engine: ${engine}; browser / standalone simulation / Telegram SDK fixture. These are not physical device tests.`,
);
const port = 4187,
  origin = `http://127.0.0.1:${port}`,
  base = origin + "/FIELD/";
function telegramFixture(platform) {
  const events = new Map(),
    calls = [];
  const app = {
    initData: "user=%7B%22id%22%3A41%7D",
    initDataUnsafe: { user: { id: 41, username: "test_owner" } },
    platform,
    viewportHeight: innerHeight,
    viewportStableHeight: innerHeight,
    onEvent: (name, fn) => {
      const handlers = events.get(name) || new Set();
      handlers.add(fn);
      events.set(name, handlers);
    },
    offEvent: (name, fn) => events.get(name)?.delete(fn),
    ready: () => calls.push("ready"),
    expand: () => calls.push("expand"),
    openTelegramLink: (url) => calls.push(url),
    isVersionAtLeast: () => true,
    shareMessage: (id) => calls.push("share:" + id),
    BackButton: {
      show: () => calls.push("back:show"),
      hide: () => calls.push("back:hide"),
      onClick: (fn) => app.onEvent("back", fn),
      offClick: (fn) => app.offEvent("back", fn),
    },
    HapticFeedback: {
      impactOccurred: () => {},
      notificationOccurred: () => {},
    },
  };
  window.Telegram = { WebApp: app };
  window.__qaTelegram = {
    calls,
    viewport: (height, stable = true) => {
      app.viewportHeight = height;
      if (stable) app.viewportStableHeight = height;
      for (const fn of events.get("viewportChanged") || [])
        fn({ isStateStable: stable });
    },
    back: () => {
      for (const fn of events.get("back") || []) fn();
    },
  };
}
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
// Serve the production assets and explicit fixture modules over real HTTP.
// This keeps service-worker fetches observable even in WebKit, whose routes
// cannot intercept a module request made inside an active service worker.
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, origin).pathname);
    if (!path.startsWith("/FIELD/") || path.includes("..")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const relative = path.slice("/FIELD/".length);
    if (relative === "__qa/telegram.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(
        req.headers.cookie?.includes("qa_tma=1")
          ? `(${telegramFixture.toString()})(${JSON.stringify(engine === "chromium" ? "android" : "ios")})`
          : 'window.Telegram={WebApp:{initData:""}};',
      );
      return;
    }
    if (relative.startsWith("__qa/src/") && relative.endsWith(".ts")) {
      const file = relative.slice("__qa/".length);
      if (file === "src/config.ts") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(`export const API_URL=${JSON.stringify(apiOrigin)};`);
        return;
      }
      let { code } = await transformWithOxc(
        await readFile(resolve(file), "utf8"),
        file,
      );
      code = code.replace(
        /from (["'])(\.[^"']+)\1/g,
        (_, q, p) => `from ${q}${p}.ts${q}`,
      );
      res.setHeader("Content-Type", "application/javascript");
      res.end(code);
      return;
    }
    const file = relative || "index.html";
    let bytes = await readFile(resolve("dist", file));
    if (file === "index.html")
      bytes = Buffer.from(
        bytes
          .toString()
          .replace(
            "https://telegram.org/js/telegram-web-app.js?63",
            "./__qa/telegram.js",
          ),
      );
    res.setHeader(
      "Content-Type",
      mime[extname(file)] || "application/octet-stream",
    );
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
const apiOrigin = "http://127.0.0.1:4188";
const libraryDb = new DatabaseSync(":memory:");
libraryDb.exec(
  await readFile("server/migrations/0008_private_library.sql", "utf8"),
);
const libraryFiles = new Map();
const libraryEnv = {
  LIBRARY_SYNC_ENABLED: "true",
  DB: {
    prepare(sql) {
      const bind = (...args) => ({
        first: async () => libraryDb.prepare(sql).get(...args) || null,
        all: async () => ({ results: libraryDb.prepare(sql).all(...args) }),
        run: async () => ({
          meta: {
            changes: Number(libraryDb.prepare(sql).run(...args).changes),
          },
        }),
      });
      return { ...bind(), bind };
    },
  },
  AUDIO: {
    async put(key, bytes) {
      libraryFiles.set(key, new Uint8Array(bytes));
    },
    async get(key) {
      const bytes = libraryFiles.get(key);
      return bytes ? { body: bytes.slice() } : null;
    },
  },
};
let browser, api, profileDirectory;
const deadline = setTimeout(() => {
  console.error("Browser regression exceeded 120 seconds");
  server.close();
  api?.close();
  void browser?.close();
  process.exit(1);
}, 120000);
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  let context;
  const options = {
    ...mobileProfile,
    viewport: { width: 375, height: 640 },
    locale: "en-US",
  };
  if (engine === "chromium") {
    await mkdir("work", { recursive: true });
    profileDirectory = await mkdtemp(resolve("work/pwa-profile-"));
    context = await chromium.launchPersistentContext(profileDirectory, {
      ...options,
      ...(process.env.FIELD_QA_CHROME
        ? { executablePath: process.env.FIELD_QA_CHROME }
        : {}),
      timeout: 20000,
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    });
    browser = context.browser();
  } else {
    browser = await webkit.launch({ timeout: 20000 });
    context = await browser.newContext(options);
  }
  console.log("Browser launched in isolated profile");
  console.log("Isolated context created");
  const page = await context.newPage(),
    errors = [];
  console.log("Test page created");
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  const location = {
    placeId: "osm:relation:1",
    city: "Yerevan",
    country: "Armenia",
    countryCode: "AM",
    lat: 40.177,
    lng: 44.503,
  };
  const challenge = {
    id: "1".repeat(32),
    proof: "p".repeat(43),
    code: "123456",
    expiresAt: Date.now() + 600000,
    url: `https://t.me/field_sound_bot?start=field_web_${"1".repeat(32)}`,
  };
  const identity = {
    userId: 41,
    displayName: "Test owner",
    provider: "telegram",
    token: "field_" + "a".repeat(43),
    expiresAt: Date.now() + 600000,
  };
  let approved = false,
    worldRequests = 0,
    groupRequests = 0,
    uploads = 0,
    privateTransfers = 0;
  // Real cross-origin HTTP fixture uses the Worker's actual CORS policy.
  // WebKit preflights must never escape to the production API.
  assert(
    (await readFile("dist/index.html", "utf8")).includes(apiOrigin),
    "Build browser regression with VITE_FIELD_API_URL=http://127.0.0.1:4188",
  );
  await new Promise((resolve) => {
    api = createServer(async (req, res) => {
      const path = new URL(req.url, apiOrigin).pathname;
      try {
        const cors = await worker.fetch(
          new Request(apiOrigin + path, {
            method: "OPTIONS",
            headers: { Origin: req.headers.origin || origin },
          }),
          { APP_ORIGIN: origin },
        );
        cors.headers.forEach((value, key) => res.setHeader(key, value));
        if (req.method === "OPTIONS") {
          console.log(
            `${engine} preflight`,
            path,
            req.headers["access-control-request-headers"] || "",
          );
          res.writeHead(204);
          res.end();
          return;
        }
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        if (path === "/library" || path.startsWith("/library/")) {
          assert(
            [
              `Bearer ${identity.token}`,
              "tma user=%7B%22id%22%3A41%7D",
            ].includes(req.headers.authorization),
          );
          const response = await libraryRoute(
            new Request(apiOrigin + req.url, {
              method: req.method,
              headers: { "Content-Type": req.headers["content-type"] || "" },
              ...(["POST", "DELETE"].includes(req.method)
                ? { body: Buffer.concat(chunks) }
                : {}),
            }),
            libraryEnv,
            identity.userId,
          );
          res.writeHead(response.status, {
            "Content-Type":
              response.headers.get("Content-Type") || "application/json",
          });
          res.end(Buffer.from(await response.arrayBuffer()));
          return;
        }
        let body = {};
        if (path === "/files/telegram") {
          assert.equal(
            req.headers.authorization,
            "tma user=%7B%22id%22%3A41%7D",
          );
          const form = await new Request(apiOrigin + path, {
            method: "POST",
            headers: { "Content-Type": req.headers["content-type"] },
            body: Buffer.concat(chunks),
          }).formData();
          const file = form.get("audio");
          assert(file instanceof Blob && file.size > 44);
          assert.equal(
            new TextDecoder().decode((await file.arrayBuffer()).slice(0, 4)),
            "RIFF",
          );
          privateTransfers++;
          body = {
            delivered: true,
            preparedMessageId: "fixture-file",
            botUrl: "https://t.me/field_sound_bot",
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
          return;
        }
        if (path === "/auth/browser/challenge") body = challenge;
        else if (path === "/auth/browser/status")
          body = approved
            ? { state: "approved", userId: 41, displayName: "Test owner" }
            : { state: "pending" };
        else if (path === "/auth/browser/exchange") {
          assert(approved);
          body = identity;
        } else if (path === "/auth/browser/logout") body = { ok: true };
        else {
          assert(
            [
              `Bearer ${identity.token}`,
              "tma user=%7B%22id%22%3A41%7D",
            ].includes(req.headers.authorization),
          );
          if (path === "/world/cities") {
            worldRequests++;
            body = [{ ...location, id: location.placeId, count: 1 }];
          } else if (path === "/groups") {
            groupRequests++;
            body = [
              {
                id: "course",
                name: "Existing course",
                role: "member",
                telegramTitle: "Tune Tots",
              },
            ];
          } else if (path === "/cities/resolve") body = location;
          else if (path === "/world") {
            uploads++;
            body = { id: "public-sound", location };
          } else if (path === "/groups/course/sounds") {
            uploads++;
            body = { id: "group-sound", telegramDeliveryState: "delivered" };
          } else throw Error(`Unexpected test request ${path}`);
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
      } catch (error) {
        errors.push(error.message);
        res.writeHead(500);
        res.end();
      }
    });
    api.listen(4188, "127.0.0.1", resolve);
  });
  await page.goto(base);
  await page.locator(".bottom-nav").waitFor();
  await page.waitForFunction(
    () => !!navigator.serviceWorker.controller,
    undefined,
    { timeout: 15000 },
  );
  console.log("PWA opened with active service worker");
  const manifestResponse = await context.request.get(
    base + "manifest.webmanifest",
  );
  assert.equal(manifestResponse.status(), 200);
  const manifest = await manifestResponse.json();
  assert.equal(new URL(manifest.start_url, base).href, base);
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    const response = await context.request.get(new URL(icon.src, base).href);
    assert.equal(response.status(), 200);
    const png = await response.body(),
      size = Number(icon.sizes.split("x")[0]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  if (engine === "chromium") {
    const cdp = await context.newCDPSession(page);
    const parsed = await cdp.send("Page.getAppManifest");
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.manifest.id, base);
    assert.equal(parsed.manifest.scope, base);
    const eligibility = await cdp.send("Page.getInstallabilityErrors");
    assert.deepEqual(
      eligibility.installabilityErrors,
      [],
      "Normal Chrome profile must meet actual manifest/installability criteria",
    );
    await cdp.detach();
    console.log(
      "Chromium installability: zero errors, stable FIELD identity/scope, real 192/512 icons",
    );
  }
  const nav = page.locator(".bottom-nav");
  async function checkNav() {
    const box = await nav.boundingBox();
    assert(
      box && box.y + box.height <= page.viewportSize().height + 1,
      JSON.stringify(box),
    );
    for (const button of await nav.getByRole("button").all()) {
      const b = await button.boundingBox();
      assert(b.width >= 44 && b.height >= 44);
    }
    return box.y;
  }
  for (const size of [
    { width: 360, height: 640 },
    { width: 375, height: 640 },
    { width: 375, height: 540 },
    { width: 390, height: 750 },
    { width: 812, height: 375 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForFunction(
      () =>
        Math.abs(
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--field-viewport-height",
            ),
          ) - (window.visualViewport?.height || innerHeight),
        ) < 1,
      undefined,
      { timeout: 15000 },
    );
    console.log("Checking viewport", size);
    const baseline = await checkNav();
    for (const name of ["LIBRARY", "DAILY", "MAP", "SETTINGS", "REC"]) {
      await nav.getByRole("button", { name, exact: true }).click();
      assert(
        Math.abs((await checkNav()) - baseline) < 1,
        `Navigation moves on ${name}`,
      );
    }
  }
  await page.setViewportSize({ width: 375, height: 640 });
  await nav.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue with Telegram", exact: true })
    .click();
  const botLink = page.getByRole("link", {
    name: "Continue with Telegram",
    exact: true,
  });
  assert.equal(await botLink.getAttribute("href"), challenge.url);
  assert(!challenge.url.includes(challenge.proof));
  approved = true;
  console.log("Awaiting login approval");
  await page
    .getByRole("button", { name: "Continue as Test owner", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).waitFor();
  await nav.getByRole("button", { name: "MAP", exact: true }).click();
  await page
    .getByRole("button", { name: "Yerevan · 1", exact: true })
    .waitFor();
  assert(worldRequests > 0);
  console.log("Shared World loaded");
  // Save actual WAV bytes through the production repository; then close the
  // tab, restore session and verify Library/render/original in a fresh tab.
  await page.evaluate(async (location) => {
    const { soundsDb } = await import("/FIELD/__qa/src/storage/db.ts");
    const buffer = new ArrayBuffer(16044),
      v = new DataView(buffer);
    const str = (o, s) =>
      [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, 16036, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true);
    v.setUint32(28, 16000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, 16000, true);
    for (let i = 44; i < 16044; i += 2) v.setInt16(i, 1000, true);
    const blob = new Blob([buffer], { type: "audio/wav" });
    await soundsDb.save({
      id: "web-fixture",
      title: "WebKit saved sound",
      createdAt: 1,
      duration: 1,
      audioBlob: blob,
      originalBlob: blob,
      waveform: [0.2, 0.5, 0.2],
      emojis: ["🌲", "🌲", "🌲"],
      visibility: "private",
      effect: "original",
      location,
    });
  }, location);
  await page.close();
  console.log("Saved WAV and closed tab");
  const reopened = await context.newPage();
  reopened.setDefaultTimeout(15000);
  reopened.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await reopened.goto(base);
  await reopened.locator(".bottom-nav").waitFor();
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  await reopened.getByText("WebKit saved sound", { exact: true }).waitFor();
  const originalBytes = await reopened.evaluate(async () => {
    const { soundsDb } = await import("/FIELD/__qa/src/storage/db.ts");
    const row = (await soundsDb.getAll())[0];
    return {
      size: row.audioBlob.size,
      original: row.originalBlob.size,
      sample: new DataView(await row.audioBlob.arrayBuffer()).getInt16(
        44,
        true,
      ),
    };
  });
  assert.deepEqual(originalBytes, {
    size: 16044,
    original: 16044,
    sample: 1000,
  });
  await reopened
    .getByRole("button", { name: /Sync recordings from this device/ })
    .click();
  await reopened
    .getByRole("button", { name: "Add to my private Library", exact: true })
    .click();
  await reopened
    .getByText("Private Library is synced", { exact: true })
    .waitFor();
  assert.equal(
    libraryDb
      .prepare("SELECT COUNT(*) n FROM private_library WHERE user_id=41")
      .get().n,
    1,
  );
  for (const destination of ["Add to World", "Add to Tune Tots Group"]) {
    console.log("Publishing saved WAV", destination);
    await reopened
      .getByRole("button", { name: "Sound actions", exact: true })
      .click();
    await reopened
      .getByRole("button", { name: destination, exact: true })
      .click();
    await reopened
      .getByRole("button", { name: "Existing course Tune Tots" })
      .waitFor();
    if (destination === "Add to Tune Tots Group")
      await reopened
        .getByRole("button", { name: "Existing course Tune Tots" })
        .click();
    await reopened
      .getByRole("button", { name: "CONTINUE →", exact: true })
      .click();
    await reopened.getByRole("button", { name: "SAVE", exact: true }).click();
    if (destination === "Add to World")
      await reopened
        .getByRole("button", { name: "Publish", exact: true })
        .click();
    await reopened
      .getByText(
        destination === "Add to World"
          ? "Saved on this device and published to FIELD World."
          : "Saved and delivered to your Tune Tots Group.",
        { exact: true },
      )
      .waitFor();
    await reopened
      .locator(".bottom-nav")
      .getByRole("button", { name: "LIBRARY", exact: true })
      .click();
  }
  assert.equal(uploads, 2);
  assert(groupRequests > 0);

  await reopened
    .getByText("Private Library is synced", { exact: true })
    .waitFor();
  const telegramContext = await browser.newContext({
    viewport: { width: 390, height: 750 },
    locale: "en-US",
    isMobile: true,
    hasTouch: true,
  });
  await telegramContext.addCookies([
    { name: "qa_tma", value: "1", url: origin },
  ]);
  const telegramPage = await telegramContext.newPage();
  telegramPage.setDefaultTimeout(15000);
  telegramPage.on("pageerror", (error) => errors.push(error.message));
  await telegramPage.goto(base);
  await telegramPage
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  await telegramPage.getByText("WebKit saved sound", { exact: true }).waitFor();
  const remoteBytes = await telegramPage.evaluate(async () => {
    const { soundsDb } = await import("/FIELD/__qa/src/storage/db.ts");
    const row = (await soundsDb.getAll())[0];
    return {
      render: row.audioBlob.size,
      original: row.originalBlob.size,
      sample: new DataView(await row.originalBlob.arrayBuffer()).getInt16(
        44,
        true,
      ),
      world: row.worldPublication?.state,
      group: row.groupPublication?.state,
    };
  });
  assert.deepEqual(remoteBytes, {
    render: 16044,
    original: 16044,
    sample: 1000,
    world: "published",
    group: "published",
  });
  await telegramPage
    .getByRole("button", { name: "Favorite", exact: true })
    .click();
  await telegramPage.locator(".favorite.active").waitFor();
  await telegramPage
    .getByText("Private Library is synced", { exact: true })
    .waitFor();
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "SETTINGS", exact: true })
    .click();
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  await reopened.locator(".favorite.active").waitFor();
  await telegramPage.evaluate(() => {
    document.documentElement.style.setProperty(
      "--tg-safe-area-inset-bottom",
      "24px",
    );
    document.documentElement.style.setProperty(
      "--tg-content-safe-area-inset-bottom",
      "8px",
    );
    window.__qaTelegram.viewport(620);
  });
  await telegramPage.waitForFunction(
    () =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--field-viewport-height",
        ),
      ) === 620,
  );
  let telegramBaseline;
  for (const name of ["REC", "LIBRARY", "DAILY", "MAP", "SETTINGS"]) {
    await telegramPage
      .locator(".bottom-nav")
      .getByRole("button", { name, exact: true })
      .click();
    const box = await telegramPage.locator(".bottom-nav").boundingBox();
    assert(
      box.y + box.height <= 621,
      "Telegram native viewport contains navigation",
    );
    telegramBaseline ??= box.y;
    assert(Math.abs(box.y - telegramBaseline) < 1);
  }
  await telegramPage.evaluate(() => window.__qaTelegram.viewport(540, false));
  assert.equal(
    await telegramPage.evaluate(() =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--field-viewport-height",
        ),
      ),
    ),
    620,
    "Do not bounce navigation during native resize animation",
  );
  await telegramPage.evaluate(() => window.__qaTelegram.viewport(540, true));
  await telegramPage.waitForFunction(
    () =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--field-viewport-height",
        ),
      ) === 540,
  );
  await telegramPage.setViewportSize({ width: 390, height: 400 });
  await telegramPage.waitForFunction(
    () =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--field-viewport-height",
        ),
      ) === 400,
  );
  const keyboardNav = await telegramPage.locator(".bottom-nav").boundingBox();
  assert(
    keyboardNav.y + keyboardNav.height <= 401,
    "Smaller keyboard-visible browser viewport wins",
  );
  await telegramPage.setViewportSize({ width: 390, height: 750 });

  await telegramPage
    .locator(".settings-list")
    .getByRole("button", { name: /^Help/ })
    .click();
  await telegramPage.evaluate(() => window.__qaTelegram.back());
  await telegramPage.locator(".settings-list").waitFor();
  await telegramPage
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  await telegramPage
    .getByRole("button", { name: "Sound actions", exact: true })
    .click();
  await telegramPage
    .getByRole("button", { name: "EXPORT WAV", exact: true })
    .click();
  await telegramPage
    .getByText(
      "The WAV is in your private FIELD bot chat. Save or forward the file there.",
      { exact: true },
    )
    .waitFor();
  await telegramPage
    .getByRole("button", { name: "SHARE", exact: true })
    .click();
  await telegramPage.waitForFunction(() =>
    window.__qaTelegram.calls.includes("share:fixture-file"),
  );
  assert.equal(
    privateTransfers,
    2,
    "Telegram export/share are explicit private transfers",
  );
  await telegramPage
    .getByRole("link", { name: "Open FIELD bot chat", exact: true })
    .click();
  assert(
    await telegramPage.evaluate(() =>
      window.__qaTelegram.calls.includes("https://t.me/field_sound_bot"),
    ),
    "Bot handoff uses Telegram native link",
  );
  await telegramContext.close();
  console.log(
    "Two isolated browser/Telegram contexts share actual D1/R2 private Library bytes, publication metadata and favorite changes",
  );
  const standalone = await browser.newContext({
    ...mobileProfile,
    viewport: { width: 360, height: 640 },
    locale: "en-US",
  });
  // This emulates the standalone surface only; it does not install a WebAPK or
  // assert a real iOS Home Screen launch. Physical launcher/permission checks remain.
  await standalone.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    }),
  );
  let installedPage = await standalone.newPage();
  installedPage.setDefaultTimeout(15000);
  installedPage.on("pageerror", (error) => errors.push(error.message));
  await installedPage.goto(base);
  assert(await installedPage.evaluate(() => navigator.standalone));
  await installedPage
    .locator(".bottom-nav")
    .getByRole("button", { name: "SETTINGS", exact: true })
    .click();
  await installedPage
    .getByRole("button", { name: "Continue with Telegram", exact: true })
    .click();
  await installedPage
    .getByRole("button", { name: "Continue as Test owner", exact: true })
    .click();
  await installedPage
    .getByRole("button", { name: "Sign out", exact: true })
    .waitFor();
  await installedPage
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  await installedPage
    .getByText("WebKit saved sound", { exact: true })
    .waitFor();
  await installedPage
    .getByRole("button", { name: "Sound actions", exact: true })
    .click();
  const downloaded = installedPage.waitForEvent("download");
  await installedPage
    .getByRole("button", { name: "EXPORT WAV", exact: true })
    .click();
  const download = await downloaded;
  assert(download.suggestedFilename().endsWith(".wav"));
  assert.equal(await download.failure(), null);
  const exported = await readFile(await download.path());
  assert.equal(exported.toString("ascii", 0, 4), "RIFF");
  assert.equal(exported.length, 16044);
  await installedPage.close();
  installedPage = await standalone.newPage();
  installedPage.on("pageerror", (error) => errors.push(error.message));
  await installedPage.goto(new URL(manifest.start_url, base).href);
  await installedPage
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  await installedPage
    .getByText("WebKit saved sound", { exact: true })
    .waitFor();
  await installedPage.locator(".favorite.active").waitFor();
  await standalone.close();
  console.log(
    "Standalone surface simulation: account/Library reopen and actual WAV download preserved",
  );

  assert(errors.length === 0, errors.join("\n"));
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "SETTINGS", exact: true })
    .click();
  await reopened
    .getByRole("button", { name: "Sign out", exact: true })
    .waitFor();
  const buttonStyle = (element) => {
    const c = getComputedStyle(element);
    return {
      color: c.color,
      bg: c.backgroundColor,
      radius: c.borderRadius,
      fontFamily: c.fontFamily,
      fontSize: c.fontSize,
      fontWeight: c.fontWeight,
      lineHeight: c.lineHeight,
      letterSpacing: c.letterSpacing,
      padding: c.padding,
      height: element.getBoundingClientRect().height,
    };
  };
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "DAILY", exact: true })
    .click();
  const reference = await reopened
    .locator(".daily-card .primary-button")
    .evaluate(buttonStyle);
  assert.equal(reference.bg, "rgb(245, 49, 164)");
  assert.equal(reference.color, "rgb(255, 255, 255)");
  for (const label of ["About FIELD", "Help & Support", "Links"]) {
    await reopened
      .locator(".bottom-nav")
      .getByRole("button", { name: "SETTINGS", exact: true })
      .click();
    await reopened
      .locator(".settings-list")
      .getByRole("button", { name: new RegExp("^" + label) })
      .click();
    await reopened
      .getByRole("button", { name: "EMAIL US", exact: true })
      .click();
    const controls = reopened.locator(".email-actions .primary-button");
    assert.equal(await controls.count(), 5);
    for (const control of await controls.all())
      assert.deepEqual(
        await control.evaluate(buttonStyle),
        reference,
        `Mail action on ${label} must match the task button`,
      );
  }
  assert.equal(
    await reopened
      .locator('a[href="https://t.me/field_sound_bot?startapp"]')
      .getAttribute("href"),
    "https://t.me/field_sound_bot?startapp",
  );
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "SETTINGS", exact: true })
    .click();
  await reopened.getByRole("button", { name: "Sign out", exact: true }).click();
  await reopened
    .getByRole("button", { name: "Continue with Telegram", exact: true })
    .waitFor();
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  assert.equal(
    await reopened.getByText("WebKit saved sound", { exact: true }).count(),
    0,
    "Logout hides account Library",
  );
  assert.equal(
    await reopened.evaluate(async () => {
      const { soundsDb } = await import("/FIELD/__qa/src/storage/db.ts");
      return (await soundsDb.raw())[0].audioBlob.size;
    }),
    16044,
    "Logout retains cached private bytes",
  );
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "SETTINGS", exact: true })
    .click();
  await reopened
    .locator(".settings-list")
    .getByRole("button", { name: /Donate/ })
    .click();
  assert.equal(
    await reopened
      .getByRole("link", {
        name: "Open FIELD in Telegram to donate.",
        exact: true,
      })
      .getAttribute("href"),
    "https://t.me/field_sound_bot?startapp",
  );
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "SETTINGS", exact: true })
    .click();
  await reopened
    .getByRole("button", { name: "Continue with Telegram", exact: true })
    .click();
  await reopened
    .getByRole("button", { name: "Continue as Test owner", exact: true })
    .click();
  await reopened
    .getByRole("button", { name: "Sign out", exact: true })
    .waitFor();
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  await reopened.getByText("WebKit saved sound", { exact: true }).waitFor();
  await reopened
    .getByText("Private Library is synced", { exact: true })
    .waitFor();
  if (engine === "chromium") {
    const capture = await browser.newContext({
      ...mobileProfile,
      viewport: { width: 360, height: 640 },
      locale: "en-US",
    });
    const recording = await capture.newPage();
    recording.setDefaultTimeout(20000);
    recording.on("pageerror", (error) => errors.push(error.message));
    await recording.goto(base);
    await recording
      .getByRole("button", { name: "TAP TO RECORD", exact: true })
      .click();
    await recording
      .getByRole("button", { name: "Pause recording", exact: true })
      .waitFor({ state: "visible" });
    await recording.waitForFunction(
      () => !document.querySelector('[aria-label="Pause recording"]').disabled,
    );
    // Wait for real MediaRecorder chunks from Chrome's synthetic audio device.
    await recording.waitForTimeout(1100);
    // The Record control deliberately pulses. A real touch at its center
    // exercises the hit target without waiting for its animation to end.
    const pauseTarget = await recording
      .getByRole("button", { name: "Pause recording", exact: true })
      .boundingBox();
    await recording.touchscreen.tap(
      pauseTarget.x + pauseTarget.width / 2,
      pauseTarget.y + pauseTarget.height / 2,
    );
    await recording
      .getByRole("button", { name: "Resume recording", exact: true })
      .click();
    await recording.waitForTimeout(700);
    await recording
      .getByRole("button", { name: "Finish recording", exact: true })
      .click();
    await recording
      .getByRole("button", { name: "EDIT RECORDING →", exact: true })
      .click();
    await recording
      .getByRole("button", { name: "CONTINUE →", exact: true })
      .click();
    await recording
      .locator(".fx-preview-controls")
      .getByRole("button", { name: "PREVIEW ▶", exact: true })
      .click();
    await recording
      .locator(".fx-preview-controls")
      .getByRole("button", { name: "STOP ■", exact: true })
      .waitFor();
    await recording
      .getByRole("button", { name: "CONTINUE →", exact: true })
      .click();
    for (let i = 0; i < 3; i++)
      await recording.locator(".emoji-grid button").first().click();
    await recording
      .getByRole("button", { name: "CONTINUE →", exact: true })
      .click();
    await recording.locator(".title-input").fill("Android captured audio");
    await recording
      .getByRole("button", { name: "CONTINUE →", exact: true })
      .click();
    await recording.locator(".option-list button").first().click();
    await recording
      .getByRole("button", { name: "CONTINUE →", exact: true })
      .click();
    await recording
      .getByRole("button", { name: "CONTINUE →", exact: true })
      .click();
    await recording
      .getByRole("button", { name: "CONTINUE →", exact: true })
      .click();
    try {
      await recording.waitForFunction(() => {
        const button = document.querySelector(
          ".ready-actions button:nth-child(2)",
        );
        return button && !button.disabled;
      });
    } catch (error) {
      console.error(
        "Synthetic capture UI:",
        await recording.locator("body").innerText(),
      );
      await recording.screenshot({ path: "work/pwa-capture-failure.png" });
      throw error;
    }
    const rendered = recording
      .waitForEvent("download")
      .catch((error) => ({ error }));
    await recording
      .locator(".ready-actions")
      .getByRole("button", { name: /EXPORT WAV/ })
      .click();
    const exportDownload = await rendered;
    if ("error" in exportDownload) {
      console.error(
        "Capture export UI:",
        await recording.locator("body").innerText(),
      );
      throw exportDownload.error;
    }
    assert.equal(await exportDownload.failure(), null);
    const capturedWav = await readFile(await exportDownload.path());
    assert.equal(capturedWav.toString("ascii", 0, 4), "RIFF");
    assert(capturedWav.length > 1000);
    await recording.getByRole("button", { name: "SAVE", exact: true }).click();
    await recording
      .locator(".bottom-nav")
      .getByRole("button", { name: "LIBRARY", exact: true })
      .click();
    await recording
      .getByText("Android captured audio", { exact: true })
      .waitFor();
    await recording.reload();
    await recording
      .locator(".bottom-nav")
      .getByRole("button", { name: "LIBRARY", exact: true })
      .click();
    await recording
      .getByText("Android captured audio", { exact: true })
      .waitFor();
    const captured = await recording.evaluate(async () => {
      const { soundsDb } = await import("/FIELD/__qa/src/storage/db.ts");
      const sound = (await soundsDb.getAll())[0];
      return {
        original: sound.originalBlob.type,
        render: sound.audioBlob.type,
        bytes: sound.audioBlob.size,
        private: sound.visibility,
        synced: !!sound.librarySync,
      };
    });
    assert(
      captured.original.includes("webm"),
      "Actual Chromium MediaRecorder uses Opus/WebM",
    );
    assert.equal(captured.render, "audio/wav");
    assert.equal(captured.private, "private");
    assert.equal(captured.synced, false, "Guest recording stays local");
    await capture.close();
    console.log(
      "Real Chromium synthetic microphone → Opus chunks → decode/pause/resume → editor/FX → PCM export → committed guest Library reopen passed",
    );
  }
  // WebKit's protocol-level offline emulation rejects even literal SW responses
  // during navigation (microsoft/playwright#42775). Stop both real HTTP origins
  // instead, so fetch actually fails and the production SW must use its cache.
  for (const fixture of [server, api])
    await new Promise((resolve, reject) => {
      fixture.close((error) => (error ? reject(error) : resolve()));
      fixture.closeAllConnections();
    });
  await assert.rejects(
    fetch(base),
    "The application origin must be unavailable",
  );
  await assert.rejects(fetch(apiOrigin), "The API origin must be unavailable");
  const offlineResponse = await reopened.reload();
  assert(
    offlineResponse?.fromServiceWorker(),
    "Offline shell must come from SW",
  );
  await context.setOffline(true);
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  await reopened.getByText("WebKit saved sound", { exact: true }).waitFor();
  await context.setOffline(false);
  assert.deepEqual(
    errors,
    [],
    "No browser runtime errors after reopening/offline",
  );
  console.log(
    "PASS built PWA browser: active service worker; reachable navigation across screens/sizes; proof-based login; shared World/Group publication; committed WAV survives tab close/reopen and offline reload; separate standalone and Telegram surfaces, native viewport/Back/private file relay, restored account; matching About/Help/Links mail styles and real Telegram links",
  );
  await context.close();
} finally {
  clearTimeout(deadline);
  server.close();
  api?.close();
  await browser?.close();
  libraryDb.close();
  if (profileDirectory)
    await rm(profileDirectory, { recursive: true, force: true });
}
