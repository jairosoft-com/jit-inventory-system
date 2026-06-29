import { create } from 'zustand';
import api from '../lib/api';

export interface DashboardSummary {
  totalItems: number;
  activeEquipment: number;
  lowStockAlerts: number;
  pendingBorrows: number;
  totalInventoryItems: number;
  totalQuantityInStock: number;
  availableItems: number;
  lowStockItems: number;
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
  daysRemaining: number;
}

export interface ReplacementNeededItem {
  id: number;
  itemId: number;
  itemName: string;
  assetId: string;
  condition: string;
  status: string;
  acquisitionDate: string | null;
  lifecycleYears: number | null;
  replacementRecommendation: string;
  replacementReasons: string[];
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
  itemName: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

export interface EquipmentBreakdown {
  status: string;
  count: number;
}

export interface RecentPurchaseOrder {
  id: number;
  invoiceNumber: string | null;
  status: string;
  totalAmount: number;
  orderDate: string;
  supplier: {
    name: string;
  };
  createdBy: {
    firstName: string;
    lastName: string;
  };
  itemCount: number;
}

export interface ProcurementSummary {
  pendingOrders: number;
  completedOrders: number;
  recentPurchaseActivity: RecentPurchaseOrder[];
}

export interface StockMovement {
  date: string;
  stockIn: number;
  stockOut: number;
}

export interface EquipmentCondition {
  condition: string;
  count: number;
}

export interface InventoryDistribution {
  categoryId: number;
  categoryName: string;
  count: number;
}

export interface BorrowActivity {
  date: string;
  total: number;
  active: number;
  overdue: number;
  returned: number;
}

export interface AnalyticsData {
  stockMovements: StockMovement[];
  equipmentConditions: EquipmentCondition[];
  borrowActivity: BorrowActivity[];
  inventoryDistribution: InventoryDistribution[];
}

export interface BorrowSummary {
  activeBorrows: number;
  overdueBorrows: number;
  pendingBorrows: number;
}

export interface MostBorrowedItem {
  equipmentId: number;
  itemName: string;
  assetId: string;
  currentStatus: string;
  totalBorrows: number;
}

interface DashboardState {
  summary: DashboardSummary | null;
  alerts: DashboardAlerts;
  recentActivity: RecentActivity[];
  equipmentBreakdown: EquipmentBreakdown[];
  replacementNeeded: ReplacementNeededItem[];
  procurementSummary: ProcurementSummary | null;
  analytics: AnalyticsData | null;
  borrowSummary: BorrowSummary | null;
  mostBorrowed: MostBorrowedItem[];
  isLoading: boolean;
  isWarrantyAlertsLoading: boolean;
  isReplacementNeededLoading: boolean;
  error: string | null;

  fetchSummary: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchWarrantyAlerts: () => Promise<void>;
  fetchReplacementNeeded: () => Promise<void>;
  fetchRecentActivity: () => Promise<void>;
  fetchEquipmentBreakdown: () => Promise<void>;
  fetchProcurementSummary: () => Promise<void>;
  fetchAnalytics: () => Promise<void>;
  fetchBorrowSummary: () => Promise<void>;
  fetchMostBorrowed: () => Promise<void>;
  fetchAll: (hasAnalyticsPermission?: boolean) => Promise<void>;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  summary: null,
  alerts: { lowStock: [], warrantyExpiring: [] },
  recentActivity: [],
  equipmentBreakdown: [],
  replacementNeeded: [],
  procurementSummary: null,
  analytics: null,
  borrowSummary: null,
  mostBorrowed: [],
  isLoading: false,
  isWarrantyAlertsLoading: false,
  isReplacementNeededLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchSummary: async () => {
    try {
      const response = await api.get<DashboardSummary>('/dashboard/summary');
      set({ summary: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch dashboard summary',
      });
    }
  },

  fetchAlerts: async () => {
    try {
      const response = await api.get<DashboardAlerts>('/dashboard/alerts');
      set({ alerts: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch alerts',
      });
    }
  },

  fetchWarrantyAlerts: async () => {
    // isLoading covers the initial dashboard fetch, while isWarrantyAlertsLoading prevents duplicate manual refresh requests.
    if (get().isWarrantyAlertsLoading || get().isLoading) {
      return;
    }

    set({ isWarrantyAlertsLoading: true, error: null });

    try {
      const response = await api.get<WarrantyAlert[]>('/dashboard/warranty-alerts');

      set((state) => ({
        alerts: {
          ...state.alerts,
          warrantyExpiring: response.data,
        },
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch warranty expiration alerts',
      });
    } finally {
      set({ isWarrantyAlertsLoading: false });
    }
  },

  fetchReplacementNeeded: async () => {
    if (get().isReplacementNeededLoading) {
      return;
    }

    set({ isReplacementNeededLoading: true, error: null });

    try {
      const response = await api.get<ReplacementNeededItem[]>('/dashboard/replacement-needed');

      set({ replacementNeeded: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };

      set({
        error: err.response?.data?.message || 'Failed to fetch replacement-needed indicators',
      });
    } finally {
      set({ isReplacementNeededLoading: false });
    }
  },

  fetchRecentActivity: async () => {
    try {
      const response = await api.get<RecentActivity[]>('/dashboard/activity?limit=10');
      set({ recentActivity: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch recent activity',
      });
    }
  },

  fetchEquipmentBreakdown: async () => {
    try {
      const response = await api.get<EquipmentBreakdown[]>('/dashboard/equipment-status');
      set({ equipmentBreakdown: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch equipment status breakdown',
      });
    }
  },

  fetchProcurementSummary: async () => {
    try {
      const response = await api.get<ProcurementSummary>('/dashboard/procurement-summary');
      set({ procurementSummary: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || 'Failed to fetch procurement summary' });
    }
  },

  fetchAnalytics: async () => {
    try {
      const response = await api.get<AnalyticsData>('/dashboard/analytics');
      set({ analytics: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || 'Failed to fetch analytics' });
    }
  },

  fetchBorrowSummary: async () => {
    try {
      const response = await api.get<BorrowSummary>('/dashboard/borrow-summary');
      set({ borrowSummary: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch borrow summary',
      });
    }
  },

  fetchMostBorrowed: async () => {
    try {
      const response = await api.get<MostBorrowedItem[]>('/dashboard/most-borrowed');
      set({ mostBorrowed: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch most borrowed items',
      });
    }
  },

  fetchAll: async (hasAnalyticsPermission = false) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get(`/dashboard/all?analytics=${hasAnalyticsPermission}`);
      const {
        summary,
        alerts,
        recentActivity,
        equipmentBreakdown,
        replacementNeeded,
        procurementSummary,
        analytics,
        borrowSummary,
        mostBorrowed,
      } = response.data;

      set({
        summary,
        alerts,
        recentActivity,
        equipmentBreakdown,
        replacementNeeded,
        procurementSummary,
        analytics,
        borrowSummary,
        mostBorrowed,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch dashboard data',
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));
