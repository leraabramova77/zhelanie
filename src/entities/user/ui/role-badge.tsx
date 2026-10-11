import { ROLE_LABEL, type Role } from '../model/role';

export function RoleBadge({ role }: { role: Role }) {
  if (role === 'member') return null;
  return (
    <span className={`role-badge ${role}`}>
      {role === 'president' ? '👑 ' : '🛡️ '}
      {ROLE_LABEL[role]}
    </span>
  );
}
