import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { NAV_ITEMS } from "@/constants/app";
import { formatInrFromPaise } from "@/lib/money";
import { listCustomersWithDue } from "@/services/firestore";

interface DueNotification {
  customerId: string;
  customerName: string;
  dueInPaise: number;
  daysSinceLastOrder: number;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { pathname } = useLocation();
  const isLauncher = pathname === "/home";
  const currentModule = NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  const title = isLauncher ? "Maa Inti Vanta" : currentModule?.label ?? "Module";
  const showCreateCustomerAction = pathname === "/billing";
  const showEditInventoryAction = pathname === "/menu";
  const showNotifications = role === "admin";
  const [notifications, setNotifications] = useState<DueNotification[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const headerClassName = isLauncher
    ? "rounded-[22px] border border-[rgba(230,134,46,0.12)] bg-[#1E1612] px-4 py-4"
    : "rounded-card border border-border-subtle bg-bg-surface px-4 py-4";

  useEffect(() => {
    setPanelOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!showNotifications) {
      setNotifications([]);
      return;
    }
    let active = true;
    async function loadNotifications() {
      try {
        const dueCustomers = await listCustomersWithDue();
        if (!active) {
          return;
        }
        const now = Date.now();
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
        const nextNotifications = dueCustomers
          .filter((customer) => {
            const lastOrderMs = customer.lastOrderAt?.toMillis();
            return typeof lastOrderMs === "number" && now - lastOrderMs > sevenDaysInMs;
          })
          .map((customer) => {
            const lastOrderMs = customer.lastOrderAt?.toMillis() ?? now;
            return {
              customerId: customer.id,
              customerName: customer.name,
              dueInPaise: customer.currentBalanceInPaise,
              daysSinceLastOrder: Math.floor((now - lastOrderMs) / (24 * 60 * 60 * 1000))
            };
          })
          .sort((a, b) => b.dueInPaise - a.dueInPaise);
        setNotifications(nextNotifications);
      } catch {
        if (active) {
          setNotifications([]);
        }
      }
    }
    void loadNotifications();
    return () => {
      active = false;
    };
  }, [pathname, showNotifications]);

  const notificationControl = showNotifications ? (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        title="Notifications"
        className="relative rounded-control border border-border-strong bg-bg-surface px-3 py-2 text-text-primary transition hover:bg-bg-elevated"
        onClick={() => setPanelOpen((prev) => !prev)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 17.5h11M8.5 17.5V11a3.5 3.5 0 1 1 7 0v6.5" />
          <path strokeLinecap="round" d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {notifications.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-accent-primary px-1 text-[11px] font-semibold text-text-primary">
            {notifications.length}
          </span>
        ) : null}
      </button>

      {panelOpen ? (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[88vw] rounded-card border border-border-strong bg-bg-elevated p-2 shadow-xl">
          <p className="px-2 py-1 text-xs uppercase tracking-wide text-text-secondary">Due + Inactive Customers</p>
          {notifications.length === 0 ? (
            <p className="px-2 py-2 text-sm text-text-secondary">No notifications.</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-auto">
              {notifications.map((notification) => (
                <button
                  key={notification.customerId}
                  type="button"
                  className="w-full rounded-control border border-transparent bg-bg-surface px-2 py-2 text-left hover:border-border-subtle"
                  onClick={() => {
                    setPanelOpen(false);
                    navigate(`/customers/${notification.customerId}/ledger`);
                  }}
                >
                  <p className="text-sm font-medium text-text-primary">{notification.customerName}</p>
                  <p className="text-xs text-red-200">Due: {formatInrFromPaise(notification.dueInPaise)}</p>
                  <p className="text-xs text-text-secondary">Last order: {notification.daysSinceLastOrder} days ago</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className={`app-container space-y-6${isLauncher ? " home-shell" : ""}`}>
      <header className={headerClassName}>
        {isLauncher ? (
          <div className="home-fade-in flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[rgba(230,134,46,0.08)] text-[#E6862E]">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.6 2.3 4.5 5.2 4.5 8.1A4.5 4.5 0 0 1 12 15.6a4.5 4.5 0 0 1-4.5-4.5C7.5 8.2 9.4 5.3 12 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.2 16.5h11.6M8.5 20h7" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-[#F2E4D6] sm:text-5xl">{title}</h1>
                <p className="mt-1 text-sm text-[#A9927E]">Kitchen Operations Console</p>
              </div>
            </div>
            {notificationControl}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                to="/home"
                aria-label="Home"
                className="rounded-control border border-border-strong bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 9.75V21h13.5V9.75" />
                </svg>
              </Link>
              <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {showEditInventoryAction ? (
                <Link
                  to="/inventory"
                  aria-label="Edit Inventory"
                  title="Edit Inventory"
                  className="rounded-control border border-border-strong bg-bg-surface px-3 py-2 text-text-primary transition hover:bg-bg-elevated"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h10M4 12h7M4 16.5h10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 15.5 4.8-4.8a1.2 1.2 0 0 1 1.7 1.7l-4.8 4.8L14 18l.5-2.5Z" />
                  </svg>
                </Link>
              ) : null}
              {showCreateCustomerAction ? (
                <Link
                  to="/customers/new"
                  aria-label="Create Customer"
                  title="Create Customer"
                  className="rounded-control border border-border-strong bg-bg-surface px-3 py-2 text-text-primary transition hover:bg-bg-elevated"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <circle cx="10" cy="8" r="3" />
                    <path strokeLinecap="round" d="M4.5 18c1.1-2.4 2.9-3.7 5.5-3.7 1.7 0 3.1.5 4.2 1.4" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 10.5v7M14 14h7" />
                  </svg>
                </Link>
              ) : null}
              {notificationControl}
            </div>
          </div>
        )}
      </header>

      <main className="space-y-6">{children}</main>
    </div>
  );
}
