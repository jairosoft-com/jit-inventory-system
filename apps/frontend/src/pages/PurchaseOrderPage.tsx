import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  useProcurementStore,
  type PurchaseOrder,
  type POStatus,
  type POHistoryEntry,
} from '../store/procurementStore';
import { useSupplierStore, type Supplier } from '../store/supplierStore';
import api from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface SimpleItem {
  id: number;
  itemName: string;
  barcode: string | null;
  itemType: string;
}

interface LineItemRow {
  itemId: number;
  quantity: number;
  unitCost: number;
  selectedType?: 'CONSUMABLE' | 'EQUIPMENT';
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALL_STATUSES: POStatus[] = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
];

const STATUS_CONFIG: Record<
  POStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    dot: 'bg-slate-500',
  },
  PENDING: {
    label: 'Pending Approval',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    dot: 'bg-blue-500',
  },
  REJECTED: {
    label: 'Rejected',
    color: 'text-red-700',
    bg: 'bg-red-50',
    dot: 'bg-red-500',
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-green-700',
    bg: 'bg-green-50',
    dot: 'bg-green-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    dot: 'bg-gray-500',
  },
  ARCHIVED: {
    label: 'Completed',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    dot: 'bg-purple-500',
  },
};

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ── Component ────────────────────────────────────────────────────────────────

