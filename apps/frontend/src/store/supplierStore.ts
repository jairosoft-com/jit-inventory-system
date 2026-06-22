import { create } from 'zustand';
import api from '../lib/api';

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

interface SupplierListResponse {
  data: Supplier[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
  isLoading: boolean;
  error: string | null;

  fetchSuppliers: (includeArchived?: boolean) => Promise<void>;
  createSupplier: (data: CreateSupplierInput) => Promise<Supplier>;
  updateSupplier: (id: number, data: UpdateSupplierInput) => Promise<Supplier>;
  archiveSupplier: (id: number) => Promise<void>;
  fetchSupplierHistory: (id: number) => Promise<void>;
  clearError: () => void;
}

function normalizeSupplier(supplier: Supplier): Supplier {
  return {
    ...supplier,
    status: supplier.status ?? (supplier.deletedAt ? 'inactive' : 'active'),
    purchaseOrderCount:
      supplier.purchaseOrderCount ?? supplier._count?.purchaseOrders ?? 0,
  };
}

function normalizeSupplierResponse(
  responseData: Supplier[] | SupplierListResponse,
): Supplier[] {
  if (Array.isArray(responseData)) {
    return responseData.map(normalizeSupplier);
  }

  if (Array.isArray(responseData?.data)) {
    return responseData.data.map(normalizeSupplier);
  }

  return [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as ApiError;
  return err.response?.data?.message || err.message || fallback;
}

export const useSupplierStore = create<SupplierState>((set) => ({
  suppliers: [],
  supplierHistory: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchSuppliers: async (includeArchived = false) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<Supplier[] | SupplierListResponse>(
        '/suppliers',
        {
          params: { includeArchived },
        },
      );

      const suppliers = normalizeSupplierResponse(response.data);

      set({ suppliers, isLoading: false });
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