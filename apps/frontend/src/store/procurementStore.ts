import { create } from 'zustand';
import api from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

export type POStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export interface POLineItem {
  id: number;
  purchaseOrderId: number;
  itemId: number;
  quantity: number;
  unitCost: string; // Decimal comes as string from Prisma
  item: {
    id: number;
    itemName: string;
    barcode: string | null;
    itemType: string;
  };
}

export interface POHistoryEntry {
  id: number;
  purchaseOrderId: number;
  oldStatus: POStatus;
  newStatus: POStatus;
  notes: string | null;
  createdAt: string;
  changedBy: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface POAttachment {
  id: number;
  purchaseOrderId: number;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  uploadedAt: string;
}

export interface PurchaseOrder {
  id: number;
  supplierId: number;
  invoiceNumber: string | null;
  status: POStatus;
  totalAmount: string; // Decimal
  receiptUrl: string | null;
  createdById: number;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: number;
    supplierName: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    deletedAt: string | null;
  };
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
  };
  lineItems: POLineItem[];
  history: POHistoryEntry[];
  attachments: POAttachment[];
}

export interface CreatePOInput {
  supplierId: number;
  invoiceNumber?: string | null;
  lineItems: Array<{
    itemId: number;
    quantity: number;
    unitCost: number;
  }>;
}

export interface UpdatePOInput {
  supplierId?: number;
  invoiceNumber?: string | null;
  lineItems?: Array<{
    itemId: number;
    quantity: number;
    unitCost: number;
  }>;
}

// ── Store ────────────────────────────────────────────────────────────────────

interface ProcurementState {
  purchaseOrders: PurchaseOrder[];
  isLoading: boolean;
  error: string | null;

  fetchPurchaseOrders: (
    status?: POStatus,
    includeArchived?: boolean,
  ) => Promise<void>;
  createPurchaseOrder: (data: CreatePOInput) => Promise<PurchaseOrder>;
  updatePurchaseOrder: (
    id: number,
    data: UpdatePOInput,
  ) => Promise<PurchaseOrder>;
  updatePurchaseOrderStatus: (
    id: number,
    status: POStatus,
    notes?: string,
  ) => Promise<PurchaseOrder>;
  addAttachment: (
    id: number,
    data: { fileUrl: string; fileName: string; fileSize?: number },
  ) => Promise<void>;
  deleteAttachment: (poId: number, attachmentId: number) => Promise<void>;
  clearError: () => void;
}

export const useProcurementStore = create<ProcurementState>((set) => ({
  purchaseOrders: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchPurchaseOrders: async (status, includeArchived = false) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, unknown> = { includeArchived };
      if (status) params.status = status;
      const response = await api.get<PurchaseOrder[]>('/procurement', {
        params,
      });
      set({ purchaseOrders: response.data, isLoading: false });
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
      };
      set({
        error:
          err.response?.data?.message || 'Failed to fetch purchase orders',
        isLoading: false,
      });
    }
  },

  createPurchaseOrder: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<PurchaseOrder>('/procurement', data);
      const newPO = response.data;
      set((state) => ({
        purchaseOrders: [newPO, ...state.purchaseOrders],
        isLoading: false,
      }));
      return newPO;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to create purchase order';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  updatePurchaseOrder: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<PurchaseOrder>(
        `/procurement/${id}`,
        data,
      );
      const updated = response.data;
      set((state) => ({
        purchaseOrders: state.purchaseOrders.map((po) =>
          po.id === id ? updated : po,
        ),
        isLoading: false,
      }));
      return updated;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to update purchase order';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  updatePurchaseOrderStatus: async (id, status, notes) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<PurchaseOrder>(
        `/procurement/${id}/status`,
        { status, notes },
      );
      const updated = response.data;
      set((state) => ({
        purchaseOrders: state.purchaseOrders.map((po) =>
          po.id === id ? updated : po,
        ),
        isLoading: false,
      }));
      return updated;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to update status';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  addAttachment: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/procurement/${id}/attachments`, data);
      // Re-fetch the specific PO to update attachments
      const response = await api.get<PurchaseOrder>(`/procurement/${id}`);
      const updated = response.data;
      set((state) => ({
        purchaseOrders: state.purchaseOrders.map((po) =>
          po.id === id ? updated : po,
        ),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to add attachment';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  deleteAttachment: async (poId, attachmentId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/procurement/${poId}/attachments/${attachmentId}`);
      // Re-fetch the PO
      const response = await api.get<PurchaseOrder>(`/procurement/${poId}`);
      const updated = response.data;
      set((state) => ({
        purchaseOrders: state.purchaseOrders.map((po) =>
          po.id === poId ? updated : po,
        ),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to delete attachment';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },
}));
