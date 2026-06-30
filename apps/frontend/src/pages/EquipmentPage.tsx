import { useEffect, useState, useMemo, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  useEquipmentStore,
  type Equipment,
  type EquipmentStatus,
  type ConditionStatus,
  type ListEquipmentQuery,
  type DisposalReason,
  type DisposalApprovalStatus,
} from '../store/equipmentStore';
import { useCategoryStore } from '../store/categoryStore';

// ── Constants ────────────────────────────────────────────────────────────────

const EQUIPMENT_STATUSES: EquipmentStatus[] = [
  'AVAILABLE',
  'IN_USE',
  'UNDER_MAINTENANCE',
  'DAMAGED',
  'LOST',
  'BORROWED',
  'RETIREMENT_PENDING',
  'RETIRED',
];

const MANUALLY_SELECTABLE_EQUIPMENT_STATUSES: EquipmentStatus[] = [
  'AVAILABLE',
  'IN_USE',
  'UNDER_MAINTENANCE',
  'DAMAGED',
  'LOST',
  'BORROWED',
];

const CONDITION_STATUSES: ConditionStatus[] = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];

const EQUIPMENT_LIFECYCLE_YEARS = 5;

const DISPOSAL_REASONS: DisposalReason[] = [
  'DAMAGED_BEYOND_REPAIR',
  'OUTDATED',
  'LOST',
  'STOLEN',
  'DONATED',
];

const DISPOSAL_REASON_LABELS: Record<DisposalReason, string> = {
  DAMAGED_BEYOND_REPAIR: 'Damaged beyond repair',
  OUTDATED: 'Outdated',
  LOST: 'Lost',
  STOLEN: 'Stolen',
  DONATED: 'Donated',
};

const DISPOSAL_APPROVAL_STATUS_LABELS: Record<DisposalApprovalStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
};

const PAGE_SIZE = 20;

// ── Form State ───────────────────────────────────────────────────────────────

interface FormState {
  itemName: string;
  assetId: string;
  categoryId: string;
  description: string;
  serialNumber: string;
  brand: string;
  model: string;
  condition: ConditionStatus;
  status: EquipmentStatus;
  location: string;
  warrantyStart: string;
  warrantyEnd: string;
  warrantyProvider: string;
  purchasePrice: string;
  acquisitionDate: string;
}

interface RetirementFormState {
  reason: DisposalReason;
  method: string;
  notes: string;
}

interface PendingImage {
  url: string;
  label: string;
  isPrimary: boolean;
  size: number;
}

const DEFAULT_LOCATIONS = [
  'IT Office',
  'Server Room',
  'Conference Room A',
  'Conference Room B',
  'Storage Room',
  'Reception',
  'HR Department',
  'Finance Department',
  'Operations Room',
];

const emptyForm: FormState = {
  itemName: '',
  assetId: '',
  categoryId: '',
  description: '',
  serialNumber: '',
  brand: '',
  model: '',
  condition: 'NEW',
  status: 'AVAILABLE',
  location: '',
  warrantyStart: '',
  warrantyEnd: '',
  warrantyProvider: '',
  purchasePrice: '',
  acquisitionDate: '',
};

