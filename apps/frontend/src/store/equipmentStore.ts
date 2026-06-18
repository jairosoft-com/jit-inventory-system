import { create } from 'zustand';
import api from '../lib/api';

// ── Enums (must match backend Prisma enums) ─────────────────────────────────

export type ConditionStatus = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

export type EquipmentStatus =
  | 'AVAILABLE'
  | 'IN_USE'
  | 'UNDER_MAINTENANCE'
  | 'DAMAGED'
  | 'LOST'
  | 'BORROWED'
  | 'RETIREMENT_PENDING'
  | 'RETIRED';

export type DisposalReason =
  | 'DAMAGED_BEYOND_REPAIR'
  | 'OUTDATED'
  | 'LOST'
  | 'STOLEN'
  | 'DONATED';

// ── Response types (match backend API shape) ────────────────────────────────

export interface Disposal {
  id: number;
  equipmentId: number;
  approvedById: number;
  disposalDate: string;
  reason: DisposalReason;
  method: string;
  notes: string | null;
  createdAt: string;
}

export interface EquipmentImage {
  id: number;
  equipmentId: number;
  url: string;
  label: string | null;
  isPrimary: boolean;
  uploadedAt: string;
}

export interface Equipment {
  id: number;
  itemId: number;
  assetId: string;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  condition: ConditionStatus;
  status: EquipmentStatus;
  location: string | null;
  assignedTo: number | null;
  purchaseOrderId: number | null;
  acquisitionDate: string | null;
  purchasePrice: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  warrantyProvider: string | null;
  warrantyDocUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  item: {
    id: number;
    itemName: string;
    description: string | null;
    categoryId: number;
    itemType: string;
    barcode: string | null;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
    category: {
      id: number;
      name: string;
      type: string;
    };
  };
  assignedToUser: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  purchaseOrder: {
    id: number;
    invoiceNumber: string | null;
    orderDate: string;
  } | null;
  images: EquipmentImage[];
}

// ── Input types ─────────────────────────────────────────────────────────────

