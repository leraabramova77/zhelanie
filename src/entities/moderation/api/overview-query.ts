'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/entities/session';
import type { Role } from '@/entities/user';
import { rpc } from '@/shared/api';

export interface ModWish {
  id: string;
  text: string;
  createdAt: string;
  authorId: string;
  authorName: string | null;
  hidden: boolean;
  likes: number;
  dislikes: number;
  reports: number;
  reasons: string | null;
  aiStatus: 'pending' | 'ok' | 'skipped';
  aiScore: number | null;
  aiReason: string | null;
}

export interface ModLogEntry {
  at: string;
  actor: string | null;
  action: string;
  details: string;
}

export interface ModOverview {
  role: Role;
  schoolCode: string | null;
  threshold: number;
  queue: ModWish[];
  posts: ModWish[];
  words: string[];
  log: ModLogEntry[];
  subscribers: number;
}

export interface ModUser {
  id: string;
  name: string;
  login: string | null;
  avatar: string | null;
  role: Role;
  banned: boolean;
  posts: number;
}

export const modKeys = {
  all: ['moderation'] as const,
  overview: ['moderation', 'overview'] as const,
  users: (q: string) => ['moderation', 'users', q] as const,
};

export function useModOverviewQuery() {
  const session = useSession((s) => s.session);
  return useQuery({
    queryKey: modKeys.overview,
    queryFn: () => rpc<ModOverview>('mod_overview'),
    enabled: !!session,
    refetchInterval: 30_000,
  });
}

export function useUsersQuery(query: string) {
  return useQuery({
    queryKey: modKeys.users(query),
    queryFn: () => rpc<ModUser[]>('search_users', { p_query: query }),
  });
}

export const ACTION_LABEL: Record<string, string> = {
  delete_post: 'удалил(а) желание',
  ai_remove: 'удалил желание',
  restore_post: 'оставил(а) желание после жалоб',
  add_word: 'добавил(а) запретное слово',
  remove_word: 'убрал(а) запретное слово',
  set_role: 'изменил(а) роль',
  ban: 'заблокировал(а)',
  unban: 'разблокировал(а)',
  broadcast: 'отправил(а) уведомление всем',
  reset_password: 'выдал(а) временный пароль',
  set_school_code: 'изменил(а) код школы',
};
