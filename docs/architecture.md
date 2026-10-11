# Архитектура

## Стек

| Часть | Что | Зачем |
|---|---|---|
| Фронтенд | Next.js 16 (App Router, `output: 'export'`), React 19, TypeScript | Статическая сборка под GitHub Pages |
| Данные | TanStack Query 5 | Кэш, рефетч каждые 30 с, оптимистичные голоса |
| Состояние UI | Zustand 5 | Сессия, тосты, сортировка, открытые панели, вкладки модерации |
| Бэкенд | Supabase: Postgres + Auth + Edge Functions + pg_cron | Без своего сервера, бесплатно |
| Вход | Supabase Auth: логин + пароль, регистрация через Edge Function `account` | Без почты и сторонних аккаунтов |
| Уведомления | Web Push (VAPID) через Edge Function `push` | |
| ИИ-модератор | OpenRouter (`dots-studio/dots-3-note-preview:free`) через Edge Function `ai` + триггер pg_net | Проверка и оценка желаний |
| Линтер и форматтер | Biome 2 | Одна утилита вместо ESLint + Prettier |
| Тесты логики | PGlite (Postgres в WASM) + `scripts/test-schema.mjs` | Проверка SQL без Supabase |
| CI/CD | GitHub Actions → GitHub Pages | lint → typecheck → test:sql → build → deploy |

## Feature-Sliced Design

Весь код — в `src/`, слои сверху вниз; импортировать можно только из нижних слоёв и только через `index.ts` слайса.

```
src/
  app/          # слой app + маршруты Next.js (только файлы *.next.tsx), провайдеры, глобальные стили
  pages/        # страницы: home, moderation
  widgets/      # hero, winner-card, wish-list, winners-history, moderation-panel
  features/     # auth, propose-wish, vote-wish, report-wish, delete-wish, push-notifications,
                # restore-wish, banned-words, manage-user, broadcast
  entities/     # session, user (роли), wish (желание, доска), moderation (данные модерации)
  shared/       # api (supabase, query-client), config (env), lib (форматирование), ui (тосты, иконки)
```

Почему маршруты — `*.next.tsx`: Next.js считает папку `src/pages` старым Pages Router. В `next.config.ts` задано
`pageExtensions: ['next.tsx', 'next.ts']`, поэтому роутер видит только `src/app/**/page.next.tsx` и
`layout.next.tsx`, а слой FSD `src/pages` остаётся обычным кодом. Корневых `app/` и `pages/` нет.

## База данных

Схема — [supabase/schema.sql](../supabase/schema.sql), идемпотентная (можно запускать повторно).

| Таблица | Что хранит |
|---|---|
| `app_settings` | Настройки: часовой пояс, лимиты, порог жалоб, дни до очистки, логины президента |
| `profiles` | Пользователь: имя, логин, роль, блокировка |
| `signup_log` | IP регистраций за сутки (ограничение частоты) |
| `posts` | Желание: неделя, текст, автор, `hidden`, `reviewed` |
| `votes` | Голос: желание, пользователь, ±1 |
| `reports` | Жалоба: желание, пользователь, причина |
| `winners` | Победители прошлых недель |
| `banned_words` | Запретные слова (нормализованные) |
| `mod_log` | Журнал модерации |
| `push_subscriptions` | Подписки браузеров на push |
| `sent_reminders` | Какие напоминания уже отправлены |

### Безопасность

- На всех таблицах включён RLS **без политик** и отозваны права `anon`/`authenticated` — из браузера таблицы
  недоступны напрямую.
- Браузер вызывает только функции (`supabase.rpc`), объявленные `security definer`. Каждая сама проверяет
  `auth.uid()`, роль и блокировку. Права на вызов функций выданы явно: гостям — только `get_board` и подписка
  на push; вошедшим — действия ученика и модерации (проверка роли внутри).
- Публичный ключ Supabase (`anon`) можно хранить в коде сайта — без функций он ничего не даёт.
- Секреты (VAPID private, CRON_SECRET, service role) живут только в секретах Supabase.

### Функции (API)

| Функция | Кто | Что делает |
|---|---|---|
| `get_board()` | все | Всё для главной одним запросом; заодно `maintain()` и синхронизация профиля |
| `create_post(text)` | ученик | Проверки длины, ссылок, слов, лимита, дубликатов |
| `vote(post, value)` | ученик | Голос −1/0/1, возвращает новые счётчики |
| `report_post(post, reason)` | ученик | Жалоба, скрытие по порогу |
| `delete_post(post, reason)` | автор / модератор | Своё — без причины; чужое — модератор, в журнал |
| `restore_post(post)` | модератор | Оставить после жалоб |
| `add_banned_word` / `remove_banned_word` | модератор | Список слов |
| `search_users(query)` | модератор | Поиск людей |
| `set_banned(user, bool)` | модератор | Блокировка ученика |
| `set_role(user, role)` | президент | Назначить / снять модератора |
| `set_school_code(code)` | президент | Код школы для регистрации |
| `check_registration` / `create_profile` | Edge Function | Проверки и создание профиля при регистрации |
| `mod_overview()` | модератор | Очередь, желания недели, слова, журнал, число подписчиков |
| `save_push_subscription` / `remove_push_subscription` | все | Подписка на push |
| `maintain()` | cron | Победитель и очистка |
| `ai_apply` / `ai_failed` | Edge Function `ai` | Решение ИИ: оставить с оценкой или удалить полностью (с записью в журнал) |

### Фоновые задачи

[supabase/cron.sql](../supabase/cron.sql): pg_cron вызывает `maintain()` в понедельник 00:05 МСК и Edge Function
`push` с напоминаниями (пн 08:00, чт 16:00, вс 12:00 МСК).

## Проверки качества

```bash
npm run lint       # Biome
npm run typecheck  # TypeScript
npm run test:sql   # 32 сценария бизнес-логики на PGlite
npm run check      # всё вместе
```
