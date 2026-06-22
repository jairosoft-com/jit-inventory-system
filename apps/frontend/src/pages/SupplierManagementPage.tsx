import { useEffect, useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSupplierStore, Supplier, SupplierHistory } from '../store/supplierStore';

export default function SupplierManagementPage() {
  const { user } = useAuthStore();
  const {
    suppliers,
    supplierHistory,
    isLoading,
    error: storeError,
    fetchSuppliers,
    createSupplier,
    updateSupplier,
    archiveSupplier,
    fetchSupplierHistory,
    clearError,
  } = useSupplierStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'active' | 'archived'>('active');

  // Modal control states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null);

  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [archiveTargetSupplier, setArchiveTargetSupplier] = useState<Supplier | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    supplierName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all suppliers (active + archived) on mount
  useEffect(() => {
    fetchSuppliers(true);
  }, [fetchSuppliers]);

  // Resolve user permissions
  const permissions = useMemo(() => {
    if (!user || !user.permissions) return [];
    return user.permissions.map((p) => (typeof p === 'string' ? p : p.name || ''));
  }, [user]);

  const canRead = permissions.includes('suppliers:read');
  const canCreate = permissions.includes('suppliers:create');
  const canUpdate = permissions.includes('suppliers:update');
  const canDelete = permissions.includes('suppliers:delete');

  // Filter suppliers based on search criteria and active/archived tab
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return suppliers.filter((sup) => {
      const matchesSearch =
        sup.supplierName.toLowerCase().includes(term) ||
        (sup.contactPerson && sup.contactPerson.toLowerCase().includes(term)) ||
        (sup.email && sup.email.toLowerCase().includes(term)) ||
        (sup.phone && sup.phone.toLowerCase().includes(term)) ||
        (sup.address && sup.address.toLowerCase().includes(term));

      const matchesTab = filterTab === 'active' ? !sup.deletedAt : !!sup.deletedAt;

      return matchesSearch && matchesTab;
    });
  }, [suppliers, searchTerm, filterTab]);

  // Statistics summaries
  const summaries = useMemo(() => {
    const active = suppliers.filter((s) => !s.deletedAt);
    const archived = suppliers.filter((s) => !!s.deletedAt);
    const linkedToPOs = active.filter(
      (s) => s._count?.purchaseOrders && s._count.purchaseOrders > 0,
    );

    return {
      total: active.length,
      active: active.length,
      archived: archived.length,
      linkedToPOs: linkedToPOs.length,
    };
  }, [suppliers]);

  // If user has no read permission, block access immediately
  if (!canRead) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-6 py-12 flex items-center justify-center">
        <section className="max-w-md w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
            🔒
          </div>
          <h1 className="mt-6 text-xl font-bold text-[var(--text-primary)]">Access Denied</h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            You do not have the required permissions to access supplier records. Please contact your
            administrator.
          </p>
        </section>
      </main>
    );
  }

  const handleOpenCreate = () => {
    if (!canCreate) return;
    setEditingSupplier(null);
    setFormData({
      supplierName: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    if (!canUpdate || supplier.deletedAt) return;
    setEditingSupplier(supplier);
    setFormData({
      supplierName: supplier.supplierName,
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const nameTrimmed = formData.supplierName.trim();
    if (!nameTrimmed) {
      setFormError('Supplier name is required');
      return;
    }

    const contactPersonTrimmed = formData.contactPerson.trim();
    if (!contactPersonTrimmed) {
      setFormError('Contact person is required');
      return;
    }

    const emailTrimmed = formData.email.trim();
    if (!emailTrimmed) {
      setFormError('Email address is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setFormError('Invalid email address format');
      return;
    }

    const phoneTrimmed = formData.phone.trim();
    if (!phoneTrimmed) {
      setFormError('Phone number is required');
      return;
    }

    const addressTrimmed = formData.address.trim();
    if (!addressTrimmed) {
      setFormError('Business address is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplierName: nameTrimmed,
        contactPerson: contactPersonTrimmed,
        email: emailTrimmed,
        phone: phoneTrimmed,
        address: addressTrimmed,
      };

      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, payload);
        setSuccessMessage('Supplier details updated successfully');
      } else {
        await createSupplier(payload);
        setSuccessMessage('Supplier registered successfully');
      }
      setIsFormOpen(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred while saving supplier';
      setFormError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenHistory = async (supplier: Supplier) => {
    setHistorySupplier(supplier);
    setIsHistoryOpen(true);
    try {
      await fetchSupplierHistory(supplier.id);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const handleOpenArchiveConfirm = (supplier: Supplier) => {
    if (!canDelete || supplier.deletedAt) return;
    setArchiveTargetSupplier(supplier);
    setIsArchiveConfirmOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTargetSupplier) return;
    setSuccessMessage(null);
    try {
      await archiveSupplier(archiveTargetSupplier.id);
      setSuccessMessage(`Supplier "${archiveTargetSupplier.supplierName}" archived successfully`);
      setIsArchiveConfirmOpen(false);
      setArchiveTargetSupplier(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to archive supplier';
      alert(errMsg);
    }
  };

  // Helper timeline items badges
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATED':
        return (
          <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
            Created
          </span>
        );
      case 'UPDATED':
        return (
          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            Updated
          </span>
        );
      case 'DELETED':
        return (
          <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-700">
            {action}
          </span>
        );
    }
  };

  // Render log changes diff list
  const renderLogChanges = (log: SupplierHistory) => {
    if (log.action === 'CREATED') {
      return <p className="text-xs text-[var(--text-secondary)] mt-1">New supplier registered.</p>;
    }
    if (log.action === 'DELETED') {
      return <p className="text-xs text-[var(--text-secondary)] mt-1">Supplier record archived.</p>;
    }
    if (log.action === 'UPDATED' && log.oldData && log.newData) {
      const changes: string[] = [];
      const oldObj = log.oldData;
      const newObj = log.newData;
      const fields = [
        { key: 'supplierName', label: 'Supplier Name' },
        { key: 'contactPerson', label: 'Contact Person' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address' },
      ];

      fields.forEach((field) => {
        const oldVal = oldObj[field.key];
        const newVal = newObj[field.key];
        if (oldVal !== newVal) {
          changes.push(`${field.label}: "${oldVal || 'N/A'}" → "${newVal || 'N/A'}"`);
        }
      });

      if (changes.length === 0) {
        return <p className="text-xs text-[var(--text-disabled)] mt-1">No field differences.</p>;
      }

      return (
        <ul className="mt-1 list-disc pl-4 text-xs text-[var(--text-secondary)] space-y-0.5">
          {changes.map((c, idx) => (
            <li key={idx}>{c}</li>
          ))}
        </ul>
      );
    }
    return null;
  };

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between animate-fade-in">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">Procurement Settings</p>
            <h1 className="mt-1 text-2xl font-semibold">Supplier Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Register and manage supplier records, contact info, and addresses. Track profile
              histories and view related active purchase orders.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fetchSuppliers(true)}
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
                Add Supplier
              </button>
            )}
          </div>
        </header>

        {/* Global Store Error & Success Notifications */}
        {storeError && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
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

        {/* Summaries Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
          <SummaryCard title="Total Suppliers" value={summaries.total} icon="🏢" />
          <SummaryCard title="Active Suppliers" value={summaries.active} icon="✅" />
          <SummaryCard title="Archived Suppliers" value={summaries.archived} icon="📁" />
          <SummaryCard title="With PO Links" value={summaries.linkedToPOs} icon="🔗" />
        </section>

        {/* Main Section */}
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
              Showing {filteredSuppliers.length} of {suppliers.length} records
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search suppliers by name, email, contact, phone, or address..."
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

          {/* Listing Content */}
          {isLoading ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-12 text-center animate-pulse">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <h3 className="mt-3 font-medium text-[var(--text-primary)]">Loading suppliers...</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Please wait while we fetch the directory.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="mt-6 hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block animate-fade-in">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Supplier Name</th>
                      <th className="px-5 py-3.5 font-semibold">Contact Person</th>
                      <th className="px-5 py-3.5 font-semibold">Email</th>
                      <th className="px-5 py-3.5 font-semibold">Phone</th>
                      <th className="px-5 py-3.5 font-semibold">POs Linked</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {filteredSuppliers.map((sup) => (
                      <tr key={sup.id} className="transition hover:bg-[var(--surface-hover)] group">
                        <td className="px-5 py-3.5 font-medium text-[var(--text-primary)]">
                          {sup.supplierName}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-secondary)]">
                          {sup.contactPerson || (
                            <span className="italic text-[var(--text-disabled)]">N/A</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-secondary)]">
                          {sup.email || (
                            <span className="italic text-[var(--text-disabled)]">N/A</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-secondary)]">
                          {sup.phone || (
                            <span className="italic text-[var(--text-disabled)]">N/A</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-[var(--text-secondary)]">
                          {sup._count?.purchaseOrders ?? 0}
                        </td>
                        <td className="px-5 py-3.5">
                          {sup.deletedAt ? (
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
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(sup)}
                              className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                            >
                              History
                            </button>
                            {canUpdate && !sup.deletedAt && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(sup)}
                                className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && !sup.deletedAt && (
                              <button
                                type="button"
                                onClick={() => handleOpenArchiveConfirm(sup)}
                                className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:border-red-200"
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="mt-6 grid gap-4 md:hidden">
                {filteredSuppliers.map((sup) => (
                  <article
                    key={sup.id}
                    className="rounded-xl border border-[var(--surface-border)] p-4 hover:shadow-[var(--shadow-sm)] transition"
                  >
                    <div className="flex flex-col gap-1">
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {sup.supplierName}
                      </h3>
                      {sup.contactPerson && (
                        <p className="text-xs text-[var(--text-secondary)]">
                          Contact:{' '}
                          <span className="font-medium text-[var(--text-primary)]">
                            {sup.contactPerson}
                          </span>
                        </p>
                      )}
                      {sup.email && (
                        <p className="text-xs text-[var(--text-secondary)] truncate">
                          Email:{' '}
                          <span className="font-medium text-[var(--text-primary)]">
                            {sup.email}
                          </span>
                        </p>
                      )}
                      {sup.phone && (
                        <p className="text-xs text-[var(--text-secondary)]">
                          Phone:{' '}
                          <span className="font-medium text-[var(--text-primary)]">
                            {sup.phone}
                          </span>
                        </p>
                      )}
                      <p className="mt-2 text-xs text-[var(--text-tertiary)] font-medium">
                        Linked POs:{' '}
                        <span className="font-semibold text-[var(--text-primary)]">
                          {sup._count?.purchaseOrders ?? 0}
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[var(--surface-border)] pt-3">
                      {sup.deletedAt ? (
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
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(sup)}
                          className="rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
                        >
                          History
                        </button>
                        {canUpdate && !sup.deletedAt && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(sup)}
                            className="rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && !sup.deletedAt && (
                          <button
                            type="button"
                            onClick={() => handleOpenArchiveConfirm(sup)}
                            className="rounded-lg border border-red-200 text-red-600 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-red-50"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Empty State Screen */}
              {filteredSuppliers.length === 0 && (
                <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-xl">
                    🏢
                  </div>
                  <h3 className="mt-4 font-semibold text-[var(--text-primary)]">
                    {filterTab === 'archived'
                      ? 'No archived suppliers found'
                      : 'No active suppliers found'}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {filterTab === 'archived'
                      ? searchTerm
                        ? 'No archived suppliers match your search criteria.'
                        : 'There are no archived suppliers in the system.'
                      : searchTerm
                        ? 'Try refining your search terms.'
                        : 'No suppliers have been registered in the system yet.'}
                  </p>
                  {canCreate && !searchTerm && filterTab === 'active' && (
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
                    >
                      Register First Supplier
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </section>

      {/* Creation & Editing Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-lg rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
            <div className="mb-5 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {editingSupplier ? 'Edit Supplier' : 'Register Supplier'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {editingSupplier
                    ? 'Modify supplier properties and details below.'
                    : 'Provide the required and optional fields to register a new supplier.'}
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
              {/* Supplier Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sup-name"
                  className="text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="sup-name"
                  required
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  placeholder="e.g. Globex Corporation, Acme Labs"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              {/* Contact Person */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sup-contact"
                  className="text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Contact Person <span className="text-red-500">*</span>
                </label>
                <input
                  id="sup-contact"
                  required
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="e.g. John Doe, Sales Manager"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sup-email"
                  className="text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="sup-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. sales@globex.com"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sup-phone"
                  className="text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="sup-phone"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +1 (555) 019-2834"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sup-address"
                  className="text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Business Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="sup-address"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, State, ZIP..."
                  rows={2}
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
                  {editingSupplier ? 'Save Changes' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Profile History Timeline Modal */}
      {isHistoryOpen && historySupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-2xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl flex flex-col max-h-[85vh] animate-fade-in-up">
            <div className="mb-5 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Supplier Profile History
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Chronological activity trail for{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {historySupplier.supplierName}
                  </span>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsHistoryOpen(false);
                  setHistorySupplier(null);
                }}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {isLoading ? (
                <div className="py-12 text-center animate-pulse">
                  <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Fetching history records...
                  </p>
                </div>
              ) : supplierHistory.length === 0 ? (
                <div className="py-12 text-center text-[var(--text-secondary)] italic">
                  No activity history records found for this supplier.
                </div>
              ) : (
                <div className="relative border-l border-[var(--surface-border)] ml-3 pl-6 space-y-6">
                  {supplierHistory.map((log) => (
                    <div key={log.id} className="relative">
                      {/* Timeline indicator node */}
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface)] border-2 border-[var(--accent)]" />

                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {getActionBadge(log.action)}
                          <span className="text-xs text-[var(--text-secondary)] font-medium">
                            by {log.performedBy}
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            • {new Date(log.performedAt).toLocaleString()}
                          </span>
                        </div>
                        {renderLogChanges(log)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-[var(--surface-border)] pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsHistoryOpen(false);
                  setHistorySupplier(null);
                }}
                className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
              >
                Close History
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      {isArchiveConfirmOpen && archiveTargetSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
            <div className="mb-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-2xl text-red-600">
                ⚠️
              </div>
              <h2 className="mt-4 text-lg font-bold text-[var(--text-primary)]">
                Archive Supplier Record
              </h2>
            </div>

            <div className="space-y-3 text-sm text-[var(--text-secondary)]">
              <p>
                Are you sure you want to archive the supplier{' '}
                <span className="font-semibold text-[var(--text-primary)]">
                  "{archiveTargetSupplier.supplierName}"
                </span>
                ?
              </p>
              <p>
                This will move them to the Archived list. They will be marked as inactive and
                omitted from active selections.
              </p>

              <div className="rounded-xl bg-[var(--background-tertiary)] p-3 border border-[var(--surface-border)] text-xs space-y-1">
                <p className="font-semibold text-[var(--text-primary)]">
                  System Integrity Summary:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    Linked Purchase Orders:{' '}
                    <span className="font-semibold text-red-600">
                      {archiveTargetSupplier._count?.purchaseOrders ?? 0}
                    </span>
                  </li>
                  <li>Historical purchase orders remain fully linked.</li>
                  <li>No database cascade deletions will occur.</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsArchiveConfirmOpen(false);
                  setArchiveTargetSupplier(null);
                }}
                className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirm}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Archive Supplier
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

// Subcomponent: Statistics Card
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
