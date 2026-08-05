import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { CalendarIcon, X } from 'lucide-react';
import { useReportStore, type ReportType } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
        isSelected
          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm'
          : 'border-[var(--surface-border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--input-border-focus)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="shrink-0">
        <IconReport />
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  name: string;
}

interface FilterBarProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  categoryId: string;
  onCategoryChange: (id: string) => void;
  categories: Category[];
  isLoadingCategories: boolean;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  showDateFilter: boolean;
}

function FilterBar({
  dateRange,
  onDateRangeChange,
  categoryId,
  onCategoryChange,
  categories,
  isLoadingCategories,
  onClearFilters,
  hasActiveFilters,
  showDateFilter,
}: FilterBarProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateLabel =
    dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'MMM d, yyyy')} – ${format(dateRange.to, 'MMM d, yyyy')}`
      : dateRange?.from
        ? `From ${format(dateRange.from, 'MMM d, yyyy')}`
        : 'Pick date range';

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--surface-border)] pb-5">
      <span className="text-xs font-bold tracking-wider text-[var(--text-tertiary)]">FILTERS</span>

      {/* Date Range Picker */}
      {showDateFilter && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="flex h-9 items-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm font-normal text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              <CalendarIcon size={14} className="text-[var(--text-tertiary)]" />
              <span className={!dateRange?.from ? 'text-[var(--text-tertiary)]' : ''}>
                {dateLabel}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                onDateRangeChange(range);
                if (range?.from && range?.to) setCalendarOpen(false);
              }}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
            {dateRange?.from && (
              <div className="border-t border-[var(--surface-border)] p-2">
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  onClick={() => {
                    onDateRangeChange(undefined);
                    setCalendarOpen(false);
                  }}
                >
                  Clear dates
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

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
  const pageSize = 20;

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

  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = data.slice((page - 1) * pageSize, page * pageSize);

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

      {totalPages > 1 && (
        <div className="-mx-5 -mb-5 flex items-center justify-between rounded-b-2xl border-t border-[var(--surface-border)] bg-[var(--background-tertiary)] px-5 py-3.5 mt-5">
          <span className="text-xs text-[var(--text-tertiary)]">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.length)} of{' '}
            {data.length} records
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-[var(--surface-hover)]"
            >
              ← Previous
            </button>
            <span className="flex items-center px-2 text-xs font-semibold text-[var(--text-secondary)]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-[var(--surface-hover)]"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
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

  const handleSelectType = (type: ReportType) => {
    clearPreview();
    clearError();
    selectType(type);
  };

  const dateRange: DateRange | undefined =
    filters.startDate || filters.endDate
      ? {
          from: filters.startDate ? parseLocalDate(filters.startDate) : undefined,
          to: filters.endDate ? parseLocalDate(filters.endDate) : undefined,
        }
      : undefined;

  const hasActiveFilters = !!(filters.startDate || filters.endDate || filters.categoryId);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setFilters({
      startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
      endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
    });
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

      {/* Main Layout Grid */}
      <div className="flex flex-col gap-6 md:flex-row items-start">
        {/* Left panel: report type selector */}
        <aside className="flex w-full shrink-0 flex-col gap-3 md:w-64">
          <p className="text-xs font-bold tracking-wider text-[var(--text-tertiary)]">
            SELECT REPORT TYPE
          </p>
          {isLoadingTypes ? (
            <div className="flex items-center gap-2 py-4 text-sm text-[var(--text-secondary)]">
              <IconSpinner /> Loading…
            </div>
          ) : (
            <div className="flex flex-col gap-2">
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

        {/* Right panel: Main frame */}
      <section className="flex w-full min-w-0 flex-1 flex-col gap-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">          {!selectedType ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-[var(--text-disabled)]">
              <div className="scale-150 opacity-50 mb-2">
                <IconReport />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Choose a Report Type
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs">
                Select a report from the left panel to generate a preview and export options.
              </p>
            </div>
          ) : (
            <>
              {/* Filter bar */}
              <FilterBar
                dateRange={dateRange}
                onDateRangeChange={handleDateRangeChange}
                categoryId={filters.categoryId ?? 'all'}
                onCategoryChange={handleCategoryChange}
                categories={categories}
                isLoadingCategories={isLoadingCategories}
                onClearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
                showDateFilter={selectedType !== 'low_stock'}
              />

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
