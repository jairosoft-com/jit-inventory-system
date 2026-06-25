import { useEffect, useState } from 'react';
import { useReportStore, type ReportType } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import '../index.css';
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
      </div>
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
    </div>
  );
}