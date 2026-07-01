import { create } from 'zustand';
import api from '../lib/api';
import type { Equipment } from './equipmentStore';

// ── Enums (must match backend Prisma enums) ─────────────────────────────────

export type BorrowStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'BORROWED'
  | 'RETURNED'
  | 'OVERDUE'
  | 'CANCELLED';

// ── Response types ───────────────────────────────────────────────────────────

export interface BorrowRecord {
  id: number;
  equipmentId: number;
  borrowedById: number;
  approvedById: number | null;
  borrowDate: string | null;
  expectedReturn: string;
  actualReturn: string | null;
  returnCondition: string | null;
  status: BorrowStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  equipment: Pick<Equipment, 'id' | 'assetId' | 'status'> & {
    item: { id: number; itemName: string; imageUrl: string | null };
    images: Array<{ url: string; isPrimary: boolean }>;
  };
  borrowedBy: { id: number; firstName: string; lastName: string; email: string };
  approvedBy: { id: number; firstName: string; lastName: string; email: string } | null;
}

// ── Input types ──────────────────────────────────────────────────────────────

export interface CreateBorrowInput {
  equipmentId: number;
  expectedReturn: string; // ISO date string
  notes?: string | null;
}

export interface ListBorrowQuery {
  status?: BorrowStatus;
  equipmentId?: number;
  borrowedById?: number;
  mine?: boolean;
  page?: number;
  limit?: number;
}

// ── Pagination ───────────────────────────────────────────────────────────────

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Store ────────────────────────────────────────────────────────────────────

interface BorrowState {
  /** All borrow records — admin/manager view only. Kept separate from
   *  myRecords so switching between the History and All Requests tabs
   *  never causes a flicker of cross-filtered data. */
  adminRecords: BorrowRecord[];
  adminMeta: PaginationMeta;

  /** Current user's own borrow history. */
  myRecords: BorrowRecord[];
  myMeta: PaginationMeta;

  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  /** Fetch all borrow records (admin/manager view) */
  fetchAdminRecords: (query?: ListBorrowQuery) => Promise<void>;
  /** Fetch only the current user's borrow history */
  fetchMyRecords: (query?: Omit<ListBorrowQuery, 'mine'>) => Promise<void>;
  /** Submit a new borrow request */
  submitRequest: (data: CreateBorrowInput) => Promise<BorrowRecord>;
  /** Approve a PENDING request (requires borrow:approve) */
  approveRequest: (id: number) => Promise<BorrowRecord>;
  /** Reject a PENDING request (requires borrow:approve) */
  rejectRequest: (id: number, reason?: string) => Promise<BorrowRecord>;
  /** Mark a BORROWED/OVERDUE record as returned (requires borrow:return) */
  returnEquipment: (id: number, returnCondition?: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED', notes?: string) => Promise<BorrowRecord>;
  clearError: () => void;
}

const emptyMeta: PaginationMeta = { total: 0, page: 1, limit: 20, totalPages: 0 };

export const useBorrowStore = create<BorrowState>((set, get) => ({
  adminRecords: [],
  adminMeta: emptyMeta,
  myRecords: [],
  myMeta: emptyMeta,
  isLoading: false,
  isSubmitting: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchAdminRecords: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (query?.status) params.status = query.status;
      if (query?.equipmentId) params.equipmentId = String(query.equipmentId);
      if (query?.borrowedById) params.borrowedById = String(query.borrowedById);
      if (query?.page) params.page = String(query.page);
      if (query?.limit) params.limit = String(query.limit);

      const response = await api.get<{ data: BorrowRecord[]; meta: PaginationMeta }>(
        '/borrow',
        { params },
      );
      set({ adminRecords: response.data.data, adminMeta: response.data.meta, isLoading: false });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch borrow records',
        isLoading: false,
      });
    }
  },

  fetchMyRecords: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string> = { mine: 'true' };
      if (query?.status) params.status = query.status;
      if (query?.page) params.page = String(query.page);
      if (query?.limit) params.limit = String(query.limit);

      const response = await api.get<{ data: BorrowRecord[]; meta: PaginationMeta }>('/borrow', {
        params,
      });
      set({ myRecords: response.data.data, myMeta: response.data.meta, isLoading: false });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({
        error: err.response?.data?.message || 'Failed to fetch your borrow history',
        isLoading: false,
      });
    }
  },

  submitRequest: async (data) => {
    set({ isSubmitting: true, error: null });
    try {
      const response = await api.post<BorrowRecord>('/borrow', data);
      const created = response.data;
      // Optimistically prepend to myRecords so the history panel updates immediately
      set((state) => ({
        myRecords: [created, ...state.myRecords],
        myMeta: { ...state.myMeta, total: state.myMeta.total + 1 },
        isSubmitting: false,
      }));
      // Also refresh the admin records list if it has been loaded
      if (get().adminRecords.length > 0) {
        void get().fetchAdminRecords();
      }
      return created;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to submit borrow request';
      set({ error: errMsg, isSubmitting: false });
      throw new Error(errMsg);
    }
  },

  approveRequest: async (id) => {
    try {
      const response = await api.patch<BorrowRecord>(`/borrow/${id}/approve`);
      const updated = response.data;
      // Update both arrays in-place so a manager who has both panels loaded
      // sees the new status everywhere without a manual refresh.
      set((state) => ({
        adminRecords: state.adminRecords.map((r) => (r.id === id ? updated : r)),
        myRecords: state.myRecords.map((r) => (r.id === id ? updated : r)),
      }));
      return updated;
    } catch (error: unknown) {
      // Row-scoped failure — caller surfaces it inline; no global error banner.
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg = err.response?.data?.message || err.message || 'Failed to approve request';
      throw new Error(errMsg);
    }
  },

  rejectRequest: async (id, reason) => {
    try {
      const response = await api.patch<BorrowRecord>(`/borrow/${id}/reject`, {
        reason: reason ?? null,
      });
      const updated = response.data;
      // Same in-place dual-array update as approveRequest.
      set((state) => ({
        adminRecords: state.adminRecords.map((r) => (r.id === id ? updated : r)),
        myRecords: state.myRecords.map((r) => (r.id === id ? updated : r)),
      }));
      return updated;
    } catch (error: unknown) {
      // Row-scoped failure — no global error banner.
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg = err.response?.data?.message || err.message || 'Failed to reject request';
      throw new Error(errMsg);
    }
  },

  returnEquipment: async (id, returnCondition?: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED', notes?: string) => {
    try {
      const response = await api.patch<{ record: BorrowRecord; isLate: boolean }>(`/borrow/${id}/return`, {
        returnCondition,
        notes,
      });
      const { record } = response.data;
      set((state) => ({
        adminRecords: state.adminRecords.map((r) => (r.id === id ? record : r)),
        myRecords: state.myRecords.map((r) => (r.id === id ? record : r)),
      }));
      return record;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg = err.response?.data?.message || err.message || 'Failed to process return';
      throw new Error(errMsg);
    }
  },
}));