export default function PurchaseOrderPage() {
  const { user } = useAuthStore();
  const {
    purchaseOrders,
    isLoading,
    error: storeError,
    fetchPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    updatePurchaseOrderStatus,
    addAttachment,
    deleteAttachment,
    clearError,
  } = useProcurementStore();

  const { suppliers, fetchSuppliers } = useSupplierStore();

  // ── Permissions ──────────────────────────────────────────────────────────
  const permissions = useMemo(() => {
    if (!user || !user.permissions) return [];
    return user.permissions.map((p) =>
      typeof p === 'string' ? p : p.name || '',
    );
  }, [user]);

  const roleName = user?.role?.name?.toUpperCase() || '';
  const isManagerOrAdmin =
    roleName.includes('ADMIN') || roleName.includes('MANAGER');
  const canRead =
    permissions.includes('purchase_orders:read') ||
    permissions.includes('suppliers:read');
  const canCreate = permissions.includes('purchase_orders:create');
  const canUpdate = permissions.includes('purchase_orders:update');

  // ── Items list for line item dropdown ─────────────────────────────────────
  const [availableItems, setAvailableItems] = useState<SimpleItem[]>([]);

  useEffect(() => {
    fetchPurchaseOrders(undefined, true);
    fetchSuppliers(false);
    // Fetch items for line item selection
    api
      .get('/items', { params: { limit: 500 } })
      .then((res) => {
        // Handle paginated response ({ data, meta }) or direct array response
        const items = (res.data as any).data || (res.data as any).items || res.data;
        if (Array.isArray(items)) {
          setAvailableItems(
            items
              .filter((i: any) => i.itemType === 'CONSUMABLE' || i.itemType === 'EQUIPMENT')
              .map((i: any) => ({
                id: i.id,
                itemName: i.itemName,
                barcode: i.barcode,
                itemType: i.itemType,
              })),
          );
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── UI State ─────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'active' | 'archived'>('active');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null);
  const [detailTab, setDetailTab] = useState<
    'items' | 'history' | 'attachments'
  >('items');
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<POStatus | null>(null);
  const [statusNotes, setStatusNotes] = useState('');

  // Equipment Integration States
  const [poEquipment, setPoEquipment] = useState<any[]>([]);
  const [registeringUnit, setRegisteringUnit] = useState<any | null>(null);
  const [regForm, setRegForm] = useState({
    serialNumber: '',
    location: '',
    brand: '',
    model: '',
    condition: 'NEW',
    warrantyEnd: '',
  });

  // Form state
  const [formData, setFormData] = useState({
    supplierId: '',
  });
  const [lineItems, setLineItems] = useState<LineItemRow[]>([
    { itemId: 0, quantity: 1, unitCost: 0 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active suppliers only
  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => !s.deletedAt),
    [suppliers],
  );

  // ── Filtering ────────────────────────────────────────────────────────────
  const filteredPOs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      const isArchived =
        po.status === 'ARCHIVED' ||
        po.status === 'REJECTED' ||
        po.status === 'CANCELLED';
      const matchesTab = filterTab === 'active' ? !isArchived : isArchived;

      if (statusFilter && filterTab === 'active') {
        if (po.status !== statusFilter) return false;
      }

      if (supplierFilter) {
        if (String(po.supplierId) !== supplierFilter) return false;
      }

      const matchesSearch =
        !term ||
        po.invoiceNumber?.toLowerCase().includes(term) ||
        po.supplier.supplierName.toLowerCase().includes(term) ||
        `PO-${String(po.id).padStart(5, '0')}`.toLowerCase().includes(term) ||
        po.createdBy.firstName.toLowerCase().includes(term) ||
        po.createdBy.lastName.toLowerCase().includes(term);

      return matchesTab && matchesSearch;
    });
  }, [purchaseOrders, searchTerm, filterTab, statusFilter, supplierFilter]);

  // ── Summaries ────────────────────────────────────────────────────────────
  const summaries = useMemo(() => {
    const active = purchaseOrders.filter(
      (po) =>
        po.status !== 'ARCHIVED' &&
        po.status !== 'REJECTED' &&
        po.status !== 'CANCELLED'
    );
    return {
      total: active.length,
      draft: active.filter((po) => po.status === 'DRAFT').length,
      pending: active.filter((po) => po.status === 'PENDING').length,
      approved: active.filter((po) => po.status === 'APPROVED').length,
    };
  }, [purchaseOrders]);

  // ── Permission gate ──────────────────────────────────────────────────────
  if (!canRead) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-6 py-12 flex items-center justify-center">
        <section className="max-w-md w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
            🔒
          </div>
          <h1 className="mt-6 text-xl font-bold text-[var(--text-primary)]">
            Access Denied
          </h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            You do not have the required permissions to access procurement
            records. Please contact your administrator.
          </p>
        </section>
      </main>
    );
  }

  // ── Form handlers ────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingPO(null);
    setFormData({ supplierId: '' });
    setLineItems([{ itemId: 0, quantity: 1, unitCost: 0 }]);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (po: PurchaseOrder) => {
    if (po.status !== 'DRAFT') return;
    setEditingPO(po);
    setFormData({
      supplierId: String(po.supplierId),
    });
    setLineItems(
      po.lineItems.map((li) => ({
        itemId: li.itemId,
        quantity: li.quantity,
        unitCost: parseFloat(li.unitCost),
        selectedType: (li.item.itemType as any) || 'CONSUMABLE',
      })),
    );
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [...prev, { itemId: 0, quantity: 1, unitCost: 0, selectedType: 'CONSUMABLE' }]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (
    index: number,
    field: keyof LineItemRow,
    value: string | number,
  ) => {
    setLineItems((prev) =>
      prev.map((li, i) =>
        i === index
          ? {
              ...li,
              [field]:
                field === 'selectedType'
                  ? value
                  : typeof value === 'string'
                  ? Number(value) || 0
                  : value,
            }
          : li,
      ),
    );
  };

  const computeTotal = () =>
    lineItems.reduce((sum, li) => sum + li.quantity * li.unitCost, 0);

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!formData.supplierId) {
      setFormError('Please select a supplier');
      return;
    }

    const validLineItems = lineItems.filter((li) => li.itemId > 0);
    if (validLineItems.length === 0) {
      setFormError('At least one line item with a selected item is required');
      return;
    }

    for (const li of validLineItems) {
      if (li.quantity < 1) {
        setFormError('All line items must have a quantity of at least 1');
        return;
      }
      if (li.unitCost <= 0) {
        setFormError('All line items must have a unit cost greater than 0');
        return;
      }
    }

    // Check for duplicate items
    const itemIds = validLineItems.map((li) => li.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      setFormError('Duplicate items are not allowed');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPO) {
        await updatePurchaseOrder(editingPO.id, {
          supplierId: Number(formData.supplierId),
          lineItems: validLineItems,
        });
        setSuccessMessage('Purchase order updated successfully');
      } else {
        await createPurchaseOrder({
          supplierId: Number(formData.supplierId),
          lineItems: validLineItems,
        });
        setSuccessMessage('Purchase order created successfully');
      }
      setIsFormOpen(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'An error occurred';
      setFormError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Detail view ──────────────────────────────────────────────────────────
  const handleOpenDetail = (po: PurchaseOrder) => {
    setDetailPO(po);
    setDetailTab('items');
    setIsDetailOpen(true);
  };

  // Keep detail in sync with store
  useEffect(() => {
    if (detailPO) {
      const updated = purchaseOrders.find((po) => po.id === detailPO.id);
      if (updated) setDetailPO(updated);
    }
  }, [purchaseOrders]);

  // Fetch equipment units for selected Purchase Order if it has equipment lines
  const fetchPoEquipment = (poId: number) => {
    api.get(`/procurement/${poId}/equipment`)
      .then(res => {
        setPoEquipment(res.data || []);
      })
      .catch(err => {
        console.error('Error fetching PO equipment:', err);
      });
  };

  useEffect(() => {
    if (detailPO && detailPO.lineItems.some(li => li.item.itemType === 'EQUIPMENT')) {
      fetchPoEquipment(detailPO.id);
    } else {
      setPoEquipment([]);
    }
  }, [detailPO]);

  const handleOpenRegister = (unit: any) => {
    setRegisteringUnit(unit);
    setRegForm({
      serialNumber: unit.serialNumber || '',
      location: unit.location || '',
      brand: unit.brand || '',
      model: unit.model || '',
      condition: unit.condition || 'NEW',
      warrantyEnd: unit.warrantyEnd ? new Date(unit.warrantyEnd).toISOString().split('T')[0] : '',
    });
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!registeringUnit) return;
    try {
      await api.put(`/procurement/${detailPO!.id}/equipment/${registeringUnit.id}`, {
        serialNumber: regForm.serialNumber.trim() || null,
        location: regForm.location.trim() || null,
        brand: regForm.brand.trim() || null,
        model: regForm.model.trim() || null,
        condition: regForm.condition,
        warrantyEnd: regForm.warrantyEnd ? new Date(regForm.warrantyEnd) : null,
      });
      // Refresh equipment list and purchase orders to capture potential PO status updates
      fetchPoEquipment(detailPO!.id);
      fetchPurchaseOrders(undefined, true);
      setRegisteringUnit(null);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to update equipment');
    }
  };

  // ── Status change ────────────────────────────────────────────────────────
  const handleOpenStatusDialog = (action: POStatus) => {
    setStatusAction(action);
    setStatusNotes('');
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!detailPO || !statusAction) return;
    setIsSubmitting(true);
    try {
      await updatePurchaseOrderStatus(
        detailPO.id,
        statusAction,
        statusNotes.trim() || undefined,
      );
      setIsStatusDialogOpen(false);
      setSuccessMessage(
        `Purchase order status changed to ${STATUS_CONFIG[statusAction].label}`,
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'Failed to update status';
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Attachments ──────────────────────────────────────────────────────────
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!detailPO) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert(
        `Invalid file type "${ext}". Only JPG, JPEG, and PNG files are allowed.`,
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      alert(
        `File is ${sizeMB} MB — exceeds the 5 MB limit. Please choose a smaller file.`,
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const url = event.target?.result as string;
      if (!url) return;
      try {
        await addAttachment(detailPO.id, {
          fileUrl: url,
          fileName: file.name,
          fileSize: file.size,
        });
        setSuccessMessage('Attachment uploaded successfully');
        setTimeout(() => setSuccessMessage(null), 4000);
      } catch (err: unknown) {
        alert(
          err instanceof Error ? err.message : 'Failed to upload attachment',
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!detailPO) return;
    if (!window.confirm('Are you sure you want to remove this attachment?'))
      return;
    try {
      await deleteAttachment(detailPO.id, attachmentId);
      setSuccessMessage('Attachment removed');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      // error in store
    }
  };

  // ── Available workflow actions for current PO ────────────────────────────
  const getAvailableActions = (
    po: PurchaseOrder,
  ): { status: POStatus; label: string; variant: string }[] => {
    const actions: { status: POStatus; label: string; variant: string }[] = [];

    switch (po.status) {
      case 'DRAFT':
        actions.push({
          status: 'PENDING',
          label: 'Submit for Approval',
          variant: 'primary',
        });
        break;
      case 'PENDING':
        if (isManagerOrAdmin) {
          actions.push({
            status: 'APPROVED',
            label: 'Approve',
            variant: 'success',
          });
          actions.push({
            status: 'REJECTED',
            label: 'Reject',
            variant: 'danger',
          });
        }
        break;
      case 'APPROVED':
        if (isManagerOrAdmin) {
          actions.push({
            status: 'COMPLETED',
            label: 'Mark as Completed',
            variant: 'success',
          });
          actions.push({
            status: 'CANCELLED',
            label: 'Cancel Order',
            variant: 'danger',
          });
        }
        break;
      case 'COMPLETED':
      case 'CANCELLED':
        if (isManagerOrAdmin) {
          actions.push({
            status: 'ARCHIVED',
            label: 'Archive',
            variant: 'secondary',
          });
        }
        break;
    }

    return actions;
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between animate-fade-in">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">
              Procurement
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Purchase Orders</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Create, track, and manage purchase orders. Submit orders for
              approval, monitor workflow status, and maintain complete audit
              trails.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fetchPurchaseOrders(undefined, true)}
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
                + New Purchase Order
              </button>
            )}
          </div>
        </header>

        {/* Alerts */}
        {storeError && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
            <span>{storeError}</span>
            <button
              onClick={clearError}
              className="font-semibold text-red-800 hover:text-red-950"
            >
              Dismiss
            </button>
          </div>
        )}
        {successMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 animate-fade-in">
            {successMessage}
          </div>
        )}

        {/* Summary Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
          <SummaryCard title="Total Active" value={summaries.total} icon="📋" />
          <SummaryCard title="Drafts" value={summaries.draft} icon="📝" />
          <SummaryCard
            title="Pending Approval"
            value={summaries.pending}
            icon="⏳"
          />
          <SummaryCard title="Approved" value={summaries.approved} icon="✅" />
        </section>

        {/* Main Table Section */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          {/* Tabs + Filter Row */}
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[var(--surface-border)] pb-4 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilterTab('active');
                  setStatusFilter('');
                }}
                className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${filterTab === 'active'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterTab('archived');
                  setStatusFilter('');
                }}
                className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${filterTab === 'archived'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                Archived
              </button>
            </div>
            <div className="text-xs text-[var(--text-tertiary)] font-medium">
              Showing {filteredPOs.length} of {purchaseOrders.length} records
            </div>
          </div>

          {/* Search + Supplier + Status Filters */}
          <div className={`grid gap-3 ${filterTab === 'active' ? 'md:grid-cols-[1fr_200px_200px]' : 'md:grid-cols-[1fr_200px]'}`}>
            <div className="relative flex items-center">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by PO #, invoice, supplier, or creator..."
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
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            >
              <option value="">All Suppliers</option>
              {activeSuppliers.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.supplierName}
                </option>
              ))}
            </select>
            {filterTab === 'active' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
              >
                <option value="">All Statuses</option>
                {ALL_STATUSES.filter((s) => s !== 'ARCHIVED' && s !== 'REJECTED' && s !== 'CANCELLED').map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-12 text-center animate-pulse">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <h3 className="mt-3 font-medium text-[var(--text-primary)]">
                Loading purchase orders...
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Please wait while we fetch the records.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="mt-6 hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block animate-fade-in">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">PO #</th>
                      <th className="px-5 py-3.5 font-semibold">Supplier</th>
                      <th className="px-5 py-3.5 font-semibold">Invoice</th>
                      <th className="px-5 py-3.5 font-semibold">Items</th>
                      <th className="px-5 py-3.5 font-semibold">Total</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="px-5 py-3.5 font-semibold">Created</th>
                      <th className="px-5 py-3.5 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {filteredPOs.map((po) => (
                      <tr
                        key={po.id}
                        className="transition hover:bg-[var(--surface-hover)] group cursor-pointer"
                        onClick={() => handleOpenDetail(po)}
                      >
                        <td className="px-5 py-3.5 font-mono font-medium text-[var(--accent)]">
                          PO-{String(po.id).padStart(5, '0')}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-[var(--text-primary)]">
                          {po.supplier.supplierName}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-secondary)]">
                          {po.invoiceNumber || (
                            <span className="italic text-[var(--text-disabled)]">
                              N/A
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-[var(--text-secondary)]">
                          {po.lineItems.length}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-[var(--text-primary)]">
                          ₱
                          {parseFloat(po.totalAmount).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={po.status} />
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[var(--text-secondary)]">
                          <div>
                            {new Date(po.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-[var(--text-disabled)]">
                            by {po.createdBy.firstName} {po.createdBy.lastName}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div
                            className="flex items-center justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(po)}
                              className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                            >
                              View
                            </button>
                            {canUpdate && po.status === 'DRAFT' && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(po)}
                                className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="mt-6 grid gap-4 md:hidden">
                {filteredPOs.map((po) => (
                  <article
                    key={po.id}
                    onClick={() => handleOpenDetail(po)}
                    className="rounded-xl border border-[var(--surface-border)] p-4 hover:shadow-[var(--shadow-sm)] transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-[var(--accent)]">
                        PO-{String(po.id).padStart(5, '0')}
                      </span>
                      <StatusBadge status={po.status} />
                    </div>
                    <h3 className="mt-2 font-semibold text-[var(--text-primary)]">
                      {po.supplier.supplierName}
                    </h3>
                    <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>
                        {po.lineItems.length} items · ₱
                        {parseFloat(po.totalAmount).toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span>
                        {new Date(po.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              {/* Empty State */}
              {filteredPOs.length === 0 && (
                <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-xl">
                    📋
                  </div>
                  <h3 className="mt-4 font-semibold text-[var(--text-primary)]">
                    {filterTab === 'archived'
                      ? 'No archived purchase orders'
                      : 'No purchase orders found'}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {searchTerm || statusFilter || supplierFilter
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Create your first purchase order to get started.'}
                  </p>
                  {canCreate && !searchTerm && filterTab === 'active' && (
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
                    >
                      Create First Purchase Order
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </section>

      {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-2xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] p-6 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {editingPO ? 'Edit Purchase Order' : 'New Purchase Order'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {editingPO
                    ? 'Modify the purchase order details below.'
                    : 'Fill in the details to create a new purchase order.'}
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

            <div className="flex-1 overflow-y-auto p-6 pt-4">
              {formError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <form
                id="po-form"
                onSubmit={handleFormSubmit}
                className="flex flex-col gap-5"
              >
                {/* Supplier */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="po-supplier"
                    className="text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="po-supplier"
                    required
                    value={formData.supplierId}
                    onChange={(e) =>
                      setFormData({ ...formData, supplierId: e.target.value })
                    }
                    className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                  >
                    <option value="">Select a supplier...</option>
                    {activeSuppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.supplierName}
                      </option>
                    ))}
                  </select>
                </div>


                {/* Line Items */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Line Items <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {lineItems.map((li, index) => (
                      <div
                        key={index}
                        className="grid gap-2 items-end"
                        style={{ gridTemplateColumns: '130px 1fr 80px 100px 100px 32px' }}
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          {index === 0 && (
                            <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                              Type
                            </span>
                          )}
                          <div className="flex rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] p-0.5 text-xs w-full">
                            <button
                              type="button"
                              onClick={() => {
                                handleLineItemChange(index, 'selectedType', 'CONSUMABLE');
                                handleLineItemChange(index, 'itemId', 0);
                              }}
                              className={`flex-1 rounded-md py-1.5 font-medium transition cursor-pointer text-center ${(li.selectedType || 'CONSUMABLE') === 'CONSUMABLE' ? 'bg-[var(--accent)] text-white shadow-[var(--shadow-sm)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                              Cons.
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleLineItemChange(index, 'selectedType', 'EQUIPMENT');
                                handleLineItemChange(index, 'itemId', 0);
                              }}
                              className={`flex-1 rounded-md py-1.5 font-medium transition cursor-pointer text-center ${li.selectedType === 'EQUIPMENT' ? 'bg-[var(--accent)] text-white shadow-[var(--shadow-sm)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                              Equip.
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          {index === 0 && (
                            <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                              Item
                            </span>
                          )}
                          <SearchableItemSelect
                            value={li.itemId || null}
                            onChange={(val) =>
                              handleLineItemChange(
                                index,
                                'itemId',
                                val,
                              )
                            }
                            items={availableItems.filter(
                              (item) =>
                                item.itemType === (li.selectedType || 'CONSUMABLE') &&
                                (item.id === li.itemId ||
                                  !lineItems.some((otherLi) => otherLi.itemId === item.id))
                            )}
                            placeholder="Select item..."
                          />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          {index === 0 && (
                            <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                              Qty
                            </span>
                          )}
                          <input
                            type="number"
                            min="1"
                            value={li.quantity || ''}
                            onChange={(e) =>
                              handleLineItemChange(
                                index,
                                'quantity',
                                e.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                          />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          {index === 0 && (
                            <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                              Unit Cost
                            </span>
                          )}
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={li.unitCost || ''}
                            onChange={(e) =>
                              handleLineItemChange(
                                index,
                                'unitCost',
                                e.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                          />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          {index === 0 && (
                            <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                              Subtotal
                            </span>
                          )}
                          <div className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background-tertiary)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] text-right h-[38px] flex items-center justify-end">
                            ₱{((li.quantity || 0) * (li.unitCost || 0)).toLocaleString('en-PH', {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(index)}
                          disabled={lineItems.length <= 1}
                          className="rounded-lg border border-[var(--surface-border)] p-2 text-red-500 hover:bg-red-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-end gap-2 border-t border-[var(--surface-border)] pt-3">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">
                      Total:
                    </span>
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      ₱
                      {computeTotal().toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-[var(--surface-border)] p-6 pt-4">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="po-form"
                disabled={isSubmitting}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {editingPO ? 'Save Changes' : 'Create Purchase Order'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────── */}
      {isDetailOpen && detailPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-3xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl animate-fade-in-up flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] p-6 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] font-mono">
                    PO-{String(detailPO.id).padStart(5, '0')}
                  </h2>
                  <StatusBadge status={detailPO.status} />
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Supplier:{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {detailPO.supplier.supplierName}
                  </span>
                  {detailPO.invoiceNumber && (
                    <>
                      {' '}
                      · Invoice:{' '}
                      <span className="font-medium">
                        {detailPO.invoiceNumber}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDetailOpen(false);
                  setDetailPO(null);
                }}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
              >
                ✕
              </button>
            </div>

            {/* Info Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 py-4 bg-[var(--background-tertiary)] border-b border-[var(--surface-border)]">
              <div>
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Total Amount
                </span>
                <p className="mt-0.5 text-lg font-bold text-[var(--text-primary)]">
                  ₱
                  {parseFloat(detailPO.totalAmount).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Line Items
                </span>
                <p className="mt-0.5 text-lg font-bold text-[var(--text-primary)]">
                  {detailPO.lineItems.length}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Created By
                </span>
                <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
                  {detailPO.createdBy.firstName} {detailPO.createdBy.lastName}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Order Date
                </span>
                <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
                  {new Date(detailPO.orderDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 border-b border-[var(--surface-border)]">
              {(
                ['items', 'history', 'attachments'] as Array<
                  'items' | 'history' | 'attachments'
                >
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition capitalize ${detailTab === tab
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  {tab === 'items'
                    ? `Items (${detailPO.lineItems.length})`
                    : tab === 'history'
                      ? `History (${detailPO.history.length})`
                      : `Attachments (${detailPO.attachments.length})`}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailTab === 'items' && (
                <>
                  <div className="overflow-x-auto rounded-xl border border-[var(--surface-border)]">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Item</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Qty
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Unit Cost
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--surface-border)]">
                      {detailPO.lineItems.map((li) => {
                        const subtotal =
                          li.quantity * parseFloat(li.unitCost);
                        return (
                          <tr key={li.id}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-[var(--text-primary)]">
                                {li.item.itemName}
                              </div>
                              {li.item.barcode && (
                                <div className="text-xs text-[var(--text-tertiary)] font-mono">
                                  {li.item.barcode}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {li.quantity}
                            </td>
                            <td className="px-4 py-3 text-right">
                              ₱
                              {parseFloat(li.unitCost).toLocaleString(
                                'en-PH',
                                { minimumFractionDigits: 2 },
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              ₱
                              {subtotal.toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--background-tertiary)]">
                        <td
                          colSpan={3}
                          className="px-4 py-3 text-right font-semibold text-[var(--text-secondary)]"
                        >
                          Total
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[var(--text-primary)] text-base">
                          ₱
                          {parseFloat(detailPO.totalAmount).toLocaleString(
                            'en-PH',
                            { minimumFractionDigits: 2 },
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Equipment Assets Status Checklist */}
                {detailPO.lineItems.some((li) => li.item.itemType === 'EQUIPMENT') && (
                  <div className="mt-8 border-t border-[var(--surface-border)] pt-6">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Equipment Registration Progress
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mb-4">
                      All physical equipment units purchased under this order must be cataloged and serialized.
                    </p>
                    
                    {poEquipment.length === 0 ? (
                      <div className="flex items-center justify-center p-6 border rounded-xl border-dashed border-[var(--surface-border)]">
                        <span className="text-xs text-[var(--text-tertiary)] italic animate-pulse">
                          Loading equipment records...
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] bg-[var(--background-tertiary)] px-4 py-2 rounded-lg">
                          <span>
                            Registration Progress
                          </span>
                          <span className="font-mono">
                            {poEquipment.filter(u => u.deletedAt === null).length} / {poEquipment.length} Registered
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                              <tr>
                                <th className="px-4 py-2 font-semibold">Asset ID</th>
                                <th className="px-4 py-2 font-semibold">Item Model</th>
                                <th className="px-4 py-2 font-semibold font-mono">Serial Number</th>
                                <th className="px-4 py-2 font-semibold">Location</th>
                                <th className="px-4 py-2 font-semibold">Condition</th>
                                <th className="px-4 py-2 font-semibold text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--surface-border)]">
                              {poEquipment.map((unit) => {
                                const isRegistered = unit.deletedAt === null;
                                return (
                                  <tr key={unit.id} className="hover:bg-[var(--surface-hover)] transition">
                                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                                      {unit.assetId}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                                      {unit.item.itemName}
                                    </td>
                                    <td className="px-4 py-3 font-mono">
                                      {isRegistered ? (
                                        <span className="text-[var(--text-primary)] font-semibold">{unit.serialNumber}</span>
                                      ) : (
                                        <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-[10px] text-yellow-700 font-semibold border border-yellow-200">
                                          Unserialized
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                                      {unit.location || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                        unit.condition === 'NEW'
                                          ? 'bg-green-50 text-green-700 border border-green-200'
                                          : unit.condition === 'GOOD'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                      }`}>
                                        {unit.condition}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenRegister(unit)}
                                        className="rounded bg-[var(--background-tertiary)] hover:bg-[var(--surface-border)] px-2 py-1 font-semibold text-[var(--text-primary)] border border-[var(--surface-border)] cursor-pointer transition text-[10px]"
                                      >
                                        {isRegistered ? 'Edit Details' : 'Register Unit'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </>
              )}

              {detailTab === 'history' && (
                <div className="relative border-l border-[var(--surface-border)] ml-3 pl-6 space-y-6">
                  {detailPO.history.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)] italic py-8 text-center">
                      No history records found.
                    </p>
                  ) : (
                    detailPO.history.map((entry) => (
                      <div key={entry.id} className="relative">
                        <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface)] border-2 border-[var(--accent)]" />
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={entry.oldStatus} />
                            <span className="text-xs text-[var(--text-tertiary)]">
                              →
                            </span>
                            <StatusBadge status={entry.newStatus} />
                            <span className="text-xs text-[var(--text-secondary)] font-medium">
                              by {entry.changedBy.firstName}{' '}
                              {entry.changedBy.lastName}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                          {entry.notes && (
                            <p className="text-xs text-[var(--text-secondary)] mt-1 bg-[var(--background-tertiary)] rounded-lg px-3 py-2 border border-[var(--surface-border)]">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailTab === 'attachments' && (
                <div className="space-y-4">
                  {canUpdate && (
                    <div className="flex items-center gap-3">
                      <label className="rounded-xl border border-dashed border-[var(--surface-border)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition cursor-pointer flex items-center gap-2">
                        <span>📎</span> Upload File (JPG, JPEG, PNG — Max 5MB)
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                    </div>
                  )}

                  {detailPO.attachments.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)] italic py-8 text-center">
                      No attachments uploaded yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {detailPO.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between rounded-xl border border-[var(--surface-border)] px-4 py-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-lg">📄</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                {att.fileName}
                              </p>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {att.fileSize
                                  ? `${(att.fileSize / 1024).toFixed(1)} KB`
                                  : ''}{' '}
                                ·{' '}
                                {new Date(
                                  att.uploadedAt,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {att.fileUrl.startsWith('data:image') && (
                              <a
                                href={att.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
                              >
                                Preview
                              </a>
                            )}
                            {canUpdate && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteAttachment(att.id)
                                }
                                className="rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:border-red-200"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between border-t border-[var(--surface-border)] p-6 pt-4">
              <div className="flex items-center gap-2 flex-wrap">
                {canUpdate &&
                  getAvailableActions(detailPO).map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      onClick={() => handleOpenStatusDialog(action.status)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${action.variant === 'primary'
                        ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                        : action.variant === 'success'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : action.variant === 'danger'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                        }`}
                    >
                      {action.label}
                    </button>
                  ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDetailOpen(false);
                  setDetailPO(null);
                }}
                className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Status Change Confirmation Dialog ─────────────────────────────── */}
      {isStatusDialogOpen && statusAction && detailPO && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
            <div className="mb-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background-tertiary)] text-2xl">
                {statusAction === 'APPROVED'
                  ? '✅'
                  : statusAction === 'REJECTED'
                    ? '❌'
                    : statusAction === 'COMPLETED'
                      ? '🎉'
                      : statusAction === 'CANCELLED'
                        ? '🚫'
                        : statusAction === 'ARCHIVED'
                          ? '📁'
                          : '📤'}
              </div>
              <h2 className="mt-4 text-lg font-bold text-[var(--text-primary)]">
                Confirm Status Change
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Change PO-{String(detailPO.id).padStart(5, '0')} from{' '}
                <strong>{STATUS_CONFIG[detailPO.status].label}</strong> to{' '}
                <strong>{STATUS_CONFIG[statusAction].label}</strong>?
              </p>
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Notes (optional)
              </label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add a note about this status change..."
                rows={3}
                className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4">
              <button
                type="button"
                onClick={() => setIsStatusDialogOpen(false)}
                className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={isSubmitting}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 ${statusAction === 'REJECTED' || statusAction === 'CANCELLED'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                  }`}
              >
                {isSubmitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Equipment Unit Registration Modal ─────────────────────────────── */}
      {registeringUnit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
              Register Equipment Details
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Asset ID: <strong className="font-mono text-[var(--text-primary)]">{registeringUnit.assetId}</strong> ({registeringUnit.item.itemName})
            </p>

            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
              {/* Serial Number */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Serial Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regForm.serialNumber}
                  onChange={(e) => setRegForm({ ...regForm, serialNumber: e.target.value })}
                  placeholder="Enter manufacturer serial number..."
                  className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              {/* Location */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Location
                </label>
                <input
                  type="text"
                  value={regForm.location}
                  onChange={(e) => setRegForm({ ...regForm, location: e.target.value })}
                  placeholder="e.g. IT Office, Library, Room 402..."
                  className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Brand */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={regForm.brand}
                    onChange={(e) => setRegForm({ ...regForm, brand: e.target.value })}
                    placeholder="e.g. Dell, Logitech..."
                    className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                  />
                </div>

                {/* Model */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Model
                  </label>
                  <input
                    type="text"
                    value={regForm.model}
                    onChange={(e) => setRegForm({ ...regForm, model: e.target.value })}
                    placeholder="e.g. Latitude 5520..."
                    className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Condition */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Condition
                  </label>
                  <select
                    value={regForm.condition}
                    onChange={(e) => setRegForm({ ...regForm, condition: e.target.value })}
                    className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                  >
                    <option value="NEW">New</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="POOR">Poor</option>
                    <option value="BROKEN">Broken</option>
                  </select>
                </div>

                {/* Warranty End */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Warranty End Date
                  </label>
                  <input
                    type="date"
                    value={regForm.warrantyEnd}
                    onChange={(e) => setRegForm({ ...regForm, warrantyEnd: e.target.value })}
                    className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setRegisteringUnit(null)}
                  className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition cursor-pointer"
                >
                  Save Registration
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: POStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] hover:shadow-md transition duration-200">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-2xl">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </p>
        <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
          {value}
        </p>
      </div>
    </article>
  );
}

// ── Searchable Item Dropdown using React Portals ───────────────────────────

interface SearchableItemSelectProps {
  value: number | null;
  onChange: (id: number) => void;
  items: SimpleItem[];
  placeholder?: string;
}

function SearchableItemSelect({
  value,
  onChange,
  items,
  placeholder = 'Select item...',
}: SearchableItemSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === value);

  // Position detection relative to document.body
  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  // Open & trigger coordinates calculation
  const handleToggle = () => {
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on scroll events to prevent floating away
  useEffect(() => {
    if (isOpen) {
      const handleScroll = () => {
        setIsOpen(false);
      };
      window.addEventListener('scroll', handleScroll, { capture: true });
      return () => {
        window.removeEventListener('scroll', handleScroll, { capture: true });
      };
    }
    return () => {};
  }, [isOpen]);

  // Reset search when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredItems = items.filter((item) => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      item.itemName.toLowerCase().includes(term) ||
      (item.barcode && item.barcode.toLowerCase().includes(term))
    );
  });

  return (
    <div className="relative w-full">
      {/* Dropdown Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-left text-sm outline-none transition focus:border-[var(--input-border-focus)] focus:ring-1 focus:ring-[var(--input-border-focus)] cursor-pointer"
      >
        <span className="truncate">
          {selectedItem ? (
            <span className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-primary)]">{selectedItem.itemName}</span>
              {selectedItem.barcode && (
                <span className="rounded bg-[var(--background-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] font-mono">
                  {selectedItem.barcode}
                </span>
              )}
            </span>
          ) : (
            <span className="text-[var(--text-tertiary)]">{placeholder}</span>
          )}
        </span>
        <span className={`text-[var(--text-tertiary)] text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Dropdown Overlay in React Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
            }}
            className="z-[9999] mt-1 max-h-60 overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] shadow-lg animate-fade-in flex flex-col"
          >
            {/* Search Box */}
            <div className="border-b border-[var(--surface-border)] p-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search..."
                className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--input-border-focus)]"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>

            {/* Items List */}
            <div className="overflow-y-auto max-h-48 divide-y divide-[var(--surface-border)]/50">
              {filteredItems.length === 0 ? (
                <div className="p-3 text-center text-xs text-[var(--text-tertiary)] italic">
                  No items found
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition hover:bg-[var(--surface-hover)] cursor-pointer ${
                      item.id === value ? 'bg-[var(--background-tertiary)] font-semibold' : ''
                    }`}
                  >
                    <span className="truncate text-[var(--text-primary)]">{item.itemName}</span>
                    {item.barcode && (
                      <span className="ml-2 shrink-0 rounded bg-[var(--surface-border)]/50 px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)] font-mono">
                        {item.barcode}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
