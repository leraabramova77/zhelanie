import { create } from 'zustand';

export type ModTab = 'queue' | 'posts' | 'words' | 'people' | 'log';

export const useModTab = create<{ tab: ModTab; setTab: (tab: ModTab) => void }>((set) => ({
  tab: 'queue',
  setTab: (tab) => set({ tab }),
}));
