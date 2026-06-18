import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import {
  useItemsStore,
  type Item,
  type ItemImage,
  type StockStatusFilter,
} from '../store/itemsStore';
import StockMovementModal from '../components/StockMovementModal';

// ── Constants (image upload) ───────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'LOW_STOCK', label: 'Low Stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
];

interface PendingImage {
  url: string;
  label: string;
  isPrimary: boolean;
  size: number;
}

type SubTab = 'active' | 'archived';
type StatusFilter = 'all' | StockStatusFilter;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusLabel(item: Item): string {
  if (item.consumableProfile) {
    const status = item.consumableProfile.status;

    if (status === 'IN_STOCK') return 'In Stock';
    if (status === 'LOW_STOCK') return 'Low Stock';
    if (status === 'OUT_OF_STOCK') return 'Out of Stock';
  }

  return '—';
}

function getStatusVariant(item: Item): 'success' | 'warning' | 'danger' | 'neutral' {
  const label = getStatusLabel(item).toLowerCase();

  if (label.includes('in stock')) return 'success';
  if (label.includes('low')) return 'warning';
  if (label.includes('out')) return 'danger';

  return 'neutral';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getPrimaryImage(item: Item): ItemImage | null {
  return item.images?.find((img) => img.isPrimary) || item.images?.[0] || null;
}

function getNoResultsMessage(hasFilters: boolean, subTab: SubTab) {
  if (hasFilters) {
    return subTab === 'archived'
      ? 'No archived inventory records match the current search or filters.'
      : 'No inventory records match the current search or filters.';
  }

  return subTab === 'archived'
    ? 'Archived items will appear here.'
    : 'Try adjusting your filters or add a new item.';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ item }: { item: Item }) {
  const label = getStatusLabel(item);
  const variant = getStatusVariant(item);

  const className = {
    success: 'bg-[var(--success-muted)] text-[var(--success)]',
    warning: 'bg-[var(--warning-muted)] text-[var(--warning)]',
    danger: 'bg-red-50 text-red-700',
    neutral: 'bg-[var(--background-tertiary)] text-[var(--text-secondary)]',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: ReactNode;
  icon: string;
}) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-2xl">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {title}
        </p>
        <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      </div>
    </article>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function InventoryManagementPage() {
  const { user } = useAuthStore();
  const { categories, fetchCategories } = useCategoryStore();
  const {
    items,
    archivedItems,
    meta,
    archivedMeta,
    isLoading,
    error: storeError,
    fetchItems,
    fetchArchivedItems,
    fetchMaxBarcode,
    createItem,
    updateItem,
    archiveItem,
    addImage,
    deleteImage,
    clearError,
  } = useItemsStore();


  // ── Local UI state ──────────────────────────────────────────────────────────

  const [subTab, setSubTab] = useState<SubTab>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedCategoryId, setAppliedCategoryId] = useState('all');
  const [appliedStatus, setAppliedStatus] = useState<StatusFilter>('all');

  // form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // stock movement modal
  const [stockItem, setStockItem] = useState<Item | null>(null);

  // image upload state
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // generated code for new item — fetched from backend to include archived
  const [generatedCode, setGeneratedCode] = useState('ITM-001');

  // ── Permissions ─────────────────────────────────────────────────────────────

  const permissions = useMemo(() => {
    if (!user || !(user as any).permissions) return [] as string[];

    return ((user as any).permissions as any[]).map((permission: any) =>
      typeof permission === 'string' ? permission : (permission.name ?? ''),
    );
  }, [user]);

  const isAdmin = (user as any)?.role?.name === 'ADMIN';
  const canCreate = isAdmin || permissions.includes('inventory:create');
  const canUpdate = isAdmin || permissions.includes('inventory:update');
  const canDelete = isAdmin || permissions.includes('inventory:delete');

  // ── Load data ───────────────────────────────────────────────────────────────

  const buildQuery = useCallback(() => {
    const query: Record<string, unknown> = {
      itemType: 'CONSUMABLE',
    };

    if (appliedCategoryId !== 'all') {
      query.categoryId = Number(appliedCategoryId);
    }

    if (appliedStatus !== 'all') {
      query.status = appliedStatus;
    }

    const trimmedSearchTerm = appliedSearchTerm.trim();

    if (trimmedSearchTerm) {
      query.search = trimmedSearchTerm;
    }

    return query;
  }, [appliedCategoryId, appliedSearchTerm, appliedStatus]);

  const loadItems = useCallback(async () => {
    await fetchItems(buildQuery());
  }, [fetchItems, buildQuery]);

  const loadArchivedItems = useCallback(async () => {
    await fetchArchivedItems(buildQuery());
  }, [fetchArchivedItems, buildQuery]);

  useEffect(() => {
    void loadItems();
    void loadArchivedItems(); // pre-load so Archived count shows on mount
  }, [loadItems, loadArchivedItems]);

  useEffect(() => {
    fetchCategories(false);
  }, [fetchCategories]);

  // Load archived items when user switches to the archived tab
  useEffect(() => {
    if (subTab === 'archived') {
      void loadArchivedItems();
    }
  }, [subTab, loadArchivedItems]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const consumableCategories = useMemo(
    () =>
      categories.filter(
        (category) => !category.deletedAt && category.type === 'CONSUMABLE',
      ),
    [categories],
  );

  const hasActiveFilters =
    Boolean(appliedSearchTerm.trim()) ||
    appliedCategoryId !== 'all' ||
    appliedStatus !== 'all';

  const summaries = useMemo(() => {
    const inStock = items.filter(
      (item) => item.consumableProfile?.status === 'IN_STOCK',
    ).length;
    const lowStock = items.filter(
      (item) => item.consumableProfile?.status === 'LOW_STOCK',
    ).length;
    const outOfStock = items.filter(
      (item) => item.consumableProfile?.status === 'OUT_OF_STOCK',
    ).length;

    return {
      total: meta.total,
      inStock,
      lowStock,
      outOfStock,
      archived: archivedMeta.total,
    };
  }, [items, meta.total, archivedMeta.total]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  async function openCreate() {
    setEditingItem(null);
    setFormError('');
    setPendingImages([]);
    setImageError(null);

    // BUG FIX #3: Fetch the true max barcode from backend (includes archived items)
    const max = await fetchMaxBarcode();

    setGeneratedCode(`ITM-${String(max + 1).padStart(3, '0')}`);
    setIsFormOpen(true);
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setFormError('');
    setPendingImages([]);
    setImageError(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingItem(null);
    setFormError('');
    setPendingImages([]);
    setImageError(null);
  }

  function applyFilters() {
    setAppliedSearchTerm(searchTerm.trim());
    setAppliedCategoryId(selectedCategoryId);
    setAppliedStatus(selectedStatus);
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
  }

  function clearFilters() {
    setSearchTerm('');
    setSelectedCategoryId('all');
    setSelectedStatus('all');
    setAppliedSearchTerm('');
    setAppliedCategoryId('all');
    setAppliedStatus('all');
  }

  // ── Image Handlers ────────────────────────────────────────────────────────────

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    // Reset input so same file can be re-selected after an error
    event.target.value = '';

    if (!file.type.startsWith('image/') || !ALLOWED_MIME_TYPES.includes(file.type)) {
      setImageError(`"${file.name}" is not a supported image. Only JPG, JPEG, and PNG are allowed.`);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

      setImageError(`"${file.name}" is ${sizeMB} MB — exceeds the 5 MB limit. Please choose a smaller image.`);
      return;
    }

    setImageError(null);

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const url = readerEvent.target?.result as string;

      if (!url) return;

      setPendingImages((previousImages) => [
        ...previousImages,
        {
          url,
          label: file.name,
          isPrimary:
            previousImages.length === 0 &&
            (!editingItem || (editingItem.images?.length ?? 0) === 0),
          size: file.size,
        },
      ]);
    };

    reader.onerror = () => {
      setImageError(`Failed to read "${file.name}". Please try again.`);
    };

    reader.readAsDataURL(file);
  };

  const handleRemovePendingImage = (index: number) => {
    setPendingImages((previousImages) => {
      const nextImages = previousImages.filter((_, imageIndex) => imageIndex !== index);

      if (nextImages.length > 0 && !nextImages.some((image) => image.isPrimary)) {
        nextImages[0] = { ...nextImages[0], isPrimary: true };
      }

      return nextImages;
    });
  };

  const handleDeleteExistingImage = async (itemId: number, imageId: number) => {
    if (!window.confirm('Remove this image?')) return;

    try {
      await deleteImage(itemId, imageId);

      setEditingItem((currentItem) =>
        currentItem
          ? {
              ...currentItem,
              images: currentItem.images.filter((image) => image.id !== imageId),
            }
          : currentItem,
      );
    } catch {
      // error already set in store
    }
  };

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const formData = new FormData(event.currentTarget);

    const base = {
      itemName: String(formData.get('itemName') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || null,
      categoryId: Number(formData.get('categoryId')),
      ...(!editingItem && { barcode: generatedCode }),
    };

    if (!base.itemName || !base.categoryId) {
      setFormError('Item name and category are required.');
      return;
    }

    setIsSaving(true);

    try {
      if (editingItem) {
        // BUG FIX #1: Quantity is NOT editable through this form.
        // Only unit and reorderPoint can be edited here.
        const updatePayload: Record<string, unknown> = { ...base };
        const unit = String(formData.get('unit') ?? '').trim();
        const reorderPoint = Number(formData.get('reorderPoint'));

        if (unit) updatePayload.unit = unit;
        if (!isNaN(reorderPoint)) updatePayload.reorderPoint = reorderPoint;

        await updateItem(editingItem.id, updatePayload);

        // Upload any newly selected images for the updated item
        for (const image of pendingImages) {
          await addImage(editingItem.id, {
            url: image.url,
            label: image.label || null,
            isPrimary: image.isPrimary,
          });
        }

        setSuccessMessage('Item updated successfully.');
      } else {
        const createPayload = {
          ...base,
          itemType: 'CONSUMABLE',
          consumableProfile: {
            unit: String(formData.get('unit') ?? '').trim() || 'pcs',
            quantity: 0,
            reorderPoint: Number(formData.get('reorderPoint') ?? 0),
          },
        };

        const createdItem = await createItem(createPayload);

        // Upload pending images after creation
        for (const image of pendingImages) {
          await addImage(createdItem.id, {
            url: image.url,
            label: image.label || null,
            isPrimary: image.isPrimary,
          });
        }

        setSuccessMessage('Item created successfully.');
      }

      closeForm();
      void loadItems();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error: unknown) {
      const err = error as Error;
      setFormError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive(item: Item) {
    if (!canDelete) return;
    if (!window.confirm(`Archive "${item.itemName}"? This cannot be undone.`)) return;

    try {
      await archiveItem(item.id);
      setSuccessMessage(`"${item.itemName}" has been archived.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch {
      // storeError handles it
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderItemImage(item: Item, sizeClass = 'h-12 w-12') {
    const primaryImage = getPrimaryImage(item);

    if (!primaryImage) {
      return (
        <div
          className={`${sizeClass} flex items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-xs text-[var(--text-tertiary)]`}
        >
          —
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setPreviewImageUrl(primaryImage.url)}
        className={`${sizeClass} overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--background-tertiary)]`}
      >
        <img
          src={primaryImage.url}
          alt={primaryImage.label || item.itemName}
          className="h-full w-full object-cover"
        />
      </button>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">
              Stock Tracking
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Inventory Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Track stock levels, reorder points, and item movements across your organisation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void (subTab === 'active' ? loadItems() : loadArchivedItems())}
              disabled={isLoading}
              className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={() => void openCreate()}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
              >
                + Add Item
              </button>
            )}
          </div>
        </header>

        {/* Alerts */}
        {storeError && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{storeError}</span>
            <button onClick={clearError} className="font-semibold hover:text-red-900">
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="animate-fade-in rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {/* Summary */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryCard title="Total Items" value={summaries.total} icon="📦" />
          <SummaryCard title="Active" value={summaries.total} icon="🟢" />
          <SummaryCard title="In Stock" value={summaries.inStock} icon="✅" />
          <SummaryCard title="Low Stock" value={summaries.lowStock} icon="⚠️" />
          <SummaryCard title="Out of Stock" value={summaries.outOfStock} icon="🚫" />
          <SummaryCard title="Archived" value={summaries.archived} icon="🗄️" />
        </section>

        {/* Table section */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          {/* Sub-tabs: Active / Archived */}
          <div className="mb-5 flex items-center gap-1 border-b border-[var(--surface-border)] pb-0">
            {(['active', 'archived'] as SubTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSubTab(tab)}
                className={`relative px-4 py-2.5 text-sm font-medium capitalize transition ${
                  subTab === tab
                    ? 'text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab === 'active' ? 'Active Items' : 'Archived'}

                {tab === 'active' && meta.total > 0 && (
                  <span className="ml-1.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {meta.total}
                  </span>
                )}

                {tab === 'archived' && archivedMeta.total > 0 && (
                  <span className="ml-1.5 rounded-full bg-[var(--text-tertiary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {archivedMeta.total}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="mb-5 flex flex-col gap-4 border-b border-[var(--surface-border)] pb-5">
            <form
              onSubmit={handleFilterSubmit}
              className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px_170px_auto]"
            >
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by item name or category…"
                className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
              />

              <select
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
              >
                <option value="all">All Categories</option>
                {consumableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as StatusFilter)}
                className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                Search
              </button>
            </form>

            {hasActiveFilters && (
              <div className="flex items-center justify-between rounded-xl bg-[var(--background-tertiary)] px-4 py-3 text-xs text-[var(--text-secondary)]">
                <span>Search and filters are active.</span>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-semibold text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--accent)]" />
              <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading items…</p>
            </div>
          ) : (
            <>
              {/* ── Active Items ── */}
              {subTab === 'active' && (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Image</th>
                          <th className="px-4 py-3 font-medium">Item</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Stock</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Added</th>
                          {(canUpdate || canDelete) && (
                            <th className="px-4 py-3 font-medium">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-border)]">
                        {items.map((item) => (
                          <tr
                            key={item.id}
                            className="transition hover:bg-[var(--surface-hover)]"
                          >
                            <td className="px-4 py-3">{renderItemImage(item)}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.itemName}</p>
                              {item.barcode && (
                                <p className="font-mono text-xs text-[var(--text-tertiary)]">
                                  {item.barcode}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {item.category.name}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {item.consumableProfile ? (
                                <span>
                                  {item.consumableProfile.quantity}{' '}
                                  {item.consumableProfile.unit}
                                  <span className="ml-1 text-xs text-[var(--text-tertiary)]">
                                    (reorder @ {item.consumableProfile.reorderPoint})
                                  </span>
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge item={item} />
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {formatDate(item.createdAt)}
                            </td>
                            {(canUpdate || canDelete) && (
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {canUpdate && (
                                    <button
                                      type="button"
                                      onClick={() => openEdit(item)}
                                      className="rounded-lg border border-[var(--surface-border)] px-2.5 py-1 text-xs font-medium transition hover:bg-[var(--surface-hover)]"
                                    >
                                      Edit
                                    </button>
                                  )}
                                  
                                  {canUpdate && item.consumableProfile && (
                                    <button
                                      type="button"
                                      onClick={() => setStockItem(item)}
                                      className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                                    >
                                      Stock
                                    </button>
                                  )}

                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => void handleArchive(item)}
                                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                    >
                                      Archive
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="grid gap-3 md:hidden">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-[var(--surface-border)] p-4"
                      >
                        <div className="flex items-start gap-3">
                          {renderItemImage(item)}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{item.itemName}</p>
                                <p className="text-xs text-[var(--text-secondary)]">
                                  {item.category.name}
                                </p>
                              </div>
                              <StatusBadge item={item} />
                            </div>

                            {item.consumableProfile && (
                              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                                {item.consumableProfile.quantity}{' '}
                                {item.consumableProfile.unit}
                                {' · reorder @ '}
                                {item.consumableProfile.reorderPoint}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-hover)]"
                            >
                              Edit
                            </button>
                          )}

                            {canUpdate && item.consumableProfile && (
                              <button
                                type="button"
                                onClick={() => setStockItem(item)}
                                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                              >
                                Stock
                              </button>
                            )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => void handleArchive(item)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>

                  {items.length === 0 && (
                    <div className="py-16 text-center">
                      <p className="text-3xl">📭</p>
                      <h3 className="mt-3 font-semibold">No items found</h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {getNoResultsMessage(hasActiveFilters, subTab)}
                      </p>
                    </div>
                  )}

                  {meta.total > 0 && (
                    <p className="mt-4 text-xs text-[var(--text-tertiary)]">
                      Showing {items.length} of {meta.total} items
                    </p>
                  )}
                </>
              )}

              {/* ── Archived Items ── */}
              {subTab === 'archived' && (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Item</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Last Stock</th>
                          <th className="px-4 py-3 font-medium">Added</th>
                          <th className="px-4 py-3 font-medium">Archived</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-border)]">
                        {archivedItems.map((item) => (
                          <tr
                            key={item.id}
                            className="opacity-70 transition hover:bg-[var(--surface-hover)] hover:opacity-100"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.itemName}</p>
                              {item.barcode && (
                                <p className="font-mono text-xs text-[var(--text-tertiary)]">
                                  {item.barcode}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {item.category.name}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {item.consumableProfile ? (
                                <span>
                                  {item.consumableProfile.quantity}{' '}
                                  {item.consumableProfile.unit}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {formatDate(item.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Archived
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="grid gap-3 md:hidden">
                    {archivedItems.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-[var(--surface-border)] p-4 opacity-70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.itemName}</p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {item.category.name}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                            Archived
                          </span>
                        </div>

                        {item.consumableProfile && (
                          <p className="mt-2 text-xs text-[var(--text-secondary)]">
                            Last stock: {item.consumableProfile.quantity}{' '}
                            {item.consumableProfile.unit}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>

                  {archivedItems.length === 0 && (
                    <div className="py-16 text-center">
                      <p className="text-3xl">🗄️</p>
                      <h3 className="mt-3 font-semibold">No archived items</h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {getNoResultsMessage(hasActiveFilters, subTab)}
                      </p>
                    </div>
                  )}

                  {archivedMeta.total > 0 && (
                    <p className="mt-4 text-xs text-[var(--text-tertiary)]">
                      Showing {archivedItems.length} of {archivedMeta.total} archived items
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </section>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
            <div className="mb-5 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingItem ? 'Edit Item' : 'Add Item'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {editingItem
                    ? `Editing "${editingItem.itemName}"`
                    : 'Register a new inventory item.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] transition hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              {/* Image Upload */}
              <div className="rounded-xl border border-[var(--surface-border)] p-4">
                <label className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">
                  Images
                </label>

                {/* Existing images (edit mode) */}
                {editingItem && (editingItem.images?.length ?? 0) > 0 && (
                  <div className="mb-3">
                    <p className="mb-2 text-xs text-[var(--text-tertiary)]">
                      Current Images
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {editingItem.images.map((image) => (
                        <div key={image.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => setPreviewImageUrl(image.url)}
                            className="h-16 w-16 overflow-hidden rounded-lg border border-[var(--surface-border)]"
                          >
                            <img
                              src={image.url}
                              alt={image.label || 'Item image'}
                              className="h-full w-full object-cover"
                            />
                          </button>
                          {image.isPrimary && (
                            <span className="absolute bottom-0 left-0 rounded-tr bg-[var(--accent)] px-1.5 py-0.5 text-[9px] text-white">
                              Primary
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDeleteExistingImage(editingItem.id, image.id)}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 shadow transition group-hover:opacity-100"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending images */}
                {pendingImages.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-2 text-xs text-[var(--text-tertiary)]">
                      {editingItem ? 'New images to add' : 'Images to upload'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {pendingImages.map((image, index) => (
                        <div key={`${image.label}-${index}`} className="group relative">
                          <button
                            type="button"
                            onClick={() => setPreviewImageUrl(image.url)}
                            className="h-16 w-16 overflow-hidden rounded-lg border border-[var(--surface-border)]"
                          >
                            <img
                              src={image.url}
                              alt={image.label}
                              className="h-full w-full object-cover"
                            />
                          </button>
                          {image.isPrimary && (
                            <span className="absolute bottom-0 left-0 rounded-tr bg-[var(--accent)] px-1.5 py-0.5 text-[9px] text-white">
                              Primary
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePendingImage(index)}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 shadow transition group-hover:opacity-100"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File input */}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleImageChange}
                  className="block w-full cursor-pointer rounded-lg border border-dashed border-[var(--surface-border)] p-2 text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--background-tertiary)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--text-primary)]"
                />

                {imageError && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {imageError}
                    <button
                      type="button"
                      onClick={() => setImageError(null)}
                      className="ml-2 font-bold text-red-800 hover:text-red-950"
                    >
                      ×
                    </button>
                  </div>
                )}
                <p className="text-xs text-[var(--text-tertiary)]">Max size: 5 MB. Formats: JPG, JPEG, PNG</p>
              </div>

              {/* Common fields */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Item Name *
                  </label>
                  <input
                    name="itemName"
                    required
                    defaultValue={editingItem?.itemName ?? ''}
                    placeholder="e.g. USB-C Cable"
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Category *
                  </label>
                  <select
                    name="categoryId"
                    required
                    defaultValue={editingItem?.categoryId ?? ''}
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                  >
                    <option value="">Select category</option>
                    {consumableCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Item Code
                  </label>
                  <input
                    readOnly
                    value={editingItem?.barcode ?? generatedCode}
                    className="w-full cursor-not-allowed rounded-xl border border-[var(--surface-border)] bg-[var(--background-tertiary)] px-4 py-2.5 font-mono text-sm text-[var(--text-secondary)] outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={editingItem?.description ?? ''}
                    placeholder="Optional"
                    className="w-full resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                  />
                </div>
              </div>

              {/* Stock fields */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Unit *
                  </label>
                  <input
                    name="unit"
                    required
                    list="unit-options"
                    defaultValue={editingItem?.consumableProfile?.unit ?? ''}
                    placeholder="pcs, kg, box…"
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                  />
                  <datalist id="unit-options">
                    {[
                      'pcs',
                      'box',
                      'pack',
                      'ream',
                      'roll',
                      'kg',
                      'g',
                      'lbs',
                      'L',
                      'mL',
                      'm',
                      'cm',
                      'bottle',
                      'can',
                      'pair',
                      'set',
                      'sheet',
                      'bag',
                      'tube',
                      'carton',
                    ].map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Reorder Level
                  </label>
                  <input
                    name="reorderPoint"
                    type="number"
                    min="0"
                    defaultValue={editingItem?.consumableProfile?.reorderPoint ?? 0}
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                  />
                </div>
              </div>

              {editingItem && (
                <p className="rounded-lg bg-[var(--background-tertiary)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
                  ℹ️ Quantity can only be adjusted through the Stock In / Stock Out process.
                </p>
              )}

              <div className="mt-2 flex gap-3 border-t border-[var(--surface-border)] pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {isSaving ? 'Saving…' : editingItem ? 'Save Changes' : 'Create Item'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-[var(--surface-border)] px-5 py-2 text-sm font-semibold transition hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── Stock Movement Modal ───────────────────────────────────────────────── */}
      {stockItem && (
        <StockMovementModal
          item={stockItem}
          onClose={() => setStockItem(null)}
          onSuccess={() => {
            setStockItem(null);
            void loadItems();
          }}
        />
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────────── */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative flex max-h-[90vh] max-w-4xl flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-12 right-0 cursor-pointer rounded-full bg-gray-800/50 p-2 text-white transition hover:bg-gray-800 hover:text-gray-300 focus:outline-none"
            >
              <span className="sr-only">Close Preview</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={previewImageUrl}
              alt="Full-size preview"
              className="max-h-[80vh] max-w-full rounded-lg border border-gray-700 bg-gray-900 object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      )}
    </main>
  );
}