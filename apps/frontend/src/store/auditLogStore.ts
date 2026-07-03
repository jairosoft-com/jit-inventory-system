import { create } from 'zustand';
import api from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'APPROVED'
  | 'REJECTED'
  | 'BORROWED'
  | 'RETURNED'
  | 'DISPOSED'
  | 'TRANSFERRED'
  | 'MAINTENANCE_STARTED'
  | 'MAINTENANCE_COMPLETED'
  | 'RENEWED';

export interface AuditLog {
  id: number;
  entityType: string;
  entityId: number;
  action: AuditAction;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  performedBy: number;
  performedAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: number;
  action?: AuditAction | '';
  performedBy?: number;
  startDate?: string;
  endDate?: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface AuditLogState {
  logs: AuditLog[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  filters: AuditLogFilters;

  fetchLogs: (page?: number, limit?: number) => Promise<void>;
  setFilters: (filters: Partial<AuditLogFilters>) => void;
  clearFilters: () => void;
  clearError: () => void;
}

const emptyMeta: PaginationMeta = { total: 0, page: 1, limit: 25, totalPages: 0 };

export const useAuditLogStore = create<AuditLogState>((set, get) => ({
  logs: [],
  meta: emptyMeta,
  isLoading: false,
  error: null,
  filters: {},

  clearError: () => set({ error: null }),

  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),

  clearFilters: () => set({ filters: {} }),

  fetchLogs: async (page = 1, limit = 25) => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
      };
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.entityId !== undefined) params.entityId = String(filters.entityId);
      if (filters.action) params.action = filters.action;
      if (filters.performedBy !== undefined) params.performedBy = String(filters.performedBy);
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res = await api.get<{ data: AuditLog[]; meta: PaginationMeta }>('/audit-logs', {
        params,
      });
      set({ logs: res.data.data, meta: res.data.meta, isLoading: false });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to load audit logs',
        isLoading: false,
      });
    }
  },
}));
