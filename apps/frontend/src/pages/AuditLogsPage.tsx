import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore, type AuditLog, type AuditAction } from '../store/auditLogStore';
import './DashboardPage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso));
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Action badge config ───────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  AuditAction,
  { label: string; bg: string; dot: string; text: string }
> = {
  CREATED:               { label: 'Created',              bg: '#eff6ff', dot: '#3b82f6', text: '#1e40af' },
  APPROVED:              { label: 'Approved',             bg: '#f0fdf4', dot: '#22c55e', text: '#15803d' },
  RETURNED:              { label: 'Returned',             bg: '#f0fdf4', dot: '#10b981', text: '#065f46' },
  REJECTED:              { label: 'Rejected',             bg: '#fff1f2', dot: '#ef4444', text: '#991b1b' },
  DELETED:               { label: 'Deleted',              bg: '#fff1f2', dot: '#dc2626', text: '#7f1d1d' },
  UPDATED:               { label: 'Updated',              bg: '#fffbeb', dot: '#f59e0b', text: '#92400e' },
  BORROWED:              { label: 'Borrowed',             bg: '#f5f3ff', dot: '#8b5cf6', text: '#4c1d95' },
  DISPOSED:              { label: 'Disposed',             bg: '#fdf2f8', dot: '#ec4899', text: '#831843' },
  TRANSFERRED:           { label: 'Transferred',          bg: '#ecfeff', dot: '#06b6d4', text: '#164e63' },
  MAINTENANCE_STARTED:   { label: 'Maint. Started',      bg: '#fefce8', dot: '#eab308', text: '#713f12' },
  MAINTENANCE_COMPLETED: { label: 'Maint. Completed',    bg: '#f0fdf4', dot: '#84cc16', text: '#365314' },
  RENEWED:               { label: 'Renewed',              bg: '#ecfeff', dot: '#0ea5e9', text: '#0c4a6e' },
  LOGIN:                 { label: 'Login',                bg: '#f0f9ff', dot: '#0284c7', text: '#0c4a6e' },
  LOGOUT:                { label: 'Logout',               bg: '#f9fafb', dot: '#6b7280', text: '#374151' },
};