export interface ListEquipmentQuery {
  status?: EquipmentStatus;
  condition?: ConditionStatus;
  categoryId?: number;
  assignedTo?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateEquipmentInput {
  itemName: string;
  description?: string | null;
  categoryId: number;
  barcode?: string | null;
  assetId: string;
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  condition?: ConditionStatus;
  status?: EquipmentStatus;
  location?: string | null;
  assignedTo?: number | null;
  purchaseOrderId?: number | null;
  acquisitionDate?: string | null;
  purchasePrice?: number | null;
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  warrantyProvider?: string | null;
  warrantyDocUrl?: string | null;
  images: Array<{ url: string; label?: string | null; isPrimary: boolean }>;
}

export interface RetirementRequestInput {
  reason: DisposalReason;
  method: string;
  notes?: string | null;
}

export interface RetirementRequestResponse {
  message: string;
  equipment: Equipment;
  disposal: Disposal;
}

export interface UpdateEquipmentInput {
  itemName?: string;
  description?: string | null;
  categoryId?: number;
  barcode?: string | null;
  assetId?: string;
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  condition?: ConditionStatus;
  status?: EquipmentStatus;
  location?: string | null;
  assignedTo?: number | null;
  purchaseOrderId?: number | null;
  acquisitionDate?: string | null;
  purchasePrice?: number | null;
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  warrantyProvider?: string | null;
  warrantyDocUrl?: string | null;
}

// ── Pagination ──────────────────────────────────────────────────────────────

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Store ───────────────────────────────────────────────────────────────────

interface EquipmentState {
  equipment: Equipment[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | null;

  fetchEquipment: (query?: ListEquipmentQuery) => Promise<void>;
  createEquipment: (data: CreateEquipmentInput) => Promise<Equipment>;
  updateEquipment: (id: number, data: UpdateEquipmentInput) => Promise<Equipment>;
  submitRetirementRequest: (
    id: number,
    data: RetirementRequestInput,
  ) => Promise<RetirementRequestResponse>;
  deleteEquipment: (id: number) => Promise<void>;
  addImage: (
    equipmentId: number,
    data: { url: string; label?: string | null; isPrimary: boolean },
  ) => Promise<EquipmentImage>;
  deleteImage: (equipmentId: number, imageId: number) => Promise<void>;
  clearError: () => void;
}

export const useEquipmentStore = create<EquipmentState>((set, get) => ({
  equipment: [],
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchEquipment: async (query) => {
    set({ isLoading: true, error: null });

    try {
      const params: Record<string, string> = {};

      if (query?.status) params.status = query.status;
      if (query?.condition) params.condition = query.condition;
      if (query?.categoryId) params.categoryId = String(query.categoryId);
      if (query?.assignedTo) params.assignedTo = String(query.assignedTo);
      if (query?.search) params.search = query.search;
      if (query?.page) params.page = String(query.page);
      if (query?.limit) params.limit = String(query.limit);

      const response = await api.get<{ data: Equipment[]; meta: PaginationMeta }>(
        '/equipment',
        { params },
      );

      set({
        equipment: response.data.data,
        meta: response.data.meta,
        isLoading: false,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };

      set({
        error: err.response?.data?.message || 'Failed to fetch equipment',
        isLoading: false,
      });
    }
  },

  createEquipment: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<Equipment>('/equipment', data);
      const created = response.data;

      await get().fetchEquipment({ page: 1 });

      return created;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      let errMsg = err.response?.data?.message || err.message || 'Failed to create equipment';
      if (
        err.response?.status === 413 ||
        errMsg.includes('413') ||
        errMsg.toLowerCase().includes('payload too large') ||
        errMsg.toLowerCase().includes('too large')
      ) {
        errMsg = 'file size exceeds 5mb';
      } else if (
        err.response?.status === 415 ||
        errMsg.toLowerCase().includes('file type') ||
        errMsg.toLowerCase().includes('mime') ||
        errMsg.toLowerCase().includes('unsupported')
      ) {
        errMsg = 'wrong file type';
      }
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  updateEquipment: async (id, data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.patch<Equipment>(`/equipment/${id}`, data);
      const updated = response.data;

      set((state) => ({
        equipment: state.equipment.map((eq) => (eq.id === id ? updated : eq)),
        isLoading: false,
      }));

      return updated;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      const errMsg =
        err.response?.data?.message || err.message || 'Failed to update equipment';

      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  submitRetirementRequest: async (id, data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<RetirementRequestResponse>(
        `/equipment/${id}/retirement-request`,
        data,
      );

      const result = response.data;

      set((state) => ({
        equipment: state.equipment.map((eq) =>
          eq.id === id ? result.equipment : eq,
        ),
        isLoading: false,
      }));

      return result;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to submit retirement request';

      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  deleteEquipment: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await api.delete(`/equipment/${id}`);

      set((state) => ({
        equipment: state.equipment.filter((eq) => eq.id !== id),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      const errMsg =
        err.response?.data?.message || err.message || 'Failed to delete equipment';

      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  addImage: async (equipmentId, data) => {
    try {
      const response = await api.post<EquipmentImage>(
        `/equipment/${equipmentId}/images`,
        data,
      );

      const newImage = response.data;

      set((state) => ({
        equipment: state.equipment.map((eq) =>
          eq.id === equipmentId ? { ...eq, images: [...eq.images, newImage] } : eq,
        ),
      }));

      return newImage;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      let errMsg = err.response?.data?.message || err.message || 'Failed to add image';
      if (
        err.response?.status === 413 ||
        errMsg.includes('413') ||
        errMsg.toLowerCase().includes('payload too large') ||
        errMsg.toLowerCase().includes('too large')
      ) {
        errMsg = 'file size exceeds 5mb';
      } else if (
        err.response?.status === 415 ||
        errMsg.toLowerCase().includes('file type') ||
        errMsg.toLowerCase().includes('mime') ||
        errMsg.toLowerCase().includes('unsupported')
      ) {
        errMsg = 'wrong file type';
      }
      set({ error: errMsg });
      throw new Error(errMsg);
    }
  },

  deleteImage: async (equipmentId, imageId) => {
    try {
      await api.delete(`/equipment/${equipmentId}/images/${imageId}`);

      set((state) => ({
        equipment: state.equipment.map((eq) =>
          eq.id === equipmentId
            ? { ...eq, images: eq.images.filter((img) => img.id !== imageId) }
            : eq,
        ),
      }));
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      const errMsg =
        err.response?.data?.message || err.message || 'Failed to delete image';

      set({ error: errMsg });
      throw new Error(errMsg);
    }
  },
}));