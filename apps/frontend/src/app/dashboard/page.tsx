'use client';

import { useState } from 'react';

export default function DashboardPage() {
  // Skeleton states
  const [isLoading, setIsLoading] = useState(false);

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
          <button className="dash-btn dash-btn--secondary" onClick={() => setIsLoading(!isLoading)}>
            {isLoading ? 'Loaded State' : 'Simulate Loading'}
          </button>
          <button className="dash-btn dash-btn--primary">
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

      {/* KPI Cards — Pure Visual Skeletons */}
      <div className="dash-stats">
        {[
          { label: 'Total Items', color: '#2563eb' },
          { label: 'Active Equipment', color: '#8b5cf6' },
          { label: 'Low Stock Alerts', color: '#d97706' },
          { label: 'Pending Borrows', color: '#0891b2' },
        ].map((stat) => (
          <div key={stat.label} className="dash-stat-card">
            <div className="dash-stat-header">
              <span className="dash-stat-label">{stat.label}</span>
              <div
                className="dash-stat-icon"
                style={{ background: `${stat.color}08`, color: stat.color }}
              >
                <div className="dash-skeleton-pulse dash-skeleton-pulse--square" />
              </div>
            </div>
            {isLoading ? (
              <div className="dash-skeleton-wrapper">
                <div className="dash-skeleton-pulse dash-skeleton-pulse--value animate-pulse" />
              </div>
            ) : (
              <div className="dash-stat-empty-val">—</div>
            )}
            <div className="dash-stat-footer">
              <div className="dash-skeleton-pulse dash-skeleton-pulse--small animate-pulse" />
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
            <button className="dash-card-action" disabled>
              View All
            </button>
          </div>

          <div className="dash-card-content-empty">
            {isLoading ? (
              <div className="dash-skeleton-list">
                {[1, 2, 3, 4].map((id) => (
                  <div key={id} className="dash-skeleton-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--circle" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-long" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-short" />
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

          <div className="dash-card-content-empty">
            {isLoading ? (
              <div className="dash-skeleton-eq-breakdown">
                {[1, 2, 3, 4, 5].map((id) => (
                  <div key={id} className="dash-skeleton-eq-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-short" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--bar" />
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

        {/* Low Stock Items Card */}
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
              Low Stock Items
            </h2>
            <button className="dash-card-action" disabled>
              Manage
            </button>
          </div>

          <div className="dash-card-content-empty">
            {isLoading ? (
              <div className="dash-skeleton-list">
                {[1, 2, 3].map((id) => (
                  <div key={id} className="dash-skeleton-row animate-pulse">
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-long" />
                    <div className="dash-skeleton-pulse dash-skeleton-pulse--text-short" />
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
                <h3 className="dash-empty-heading">All Items Fully Stocked</h3>
                <p className="dash-empty-text">
                  Low stock warnings and reorder targets will display here when stock drops.
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
              { label: 'Register Item', color: '#2563eb', icon: '+' },
              { label: 'Stock In', color: '#16a34a', icon: '↓' },
              { label: 'Stock Out', color: '#dc2626', icon: '↑' },
              { label: 'New PO', color: '#8b5cf6', icon: '📋' },
              { label: 'Borrow Request', color: '#d97706', icon: '🔄' },
              { label: 'Run Report', color: '#0891b2', icon: '📊' },
            ].map((action) => (
              <button key={action.label} className="dash-qa-btn">
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
