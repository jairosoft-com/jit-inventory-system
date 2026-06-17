import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import AnalyticsSection from './AnalyticsSection';
import './DashboardPage.css';

interface QuickAction {
  label: string;
  color: string;
  icon: string;
  path: string;
  disabled?: boolean;
}

const quickActions: QuickAction[] = [
  {
    label: 'Register Item',
    color: '#2563eb',
    icon: '+',
    path: '/dashboard/inventory',
  },
  {
    label: 'Stock In',
    color: '#16a34a',
    icon: '↓',
    path: '/dashboard/inventory',
  },
  {
    label: 'Stock Out',
    color: '#dc2626',
    icon: '↑',
    path: '/dashboard/inventory',
  },
  {
    label: 'New PO',
    color: '#8b5cf6',
    icon: '📋',
    path: '/dashboard/orders',
  },
  {
    label: 'Borrow Request',
    color: '#d97706',
    icon: '🔄',
    path: '/dashboard/borrow',
    disabled: true,
  },
  {
    label: 'Run Report',
    color: '#0891b2',
    icon: '📊',
    path: '/dashboard/logs',
  },
];

const purchaseOrderStatusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'rgba(107, 114, 128, 0.08)', text: '#6b7280' },
  PENDING: { bg: 'rgba(245, 158, 11, 0.08)', text: '#d97706' },
  APPROVED: { bg: 'rgba(59, 130, 246, 0.08)', text: '#2563eb' },
  RECEIVED: { bg: 'rgba(16, 185, 129, 0.08)', text: '#10b981' },
  CANCELLED: { bg: 'rgba(239, 68, 68, 0.08)', text: '#ef4444' },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';

  return `${diffDay}d ago`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDaysRemaining(daysRemaining: number): string {
  if (daysRemaining === 0) {
    return 'Expires today';
  }

  if (daysRemaining === 1) {
    return '1 day remaining';
  }

  return `${daysRemaining} days remaining`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function getActivityDetails(action: string) {
  switch (action) {
    case 'CREATED':
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)',
        label: 'Created',
      };
    case 'UPDATED':
      return {
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.1)',
        label: 'Updated',
      };
    case 'DELETED':
      return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        label: 'Deleted',
      };
    case 'BORROWED':
      return {
        color: '#8b5cf6',
        bg: 'rgba(139, 92, 246, 0.1)',
        label: 'Borrowed',
      };
    case 'RETURNED':
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)',
        label: 'Returned',
      };
    case 'APPROVED':
      return {
        color: '#059669',
        bg: 'rgba(5, 150, 105, 0.1)',
        label: 'Approved',
      };
    case 'REJECTED':
      return {
        color: '#dc2626',
        bg: 'rgba(220, 38, 38, 0.1)',
        label: 'Rejected',
      };
    case 'DISPOSED':
      return {
        color: '#6b7280',
        bg: 'rgba(107, 114, 128, 0.1)',
        label: 'Disposed',
      };
    case 'MAINTENANCE_STARTED':
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        label: 'Maint. Start',
      };
    case 'MAINTENANCE_COMPLETED':
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)',
        label: 'Maint. End',
      };
    default:
      return {
        color: '#6b7280',
        bg: 'rgba(107, 114, 128, 0.1)',
        label: action.toLowerCase(),
      };
  }
}

