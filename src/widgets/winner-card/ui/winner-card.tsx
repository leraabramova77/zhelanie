import type { Board } from '@/entities/wish';
import { weekLabel } from '@/shared/lib';

export function WinnerCard({ board }: { board: Board }) {
  const w = board.lastWinner;
  if (!w) return null;
  const runners = board.previous.filter((p) => p.text !== w.text).slice(0, 3);
  return (
    <section className="winner">
      <span className="badge">🏆 Победитель прошлой недели</span>
      <p className="winner-text">{w.text}</p>
      <p className="winner-meta">
        👍 {w.likes} · 👎 {w.dislikes} · {weekLabel(w.weekId)}
      </p>
      {runners.length > 0 && (
        <ol className="runners" start={2}>
          {runners.map((p) => (
            <li key={p.id}>
              {p.text} — 👍 {p.likes}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
