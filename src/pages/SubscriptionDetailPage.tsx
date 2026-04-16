import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { formatInrFromPaise } from "@/lib/money";
import {
  getSubscriptionById,
  listSubscriptionMembersBySubscription,
  listCustomers,
  updateSubscriptionMemberStatus
} from "@/services/firestore";
import type { Customer, Subscription, SubscriptionMember, SubscriptionMemberStatus } from "@/types/models";

interface MemberWithCustomer extends SubscriptionMember {
  customerName: string;
}

export function SubscriptionDetailPage() {
  const { subscriptionId } = useParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [members, setMembers] = useState<MemberWithCustomer[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubscriptionMemberStatus | "all">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!subscriptionId) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [sub, membersRaw, customers] = await Promise.all([
          getSubscriptionById(subscriptionId),
          listSubscriptionMembersBySubscription(subscriptionId),
          listCustomers()
        ]);
        if (!sub) {
          setError("Subscription not found.");
          setLoading(false);
          return;
        }
        setSubscription(sub);
        const customerMap = new Map<string, Customer>(customers.map((c) => [c.id, c]));
        const merged: MemberWithCustomer[] = membersRaw.map((member) => ({
          ...member,
          customerName: customerMap.get(member.customerId)?.name ?? member.customerId
        }));
        setMembers(merged);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load subscription.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [subscriptionId]);

  const filteredMembers = useMemo(() => {
    if (statusFilter === "all") {
      return members;
    }
    return members.filter((member) => member.status === statusFilter);
  }, [members, statusFilter]);

  async function changeStatus(member: MemberWithCustomer, status: SubscriptionMemberStatus) {
    try {
      await updateSubscriptionMemberStatus(member.id, status);
      setMembers((prev) =>
        prev.map((item) => (item.id === member.id ? { ...item, status } : item))
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update status.");
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/subscriptions")}>
            Back
          </Button>
          <h2 className="text-lg font-semibold">Subscription Details</h2>
        </div>

        {loading ? (
          <Card>
            <p className="text-sm text-text-secondary">Loading subscription...</p>
          </Card>
        ) : null}

        {subscription ? (
          <Card className="space-y-2">
            <p className="text-xs uppercase text-text-secondary">Subscription</p>
            <p className="text-xl font-semibold">{subscription.title}</p>
            <p className="text-sm text-text-secondary">
              {formatInrFromPaise(subscription.priceInPaise)} ·{" "}
              <span className="capitalize">{subscription.duration}</span>
            </p>
            {subscription.description ? (
              <p className="text-sm text-text-secondary">{subscription.description}</p>
            ) : null}
          </Card>
        ) : null}

        <Card className="space-y-3">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm font-semibold">Subscribers</p>
            <div className="flex flex-wrap gap-2">
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as SubscriptionMemberStatus | "all")}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
                <option value="all">All</option>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/subscriptions/${subscriptionId}/add-existing`)}
              >
                Add Existing Customer
              </Button>
              <Button
                type="button"
                onClick={() => navigate(`/subscriptions/${subscriptionId}/create-customer`)}
              >
                Create New Customer
              </Button>
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <p className="text-sm text-text-secondary">No subscribers for this filter.</p>
          ) : null}

          <div className="space-y-2">
            {filteredMembers.map((member) => (
              <article
                key={member.id}
                className="rounded-control border border-border-subtle bg-bg-surface p-3 text-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{member.customerName}</p>
                    <p className="text-xs text-text-secondary">
                      Status: <span className="capitalize">{member.status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => navigate(`/subscriptions/${subscriptionId}/member/${member.id}`)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Card>

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>
    </div>
  );
}

