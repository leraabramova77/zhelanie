import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isBackendConfigured } from '@/shared/config';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isBackendConfigured) throw new Error('Сайт ещё не подключён к базе данных');
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
  });
  return client;
}

// Вызов SQL-функции из supabase/schema.sql. Текст ошибки из базы уже написан для пользователя.
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) {
    if (error.code === '42501') throw new Error('Войди в аккаунт, чтобы продолжить');
    throw new Error(error.message || 'Что-то пошло не так, попробуй ещё раз');
  }
  return data as T;
}
