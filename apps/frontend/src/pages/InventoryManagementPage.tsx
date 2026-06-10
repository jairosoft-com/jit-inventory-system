import { useEffect, useState, useMemo, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  useItemStore,
  type Item,
  type ItemStatus,
  type ListItemsQuery,
} from '../store/itemStore';
import { useCategoryStore } from '../store/categoryStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

// ── Form State ────────────────────────────────────────────────────────────────

interface FormState {
  itemName: string;
  categoryId: string;
  description: string;
  barcode: string;
  unit: string;
  quantity: string;
  reorderPoint: string;
}

interface PendingImage {
  url: string;
  label: string;
  isPrimary: boolean;
  size: number;
}

const emptyForm: FormState = {
  itemName: '',
  categoryId: '',
  description: '',
  barcode: '',
  unit: 'pcs',
  quantity: '0',
  reorderPoint: '0',
};

function itemToForm(item: Item): FormState {
  const profile = item.consumableProfile;
  return {
    itemName: item.itemName,
    categoryId: String(item.categoryId),
    description: item.description || '',
    barcode: item.barcode || '',
    unit: profile?.unit || 'pcs',
    quantity: profile ? String(profile.quantity) : '0',
    reorderPoint: profile ? String(profile.reorderPoint) : '0',
  };
}

