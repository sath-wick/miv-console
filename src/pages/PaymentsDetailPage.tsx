import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatInrFromPaise } from "@/lib/money";
import { getCustomerById, listOrdersByCustomer, listPaymentsByCustomer } from "@/services/firestore";
import type { Customer } from "@/types/models";

type TimelineEntry =
  | {
      id: string;
      type: "order";
      label: string;
      amountInPaise: number;
      atMs: number;
      dateLabel: string;
    }
  | {
      id: string;
      type: "settlement";
      label: string;
      amountInPaise: number;
      atMs: number;
      dateLabel: string;
    };

function toDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function fromDateKeyLabel(dateKey: string): string {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return "-";
  }
  return toDateLabel(new Date(year, month - 1, day));
}

function fromDateKeyMs(dateKey: string): number {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return 0;
  }
  return new Date(year, month - 1, day).getTime();
}

export function PaymentsDetailPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadData(id: string) {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const [customerResult, ordersResult, paymentsResult] = await Promise.all([
          getCustomerById(id),
          listOrdersByCustomer(id),
          listPaymentsByCustomer(id)
        ]);
        if (!customerResult) {
          setNotFound(true);
          return;
        }
        setCustomer(customerResult);

        const orderEntries: TimelineEntry[] = ordersResult.map((order) => ({
          id: order.id,
          type: "order",
          label: order.mealType.charAt(0).toUpperCase() + order.mealType.slice(1),
          amountInPaise: order.grandTotalInPaise,
          atMs: fromDateKeyMs(order.dateKey),
          dateLabel: fromDateKeyLabel(order.dateKey)
        }));

        const settlementEntries: TimelineEntry[] = paymentsResult.map((payment) => ({
          id: payment.id,
          type: "settlement",
          label: payment.settlementSide === "undue" ? "Undue Settlement" : "Due Settlement",
          amountInPaise: payment.amountInPaise,
          atMs: payment.createdAt?.toMillis() ?? 0,
          dateLabel: payment.createdAt ? toDateLabel(payment.createdAt.toDate()) : "-"
        }));

        setEntries([...orderEntries, ...settlementEntries].sort((a, b) => a.atMs - b.atMs));
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load payments detail.");
      } finally {
        setLoading(false);
      }
    }

    if (!customerId) {
      return;
    }
    void loadData(customerId);
  }, [customerId]);

  const balanceText = useMemo(() => {
    if (!customer) {
      return "";
    }
    if (customer.currentBalanceInPaise > 0) {
      return `Due: ${formatInrFromPaise(customer.currentBalanceInPaise)}`;
    }
    if (customer.currentBalanceInPaise < 0) {
      return `Undue: ${formatInrFromPaise(Math.abs(customer.currentBalanceInPaise))}`;
    }
    return "No balance";
  }, [customer]);

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => navigate("/payments")}>
          Back
        </Button>
        <h2 className="text-lg font-semibold">Settlement History</h2>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-text-secondary">Loading...</p>
        </Card>
      ) : null}

      {notFound ? (
        <Card className="space-y-3">
          <p className="text-sm text-text-secondary">Customer not found.</p>
          <Button type="button" variant="secondary" onClick={() => navigate("/payments")}>
            Back to Payments
          </Button>
        </Card>
      ) : null}

      {!loading && !notFound && customer ? (
        <Card className="space-y-1">
          <p className="text-xs uppercase text-text-secondary">Customer</p>
          <p className="text-xl font-semibold">{customer.name}</p>
          <p className="text-sm text-text-secondary">{balanceText}</p>
        </Card>
      ) : null}

      {!loading && !notFound ? (
        <Card className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-text-secondary">No history found.</p>
          ) : (
            entries.map((entry) => (
              <article
                key={`${entry.type}-${entry.id}`}
                className="rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{entry.label}</p>
                  <p className={entry.type === "order" ? "text-red-200" : "text-emerald-300"}>
                    {formatInrFromPaise(entry.amountInPaise)}
                  </p>
                </div>
                <p className="text-xs text-text-secondary">{entry.dateLabel}</p>
              </article>
            ))
          )}
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
