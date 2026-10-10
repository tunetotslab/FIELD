# FIELD security and deployment

Status date: 2026-10-11.

## Architecture

The GitHub repository is the only source of truth. Cloudflare Pages project
`field-by-tune-tots` builds `main` with `npm run build -- --base=/` and publishes
`https://field-by-tune-tots.pages.dev/`. Cloudflare Worker `field-api` remains at
`https://field-api.nikolachenmusic.workers.dev`, with the existing D1 database and
private R2 bucket. No database recreation or destructive migration is part of this
hosting change.

## Secrets and public configuration

`BOT_TOKEN` and `WEBHOOK_SECRET` are encrypted Cloudflare Worker secrets. They must
never be stored in Git, Pages variables, documentation, screenshots or logs.
`.env*` and `.dev.vars*` are ignored. `VITE_FIELD_API_URL`, feature flags, Worker
name, D1 identifier and R2 bucket name are public configuration, not credentials.
Everything prefixed `VITE_` is included in the browser bundle.

The current tree and full Git history were scanned for common Telegram, GitHub,
Cloudflare and private-key patterns without printing candidate values. No committed
credential or tracked source map was identified, so no rotation was indicated by
this audit. Private repository visibility cannot revoke earlier forks or clones.

## Release order and rollback

1. Build and test the Pages deployment while the old GitHub Pages URL remains live.
2. Push the reviewed commit and verify Cloudflare builds that exact commit.
3. Deploy the Worker configuration from that GitHub commit and verify both origins.
4. Update the Telegram Main Mini App URL and verify the real client.
5. Make the GitHub repository private, verify anonymous repository denial, and
   confirm Pages/Worker remain healthy.

Before step 5, rollback means keep GitHub Pages and the old Worker variables. After
step 5, restore the prior Worker version and temporarily make the repository public
only if the new Pages deployment cannot be repaired. The local pre-change Git bundle
is an additional recovery snapshot, not a production source.

Production source maps are disabled explicitly. Cloudflare `_headers` prevents stale
HTML/service-worker caching and `_redirects` preserves SPA navigation.
