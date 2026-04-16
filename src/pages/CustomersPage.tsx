import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { deleteCustomer, listCustomers } from "@/services/firestore";
import type { Customer } from "@/types/models";

function formatLastOrderDate(customer: Customer): string {
  if (!customer.lastOrderAt) {
    return "No orders yet";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(customer.lastOrderAt.toDate());
}

export function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await listCustomers({ search });
      setCustomers(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [search]);

  async function onDelete(customer: Customer) {
    const shouldDelete = window.confirm(`Delete customer ${customer.name}?`);
    if (!shouldDelete) {
      return;
    }
    try {
      await deleteCustomer(customer.id);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete customer.");
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <Card className="space-y-3">
        <Input
          value={search}
          placeholder="Search customer..."
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button onClick={() => navigate("/customers/new")}>Add Customer</Button>
      </Card>

      <Card className="space-y-2">
        {loading ? <p className="text-sm text-text-secondary">Loading customers...</p> : null}
        {!loading && customers.length === 0 ? <p className="text-sm text-text-secondary">No customers found.</p> : null}
        {customers.map((customer) => (
          <article key={customer.id} className="rounded-control border border-border-subtle bg-bg-surface p-3">
            <div className="space-y-1">
              <p className="font-medium">{customer.name}</p>
              <p className="text-sm text-text-secondary">{customer.phone}</p>
              <p className="text-xs text-text-secondary">Last order: {formatLastOrderDate(customer)}</p>
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => navigate(`/customers/${customer.id}/edit`)}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => void onDelete(customer)}>
                Delete
              </Button>
            </div>
          </article>
        ))}
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </Card>
    </div>
  );
}