function getPrimaryImage(item: Item) {
  return item.images.find((img) => img.isPrimary) || item.images[0] || null;
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StockBadge({ status }: { status: ItemStatus }) {
  const styles: Record<ItemStatus, string> = {
    IN_STOCK: 'bg-[var(--success-muted)] text-[var(--success)]',
    LOW_STOCK: 'bg-[var(--warning-muted)] text-[var(--warning)]',
    OUT_OF_STOCK: 'bg-red-50 text-red-600',
    ARCHIVED: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<ItemStatus, string> = {
    IN_STOCK: 'In Stock',
    LOW_STOCK: 'Low Stock',
    OUT_OF_STOCK: 'Out of Stock',
    ARCHIVED: 'Archived',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-500'}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'IN_STOCK'
            ? 'bg-[var(--success)]'
            : status === 'LOW_STOCK'
              ? 'bg-[var(--warning)]'
              : status === 'OUT_OF_STOCK'
                ? 'bg-red-600'
                : 'bg-gray-400'
        }`}
      />
      {labels[status]}
    </span>
  );
}

// ── FormField helper ──────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  required?: boolean;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        required={required}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step={type === 'number' ? '1' : undefined}
        min={type === 'number' ? '0' : undefined}
        className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
      />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventoryManagementPage() {
  // ── Stores ──────────────────────────────────────────────────────────────────
  const { user } = useAuthStore();
  const {
    items,
    meta,
    isLoading,
    error: storeError,
    fetchItems,
    createItem,
    updateItem,
    addImage,
    deleteImage,
    clearError,
  } = useItemStore();
  const { categories, fetchCategories } = useCategoryStore();

  // Categories filtered to CONSUMABLE type only
  const consumableCategories = useMemo(
    () => categories.filter((c) => c.type === 'CONSUMABLE' && !c.deletedAt),
    [categories],
  );

  // ── Permissions ─────────────────────────────────────────────────────────────
  const permissions = useMemo(() => {
    if (!user || !(user as any).permissions) return [];
    return ((user as any).permissions as any[]).map((p: any) =>
      typeof p === 'string' ? p : p.name || '',
    );
  }, [user]);

  const roleName = user?.role?.name?.toUpperCase() || '';
  const isAdmin = roleName.includes('ADMIN');
  const canCreate = isAdmin || permissions.includes('inventory:create');
  const canUpdate = isAdmin || permissions.includes('inventory:update');

  // ── UI State ─────────────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ── Data Loading ──────────────────────────────────────────────────────────────
  const loadItems = useCallback(
    (page?: number, search?: string) => {
      const query: ListItemsQuery = {
        page: page ?? currentPage,
        limit: PAGE_SIZE,
        itemType: 'CONSUMABLE',
      };
      const s = search ?? searchInput.trim();
      if (s) query.search = s;
      fetchItems(query);
    },
    [currentPage, searchInput, fetchItems],
  );

  useEffect(() => {
    loadItems(1);
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Form Handlers ─────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setPendingImages([]);
    setImageError(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setFormData(itemToForm(item));
    setPendingImages([]);
    setImageError(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
    setFormData(emptyForm);
    setPendingImages([]);
    setFormError(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ── Image Handlers (identical to EquipmentPage) ───────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected after an error
    e.target.value = '';

    if (!file.type.startsWith('image/') || !ALLOWED_MIME_TYPES.includes(file.type)) {
      setImageError(`"${file.name}" is not a supported image. Only JPG, PNG, GIF, WEBP, AVIF are allowed.`);
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
          isPrimary: prev.length === 0 && (!editingItem || editingItem.images.length === 0),
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

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!formData.itemName.trim()) {
      setFormError('Item name is required.');
      return;
    }
    if (!formData.categoryId) {
      setFormError('Please select a category.');
      return;
    }
    if (!formData.unit.trim()) {
      setFormError('Unit is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        // ── Update ────────────────────────────────────────────────────────
        await updateItem(editingItem.id, {
          itemName: formData.itemName.trim(),
          categoryId: Number(formData.categoryId),
          description: formData.description.trim() || null,
          barcode: formData.barcode.trim() || null,
          unit: formData.unit.trim(),
          quantity: Number(formData.quantity),
          reorderPoint: Number(formData.reorderPoint),
        });

        // Upload any newly selected images
        for (const img of pendingImages) {
          await addImage(editingItem.id, {
            url: img.url,
            label: img.label || null,
            isPrimary: img.isPrimary,
          });
        }

        setSuccessMessage('Item updated successfully');
      } else {
        // ── Create ────────────────────────────────────────────────────────
        const created = await createItem({
          itemType: 'CONSUMABLE',
          itemName: formData.itemName.trim(),
          categoryId: Number(formData.categoryId),
          description: formData.description.trim() || null,
          barcode: formData.barcode.trim() || null,
          consumableProfile: {
            unit: formData.unit.trim(),
            quantity: Number(formData.quantity),
            reorderPoint: Number(formData.reorderPoint),
          },
        });

        // Upload pending images after creation
        for (const img of pendingImages) {
          await addImage(created.id, {
            url: img.url,
            label: img.label || null,
            isPrimary: img.isPrimary,
          });
        }

        setSuccessMessage('Item created successfully');
      }
      handleCloseForm();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      clearError();
      setFormError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Filter Handlers ────────────────────────────────────────────────────────────
  const handleSearch = () => {
    setCurrentPage(1);
    loadItems(1, searchInput.trim());
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setCurrentPage(1);
    loadItems(1, '');
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadItems(page, searchInput.trim());
  };

  // ── Summary counts ─────────────────────────────────────────────────────────────
  const inStock = items.filter((i) => i.consumableProfile?.status === 'IN_STOCK').length;
  const lowStock = items.filter((i) => i.consumableProfile?.status === 'LOW_STOCK').length;
  const outOfStock = items.filter((i) => i.consumableProfile?.status === 'OUT_OF_STOCK').length;

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">
              Consumables & Supplies
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Inventory Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Track consumable stock levels, manage reorder points, and upload item images.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => loadItems()}
              className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
            >
              Refresh
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
              >
                + Add Item
              </button>
            )}
          </div>
        </header>

        {/* ── Summary Tiles ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Items', value: meta.total, color: 'text-[var(--text-primary)]' },
            { label: 'In Stock', value: inStock, color: 'text-[var(--success)]' },
            { label: 'Low Stock', value: lowStock, color: 'text-[var(--warning)]' },
            { label: 'Out of Stock', value: outOfStock, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"
            >
              <p className="text-xs text-[var(--text-secondary)] font-medium">{label}</p>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Alerts ───────────────────────────────────────────────────── */}
        {storeError && !isFormOpen && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{storeError}</span>
            <button onClick={clearError} className="font-semibold text-red-800 hover:text-red-950">
              Dismiss
            </button>
          </div>
        )}
        {successMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 animate-fade-in">
            {successMessage}
          </div>
        )}

        {/* ── Main Card ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">

          {/* Filters Row */}
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[var(--surface-border)] pb-4 sm:flex-row sm:items-center">
            <div className="text-xs text-[var(--text-tertiary)] font-medium">
              Showing {items.length} of {meta.total} records
              {meta.totalPages > 1 && ` · Page ${meta.page} of ${meta.totalPages}`}
            </div>
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                Clear Search
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by name, barcode, description..."
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-border-focus)]"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
            >
              Search
            </button>
          </div>

          {/* ── Table ─────────────────────────────────────────────────── */}
          {isLoading ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-12 text-center animate-pulse">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <h3 className="mt-3 font-medium text-[var(--text-primary)]">Loading inventory...</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Fetching data from the server.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="mt-6 hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-4 py-3.5 font-semibold w-14"></th>
                      <th className="px-4 py-3.5 font-semibold">Item</th>
                      <th className="px-4 py-3.5 font-semibold">Category</th>
                      <th className="px-4 py-3.5 font-semibold">Stock</th>
                      <th className="px-4 py-3.5 font-semibold">Status</th>
                      {canUpdate && (
                        <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {items.map((item) => {
                      const primaryImg = getPrimaryImage(item);
                      const profile = item.consumableProfile;
                      return (
                        <tr key={item.id} className="transition hover:bg-[var(--surface-hover)] group">
                          {/* Image */}
                          <td className="px-4 py-4">
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

                          {/* Item Info */}
                          <td className="px-4 py-4">
                            <div className="font-medium text-[var(--text-primary)]">{item.itemName}</div>
                            {item.barcode && (
                              <div className="text-[var(--text-tertiary)] font-mono text-xs mt-0.5">
                                {item.barcode}
                              </div>
                            )}
                            {item.description && (
                              <div className="text-[var(--text-disabled)] text-xs mt-0.5 truncate max-w-xs">
                                {item.description}
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td className="px-4 py-4 text-[var(--text-secondary)] text-sm">
                            {item.category.name}
                          </td>

                          {/* Stock */}
                          <td className="px-4 py-4 text-sm">
                            {profile ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {profile.quantity} {profile.unit}
                                </span>
                                <span className="text-xs text-[var(--text-tertiary)]">
                                  Reorder @ {profile.reorderPoint}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[var(--text-disabled)]">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            {profile ? (
                              <StockBadge status={profile.status} />
                            ) : (
                              <span className="text-[var(--text-disabled)] text-xs">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          {canUpdate && (
                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="mt-6 grid gap-4 md:hidden">
                {items.map((item) => {
                  const primaryImg = getPrimaryImage(item);
                  const profile = item.consumableProfile;
                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border border-[var(--surface-border)] p-4 hover:shadow-[var(--shadow-sm)] transition"
                    >
                      <div className="flex items-start gap-3">
                        {primaryImg ? (
                          <img
                            src={primaryImg.url}
                            alt={item.itemName}
                            className="h-12 w-12 rounded-lg object-cover cursor-pointer flex-shrink-0"
                            onClick={() => setPreviewImageUrl(primaryImg.url)}
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-[var(--background-tertiary)] flex items-center justify-center text-[var(--text-disabled)] text-xs border flex-shrink-0">
                            —
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[var(--text-primary)] truncate">{item.itemName}</h3>
                          <p className="text-xs text-[var(--text-disabled)]">{item.category.name}</p>
                          {profile && (
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                              {profile.quantity} {profile.unit}
                            </p>
                          )}
                        </div>
                        {profile && <StockBadge status={profile.status} />}
                      </div>
                      {canUpdate && (
                        <div className="mt-3 flex justify-end border-t border-[var(--surface-border)] pt-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)]"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Empty State */}
              {items.length === 0 && !isLoading && (
                <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-xl">
                    📦
                  </div>
                  <h3 className="mt-4 font-semibold text-[var(--text-primary)]">No items found</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {searchInput
                      ? 'Try adjusting your search criteria.'
                      : 'Add your first consumable item to get started.'}
                  </p>
                  {canCreate && !searchInput && (
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
                    >
                      Add First Item
                    </button>
                  )}
                </div>
              )}

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Page {meta.page} of {meta.totalPages} · {meta.total} total records
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={meta.page <= 1}
                      onClick={() => handlePageChange(meta.page - 1)}
                      className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => handlePageChange(meta.page + 1)}
                      className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </section>

      {/* ── Modal Form ────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-2xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl animate-fade-in-up max-h-[95vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex-shrink-0 flex items-center justify-between border-b border-[var(--surface-border)] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {editingItem
                    ? `Editing ${editingItem.itemName}`
                    : 'Add a new consumable item to inventory.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {formError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                {/* ── Images ──────────────────────────────────────────── */}
                <fieldset>
                  <legend className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                    Images
                  </legend>

                  {/* Existing images (edit mode) */}
                  {editingItem && editingItem.images.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-[var(--text-secondary)] mb-2">Current Images</p>
                      <div className="flex flex-wrap gap-3">
                        {editingItem.images.map((img) => (
                          <div key={img.id} className="relative group">
                            <img
                              src={img.url}
                              alt={img.label || 'Item image'}
                              className="h-20 w-20 rounded-lg object-cover border border-[var(--surface-border)] cursor-pointer"
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
                    <div className="mb-3">
                      <p className="text-xs text-[var(--text-secondary)] mb-2">
                        {editingItem ? 'New images to add' : 'Images to upload'}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {pendingImages.map((img, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={img.url}
                              alt={img.label}
                              className="h-20 w-20 rounded-lg object-cover border border-[var(--surface-border)] cursor-pointer"
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
                  <div className="flex flex-col gap-2 w-full">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {imageError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 font-medium flex items-center justify-between gap-2">
                        <span>{imageError}</span>
                        <button type="button" onClick={() => setImageError(null)} className="font-bold text-red-800 hover:text-red-950">×</button>
                      </div>
                    )}
                    <p className="text-xs text-[var(--text-tertiary)]">Max size: 5 MB. Formats: JPG, PNG, GIF, WEBP</p>
                  </div>
                </fieldset>

                {/* ── Item Details ─────────────────────────────────────── */}
                <fieldset>
                  <legend className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                    Item Details
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      label="Item Name"
                      required
                      name="itemName"
                      value={formData.itemName}
                      onChange={handleInputChange}
                      placeholder="e.g. Ballpoint Pens"
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        name="categoryId"
                        value={formData.categoryId}
                        onChange={handleInputChange}
                        className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                      >
                        <option value="">Select category...</option>
                        {consumableCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {consumableCategories.length === 0 && (
                        <p className="text-xs text-[var(--text-disabled)]">
                          No consumable categories found. Create one first.
                        </p>
                      )}
                    </div>
                    <FormField
                      label="Barcode"
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleInputChange}
                      placeholder="e.g. 1234567890123"
                    />
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Optional description..."
                        rows={2}
                        className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)] resize-none"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* ── Stock Details ────────────────────────────────────── */}
                <fieldset>
                  <legend className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                    Stock Details
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FormField
                      label="Unit"
                      required
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      placeholder="e.g. pcs, boxes, reams"
                    />
                    <FormField
                      label="Quantity"
                      name="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      placeholder="0"
                    />
                    <FormField
                      label="Reorder Point"
                      name="reorderPoint"
                      type="number"
                      value={formData.reorderPoint}
                      onChange={handleInputChange}
                      placeholder="0"
                    />
                  </div>
                </fieldset>

                {/* ── Form Actions ─────────────────────────────────────── */}
                <div className="mt-2 flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    )}
                    {editingItem ? 'Save Changes' : 'Add Item'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────── */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4 transition-all duration-300 ease-out"
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
