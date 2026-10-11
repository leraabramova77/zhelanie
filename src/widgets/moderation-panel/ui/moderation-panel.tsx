'use client';

import { useState } from 'react';
import { ACTION_LABEL, type ModOverview, type ModWish } from '@/entities/moderation';
import { canManageRoles } from '@/entities/user';
import { BannedWordsEditor } from '@/features/banned-words';
import { BroadcastForm } from '@/features/broadcast';
import { useDeleteWish } from '@/features/delete-wish';
import { UserManager } from '@/features/manage-user';
import { useRestoreWish } from '@/features/restore-wish';
import { SchoolCodeForm } from '@/features/school-code';
import { dateTime, plural } from '@/shared/lib';
import { ReasonPicker } from '@/shared/ui';
import { type ModTab, useModTab } from '../model/store';

export function ModerationPanel({ data, myId }: { data: ModOverview; myId?: string }) {
  const { tab, setTab } = useModTab();
  const president = canManageRoles(data.role);

  const tabs: [ModTab, string][] = [
    ['queue', `Жалобы${data.queue.length ? ` · ${data.queue.length}` : ''}`],
    ['posts', 'Желания недели'],
    ['words', 'Запретные слова'],
    ['people', 'Люди'],
    ['log', 'Журнал'],
  ];
  if (president) tabs.push(['broadcast', 'Президент']);

  return (
    <div className="stack">
      <div className="tabs mod-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <section className="card">
          <h2>Жалобы</h2>
          <p className="muted small">
            После {data.threshold} {plural(data.threshold, ['жалобы', 'жалоб', 'жалоб'])} желание скрывается от всех и
            ждёт решения. «Оставить» — вернуть и больше не скрывать по жалобам, «Удалить» — убрать насовсем.
          </p>
          {data.queue.length === 0 && <p className="muted">Жалоб нет 🎉</p>}
          {data.queue.map((w) => (
            <ModWishRow key={w.id} wish={w} showRestore />
          ))}
        </section>
      )}

      {tab === 'posts' && (
        <section className="card">
          <h2>Все желания этой недели · {data.posts.length}</h2>
          {data.posts.length === 0 && <p className="muted">Пока пусто</p>}
          {data.posts.map((w) => (
            <ModWishRow key={w.id} wish={w} showRestore={w.hidden} />
          ))}
        </section>
      )}

      {tab === 'words' && <BannedWordsEditor words={data.words} />}
      {tab === 'people' && <UserManager myRole={data.role} myId={myId} />}

      {tab === 'log' && (
        <section className="card">
          <h2>Журнал модерации</h2>
          <p className="muted small">Все действия модераторов и президента — чтобы решения были прозрачными.</p>
          {data.log.length === 0 && <p className="muted">Пока пусто</p>}
          <ul className="log-list">
            {data.log.map((l) => (
              <li key={`${l.at}-${l.action}-${l.details}`}>
                <span className="muted small">{dateTime(l.at)}</span> <b>{l.actor ?? 'кто-то'}</b>{' '}
                {ACTION_LABEL[l.action] ?? l.action}: {l.details}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'broadcast' && president && (
        <>
          <SchoolCodeForm current={data.schoolCode ?? ''} />
          <BroadcastForm subscribers={data.subscribers} />
        </>
      )}
    </div>
  );
}

function ModWishRow({ wish, showRestore }: { wish: ModWish; showRestore?: boolean }) {
  const [deleting, setDeleting] = useState(false);
  const restore = useRestoreWish();
  const remove = useDeleteWish();

  return (
    <div className="mod-post">
      <div className="mod-post-main">
        <p className="mod-post-text">
          {wish.text}{' '}
          {wish.aiStatus === 'removed' ? (
            <span className="tag danger">🤖 удалено ИИ: {wish.aiReason}</span>
          ) : (
            wish.hidden && <span className="tag danger">скрыто</span>
          )}
          {wish.aiStatus === 'pending' && <span className="tag">🤖 проверяется</span>}
          {wish.aiScore && <span className="tag ai">🤖 {wish.aiScore}/10</span>}
        </p>
        <p className="muted small">
          {wish.authorName ?? 'удалённый пользователь'} · 👍 {wish.likes} 👎 {wish.dislikes}
          {wish.reports > 0 && ` · жалоб: ${wish.reports} (${wish.reasons})`}
        </p>
        {deleting && (
          <ReasonPicker
            title="Причина удаления:"
            danger
            onCancel={() => setDeleting(false)}
            onPick={(reason) => {
              setDeleting(false);
              remove.mutate({ id: wish.id, reason });
            }}
          />
        )}
      </div>
      <div className="mod-post-actions">
        {showRestore && (
          <button type="button" className="btn btn-small" onClick={() => restore.mutate(wish.id)}>
            Оставить
          </button>
        )}
        <button type="button" className="btn btn-small btn-danger" onClick={() => setDeleting(true)}>
          Удалить
        </button>
      </div>
    </div>
  );
}
