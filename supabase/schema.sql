-- «Желание недели» — схема базы для Supabase.
--
-- Сайт статический (GitHub Pages / Vercel), своего сервера нет. Поэтому вся логика живёт здесь:
-- таблицы закрыты RLS без политик, и браузер с публичным ключом может работать с данными
-- только через функции ниже (security definer), которые сами проверяют вход и права.
--
-- Скрипт идемпотентный: его можно запускать повторно после правок.

-- ---------- Настройки ----------

create table if not exists app_settings (
  id boolean primary key default true check (id),
  time_zone text not null default 'Europe/Moscow',
  max_posts_per_week int not null default 1,     -- сколько желаний ученик может предложить за неделю
  report_hide_threshold int not null default 3,  -- после стольких жалоб желание скрывается до проверки
  cleanup_days int not null default 10,          -- предложения удаляются через ~1,5 недели после начала своей недели
  history_size int not null default 12,          -- сколько прошлых победителей хранить
  president_logins text[] not null default '{}'  -- GitHub-логины, которые получают роль президента при входе
);
insert into app_settings default values on conflict do nothing;

create table if not exists app_meta (key text primary key);

-- ---------- Таблицы ----------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Ученик',
  login text,
  avatar text,
  role text not null default 'member' check (role in ('member', 'moderator', 'president')),
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  week_id date not null,                       -- понедельник недели
  text text not null,
  author_id uuid not null references profiles(id) on delete cascade,
  hidden boolean not null default false,       -- скрыто жалобами, ждёт решения модератора
  reviewed boolean not null default false,     -- модератор проверил и оставил — жалобы больше не скрывают
  created_at timestamptz not null default now()
);
create unique index if not exists posts_week_text on posts (week_id, lower(text));
create index if not exists posts_author on posts (author_id, week_id);

create table if not exists votes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (post_id, user_id)
);

