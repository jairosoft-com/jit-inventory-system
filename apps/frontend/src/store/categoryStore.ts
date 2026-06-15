import { create } from 'zustand';
import api from '../lib/api';

export type CategoryType = 'EQUIPMENT' | 'CONSUMABLE' | 'DIGITAL';

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  description: string | null;
  deletedAt: string | null;
  _count?: {
    items: number;
  };
}

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  description?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: CategoryType;
  description?: string | null;
}

export interface FetchCategoriesQuery {
  includeArchived?: boolean;
  search?: string;
  type?: CategoryType | 'all';
}

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;

  fetchCategories: (query?: boolean | FetchCategoriesQuery) => Promise<void>;
  createCategory: (data: CreateCategoryInput) => Promise<Category>;
  updateCategory: (id: number, data: UpdateCategoryInput) => Promise<Category>;
  archiveCategory: (id: number) => Promise<void>;
  clearError: () => void;
}

function buildFetchParams(query?: boolean | FetchCategoriesQuery) {
  if (typeof query === 'boolean') {
    return { includeArchived: query };
  }

  const params: {
    includeArchived: boolean;
    search?: string;
    type?: CategoryType;
  } = {
    includeArchived: query?.includeArchived ?? false,
  };

  const search = query?.search?.trim();
  if (search) {
    params.search = search;
  }

  if (query?.type && query.type !== 'all') {
    params.type = query.type;
  }

  return params;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchCategories: async (query = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Category[]>('/categories', {
        params: buildFetchParams(query),
      });
      set({ categories: response.data, isLoading: false });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch categories',
        isLoading: false,
      });
    }
  },

  createCategory: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<Category>('/categories', data);
      const newCategory = response.data;
      set((state) => ({
        categories: [...state.categories, newCategory].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
        isLoading: false,
      }));
      return newCategory;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to create category';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  updateCategory: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<Category>(`/categories/${id}`, data);
      const updatedCategory = response.data;
      set((state) => ({
        categories: state.categories
          .map((cat) => (cat.id === id ? updatedCategory : cat))
          .sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }));
      return updatedCategory;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to update category';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  archiveCategory: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.delete<Category>(`/categories/${id}`);
      const updatedCategory = response.data;
      set((state) => ({
        categories: state.categories.map((cat) =>
          cat.id === id ? updatedCategory : cat,
        ),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to archive category';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },
}));