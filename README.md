# FIELD by Tune Tots Lab

Mobile-first Telegram Mini App / installable PWA for recording, shaping and collecting field sound.

## Telegram Mini App

The frontend is ready to be opened by Telegram as a Mini App. It loads the
official Telegram Web App SDK, expands the viewport, follows Telegram theme
colors, supports native haptics and the native Back button, and keeps the PWA
fallback for normal browsers.

The repository includes a GitHub Pages workflow. After enabling Pages with
GitHub Actions in repository settings, the production URL is
`https://tunetotslab.github.io/FIELD/`. Configure that URL in BotFather as the
bot's Main Mini App or as a `web_app` button. Audio saves first in local IndexedDB.
Signed-in private Library sync, authenticated World and Tune Tots Group publication
use the existing Cloudflare Worker, D1 and private R2 bucket.
Ready and Library prepare real WAV bytes independently of publication. In Telegram,
Export sends the WAV to the user's private FIELD bot chat; Share opens Telegram's
native recipient selector when supported, with the bot copy as the fallback.
The signed session alone selects the recipient. Other browsers retain system file
sharing/download. Private transfer stores a delivery receipt, not audio in World/R2.
Telegram Mini App uses signed Telegram data. Safari/PWA can sign in with explicit
approval in the private FIELD bot and use the same Telegram identity, World and
course memberships. World reads the shared D1/R2 archive, never the private Library.
Safari, Telegram and installed PWA keep separate local caches but now sync the same
private account Library. New signed-in saves sync automatically when FIELD is online.
For recordings already stored locally, open Library **on the device/context holding
them**, choose **Sync recordings from this device**, check the account and confirm.
Do this once in the original Telegram Mini App to bring its old Library into Safari.
Sync never publishes private recordings or sends them to a group.

## Run

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Microphone access requires HTTPS or localhost. Audio saves locally in IndexedDB;
signed-in private Library also has authenticated D1/R2 copies.
World/Group availability follows the existing build flags and Worker configuration.
See `server/README.md` for deployment and `FIELD_WORLD_GROUPS_PLAN_RU.md` for release
verification and remaining physical-device acceptance.

Library rows are normalized centrally on read and on save without deleting data.
Both publication destinations normalize the saved render to PCM WAV, derive duration
from real samples and preserve the local source. World comes only from D1/R2;
foreground/online events revalidate it. Daily uses the local calendar day and
refreshes after foregrounding and while the Daily screen stays open overnight.
Saved PCM is prepared directly without Web Audio allocation. Metadata changes
retain the render; only audio edits invalidate it. Publication errors include a
safe stage or HTTP code, and request deadlines cover the complete response body.

City suggestions start after two characters within the selected country. The
versioned GeoNames catalogue in `public/geo/v1` includes alternate scripts,
English/native names and available translations. It is fetched by the Worker per
country; it is not included in the frontend JavaScript bundle. Catalogue coverage
is settlements with >500 residents or administrative seats, not every village.
Missing translations fall back to English and native labels. Source, licence and
checksums are in its manifest; rebuild with `scripts/build-city-directory.py`.

## Approved assets now integrated

The app uses the supplied immutable Tune Tots logo and approved Miley sheet. Production crops are stored locally and are not regenerated at runtime.

## Production assets still required

Replace the clearly marked placeholders with approved source files for:

- Nine FIELD FX objects
- Daily challenge photography, beginning with `daily-metallic.jpg`

Do not trace or regenerate these assets from the reference screenshots.

## Standalone Safari/PWA

Open Settings or World → Continue with Telegram → open the FIELD bot → compare
six-digit codes and approve your own login → return to the same browser and confirm
the displayed account. The proof stays in browser memory; bot links carry only the
challenge ID. Login expires after 30 days or server revocation. Signing out affects
only the separate `field-account` database, never `field-audio`.

Save new sounds explicitly in Library, then close/reopen the same Safari/PWA
context. Saves resolve after IndexedDB transaction commit, store audio bytes and
request browser eviction protection where supported. Browser/private-mode storage
policy can still remove local data; export valuable WAVs. No data wipe is required.
Library syncs on entry, foreground and reconnect; audio, original source, editor/FX,
titles and favorites follow the account. Offline saves stay local until retry.
Sign-out hides account-owned rows without erasing their cached bytes. Concurrent
edits keep both versions. Removing a synced row removes it from Library on all
synced devices; World/Group publications remain. Recovery bytes remain private;
full erasure currently requires support. Storage limits and migration are documented
in `server/README.md`. The bottom menu follows the visible
viewport on every screen. Mail actions share the primary pink/white pill design;
Telegram and donation handoffs use actual links.

Cross-platform regression (isolated profiles, synthetic audio, real private Library route/SQLite/R2 adapter and fixture bot/publication services):

```bash
npx playwright install webkit chromium
VITE_FIELD_API_URL=http://127.0.0.1:4188 VITE_FIELD_WORLD_ENABLED=true VITE_FIELD_GROUPS_ENABLED=true npm run build -- --base=/FIELD/
FIELD_QA_BROWSER=webkit npm run test:web
FIELD_QA_BROWSER=chromium npm run test:web
```

The regression includes separate Safari and Telegram contexts restoring private bytes
and publication state and exchanging favorites through the private account archive.
The GitHub workflow runs real WebKit and Chromium engines on pull requests. Each
checks ordinary browser, a separate standalone-profile simulation and Telegram SDK
fixtures. Chromium also verifies installability in a normal profile and records
through its synthetic microphone using actual MediaRecorder Opus/WebM, then decodes,
edits/previews, exports PCM WAV and reopens the committed local recording. These are
not physical-phone, OS installation or live Telegram approval tests. See
`FIELD_PWA_AUDIT.md` for scope, evidence, installation steps and remaining device checks. Native iOS work remains separately
in PR #3; no paid Apple membership is needed for this PWA.
