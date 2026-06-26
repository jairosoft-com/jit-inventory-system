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

interface ReportState {
  availableTypes: ReportTypeOption[];
  selectedType: ReportType | null;
  preview: ReportPreview | null;
  isLoadingTypes: boolean;
  isLoadingPreview: boolean;
  isExporting: boolean;
  error: string | null;

  fetchTypes: () => Promise<void>;
  selectType: (type: ReportType) => void;
  generatePreview: () => Promise<void>;
  exportExcel: () => Promise<void>;
  exportPdf: () => Promise<void>;
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

export const useReportStore = create<ReportState>((set, get) => ({
  availableTypes: [],
  selectedType: null,
  preview: null,
  isLoadingTypes: false,
  isLoadingPreview: false,
  isExporting: false,
  error: null,

  fetchTypes: async () => {
    set({ isLoadingTypes: true, error: null });
    try {
      const response = await api.get<{ types: ReportTypeOption[] }>('/reports/types');
      set({ availableTypes: response.data.types, isLoadingTypes: false });
    } catch {
      set({ error: 'Failed to load report types.', isLoadingTypes: false });
    }
  },

  selectType: (type) => {
    set({ selectedType: type, preview: null, error: null });
  },

  generatePreview: async () => {
    const { selectedType } = get();
    if (!selectedType) return;
    set({ isLoadingPreview: true, error: null, preview: null });
    try {
      const response = await api.get<ReportPreview>(`/reports/preview?type=${selectedType}`);
      set({ preview: response.data, isLoadingPreview: false });
    } catch {
      set({ error: 'Failed to generate report. Please try again.', isLoadingPreview: false });
    }
  },

  exportExcel: async () => {
    const { selectedType } = get();
    if (!selectedType) return;
    set({ isExporting: true, error: null });
    try {
      const date = new Date().toISOString().split('T')[0];
      await downloadBlob(
        `/reports/export/excel?type=${selectedType}`,
        `${selectedType}-report-${date}.xlsx`,
      );
    } catch {
      set({ error: 'Failed to export Excel file. Please try again.' });
    } finally {
      set({ isExporting: false });
    }
  },

  exportPdf: async () => {
    const { selectedType } = get();
    if (!selectedType) return;
    set({ isExporting: true, error: null });
    try {
      const date = new Date().toISOString().split('T')[0];
      await downloadBlob(
        `/reports/export/pdf?type=${selectedType}`,
        `${selectedType}-report-${date}.pdf`,
      );
    } catch {
      set({ error: 'Failed to export PDF file. Please try again.' });
    } finally {
      set({ isExporting: false });
    }
  },

  clearPreview: () => set({ preview: null }),
  clearError: () => set({ error: null }),
}));