create table if not exists reports (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists winners (
  week_id date primary key,
  text text not null,
  likes int not null,
  dislikes int not null
);

create table if not exists banned_words (
  word text primary key,                       -- в нормализованном виде; «^» в начале = только начало слова
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists mod_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists sent_reminders (
  key text primary key,
  sent_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['app_settings', 'app_meta', 'profiles', 'posts', 'votes', 'reports', 'winners',
                           'banned_words', 'mod_log', 'push_subscriptions', 'sent_reminders'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- Время ----------

create or replace function current_week() returns date
language sql stable set search_path = public as $$
  select date_trunc('week', now() at time zone (select time_zone from app_settings))::date
$$;

-- Конец голосования: понедельник следующей недели 00:00 (= воскресенье 23:59:59) по времени школы.
create or replace function voting_deadline() returns timestamptz
language sql stable set search_path = public as $$
  select (current_week() + 7)::timestamp at time zone (select time_zone from app_settings)
$$;

-- ---------- Пользователи и права ----------

-- Создаёт или обновляет профиль текущего пользователя по данным из GitHub.
create or replace function sync_profile() returns profiles
language plpgsql security definer set search_path = public as $$
declare
  u auth.users;
  m jsonb;
  l text;
  p profiles;
begin
  if auth.uid() is null then return null; end if;
  select * into u from auth.users where id = auth.uid();
  if u.id is null then return null; end if;
  m := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  l := m->>'user_name';
  insert into profiles as pr (id, name, login, avatar, role)
  values (
    u.id,
    left(coalesce(nullif(m->>'full_name', ''), nullif(m->>'name', ''), l, split_part(u.email, '@', 1), 'Ученик'), 60),
    l,
    m->>'avatar_url',
    case when lower(l) = any (select lower(unnest(president_logins)) from app_settings) then 'president' else 'member' end
  )
  on conflict (id) do update set
    name = excluded.name,
    login = excluded.login,
    avatar = excluded.avatar,
    role = case when excluded.role = 'president' then 'president' else pr.role end
  returning * into p;
  return p;
end $$;

create or replace function role_rank(r text) returns int
language sql immutable as $$
  select array_position(array['member', 'moderator', 'president'], r)
$$;

create or replace function require_role(min_role text) returns profiles
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  select * into p from profiles where id = auth.uid();
  if p.id is null then raise exception 'Войди в аккаунт, чтобы продолжить'; end if;
  if role_rank(p.role) < role_rank(min_role) then raise exception 'Недостаточно прав'; end if;
  return p;
end $$;

create or replace function log_action(p_actor uuid, p_action text, p_details text) returns void
language sql security definer set search_path = public as $$
  insert into mod_log (actor_id, action, details) values (p_actor, p_action, p_details)
$$;

-- ---------- Фильтр запрещённых слов ----------

-- Приводит текст к единому виду: строчные, ё→е, латинские «двойники» и цифры → кириллица,
-- повторы букв схлопываются («хууууй» → «хуй», «x7» → «х7»).
create or replace function normalize_text(t text) returns text
language sql immutable as $$
  select regexp_replace(
    translate(replace(lower(t), 'ё', 'е'), 'acehkmoptxy036@', 'асенкмортхуозба'),
    '(.)\1+', '\1', 'g')
$$;

-- Возвращает найденное запрещённое слово или null.
-- Слово ищется внутри каждого слова текста; «^слово» — только в начале слова.
-- Цепочки одиночных букв склеиваются, чтобы ловить «х у й» и «х.у.й».
create or replace function find_banned_word(t text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  tokens text[] := '{}';
  run text := '';
  tok text;
  w text;
  pat text;
begin
  foreach tok in array regexp_split_to_array(normalize_text(t), '[^а-яa-z0-9]+') loop
    if tok = '' then continue; end if;
    if length(tok) = 1 then
      run := run || tok;
    else
      if run <> '' then tokens := tokens || run; run := ''; end if;
      tokens := tokens || tok;
    end if;
  end loop;
  if run <> '' then tokens := tokens || run; end if;

  for w in select word from banned_words loop
    pat := case when left(w, 1) = '^' then substr(w, 2) || '%' else '%' || w || '%' end;
    foreach tok in array tokens loop
      if tok like pat then return ltrim(w, '^'); end if;
    end loop;
  end loop;
  return null;
end $$;

-- Стартовый список — только при первом запуске, дальше его ведут модераторы на сайте.
do $$
begin
  if not exists (select 1 from app_meta where key = 'words_seeded') then
    insert into banned_words (word)
    select unnest(array[
      'хуй', 'хуе', 'хуя', 'хуи', 'пизд', '^еб', 'заеб', 'выеб', 'въеб', 'отъеб', 'наеб', 'уеба', 'уебо', 'уебк',
      'долбоеб', 'проеб', 'подъеб', 'разъеб', 'съеб', 'ебуч', '^бля', 'мудак', 'мудил', 'пидор', 'пидар', 'педик', 'залуп',
      'гандон', 'шлюх', 'дроч', '^сука', '^суки', '^сучк', '^сучар', '^говн', '^жоп', '^дебил', '^даун', 'х7'
    ])
    on conflict do nothing;
    insert into app_meta values ('words_seeded');
  end if;
end $$;

-- ---------- Итоги недели и очистка ----------

create or replace function maintain() returns void
language plpgsql security definer set search_path = public as $$
declare s app_settings;
begin
  select * into s from app_settings;
  -- Когда неделя закончилась — фиксируем победителя, пока её предложения ещё не удалены.
  insert into winners (week_id, text, likes, dislikes)
  select distinct on (t.week_id) t.week_id, t.text, t.likes, t.dislikes
  from (
    select p.week_id, p.text, p.created_at,
      count(v.user_id) filter (where v.value = 1)::int as likes,
      count(v.user_id) filter (where v.value = -1)::int as dislikes
    from posts p left join votes v on v.post_id = p.id
    where p.week_id < current_week() and not p.hidden
    group by p.id
  ) t
  order by t.week_id, t.likes - t.dislikes desc, t.likes desc, t.created_at
  on conflict (week_id) do nothing;

  delete from winners where week_id not in (select week_id from winners order by week_id desc limit s.history_size);
  delete from posts where week_id <= (now() at time zone s.time_zone)::date - s.cleanup_days;
end $$;

-- ---------- Чтение ----------

create or replace function week_posts(p_week date, p_uid uuid, p_include_hidden boolean default false)
returns table (
  id uuid, text text, created_at timestamptz, author_id uuid, author_name text, hidden boolean,
  likes int, dislikes int, my int, reported boolean, reports int, report_reasons text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.text, p.created_at, p.author_id, pr.name, p.hidden,
    (select count(*) from votes v where v.post_id = p.id and v.value = 1)::int,
    (select count(*) from votes v where v.post_id = p.id and v.value = -1)::int,
    coalesce((select v.value from votes v where v.post_id = p.id and v.user_id = p_uid), 0)::int,
    exists (select 1 from reports r where r.post_id = p.id and r.user_id = p_uid),
    (select count(*) from reports r where r.post_id = p.id)::int,
    (select string_agg(distinct r.reason, ', ') from reports r where r.post_id = p.id)
  from posts p left join profiles pr on pr.id = p.author_id
  where p.week_id = p_week and (p_include_hidden or not p.hidden)
$$;

-- Всё, что нужно главной странице, одним запросом.
create or replace function get_board() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  uid uuid := auth.uid();
  s app_settings;
  cur date := current_week();
  mine int;
begin
  perform maintain();
  me := sync_profile();
  select * into s from app_settings;
  select count(*) into mine from posts where week_id = cur and author_id = uid;

  return jsonb_build_object(
    'me', case when me.id is null then null else jsonb_build_object(
      'id', me.id, 'name', me.name, 'avatar', me.avatar, 'role', me.role, 'banned', me.banned) end,
    'weekId', cur,
    'deadline', voting_deadline(),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'text', w.text, 'createdAt', w.created_at, 'likes', w.likes, 'dislikes', w.dislikes,
        'my', w.my, 'mine', coalesce(w.author_id = uid, false), 'reported', w.reported)
        order by w.likes - w.dislikes desc, w.likes desc, w.created_at)
      from week_posts(cur, uid) w), '[]'::jsonb),
    'previous', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'text', w.text, 'likes', w.likes, 'dislikes', w.dislikes)
        order by w.likes - w.dislikes desc, w.likes desc, w.created_at)
      from week_posts(cur - 7, uid) w), '[]'::jsonb),
    'lastWinner', (
      select jsonb_build_object('weekId', week_id, 'text', text, 'likes', likes, 'dislikes', dislikes)
      from winners where week_id = cur - 7),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('weekId', week_id, 'text', text, 'likes', likes, 'dislikes', dislikes)
        order by week_id desc)
      from winners), '[]'::jsonb),
    'postsLeft', case when uid is null then 0 else greatest(0, s.max_posts_per_week - mine) end,
    'maxPerWeek', s.max_posts_per_week
  );
