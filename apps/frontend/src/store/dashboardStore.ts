import { create } from 'zustand';
import api from '../lib/api';

export interface DashboardSummary {
  totalItems: number;
  activeEquipment: number;
  lowStockAlerts: number;
  pendingBorrows: number;
}

export interface LowStockItem {
  id: number;
  itemId: number;
  itemName: string;
  quantity: number;
  reorderPoint: number;
  unit: string;
  status: string;
}

export interface WarrantyAlert {
  id: number;
  itemName: string;
  assetId: string;
  warrantyEnd: string;
  warrantyProvider: string | null;
}

export interface DashboardAlerts {
  lowStock: LowStockItem[];
  warrantyExpiring: WarrantyAlert[];
}

export interface RecentActivity {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  performedAt: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

export interface EquipmentBreakdown {
  status: string;
  count: number;
}

interface DashboardState {
  summary: DashboardSummary | null;
  alerts: DashboardAlerts;
  recentActivity: RecentActivity[];
  equipmentBreakdown: EquipmentBreakdown[];
  isLoading: boolean;
  error: string | null;

  fetchSummary: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchRecentActivity: () => Promise<void>;
  fetchEquipmentBreakdown: () => Promise<void>;
  fetchAll: () => Promise<void>;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  summary: null,
  alerts: { lowStock: [], warrantyExpiring: [] },
  recentActivity: [],
  equipmentBreakdown: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchSummary: async () => {
    try {
      const response = await api.get<DashboardSummary>('/dashboard/summary');
      set({ summary: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || 'Failed to fetch dashboard summary' });
    }
  },

  fetchAlerts: async () => {
    try {
      const response = await api.get<DashboardAlerts>('/dashboard/alerts');
      set({ alerts: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || 'Failed to fetch alerts' });
    }
  },

  fetchRecentActivity: async () => {
    try {
      const response = await api.get<RecentActivity[]>('/dashboard/activity?limit=10');
      set({ recentActivity: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || 'Failed to fetch recent activity' });
    }
  },

  fetchEquipmentBreakdown: async () => {
    try {
      const response = await api.get<EquipmentBreakdown[]>('/dashboard/equipment-status');
      set({ equipmentBreakdown: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || 'Failed to fetch equipment status breakdown' });
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    await Promise.allSettled([
      get().fetchSummary(),
      get().fetchAlerts(),
      get().fetchRecentActivity(),
      get().fetchEquipmentBreakdown(),
    ]);
    set({ isLoading: false });
  },
}));
