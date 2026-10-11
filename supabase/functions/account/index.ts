// Supabase Edge Function «account» — аккаунты по логину и паролю (без почты и сторонних сервисов).
//
//   { action: 'register', name, login, password, code } — регистрация ученика по коду школы.
//      Публичная регистрация в Supabase выключена, поэтому создать аккаунт можно только здесь.
//   { action: 'reset_password', userId } — модератор/президент выдаёт ученику временный пароль.
//
// Внутри Supabase пользователь хранится с адресом <логин>@zhelanie.local — его никто не видит и писем туда нет.
import { createClient } from 'npm:@supabase/supabase-js@2';

const DOMAIN = 'zhelanie.local';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

function tempPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function register(body: Record<string, unknown>, ip: string) {
  const login = String(body.login ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim();
  const password = String(body.password ?? '');
  if (password.length < 6 || password.length > 72) return json({ error: 'Пароль: от 6 до 72 символов' }, 400);

  const { data: problem, error: checkError } = await admin.rpc('check_registration', {
    p_login: login,
    p_name: name,
    p_code: String(body.code ?? ''),
    p_ip: ip,
  });
  if (checkError) return json({ error: 'Не получилось проверить данные, попробуй позже' }, 500);
  if (problem) return json({ error: problem }, 400);

  const { data, error } = await admin.auth.admin.createUser({
    email: `${login}@${DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { user_name: login, full_name: name },
  });
  if (error || !data.user) {
    const taken = /already|exists|registered/i.test(error?.message ?? '');
    return json({ error: taken ? 'Такой логин уже занят — придумай другой' : 'Не получилось создать аккаунт' }, 400);
  }

  const { data: role, error: profileError } = await admin.rpc('create_profile', {
    p_id: data.user.id,
    p_name: name,
    p_login: login,
    p_ip: ip,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return json({ error: 'Такой логин уже занят — придумай другой' }, 400);
  }
  return json({ ok: true, role });
}

async function resetPassword(body: Record<string, unknown>, authHeader: string) {
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData.user) return json({ error: 'Войди в аккаунт' }, 401);

  const { data: me } = await admin.from('profiles').select('id, role').eq('id', userData.user.id).maybeSingle();
  const { data: target } = await admin
    .from('profiles')
    .select('id, name, role')
    .eq('id', String(body.userId ?? ''))
    .maybeSingle();
  if (!me || !target) return json({ error: 'Пользователь не найден' }, 404);
  if (me.id === target.id) return json({ error: 'Свой пароль меняй в меню «Пароль»' }, 400);

  // Временный пароль выдаёт только президент — ученикам и модераторам.
  const allowed = me.role === 'president' && target.role !== 'president';
  if (!allowed) return json({ error: 'Недостаточно прав' }, 403);

  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(target.id, { password });
  if (error) return json({ error: 'Не получилось сбросить пароль' }, 500);
  await admin.from('mod_log').insert({ actor_id: me.id, action: 'reset_password', details: target.name });
  return json({ ok: true, password });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const body = await req.json().catch(() => ({}));
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();

  if (body.action === 'register') return register(body, ip);
  if (body.action === 'reset_password') return resetPassword(body, req.headers.get('Authorization') ?? '');
  return json({ error: 'unknown action' }, 400);
});
