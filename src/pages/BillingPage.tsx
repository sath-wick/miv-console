import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createOrder, getMenuByDate, listCustomers, listInventory } from "@/services/firestore";
import { formatInrFromPaise, safeAddPaise, toPaiseFromInput } from "@/lib/money";
import { getMenuItemIdsByMeal } from "@/lib/menu";
import { useAuth } from "@/auth/AuthProvider";
import type { Customer, DeliveryMode, InventoryItem, MealType, MenuForDate, OrderItem } from "@/types/models";

const DELIVERY_CHARGES: Record<Exclude<DeliveryMode, "custom">, number> = {
  none: 0,
  within3km: 3000,
  beyond3km: 6000
};

const MEAL_TYPE_CODES: Record<MealType, "BRK" | "LNC" | "DNR"> = {
  breakfast: "BRK",
  lunch: "LNC",
  dinner: "DNR"
};

const CUSTOM_ITEM_ID = "__custom_item__";

function generateBillNumber(): number {
  const seed = Date.now() + Math.floor(Math.random() * 1000);
  return 1000 + (seed % 9000);
}

function formatBillDate(dateKey: string): string {
  if (!dateKey) {
    return "-";
  }
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function formatInrForBill(valueInPaise: number): string {
  const formatted = formatInrFromPaise(valueInPaise);
  return formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
}

function parsePositiveIntegerInput(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return 0;
  }
  return parsed;
}

