'use client';

import Link from 'next/link';
import { useModOverviewQuery } from '@/entities/moderation';
import { useSession } from '@/entities/session';
import { AuthDialog, SignInButton } from '@/features/auth';
import { errorMessage } from '@/shared/lib';
import { ModerationPanel } from '@/widgets/moderation-panel';

export function ModerationPage() {
  const { session, ready } = useSession();
  const overview = useModOverviewQuery();

  return (
    <main className="wrap admin">
      <div className="admin-head">
        <h1>Модерация</h1>
        <Link href="/" className="muted">
          ← На сайт
        </Link>
      </div>

      {ready && !session && (
        <section className="card">
          <h2>Нужно войти</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Раздел «Модерация» доступен только президенту.
          </p>
          <SignInButton variant="primary" />
        </section>
      )}
      {session && overview.isPending && <div className="card skeleton" aria-busy="true" />}
      {overview.isError && (
        <section className="card">
          <h2>Только для президента</h2>
          <p className="muted">{errorMessage(overview.error)}. Раздел «Модерация» видит только президент.</p>
        </section>
      )}
      {overview.data && <ModerationPanel data={overview.data} myId={session?.user.id} />}
      <AuthDialog />
    </main>
  );
}
