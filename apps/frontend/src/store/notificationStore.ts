import { create } from 'zustand';
import api from '../lib/api';

export interface Notification {
  id: number;
  userId: number;
  borrowRecordId: number;
  type: 'BORROW_OVERDUE' | 'BORROW_RETURNED';
  message: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

interface NotificationStore {
  notifications: Notification[];
  isLoading: boolean;
  isOpen: boolean;

  fetchNotifications: () => Promise<void>;
  resolveNotification: (id: number) => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  isLoading: false,
  isOpen: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<Notification[]>('/notifications');
      set({ notifications: res.data });
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      set({ isLoading: false });
    }
  },

  resolveNotification: async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/resolve`);
      // Update local state immediately without refetching
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isResolved: true, resolvedAt: new Date().toISOString() } : n,
        ),
      }));
    } catch (err) {
      console.error('Failed to resolve notification', err);
    }
  },

  togglePanel: () => {
    const { isOpen, fetchNotifications } = get();
    if (!isOpen) {
      void fetchNotifications();
    }
    set((state) => ({ isOpen: !state.isOpen }));
  },

  closePanel: () => set({ isOpen: false }),
}));