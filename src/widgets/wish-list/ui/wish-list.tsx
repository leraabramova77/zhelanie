'use client';

import { canModerate } from '@/entities/user';
import { type Board, type Wish, WishCard } from '@/entities/wish';
import { startSignIn } from '@/features/auth';
import { useDeleteWish } from '@/features/delete-wish';
import { useReportWish } from '@/features/report-wish';
import { VoteButtons } from '@/features/vote-wish';
import { ReasonPicker } from '@/shared/ui';
import { useWishListStore } from '../model/store';

export function WishList({ board }: { board: Board }) {
  const { sort, setSort } = useWishListStore();
  const posts = board.posts;
  const leaderId = posts[0] && posts[0].likes > posts[0].dislikes ? posts[0].id : null;
  const places = new Map(posts.map((p, i) => [p.id, i + 1]));
  const shown = sort === 'new' ? [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : posts;

  return (
    <section>
      <div className="list-head">
        <h2>
          Желания недели <span className="pill">{posts.length}</span>
        </h2>
        <div className="tabs" role="tablist">
          {(['top', 'new'] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={sort === s} onClick={() => setSort(s)}>
              {s === 'top' ? 'Популярные' : 'Новые'}
            </button>
          ))}
        </div>
      </div>
      {shown.length > 0 ? (
        <ol className="posts">
          {shown.map((w) => (
            <WishRow key={w.id} wish={w} board={board} place={places.get(w.id) ?? 0} leader={w.id === leaderId} />
          ))}
        </ol>
      ) : (
        <p className="empty">Пока ни одного желания. Стань первым! ✍️</p>
      )}
    </section>
  );
}

function WishRow({ wish, board, place, leader }: { wish: Wish; board: Board; place: number; leader: boolean }) {
  const { picker, openPicker, closePicker } = useWishListStore();
  const report = useReportWish();
  const remove = useDeleteWish();
  const me = board.me;
  const isMod = canModerate(me?.role);
  const open = picker?.id === wish.id ? picker.kind : null;

  const actions = me && (
    <>
      {wish.mine && (
        <button type="button" className="link-btn" onClick={() => openPicker(wish.id, 'confirm-own')}>
          удалить
        </button>
      )}
      {!wish.mine && isMod && (
        <button type="button" className="link-btn" onClick={() => openPicker(wish.id, 'delete')}>
          удалить
        </button>
      )}
      {!wish.mine && !isMod && !me.banned && (
        <button
          type="button"
          className="link-btn muted"
          disabled={wish.reported}
          onClick={() => openPicker(wish.id, 'report')}
        >
          {wish.reported ? 'жалоба отправлена' : '⚑ пожаловаться'}
        </button>
      )}
    </>
  );

  let footer = null;
  if (open === 'report') {
    footer = (
      <ReasonPicker
        title="Что не так с этим желанием?"
        onCancel={closePicker}
        onPick={(reason) => {
          closePicker();
          report.mutate({ id: wish.id, reason });
        }}
      />
    );
  } else if (open === 'delete') {
    footer = (
      <ReasonPicker
        title="Удалить чужое желание. Причина попадёт в журнал модерации:"
        danger
        onCancel={closePicker}
        onPick={(reason) => {
          closePicker();
          remove.mutate({ id: wish.id, reason });
        }}
      />
    );
  } else if (open === 'confirm-own') {
    footer = (
      <div className="reason-picker">
        <span className="muted small">Удалить твоё желание? Можно будет предложить другое.</span>
        <div className="reason-list">
          <button
            type="button"
            className="reason danger"
            onClick={() => {
              closePicker();
              remove.mutate({ id: wish.id });
            }}
          >
            да, удалить
          </button>
          <button type="button" className="link-btn muted" onClick={closePicker}>
            отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <WishCard
      wish={wish}
      place={place}
      leader={leader}
      actions={actions}
      footer={footer}
      votes={<VoteButtons wish={wish} onUnauthorized={me ? undefined : startSignIn} />}
    />
  );
}
