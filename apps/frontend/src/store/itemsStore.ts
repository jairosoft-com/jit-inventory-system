import { create } from 'zustand';
import api from '../lib/api';

// ── Enums ─────────────────────────────────────────────────────────────────────

export type ItemType = 'CONSUMABLE' | 'DIGITAL';
export type ItemStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ARCHIVED';
export type DigitalStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
export type DigitalAssetType = 'SOFTWARE' | 'SUBSCRIPTION' | 'DOMAIN' | 'LICENSE' | 'API_KEY';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONE_TIME';

// ── Shapes ────────────────────────────────────────────────────────────────────

export interface ItemImage {
  id: number;
  itemId: number;
  url: string;
  label: string | null;
  isPrimary: boolean;
  uploadedAt: string;
}

export interface ConsumableProfile {
  id: number;
  itemId: number;
  unit: string;
  quantity: number;
  reorderPoint: number;
  status: ItemStatus;
}

export interface DigitalAsset {
  id: number;
  itemId: number;
  assetType: DigitalAssetType;
  url: string | null;
  vendor: string | null;
  licenseKey: string | null;
  credentialsRef: string | null;
  seats: number | null;
  expiryDate: string | null;
  cost: string | null;
  billingCycle: BillingCycle | null;
  status: DigitalStatus;
  notes: string | null;
}

export interface Item {
  id: number;
  itemName: string;
  description: string | null;
  categoryId: number;
  itemType: ItemType;
  barcode: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: number; name: string; type: string };
  consumableProfile: ConsumableProfile | null;
  digitalAsset: DigitalAsset | null;
  images: ItemImage[];
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface ListItemsQuery {
  itemType?: ItemType;
  categoryId?: number;
  search?: string;
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ItemsState {
  items: Item[];
  archivedItems: Item[];
  meta: PaginationMeta;
  archivedMeta: PaginationMeta;
  isLoading: boolean;
  error: string | null;

  fetchItems: (query?: ListItemsQuery) => Promise<void>;
  fetchArchivedItems: (query?: ListItemsQuery) => Promise<void>;
  fetchMaxBarcode: () => Promise<number>;
  createItem: (data: Record<string, unknown>) => Promise<Item>;
  updateItem: (id: number, data: Record<string, unknown>) => Promise<Item>;
  archiveItem: (id: number) => Promise<void>;
  addImage: (
    itemId: number,
    data: { url: string; label?: string | null; isPrimary: boolean },
  ) => Promise<ItemImage>;
  deleteImage: (itemId: number, imageId: number) => Promise<void>;
  clearError: () => void;
}

export const useItemsStore = create<ItemsState>((set, _get) => ({
  items: [],
  archivedItems: [],
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  archivedMeta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchItems: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (query?.itemType) params.itemType = query.itemType;
      if (query?.categoryId) params.categoryId = String(query.categoryId);
      if (query?.search) params.search = query.search;
      if (query?.page) params.page = String(query.page);
      if (query?.limit) params.limit = String(query.limit);

      const response = await api.get<{ data: Item[]; meta: PaginationMeta }>(
        '/items',
        { params },
      );
      set({ items: response.data.data, meta: response.data.meta, isLoading: false });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      set({
        error: err.response?.data?.message || 'Failed to fetch items',
        isLoading: false,
      });
    }
  },

  fetchArchivedItems: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string> = { includeArchived: 'true' };
      if (query?.itemType) params.itemType = query.itemType;
      if (query?.categoryId) params.categoryId = String(query.categoryId);
      if (query?.search) params.search = query.search;
      if (query?.page) params.page = String(query.page);
      if (query?.limit) params.limit = String(query.limit);

      const response = await api.get<{ data: Item[]; meta: PaginationMeta }>(
        '/items',
        { params },
      );
      set({ archivedItems: response.data.data, archivedMeta: response.data.meta, isLoading: false });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      set({
        error: err.response?.data?.message || 'Failed to fetch archived items',
        isLoading: false,
      });
    }
  },

  fetchMaxBarcode: async () => {
    try {
      const response = await api.get<{ max: number }>('/items/max-barcode');
      return response.data.max;
    } catch {
      return 0;
    }
  },

  createItem: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<Item>('/items', data);
      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to create item';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  updateItem: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<Item>(`/items/${id}`, data);
      const updated = response.data;
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? updated : item)),
        isLoading: false,
      }));
      return updated;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to update item';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  archiveItem: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/items/${id}`);
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to archive item';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  addImage: async (itemId, data) => {
    try {
      const response = await api.post<ItemImage>(
        `/items/${itemId}/images`,
        data,
      );
      const newImage = response.data;
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId
            ? { ...item, images: [...item.images, newImage] }
            : item,
        ),
      }));
      return newImage;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to add image';
      set({ error: errMsg });
      throw new Error(errMsg);
    }
  },

  deleteImage: async (itemId, imageId) => {
    try {
      await api.delete(`/items/${itemId}/images/${imageId}`);
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId
            ? { ...item, images: item.images.filter((img) => img.id !== imageId) }
            : item,
        ),
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to delete image';
      set({ error: errMsg });
      throw new Error(errMsg);
    }
  },
}));