function ActionBadge({ action }: { action: AuditAction }) {
  const cfg = ACTION_CONFIG[action] ?? {
    label: action,
    bg: '#f3f4f6',
    dot: '#9ca3af',
    text: '#374151',
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        background: cfg.bg,
        color: cfg.text,
        fontSize: '11.5px',
        fontWeight: 700,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ── JSON diff viewer ──────────────────────────────────────────────────────────

function JsonBlock({ data, label }: { data: unknown; label: string }) {
  const isEmpty = data === null || data === undefined;
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p
        style={{
          margin: '0 0 6px',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
      <pre
        style={{
          margin: 0,
          padding: '12px',
          borderRadius: '10px',
          background: 'var(--background)',
          border: '1px solid var(--surface-border)',
          fontSize: '11.5px',
          lineHeight: 1.6,
          color: isEmpty ? 'var(--text-disabled)' : 'var(--text-primary)',
          overflowX: 'auto',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          minHeight: '60px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {isEmpty ? '—  (no data)' : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: '20px',
          border: '1px solid var(--surface-border)',
          boxShadow: 'var(--shadow-md)',
          padding: '28px',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}
            >
              <ActionBadge action={log.action} />
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>#{log.id}</span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {log.entityType} · ID {log.entityId}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {formatDateTime(log.performedAt)} · by {log.user.firstName} {log.user.lastName} (
              {log.user.email})
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--surface-border)',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              fontSize: '16px',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* JSON diff */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <JsonBlock data={log.oldData} label="Before" />
          <JsonBlock data={log.newData} label="After" />
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconAudit() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
      />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path strokeLinecap="round" d="M9 12h6M9 16h4" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const ACTION_OPTIONS: Array<{ value: AuditAction | ''; label: string }> = [
  { value: '', label: 'All actions' },
  { value: 'CREATED', label: 'Created' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'BORROWED', label: 'Borrowed' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'UPDATED', label: 'Updated' },
  { value: 'DELETED', label: 'Deleted' },
  { value: 'DISPOSED', label: 'Disposed' },
  { value: 'MAINTENANCE_STARTED', label: 'Maint. Started' },
  { value: 'MAINTENANCE_COMPLETED', label: 'Maint. Completed' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'BorrowRecord', label: 'Borrow Record' },
  { value: 'Equipment', label: 'Equipment' },
  { value: 'Item', label: 'Item' },
  { value: 'StockIn', label: 'Stock In' },
  { value: 'StockOut', label: 'Stock Out' },
  { value: 'Disposal', label: 'Disposal' },
  { value: 'MaintenanceLog', label: 'Maintenance Log' },
  { value: 'User', label: 'User' },
];

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const { logs, meta, isLoading, error, filters, fetchLogs, setFilters, clearFilters, clearError } =
    useAuditLogStore();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5); // State for your dropdown
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Access gate — only ADMIN / MANAGER
  const canView =
    user?.role?.name === 'ADMIN' ||
    user?.role?.name === 'MANAGER' ||
    user?.permissions?.some((p: unknown) =>
      typeof p === 'string'
        ? p === 'audit_logs:read'
        : (p as { name?: string })?.name === 'audit_logs:read',
    );

  const load = useCallback(
    (p: number, currentLimit: number) => {
      void fetchLogs(p, currentLimit); // Uses the dropdown limit instead of 25
    },
    [fetchLogs],
  );

  useEffect(() => {
    if (canView) load(1, limit);
  }, [load, canView, limit]);

  // Re-fetch when filters or limit change
  useEffect(() => {
    if (!canView) return;
    setPage(1);
    load(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, limit]); // Added limit to dependency array so changing it triggers a reload

  function handlePageChange(next: number) {
    setPage(next);
    load(next, limit);
  }

  function handleFilterChange(key: string, value: string) {
    setFilters({ [key]: value || undefined } as Parameters<typeof setFilters>[0]);
  }

  function handleClearFilters() {
    clearFilters();
    setPage(1);
  }

  if (!canView) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '12px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          padding: '40px',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          style={{ opacity: 0.3 }}
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <h2
          style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}
        >
          Access Restricted
        </h2>
        <p style={{ margin: 0, maxWidth: '400px', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Audit logs are only visible to Administrators and Managers. Contact your system admin if
          you believe this is an error.
        </p>
      </div>
    );
  }

  const hasFilters = !!(
    filters.action ||
    filters.entityType ||
    filters.startDate ||
    filters.endDate ||
    filters.entityId
  );

return (
    <div className="dash-page animate-fade-in flex flex-col gap-6">
      
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Audit Logs</h1>
          <p className="dash-page-desc">
Verify Employee actions,  asset write-off justifications, and system configuration logs.          </p>
        </div>
        
        {/* Immutability badge */}
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-400">
          <IconLock />
          Read-only · Tamper-proof
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={clearError} className="font-semibold hover:text-red-900">
            ✕
          </button>
        </div>
      )}

      {/* ── Main Section Frame ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        
        {/* Immutability info banner */}
        <div className="flex items-center gap-3 rounded-xl border border-blue-200/60 bg-blue-50/50 px-4 py-3 text-[13px] text-[var(--text-secondary)]">
          <span className="shrink-0 text-blue-500">
            <IconShield />
          </span>
          <span>
            Audit logs are <strong className="text-[var(--text-primary)]">permanently stored and immutable</strong>. No user or administrator can modify or delete entries — every action is preserved exactly as it occurred.
          </span>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--surface-border)] pb-5">
          <select
            value={filters.action ?? ''}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={filters.entityType ?? ''}
            onChange={(e) => handleFilterChange('entityType', e.target.value)}
            className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-xs font-medium text-[var(--text-tertiary)]">From</label>
            <input
              type="date"
              value={filters.startDate ?? ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-xs font-medium text-[var(--text-tertiary)]">To</label>
            <input
              type="date"
              value={filters.endDate ?? ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            />
          </div>

          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              ✕ Clear filters
            </button>
          )}

          <span className="ml-auto text-xs font-medium text-[var(--text-tertiary)]">
            {meta.total > 0 && `${meta.total.toLocaleString()} log${meta.total !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Table Area */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-[var(--text-secondary)]">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--surface-border)] border-t-[var(--accent)]" />
            Loading audit logs…
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-[var(--text-disabled)]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="opacity-40">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="m-0 text-sm font-semibold">No audit logs found</p>
            <p className="m-0 text-xs">
              {hasFilters ? 'Try adjusting or clearing your filters.' : 'Actions will appear here as they occur.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--background-tertiary)]">
                  {['#', 'Action', 'Entity', 'Entity ID', 'Performed By', 'Timestamp', ''].map((col) => (
                    <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`cursor-pointer transition hover:bg-[var(--surface-hover)] ${
                      idx < logs.length - 1 ? 'border-b border-[var(--surface-border)]' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-[11.5px] text-[var(--text-disabled)]">#{log.id}</td>
                    <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{log.entityType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{log.entityId}</td>
                    <td className="px-4 py-3">
                      <p className="m-0 font-semibold text-[var(--text-primary)]">{log.user.firstName} {log.user.lastName}</p>
                      <p className="m-0 mt-0.5 text-[11.5px] text-[var(--text-secondary)]">{log.user.email}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="m-0 text-[12.5px] text-[var(--text-primary)]">{formatDateTime(log.performedAt)}</p>
                      <p className="m-0 mt-0.5 text-[11px] text-[var(--text-tertiary)]">{formatRelative(log.performedAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

{/* Pagination */}
        {meta.totalPages > 1 && !isLoading && (
          <div className="-mb-5 -mx-5 flex items-center justify-between rounded-b-2xl border-t border-[var(--surface-border)] bg-[var(--background-tertiary)] px-5 py-3.5">
            
            {/* Rows Selector & Page Text */}
            <div className="flex items-center gap-4">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="cursor-pointer rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
              >
                <option value={5}>5 rows</option>
                <option value={10}>10 rows</option>
                <option value={15}>15 rows</option>
              </select>
              
              <span className="text-xs text-[var(--text-tertiary)]">
                Page {page} of {meta.totalPages} · {meta.total.toLocaleString()} total
              </span>
            </div>
            
            {/* Next / Prev Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-[var(--surface-hover)]"
              >
                ← Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= meta.totalPages}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-[var(--surface-hover)]"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>
      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      {selectedLog && <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}