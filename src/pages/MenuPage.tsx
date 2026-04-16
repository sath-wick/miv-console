import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useAuth } from "@/auth/AuthProvider";
import { buildWhatsappMessage } from "@/lib/whatsapp";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatInrFromPaise } from "@/lib/money";
import { groupInventoryByCategory } from "@/lib/menu";
import {
  getMenuByDate,
  listInventory,
  saveMenuForDate
} from "@/services/firestore";
import { LD_CATEGORIES, type InventoryItem, type LDCategory } from "@/types/models";

type MenuDraft = {
  breakfastItemIds: string[];
  lunch: Record<LDCategory, string[]>;
  dinner: Record<LDCategory, string[]>;
};

const EMPTY_DRAFT: MenuDraft = {
  breakfastItemIds: [],
  lunch: { daal: [], curry: [], pickle: [], sambar: [], others: [] },
  dinner: { daal: [], curry: [], pickle: [], sambar: [], others: [] }
};

function addUnique(target: string[], itemId: string): string[] {
  return target.includes(itemId) ? target : [...target, itemId];
}

function removeValue(target: string[], itemId: string): string[] {
  return target.filter((entry) => entry !== itemId);
}

export function MenuPage() {
  const { user } = useAuth();
  const [dateKey, setDateKey] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [menuDraft, setMenuDraft] = useState<MenuDraft>(EMPTY_DRAFT);
  const [existingMenu, setExistingMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [expandedMeal, setExpandedMeal] = useState<"breakfast" | "lunch" | "dinner">("breakfast");

  const inventoryMap = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const groupedInventory = useMemo(() => groupInventoryByCategory(inventory), [inventory]);

  const draftMenuModel = useMemo(
    () => ({
      id: dateKey,
      dateKey,
      breakfastItemIds: menuDraft.breakfastItemIds,
      lunch: menuDraft.lunch,
      dinner: menuDraft.dinner,
      createdBy: user?.uid ?? "unknown"
    }),
    [dateKey, menuDraft, user?.uid]
  );

  useEffect(() => {
    async function loadBase() {
      setError(null);
      setLoading(true);
      try {
        const [inventoryResult, menuResult] = await Promise.all([listInventory(), dateKey ? getMenuByDate(dateKey) : null]);
        setInventory(inventoryResult);
        if (menuResult) {
          setMenuDraft({
            breakfastItemIds: menuResult.breakfastItemIds,
            lunch: menuResult.lunch,
            dinner: menuResult.dinner
          });
          setExistingMenu(true);
          setMessage(buildWhatsappMessage(menuResult, inventoryResult));
        } else {
          setMenuDraft(EMPTY_DRAFT);
          setExistingMenu(false);
          setMessage("");
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load menu data.");
      } finally {
        setLoading(false);
      }
    }
    void loadBase();
  }, [dateKey]);

  function addBreakfastItem(itemId: string) {
    setMenuDraft((prev) => ({
      ...prev,
      breakfastItemIds: addUnique(prev.breakfastItemIds, itemId)
    }));
  }

  function addLunchCategory(category: LDCategory, itemId: string) {
    setMenuDraft((prev) => ({
      ...prev,
      lunch: {
        ...prev.lunch,
        [category]: addUnique(prev.lunch[category], itemId)
      }
    }));
  }

  function addDinnerCategory(category: LDCategory, itemId: string) {
    setMenuDraft((prev) => ({
      ...prev,
      dinner: {
        ...prev.dinner,
        [category]: addUnique(prev.dinner[category], itemId)
      }
    }));
  }

  async function generateMenu() {
    if (!dateKey) {
      setError("Select a date first.");
      return;
    }
    if (!user) {
      setError("User session missing.");
      return;
    }

    if (existingMenu) {
      const confirmed = window.confirm(
        "A menu already exists for this date. Replacing it will not affect existing orders."
      );
      if (!confirmed) {
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await saveMenuForDate({
        dateKey,
        breakfastItemIds: menuDraft.breakfastItemIds,
        lunch: menuDraft.lunch,
        dinner: menuDraft.dinner,
        userId: user.uid
      });
      setExistingMenu(true);
      setMessage(buildWhatsappMessage(draftMenuModel, inventory));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save menu.");
    } finally {
      setSaving(false);
    }
  }

  function removeMenuItem(meal: "breakfast" | "lunch" | "dinner", itemId: string, category?: LDCategory) {
    setMenuDraft((prev) => {
      if (meal === "breakfast") {
        return {
          ...prev,
          breakfastItemIds: removeValue(prev.breakfastItemIds, itemId)
        };
      }
      if (!category) {
        return prev;
      }
      return {
        ...prev,
        [meal]: {
          ...prev[meal],
          [category]: removeValue(prev[meal][category], itemId)
        }
      };
    });
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="space-y-4">
          {dateKey ? (
            <>
              <article className="rounded-card border border-border-subtle bg-bg-elevated p-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setExpandedMeal("breakfast")}
                >
                  <div>
                    <h3 className="text-base font-semibold">Breakfast</h3>
                    <p className="text-xs text-text-secondary">{menuDraft.breakfastItemIds.length} items selected</p>
                  </div>
                  {expandedMeal === "breakfast" ? null : (
                    <span className="text-xs text-text-secondary">Expand</span>
                  )}
                </button>
                {expandedMeal === "breakfast" ? (
                  <div className="mt-4 space-y-4 border-t border-border-subtle pt-4">
                    <SearchableSelect
                      placeholder="Search breakfast item"
                      noResultsText="No breakfast items found."
                      options={groupedInventory.breakfast.uncategorized.map((item) => ({
                        value: item.id,
                        label: `${item.name} (${formatInrFromPaise(item.priceInPaise)})`
                      }))}
                      onSelect={addBreakfastItem}
                    />
                    <div className="space-y-2">
                      {menuDraft.breakfastItemIds.length === 0 ? (
                        <p className="text-sm text-text-secondary">No breakfast items added yet.</p>
                      ) : null}
                      {menuDraft.breakfastItemIds.map((itemId) => (
                        <div key={itemId} className="rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span>{inventoryMap.get(itemId)?.name ?? itemId}</span>
                            <Button variant="ghost" onClick={() => removeMenuItem("breakfast", itemId)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>

              <article className="rounded-card border border-border-subtle bg-bg-elevated p-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setExpandedMeal("lunch")}
                >
                  <div>
                    <h3 className="text-base font-semibold">Lunch</h3>
                    <p className="text-xs text-text-secondary">
                      {LD_CATEGORIES.reduce((count, category) => count + menuDraft.lunch[category].length, 0)} items selected
                    </p>
                  </div>
                  {expandedMeal === "lunch" ? null : (
                    <span className="text-xs text-text-secondary">Expand</span>
                  )}
                </button>
                {expandedMeal === "lunch" ? (
                  <div className="mt-4 space-y-4 border-t border-border-subtle pt-4">
                    {LD_CATEGORIES.map((category) => (
                      <div key={`l-${category}`} className="space-y-2">
                        <p className="text-xs uppercase text-text-secondary">{category}</p>
                        <SearchableSelect
                          placeholder={`Search ${category}`}
                          noResultsText={`No ${category} items found.`}
                          options={groupedInventory.lunch[category].map((item) => ({
                            value: item.id,
                            label: `${item.name} (${formatInrFromPaise(item.priceInPaise)})`
                          }))}
                          onSelect={(itemId) => addLunchCategory(category, itemId)}
                        />
                        <div className="space-y-2">
                          {menuDraft.lunch[category].map((itemId) => (
                            <div
                              key={itemId}
                              className="rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{inventoryMap.get(itemId)?.name ?? itemId}</span>
                                <Button variant="ghost" onClick={() => removeMenuItem("lunch", itemId, category)}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>

              <article className="rounded-card border border-border-subtle bg-bg-elevated p-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setExpandedMeal("dinner")}
                >
                  <div>
                    <h3 className="text-base font-semibold">Dinner</h3>
                    <p className="text-xs text-text-secondary">
                      {LD_CATEGORIES.reduce((count, category) => count + menuDraft.dinner[category].length, 0)} items selected
                    </p>
                  </div>
                  {expandedMeal === "dinner" ? null : (
                    <span className="text-xs text-text-secondary">Expand</span>
                  )}
                </button>
                {expandedMeal === "dinner" ? (
                  <div className="mt-4 space-y-4 border-t border-border-subtle pt-4">
                    {LD_CATEGORIES.map((category) => (
                      <div key={`d-${category}`} className="space-y-2">
                        <p className="text-xs uppercase text-text-secondary">{category}</p>
                        <SearchableSelect
                          placeholder={`Search ${category}`}
                          noResultsText={`No ${category} items found.`}
                          options={groupedInventory.dinner[category].map((item) => ({
                            value: item.id,
                            label: `${item.name} (${formatInrFromPaise(item.priceInPaise)})`
                          }))}
                          onSelect={(itemId) => addDinnerCategory(category, itemId)}
                        />
                        <div className="space-y-2">
                          {menuDraft.dinner[category].map((itemId) => (
                            <div
                              key={itemId}
                              className="rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{inventoryMap.get(itemId)?.name ?? itemId}</span>
                                <Button variant="ghost" onClick={() => removeMenuItem("dinner", itemId, category)}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>

            </>
          ) : null}

          {error ? <p className="text-sm text-red-200">{error}</p> : null}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="space-y-4">
            <h3 className="text-base font-semibold">Select Date</h3>
            <label className="space-y-1">
              <span className="text-xs text-text-secondary">Date</span>
              <Input type="date" value={dateKey} onChange={(event) => setDateKey(event.target.value)} />
            </label>
            {loading ? <p className="text-sm text-text-secondary">Loading menu data...</p> : null}
            {existingMenu ? (
              <p className="text-xs text-text-secondary">A menu already exists for this date and can be overwritten.</p>
            ) : (
              <p className="text-xs text-text-secondary">No saved menu for selected date.</p>
            )}
          </Card>

          {message ? (
            <Card className="space-y-3">
              <h3 className="text-base font-semibold">WhatsApp Message</h3>
              <pre className="whitespace-pre-wrap rounded-control border border-border-subtle bg-bg-surface p-3 text-xs text-text-secondary">
                {message}
              </pre>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await copyTextToClipboard(message);
                  } catch {
                    setError("Unable to copy message. Please copy it manually.");
                  }
                }}
              >
                Copy to Clipboard
              </Button>
            </Card>
          ) : null}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-bg-primary/95 p-3 backdrop-blur">
        <div className="mx-auto w-full max-w-app">
          <Button onClick={generateMenu} disabled={saving || loading || !dateKey} className="w-full text-base font-semibold">
            {saving ? "Saving..." : "Generate & Save Menu"}
          </Button>
        </div>
      </div>

    </div>
  );
}
