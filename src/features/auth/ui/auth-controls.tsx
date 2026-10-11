'use client';

import Link from 'next/link';
import { signInWithGitHub, signOut } from '@/entities/session';
import { canModerate, type Profile, RoleBadge } from '@/entities/user';
import { errorMessage } from '@/shared/lib';
import { GitHubIcon, toast } from '@/shared/ui';

const startSignIn = () => signInWithGitHub().catch((e) => toast(errorMessage(e)));

export function SignInButton({ variant = 'chip' }: { variant?: 'chip' | 'primary' }) {
  return (
    <button type="button" className={variant === 'chip' ? 'chip' : 'btn'} onClick={startSignIn}>
      <GitHubIcon /> {variant === 'chip' ? 'Войти' : 'Войти через GitHub'}
    </button>
  );
}

export function UserMenu({ me }: { me: Profile }) {
  return (
    <div className="userbar">
      {canModerate(me.role) && (
        <Link href="/moderation/" className="chip">
          Модерация
        </Link>
      )}
      {me.avatar && <img src={me.avatar} alt="" className="avatar" width={28} height={28} />}
      <span className="username">{me.name}</span>
      <RoleBadge role={me.role} />
      <button type="button" className="chip" onClick={() => signOut()}>
        Выйти
      </button>
    </div>
  );
}

export { startSignIn };
