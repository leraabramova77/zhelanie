'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type Board, boardKeys } from '@/entities/wish';
import { rpc } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { toast } from '@/shared/ui';

const MIN = 3;
const MAX = 200;

export function ProposeForm({ board }: { board: Board }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (value: string) => rpc('create_post', { p_text: value }),
    onSuccess: () => {
      setText('');
      toast('Желание добавлено! Зови друзей голосовать 🎉');
    },
    onError: (e) => toast(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardKeys.all }),
  });

  if (board.me?.banned) {
    return (
      <section className="card">
        <h2>Предложить желание</h2>
        <p className="muted">Модераторы запретили тебе предлагать желания. Голосовать по-прежнему можно.</p>
      </section>
    );
  }

  if (board.postsLeft <= 0) {
    return (
      <section className="card done-card">
        <h2>Твоё желание на этой неделе уже отправлено ✅</h2>
        <p className="muted">Каждый может предложить одно желание в неделю. Следующее — с понедельника.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Предложить желание</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(text);
        }}
      >
        <textarea
          className="input"
          rows={3}
          maxLength={MAX}
          placeholder="Например: каждую пятницу — свободная форма"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="form-row">
          <span className="muted small">
            {text.length} / {MAX} · одно желание в неделю, без мата и ссылок
          </span>
          <button className="btn" type="submit" disabled={create.isPending || text.trim().length < MIN}>
            Отправить
          </button>
        </div>
      </form>
    </section>
  );
}
