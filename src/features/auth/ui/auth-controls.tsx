'use client';

import Link from 'next/link';
import { signOut } from '@/entities/session';
import { canModerate, type Profile, RoleBadge } from '@/entities/user';
import { useAuthDialog } from '../model/store';

export function SignInButton({ variant = 'chip' }: { variant?: 'chip' | 'primary' }) {
  const open = useAuthDialog((s) => s.open);
  if (variant === 'chip') {
    return (
      <button type="button" className="chip" onClick={() => open('login')}>
        Войти
      </button>
    );
  }
  return (
    <div className="auth-actions">
      <button type="button" className="btn" onClick={() => open('register')}>
        Зарегистрироваться
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => open('login')}>
        У меня есть аккаунт
      </button>
    </div>
  );
}

export function UserMenu({ me }: { me: Profile }) {
  const open = useAuthDialog((s) => s.open);
  return (
    <div className="userbar">
      {canModerate(me.role) && (
        <Link href="/moderation/" className="chip">
          Модерация
        </Link>
      )}
      <span className="username">{me.name}</span>
      <RoleBadge role={me.role} />
      <button type="button" className="chip" onClick={() => open('password')}>
        Пароль
      </button>
      <button type="button" className="chip" onClick={() => signOut()}>
        Выйти
      </button>
    </div>
  );
}
