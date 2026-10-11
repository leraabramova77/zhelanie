# Установка и деплой

Все аккаунты — Леры (abramovavaleriia@gmail.com, GitHub `leraabramova77`).

## 1. Supabase

1. Создать проект на https://supabase.com (регион — Frankfurt / ближайший).
2. SQL Editor → выполнить [supabase/schema.sql](../supabase/schema.sql).
3. Назначить президента:
   ```sql
   update app_settings set president_logins = '{leraabramova77}';
   ```
4. Project Settings → API: взять **Project URL** и ключ **anon / publishable**.

## 2. Вход через GitHub

1. https://github.com/settings/applications/new
   - Homepage URL: `https://leraabramova77.github.io/help-project/`
   - Authorization callback URL: `https://<ref>.supabase.co/auth/v1/callback`
2. Скопировать **Client ID**, создать **Client secret**.
3. Supabase → Authentication → Sign In / Providers → GitHub: включить, вставить ID и secret.
4. Supabase → Authentication → URL Configuration:
   - Site URL: `https://leraabramova77.github.io/help-project/`
   - Redirect URLs: `https://leraabramova77.github.io/help-project/**`, `http://localhost:3000/**`

## 3. Уведомления

```bash
npx web-push generate-vapid-keys        # получить пару ключей
npx supabase login                      # или SUPABASE_ACCESS_TOKEN
npx supabase secrets set --project-ref <ref> VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:abramovavaleriia@gmail.com CRON_SECRET=<случайная строка>
npx supabase functions deploy push --project-ref <ref> --no-verify-jwt --use-api
```

Затем выполнить [supabase/cron.sql](../supabase/cron.sql), подставив `{{PROJECT_URL}}` и `{{CRON_SECRET}}`.

## 4. GitHub Pages

1. Репозиторий: https://github.com/leraabramova77/help-project
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Secrets and variables → Actions → **Variables**:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SCHOOL_NAME`.
4. Любой push в `main` запускает [.github/workflows/deploy.yml](../.github/workflows/deploy.yml):
   lint → typecheck → test:sql → build → deploy.
5. Сайт: https://leraabramova77.github.io/help-project/

## Локально

```bash
npm install
cp .env.example .env.local   # заполнить URL и anon key Supabase, VAPID public key
npm run dev                  # http://localhost:3000
npm run check                # линтер, типы, тесты SQL
```

Без `.env.local` сайт откроется, но покажет «Сайт ещё не подключён к базе». Тесты бизнес-логики
(`npm run test:sql`) работают без Supabase.

## Перенос на Vercel (позже)

Сайт статический — на Vercel достаточно импортировать репозиторий и задать те же `NEXT_PUBLIC_*` переменные
(без `NEXT_PUBLIC_BASE_PATH`). В Supabase добавить домен Vercel в Redirect URLs и Site URL.
