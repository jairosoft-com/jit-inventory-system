import { create } from 'zustand';
import api from '../lib/api';
import type { AlertCategoryFilter } from './alertStore';

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

interface ProcurementAlertHistoryParams {
  category?: AlertCategoryFilter;
}

interface ProcurementAlertState {
  alerts: ProcurementAlert[];
  historyAlerts: ProcurementAlert[];
  unreadCount: number;
  isLoading: boolean;
  isHistoryLoading: boolean;
  error: string | null;
  historyError: string | null;

  fetchUnread: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  fetchHistory: (params?: ProcurementAlertHistoryParams) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  reset: () => void;
}

const PROCUREMENT_ALERT_TYPES: ProcurementAlertType[] = [
  'PENDING_APPROVAL',
  'STATUS_UPDATED',
];

function getProcurementAlertType(
  category?: AlertCategoryFilter,
): ProcurementAlertType | undefined {
  return PROCUREMENT_ALERT_TYPES.includes(category as ProcurementAlertType)
    ? (category as ProcurementAlertType)
    : undefined;
}

export const useProcurementAlertStore = create<ProcurementAlertState>((set, get) => ({
  alerts: [],
  historyAlerts: [],
  unreadCount: 0,
  isLoading: false,
  isHistoryLoading: false,
  error: null,
  historyError: null,

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

  fetchHistory: async (params) => {
    const category = params?.category ?? 'ALL';
    const alertType = getProcurementAlertType(category);

    if (category !== 'ALL' && !alertType) {
      set({ historyAlerts: [], isHistoryLoading: false, historyError: null });
      return;
    }

    set({ isHistoryLoading: true, historyError: null });
    try {
      const res = await api.get<{ alerts: ProcurementAlert[] }>('/procurement-alerts/history', {
        params: {
          page: 1,
          pageSize: 50,
          ...(alertType && { alertType }),
        },
      });

      set({ historyAlerts: res.data.alerts, isHistoryLoading: false });
    } catch {
      set({
        historyError: 'Failed to load procurement notification history.',
        isHistoryLoading: false,
      });
    }
  },

  markAsRead: async (id: number) => {
    try {
      await api.patch(`/procurement-alerts/${id}/read`);
      const readAt = new Date().toISOString();
      set((state) => ({
        alerts: state.alerts.map((alert) =>
          alert.id === id ? { ...alert, isRead: true, readAt } : alert,
        ),
        historyAlerts: state.historyAlerts.map((alert) =>
          alert.id === id ? { ...alert, isRead: true, readAt } : alert,
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
      const readAt = new Date().toISOString();
      set((state) => ({
        alerts: state.alerts.map((alert) => ({ ...alert, isRead: true, readAt })),
        historyAlerts: state.historyAlerts.map((alert) => ({
          ...alert,
          isRead: true,
          readAt,
        })),
        unreadCount: 0,
      }));
    } catch {
      // ignore
    }
  },

  reset: () =>
    set({
      alerts: [],
      historyAlerts: [],
      unreadCount: 0,
      isLoading: false,
      isHistoryLoading: false,
      error: null,
      historyError: null,
    }),
}));