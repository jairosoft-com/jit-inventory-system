import { useEffect, useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore, Category, CreateCategoryInput } from '../store/categoryStore';
import api from '../lib/api';
import { Item } from '../store/itemsStore';

export default function CategoryManagementPage() {
  const { user } = useAuthStore();
  const {
    categories,
    isLoading,
    error: storeError,
    fetchCategories,
    createCategory,
    updateCategory,
    archiveCategory,
    clearError,
  } = useCategoryStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  // Linked items modal state
  const [selectedCategoryForItems, setSelectedCategoryForItems] = useState<Category | null>(null);
  const [linkedItems, setLinkedItems] = useState<Item[]>([]);
  const [isLinkedItemsLoading, setIsLinkedItemsLoading] = useState(false);
  const [linkedItemsError, setLinkedItemsError] = useState<string | null>(null);

  const fetchLinkedItems = async (category: Category) => {
    setSelectedCategoryForItems(category);
    setIsLinkedItemsLoading(true);
    setLinkedItemsError(null);
    setLinkedItems([]);
    try {
      const response = await api.get<{ data: Item[] }>('/items', {
        params: {
          categoryId: category.id,
          limit: 1000,
        },
      });
      setLinkedItems(response.data.data);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch linked items';
      setLinkedItemsError(errMsg);
    } finally {
      setIsLinkedItemsLoading(false);
    }
  };
  const [filterTab, setFilterTab] = useState<'active' | 'archived'>('active');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [formData, setFormData] = useState<CreateCategoryInput>({
    name: '',
    type: 'EQUIPMENT',
    description: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories(true);
  }, [fetchCategories]);

  // Resolve user permissions
  const permissions = useMemo(() => {
    if (!user || !user.permissions) return [];
    return user.permissions.map((p) => (typeof p === 'string' ? p : p.name || ''));
  }, [user]);

  const canCreate = permissions.includes('categories:create');
  const canUpdate = permissions.includes('categories:update');
  const canDelete = permissions.includes('categories:delete');

  // Filter categories based on search term and selected type
  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return categories.filter((cat) => {
      const matchesSearch =
        cat.name.toLowerCase().includes(term) ||
        (cat.description && cat.description.toLowerCase().includes(term));
      const matchesType = selectedType === 'all' || cat.type === selectedType;

      const matchesTab = filterTab === 'active' ? !cat.deletedAt : !!cat.deletedAt;

      return matchesSearch && matchesType && matchesTab;
    });
  }, [categories, searchTerm, selectedType, filterTab]);

  // Summaries
  const summaries = useMemo(() => {
    const activeCats = categories.filter((c) => !c.deletedAt);
    const archivedCats = categories.filter((c) => !!c.deletedAt);
    const total = activeCats.length;
    const equipment = activeCats.filter((c) => c.type === 'EQUIPMENT').length;
    const consumable = activeCats.filter((c) => c.type === 'CONSUMABLE').length;
    const digital = activeCats.filter((c) => c.type === 'DIGITAL').length;
    const archived = archivedCats.length;
    return { total, equipment, consumable, digital, archived };
  }, [categories]);

  const handleOpenCreate = () => {
    if (!canCreate) return;
    setEditingCategory(null);
    setFormData({
      name: '',
      type: 'EQUIPMENT',
      description: '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    if (!canUpdate || category.deletedAt) return;
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      description: category.description || '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const nameTrimmed = formData.name.trim();
    if (!nameTrimmed) {
      setFormError('Category name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: nameTrimmed,
          type: formData.type,
          description: formData.description || null,
        });
        setSuccessMessage('Category updated successfully');
      } else {
        await createCategory({
          name: nameTrimmed,
          type: formData.type,
          description: formData.description || null,
        });
        setSuccessMessage('Category created successfully');
      }
      setIsFormOpen(false);
      // Auto-fade success message
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'An error occurred while saving the category';
      setFormError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (id: number, name: string) => {
    if (!canDelete) return;
    if (!window.confirm(`Are you sure you want to archive the category "${name}"?`)) {
      return;
    }

    setSuccessMessage(null);
    try {
      await archiveCategory(id);
      setSuccessMessage(`Category "${name}" archived successfully`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to archive category';
      alert(errMsg);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">Inventory Settings</p>
            <h1 className="mt-1 text-2xl font-semibold">Category Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Organize and classify items within the system. Define types to enforce schema rules
              for equipment, consumables, and digital assets.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fetchCategories(true)}
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
                Add Category
              </button>
            )}
          </div>
        </header>

        {/* Global/Store Error or Success Message */}
        {storeError && (
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

        {/* Summaries */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 stagger-children">
          <SummaryCard title="Total Categories" value={summaries.total} icon="📊" />
          <SummaryCard title="Equipment Categories" value={summaries.equipment} icon="🛠️" />
          <SummaryCard title="Consumables Categories" value={summaries.consumable} icon="📦" />
          <SummaryCard title="Digital Asset Categories" value={summaries.digital} icon="💻" />
          <SummaryCard title="Archived Categories" value={summaries.archived} icon="📁" />
        </section>

        {/* Main Card with filters & table */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[var(--surface-border)] pb-4 sm:flex-row sm:items-center">
            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilterTab('active')}
                className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
                  filterTab === 'active'
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Active
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('archived')}
                className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
                  filterTab === 'archived'
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Archived
              </button>
            </div>

            <div className="text-xs text-[var(--text-tertiary)] font-medium">
              Showing {filteredCategories.length} of {categories.length} records
            </div>
          </div>

          {/* Search and Dropdown Filter */}
          <div className="grid gap-3 md:grid-cols-[1fr_200px]">
            <div className="relative flex items-center">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search categories by name or description..."
                className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-border-focus)]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            >
              <option value="all">All Types</option>
              <option value="EQUIPMENT">Equipment</option>
              <option value="CONSUMABLE">Consumable</option>
              <option value="DIGITAL">Digital Asset</option>
            </select>
          </div>

          {/* Table Area */}
          {isLoading ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-12 text-center animate-pulse">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <h3 className="mt-3 font-medium text-[var(--text-primary)]">Loading categories...</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Please wait while we fetch inventory settings.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="mt-6 hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Name</th>
                      <th className="px-5 py-3.5 font-semibold">Type</th>
                      <th className="px-5 py-3.5 font-semibold">Description</th>
                      <th className="px-5 py-3.5 font-semibold">Linked Items</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      {(canUpdate || canDelete) && (
                        <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {filteredCategories.map((cat) => (
                      <tr key={cat.id} className="transition hover:bg-[var(--surface-hover)] group">
                        <td className="px-5 py-3.5 font-medium text-[var(--text-primary)]">
                          {cat.name}
                        </td>
                        <td className="px-5 py-3.5">
                          <TypeBadge type={cat.type} />
                        </td>
                        <td
                          className="max-w-md px-5 py-3.5 text-[var(--text-secondary)] truncate"
                          title={cat.description || ''}
                        >
                          {cat.description || (
                            <span className="italic text-[var(--text-disabled)]">
                              No description
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium">
                          {(cat._count?.items ?? 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => fetchLinkedItems(cat)}
                              className="text-[var(--accent)] hover:underline font-semibold cursor-pointer"
                            >
                              {cat._count?.items}
                            </button>
                          ) : (
                            <span className="text-[var(--text-secondary)]">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {cat.deletedAt ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                              Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                              Active
                            </span>
                          )}
                        </td>
                        {(canUpdate || canDelete) && (
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canUpdate && !cat.deletedAt && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(cat)}
                                  className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                                >
                                  Edit
                                </button>
                              )}
                              {canDelete && !cat.deletedAt && (() => {
                                const hasLinkedItems = (cat._count?.items ?? 0) > 0;
                                return hasLinkedItems ? (
                                  <button
                                    type="button"
                                    disabled
                                    title="this category is currently linked to items in your inventory, unlink to archive"
                                    className="rounded-lg border border-[var(--surface-border)] bg-[var(--background-secondary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-disabled)] cursor-not-allowed opacity-55"
                                  >
                                    Archive
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleArchive(cat.id, cat.name)}
                                    className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:border-red-200"
                                  >
                                    Archive
                                  </button>
                                );
                              })()}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Grid */}
              <div className="mt-6 grid gap-4 md:hidden">
                {filteredCategories.map((cat) => (
                  <article
                    key={cat.id}
                    className="rounded-xl border border-[var(--surface-border)] p-4 hover:shadow-[var(--shadow-sm)] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)]">{cat.name}</h3>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {cat.description || (
                            <span className="italic text-[var(--text-disabled)]">
                              No description
                            </span>
                          )}
                        </p>
                        <p className="mt-2 text-xs text-[var(--text-tertiary)] font-medium">
                          Linked Items:{' '}
                          {(cat._count?.items ?? 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => fetchLinkedItems(cat)}
                              className="font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                            >
                              {cat._count?.items}
                            </button>
                          ) : (
                            <span className="font-semibold text-[var(--text-primary)]">0</span>
                          )}
                        </p>
                      </div>
                      <TypeBadge type={cat.type} />
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[var(--surface-border)] pt-3">
                      {cat.deletedAt ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                          Archived
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                          Active
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        {canUpdate && !cat.deletedAt && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cat)}
                            className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)]"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && !cat.deletedAt && (() => {
                          const hasLinkedItems = (cat._count?.items ?? 0) > 0;
                          return hasLinkedItems ? (
                            <button
                              type="button"
                              disabled
                              title="this category is currently linked to items in your inventory, unlink to archive"
                              className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-xs font-semibold transition bg-[var(--background-secondary)] text-[var(--text-disabled)] cursor-not-allowed opacity-55"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleArchive(cat.id, cat.name)}
                              className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-xs font-semibold transition hover:bg-red-50"
                            >
                              Archive
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Empty State */}
              {filteredCategories.length === 0 && (
                <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-xl">
                    📁
                  </div>
                  <h3 className="mt-4 font-semibold text-[var(--text-primary)]">
                    {filterTab === 'archived'
                      ? 'No archived categories found'
                      : 'No active categories found'}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {filterTab === 'archived'
                      ? searchTerm || selectedType !== 'all'
                        ? 'No archived categories match your search criteria.'
                        : 'There are no archived categories in the system.'
                      : searchTerm || selectedType !== 'all'
                        ? 'Try refining your search query or selected type filter.'
                        : 'No inventory categories have been created yet.'}
                  </p>
                  {canCreate && !searchTerm && selectedType === 'all' && filterTab === 'active' && (
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
                    >
                      Create First Category
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </section>

      {/* Modal Dialog Form (Add / Edit) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-lg rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
            <div className="mb-5 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {editingCategory
                    ? 'Modify the category properties below.'
                    : 'Create a new classification category for inventory tracking.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
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
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cat-name"
                  className="text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="cat-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Laptops, Office Supplies, Software Licenses"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cat-type"
                  className="text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Category Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="cat-type"
                  required
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as 'EQUIPMENT' | 'CONSUMABLE' | 'DIGITAL',
                    })
                  }
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                >
                  <option value="EQUIPMENT">
                    Equipment (Trackable individual assets with serial numbers)
                  </option>
                  <option value="CONSUMABLE">
                    Consumable (Stock-based items tracked by bulk quantities)
                  </option>
                  <option value="DIGITAL">
                    Digital Asset (Licenses, subscriptions, software keys)
                  </option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cat-desc"
                  className="text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Description
                </label>
                <textarea
                  id="cat-desc"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide a brief explanation of the items belonging to this category..."
                  rows={3}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)] resize-none"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  )}
                  {editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Linked Items Modal */}
      {selectedCategoryForItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-4xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up flex flex-col max-h-[85vh]">
            <div className="mb-5 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Items in</span>
                  <span className="rounded bg-[var(--background-tertiary)] px-2 py-0.5 text-sm font-bold text-[var(--accent)]">
                    {selectedCategoryForItems.name}
                  </span>
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Active items assigned to this category.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategoryForItems(null)}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              {isLinkedItemsLoading ? (
                <div className="py-12 text-center">
                  <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                  <h3 className="mt-3 font-medium text-[var(--text-primary)]">Loading items...</h3>
                </div>
              ) : linkedItemsError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {linkedItemsError}
                </div>
              ) : linkedItems.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-xl">
                    📦
                  </div>
                  <h3 className="mt-4 font-semibold text-[var(--text-primary)]">No items found</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    There are no active items currently linked to this category.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--surface-border)]">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)] sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Item Name</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Details / Status</th>
                        <th className="px-4 py-3 font-semibold">Barcode</th>
                        <th className="px-4 py-3 font-semibold">Created At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--surface-border)]">
                      {linkedItems.map((item) => (
                        <tr key={item.id} className="transition hover:bg-[var(--surface-hover)]">
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                            <div>
                              <p className="font-semibold">{item.itemName}</p>
                              {item.description && (
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                              {item.itemType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                            {/* Consumable Details */}
                            {item.itemType === 'CONSUMABLE' && item.consumableProfile && (
                              <div className="flex flex-col gap-0.5">
                                <p>
                                  <span className="font-medium text-[var(--text-primary)]">Quantity:</span>{' '}
                                  {item.consumableProfile.quantity} {item.consumableProfile.unit}
                                </p>
                                <p>
                                  <span className="font-medium">Reorder Point:</span>{' '}
                                  {item.consumableProfile.reorderPoint}
                                </p>
                                <span className={`inline-flex w-fit rounded-full px-1.5 py-0.5 text-[9px] font-bold mt-1 ${
                                  item.consumableProfile.status === 'IN_STOCK'
                                    ? 'bg-[var(--success-muted)] text-[var(--success)]'
                                    : item.consumableProfile.status === 'LOW_STOCK'
                                    ? 'bg-[var(--warning-muted)] text-[var(--warning)]'
                                    : 'bg-red-50 text-red-700'
                                }`}>
                                  {item.consumableProfile.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                            )}

                            {/* Equipment Details */}
                            {item.itemType === 'EQUIPMENT' && item.equipment && (
                              <div className="flex flex-col gap-0.5">
                                <p>
                                  <span className="font-medium text-[var(--text-primary)]">Asset ID:</span>{' '}
                                  {item.equipment.assetId}
                                </p>
                                {(item.equipment.brand || item.equipment.model) && (
                                  <p>
                                    <span className="font-medium">Model:</span>{' '}
                                    {item.equipment.brand} {item.equipment.model}
                                  </p>
                                )}
                                {item.equipment.serialNumber && (
                                  <p>
                                    <span className="font-medium">S/N:</span>{' '}
                                    {item.equipment.serialNumber}
                                  </p>
                                )}
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span className="inline-flex rounded-full bg-[var(--accent-muted)] text-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold">
                                    {item.equipment.status.replace(/_/g, ' ')}
                                  </span>
                                  <span className="inline-flex rounded-full bg-[var(--background-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.5 text-[9px] font-bold">
                                    {item.equipment.condition}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Digital Asset Details */}
                            {item.itemType === 'DIGITAL' && item.digitalAsset && (
                              <div className="flex flex-col gap-0.5">
                                <p>
                                  <span className="font-medium text-[var(--text-primary)]">Asset Type:</span>{' '}
                                  {item.digitalAsset.assetType}
                                </p>
                                {item.digitalAsset.vendor && (
                                  <p>
                                    <span className="font-medium">Vendor:</span>{' '}
                                    {item.digitalAsset.vendor}
                                  </p>
                                )}
                                {item.digitalAsset.seats != null && (
                                  <p>
                                    <span className="font-medium">Seats:</span>{' '}
                                    {item.digitalAsset.seats}
                                  </p>
                                )}
                                <span className={`inline-flex w-fit rounded-full px-1.5 py-0.5 text-[9px] font-bold mt-1 ${
                                  item.digitalAsset.status === 'ACTIVE'
                                    ? 'bg-[var(--success-muted)] text-[var(--success)]'
                                    : 'bg-red-50 text-red-700'
                                }`}>
                                  {item.digitalAsset.status}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                            {item.barcode || <span className="italic text-[var(--text-disabled)]">-</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-end border-t border-[var(--surface-border)] pt-4">
              <button
                type="button"
                onClick={() => setSelectedCategoryForItems(null)}
                className="rounded-xl bg-[var(--background-tertiary)] hover:bg-[var(--surface-hover)] px-5 py-2 text-sm font-semibold text-[var(--text-primary)] transition"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

// Subcomponents helper
function SummaryCard({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] hover:shadow-md transition duration-200">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-2xl">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </p>
        <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      </div>
    </article>
  );
}

function TypeBadge({ type }: { type: 'EQUIPMENT' | 'CONSUMABLE' | 'DIGITAL' }) {
  let classes = 'bg-[var(--background-tertiary)] text-[var(--text-secondary)]';
  let label = 'Unknown';

  if (type === 'EQUIPMENT') {
    classes = 'bg-[var(--accent-muted)] text-[var(--accent)]';
    label = 'Equipment';
  } else if (type === 'CONSUMABLE') {
    classes = 'bg-[var(--warning-muted)] text-[var(--warning)]';
    label = 'Consumable';
  } else if (type === 'DIGITAL') {
    classes = 'bg-[var(--info-muted)] text-[var(--info)]';
    label = 'Digital Asset';
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>
      {label}
    </span>
  );
}
