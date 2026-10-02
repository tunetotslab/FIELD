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
bot's Main Mini App or as a `web_app` button. The bot/backend is intentionally not part of this frontend;
private recordings remain in IndexedDB. Authenticated World and Tune Tots Group
publication use the existing Cloudflare Worker, D1 and private R2 bucket.
Ready and Library prepare real WAV bytes independently of publication. In Telegram,
Export sends the WAV to the user's private FIELD bot chat; Share opens Telegram's
native recipient selector when supported, with the bot copy as the fallback.
The signed session alone selects the recipient. Other browsers retain system file
sharing/download. Private transfer stores a delivery receipt, not audio in World/R2.
World requires a signed Telegram session; the ordinary-browser map explains this.

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

Microphone access requires HTTPS or localhost. Audio is stored locally in IndexedDB.
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


## iOS / Stage 6

Owner authorized iOS development on 2026-10-03; Android follows later.
See [FIELD_IOS_PLAN_RU.md](FIELD_IOS_PLAN_RU.md). Native source lives in `ios/` in
this GitHub repository. `npm run sync:ios` bundles the same frontend locally;
`npm run open:ios` opens Xcode. No remote app-shell URL or native service worker.
Native audio/files + SQLite are separate from Telegram/PWA's IndexedDB; native
sessions use Keychain. Export/share use system iOS controllers.

`.github/workflows/ios.yml` checks real Swift/SQLite persistence and compiles both
simulator and unsigned iPhone builds. Its simulator archive is not an installable
signed IPA. TestFlight/App Store requires Apple Developer enrollment and signing.
`npm run test:ios-storage` runs native persistence checks on macOS with Swift.
Standalone Telegram auth is opt-in (`NATIVE_AUTH_ENABLED`, migration 0007);
private bot approval preserves existing Telegram user/group identities. Store
release additionally requires the remaining gates documented in the iOS plan.
