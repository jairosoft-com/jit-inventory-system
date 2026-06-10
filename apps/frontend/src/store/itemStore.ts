import { create } from 'zustand';
import api from '../lib/api';

// ── Enums (must match backend Prisma enums) ──────────────────────────────────

export type ItemType = 'CONSUMABLE' | 'DIGITAL';
export type ItemStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ARCHIVED';
export type DigitalStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
export type DigitalAssetType =
  | 'SOFTWARE'
  | 'SUBSCRIPTION'
  | 'DOMAIN'
  | 'LICENSE'
  | 'API_KEY';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONE_TIME';

// ── Response types (match backend API shape) ─────────────────────────────────

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
  deletedAt: string | null;
  category: { id: number; name: string; type: string };
  registeredByUser: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  consumableProfile: ConsumableProfile | null;
  digitalAsset: DigitalAsset | null;
  images: ItemImage[];
}

// ── Input types ──────────────────────────────────────────────────────────────

export interface ListItemsQuery {
  itemType?: ItemType;
  categoryId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateConsumableInput {
  itemType: 'CONSUMABLE';
  itemName: string;
  description?: string | null;
  categoryId: number;
  barcode?: string | null;
  consumableProfile: {
    unit: string;
    quantity?: number;
    reorderPoint?: number;
  };
}

export interface UpdateItemInput {
  itemName?: string;
  description?: string | null;
  categoryId?: number;
  barcode?: string | null;
  // consumable fields
  unit?: string;
  quantity?: number;
  reorderPoint?: number;
}

// ── Pagination ───────────────────────────────────────────────────────────────

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Store ────────────────────────────────────────────────────────────────────

interface ItemState {
  items: Item[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | null;

  fetchItems: (query?: ListItemsQuery) => Promise<void>;
  createItem: (data: CreateConsumableInput) => Promise<Item>;
  updateItem: (id: number, data: UpdateItemInput) => Promise<Item>;
  deleteItem: (id: number) => Promise<void>;
  addImage: (
    itemId: number,
    data: { url: string; label?: string | null; isPrimary: boolean },
  ) => Promise<ItemImage>;
  deleteImage: (itemId: number, imageId: number) => Promise<void>;
  clearError: () => void;
}

export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
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
      set({
        items: response.data.data,
        meta: response.data.meta,
        isLoading: false,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch items',
        isLoading: false,
      });
    }
  },

  createItem: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<Item>('/items', data);
      const created = response.data;
      await get().fetchItems({ page: 1, itemType: 'CONSUMABLE' });
      return created;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to create item';
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
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to update item';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  deleteItem: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/items/${id}`);
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to delete item';
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
      // Update local state with the new image
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId
            ? { ...item, images: [...item.images, newImage] }
            : item,
        ),
      }));
      return newImage;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to add image';
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
