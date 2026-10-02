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
Массовый запуск требует оценки нагрузки геокодера и замены провайдера при росте.

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
