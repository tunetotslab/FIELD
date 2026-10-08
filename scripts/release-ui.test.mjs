import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile("src/App.tsx", "utf8");
const shell = await readFile("src/components/Shell.tsx", "utf8");
const artwork = await readFile("src/components/FieldArtwork.tsx", "utf8");
const telegram = await readFile("src/telegram/index.ts", "utf8");
const world = await readFile("src/components/WorldMap.tsx", "utf8");
const i18n = await readFile("src/i18n/index.tsx", "utf8");

assert(!app.includes("✂"), "Editor must use the FIELD SVG scissors, not emoji");
for (const key of ["trim", "split", "soon", "loop", "fade", "continue"])
  assert.equal(
    (i18n.match(new RegExp(`\\b${key}:`, "g")) || []).length,
    4,
    `${key} must exist in all four locales`,
  );
assert(
  shell.includes("(navigation ? ("),
  "Bottom navigation must remain mounted during recording",
);
assert(
  artwork.includes('UiIcon name="plus"') &&
    artwork.includes('UiIcon name="minus"'),
  "World zoom must use SVG icons",
);
assert(
  telegram.includes("disableVerticalSwipes") &&
    world.includes("setVerticalSwipes(false)"),
  "Telegram World swipe protection missing",
);
assert(
  app.includes('className="ready-save-action"') &&
    !app.includes('className="ready-actions"'),
  "Final sound screen must expose only the primary Save action",
);
assert(
  artwork.includes("dx * 0.55") && artwork.includes("precision(0.8)"),
  "World drag responsiveness regression",
);
console.log(
  "PASS release UI gate: persistent navigation, single Save action, responsive World, SVG controls, four-locale editor copy and Telegram swipe protection",
);
