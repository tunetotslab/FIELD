# FIELD World + Tune Tots Groups — план реализации

## Цель

Открыть реальную публикацию звуков в двух общих пространствах:

1. **FIELD World** — общая библиотека и глобус с городами, без точных координат.
2. **Tune Tots Group** — закрытые учебные группы по коду, связанные с отдельной
   Telegram-группой или конкретным topic внутри Telegram supergroup.

Приватная запись по-прежнему остаётся только на устройстве пользователя.

## Уже готово

- запись до 60 секунд, playback, waveform, FX и локальная Library;
- Telegram Mini App и рабочий бот;
- Cloudflare Worker, D1 и приватный R2 bucket;
- проверка подписи Telegram Mini App;
- черновой FIELD World API: upload, список, city-level геокодинг, R2 playback;
- интерактивный глобус и группировка маркеров по городу;
- GitHub Pages deployment из `main`;
- Telegram Stars и приватная статистика владельца.

## Статус Stage 5 — 2 октября 2026

Аудит: запись, бот, Stars, приватное R2 и учебные группы работали до этого этапа.
World был частичным: список последних 200, без сохранённых publication IDs,
retry, жалоб и модерации. Тестовая публикация в группу уже была подтверждена
пользователем; старые наборы сохраняют собственные коды и Telegram bindings.

Реализовано в Stage 5:

- строгий PCM WAV / реальный лимит 60 секунд, серверный city cache;
- явный поиск города по кнопке, общий лимит геокодера 1 запрос / 1,1 секунды;
- подтверждение публикации, durable foreground retry и idempotency;
- city markers с полным count, курсорные страницы по 20 записей;
- lazy playback, waveform/progress, остановка при закрытии города;
- жалобы и ручная модерация через приватного бота (`/reports`);
- owner-only unpublish с сохранением локального оригинала;
- действия Library: edit новой версией, поздняя публикация World/Group, Retry;
- цепочка до трёх FX, per-slot параметры/order/bypass, peak protection;
- локализация новых экранов EN/RU/HY/zh-TW.

Автотесты: настоящая SQLite-схема с адаптерами D1/R2, подписи двух тестовых
пользователей, 46 записей/пагинация, PCM/ACL/privacy/reports/moderation,
group upload/retry регрессия. Browser QA: реальные Web Audio render/decode,
FX-комбинации, IndexedDB reopen, offline intent и потеря ответа без дубля.
QA-fixtures изолированы и никогда не публикуются в production.

Не завершено: реальный приёмочный маршрут на двух Telegram-аккаунтах/телефонах
(пользователь проводит его), полный физический pinch/WebView QA и live
уведомление/решение через бота. Поэтому Stage 5 ещё не отмечен завершённым.
Архив/фильтр закрытых групп на карте отложен отдельно; upload в группы работает.
Поиск Nominatim впоследствии заменён каталогом GeoNames — см. аудит ниже.

## Что остаётся для публичного запуска

- нет приёмочного теста со второго Telegram-аккаунта и реального телефона.
World включается для контрольного теста пользователя после automated/browser QA.
Это не отметка о завершении Stage 5 и не подтверждение реального mobile acceptance.

### Публикация контрольной версии

- GitHub PR: https://github.com/tunetotslab/FIELD/pull/1 (merged).
- Код в `main`: `8f8c27c10f484cf03e7a42d4667ae0e76fe5c66d`.
- Pages build/deploy: https://github.com/tunetotslab/FIELD/actions/runs/36948668114 — success.
- D1 migration `0003_world.sql` применена до Worker deploy.
- Worker version: `8bcacbf5-a14b-4958-8a71-ea54dff08024`.
- Frontend и Worker World flags включены; live bundle содержит новый API и не содержит QA fixtures.
- Live health: 200; World без подписи: 401; неверный Origin/webhook без секрета: 403.
- Существующие 5 записей учебной группы и 1 Telegram binding сохранились.
- На момент проверки публичных World-записей и жалоб ещё нет: synthetic fixtures не загружались.
- Browser audio/storage QA: 162 проверки, включая offline reopen/retry и три FX-комбинации.
- Размеры 375/390/430/900: панель города без горизонтального переполнения.
- Реальная публикация, второй телефон и решение по жалобе через бота: ожидаются от пользователя.

