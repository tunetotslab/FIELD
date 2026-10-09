import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile("src/App.tsx", "utf8");
const shell = await readFile("src/components/Shell.tsx", "utf8");
const artwork = await readFile("src/components/FieldArtwork.tsx", "utf8");
const telegram = await readFile("src/telegram/index.ts", "utf8");
const world = await readFile("src/components/WorldMap.tsx", "utf8");
const i18n = await readFile("src/i18n/index.tsx", "utf8");
const install = await readFile("src/components/InstallPrompt.tsx", "utf8");
const visual = await readFile("src/visual-cleanup.css", "utf8");
const theme = await readFile("src/theme.ts", "utf8");

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
for (const key of [
  "installTitle",
  "installCopy",
  "installAction",
  "installIosAction",
  "installIosSteps",
  "dismissInstall",
])
  assert.equal(
    (i18n.match(new RegExp(`\\b${key}:`, "g")) || []).length,
    4,
    `${key} must exist in all four locales`,
  );
assert(
  install.includes('window.addEventListener("beforeinstallprompt"') &&
    install.includes('window.matchMedia("(display-mode: standalone)")') &&
    install.includes("telegram.isTelegram") &&
    install.includes("isNativeApp()") &&
    !install.includes("localStorage"),
  "Mobile install card must use the real prompt and stay out of installed/Telegram/native surfaces",
);
assert(
  visual.includes(':root[data-theme="dark"] .install-prompt-copy .install-instructions') &&
    visual.includes(':root:not([data-theme="dark"]) .install-prompt-copy .install-instructions'),
  "Expanded install instructions must remain readable in light and dark themes",
);
assert(
  theme.includes('const THEME_CHOICE_KEY = "field-theme-choice-v2"') &&
    !theme.includes('saved === "system"') &&
    !theme.includes("matchMedia"),
  "FIELD must default to Light independently of the device and remember only an explicit theme choice",
);
console.log(
  "PASS release UI gate: persistent navigation, single Save action, responsive World, localized real PWA install offer, SVG controls, four-locale editor copy and Telegram swipe protection",
);
