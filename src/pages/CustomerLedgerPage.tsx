import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatInrFromPaise } from "@/lib/money";
import { getCustomerById, listOrdersByCustomer, listPaymentsByCustomer } from "@/services/firestore";
import type { Customer } from "@/types/models";

interface LedgerEntry {
  id: string;
  type: "Order" | "Payment";
  amountInPaise: number;
  createdAtMs: number;
}

interface LedgerRow extends LedgerEntry {
  runningBalanceInPaise: number;
}

function formatLedgerDate(createdAtMs: number): string {
  if (createdAtMs <= 0) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(createdAtMs));
}

function toBalanceLabel(balanceInPaise: number): string {
  if (balanceInPaise > 0) {
    return `Outstanding: ${formatInrFromPaise(balanceInPaise)}`;
  }
  if (balanceInPaise < 0) {
    return `Advance Credit: ${formatInrFromPaise(Math.abs(balanceInPaise))}`;
  }
  return "No Outstanding Balance";
}

function toBalanceTone(balanceInPaise: number): string {
  if (balanceInPaise > 0) {
    return "text-red-200";
  }
  if (balanceInPaise < 0) {
    return "text-emerald-300";
  }
  return "text-text-secondary";
}

export function CustomerLedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    const customerId = id;
    if (!customerId) {
      return;
    }

    async function loadLedger(customerIdValue: string) {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const [customerResult, orderResult, paymentResult] = await Promise.all([
          getCustomerById(customerIdValue),
          listOrdersByCustomer(customerIdValue),
          listPaymentsByCustomer(customerIdValue)
        ]);
        if (!customerResult) {
          setNotFound(true);
          return;
        }
        setCustomer(customerResult);
        const mergedEntries: LedgerEntry[] = [
          ...orderResult.map((order) => ({
            id: order.id,
            type: "Order" as const,
            amountInPaise: order.grandTotalInPaise,
            createdAtMs: order.createdAt?.toMillis() ?? 0
          })),
          ...paymentResult.map((payment) => ({
            id: payment.id,
            type: "Payment" as const,
            amountInPaise: payment.amountInPaise,
            createdAtMs: payment.createdAt?.toMillis() ?? 0
          }))
        ].sort((a, b) => b.createdAtMs - a.createdAtMs);
        setEntries(mergedEntries);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load ledger.");
      } finally {
        setLoading(false);
      }
    }

    void loadLedger(customerId);
  }, [id]);

  const rows = useMemo<LedgerRow[]>(() => {
    if (!customer) {
      return [];
    }
    let runningBalance = customer.currentBalanceInPaise;
    return entries.map((entry) => {
      const row: LedgerRow = {
        ...entry,
        runningBalanceInPaise: runningBalance
      };
      runningBalance = entry.type === "Order" ? runningBalance - entry.amountInPaise : runningBalance + entry.amountInPaise;
      return row;
    });
  }, [customer, entries]);

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 pb-24">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate("/customers")}>
              Back
            </Button>
            <h2 className="text-lg font-semibold">Customer Ledger</h2>
          </div>
          {id ? (
            <Button type="button" onClick={() => navigate(`/customers/${id}/ledger/payment/new`)}>
              Add Payment
            </Button>
          ) : null}
        </div>

        {loading ? (
          <Card>
            <p className="text-sm text-text-secondary">Loading ledger...</p>
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

        {!loading && !notFound && customer ? (
          <>
            <Card className="space-y-2">
              <p className="text-xs uppercase text-text-secondary">Customer</p>
              <p className="text-xl font-semibold">{customer.name}</p>
              <p className={`text-sm font-medium ${toBalanceTone(customer.currentBalanceInPaise)}`}>
                {toBalanceLabel(customer.currentBalanceInPaise)}
              </p>
            </Card>

            <Card className="space-y-2">
              <p className="text-sm font-semibold">Ledger Entries</p>
              {rows.length === 0 ? <p className="text-sm text-text-secondary">No ledger entries found.</p> : null}
              {rows.map((entry) => (
                <article key={`${entry.type}-${entry.id}`} className="rounded-control border border-border-subtle bg-bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{entry.type}</p>
                      <p className="text-xs text-text-secondary">{formatLedgerDate(entry.createdAtMs)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${entry.type === "Order" ? "text-red-200" : "text-emerald-300"}`}>
                        {entry.type === "Order" ? "+" : "-"}
                        {formatInrFromPaise(entry.amountInPaise)}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Running: {formatInrFromPaise(entry.runningBalanceInPaise)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </Card>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>
    </div>
  );
}
