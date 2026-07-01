import { create } from 'zustand';
import api from '../lib/api';

export type ProcurementAlertType = 'PENDING_APPROVAL' | 'STATUS_UPDATED';

export interface ProcurementAlert {
  id: number;
  purchaseOrderId: number;
  alertType: ProcurementAlertType;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  purchaseOrder: {
    id: number;
    status: string;
    totalAmount: string;
    supplier: { id: number; supplierName: string };
    createdBy: { id: number; firstName: string; lastName: string };
  };
}

interface ProcurementAlertState {
  alerts: ProcurementAlert[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  fetchUnread: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  reset: () => void;
}

export const useProcurementAlertStore = create<ProcurementAlertState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchUnread: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<ProcurementAlert[]>('/procurement-alerts');
      const unread = res.data.filter((a) => !a.isRead);
      set({ alerts: unread, unreadCount: unread.length, isLoading: false });
    } catch {
      set({ error: 'Failed to load procurement alerts.', isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.get<ProcurementAlert[]>('/procurement-alerts');
      const unread = res.data.filter((a) => !a.isRead);
      set({ unreadCount: unread.length });
    } catch {
      // Silently fail for polling
    }
  },

  markAsRead: async (id: number) => {
    try {
      await api.patch(`/procurement-alerts/${id}/read`);
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === id ? { ...a, isRead: true, readAt: new Date().toISOString() } : a,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // ignore
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/procurement-alerts/read-all');
      set((state) => ({
        alerts: state.alerts.map((a) => ({
          ...a,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch {
      // ignore
    }
  },

  reset: () => set({
    alerts: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
  }),
}));