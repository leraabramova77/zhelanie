'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpc } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { toast } from '@/shared/ui';

// Автор удаляет своё желание без причины; модератор — чужое, с причиной (попадает в журнал).
export function useDeleteWish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rpc('delete_post', { p_post: id, p_reason: reason ?? null }),
    onSuccess: () => toast('Желание удалено'),
    onError: (e) => toast(errorMessage(e)),
    // Обновляем и доску, и данные модерации.
    onSettled: () => queryClient.invalidateQueries(),
  });
}
