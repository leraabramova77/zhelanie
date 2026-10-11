'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { type ModUser, modKeys, useUsersQuery } from '@/entities/moderation';
import { canManageRoles, ROLE_LABEL, type Role, RoleBadge } from '@/entities/user';
import { invokeFunction, rpc } from '@/shared/api';
import { errorMessage, plural } from '@/shared/lib';
import { toast } from '@/shared/ui';

// Президент назначает и снимает модераторов. Модераторы и президент блокируют учеников и выдают временные пароли.
export function UserManager({ myRole, myId }: { myRole: Role; myId?: string }) {
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
      <ul className="user-list">
        {users.data?.map((u: ModUser) => (
          <li key={u.id} className="user-row">
            <div className="user-info">
              <b>{u.name}</b> <RoleBadge role={u.role} /> {u.banned && <span className="tag danger">заблокирован</span>}
              <div className="muted small">
                {u.login ? `${u.login} · ` : ''}
                {ROLE_LABEL[u.role]} · {u.posts} {plural(u.posts, ['желание', 'желания', 'желаний'])}
              </div>
            </div>
            <div className="user-actions">
              {president && u.role !== 'president' && (
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setRole.mutate({ id: u.id, role: u.role === 'moderator' ? 'member' : 'moderator' })}
                >
                  {u.role === 'moderator' ? 'Снять модератора' : 'Сделать модератором'}
                </button>
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
      </ul>
      {users.data?.length === 0 && <p className="muted">Никого не нашли</p>}
    </section>
  );
}
