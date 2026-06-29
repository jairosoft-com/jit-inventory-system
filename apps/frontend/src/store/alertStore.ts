import { create } from 'zustand';
import api from '../lib/api';

export type AlertPriority = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryAlert {
  id: number;
  alertType: AlertType;
  priority: AlertPriority;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
  consumableProfile: {
    quantity: number;
    reorderPoint: number;
    unit: string;
    item: { id: number; itemName: string };
  };
}

interface AlertState {
  alerts: InventoryAlert[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  fetchUnreadCount: () => Promise<void>;
  fetchUnread: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toggleOpen: () => void;
  close: () => void;
  reset: () => void;
}

// Filter out alerts older than 24 hours client-side as a safety net
const ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function filterFreshAlerts(alerts: InventoryAlert[]): InventoryAlert[] {
  const cutoff = Date.now() - ALERT_MAX_AGE_MS;
  return alerts.filter((a) => new Date(a.createdAt).getTime() > cutoff);
}

// Poll interval for the badge count (every 60 seconds)
export const ALERT_POLL_INTERVAL_MS = 60_000;

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  isOpen: false,
  isLoading: false,
  error: null,

  fetchUnreadCount: async () => {
    try {
      const res = await api.get<{ count: number }>('/alerts/count');
      set({ unreadCount: res.data.count });
    } catch {
      // Silently fail for polling
    }
  },

  fetchUnread: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{ alerts: InventoryAlert[]; count: number }>('/alerts/unread');
      const fresh = filterFreshAlerts(res.data.alerts);
      set({ alerts: fresh, unreadCount: fresh.length, isLoading: false });
    } catch {
      set({ error: 'Failed to load alerts.', isLoading: false });
    }
  },

  markAsRead: async (id: number) => {
    try {
      await api.patch(`/alerts/${id}/read`);
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
      await api.patch('/alerts/read-all');
      set((state) => ({
        alerts: state.alerts.map((a) => ({ ...a, isRead: true, readAt: new Date().toISOString() })),
        unreadCount: 0,
      }));
    } catch {
      // ignore
    }
  },

  toggleOpen: () => {
    const { isOpen, fetchUnread } = get();
    const next = !isOpen;
    set({ isOpen: next });
    if (next) void fetchUnread();
  },

  close: () => set({ isOpen: false }),

  reset: () => set({
    alerts: [],
    unreadCount: 0,
    isOpen: false,
    isLoading: false,
    error: null,
  }),
}));