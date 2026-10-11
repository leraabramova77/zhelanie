-- Расписание для Supabase (pg_cron + pg_net). Запускается после schema.sql и деплоя функции push.
-- Перед запуском замените {{PROJECT_URL}} (https://<ref>.supabase.co) и {{CRON_SECRET}}.
-- Время — UTC: 05:00 = 08:00 МСК, 13:00 = 16:00 МСК, 09:00 = 12:00 МСК.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobname) from cron.job where jobname like 'wish-%';

-- Итоги недели и очистка: понедельник 00:05 по Москве.
select cron.schedule('wish-maintain', '5 21 * * 0', 'select public.maintain()');

-- ИИ-модератор: триггер на новые желания зовёт функцию ai сразу, а cron добирает пропущенные каждые 10 минут.
update public.app_settings set ai_hook_url = '{{PROJECT_URL}}/functions/v1/ai', ai_hook_secret = '{{CRON_SECRET}}';

select cron.schedule('wish-ai-pending', '*/10 * * * *', $$
  select net.http_post(
    url := '{{PROJECT_URL}}/functions/v1/ai',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer {{CRON_SECRET}}"}'::jsonb,
    body := '{"pending": true}'::jsonb)
$$);

select cron.schedule('wish-remind-mon', '0 5 * * 1', $$
  select net.http_post(
    url := '{{PROJECT_URL}}/functions/v1/push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer {{CRON_SECRET}}"}'::jsonb,
    body := '{"kind": "reminder", "key": "mon"}'::jsonb)
$$);

select cron.schedule('wish-remind-thu', '0 13 * * 4', $$
  select net.http_post(
    url := '{{PROJECT_URL}}/functions/v1/push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer {{CRON_SECRET}}"}'::jsonb,
    body := '{"kind": "reminder", "key": "thu"}'::jsonb)
$$);

select cron.schedule('wish-remind-sun', '0 9 * * 0', $$
  select net.http_post(
    url := '{{PROJECT_URL}}/functions/v1/push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer {{CRON_SECRET}}"}'::jsonb,
    body := '{"kind": "reminder", "key": "sun"}'::jsonb)
$$);
