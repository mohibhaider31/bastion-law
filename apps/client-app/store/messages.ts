import { create } from 'zustand';

interface MessagesState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
}));