## Продуктовый контракт Tune Tots Group

1. Владелец создаёт учебную группу и получает короткий код.
2. Участник вводит код в FIELD и становится участником этой группы.
3. Владелец добавляет FIELD-бота в Telegram-группу.
4. В нужной группе или topic владелец отправляет `/connect CODE`.
5. Бот проверяет, что отправитель — администратор Telegram-группы.
6. В FIELD пользователь выбирает `Tune Tots Group` и конкретную учебную группу.
7. WAV хранится в приватном R2, метаданные — в D1.
8. Бот отправляет запись в привязанную Telegram-группу/topic.
9. Только участники учебной группы могут видеть и слушать её архив в FIELD.

## Этапы

### M1 — backend групп

- D1: группы, участники, Telegram bindings, group sound delivery state;
- команды владельца `/newgroup`, `/groups`, `/connect`, `/disconnect`;
- join по коду;
- member-only upload/list/playback;
- доставка аудио в Telegram chat/topic.

### M2 — интерфейс групп

- экран моих групп и ввод кода;
- выбор конкретной группы при публикации;
- архив группы и playback;
- честные состояния upload/delivery/retry.

### M2.1 — жизнь записи после сохранения

- тап по карточке запускает Play/Pause;
- меню записи: редактировать, скачать WAV, системный Share, удалить;
- повторно открыть trim, emoji, title, style, location и FX;
- уже сохранённую Private-запись можно позднее отправить в FIELD World;
- уже сохранённую Private-запись можно позднее отправить в выбранную Tune Tots Group;
- прямой Download/Save в Chrome остаётся доступным независимо от Web Share API;
- статусы Local / Pending / Published / Failed + ручной Retry.

### M2.2 — цепочки эффектов

- от нуля до трёх FX в одной записи;
- изменение порядка, bypass и удаление каждого FX;
- отдельный mix/parameters для каждого слота;
- один и тот же chain для preview и render;
- финальный linked-channel limiter / peak protection;
- тесты комбинаций на feedback, clipping, loudness jump и низкочастотную «кашу»;
- оригинал и настройки цепочки всегда остаются доступными для повторного редактирования.

### M3 — FIELD World launch safety

- локальная очередь повторной загрузки;
- report endpoint и кнопка жалобы;
- скрытие записи владельцем/модератором;
- пагинация вместо жёстких последних 200;
- кэш city lookup и устойчивый geocoding provider.

### M4 — запуск

- применить D1 migrations из GitHub-версии проекта;
- проверить R2/D1 bindings и Worker secrets;
- тест двух аккаунтов: upload → globe/group → playback;
- тест Telegram group и forum topic;
- включить Worker `WORLD_ENABLED=true`;
- включить GitHub variable `FIELD_WORLD_ENABLED=true`;
- повторить mobile/privacy/offline QA.

## Рабочие промпты

### Промпт 1 — backend групп

> Реализуй M1 из `FIELD_WORLD_GROUPS_PLAN_RU.md`. Следуй `FIELD_SPEC.md`.
> Храни аудио только в приватном Cloudflare R2, метаданные и ACL в D1. Создание
> групп разрешено владельцу FIELD, вход — по отзываемому коду. `/connect CODE`
> должен работать в обычной Telegram-группе и в forum topic через
> `message_thread_id`, только после проверки прав администратора. Добавь миграцию,
> тесты авторизации и документацию deployment. Не включай production-флаги.

### Промпт 2 — интерфейс групп

> Реализуй M2 из `FIELD_WORLD_GROUPS_PLAN_RU.md`. Добавь в FIELD список моих
> Tune Tots Groups, join по коду, выбор группы в Share To, загрузку, архив и
> playback. Не выдавай локальное сохранение за успешную публикацию. Все строки —
> через i18n EN/RU/HY/zh-TW. Проверь 375/390/430 px и Telegram WebView.

### Промпт 3 — безопасный запуск World

> Реализуй M3 из `FIELD_WORLD_GROUPS_PLAN_RU.md`: durable retry queue в IndexedDB,
> report/moderation, owner delete, pagination и geocoder cache. Точная геолокация
> никогда не должна попадать в публичный API. Добавь unit/integration tests и
> обнови privacy/help copy. Production-флаги не включай до ручного acceptance.

