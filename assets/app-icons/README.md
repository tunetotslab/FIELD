# FIELD application icon

`field-app-icon-master.png` is the canonical application icon supplied by Tune Tots Lab. It must remain the source for all FIELD application-icon exports.

The committed exports are deterministic resizes of that master image; the artwork itself is not regenerated or redrawn.

## Included exports

- `ios/AppIcon.appiconset/`: complete iPhone, iPad, and App Store icon set for a future native iOS target.
- `android/google-play-512.png`: Google Play listing icon.
- `android/mipmap-*/ic_launcher.png` and `ic_launcher_round.png`: density-specific Android launcher icons for a future native Android target.
- `telegram/telegram-app-icon-512.png` and `telegram-app-icon-640.png`: square icons ready for upload in Telegram/BotFather.
- `public/icons/`: browser, Apple touch, PWA, and maskable PWA icons used by the web application.

The repository currently contains the FIELD web/PWA application and does not contain native iOS or Android projects. Store and Telegram exports are therefore kept here as upload-ready source assets until those native targets or external listings are configured.
