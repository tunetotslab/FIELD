# FIELD API — GitHub / Cloudflare

This Worker belongs to the FIELD GitHub repository. GitHub Pages remains the
frontend. No OpenAI hosting or storage is used.

## Cloudflare setup

1. Connect this repository to Cloudflare Workers Builds (root directory `server`).
2. Create D1 database `field` and private R2 bucket `field-audio`.
3. Replace `database_id` in `wrangler.jsonc` with the D1 ID, commit and push it.
4. Apply `schema.sql` to D1 before deployment.
5. Add Worker secrets `BOT_TOKEN` and a random `WEBHOOK_SECRET`. Never put either
   in the repository, frontend environment variables, screenshots or chat.
6. Deploy via the GitHub connection. Register `/telegram/webhook` with Telegram
   `setWebhook`, using the same `secret_token` and updates `message` and
   `pre_checkout_query`. Inspect existing webhook first; do not replace another
   bot service unknowingly.
   The Worker now also serves FIELD bot menus for `/start`, `/open`, `/daily`,
   `/donate`, `/about`, `/help`, `/links`, `/language` and inline callbacks.
   After deploy, set localized command menus with `server/register-commands.mjs`.
7. Test invoices in Telegram's test environment: cancel, pending, paid,
   duplicate delivery, bad payload, wrong user/amount, and `/paysupport`.
   Receipts in D1 (`charge_id`) are the authoritative record. To refund use
   `refundStarPayment` with that charge ID and the corresponding user ID.
8. Add repository Actions variable `FIELD_API_URL` with the Worker HTTPS URL,
   then rebuild Pages. Donations stay disabled without this variable.

## Tune Tots Groups

Apply `migrations/0002_tune_tots_groups.sql` before enabling group UI. In the
private bot chat the FIELD owner creates a course group with
`/newgroup Course name`. The bot returns a nine-character code. Add the bot as
an administrator to the target Telegram group, then send `/connect CODE` in the
group or in the required forum topic. The binding stores `message_thread_id`, so
different FIELD course groups can target different topics in one supergroup.

Members join through the authenticated Mini App API with the code. Group audio
stays in private R2; D1 membership is checked for listing and playback. The bot
sends the stored WAV with `sendDocument` because Telegram `sendAudio` only
accepts MP3/M4A. A failed
Telegram delivery is recorded as `failed` and must never be presented as a
successful chat delivery.

After the migration is applied, set the Worker variable `GROUPS_ENABLED=true`.
Until then the deployed Worker keeps the existing audio authorization query and
returns `503` from group endpoints, so a GitHub-driven Worker deployment cannot
break FIELD World before its D1 schema is ready.

## FIELD World launch gate

Worker variable `WORLD_ENABLED=true` and GitHub variable
`FIELD_WORLD_ENABLED=true` enable the controlled acceptance build after automated
and isolated browser checks. The owner is testing on a second account/phone.
Do not declare Stage 5 complete or announce a broad release until real upload,
second-account playback, owner removal, reports and offline retry are confirmed.
Reporting/moderation and group sharing are implemented. Private recordings
remain local; cloud private-library sync is not implemented. Apply
`migrations/0003_world.sql` to the existing D1 database before this Worker deploy.
Do not execute the updated fresh-install `schema.sql` as a migration.
Never deploy a Worker referencing moderation columns before this migration.

World upload accepts PCM WAV up to 24 MB / **actual** 60 seconds, including FX
tails. Multipart requests do not require `Content-Length`: both World and Group
count actual incoming bytes before parsing, cancel bodies above 25 MB, and reject
oversized files independently. Missing or understated size headers cannot bypass
the cap. Regression tests include browser-style requests without the header.

