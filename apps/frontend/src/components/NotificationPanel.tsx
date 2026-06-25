import { useEffect, useRef } from 'react';
import { useNotificationStore } from '../store/notificationStore';

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationPanel() {
  const { notifications, isLoading, isOpen, togglePanel, closePanel, resolveNotification } =
    useNotificationStore();

  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isResolved).length;

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closePanel]);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button className="dash-topbar-btn" onClick={togglePanel} title="Notifications">
        <IconBell />
        {unreadCount > 0 && (
          <span className="dash-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '360px',
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-md)',
          zIndex: 100,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--surface-border)',
          }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'var(--accent-muted)',
                padding: '2px 8px',
                borderRadius: '99px',
              }}>
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--surface-border)',
                    background: n.isResolved ? 'transparent' : 'var(--background-tertiary)',
                    opacity: n.isResolved ? 0.6 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {/* Type indicator dot */}
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    marginTop: '5px',
                    flexShrink: 0,
                    background: n.type === 'BORROW_OVERDUE'
                      ? 'var(--danger)'
                      : 'var(--success, #16a34a)',
                  }} />

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: '0 0 4px',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      lineHeight: 1.4,
                    }}>
                      {n.message}
                    </p>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>

                  {/* Resolve button */}
                  {!n.isResolved && (
                    <button
                      onClick={() => void resolveNotification(n.id)}
                      title="Mark as resolved"
                      style={{
                        flexShrink: 0,
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface)',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--success, #16a34a)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'white';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--surface-border)';
                      }}
                    >
                      <IconCheck />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}