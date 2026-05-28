import { create } from 'zustand';
import api from '../lib/api';

export interface Category {
  id: number;
  name: string;
  type: 'EQUIPMENT' | 'CONSUMABLE' | 'DIGITAL';
  description: string | null;
  deletedAt: string | null;
}

export interface CreateCategoryInput {
  name: string;
  type: 'EQUIPMENT' | 'CONSUMABLE' | 'DIGITAL';
  description?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: 'EQUIPMENT' | 'CONSUMABLE' | 'DIGITAL';
  description?: string | null;
}

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  
  fetchCategories: () => Promise<void>;
  createCategory: (data: CreateCategoryInput) => Promise<Category>;
  updateCategory: (id: number, data: UpdateCategoryInput) => Promise<Category>;
  archiveCategory: (id: number) => Promise<void>;
  clearError: () => void;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Category[]>('/categories');
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
          a.name.localeCompare(b.name)
        ),
        isLoading: false,
      }));
      return newCategory;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to create category';
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
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to update category';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  archiveCategory: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/categories/${id}`);
      set((state) => ({
        categories: state.categories.filter((cat) => cat.id !== id),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err.response?.data?.message || err.message || 'Failed to archive category';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },
}));
