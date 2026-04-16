import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { toPaiseFromInput } from "@/lib/money";
import { createPayment, getCustomerById } from "@/services/firestore";

export function CustomerPaymentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const customerId = id;
    if (!customerId) {
      return;
    }

    async function loadCustomer(customerIdValue: string) {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const customer = await getCustomerById(customerIdValue);
        if (!customer) {
          setNotFound(true);
          return;
        }
        setCustomerName(customer.name);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load customer.");
      } finally {
        setLoading(false);
      }
    }

    void loadCustomer(customerId);
  }, [id]);

  async function onSubmit() {
    if (!id) {
      setError("Missing customer id.");
      return;
    }
    const amountInPaise = toPaiseFromInput(amountInput);
    if (amountInPaise <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    if (!user) {
      setError("Signed in user not found.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createPayment({
        customerId: id,
        amountInPaise,
        note: note.trim() || undefined,
        createdBy: user.uid
      });
      navigate(`/customers/${id}/ledger`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex min-h-[calc(100dvh-180px)] flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 pb-28">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => (id ? navigate(`/customers/${id}/ledger`) : navigate("/customers"))}>
            Back
          </Button>
          <h2 className="text-lg font-semibold">Add Payment</h2>
        </div>

        {loading ? (
          <Card>
            <p className="text-sm text-text-secondary">Loading customer...</p>
          </Card>
        ) : null}

        {notFound ? (
          <Card className="space-y-3">
            <p className="text-sm text-text-secondary">Customer not found.</p>
            <Button type="button" variant="secondary" onClick={() => navigate("/customers")}>
              Back to Customers
            </Button>
          </Card>
        ) : null}

        {!loading && !notFound ? (
          <Card className="space-y-4">
            <p className="text-sm text-text-secondary">Customer: {customerName}</p>

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Amount (INR)</span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                autoFocus
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Note (optional)</span>
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
          </Card>
        ) : null}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>

      {!notFound ? (
        <div className="sticky bottom-0 border-t border-border-subtle bg-bg-primary/95 p-3 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl">
            <Button type="submit" disabled={saving || loading} className="w-full text-base font-semibold">
              {saving ? "Saving..." : "Save Payment"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
