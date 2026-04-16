import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toPaiseFromInput } from "@/lib/money";
import {
  getCustomerById,
  getCustomerSubscriptionByCustomerId,
  updateCustomerSubscriptionByCustomerId
} from "@/services/firestore";
import type { SubscriptionDuration } from "@/types/models";

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function SubscriptionEditPage() {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const [customerName, setCustomerName] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [billingType, setBillingType] = useState<SubscriptionDuration>("monthly");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!customerId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [customer, subscription] = await Promise.all([
          getCustomerById(customerId),
          getCustomerSubscriptionByCustomerId(customerId)
        ]);
        if (!subscription) {
          setNotFound(true);
          return;
        }

        setCustomerName(customer?.name ?? customerId);
        setPriceInput((subscription.priceInPaise / 100).toFixed(2));
        setBillingType(subscription.billingType);
        setStartDateInput(formatDateInput(subscription.startDate.toDate()));
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load subscription.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [customerId]);

  async function onSave() {
    if (!customerId) {
      setError("Customer not found.");
      return;
    }
    const priceInPaise = toPaiseFromInput(priceInput);
    if (priceInPaise <= 0) {
      setError("Enter a valid subscription amount.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateCustomerSubscriptionByCustomerId({
        customerId,
        priceInPaise,
        billingType
      });
      navigate("/subscriptions", { state: { flashMessage: "Edit saved" } });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 pb-28">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/subscriptions")}>
            Back
          </Button>
          <h2 className="text-lg font-semibold">Edit Subscription</h2>
        </div>

        {loading ? (
          <Card>
            <p className="text-sm text-text-secondary">Loading subscription...</p>
          </Card>
        ) : null}

        {notFound ? (
          <Card className="space-y-3">
            <p className="text-sm text-text-secondary">Subscription not found.</p>
            <Button type="button" variant="secondary" onClick={() => navigate("/subscriptions")}>
              Back to Subscriptions
            </Button>
          </Card>
        ) : null}

        {!loading && !notFound ? (
          <Card className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-text-secondary">Customer</p>
              <p className="text-sm font-medium">{customerName}</p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Price</span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Start Date</span>
              <Input
                type="date"
                value={startDateInput}
                disabled
                className="cursor-not-allowed border-border-subtle bg-bg-primary text-text-disabled disabled:opacity-100"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Billing Type</span>
              <Select
                value={billingType}
                onChange={(event) => setBillingType(event.target.value as SubscriptionDuration)}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </label>
          </Card>
        ) : null}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>

      {!notFound ? (
        <div className="sticky bottom-0 border-t border-border-subtle bg-bg-primary/95 p-3 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl">
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || loading}
              className="w-full text-base font-semibold"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
