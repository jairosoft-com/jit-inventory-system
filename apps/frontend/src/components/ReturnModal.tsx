import { useState } from 'react';
import { useBorrowStore, type BorrowRecord, type ConditionStatus } from '../store/borrowStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  record: BorrowRecord;
  onClose: () => void;
  /** Called after a successful return so the parent can refresh its list */
  onSuccess: (isLate: boolean) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CONDITION_OPTIONS: Array<{ value: ConditionStatus; label: string; description: string }> = [
  { value: 'NEW',     label: 'New',     description: 'No signs of use, same as received' },
  { value: 'GOOD',    label: 'Good',    description: 'Minor wear, fully functional' },
  { value: 'FAIR',    label: 'Fair',    description: 'Visible wear but working properly' },
  { value: 'POOR',    label: 'Poor',    description: 'Heavy wear, may need attention' },
  { value: 'DAMAGED', label: 'Damaged', description: 'Broken or non-functional' },
];

const CONDITION_COLORS: Record<ConditionStatus, string> = {
  NEW:     'border-emerald-500 bg-emerald-50 text-emerald-800',
  GOOD:    'border-blue-500 bg-blue-50 text-blue-800',
  FAIR:    'border-amber-500 bg-amber-50 text-amber-800',
  POOR:    'border-orange-500 bg-orange-50 text-orange-800',
  DAMAGED: 'border-red-500 bg-red-50 text-red-800',
};

const CONDITION_IDLE: string =
  'border-[var(--surface-border)] bg-[var(--background-tertiary)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-muted)]';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function isOverdue(expectedReturn: string): boolean {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const expectedStr = new Date(expectedReturn).toISOString().split('T')[0];
  return todayStr > expectedStr;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReturnModal({ record, onClose, onSuccess }: Props) {
  const { processReturn } = useBorrowStore();

  const [condition, setCondition] = useState<ConditionStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const overdue = isOverdue(record.expectedReturn);
  const daysLate = overdue
    ? Math.floor(
        (Date.now() - new Date(record.expectedReturn).getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  async function handleSubmit() {
    if (!condition) {
      setError('Please select the return condition of the equipment.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await processReturn(record.id, {
        returnCondition: condition,
        notes: notes.trim() || null,
      });
      onSuccess(result.isLate);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to process return. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between border-b border-[var(--surface-border)] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Process Equipment Return
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {record.equipment.item.itemName}{' '}
              <span className="font-mono text-xs text-[var(--text-tertiary)]">
                ({record.equipment.assetId})
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-[var(--text-tertiary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* ── Overdue warning ── */}
          {overdue && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Late Return</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  This equipment was due on {formatDate(record.expectedReturn)},{' '}
                  {daysLate} day{daysLate !== 1 ? 's' : ''} ago. This return will be
                  recorded as <span className="font-bold">OVERDUE</span> in the audit
                  trail.
                </p>
              </div>
            </div>
          )}

          {/* ── Borrow summary ── */}
          <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-tertiary)] px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Return Summary
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <dt className="text-[var(--text-tertiary)]">Borrowed by</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {record.borrowedBy.firstName} {record.borrowedBy.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-tertiary)]">Expected return</dt>
                <dd className={`font-medium ${overdue ? 'text-amber-700' : 'text-[var(--text-primary)]'}`}>
                  {formatDate(record.expectedReturn)}
                  {overdue && ' ⚠'}
                </dd>
              </div>
              {record.borrowDate && (
                <div>
                  <dt className="text-[var(--text-tertiary)]">Borrowed on</dt>
                  <dd className="font-medium text-[var(--text-primary)]">
                    {formatDate(record.borrowDate)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[var(--text-tertiary)]">Return date</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {formatDate(new Date().toISOString())} (today)
                </dd>
              </div>
            </dl>
          </div>

          {/* ── Return condition selector ── */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Return Condition <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CONDITION_OPTIONS.map((opt) => {
                const isSelected = condition === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setCondition(opt.value);
                      if (error) setError('');
                    }}
                    className={`flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left text-sm transition ${
                      isSelected ? CONDITION_COLORS[opt.value] : CONDITION_IDLE
                    }`}
                  >
                    <span className="font-semibold">{opt.label}</span>
                    <span className="mt-0.5 text-xs opacity-70">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Notes <span className="font-normal text-[var(--text-disabled)]">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations about the equipment's condition, damage details, or remarks…"
              rows={2}
              className="w-full resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm placeholder:text-[var(--text-disabled)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--surface-border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-[var(--surface-border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !condition}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Processing…
              </span>
            ) : (
              'Confirm Return'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
