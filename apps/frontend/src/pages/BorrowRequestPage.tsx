import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useEquipmentStore, type Equipment } from '../store/equipmentStore';
import { useBorrowStore, type BorrowStatus, type BorrowRecord } from '../store/borrowStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

// ── Badge components ──────────────────────────────────────────────────────────

function BorrowStatusBadge({ status }: { status: BorrowStatus }) {
  const cfg: Record<BorrowStatus, { color: string; dot: string; label: string }> = {
    PENDING:   { color: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-500',  label: 'Pending' },
    APPROVED:  { color: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-500',   label: 'Approved' },
    REJECTED:  { color: 'bg-red-50 text-red-700',       dot: 'bg-red-500',    label: 'Rejected' },
    BORROWED:  { color: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500', label: 'Borrowed' },
    RETURNED:  { color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', label: 'Returned' },
    OVERDUE:   { color: 'bg-red-100 text-red-800',      dot: 'bg-red-700',    label: 'Overdue' },
    CANCELLED: { color: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-400',   label: 'Cancelled' },
  };
  const { color, dot, label } = cfg[status] ?? cfg.CANCELLED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function EquipmentStatusDot({ status }: { status: string }) {
  const available = status === 'AVAILABLE';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        available
          ? 'bg-[var(--success-muted)] text-[var(--success)]'
          : 'bg-gray-100 text-gray-500'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-[var(--success)]' : 'bg-gray-400'}`}
      />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Equipment picker ──────────────────────────────────────────────────────────

interface EquipmentPickerProps {
  selected: Equipment | null;
  onSelect: (eq: Equipment | null) => void;
  error?: string;
}

function EquipmentPicker({ selected, onSelect, error }: EquipmentPickerProps) {
  const { equipment, isLoading, fetchEquipment } = useEquipmentStore();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void fetchEquipment({ status: 'AVAILABLE', limit: 100 });
  }, [fetchEquipment]);

  const filtered = equipment.filter((eq) => {
    const q = search.toLowerCase();
    return (
      eq.assetId.toLowerCase().includes(q) ||
      eq.item.itemName.toLowerCase().includes(q) ||
      (eq.brand ?? '').toLowerCase().includes(q) ||
      (eq.model ?? '').toLowerCase().includes(q)
    );
  });

  function handleSelect(eq: Equipment) {
    onSelect(eq);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative">
      {/* Trigger / selected display */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full rounded-xl border ${
          error
            ? 'border-red-400 bg-red-50 focus:ring-red-300'
            : 'border-[var(--input-border)] bg-[var(--input-bg)]'
        } px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]`}
      >
        {selected ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--text-primary)]">
                {selected.item.itemName}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {selected.assetId}
                {selected.brand && ` · ${selected.brand}`}
                {selected.model && ` ${selected.model}`}
              </p>
            </div>
            <EquipmentStatusDot status={selected.status} />
          </div>
        ) : (
          <span className="text-[var(--text-disabled)]">
            {isLoading ? 'Loading available equipment…' : 'Select equipment to borrow'}
          </span>
        )}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
          ▾
        </span>
      </button>

      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {error}
        </p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
          <div className="border-b border-[var(--surface-border)] p-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, asset ID, brand…"
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          <ul className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <li className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
                Loading…
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-[var(--text-disabled)]">
                {search ? 'No equipment matches your search.' : 'No available equipment found.'}
              </li>
            ) : (
              filtered.map((eq) => (
                <li key={eq.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(eq)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-[var(--surface-hover)] ${
                      selected?.id === eq.id ? 'bg-[var(--accent-muted)]' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text-primary)]">
                        {eq.item.itemName}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {eq.assetId}
                        {eq.brand && ` · ${eq.brand}`}
                        {eq.model && ` ${eq.model}`}
                        {eq.location && (
                          <span className="ml-2 text-[var(--text-disabled)]">@ {eq.location}</span>
                        )}
                      </p>
                    </div>
                    <EquipmentStatusDot status={eq.status} />
                  </button>
                </li>
              ))
            )}
          </ul>

          {selected && (
            <div className="border-t border-[var(--surface-border)] p-2">
              <button
                type="button"
                onClick={() => { onSelect(null); setOpen(false); }}
                className="w-full rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel() {
  const { myRecords, myMeta, isLoading, fetchMyRecords } = useBorrowStore();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<BorrowStatus | ''>('');

  const load = useCallback(
    (p: number, s: BorrowStatus | '') => {
      void fetchMyRecords({ page: p, limit: 10, ...(s && { status: s }) });
    },
    [fetchMyRecords],
  );

  useEffect(() => {
    load(1, statusFilter);
  }, [load, statusFilter]);

  function handlePageChange(next: number) {
    setPage(next);
    load(next, statusFilter);
  }

  function handleStatusChange(s: BorrowStatus | '') {
    setStatusFilter(s);
    setPage(1);
  }

  const STATUS_OPTIONS: Array<{ value: BorrowStatus | ''; label: string }> = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'BORROWED', label: 'Borrowed' },
    { value: 'RETURNED', label: 'Returned' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Filter row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {myMeta.total > 0 && `${myMeta.total} request${myMeta.total !== 1 ? 's' : ''}`}
        </p>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as BorrowStatus | '')}
          className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs outline-none transition focus:border-[var(--accent)]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Record list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--accent)]" />
        </div>
      ) : myRecords.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] p-10 text-center">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-[var(--text-disabled)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {statusFilter ? 'No requests with this status.' : 'No borrow requests yet.'}
          </p>
          <p className="mt-1 text-xs text-[var(--text-disabled)]">
            Requests you submit will appear here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {myRecords.map((rec) => (
            <li
              key={rec.id}
              className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-tertiary)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--text-primary)]">
                    {rec.equipment.item.itemName}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {rec.equipment.assetId}
                  </p>
                </div>
                <BorrowStatusBadge status={rec.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                <span>
                  <span className="font-medium text-[var(--text-tertiary)]">Submitted</span>{' '}
                  {formatDateTime(rec.createdAt)}
                </span>
                <span>
                  <span className="font-medium text-[var(--text-tertiary)]">Return by</span>{' '}
                  {formatDate(rec.expectedReturn)}
                </span>
                {rec.borrowDate && (
                  <span>
                    <span className="font-medium text-[var(--text-tertiary)]">Borrowed</span>{' '}
                    {formatDate(rec.borrowDate)}
                  </span>
                )}
                {rec.actualReturn && (
                  <span>
                    <span className="font-medium text-[var(--text-tertiary)]">Returned</span>{' '}
                    {formatDate(rec.actualReturn)}
                  </span>
                )}
              </div>

              {rec.notes && (
                <p className="mt-2 border-l-2 border-[var(--surface-border)] pl-2 text-xs italic text-[var(--text-secondary)]">
                  {rec.notes}
                </p>
              )}

              {rec.approvedBy && (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-tertiary)]">
                    {rec.status === 'REJECTED' ? 'Rejected' : 'Approved'} by:{' '}
                  </span>
                  {rec.approvedBy.firstName} {rec.approvedBy.lastName}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {myMeta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-xs text-[var(--text-secondary)]">
            Page {page} of {myMeta.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= myMeta.totalPages}
            className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Reject reason modal ───────────────────────────────────────────────────────

interface RejectModalProps {
  record: BorrowRecord;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function RejectModal({ record, onConfirm, onCancel, isSubmitting }: RejectModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Reject borrow request
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {record.equipment.item.itemName} ({record.equipment.assetId}) —{' '}
          {record.borrowedBy.firstName} {record.borrowedBy.lastName}
        </p>

        <label className="mt-4 mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Reason <span className="text-[var(--text-disabled)] font-normal">(optional)</span>
        </label>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Let the employee know why this was rejected…"
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm placeholder:text-[var(--text-disabled)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
        />

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border border-[var(--surface-border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={isSubmitting}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Rejecting…' : 'Reject Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────

function AdminPanel() {
  const { records, meta, isLoading, error, fetchRecords, approveRequest, rejectRequest } =
    useBorrowStore();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<BorrowStatus | ''>('');
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BorrowRecord | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  const load = useCallback(
    (p: number, s: BorrowStatus | '') => {
      void fetchRecords({ page: p, limit: 20, ...(s && { status: s }) });
    },
    [fetchRecords],
  );

  useEffect(() => {
    load(1, statusFilter);
  }, [load, statusFilter]);

  function handlePageChange(next: number) {
    setPage(next);
    load(next, statusFilter);
  }

  async function handleApprove(id: number) {
    setRowError(null);
    setActioningId(id);
    try {
      await approveRequest(id);
    } catch (err: unknown) {
      const e = err as Error;
      setRowError({ id, message: e.message || 'Failed to approve request.' });
    } finally {
      setActioningId(null);
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;
    setRowError(null);
    setActioningId(rejectTarget.id);
    try {
      await rejectRequest(rejectTarget.id, reason || undefined);
      setRejectTarget(null);
    } catch (err: unknown) {
      const e = err as Error;
      setRowError({ id: rejectTarget.id, message: e.message || 'Failed to reject request.' });
    } finally {
      setActioningId(null);
    }
  }

  const STATUS_OPTIONS: Array<{ value: BorrowStatus | ''; label: string }> = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'BORROWED', label: 'Borrowed' },
    { value: 'RETURNED', label: 'Returned' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-5 flex flex-col justify-between gap-3 border-b border-[var(--surface-border)] pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            All Borrow Requests
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {meta.total} total request{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as BorrowStatus | '');
            setPage(1);
          }}
          className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--accent)]" />
        </div>
      ) : records.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-disabled)]">
          No requests found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--surface-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Equipment</th>
                  <th className="px-4 py-3 font-semibold">Requested by</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Return by</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {records.map((rec) => {
                  const isPending = rec.status === 'PENDING';
                  const isActioning = actioningId === rec.id;
                  return (
                    <tr
                      key={rec.id}
                      className="bg-[var(--surface)] transition hover:bg-[var(--surface-hover)]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--text-primary)]">
                          {rec.equipment.item.itemName}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {rec.equipment.assetId}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--text-primary)]">
                          {rec.borrowedBy.firstName} {rec.borrowedBy.lastName}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {rec.borrowedBy.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                        {formatDateTime(rec.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                        {formatDate(rec.expectedReturn)}
                      </td>
                      <td className="px-4 py-3">
                        <BorrowStatusBadge status={rec.status} />
                        {rowError?.id === rec.id && (
                          <p className="mt-1 max-w-[180px] text-xs font-medium text-red-600">
                            {rowError.message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isPending ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(rec.id)}
                              disabled={isActioning}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {isActioning ? '…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectTarget(rec)}
                              disabled={isActioning}
                              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-disabled)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-xs text-[var(--text-secondary)]">
                Page {page} of {meta.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= meta.totalPages}
                className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {rejectTarget && (
        <RejectModal
          record={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          isSubmitting={actioningId === rejectTarget.id}
        />
      )}
    </div>
  );
}

// ── Borrow request form ───────────────────────────────────────────────────────

interface FormErrors {
  equipmentId?: string;
  expectedReturn?: string;
}

function BorrowForm({ onSuccess }: { onSuccess: () => void }) {
  const { submitRequest, isSubmitting } = useBorrowStore();

  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [expectedReturn, setExpectedReturn] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  function validate(): boolean {
    const next: FormErrors = {};
    if (!selectedEquipment) {
      next.equipmentId = 'Please select equipment to borrow.';
    }
    if (!expectedReturn) {
      next.expectedReturn = 'Please set an expected return date.';
    } else if (new Date(expectedReturn) <= new Date()) {
      next.expectedReturn = 'Return date must be in the future.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    setSubmitError('');
    setSuccessMsg('');
    if (!validate()) return;

    try {
      await submitRequest({
        equipmentId: selectedEquipment!.id,
        expectedReturn: new Date(expectedReturn).toISOString(),
        notes: notes.trim() || null,
      });

      setSuccessMsg(
        `Your request for "${selectedEquipment!.item.itemName}" has been submitted and is pending approval.`,
      );
      // Reset form
      setSelectedEquipment(null);
      setExpectedReturn('');
      setNotes('');
      setErrors({});

      // Signal parent to switch to history tab after short delay
      setTimeout(() => {
        onSuccess();
        setSuccessMsg('');
      }, 2500);
    } catch (err: unknown) {
      const e = err as Error;
      setSubmitError(e.message || 'Failed to submit request.');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Equipment selector */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Equipment <span className="text-red-500">*</span>
        </label>
        <EquipmentPicker
          selected={selectedEquipment}
          onSelect={(eq) => {
            setSelectedEquipment(eq);
            if (errors.equipmentId) setErrors((e) => ({ ...e, equipmentId: undefined }));
          }}
          error={errors.equipmentId}
        />
      </div>

      {/* Selected equipment details card */}
      {selectedEquipment && (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-tertiary)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Equipment Details
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {[
              ['Asset ID', selectedEquipment.assetId],
              ['Condition', selectedEquipment.condition],
              ['Brand', selectedEquipment.brand ?? '—'],
              ['Model', selectedEquipment.model ?? '—'],
              ['Location', selectedEquipment.location ?? '—'],
              ['Category', selectedEquipment.item.category.name],
            ].map(([key, val]) => (
              <div key={key} className="flex flex-col">
                <dt className="font-medium text-[var(--text-tertiary)]">{key}</dt>
                <dd className="text-[var(--text-primary)]">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Expected return date */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Expected Return Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          min={todayIso()}
          value={expectedReturn}
          onChange={(e) => {
            setExpectedReturn(e.target.value);
            if (errors.expectedReturn)
              setErrors((err) => ({ ...err, expectedReturn: undefined }));
          }}
          className={`w-full rounded-xl border ${
            errors.expectedReturn
              ? 'border-red-400 bg-red-50'
              : 'border-[var(--input-border)] bg-[var(--input-bg)]'
          } px-4 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]`}
        />
        {errors.expectedReturn && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {errors.expectedReturn}
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Notes <span className="text-[var(--text-disabled)] font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Purpose of borrowing, special instructions…"
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm placeholder:text-[var(--text-disabled)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Feedback banners */}
      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {submitError}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✓ {successMsg}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3 border-t border-[var(--surface-border)] pt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Submitting…
            </span>
          ) : (
            'Submit Request'
          )}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'request' | 'history' | 'admin';

export default function BorrowRequestPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('request');

  const isAdminOrManager =
    user?.role?.name === 'ADMIN' || user?.role?.name === 'MANAGER';

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'request', label: 'New Request' },
    { id: 'history', label: 'My Requests' },
    ...(isAdminOrManager ? [{ id: 'admin' as Tab, label: 'All Requests' }] : []),
  ];

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">

        {/* Page header */}
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold">Borrow Requests</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Request available equipment for a defined period. All requests require
              manager or admin approval before the equipment is released.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex flex-col items-center rounded-xl border border-[var(--surface-border)] bg-[var(--background-tertiary)] px-4 py-3 text-center">
              <svg
                className="mb-1 h-5 w-5 text-[var(--accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Tracked & controlled
              </span>
            </div>
          </div>
        </header>

        {/* Tabs + content */}
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          {/* Tab bar */}
          <div className="flex border-b border-[var(--surface-border)] px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`-mb-px border-b-2 py-3.5 pr-6 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'request' && (
              <BorrowForm onSuccess={() => setActiveTab('history')} />
            )}
            {activeTab === 'history' && <HistoryPanel />}
            {activeTab === 'admin' && isAdminOrManager && <AdminPanel />}
          </div>
        </div>
      </section>
    </main>
  );
}
