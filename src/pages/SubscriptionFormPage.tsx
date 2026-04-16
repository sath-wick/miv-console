import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toPaiseFromInput } from "@/lib/money";
import { createCustomerSubscription, listCustomerSubscriptions, listCustomers } from "@/services/firestore";
import type { Customer, SubscriptionDuration } from "@/types/models";

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function SubscriptionFormPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [existingCustomerIds, setExistingCustomerIds] = useState<Set<string>>(new Set());
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOptionsOpen, setCustomerOptionsOpen] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [startDateInput, setStartDateInput] = useState(() => formatDateInput(new Date()));
  const [billingType, setBillingType] = useState<SubscriptionDuration>("monthly");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [customerResult, subscriptionResult] = await Promise.all([listCustomers(), listCustomerSubscriptions()]);
        setCustomers(customerResult);
        setExistingCustomerIds(new Set(subscriptionResult.map((entry) => entry.customerId)));
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load customers.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const availableCustomers = useMemo(
    () => customers.filter((customer) => !existingCustomerIds.has(customer.id)),
    [customers, existingCustomerIds]
  );
  const hasCustomerQuery = customerQuery.trim().length > 0;
  const filteredAvailableCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return availableCustomers.filter((customer) => customer.name.toLowerCase().includes(query));
  }, [availableCustomers, customerQuery]);

  async function onSubmit() {
    if (!selectedCustomerId) {
      setError("Select a customer.");
      return;
    }

    const startDate = parseDateInput(startDateInput);
    if (!startDate) {
      setError("Select a valid start date.");
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
      await createCustomerSubscription({
        customerId: selectedCustomerId,
        priceInPaise,
        startDate,
        billingType
      });
      navigate("/subscriptions", { state: { flashMessage: "Subscription added" } });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to add subscription.");
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
          <h2 className="text-lg font-semibold">Add Subscription</h2>
        </div>

        <Card className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs text-text-secondary">Customer</span>
            <div className="relative">
              <Input
                value={customerQuery}
                onFocus={() => setCustomerOptionsOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setCustomerOptionsOpen(false), 120);
                }}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  setCustomerOptionsOpen(true);
                  setSelectedCustomerId("");
                }}
                placeholder="Search and select customer"
              />
              {customerOptionsOpen && hasCustomerQuery ? (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-control border border-border-strong bg-bg-elevated p-1">
                  {filteredAvailableCustomers.length === 0 ? (
                    <p className="px-2 py-2 text-sm text-text-secondary">No customers found.</p>
                  ) : null}
                  {filteredAvailableCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="w-full rounded-control px-2 py-2 text-left text-sm hover:bg-bg-surface"
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        setCustomerQuery(customer.name);
                        setCustomerOptionsOpen(false);
                      }}
                    >
                      {customer.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>

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
            <Input type="date" value={startDateInput} onChange={(event) => setStartDateInput(event.target.value)} />
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

          {!loading && availableCustomers.length === 0 ? (
            <p className="text-sm text-text-secondary">All customers already have subscriptions.</p>
          ) : null}
          {loading ? <p className="text-sm text-text-secondary">Loading customers...</p> : null}
        </Card>

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>

      <div className="sticky bottom-0 border-t border-border-subtle bg-bg-primary/95 p-3 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">
          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={saving || loading || availableCustomers.length === 0}
            className="w-full text-base font-semibold"
          >
            {saving ? "Saving..." : "Add Subscription"}
          </Button>
        </div>
      </div>
    </div>
  );
}