export function BillingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const billPreviewRef = useRef<HTMLElement | null>(null);
  const [billNumber, setBillNumber] = useState(() => generateBillNumber());
  const [dateKey, setDateKey] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOptionsOpen, setCustomerOptionsOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [menu, setMenu] = useState<MenuForDate | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("within3km");
  const [customDeliveryInput, setCustomDeliveryInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customPriceInput, setCustomPriceInput] = useState("");
  const [customQuantityInput, setCustomQuantityInput] = useState("");
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashLeaving, setFlashLeaving] = useState(false);

  useEffect(() => {
    async function loadBase() {
      const [customerResult, inventoryResult] = await Promise.all([listCustomers(), listInventory()]);
      setCustomers(customerResult);
      setInventory(inventoryResult);
    }
    void loadBase();
  }, []);

  useEffect(() => {
    async function loadMenu() {
      if (!dateKey) {
        setMenu(null);
        setQuantities({});
        return;
      }
      const menuResult = await getMenuByDate(dateKey);
      setMenu(menuResult);
      setQuantities({});
    }
    void loadMenu();
  }, [dateKey]);

  const filteredCustomers = useMemo(() => {
    if (!customerQuery.trim()) {
      return customers;
    }
    const lowered = customerQuery.toLowerCase();
    return customers.filter((customer) => customer.name.toLowerCase().includes(lowered));
  }, [customerQuery, customers]);

  const selectedCustomer = useMemo(
    () => customers.find((entry) => entry.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );
  const selectedCustomerBalance = selectedCustomer?.currentBalanceInPaise ?? 0;
  const selectedCustomerBalanceMeta = useMemo(() => {
    if (!selectedCustomer) {
      return null;
    }
    if (selectedCustomerBalance > 0) {
      return {
        label: `Outstanding: ${formatInrFromPaise(selectedCustomerBalance)}`,
        className: "text-red-200"
      };
    }
    if (selectedCustomerBalance < 0) {
      return {
        label: `Advance credit: ${formatInrFromPaise(Math.abs(selectedCustomerBalance))}`,
        className: "text-emerald-300"
      };
    }
    return {
      label: "No outstanding balance",
      className: "text-text-secondary"
    };
  }, [selectedCustomer, selectedCustomerBalance]);

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerQuery(selectedCustomer.name);
      return;
    }
    setCustomerQuery("");
  }, [selectedCustomer]);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const leaveTimeout = window.setTimeout(() => setFlashLeaving(true), 1000);
    const clearTimeoutId = window.setTimeout(() => {
      setFlashMessage(null);
      setFlashLeaving(false);
    }, 1300);

    return () => {
      window.clearTimeout(leaveTimeout);
      window.clearTimeout(clearTimeoutId);
    };
  }, [flashMessage]);

  const inventoryById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);

  const mealItemIds = useMemo(() => {
    if (!menu) {
      return [];
    }
    return getMenuItemIdsByMeal(menu, mealType);
  }, [mealType, menu]);

  const menuOrderItems = useMemo<OrderItem[]>(() => {
    return mealItemIds.reduce<OrderItem[]>((acc, itemId) => {
      const quantity = quantities[itemId] ?? 0;
      const item = inventoryById.get(itemId);
      if (!item || quantity <= 0) {
        return acc;
      }
      acc.push({
        inventoryItemId: item.id,
        name: item.name,
        alternateName: item.alternateName,
        unitPriceInPaise: item.priceInPaise,
        quantity,
        lineTotalInPaise: quantity * item.priceInPaise
      });
      return acc;
    }, []);
  }, [mealItemIds, quantities, inventoryById]);

  const customQuantity = useMemo(
    () => parsePositiveIntegerInput(customQuantityInput.trim()),
    [customQuantityInput]
  );

  const customOrderItem = useMemo<OrderItem | null>(() => {
    const name = customItemName.trim();
    const priceInPaise = toPaiseFromInput(customPriceInput);
    if (!name || priceInPaise <= 0 || customQuantity <= 0) {
      return null;
    }
    return {
      inventoryItemId: CUSTOM_ITEM_ID,
      name,
      unitPriceInPaise: priceInPaise,
      quantity: customQuantity,
      lineTotalInPaise: customQuantity * priceInPaise
    };
  }, [customItemName, customPriceInput, customQuantity]);

  const orderItems = useMemo<OrderItem[]>(
    () => (customOrderItem ? [...menuOrderItems, customOrderItem] : menuOrderItems),
    [customOrderItem, menuOrderItems]
  );

  const subtotalInPaise = useMemo(
    () => safeAddPaise(orderItems.map((item) => item.lineTotalInPaise)),
    [orderItems]
  );

  const deliveryChargeInPaise = useMemo(() => {
    if (deliveryMode === "custom") {
      return toPaiseFromInput(customDeliveryInput);
    }
    return DELIVERY_CHARGES[deliveryMode];
  }, [customDeliveryInput, deliveryMode]);

  const grandTotalInPaise = subtotalInPaise + deliveryChargeInPaise;
  const mealTypeCode = MEAL_TYPE_CODES[mealType];
  const billDateLabel = formatBillDate(dateKey);

  function setQuantity(itemId: string, nextQty: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: Math.max(0, nextQty) }));
  }

  function hasAnyQuantity() {
    return Object.values(quantities).some((qty) => qty > 0);
  }

  function onMealTypeChange(nextMealType: MealType) {
    if (nextMealType === mealType) {
      return;
    }
    if (hasAnyQuantity()) {
      const shouldReset = window.confirm(
        "Changing meal type will reset selected quantities. Do you want to continue?"
      );
      if (!shouldReset) {
        return;
      }
    }
    setMealType(nextMealType);
    setQuantities({});
  }

  function clearAll() {
    setBillNumber(generateBillNumber());
    setDateKey("");
    setSelectedCustomerId("");
    setCustomerOptionsOpen(false);
    setMealType("breakfast");
    setQuantities({});
    setDeliveryMode("within3km");
    setCustomDeliveryInput("");
    setCustomItemName("");
    setCustomPriceInput("");
    setCustomQuantityInput("");
    setError(null);
  }

  function showTransientMessage(message: string) {
    setFlashMessage(message);
    setFlashLeaving(false);
  }

  async function captureBillPreviewBlob(): Promise<Blob> {
    const billElement = billPreviewRef.current;
    if (!billElement) {
      throw new Error("Bill preview is unavailable.");
    }

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(billElement, {
      backgroundColor: "#e8e8e8",
      scale: 2,
      logging: false,
      useCORS: true
    });

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Unable to generate bill image."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
    if (typeof navigator.clipboard?.write !== "function" || typeof ClipboardItem === "undefined") {
      return false;
    }
    try {
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      return false;
    }
  }

  async function tryShareBillImage() {
    try {
      const blob = await captureBillPreviewBlob();
      const file = new File([blob], `miv-bill-${billNumber}.png`, { type: "image/png" });
      const title = `Maa Inti Vanta Bill #${billNumber}`;
      const text = `${selectedCustomer?.name ?? "Customer"} - ${billDateLabel} - ${mealTypeCode}`;

      if (typeof navigator.share === "function") {
        try {
          const canShareFiles =
            typeof navigator.canShare === "function" ? navigator.canShare({ files: [file] }) : false;
          if (canShareFiles) {
            await navigator.share({
              title,
              text,
              files: [file]
            });
            return;
          }

          // Some browsers can still share text even when file sharing is unsupported.
          await navigator.share({
            title,
            text
          });
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") {
            return;
          }
        }
      }

      const copied = await copyBlobToClipboard(blob);
      if (copied) {
        showTransientMessage("Bill image copied. Paste it where you want to share.");
        return;
      }

      // Last fallback for browsers/devices without share support.
      downloadBlob(blob, file.name);
      showTransientMessage("Direct share unavailable. Bill image downloaded.");
    } catch {
      // Sharing should not block order creation.
      showTransientMessage("Unable to share bill image on this device.");
    }
  }

  async function createOrderRecord() {
    if (!dateKey) {
      setError("Select a date.");
      return;
    }
    if (!menu) {
      setError("Billing cannot proceed because no menu exists for this date.");
      return;
    }
    if (!selectedCustomer || !user) {
      setError("Select customer and ensure signed in user exists.");
      return;
    }
    const hasAnyCustomFieldInput = Boolean(
      customItemName.trim() || customPriceInput.trim() || customQuantityInput.trim()
    );
    if (hasAnyCustomFieldInput && !customItemName.trim()) {
      setError("Enter custom item name.");
      return;
    }
    if (hasAnyCustomFieldInput && toPaiseFromInput(customPriceInput) <= 0) {
      setError("Enter a valid custom item price.");
      return;
    }
    if (hasAnyCustomFieldInput && parsePositiveIntegerInput(customQuantityInput.trim()) <= 0) {
      setError("Enter a valid custom item quantity.");
      return;
    }
    if (orderItems.length === 0) {
      setError("Add quantity for at least one item.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createOrder({
        dateKey,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        billNumber,
        mealType,
        items: orderItems,
        subtotalInPaise,
        deliveryMode,
        deliveryChargeInPaise,
        grandTotalInPaise,
        createdBy: user.uid
      });
      await tryShareBillImage();
      clearAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-24">
      {flashMessage ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3">
          <div
            className={`rounded-control border border-border-strong bg-bg-elevated px-4 py-2 text-sm font-medium text-text-primary shadow-lg ${
              flashLeaving ? "subscription-toast-leave" : "subscription-toast-enter"
            }`}
          >
            {flashMessage}
          </div>
        </div>
      ) : null}

      <section className="space-y-4">
        <Card className="space-y-4">
          <h3 className="text-base font-semibold">Order Details</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-text-secondary">Date</span>
              <Input
                type="date"
                value={dateKey}
                onChange={(event) => {
                  setDateKey(event.target.value);
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-text-secondary">Meal Type</span>
              <Select value={mealType} onChange={(event) => onMealTypeChange(event.target.value as MealType)}>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </Select>
            </label>
          </div>

          <div className="grid gap-4">
            <label className="space-y-1">
              <span className="text-xs text-text-secondary">Customer</span>
              <div className="relative">
                <Input
                  value={customerQuery}
                  onFocus={() => setCustomerOptionsOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setCustomerOptionsOpen(false), 120);
                  }}
                  onChange={(event) => {
                    setCustomerQuery(event.target.value);
                    setCustomerOptionsOpen(true);
                    setSelectedCustomerId("");
                  }}
                  placeholder="Search and select customer"
                />
                {customerOptionsOpen ? (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-control border border-border-strong bg-bg-elevated p-1">
                    {filteredCustomers.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-text-secondary">No customers found.</p>
                    ) : null}
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="w-full rounded-control px-2 py-2 text-left text-sm hover:bg-bg-surface"
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => {
                          setSelectedCustomerId(customer.id);
                          setCustomerQuery(customer.name);
                          setCustomerOptionsOpen(false);
                        }}
                      >
                        {customer.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
            {selectedCustomer && selectedCustomerBalanceMeta ? (
              <button
                type="button"
                className={`w-fit text-sm font-medium underline-offset-2 hover:underline ${selectedCustomerBalanceMeta.className}`}
                onClick={() => navigate(`/payments?customerId=${selectedCustomer.id}`)}
              >
                {selectedCustomerBalanceMeta.label}
              </button>
            ) : null}
          </div>
        </Card>
      </section>

      {!dateKey ? null : !menu ? (
        <Card>
          <p className="text-sm text-text-secondary">
            Billing cannot proceed because no menu exists for this date. Create a menu first in Menu Creator.
          </p>
        </Card>
      ) : (
        <>
          <section className="space-y-4">
            <Card className="space-y-4">
              <h3 className="text-base font-semibold">Items</h3>

              <div className="space-y-2">
                {mealItemIds.length === 0 ? <p className="text-sm text-text-secondary">No menu items for selected meal type.</p> : null}
                {mealItemIds.map((itemId) => {
                  const item = inventoryById.get(itemId);
                  if (!item) return null;
                  const quantity = quantities[itemId] ?? 0;
                  return (
                    <div key={itemId} className="rounded-control border border-border-subtle bg-bg-surface px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-text-secondary">{formatInrFromPaise(item.priceInPaise)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" onClick={() => setQuantity(itemId, quantity - 1)}>
                            -
                          </Button>
                          <span className="w-8 text-center text-sm">{quantity}</span>
                          <Button variant="secondary" onClick={() => setQuantity(itemId, quantity + 1)}>
                            +
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <article className="rounded-control border border-border-subtle bg-bg-surface">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-3 text-left"
                  onClick={() => setCustomItemOpen((prev) => !prev)}
                >
                  <span className="text-sm font-medium">Custom Item</span>
                  {!customItemOpen ? (
                    <span className="text-xs text-text-secondary">Expand</span>
                  ) : null}
                </button>
                {customItemOpen ? (
                  <div className="space-y-3 border-t border-border-subtle px-3 py-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="space-y-1">
                        <Input
                          value={customItemName}
                          onChange={(event) => setCustomItemName(event.target.value)}
                          placeholder="Item name"
                        />
                      </label>
                      <label className="space-y-1">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={customPriceInput}
                          onChange={(event) => setCustomPriceInput(event.target.value)}
                          placeholder="Price in INR"
                        />
                      </label>
                      <label className="space-y-1">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={customQuantityInput}
                          onChange={(event) => setCustomQuantityInput(event.target.value)}
                          placeholder="Qty"
                        />
                      </label>
                    </div>
                    {customOrderItem ? (
                      <div className="rounded-control border border-border-subtle bg-bg-surface px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{customOrderItem.name}</p>
                            <p className="text-xs text-text-secondary">
                              {formatInrFromPaise(customOrderItem.unitPriceInPaise)} x {customOrderItem.quantity}
                            </p>
                          </div>
                          <p className="text-sm font-semibold">{formatInrFromPaise(customOrderItem.lineTotalInPaise)}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            </Card>
          </section>

          <section className="space-y-4">
            <Card className="space-y-4">
              <h3 className="text-base font-semibold">Charges & Total</h3>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
                  <input type="radio" checked={deliveryMode === "none"} onChange={() => setDeliveryMode("none")} />
                  No delivery
                </label>
                <label className="flex items-center gap-2 rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
                  <input
                    type="radio"
                    checked={deliveryMode === "within3km"}
                    onChange={() => setDeliveryMode("within3km")}
                  />
                  Within 3km (Rs.30)
                </label>
                <label className="flex items-center gap-2 rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
                  <input
                    type="radio"
                    checked={deliveryMode === "beyond3km"}
                    onChange={() => setDeliveryMode("beyond3km")}
                  />
                  Beyond 3km (Rs.60)
                </label>
                <label className="flex items-center gap-2 rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
                  <input type="radio" checked={deliveryMode === "custom"} onChange={() => setDeliveryMode("custom")} />
                  Custom
                </label>
              </div>

              {deliveryMode === "custom" ? (
                <Input
                  value={customDeliveryInput}
                  onChange={(event) => setCustomDeliveryInput(event.target.value)}
                  placeholder="Custom delivery in INR"
                />
              ) : null}

              <div className="space-y-2 rounded-control border border-border-strong bg-bg-surface p-3 text-sm">
                <p className="text-xs text-text-secondary">Customer: {selectedCustomer?.name ?? "-"}</p>
                {orderItems.map((item, index) => (
                  <div key={item.inventoryItemId} className="flex items-center justify-between border-b border-border-subtle py-1">
                    <span>
                      {index + 1}. {item.name} x {item.quantity}
                    </span>
                    <span className="text-right">{formatInrFromPaise(item.lineTotalInPaise)}</span>
                  </div>
                ))}
                <div className="pt-2">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span className="text-right">{formatInrFromPaise(subtotalInPaise)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Delivery</span>
                    <span className="text-right">{formatInrFromPaise(deliveryChargeInPaise)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2 text-base font-semibold">
                    <span>Grand Total</span>
                    <span className="text-xl text-right">{formatInrFromPaise(grandTotalInPaise)}</span>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {selectedCustomer ? (
            <section className="space-y-4">
              <Card className="space-y-3">
                <h3 className="text-base font-semibold">Bill Preview</h3>
                <div className="overflow-x-auto">
                  <article
                    ref={billPreviewRef}
                    className="mx-auto w-full max-w-[430px] border border-[#111] bg-[#e8e8e8] p-4 text-[#111] shadow-sm sm:p-5"
                  >
                    <header className="border-b-2 border-[#98a1a8] pb-3 text-center font-mono">
                      <h4 className="text-[42px] font-bold leading-none tracking-tight">Maa Inti Vanta</h4>
                      <p className="mt-2 text-[21px] leading-tight">NFC Nagar, Telangana</p>
                      <p className="mt-1 text-[21px] leading-tight">Phone: +91 9346604522</p>
                    </header>

                    <section className="mt-3 grid grid-cols-2 gap-4 font-mono text-[20px] font-semibold leading-tight">
                      <p>
                        <span>Name:</span>
                        <br />
                        <span>{selectedCustomer.name}</span>
                      </p>
                      <p className="text-right">
                        <span>Bill No:</span>
                        <br />
                        <span>{billNumber}</span>
                      </p>
                      <p>
                        <span>Date:</span>
                        <br />
                        <span>{billDateLabel}</span>
                      </p>
                      <p className="text-right">
                        <span>Type:</span>
                        <br />
                        <span>{mealTypeCode}</span>
                      </p>
                    </section>

                    <section className="mt-5 font-mono">
                      <div className="grid grid-cols-[60px_1fr_70px_95px] border-b-2 border-[#98a1a8] pb-2 text-[20px] font-semibold">
                        <span>S.No</span>
                        <span>Item</span>
                        <span className="text-center">Qty</span>
                        <span className="text-right">Amount</span>
                      </div>

                      {orderItems.length === 0 ? (
                        <p className="py-4 text-[18px] text-[#4b4b4b]">Add items to generate bill rows.</p>
                      ) : (
                        orderItems.map((item, index) => (
                          <div
                            key={item.inventoryItemId}
                            className="grid grid-cols-[60px_1fr_70px_95px] border-b border-dotted border-[#c1c1c1] py-2 text-[20px]"
                          >
                            <span>{index + 1}</span>
                            <span className="break-words pr-2">{item.name}</span>
                            <span className="text-center">{item.quantity}</span>
                            <span className="text-right">{formatInrForBill(item.lineTotalInPaise)}</span>
                          </div>
                        ))
                      )}
                    </section>

                    <section className="mt-3 border-b-2 border-[#98a1a8] pb-3 font-mono text-[21px] leading-tight">
                      <div className="flex items-center justify-between py-1">
                        <span>Subtotal:</span>
                        <span>{formatInrForBill(subtotalInPaise)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span>Delivery Charges:</span>
                        <span>{formatInrForBill(deliveryChargeInPaise)}</span>
                      </div>
                    </section>

                    <section className="mt-3 border-b-2 border-[#98a1a8] pb-4 font-mono">
                      <div className="flex items-center justify-between text-[30px] font-extrabold leading-none">
                        <span>Grand Total:</span>
                        <span>{formatInrForBill(grandTotalInPaise)}</span>
                      </div>
                    </section>

                    <footer className="pt-4 text-center font-mono text-[22px] leading-tight">
                      <p>Thank you for your order</p>
                      <p>Order Again!</p>
                    </footer>
                  </article>
                </div>
              </Card>
            </section>
          ) : null}
        </>
      )}

      {error ? <p className="text-sm text-red-200">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-bg-primary/95 p-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-app gap-2">
          <Button variant="secondary" onClick={clearAll}>
            Clear
          </Button>
          <Button onClick={createOrderRecord} disabled={saving || !menu} className="flex-1 text-base font-semibold">
            {saving ? "Creating..." : "Create Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
