import { create } from 'zustand';
import api from '../lib/api';

export type AlertPriority = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERDUE_EQUIPMENT' | 'MAINTENANCE_DUE';
export type AlertCategoryFilter = 'ALL' | AlertType;

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
  borrowRecord?: {
    id: number;
    expectedReturn: string;
    status: string;
    equipment: {
      assetId: string;
      item: { id: number; itemName: string };
    };
    borrowedBy: { id: number; firstName: string; lastName: string };
  } | null;
}

interface StockAlertResponse {
  id: number;
  alertType: Exclude<AlertType, 'MAINTENANCE_DUE'>;
  priority: AlertPriority;
  message: string;
  isRead: boolean;
  readAt: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  consumableProfile?: UnifiedAlert['consumableProfile'];
  borrowRecord?: UnifiedAlert['borrowRecord'];
}

interface MaintenanceAlertResponse {
  id: number;
  alertType?: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface AlertHistoryParams {
  category?: AlertCategoryFilter;
}

interface AlertState {
  alerts: UnifiedAlert[];
  historyAlerts: UnifiedAlert[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  isHistoryLoading: boolean;
  error: string | null;
  historyError: string | null;
  historyCategory: AlertCategoryFilter;

  fetchUnreadCount: () => Promise<void>;
  fetchUnread: () => Promise<void>;
  fetchHistory: (params?: AlertHistoryParams) => Promise<void>;
  scanAlerts: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toggleOpen: () => void;
  close: () => void;
  reset: () => void;
}

// Filter out alerts older than 24 hours client-side as a safety net for the current dropdown
const ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function filterFreshAlerts(alerts: UnifiedAlert[]): UnifiedAlert[] {
  const cutoff = Date.now() - ALERT_MAX_AGE_MS;
  return alerts.filter((a) => new Date(a.createdAt).getTime() > cutoff);
}

function mapStockAlert(a: StockAlertResponse): UnifiedAlert {
  return {
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
    consumableProfile: a.consumableProfile ?? null,
    borrowRecord: a.borrowRecord ?? null,
  };
}

function mapMaintenanceAlert(a: MaintenanceAlertResponse): UnifiedAlert {
  return {
    id: `m-${a.id}`,
    originalId: a.id,
    sourceType: 'maintenance',
    alertType: 'MAINTENANCE_DUE',
    priority: 'WARNING',
    message: a.message,
    isRead: a.isRead,
    readAt: a.readAt,
    resolvedAt: null,
    createdAt: a.createdAt,
  };
}

function sortAlertsNewestFirst(alerts: UnifiedAlert[]): UnifiedAlert[] {
  return [...alerts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function getStockAlertType(category: AlertCategoryFilter): Exclude<AlertType, 'MAINTENANCE_DUE'> | undefined {
  return category !== 'ALL' && category !== 'MAINTENANCE_DUE' ? category : undefined;
}

// Poll interval for the badge count (every 60 seconds)
export const ALERT_POLL_INTERVAL_MS = 60_000;

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  historyAlerts: [],
  unreadCount: 0,
  isOpen: false,
  isLoading: false,
  isHistoryLoading: false,
  error: null,
  historyError: null,
  historyCategory: 'ALL',

  fetchUnreadCount: async () => {
    try {
      const [stockRes, maintRes] = await Promise.all([
        api.get<{ count: number }>('/alerts/count'),
        api.get<{ count: number }>('/maintenance-alerts/count'),
      ]);
      set({ unreadCount: stockRes.data.count + maintRes.data.count });
    } catch {
      // Silently fail for polling
    }
  },

  fetchUnread: async () => {
    set({ isLoading: true, error: null });
    try {
      const [stockRes, maintRes] = await Promise.all([
        api.get<{ alerts: StockAlertResponse[]; count: number }>('/alerts/unread'),
        api.get<{ alerts: MaintenanceAlertResponse[]; count: number }>('/maintenance-alerts'),
      ]);

      const stockAlerts = stockRes.data.alerts.map(mapStockAlert);
      const maintAlerts = maintRes.data.alerts.map(mapMaintenanceAlert);
      const fresh = filterFreshAlerts([...stockAlerts, ...maintAlerts]);

      set({ alerts: sortAlertsNewestFirst(fresh), isLoading: false });
    } catch {
      set({ error: 'Failed to load alerts.', isLoading: false });
    }
  },

  fetchHistory: async (params) => {
    const category = params?.category ?? get().historyCategory;
    set({ isHistoryLoading: true, historyError: null, historyCategory: category });

    try {
      const shouldFetchStock = category === 'ALL' || category !== 'MAINTENANCE_DUE';
      const shouldFetchMaintenance = category === 'ALL' || category === 'MAINTENANCE_DUE';
      const stockAlertType = getStockAlertType(category);

      const [stockRes, maintRes] = await Promise.all([
        shouldFetchStock
          ? api.get<{ alerts: StockAlertResponse[] }>('/alerts', {
              params: { page: 1, pageSize: 50, ...(stockAlertType && { alertType: stockAlertType }) },
            })
          : Promise.resolve({ data: { alerts: [] as StockAlertResponse[] } }),
        shouldFetchMaintenance
          ? api.get<{ alerts: MaintenanceAlertResponse[] }>('/maintenance-alerts/history', {
              params: { page: 1, pageSize: 50, alertType: 'MAINTENANCE_DUE' },
            })
          : Promise.resolve({ data: { alerts: [] as MaintenanceAlertResponse[] } }),
      ]);

      const stockAlerts = stockRes.data.alerts.map(mapStockAlert);
      const maintAlerts = maintRes.data.alerts.map(mapMaintenanceAlert);

      set({
        historyAlerts: sortAlertsNewestFirst([...stockAlerts, ...maintAlerts]),
        isHistoryLoading: false,
      });
    } catch {
      set({ historyError: 'Failed to load notification history.', isHistoryLoading: false });
    }
  },

  scanAlerts: async () => {
    try {
      await api.post('/alerts/scan');
    } catch {
      // Ignore scan errors so the refresh button can still reload existing notifications.
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
      const readAt = new Date().toISOString();
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? { ...a, isRead: true, readAt } : a)),
        historyAlerts: state.historyAlerts.map((a) =>
          a.id === id ? { ...a, isRead: true, readAt } : a,
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
      const readAt = new Date().toISOString();
      set((state) => ({
        alerts: state.alerts.map((a) => ({ ...a, isRead: true, readAt })),
        historyAlerts: state.historyAlerts.map((a) => ({ ...a, isRead: true, readAt })),
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
    historyAlerts: [],
    unreadCount: 0,
    isOpen: false,
    isLoading: false,
    isHistoryLoading: false,
    error: null,
    historyError: null,
    historyCategory: 'ALL',
  }),
}));