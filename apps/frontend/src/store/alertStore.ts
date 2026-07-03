import { create } from 'zustand';
import api from '../lib/api';

export type AlertPriority = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'WARRANTY_EXPIRING' | 'REPLACEMENT_NEEDED' | 'MAINTENANCE_DUE' | 'OVERDUE_EQUIPMENT' | 'BORROW_RETURNED';

export interface UnifiedAlert {
  id: string; // Combined format: 'stock-1' or 'm-1' to avoid key collisions
  alertType: AlertType;
  priority: AlertPriority;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  sourceType: 'stock' | 'maintenance';
  originalId: number;
  resolvedAt: string | null;
  consumableProfile?: {
    quantity: number;
    reorderPoint: number;
    unit: string;
    item: { id: number; itemName: string };
  } | null;
  equipment?: {
    id: number;
    assetId: string;
    warrantyEnd: string | null;
    item: { id: number; itemName: string; category: { id: number; name: string } };
  } | null;
}

interface AlertState {
  alerts: UnifiedAlert[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  fetchUnreadCount: () => Promise<void>;
  fetchUnread: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toggleOpen: () => void;
  close: () => void;
  reset: () => void;
}

// Filter out alerts older than 24 hours client-side as a safety net.
// Only applies to stock alerts (LOW_STOCK/OUT_OF_STOCK), which are
// recreated/refreshed frequently. Equipment lifecycle alerts
// (WARRANTY_EXPIRING/REPLACEMENT_NEEDED) are long-lived by design — an
// expired warranty or a replacement tag can stay open for weeks — and
// runWarrantyScan() updates the same alert row in place rather than
// recreating it, so createdAt does not reflect how current the alert is.
const ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PERSISTENT_ALERT_TYPES: AlertType[] = ['WARRANTY_EXPIRING', 'REPLACEMENT_NEEDED', 'OVERDUE_EQUIPMENT', 'BORROW_RETURNED'];

function filterFreshAlerts(alerts: UnifiedAlert[]): UnifiedAlert[] {
  const cutoff = Date.now() - ALERT_MAX_AGE_MS;
  return alerts.filter(
    (a) => PERSISTENT_ALERT_TYPES.includes(a.alertType) || new Date(a.createdAt).getTime() > cutoff,
  );
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
      const stockRes = await api.get<{ count: number }>('/alerts/count');
      let maintCount = 0;
      try {
        const maintRes = await api.get<{ count: number }>('/maintenance-alerts/count');
        maintCount = maintRes.data.count;
      } catch {
        // Staff may not have maintenance alert permission — silently ignore
      }
      set({ unreadCount: stockRes.data.count + maintCount });
    } catch {
      // Silently fail for polling
    }
  },

fetchUnread: async () => {
    set({ isLoading: true, error: null });
    try {
      const stockRes = await api.get<{ alerts: any[]; count: number }>('/alerts/unread');
      let maintAlertsList: any[] = [];
      try {
        const maintRes = await api.get<{ alerts: any[]; count: number }>('/maintenance-alerts');
        maintAlertsList = maintRes.data.alerts;
      } catch {
        // Staff may not have maintenance alert permission — silently ignore
      }

      const stockAlerts: UnifiedAlert[] = stockRes.data.alerts.map((a) => ({
        id: `stock-${a.id}`,
        originalId: a.id,
        sourceType: 'stock',
        alertType: a.alertType,
        priority: a.priority,
        message: a.message,
        isRead: a.isRead,
        readAt: a.readAt,
        resolvedAt: a.resolvedAt ?? null,
        createdAt: a.createdAt,
      }));

const maintAlerts: UnifiedAlert[] = maintAlertsList.map((a) => ({
        id: `m-${a.id}`,
        originalId: a.id,
        sourceType: 'maintenance',
        alertType: 'MAINTENANCE_DUE',
        priority: 'WARNING',
        message: a.message,
        isRead: a.isRead,
        readAt: a.readAt,
        resolvedAt: a.resolvedAt ?? null,
        createdAt: a.createdAt,
      }));

      const combined = [...stockAlerts, ...maintAlerts];
      const fresh = filterFreshAlerts(combined);

      // Sort by newest first
      fresh.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      set({ alerts: fresh, unreadCount: fresh.length, isLoading: false });
    } catch {
      set({ error: 'Failed to load alerts.', isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    const isMaint = id.startsWith('m-');
    const rawId = parseInt(id.replace(/^(m-|stock-)/, ''), 10);
    if (isNaN(rawId)) {
      console.error('Invalid alert ID format:', id);
      return;
    }
    try {
      if (isMaint) {
        await api.patch(`/maintenance-alerts/${rawId}/read`);
      } else {
        await api.patch(`/alerts/${rawId}/read`);
      }
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
      await Promise.all([
        api.patch('/alerts/read-all'),
        api.patch('/maintenance-alerts/read-all'),
      ]);
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

