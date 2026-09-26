# FIELD by Tune Tots Lab

Mobile-first Telegram Mini App / installable PWA for recording, shaping and collecting field sound.

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
