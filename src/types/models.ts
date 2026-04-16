import type { Timestamp } from "firebase/firestore";

export type FirebaseFirestoreTimestamp = Timestamp;

export type Role = "admin" | "courier";
export type MealType = "breakfast" | "lunch" | "dinner";
export type LDCategory = "daal" | "curry" | "pickle" | "sambar" | "others";
export type DeliveryMode = "none" | "within3km" | "beyond3km" | "custom";
export type OrderStatus = "pending" | "delivered";
export type CustomerType = "normal" | "subscription";

export type SubscriptionDuration = "monthly" | "yearly";
export type SubscriptionMemberStatus = "active" | "paused" | "cancelled";

export interface AppUser {
  uid: string;
  role: Role;
  displayName?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  currentBalanceInPaise: number;
  lastOrderAt: FirebaseFirestoreTimestamp | null;
  lastPaymentAt: FirebaseFirestoreTimestamp | null;
  isActive: boolean;
  createdAt?: FirebaseFirestoreTimestamp;
  updatedAt?: FirebaseFirestoreTimestamp;
}

export interface InventoryItem {
  id: string;
  mealType: MealType;
  name: string;
  alternateName?: string;
  priceInPaise: number;
  category?: LDCategory;
  isActive: boolean;
  createdAt?: FirebaseFirestoreTimestamp;
  updatedAt?: FirebaseFirestoreTimestamp;
}

export interface MenuForDate {
  id: string;
  dateKey: string;
  breakfastItemIds: string[];
  lunch: Record<LDCategory, string[]>;
  dinner: Record<LDCategory, string[]>;
  createdBy: string;
  createdAt?: FirebaseFirestoreTimestamp;
  updatedAt?: FirebaseFirestoreTimestamp;
}

export interface OrderItem {
  inventoryItemId: string;
  name: string;
  alternateName?: string;
  unitPriceInPaise: number;
  quantity: number;
  lineTotalInPaise: number;
}

export interface Order {
  id: string;
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
  status: OrderStatus;
  assignedCourierId?: string;
  deliveredAt?: FirebaseFirestoreTimestamp;
  createdBy: string;
  createdAt?: FirebaseFirestoreTimestamp;
  updatedAt?: FirebaseFirestoreTimestamp;
}

export interface Payment {
  id: string;
  customerId: string;
  amountInPaise: number;
  customerTypeAtPayment?: CustomerType;
  settlementSide?: "due" | "undue";
  note?: string;
  createdAt?: FirebaseFirestoreTimestamp;
  createdBy: string;
}

export interface Subscription {
  id: string;
  title: string;
  priceInPaise: number;
  duration: SubscriptionDuration;
  description?: string;
  createdAt?: FirebaseFirestoreTimestamp;
}

export interface SubscriptionMember {
  id: string;
  subscriptionId: string;
  customerId: string;
  startDate: FirebaseFirestoreTimestamp;
  nextBillingDate: FirebaseFirestoreTimestamp;
  status: SubscriptionMemberStatus;
  createdAt?: FirebaseFirestoreTimestamp;
}

export interface CustomerSubscription {
  id: string;
  customerId: string;
  priceInPaise: number;
  billingType: SubscriptionDuration;
  startDate: FirebaseFirestoreTimestamp;
  nextDueDate: FirebaseFirestoreTimestamp;
  createdAt?: FirebaseFirestoreTimestamp;
  updatedAt?: FirebaseFirestoreTimestamp;
}

export const LD_CATEGORIES: LDCategory[] = [
  "daal",
  "curry",
  "pickle",
  "sambar",
  "others"
];
