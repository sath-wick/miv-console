import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createCustomer, listCustomers, updateCustomer } from "@/services/firestore";

interface CustomerFormState {
  name: string;
  phone: string;
  address: string;
}

const EMPTY_FORM: CustomerFormState = {
  name: "",
  phone: "",
  address: ""
};

export function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [formState, setFormState] = useState<CustomerFormState>(EMPTY_FORM);

  const title = useMemo(() => (isEdit ? "Edit Customer" : "Create Customer"), [isEdit]);

  useEffect(() => {
    if (!isEdit || !id) {
      return;
    }

    async function loadCustomer() {
      setLoading(true);
      setError(null);
      try {
        const customers = await listCustomers();
        const customer = customers.find((entry) => entry.id === id);
        if (!customer) {
          setNotFound(true);
          return;
        }
        setFormState({
          name: customer.name,
          phone: customer.phone,
          address: customer.address
        });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load customer.");
      } finally {
        setLoading(false);
      }
    }

    void loadCustomer();
  }, [id, isEdit]);

  async function onSave() {
    if (!formState.name.trim() || !formState.phone.trim() || !formState.address.trim()) {
      setError("Name, phone and address are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: formState.name,
        phone: formState.phone,
        address: formState.address
      };
      if (isEdit && id) {
        await updateCustomer(id, payload);
      } else {
        await createCustomer(payload);
      }
      navigate("/customers");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 pb-28">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/customers")}>
            Back
          </Button>
          <h2 className="text-lg font-semibold">{title}</h2>
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
            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Customer Name</span>
              <Input
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Phone Number</span>
              <Input
                value={formState.phone}
                onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Address</span>
              <Input
                value={formState.address}
                onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
              />
            </label>

          </Card>
        ) : null}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>

      {!notFound ? (
        <div className="sticky bottom-0 border-t border-border-subtle bg-bg-primary/95 p-3 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl">
            <Button onClick={() => void onSave()} disabled={saving || loading} className="w-full text-base font-semibold">
              {saving ? "Saving..." : isEdit ? "Update Customer" : "Create Customer"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
