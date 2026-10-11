// Supabase Edge Function «push» — рассылка web-push уведомлений.
//
// Два режима:
//   { kind: 'reminder', key: 'mon' | 'thu' | 'sun' } — плановое напоминание. Вызывает pg_cron
//      (supabase/cron.sql) с заголовком Authorization: Bearer <CRON_SECRET>.
//   { kind: 'broadcast', title, body } — ручная рассылка из модерации. Только для президента:
//      проверяем JWT пользователя и его роль в profiles.
//
// Секреты (npx supabase secrets set ...): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY Supabase подставляет сам.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const REMINDERS: Record<string, { title: string; body: (winner?: string) => string }> = {
  mon: {
    title: 'Новая неделя — новые желания! ✨',
    body: (winner) =>
      winner
        ? `Победило: «${winner}». Предлагай желание на эту неделю!`
        : 'Предлагай, что изменить в школе на этой неделе!',
  },
  thu: {
    title: 'Не забудь проголосовать 🗳️',
    body: () => 'Лайкай желания, которые нравятся. Голосование до воскресенья 23:59.',
  },
  sun: {
    title: 'Последний день голосования! ⏰',
    body: () => 'Сегодня в 23:59 выбираем желание недели. Успей проголосовать!',
  },
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
);

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

async function sendToAll(payload: { title: string; body: string }) {
  const { data: subs, error } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth');
  if (error) throw error;
  const message = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(
      subs.slice(i, i + 50).map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 86400 })
          .then(() => {
            sent++;
          })
          .catch((err: { statusCode?: number }) => {
            if (err.statusCode === 404 || err.statusCode === 410) dead.push(s.endpoint);
            else console.error('push error', err.statusCode);
          }),
      ),
    );
  }
  if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead);
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const body = await req.json().catch(() => ({}));
  const authHeader = req.headers.get('Authorization') ?? '';

  if (body.kind === 'reminder') {
    if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) return json({ error: 'unauthorized' }, 401);
    const reminder = REMINDERS[body.key];
    if (!reminder) return json({ error: 'unknown reminder' }, 400);

    await admin.rpc('maintain');
    const { data: week } = await admin.rpc('current_week');
    // Защита от повторной отправки, если cron сработает дважды.
    const { error: dup } = await admin.from('sent_reminders').insert({ key: `${week}:${body.key}` });
    if (dup) return json({ ok: true, sent: 0, skipped: 'already sent' });

    const prevWeek = new Date(`${week}T00:00:00Z`);
    prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
    const { data: winner } = await admin
      .from('winners')
      .select('text')
      .eq('week_id', prevWeek.toISOString().slice(0, 10))
      .maybeSingle();
    const sent = await sendToAll({ title: reminder.title, body: reminder.body(winner?.text) });
    return json({ ok: true, sent });
  }

  if (body.kind === 'broadcast') {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData.user) return json({ error: 'unauthorized' }, 401);
    const { data: profile } = await admin.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
    if (profile?.role !== 'president') return json({ error: 'Рассылку может делать только президент' }, 403);

    const title = String(body.title ?? '').trim().slice(0, 80);
    const text = String(body.body ?? '').trim().slice(0, 200);
    if (!title) return json({ error: 'Нужен заголовок' }, 400);
    const sent = await sendToAll({ title, body: text });
    await admin.from('mod_log').insert({ actor_id: userData.user.id, action: 'broadcast', details: title });
    return json({ ok: true, sent });
  }

  return json({ error: 'unknown kind' }, 400);
});