`/cities?q=...&country=AM&language=ru` now searches the versioned GeoNames
country catalogue after two characters (450ms frontend debounce). Nominatim is
no longer used: its global lease blocked concurrent users and its policy does not
permit autocomplete. D1 caches results for 30 days under a new namespace; the
Worker caches at most three country files for 30 minutes. Typed queries and user
coordinates never go to an external geocoder. `CITY_DIRECTORY_URL` can override
the default `${APP_URL}geo/v1/`; publish the catalogue via the existing Pages
workflow before deploying this Worker. Prefix aliases are normalized at build
time; Thai/other non-Latin combining marks are retained. RU/EN/HY/Chinese names
use GeoNames translations; missing labels fall back to English plus native names.
Existing OSM IDs are retained only when a catalogue alias matches a cached city
in the same country within 10km, with no ambiguous matches. New IDs use
`geonames:<id>`. Only cached server city IDs are accepted for publication; client
coordinates are ignored. No D1 migration is required for this catalogue change.

Catalogue sources/licence: [GeoNames dumps](https://download.geonames.org/export/dump/readme.txt),
CC BY 4.0. Download `cities500.zip`, `alternateNamesV2.zip`, `admin1CodesASCII.txt`
and `countryInfo.txt` into ignored `work/geo/`, then run
`python3 scripts/build-city-directory.py work/geo public/geo/v1` and commit the
generated shards/manifest. Coverage excludes some small villages; aliases and
translations are only as complete as GeoNames. Do not invent translated names.

`GET /world/cities` returns complete visible city counts. `GET /world?city=ID`
returns `{items,nextCursor}` (20 items). Cursor ordering uses `(created_at,id)`.
World POST retries are idempotent per user/client ID; removed publications need
a new key. Owner-only `DELETE /world/:id` cannot target group audio. Report POST
`/world/:id/reports` accepts privacy/abuse/copyright/other, deduplicates by
reporter/sound and limits reports per day. Hidden audio is denied even through
direct `/audio/:id`. Owner-only private `/reports` and `mod:*` callbacks provide
listen/keep/hide/delete with confirmation; notification failure never loses the
report. Human moderation, no automatic keyword deletion.

IndexedDB publication intent retries while FIELD is open and authenticated,
including reopening after offline. Failed uploads offer manual Retry. Private
originals and non-destructive editor settings remain local. Editing saves a new
version; unpublishing never deletes local audio. Legacy recordings without saved
originals cannot recover pre-render audio. Group upload has per-user/group/client
idempotency and owner-only `/groups/:id/sounds/:sound/retry` for failed delivery.
Telegram does not provide exactly-once document delivery on ambiguous timeout;
the UI warns before manual retry. A `pending` delivery after a Worker interruption
requires owner review rather than blind resending.
R2 stays private; requests require signed Telegram initData no older than 1 hour.
Users reopen FIELD to refresh an expired session. No authenticated API response
may be cached by the service worker.

All World/group GET requests explicitly bypass HTTP caches. World revalidates on
open, foreground/focus and reconnect; the active city list is refreshed too.
Cancelled city responses cannot overwrite a newer fetch. Static shell caching
remains available offline; navigations revalidate HTTP HTML in shell v7. No
localStorage/IndexedDB reset is part of release or rollback.

Regression verification: `npm run typecheck`, `npm test`, `npm run build`, plus
dev-only `/qa.html` for audio/IndexedDB/three-FX and isolated World UI. Do not
publish QA fixtures. World rollback: disable frontend and Worker flags without
deleting D1/R2 or resetting the user's IndexedDB. Keep the additive migration.

### World sharing extension

For an existing Stage 5 database, apply **only** additive migrations
`0004_report_outcomes.sql` and `0005_world_sharing.sql` before this Worker deploy.
Do not reapply the fresh-install schema or old migrations. Commit and push the
repository before executing production migrations/deployment.

`POST /cities/resolve` repairs saved legacy city IDs using a canonical cached city
or named settlement lookup; ambiguous locations require selecting a city again.
The client converts the saved render (without applying effects again) to PCM WAV
and recalculates duration. Full local files are preserved; shared copies cap at
60 seconds with a short fade and explicit notice.

`POST/DELETE /world/:id/likes` are per-account idempotent. World listing returns
aggregate `likes` and requester `liked`, never the identities of voters.
`POST /world/:id/download` issues a five-minute HMAC ticket signed with the existing
Worker webhook secret under a download-specific purpose string. `GET/HEAD
/download/:id` validates the ticket and current World visibility, serves WAV as
an attachment, and permits Telegram Web download CORS. No course/private audio
or initData/credentials enter download URLs. R2 remains private.

`WORLD_TELEGRAM_CHAT=@Fieldapp` configures the public mirror, independent of
course bindings. Add the existing FIELD bot with document-sending rights (channel:
posting administrator). New publications trigger delivery; a five-minute Worker
cron recovers queued/rejected deliveries and backfills existing visible World
sounds. `world_telegram_deliveries` records destination, status, message ID and
sanitized Telegram rejection. Delivered messages are not resent. `uncertain` or
interrupted `sending` requires manual review: check Telegram before changing the
row back to queued. Exactly-once delivery is not promised. Removal/hide tries to
delete the bot message; external downloads/forwards cannot be recalled.

Owner-only private `/worldsync` drains a batch immediately and reports delivery
counts/errors. It never blindly resends uncertain deliveries.

Report outcomes retain locale/resolution/notification state. Reporter messages
are private and retry through the Worker cron; blocked/not-started bots may reject
delivery. Administration remains private and owner-only.

## Amounts

Presets: 5, 10, 25, 50, 75, 100, 1000, 10000, 100000 XTR. Random amounts:
1–100,000 XTR, displayed before requesting an invoice. FIELD weights the roll
so everyday gifts are common and very large gifts are rare. Telegram may reject
a large invoice; the maximum must be live-tested before launch.
Random selection never executes a payment. Donation invoices award no prize.

References: https://core.telegram.org/bots/payments-stars,
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app,
https://developers.cloudflare.com/workers/ci-cd/builds/.

## Owner admin

`ADMIN_TELEGRAM_ID` is a non-secret Worker variable. `/stats` and `/transactions`
are handled only when the sender ID matches it; other users receive the ordinary
FIELD home response. Successful payments are recorded by unique Telegram charge
ID before an owner notification can be claimed, so webhook retries do not count
or notify twice. Apply `migrations/0001_admin_donations.sql` before deploying the
Worker version that uses the added nullable donor and notification columns.

## Playable legacy audio / private file actions repair

Local `field-audio` storage now writes ArrayBuffer envelopes and reads both those
and legacy Blob rows. No database wipe or bulk overwrite is required. Preserve the
new envelope reader in any rollback; older clients cannot interpret newly saved
byte envelopes. Existing originals/edit states remain on the user's device.

Before deploying this Worker to an existing production DB, commit/push the code,
then apply **only** `migrations/0006_private_file_transfers.sql`. This adds receipt
metadata; it does not change sounds, groups, donations or R2 objects. Fresh installs
use `schema.sql`. Keep this additive table on rollback.

`POST /files/telegram` requires the existing Origin and signed Telegram session,
bounded multipart input (25 MB body / 24 MB WAV), a UUID clientId and export/share
action. It delivers the full valid PCM WAV solely to the authenticated user's own
bot chat. Recipient fields in submitted metadata are ignored. No R2 writes and no
World/Group publication occur. Share optionally prepares a cached-document inline
message for native Telegram `shareMessage` (WebApp 8.0+). Rejected preparation does
not lose the already delivered private copy; its bot-chat link remains available.
A blocked/not-started bot produces a visible error instructing the user to start it.

D1 receipts keyed by user/clientId/hash deduplicate successful transfers and claim
concurrent delivery. Explicit Telegram rejection permits a manual retry; ambiguous
network/acknowledgement and interrupted `sending` never automatically resend. Check
the private bot chat first. Requests are limited to ten new receipts per user/minute.
No initData, bot token, Telegram file ID or private audio is returned in public URLs.
Regression `scripts/files.test.mjs` uses SQLite plus mocked Telegram; it sends no
production messages and leaves production World/Group audio untouched.
