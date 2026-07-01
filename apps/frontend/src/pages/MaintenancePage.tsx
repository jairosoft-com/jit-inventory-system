import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useEquipmentStore } from '../store/equipmentStore';
import type { MaintenanceLog, MaintenanceStatus } from '../store/maintenanceStore';
import api from '../lib/api';
import './MaintenancePage.css';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

const PAGE_LIMIT = 20;

export default function MaintenancePage() {
  const { user: authUser } = useAuthStore();
  const {
    maintenanceLogs,
    meta,
    stats,
    isLoading,
    error: storeError,
    fetchMaintenanceLogs,
    fetchStats,
    scheduleMaintenance,
    updateMaintenanceSchedule,
    createMaintenanceLog,
    clearError,
  } = useMaintenanceStore();

  const { equipment, fetchEquipment } = useEquipmentStore();

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'all'>('upcoming');

  // Modal control states
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<MaintenanceLog | null>(null);

  // Form states
  const [users, setUsers] = useState<User[]>([]);
  const [scheduleData, setScheduleData] = useState({
    description: '',
    scheduledDate: '',
    assigneeType: 'internal', // 'internal' | 'vendor'
    performedById: '',
    performedByVendor: '',
    notes: '',
  });

  const [completeData, setCompleteData] = useState({
    cost: '',
    completedDate: new Date().toISOString().split('T')[0],
    notes: '',
    postMaintenanceCondition: '',
  });

  const [createData, setCreateData] = useState({
    equipmentId: '',
    description: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Permissions
  const isAdmin = authUser?.role?.name === 'ADMIN';
  const isManager = authUser?.role?.name === 'MANAGER';
  const canWrite = isAdmin || isManager; // Admins and Managers are authorized users

  const loadData = useCallback(() => {
    // Determine status query param
    let statusQuery: MaintenanceStatus | undefined;
    if (activeTab === 'all' && statusFilter !== 'all' && statusFilter !== 'unscheduled' && statusFilter !== 'scheduled_only') {
      statusQuery = statusFilter as MaintenanceStatus;
    }

    void fetchMaintenanceLogs({
      search: appliedSearchTerm,
      status: statusQuery,
      tab: activeTab,
      page: currentPage,
      limit: PAGE_LIMIT,
    });
  }, [activeTab, appliedSearchTerm, statusFilter, currentPage, fetchMaintenanceLogs]);

  // Fetch users for technician list and equipment
  useEffect(() => {
    loadData();
    api.get<{ data: User[] }>('/users', { params: { limit: 100 } })
      .then((res) => setUsers(res.data.data))
      .catch((err) => console.error('Failed to load users:', err));

    void fetchEquipment({ needsMaintenance: true, limit: 100 });
  }, [loadData, fetchEquipment]);

  // Filter logs locally for unscheduled and scheduled_only helper filters when in 'all' tab
  // Also safeguard tab states during loading/loading transitions
  const filteredLogs = useMemo(() => {
    let logs = maintenanceLogs;
    if (activeTab === 'upcoming') {
      logs = maintenanceLogs.filter(
        (log) =>
          (log.status === 'SCHEDULED' || log.status === 'IN_PROGRESS') &&
          log.scheduledDate !== null
      );
    } else if (activeTab === 'history') {
      logs = maintenanceLogs.filter(
        (log) => log.status === 'COMPLETED' || log.status === 'CANCELLED'
      );
    } else if (activeTab === 'all') {
      if (statusFilter === 'unscheduled') {
        logs = maintenanceLogs.filter((log) => log.scheduledDate === null);
      } else if (statusFilter === 'scheduled_only') {
        logs = maintenanceLogs.filter((log) => log.status === 'SCHEDULED' && log.scheduledDate !== null);
      }
    }
    return logs;
  }, [maintenanceLogs, activeTab, statusFilter]);

  const selectableEquipment = equipment;

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    setAppliedSearchTerm(searchTerm.trim());
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setAppliedSearchTerm('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  // Open Schedule Modal
  const handleOpenSchedule = (log: MaintenanceLog) => {
    setSelectedLog(log);
    setFormError(null);
    setScheduleData({
      description: log.description || '',
      scheduledDate: log.scheduledDate ? log.scheduledDate.split('T')[0] : '',
      assigneeType: log.performedByVendor ? 'vendor' : 'internal',
      performedById: log.performedById ? String(log.performedById) : '',
      performedByVendor: log.performedByVendor || '',
      notes: log.notes || '',
    });
    setIsScheduleModalOpen(true);
  };

  // Submit Schedule
  const handleScheduleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLog) return;
    setFormError(null);

    const { description, scheduledDate, assigneeType, performedById, performedByVendor, notes } = scheduleData;

    if (!description.trim()) {
      setFormError('Maintenance description/type is required');
      return;
    }

    if (!scheduledDate) {
      setFormError('Scheduled date is required');
      return;
    }

    const selectedDateObj = new Date(scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDateObj < today) {
      setFormError('Scheduled date cannot be in the past');
      return;
    }

    let performedByIdNum: number | null = null;
    let vendorStr: string | null = null;

    if (assigneeType === 'internal') {
      if (!performedById) {
        setFormError('Please select a technician');
        return;
      }
      performedByIdNum = Number(performedById);
    } else {
      if (!performedByVendor.trim()) {
        setFormError('Please specify a service provider/vendor');
        return;
      }
      vendorStr = performedByVendor.trim();
    }

    setIsSubmitting(true);
    try {
      await scheduleMaintenance(selectedLog.id, {
        description: description.trim(),
        scheduledDate: new Date(scheduledDate).toISOString(),
        performedById: performedByIdNum,
        performedByVendor: vendorStr,
        notes: notes.trim() || null,
      });

      setSuccessMessage('Maintenance scheduled successfully');
      setIsScheduleModalOpen(false);
      loadData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transition Status (Start Maintenance / Cancel Maintenance)
  const handleTransitionStatus = async (log: MaintenanceLog, newStatus: MaintenanceStatus) => {
    try {
      await updateMaintenanceSchedule(log.id, {
        status: newStatus,
      });
      setSuccessMessage(`Maintenance transitioned to ${newStatus.replace('_', ' ')}`);
      loadData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update maintenance status');
    }
  };

  // Open Complete Modal
  const handleOpenComplete = (log: MaintenanceLog) => {
    setSelectedLog(log);
    setFormError(null);
    setCompleteData({
      cost: '',
      completedDate: new Date().toISOString().split('T')[0],
      notes: log.notes || '',
      postMaintenanceCondition: log.equipment.condition || 'GOOD',
    });
    setIsCompleteModalOpen(true);
  };

  // Submit Complete
  const handleCompleteSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLog) return;
    setFormError(null);

    const { cost, completedDate, notes, postMaintenanceCondition } = completeData;

    if (!completedDate) {
      setFormError('Completed date is required');
      return;
    }

    const costNum = cost ? Number(cost) : null;
    if (costNum !== null && (isNaN(costNum) || costNum < 0)) {
      setFormError('Cost must be a positive number');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateMaintenanceSchedule(selectedLog.id, {
        status: 'COMPLETED',
        completedDate: new Date(completedDate).toISOString(),
        cost: costNum,
        notes: notes.trim() || null,
        ...(postMaintenanceCondition ? { postMaintenanceCondition } : {}),
      });

      setSuccessMessage('Maintenance record completed successfully');
      setIsCompleteModalOpen(false);
      loadData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Create Manual Modal
  const handleOpenCreate = () => {
    setFormError(null);
    setCreateData({
      equipmentId: '',
      description: '',
    });
    setIsCreateModalOpen(true);
  };

  // Submit Create Manual Log
  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const { equipmentId, description } = createData;

    if (!equipmentId) {
      setFormError('Please select an equipment asset');
      return;
    }

    if (!description.trim()) {
      setFormError('Maintenance description is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await createMaintenanceLog(Number(equipmentId), description.trim());
      setSuccessMessage('Maintenance slot initialized successfully');
      setIsCreateModalOpen(false);
      loadData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };



  // Render Condition Badge
  const renderConditionBadge = (condition: string) => {
    const styles: Record<string, string> = {
      NEW: 'bg-green-100 text-green-800',
      GOOD: 'bg-blue-100 text-blue-800',
      FAIR: 'bg-amber-100 text-amber-800',
      POOR: 'bg-orange-100 text-orange-800',
      DAMAGED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[condition] || 'bg-gray-100 text-gray-800'}`}>
        {condition}
      </span>
    );
  };

  // Render Badge
  const renderStatusBadge = (log: MaintenanceLog) => {
    if (log.scheduledDate === null) {
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          No Maintenance Scheduled
        </span>
      );
    }

    switch (log.status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
            Scheduled
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            {log.status}
          </span>
        );
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between animate-fade-in">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold">Equipment Maintenance</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Schedule, track, and complete preventive and corrective maintenance logs for registered hardware assets.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadData}
              className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
            >
              Refresh
            </button>

            {canWrite && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
              >
                Log Maintenance
              </button>
            )}
          </div>
        </header>

        {/* Errors & Alerts */}
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

        {/* Summary Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 stagger-children">
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Total Records</p>
              <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
            </div>
            <div className="text-3xl">🛠️</div>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Unscheduled</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-500">{stats.unscheduled}</h3>
            </div>
            <div className="text-3xl">⏳</div>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Scheduled</p>
              <h3 className="text-2xl font-bold mt-1 text-blue-500">{stats.scheduled}</h3>
            </div>
            <div className="text-3xl">📅</div>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">In Progress</p>
              <h3 className="text-2xl font-bold mt-1 text-amber-500">{stats.inProgress}</h3>
            </div>
            <div className="text-3xl">⚙️</div>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Completed</p>
              <h3 className="text-2xl font-bold mt-1 text-green-500">{stats.completed}</h3>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </section>

        {/* Workspace Maintenance Logs Section */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          {/* Horizontal Tabs */}
          <div className="flex border-b border-[var(--surface-border)] mb-6 overflow-x-auto whitespace-nowrap">
            <button
              type="button"
              onClick={() => { setActiveTab('upcoming'); setCurrentPage(1); }}
              className={`px-5 py-3 text-sm font-semibold -mb-px border-b-2 transition duration-200 ${
                activeTab === 'upcoming'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Upcoming Maintenance
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
              className={`px-5 py-3 text-sm font-semibold -mb-px border-b-2 transition duration-200 ${
                activeTab === 'history'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Maintenance History
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
              className={`px-5 py-3 text-sm font-semibold -mb-px border-b-2 transition duration-200 ${
                activeTab === 'all'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All Records
            </button>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 border-b border-[var(--surface-border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 max-w-lg gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by equipment, asset ID or description..."
                className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm outline-none focus:border-[var(--input-border-focus)]"
              />
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              {activeTab === 'all' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilterChange(e.target.value)}
                    className="rounded-xl border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm font-medium outline-none"
                  >
                    <option value="all">All Logs</option>
                    <option value="unscheduled">Unscheduled</option>
                    <option value="scheduled_only">Scheduled Only</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              )}

              {(searchTerm || (activeTab === 'all' && statusFilter !== 'all')) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="rounded-xl border border-dashed border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Table list */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="py-12 text-center">
                <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--accent)]" />
                <p className="mt-2 text-sm text-[var(--text-secondary)] animate-pulse">Loading maintenance logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-secondary)]">
                <p className="text-lg font-semibold">No maintenance logs found</p>
                <p className="text-sm mt-1">Try expanding your search query or registering new equipment.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--background-secondary)]">
                    <th className="px-4 py-3.5">Asset ID</th>
                    <th className="px-4 py-3.5">Equipment Name</th>
                    <th className="px-4 py-3.5">Condition</th>
                    <th className="px-4 py-3.5">Maintenance Description</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Scheduled Date</th>
                    <th className="px-4 py-3.5">Completion Date</th>
                    <th className="px-4 py-3.5">Technician / Vendor</th>
                    <th className="px-4 py-3.5">Cost</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)] text-sm">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--surface-hover)] transition">
                      <td className="px-4 py-4 font-mono font-medium text-[var(--text-primary)]">
                        {log.equipment.assetId}
                      </td>
                      <td className="px-4 py-4 font-medium text-[var(--text-primary)]">
                        {log.equipmentName || log.equipment.item.itemName}
                      </td>
                      <td className="px-4 py-4">
                        {renderConditionBadge(log.equipmentCondition || log.equipment.condition)}
                      </td>
                      <td className="px-4 py-4 text-[var(--text-secondary)] max-w-xs truncate">
                        {log.description}
                      </td>
                      <td className="px-4 py-4">
                        {renderStatusBadge(log)}
                      </td>
                      <td className="px-4 py-4 text-[var(--text-secondary)]">
                        {log.scheduledDate ? new Date(log.scheduledDate).toLocaleDateString(undefined, { timeZone: 'UTC' }) : '—'}
                      </td>
                      <td className="px-4 py-4 text-[var(--text-secondary)]">
                        {log.completedDate ? new Date(log.completedDate).toLocaleDateString(undefined, { timeZone: 'UTC' }) : '—'}
                      </td>
                      <td className="px-4 py-4 text-[var(--text-secondary)]">
                        {log.performedBy
                          ? `${log.performedBy.firstName} ${log.performedBy.lastName}`
                          : log.performedByVendor
                          ? `${log.performedByVendor} (Vendor)`
                          : '—'}
                      </td>
                      <td className="px-4 py-4 text-[var(--text-primary)] font-semibold">
                        {log.cost !== null ? `$${Number(log.cost).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {canWrite && log.scheduledDate === null && (
                            <button
                              onClick={() => handleOpenSchedule(log)}
                              className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                            >
                              Schedule
                            </button>
                          )}
                          {canWrite && log.scheduledDate !== null && log.status === 'SCHEDULED' && (
                            <>
                              <button
                                onClick={() => handleOpenSchedule(log)}
                                className="rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleTransitionStatus(log, 'IN_PROGRESS')}
                                className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
                              >
                                Start
                              </button>
                            </>
                          )}
                          {canWrite && log.status === 'IN_PROGRESS' && (
                            <>
                              <button
                                onClick={() => handleOpenComplete(log)}
                                className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => handleTransitionStatus(log, 'CANCELLED')}
                                className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {log.notes && (
                            <span
                              title={log.notes}
                              className="cursor-help rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 transition"
                            >
                              ℹ️
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && filteredLogs.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-[var(--surface-border)] pt-4">
              <span className="text-xs text-[var(--text-secondary)]">
                Showing page <span className="font-semibold">{meta.page}</span> of{' '}
                <span className="font-semibold">{meta.totalPages}</span> ({meta.total} total logs)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={meta.page <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Schedule Maintenance Modal */}
      {isScheduleModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {selectedLog.scheduledDate ? 'Reschedule Maintenance' : 'Schedule Maintenance'}
              </h2>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Equipment Asset</label>
                <input
                  type="text"
                  disabled
                  value={`${selectedLog.equipment.item.itemName} (${selectedLog.equipment.assetId})`}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--background-secondary)] px-4 py-2.5 text-sm cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="sch-desc" className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                  Maintenance Type / Description <span className="text-red-500">*</span>
                </label>
                <input
                  id="sch-desc"
                  type="text"
                  required
                  value={scheduleData.description}
                  onChange={(e) => setScheduleData({ ...scheduleData, description: e.target.value })}
                  placeholder="e.g. Annual calibration, Repair broken screen..."
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="sch-date" className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                  Scheduled Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="sch-date"
                  type="date"
                  required
                  value={scheduleData.scheduledDate}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduledDate: e.target.value })}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Assignee Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="assigneeType"
                      checked={scheduleData.assigneeType === 'internal'}
                      onChange={() => setScheduleData({ ...scheduleData, assigneeType: 'internal' })}
                    />
                    Internal Technician
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="assigneeType"
                      checked={scheduleData.assigneeType === 'vendor'}
                      onChange={() => setScheduleData({ ...scheduleData, assigneeType: 'vendor' })}
                    />
                    External Vendor
                  </label>
                </div>
              </div>

              {scheduleData.assigneeType === 'internal' ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sch-tech" className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                    Assign Technician <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="sch-tech"
                    required={scheduleData.assigneeType === 'internal'}
                    value={scheduleData.performedById}
                    onChange={(e) => setScheduleData({ ...scheduleData, performedById: e.target.value })}
                    className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                  >
                    <option value="">Select Technician...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sch-vendor" className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                    Service Provider / Vendor <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="sch-vendor"
                    type="text"
                    required={scheduleData.assigneeType === 'vendor'}
                    value={scheduleData.performedByVendor}
                    onChange={(e) => setScheduleData({ ...scheduleData, performedByVendor: e.target.value })}
                    placeholder="e.g. Tektronix Inc., Acer Support..."
                    className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="sch-notes" className="text-xs font-bold text-[var(--text-secondary)] uppercase">Notes</label>
                <textarea
                  id="sch-notes"
                  rows={2}
                  value={scheduleData.notes}
                  onChange={(e) => setScheduleData({ ...scheduleData, notes: e.target.value })}
                  placeholder="Optional technician guidelines..."
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)] resize-none"
                />
              </div>

              {formError && <p className="text-xs font-semibold text-red-600">{formError}</p>}

              <div className="flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Complete Maintenance Modal */}
      {isCompleteModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Complete Maintenance</h2>
              <button
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Equipment Asset</label>
                <input
                  type="text"
                  disabled
                  value={`${selectedLog.equipment.item.itemName} (${selectedLog.equipment.assetId})`}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--background-secondary)] px-4 py-2.5 text-sm cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cpl-cost" className="text-xs font-bold text-[var(--text-secondary)] uppercase">Maintenance Cost ($)</label>
                <input
                  id="cpl-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={completeData.cost}
                  onChange={(e) => setCompleteData({ ...completeData, cost: e.target.value })}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cpl-date" className="text-xs font-bold text-[var(--text-secondary)] uppercase">Completion Date <span className="text-red-500">*</span></label>
                <input
                  id="cpl-date"
                  type="date"
                  required
                  value={completeData.completedDate}
                  onChange={(e) => setCompleteData({ ...completeData, completedDate: e.target.value })}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cpl-condition" className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                  Equipment Condition Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="cpl-condition"
                  required
                  value={completeData.postMaintenanceCondition}
                  onChange={(e) => setCompleteData({ ...completeData, postMaintenanceCondition: e.target.value })}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                >
                  <option value="NEW">New</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cpl-notes" className="text-xs font-bold text-[var(--text-secondary)] uppercase">Technician Notes</label>
                <textarea
                  id="cpl-notes"
                  rows={3}
                  value={completeData.notes}
                  onChange={(e) => setCompleteData({ ...completeData, notes: e.target.value })}
                  placeholder="Describe maintenance work done, parts replaced..."
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)] resize-none"
                />
              </div>

              {formError && <p className="text-xs font-semibold text-red-600">{formError}</p>}

              <div className="flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving...' : 'Complete Work'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Log Maintenance (Create) Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
          <section className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Initialize Maintenance Log</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cre-eq" className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                  Select Equipment <span className="text-red-500">*</span>
                </label>
                <select
                  id="cre-eq"
                  required
                  value={createData.equipmentId}
                  onChange={(e) => setCreateData({ ...createData, equipmentId: e.target.value })}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                >
                  <option value="">Choose asset...</option>
                  {selectableEquipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.item.itemName} ({eq.assetId}) - {eq.status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cre-desc" className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                  Initial Description <span className="text-red-500">*</span>
                </label>
                <input
                  id="cre-desc"
                  type="text"
                  required
                  value={createData.description}
                  onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                  placeholder="e.g. Schedule for inspection..."
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
                />
              </div>

              {formError && <p className="text-xs font-semibold text-red-600">{formError}</p>}

              <div className="flex items-center justify-end gap-3 border-t border-[var(--surface-border)] pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating...' : 'Create Record'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
