// Публичные настройки сборки. Значения подставляются в код при `next build`.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  schoolName: process.env.NEXT_PUBLIC_SCHOOL_NAME || 'Наша школа',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
};

export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

// Адрес файла из public/ с учётом подпапки GitHub Pages.
export const asset = (path: string) => `${env.basePath}${path}`;
