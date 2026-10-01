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

## Что блокирует публичный запуск

- production-флаг `FIELD_WORLD_ENABLED` ещё не включён;
- нет очереди повторной публикации после offline/network failure;
- нет жалоб и модерации публичных записей;
- Tune Tots Group пока не имеет модели данных, кода приглашения и Telegram binding;
- нет приёмочного теста со второго Telegram-аккаунта и реального телефона.

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

### Промпт 4 — acceptance и включение

> Выполни M4 из `FIELD_WORLD_GROUPS_PLAN_RU.md` только из GitHub-репозитория FIELD.
> Примени миграции, проверь Worker/R2/D1, затем проведи тесты с двумя Telegram-
> аккаунтами, отдельной группой и forum topic. Включай World только после успешных
> upload/playback/delete/report/offline-retry/privacy проверок. Зафиксируй точные
> результаты и ссылки на GitHub Actions.

## Не входит в первый запуск

- загрузка произвольных Telegram voice/audio сообщений обратно в FIELD;
- публичные профили, лайки, рейтинги и комментарии;
- точные GPS-координаты;
- облачная синхронизация Private Library.