### Промпт 3A — повторное редактирование и публикация

> Реализуй M2.1 из `FIELD_WORLD_GROUPS_PLAN_RU.md`. Любая карточка Library должна
> реально проигрываться и открывать действия Edit, Download WAV, Share, Publish
> to FIELD World, Publish to Tune Tots Group, Retry и Delete. Сохраняй canonical
> original и editable metadata; пользователь может решить опубликовать звук через
> дни после записи. В Chrome всегда оставляй прямое скачивание, даже если Web Share
> недоступен или открыл браузер без файлового действия. Не выдавай pending upload
> за публикацию.

### Промпт 3B — до трёх FX

> Реализуй M2.2 из `FIELD_WORLD_GROUPS_PLAN_RU.md`: ordered non-destructive chain
> максимум из трёх эффектов, per-slot mix/parameters/bypass, единый preview/render
> path и финальный linked-channel limiter. Сохраняй оригинал и весь chain для
> повторного редактирования. Добавь DSP-тесты сложных комбинаций, rapid switching,
> clipping, feedback, DC/low-frequency overload и loudness jumps.

### Промпт 4 — acceptance и включение

> Выполни M4 из `FIELD_WORLD_GROUPS_PLAN_RU.md` только из GitHub-репозитория FIELD.
> Примени миграции, проверь Worker/R2/D1, затем проведи тесты с двумя Telegram-
> аккаунтами, отдельной группой и forum topic. Включай World только после успешных
> upload/playback/delete/report/offline-retry/privacy проверок. Зафиксируй точные
> результаты и ссылки на GitHub Actions.

## Не входит в первый запуск

- загрузка произвольных Telegram voice/audio сообщений обратно в FIELD;
- публичные профили, рейтинги и комментарии;
- точные GPS-координаты;
- облачная синхронизация Private Library.

## Дополнение по обратной связи — октябрь 2026

- World открывается без автоматической карточки записи.
- Старые записи публикуются без удаления: восстановление города и нормализация публичной WAV-копии по фактической длительности.
- Скачать WAV с глобуса, в том числе через Telegram downloadFile и прямую ссылку в браузере.
- Общий счётчик лайков: один аккаунт — один обратимый лайк, без рейтинга.
- Публичные World-записи автоматически дублируются в @Fieldapp; закрытые учебные группы и Private исключены.
- Решение по жалобе отправляется лично автору жалобы; очередь видит только администратор.
- Перекрытие кнопок подтверждения и автоматическое увеличение полей ввода исправляются; мобильную клавиатуру проверяем отдельно на реальном телефоне.
- После выпуска повторить на телефоне: старая запись → World/Group; World → скачать; два аккаунта → общий лайк; жалоба → ответ; сообщение WAV в @Fieldapp.

### Результат выпуска 2026-10-02

- GitHub PR: https://github.com/tunetotslab/FIELD/pull/2 (merged).
- Код выпуска: `56f4bf4`; GitHub Actions: https://github.com/tunetotslab/FIELD/actions/runs/36953138978 — success.
- Worker: `b4402e4b-9821-4db0-9d3f-090a9e8bde7a`; миграции 0004/0005 применены без удаления прежних данных.
- Реальное подтверждение Telegram: обе прежние публичные World-записи имеют `delivered`, ошибок нет. Это именно ответ Bot API, не имитация UI.
- Фоновые повторы каждые пять минут; личная команда владельца `/worldsync` запускает пакет сразу и показывает статусы. Неопределённую отправку не повторяем вслепую.
- `typecheck`, серверные/DSP регрессии и production build прошли. Dev-only браузерная проверка аудио/IndexedDB/старой длительности/60-секундной копии: 166 assertions. Подтверждение проверено в отдельных рамках 375/390/430/900 px; World открывается без автоматического диалога, кнопки скачивания/лайка доступны.
- Проверены подписанные WAV-ticket, срок действия, запрет скачивания скрытой/закрытой записи, дедупликация лайков, приватность ответов и восстановление очереди. Автоматический браузерный перехват события скачивания в текущем инструменте завершился таймаутом: сохранение в «Файлы» реального телефона не объявляем проверенным.
- Ручной acceptance на телефоне по списку выше остаётся необходимым, особенно клавиатура Telegram и старые файлы конкретного пользователя. Личные сообщения заявителю требуют доступного/запущенного бота.