function getWarrantySeverity(
  daysRemaining: number,
): 'critical' | 'warning' | 'info' {
  if (daysRemaining <= 7) {
    return 'critical';
  }

  if (daysRemaining <= 14) {
    return 'warning';
  }

  return 'info';
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const {
    summary,
    alerts,
    recentActivity,
    equipmentBreakdown,
    replacementNeeded,
    procurementSummary,
    isLoading,
    isWarrantyAlertsLoading,
    isReplacementNeededLoading,
    error,
    fetchAll,
    fetchWarrantyAlerts,
    fetchReplacementNeeded,
    clearError,
  } = useDashboardStore();

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const totalEquipmentCount = equipmentBreakdown.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  const lowStockAlertsMapped = (alerts?.lowStock || []).map((item) => {
    const isOutOfStock = item.quantity === 0 || item.status === 'OUT_OF_STOCK';

    return {
      id: `low-stock-${item.id}`,
      severity: isOutOfStock ? 'critical' : 'warning',
      itemName: item.itemName,
      detail: isOutOfStock
        ? `Out of stock · ${item.quantity} ${item.unit} remaining (Reorder at ${item.reorderPoint})`
        : `${item.quantity} ${item.unit} remaining (Reorder at ${item.reorderPoint})`,
    };
  });

  const warrantyAlerts = alerts?.warrantyExpiring || [];
  const replacementNeededItems = replacementNeeded || [];

  const statusConfigs: Record<string, { label: string; color: string }> = {
    AVAILABLE: { label: 'Available', color: '#10b981' },
    IN_USE: { label: 'In Use', color: '#3b82f6' },
    UNDER_MAINTENANCE: { label: 'In Maintenance', color: '#f59e0b' },
    DAMAGED: { label: 'Damaged', color: '#ef4444' },
    LOST: { label: 'Lost', color: '#6b7280' },
    BORROWED: { label: 'Borrowed', color: '#8b5cf6' },
    RETIRED: { label: 'Retired', color: '#9ca3af' },
  };

  const statusesToShow = Object.keys(statusConfigs)
    .map((statusKey) => {
      const entry = equipmentBreakdown.find(
        (item) => item.status === statusKey,
      );
      const count = entry ? entry.count : 0;
      const percentage =
        totalEquipmentCount > 0 ? (count / totalEquipmentCount) * 100 : 0;

      return {
        key: statusKey,
        count,
        percentage,
        ...statusConfigs[statusKey],
      };
    })
    .filter((status) => status.count > 0 || totalEquipmentCount === 0);

  const statCards = [
    {
      label: 'Total Items',
      color: '#2563eb',
      value: summary ? summary.totalItems.toLocaleString() : null,
      subtext: 'total registered',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
          <polygon points="12 22.08 12 12 3 6.8 3 17.2 12 22.08" />
          <polygon points="12 22.08 12 12 21 6.8 21 17.2 12 22.08" />
          <polygon points="12 12 3 6.8 12 1.58 21 6.8 12 12" />
        </svg>
      ),
    },
    {
      label: 'Active Equipment',
      color: '#8b5cf6',
      value: summary ? summary.activeEquipment.toLocaleString() : null,
      subtext: 'currently available',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      label: 'Low Stock Alerts',
      color: '#d97706',
      value: summary ? summary.lowStockAlerts.toLocaleString() : null,
      subtext: 'requires reorder',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      label: 'Pending Borrows',
      color: '#0891b2',
      value: summary ? summary.pendingBorrows.toLocaleString() : null,
      subtext: 'awaiting approval',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M17 2.1l4 4-4 4" />
          <path d="M3 12.2v-2a4 4 0 014-4h14" />
          <path d="M7 21.9l-4-4 4-4" />
          <path d="M21 11.8v2a4 4 0 01-4 4H3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="dash-page animate-fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Dashboard</h1>
          <p className="dash-page-desc">
            Welcome back — here is your real-time inventory and equipment
            oversight.
          </p>
        </div>
      </div>

      {error && (
        <div className="dash-error-banner animate-fade-in">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="dash-error-msg">{error}</span>
          <button className="dash-error-close" onClick={clearError}>
            &times;
          </button>
        </div>
      )}

      <div className="dash-stats stagger-children">
        {statCards.map((stat) => (
          <div key={stat.label} className="dash-stat-card">
            <div className="dash-stat-header">
              <span className="dash-stat-label">{stat.label}</span>
              <div
                className="dash-stat-icon"
                style={{
                  background: `${stat.color}08`,
                  color: stat.color,
                }}
              >
                {stat.icon}
              </div>
            </div>

            {isLoading && !summary ? (
              <div className="dash-skeleton-wrapper">
                <div className="dash-skeleton-pulse dash-skeleton-pulse--value animate-pulse" />
              </div>
            ) : stat.value !== null ? (
              <div
                className="dash-stat-val"
                style={{ color: 'var(--text-primary)' }}
              >
                {stat.value}
              </div>
            ) : (
              <div className="dash-stat-empty-val">—</div>
            )}

            <div className="dash-stat-footer">
              {isLoading && !summary ? (
                <div className="dash-skeleton-pulse dash-skeleton-pulse--small animate-pulse" />
              ) : (
                <span className="dash-stat-subtext">{stat.subtext}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="dash-card dash-card--wide">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Recent Activity</h2>
            <button
              className="dash-card-action"
              onClick={() => navigate('/dashboard/logs')}
              disabled={recentActivity.length === 0}
            >
              View All
            </button>
          </div>

          <div
            className={
              recentActivity.length > 0
                ? 'dash-card-content'
                : 'dash-card-content-empty'
            }
          >
            {isLoading && recentActivity.length === 0 ? (
              <div className="dash-skeleton-list">
                {[1, 2, 3, 4].map((id) => (
                  <div key={id} className="dash-skeleton-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--circle" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-long" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-short" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="dash-activity-list">
                {recentActivity.map((activity) => {
                  const details = getActivityDetails(activity.action);

                  return (
                    <div key={activity.id} className="dash-activity-item">
                      <div className="dash-activity-dot-container">
                        <div
                          className="dash-activity-dot"
                          style={{ backgroundColor: details.color }}
                        />
                        <div className="dash-activity-line" />
                      </div>
                      <div className="dash-activity-info">
                        <div className="dash-activity-text">
                          <strong>
                            {activity.user.firstName}{' '}
                            {activity.user.lastName}
                          </strong>{' '}
                          <span
                            className="dash-activity-action-tag"
                            style={{
                              color: details.color,
                              background: details.bg,
                            }}
                          >
                            {details.label}
                          </span>{' '}
                          {activity.entityType.toLowerCase()} #
                          {activity.entityId}
                        </div>
                        <span className="dash-activity-time">
                          {formatRelativeTime(activity.performedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dash-empty-state">
                <div className="dash-empty-icon">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <h3 className="dash-empty-heading">No Recent Activities</h3>
                <p className="dash-empty-text">
                  Real-time audit log entries will display here as operational
                  changes occur.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Equipment Status</h2>
          </div>

          <div
            className={
              totalEquipmentCount > 0
                ? 'dash-card-content'
                : 'dash-card-content-empty'
            }
          >
            {isLoading && equipmentBreakdown.length === 0 ? (
              <div className="dash-skeleton-eq-breakdown">
                {[1, 2, 3, 4, 5].map((id) => (
                  <div key={id} className="dash-skeleton-eq-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-short" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--bar" />
                  </div>
                ))}
              </div>
            ) : totalEquipmentCount > 0 ? (
              <div className="dash-status-breakdown">
                {statusesToShow.map((status) => (
                  <div key={status.key} className="dash-status-row">
                    <div className="dash-status-info">
                      <span className="dash-status-label">{status.label}</span>
                      <span className="dash-status-count">
                        <strong>{status.count}</strong> (
                        {Math.round(status.percentage)}%)
                      </span>
                    </div>
                    <div className="dash-status-bar">
                      <div
                        className="dash-status-fill"
                        style={{
                          width: `${status.percentage}%`,
                          backgroundColor: status.color,
                          boxShadow: `0 0 8px ${status.color}30`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dash-empty-state">
                <div className="dash-empty-icon">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <h3 className="dash-empty-heading">No Registered Assets</h3>
                <p className="dash-empty-text">
                  Register trackable equipment units to begin tracking
                  operational status.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="dash-card dash-card--wide dash-procurement-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
              Procurement Summary
            </h2>
            <button
              className="dash-card-action"
              onClick={() => navigate('/dashboard/orders')}
              disabled={
                !procurementSummary ||
                procurementSummary.recentPurchaseActivity.length === 0
              }
            >
              View All
            </button>
          </div>

          <div
            className={
              procurementSummary?.recentPurchaseActivity &&
              procurementSummary.recentPurchaseActivity.length > 0
                ? 'dash-card-content'
                : 'dash-card-content-empty'
            }
          >
            {isLoading && !procurementSummary ? (
              <div className="dash-skeleton-list">
                {[1, 2, 3].map((id) => (
                  <div key={id} className="dash-skeleton-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-long" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-short" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="dash-procurement-container">
                <div className="dash-procurement-stats">
                  <div className="dash-procurement-stat">
                    <div className="dash-procurement-stat-icon dash-procurement-stat-icon--pending">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="dash-procurement-stat-info">
                      <span className="dash-procurement-stat-val">
                        {procurementSummary?.pendingOrders ?? 0}
                      </span>
                      <span className="dash-procurement-stat-label">
                        Pending Orders
                      </span>
                    </div>
                  </div>

                  <div className="dash-procurement-stat">
                    <div className="dash-procurement-stat-icon dash-procurement-stat-icon--completed">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="dash-procurement-stat-info">
                      <span className="dash-procurement-stat-val">
                        {procurementSummary?.completedOrders ?? 0}
                      </span>
                      <span className="dash-procurement-stat-label">
                        Completed Orders
                      </span>
                    </div>
                  </div>
                </div>

                <div className="dash-procurement-activity">
                  <h3 className="dash-procurement-subtitle">
                    Recent Purchase Activity
                  </h3>

                  {procurementSummary?.recentPurchaseActivity &&
                  procurementSummary.recentPurchaseActivity.length > 0 ? (
                    <div className="dash-po-list-wrapper">
                      <table className="dash-po-table">
                        <thead>
                          <tr>
                            <th>Invoice / PO</th>
                            <th>Supplier</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {procurementSummary.recentPurchaseActivity.map(
                            (po) => {
                              const color = purchaseOrderStatusColors[
                                po.status
                              ] || {
                                bg: 'rgba(107, 114, 128, 0.08)',
                                text: '#6b7280',
                              };

                              return (
                                <tr key={po.id}>
                                  <td className="dash-po-invoice">
                                    <strong>
                                      {po.invoiceNumber || `#${po.id}`}
                                    </strong>
                                    <span className="dash-po-item-count">
                                      {po.itemCount} item
                                      {po.itemCount === 1 ? '' : 's'}
                                    </span>
                                  </td>
                                  <td>{po.supplier.name}</td>
                                  <td className="dash-po-amount">
                                    {formatCurrency(po.totalAmount)}
                                  </td>
                                  <td>
                                    <span
                                      className="dash-po-status-badge"
                                      style={{
                                        backgroundColor: color.bg,
                                        color: color.text,
                                      }}
                                    >
                                      {po.status}
                                    </span>
                                  </td>
                                  <td className="dash-po-date">
                                    {formatDate(po.orderDate)}
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      className="dash-empty-state"
                      style={{ minHeight: '140px' }}
                    >
                      <div className="dash-empty-icon">
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                        >
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                        </svg>
                      </div>
                      <h4 className="dash-empty-heading">
                        No Purchase Orders Found
                      </h4>
                      <p className="dash-empty-text">
                        Recent purchasing actions and order statuses will
                        display here once recorded.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="dash-card dash-card--wide">
          <div className="dash-card-header">
            <h2 className="dash-card-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d97706"
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Low Stock Alerts
            </h2>
          </div>

          <div
            className={
              lowStockAlertsMapped.length > 0
                ? 'dash-card-content'
                : 'dash-card-content-empty'
            }
          >
            {isLoading && lowStockAlertsMapped.length === 0 ? (
              <div className="dash-skeleton-list">
                {[1, 2, 3].map((id) => (
                  <div key={id} className="dash-skeleton-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--square" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-long" />
                  </div>
                ))}
              </div>
            ) : lowStockAlertsMapped.length > 0 ? (
              <div className="dash-alerts-list">
                {lowStockAlertsMapped.map((alert) => (
                  <div
                    key={alert.id}
                    className={`dash-alert-row dash-alert-row--${alert.severity}`}
                  >
                    <div className="dash-alert-badge">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={
                          alert.severity === 'critical'
                            ? '#ef4444'
                            : '#d97706'
                        }
                        strokeWidth="2"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>

                    <div className="dash-alert-content">
                      <span className="dash-alert-itemName">
                        {alert.itemName}
                      </span>
                      <span className="dash-alert-detail">
                        {alert.detail}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dash-empty-state">
                <div className="dash-empty-icon">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <h3 className="dash-empty-heading">No Low Stock Alerts</h3>
                <p className="dash-empty-text">
                  Consumable inventory levels are currently within acceptable
                  thresholds.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Warranty Alerts
            </h2>
            <button
              className="dash-card-action"
              onClick={() => void fetchWarrantyAlerts()}
              disabled={isWarrantyAlertsLoading}
            >
              {isWarrantyAlertsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div
            className={
              warrantyAlerts.length > 0
                ? 'dash-card-content'
                : 'dash-card-content-empty'
            }
          >
            {isLoading && warrantyAlerts.length === 0 ? (
              <div className="dash-skeleton-list">
                {[1, 2, 3].map((id) => (
                  <div key={id} className="dash-skeleton-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--square" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-long" />
                  </div>
                ))}
              </div>
            ) : warrantyAlerts.length > 0 ? (
              <div className="dash-alerts-list">
                {warrantyAlerts.map((alert) => {
                  const severity = getWarrantySeverity(alert.daysRemaining);

                  return (
                    <div
                      key={alert.id}
                      className={`dash-alert-row dash-alert-row--${severity}`}
                    >
                      <div className="dash-alert-badge">
                        {severity === 'critical' && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        )}

                        {severity === 'warning' && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#d97706"
                            strokeWidth="2"
                          >
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        )}

                        {severity === 'info' && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        )}
                      </div>

                      <div className="dash-alert-content">
                        <span className="dash-alert-itemName">
                          {alert.itemName}
                        </span>
                        <span className="dash-alert-detail">
                          Warranty ends {formatDate(alert.warrantyEnd)} ·{' '}
                          {formatDaysRemaining(alert.daysRemaining)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dash-empty-state">
                <div className="dash-empty-icon">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <h3 className="dash-empty-heading">All warranties valid</h3>
                <p className="dash-empty-text">
                  No equipment warranties are nearing expiration within the next
                  30 days.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="dash-card dash-card--wide">
          <div className="dash-card-header">
            <h2 className="dash-card-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
              >
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
              Replacement Needed
            </h2>

            <div className="dash-card-actions-inline">
              <button
                className="dash-card-action"
                onClick={() => navigate('/dashboard/equipment')}
              >
                Manage Equipment
              </button>

              <button
                className="dash-card-action"
                onClick={() => void fetchReplacementNeeded()}
                disabled={isLoading || isReplacementNeededLoading}
              >
                {isReplacementNeededLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div
            className={
              replacementNeededItems.length > 0
                ? 'dash-card-content'
                : 'dash-card-content-empty'
            }
          >
            {(isLoading || isReplacementNeededLoading) &&
            replacementNeededItems.length === 0 ? (
              <div className="dash-skeleton-list">
                {[1, 2, 3].map((id) => (
                  <div key={id} className="dash-skeleton-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-long" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-short" />
                  </div>
                ))}
              </div>
            ) : replacementNeededItems.length > 0 ? (
              <div className="dash-alerts-list">
                {replacementNeededItems.map((item) => (
                  <div
                    key={item.id}
                    className="dash-alert-row dash-alert-row--critical"
                  >
                    <div className="dash-alert-badge">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>

                    <div className="dash-alert-content">
                      <span className="dash-alert-itemName">
                        {item.itemName}
                      </span>

                      <div className="dash-replacement-meta">
                        <span className="dash-condition-badge">
                          Condition: {item.condition}
                        </span>
                        <span className="dash-condition-badge dash-condition-badge--status">
                          Status: {item.status}
                        </span>
                      </div>

                      <span className="dash-alert-detail">
                        {item.replacementRecommendation}
                      </span>

                      {item.replacementReasons.length > 0 && (
                        <div className="dash-replacement-reasons">
                          {item.replacementReasons.map((reason) => (
                            <span
                              key={item.id + '-' + reason}
                              className="dash-replacement-reason-tag"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dash-empty-state">
                <div className="dash-empty-icon">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <h3 className="dash-empty-heading">No Replacement Needed</h3>
                <p className="dash-empty-text">
                  No equipment currently meets the replacement-needed threshold.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Quick Actions</h2>
          </div>

          <div className="dash-quick-actions">
            {quickActions.map((action) => (
              <button
                key={action.label}
                className={`dash-qa-btn ${
                  action.disabled ? 'dash-qa-btn--disabled' : ''
                }`}
                disabled={action.disabled}
                title={action.disabled ? 'Coming soon' : undefined}
                onClick={() => !action.disabled && navigate(action.path)}
              >
                <span
                  className="dash-qa-icon"
                  style={{
                    background: `${action.color}08`,
                    color: action.color,
                  }}
                >
                  {action.icon}
                </span>
                <span className="dash-qa-label">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnalyticsSection />
    </div>
  );
}