const emptyRetirementForm: RetirementFormState = {
  reason: 'OUTDATED',
  method: 'For disposal review',
  notes: '',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** ISO date string → YYYY-MM-DD for <input type="date"> */
function toDateInput(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

/** Build a FormState from an existing Equipment record (for edit mode) */
function equipmentToForm(eq: Equipment): FormState {
  return {
    itemName: eq.item.itemName,
    assetId: eq.assetId,
    categoryId: String(eq.item.categoryId),
    description: eq.item.description || '',
    serialNumber: eq.serialNumber || '',
    brand: eq.brand || '',
    model: eq.model || '',
    condition: eq.condition,
    status: eq.status,
    location: eq.location || '',
    warrantyStart: toDateInput(eq.warrantyStart),
    warrantyEnd: toDateInput(eq.warrantyEnd),
    warrantyProvider: eq.warrantyProvider || '',
    purchasePrice: eq.purchasePrice ? String(eq.purchasePrice) : '',
    acquisitionDate: toDateInput(eq.acquisitionDate),
  };
}

function getPrimaryImage(eq: Equipment) {
  return eq.images.find((img) => img.isPrimary) || eq.images[0] || null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addCalendarYears(date: Date, years: number): Date {
  const result = startOfDay(date);
  result.setFullYear(result.getFullYear() + years);

  return result;
}

function hasExceededLifecycle(acquisitionDate: string | null | undefined): boolean {
  if (!acquisitionDate) return false;

  const parsedDate = new Date(acquisitionDate);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const replacementDate = addCalendarYears(parsedDate, EQUIPMENT_LIFECYCLE_YEARS);

  return startOfDay(new Date()) >= replacementDate;
}

function hasReplacementPlanningIndicator(eq: Equipment): boolean {
  const hasReplacementCondition = ['FAIR', 'POOR', 'DAMAGED'].includes(eq.condition);
  const hasReplacementStatus = ['DAMAGED', 'LOST', 'RETIRED'].includes(eq.status);

  return (
    eq.replacementNeeded ||
    hasReplacementCondition ||
    hasReplacementStatus ||
    hasExceededLifecycle(eq.acquisitionDate)
  );
}

function getDefaultRetirementReason(eq: Equipment): DisposalReason {
  if (eq.status === 'LOST') return 'LOST';
  if (eq.condition === 'DAMAGED' || eq.status === 'DAMAGED') {
    return 'DAMAGED_BEYOND_REPAIR';
  }
  return 'OUTDATED';
}

function getRetirementIneligibilityReason(eq: Equipment): string | null {
  if (eq.status === 'RETIREMENT_PENDING') {
    return 'Retirement request already pending.';
  }

  if (eq.status === 'RETIRED') {
    return 'Equipment is already retired.';
  }

  if (eq.status === 'BORROWED' || eq.status === 'IN_USE') {
    return 'Equipment must be returned before retirement can be requested.';
  }

  const hasRetirementStatus = eq.status === 'DAMAGED' || eq.status === 'LOST';
  const hasRetirementCondition = ['FAIR', 'POOR', 'DAMAGED'].includes(eq.condition);
  const hasRetirementIndicator =
    hasRetirementStatus ||
    hasRetirementCondition ||
    eq.replacementNeeded ||
    hasExceededLifecycle(eq.acquisitionDate);

  if (!hasRetirementIndicator) {
    return 'Only equipment with replacement, lifecycle, damaged, lost, fair, or poor indicators can be retired.';
  }

  return null;
}

function canRequestRetirement(eq: Equipment): boolean {
  return getRetirementIneligibilityReason(eq) === null;
}

function canManageReplacementNeededTag(eq: Equipment): boolean {
  return eq.replacementNeeded || hasReplacementPlanningIndicator(eq);
}

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';

  return new Date(dateStr).toLocaleDateString();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  // ── Stores ───────────────────────────────────────────────────────────────
  const { user } = useAuthStore();
  const {
    equipment,
    meta,
    isLoading,
    error: storeError,
    disposalHistory,
    isDisposalHistoryLoading,
    fetchEquipment,
    fetchDisposalHistory,
    createEquipment,
    updateEquipment,
    submitRetirementRequest,
    updateDisposalApproval,
    setReplacementNeeded,
    deleteEquipment,
    addImage,
    deleteImage,
    clearError,
  } = useEquipmentStore();
  const { categories, fetchCategories } = useCategoryStore();

  // Categories filtered to EQUIPMENT type only, excluding archived entries
  const equipmentCategories = useMemo(
    () => categories.filter((c) => c.type === 'EQUIPMENT' && !c.deletedAt),
    [categories],
  );

  // ── Permissions ──────────────────────────────────────────────────────────
  const permissions = useMemo(() => {
    if (!user || !(user as any).permissions) return [];
    return ((user as any).permissions as any[]).map((p: any) =>
      typeof p === 'string' ? p : p.name || '',
    );
  }, [user]);

  const roleName = user?.role?.name?.toUpperCase() || '';
  const isAdmin = roleName.includes('ADMIN');
  const canRead = isAdmin || permissions.includes('equipment:read');
  const canCreate = isAdmin || permissions.includes('equipment:create');
  const canUpdate = isAdmin || permissions.includes('equipment:update');
  const canDelete = false; // deletion is disabled

  // ── UI State ─────────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [locationOptions, setLocationOptions] = useState<string[]>(DEFAULT_LOCATIONS);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [newLocationValue, setNewLocationValue] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [retiringEquipment, setRetiringEquipment] = useState<Equipment | null>(null);
  const [retirementForm, setRetirementForm] = useState<RetirementFormState>(emptyRetirementForm);
  const [retirementError, setRetirementError] = useState<string | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);
  const [isDisposalHistoryOpen, setIsDisposalHistoryOpen] = useState(false);
  const [disposalHistoryError, setDisposalHistoryError] = useState<string | null>(null);
  const [disposalActionId, setDisposalActionId] = useState<number | null>(null);

  const [replacementEquipment, setReplacementEquipment] = useState<Equipment | null>(null);
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [isMarkingReplacement, setIsMarkingReplacement] = useState(false);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ── Data Loading ─────────────────────────────────────────────────────────
  const loadEquipment = useCallback(
    (page?: number, search?: string, status?: string) => {
      const query: ListEquipmentQuery = {
        page: page ?? currentPage,
        limit: PAGE_SIZE,
      };
      const s = search ?? searchInput.trim();
      const st = status ?? statusFilter;
      if (s) query.search = s;
      if (st) query.status = st as EquipmentStatus;
      return fetchEquipment(query);
    },
    [currentPage, searchInput, statusFilter, fetchEquipment],
  );

  useEffect(() => {
    loadEquipment(1);
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Form Handlers ────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingEquipment(null);
    setFormData({ ...emptyForm });
    setPendingImages([]);
    setImageError(null);
    setFormError(null);
    setShowLocationInput(false);
    setNewLocationValue('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (eq: Equipment) => {
    setEditingEquipment(eq);
    setFormData(equipmentToForm(eq));
    setPendingImages([]);
    setImageError(null);
    setFormError(null);
    setShowLocationInput(false);
    setNewLocationValue('');
    // Add current location to dropdown if not already there
    if (eq.location && !locationOptions.includes(eq.location)) {
      setLocationOptions((prev) => [...prev, eq.location!]);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingEquipment(null);
    setFormData(emptyForm);
    setPendingImages([]);
    setFormError(null);
    setShowLocationInput(false);
    setNewLocationValue('');
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input immediately so the same file can be re-selected after an error
    e.target.value = '';

    if (!file.type.startsWith('image/') || !ALLOWED_MIME_TYPES.includes(file.type)) {
      setImageError(
        `"${file.name}" is not a supported image. Only JPG, JPEG, and PNG are allowed.`,
      );
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setImageError(
        `"${file.name}" is ${sizeMB} MB — exceeds the 5 MB limit. Please choose a smaller image.`,
      );
      return;
    }

    setImageError(null);

    // Read file as base64 data URL so it can be saved in the database
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      if (!url) return;
      setPendingImages((prev) => [
        ...prev,
        {
          url,
          label: file.name,
          isPrimary:
            prev.length === 0 && (!editingEquipment || editingEquipment.images.length === 0),
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
      // Ensure at least one is primary
      if (next.length > 0 && !next.some((img) => img.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  const handleDeleteExistingImage = async (equipmentId: number, imageId: number) => {
    if (!window.confirm('Remove this image?')) return;
    try {
      await deleteImage(equipmentId, imageId);

      // Update local editing state to remove the image immediately from the modal
      setEditingEquipment((prev) =>
        prev ? { ...prev, images: prev.images.filter((img) => img.id !== imageId) } : prev,
      );
    } catch {
      // error already set in store
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    // Basic validation
    if (!formData.itemName.trim()) {
      setFormError('Item name is required.');
      return;
    }
    if (!formData.assetId.trim()) {
      setFormError('Asset ID is required.');
      return;
    }
    if (!formData.categoryId) {
      setFormError('Please select a category.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEquipment) {
        // ── Update ──────────────────────────────────────────────────────
        await updateEquipment(editingEquipment.id, {
          itemName: formData.itemName.trim(),
          assetId: formData.assetId.trim(),
          categoryId: Number(formData.categoryId),
          description: formData.description.trim() || null,
          serialNumber: formData.serialNumber.trim() || null,
          brand: formData.brand.trim() || null,
          model: formData.model.trim() || null,
          condition: formData.condition,
          status: formData.status,
          location: formData.location.trim() || null,
          warrantyStart: formData.warrantyStart || null,
          warrantyEnd: formData.warrantyEnd || null,
          warrantyProvider: formData.warrantyProvider.trim() || null,
          purchasePrice: formData.purchasePrice ? Number(formData.purchasePrice) : null,
          acquisitionDate: formData.acquisitionDate || null,
        });

        // Upload any newly selected images
        for (const img of pendingImages) {
          await addImage(editingEquipment.id, {
            url: img.url,
            label: img.label || null,
            isPrimary: img.isPrimary,
          });
        }

        setSuccessMessage('Equipment updated successfully');
      } else {
        // ── Create ──────────────────────────────────────────────────────
        await createEquipment({
          itemName: formData.itemName.trim(),
          assetId: formData.assetId.trim(),
          categoryId: Number(formData.categoryId),
          description: formData.description.trim() || null,
          serialNumber: formData.serialNumber.trim() || null,
          brand: formData.brand.trim() || null,
          model: formData.model.trim() || null,
          condition: formData.condition,
          status: formData.status,
          location: formData.location.trim() || null,
          warrantyStart: formData.warrantyStart || null,
          warrantyEnd: formData.warrantyEnd || null,
          warrantyProvider: formData.warrantyProvider.trim() || null,
          purchasePrice: formData.purchasePrice ? Number(formData.purchasePrice) : null,
          acquisitionDate: formData.acquisitionDate || null,
          images: pendingImages.map((img) => ({
            url: img.url,
            label: img.label || null,
            isPrimary: img.isPrimary,
          })),
        });
        setSuccessMessage('Equipment registered successfully');
      }
      handleCloseForm();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      clearError(); // prevent store error from showing on main page
      setFormError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete Handler ───────────────────────────────────────────────────────
  const handleDelete = async (eq: Equipment) => {
    if (
      !window.confirm(
        `Are you sure you want to retire/delete "${eq.item.itemName}" (${eq.assetId})? This action can be reversed by an administrator.`,
      )
    )
      return;

    setSuccessMessage(null);
    try {
      await deleteEquipment(eq.id);
      setSuccessMessage(`"${eq.item.itemName}" has been deleted.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      // error already set in store
    }
  };

  // ── Retirement Request Handlers ──────────────────────────────────────────
  const handleOpenRetirementRequest = (eq: Equipment) => {
    const ineligibilityReason = getRetirementIneligibilityReason(eq);

    if (ineligibilityReason) {
      setSuccessMessage(null);
      setRetirementError(ineligibilityReason);
      return;
    }

    setRetiringEquipment(eq);
    setRetirementForm({
      ...emptyRetirementForm,
      reason: getDefaultRetirementReason(eq),
    });
    setRetirementError(null);
    setSuccessMessage(null);
    clearError();
  };

  const handleCloseRetirementRequest = () => {
    setRetiringEquipment(null);
    setRetirementForm(emptyRetirementForm);
    setRetirementError(null);
  };

  const handleRetirementInputChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    if (name === 'reason') {
      setRetirementForm((prev) => ({
        ...prev,
        reason: value as DisposalReason,
      }));
      return;
    }

    if (name === 'method' || name === 'notes') {
      setRetirementForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmitRetirementRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!retiringEquipment) return;

    setRetirementError(null);
    setSuccessMessage(null);

    const method = retirementForm.method.trim();
    if (!method) {
      setRetirementError('Disposal method is required.');
      return;
    }

    setIsRetiring(true);
    try {
      const result = await submitRetirementRequest(retiringEquipment.id, {
        reason: retirementForm.reason,
        method,
        notes: retirementForm.notes.trim() || null,
      });

      if (result.equipment.status !== 'RETIREMENT_PENDING') {
        throw new Error(
          'Retirement request was saved, but equipment status was not updated to Retirement Pending.',
        );
      }

      await loadEquipment(currentPage, searchInput.trim(), statusFilter);

      setSuccessMessage(
        `Retirement request submitted for "${retiringEquipment.item.itemName}". Status is now Retirement Pending.`,
      );
      handleCloseRetirementRequest();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      clearError();
      const message = err instanceof Error ? err.message : 'Failed to submit retirement request.';
      setRetirementError(message);
    } finally {
      setIsRetiring(false);
    }
  };

  const handleOpenReplacementNeeded = (eq: Equipment) => {
    if (!canManageReplacementNeededTag(eq)) return;

    setReplacementEquipment(eq);
    setReplacementError(null);
  };

  const handleCloseReplacementNeeded = () => {
    if (isMarkingReplacement) return;

    setReplacementEquipment(null);
    setReplacementError(null);
  };

  const handleConfirmReplacementNeeded = async () => {
    if (!replacementEquipment) return;

    const nextReplacementNeeded = !replacementEquipment.replacementNeeded;

    setReplacementError(null);
    setSuccessMessage(null);
    clearError();
    setIsMarkingReplacement(true);

    try {
      await setReplacementNeeded(replacementEquipment.id, nextReplacementNeeded);
      setSuccessMessage(
        nextReplacementNeeded
          ? `"${replacementEquipment.item.itemName}" has been tagged as replacement needed.`
          : `"${replacementEquipment.item.itemName}" has been removed from replacement planning.`,
      );
      setReplacementEquipment(null);
      setReplacementError(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      clearError();
      const message =
        err instanceof Error
          ? err.message
          : nextReplacementNeeded
            ? 'Failed to mark equipment as replacement needed.'
            : 'Failed to clear replacement needed tag.';
      setReplacementError(message);
    } finally {
      setIsMarkingReplacement(false);
    }
  };

  // ── Filter Handlers ──────────────────────────────────────────────────────
  const handleSearch = () => {
    setCurrentPage(1);
    loadEquipment(1, searchInput.trim(), statusFilter);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
    loadEquipment(1, searchInput.trim(), value);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setStatusFilter('');
    setCurrentPage(1);
    loadEquipment(1, '', '');
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadEquipment(page, searchInput.trim(), statusFilter);
  };

  const handleOpenDisposalHistory = async () => {
    setIsDisposalHistoryOpen(true);
    setDisposalHistoryError(null);

    try {
      await fetchDisposalHistory();
      await loadEquipment(currentPage, searchInput.trim(), statusFilter);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch disposal history';

      setDisposalHistoryError(message);
    }
  };

  const handleCloseDisposalHistory = () => {
    setIsDisposalHistoryOpen(false);
    setDisposalHistoryError(null);
  };

  const handleUpdateDisposalApproval = async (
    recordId: number,
    approvalStatus: Exclude<DisposalApprovalStatus, 'PENDING'>,
  ) => {
    setDisposalHistoryError(null);
    setSuccessMessage(null);
    setDisposalActionId(recordId);

    try {
      const updated = await updateDisposalApproval(recordId, { approvalStatus });
      await fetchDisposalHistory();
      await loadEquipment(currentPage, searchInput.trim(), statusFilter);

      setSuccessMessage(
        `Disposal record for "${updated.equipment.item.itemName}" was marked as ${DISPOSAL_APPROVAL_STATUS_LABELS[approvalStatus]}.`,
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update disposal approval status';
      setDisposalHistoryError(message);
    } finally {
      setDisposalActionId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">Asset Management</p>
            <h1 className="mt-1 text-2xl font-semibold">Equipment Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Register, track, and manage physical equipment assets. View status, condition,
              warranty information, and assigned users.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => loadEquipment()}
              className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
            >
              Refresh
            </button>

            {canRead && (
              <button
                type="button"
                onClick={handleOpenDisposalHistory}
                className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
              >
                Disposal History
              </button>
            )}

            {canCreate && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
              >
                + Add Equipment
              </button>
            )}
          </div>
        </header>

        {/* ── Alerts ──────────────────────────────────────────────────── */}
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

        {/* ── Main Card ───────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          {/* Filters Row */}
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[var(--surface-border)] pb-4 sm:flex-row sm:items-center">
            <div className="text-xs text-[var(--text-tertiary)] font-medium">
              Showing {equipment.length} of {meta.total} equipment records
              {meta.totalPages > 1 && ` · Page ${meta.page} of ${meta.totalPages}`}
            </div>
            {(searchInput || statusFilter) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
            <div className="relative flex items-center">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name, asset ID, serial number, brand, model..."
                className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-border-focus)]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            >
              <option value="">All Statuses</option>
              {EQUIPMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

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
              <h3 className="mt-3 font-medium text-[var(--text-primary)]">Loading equipment...</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Fetching data from the server.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="mt-6 hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-4 py-3.5 font-semibold w-14"></th>
                      <th className="px-4 py-3.5 font-semibold">Equipment</th>
                      <th className="px-4 py-3.5 font-semibold">Serial &amp; Model</th>
                      <th className="px-4 py-3.5 font-semibold">Status</th>
                      <th className="px-4 py-3.5 font-semibold">Monitoring Info</th>
                      {(canUpdate || canDelete) && (
                        <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {equipment.map((eq) => {
                      const primaryImg = getPrimaryImage(eq);
                      return (
                        <tr
                          key={eq.id}
                          className="transition hover:bg-[var(--surface-hover)] group"
                        >
                          {/* Image */}
                          <td className="px-4 py-4">
                            {primaryImg ? (
                              <div
                                className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer shadow-sm hover:scale-110 transition-transform duration-200"
                                onClick={() => setPreviewImageUrl(primaryImg.url)}
                              >
                                <img
                                  src={primaryImg.url}
                                  alt={eq.item.itemName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-[var(--background-tertiary)] flex items-center justify-center text-[var(--text-disabled)] text-xs border border-[var(--surface-border)]">
                                —
                              </div>
                            )}
                          </td>

                          {/* Equipment Info */}
                          <td className="px-4 py-4">
                            <div className="font-medium text-[var(--text-primary)]">
                              {eq.item.itemName}
                            </div>
                            <div className="text-[var(--text-tertiary)] font-mono text-xs mt-0.5">
                              {eq.assetId}
                            </div>
                            <div className="text-[var(--text-disabled)] text-xs mt-0.5">
                              {eq.item.category.name}
                            </div>
                          </td>

                          {/* Serial & Model */}
                          <td className="px-4 py-4 text-[var(--text-secondary)]">
                            <div>
                              {eq.brand && <span className="font-medium">{eq.brand} </span>}
                              {eq.model || '—'}
                            </div>
                            {eq.serialNumber && (
                              <div className="font-mono text-xs text-[var(--text-tertiary)] mt-0.5">
                                S/N: {eq.serialNumber}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            <StatusBadge status={eq.status} />
                          </td>

                          {/* Monitoring Info — Condition + Warranty merged */}
                          <td className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[var(--text-tertiary)]">Condition:</span>
                                <ConditionBadge condition={eq.condition} />
                              </div>
                              {eq.replacementNeeded && (
                                <div>
                                  <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                                    Replacement Needed
                                  </span>
                                </div>
                              )}
                              {eq.warrantyEnd ? (
                                <>
                                  <div>
                                    <span className="text-[var(--text-tertiary)]">Warranty: </span>
                                    {new Date(eq.warrantyEnd).toLocaleDateString()}
                                  </div>
                                  {eq.warrantyProvider && (
                                    <div className="text-[var(--text-disabled)]">
                                      {eq.warrantyProvider}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-[var(--text-disabled)] italic">
                                  No warranty
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          {(canUpdate || canDelete) && (
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {canUpdate && (
                                  <>
                                    {canManageReplacementNeededTag(eq) && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenReplacementNeeded(eq)}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                          eq.replacementNeeded
                                            ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                            : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                                        }`}
                                      >
                                        {eq.replacementNeeded
                                          ? 'Clear Planning Tag'
                                          : 'Mark Replacement'}
                                      </button>
                                    )}
                                    {canRequestRetirement(eq) && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenRetirementRequest(eq)}
                                        className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                                      >
                                        Request Retirement
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(eq)}
                                      className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                                    >
                                      Edit
                                    </button>
                                  </>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(eq)}
                                    className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:border-red-200"
                                  >
                                    Delete
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

              {/* Mobile Cards */}
              <div className="mt-6 grid gap-4 md:hidden">
                {equipment.map((eq) => {
                  const primaryImg = getPrimaryImage(eq);
                  return (
                    <article
                      key={eq.id}
                      className="rounded-xl border border-[var(--surface-border)] p-4 hover:shadow-[var(--shadow-sm)] transition"
                    >
                      <div className="flex items-start gap-3">
                        {primaryImg ? (
                          <img
                            src={primaryImg.url}
                            alt={eq.item.itemName}
                            className="h-12 w-12 rounded-lg object-cover cursor-pointer flex-shrink-0"
                            onClick={() => setPreviewImageUrl(primaryImg.url)}
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-[var(--background-tertiary)] flex items-center justify-center text-[var(--text-disabled)] text-xs border flex-shrink-0">
                            —
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[var(--text-primary)] truncate">
                            {eq.item.itemName}
                          </h3>
                          <p className="text-xs text-[var(--text-tertiary)] font-mono">
                            {eq.assetId}
                          </p>
                          <p className="text-xs text-[var(--text-disabled)]">
                            {eq.item.category.name}
                          </p>
                        </div>
                        <StatusBadge status={eq.status} />
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-[var(--surface-border)] pt-3">
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[var(--text-tertiary)]">Condition:</span>
                            <ConditionBadge condition={eq.condition} />
                          </div>
                          {eq.replacementNeeded && (
                            <span className="inline-flex w-fit rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                              Replacement Needed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {canUpdate && (
                            <>
                              {canManageReplacementNeededTag(eq) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReplacementNeeded(eq)}
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                    eq.replacementNeeded
                                      ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                      : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                                  }`}
                                >
                                  {eq.replacementNeeded ? 'Clear Planning Tag' : 'Mark Replacement'}
                                </button>
                              )}
                              {canRequestRetirement(eq) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRetirementRequest(eq)}
                                  className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                                >
                                  Request Retirement
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(eq)}
                                className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)]"
                              >
                                Edit
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(eq)}
                              className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-xs font-semibold transition hover:bg-red-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Empty State */}
              {equipment.length === 0 && !isLoading && (
                <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--background-tertiary)] text-xl">
                    🛠️
                  </div>
                  <h3 className="mt-4 font-semibold text-[var(--text-primary)]">
                    No equipment found
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {searchInput || statusFilter
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Register your first equipment asset to get started.'}
                  </p>
                  {canCreate && !searchInput && !statusFilter && (
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
                    >
                      Register First Equipment
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

      {/* ── Modal Form ──────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-3xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl animate-fade-in-up max-h-[95vh] flex flex-col overflow-hidden">
            {/* Modal Header — sticky, never scrolls */}
            <div className="flex-shrink-0 flex items-center justify-between border-b border-[var(--surface-border)] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {editingEquipment ? 'Edit Equipment' : 'Register New Equipment'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {editingEquipment
                    ? `Editing ${editingEquipment.item.itemName} (${editingEquipment.assetId})`
                    : 'Add a new equipment asset to the inventory system.'}
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
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Form Error */}
              {formError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* ── Images ─────────────────────────────────────────────── */}
                <fieldset>
                  <legend className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                    Images
                  </legend>

                  {/* Existing images (edit mode) */}
                  {editingEquipment && editingEquipment.images.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-[var(--text-secondary)] mb-2">Current Images</p>
                      <div className="flex flex-wrap gap-3">
                        {editingEquipment.images.map((img) => (
                          <div key={img.id} className="relative group">
                            <img
                              src={img.url}
                              alt={img.label || 'Equipment image'}
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
                              onClick={() => handleDeleteExistingImage(editingEquipment.id, img.id)}
                              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending images (both create and edit modes) */}
                  {pendingImages.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-[var(--text-secondary)] mb-2">
                        {editingEquipment ? 'New images to add' : 'Images to upload'}
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

                  {/* Add image input */}
                  <div className="flex flex-col gap-2 w-full">
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleImageChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {imageError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 font-medium flex items-center justify-between gap-2">
                        <span>{imageError}</span>
                        <button
                          type="button"
                          onClick={() => setImageError(null)}
                          className="font-bold text-red-800 hover:text-red-950"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Max size: 5MB. Formats: JPG, JPEG, PNG
                    </p>
                  </div>
                </fieldset>

                {/* ── Basic Information ───────────────────────────────────── */}
                <fieldset>
                  <legend className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                    Basic Information
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      label="Item Name"
                      required
                      name="itemName"
                      value={formData.itemName}
                      onChange={handleInputChange}
                      placeholder="e.g. Dell XPS 15 Laptop"
                    />
                    {/* Asset ID — manual entry */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Asset ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        name="assetId"
                        value={formData.assetId}
                        onChange={handleInputChange}
                        readOnly={!!editingEquipment && !isAdmin}
                        placeholder="e.g. EQ-001"
                        className={`w-full rounded-xl border px-4 py-2.5 text-sm font-mono outline-none transition ${
                          editingEquipment && !isAdmin
                            ? 'cursor-not-allowed border-[var(--surface-border)] bg-[var(--background-tertiary)] text-[var(--text-secondary)]'
                            : 'border-[var(--input-border)] bg-[var(--input-bg)] focus:border-[var(--input-border-focus)]'
                        }`}
                      />
                    </div>
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
                        {equipmentCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {equipmentCategories.length === 0 && (
                        <p className="text-xs text-[var(--text-disabled)]">
                          No equipment categories found. Create one first.
                        </p>
                      )}
                    </div>
                    <FormField
                      label="Serial Number"
                      name="serialNumber"
                      value={formData.serialNumber}
                      onChange={handleInputChange}
                      placeholder="e.g. SN-987654321"
                    />
                    <FormField
                      label="Brand"
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      placeholder="e.g. Dell"
                    />
                    <FormField
                      label="Model"
                      name="model"
                      value={formData.model}
                      onChange={handleInputChange}
                      placeholder="e.g. XPS 15 9520"
                    />
                    {/* Location dropdown with ability to add new options */}
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Location
                      </label>
                      {showLocationInput ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newLocationValue}
                            onChange={(e) => setNewLocationValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = newLocationValue.trim();
                                if (trimmed && !locationOptions.includes(trimmed)) {
                                  setLocationOptions((prev) => [...prev, trimmed]);
                                }
                                if (trimmed) {
                                  setFormData((prev) => ({ ...prev, location: trimmed }));
                                }
                                setNewLocationValue('');
                                setShowLocationInput(false);
                              }
                              if (e.key === 'Escape') {
                                setShowLocationInput(false);
                                setNewLocationValue('');
                              }
                            }}
                            placeholder="Enter new location..."
                            autoFocus
                            className="flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newLocationValue.trim();
                              if (trimmed && !locationOptions.includes(trimmed)) {
                                setLocationOptions((prev) => [...prev, trimmed]);
                              }
                              if (trimmed) {
                                setFormData((prev) => ({ ...prev, location: trimmed }));
                              }
                              setNewLocationValue('');
                              setShowLocationInput(false);
                            }}
                            className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowLocationInput(false);
                              setNewLocationValue('');
                            }}
                            className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <select
                            name="location"
                            value={formData.location}
                            onChange={handleInputChange}
                            className="flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                          >
                            <option value="">Select location...</option>
                            {locationOptions.map((loc) => (
                              <option key={loc} value={loc}>
                                {loc}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowLocationInput(true)}
                            title="Add new location"
                            className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Optional description..."
                      rows={2}
                      className="mt-1.5 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)] resize-none"
                    />
                  </div>
                </fieldset>

                {/* ── Status & Condition ──────────────────────────────────── */}
                <fieldset>
                  <legend className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                    Status &amp; Condition
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Status
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                      >
                        {!MANUALLY_SELECTABLE_EQUIPMENT_STATUSES.includes(formData.status) && (
                          <option value={formData.status} disabled>
                            {formData.status.replace(/_/g, ' ')} (workflow status)
                          </option>
                        )}
                        {MANUALLY_SELECTABLE_EQUIPMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Condition
                      </label>
                      <select
                        name="condition"
                        value={formData.condition}
                        onChange={handleInputChange}
                        className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                      >
                        {CONDITION_STATUSES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </fieldset>

                {/* ── Warranty & Purchase ─────────────────────────────────── */}
                <fieldset>
                  <legend className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                    Warranty &amp; Purchase
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      label="Warranty Start"
                      name="warrantyStart"
                      type="date"
                      value={formData.warrantyStart}
                      onChange={handleInputChange}
                    />
                    <FormField
                      label="Warranty End"
                      name="warrantyEnd"
                      type="date"
                      value={formData.warrantyEnd}
                      onChange={handleInputChange}
                    />
                    <FormField
                      label="Warranty Provider"
                      name="warrantyProvider"
                      value={formData.warrantyProvider}
                      onChange={handleInputChange}
                      placeholder="e.g. Dell Technologies"
                    />
                    <FormField
                      label="Purchase Price"
                      name="purchasePrice"
                      type="number"
                      value={formData.purchasePrice}
                      onChange={handleInputChange}
                      placeholder="0.00"
                    />
                    <FormField
                      label="Acquisition Date"
                      name="acquisitionDate"
                      type="date"
                      value={formData.acquisitionDate}
                      onChange={handleInputChange}
                    />
                  </div>
                </fieldset>

                {/* ── Form Actions ────────────────────────────────────────── */}
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
                    {editingEquipment ? 'Save Changes' : 'Register Equipment'}
                  </button>
                </div>
              </form>
            </div>
            {/* end scrollable body */}
          </section>
        </div>
      )}

      {/* ── Replacement Needed Confirmation Modal ─────────────────────── */}
      {replacementEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl animate-fade-in-up overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {replacementEquipment.replacementNeeded
                    ? 'Clear Replacement Needed Tag'
                    : 'Mark Replacement Needed'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {replacementEquipment.item.itemName} · {replacementEquipment.assetId}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseReplacementNeeded}
                disabled={isMarkingReplacement}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5">
              {replacementError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {replacementError}
                </div>
              )}

              <div
                className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                  replacementEquipment.replacementNeeded
                    ? 'border-slate-200 bg-slate-50 text-slate-700'
                    : 'border-purple-200 bg-purple-50 text-purple-800'
                }`}
              >
                {replacementEquipment.replacementNeeded ? (
                  <>
                    This will remove the manual{' '}
                    <span className="font-semibold">Replacement Needed </span>planning tag. The
                    equipment may still appear in replacement planning if its condition, status, or
                    lifecycle qualifies.
                  </>
                ) : (
                  <>
                    This will tag the equipment as{' '}
                    <span className="font-semibold">Replacement Needed </span>for procurement
                    planning only. It will not change the equipment status or submit a retirement
                    request.
                  </>
                )}
              </div>

              <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)]">
                  {replacementEquipment.item.itemName}
                </p>
                <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">
                  {replacementEquipment.assetId}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-[var(--text-tertiary)]">Status: </span>
                    <span className="font-semibold">
                      {replacementEquipment.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">Condition: </span>
                    <span className="font-semibold">{replacementEquipment.condition}</span>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-[var(--text-tertiary)]">
                This action does not change equipment status and does not automatically trigger
                retirement or disposal.
              </p>

              <div className="mt-5 flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4">
                <button
                  type="button"
                  onClick={handleCloseReplacementNeeded}
                  disabled={isMarkingReplacement}
                  className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmReplacementNeeded()}
                  disabled={isMarkingReplacement}
                  className={`rounded-xl px-5 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2 ${
                    replacementEquipment.replacementNeeded
                      ? 'bg-slate-700 hover:bg-slate-800'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {isMarkingReplacement && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  )}
                  {replacementEquipment.replacementNeeded ? 'Clear Tag' : 'Confirm Tag'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Disposal History Modal ──────────────────────────────────────── */}
      {isDisposalHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-5xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl animate-fade-in-up overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Disposal History
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Review pending, completed, and rejected equipment disposal records.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDisposalHistory}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {disposalHistoryError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {disposalHistoryError}
                </div>
              )}

              {isDisposalHistoryLoading ? (
                <div className="rounded-xl border border-dashed border-[var(--surface-border)] p-10 text-center">
                  <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                  <h3 className="mt-3 font-medium text-[var(--text-primary)]">
                    Loading disposal history...
                  </h3>
                </div>
              ) : disposalHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--surface-border)] p-10 text-center">
                  <h3 className="font-semibold text-[var(--text-primary)]">No Disposal History</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Pending, completed, and rejected disposal records will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--surface-border)]">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Equipment</th>
                        <th className="px-4 py-3 font-semibold">Reason</th>
                        <th className="px-4 py-3 font-semibold">User</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Approval Status</th>
                        <th className="px-4 py-3 font-semibold">Notes</th>
                        <th className="px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--surface-border)]">
                      {disposalHistory.map((record) => (
                        <tr key={record.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--text-primary)]">
                              {record.equipment.item.itemName}
                            </div>
                            <div className="text-xs font-mono text-[var(--text-tertiary)]">
                              {record.equipment.assetId}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            {DISPOSAL_REASON_LABELS[record.reason]}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            <div>
                              {record.approvedBy.firstName} {record.approvedBy.lastName}
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)]">
                              {record.approvedBy.email}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            {formatDisplayDate(record.disposalDate)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                record.approvalStatus === 'COMPLETED'
                                  ? 'border border-green-200 bg-green-50 text-green-700'
                                  : record.approvalStatus === 'PENDING'
                                    ? 'border border-yellow-200 bg-yellow-50 text-yellow-700'
                                    : 'border border-red-200 bg-red-50 text-red-700'
                              }`}
                            >
                              {DISPOSAL_APPROVAL_STATUS_LABELS[record.approvalStatus]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            {record.notes || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {record.approvalStatus === 'PENDING' && (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateDisposalApproval(record.id, 'COMPLETED')
                                  }
                                  disabled={disposalActionId === record.id}
                                  className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {disposalActionId === record.id ? 'Saving...' : 'Complete'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateDisposalApproval(record.id, 'REJECTED')
                                  }
                                  disabled={disposalActionId === record.id}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {disposalActionId === record.id ? 'Saving...' : 'Reject'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── Retirement Request Modal ────────────────────────────────────── */}
      {retiringEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-lg rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl animate-fade-in-up overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Submit Retirement Request
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {retiringEquipment.item.itemName} · {retiringEquipment.assetId}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseRetirementRequest}
                disabled={isRetiring}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRetirementRequest} className="px-6 py-5">
              {retirementError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {retirementError}
                </div>
              )}

              <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                This will create a disposal record and change the equipment status to
                <span className="font-semibold"> RETIREMENT PENDING</span>.
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Disposal Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    name="reason"
                    value={retirementForm.reason}
                    onChange={handleRetirementInputChange}
                    className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                  >
                    {DISPOSAL_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {DISPOSAL_REASON_LABELS[reason]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Disposal Method <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    name="method"
                    value={retirementForm.method}
                    onChange={handleRetirementInputChange}
                    maxLength={100}
                    placeholder="e.g. For disposal review"
                    className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={retirementForm.notes}
                    onChange={handleRetirementInputChange}
                    maxLength={1000}
                    rows={4}
                    placeholder="Optional retirement/disposal notes..."
                    className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)] resize-none"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4">
                <button
                  type="button"
                  onClick={handleCloseRetirementRequest}
                  disabled={isRetiring}
                  className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRetiring}
                  className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
                >
                  {isRetiring && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  )}
                  Submit Request
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── Lightbox ────────────────────────────────────────────────────── */}
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
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-gray-700 bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </main>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

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
        step={type === 'number' ? '0.01' : undefined}
        min={type === 'number' ? '0' : undefined}
        className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
      />
    </div>
  );
}

function StatusBadge({ status }: { status: EquipmentStatus }) {
  const styles: Record<EquipmentStatus, string> = {
    AVAILABLE: 'bg-[var(--success-muted)] text-[var(--success)]',
    IN_USE: 'bg-[var(--info-muted)] text-[var(--info)]',
    UNDER_MAINTENANCE: 'bg-[var(--warning-muted)] text-[var(--warning)]',
    DAMAGED: 'bg-red-50 text-red-600',
    LOST: 'bg-red-50 text-red-700',
    BORROWED: 'bg-purple-50 text-purple-600',
    RETIREMENT_PENDING: 'bg-orange-50 text-orange-700',
    RETIRED: 'bg-gray-100 text-gray-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-500'}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'AVAILABLE'
            ? 'bg-[var(--success)]'
            : status === 'IN_USE'
              ? 'bg-[var(--info)]'
              : status === 'UNDER_MAINTENANCE'
                ? 'bg-[var(--warning)]'
                : status === 'DAMAGED' || status === 'LOST'
                  ? 'bg-red-600'
                  : status === 'BORROWED'
                    ? 'bg-purple-600'
                    : status === 'RETIREMENT_PENDING'
                      ? 'bg-orange-600'
                      : 'bg-gray-400'
        }`}
      />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ConditionBadge({ condition }: { condition: ConditionStatus }) {
  const styles: Record<ConditionStatus, string> = {
    NEW: 'text-[var(--success)] font-bold',
    GOOD: 'text-[var(--info)] font-semibold',
    FAIR: 'text-[var(--warning)] font-semibold',
    POOR: 'text-orange-600 font-semibold',
    DAMAGED: 'text-red-600 font-bold',
  };

  return <span className={`text-xs ${styles[condition] || 'text-gray-500'}`}>{condition}</span>;
}
