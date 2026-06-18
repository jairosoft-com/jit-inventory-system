import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { useItemsStore, type Item, type ItemImage } from '../store/itemsStore';
import StockMovementModal from '../components/StockMovementModal';
// ── Constants (image upload) ───────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

interface PendingImage {
  url: string;
  label: string;
  isPrimary: boolean;
  size: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusLabel(item: Item): string {
  if (item.consumableProfile) {
    const s = item.consumableProfile.status;
    if (s === 'IN_STOCK') return 'In Stock';
    if (s === 'LOW_STOCK') return 'Low Stock';
    if (s === 'OUT_OF_STOCK') return 'Out of Stock';
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ item }: { item: Item }) {
  const label = getStatusLabel(item);
  const variant = getStatusVariant(item);

  const cls = {
    success: 'bg-[var(--success-muted)] text-[var(--success)]',
    warning: 'bg-[var(--warning-muted)] text-[var(--warning)]',
    danger: 'bg-red-50 text-red-700',
    neutral: 'bg-[var(--background-tertiary)] text-[var(--text-secondary)]',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
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

// ── Page ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type SubTab = 'active' | 'archived';
type ItemTypeFilter = 'CONSUMABLE' | 'DIGITAL' | 'all';
type StatusFilter = 'all' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

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

  const fetchingActiveRef = useRef(false);
  const fetchingArchivedRef = useRef(false);

  // ── Local UI state ──────────────────────────────────────────────────────────

  const [subTab, setSubTab] = useState<SubTab>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedItemType, setSelectedItemType] = useState<ItemTypeFilter>('CONSUMABLE');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedCategoryId, setAppliedCategoryId] = useState('all');
  const [appliedItemType, setAppliedItemType] = useState<ItemTypeFilter>('CONSUMABLE');
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
    return ((user as any).permissions as any[]).map((p: any) =>
      typeof p === 'string' ? p : (p.name ?? ''),
    );
  }, [user]);

  const isAdmin = (user as any)?.role?.name === 'ADMIN';
  const canCreate = isAdmin || permissions.includes('inventory:create');
  const canUpdate = isAdmin || permissions.includes('inventory:update');
  const canDelete = isAdmin || permissions.includes('inventory:delete');

  // ── Load data ────────────────────────────────────────────────────────────────

  const buildQuery = useCallback(() => {
    const query: Record<string, unknown> = { itemType: 'CONSUMABLE' };
    if (selectedCategoryId !== 'all') query.categoryId = Number(selectedCategoryId);
    if (searchTerm.trim()) query.search = searchTerm.trim();
    return query;
  }, [selectedCategoryId, searchTerm]);

  const loadItems = useCallback(async () => {
    if (fetchingActiveRef.current) return;
    fetchingActiveRef.current = true;
    try {
      await fetchItems(buildQuery() as any);
    } finally {
      fetchingActiveRef.current = false;
    }
  }, [fetchItems, buildQuery]);

  const loadArchivedItems = useCallback(async () => {
    if (fetchingArchivedRef.current) return;
    fetchingArchivedRef.current = true;
    try {
      await fetchArchivedItems(buildQuery() as any);
    } finally {
      fetchingArchivedRef.current = false;
    }
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

  // ── Derived ──────────────────────────────────────────────────────────────────

  const inventoryCategories = useMemo(
    () => categories.filter((c) => !c.deletedAt && c.type === 'CONSUMABLE'),
    [categories],
  );

  const summaries = useMemo(() => {
    const inStock = items.filter(
      (i) => i.consumableProfile?.status === 'IN_STOCK',
    ).length;
    const lowStock = items.filter(
      (i) => i.consumableProfile?.status === 'LOW_STOCK',
    ).length;
    const outOfStock = items.filter(
      (i) => i.consumableProfile?.status === 'OUT_OF_STOCK',
    ).length;
    return { total: meta.total, inStock, lowStock, outOfStock, archived: archivedMeta.total };
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

  // ── Image Handlers ────────────────────────────────────────────────────────────

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected after an error
    e.target.value = '';

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
    reader.onload = (event) => {
      const url = event.target?.result as string;
      if (!url) return;
      setPendingImages((prev) => [
        ...prev,
        {
          url,
          label: file.name,
          isPrimary: prev.length === 0 && (!editingItem || (editingItem.images?.length ?? 0) === 0),
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
    setPendingImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((img) => img.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  const handleDeleteExistingImage = async (itemId: number, imageId: number) => {
    if (!window.confirm('Remove this image?')) return;
    try {
      await deleteImage(itemId, imageId);
      setEditingItem((prev) =>
        prev ? { ...prev, images: prev.images.filter((img) => img.id !== imageId) } : prev,
      );
    } catch {
      // error already set in store
    }
  };

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const fd = new FormData(event.currentTarget);

    const base = {
      itemName: String(fd.get('itemName') ?? '').trim(),
      description: String(fd.get('description') ?? '').trim() || null,
      categoryId: Number(fd.get('categoryId')),
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
        const unit = String(fd.get('unit') ?? '').trim();
        const reorder = Number(fd.get('reorderPoint'));
        if (unit) updatePayload.unit = unit;
        if (!isNaN(reorder)) updatePayload.reorderPoint = reorder;

        await updateItem(editingItem.id, updatePayload);

        // Upload any newly selected images
        for (const img of pendingImages) {
          await addImage(editingItem.id, {
            url: img.url,
            label: img.label || null,
            isPrimary: img.isPrimary,
          });
        }

        setSuccessMessage('Item updated successfully.');
      } else {
        const createPayload = {
          ...base,
          itemType: 'CONSUMABLE',
          consumableProfile: {
            unit: String(fd.get('unit') ?? '').trim() || 'pcs',
            quantity: 0,
            reorderPoint: Number(fd.get('reorderPoint') ?? 0),
          },
        };

        const created = await createItem(createPayload);

        // Upload pending images after creation
        for (const img of pendingImages) {
          await addImage(created.id, {
            url: img.url,
            label: img.label || null,
            isPrimary: img.isPrimary,
          });
        }

        setSuccessMessage('Item created successfully.');
      }

      closeForm();
      void loadItems();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
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
      /* storeError handles it */
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────────────────────────────────────────────

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
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 animate-fade-in">
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
                className={`relative px-4 py-2.5 text-sm font-medium capitalize transition ${subTab === tab
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
          <div className="mb-5 flex flex-col gap-4 border-b border-[var(--surface-border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, barcode…"
                className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
              />
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
              >
                <option value="all">All Categories</option>
                {inventoryCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
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
                          <th className="px-4 py-3 font-medium w-14"></th>
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
                        {items.map((item) => {
                          const primaryImg = getPrimaryImage(item);
                          return (
                            <tr
                              key={item.id}
                              className="transition hover:bg-[var(--surface-hover)]"
                            >
                              {/* Image thumbnail */}
                              <td className="px-4 py-3">
                                {primaryImg ? (
                                  <div
                                    className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer shadow-sm hover:scale-110 transition-transform duration-200"
                                    onClick={() => setPreviewImageUrl(primaryImg.url)}
                                  >
                                    <img
                                      src={primaryImg.url}
                                      alt={item.itemName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-[var(--background-tertiary)] flex items-center justify-center text-[var(--text-disabled)] text-xs border border-[var(--surface-border)]">
                                    —
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium">{item.itemName}</p>
                                {item.barcode && (
                                  <p className="text-xs font-mono text-[var(--text-tertiary)]">
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
                                ) : '—'}
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="grid gap-3 md:hidden">
                    {items.map((item) => {
                      const primaryImg = getPrimaryImage(item);
                      return (
                        <article
                          key={item.id}
                          className="rounded-xl border border-[var(--surface-border)] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {primaryImg ? (
                                <img
                                  src={primaryImg.url}
                                  alt={item.itemName}
                                  className="h-10 w-10 rounded-lg object-cover cursor-pointer flex-shrink-0"
                                  onClick={() => setPreviewImageUrl(primaryImg.url)}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-[var(--background-tertiary)] flex items-center justify-center text-[var(--text-disabled)] text-xs border flex-shrink-0">
                                  —
                                </div>
                              )}
                              <div>
                                <p className="font-semibold">{item.itemName}</p>
                                <p className="text-xs text-[var(--text-secondary)]">
                                  {item.category.name}
                                </p>
                              </div>
                            </div>
                            <StatusBadge item={item} />
                          </div>
                          {item.consumableProfile && (
                            <p className="mt-2 text-xs text-[var(--text-secondary)]">
                              {item.consumableProfile.quantity} {item.consumableProfile.unit}
                              {' · reorder @ '}{item.consumableProfile.reorderPoint}
                            </p>
                          )}
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
                      );
                    })}
                  </div>

                  {items.length === 0 && (
                    <div className="py-16 text-center">
                      <p className="text-3xl">🔍</p>
                      <h3 className="mt-3 font-semibold">No items found</h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Try adjusting your filters or add a new item.
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
                                <p className="text-xs font-mono text-[var(--text-tertiary)]">
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
                              ) : '—'}
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
                            Last stock: {item.consumableProfile.quantity} {item.consumableProfile.unit}
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
                        Archived items will appear here.
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

      {/* ── Add / Edit Modal ───────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-lg rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up max-h-[95vh] overflow-y-auto">
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
              {/* ── Image Upload ─────────────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Images</p>

                {/* Existing images (edit mode) */}
                {editingItem && (editingItem.images?.length ?? 0) > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1.5">Current Images</p>
                    <div className="flex flex-wrap gap-2">
                      {editingItem.images.map((img) => (
                        <div key={img.id} className="relative group">
                          <img
                            src={img.url}
                            alt={img.label || 'Item image'}
                            className="h-16 w-16 rounded-lg object-cover border border-[var(--surface-border)] cursor-pointer"
                            onClick={() => setPreviewImageUrl(img.url)}
                          />
                          {img.isPrimary && (
                            <span className="absolute top-0.5 left-0.5 bg-[var(--accent)] text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                              Primary
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteExistingImage(editingItem.id, img.id)}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
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
                  <div className="mb-2">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1.5">
                      {editingItem ? 'New images to add' : 'Images to upload'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {pendingImages.map((img, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={img.url}
                            alt={img.label}
                            className="h-16 w-16 rounded-lg object-cover border border-[var(--surface-border)] cursor-pointer"
                            onClick={() => setPreviewImageUrl(img.url)}
                          />
                          {img.isPrimary && (
                            <span className="absolute top-0.5 left-0.5 bg-[var(--accent)] text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                              Primary
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePendingImage(i)}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
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
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                {imageError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 font-medium flex items-center justify-between gap-2">
                    <span>{imageError}</span>
                    <button type="button" onClick={() => setImageError(null)} className="font-bold text-red-800 hover:text-red-950">×</button>
                  </div>
                )}
                <p className="text-xs text-[var(--text-tertiary)]">Max size: 5 MB. Formats: JPG, JPEG, PNG</p>
              </div>
              {/* Common fields */}
              <div className="grid gap-3 md:grid-cols-2 border-t border-[var(--surface-border)] pt-4">
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
                    {inventoryCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
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
                    className="w-full cursor-not-allowed rounded-xl border border-[var(--surface-border)] bg-[var(--background-tertiary)] px-4 py-2.5 text-sm font-mono text-[var(--text-secondary)] outline-none"
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
                    {['pcs', 'box', 'pack', 'ream', 'roll', 'kg', 'g', 'lbs', 'L', 'mL', 'm', 'cm', 'bottle', 'can', 'pair', 'set', 'sheet', 'bag', 'tube', 'carton'].map((u) => (
                      <option key={u} value={u} />
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
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 focus:outline-none transition p-2 bg-gray-800/50 hover:bg-gray-800 rounded-full cursor-pointer"
            >
              <span className="sr-only">Close Preview</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewImageUrl}
              alt="Full-size preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-gray-700 bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </main>
  );
}