import { create } from 'zustand';

export type Sort = 'top' | 'new';
export type PickerKind = 'report' | 'delete' | 'confirm-own';

interface WishListState {
  sort: Sort;
  picker: { id: string; kind: PickerKind } | null;
  setSort: (sort: Sort) => void;
  openPicker: (id: string, kind: PickerKind) => void;
  closePicker: () => void;
}

export const useWishListStore = create<WishListState>((set) => ({
  sort: 'top',
  picker: null,
  setSort: (sort) => set({ sort }),
  openPicker: (id, kind) => set({ picker: { id, kind } }),
  closePicker: () => set({ picker: null }),
}));
