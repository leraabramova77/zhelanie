// Три ранга. Права проверяет база (supabase/schema.sql), здесь — только чтобы показать нужные кнопки.
export type Role = 'member' | 'moderator' | 'president';

export const ROLE_LABEL: Record<Role, string> = {
  member: 'ученик',
  moderator: 'модератор',
  president: 'президент',
};

const RANK: Record<Role, number> = { member: 1, moderator: 2, president: 3 };

export const canModerate = (role?: Role | null) => !!role && RANK[role] >= RANK.moderator;
export const canManageRoles = (role?: Role | null) => role === 'president';

export interface Profile {
  id: string;
  name: string;
  avatar: string | null;
  role: Role;
  banned: boolean;
}
