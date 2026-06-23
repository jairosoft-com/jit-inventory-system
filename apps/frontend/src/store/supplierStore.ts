import { create } from 'zustand';
import api from '../lib/api';

export type SupplierStatusFilter = 'all' | 'active' | 'inactive';

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
  status?: string;
  purchaseOrderCount?: number;
  _count?: {
    purchaseOrders: number;
  };
}

export interface SupplierHistory {
  id: number;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | string;
  performedBy: string;
  performedAt: string;
  oldData: unknown;
  newData: unknown;
}

export interface CreateSupplierInput {
  supplierName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
}

export interface UpdateSupplierInput {
  supplierName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface SupplierPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SupplierListQuery {
  search?: string;
  status?: SupplierStatusFilter;
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}

interface SupplierListResponse {
  data: Supplier[];
  meta?: SupplierPaginationMeta;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

interface SupplierState {
  suppliers: Supplier[];
  supplierHistory: SupplierHistory[];
  meta: SupplierPaginationMeta;
  isLoading: boolean;
  error: string | null;

  fetchSuppliers: (query?: SupplierListQuery | boolean) => Promise<void>;
  createSupplier: (data: CreateSupplierInput) => Promise<Supplier>;
  updateSupplier: (id: number, data: UpdateSupplierInput) => Promise<Supplier>;
  archiveSupplier: (id: number) => Promise<void>;
  fetchSupplierHistory: (id: number) => Promise<void>;
  clearError: () => void;
}

const DEFAULT_META: SupplierPaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

function normalizeSupplier(supplier: Supplier): Supplier {
  const purchaseOrderCount =
    supplier.purchaseOrderCount ?? supplier._count?.purchaseOrders ?? 0;

  return {
    ...supplier,
    status: supplier.status ?? (supplier.deletedAt ? 'inactive' : 'active'),
    purchaseOrderCount,
    _count: supplier._count ?? { purchaseOrders: purchaseOrderCount },
  };
}

function normalizeSupplierResponse(
  responseData: Supplier[] | SupplierListResponse,
): { suppliers: Supplier[]; meta: SupplierPaginationMeta } {
  if (Array.isArray(responseData)) {
    const suppliers = responseData.map(normalizeSupplier);

    return {
      suppliers,
      meta: {
        page: 1,
        limit: suppliers.length || DEFAULT_META.limit,
        total: suppliers.length,
        totalPages: 1,
      },
    };
  }

  if (Array.isArray(responseData?.data)) {
    const suppliers = responseData.data.map(normalizeSupplier);

    return {
      suppliers,
      meta: {
        ...DEFAULT_META,
        ...responseData.meta,
        total: responseData.meta?.total ?? suppliers.length,
        totalPages: responseData.meta?.totalPages ?? 1,
      },
    };
  }

  return { suppliers: [], meta: DEFAULT_META };
}

function normalizeQuery(query?: SupplierListQuery | boolean): SupplierListQuery {
  if (typeof query === 'boolean') {
    return { includeArchived: query };
  }

  return query ?? {};
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as ApiError;
  return err.response?.data?.message || err.message || fallback;
}

export const useSupplierStore = create<SupplierState>((set) => ({
  suppliers: [],
  supplierHistory: [],
  meta: DEFAULT_META,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchSuppliers: async (query) => {
    set({ isLoading: true, error: null });

    try {
      const params = normalizeQuery(query);
      const response = await api.get<Supplier[] | SupplierListResponse>(
        '/suppliers',
        { params },
      );

      const { suppliers, meta } = normalizeSupplierResponse(response.data);

      set({ suppliers, meta, isLoading: false });
    } catch (error: unknown) {
      set({
        error: getErrorMessage(error, 'Failed to fetch suppliers'),
        isLoading: false,
      });
    }
  },

  createSupplier: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<Supplier>('/suppliers', data);
      const newSupplier = normalizeSupplier(response.data);

      set((state) => ({
        suppliers: [...state.suppliers, newSupplier].sort((a, b) =>
          a.supplierName.localeCompare(b.supplierName),
        ),
        meta: {
          ...state.meta,
          total: state.meta.total + 1,
        },
        isLoading: false,
      }));

      return newSupplier;
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error, 'Failed to create supplier');
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  updateSupplier: async (id, data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.put<Supplier>(`/suppliers/${id}`, data);
      const updatedSupplier = normalizeSupplier(response.data);

      set((state) => ({
        suppliers: state.suppliers
          .map((supplier) =>
            supplier.id === id ? updatedSupplier : supplier,
          )
          .sort((a, b) => a.supplierName.localeCompare(b.supplierName)),
        isLoading: false,
      }));

      return updatedSupplier;
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error, 'Failed to update supplier');
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  archiveSupplier: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.patch<Supplier>(`/suppliers/${id}/archive`);
      const updatedSupplier = normalizeSupplier(response.data);

      set((state) => ({
        suppliers: state.suppliers.map((supplier) =>
          supplier.id === id ? updatedSupplier : supplier,
        ),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error, 'Failed to archive supplier');
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  fetchSupplierHistory: async (id) => {
    set({ isLoading: true, error: null, supplierHistory: [] });

    try {
      const response = await api.get<SupplierHistory[]>(
        `/suppliers/${id}/history`,
      );

      set({ supplierHistory: response.data, isLoading: false });
    } catch (error: unknown) {
      const errMsg = getErrorMessage(
        error,
        'Failed to fetch supplier history',
      );

      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },
}));