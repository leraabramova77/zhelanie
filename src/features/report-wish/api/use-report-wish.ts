'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { boardKeys } from '@/entities/wish';
import { rpc } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { type Reason, toast } from '@/shared/ui';

export function useReportWish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: Reason }) =>
      rpc<{ hidden: boolean }>('report_post', { p_post: id, p_reason: reason }),
    onSuccess: (r) =>
      toast(r.hidden ? 'Спасибо! Желание скрыто до проверки модератором' : 'Спасибо, жалоба отправлена'),
    onError: (e) => toast(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardKeys.all }),
  });
}
