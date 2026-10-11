'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { type ModOverview, type ModUser, modKeys, useUsersQuery } from '@/entities/moderation';
import { canManageRoles, ROLE_LABEL, type Role, RoleBadge } from '@/entities/user';
import { invokeFunction, rpc } from '@/shared/api';
import { dateTime, errorMessage, plural, timeAgo } from '@/shared/lib';
import { toast } from '@/shared/ui';

// Президент назначает и снимает модераторов. Модераторы и президент блокируют учеников и выдают временные пароли.
interface Props {
  myRole: Role;
  myId?: string;
  people?: ModOverview['people'];
}

export function UserManager({ myRole, myId, people }: Props) {
  const [query, setQuery] = useState('');
  const [issued, setIssued] = useState<{ name: string; login: string | null; password: string } | null>(null);
  const deferred = useDeferredValue(query.trim());
  const users = useUsersQuery(deferred);
  const queryClient = useQueryClient();
  const president = canManageRoles(myRole);
  const done = (msg: string) => {
    toast(msg);
    queryClient.invalidateQueries({ queryKey: modKeys.all });
  };

  const setRole = useMutation({
    mutationFn: (v: { id: string; role: 'member' | 'moderator' }) => rpc('set_role', { p_user: v.id, p_role: v.role }),
    onSuccess: (_r, v) => done(v.role === 'moderator' ? 'Назначен модератор' : 'Модератор снят'),
    onError: (e) => toast(errorMessage(e)),
  });
  const setBanned = useMutation({
    mutationFn: (v: { id: string; banned: boolean }) => rpc('set_banned', { p_user: v.id, p_banned: v.banned }),
    onSuccess: (_r, v) => done(v.banned ? 'Ученик заблокирован' : 'Блокировка снята'),
    onError: (e) => toast(errorMessage(e)),
  });
  const resetPassword = useMutation({
    mutationFn: (u: ModUser) =>
      invokeFunction<{ password: string }>('account', { action: 'reset_password', userId: u.id }),
    onSuccess: (r, u) => {
      setIssued({ name: u.name, login: u.login, password: r.password });
      done('Временный пароль выдан');
    },
    onError: (e) => toast(errorMessage(e)),
  });

  const canReset = (u: ModUser) => u.id !== myId && (u.role === 'member' || (president && u.role === 'moderator'));

  return (
    <section className="card">
      <h2>Люди</h2>
      {people && (
        <div className="people-stats">
          <div>
            <b>{people.total}</b>
            <small>всего в системе</small>
          </div>
          <div>
            <b>{people.today}</b>
            <small>заходили сегодня</small>
          </div>
          <div>
            <b>{people.week}</b>
            <small>за неделю</small>
          </div>
          <div>
            <b>{people.newThisWeek}</b>
            <small>новых за неделю</small>
          </div>
        </div>
      )}
      <p className="muted small">
        {president
          ? 'Ты президент: назначаешь и снимаешь модераторов, блокируешь учеников, выдаёшь временные пароли.'
          : 'Модератор блокирует учеников (заблокированный не может предлагать желания и жаловаться) и выдаёт временные пароли тем, кто забыл свой. Назначать модераторов может только президент.'}
      </p>

      {issued && (
        <div className="issued">
          <p>
            Временный пароль для <b>{issued.name}</b>
            {issued.login ? ` (логин ${issued.login})` : ''}:
          </p>
          <p className="school-code">{issued.password}</p>
          <p className="muted small">Передай его ученику лично. После входа пусть сменит пароль в меню «Пароль».</p>
          <button type="button" className="link-btn muted" onClick={() => setIssued(null)}>
            скрыть
          </button>
        </div>
      )}

      <input
        className="input"
        placeholder="Поиск по имени или логину"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginTop: 12 }}
      />
      {users.isLoading && <p className="muted small">Загрузка…</p>}
      <ol className="user-list">
        {users.data?.map((u: ModUser, i) => (
          <li key={u.id} className="user-row">
            <span className="user-num">{i + 1}</span>
            <div className="user-info">
              <b>{u.name}</b> <RoleBadge role={u.role} /> {u.banned && <span className="tag danger">заблокирован</span>}
              <div className="muted small">
                {u.login ? `${u.login} · ` : ''}
                {ROLE_LABEL[u.role]} · {u.posts} {plural(u.posts, ['желание', 'желания', 'желаний'])}
                {u.registeredAt && ` · с нами с ${dateTime(u.registeredAt)}`}
                {u.lastSeenAt && ` · заходил(а) ${timeAgo(u.lastSeenAt)}`}
              </div>
            </div>
            <div className="user-actions">
              {president && u.role !== 'president' && (
                <label className="role-select">
                  <span className="sr-only">Ранг</span>
                  <select
                    className="input"
                    value={u.role}
                    disabled={setRole.isPending}
                    onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value as 'member' | 'moderator' })}
                  >
                    <option value="member">🎒 Ученик</option>
                    <option value="moderator">🛡️ Модератор</option>
                  </select>
                </label>
              )}
              {canReset(u) && (
                <button type="button" className="btn btn-small btn-ghost" onClick={() => resetPassword.mutate(u)}>
                  Сбросить пароль
                </button>
              )}
              {u.role === 'member' && (
                <button
                  type="button"
                  className={`btn btn-small ${u.banned ? '' : 'btn-danger'}`}
                  onClick={() => setBanned.mutate({ id: u.id, banned: !u.banned })}
                >
                  {u.banned ? 'Разблокировать' : 'Заблокировать'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {users.data?.length === 0 && <p className="muted">Никого не нашли</p>}
    </section>
  );
}
