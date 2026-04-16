import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createCustomer, createSubscriptionMember, getSubscriptionById } from "@/services/firestore";
import type { Subscription } from "@/types/models";

function computeNextBillingDate(start: Date, duration: "monthly" | "yearly"): Date {
  const year = start.getFullYear();
  const month = start.getMonth();
  const day = start.getDate();
  if (duration === "monthly") {
    return new Date(year, month + 1, day);
  }
  return new Date(year + 1, month, day);
}

export function SubscriptionCreateCustomerPage() {
  const { subscriptionId } = useParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureSubscriptionLoaded() {
    if (!subscriptionId || subscription) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sub = await getSubscriptionById(subscriptionId);
      if (!sub) {
        setError("Subscription not found.");
      } else {
        setSubscription(sub);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load subscription.");
    } finally {
      setLoading(false);
    }
  }

  void ensureSubscriptionLoaded();

  async function onSubmit() {
    if (!subscriptionId || !subscription) {
      setError("Subscription not found.");
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Name, phone and address are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const customerPayload = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim()
      };
      // createCustomer does not return id, so we create directly here for subscription flow
      const today = new Date();
      const nextBilling = computeNextBillingDate(today, subscription.duration);

      const db = (await import("@/lib/firebase")).db;
      if (!db) {
        throw new Error("Firebase is not configured.");
      }
      const { addDoc, collection, serverTimestamp, Timestamp } = await import("firebase/firestore");
      const customerRef = await addDoc(collection(db, "customers"), {
        ...customerPayload,
        currentBalanceInPaise: 0,
        lastOrderAt: null,
        lastPaymentAt: null,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await createSubscriptionMember({
        subscriptionId,
        customerId: customerRef.id,
        startDate: today,
        nextBillingDate: nextBilling
      });

      navigate(`/subscriptions/${subscriptionId}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 pb-28">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/subscriptions/${subscriptionId}`)}
          >
            Back
          </Button>
          <h2 className="text-lg font-semibold">Create Customer</h2>
        </div>

        {subscription ? (
          <Card className="space-y-1">
            <p className="text-xs uppercase text-text-secondary">Subscription</p>
            <p className="text-sm font-semibold">{subscription.title}</p>
          </Card>
        ) : null}

        <Card className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs text-text-secondary">Customer Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-text-secondary">Phone Number</span>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-text-secondary">Address</span>
            <Input value={address} onChange={(event) => setAddress(event.target.value)} />
          </label>
        </Card>

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>

      <div className="sticky bottom-0 border-t border-border-subtle bg-bg-primary/95 p-3 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">
          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={saving}
            className="w-full text-base font-semibold"
          >
            {saving ? "Saving..." : "Create & Attach"}
          </Button>
        </div>
      </div>
    </div>
  );
}
