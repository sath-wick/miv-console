import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatInrFromPaise } from "@/lib/money";
import {
  deleteCommandCenterMenu,
  deleteCommandCenterOrder,
  deleteCommandCenterUser,
  listCommandCenterMenus,
  listCommandCenterOrders,
  listCommandCenterUsers,
  type CommandCenterUserDocument
} from "@/services/firestore";
import type { MenuForDate, Order } from "@/types/models";

type CommandCenterSection = "users" | "orders" | "menus";

function formatDateValue(value: Date | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

function parseDateKey(dateKey: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function menuItemsCount(menu: MenuForDate): { breakfast: number; lunch: number; dinner: number } {
  const lunch = Object.values(menu.lunch ?? {}).reduce((sum, itemIds) => sum + (itemIds?.length ?? 0), 0);
  const dinner = Object.values(menu.dinner ?? {}).reduce((sum, itemIds) => sum + (itemIds?.length ?? 0), 0);
  return {
    breakfast: menu.breakfastItemIds?.length ?? 0,
    lunch,
    dinner
  };
}

export function CommandCenterPage() {
  const [section, setSection] = useState<CommandCenterSection>("users");
  const [users, setUsers] = useState<CommandCenterUserDocument[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menus, setMenus] = useState<MenuForDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [usersResult, ordersResult, menusResult] = await Promise.all([
        listCommandCenterUsers(),
        listCommandCenterOrders(),
        listCommandCenterMenus()
      ]);
      setUsers(usersResult);
      setOrders(ordersResult);
      setMenus(menusResult);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load command center data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onDeleteUser(user: CommandCenterUserDocument) {
    const confirmed = window.confirm(`Delete user document ${user.id}?`);
    if (!confirmed) {
      return;
    }
    setWorkingId(user.id);
    setError(null);
    try {
      await deleteCommandCenterUser(user.id);
      setUsers((prev) => prev.filter((entry) => entry.id !== user.id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete user document.");
    } finally {
      setWorkingId(null);
    }
  }

  async function onDeleteOrder(order: Order) {
    const confirmed = window.confirm(`Delete order ${order.id} for ${order.customerName}?`);
    if (!confirmed) {
      return;
    }
    setWorkingId(order.id);
    setError(null);
    try {
      await deleteCommandCenterOrder(order.id);
      setOrders((prev) => prev.filter((entry) => entry.id !== order.id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete order document.");
    } finally {
      setWorkingId(null);
    }
  }

  async function onDeleteMenu(menu: MenuForDate) {
    const confirmed = window.confirm(`Delete menu document for date ${menu.dateKey}?`);
    if (!confirmed) {
      return;
    }
    setWorkingId(menu.id);
    setError(null);
    try {
      await deleteCommandCenterMenu(menu.id);
      setMenus((prev) => prev.filter((entry) => entry.id !== menu.id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete menu document.");
    } finally {
      setWorkingId(null);
    }
  }

  const activeCount = useMemo(() => {
    if (section === "users") {
      return users.length;
    }
    if (section === "orders") {
      return orders.length;
    }
    return menus.length;
  }, [menus.length, orders.length, section, users.length]);

  return (
    <div className="space-y-4 pb-24">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Command Center</h2>
          <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </Button>
        </div>
        <p className="text-xs text-text-secondary">
          Admin tools to inspect and delete Firestore documents for users, orders, and menus.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={section === "users" ? "primary" : "secondary"} onClick={() => setSection("users")}>
            Users
          </Button>
          <Button type="button" variant={section === "orders" ? "primary" : "secondary"} onClick={() => setSection("orders")}>
            Orders
          </Button>
          <Button type="button" variant={section === "menus" ? "primary" : "secondary"} onClick={() => setSection("menus")}>
            Menus
          </Button>
        </div>
        <p className="text-xs text-text-secondary">
          Showing <span className="font-semibold text-text-primary">{activeCount}</span> documents.
        </p>
      </Card>

      <Card className="space-y-2">
        {loading ? <p className="text-sm text-text-secondary">Loading documents...</p> : null}

        {!loading && section === "users" && users.length === 0 ? (
          <p className="text-sm text-text-secondary">No user documents found.</p>
        ) : null}
        {!loading && section === "orders" && orders.length === 0 ? (
          <p className="text-sm text-text-secondary">No order documents found.</p>
        ) : null}
        {!loading && section === "menus" && menus.length === 0 ? (
          <p className="text-sm text-text-secondary">No menu documents found.</p>
        ) : null}

        {!loading && section === "users" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase text-text-secondary">
                  <th className="px-2 py-2 sm:px-3">User ID</th>
                  <th className="px-2 py-2 sm:px-3">Role</th>
                  <th className="px-2 py-2 sm:px-3">Name</th>
                  <th className="px-2 py-2 sm:px-3">Email</th>
                  <th className="px-2 py-2 text-right sm:px-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border-subtle bg-bg-surface">
                    <td className="break-all px-2 py-3 sm:px-3">{user.id}</td>
                    <td className="px-2 py-3 capitalize sm:px-3">{user.role ?? "-"}</td>
                    <td className="px-2 py-3 sm:px-3">{user.displayName ?? "-"}</td>
                    <td className="px-2 py-3 sm:px-3">{user.email ?? "-"}</td>
                    <td className="px-2 py-3 text-right sm:px-3">
                      <Button
                        type="button"
                        variant="danger"
                        disabled={workingId === user.id}
                        onClick={() => void onDeleteUser(user)}
                      >
                        {workingId === user.id ? "Deleting..." : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && section === "orders" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase text-text-secondary">
                  <th className="px-2 py-2 sm:px-3">Order</th>
                  <th className="px-2 py-2 sm:px-3">Date</th>
                  <th className="px-2 py-2 sm:px-3">Customer</th>
                  <th className="px-2 py-2 sm:px-3">Meal</th>
                  <th className="px-2 py-2 text-right sm:px-3">Total</th>
                  <th className="px-2 py-2 text-right sm:px-3"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border-subtle bg-bg-surface">
                    <td className="px-2 py-3 sm:px-3">#{order.billNumber ?? "-"} · {order.id}</td>
                    <td className="px-2 py-3 sm:px-3">{formatDateValue(parseDateKey(order.dateKey))}</td>
                    <td className="px-2 py-3 sm:px-3">{order.customerName}</td>
                    <td className="px-2 py-3 capitalize sm:px-3">{order.mealType}</td>
                    <td className="px-2 py-3 text-right sm:px-3">{formatInrFromPaise(order.grandTotalInPaise)}</td>
                    <td className="px-2 py-3 text-right sm:px-3">
                      <Button
                        type="button"
                        variant="danger"
                        disabled={workingId === order.id}
                        onClick={() => void onDeleteOrder(order)}
                      >
                        {workingId === order.id ? "Deleting..." : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && section === "menus" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase text-text-secondary">
                  <th className="px-2 py-2 sm:px-3">Menu ID</th>
                  <th className="px-2 py-2 sm:px-3">Date</th>
                  <th className="px-2 py-2 text-right sm:px-3">Breakfast</th>
                  <th className="px-2 py-2 text-right sm:px-3">Lunch</th>
                  <th className="px-2 py-2 text-right sm:px-3">Dinner</th>
                  <th className="px-2 py-2 text-right sm:px-3"></th>
                </tr>
              </thead>
              <tbody>
                {menus.map((menu) => {
                  const counts = menuItemsCount(menu);
                  return (
                    <tr key={menu.id} className="border-b border-border-subtle bg-bg-surface">
                      <td className="px-2 py-3 sm:px-3">{menu.id}</td>
                      <td className="px-2 py-3 sm:px-3">{formatDateValue(parseDateKey(menu.dateKey))}</td>
                      <td className="px-2 py-3 text-right sm:px-3">{counts.breakfast}</td>
                      <td className="px-2 py-3 text-right sm:px-3">{counts.lunch}</td>
                      <td className="px-2 py-3 text-right sm:px-3">{counts.dinner}</td>
                      <td className="px-2 py-3 text-right sm:px-3">
                        <Button
                          type="button"
                          variant="danger"
                          disabled={workingId === menu.id}
                          onClick={() => void onDeleteMenu(menu)}
                        >
                          {workingId === menu.id ? "Deleting..." : "Delete"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </Card>
    </div>
  );
}
