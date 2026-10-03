import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { transformWithOxc } from "vite";
import { createServer } from "node:http";
import worker from "../server/worker.mjs";
import { webkit, chromium } from "playwright";
// Use only a local build, isolated browser profile and test fixtures. No real
// Telegram messages, production uploads or existing personal browser storage.
const port = 4187,
  origin = `http://127.0.0.1:${port}`,
  base = origin + "/FIELD/";
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
      res.end('window.Telegram={WebApp:{initData:""}};');
      return;
    }
    if (relative.startsWith("__qa/src/") && relative.endsWith(".ts")) {
      const file = relative.slice("__qa/".length);
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
let browser, api;
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
  browser = process.env.FIELD_QA_CHROME
    ? await chromium.launch({
        executablePath: process.env.FIELD_QA_CHROME,
        timeout: 20000,
      })
    : await webkit.launch({ timeout: 20000 });
  console.log("Browser launched");
  const context = await browser.newContext({
    viewport: { width: 375, height: 640 },
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
  });
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
    uploads = 0;
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
            "WebKit preflight",
            path,
            req.headers["access-control-request-headers"] || "",
          );
          res.writeHead(204);
          res.end();
          return;
        }
        for await (const chunk of req) {
          /* Consume bounded synthetic fixture input. */
        }
        let body = {};
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
          assert.equal(req.headers.authorization, `Bearer ${identity.token}`);
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
  await reopened.getByText("WebKit saved sound", { exact: true }).waitFor();
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
  await context.setOffline(true);
  await reopened.reload();
  await reopened
    .locator(".bottom-nav")
    .getByRole("button", { name: "LIBRARY", exact: true })
    .click();
  await reopened.getByText("WebKit saved sound", { exact: true }).waitFor();
  await context.setOffline(false);
  assert.deepEqual(errors, [], "No browser runtime errors after reopening/offline");
  console.log(
    "PASS built PWA browser: active service worker; reachable navigation across screens/sizes; proof-based login; shared World/Group publication; committed WAV survives tab close/reopen and offline reload; restored account; matching About/Help/Links mail styles and real Telegram links",
  );
  await context.close();
} finally {
  clearTimeout(deadline);
  server.close();
  api?.close();
  await browser?.close();
}
