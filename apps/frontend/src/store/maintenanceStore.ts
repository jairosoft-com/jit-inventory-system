import { create } from 'zustand';
import api from '../lib/api';

export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface MaintenanceLog {
  id: number;
  equipmentId: number;
  description: string;
  status: MaintenanceStatus;
  scheduledDate: string | null;
  completedDate: string | null;
  cost: number | null;
  performedById: number | null;
  performedByVendor: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  equipment: {
    id: number;
    assetId: string;
    serialNumber: string | null;
    brand: string | null;
    model: string | null;
    status: string;
    condition: string;
    item: {
      itemName: string;
    };
  };
  performedBy?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  equipmentName?: string | null;
  equipmentCondition?: string | null;
  equipmentBrand?: string | null;
  equipmentModel?: string | null;
}

export interface ListMaintenanceLogsQuery {
  status?: MaintenanceStatus;
  equipmentId?: number;
  search?: string;
  tab?: 'upcoming' | 'history' | 'all';
  page?: number;
  limit?: number;
}

export interface ScheduleMaintenanceInput {
  description: string;
  scheduledDate: string;
  performedById?: number | null;
  performedByVendor?: string | null;
  notes?: string | null;
}

export interface UpdateMaintenanceScheduleInput {
  description?: string;
  scheduledDate?: string;
  performedById?: number | null;
  performedByVendor?: string | null;
  notes?: string | null;
  status?: MaintenanceStatus;
  cost?: number | null;
  completedDate?: string | null;
  postMaintenanceCondition?: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MaintenanceState {
  maintenanceLogs: MaintenanceLog[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | null;

  fetchMaintenanceLogs: (query?: ListMaintenanceLogsQuery) => Promise<void>;
  createMaintenanceLog: (equipmentId: number, description: string) => Promise<MaintenanceLog>;
  scheduleMaintenance: (id: number, data: ScheduleMaintenanceInput) => Promise<MaintenanceLog>;
  updateMaintenanceSchedule: (id: number, data: UpdateMaintenanceScheduleInput) => Promise<MaintenanceLog>;
  clearError: () => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set, get) => ({
  maintenanceLogs: [],
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchMaintenanceLogs: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (query?.status) params.status = query.status;
      if (query?.equipmentId) params.equipmentId = String(query.equipmentId);
      if (query?.search) params.search = query.search;
      if (query?.tab) params.tab = query.tab;
      if (query?.page) params.page = String(query.page);
      if (query?.limit) params.limit = String(query.limit);

      const response = await api.get<{ data: MaintenanceLog[]; meta: PaginationMeta }>('/maintenance-logs', {
        params,
      });

      set({
        maintenanceLogs: response.data.data,
        meta: response.data.meta,
        isLoading: false,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch maintenance logs',
        isLoading: false,
      });
    }
  },

  createMaintenanceLog: async (equipmentId, description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<MaintenanceLog>('/maintenance-logs', {
        equipmentId,
        description,
      });
      const created = response.data;
      await get().fetchMaintenanceLogs({ page: 1 });
      return created;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errMsg = err.response?.data?.message || 'Failed to create maintenance record';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  scheduleMaintenance: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<MaintenanceLog>(`/maintenance-logs/${id}/schedule`, data);
      const updated = response.data;
      set((state) => ({
        maintenanceLogs: state.maintenanceLogs.map((log) => (log.id === id ? updated : log)),
        isLoading: false,
      }));
      return updated;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errMsg = err.response?.data?.message || 'Failed to schedule maintenance';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  updateMaintenanceSchedule: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<MaintenanceLog>(`/maintenance-logs/${id}`, data);
      const updated = response.data;
      set((state) => ({
        maintenanceLogs: state.maintenanceLogs.map((log) => (log.id === id ? updated : log)),
        isLoading: false,
      }));
      return updated;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errMsg = err.response?.data?.message || 'Failed to update maintenance record';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },
}));
