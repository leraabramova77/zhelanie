import { getSupabase } from '@/shared/api';

export async function signInWithGitHub() {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.href.split('#')[0].split('?')[0] },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await getSupabase().auth.signOut();
}
