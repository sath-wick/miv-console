import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QueryConstraint
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Customer,
  CustomerSubscription,
  CustomerType,
  InventoryItem,
  LDCategory,
  MealType,
  MenuForDate,
  Order,
  Payment,
  Subscription,
  SubscriptionDuration,
  SubscriptionMember,
  SubscriptionMemberStatus
} from "@/types/models";
import { buildCreateOrderPayload, type CreateOrderInput } from "@/services/orderPayload";

const MEAL_CATEGORIES: LDCategory[] = ["daal", "curry", "pickle", "sambar", "others"];

function assertDb() {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  return db;
}

function withId<T>(id: string, data: DocumentData): T {
  return { id, ...data } as unknown as T;
}

function mapCollection<T>(docs: QueryDocumentSnapshot<DocumentData>[]): T[] {
  return docs.map((entry) => withId<T>(entry.id, entry.data()));
}

function mapCustomerData(id: string, data: Partial<Customer>): Customer {
  return {
    id,
    name: data.name ?? "",
    phone: data.phone ?? "",
    address: data.address ?? "",
    currentBalanceInPaise: typeof data.currentBalanceInPaise === "number" ? data.currentBalanceInPaise : 0,
    lastOrderAt: data.lastOrderAt ?? null,
    lastPaymentAt: data.lastPaymentAt ?? null,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

function mapCustomerSubscription(id: string, data: Partial<CustomerSubscription>): CustomerSubscription {
  return {
    id,
    customerId: data.customerId ?? "",
    priceInPaise: typeof data.priceInPaise === "number" ? data.priceInPaise : 0,
    billingType: (data.billingType as SubscriptionDuration) ?? "monthly",
    startDate: data.startDate as Timestamp,
    nextDueDate: data.nextDueDate as Timestamp,
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined
  };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addMonthsClamped(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const day = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return new Date(target.getFullYear(), target.getMonth(), day);
}

function addYearsClamped(date: Date, years: number): Date {
  const targetYear = date.getFullYear() + years;
  const monthIndex = date.getMonth();
  const day = Math.min(date.getDate(), daysInMonth(targetYear, monthIndex));
  return new Date(targetYear, monthIndex, day);
}

function computeNextDueDate(startDate: Date, billingType: SubscriptionDuration): Date {
  return billingType === "monthly" ? addMonthsClamped(startDate, 1) : addYearsClamped(startDate, 1);
}

function mapOrderData(id: string, data: Partial<Order>): Order {
  return {
    id,
    dateKey: data.dateKey ?? "",
    customerId: data.customerId ?? "",
    customerName: data.customerName ?? "",
    billNumber: typeof data.billNumber === "number" ? data.billNumber : undefined,
    mealType: data.mealType ?? "breakfast",
    items: data.items ?? [],
    subtotalInPaise: data.subtotalInPaise ?? 0,
    deliveryMode: data.deliveryMode ?? "none",
    deliveryChargeInPaise: data.deliveryChargeInPaise ?? 0,
    grandTotalInPaise: data.grandTotalInPaise ?? 0,
    status: data.status ?? "pending",
    assignedCourierId: data.assignedCourierId,
    deliveredAt: data.deliveredAt,
    createdBy: data.createdBy ?? "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

function ref(name: string) {
  return collection(assertDb(), name);
}

export type CustomerSortOption = "name" | "highestDue" | "lowestDue" | "mostRecentlyActive" | "longestInactive";

interface ListCustomersOptions {
  search?: string;
  onlyDue?: boolean;
  sortBy?: CustomerSortOption;
}

function applyCustomerFilters(customers: Customer[], options: ListCustomersOptions): Customer[] {
  const lowered = options.search?.trim().toLowerCase() ?? "";
  let filtered = customers;
  if (lowered) {
    filtered = filtered.filter((item) => item.name.toLowerCase().includes(lowered));
  }
  if (options.onlyDue) {
    filtered = filtered.filter((item) => item.currentBalanceInPaise > 0);
  }
  function lastActivityTime(customer: Customer): number {
    return Math.max(customer.lastOrderAt?.toMillis() ?? 0, customer.lastPaymentAt?.toMillis() ?? 0);
  }
  switch (options.sortBy) {
    case "highestDue":
      return [...filtered].sort((a, b) => b.currentBalanceInPaise - a.currentBalanceInPaise);
    case "lowestDue":
      return [...filtered].sort((a, b) => a.currentBalanceInPaise - b.currentBalanceInPaise);
    case "mostRecentlyActive":
      return [...filtered].sort((a, b) => {
        const aTime = lastActivityTime(a);
        const bTime = lastActivityTime(b);
        return bTime - aTime;
      });
    case "longestInactive":
      return [...filtered].sort((a, b) => {
        const aTime = lastActivityTime(a);
        const bTime = lastActivityTime(b);
        return aTime - bTime;
      });
    default:
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }
}

function resolveCustomerListOptions(searchOrOptions: string | ListCustomersOptions = ""): ListCustomersOptions {
  if (typeof searchOrOptions === "string") {
    return { search: searchOrOptions, onlyDue: false, sortBy: "name" };
  }
  return {
    search: searchOrOptions.search ?? "",
    onlyDue: searchOrOptions.onlyDue ?? false,
    sortBy: searchOrOptions.sortBy ?? "name"
  };
}

function customerQueryConstraints(options: ListCustomersOptions): QueryConstraint[] {
  const constraints: QueryConstraint[] = [where("isActive", "==", true)];
  if (options.onlyDue) {
    constraints.push(where("currentBalanceInPaise", ">", 0));
  }
  switch (options.sortBy) {
    case "highestDue":
      constraints.push(orderBy("currentBalanceInPaise", "desc"));
      break;
    case "lowestDue":
      constraints.push(orderBy("currentBalanceInPaise", "asc"));
      break;
    case "mostRecentlyActive":
      constraints.push(orderBy("lastOrderAt", "desc"));
      break;
    case "longestInactive":
      constraints.push(orderBy("lastOrderAt", "asc"));
      break;
    default:
      constraints.push(orderBy("name"));
      break;
  }
  return constraints;
}

export async function listCustomers(searchOrOptions: string | ListCustomersOptions = ""): Promise<Customer[]> {
  const options = resolveCustomerListOptions(searchOrOptions);
  try {
    const snapshot = await getDocs(query(ref("customers"), ...customerQueryConstraints(options)));
    const customers = snapshot.docs.map((entry) => mapCustomerData(entry.id, entry.data() as Partial<Customer>));
    return applyCustomerFilters(customers, options);
  } catch {
    const fallbackSnapshot = await getDocs(query(ref("customers"), where("isActive", "==", true), orderBy("name")));
    const fallbackCustomers = fallbackSnapshot.docs.map((entry) =>
      mapCustomerData(entry.id, entry.data() as Partial<Customer>)
    );
    return applyCustomerFilters(fallbackCustomers, options);
  }
}

export async function listCustomersWithDue(): Promise<Customer[]> {
  return listCustomers({ onlyDue: true, sortBy: "highestDue" });
}

export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const snapshot = await getDoc(doc(assertDb(), "customers", customerId));
  if (!snapshot.exists()) {
    return null;
  }
  return mapCustomerData(snapshot.id, snapshot.data() as Partial<Customer>);
}

type CustomerWriteInput = Pick<Customer, "name" | "phone" | "address">;

export async function createCustomer(input: CustomerWriteInput) {
  await addDoc(ref("customers"), {
    ...input,
    currentBalanceInPaise: 0,
    lastOrderAt: null,
    lastPaymentAt: null,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateCustomer(customerId: string, input: CustomerWriteInput) {
  await updateDoc(doc(assertDb(), "customers", customerId), {
    ...input,
    customerType: deleteField(),
    updatedAt: serverTimestamp()
  });
}

export async function deleteCustomer(customerId: string) {
  const database = assertDb();
  const customerRef = doc(database, "customers", customerId);
  const customerSubscriptionRef = doc(database, "customerSubscriptions", customerId);

  const [customerSubscriptionSnapshot, memberSnapshot, paymentSnapshot] = await Promise.all([
    getDoc(customerSubscriptionRef),
    getDocs(query(ref("subscriptionMembers"), where("customerId", "==", customerId))),
    getDocs(query(ref("payments"), where("customerId", "==", customerId)))
  ]);

  const customerTypeAtPayment: CustomerType =
    customerSubscriptionSnapshot.exists() || memberSnapshot.size > 0 ? "subscription" : "normal";

  let batch = writeBatch(database);
  let operations = 0;
  const commits: Promise<void>[] = [];

  function queueWrite(write: () => void) {
    write();
    operations += 1;
    if (operations >= 400) {
      commits.push(batch.commit());
      batch = writeBatch(database);
      operations = 0;
    }
  }

  queueWrite(() => batch.delete(customerRef));
  queueWrite(() => batch.delete(customerSubscriptionRef));

  for (const memberDoc of memberSnapshot.docs) {
    queueWrite(() => batch.delete(memberDoc.ref));
  }

  for (const paymentDoc of paymentSnapshot.docs) {
    const paymentData = paymentDoc.data() as Partial<Payment>;
    if (!paymentData.customerTypeAtPayment) {
      queueWrite(() =>
        batch.update(paymentDoc.ref, {
          customerTypeAtPayment
        })
      );
    }
  }

  if (operations > 0) {
    commits.push(batch.commit());
  }
  await Promise.all(commits);
}

export async function listInventory(mealType?: MealType): Promise<InventoryItem[]> {
  const constraints: QueryConstraint[] = [where("isActive", "==", true), orderBy("name")];
  if (mealType) {
    constraints.unshift(where("mealType", "==", mealType));
  }
  const snapshot = await getDocs(query(ref("inventoryItems"), ...constraints));
  return mapCollection<InventoryItem>(snapshot.docs);
}

export async function createInventoryItem(
  input: Omit<InventoryItem, "id" | "createdAt" | "updatedAt" | "isActive">
) {
  const payload: DocumentData = {
    mealType: input.mealType,
    name: input.name,
    priceInPaise: input.priceInPaise,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (input.alternateName !== undefined) {
    payload.alternateName = input.alternateName;
  }

  if (input.mealType !== "breakfast" && input.category !== undefined) {
    payload.category = input.category;
  }

  await addDoc(ref("inventoryItems"), payload);
}

export async function updateInventoryItem(
  itemId: string,
  input: Pick<InventoryItem, "name" | "alternateName" | "priceInPaise" | "mealType" | "category">
) {
  const payload: DocumentData = {
    mealType: input.mealType,
    name: input.name,
    priceInPaise: input.priceInPaise,
    alternateName: input.alternateName ?? deleteField(),
    category: input.mealType === "breakfast" || input.category === undefined ? deleteField() : input.category,
    updatedAt: serverTimestamp()
  };

  await updateDoc(doc(assertDb(), "inventoryItems", itemId), payload);
}

export async function deleteInventoryItem(itemId: string) {
  await deleteDoc(doc(assertDb(), "inventoryItems", itemId));
}

function mapSubscription(id: string, data: Partial<Subscription>): Subscription {
  return {
    id,
    title: data.title ?? "",
    priceInPaise: typeof data.priceInPaise === "number" ? data.priceInPaise : 0,
    duration: (data.duration as SubscriptionDuration) ?? "monthly",
    description: data.description,
    createdAt: data.createdAt as Timestamp | undefined
  };
}

function mapSubscriptionMember(id: string, data: Partial<SubscriptionMember>): SubscriptionMember {
  return {
    id,
    subscriptionId: data.subscriptionId ?? "",
    customerId: data.customerId ?? "",
    startDate: data.startDate as Timestamp,
    nextBillingDate: data.nextBillingDate as Timestamp,
    status: (data.status as SubscriptionMemberStatus) ?? "active",
    createdAt: data.createdAt as Timestamp | undefined
  };
}

interface CreateCustomerSubscriptionInput {
  customerId: string;
  priceInPaise: number;
  billingType: SubscriptionDuration;
  startDate: Date;
}

interface UpdateCustomerSubscriptionInput {
  customerId: string;
  priceInPaise: number;
  billingType: SubscriptionDuration;
}

export interface CommandCenterUserDocument {
  id: string;
  role?: string;
  displayName?: string;
  email?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export async function listCustomerSubscriptions(): Promise<CustomerSubscription[]> {
  const snapshot = await getDocs(query(ref("customerSubscriptions"), orderBy("nextDueDate", "asc")));
  return snapshot.docs.map((entry) => mapCustomerSubscription(entry.id, entry.data() as Partial<CustomerSubscription>));
}

export async function getCustomerSubscriptionByCustomerId(customerId: string): Promise<CustomerSubscription | null> {
  const snapshot = await getDoc(doc(assertDb(), "customerSubscriptions", customerId));
  if (!snapshot.exists()) {
    return null;
  }
  return mapCustomerSubscription(snapshot.id, snapshot.data() as Partial<CustomerSubscription>);
}

export async function createCustomerSubscription(input: CreateCustomerSubscriptionInput): Promise<void> {
  if (input.priceInPaise <= 0) {
    throw new Error("Subscription amount must be greater than zero.");
  }

  const database = assertDb();
  const customerRef = doc(database, "customers", input.customerId);
  const customerSubscriptionRef = doc(database, "customerSubscriptions", input.customerId);
  const nextDueDate = computeNextDueDate(input.startDate, input.billingType);

  await runTransaction(database, async (transaction) => {
    const [customerSnapshot, existingSubscriptionSnapshot] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(customerSubscriptionRef)
    ]);

    if (!customerSnapshot.exists()) {
      throw new Error("Customer not found.");
    }
    if (existingSubscriptionSnapshot.exists()) {
      throw new Error("Subscription already exists for this customer.");
    }

    transaction.set(customerSubscriptionRef, {
      customerId: input.customerId,
      priceInPaise: input.priceInPaise,
      billingType: input.billingType,
      startDate: Timestamp.fromDate(input.startDate),
      nextDueDate: Timestamp.fromDate(nextDueDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    transaction.update(customerRef, {
      customerType: deleteField(),
      updatedAt: serverTimestamp()
    });
  });
}

export async function updateCustomerSubscriptionByCustomerId(input: UpdateCustomerSubscriptionInput): Promise<void> {
  if (input.priceInPaise <= 0) {
    throw new Error("Subscription amount must be greater than zero.");
  }

  const database = assertDb();
  const customerSubscriptionRef = doc(database, "customerSubscriptions", input.customerId);
  const existingSnapshot = await getDoc(customerSubscriptionRef);
  if (!existingSnapshot.exists()) {
    throw new Error("Subscription not found.");
  }

  const existing = mapCustomerSubscription(existingSnapshot.id, existingSnapshot.data() as Partial<CustomerSubscription>);
  const startDate = existing.startDate?.toDate?.();
  if (!startDate) {
    throw new Error("Subscription start date is missing.");
  }

  const nextDueDate = computeNextDueDate(startDate, input.billingType);
  await updateDoc(customerSubscriptionRef, {
    priceInPaise: input.priceInPaise,
    billingType: input.billingType,
    nextDueDate: Timestamp.fromDate(nextDueDate),
    updatedAt: serverTimestamp()
  });
}

export async function deleteCustomerSubscriptionByCustomerId(customerId: string): Promise<void> {
  const database = assertDb();
  const customerRef = doc(database, "customers", customerId);
  const customerSubscriptionRef = doc(database, "customerSubscriptions", customerId);

  await runTransaction(database, async (transaction) => {
    const [customerSnapshot, subscriptionSnapshot] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(customerSubscriptionRef)
    ]);

    if (!subscriptionSnapshot.exists()) {
      throw new Error("Subscription not found.");
    }
    if (!customerSnapshot.exists()) {
      throw new Error("Customer not found.");
    }

    transaction.delete(customerSubscriptionRef);
    transaction.update(customerRef, {
      customerType: deleteField(),
      updatedAt: serverTimestamp()
    });
  });
}

export async function listCommandCenterUsers(): Promise<CommandCenterUserDocument[]> {
  try {
    const snapshot = await getDocs(query(ref("users"), orderBy("createdAt", "desc")));
    return snapshot.docs.map((entry) => {
      const data = entry.data() as DocumentData;
      return {
        id: entry.id,
        role: typeof data.role === "string" ? data.role : undefined,
        displayName: typeof data.displayName === "string" ? data.displayName : undefined,
        email: typeof data.email === "string" ? data.email : undefined,
        createdAt: data.createdAt as Timestamp | undefined,
        updatedAt: data.updatedAt as Timestamp | undefined
      };
    });
  } catch {
    const fallback = await getDocs(ref("users"));
    return fallback.docs.map((entry) => {
      const data = entry.data() as DocumentData;
      return {
        id: entry.id,
        role: typeof data.role === "string" ? data.role : undefined,
        displayName: typeof data.displayName === "string" ? data.displayName : undefined,
        email: typeof data.email === "string" ? data.email : undefined,
        createdAt: data.createdAt as Timestamp | undefined,
        updatedAt: data.updatedAt as Timestamp | undefined
      };
    });
  }
}

export async function deleteCommandCenterUser(userId: string): Promise<void> {
  await deleteDoc(doc(assertDb(), "users", userId));
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const snapshot = await getDocs(query(ref("subscriptions"), orderBy("createdAt", "desc")));
  return snapshot.docs.map((entry) => mapSubscription(entry.id, entry.data() as Partial<Subscription>));
}

interface CreateSubscriptionInput {
  title: string;
  priceInPaise: number;
  duration: SubscriptionDuration;
  description?: string;
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<void> {
  const database = assertDb();
  await addDoc(collection(database, "subscriptions"), {
    title: input.title.trim(),
    priceInPaise: input.priceInPaise,
    duration: input.duration,
    description: input.description?.trim() || undefined,
    createdAt: serverTimestamp()
  });
}

export async function getSubscriptionById(subscriptionId: string): Promise<Subscription | null> {
  const snapshot = await getDoc(doc(assertDb(), "subscriptions", subscriptionId));
  if (!snapshot.exists()) {
    return null;
  }
  return mapSubscription(snapshot.id, snapshot.data() as Partial<Subscription>);
}

export async function listSubscriptionMembersBySubscription(
  subscriptionId: string,
  status?: SubscriptionMemberStatus
): Promise<SubscriptionMember[]> {
  const constraints: QueryConstraint[] = [where("subscriptionId", "==", subscriptionId)];
  if (status) {
    constraints.push(where("status", "==", status));
  }
  const snapshot = await getDocs(query(ref("subscriptionMembers"), ...constraints));
  return snapshot.docs
    .map((entry) => mapSubscriptionMember(entry.id, entry.data() as Partial<SubscriptionMember>))
    .sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
}

interface CreateSubscriptionMemberInput {
  subscriptionId: string;
  customerId: string;
  startDate: Date;
  nextBillingDate: Date;
}

export async function createSubscriptionMember(input: CreateSubscriptionMemberInput): Promise<void> {
  const database = assertDb();
  const membersRef = collection(database, "subscriptionMembers");

  const duplicateSnapshot = await getDocs(
    query(
      membersRef,
      where("subscriptionId", "==", input.subscriptionId),
      where("customerId", "==", input.customerId),
      where("status", "==", "active")
    )
  );
  if (!duplicateSnapshot.empty) {
    throw new Error("Customer already has an active membership for this subscription.");
  }

  await addDoc(membersRef, {
    subscriptionId: input.subscriptionId,
    customerId: input.customerId,
    startDate: Timestamp.fromDate(input.startDate),
    nextBillingDate: Timestamp.fromDate(input.nextBillingDate),
    status: "active" as SubscriptionMemberStatus,
    createdAt: serverTimestamp()
  });
}

export async function updateSubscriptionMemberStatus(
  memberId: string,
  status: SubscriptionMemberStatus
): Promise<void> {
  await updateDoc(doc(assertDb(), "subscriptionMembers", memberId), {
    status,
    updatedAt: serverTimestamp()
  });
}

function emptyCategoryMap(): Record<LDCategory, string[]> {
  return {
    daal: [],
    curry: [],
    pickle: [],
    sambar: [],
    others: []
  };
}

function normalizeCategoryMap(
  source: Partial<Record<LDCategory, string[]>> | undefined
): Record<LDCategory, string[]> {
  const normalized = emptyCategoryMap();
  for (const category of MEAL_CATEGORIES) {
    normalized[category] = source?.[category] ?? [];
  }
  return normalized;
}

export async function getMenuByDate(dateKey: string): Promise<MenuForDate | null> {
  const snapshot = await getDoc(doc(assertDb(), "menus", dateKey));
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data() as MenuForDate;
  return {
    id: snapshot.id,
    dateKey: data.dateKey,
    breakfastItemIds: data.breakfastItemIds ?? [],
    lunch: normalizeCategoryMap(data.lunch),
    dinner: normalizeCategoryMap(data.dinner),
    createdBy: data.createdBy,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

export interface SaveMenuInput {
  dateKey: string;
  breakfastItemIds: string[];
  lunch: Partial<Record<LDCategory, string[]>>;
  dinner: Partial<Record<LDCategory, string[]>>;
  userId: string;
}

export async function saveMenuForDate(input: SaveMenuInput): Promise<void> {
  const menuRef = doc(assertDb(), "menus", input.dateKey);
  const existing = await getDoc(menuRef);
  const existingCreatedAt = existing.exists() ? existing.data().createdAt : serverTimestamp();

  await setDoc(
    menuRef,
    {
      dateKey: input.dateKey,
      breakfastItemIds: input.breakfastItemIds,
      lunch: normalizeCategoryMap(input.lunch),
      dinner: normalizeCategoryMap(input.dinner),
      createdBy: input.userId,
      createdAt: existingCreatedAt,
      updatedAt: serverTimestamp()
    },
    { merge: false }
  );
}

export async function listOrdersByDate(dateKey: string): Promise<Order[]> {
  const snapshot = await getDocs(
    query(ref("orders"), where("dateKey", "==", dateKey), orderBy("createdAt", "desc"))
  );
  return snapshot.docs.map((entry) => mapOrderData(entry.id, entry.data() as Partial<Order>));
}

export async function listOrdersByDateRange(fromDateKey: string, toDateKey: string): Promise<Order[]> {
  const snapshot = await getDocs(
    query(
      ref("orders"),
      where("dateKey", ">=", fromDateKey),
      where("dateKey", "<=", toDateKey),
      orderBy("dateKey"),
      orderBy("createdAt", "desc")
    )
  );
  return snapshot.docs.map((entry) => mapOrderData(entry.id, entry.data() as Partial<Order>));
}

export async function listOrdersByCreatedAtRange(startDate: Date, endDate: Date): Promise<Order[]> {
  const startBoundary = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
  const endBoundary = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
  const [from, to] =
    startBoundary.getTime() <= endBoundary.getTime()
      ? [startBoundary, endBoundary]
      : [
          new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0),
          new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59, 999)
        ];

  const snapshot = await getDocs(
    query(
      ref("orders"),
      where("createdAt", ">=", Timestamp.fromDate(from)),
      where("createdAt", "<=", Timestamp.fromDate(to)),
      orderBy("createdAt", "desc")
    )
  );

  return snapshot.docs.map((entry) => mapOrderData(entry.id, entry.data() as Partial<Order>));
}

export async function listPaymentsByCreatedAtRange(startDate: Date, endDate: Date): Promise<Payment[]> {
  const startBoundary = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
  const endBoundary = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
  const [from, to] =
    startBoundary.getTime() <= endBoundary.getTime()
      ? [startBoundary, endBoundary]
      : [
          new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0),
          new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59, 999)
        ];

  const snapshot = await getDocs(
    query(
      ref("payments"),
      where("createdAt", ">=", Timestamp.fromDate(from)),
      where("createdAt", "<=", Timestamp.fromDate(to)),
      orderBy("createdAt", "desc")
    )
  );

  return mapCollection<Payment>(snapshot.docs);
}

export async function listOrdersByCustomer(customerId: string): Promise<Order[]> {
  const snapshot = await getDocs(query(ref("orders"), where("customerId", "==", customerId)));
  return snapshot.docs
    .map((entry) => mapOrderData(entry.id, entry.data() as Partial<Order>))
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export async function listCommandCenterOrders(): Promise<Order[]> {
  try {
    const snapshot = await getDocs(query(ref("orders"), orderBy("dateKey", "desc"), orderBy("createdAt", "desc")));
    return snapshot.docs.map((entry) => mapOrderData(entry.id, entry.data() as Partial<Order>));
  } catch {
    const fallback = await getDocs(ref("orders"));
    return fallback.docs
      .map((entry) => mapOrderData(entry.id, entry.data() as Partial<Order>))
      .sort((a, b) => {
        const byDate = (b.dateKey ?? "").localeCompare(a.dateKey ?? "");
        if (byDate !== 0) {
          return byDate;
        }
        return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);
      });
  }
}

interface CreatePaymentInput {
  customerId: string;
  amountInPaise: number;
  settlementSide?: "due" | "undue";
  note?: string;
  createdBy: string;
}

interface SettleCustomerSubscriptionInput {
  customerId: string;
  amountInPaise: number;
  createdBy: string;
}

export async function listPaymentsByCustomer(customerId: string): Promise<Payment[]> {
  const snapshot = await getDocs(query(ref("payments"), where("customerId", "==", customerId)));
  return mapCollection<Payment>(snapshot.docs).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export async function createPayment(input: CreatePaymentInput): Promise<void> {
  if (input.amountInPaise <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }
  const database = assertDb();
  const customerRef = doc(database, "customers", input.customerId);
  const customerSubscriptionRef = doc(database, "customerSubscriptions", input.customerId);
  const paymentRef = doc(collection(database, "payments"));
  const note = input.note?.trim();

  await runTransaction(database, async (transaction) => {
    const [customerSnapshot, customerSubscriptionSnapshot] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(customerSubscriptionRef)
    ]);
    if (!customerSnapshot.exists()) {
      throw new Error("Customer not found.");
    }
    const customerData = customerSnapshot.data() as Partial<Customer>;
    const previousBalance =
      typeof customerData.currentBalanceInPaise === "number" ? customerData.currentBalanceInPaise : 0;
    const settlementSide = input.settlementSide ?? "due";
    const nextBalance =
      settlementSide === "undue" ? previousBalance + input.amountInPaise : previousBalance - input.amountInPaise;
    const customerTypeAtPayment: CustomerType = customerSubscriptionSnapshot.exists() ? "subscription" : "normal";

    transaction.update(customerRef, {
      currentBalanceInPaise: nextBalance,
      lastPaymentAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const paymentPayload: DocumentData = {
      customerId: input.customerId,
      amountInPaise: input.amountInPaise,
      customerTypeAtPayment,
      settlementSide,
      createdAt: serverTimestamp(),
      createdBy: input.createdBy
    };
    if (note) {
      paymentPayload.note = note;
    }
    transaction.set(paymentRef, paymentPayload);
  });
}

export async function settleCustomerSubscription(input: SettleCustomerSubscriptionInput): Promise<void> {
  if (input.amountInPaise <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const database = assertDb();
  const customerRef = doc(database, "customers", input.customerId);
  const customerSubscriptionRef = doc(database, "customerSubscriptions", input.customerId);
  const paymentRef = doc(collection(database, "payments"));

  await runTransaction(database, async (transaction) => {
    const [customerSnapshot, customerSubscriptionSnapshot] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(customerSubscriptionRef)
    ]);
    if (!customerSnapshot.exists()) {
      throw new Error("Customer not found.");
    }
    if (!customerSubscriptionSnapshot.exists()) {
      throw new Error("Subscription not found.");
    }

    const customerSubscription = mapCustomerSubscription(
      customerSubscriptionSnapshot.id,
      customerSubscriptionSnapshot.data() as Partial<CustomerSubscription>
    );
    const currentDueDate = customerSubscription.nextDueDate?.toDate?.();
    if (!currentDueDate) {
      throw new Error("Subscription due date is missing.");
    }
    const nextDueDate = computeNextDueDate(currentDueDate, customerSubscription.billingType);

    transaction.update(customerSubscriptionRef, {
      nextDueDate: Timestamp.fromDate(nextDueDate),
      updatedAt: serverTimestamp()
    });

    transaction.update(customerRef, {
      lastPaymentAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    transaction.set(paymentRef, {
      customerId: input.customerId,
      amountInPaise: input.amountInPaise,
      customerTypeAtPayment: "subscription" as CustomerType,
      settlementSide: "due" as const,
      note: "Subscription settlement",
      createdAt: serverTimestamp(),
      createdBy: input.createdBy
    });
  });
}

export async function deleteCommandCenterOrder(orderId: string): Promise<void> {
  const database = assertDb();
  const orderRef = doc(database, "orders", orderId);

  await runTransaction(database, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) {
      throw new Error("Order not found.");
    }
    const orderData = orderSnapshot.data() as Partial<Order>;

    if (orderData.customerId) {
      const customerRef = doc(database, "customers", orderData.customerId);
      const customerSnapshot = await transaction.get(customerRef);
      if (customerSnapshot.exists()) {
        const customerData = customerSnapshot.data() as Partial<Customer>;
        const previousBalance =
          typeof customerData.currentBalanceInPaise === "number" ? customerData.currentBalanceInPaise : 0;
        const orderTotal = typeof orderData.grandTotalInPaise === "number" ? orderData.grandTotalInPaise : 0;
        transaction.update(customerRef, {
          currentBalanceInPaise: previousBalance - orderTotal,
          updatedAt: serverTimestamp()
        });
      }
    }

    transaction.delete(orderRef);
  });
}

export async function createOrder(input: CreateOrderInput): Promise<void> {
  const database = assertDb();
  const customerRef = doc(database, "customers", input.customerId);
  const orderRef = doc(collection(database, "orders"));
  const payload = buildCreateOrderPayload(input, serverTimestamp) as DocumentData;

  await runTransaction(database, async (transaction) => {
    const customerSnapshot = await transaction.get(customerRef);
    if (!customerSnapshot.exists()) {
      throw new Error("Customer not found.");
    }
    const customerData = customerSnapshot.data() as Partial<Customer>;
    const previousBalance =
      typeof customerData.currentBalanceInPaise === "number" ? customerData.currentBalanceInPaise : 0;
    const nextBalance = previousBalance + input.grandTotalInPaise;

    transaction.set(orderRef, payload);

    const customerUpdatePayload: DocumentData = {
      currentBalanceInPaise: nextBalance,
      lastOrderAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    transaction.update(customerRef, customerUpdatePayload);
  });
}

export async function markOrderDelivered(orderId: string): Promise<void> {
  await updateDoc(doc(assertDb(), "orders", orderId), {
    status: "delivered",
    deliveredAt: serverTimestamp()
  });
}

export async function listCommandCenterMenus(): Promise<MenuForDate[]> {
  try {
    const snapshot = await getDocs(query(ref("menus"), orderBy("dateKey", "desc")));
    return snapshot.docs.map((entry) => withId<MenuForDate>(entry.id, entry.data()));
  } catch {
    const fallback = await getDocs(ref("menus"));
    return fallback.docs
      .map((entry) => withId<MenuForDate>(entry.id, entry.data()))
      .sort((a, b) => (b.dateKey ?? "").localeCompare(a.dateKey ?? ""));
  }
}

export async function deleteCommandCenterMenu(menuId: string): Promise<void> {
  await deleteDoc(doc(assertDb(), "menus", menuId));
}
