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
      // Server already filters isRead: false — no client-side filter needed
      set({ alerts: res.data, unreadCount: res.data.length, isLoading: false });
    } catch {
      set({ error: 'Failed to load procurement alerts.', isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.get<{ count: number }>('/procurement-alerts/count');
      set({ unreadCount: res.data.count });
    } catch {
      // Silently fail for polling
    }
  },

  markAsRead: async (id: number) => {
    try {
      await api.patch(`/procurement-alerts/${id}/read`);
      // Remove from panel immediately instead of just flipping the flag
      set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // ignore
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/procurement-alerts/read-all');
      // Clear all alerts from panel immediately
      set({ alerts: [], unreadCount: 0 });
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