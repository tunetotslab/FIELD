# FIELD API — deployment pending

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

Set Worker variable `WORLD_ENABLED=true` and GitHub variable
`FIELD_WORLD_ENABLED=true` only after testing upload, playback from a second
Telegram account, owner-only deletion, offline retry and city-level privacy.
Implement content reporting/moderation before a broad public launch. Private
recordings remain local; group sharing and cloud private-library sync are not
implemented. World currently returns the latest 200 recordings.

World upload accepts WAV up to 24 MB / declared 60 seconds and resolves the city
server-side; client coordinates are ignored. Nominatim requires a deployment
with a suitable geocoding quota/cache or replacement provider before scaling.
R2 stays private; requests require signed Telegram initData no older than 1 hour.
Users reopen FIELD to refresh an expired session. No authenticated API response
may be cached by the service worker.

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
