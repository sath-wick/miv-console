import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getSubscriptionById, listSubscriptionMembersBySubscription, listCustomers, updateSubscriptionMemberStatus } from "@/services/firestore";
import type { Customer, Subscription, SubscriptionMember, SubscriptionMemberStatus } from "@/types/models";

interface MemberWithCustomer extends SubscriptionMember {
  customerName: string;
}

export function SubscriptionMemberDetailPage() {
  const { subscriptionId, memberId } = useParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [member, setMember] = useState<MemberWithCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!subscriptionId || !memberId) {
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
        const baseMember = membersRaw.find((m) => m.id === memberId) ?? null;
        if (!baseMember) {
          setError("Member not found.");
          setLoading(false);
          return;
        }
        setMember({
          ...baseMember,
          customerName: customerMap.get(baseMember.customerId)?.name ?? baseMember.customerId
        });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load subscriber.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [subscriptionId, memberId]);

  async function changeStatus(status: SubscriptionMemberStatus) {
    if (!member) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateSubscriptionMemberStatus(member.id, status);
      setMember({ ...member, status });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/subscriptions/${subscriptionId}`)}
          >
            Back
          </Button>
          <h2 className="text-lg font-semibold">Subscriber Details</h2>
        </div>

        {loading ? (
          <Card>
            <p className="text-sm text-text-secondary">Loading...</p>
          </Card>
        ) : null}

        {subscription ? (
          <Card className="space-y-1">
            <p className="text-xs uppercase text-text-secondary">Subscription</p>
            <p className="text-sm font-semibold">{subscription.title}</p>
          </Card>
        ) : null}

        {member ? (
          <Card className="space-y-3">
            <div>
              <p className="text-xs uppercase text-text-secondary">Customer</p>
              <p className="text-base font-semibold">{member.customerName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={member.status === "active" ? "primary" : "secondary"}
                disabled={saving}
                onClick={() => void changeStatus("active")}
              >
                Resume
              </Button>
              <Button
                type="button"
                variant={member.status === "paused" ? "primary" : "secondary"}
                disabled={saving}
                onClick={() => void changeStatus("paused")}
              >
                Pause
              </Button>
              <Button
                type="button"
                variant={member.status === "cancelled" ? "primary" : "secondary"}
                disabled={saving}
                onClick={() => void changeStatus("cancelled")}
              >
                Cancel
              </Button>
            </div>
          </Card>
        ) : null}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>
    </div>
  );
}

