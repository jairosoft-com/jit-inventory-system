import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import NotificationPanel from '../components/NotificationPanel';

/* ------ SVG Icon Components (inline for skeleton) ------ */

function IconDashboard() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
    </svg>
  );
}

function IconInventory() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M20 7H4a1 1 0 00-1 1v12a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1z" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <path d="M12 12v4M10 14h4" />
    </svg>
  );
}

function IconCategories() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconEquipment() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function IconBorrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M8 7h12l-2 13H6L4 3H1" />
      <circle cx="10" cy="21" r="1" />
      <circle cx="18" cy="21" r="1" />
    </svg>
  );
}

function IconSuppliers() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function IconMaintenance() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLogs() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function IconChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
        transition: 'transform var(--transition-fast)',
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ------ Navigation config ------ */

const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: IconDashboard },
      { name: 'Inventory', href: '/dashboard/inventory', icon: IconInventory },
      { name: 'Categories', href: '/dashboard/categories', icon: IconCategories },
      { name: 'Equipment', href: '/dashboard/equipment', icon: IconEquipment },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Borrow Requests', href: '/dashboard/borrow', icon: IconBorrow },
      { name: 'Purchase Orders', href: '/dashboard/orders', icon: IconOrders },
      { name: 'Suppliers', href: '/dashboard/suppliers', icon: IconSuppliers },
      { name: 'Maintenance', href: '/dashboard/maintenance', icon: IconMaintenance },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { name: 'Users & Roles', href: '/dashboard/users', icon: IconUsers },
      { name: 'Audit Logs', href: '/dashboard/logs', icon: IconLogs },
    ],
  },
];

