import { create } from 'zustand';
import api from '../lib/api';

export type ReportType =
  | 'inventory'
  | 'procurement'
  | 'borrowing'
  | 'maintenance'
  | 'disposal'
  | 'employee_equipment'
  | 'low_stock';

export interface ReportTypeOption {
  value: ReportType;
  label: string;
}

export interface ReportPreview {
  type: ReportType;
  title: string;
  generatedAt: string;
  generatedBy: string;
  count: number;
  data: Record<string, unknown>[];
}

export interface ReportFilters {
  startDate?: string;   // 'yyyy-MM-dd'
  endDate?: string;     // 'yyyy-MM-dd'
  categoryId?: string;
}

export interface Category {
  id: number;
  name: string;
}

interface ReportState {
  availableTypes: ReportTypeOption[];
  selectedType: ReportType | null;
  preview: ReportPreview | null;
  isLoadingTypes: boolean;
  isLoadingPreview: boolean;
  isExporting: boolean;
  error: string | null;

  // Filters
  filters: ReportFilters;
  categories: Category[];
  isLoadingCategories: boolean;

  fetchTypes: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  selectType: (type: ReportType) => void;
  generatePreview: () => Promise<void>;
  exportExcel: () => Promise<void>;
  exportPdf: () => Promise<void>;
  setFilters: (partial: Partial<ReportFilters>) => void;
  clearFilters: () => void;
  clearPreview: () => void;
  clearError: () => void;
}

async function downloadBlob(url: string, filename: string) {
  const response = await api.get(url, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

function buildFilterParams(filters: ReportFilters): string {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  const qs = params.toString();
  return qs ? `&${qs}` : '';
}

export const useReportStore = create<ReportState>((set, get) => ({
  availableTypes: [],
  selectedType: null,
  preview: null,
  isLoadingTypes: false,
  isLoadingPreview: false,
  isExporting: false,
  error: null,

  filters: {},
  categories: [],
  isLoadingCategories: false,

  fetchTypes: async () => {
    set({ isLoadingTypes: true, error: null });
    try {
      const response = await api.get<{ types: ReportTypeOption[] }>('/reports/types');
      set({ availableTypes: response.data.types, isLoadingTypes: false });
    } catch {
      set({ error: 'Failed to load report types.', isLoadingTypes: false });
    }
  },

  fetchCategories: async () => {
    set({ isLoadingCategories: true });
    try {
      const response = await api.get<Category[]>('/categories');
      set({ categories: response.data, isLoadingCategories: false });
    } catch {
      set({ isLoadingCategories: false });
    }
  },

  selectType: (type) => {
    set({ selectedType: type, preview: null, error: null });
  },

  generatePreview: async () => {
    const { selectedType, filters } = get();
    if (!selectedType) return;
    set({ isLoadingPreview: true, error: null, preview: null });
    try {
      const qs = buildFilterParams(filters);
      const response = await api.get<ReportPreview>(`/reports/preview?type=${selectedType}${qs}`);
      set({ preview: response.data, isLoadingPreview: false });
    } catch {
      set({ error: 'Failed to generate report. Please try again.', isLoadingPreview: false });
    }
  },

  exportExcel: async () => {
    const { selectedType, filters } = get();
    if (!selectedType) return;
    set({ isExporting: true, error: null });
    try {
      const date = new Date().toISOString().split('T')[0];
      const qs = buildFilterParams(filters);
      await downloadBlob(
        `/reports/export/excel?type=${selectedType}${qs}`,
        `${selectedType}-report-${date}.xlsx`,
      );
    } catch {
      set({ error: 'Failed to export Excel file. Please try again.' });
    } finally {
      set({ isExporting: false });
    }
  },

  exportPdf: async () => {
    const { selectedType, filters } = get();
    if (!selectedType) return;
    set({ isExporting: true, error: null });
    try {
      const date = new Date().toISOString().split('T')[0];
      const qs = buildFilterParams(filters);
      await downloadBlob(
        `/reports/export/pdf?type=${selectedType}${qs}`,
        `${selectedType}-report-${date}.pdf`,
      );
    } catch {
      set({ error: 'Failed to export PDF file. Please try again.' });
    } finally {
      set({ isExporting: false });
    }
  },

  setFilters: (partial) => {
    set((state) => ({ filters: { ...state.filters, ...partial }, preview: null }));
  },

  clearFilters: () => {
    set({ filters: {}, preview: null });
  },

  clearPreview: () => set({ preview: null }),
  clearError: () => set({ error: null }),
}));
