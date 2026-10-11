'use client';

import type { ReactNode } from 'react';
import { timeAgo, useNow } from '@/shared/lib';
import type { Wish } from '../model/types';

interface Props {
  wish: Wish;
  place: number;
  leader: boolean;
  votes: ReactNode; // слот для кнопок голосования
  actions?: ReactNode; // слот для «удалить», «пожаловаться»
  footer?: ReactNode; // слот под карточкой (например, выбор причины)
}

export function WishCard({ wish, place, leader, votes, actions, footer }: Props) {
  const now = useNow(60_000);
  const total = wish.likes + wish.dislikes;
  const share = total ? (wish.likes / total) * 100 : 0;

  return (
    <li className={`post${leader ? ' leader' : ''}`}>
      <div className="rank">{place}</div>
      <div className="post-body">
        <p className="post-text">{wish.text}</p>
        <div className="post-meta">
          {leader && <span className="tag lead">🏆 лидирует</span>}
          {now && <span>{timeAgo(wish.createdAt)}</span>}
          {wish.mine && <span className="tag">твоё</span>}
          {actions}
        </div>
        <div className={`bar${total ? '' : ' none'}`} title={total ? `${Math.round(share)}% за` : 'Пока нет голосов'}>
          <span style={{ width: `${share}%` }} />
        </div>
      </div>
      <div className="votes">{votes}</div>
      {footer && <div className="post-footer">{footer}</div>}
    </li>
  );
}
