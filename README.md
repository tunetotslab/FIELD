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
local recordings remain in IndexedDB and `sendData` sends only the saved sound
metadata when the app was opened from a keyboard button.

## Run

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run typecheck
npm run lint
npm run build
```

Microphone access requires HTTPS or localhost. Audio is stored locally in IndexedDB. Group and World publishing are intentionally disabled until a backend exists.

## Approved assets now integrated

The app uses the supplied immutable Tune Tots logo and approved Miley sheet. Production crops are stored locally and are not regenerated at runtime.

## Production assets still required

Replace the clearly marked placeholders with approved source files for:

- Nine FIELD FX objects
- Daily challenge photography, beginning with `daily-metallic.jpg`

Do not trace or regenerate these assets from the reference screenshots.
