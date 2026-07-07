import React from 'react';

export const ROWS_PER_PAGE_OPTIONS = [5, 10, 15];

interface RowsPerPageSelectProps {
  value: number;
  onChange: (size: number) => void;
}

export function RowsPerPageSelect({ value, onChange }: RowsPerPageSelectProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
      Rows per page
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-[var(--surface-border)] bg-[var(--input-bg)] px-2 py-1 text-xs outline-none transition focus:border-[var(--input-border-focus)]"
      >
        {ROWS_PER_PAGE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

interface PaginationBarProps {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  totalCount: number;
}

export function PaginationBar({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalCount,
}: PaginationBarProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <RowsPerPageSelect value={pageSize} onChange={onPageSizeChange} />
      {totalCount > 0 && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-[var(--text-tertiary)]">
            Page {page} of {totalPages}
          </p>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            disabled={page <= 1}
            className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(page + 1, totalPages))}
            disabled={page >= totalPages}
            className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
