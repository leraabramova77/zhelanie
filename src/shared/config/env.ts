// Публичные настройки сборки. Значения подставляются в код при `next build`.
// В .env-файлах пустых значений не бывает: маркеры not-required / required-not-set означают «не задано».
const PLACEHOLDERS = new Set(['not-required', 'required-not-set']);
const read = (value: string | undefined) => (value && !PLACEHOLDERS.has(value.trim()) ? value.trim() : '');

export const env = {
  supabaseUrl: read(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: read(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  vapidPublicKey: read(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  schoolName: read(process.env.NEXT_PUBLIC_SCHOOL_NAME) || 'Наша школа',
  basePath: read(process.env.NEXT_PUBLIC_BASE_PATH),
};

export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

// Адрес файла из public/ с учётом подпапки GitHub Pages.
export const asset = (path: string) => `${env.basePath}${path}`;
