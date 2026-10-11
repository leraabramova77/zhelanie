import { create } from 'zustand';

export type AuthMode = 'login' | 'register' | 'password';

interface AuthDialogState {
  mode: AuthMode | null;
  open: (mode?: AuthMode) => void;
  close: () => void;
}

export const useAuthDialog = create<AuthDialogState>((set) => ({
  mode: null,
  open: (mode = 'login') => set({ mode }),
  close: () => set({ mode: null }),
}));

export const openSignIn = () => useAuthDialog.getState().open('login');
