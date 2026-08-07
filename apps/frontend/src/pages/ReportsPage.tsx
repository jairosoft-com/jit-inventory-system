import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useReportStore, type ReportType } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import '../index.css';
import './DashboardPage.css';

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
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--surface-border)] border-t-[var(--accent)]" />
  );
}

function IconAlert() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Filter Bar ────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  name: string;
}

interface FilterBarProps {
  reportType: string;
  onReportTypeChange: (type: string) => void;
  availableTypes: { value: string; label: string }[];
  isLoadingTypes: boolean;
  categoryId: string;
  onCategoryChange: (id: string) => void;
  categories: Category[];
  isLoadingCategories: boolean;
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  showDateFilter: boolean;
}

function FilterBar({
  reportType,
  onReportTypeChange,
  availableTypes,
  isLoadingTypes,
  categoryId,
  onCategoryChange,
  categories,
  isLoadingCategories,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClearFilters,
  hasActiveFilters,
  showDateFilter,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--surface-border)] pb-5">
      <span className="text-xs font-bold tracking-wider text-[var(--text-tertiary)]">FILTERS</span>

      {/* Report Type Select */}
      <Select value={reportType} onValueChange={onReportTypeChange} disabled={isLoadingTypes}>
        <SelectTrigger className="h-9 w-[220px] rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm focus:border-[var(--input-border-focus)] focus:ring-0">
          <SelectValue placeholder={isLoadingTypes ? 'Loading…' : 'Select report type'} />
        </SelectTrigger>
        <SelectContent>
          {availableTypes.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Category Select */}
      <Select value={categoryId} onValueChange={onCategoryChange} disabled={isLoadingCategories}>
        <SelectTrigger className="h-9 w-[200px] rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm focus:border-[var(--input-border-focus)] focus:ring-0">
          <SelectValue placeholder={isLoadingCategories ? 'Loading…' : 'All categories'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={String(cat.id)}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date inputs */}
      {showDateFilter && (
        <>
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-xs font-medium text-[var(--text-tertiary)]">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-xs font-medium text-[var(--text-tertiary)]">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            />
          </div>
        </>
      )}

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          type="button"
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          onClick={onClearFilters}
        >
          <X size={13} /> Clear filters
        </button>
      )}
    </div>
  );
}

// ── Columns to show in preview table per report type ──────────────────────────

const PREVIEW_COLUMNS: Record<string, string[]> = {
  inventory: [
    'itemName',
    'itemType',
    'category',
    'quantity',
    'unit',
    'stockStatus',
    'equipmentStatus',
    'condition',
  ],
  procurement: ['invoiceNumber', 'status', 'totalAmount', 'orderDate', 'supplier', 'itemCount'],
  borrowing: [
    'equipmentName',
    'assetId',
    'borrowedBy',
    'status',
    'borrowDate',
    'expectedReturn',
    'actualReturn',
  ],
  maintenance: ['equipmentName', 'description', 'status', 'scheduledDate', 'completedDate', 'cost'],
  disposal: ['equipmentName', 'assetId', 'reason', 'method', 'disposalDate', 'approvedBy'],
  employee_equipment: [
    'itemName',
    'category',
    'assetId',
    'condition',
    'status',
    'assignedTo',
    'assignedToEmail',
  ],
  low_stock: [
    'itemName',
    'category',
    'currentQuantity',
    'reorderPoint',
    'unit',
    'deficit',
    'stockStatus',
  ],
};

