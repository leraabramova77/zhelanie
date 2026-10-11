'use client';

import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (message: string) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    clearTimeout(timer);
    set({ message });
    timer = setTimeout(() => set({ message: null }), 3200);
  },
}));

export const toast = (message: string) => useToast.getState().show(message);

export function Toaster() {
  const message = useToast((s) => s.message);
  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
