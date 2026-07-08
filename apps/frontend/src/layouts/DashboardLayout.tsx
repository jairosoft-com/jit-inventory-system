import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  useAlertStore,
  ALERT_POLL_INTERVAL_MS,
  type AlertCategoryFilter,
} from "../store/alertStore";
import { useProcurementAlertStore } from "../store/procurementAlertStore";
import { usePolling } from "../lib/usePolling";

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

function IconInventoryMgmt() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
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
      <line
        x1="7"
        y1="7"
        x2="7.01"
        y2="7"
        strokeWidth="2"
        strokeLinecap="round"
      />
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

function IconBorrowHistory() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
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

function IconReports() {
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
        transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
        transition: "transform var(--transition-fast)",
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconChevronSmall({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform var(--transition-fast)",
        flexShrink: 0,
        marginLeft: "auto",
        opacity: 0.6,
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ------ Navigation config ------ */

const INV_MGMT_ITEMS = [
  {
    name: "Items",
    href: "/dashboard/inventory",
    icon: IconInventory,
    requiredPermission: "inventory:read",
  },
  {
    name: "Categories",
    href: "/dashboard/categories",
    icon: IconCategories,
    requiredPermission: "categories:create",
  },
  {
    name: "Equipment",
    href: "/dashboard/equipment",
    icon: IconEquipment,
    requiredPermission: "equipment:read",
  },
  {
    name: "Borrow Requests",
    href: "/dashboard/borrow",
    icon: IconBorrow,
    requiredPermission: "borrow:read",
  },
  {
    name: "Purchase Orders",
    href: "/dashboard/orders",
    icon: IconOrders,
    requiredPermission: "purchase_orders:read",
  },
  {
    name: "Suppliers",
    href: "/dashboard/suppliers",
    icon: IconSuppliers,
    requiredPermission: "suppliers:create",
  },
  {
    name: "Maintenance",
    href: "/dashboard/maintenance",
    icon: IconMaintenance,
    requiredPermission: "maintenance:read",
  },
];

const ADMIN_ITEMS = [
  {
    name: "Users & Roles",
    href: "/dashboard/users",
    icon: IconUsers,
    requiredPermission: "users:read",
  },
  {
    name: "Audit Logs",
    href: "/dashboard/logs",
    icon: IconLogs,
    requiredPermission: "audit_logs:read",
  },
  {
    name: "Reports",
    href: "/dashboard/reports",
    icon: IconReports,
    requiredPermission: "reports:export",
  },
];

function formatRoleName(roleName?: string | null) {
  if (!roleName) {
    return "User";
  }

  return roleName
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(Math.floor(totalSeconds), 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    user,
    isLoading,
    checkAuth,
    logout,
    authCheckStatus,
    authRetryAfterSeconds,
  } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const invMgmtChildActive = INV_MGMT_ITEMS.some(
    (item) => pathname === item.href,
  );
  const [invMgmtOpen, setInvMgmtOpen] = useState(invMgmtChildActive);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [notifView, setNotifView] = useState<"current" | "history">("current");
  const [notifCategory, setNotifCategory] =
    useState<AlertCategoryFilter>("ALL");
  const hasCheckedAuthRef = useRef(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const permissions = useMemo(() => {
    if (!user || !user.permissions) return [];
    return user.permissions.map((p) =>
      typeof p === "string" ? p : p.name || "",
    );
  }, [user]);

  const hasPermission = (requiredPermission?: string) => {
    if (!requiredPermission) return true;
    if (user?.role?.name === "ADMIN") return true;
    return permissions.includes(requiredPermission);
  };

  const {
    unreadCount,
    alerts,
    historyAlerts,
    isOpen: notifOpen,
    isLoading: notifLoading,
    isHistoryLoading,
    historyError,
    fetchUnreadCount,
    fetchUnread,
    fetchHistory,
    scanAlerts,
    markAsRead,
    markAllAsRead,
    toggleOpen,
    close: closeNotif,
  } = useAlertStore();

  const {
    alerts: procurementAlerts,
    historyAlerts: procurementHistoryAlerts,
    unreadCount: procurementUnreadCount,
    isHistoryLoading: isProcurementHistoryLoading,
    historyError: procurementHistoryError,
    fetchUnread: fetchProcurementUnread,
    fetchHistory: fetchProcurementHistory,
    markAsRead: markProcurementAsRead,
    markAllAsRead: markAllProcurementAsRead,
  } = useProcurementAlertStore();

  // Poll badge count every 60s
  usePolling(fetchUnreadCount, ALERT_POLL_INTERVAL_MS, !!user);
  usePolling(fetchProcurementUnread, ALERT_POLL_INTERVAL_MS, !!user);

  // Close notification panel on click outside
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        closeNotif();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen, closeNotif]);

  useEffect(() => {
    if (invMgmtChildActive) {
      setInvMgmtOpen(true);
    }
  }, [invMgmtChildActive]);

  // Close the mobile off-canvas sidebar whenever the route changes, so
  // tapping a nav item on a phone navigates and dismisses the drawer.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!notifOpen || notifView !== "history") {
      return;
    }

    void Promise.all([
      fetchHistory({ category: notifCategory }),
      fetchProcurementHistory({ category: notifCategory }),
    ]);
  }, [
    fetchHistory,
    fetchProcurementHistory,
    notifCategory,
    notifOpen,
    notifView,
  ]);

  useEffect(() => {
    if (hasCheckedAuthRef.current) {
      return;
    }

    hasCheckedAuthRef.current = true;
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !user && authCheckStatus === 401) {
      navigate("/");
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
      setRetryCountdown((currentCountdown) =>
        Math.max(currentCountdown - 1, 0),
      );
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [retryCountdown]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleRetryAuthCheck = () => {
    if (retryCountdown > 0 || isLoading) {
      return;
    }

    void checkAuth();
  };

  // Merge inventory/maintenance and procurement alerts for the Current tab.
  type DisplayedNotification = {
    id: string | number;
    alertType: string;
    priority: "INFO" | "WARNING" | "CRITICAL" | "NORMAL";
    message: string;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
    source: "inventory" | "procurement";
  };

  const totalUnreadCount = unreadCount + procurementUnreadCount;
  const currentNotifications: DisplayedNotification[] = [
    ...alerts.map((alert) => ({ ...alert, source: "inventory" as const })),
    ...procurementAlerts.map((alert) => ({
      id: alert.id,
      alertType: alert.alertType as string,
      priority: (alert.alertType === "PENDING_APPROVAL"
        ? "WARNING"
        : "NORMAL") as "WARNING" | "NORMAL",
      message: alert.message,
      isRead: alert.isRead,
      readAt: alert.readAt,
      createdAt: alert.createdAt,
      source: "procurement" as const,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const historyNotifications: DisplayedNotification[] = [
    ...historyAlerts.map((alert) => ({
      ...alert,
      source: "inventory" as const,
    })),
    ...procurementHistoryAlerts.map((alert) => ({
      id: alert.id,
      alertType: alert.alertType as string,
      priority: (alert.alertType === "PENDING_APPROVAL"
        ? "WARNING"
        : "NORMAL") as "WARNING" | "NORMAL",
      message: alert.message,
      isRead: alert.isRead,
      readAt: alert.readAt,
      createdAt: alert.createdAt,
      source: "procurement" as const,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const displayedNotifications =
    notifView === "history" ? historyNotifications : currentNotifications;

  if (isLoading) {
    return (
      <div
        className="dash-layout"
        style={{
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <span
          className="login-spinner"
          style={{
            width: "40px",
            height: "40px",
            borderColor: "rgba(37,99,235,0.1)",
            borderTopColor: "#2563eb",
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
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "480px",
            border: "1px solid var(--surface-border)",
            borderRadius: "16px",
            background: "var(--surface)",
            padding: "24px",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <h1
            style={{
              margin: "0 0 8px",
              color: "var(--text-primary)",
              fontSize: "1.25rem",
              fontWeight: 700,
            }}
          >
            Please wait before retrying
          </h1>

          <p
            style={{
              margin: "0 0 16px",
              color: "var(--text-secondary)",
              fontSize: "0.95rem",
              lineHeight: 1.6,
            }}
          >
            {isRateLimited
              ? "Too many session checks were sent. Please wait for the backend cooldown before trying again."
              : "The system could not verify your session right now. Please try again in a moment."}
          </p>

          {retryCountdown > 0 && (
            <p
              style={{
                margin: "0 0 16px",
                color: "var(--text-tertiary)",
                fontSize: "0.9rem",
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
              borderRadius: "10px",
              background: "var(--accent)",
              color: "#ffffff",
              cursor:
                isLoading || retryCountdown > 0 ? "not-allowed" : "pointer",
              font: "inherit",
              fontWeight: 700,
              opacity: isLoading || retryCountdown > 0 ? 0.65 : 1,
              padding: "10px 14px",
            }}
          >
            {isLoading
              ? "Checking..."
              : retryCountdown > 0
                ? `Retry in ${formatCountdown(retryCountdown)}`
                : "Retry Session Check"}
          </button>
        </section>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getInitials = () => {
    if (!user) return "";
    const f = user.firstName?.[0] || "";
    const l = user.lastName?.[0] || "";
    return (f + l).toUpperCase();
  };

  const notificationsLoading =
    notifView === "history"
      ? isHistoryLoading || isProcurementHistoryLoading
      : notifLoading;
  const notificationEmptyText =
    notifView === "history"
      ? "No notification history found"
      : "No alerts right now";
  const notificationHistoryError = historyError || procurementHistoryError;

  const handleNotificationViewChange = (view: "current" | "history") => {
    setNotifView(view);
    if (view === "current") {
      void fetchUnread();
    }
  };

  const handleNotificationCategoryChange = (category: AlertCategoryFilter) => {
    setNotifCategory(category);
  };

  const handleNotificationRefresh = async () => {
    await scanAlerts();
    await Promise.all([fetchUnreadCount(), fetchProcurementUnread()]);

    if (notifView === "history") {
      await Promise.all([
        fetchHistory({ category: notifCategory }),
        fetchProcurementHistory({ category: notifCategory }),
      ]);
      return;
    }

    await Promise.all([fetchUnread(), fetchProcurementUnread()]);
  };

  const handleMarkAllNotificationsRead = async () => {
    await Promise.all([markAllAsRead(), markAllProcurementAsRead()]);
    await Promise.all([fetchUnreadCount(), fetchProcurementUnread()]);
    setNotifView("history");
    await Promise.all([
      fetchHistory({ category: notifCategory }),
      fetchProcurementHistory({ category: notifCategory }),
    ]);
  };

  const handleNotificationClick = async (alert: DisplayedNotification) => {
    const shouldRefreshHistory = notifView !== "history" || !alert.isRead;

    if (!alert.isRead) {
      if (alert.source === "procurement") {
        await markProcurementAsRead(Number(alert.id));
      } else {
        await markAsRead(String(alert.id));
      }

      await Promise.all([fetchUnreadCount(), fetchProcurementUnread()]);
    }

    setNotifView("history");

    if (shouldRefreshHistory) {
      await Promise.all([
        fetchHistory({ category: notifCategory }),
        fetchProcurementHistory({ category: notifCategory }),
      ]);
    }
  };

  const formatAlertTypeLabel = (category: string) => {
    if (category === "ALL") return "All Categories";

    return category
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="dash-layout">
      {/* Mobile off-canvas backdrop */}
      {mobileNavOpen && (
        <div
          className="dash-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`dash-sidebar animate-fade-in ${collapsed ? "dash-sidebar--collapsed" : ""} ${mobileNavOpen ? "dash-sidebar--mobile-open" : ""}`}
      >
        {/* Sidebar header */}
        <div
          className={`dash-sidebar-header ${collapsed ? "dash-sidebar-header--collapsed" : ""}`}
        >
          {collapsed ? (
            /* Collapsed: solo logo acts as the expand button */
            <button
              className="dash-sidebar-solo-btn"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <img
                src="/logosolo.svg"
                alt="JIT Inventory"
                className="dash-sidebar-solo-logo"
              />
            </button>
          ) : (
            /* Expanded: full logo + collapse toggle */
            <>
              <div className="dash-sidebar-brand">
                <img
                  className="dash-sidebar-logo"
                  src="/logowhite.svg"
                  alt="JIT Inventory logo"
                />
              </div>
              <button
                className="dash-sidebar-toggle"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
              >
                <IconChevron collapsed={false} />
              </button>
            </>
          )}
        </div>

        {/* Nav sections */}
        <nav className="dash-sidebar-nav">
          <ul className="dash-nav-list">
            {/* Dashboard */}
            <li>
              <button
                className={`dash-nav-item ${pathname === "/dashboard" ? "dash-nav-item--active" : ""}`}
                onClick={() => navigate("/dashboard")}
                title={collapsed ? "Dashboard" : undefined}
              >
                <IconDashboard />
                {!collapsed && <span>Dashboard</span>}
              </button>
            </li>

            {/* Inventory Management collapsible group */}
            {(() => {
              const visibleChildren = INV_MGMT_ITEMS.filter((item) =>
                hasPermission(item.requiredPermission),
              );
              if (visibleChildren.length === 0) return null;
              return (
                <>
                  <li>
                    <button
                      className={`dash-nav-item dash-nav-group-trigger ${invMgmtChildActive ? "dash-nav-item--active" : ""}`}
                      onClick={() => !collapsed && setInvMgmtOpen((o) => !o)}
                      title={collapsed ? "Inventory Management" : undefined}
                    >
                      <IconInventoryMgmt />
                      {!collapsed && (
                        <>
                          <span>Inventory Management</span>
                          <IconChevronSmall open={invMgmtOpen} />
                        </>
                      )}
                    </button>
                  </li>
                  {!collapsed &&
                    invMgmtOpen &&
                    visibleChildren.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <li key={item.name}>
                          <button
                            className={`dash-nav-item dash-nav-child ${isActive ? "dash-nav-item--active" : ""}`}
                            onClick={() => navigate(item.href)}
                          >
                            <item.icon />
                            <span>{item.name}</span>
                          </button>
                        </li>
                      );
                    })}
                </>
              );
            })()}

            {/* Admin items */}
            {ADMIN_ITEMS.filter((item) =>
              hasPermission(item.requiredPermission),
            ).map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <button
                    className={`dash-nav-item ${isActive ? "dash-nav-item--active" : ""}`}
                    onClick={() => navigate(item.href)}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon />
                    {!collapsed && <span>{item.name}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar footer */}
        <div className="dash-sidebar-footer">
          <button
            className={`dash-user-btn ${collapsed ? "dash-user-btn--collapsed" : ""}`}
            onClick={() => setAccountModalOpen(true)}
            title={collapsed ? `${user.firstName} ${user.lastName}` : undefined}
          >
            <div className="dash-avatar dash-avatar--circle">
              {getInitials()}
            </div>
            {!collapsed && (
              <div className="dash-user-meta">
                <span className="dash-user-name">{`${user.firstName} ${user.lastName}`}</span>
                <span className="dash-user-role">
                  {formatRoleName(user.role?.name)}
                </span>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dash-main">
        {/* Top bar */}
        <header className="dash-topbar">
          <button
            type="button"
            className="dash-mobile-menu-btn"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNavOpen}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="dash-topbar-right">
            {/* Notification Bell */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                className="dash-topbar-btn"
                title="Notifications"
                onClick={toggleOpen}
                aria-label="Toggle notifications"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {totalUnreadCount > 0 && (
                  <span className="dash-notif-badge">
                    {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown Panel */}
              {notifOpen && (
                <div className="dash-notif-panel">
                  <div className="dash-notif-header">
                    <div>
                      <span className="dash-notif-title">Notifications</span>
                      <p className="dash-notif-subtitle">
                        Updates refresh every{" "}
                        {Math.round(ALERT_POLL_INTERVAL_MS / 1000)} seconds.
                      </p>
                    </div>
                    <div className="dash-notif-header-actions">
                      <button
                        type="button"
                        className="dash-notif-refresh"
                        onClick={() => void handleNotificationRefresh()}
                        disabled={notificationsLoading}
                        title="Refresh notifications"
                        aria-label="Refresh notifications"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 12a9 9 0 01-15.32 6.36" />
                          <path d="M3 12a9 9 0 0115.32-6.36" />
                          <path d="M18 3v4h-4" />
                          <path d="M6 21v-4h4" />
                        </svg>
                      </button>

                      {totalUnreadCount > 0 && (
                        <button
                          className="dash-notif-mark-all"
                          onClick={() => {
                            void handleMarkAllNotificationsRead();
                          }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="dash-notif-tabs">
                    <button
                      type="button"
                      className={`dash-notif-tab ${notifView === "current" ? "dash-notif-tab--active" : ""}`}
                      onClick={() => handleNotificationViewChange("current")}
                    >
                      Current
                    </button>
                    <button
                      type="button"
                      className={`dash-notif-tab ${notifView === "history" ? "dash-notif-tab--active" : ""}`}
                      onClick={() => handleNotificationViewChange("history")}
                    >
                      History
                    </button>
                  </div>

                  {notifView === "history" && (
                    <div className="dash-notif-filter-row">
                      <label htmlFor="notification-category-filter">
                        Category
                      </label>
                      <select
                        id="notification-category-filter"
                        value={notifCategory}
                        onChange={(event) =>
                          handleNotificationCategoryChange(
                            event.target.value as AlertCategoryFilter,
                          )
                        }
                      >
                        {(
                          [
                            "ALL",
                            "LOW_STOCK",
                            "OUT_OF_STOCK",
                            "OVERDUE_EQUIPMENT",
                            "WARRANTY_EXPIRING",
                            "REPLACEMENT_NEEDED",
                            "MAINTENANCE_DUE",
                            "BORROW_RETURNED",
                            "PENDING_APPROVAL",
                            "STATUS_UPDATED",
                          ] as AlertCategoryFilter[]
                        ).map((category) => (
                          <option key={category} value={category}>
                            {formatAlertTypeLabel(category)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div
                    className={`dash-notif-body ${notifView === "history" ? "dash-notif-body--history" : ""}`}
                  >
                    {notificationsLoading ? (
                      <div className="dash-notif-empty">Loading...</div>
                    ) : notificationHistoryError && notifView === "history" ? (
                      <div className="dash-notif-empty">
                        {notificationHistoryError}
                      </div>
                    ) : displayedNotifications.length === 0 ? (
                      <div className="dash-notif-empty">
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          style={{ opacity: 0.3, marginBottom: 8 }}
                        >
                          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                        </svg>
                        <span>{notificationEmptyText}</span>
                      </div>
                    ) : (
                      displayedNotifications.map((alert) => (
                        <div
                          key={`${alert.source}-${alert.id}`}
                          className={`dash-notif-item ${!alert.isRead ? "dash-notif-item--unread" : ""} ${alert.priority === "CRITICAL" ? "dash-notif-item--critical" : ""}`}
                          onClick={() => {
                            void handleNotificationClick(alert);
                          }}
                        >
                          <div className="dash-notif-dot" />
                          <div className="dash-notif-item-body">
                            <span className="dash-notif-item-msg">
                              {alert.message}
                            </span>
                            <span className="dash-notif-item-time">
                              {formatAlertTypeLabel(alert.alertType)} •{" "}
                              {new Date(alert.createdAt).toLocaleString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                          <div className="dash-notif-tags">
                            {alert.priority !== "NORMAL" && (
                              <span
                                className={`dash-notif-tag dash-notif-tag--${alert.priority.toLowerCase()}`}
                              >
                                {alert.priority}
                              </span>
                            )}
                            <span
                              className={`dash-notif-status ${alert.isRead ? "dash-notif-status--read" : "dash-notif-status--unread"}`}
                            >
                              {alert.isRead ? "Read" : "Unread"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="dash-content">
          <Outlet />
        </div>
      </main>

      {/* Account Modal */}
      {accountModalOpen && (
        <div
          className="acct-modal-overlay"
          onClick={() => setAccountModalOpen(false)}
        >
          <div className="acct-modal" onClick={(e) => e.stopPropagation()}>
            <div className="acct-modal-avatar">{getInitials()}</div>
            <div className="acct-modal-name">{`${user.firstName} ${user.lastName}`}</div>
            <div className="acct-modal-role">
              {formatRoleName(user.role?.name)}
            </div>
            <div className="acct-modal-divider" />
            <button
              className="acct-modal-signout"
              onClick={async () => {
                setAccountModalOpen(false);
                await handleLogout();
              }}
            >
              <IconLogout />
              Sign Out
            </button>
          </div>
        </div>
      )}

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
          background: linear-gradient(180deg, #0e122f 0%, #101738 100%);
          border-right: 1px solid rgba(138, 56, 245, 0.16);
          display: flex;
          flex-direction: column;
          z-index: 40;
          transition: width var(--transition-base), transform var(--transition-base);
          box-shadow: 12px 0 40px rgba(6, 10, 28, 0.16);
        }
        .dash-sidebar--collapsed {
          width: 76px;
        }

        .dash-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 14px 14px;
          border-bottom: 1px solid rgba(168, 179, 196, 0.16);
          min-height: 72px;
        }

        .dash-sidebar-header--collapsed {
          justify-content: center;
          padding: 12px 8px;
        }

        .dash-sidebar-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          animation: slideInLeft 0.3s ease;
        }

        .dash-sidebar-brand--collapsed {
          justify-content: center;
        }

        .dash-sidebar-logo {
          width: 100%;
          height: 48px;
          object-fit: contain;
          flex-shrink: 0;
          display: block;
          padding: 0 8px;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.18));
        }

        .dash-sidebar-solo-btn {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          transition: background var(--transition-fast);
        }
        .dash-sidebar-solo-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .dash-sidebar-solo-logo {
          width: 36px;
          height: 36px;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.18));
        }

        .dash-sidebar-toggle {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(168, 179, 196, 0.18);
          border-radius: var(--radius-sm);
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f1f3f6;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .dash-sidebar-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.24);
        }

        /* ------ Navigation ------ */

        .dash-sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .dash-nav-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
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
          color: #c8ced9;
          font-size: 13.5px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-fast);
        }
        .dash-nav-item:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #f1f3f6;
        }
        .dash-nav-item--active {
          background: #2d3a8c;
          color: #ffffff;
          font-weight: 600;
        }

        .dash-nav-indicator {
          display: none;
        }

        .dash-nav-child {
          padding-left: 36px;
          font-size: 13px;
        }

        .dash-nav-group-trigger {
          /* inherits dash-nav-item styles */
        }

        /* ------ Sidebar Footer ------ */

        .dash-sidebar-footer {
          border-top: 1px solid rgba(168, 179, 196, 0.16);
          padding: 12px;
        }

        .dash-user-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(168, 179, 196, 0.12);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
          font-family: inherit;
        }
        .dash-user-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .dash-user-btn--collapsed {
          justify-content: center;
          padding: 8px;
        }

        .dash-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2d3a8c, #4254c7);
          color: #ffffff;
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
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dash-user-role {
          font-size: 11px;
          color: #a8b3c4;
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
          margin-left: 76px;
        }

        /* ------ Top Bar ------ */

        .dash-topbar {
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          height: 60px;
          padding: 0 28px;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--surface-border);
        }

        .dash-mobile-menu-btn {
          display: none;
          width: 36px;
          height: 36px;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          flex-shrink: 0;
          transition: all var(--transition-fast);
        }
        .dash-mobile-menu-btn:hover {
          background: var(--sidebar-hover);
          color: var(--text-primary);
        }

        .dash-mobile-backdrop {
          display: none;
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

        /* ------ Notification Panel ------ */

        .dash-notif-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 360px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg, 12px);
          box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.12));
          z-index: 100;
          overflow: hidden;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .dash-notif-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
          border-bottom: 1px solid var(--surface-border);
        }

        .dash-notif-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .dash-notif-subtitle {
          margin: 2px 0 0;
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .dash-notif-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .dash-notif-refresh {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--surface-border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .dash-notif-refresh:hover:not(:disabled) {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-muted);
        }

        .dash-notif-refresh:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .dash-notif-mark-all {
          background: none;
          border: none;
          font-size: 12px;
          font-family: inherit;
          color: var(--accent);
          cursor: pointer;
          padding: 0;
          font-weight: 500;
        }
        .dash-notif-mark-all:hover { text-decoration: underline; }

        .dash-notif-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--surface-border);
          background: var(--background-tertiary);
        }

        .dash-notif-tab {
          border: 1px solid var(--surface-border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text-secondary);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          padding: 7px 10px;
          transition: all var(--transition-fast);
        }

        .dash-notif-tab--active,
        .dash-notif-tab:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-muted);
        }

        .dash-notif-filter-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--surface-border);
        }

        .dash-notif-filter-row label {
          color: var(--text-tertiary);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .dash-notif-filter-row select {
          flex: 1;
          border: 1px solid var(--surface-border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text-primary);
          font: inherit;
          font-size: 12px;
          padding: 7px 9px;
        }

        .dash-notif-body {
          max-height: 380px;
          overflow-y: auto;
        }

        .dash-notif-body--history {
          margin: 12px;
          max-height: 340px;
          border: 1px solid var(--surface-border);
          border-radius: 10px;
          background: var(--surface);
          overflow: hidden auto;
        }

        .dash-notif-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 36px 16px;
          color: var(--text-tertiary);
          font-size: 13px;
          gap: 4px;
        }

        .dash-notif-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--surface-border);
          transition: background var(--transition-fast);
        }
        .dash-notif-item:last-child { border-bottom: none; }
        .dash-notif-item:hover { background: var(--background-tertiary); }
        .dash-notif-item--unread { background: var(--accent-muted, rgba(37,99,235,0.05)); }
        .dash-notif-item--critical.dash-notif-item--unread { background: rgba(220,38,38,0.05); }

        .dash-notif-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
          margin-top: 5px;
          opacity: 0;
        }
        .dash-notif-item--unread .dash-notif-dot { opacity: 1; }
        .dash-notif-item--critical .dash-notif-dot { background: var(--danger); }

        .dash-notif-item-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .dash-notif-item-msg {
          font-size: 13px;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .dash-notif-item-time {
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .dash-notif-tags {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .dash-notif-tag {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .dash-notif-tag--warning {
          background: rgba(245,158,11,0.12);
          color: #b45309;
        }
        .dash-notif-tag--critical {
          background: rgba(220,38,38,0.1);
          color: var(--danger, #dc2626);
        }

        .dash-notif-status {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .dash-notif-status--read {
          background: var(--background-tertiary);
          color: var(--text-tertiary);
        }

        .dash-notif-status--unread {
          background: var(--accent-muted);
          color: var(--accent);
        }

        /* ------ Page Content Area ------ */

        .dash-content {
          flex: 1;
          padding: 28px;
        }

        /* ------ Account Modal ------ */

        .acct-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.15s ease;
        }

        .acct-modal {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px 28px 24px;
          width: 100%;
          max-width: 320px;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          animation: fadeInUp 0.2s ease;
        }

        .acct-modal-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2d3a8c, #4254c7);
          color: #ffffff;
          font-size: 24px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          font-family: inherit;
        }

        .acct-modal-name {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
          text-align: center;
          font-family: inherit;
        }

        .acct-modal-role {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 24px;
          text-align: center;
          font-family: inherit;
        }

        .acct-modal-divider {
          width: 100%;
          height: 1px;
          background: #e2e8f0;
          margin-bottom: 16px;
        }

        .acct-modal-signout {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 11px 16px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          color: #475569;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 150ms ease;
        }
        .acct-modal-signout:hover {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #dc2626;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ------ Responsive: tablet & below ------ */
        @media (max-width: 1024px) {
          .dash-content {
            padding: 20px;
          }
        }

        /* ------ Responsive: mobile ------ */
        @media (max-width: 900px) {
          /* Sidebar becomes an off-canvas drawer instead of pushing content */
          .dash-sidebar,
          .dash-sidebar--collapsed {
            width: min(280px, 84vw);
            transform: translateX(-100%);
            box-shadow: none;
          }
          .dash-sidebar--mobile-open {
            transform: translateX(0);
            box-shadow: 12px 0 40px rgba(6, 10, 28, 0.28);
          }

          .dash-main,
          .dash-sidebar--collapsed ~ .dash-main {
            margin-left: 0;
          }

          .dash-mobile-menu-btn {
            display: flex;
          }

          .dash-mobile-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(6, 10, 28, 0.45);
            z-index: 39; /* just under the sidebar's z-index of 40 */
            animation: fadeIn 0.15s ease;
          }

          .dash-topbar {
            justify-content: space-between;
            padding: 0 16px;
          }

          .dash-content {
            padding: 16px;
          }

          .dash-notif-panel {
            position: fixed;
            top: 64px;
            right: 8px;
            left: 8px;
            width: auto;
            max-height: calc(100vh - 80px);
          }

          .dash-notif-body {
            max-height: calc(100vh - 260px);
          }
        }

        @media (max-width: 480px) {
          .dash-sidebar-header {
            padding: 12px;
          }

          .dash-content {
            padding: 12px;
          }

          .dash-notif-tabs {
            padding: 8px;
          }

          .acct-modal {
            max-width: calc(100vw - 32px);
            padding: 24px 20px 20px;
          }
        }
      `}</style>
    </div>
  );
}