function formatRoleName(roleName?: string | null) {
  if (!roleName) {
    return 'User';
  }

  return roleName
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(Math.floor(totalSeconds), 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isLoading, checkAuth, logout, authCheckStatus, authRetryAfterSeconds } =
    useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const hasCheckedAuthRef = useRef(false);

  useEffect(() => {
    if (hasCheckedAuthRef.current) {
      return;
    }

    hasCheckedAuthRef.current = true;
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !user && authCheckStatus === 401) {
      navigate('/');
    }
  }, [user, isLoading, authCheckStatus, navigate]);

  useEffect(() => {
    if (authCheckStatus === 429) {
      setRetryCountdown(authRetryAfterSeconds ?? 15 * 60);
      return;
    }

    setRetryCountdown(0);
  }, [authCheckStatus, authRetryAfterSeconds]);

  useEffect(() => {
    if (retryCountdown <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRetryCountdown((currentCountdown) => Math.max(currentCountdown - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [retryCountdown]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleRetryAuthCheck = () => {
    if (retryCountdown > 0 || isLoading) {
      return;
    }

    void checkAuth();
  };

  if (isLoading) {
    return (
      <div
        className="dash-layout"
        style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}
      >
        <span
          className="login-spinner"
          style={{
            width: '40px',
            height: '40px',
            borderColor: 'rgba(37,99,235,0.1)',
            borderTopColor: '#2563eb',
          }}
        />
      </div>
    );
  }

  if (authCheckStatus && authCheckStatus !== 401) {
    const isRateLimited = authCheckStatus === 429;

    return (
      <div
        className="dash-layout"
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '24px',
        }}
      >
        <section
          style={{
            width: '100%',
            maxWidth: '480px',
            border: '1px solid var(--surface-border)',
            borderRadius: '16px',
            background: 'var(--surface)',
            padding: '24px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <h1
            style={{
              margin: '0 0 8px',
              color: 'var(--text-primary)',
              fontSize: '1.25rem',
              fontWeight: 700,
            }}
          >
            Please wait before retrying
          </h1>

          <p
            style={{
              margin: '0 0 16px',
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
              lineHeight: 1.6,
            }}
          >
            {isRateLimited
              ? 'Too many session checks were sent. Please wait for the backend cooldown before trying again.'
              : 'The system could not verify your session right now. Please try again in a moment.'}
          </p>

          {retryCountdown > 0 && (
            <p
              style={{
                margin: '0 0 16px',
                color: 'var(--text-tertiary)',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              Retry available in {formatCountdown(retryCountdown)}.
            </p>
          )}

          <button
            type="button"
            onClick={handleRetryAuthCheck}
            disabled={isLoading || retryCountdown > 0}
            style={{
              border: 0,
              borderRadius: '10px',
              background: 'var(--accent)',
              color: '#ffffff',
              cursor: isLoading || retryCountdown > 0 ? 'not-allowed' : 'pointer',
              font: 'inherit',
              fontWeight: 700,
              opacity: isLoading || retryCountdown > 0 ? 0.65 : 1,
              padding: '10px 14px',
            }}
          >
            {isLoading
              ? 'Checking...'
              : retryCountdown > 0
                ? `Retry in ${formatCountdown(retryCountdown)}`
                : 'Retry Session Check'}
          </button>
        </section>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getInitials = () => {
    if (!user) return '';
    const f = user.firstName?.[0] || '';
    const l = user.lastName?.[0] || '';
    return (f + l).toUpperCase();
  };

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <aside className={`dash-sidebar ${collapsed ? 'dash-sidebar--collapsed' : ''}`}>
        {/* Sidebar header */}
        <div className="dash-sidebar-header">
          {!collapsed && (
            <div className="dash-sidebar-brand">
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="url(#sb-grad)" />
                <path d="M12 14h16v2H12zm0 5h12v2H12zm0 5h14v2H12z" fill="white" opacity="0.95" />
                <defs>
                  <linearGradient id="sb-grad" x1="0" y1="0" x2="40" y2="40">
                    <stop stopColor="#2563eb" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="dash-sidebar-title">JIT IMS</span>
            </div>
          )}
          <button
            className="dash-sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconChevron collapsed={collapsed} />
          </button>
        </div>

        {/* Nav sections */}
        <nav className="dash-sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="dash-nav-section">
              {!collapsed && <span className="dash-nav-label">{section.label}</span>}
              <ul className="dash-nav-list">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.name}>
                      <button
                        className={`dash-nav-item ${isActive ? 'dash-nav-item--active' : ''}`}
                        onClick={() => navigate(item.href)}
                        title={collapsed ? item.name : undefined}
                      >
                        <item.icon />
                        {!collapsed && <span>{item.name}</span>}
                        {isActive && <div className="dash-nav-indicator" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="dash-sidebar-footer">
          {!collapsed && (
            <div className="dash-user-info">
              <div className="dash-avatar">{getInitials()}</div>
              <div className="dash-user-meta">
                <span className="dash-user-name">{`${user.firstName} ${user.lastName}`}</span>
                <span className="dash-user-role">{formatRoleName(user.role?.name)}</span>
              </div>
            </div>
          )}
          <button className="dash-logout-btn" onClick={handleLogout} title="Sign out">
            <IconLogout />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dash-main">
        {/* Top bar */}
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <div className="dash-search-wrapper">
              <svg
                className="dash-search-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="global-search"
                type="text"
                placeholder="Search inventory, equipment, orders"
                className="dash-search-input"
              />
              <kbd className="dash-search-kbd"></kbd>
            </div>
          </div>
          <div className="dash-topbar-right">
  <NotificationPanel />
</div>
        </header>

        {/* Page content */}
        <div className="dash-content">
          <Outlet />
        </div>
      </main>

      <style>{`
        /* ------ Dashboard Shell ------ */

        .dash-layout {
          display: flex;
          min-height: 100vh;
          background: var(--background);
        }

        /* ------ Sidebar -------------- */

        .dash-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: var(--sidebar-width);
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          z-index: 40;
          transition: width var(--transition-base);
        }
        .dash-sidebar--collapsed {
          width: 68px;
        }

        .dash-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 16px 16px;
          border-bottom: 1px solid var(--sidebar-border);
        }

        .dash-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          animation: slideInLeft 0.3s ease;
        }

        .dash-sidebar-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .dash-sidebar-toggle {
          background: none;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .dash-sidebar-toggle:hover {
          background: var(--sidebar-hover);
          color: var(--text-secondary);
          border-color: var(--surface-border-hover);
        }

        /* ------ Navigation ------ */

        .dash-sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 12px 8px;
        }

        .dash-nav-section {
          margin-bottom: 20px;
        }

        .dash-nav-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: var(--text-tertiary);
          letter-spacing: 0.1em;
          padding: 0 12px;
          margin-bottom: 6px;
        }

        .dash-nav-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .dash-nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 13.5px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-fast);
        }
        .dash-nav-item:hover {
          background: var(--sidebar-hover);
          color: var(--text-primary);
        }
        .dash-nav-item--active {
          background: var(--sidebar-active);
          color: var(--accent);
          font-weight: 600;
        }

        .dash-nav-indicator {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 18px;
          background: var(--accent);
          border-radius: var(--radius-full);
        }

        /* ------ Sidebar Footer ------ */

        .dash-sidebar-footer {
          border-top: 1px solid var(--sidebar-border);
          padding: 12px;
        }

        .dash-user-info {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          margin-bottom: 8px;
          border-radius: var(--radius-md);
          background: var(--background-tertiary);
        }

        .dash-avatar {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-sm);
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .dash-user-meta {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .dash-user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dash-user-role {
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .dash-logout-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-tertiary);
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .dash-logout-btn:hover {
          background: var(--danger-muted);
          color: var(--danger);
        }

        /* ------ Main Content ------ */

        .dash-main {
          flex: 1;
          margin-left: var(--sidebar-width);
          display: flex;
          flex-direction: column;
          transition: margin-left var(--transition-base);
        }
        .dash-sidebar--collapsed ~ .dash-main {
          margin-left: 68px;
        }

        /* ------ Top Bar ------ */

        .dash-topbar {
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
          padding: 0 28px;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--surface-border);
        }

        .dash-topbar-left {
          flex: 1;
          max-width: 480px;
        }

        .dash-search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .dash-search-icon {
          position: absolute;
          left: 12px;
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .dash-search-input {
          width: 100%;
          height: 36px;
          padding: 0 60px 0 36px;
          background: var(--background-tertiary);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 13px;
          font-family: inherit;
          transition: all var(--transition-fast);
        }
        .dash-search-input::placeholder {
          color: var(--text-tertiary);
        }
        .dash-search-input:focus {
          outline: none;
          background: var(--surface);
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-muted);
        }

        .dash-search-kbd {
          position: absolute;
          right: 10px;
          padding: 2px 6px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 4px;
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .dash-topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dash-topbar-btn {
          position: relative;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .dash-topbar-btn:hover {
          background: var(--sidebar-hover);
          color: var(--text-primary);
          border-color: var(--surface-border-hover);
        }

        .dash-notif-badge {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 16px;
          height: 16px;
          background: var(--danger);
          color: white;
          font-size: 9px;
          font-weight: 700;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--sidebar-bg);
        }

        /* ------ Page Content Area ------ */

        .dash-content {
          flex: 1;
          padding: 28px;
        }
      `}</style>
    </div>
  );
}
