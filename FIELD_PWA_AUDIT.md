# FIELD PWA cross-platform audit — October 4, 2026

Source: FIELD GitHub repository; current audited baseline `0cbd539` (private Library
release). Owner confirmed Library exchange and city data in Telegram/Safari on one
iPhone. A second phone is not yet checked; the older Redmi is unavailable. Native
PR #3 remains separate. No Android SDK/emulator was installed on the owner's Mac.

## Evidence boundary

| Surface | Automated coverage | Physical acceptance |
| --- | --- | --- |
| iOS Safari | Real WebKit with iPhone UA/touch/viewport, browser login and session restore, Library/World/Group, WAV download, offline shell and controls | Latest owner confirms private Library/cities on one iPhone; live microphone/keyboard/device interruptions remain |
| Installed iOS PWA | Separate WebKit profile, manifest launch URL, synthetic standalone indicator, own login/cache and Library/file reopen | Home Screen installation, real display-mode, launcher and microphone permission remain |
| Android Chrome | Real Chromium with Pixel/Android UA/touch and narrow 360px layout; normal-profile manifest/installability; real MediaRecorder with synthetic microphone, pause/resume, decode, editor/FX preview, PCM export and durable guest save | Actual older Redmi/Chrome version, microphone and low-memory interruptions remain |
| Installed Android PWA | Separate Chromium profile, manifest start URL/scope/identity, synthetic standalone indicator, private Library/login and WAV download/reopen | Actual WebAPK/shortcut, OS launcher, real display-mode and permissions remain |
| Telegram iOS | Real WebKit + controlled Telegram SDK, separate signed-account Library recovery, native sheet height/safe areas/Back, explicit private WAV export/share | Actual Telegram iOS client/native sharing and interrupted microphone remain |
| Telegram Android | Real Chromium + controlled Telegram SDK; same Library, native viewport/Back and private file-relay checks | Actual Telegram Android/Redmi WebView and native sharing/microphone remain |

Standalone indicator injection models a separate launch/storage surface; it does not
install an app or emulate native CSS display-mode/system chrome. SDK fixtures do not
send real Telegram messages. Existing server regressions separately verify genuine
signed TMA/Bearer ownership and SQLite/D1/R2 isolation. Synthetic microphone tests
exercise the browser's actual recorder/decoder, not the physical phone hardware.
Do not turn any automatic PASS into a claim of six real-device PASS results.

## Reproduced defect and repair

A Telegram native sheet reports height 620 while visualViewport stays 750. Before
repair FIELD listened to viewportChanged but used only visualViewport; bottom
navigation stayed outside the sheet. New regression failed on the old build.
The shell now uses min(visible browser height, Telegram viewportStableHeight), with
viewportHeight as fallback. It stays stable during unfinished native animations,
uses smaller keyboard-visible height, ignores pinch zoom and leaves ordinary browser
layout unchanged. Safe-area/navigation and Telegram Back checks cover the result.
Frontend service worker is bumped to shell v10; no storage reset, migration or Worker
change is required. Current backend remains private Library Worker
`07924a24-14f0-4ba3-a598-d8af88c4cbb2`.

## Installation

Open https://tunetotslab.github.io/FIELD/ in an ordinary browser, not inside the
Telegram Mini App.

- **Android Chrome:** browser menu ⋮ → Install app / Add to Home screen (the exact
  label depends on browser/device). Use a normal profile; Chrome explicitly rejects
  PWA installation in incognito. Launch the FIELD icon, then sign in through the same
  Telegram bot/account to sync Library, World and Group access. Chrome devices with
  Google Mobile Services may receive a WebAPK; absent GMS or other browsers may use
  a shortcut. Private cache/session can differ from the browser; account sync resolves
  Library access after login, not by reading another browser's IndexedDB.
- **Samsung Internet:** installation packaging depends on device; WebAPK integration
  is documented on Samsung devices. It is not promised on the owner's Redmi.
- **Firefox/Edge/other Android browsers:** their menu may add a browser-backed
  shortcut instead of a WebAPK. Their physical engine/native permissions remain
  untested in this audit; ordinary HTTPS FIELD is the fallback.
- **iPhone/iPad Safari:** Share → Add to Home Screen → enable Open as Web App if the
  current system offers it → Add. Launch FIELD and sign in. Current iOS also supports
  Home Screen addition through some other browsers; Safari is the primary checked path.

The manifest already computes identity/scope/start URL as `/FIELD/`, has standalone
display and real 192/512 icons. Do not change identity to create a duplicate installed
app. Installability check runs in a temporary normal Chromium profile and only checks
eligibility; no app is installed in the owner's macOS launcher.

Primary documentation: [Chrome PWA identity](https://developer.chrome.com/docs/capabilities/pwa-manifest-id),
[installability criteria](https://web.dev/articles/install-criteria),
[MDN installation support](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable),
[Telegram viewport API](https://core.telegram.org/bots/webapps#initializing-mini-apps).

## Minimum physical check when Redmi is available

1. Chrome → open FIELD → install from menu → launch icon → sign in to the same account.
2. Record/pause/resume/stop → listen and save → close/reopen → play from Library.
3. Open the same Library in Telegram Android; check audio/favorite sync and one
   explicit World/Group publication. Check menu with keyboard open and screen rotated.
4. Repeat launch/record/reopen from the iPhone Home Screen; verify Telegram sheet/menu
   resize and permission denial/retry. Background/lock should pause recording, not
   promise recording while the OS suspends the app. Export valuable source WAVs.

No localStorage, IndexedDB, user audio, donations or public/course data were cleared.

## Recorded validation

Local typecheck, full unit/server suite, existing lint command (TypeScript), and
production fixture build passed. Real Chrome with an Android profile passed the
complete browser/Telegram/standalone-surface regression, including installability
and synthetic microphone capture. Linux WebKit and Chromium are required in GitHub
CI before release; native OS/phone acceptance remains the matrix above.
