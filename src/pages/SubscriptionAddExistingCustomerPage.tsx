import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { listCustomers, getSubscriptionById, createSubscriptionMember } from "@/services/firestore";
import type { Customer, Subscription } from "@/types/models";

function computeNextBillingDate(start: Date, duration: "monthly" | "yearly"): Date {
  const year = start.getFullYear();
  const month = start.getMonth();
  const day = start.getDate();
  if (duration === "monthly") {
    return new Date(year, month + 1, day);
  }
  return new Date(year + 1, month, day);
}

export function SubscriptionAddExistingCustomerPage() {
  const { subscriptionId } = useParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!subscriptionId) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [sub, allCustomers] = await Promise.all([
          getSubscriptionById(subscriptionId),
          listCustomers()
        ]);
        if (!sub) {
          setError("Subscription not found.");
          setLoading(false);
          return;
        }
        setSubscription(sub);
        setCustomers(allCustomers);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load data.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [subscriptionId]);

  const filteredCustomers = customers.filter((customer) => {
    if (!search.trim()) {
      return true;
    }
    const lowered = search.toLowerCase();
    return customer.name.toLowerCase().includes(lowered);
  });

  async function attachCustomer(customer: Customer) {
    if (!subscriptionId || !subscription) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const today = new Date();
      const nextBilling = computeNextBillingDate(today, subscription.duration);
      await createSubscriptionMember({
        subscriptionId,
        customerId: customer.id,
        startDate: today,
        nextBillingDate: nextBilling
      });
      navigate(`/subscriptions/${subscriptionId}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to add subscriber.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/subscriptions/${subscriptionId}`)}
          >
            Back
          </Button>
          <h2 className="text-lg font-semibold">Add Existing Customer</h2>
        </div>

        {subscription ? (
          <Card className="space-y-1">
            <p className="text-xs uppercase text-text-secondary">Subscription</p>
            <p className="text-sm font-semibold">{subscription.title}</p>
          </Card>
        ) : null}

        <Card className="space-y-3">
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Search Customer</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name"
            />
          </label>

          {loading ? <p className="text-sm text-text-secondary">Loading customers...</p> : null}
          {!loading && filteredCustomers.length === 0 ? (
            <p className="text-sm text-text-secondary">No customers found.</p>
          ) : null}

          <div className="space-y-2">
            {filteredCustomers.map((customer) => (
              <article
                key={customer.id}
                className="flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-bg-surface p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-xs text-text-secondary">{customer.phone}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void attachCustomer(customer)}
                >
                  Add
                </Button>
              </article>
            ))}
          </div>
        </Card>

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>
    </div>
  );
}

