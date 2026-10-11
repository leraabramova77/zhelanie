'use client';

import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { getSupabase } from '@/shared/api';
import { isBackendConfigured } from '@/shared/config';

interface SessionState {
  session: Session | null;
  ready: boolean;
}

export const useSession = create<SessionState>(() => ({ session: null, ready: !isBackendConfigured }));

export const useUserId = () => useSession((s) => s.session?.user.id ?? null);

let started = false;

// Подписывается на изменения входа в Supabase. Вызывается один раз из провайдера приложения.
export function startSessionSync() {
  if (started || !isBackendConfigured) return () => {};
  started = true;
  const supabase = getSupabase();
  supabase.auth.getSession().then(({ data }) => useSession.setState({ session: data.session, ready: true }));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => useSession.setState({ session, ready: true }));
  return () => {
    started = false;
    data.subscription.unsubscribe();
  };
}
