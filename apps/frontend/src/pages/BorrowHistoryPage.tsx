import { useEffect, useState, useCallback } from 'react';
import { useBorrowStore, type BorrowStatus } from '../store/borrowStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Status badge ──────────────────────────────────────────────────────────────

function BorrowStatusBadge({ status }: { status: BorrowStatus }) {
  const cfg: Record<BorrowStatus, { color: string; dot: string; label: string }> = {
    PENDING:   { color: 'bg-amber-50 text-amber-700',      dot: 'bg-amber-500',  label: 'Pending'   },
    APPROVED:  { color: 'bg-blue-50 text-blue-700',        dot: 'bg-blue-500',   label: 'Approved'  },
    REJECTED:  { color: 'bg-red-50 text-red-700',          dot: 'bg-red-500',    label: 'Rejected'  },
    BORROWED:  { color: 'bg-purple-50 text-purple-700',    dot: 'bg-purple-500', label: 'Borrowed'  },
    RETURNED:  { color: 'bg-emerald-50 text-emerald-700',  dot: 'bg-emerald-500',label: 'Returned'  },
    OVERDUE:   { color: 'bg-red-100 text-red-800',         dot: 'bg-red-700',    label: 'Overdue'   },
    CANCELLED: { color: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-400',   label: 'Cancelled' },
  };
  const { color, dot, label } = cfg[status] ?? cfg.CANCELLED;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ── Status filter options ─────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: BorrowStatus | ''; label: string }> = [
  { value: '',          label: 'All statuses' },
  { value: 'PENDING',   label: 'Pending'      },
  { value: 'APPROVED',  label: 'Approved'     },
  { value: 'BORROWED',  label: 'Borrowed'     },
  { value: 'RETURNED',  label: 'Returned'     },
  { value: 'REJECTED',  label: 'Rejected'     },
  { value: 'OVERDUE',   label: 'Overdue'      },
  { value: 'CANCELLED', label: 'Cancelled'    },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BorrowHistoryPage() {
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

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">

        {/* Page header */}
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold">Borrow History</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              View your borrow transactions and track equipment usage and status over time.
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Full history
              </span>
            </div>
          </div>
        </header>

        {/* History panel */}
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          <div className="border-b border-[var(--surface-border)] px-6 py-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Borrow Records</h2>
          </div>

          <div className="p-6">
            <div className="flex flex-col gap-4">

              {/* Filter row */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  {myMeta.total > 0
                    ? `${myMeta.total} record${myMeta.total !== 1 ? 's' : ''}`
                    : null}
                </p>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusChange(e.target.value as BorrowStatus | '')}
                  className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs outline-none transition focus:border-[var(--accent)]"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
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
                    {statusFilter ? 'No records with this status.' : 'No records found'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-disabled)]">
                    {statusFilter
                      ? 'Try selecting a different status filter.'
                      : 'Your borrow history will appear here once you submit a request.'}
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
          </div>
        </div>
      </section>
    </main>
  );
}
