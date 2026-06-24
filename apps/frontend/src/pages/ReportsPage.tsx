import { useEffect, useState } from 'react';
import { useReportStore, type ReportType } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatColumnHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function getReportDescription(type: ReportType): string {
  const descriptions: Record<ReportType, string> = {
    inventory: 'Complete inventory of all items including consumables, equipment, and digital assets.',
    procurement: 'All purchase orders with supplier details, line items, and order statuses.',
    borrowing: 'Equipment borrow requests with borrower info, dates, and return status.',
    maintenance: 'Equipment maintenance logs including schedules, costs, and completion status.',
    disposal: 'Disposed equipment records with reasons, methods, and approval details.',
    employee_equipment: 'Equipment currently assigned to employees across the organization.',
    low_stock: 'Consumable items at or below reorder point that require restocking.',
  };
  return descriptions[type];
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconReport() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '16px',
        height: '16px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTop: '2px solid #fff',
        borderRadius: '50%',
        animation: 'rp-spin 0.7s linear infinite',
      }}
    />
  );
}

function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReportTypeCard({
  value,
  label,
  isSelected,
  onSelect,
}: {
  value: ReportType;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`rp-type-card ${isSelected ? 'rp-type-card--selected' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <div className="rp-type-card-icon">
        <IconReport />
      </div>
      <div className="rp-type-card-body">
        <span className="rp-type-card-label">{label}</span>
        <span className="rp-type-card-desc">{getReportDescription(value)}</span>
      </div>
      <IconChevronRight />
    </button>
  );
}

// Columns to show in the preview table per report type (exports still get all columns)
const PREVIEW_COLUMNS: Record<string, string[]> = {
  inventory: ['itemName', 'itemType', 'category', 'quantity', 'unit', 'stockStatus', 'equipmentStatus', 'condition'],
  procurement: ['invoiceNumber', 'status', 'totalAmount', 'orderDate', 'supplier', 'itemCount'],
  borrowing: ['equipmentName', 'assetId', 'borrowedBy', 'status', 'borrowDate', 'expectedReturn', 'actualReturn'],
  maintenance: ['equipmentName', 'description', 'status', 'scheduledDate', 'completedDate', 'cost'],
  disposal: ['equipmentName', 'assetId', 'reason', 'method', 'disposalDate', 'approvedBy'],
  employee_equipment: ['itemName', 'category', 'assetId', 'condition', 'status', 'assignedTo', 'assignedToEmail'],
  low_stock: ['itemName', 'category', 'currentQuantity', 'reorderPoint', 'unit', 'deficit', 'stockStatus'],
};

function DataTable({ data, type }: { data: Record<string, unknown>[]; type: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  if (data.length === 0) {
    return <p className="rp-empty">No data available for this report.</p>;
  }

  // Use only the defined preview columns for this report type
  const allColumns = Object.keys(data[0]).filter((k) => !Array.isArray(data[0][k]));
  const preferred = PREVIEW_COLUMNS[type] ?? allColumns;
  const columns = preferred.filter((c) => allColumns.includes(c));

  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="rp-table-wrapper">
      <div className="rp-table-scroll">
        <table className="rp-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{formatColumnHeader(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>{formatCellValue(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="rp-pagination">
          <span className="rp-pagination-info">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.length)} of {data.length} records
          </span>
          <div className="rp-pagination-controls">
            <button
              className="rp-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              type="button"
            >
              Previous
            </button>
            <span className="rp-page-indicator">Page {page} of {totalPages}</span>
            <button
              className="rp-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuthStore();
  const {
    availableTypes,
    selectedType,
    preview,
    isLoadingTypes,
    isLoadingPreview,
    isExporting,
    error,
    fetchTypes,
    selectType,
    generatePreview,
    exportExcel,
    exportPdf,
    clearPreview,
    clearError,
  } = useReportStore();

  // Check if user has reports:export permission
  const canExport =
    user?.permissions?.some((p) =>
      typeof p === 'string' ? p === 'reports:export' : p?.name === 'reports:export',
    ) ?? ['ADMIN', 'MANAGER'].includes(user?.role?.name ?? '');

  useEffect(() => {
    void fetchTypes();
  }, [fetchTypes]);

  const handleSelectType = (type: ReportType) => {
    clearPreview();
    clearError();
    selectType(type);
  };

  if (!canExport) {
    return (
      <div className="rp-access-denied">
        <IconAlert />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have permission to generate or export reports. This feature is available to Admins and Managers only.</p>
      </div>
    );
  }

  return (
    <div className="rp-page">
      {/* Page Header */}
      <div className="rp-header">
        <div className="rp-header-text">
          <h1 className="rp-title">Reports</h1>
          <p className="rp-subtitle">Generate and export operational reports for inventory, equipment, and more.</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rp-error-banner">
          <IconAlert />
          <span>{error}</span>
          <button type="button" className="rp-error-dismiss" onClick={clearError}>✕</button>
        </div>
      )}

      <div className="rp-body">
        {/* Left panel: report type selector */}
        <aside className="rp-sidebar">
          <p className="rp-sidebar-label">SELECT REPORT TYPE</p>
          {isLoadingTypes ? (
            <div className="rp-loading-types">
              <IconSpinner />
              <span>Loading…</span>
            </div>
          ) : (
            <div className="rp-type-list">
              {availableTypes.map((t) => (
                <ReportTypeCard
                  key={t.value}
                  value={t.value}
                  label={t.label}
                  isSelected={selectedType === t.value}
                  onSelect={() => handleSelectType(t.value)}
                />
              ))}
            </div>
          )}
        </aside>

        {/* Right panel: generate + preview */}
        <section className="rp-main">
          {!selectedType ? (
            <div className="rp-placeholder">
              <div className="rp-placeholder-icon"><IconReport /></div>
              <h3>Choose a Report Type</h3>
              <p>Select a report from the left panel to generate a preview and export options.</p>
            </div>
          ) : (
            <>
              {/* Report actions bar */}
              <div className="rp-actions-bar">
                <div className="rp-actions-info">
                  <h2 className="rp-report-title">
                    {availableTypes.find((t) => t.value === selectedType)?.label}
                  </h2>
                  {preview && (
                    <span className="rp-meta">
                      {preview.count} record{preview.count !== 1 ? 's' : ''} · Generated {formatDate(preview.generatedAt)} by {preview.generatedBy}
                    </span>
                  )}
                </div>
                <div className="rp-actions-btns">
                  <button
                    type="button"
                    className="rp-btn rp-btn--primary"
                    onClick={() => void generatePreview()}
                    disabled={isLoadingPreview}
                  >
                    {isLoadingPreview ? <><IconSpinner /> Generating…</> : 'Generate Preview'}
                  </button>

                  {preview && (
                    <>
                      <button
                        type="button"
                        className="rp-btn rp-btn--secondary"
                        onClick={() => void exportExcel()}
                        disabled={isExporting}
                        title="Export as Excel (.xlsx)"
                      >
                        {isExporting ? <IconSpinner /> : <IconDownload />}
                        Export Excel
                      </button>
                      <button
                        type="button"
                        className="rp-btn rp-btn--secondary"
                        onClick={() => void exportPdf()}
                        disabled={isExporting}
                        title="Export as PDF"
                      >
                        {isExporting ? <IconSpinner /> : <IconDownload />}
                        Export PDF
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Preview area */}
              <div className="rp-preview">
                {isLoadingPreview && (
                  <div className="rp-loading-preview">
                    <IconSpinner />
                    <span>Generating report…</span>
                  </div>
                )}

                {!isLoadingPreview && !preview && (
                  <div className="rp-preview-empty">
                    <p>Click <strong>Generate Preview</strong> to load data for this report.</p>
                  </div>
                )}

                {!isLoadingPreview && preview && (
                  <DataTable data={preview.data} type={preview.type} />
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <style>{`
        @keyframes rp-spin {
          to { transform: rotate(360deg); }
        }

        .rp-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-height: 0;
        }

        /* Header */
        .rp-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .rp-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px;
          letter-spacing: -0.02em;
        }
        .rp-subtitle {
          color: var(--text-secondary);
          margin: 0;
          font-size: 0.9rem;
        }

        /* Error banner */
        .rp-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: var(--danger-muted);
          border: 1px solid var(--danger);
          border-radius: var(--radius-md);
          color: var(--danger);
          font-size: 0.875rem;
        }
        .rp-error-dismiss {
          margin-left: auto;
          background: none;
          border: none;
          color: var(--danger);
          cursor: pointer;
          font-size: 1rem;
          line-height: 1;
          padding: 0 4px;
        }

        /* Body layout */
        .rp-body {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        /* Sidebar */
        .rp-sidebar {
          flex-shrink: 0;
          width: 220px;
        }
        .rp-sidebar-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-tertiary);
          letter-spacing: 0.1em;
          margin: 0 0 10px;
        }
        .rp-loading-types {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }
        .rp-type-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .rp-type-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-fast);
          width: 100%;
          font-family: inherit;
        }
        .rp-type-card:hover {
          border-color: var(--accent);
          background: var(--accent-muted);
        }
        .rp-type-card--selected {
          border-color: var(--accent);
          background: var(--accent-muted);
          box-shadow: 0 0 0 2px var(--accent-muted);
        }
        .rp-type-card-icon {
          color: var(--accent);
          flex-shrink: 0;
          margin-top: 1px;
        }
        .rp-type-card-body {
          flex: 1;
          min-width: 0;
        }
        .rp-type-card-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 2px;
        }
        .rp-type-card-desc {
          display: none;
        }
        .rp-type-card svg:last-child {
          display: none;
        }

        /* Main panel */
        .rp-main {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .rp-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 32px;
          background: var(--surface);
          border: 1px dashed var(--surface-border);
          border-radius: var(--radius-lg);
          text-align: center;
          gap: 12px;
        }
        .rp-placeholder-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--accent-muted);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rp-placeholder-icon svg {
          width: 28px;
          height: 28px;
        }
        .rp-placeholder h3 {
          margin: 0;
          font-size: 1.1rem;
          color: var(--text-primary);
        }
        .rp-placeholder p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-secondary);
          max-width: 320px;
        }

        /* Actions bar */
        .rp-actions-bar {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
        }
        .rp-actions-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .rp-report-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .rp-meta {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }
        .rp-actions-btns {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* Buttons */
        .rp-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }
        .rp-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .rp-btn--primary {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);
        }
        .rp-btn--primary:hover:not(:disabled) {
          filter: brightness(1.08);
        }
        .rp-btn--secondary {
          background: var(--surface);
          color: var(--text-primary);
          border-color: var(--surface-border);
        }
        .rp-btn--secondary:hover:not(:disabled) {
          background: var(--sidebar-hover);
          border-color: var(--surface-border-hover);
        }

        /* Preview */
        .rp-preview {
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          min-height: 300px;
          overflow: hidden;
          max-width: 100%;
        }
        .rp-loading-preview,
        .rp-preview-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 64px 32px;
          color: var(--text-secondary);
          font-size: 0.9rem;
          text-align: center;
        }

        /* Table */
        .rp-table-wrapper {
          display: flex;
          flex-direction: column;
        }
        .rp-table-scroll {
          width: 100%;
          overflow-x: hidden;
        }
        .rp-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          table-layout: fixed;
        }
        .rp-table thead tr {
          background: var(--background-tertiary);
        }
        .rp-table th {
          padding: 8px 10px;
          text-align: left;
          font-size: 10px;
          font-weight: 600;
          color: var(--text-tertiary);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-bottom: 1px solid var(--surface-border);
        }
        .rp-table td {
          padding: 8px 10px;
          color: var(--text-primary);
          border-bottom: 1px solid var(--surface-border);
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.4;
        }
        .rp-table tbody tr:last-child td {
          border-bottom: none;
        }
        .rp-table tbody tr:hover td {
          background: var(--background-tertiary);
        }

        /* Pagination */
        .rp-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-top: 1px solid var(--surface-border);
          gap: 12px;
          flex-wrap: wrap;
        }
        .rp-pagination-info {
          font-size: 12px;
          color: var(--text-tertiary);
        }
        .rp-pagination-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rp-page-btn {
          padding: 6px 12px;
          font-size: 12px;
          font-family: inherit;
          font-weight: 500;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .rp-page-btn:hover:not(:disabled) {
          background: var(--sidebar-hover);
        }
        .rp-page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .rp-page-indicator {
          font-size: 12px;
          color: var(--text-secondary);
          min-width: 80px;
          text-align: center;
        }

        /* Empty state */
        .rp-empty {
          padding: 48px 32px;
          text-align: center;
          color: var(--text-tertiary);
          font-size: 0.875rem;
        }

        /* Access denied */
        .rp-access-denied {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 64px 32px;
          text-align: center;
          color: var(--text-secondary);
        }
        .rp-access-denied svg {
          width: 40px;
          height: 40px;
          color: var(--danger);
        }
        .rp-access-denied h2 {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.2rem;
        }
        .rp-access-denied p {
          margin: 0;
          max-width: 360px;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}