# FIELD — короткий план

## Зафиксированные решения

- Исходный код: GitHub, `tunetotslab/FIELD`.
- OpenAI/GPT-хранилище и GPT-серверы не используем.
- Публикация frontend: GitHub Pages → Telegram Mini App / PWA.
- Максимальная длина одной записи: 60 секунд.
- Локальная запись должна работать offline.
- Аудио: Cloudflare R2.
- Метаданные, авторизация и группы: backend/database.
- Три режима видимости: Private, Tune Tots Group, Field World.
- Field World: общий архив семплов с отображением на карте мира.
- Публичная геолокация: только город и страна, без точного GPS.
- Цель: web + Telegram Mini App + iOS + Android из общей кодовой базы.

## Порядок работ

1. ✅ Довести текущую web/Telegram-версию и поставить лимит 60 секунд.
2. ⚠️ Проверить запись, playback, waveform, FX, Library, Daily, Map и Settings на реальных телефонах.
3. ✅ Подключить базовый backend: Telegram-авторизация, D1 и права доступа.
4. ✅ Подключить приватный Cloudflare R2 для аудиофайлов.
5. 🚧 Реализовать Tune Tots Group с кодами и Telegram chat/topic binding — см. `FIELD_WORLD_GROUPS_PLAN_RU.md`.
6. 🚧 Довести Field World: upload/map/playback уже написаны; до публичного включения нужны retry и moderation.
7. Протестировать offline-запись, загрузку и приватность.
8. Упаковать общую кодовую базу через Capacitor в iOS и Android.
9. Провести TestFlight/Google Play testing и подготовить релиз.

Telegram-бот, меню, Telegram Stars, проверенная оплата и приватная статистика
владельца уже подключены. Production FIELD World пока намеренно выключен.

## Главное правило

Сначала рабочая запись и надёжное хранение, затем backend и Field World, после этого мобильные приложения и публикация.
