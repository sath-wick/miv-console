import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatInrFromPaise, toPaiseFromInput } from "@/lib/money";
import {
  createPayment,
  getCustomerById,
  listCustomerSubscriptions,
  listCustomers,
  settleCustomerSubscription
} from "@/services/firestore";
import type { Customer, CustomerSubscription, FirebaseFirestoreTimestamp } from "@/types/models";
import { useAuth } from "@/auth/AuthProvider";

interface PaymentsLocationState {
  prefillCustomerId?: string;
  prefillCustomerName?: string;
}

type BalanceFilter = "due" | "undue";

interface SubscriptionPaymentRow extends CustomerSubscription {
  customerName: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntilDue(dueDate: Date): number {
  const today = startOfDay(new Date()).getTime();
  const due = startOfDay(dueDate).getTime();
  return Math.floor((due - today) / MS_PER_DAY);
}

function formatDueDate(value: FirebaseFirestoreTimestamp): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value.toDate());
}

export function PaymentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const locationState = (location.state ?? {}) as PaymentsLocationState;
  const [search, setSearch] = useState(locationState.prefillCustomerName ?? "");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("due");
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subscriptionRows, setSubscriptionRows] = useState<SubscriptionPaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [earlySettlementEnabledByCustomerId, setEarlySettlementEnabledByCustomerId] = useState<
    Record<string, boolean>
  >({});

  const [highlightedCustomerId, setHighlightedCustomerId] = useState<string | undefined>(
    locationState.prefillCustomerId
  );

  // Support query param: /payments?customerId=<id>
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const customerId = params.get("customerId");
    if (!customerId) {
      return;
    }
    setHighlightedCustomerId(customerId);
    // Prefill search with customer name, if we can resolve it
    void (async () => {
      try {
        const customer = await getCustomerById(customerId);
        if (customer?.name) {
          setSearch(customer.name);
        }
      } catch {
        // Ignore lookup failures; list will still load
      }
    })();
  }, [location.search]);

  async function refreshBalances() {
    setLoading(true);
    setError(null);
    try {
      const result = await listCustomers({ search, sortBy: "highestDue" });
      setCustomers(result.filter((customer) => customer.currentBalanceInPaise !== 0));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load balances.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSubscriptions() {
    setLoading(true);
    setError(null);
    try {
      const [subscriptionResult, customerResult] = await Promise.all([
        listCustomerSubscriptions(),
        listCustomers({ search, sortBy: "name" })
      ]);
      const customerMap = new Map(customerResult.map((customer) => [customer.id, customer.name]));
      const rows = subscriptionResult
        .filter((subscription) => customerMap.has(subscription.customerId))
        .map((subscription) => ({
          ...subscription,
          customerName: customerMap.get(subscription.customerId) ?? ""
        }))
        .sort((a, b) => a.nextDueDate.toMillis() - b.nextDueDate.toMillis());
      setSubscriptionRows(rows);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (showSubscriptions) {
      void refreshSubscriptions();
      return;
    }
    void refreshBalances();
  }, [search, showSubscriptions]);

  const filteredCustomers = useMemo(() => {
    if (balanceFilter === "due") {
      return customers.filter((customer) => customer.currentBalanceInPaise > 0);
    }
    return customers.filter((customer) => customer.currentBalanceInPaise < 0);
  }, [balanceFilter, customers]);

  function onChangeAmount(customerId: string, value: string) {
    setAmountInputs((prev) => ({ ...prev, [customerId]: value }));
  }

  async function settleCustomer(customer: Customer) {
    if (!user) {
      setError("Signed in user not found.");
      return;
    }

    const currentBalanceInPaise = customer.currentBalanceInPaise;
    if (currentBalanceInPaise === 0) {
      setError("This customer has no outstanding balance.");
      return;
    }
    const isUndueBalance = currentBalanceInPaise < 0;
    const outstandingBalanceInPaise = Math.abs(currentBalanceInPaise);

    const raw = amountInputs[customer.id] ?? "";
    const trimmed = raw.trim();
    let amountInPaise = outstandingBalanceInPaise;
    let overSettling = false;

    if (trimmed) {
      amountInPaise = toPaiseFromInput(trimmed);
      if (amountInPaise <= 0) {
        window.alert("Enter a valid amount greater than zero.");
        return;
      }
      if (amountInPaise > outstandingBalanceInPaise) {
        overSettling = true;
        const excess = amountInPaise - outstandingBalanceInPaise;
        const balanceType = isUndueBalance ? "undue" : "due";
        const nextState = isUndueBalance ? "due" : "undue";
        window.alert(`Entered amount exceeds ${balanceType} by ${formatInrFromPaise(excess)}.`);
        const proceedOverSettle = window.confirm(`Continue and mark customer as ${nextState}?`);
        if (!proceedOverSettle) {
          return;
        }
      }
    }

    const balanceLabel = isUndueBalance ? "undue" : "due";
    const isFull = amountInPaise === outstandingBalanceInPaise;
    const confirmMessage = overSettling
      ? `Settle ${formatInrFromPaise(amountInPaise)} for ${customer.name}?`
      : isFull
        ? `Settle full ${balanceLabel} of ${formatInrFromPaise(outstandingBalanceInPaise)} for ${customer.name}?`
        : `Settle ${formatInrFromPaise(amountInPaise)} for ${customer.name}?`;

    const shouldProceed = window.confirm(confirmMessage);
    if (!shouldProceed) {
      return;
    }

    setError(null);
    try {
      await createPayment({
        customerId: customer.id,
        amountInPaise,
        settlementSide: isUndueBalance ? "undue" : "due",
        createdBy: user.uid
      });
      await refreshBalances();
      setAmountInputs((prev) => ({ ...prev, [customer.id]: "" }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to settle balance.");
    }
  }

  async function settleSubscription(subscription: SubscriptionPaymentRow) {
    if (!user) {
      setError("Signed in user not found.");
      return;
    }

    const raw = amountInputs[subscription.customerId] ?? "";
    const trimmed = raw.trim();
    const amountInPaise = trimmed ? toPaiseFromInput(trimmed) : subscription.priceInPaise;
    if (amountInPaise <= 0) {
      window.alert("Enter a valid amount greater than zero.");
      return;
    }

    const shouldProceed = window.confirm(
      `Settle ${formatInrFromPaise(amountInPaise)} for ${subscription.customerName}?`
    );
    if (!shouldProceed) {
      return;
    }

    setError(null);
    try {
      await settleCustomerSubscription({
        customerId: subscription.customerId,
        amountInPaise,
        createdBy: user.uid
      });
      await refreshSubscriptions();
      setAmountInputs((prev) => ({ ...prev, [subscription.customerId]: "" }));
      setEarlySettlementEnabledByCustomerId((prev) => {
        const next = { ...prev };
        delete next[subscription.customerId];
        return next;
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to settle subscription.");
    }
  }

  function enableEarlySettlement(subscription: SubscriptionPaymentRow) {
    const confirmed = window.confirm(
      `Due date is ${formatDueDate(subscription.nextDueDate)}. Do you want to settle early for ${subscription.customerName}?`
    );
    if (!confirmed) {
      return;
    }
    setEarlySettlementEnabledByCustomerId((prev) => ({ ...prev, [subscription.customerId]: true }));
  }

  const isUndueFilter = balanceFilter === "undue";

  return (
    <div className="space-y-4 pb-24">
      <Card className="space-y-3">
        <label className="space-y-1">
          <span className="text-xs text-text-secondary">Search Customer</span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
            autoFocus={Boolean(locationState.prefillCustomerName)}
          />
        </label>

        <div className="flex items-center gap-3">
          <span className={`text-sm ${!isUndueFilter ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
            Due
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isUndueFilter}
            className={`relative h-7 w-12 rounded-full border transition ${
              isUndueFilter ? "border-emerald-400/40 bg-emerald-500/20" : "border-red-300/25 bg-red-500/20"
            }`}
            onClick={() => setBalanceFilter((prev) => (prev === "due" ? "undue" : "due"))}
          >
            <span
              className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-bg-elevated shadow transition ${
                isUndueFilter ? "left-6" : "left-1"
              }`}
            />
          </button>
          <span className={`text-sm ${isUndueFilter ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
            Undue
          </span>
          <label className="ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              checked={showSubscriptions}
              onChange={(event) => {
                const checked = event.target.checked;
                setShowSubscriptions(checked);
                if (!checked) {
                  setEarlySettlementEnabledByCustomerId({});
                }
              }}
              className="h-4 w-4 rounded border-border-subtle accent-[rgb(196,106,58)]"
            />
            <span className={`text-sm ${showSubscriptions ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
              Subscriptions
            </span>
          </label>
        </div>
      </Card>

      <Card className="space-y-2">
        {loading ? (
          <p className="text-sm text-text-secondary">
            {showSubscriptions ? "Loading subscriptions..." : "Loading balances..."}
          </p>
        ) : null}
        {!loading && showSubscriptions && subscriptionRows.length === 0 ? (
          <p className="text-sm text-text-secondary">No subscription customers found.</p>
        ) : null}
        {!loading && !showSubscriptions && filteredCustomers.length === 0 ? (
          <p className="text-sm text-text-secondary">{isUndueFilter ? "No customers in undue." : "No customers with due."}</p>
        ) : null}

        {showSubscriptions ? (
          <>
            {subscriptionRows.length > 0 ? (
              <div className="grid grid-cols-[1.2fr_1fr_1.6fr] border-b border-border-subtle pb-2 text-xs uppercase text-text-secondary">
                <span>Customer Name</span>
                <span className="text-right">Due Date</span>
                <span className="text-right">Settle</span>
              </div>
            ) : null}
            {subscriptionRows.map((subscription) => {
              const isHighlighted = subscription.customerId === highlightedCustomerId;
              const amountValue = amountInputs[subscription.customerId] ?? "";
              const dueInDays = daysUntilDue(subscription.nextDueDate.toDate());
              const showSettleInput =
                dueInDays < 3 || Boolean(earlySettlementEnabledByCustomerId[subscription.customerId]);

              return (
                <article
                  key={subscription.id}
                  className={`rounded-control border bg-bg-surface p-3 ${
                    isHighlighted ? "border-accent-soft" : "border-border-subtle"
                  }`}
                >
                  <div className="grid items-center gap-3 sm:grid-cols-[1.2fr_1fr_1.6fr]">
                    <div className="space-y-1">
                      <p className="font-medium">{subscription.customerName}</p>
                      <p className="text-xs text-text-secondary">
                        Subscription Amount: {formatInrFromPaise(subscription.priceInPaise)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm">{formatDueDate(subscription.nextDueDate)}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      {showSettleInput ? (
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            pattern="[0-9]*"
                            value={amountValue}
                            onChange={(event) => onChangeAmount(subscription.customerId, event.target.value)}
                            placeholder="Amount (empty = subscription)"
                            className="sm:w-52"
                          />
                          <Button
                            type="button"
                            onClick={() => void settleSubscription(subscription)}
                            className="sm:min-w-[120px]"
                          >
                            Settle
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => enableEarlySettlement(subscription)}
                        >
                          Settle Early
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </>
        ) : (
          filteredCustomers.map((customer) => {
            const isHighlighted = customer.id === highlightedCustomerId;
            const amountValue = amountInputs[customer.id] ?? "";
            const isUndue = customer.currentBalanceInPaise < 0;
            const balanceLabel = isUndue ? "Undue" : "Due";
            const balanceClass = isUndue ? "text-emerald-300" : "text-red-200";

            return (
              <article
                key={customer.id}
                className={`space-y-2 rounded-control border bg-bg-surface p-3 ${
                  isHighlighted ? "border-accent-soft" : "border-border-subtle"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{customer.name}</p>
                    {isUndue ? (
                      <span className="rounded-control border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                        undue
                      </span>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-text-secondary">{balanceLabel}</p>
                    <p className={`text-sm font-semibold ${balanceClass}`}>
                      {formatInrFromPaise(Math.abs(customer.currentBalanceInPaise))}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amountValue}
                    onChange={(event) => onChangeAmount(customer.id, event.target.value)}
                    placeholder="Partial amount (empty = full balance)"
                    className="sm:flex-1"
                  />
                  <Button
                    type="button"
                    onClick={() => void settleCustomer(customer)}
                    className="sm:w-auto sm:min-w-[120px]"
                  >
                    Settle
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate(`/payments/${customer.id}`)}
                    className="sm:w-auto"
                  >
                    View
                  </Button>
                </div>
              </article>
            );
          })
        )}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </Card>
    </div>
  );
}
