export function plural(n: number, [one, few, many]: [string, string, string]) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });

export function timeAgo(date: string | number) {
  const sec = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  if (sec > -60) return 'только что';
  if (sec > -3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (sec > -86400) return rtf.format(Math.round(sec / 3600), 'hour');
  return rtf.format(Math.round(sec / 86400), 'day');
}

export function weekLabel(weekId: string) {
  const [y, m, d] = weekId.split('-').map(Number);
  const f = (x: Date) => x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${f(new Date(y, m - 1, d))} — ${f(new Date(y, m - 1, d + 6))}`;
}

export function dateTime(date: string) {
  return new Date(date).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Что-то пошло не так');
