import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatInrFromPaise } from "@/lib/money";
import {
  deleteCustomerSubscriptionByCustomerId,
  listCustomerSubscriptions,
  listCustomers
} from "@/services/firestore";
import type { CustomerSubscription, FirebaseFirestoreTimestamp } from "@/types/models";

interface SubscriptionsLocationState {
  flashMessage?: string;
}

interface SubscriptionRow extends CustomerSubscription {
  customerName: string;
}

function formatDueDate(nextDueDate: FirebaseFirestoreTimestamp): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(nextDueDate.toDate());
}

export function SubscriptionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [subscriptionRows, customers] = await Promise.all([listCustomerSubscriptions(), listCustomers()]);
      const customerMap = new Map(customers.map((customer) => [customer.id, customer.name]));
      const merged = subscriptionRows
        .filter((subscription) => customerMap.has(subscription.customerId))
        .map((subscription) => ({
          ...subscription,
          customerName: customerMap.get(subscription.customerId) ?? ""
        }));
      setSubscriptions(merged);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const locationState = (location.state ?? {}) as SubscriptionsLocationState;
    const message = locationState.flashMessage?.trim();
    if (!message) {
      return;
    }

    setToastMessage(message);
    setToastLeaving(false);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const leaveTimeout = window.setTimeout(() => setToastLeaving(true), 1000);
    const clearTimeoutId = window.setTimeout(() => {
      setToastMessage(null);
      setToastLeaving(false);
    }, 1300);

    return () => {
      window.clearTimeout(leaveTimeout);
      window.clearTimeout(clearTimeoutId);
    };
  }, [toastMessage]);

  async function onDelete(subscription: SubscriptionRow) {
    const confirmed = window.confirm(`Delete subscription for ${subscription.customerName}?`);
    if (!confirmed) {
      return;
    }

    setDeletingCustomerId(subscription.customerId);
    setError(null);
    try {
      await deleteCustomerSubscriptionByCustomerId(subscription.customerId);
      setSubscriptions((prev) => prev.filter((entry) => entry.customerId !== subscription.customerId));
      setToastMessage("Subscription deleted");
      setToastLeaving(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete subscription.");
    } finally {
      setDeletingCustomerId(null);
    }
  }

  const rows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return subscriptions;
    }
    return subscriptions.filter((subscription) => subscription.customerName.toLowerCase().includes(query));
  }, [searchQuery, subscriptions]);

  return (
    <div className="space-y-4 pb-24">
      {toastMessage ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3">
          <div
            className={`rounded-control border border-border-strong bg-bg-elevated px-4 py-2 text-sm font-medium text-text-primary shadow-lg ${
              toastLeaving ? "subscription-toast-leave" : "subscription-toast-enter"
            }`}
          >
            {toastMessage}
          </div>
        </div>
      ) : null}

      <Card className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Subscriptions</h2>
        <Button type="button" onClick={() => navigate("/subscriptions/new")}>
          Add Subscription
        </Button>
      </Card>

      <Card className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-text-secondary">Search Customer</span>
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by customer name"
          />
        </label>

        {loading ? <p className="text-sm text-text-secondary">Loading subscriptions...</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-text-secondary">No subscriptions found.</p>
        ) : null}

        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase text-text-secondary">
                  <th className="px-2 py-2 sm:px-3">Name</th>
                  <th className="px-2 py-2 text-right sm:px-3">Amount</th>
                  <th className="px-2 py-2 text-right sm:px-3">Due Date</th>
                  <th className="w-[92px] px-2 py-2 text-right sm:px-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((subscription) => (
                  <tr
                    key={subscription.id}
                    className="cursor-pointer border-b border-border-subtle bg-bg-surface transition hover:bg-bg-elevated"
                    onClick={() => navigate(`/subscriptions/${subscription.customerId}/edit`)}
                  >
                    <td className="break-words px-2 py-3 font-medium sm:px-3">{subscription.customerName}</td>
                    <td className="px-2 py-3 text-right sm:px-3">{formatInrFromPaise(subscription.priceInPaise)}</td>
                    <td className="px-2 py-3 text-right sm:px-3">{formatDueDate(subscription.nextDueDate)}</td>
                    <td className="px-2 py-3 text-right sm:px-3">
                      <Button
                        type="button"
                        variant="danger"
                        disabled={deletingCustomerId === subscription.customerId}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onDelete(subscription);
                        }}
                      >
                        {deletingCustomerId === subscription.customerId ? "Deleting..." : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </Card>
    </div>
  );
}