### Аудит и стабилизация 2026-10-02 (после `2001916`)

- Восстановлена чистая `main` и сверена с GitHub; предыдущие исправления WAV,
  legacy city resolve, глобальной пагинации, Telegram mirror и ACL сохранены.
- Read-only production: 7 записей — 2 публичные World (Батуми/Дилиджан), 5 учебной
  группы, 1 группа и 1 binding. Оба World WAV существуют в R2; их реальные
  длительности совпадают с D1 (5.60227s / 2.04908s); обе mirror-доставки delivered.
- Подтверждённые дефекты кода: city/country-only legacy location пропускала выбор
  canonical city; общий geocoder lease блокировал запрос другого телефона;
  mounted World не обновлялся после фона; Daily пересчитывался только при входе.
  На текущих данных не подтверждено удаление backend-городов или потеря R2.
- Добавлены read-through нормализация Library v1 и безопасный save без удаления
  raw/audio/unknown fields. Старая запись не получает выдуманный original или
  published state. World/Group используют прежний единый WAV preparation.
- По просьбе владельца: prefix-подсказки с 2 символов, debounce 450ms, выбранная
  страна, латиница/кириллица/азиатские aliases, RU/EN/native labels из GeoNames.
  Пхукет найден по `Пх`, `Phu`, `ภู`; отсутствующий перевод заменяется английским.
  Существующие OSM city IDs сохраняются при однозначном alias + nearby match.
- Удалён прежний Nominatim request/lease path. Новая directory source of truth
  находится в этом GitHub repo; опубликованные звуки остаются в прежних D1/R2.
- World GET no-store; foreground/focus/online revalidation и защита от cancelled
  city responses. Daily проверяет local date при входе/foreground/каждые 30s на
  видимом Daily. SW v7 revalidates HTML; IndexedDB/localStorage не очищаются.
- Новые регрессии: old/current client payload для обоих destinations, missing
  audio, честное publication state, lifecycle/rollover/listener cleanup, реальные
  многоязычные GeoNames prefixes, общий World count для разных пользователей.
  Реальные старые файлы с телефонов и Telegram WebView acceptance ещё требуют
  физической проверки. Подпись Mini App по-прежнему истекает через час — reopen
  обновляет сессию; обход авторизации не добавлялся.
- Дополнительная проверка сохранения: metadata-only публикация legacy render
  больше не выдумывает `originalBlob`/`editState`. Ошибки 401 при поиске,
  World/list/playback и Group показывают локализованную инструкцию обновить
  Telegram-сессию; offline/lookup ошибки остаются отдельными.
- Legacy city resolve сравнивает доступные названия на разных языках, а не только
  переведённый display label. Повтор публикации проверяет R2 object через head;
  существующая D1 row без WAV не выдаётся за успех и не удаляется.
- Проверки текущего исправления: `typecheck`, `lint` (TypeScript), `npm test`,
  production build с `/FIELD/` — pass; браузерный Web Audio/isolated IndexedDB QA
  — 169 assertions. Предупреждение о размере JS bundle существовало до этого
  этапа; каталог городов не входит в JS bundle.
- Выпущенный код: `5f77fd1` (включает `a2efed5`, `3aa48d6`, `cdb16fe`).
  GitHub Pages Actions: https://github.com/tunetotslab/FIELD/actions/runs/37000243046
  — success. Worker: `bb57837f-3ec0-44b5-b357-d63135d6259f`; health 200.
  Миграций D1, удаления данных и изменения секретов в этом выпуске нет.
- Проверка поиска на опубликованном каталоге сохраняет прежние OSM IDs Батуми
  и Дилиджана; три написания Пхукета возвращают `geonames:1151254`.
  Это проверка каталога и resolver; реальная публикация двух Telegram-аккаунтов
  и воспроизведение их старых файлов остаются мобильным acceptance.

### Повторная обратная связь: iPhone 12 mini / XR

- Пользователь сообщил об общей ошибке старой публикации, зависании записи,
  повторении вчерашней картинки и наложении кнопки на маскота при первом входе.
