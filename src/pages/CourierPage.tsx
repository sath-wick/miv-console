import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { listOrdersByDate, markOrderDelivered } from "@/services/firestore";
import { formatInrFromPaise } from "@/lib/money";
import type { Order } from "@/types/models";

export function CourierPage() {
  const [dateKey, setDateKey] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!dateKey) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listOrdersByDate(dateKey);
      setOrders(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [dateKey]);

  const pendingCount = useMemo(() => orders.filter((order) => order.status === "pending").length, [orders]);

  async function onMarkDelivered(orderId: string) {
    try {
      await markOrderDelivered(orderId);
      await refresh();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: "delivered" } : null));
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to mark delivered.");
    }
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs text-text-secondary">Date</span>
          <Input type="date" value={dateKey} onChange={(event) => setDateKey(event.target.value)} />
        </label>
        <p className="text-sm text-text-secondary">Pending orders: {pendingCount}</p>
      </Card>

      <Card className="space-y-2">
        {loading ? <p className="text-sm text-text-secondary">Loading orders...</p> : null}
        {!loading && orders.length === 0 ? (
          <p className="text-sm text-text-secondary">No orders found for selected date.</p>
        ) : null}
        {orders.map((order) => (
          <article key={order.id} className="rounded-control border border-border-subtle bg-bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{order.customerName}</p>
                <p className="text-xs text-text-secondary">
                  {order.mealType.toUpperCase()} | {formatInrFromPaise(order.grandTotalInPaise)}
                </p>
              </div>
              <span className="text-xs uppercase text-text-secondary">{order.status}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => setSelectedOrder(order)}>
                View
              </Button>
              {order.status === "pending" ? (
                <Button onClick={() => void onMarkDelivered(order.id)}>Mark Delivered</Button>
              ) : null}
            </div>
          </article>
        ))}
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </Card>

      <Modal open={Boolean(selectedOrder)} title="Order Details" onClose={() => setSelectedOrder(null)}>
        {selectedOrder ? (
          <div className="space-y-2 text-sm">
            <p>Customer: {selectedOrder.customerName}</p>
            <p>Date: {selectedOrder.dateKey}</p>
            <p>Meal: {selectedOrder.mealType}</p>
            <p>Status: {selectedOrder.status}</p>
            <ul className="list-disc pl-5">
              {selectedOrder.items.map((item) => (
                <li key={item.inventoryItemId}>
                  {item.name} x {item.quantity} = {formatInrFromPaise(item.lineTotalInPaise)}
                </li>
              ))}
            </ul>
            <p>Subtotal: {formatInrFromPaise(selectedOrder.subtotalInPaise)}</p>
            <p>Delivery: {formatInrFromPaise(selectedOrder.deliveryChargeInPaise)}</p>
            <p className="font-semibold">Grand Total: {formatInrFromPaise(selectedOrder.grandTotalInPaise)}</p>
            {selectedOrder.status === "pending" ? (
              <Button
                onClick={async () => {
                  await onMarkDelivered(selectedOrder.id);
                }}
              >
                Mark Delivered
              </Button>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
