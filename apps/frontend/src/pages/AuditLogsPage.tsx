import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore, type AuditLog, type AuditAction } from '../store/auditLogStore';

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
  return (
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
    </div>
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
];

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const { logs, meta, isLoading, error, filters, fetchLogs, setFilters, clearFilters, clearError } =
    useAuditLogStore();

  const [page, setPage] = useState(1);
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
    (p: number) => {
      void fetchLogs(p, 25);
    },
    [fetchLogs],
  );

  useEffect(() => {
    if (canView) load(1);
  }, [load, canView]);

  // Re-fetch when filters change
  useEffect(() => {
    if (!canView) return;
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function handlePageChange(next: number) {
    setPage(next);
    load(next);
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
    <div
      id="audit-logs-page"
      style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '0' }}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '28px 32px 0',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--surface-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <IconAudit />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                Audit Logs
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Complete chronological record of all borrow and return actions.
              </p>
            </div>
          </div>

          {/* Immutability badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#94a3b8',
              fontSize: '11.5px',
              fontWeight: 600,
              letterSpacing: '0.02em',
              flexShrink: 0,
              border: '1px solid #334155',
            }}
          >
            <IconLock />
            Read-only · Tamper-proof
          </div>
        </div>

        {/* Immutability info banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            marginBottom: '20px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #1e3a5f22 0%, #1e3a5f11 100%)',
            border: '1px solid #3b82f622',
            fontSize: '12.5px',
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ color: '#3b82f6', flexShrink: 0 }}>
            <IconShield />
          </span>
          <span>
            Audit logs are{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              permanently stored and immutable
            </strong>
            . No user or administrator can modify or delete entries — every action is preserved
            exactly as it occurred.
          </span>
        </div>

        {/* Filter bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            paddingBottom: '20px',
          }}
        >
          {/* Action filter */}
          <select
            id="audit-filter-action"
            value={filters.action ?? ''}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '9px',
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Entity type filter */}
          <select
            id="audit-filter-entity"
            value={filters.entityType ?? ''}
            onChange={(e) => handleFilterChange('entityType', e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '9px',
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Date start */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label
              style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}
            >
              From
            </label>
            <input
              id="audit-filter-start-date"
              type="date"
              value={filters.startDate ?? ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: '9px',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Date end */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label
              style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}
            >
              To
            </label>
            <input
              id="audit-filter-end-date"
              type="date"
              value={filters.endDate ?? ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: '9px',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              id="audit-clear-filters"
              onClick={handleClearFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 12px',
                borderRadius: '9px',
                border: '1px solid var(--surface-border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              ✕ Clear filters
            </button>
          )}

          {/* Record count */}
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            {meta.total > 0 && `${meta.total.toLocaleString()} log${meta.total !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            margin: '16px 32px 0',
            padding: '12px 16px',
            borderRadius: '10px',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#991b1b',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#991b1b',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 32px 32px' }}>
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 0',
              gap: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '2px solid var(--surface-border)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 0.7s linear infinite',
                display: 'inline-block',
              }}
            />
            Loading audit logs…
          </div>
        ) : logs.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 0',
              gap: '10px',
              color: 'var(--text-disabled)',
              textAlign: 'center',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              style={{ opacity: 0.4 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No audit logs found</p>
            <p style={{ margin: 0, fontSize: '12px' }}>
              {hasFilters
                ? 'Try adjusting or clearing your filters.'
                : 'Actions will appear here as they occur.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              borderRadius: '14px',
              border: '1px solid var(--surface-border)',
              overflow: 'hidden',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: 'var(--background-tertiary)',
                      borderBottom: '1px solid var(--surface-border)',
                    }}
                  >
                    {['#', 'Action', 'Entity', 'Entity ID', 'Performed By', 'Timestamp', ''].map(
                      (col) => (
                        <th
                          key={col}
                          style={{
                            padding: '11px 16px',
                            textAlign: 'left',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            color: 'var(--text-tertiary)',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr
                      key={log.id}
                      id={`audit-log-row-${log.id}`}
                      style={{
                        borderBottom:
                          idx < logs.length - 1 ? '1px solid var(--surface-border)' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          'var(--surface-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Log ID */}
                      <td
                        style={{
                          padding: '13px 16px',
                          color: 'var(--text-disabled)',
                          fontSize: '11.5px',
                          fontFamily: 'monospace',
                        }}
                      >
                        #{log.id}
                      </td>

                      {/* Action badge */}
                      <td style={{ padding: '13px 16px' }}>
                        <ActionBadge action={log.action} />
                      </td>

                      {/* Entity type */}
                      <td
                        style={{
                          padding: '13px 16px',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                        }}
                      >
                        {log.entityType}
                      </td>

                      {/* Entity ID */}
                      <td
                        style={{
                          padding: '13px 16px',
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                        }}
                      >
                        {log.entityId}
                      </td>

                      {/* Performed by */}
                      <td style={{ padding: '13px 16px' }}>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {log.user.firstName} {log.user.lastName}
                        </p>
                        <p
                          style={{
                            margin: '1px 0 0',
                            fontSize: '11.5px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {log.user.email}
                        </p>
                      </td>

                      {/* Timestamp */}
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          {formatDateTime(log.performedAt)}
                        </p>
                        <p
                          style={{
                            margin: '1px 0 0',
                            fontSize: '11px',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {formatRelative(log.performedAt)}
                        </p>
                      </td>

                      {/* View detail */}
                      <td style={{ padding: '13px 16px' }}>
                        <button
                          style={{
                            padding: '4px 10px',
                            borderRadius: '7px',
                            border: '1px solid var(--surface-border)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              'var(--accent)';
                            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                            (e.currentTarget as HTMLButtonElement).style.borderColor =
                              'var(--accent)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                            (e.currentTarget as HTMLButtonElement).style.color =
                              'var(--text-secondary)';
                            (e.currentTarget as HTMLButtonElement).style.borderColor =
                              'var(--surface-border)';
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderTop: '1px solid var(--surface-border)',
                  background: 'var(--background-tertiary)',
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Page {page} of {meta.totalPages} · {meta.total.toLocaleString()} total
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--surface-border)',
                      background: 'var(--surface)',
                      color: 'var(--text-secondary)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      opacity: page <= 1 ? 0.45 : 1,
                      transition: 'all 0.12s',
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= meta.totalPages}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--surface-border)',
                      background: 'var(--surface)',
                      color: 'var(--text-secondary)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: page >= meta.totalPages ? 'not-allowed' : 'pointer',
                      opacity: page >= meta.totalPages ? 0.45 : 1,
                      transition: 'all 0.12s',
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      {selectedLog && <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
