import { create } from 'zustand';
import api from '../lib/api';

export type ProcurementAlertType = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PROCUREMENT_UPDATE';

export interface ProcurementAlert {
  id: string;
  alertType: ProcurementAlertType | string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface ProcurementAlertResponse {
  id: number | string;
  alertType?: ProcurementAlertType | string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface ProcurementAlertState {
  alerts: ProcurementAlert[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  fetchUnread: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  reset: () => void;
}

function mapProcurementAlert(alert: ProcurementAlertResponse): ProcurementAlert {
  return {
    id: String(alert.id),
    alertType: alert.alertType ?? 'PROCUREMENT_UPDATE',
    message: alert.message,
    isRead: alert.isRead,
    readAt: alert.readAt,
    createdAt: alert.createdAt,
  };
}

export const useProcurementAlertStore = create<ProcurementAlertState>((set) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchUnread: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<{
        alerts: ProcurementAlertResponse[];
        count?: number;
      }>('/procurement-alerts/unread');

      const alerts = response.data.alerts.map(mapProcurementAlert);

      set({
        alerts,
        unreadCount: response.data.count ?? alerts.filter((alert) => !alert.isRead).length,
        isLoading: false,
      });
    } catch {
      set({
        alerts: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
      });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.patch(`/procurement-alerts/${id}/read`);

      const readAt = new Date().toISOString();

      set((state) => ({
        alerts: state.alerts.map((alert) =>
          alert.id === id ? { ...alert, isRead: true, readAt } : alert,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Ignore so inventory/maintenance notifications continue working.
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/procurement-alerts/read-all');

      const readAt = new Date().toISOString();

      set((state) => ({
        alerts: state.alerts.map((alert) => ({ ...alert, isRead: true, readAt })),
        unreadCount: 0,
      }));
    } catch {
      // Ignore so inventory/maintenance notifications continue working.
    }
  },

  reset: () =>
    set({
      alerts: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
    }),
}));