- Подтверждена зависимость World/Group от AbortSignal.any/timeout, отсутствующих
  в прежних Safari. Клиент проверен без обоих методов: публикации проходят;
  собственный AbortController сохраняет timeout и cancellation.
- Старые карточки с отсутствующими emoji/названием проходят нужный metadata шаг,
  а не получают серверный Invalid sound. Исходные аудиофайлы не удаляются.
- Recorder восстанавливает полученные chunks при пропущенном onstop; decode
  ограничен 15s, может повторить те же байты. Stale callbacks после выхода
  игнорируются. Это покрыто регрессиями; конкретное зависание на iOS ещё требует
  проверки на устройстве пользователя.
- Home резервирует размер approved artwork до загрузки изображения; в браузере
  проверено первое открытие без пересечения маскота и кнопки. Реальный холодный
  запуск Telegram на обоих iPhone остаётся частью acceptance.
- Причина картинки: исходные 80 задач были сгруппированы по четыре на одну
  иллюстрацию. Daily порядок теперь чередует 20 artwork; тест 160 соседних дней
  проверяет смену картинки, включая границы цикла. Новые картинки не создавались.
- Информационные ссылки: О FIELD → Ссылки → Приватность → Помощь → Микрофон.
  About/Privacy/Help актуализированы на четырёх языках; удалены повторы и описание
  неподключённого World/Nominatim. Donations и содержимое Microphone сохранены.

### Повторный отказ сохранённых публикаций — iPhone 12 mini

- Пользователь подтвердил, что сохранённые записи разных поколений, включая
  новые геотеги, по-прежнему не отправляются ни в World, ни в Group.
- Воспроизведён общий серверный дефект: корректный multipart без Content-Length
  получал 413 до чтения аудио. Прежний integration helper всегда добавлял этот
  заголовок и скрывал отказ. Сам конкретный запрос с телефона не перехватывался;
  окончательное подтверждение требуется на той же записи пользователя.
- World/Group теперь используют общий bounded reader: проверяют фактические
  байты, отменяют поток выше 25 MB, отдельно сохраняют лимит audio 24 MB и 60s.
  Без заголовка проходят публикация, R2 playback, Group и idempotent retry;
  отсутствующий/заниженный размер не позволяет обойти лимит. Никаких D1 migrations
  или изменений/удалений пользовательских аудиофайлов нет.
- Ошибка публикации различает подготовку аудио, сеть, HTTP size/rate limits,
  город, metadata, доступ и сессию. HTTP-код виден для следующей диагностики;
  неизвестный отказ сервера больше не выдаётся за необходимость выйти онлайн.
- About расширен на четырёх языках по описанию владельца: обучение электронной
  музыке с нуля, своё творчество, зарисовки для треков, открытый World и закрытая
  учебная Group. Имена автора/лаборатории — inline Instagram links.
- Shell добавляет одну общую подпись с отступом 28px после содержимого каждой
  страницы. Email прямо в «Связаться»: selectable address, Copy, default mail app,
  Gmail. Браузерная проверка подтвердила «Адрес скопирован», один footer/email block
  и корректные author/studio href; письмо не отправлялось.
- Полный npm test, typecheck, lint и production build проходят. Новая regression
  сначала упала 413 вместо 201 на прежнем сервере, затем прошла с bounded reader.
- Выпуск: сервер `e65bbc8`, клиент `7033baf`; Pages Actions
  https://github.com/tunetotslab/FIELD/actions/runs/37005431414 — success.
  Worker `bc85632f-c616-46a1-812e-d83454f6888b`, health 200; World без сессии
  с разрешённым Origin — 401. Live JS содержит новые сообщения, About и Copy email.
  Ручной acceptance: на одном iPhone 12 mini повторить ту же сохранённую запись
  в World и Group; при отказе сообщить новый точный текст/HTTP-код. Второй телефон
  сейчас недоступен, его отсутствие не препятствует этой проверке.

### Мгновенный отказ и неработающие действия результата — повторная диагностика

- На iPhone 12 mini пользователь всё ещё получает мгновенный общий отказ; сам
  проблемный файл и запрос телефона недоступны. Поэтому прежний выпуск не считается
  подтверждённым исправлением именно этого случая. Добавлены безопасные коды
  AUDIO_MISSING/WAV/DECODE/CONVERT, CITY_RESOLVE, WORLD_UPLOAD, GROUP_UPLOAD,
  NETWORK/TIMEOUT и LOCAL с именем ошибки; HTTP-коды сохраняются. Неизвестная
  локальная ошибка больше не маскируется сообщением о подключении.
