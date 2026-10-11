import type { Winner } from '@/entities/wish';
import { weekLabel } from '@/shared/lib';

export function WinnersHistory({ history }: { history: Winner[] }) {
  if (history.length === 0) return null;
  return (
    <details className="card history">
      <summary>Прошлые победители</summary>
      <ol>
        {history.map((h) => (
          <li key={h.weekId}>
            {h.text}{' '}
            <small>
              · {weekLabel(h.weekId)} · 👍 {h.likes}
            </small>
          </li>
        ))}
      </ol>
    </details>
  );
}
