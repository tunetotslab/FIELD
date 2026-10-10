# FIELD project status

Updated: 2026-10-11.

- Source: `https://github.com/tunetotslab/FIELD`.
- Frontend target: `https://field-by-tune-tots.pages.dev/`, Cloudflare Pages project
  `field-by-tune-tots`, production branch `main`.
- Previous frontend: `https://tunetotslab.github.io/FIELD/`; keep only through the
  verified migration window.
- API: `https://field-api.nikolachenmusic.workers.dev`.
- Worker source deployment remains manual Wrangler from the GitHub clone; D1/R2 and
  encrypted Worker secrets are unchanged.
- Baseline typecheck, unit/server/security tests, lint, production build and Chromium
  regression passed. Local WebKit timed out under Node 26; GitHub Node 22 WebKit CI
  remains required before final acceptance.
- Physical iPhone, real Telegram Main Mini App URL, microphone, native share and test
  payment acceptance still require owner/device verification. No real payment was run.

See `SECURITY_DEPLOYMENT.md` for the migration gate and rollback.
