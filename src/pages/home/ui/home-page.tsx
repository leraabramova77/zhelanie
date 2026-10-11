'use client';

import { useBoardQuery } from '@/entities/wish';
import { AuthDialog, SignInButton } from '@/features/auth';
import { ProposeForm } from '@/features/propose-wish';
import { isBackendConfigured } from '@/shared/config';
import { errorMessage } from '@/shared/lib';
import { AiPicks } from '@/widgets/ai-picks';
import { Hero } from '@/widgets/hero';
import { WinnerCard } from '@/widgets/winner-card';
import { WinnersHistory } from '@/widgets/winners-history';
import { WishList } from '@/widgets/wish-list';

export function HomePage() {
  const board = useBoardQuery();
  const data = board.data;

  return (
    <>
      <Hero board={data} onDeadline={() => board.refetch()} />
      <main className="wrap stack-main">
        {!isBackendConfigured && (
          <section className="card">
            <h2>Сайт ещё не подключён к базе</h2>
            <p className="muted">
              Нужно задать NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY (см. docs/setup.md).
            </p>
          </section>
        )}
        {board.isPending && isBackendConfigured && <div className="card skeleton" aria-busy="true" />}
        {board.isError && (
          <section className="card">
            <h2>Не получилось загрузить желания</h2>
            <p className="muted">{errorMessage(board.error)}</p>
            <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => board.refetch()}>
              Попробовать снова
            </button>
          </section>
        )}
        {data && (
          <>
            <WinnerCard board={data} />
            {data.me ? (
              <ProposeForm board={data} />
            ) : (
              <section className="card signin-card">
                <h2>Хочешь предложить желание?</h2>
                <p className="muted">
                  Зарегистрируйся по логину и паролю — нужен только код школы. Каждый голосует один раз и предлагает
                  одно желание в неделю.
                </p>
                <SignInButton variant="primary" />
              </section>
            )}
            <AiPicks picks={data.aiTop} />
            <WishList board={data} />
            <WinnersHistory history={data.history} />
          </>
        )}
      </main>
      <footer className="wrap foot">
        Каждый понедельник начинается новое голосование, старые предложения удаляются через полторы недели.
      </footer>
      <AuthDialog />
    </>
  );
}
