import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlertStore, InventoryAlert } from '../store/alertStore';

interface GroupedAlert {
  key: string;
  label: string;
  count: number;
  priority: 'WARNING' | 'CRITICAL';
  alertType: 'WARRANTY_EXPIRING' | 'REPLACEMENT_NEEDED';
}

function groupEquipmentAlerts(alerts: InventoryAlert[]): GroupedAlert[] {
  const groups = new Map<string, GroupedAlert>();

  for (const alert of alerts) {
    if (alert.alertType !== 'WARRANTY_EXPIRING' && alert.alertType !== 'REPLACEMENT_NEEDED') continue;
    if (!alert.equipment) continue;

    const categoryName = alert.equipment.item.category?.name || 'Equipment';
    const key = `${alert.alertType}:${categoryName}`;
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      if (alert.priority === 'CRITICAL') existing.priority = 'CRITICAL';
    } else {
      const label =
        alert.alertType === 'WARRANTY_EXPIRING'
          ? `${categoryName} expiring in 30 days`
          : `${categoryName} tagged for replacement`;
      groups.set(key, {
        key,
        label,
        count: 1,
        priority: alert.priority as 'WARNING' | 'CRITICAL',
        alertType: alert.alertType,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

export default function EquipmentLifecycleAlertsWidget() {
  const navigate = useNavigate();
  const { alerts, isLoading, fetchUnread } = useAlertStore();

  useEffect(() => {
    void fetchUnread();
  }, [fetchUnread]);

  const groups = useMemo(() => groupEquipmentAlerts(alerts), [alerts]);

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Equipment Lifecycle Alerts
        </h2>
      </div>

      <div className={groups.length > 0 ? 'dash-card-content' : 'dash-card-content-empty'}>
        {isLoading && groups.length === 0 ? (
          <div className="dash-skeleton-list">
            {[1, 2].map((id) => (
              <div key={id} className="dash-skeleton-row animate-pulse">
                <div className="dash-skeleton-pulse dash-skeleton-pulse--square" />
                <div className="dash-skeleton-pulse dash-skeleton-pulse--text-long" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="dash-empty-state">
            <h3 className="dash-empty-heading">No active lifecycle alerts</h3>
            <p className="dash-empty-text">
              Warranties are current and no equipment is tagged for replacement.
            </p>
          </div>
        ) : (
          <div className="dash-alerts-list">
            {groups.map((group) => (
              <div
                key={group.key}
                className={`dash-alert-row dash-alert-row--${group.priority.toLowerCase()}`}
                onClick={() => navigate('/dashboard/equipment')}
                style={{ cursor: 'pointer' }}
              >
                <div className="dash-alert-badge">{group.count}</div>
                <div className="dash-alert-content">
                  <span className="dash-alert-itemName">
                    {group.count} {group.label}
                  </span>
                  <span className="dash-alert-detail">
                    {group.alertType === 'WARRANTY_EXPIRING' ? 'Warranty expiration' : 'Replacement tag'} · Click to review
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}