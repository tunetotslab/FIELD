# FIELD — iOS / Stage 6

Актуально: 2026-10-03. Владелец Никола Чен разрешил начать iOS; Google Play позже.
Исходники и сборки — только из GitHub `tunetotslab/FIELD`. Ветка `feat/ios-app`.

## Восстановленный контекст

- План развития FIELD: общая web/Telegram/iOS/Android кодовая база, Capacitor,
  запись offline, приватная Library, World, Tune Tots Group, затем магазины.
- Текущий backend: Cloudflare Worker + D1 + R2, а не ранняя идея Supabase.
- Telegram Mini App, бот, Stars, приватная статистика и группы уже существуют.
- Исправление 2318d77 и статус 5360d1d: владелец подтвердил позднюю публикацию
  совместимых записей после закрытия/открытия Library в World и закрытую Group.
  Самые ранние личные тестовые записи исключены из ремонта без удаления.
- Полная двухтелефонная проверка продолжится. Она не отменяет разрешение iOS.

## Что реализовано в исходниках

1. Настоящий проект iOS 15+ с Capacitor 8 / Swift Package Manager. Приложение
   FIELD, предварительный bundle ID `lab.tunetots.field`, существующая иконка.
   Интерфейс/FX/редактор/Daily/языки общие с текущим приложением. Shell в bundle,
   без удалённой загрузки страницы, Telegram SDK и service worker в native.
2. Аудио в защищённых файлах Application Support, метаданные в SQLite.
   Файлы с SHA-256, оригинал и render отдельно. Атомарная запись аудио перед
   SQLite commit; сбой не заменяет прежнюю запись. Чужие/общие файлы при удалении
   записи сохраняются. Массовое стирание native Library отключено.
3. Сессия в Keychain с защитой AfterFirstUnlockThisDeviceOnly. Никаких токенов
   в localStorage/UserDefaults, логах или Telegram deep link.
4. WAV export — системный выбор файла; share — системная панель iOS. Отмена
   не удаляет оригинал. Уход в фон останавливает запись с сохранением её байтов
   и прекращает playback. Запись в фоне не заявляется как поддерживаемая.
5. Standalone Telegram pairing: случайный proof только в приложении, публичный
   ID в ссылке на существующего бота, одинаковый шестизначный код, явное
   подтверждение в личном чате и затем выбранного аккаунта в приложении.
   Одноразовый exchange, hashed D1 session, срок 30 дней, server logout/revoke.
   ID и членство в Group те же, что у Telegram пользователя. World/Group запросы
   используют эту сессию. Автоповтор публикаций привязан к аккаунту владельца.
6. Additive migration 0007; native auth включается в Worker после применения migration и проверок.
   Web/Telegram signed initData авторизация и Stars не заменяются.
7. GitHub iOS workflow: все frontend/backend тесты, типы, текущая lint-проверка,
   реальная Swift SQLite/file проверка, Xcode simulator и unsigned iPhone builds.
   Итог workflow нужно проверять; наличие файла workflow не означает успеха.

## Что не переносится автоматически

Telegram/PWA и iOS — разные песочницы. Приватная библиотека в Telegram остаётся
там. Её удалять/очищать нельзя. Автоматический импорт старого IndexedDB в iOS
не реализован. Общий World и имеющиеся Group доступны через тот же backend после
входа. Нативная приватная библиотека переживает перезапуск, но удаление самого
приложения может удалить её файлы; экспортируйте важные WAV. iOS device backup
зависит от настроек пользователя, облачная синхронизация Library не обещается.
Content-addressed orphan files после отменённой/заменённой записи пока сохраняются:
автоматическая сборка мусора отложена, чтобы не удалять пользовательские байты.

## Порядок дальше и release gates

1. Проверить зелёный GitHub Xcode build, затем запустить на Simulator.
2. Поставить полный Xcode на Mac (сейчас установлены только Command Line Tools).
   Проверить микрофон/FX/фон/export/share/offline/relaunch на настоящем iPhone.
   На текущем Mac macOS 14.4.1: Xcode 26 требует минимум macOS 15.6, а
   используемый GitHub Xcode 26.6 — macOS 26.2+. ОС не обновляется агентом.
   Подписанную CI-сборку/TestFlight можно подготовить после Developer enrollment
   без локального обновления Mac; для локального Xcode нужен совместимый macOS.
3. Владелец: Apple Developer enrollment, затем App Store Connect, team/signing,
   регистрация окончательного bundle ID. Apple ID есть, membership пока нет.
   GitHub сборка без подписи не устанавливается на телефон и не является IPA.
4. Вход для App Store: проверить требование Apple 4.8 и реализовать эквивалентный
   вход Sign in with Apple; capability/Apple credentials пока не настроены.
   Telegram-only pairing — подготовка разработки, не декларация Store-ready.
5. Удаление backend аккаунта из приложения, отзыв сессий, ясный выбор сохранения
   локальной Library и удаление принадлежащих публикаций. Сейчас не реализовано.