- Подтверждён клиентский дефект: любые изменения метаданных сбрасывали processed
  render. Теперь название, emoji, город, destination и стиль сохраняют готовый
  файл, а изменения Trim/FX создают новую версию и инвалидируют render. После
  отказа upload готовый локальный файл остаётся доступен для preview/export.
- Сохранённый PCM WAV разбирается непосредственно: пересобирается стандартный
  заголовок, duration вычисляется по samples, публичная копия ограничивается 60s
  с fade на конце. Original и сохранённый render не перезаписываются. Нет Web Audio
  context/AudioBuffer constructor для этого пути; fallback других форматов также
  больше не создаёт новый AudioBuffer. Реальные World/Group client payloads
  проверены без Web Audio constructors и с недоступным localStorage.
- Ready заранее готовит файл и кеширует результат для Save/Export/Share. Native
  share вызывается непосредственно из click, до await. Прежний Send to Chat
  передавал только metadata через sendData, а не аудио; теперь Share WAV передаёт
  сам File через системное меню, где пользователь выбирает Telegram. Без поддержки
  native file share используется download. Это не серверная публикация private
  Library. Поддержку меню конкретной версией Telegram iOS подтверждает устройство.
- Network deadline теперь включает чтение body; regression воспроизводит
  зависший response после полученных headers и проверяет WORLD_UPLOAD:TIMEOUT.
- Дополнительно обнаружена обязательная crypto.randomUUID в создании draft и
  World clientId: её отсутствие прерывало путь до HTTP. Добавлен secure UUID v4
  fallback через getRandomValues. Тест настоящего upload queue без randomUUID
  проверяет failure/retry, неизменные bytes и тот же clientId. Версия iOS телефона
  неизвестна; это воспроизводимый compatibility дефект, не доказательство причины
  конкретного запроса владельца.
- Обычный браузер не имеет подписанной Telegram session. World показывает
  понятное объяснение сразу; доступ к API не ослаблен. Production preflight
  разрешает POST/Authorization/Content-Type с GitHub Pages Origin (204).
- Имя владельца: Никола Чен (Nikola Chen), «создан Николой Ченом»; один основатель
  и преподаватель, без выдуманных других преподавателей. Закреплено в AGENTS/SPEC,
  исправлено в четырёх About локалях. Instagram ссылки сохранены, фраза поддержки
  открывает существующий Donate. Copy/Write/Gmail имеют одинаковые розовые controls
  44px/999px; Write открывает выбор Gmail в браузере/default mail/copy fallback.
- Браузерная QA: Ready экспортирует 384044 bytes из saved render при имитации
  отказа/busy и отсутствующем original; новый trimmed render — 307244 bytes.
  Проверены mail chooser, одинаковые computed styles, donate navigation, отсутствие
  сессии и карта с 21 звуком в изолированном fixture. Ничего не опубликовано в
  production World/Group, письма/донаты не отправлялись; Library не очищалась.
- Физический acceptance остаётся открытым: та же старая запись в World и Group,
  Export/Share на iPhone 12 mini; при отказе нужен видимый код в квадратных скобках.
  Когда второй телефон доступен — город и воспроизведение после обновления World.
- Проверки этого выпуска: полный npm test, typecheck, lint, production build;
  после UUID follow-up повторены compatibility tests/typecheck/lint/build, затем
  GitHub Actions заново выполнил весь npm test и сборку — success.
- Выпущен `06a2905`: Pages Actions
  https://github.com/tunetotslab/FIELD/actions/runs/37009266380 — success.
  Live bundle `/FIELD/assets/index-wc7U9hjq.js` содержит 11 проверенных маркеров
  новых upload stages, secure ID fallback, Share WAV, авторского имени, donation
  и session/contact текста. Worker/D1/R2 и их данные в этом follow-up не менялись;
  рабочий Worker остаётся `bc85632f-c616-46a1-812e-d83454f6888b`.


### Новый путь после LOCAL:UnknownError — 2 октября 2026

