import { getSupabase } from './supabase';

// Вызов Edge Function. Ошибку из ответа функции ({ error }) отдаём пользователю как есть.
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke<T>(name, { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    const payload = context ? await context.json().catch(() => null) : null;
    throw new Error(payload?.error || 'Сервер не ответил, попробуй ещё раз');
  }
  return data as T;
}
