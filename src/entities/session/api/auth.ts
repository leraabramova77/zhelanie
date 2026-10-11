import { getSupabase, invokeFunction } from '@/shared/api';

// Аккаунты — по логину и паролю. Внутри Supabase логин превращается в служебный адрес, который никто не видит.
const toEmail = (login: string) => `${login.trim().toLowerCase()}@zhelanie.local`;

export async function signIn(login: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email: toEmail(login), password });
  if (error) {
    throw new Error(
      /invalid/i.test(error.message) ? 'Неверный логин или пароль' : 'Не получилось войти, попробуй ещё раз',
    );
  }
}

export interface RegisterInput {
  name: string;
  login: string;
  password: string;
  code: string;
}

export async function register(input: RegisterInput) {
  const login = input.login.trim().toLowerCase();
  const result = await invokeFunction<{ role: string }>('account', { action: 'register', ...input, login });
  await signIn(login, input.password);
  return result.role;
}

export async function changePassword(password: string) {
  if (password.length < 6) throw new Error('Пароль: минимум 6 символов');
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw new Error('Не получилось сменить пароль');
}

export async function signOut() {
  await getSupabase().auth.signOut();
}