- Пользователь подтвердил: проблемная старая запись проигрывается, но World/Group
  отказывают мгновенно с `LOCAL:UnknownError`, Export/Share молчат. Второй iPhone
  уже видит чужие World записи. Production read-only D1: 4 World, 6 Group; все 6
  Group доставки отмечены delivered. Это не доказывает успешность проблемного файла.
- Воспроизведён отказ IndexedDB put с Blob (WebKit class of failure). Реальный
  repository теперь сохраняет байты ArrayBuffer вместо временных Blob handles.
  Старые строки читаются без изменения; явное сохранение переносит render/original
  и все edit/publication/unknown поля. Проверены byte equality и сохранность строки
  при ошибке quota. Журнал iPhone недоступен, поэтому причина именно его внутреннего
  WebKit сбоя не объявляется подтверждённой.
- Export/Share получили другой путь для Telegram: по явному нажатию полный WAV
  отправляется в личный чат пользователя с FIELD-ботом; Share вызывает native
  shareMessage с cached document. Получатель определяется только signed initData.
  Рядом с кнопками указано, куда передаётся файл. На World/в группу этот export
  ничего не публикует, в R2 его не сохраняет; D1 хранит только delivery receipt.
  Повторное действие использует прежний transfer ID; uncertain не рассылается вновь.
  Браузер сохраняет прежнее системное Share/download. Это заменяет неподтверждённый
  Web Share/blob-anchor путь предыдущего Telegram выпуска.
- Исправлен finally Library retry: ошибка обновления списка больше не оставляет
  действия навсегда заблокированными. Export/Share независимы от failed publication.
- Регрессии используют реальный storage/client/Worker, isolated IndexedDB и SQLite;
  Telegram замокан. Проверены auth/origin, payload bytes, private recipient,
  full 61-second export, public 60-second cap, concurrency/idempotency,
  explicit rejection/manual retry, ambiguous no-resend, rate limits и migration.
- Физическая проверка ещё нужна: именно эта старая запись → World и Group;
  Export → WAV в личном FIELD bot чате; Share → выбор чата/пересылка того же WAV.
  Новая World запись должна воспроизводиться на втором телефоне после обновления.
- Полный `npm test`, typecheck, lint и production build прошли. Браузерная QA
  завершила 169 assertions: все FX/dry bypass, цепочки, trim, offline queue,
  реальный IndexedDB save/reopen/rename/favorite и сохранность аудио при unpublish.
  Использована только изолированная тестовая база; пользовательская Library не
  открывалась, production Telegram сообщения не отправлялись.
- Выпущен код `2318d77`: GitHub Pages run
  https://github.com/tunetotslab/FIELD/actions/runs/37014649843 — success
  (полный Verify + Build + Deploy). Live `/FIELD/assets/index-5ea5glnQ.js`
  содержит все 10 проверенных маркеров byte storage/file relay/native sharing.
- После push применена только additive `0006_private_file_transfers.sql`, затем
  Worker `451978c8-64b4-4df7-a96a-1aefd01af72c`. Health — 200; unsigned private
  file POST — 401; Pages Origin preflight — 204/no-store. Python urllib probe
  отвергнут edge 1010; стандартный curl достигает Worker, поэтому не принимаем
  этот probe за отказ самого API или доказательство проблемы телефона.
- Read-only D1 после выпуска: World 4 / Group 6, все Group delivered, private
  transfer receipts 0. Production аудио/тестовые сообщения не загружались.
- Ready fixture при simulated failed/busy публикации сохраняет Export/Share
  доступными и экспортирует 384044 bytes. Проблемный iPhone файл физически ещё
  не проверен. Обновление Mini App через закрыть/открыть, без очистки данных.


### Приёмка владельцем после выпуска 2318d77

Пользователь подтвердил реальный сценарий на телефоне: записать звук → сохранить
в личную Library → закрыть FIELD → открыть заново → опубликовать сохранённую
запись в World и отправить её в закрытую Tune Tots Group. Оба направления работают.
Публикация новых и ранее сохранённых совместимых записей подтверждена владельцем.
Этот сценарий больше не считаем открытым блокером текущего ремонта.

