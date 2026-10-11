'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { type ModUser, modKeys, useUsersQuery } from '@/entities/moderation';
import { canManageRoles, ROLE_LABEL, type Role, RoleBadge } from '@/entities/user';
import { rpc } from '@/shared/api';
import { errorMessage, plural } from '@/shared/lib';
import { toast } from '@/shared/ui';

// Президент назначает и снимает модераторов. Модераторы и президент блокируют обычных учеников.
export function UserManager({ myRole }: { myRole: Role }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const users = useUsersQuery(deferred);
  const queryClient = useQueryClient();
  const done = (msg: string) => () => {
    toast(msg);
    queryClient.invalidateQueries({ queryKey: modKeys.all });
  };

  const setRole = useMutation({
    mutationFn: (v: { id: string; role: 'member' | 'moderator' }) => rpc('set_role', { p_user: v.id, p_role: v.role }),
    onSuccess: (_r, v) => done(v.role === 'moderator' ? 'Назначен модератор' : 'Модератор снят')(),
    onError: (e) => toast(errorMessage(e)),
  });
  const setBanned = useMutation({
    mutationFn: (v: { id: string; banned: boolean }) => rpc('set_banned', { p_user: v.id, p_banned: v.banned }),
    onSuccess: (_r, v) => done(v.banned ? 'Ученик заблокирован' : 'Блокировка снята')(),
    onError: (e) => toast(errorMessage(e)),
  });

  return (
    <section className="card">
      <h2>Люди</h2>
      <p className="muted small">
        {canManageRoles(myRole)
          ? 'Ты президент: можешь назначать и снимать модераторов и блокировать учеников.'
          : 'Модератор может блокировать учеников — заблокированный не может предлагать желания и жаловаться. Назначать модераторов может только президент.'}
      </p>
      <input
        className="input"
        placeholder="Поиск по имени или логину GitHub"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginTop: 12 }}
      />
      {users.isLoading && <p className="muted small">Загрузка…</p>}
      <ul className="user-list">
        {users.data?.map((u: ModUser) => (
          <li key={u.id} className="user-row">
            {u.avatar ? (
              <img src={u.avatar} alt="" className="avatar sm" width={32} height={32} />
            ) : (
              <span className="avatar sm" />
            )}
            <div className="user-info">
              <b>{u.name}</b> <RoleBadge role={u.role} /> {u.banned && <span className="tag danger">заблокирован</span>}
              <div className="muted small">
                {u.login ? `@${u.login} · ` : ''}
                {ROLE_LABEL[u.role]} · {u.posts} {plural(u.posts, ['желание', 'желания', 'желаний'])}
              </div>
            </div>
            <div className="user-actions">
              {canManageRoles(myRole) && u.role !== 'president' && (
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setRole.mutate({ id: u.id, role: u.role === 'moderator' ? 'member' : 'moderator' })}
                >
                  {u.role === 'moderator' ? 'Снять модератора' : 'Сделать модератором'}
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
