'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Board, useBoardKey, type Vote, type Wish } from '@/entities/wish';
import { rpc } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { ThumbIcon, toast } from '@/shared/ui';

interface VoteResult {
  likes: number;
  dislikes: number;
  my: Vote;
}

function applyVote(w: Wish, value: Vote): Wish {
  const next = { ...w, my: value };
  if (w.my === 1) next.likes--;
  if (w.my === -1) next.dislikes--;
  if (value === 1) next.likes++;
  if (value === -1) next.dislikes++;
  return next;
}

export function VoteButtons({ wish, onUnauthorized }: { wish: Wish; onUnauthorized?: () => void }) {
  const queryClient = useQueryClient();
  const key = useBoardKey();

  const patch = (fn: (w: Wish) => Wish) =>
    queryClient.setQueryData<Board>(
      key,
      (b) => b && { ...b, posts: b.posts.map((p) => (p.id === wish.id ? fn(p) : p)) },
    );

  // Оптимистичное обновление: кнопка отзывается сразу, при ошибке откатываемся.
  const vote = useMutation({
    mutationFn: (value: Vote) => rpc<VoteResult>('vote', { p_post: wish.id, p_value: value }),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Board>(key);
      patch((w) => applyVote(w, value));
      return { previous };
    },
    onSuccess: (r) => patch((w) => ({ ...w, ...r })),
    onError: (e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast(errorMessage(e));
    },
  });

  const click = (value: Vote) => {
    if (onUnauthorized) return onUnauthorized();
    vote.mutate(wish.my === value ? 0 : value);
  };

  return (
    <>
      <button
        type="button"
        className="vote up"
        aria-pressed={wish.my === 1}
        aria-label="Нравится"
        onClick={() => click(1)}
      >
        <ThumbIcon />
        <span>{wish.likes}</span>
      </button>
      <button
        type="button"
        className="vote down"
        aria-pressed={wish.my === -1}
        aria-label="Не нравится"
        onClick={() => click(-1)}
      >
        <ThumbIcon down />
        <span>{wish.dislikes}</span>
      </button>
    </>
  );
}
