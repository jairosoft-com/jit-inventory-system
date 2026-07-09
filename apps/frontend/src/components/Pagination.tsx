interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');

  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }

  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);

  return pages;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Previous
      </button>

      {getPageNumbers(page, totalPages).map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-1 text-xs text-[var(--text-tertiary)]">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              p === page
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--surface-border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  );
}
