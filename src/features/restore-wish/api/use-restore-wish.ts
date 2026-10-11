'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpc } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { toast } from '@/shared/ui';

// Модератор проверил желание и оставил его: жалобы сбрасываются и больше его не скрывают.
export function useRestoreWish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rpc('restore_post', { p_post: id }),
    onSuccess: () => toast('Желание оставлено'),
    onError: (e) => toast(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries(),
  });
}
