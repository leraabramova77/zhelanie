import type { AiPick } from '@/entities/wish';

// Топ‑3 предложений недели по оценке ИИ-модератора (полезность для учеников и реальность исполнения).
export function AiPicks({ picks }: { picks: AiPick[] }) {
  return (
    <section className="ai-picks">
      <div className="ai-picks-head">
        <span className="badge">🤖 Лучшие предложения по мнению ИИ</span>
        <span className="ai-picks-note">польза для учеников и реальность</span>
      </div>
      {picks.length === 0 && (
        <p className="ai-picks-empty">
          ИИ-модератор читает каждое новое желание: убирает мат, мемы и всё не по теме, а лучшие идеи (7 из 10 и выше)
          показывает здесь. Пока оценивать нечего — предложи первое желание!
        </p>
      )}
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
