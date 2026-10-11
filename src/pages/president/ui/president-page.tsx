'use client';

import Link from 'next/link';
import { useModOverviewQuery } from '@/entities/moderation';
import { useSession } from '@/entities/session';
import { AuthDialog, SignInButton } from '@/features/auth';
import { BroadcastForm } from '@/features/broadcast';
import { UserManager } from '@/features/manage-user';
import { SchoolCodeForm } from '@/features/school-code';

// Кабинет президента: слева настройки (код школы, рассылка), справа — все люди и их ранги.
// На телефоне колонки идут друг под другом.
export function PresidentPage() {
  const { session, ready } = useSession();
  const overview = useModOverviewQuery();
  const data = overview.data;
  const isPresident = data?.role === 'president';

  return (
    <main className="wrap wrap-wide admin">
      <div className="admin-head">
        <h1>👑 Кабинет президента</h1>
        <div className="admin-links">
          <Link href="/moderation/" className="muted">
            Модерация
          </Link>
          <Link href="/" className="muted">
            ← На сайт
          </Link>
        </div>
      </div>

      {ready && !session && (
        <section className="card">
          <h2>Нужно войти</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Кабинет доступен только президенту.
          </p>
          <SignInButton variant="primary" />
        </section>
      )}
      {session && overview.isPending && <div className="card skeleton" aria-busy="true" />}
      {(overview.isError || (data && !isPresident)) && (
        <section className="card">
          <h2>Только для президента</h2>
          <p className="muted">Этот раздел видит только президент школьного совета.</p>
        </section>
      )}

      {data && isPresident && (
        <div className="president-grid">
          <div className="stack">
            <SchoolCodeForm current={data.schoolCode ?? ''} />
            <BroadcastForm subscribers={data.subscribers} />
          </div>
          <UserManager myRole={data.role} myId={session?.user.id} people={data.people} />
        </div>
      )}
      <AuthDialog />
    </main>
  );
}
