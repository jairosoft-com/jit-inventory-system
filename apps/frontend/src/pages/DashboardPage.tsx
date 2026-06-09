import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore.js';
import { usePolling } from '../lib/usePolling.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    summary,
    alerts,
    recentActivity,
    equipmentBreakdown,
    isLoading,
    error,
    fetchAll,
    clearError,
  } = useDashboardStore();

  // Setup periodic polling every 30 seconds
  usePolling(fetchAll, 30000);

  const totalCount = equipmentBreakdown.reduce((sum, item) => sum + item.count, 0);

  // Map activities relative time
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

  // Get color and text details for LogAction
  function getActivityDetails(action: string) {
    switch (action) {
      case 'CREATED':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', label: 'Created' };
      case 'UPDATED':
        return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', label: 'Updated' };
      case 'DELETED':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'Deleted' };
      case 'BORROWED':
        return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', label: 'Borrowed' };
      case 'RETURNED':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', label: 'Returned' };
      case 'APPROVED':
        return { color: '#059669', bg: 'rgba(5, 150, 105, 0.1)', label: 'Approved' };
      case 'REJECTED':
        return { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', label: 'Rejected' };
      case 'DISPOSED':
        return { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', label: 'Disposed' };
      case 'MAINTENANCE_STARTED':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'Maint. Start' };
      case 'MAINTENANCE_COMPLETED':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', label: 'Maint. End' };
      default:
        return { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', label: action.toLowerCase() };
    }
  }

  // Pre-process and merge alerts
  const lowStockAlertsMapped = (alerts?.lowStock || []).map((item) => {
    const isOutOfStock = item.quantity === 0 || item.status === 'OUT_OF_STOCK';
    return {
      id: `low-stock-${item.id}`,
      type: 'low_stock',
      severity: isOutOfStock ? 'critical' : 'warning',
      itemName: item.itemName,
      detail: isOutOfStock
        ? 'Out of stock'
        : `${item.quantity} ${item.unit} remaining (Reorder at ${item.reorderPoint})`,
    };
  });

  const warrantyAlertsMapped = (alerts?.warrantyExpiring || []).map((item) => {
    const expiryDate = item.warrantyEnd ? new Date(item.warrantyEnd) : null;
    const dateFormatted = expiryDate
      ? expiryDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    return {
      id: `warranty-${item.id}`,
      type: 'warranty',
      severity: 'info',
      itemName: item.itemName,
      detail: `Warranty expires ${dateFormatted} (Asset: ${item.assetId})`,
    };
  });

  const mergedAlerts = [...lowStockAlertsMapped, ...warrantyAlertsMapped];
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  mergedAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Equipment Breakdown config
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
      const entry = equipmentBreakdown.find((item) => item.status === statusKey);
      const count = entry ? entry.count : 0;
      const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
      return {
        key: statusKey,
        count,
        percentage,
        ...statusConfigs[statusKey],
      };
    })
    .filter((status) => status.count > 0 || totalCount === 0);

  const statCards = [
    {
      label: 'Total Items',
      color: '#2563eb',
      value: summary ? summary.totalItems.toLocaleString() : null,
      subtext: 'total registered',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 2.1l4 4-4 4" />
          <path d="M3 12.2v-2a4 4 0 0 1 4-4h14" />
          <path d="M7 21.9l-4-4 4-4" />
          <path d="M21 11.8v2a4 4 0 0 1-4 4H3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="dash-page animate-fade-in">
      {/* Page Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Dashboard</h1>
          <p className="dash-page-desc">
            Welcome back — here is your real-time inventory and equipment oversight.
          </p>
        </div>
        <div className="dash-page-actions">
          <button className="dash-btn dash-btn--primary" onClick={() => navigate('/dashboard/inventory')}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Item
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="dash-error-banner animate-fade-in">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* KPI Cards */}
      <div className="dash-stats stagger-children">
        {statCards.map((stat) => (
          <div key={stat.label} className="dash-stat-card">
            <div className="dash-stat-header">
              <span className="dash-stat-label">{stat.label}</span>
              <div
                className="dash-stat-icon"
                style={{ background: `${stat.color}08`, color: stat.color }}
              >
                {stat.icon}
              </div>
            </div>
            {isLoading && !summary ? (
              <div className="dash-skeleton-wrapper">
                <div className="dash-skeleton-pulse dash-skeleton-pulse--value animate-pulse" />
              </div>
            ) : stat.value !== null ? (
              <div className="dash-stat-val" style={{ color: 'var(--text-primary)' }}>
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

      {/* Main Grid Layout */}
      <div className="dash-grid">
        {/* Recent Activity Card */}
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

          <div className={recentActivity.length > 0 ? 'dash-card-content' : 'dash-card-content-empty'}>
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
                        <div className="dash-activity-dot" style={{ backgroundColor: details.color }} />
                        <div className="dash-activity-line" />
                      </div>
                      <div className="dash-activity-info">
                        <div className="dash-activity-text">
                          <strong>
                            {activity.user.firstName} {activity.user.lastName}
                          </strong>{' '}
                          <span
                            className="dash-activity-action-tag"
                            style={{ color: details.color, background: details.bg }}
                          >
                            {details.label}
                          </span>{' '}
                          {activity.entityType.toLowerCase()} #{activity.entityId}
                        </div>
                        <span className="dash-activity-time">{formatRelativeTime(activity.performedAt)}</span>
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
                  Real-time audit log entries will display here as operational changes occur.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Equipment Status Breakdown */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Equipment Status</h2>
          </div>

          <div className={totalCount > 0 ? 'dash-card-content' : 'dash-card-content-empty'}>
            {isLoading && equipmentBreakdown.length === 0 ? (
              <div className="dash-skeleton-eq-breakdown">
                {[1, 2, 3, 4, 5].map((id) => (
                  <div key={id} className="dash-skeleton-eq-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-short" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--bar" />
                  </div>
                ))}
              </div>
            ) : totalCount > 0 ? (
              <div className="dash-status-breakdown">
                {statusesToShow.map((status) => (
                  <div key={status.key} className="dash-status-row">
                    <div className="dash-status-info">
                      <span className="dash-status-label">{status.label}</span>
                      <span className="dash-status-count">
                        <strong>{status.count}</strong> ({Math.round(status.percentage)}%)
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
                  Register trackable equipment units to begin tracking operational status.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock & Warranty Alerts Card */}
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
              Alerts & Low Stock
            </h2>
            <button className="dash-card-action" onClick={() => navigate('/dashboard/inventory')}>
              Manage
            </button>
          </div>

          <div className={mergedAlerts.length > 0 ? 'dash-card-content' : 'dash-card-content-empty'}>
            {isLoading && mergedAlerts.length === 0 ? (
              <div className="dash-skeleton-list">
                {[1, 2, 3].map((id) => (
                  <div key={id} className="dash-skeleton-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-long" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-short" />
                  </div>
                ))}
              </div>
            ) : mergedAlerts.length > 0 ? (
              <div className="dash-alerts-list">
                {mergedAlerts.map((alert) => (
                  <div key={alert.id} className={`dash-alert-row dash-alert-row--${alert.severity}`}>
                    <div className="dash-alert-badge">
                      {alert.severity === 'critical' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      )}
                      {alert.severity === 'warning' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      )}
                      {alert.severity === 'info' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      )}
                    </div>
                    <div className="dash-alert-content">
                      <span className="dash-alert-itemName">{alert.itemName}</span>
                      <span className="dash-alert-detail">{alert.detail}</span>
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
                    <path d="M20 7H4a1 1 0 00-1 1v12a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1z" />
                    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                  </svg>
                </div>
                <h3 className="dash-empty-heading">No Alerts Active</h3>
                <p className="dash-empty-text">
                  Low stock notifications and warranty expirations will appear here when triggered.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Quick Actions</h2>
          </div>
          <div className="dash-quick-actions">
            {[
              { label: 'Register Item', color: '#2563eb', icon: '+', path: '/dashboard/inventory' },
              { label: 'Stock In', color: '#16a34a', icon: '↓', path: '/dashboard/inventory' },
              { label: 'Stock Out', color: '#dc2626', icon: '↑', path: '/dashboard/inventory' },
              { label: 'New PO', color: '#8b5cf6', icon: '📋', path: '/dashboard/orders' },
              { label: 'Borrow Request', color: '#d97706', icon: '🔄', path: '/dashboard/borrow' },
              { label: 'Run Report', color: '#0891b2', icon: '📊', path: '/dashboard/logs' },
            ].map((action) => (
              <button
                key={action.label}
                className="dash-qa-btn"
                onClick={() => navigate(action.path)}
              >
                <span
                  className="dash-qa-icon"
                  style={{ background: `${action.color}08`, color: action.color }}
                >
                  {action.icon}
                </span>
                <span className="dash-qa-label">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        /* ── Dashboard Page ──────────────────── */

        .dash-page {
          max-width: 1400px;
        }

        /* ── Page Header ─────────────────────── */

        .dash-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 28px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .dash-page-title {
          font-size: 26px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          letter-spacing: -0.03em;
        }

        .dash-page-desc {
          font-size: 13.5px;
          color: var(--text-secondary);
          margin: 4px 0 0;
        }

        .dash-page-actions {
          display: flex;
          gap: 10px;
        }

        /* ── Error Banner ───────────────────── */

        .dash-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: var(--radius-md);
          color: #ef4444;
          font-size: 13.5px;
          margin-bottom: 24px;
        }

        .dash-error-msg {
          flex: 1;
        }

        .dash-error-close {
          background: none;
          border: none;
          color: inherit;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        /* ── Buttons ─────────────────────────── */

        .dash-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition-fast);
          border: none;
        }

        .dash-btn--primary {
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
        }
        .dash-btn--primary:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-glow);
        }

        .dash-btn--secondary {
          background: var(--surface);
          color: var(--text-secondary);
          border: 1px solid var(--surface-border);
        }
        .dash-btn--secondary:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
          border-color: var(--surface-border-hover);
        }

        /* ── KPI Stats Grid ──────────────────── */

        .dash-stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .dash-stat-card {
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          transition: all var(--transition-fast);
        }
        .dash-stat-card:hover {
          border-color: var(--surface-border-hover);
          box-shadow: var(--shadow-md);
        }

        .dash-stat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .dash-stat-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .dash-stat-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
        }

        .dash-stat-val {
          font-size: 28px;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 8px;
        }

        .dash-stat-empty-val {
          font-size: 26px;
          font-weight: 700;
          color: var(--text-disabled);
          line-height: 1.2;
          margin-bottom: 8px;
        }

        .dash-stat-footer {
          margin-top: auto;
          min-height: 14px;
        }

        .dash-stat-subtext {
          font-size: 11px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        /* ── Content Grid ────────────────────── */

        .dash-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 20px;
        }

        @media (max-width: 1024px) {
          .dash-grid {
            grid-template-columns: 1fr;
          }
        }

        /* ── Cards ───────────────────────────── */

        .dash-card {
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
        }

        .dash-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .dash-card-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dash-card-action {
          background: none;
          border: none;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          cursor: pointer;
          padding: 0;
          transition: color var(--transition-fast);
        }
        .dash-card-action:hover:not(:disabled) {
          color: var(--accent-hover);
        }
        .dash-card-action:disabled {
          color: var(--text-disabled);
          cursor: not-allowed;
        }

        .dash-card-content {
          min-height: 200px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }

        .dash-card-content-empty {
          min-height: 200px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        /* ── Empty State ─────────────────────── */

        .dash-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 24px 16px;
        }

        .dash-empty-icon {
          color: var(--text-disabled);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dash-empty-heading {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 0 0 6px;
        }

        .dash-empty-text {
          font-size: 12px;
          color: var(--text-tertiary);
          max-width: 280px;
          margin: 0;
          line-height: 1.5;
        }

        /* ── Alerts Panel ────────────────────── */

        .dash-alerts-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .dash-alert-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          transition: all var(--transition-fast);
        }

        .dash-alert-row--critical {
          background: rgba(239, 68, 68, 0.04);
          border-color: rgba(239, 68, 68, 0.12);
        }

        .dash-alert-row--warning {
          background: rgba(217, 119, 6, 0.04);
          border-color: rgba(217, 119, 6, 0.12);
        }

        .dash-alert-row--info {
          background: rgba(37, 99, 235, 0.04);
          border-color: rgba(37, 99, 235, 0.12);
        }

        .dash-alert-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .dash-alert-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .dash-alert-itemName {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .dash-alert-detail {
          font-size: 12px;
          color: var(--text-secondary);
        }

        /* ── Recent Activity ─────────────────── */

        .dash-activity-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .dash-activity-item {
          display: flex;
          gap: 16px;
          position: relative;
        }

        .dash-activity-dot-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          width: 12px;
          flex-shrink: 0;
        }

        .dash-activity-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          z-index: 1;
          margin-top: 6px;
        }

        .dash-activity-line {
          position: absolute;
          top: 14px;
          bottom: -14px;
          width: 2px;
          background: var(--surface-border);
        }

        .dash-activity-item:last-child .dash-activity-line {
          display: none;
        }

        .dash-activity-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-bottom: 16px;
          flex: 1;
        }

        .dash-activity-text {
          font-size: 13px;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .dash-activity-action-tag {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: var(--radius-sm);
          display: inline-block;
          text-transform: uppercase;
        }

        .dash-activity-time {
          font-size: 11.5px;
          color: var(--text-tertiary);
        }

        /* ── Equipment Breakdown ─────────────── */

        .dash-status-breakdown {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .dash-status-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .dash-status-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12.5px;
        }

        .dash-status-label {
          font-weight: 600;
          color: var(--text-primary);
        }

        .dash-status-count {
          color: var(--text-secondary);
        }

        .dash-status-bar {
          height: 6px;
          background: var(--background-tertiary);
          border-radius: var(--radius-full);
          overflow: hidden;
          position: relative;
        }

        .dash-status-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* ── Skeletons ───────────────────────── */

        .dash-skeleton-pulse {
          background: var(--background-tertiary);
          border-radius: var(--radius-sm);
        }

        .dash-skeleton-pulse--square {
          width: 16px;
          height: 16px;
        }

        .dash-skeleton-pulse--circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }

        .dash-skeleton-pulse--value {
          width: 80px;
          height: 28px;
          margin-bottom: 8px;
        }

        .dash-skeleton-pulse--small {
          width: 120px;
          height: 12px;
        }

        .dash-skeleton-pulse--text-long {
          flex: 1;
          height: 14px;
        }

        .dash-skeleton-pulse--text-short {
          width: 60px;
          height: 14px;
        }

        .dash-skeleton-pulse--bar {
          flex: 1;
          height: 8px;
          border-radius: var(--radius-full);
        }

        .dash-skeleton-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .dash-skeleton-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dash-skeleton-eq-breakdown {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .dash-skeleton-eq-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* ── Quick Actions ───────────────────── */

        .dash-quick-actions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .dash-qa-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: var(--background-secondary);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: inherit;
        }
        .dash-qa-btn:hover {
          background: var(--surface-hover);
          border-color: var(--surface-border-hover);
          transform: translateY(-1px);
        }

        .dash-qa-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          font-size: 15px;
          flex-shrink: 0;
        }

        .dash-qa-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