function DataTable({ data, type }: { data: Record<string, unknown>[]; type: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-[var(--text-disabled)]">
        <IconReport />
        <p className="m-0 text-sm font-semibold">No data available</p>
        <p className="m-0 text-xs">There are no records matching your current report filters.</p>
      </div>
    );
  }

  const allColumns = Object.keys(data[0]).filter((k) => !Array.isArray(data[0][k]));
  const preferred = PREVIEW_COLUMNS[type] ?? allColumns;
  const columns = preferred.filter((c) => allColumns.includes(c));

  // Always at least 1 page — guards against edge case where pageSize > data.length
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  // Clamp current page within valid range after any page size change
  const safePage = Math.min(page, totalPages);
  const pageData = data.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handlePageSizeChange = (size: number) => {
    // Batch both updates together to prevent stale render between the two setState calls
    const newTotalPages = Math.max(1, Math.ceil(data.length / size));
    setPageSize(size);
    setPage((p) => Math.min(p, newTotalPages));
  };

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--background-tertiary)]">
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]"
                >
                  {formatColumnHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr
                key={i}
                className={`transition hover:bg-[var(--surface-hover)] ${
                  i < pageData.length - 1 ? 'border-b border-[var(--surface-border)]' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--text-primary)]"
                  >
                    {formatCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="-mx-5 -mb-5 flex items-center justify-between rounded-b-2xl border-t border-[var(--surface-border)] bg-[var(--background-tertiary)] px-5 py-3.5 mt-5">
        {/* Rows per page selector */}
        <div className="flex items-center gap-4">
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="cursor-pointer rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
          >
            <option value={5}>5 rows</option>
            <option value={10}>10 rows</option>
            <option value={15}>15 rows</option>
          </select>
          <span className="text-xs text-[var(--text-tertiary)]">
            Page {safePage} of {totalPages} · {data.length.toLocaleString()} total
          </span>
        </div>

        {/* Prev / Next buttons — hidden when all records fit on one page */}
        {totalPages > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-[var(--surface-hover)]"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-[var(--surface-hover)]"
            >
              Next →
            </button>
          </div>
        )}
      </div>
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
    filters,
    fetchTypes,
    selectType,
    generatePreview,
    exportExcel,
    exportPdf,
    setFilters,
    clearFilters,
    clearPreview,
    clearError,
    fetchCategories,
    categories,
    isLoadingCategories,
  } = useReportStore();

  const canExport =
    user?.permissions?.some((p) =>
      typeof p === 'string' ? p === 'reports:export' : p?.name === 'reports:export',
    ) ?? ['ADMIN', 'MANAGER'].includes(user?.role?.name ?? '');

  useEffect(() => {
    if (canExport) {
      void fetchTypes();
      void fetchCategories();
    }
  }, [fetchTypes, fetchCategories, canExport]);

  const hasActiveFilters = !!(filters.startDate || filters.endDate || filters.categoryId);

  const handleReportTypeChange = (type: string) => {
    clearPreview();
    clearError();
    selectType(type as import('../store/reportStore').ReportType);
  };

  const handleCategoryChange = (value: string) => {
    setFilters({ categoryId: value === 'all' ? undefined : value });
  };

  if (!canExport) {
    return (
      <div className="dash-page animate-fade-in flex flex-col items-center justify-center py-20">
        <div className="text-[var(--text-disabled)] mb-4 scale-150">
          <IconAlert />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Access Restricted</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          You don&apos;t have permission to generate or export reports.
        </p>
      </div>
    );
  }

  return (
    <div className="dash-page animate-fade-in flex flex-col gap-6">
      {/* Page Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Reports</h1>
          <p className="dash-page-desc">Generate and export system reports</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <IconAlert />
            <span>{error}</span>
          </div>
          <button onClick={clearError} className="font-semibold hover:text-red-900">
            ✕
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-col gap-6">
        {/* Main frame */}
        <section className="flex w-full min-w-0 flex-col gap-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          {/* Filter bar — always visible */}
          <FilterBar
            reportType={selectedType ?? ''}
            onReportTypeChange={handleReportTypeChange}
            availableTypes={availableTypes}
            isLoadingTypes={isLoadingTypes}
            categoryId={filters.categoryId ?? 'all'}
            onCategoryChange={handleCategoryChange}
            categories={categories}
            isLoadingCategories={isLoadingCategories}
            startDate={filters.startDate ?? ''}
            endDate={filters.endDate ?? ''}
            onStartDateChange={(val) => setFilters({ startDate: val || undefined })}
            onEndDateChange={(val) => setFilters({ endDate: val || undefined })}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            showDateFilter={selectedType !== 'low_stock'}
          />

          {!selectedType ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-[var(--text-disabled)]">
              <div className="scale-150 opacity-50 mb-2">
                <IconReport />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Choose a Report Type
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs">
                Select a report type from the filter above to generate a preview and export options.
              </p>
            </div>
          ) : (
            <>

              {/* Report actions bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-5">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {availableTypes.find((t) => t.value === selectedType)?.label}
                  </h2>
                  {preview && (
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {preview.count} record{preview.count !== 1 ? 's' : ''} · Generated{' '}
                      {formatDate(preview.generatedAt)} by {preview.generatedBy}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                    onClick={() => void generatePreview()}
                    disabled={isLoadingPreview}
                  >
                    {isLoadingPreview ? (
                      <>
                        <IconSpinner /> Generating…
                      </>
                    ) : (
                      'Generate Preview'
                    )}
                  </button>

                  {preview && (
                    <>
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
                        onClick={() => void exportExcel()}
                        disabled={isExporting}
                        title="Export as Excel (.xlsx)"
                      >
                        {isExporting ? <IconSpinner /> : <IconDownload />}
                        Export Excel
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
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
              <div className="min-h-[300px]">
                {isLoadingPreview && (
                  <div className="flex items-center justify-center gap-3 py-20 text-sm text-[var(--text-secondary)]">
                    <IconSpinner />
                    <span>Generating report…</span>
                  </div>
                )}

                {!isLoadingPreview && !preview && (
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-[var(--text-disabled)]">
                    <p className="m-0 text-sm">
                      Click <strong className="text-[var(--text-primary)]">Generate Preview</strong>{' '}
                      to load data for this report.
                    </p>
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
