import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { useItemsStore, type Item } from '../store/itemsStore';

function generateItemCode(existingItems: Item[]): string {
  const highest = existingItems.reduce((max, item) => {
    if (!item.barcode) return max;
    const match = item.barcode.match(/^ITM-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `ITM-${String(highest + 1).padStart(3, '0')}`;
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

// ── Sub-components ─────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function InventoryManagementPage() {
  const { user } = useAuthStore();
  const { categories, fetchCategories } = useCategoryStore();
  const {
    items,
    meta,
    isLoading,
    error: storeError,
    fetchItems,
    createItem,
    updateItem,
    archiveItem,
    clearError,
  } = useItemsStore();

  const fetchingRef = useRef(false);

  // ── Local UI state ──────────────────────────────────────────────────────────

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');

  // form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const query: Record<string, unknown> = { itemType: 'CONSUMABLE' };
      if (selectedCategoryId !== 'all') query.categoryId = Number(selectedCategoryId);
      if (searchTerm.trim()) query.search = searchTerm.trim();
      await fetchItems(query as any);
    } finally {
      fetchingRef.current = false;
    }
  }, [fetchItems, selectedCategoryId, searchTerm]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    fetchCategories(false);
  }, [fetchCategories]);

  // ── Derived ─────────────────────────────────────────────────────────────────

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
    return { total: meta.total, inStock, lowStock, outOfStock };
  }, [items, meta.total]);

  const generatedCode = useMemo(() => generateItemCode(items), [items]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingItem(null);
    setFormError('');
    setIsFormOpen(true);
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setFormError('');
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingItem(null);
    setFormError('');
  }

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
        const updatePayload: Record<string, unknown> = { ...base };
        const unit = String(fd.get('unit') ?? '').trim();
        const qty = Number(fd.get('quantity'));
        const reorder = Number(fd.get('reorderPoint'));
        if (unit) updatePayload.unit = unit;
        if (!isNaN(qty)) updatePayload.quantity = qty;
        if (!isNaN(reorder)) updatePayload.reorderPoint = reorder;

        await updateItem(editingItem.id, updatePayload);
        setSuccessMessage('Item updated successfully.');
      } else {
        const createPayload = {
          ...base,
          itemType: 'CONSUMABLE',
          consumableProfile: {
            unit: String(fd.get('unit') ?? '').trim() || 'pcs',
            quantity: Number(fd.get('quantity') ?? 0),
            reorderPoint: Number(fd.get('reorderPoint') ?? 0),
          },
        };

        await createItem(createPayload);
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

  // ── Render ────────────────────────────────────────────────────────────────────

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
              onClick={() => void loadItems()}
              disabled={isLoading}
              className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={openCreate}
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
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total Items" value={summaries.total} icon="📦" />
          <SummaryCard title="In Stock" value={summaries.inStock} icon="✅" />
          <SummaryCard title="Low Stock" value={summaries.lowStock} icon="⚠️" />
          <SummaryCard title="Out of Stock" value={summaries.outOfStock} icon="🚫" />
        </section>

        {/* Table */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
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
              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                    <tr>
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
        </section>
      </section>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-lg rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
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
              <div className="grid gap-3 md:grid-cols-3">
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
                    Quantity
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    min="0"
                    defaultValue={editingItem?.consumableProfile?.quantity ?? 0}
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                  />
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
    </main>
  );
}