end $$;

-- ---------- Действия учеников ----------

create or replace function create_post(p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('member');
  s app_settings;
  t text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
  cur date := current_week();
  n int;
  new_id uuid;
begin
  if me.banned then raise exception 'Модераторы запретили тебе предлагать желания'; end if;
  select * into s from app_settings;
  if length(t) < 3 or length(t) > 200 then raise exception 'Желание должно быть от 3 до 200 символов'; end if;
  if t ~* '(https?://|www\.|t\.me/|\.(ru|com|net|org|рф|io|me|su)(/|\s|$))' then
    raise exception 'Ссылки в желаниях запрещены';
  end if;
  if find_banned_word(t) is not null then
    raise exception 'В желании есть запрещённое слово — переформулируй, пожалуйста';
  end if;
  select count(*) into n from posts where week_id = cur and author_id = me.id;
  if n >= s.max_posts_per_week then
    raise exception 'Твоё желание на эту неделю уже есть. Следующее можно предложить с понедельника!';
  end if;
  insert into posts (week_id, text, author_id) values (cur, t, me.id) returning id into new_id;
  return jsonb_build_object('id', new_id);
exception when unique_violation then
  raise exception 'Такое желание уже есть — поддержи его лайком!';
end $$;

create or replace function vote(p_post uuid, p_value int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('member');
  wk date;
begin
  if p_value not in (-1, 0, 1) then raise exception 'Неверный голос'; end if;
  select week_id into wk from posts where id = p_post and not hidden;
  if wk is null then raise exception 'Желание не найдено'; end if;
  if wk <> current_week() then raise exception 'Голосование за эту неделю уже закончилось'; end if;

  if p_value = 0 then
    delete from votes where post_id = p_post and user_id = me.id;
  else
    insert into votes (post_id, user_id, value) values (p_post, me.id, p_value)
    on conflict (post_id, user_id) do update set value = excluded.value;
  end if;

  return (
    select jsonb_build_object(
      'likes', count(*) filter (where v.value = 1),
      'dislikes', count(*) filter (where v.value = -1),
      'my', coalesce(max(v.value) filter (where v.user_id = me.id), 0))
    from votes v where v.post_id = p_post);
end $$;

create or replace function report_post(p_post uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('member');
  s app_settings;
  p posts;
  n int;
begin
  if me.banned then raise exception 'Модераторы запретили тебе отправлять жалобы'; end if;
  if p_reason is null or p_reason not in ('мат', 'оскорбление', 'спам', 'не по теме', 'другое') then
    raise exception 'Выбери причину жалобы';
  end if;
  select * into p from posts where id = p_post;
  if p.id is null then raise exception 'Желание не найдено'; end if;
  if p.author_id = me.id then raise exception 'Нельзя пожаловаться на своё желание'; end if;

  insert into reports (post_id, user_id, reason) values (p_post, me.id, p_reason) on conflict do nothing;
  select * into s from app_settings;
  select count(*) into n from reports where post_id = p_post;
  if not p.reviewed and not p.hidden and n >= s.report_hide_threshold then
    update posts set hidden = true where id = p_post;
    return jsonb_build_object('hidden', true);
  end if;
  return jsonb_build_object('hidden', p.hidden);
end $$;

-- Своё желание текущей недели может удалить автор; чужое — модератор или президент (с записью в журнал).
create or replace function delete_post(p_post uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('member');
  p posts;
begin
  select * into p from posts where id = p_post;
  if p.id is null then raise exception 'Желание не найдено'; end if;

  if p.author_id = me.id then
    if p.week_id <> current_week() then raise exception 'Эту неделю уже нельзя менять'; end if;
    delete from posts where id = p_post;
    return;
  end if;

  if role_rank(me.role) < role_rank('moderator') then
    raise exception 'Удалять чужие желания могут только модераторы';
  end if;
  delete from posts where id = p_post;
  perform log_action(me.id, 'delete_post', format('«%s» — %s (автор: %s)',
    p.text, coalesce(nullif(btrim(p_reason), ''), 'без причины'), (select name from profiles where id = p.author_id)));
end $$;

-- ---------- Модерация ----------

create or replace function restore_post(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('moderator');
  p posts;
begin
  update posts set hidden = false, reviewed = true where id = p_post returning * into p;
  if p.id is null then raise exception 'Желание не найдено'; end if;
  delete from reports where post_id = p_post;
  perform log_action(me.id, 'restore_post', format('«%s»', p.text));
end $$;

create or replace function add_banned_word(p_word text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('moderator');
  prefix text := case when left(btrim(coalesce(p_word, '')), 1) = '^' then '^' else '' end;
  w text := regexp_replace(normalize_text(btrim(coalesce(p_word, ''))), '[^а-яa-z0-9]', '', 'g');
begin
  if length(w) < 2 or length(w) > 40 then raise exception 'Слово должно быть от 2 до 40 символов'; end if;
  insert into banned_words (word, created_by) values (prefix || w, me.id) on conflict do nothing;
  perform log_action(me.id, 'add_word', prefix || w);
  return prefix || w;
end $$;

create or replace function remove_banned_word(p_word text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := require_role('moderator');
begin
  delete from banned_words where word = p_word;
  if found then perform log_action(me.id, 'remove_word', p_word); end if;
end $$;

create or replace function search_users(p_query text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('moderator');
  q text := btrim(coalesce(p_query, ''));
begin
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by role_rank(x.role) desc, x.name)
    from (
      select pr.id, pr.name, pr.login, pr.avatar, pr.role, pr.banned,
        (select count(*) from posts where author_id = pr.id)::int as posts
      from profiles pr
      where q = '' or pr.name ilike '%' || q || '%' or pr.login ilike '%' || q || '%'
      order by role_rank(pr.role) desc, pr.name
      limit 50
    ) x), '[]'::jsonb);
end $$;

-- Назначать и снимать модераторов может только президент.
create or replace function set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('president');
  target profiles;
begin
  if p_role not in ('member', 'moderator') then raise exception 'Можно назначить только ученика или модератора'; end if;
  select * into target from profiles where id = p_user;
  if target.id is null then raise exception 'Пользователь не найден'; end if;
  if target.role = 'president' then raise exception 'Роль президента меняется только в базе'; end if;
  update profiles set role = p_role, banned = case when p_role = 'moderator' then false else banned end where id = p_user;
  perform log_action(me.id, 'set_role', format('%s → %s', target.name, case p_role when 'moderator' then 'модератор' else 'ученик' end));
end $$;

-- Блокировать (запрет предлагать желания и жаловаться) можно только обычных учеников.
create or replace function set_banned(p_user uuid, p_banned boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('moderator');
  target profiles;
begin
  select * into target from profiles where id = p_user;
  if target.id is null then raise exception 'Пользователь не найден'; end if;
  if target.role <> 'member' then raise exception 'Модераторов и президента заблокировать нельзя'; end if;
  update profiles set banned = p_banned where id = p_user;
  perform log_action(me.id, case when p_banned then 'ban' else 'unban' end, target.name);
end $$;

create or replace function mod_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles := require_role('moderator');
  cur date := current_week();
begin
  return jsonb_build_object(
    'role', me.role,
    'threshold', (select report_hide_threshold from app_settings),
    'queue', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'text', w.text, 'createdAt', w.created_at, 'authorId', w.author_id, 'authorName', w.author_name,
        'hidden', w.hidden, 'likes', w.likes, 'dislikes', w.dislikes, 'reports', w.reports, 'reasons', w.report_reasons)
        order by w.hidden desc, w.reports desc)
      from (select * from week_posts(cur, null, true) union all select * from week_posts(cur - 7, null, true)) w
      join posts p on p.id = w.id
      where w.hidden or (w.reports > 0 and not p.reviewed)), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'text', w.text, 'createdAt', w.created_at, 'authorId', w.author_id, 'authorName', w.author_name,
        'hidden', w.hidden, 'likes', w.likes, 'dislikes', w.dislikes, 'reports', w.reports, 'reasons', w.report_reasons)
        order by w.likes - w.dislikes desc, w.created_at)
      from week_posts(cur, null, true) w), '[]'::jsonb),
    'words', coalesce((select jsonb_agg(word order by ltrim(word, '^')) from banned_words), '[]'::jsonb),
    'log', coalesce((
      select jsonb_agg(jsonb_build_object('at', l.created_at, 'actor', pr.name, 'action', l.action, 'details', l.details)
        order by l.created_at desc)
      from (select * from mod_log order by created_at desc limit 50) l left join profiles pr on pr.id = l.actor_id), '[]'::jsonb),
    'subscribers', (select count(*) from push_subscriptions)
  );
end $$;

-- ---------- Push-подписки (без входа тоже можно) ----------

create or replace function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_endpoint is null or p_endpoint not like 'https://%' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Неверная подписка';
  end if;
  insert into push_subscriptions (endpoint, p256dh, auth, user_id)
  values (p_endpoint, p_p256dh, p_auth, (select id from profiles where id = auth.uid()))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth,
    user_id = coalesce(excluded.user_id, push_subscriptions.user_id);
end $$;

create or replace function remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint
$$;

-- ---------- Права на вызов функций ----------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function get_board(), save_push_subscription(text, text, text), remove_push_subscription(text)
  to anon, authenticated;
grant execute on function create_post(text), vote(uuid, int), report_post(uuid, text), delete_post(uuid, text),
  restore_post(uuid), add_banned_word(text), remove_banned_word(text), search_users(text),
  set_role(uuid, text), set_banned(uuid, boolean), mod_overview()
  to authenticated;
