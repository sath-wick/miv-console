import type { DeliveryMode, MealType, OrderItem } from "@/types/models";

type TimestampFactory = () => unknown;

export interface CreateOrderInput {
  dateKey: string;
  customerId: string;
  customerName: string;
  billNumber?: number;
  mealType: MealType;
  items: OrderItem[];
  subtotalInPaise: number;
  deliveryMode: DeliveryMode;
  deliveryChargeInPaise: number;
  grandTotalInPaise: number;
  createdBy: string;
  assignedCourierId?: string;
}

export function buildCreateOrderPayload(
  input: CreateOrderInput,
  timestampFactory: TimestampFactory
): Record<string, unknown> {
  return {
    ...input,
    status: "pending",
    deliveredAt: null,
    createdAt: timestampFactory(),
    updatedAt: timestampFactory()
  };
}

export function buildDeliveredPayload(
  timestampFactory: TimestampFactory
): Record<string, unknown> {
  return {
    status: "delivered",
    deliveredAt: timestampFactory()
  };
}
