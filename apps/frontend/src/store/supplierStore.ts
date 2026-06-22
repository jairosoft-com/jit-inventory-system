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
  _count?: {
    purchaseOrders: number;
  };
}

export interface SupplierHistory {
  id: number;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | string;
  performedBy: string;
  performedAt: string;
  oldData: any;
  newData: any;
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

export const useSupplierStore = create<SupplierState>((set) => ({
  suppliers: [],
  supplierHistory: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchSuppliers: async (includeArchived = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Supplier[]>('/suppliers', {
        params: { includeArchived },
      });
      set({ suppliers: response.data, isLoading: false });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch suppliers',
        isLoading: false,
      });
    }
  },

  createSupplier: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<Supplier>('/suppliers', data);
      const newSupplier = response.data;
      set((state) => ({
        suppliers: [...state.suppliers, newSupplier].sort((a, b) =>
          a.supplierName.localeCompare(b.supplierName),
        ),
        isLoading: false,
      }));
      return newSupplier;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to create supplier';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  updateSupplier: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<Supplier>(`/suppliers/${id}`, data);
      const updatedSupplier = response.data;
      set((state) => ({
        suppliers: state.suppliers
          .map((sup) => (sup.id === id ? updatedSupplier : sup))
          .sort((a, b) => a.supplierName.localeCompare(b.supplierName)),
        isLoading: false,
      }));
      return updatedSupplier;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to update supplier';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  archiveSupplier: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<Supplier>(`/suppliers/${id}/archive`);
      const updatedSupplier = response.data;
      set((state) => ({
        suppliers: state.suppliers.map((sup) => (sup.id === id ? updatedSupplier : sup)),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to archive supplier';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  fetchSupplierHistory: async (id) => {
    set({ isLoading: true, error: null, supplierHistory: [] });
    try {
      const response = await api.get<SupplierHistory[]>(`/suppliers/${id}/history`);
      set({ supplierHistory: response.data, isLoading: false });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to fetch supplier history';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },
}));
