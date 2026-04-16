import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Input } from "@/components/ui/Input";
import {
  listCustomerSubscriptions,
  listCustomers,
  listCustomersWithDue,
  listOrdersByDateRange,
  listOrdersByCustomer,
  listPaymentsByCreatedAtRange
} from "@/services/firestore";
import { formatInrFromPaise } from "@/lib/money";
import type { Customer, Order } from "@/types/models";

const SUBSCRIPTION_PRICE_IN_PAISE = 0;

interface HistorySummary {
  cashCollectedInPaise: number;
  operationalSalesInPaise: number;
  subscriptionCashCollectedInPaise: number;
  totalOutstandingInPaise: number;
  undeliveredOrdersCount: number;
  projectedSubscriptionValueInPaise: number;
}

const EMPTY_SUMMARY: HistorySummary = {
  cashCollectedInPaise: 0,
  operationalSalesInPaise: 0,
  subscriptionCashCollectedInPaise: 0,
  totalOutstandingInPaise: 0,
  undeliveredOrdersCount: 0,
  projectedSubscriptionValueInPaise: 0
};

function signedPaymentAmountInPaise(payment: { amountInPaise: number; settlementSide?: "due" | "undue" }): number {
  return payment.settlementSide === "undue" ? -payment.amountInPaise : payment.amountInPaise;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function HistoryPage() {
  const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>(() => {
    const today = new Date();
    return { startDate: today, endDate: today };
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<HistorySummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState<"breakfast" | "lunch" | "dinner">("breakfast");
  const [view, setView] = useState<
    "summary" | "revenueDetail" | "subscriptionDetail" | "customerHistoryList" | "customerHistoryDetail"
  >("summary");
  const [customerHistorySearch, setCustomerHistorySearch] = useState("");
  const [customerHistoryCustomers, setCustomerHistoryCustomers] = useState<Customer[]>([]);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerOrders, setSelectedCustomerOrders] = useState<Order[]>([]);

  const mealSummaries = useMemo(() => {
    function summarize(mealType: "breakfast" | "lunch" | "dinner") {
      const mealOrders = orders.filter((order) => order.mealType === mealType);
      const mealTotal = mealOrders.reduce((sum, order) => sum + order.subtotalInPaise, 0);
      const deliveryTotal = mealOrders.reduce((sum, order) => sum + order.deliveryChargeInPaise, 0);
      const grandTotal = mealOrders.reduce((sum, order) => sum + order.grandTotalInPaise, 0);
      return { count: mealOrders.length, mealTotal, deliveryTotal, grandTotal };
    }

    return {
      breakfast: summarize("breakfast"),
      lunch: summarize("lunch"),
      dinner: summarize("dinner")
    };
  }, [orders]);

  async function fetchOrders(nextRange: { startDate: Date | null; endDate: Date | null }) {
    if (!nextRange.startDate) {
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const endDate = nextRange.endDate ?? nextRange.startDate;
      const startDateKey = toLocalDateKey(nextRange.startDate);
      const endDateKey = toLocalDateKey(endDate);
      const fromDateKey = startDateKey <= endDateKey ? startDateKey : endDateKey;
      const toDateKey = startDateKey <= endDateKey ? endDateKey : startDateKey;
      const [orderResult, paymentResult, dueCustomers, customerSubscriptions] = await Promise.all([
        listOrdersByDateRange(fromDateKey, toDateKey),
        listPaymentsByCreatedAtRange(nextRange.startDate, endDate),
        listCustomersWithDue(),
        listCustomerSubscriptions()
      ]);

      const subscriptionIds = new Set(customerSubscriptions.map((entry) => entry.customerId));
      const subscriptionPayments = paymentResult.filter((payment) =>
        payment.customerTypeAtPayment
          ? payment.customerTypeAtPayment === "subscription"
          : subscriptionIds.has(payment.customerId)
      );

      setOrders(orderResult);
      setSummary({
        cashCollectedInPaise: paymentResult.reduce(
          (sum, payment) => sum + signedPaymentAmountInPaise(payment),
          0
        ),
        operationalSalesInPaise: orderResult.reduce(
          (sum, order) => sum + order.grandTotalInPaise,
          0
        ),
        subscriptionCashCollectedInPaise: subscriptionPayments.reduce(
          (sum, payment) => sum + signedPaymentAmountInPaise(payment),
          0
        ),
        totalOutstandingInPaise: dueCustomers.reduce((sum, customer) => sum + customer.currentBalanceInPaise, 0),
        undeliveredOrdersCount: orderResult.filter((order) => order.status !== "delivered").length,
        projectedSubscriptionValueInPaise: customerSubscriptions.length * SUBSCRIPTION_PRICE_IN_PAISE
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOrders(dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCustomerHistoryList(search: string) {
    setCustomerHistoryLoading(true);
    try {
      const customers = await listCustomers({ search, sortBy: "name" });
      setCustomerHistoryCustomers(customers);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load customers.");
    } finally {
      setCustomerHistoryLoading(false);
    }
  }

  async function openCustomerHistory() {
    setView("customerHistoryList");
    await loadCustomerHistoryList(customerHistorySearch);
  }

  async function openCustomerOrders(customer: Customer) {
    setSelectedCustomer(customer);
    setView("customerHistoryDetail");
    try {
      const orders = await listOrdersByCustomer(customer.id);
      setSelectedCustomerOrders(orders);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load customer orders.");
    }
  }

  if (view === "customerHistoryList") {
    return (
      <div className="space-y-6">
        <section className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Customer Order History</h2>
              <button
                type="button"
                className="text-xs text-text-secondary underline-offset-2 hover:underline"
                onClick={() => setView("summary")}
              >
                Back to Summary
              </button>
            </div>
            <label className="space-y-1">
              <span className="text-xs text-text-secondary">Search Customer</span>
              <Input
                value={customerHistorySearch}
                onChange={(event) => {
                  const next = event.target.value;
                  setCustomerHistorySearch(next);
                  void loadCustomerHistoryList(next);
                }}
                placeholder="Search customer"
              />
            </label>
          </Card>

          <Card className="space-y-2">
            {customerHistoryLoading ? (
              <p className="text-sm text-text-secondary">Loading customers...</p>
            ) : null}
            {!customerHistoryLoading && customerHistoryCustomers.length === 0 ? (
              <p className="text-sm text-text-secondary">No customers found.</p>
            ) : null}
            {customerHistoryCustomers.map((customer) => (
              <article
                key={customer.id}
                className="flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-bg-surface p-3"
              >
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-xs text-text-secondary">{customer.phone}</p>
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-accent-soft underline-offset-2 hover:underline"
                  onClick={() => void openCustomerOrders(customer)}
                >
                  View Orders
                </button>
              </article>
            ))}
          </Card>
        </section>
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>
    );
  }

  if (view === "customerHistoryDetail" && selectedCustomer) {
    return (
      <div className="space-y-6">
        <section className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase text-text-secondary">Customer</p>
                <p className="text-lg font-semibold">{selectedCustomer.name}</p>
              </div>
              <button
                type="button"
                className="text-xs text-text-secondary underline-offset-2 hover:underline"
                onClick={() => setView("customerHistoryList")}
              >
                Back to Customers
              </button>
            </div>
          </Card>

          <Card className="space-y-2">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-border-subtle pb-2 text-xs uppercase text-text-secondary">
              <span>Meal Type</span>
              <span className="text-right">Meal Total</span>
              <span className="text-right">Delivery</span>
              <span className="text-right">Total</span>
            </div>
            {selectedCustomerOrders.length === 0 ? (
              <p className="py-2 text-sm text-text-secondary">No orders found for this customer.</p>
            ) : null}
            {selectedCustomerOrders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_1fr] items-start border-b border-border-subtle py-3 text-sm"
              >
                <span className="capitalize text-text-secondary">{order.mealType}</span>
                <span className="text-right">{formatInrFromPaise(order.subtotalInPaise)}</span>
                <span className="text-right">{formatInrFromPaise(order.deliveryChargeInPaise)}</span>
                <span className="text-right font-medium">{formatInrFromPaise(order.grandTotalInPaise)}</span>
              </div>
            ))}
          </Card>
        </section>
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>
    );
  }

  if (view === "revenueDetail") {
    return (
      <div className="space-y-6">
        <section className="space-y-4">
          <Card className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase text-text-secondary">Revenue Breakdown</p>
                <p className="text-base font-semibold">Revenue Generated</p>
              </div>
              <button
                type="button"
                className="text-xs text-text-secondary underline-offset-2 hover:underline"
                onClick={() => setView("summary")}
              >
                Back to Summary
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="space-y-1">
                <p className="text-xs uppercase text-text-secondary">Cash Collected</p>
                <p className="text-2xl font-semibold">
                  {formatInrFromPaise(summary.cashCollectedInPaise)}
                </p>
              </Card>
              <Card className="space-y-1">
                <p className="text-xs uppercase text-text-secondary">Operational Sales (Billing Date)</p>
                <p className="text-2xl font-semibold">
                  {formatInrFromPaise(summary.operationalSalesInPaise)}
                </p>
              </Card>
              <Card className="space-y-1">
                <p className="text-xs uppercase text-text-secondary">Total Outstanding (All-Time)</p>
                <p className="text-2xl font-semibold">
                  {formatInrFromPaise(summary.totalOutstandingInPaise)}
                </p>
              </Card>
              <Card className="space-y-1">
                <p className="text-xs uppercase text-text-secondary">Undelivered Orders</p>
                <p className="text-2xl font-semibold">{summary.undeliveredOrdersCount}</p>
              </Card>
            </div>
          </Card>
        </section>
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>
    );
  }

  if (view === "subscriptionDetail") {
    return (
      <div className="space-y-6">
        <section className="space-y-4">
          <Card className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase text-text-secondary">Subscription Breakdown</p>
                <p className="text-base font-semibold">Subscription Amount</p>
              </div>
              <button
                type="button"
                className="text-xs text-text-secondary underline-offset-2 hover:underline"
                onClick={() => setView("summary")}
              >
                Back to Summary
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="space-y-1">
                <p className="text-xs uppercase text-text-secondary">Subscription Cash Collected</p>
                <p className="text-2xl font-semibold">
                  {formatInrFromPaise(summary.subscriptionCashCollectedInPaise)}
                </p>
              </Card>
              <Card className="space-y-1">
                <p className="text-xs uppercase text-text-secondary">Projected Subscription Value</p>
                <p className="text-2xl font-semibold">
                  {formatInrFromPaise(summary.projectedSubscriptionValueInPaise)}
                </p>
              </Card>
            </div>
            <p className="text-xs text-text-secondary">
              Projected Subscription Value is not revenue; it is estimated as active subscribers multiplied by
              subscription price.
            </p>
          </Card>
        </section>
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <Card className="space-y-4">
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Select Date Range</span>
            <DateRangePicker
              value={dateRange}
              onChange={(nextRange) => {
                setDateRange(nextRange);
                if (!nextRange.startDate) {
                  setOrders([]);
                  setSummary(EMPTY_SUMMARY);
                  setError(null);
                  return;
                }
                void fetchOrders(nextRange);
              }}
            />
          </label>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            className="text-left"
            onClick={() => setView("revenueDetail")}
          >
            <Card className="space-y-1">
              <p className="text-[11px] uppercase text-text-secondary">Cash Collected</p>
              <p className="text-3xl font-semibold leading-tight">
                {formatInrFromPaise(summary.cashCollectedInPaise)}
              </p>
            </Card>
          </button>
          <button
            type="button"
            className="text-left"
            onClick={() => setView("subscriptionDetail")}
          >
            <Card className="space-y-1">
              <p className="text-[11px] uppercase text-text-secondary">Operational Sales (Billing Date)</p>
              <p className="text-3xl font-semibold leading-tight">
                {formatInrFromPaise(summary.operationalSalesInPaise)}
              </p>
            </Card>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="space-y-1">
            <p className="text-[11px] uppercase text-text-secondary">Subscription Cash Collected</p>
            <p className="text-3xl font-semibold leading-tight">
              {formatInrFromPaise(summary.subscriptionCashCollectedInPaise)}
            </p>
          </Card>
          <Card className="space-y-1">
            <p className="text-[11px] uppercase text-text-secondary">Total Outstanding (All-Time)</p>
            <p className="text-3xl font-semibold leading-tight">
              {formatInrFromPaise(summary.totalOutstandingInPaise)}
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="space-y-1">
            <p className="text-[11px] uppercase text-text-secondary">Undelivered Orders</p>
            <p className="text-3xl font-semibold leading-tight">{summary.undeliveredOrdersCount}</p>
          </Card>
          <Card className="space-y-1">
            <p className="text-[11px] uppercase text-text-secondary">Projected Subscription Value</p>
            <p className="text-3xl font-semibold leading-tight">
              {formatInrFromPaise(summary.projectedSubscriptionValueInPaise)}
            </p>
          </Card>
        </div>

        <button
          type="button"
          className="w-full text-left"
          onClick={() => void openCustomerHistory()}
        >
          <Card className="space-y-1">
            <p className="text-xs uppercase text-text-secondary">Customer Order History</p>
          </Card>
        </button>
      </section>

      <section className="space-y-4">
        {(["breakfast", "lunch", "dinner"] as const).map((meal) => {
          const summaryForMeal = mealSummaries[meal];
          return (
            <article key={meal} className="rounded-card border border-border-subtle bg-bg-elevated p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setExpandedMeal(meal)}
              >
                <div>
                  <h3 className="text-base font-semibold capitalize">{meal}</h3>
                  <p className="text-xs text-text-secondary">{summaryForMeal.count} orders</p>
                </div>
                {expandedMeal === meal ? null : (
                  <span className="text-xs text-text-secondary">Expand</span>
                )}
              </button>
              {expandedMeal === meal ? (
                <div className="mt-4 space-y-2 border-t border-border-subtle pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Meal Total</span>
                    <span className="text-right">{formatInrFromPaise(summaryForMeal.mealTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Delivery Total</span>
                    <span className="text-right">{formatInrFromPaise(summaryForMeal.deliveryTotal)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-control border border-border-strong bg-bg-surface px-3 py-2">
                    <span className="font-semibold">Grand Total</span>
                    <span className="text-xl font-semibold text-right">
                      {formatInrFromPaise(summaryForMeal.grandTotal)}
                    </span>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
