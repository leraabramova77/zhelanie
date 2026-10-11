import type { AiPick } from '@/entities/wish';

// Топ‑3 предложений недели по оценке ИИ-модератора (полезность для учеников и реальность исполнения).
export function AiPicks({ picks }: { picks: AiPick[] }) {
  if (picks.length === 0) return null;
  return (
    <section className="ai-picks">
      <div className="ai-picks-head">
        <span className="badge">🤖 Лучшие предложения по мнению ИИ</span>
        <span className="ai-picks-note">польза для учеников и реальность</span>
      </div>
      <ol className="ai-picks-list">
        {picks.map((p) => (
          <li key={p.id}>
            <div className="ai-pick-top">
              <p className="ai-pick-text">{p.text}</p>
              <span className="ai-score" title="Оценка ИИ">
                {p.aiScore}/10
              </span>
            </div>
            {p.aiComment && <p className="ai-pick-comment">{p.aiComment}</p>}
          </li>
        ))}
      </ol>
      <p className="ai-picks-foot">Победителя всё равно выбирают ученики голосованием 🗳️</p>
    </section>
  );
}