Несколько самых ранних личных тестовых записей владельца по-прежнему не
публикуются. По явному решению владельца дальнейший ремонт именно этих тестовых
записей прекращён. Причина их неисправности не доказана; повреждение аудио не
объявляется установленным фактом. Записи не удалять и storage не очищать.
Это исключение не распространяется на все исторические записи или на будущие
отказы публикации других пользователей; централизованная совместимость сохранена.

Проверка других телефонов ещё предстоит. Последний отзыв не подтверждает отдельно
Export/Share, прямую публикацию сразу из новой записи, полный two-account маршрут
World → playback → report → owner removal, offline recovery и Daily midnight.
Поэтому закрыт подтверждённый single-phone сценарий Library → World/Group, а не
вся мобильная приёмка Stage 5.

Следующий предлагаемый этап: завершить компактную приёмку уже существующих
функций на двух аккаунтах/телефонах и провести небольшую учебную сессию Tune Tots
Lab с реальными звуковыми зарисовками. Собирать конкретные наблюдения о записи,
Trim/FX, сохранении WAV и обмене через Group. Новые функции и Capacitor/iOS/Android
на этом шаге не начинать. Приложение и production данные этим обновлением статуса
не меняются.


### Safari/PWA — текущий приоритет, 3 октября 2026

Владелец отложил платный Apple Developer/App Store и попросил довести веб-версию:
сохранение новых записей после закрытия Safari, общий World и доступ к тем же
Tune Tots Groups. Перенос старой личной Telegram Library не нужен. iOS-код остаётся
в отдельном PR #3; текущая ветка основана на main и не содержит Capacitor.

Причины различий: World был намеренно закрыт вне подписанного Telegram WebView;
SDK присутствует в Safari, но не даёт signed initData. Исправление добавляет
подтверждённый вход через личный FIELD-бот и общий backend/Telegram ID. Локальные
библиотеки разных browser/PWA/WebView остаются отдельными. IndexedDB byte codec и
commit-before-success сохранены; Library перечитывается при входе/возврате, браузер
получает best-effort запрос защиты от вытеснения. Меню использует одну измеренную
высоту viewport для всех экранов; почтовые кнопки — общий основной стиль, переходы
в FIELD/Donate — настоящие Telegram-ссылки.

Проверки: существующие audio/legacy/World/Group/bot/Stars регрессии плюс browser
pairing, account restore/401/expiry/logout с сохранностью WAV. Отдельный WebKit CI
проверяет production build, размеры/ориентацию, вход и закрытие/открытие вкладки.
Это не подтверждение поведения микрофона на физическом iPhone.

Статус выпуска: подготовлен код на GitHub, production Worker/Pages ещё не обновлены.
Предыдущая автоматическая проверка отклонила общий Worker deploy из-за отсутствия
явного согласия на обновление общего Telegram/World/Group/Stars backend. Выпуск
остаётся отдельным финальным шагом после проверок и явного согласия владельца.


### Продолжение Safari проверки — 4 октября 2026

Письма об отказе относятся к коммиту 8549958: WebKit не прошёл cross-origin
проверку входа в тесте, использовавшем перехват API-запросов. Тестовый API теперь
изолирован на localhost HTTP и возвращает реальную CORS-политику Worker; production
не используется для тестовых публикаций. Повторная CI проверка обязательна.

Причина различий почтовых кнопок: `.article-links a` затрагивал вложенные Gmail/
mailto controls, `.information-article a` задавал цвет текста статьи, а размер
шрифта зависел от родительского блока. Селекторы ограничены ссылками статьи/верхнего
уровня, основной шрифт кнопки задан явно; почтовые действия используют одинаковые
полноширинные pill-кнопки. Браузерная регрессия сравнивает каждую из пяти кнопок
в «О FIELD», «Помощи» и «Ссылках» с реальной кнопкой Daily: цвет, белый текст,
семейство/размер/вес шрифта, padding, line-height, radius и высоту.

Вторая ошибка CI (`a74a0b7`) возникла уже после успешного входа и загрузки World:
активный service worker запрашивал тестовый storage-модуль в обход Playwright
route, получая SPA HTML вместо JavaScript. Все production assets и явные fixture
modules теперь обслуживаются настоящим локальным HTTP-сервером. Service worker
остаётся включённым; проверяется также offline reload с сохранной Library.
Chrome прошёл полный сценарий; результат Linux WebKit ещё требуется подтвердить.
