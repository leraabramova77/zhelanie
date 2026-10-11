'use client';

export const REASONS = ['мат', 'оскорбление', 'спам', 'не по теме', 'другое'] as const;
export type Reason = (typeof REASONS)[number];

interface Props {
  title: string;
  danger?: boolean;
  onPick: (reason: Reason) => void;
  onCancel: () => void;
}

// Инлайн-выбор причины — для жалобы и для удаления модератором.
export function ReasonPicker({ title, danger, onPick, onCancel }: Props) {
  return (
    <div className="reason-picker">
      <span className="muted small">{title}</span>
      <div className="reason-list">
        {REASONS.map((r) => (
          <button key={r} type="button" className={`reason${danger ? ' danger' : ''}`} onClick={() => onPick(r)}>
            {r}
          </button>
        ))}
        <button type="button" className="link-btn muted" onClick={onCancel}>
          отмена
        </button>
      </div>
    </div>
  );
}
