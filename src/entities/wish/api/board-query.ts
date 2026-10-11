'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession, useUserId } from '@/entities/session';
import { rpc } from '@/shared/api';
import type { Board } from '../model/types';

export const boardKeys = {
  all: ['board'] as const,
  forUser: (userId: string | null) => ['board', userId ?? 'anon'] as const,
};

// Доска недели. Ключ зависит от пользователя — после входа/выхода данные перезапрашиваются сами.
export function useBoardQuery() {
  const ready = useSession((s) => s.ready);
  const userId = useUserId();
  return useQuery({
    queryKey: boardKeys.forUser(userId),
    queryFn: () => rpc<Board>('get_board'),
    enabled: ready,
    refetchInterval: 30_000,
  });
}

// Ключ доски текущего пользователя — для оптимистичных обновлений в фичах.
export function useBoardKey() {
  return boardKeys.forUser(useUserId());
}
