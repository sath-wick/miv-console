import { describe, expect, it } from "vitest";
import { buildCreateOrderPayload, buildDeliveredPayload } from "@/services/orderPayload";
import type { OrderItem } from "@/types/models";

const items: OrderItem[] = [
  {
    inventoryItemId: "item-1",
    name: "Idli",
    unitPriceInPaise: 3000,
    quantity: 2,
    lineTotalInPaise: 6000
  }
];

describe("order payload builder", () => {
  it("sets status default to pending and uses timestamp factory", () => {
    const stamp = { server: true };
    const payload = buildCreateOrderPayload(
      {
        dateKey: "2026-02-23",
        customerId: "cust-1",
        customerName: "Savithri",
        mealType: "breakfast",
        items,
        subtotalInPaise: 6000,
        deliveryMode: "within3km",
        deliveryChargeInPaise: 3000,
        grandTotalInPaise: 9000,
        createdBy: "admin-1"
      },
      () => stamp
    );

    expect(payload.status).toBe("pending");
    expect(payload.createdAt).toBe(stamp);
    expect(payload.updatedAt).toBe(stamp);
    expect(payload.deliveredAt).toBeNull();
  });

  it("supports optional assignedCourierId without breaking payload", () => {
    const payload = buildCreateOrderPayload(
      {
        dateKey: "2026-02-23",
        customerId: "cust-1",
        customerName: "Savithri",
        mealType: "breakfast",
        items,
        subtotalInPaise: 6000,
        deliveryMode: "within3km",
        deliveryChargeInPaise: 3000,
        grandTotalInPaise: 9000,
        createdBy: "admin-1",
        assignedCourierId: "courier-1"
      },
      () => ({ ts: true })
    );

    expect(payload.assignedCourierId).toBe("courier-1");
  });

  it("builds delivered payload using timestamp factory", () => {
    const stamp = { server: true };
    const payload = buildDeliveredPayload(() => stamp);
    expect(payload.status).toBe("delivered");
    expect(payload.deliveredAt).toBe(stamp);
    expect(payload.updatedAt).toBeUndefined();
  });
});