6. UGC 1.2: жалобы/модерация уже существуют, пользовательская блокировка и
   фильтрация недопустимого контента ещё требуют реализации/проверки.
7. Подготовить публичные Privacy/Terms/Support URL и App Store privacy labels
   под фактические данные D1/R2/Telegram; privacy manifest есть, финальный аудит
   third-party manifests и Store declaration ещё открыт. Проверить возрастные
   ограничения и использование детьми, лицензии FX/assets/audio sharing.
8. Оплата/донаты: native Stars UI скрыт; бот/web сохраняются. Выбрать допустимый
   Apple маршрут поддержки перед включением платежей в iOS.
9. Подписанная сборка → TestFlight → исправления → screenshots/review metadata,
   описание прав и test account → App Store submission владельцем. Не отмечать
   этап выпущенным до действительной приёмки/публикации.
10. Android / Google Play после рабочей iOS и закрытия общих release gates.

## Проверки

- `npm test`, `npm run typecheck`, `npm run lint` (сейчас lint = TypeScript check),
  `npm run sync:ios`, `npm run test:ios-storage`.
- Native auth регрессии: секрет proof, чужой/групповой callback, замена аккаунта,
  replay/race, revoke, expiry, rate limit, same Group ACL, CORS, body limit,
  disabled flag, Stars остаются только Telegram.
- На iPhone: запись → FX → private Library → kill/relaunch → playback; экспорт
  и отмена; share и отмена; фон во время записи; offline save; login matching
  code → существующая Group; World upload → второй телефон → owner removal.

Официальные опоры: https://capacitorjs.com/docs/ios,
https://capacitorjs.com/docs/ios/spm,
https://developer.apple.com/app-store/review/guidelines/,
https://core.telegram.org/bots/features#deep-linking.


## Проверенный backend rollout / окружение

2026-10-03: additive migration 0007 применена к существующему production D1.
До/после: 15 sounds, 1 Group, 2 members, 24 donations — без изменений.
Подготовлена активация `NATIVE_AUTH_ENABLED=true` в GitHub ветке `feat/ios-app`;
результат фактического Worker deploy фиксируется отдельно после команды deploy.
Бот для pairing проверен: `@field_sound_bot`, FIELD by Tune Tots.

Xcode 26.6 в GitHub действительно скомпилировал Simulator и unsigned iPhone
приложение. Simulator проверяет React UI → Capacitor → реальные файлы/SQLite и
Keychain; для Simulator нужна ad-hoc подпись, она не требует Developer аккаунта.
Обычный git transport сначала обрывался HTTP 408; первые три коммита отправлены
официальным GitHub Git Database API с подтверждением идентичных SHA, следующие
обычным git push. Не создано другого репозитория или иной истории.


## Фактический статус выпуска — 2026-10-03

- [Draft PR #3](https://github.com/tunetotslab/FIELD/pull/3): iOS source в GitHub.
- [Зелёный GitHub iOS run 37066735439](https://github.com/tunetotslab/FIELD/actions/runs/37066735439),
  app-source commit `bc26e20`: все тесты/типы/current lint, реальные Swift/SQLite
  проверки, Simulator build, реальный Simulator UI→native audio/Keychain smoke,
  unsigned iPhone build и архив — success. Последующие изменения ec3bbe4 только
  backend flag, regression cleanup test и документация; iOS/React source идентичен.
- Migration 0007 применена. Пользовательские данные до/после сохранены:
  15 sounds, 1 Group, 2 members, 24 donations; native sessions пока 0.
- **Production Worker deploy НЕ выполнен.** Автоматический approval review
  отклонил обновление всего production Worker из feature branch без отдельного
  разрешения владельца на общий Telegram/World/Group/Stars backend. В чате
  запрошено именно это разрешение. Обхода проверки/альтернативного deploy нет.
- Read-only `wrangler deployments list` после отклонения подтвердил действующую
  версию `451978c8-64b4-4df7-a96a-1aefd01af72c` (2026-10-02 13:42 UTC), 100%.
  Native pairing остаётся недоступным в production до разрешённого Worker deploy.
  `NATIVE_AUTH_ENABLED=true` пока записано только в GitHub ветке iOS.
- Публичное имя существующего бота проверено: `@field_sound_bot`, FIELD by Tune Tots.
- На настоящем iPhone приложение ещё не установлено; микрофон/FX/background/
  export/share/offline/relaunch и публикация через настоящий native login —
  обязательные физические проверки после signing и backend rollout.
- Developer membership отсутствует. На текущем Mac macOS 14.4.1 нет полного
  Xcode. Xcode 26 требует macOS 15.6+, Xcode 26.6 — macOS 26.2+. Подписанную
  GitHub/TestFlight сборку можно подготовить после подключения Developer team
  и credentials; самостоятельное обновление macOS агентом не выполнялось.

Официальные требования окружения/аккаунта:
https://developer.apple.com/xcode/system-requirements,
https://developer.apple.com/programs/enroll/.
