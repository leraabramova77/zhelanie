'use client';

import { useEffect, useRef } from 'react';
import type { Board } from '@/entities/wish';
import { SignInButton, UserMenu } from '@/features/auth';
import { NotifyButton } from '@/features/push-notifications';
import { env } from '@/shared/config';
import { useNow } from '@/shared/lib';

export function Hero({ board, onDeadline }: { board?: Board; onDeadline?: () => void }) {
  return (
    <header className="hero">
      <div className="wrap">
        <div className="topbar">
          <p className="school">{env.schoolName}</p>
          {board && (board.me ? <UserMenu me={board.me} /> : <SignInButton />)}
        </div>

        <h1>
          Желание
          <br />
          недели
        </h1>
        <p className="lead">
          Предлагай, что изменить в школе, и голосуй за лучшие идеи. В воскресенье в 23:59 выбираем победителя — и идём
          с ним к учителям.
        </p>

        <Countdown deadline={board?.deadline} onDone={onDeadline} />
        <NotifyButton />
      </div>
    </header>
  );
}

function Countdown({ deadline, onDone }: { deadline?: string; onDone?: () => void }) {
  const now = useNow();
  const left = deadline && now !== null ? Math.max(0, new Date(deadline).getTime() - now) : null;
  const fired = useRef(false);

  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onDone?.();
    }
    if (left) fired.current = false;
  }, [left, onDone]);

  let ms = left ?? 0;
  const d = Math.floor(ms / 864e5);
  ms -= d * 864e5;
  const h = Math.floor(ms / 36e5);
  ms -= h * 36e5;
  const m = Math.floor(ms / 6e4);
  ms -= m * 6e4;
  const s = Math.floor(ms / 1e3);
  const cells: [string, string][] =
    left === null
      ? [
          ['–', 'дн'],
          ['–', 'ч'],
          ['–', 'мин'],
          ['–', 'сек'],
        ]
      : [
          [String(d), 'дн'],
          [String(h).padStart(2, '0'), 'ч'],
          [String(m).padStart(2, '0'), 'мин'],
          [String(s).padStart(2, '0'), 'сек'],
        ];

  return (
    <div className="countdown" aria-live="off">
      <span className="cd-label">До конца голосования</span>
      <div className="cd-grid">
        {cells.map(([value, unit]) => (
          <div key={unit}>
            <b>{value}</b>
            <small>{unit}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
