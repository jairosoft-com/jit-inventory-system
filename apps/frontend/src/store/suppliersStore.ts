import { create } from 'zustand';
import api from '../lib/api';

export type SupplierStatus = 'active' | 'inactive';
export type SupplierStatusFilter = 'all' | SupplierStatus;

export interface Supplier {
  id: number;
  supplierName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  status: SupplierStatus;
  purchaseOrderCount: number;
}

interface SuppliersMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SuppliersResponse {
  data: Supplier[];
  meta: SuppliersMeta;
}

interface SuppliersState {
  suppliers: Supplier[];
  search: string;
  status: SupplierStatusFilter;
  page: number;
  limit: number;
  meta: SuppliersMeta;
  isLoading: boolean;
  error: string | null;

  fetchSuppliers: () => Promise<void>;
  setSearch: (search: string) => void;
  setStatus: (status: SupplierStatusFilter) => void;
  setPage: (page: number) => void;
  clearError: () => void;
}

export const useSuppliersStore = create<SuppliersState>((set, get) => ({
  suppliers: [],
  search: '',
  status: 'active' as SupplierStatusFilter,
  page: 1,
  limit: 20,
  meta: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  setSearch: (search) => {
    set({ search, page: 1 });
  },

  setStatus: (status) => {
    set({ status, page: 1 });
  },

  setPage: (page) => {
    set({ page });
  },

  fetchSuppliers: async () => {
    const { search, status, page, limit } = get();

    set({ isLoading: true, error: null });

    try {
      const response = await api.get<SuppliersResponse>('/suppliers', {
        params: {
          search: search.trim() || undefined,
          status,
          page,
          limit,
          _t: Date.now(),
        },
      });

      set({
        suppliers: response.data.data,
        meta: response.data.meta,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };

      set({
        error:
          err.response?.data?.message || 'Failed to fetch supplier records',
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));

