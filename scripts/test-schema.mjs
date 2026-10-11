// Прогоняет supabase/schema.sql на встроенном Postgres (PGlite) с заглушками Supabase
// и проверяет основные сценарии: желания, голоса, фильтр слов, жалобы, роли.
// Запуск: npm run test:sql
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ids = {};
let failed = 0;

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon; create role authenticated; create role service_role;
`);
await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
await db.exec(`update app_settings set president_logins = '{lera}'`);

async function as(user, sql, params = []) {
  await db.query(`select set_config('test.uid', $1, false)`, [user ? ids[user] : '']);
  return (await db.query(sql, params)).rows;
}

async function expectOk(title, fn) {
  try {
    await fn();
    console.log('  ✓', title);
  } catch (e) {
    failed++;
    console.log('  ✗', title, '→', e.message);
  }
}

async function expectError(title, fn, part) {
  try {
    await fn();
    failed++;
    console.log('  ✗', title, '→ ошибки не было');
  } catch (e) {
    if (e.message.includes(part)) console.log('  ✓', title, '→', e.message);
    else {
      failed++;
      console.log('  ✗', title, '→', e.message);
    }
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

for (const [name, login] of [
  ['lera', 'lera'],
  ['masha', 'masha'],
  ['petya', 'petya'],
  ['vova', 'vova'],
  ['kolya', 'kolya'],
]) {
  const [{ id }] = (
    await db.query(`insert into auth.users values (gen_random_uuid(), $1, $2) returning id`, [
      `${login}@example.com`,
      JSON.stringify({ user_name: login, full_name: name[0].toUpperCase() + name.slice(1) }),
    ])
  ).rows;
  ids[name] = id;
  await as(name, 'select get_board()');
}

const board = async (u) => (await as(u, 'select get_board() as b'))[0].b;
const postId = async (text) => (await db.query('select id from posts where text = $1', [text])).rows[0]?.id;

console.log('Роли');
await expectOk('lera из president_logins стала президентом', async () =>
  assert((await board('lera')).me.role === 'president', 'не президент'),
);
await expectOk('аноним видит доску без профиля', async () => assert((await board(null)).me === null, 'me не null'));

console.log('Желания');
await expectOk('masha предлагает желание', () => as('masha', `select create_post('Каждую пятницу — свободная форма')`));
await expectError(
  'второе желание за неделю нельзя',
  () => as('masha', `select create_post('Музыка на переменах')`),
  'уже есть',
);
await expectError(
  'дубликат другого ученика',
  () => as('petya', `select create_post('каждую пятницу —   СВОБОДНАЯ форма')`),
  'Такое желание',
);
await expectError('ссылки запрещены', () => as('petya', `select create_post('заходите на www.site.ru')`), 'Ссылки');
await expectError('мат запрещён', () => as('petya', `select create_post('Директор — мудак')`), 'запрещённое');
await expectError('мат латиницей и повторами', () => as('petya', `select create_post('xуууй вам')`), 'запрещённое');
await expectError('мат через пробелы', () => as('petya', `select create_post('х у й')`), 'запрещённое');
await expectError('x7 из примера', () => as('petya', `select create_post('X7 рулит')`), 'запрещённое');
await expectOk('«рубля» и «хлебать» не срабатывают', () =>
  as('petya', `select create_post('Скидка 10 рублей на хлебать компот')`),
);
await expectError('аноним не может предлагать', () => as(null, `select create_post('Тест')`), 'Войди');

console.log('Голоса');
const p1 = await postId('Каждую пятницу — свободная форма');
await expectOk('лайк и смена голоса', async () => {
  await as('petya', 'select vote($1, 1)', [p1]);
  const [{ r }] = await as('vova', 'select vote($1, -1) as r', [p1]);
  assert(r.likes === 1 && r.dislikes === 1 && r.my === -1, JSON.stringify(r));
  const [{ r: r2 }] = await as('vova', 'select vote($1, 1) as r', [p1]);
  assert(r2.likes === 2 && r2.dislikes === 0, JSON.stringify(r2));
});
await expectOk('доска сортирует по рейтингу и отмечает своё', async () => {
  const b = await board('masha');
  assert(b.posts[0].id === p1 && b.posts[0].mine === true && b.postsLeft === 0, JSON.stringify(b.posts));
});

console.log('Жалобы');
const p2 = await postId('Скидка 10 рублей на хлебать компот');
await expectError('на своё жаловаться нельзя', () => as('petya', `select report_post($1, 'спам')`, [p2]), 'своё');
await expectOk('3 жалобы скрывают желание', async () => {
  for (const u of ['masha', 'vova', 'kolya']) await as(u, `select report_post($1, 'спам')`, [p2]);
  assert(!(await board('masha')).posts.some((p) => p.id === p2), 'всё ещё видно');
});
await expectError('обычный ученик не видит модерацию', () => as('masha', 'select mod_overview()'), 'Недостаточно прав');

console.log('Модераторы и президент');
await expectError(
  'ученик не назначает модераторов',
  () => as('masha', `select set_role($1, 'moderator')`, [ids.vova]),
  'Недостаточно прав',
);
await expectOk('президент назначает masha модератором', () =>
  as('lera', `select set_role($1, 'moderator')`, [ids.masha]),
);
await expectError(
  'модератор не назначает модераторов',
  () => as('masha', `select set_role($1, 'moderator')`, [ids.vova]),
  'Недостаточно прав',
);
await expectOk('модератор видит скрытое в очереди и восстанавливает', async () => {
  const [{ o }] = await as('masha', 'select mod_overview() as o');
  assert(
    o.queue.some((p) => p.id === p2 && p.hidden),
    'нет в очереди',
  );
  await as('masha', 'select restore_post($1)', [p2]);
  assert(
    (await board('kolya')).posts.some((p) => p.id === p2),
    'не восстановилось',
  );
});
await expectOk('после проверки жалобы больше не скрывают', async () => {
  for (const u of ['masha', 'vova', 'kolya', 'lera']) await as(u, `select report_post($1, 'спам')`, [p2]);
  assert(
    (await board('kolya')).posts.some((p) => p.id === p2),
    'скрылось снова',
  );
});
await expectError('ученик не удаляет чужое', () => as('kolya', 'select delete_post($1)', [p2]), 'только модераторы');
await expectOk('модератор удаляет чужое с причиной', () => as('masha', `select delete_post($1, 'спам')`, [p2]));
await expectOk('модератор блокирует ученика', () => as('masha', 'select set_banned($1, true)', [ids.kolya]));
await expectError(
  'заблокированный не предлагает',
  () => as('kolya', `select create_post('Новое желание')`),
  'запретили',
);
await expectError(
  'модератор не блокирует президента',
  () => as('masha', 'select set_banned($1, true)', [ids.lera]),
  'нельзя',
);
await expectOk('модератор добавляет слово, фильтр сразу работает', async () => {
  await as('masha', `select add_banned_word('Тупица')`);
  try {
    await as('vova', `select create_post('Учитель тупица')`);
    throw new Error('прошло');
  } catch (e) {
    assert(e.message.includes('запрещённое'), e.message);
  }
});
await expectOk('журнал записывает действия', async () => {
  const [{ o }] = await as('lera', 'select mod_overview() as o');
  const actions = o.log.map((l) => l.action);
  for (const a of ['set_role', 'restore_post', 'delete_post', 'ban', 'add_word'])
    assert(actions.includes(a), `нет ${a}`);
});
await expectOk('президент снимает модератора', () => as('lera', `select set_role($1, 'member')`, [ids.masha]));

console.log('Итоги недели и очистка');
await expectOk('победитель прошлой недели и удаление старых', async () => {
  await db.exec(`
    insert into posts (week_id, text, author_id) values
      (current_week() - 7, 'Без домашки по пятницам', '${ids.masha}'),
      (current_week() - 7, 'Кофемашина', '${ids.petya}'),
      (current_week() - 21, 'Очень старое', '${ids.vova}');
    insert into votes select id, '${ids.lera}', 1 from posts where text in ('Без домашки по пятницам', 'Кофемашина');
    insert into votes select id, '${ids.vova}', 1 from posts where text = 'Без домашки по пятницам';
  `);
  const b = await board(null);
  assert(b.lastWinner?.text === 'Без домашки по пятницам', JSON.stringify(b.lastWinner));
  assert(b.history.length === 2, 'история: ' + JSON.stringify(b.history));
  assert(!(await postId('Очень старое')), 'старое не удалено');
});

console.log('Права из браузера');
await expectError(
  'anon не читает таблицы напрямую',
  async () => {
    await db.exec('set role anon');
    try {
      await db.query('select * from posts');
    } finally {
      await db.exec('reset role');
    }
  },
  'permission denied',
);

console.log(failed ? `\nПровалено: ${failed}` : '\nВсе проверки пройдены');
process.exit(failed ? 1 : 0);
