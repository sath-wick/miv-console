import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getMenuByDate, listInventory } from "@/services/firestore";
import { getMenuItemIdsByMeal } from "@/lib/menu";
import { loadBoardState, saveBoardState } from "@/lib/storage";
import type { InventoryItem, MealType, MenuForDate } from "@/types/models";

export function KitchenBoardPage() {
  const [dateKey, setDateKey] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [menu, setMenu] = useState<MenuForDate | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cookingDone, setCookingDone] = useState<Set<string>>(new Set());
  const [packagingDone, setPackagingDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBase() {
      const inventoryResult = await listInventory();
      setInventory(inventoryResult);
    }
    void loadBase();
  }, []);

  useEffect(() => {
    async function loadMenu() {
      if (!dateKey) {
        setMenu(null);
        return;
      }
      try {
        const menuResult = await getMenuByDate(dateKey);
        setMenu(menuResult);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load menu.");
      }
    }
    void loadMenu();
  }, [dateKey]);

  useEffect(() => {
    if (!dateKey) {
      setCookingDone(new Set());
      setPackagingDone(new Set());
      return;
    }
    setCookingDone(loadBoardState(dateKey, mealType, "cooking"));
    setPackagingDone(loadBoardState(dateKey, mealType, "packaging"));
  }, [dateKey, mealType]);

  useEffect(() => {
    if (!dateKey) return;
    saveBoardState(dateKey, mealType, "cooking", cookingDone);
  }, [cookingDone, dateKey, mealType]);

  useEffect(() => {
    if (!dateKey) return;
    saveBoardState(dateKey, mealType, "packaging", packagingDone);
  }, [packagingDone, dateKey, mealType]);

  const inventoryById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);

  const mealItems = useMemo(() => {
    if (!menu) return [];
    return getMenuItemIdsByMeal(menu, mealType)
      .map((itemId) => inventoryById.get(itemId))
      .filter((item): item is InventoryItem => Boolean(item));
  }, [inventoryById, mealType, menu]);

  const packagingItems = useMemo(() => {
    return mealItems.filter((item) => cookingDone.has(item.id));
  }, [cookingDone, mealItems]);

  function toggleCooking(itemId: string) {
    setCookingDone((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function togglePackaging(itemId: string) {
    setPackagingDone((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs text-text-secondary">Date</span>
          <Input type="date" value={dateKey} onChange={(event) => setDateKey(event.target.value)} />
        </label>
        {dateKey ? (
          <label className="block space-y-1">
            <span className="text-xs text-text-secondary">Meal Type</span>
            <Select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </Select>
          </label>
        ) : null}
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-base font-semibold">Cooking</h3>
        {mealItems.length === 0 ? <p className="text-sm text-text-secondary">No items for selection.</p> : null}
        {mealItems.map((item) => (
          <label key={item.id} className="flex items-center gap-2 rounded-control bg-bg-surface p-3 text-sm">
            <input type="checkbox" checked={cookingDone.has(item.id)} onChange={() => toggleCooking(item.id)} />
            <span className={cookingDone.has(item.id) ? "line-through text-text-secondary" : ""}>{item.name}</span>
          </label>
        ))}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-base font-semibold">Packaging</h3>
        {packagingItems.length === 0 ? (
          <p className="text-sm text-text-secondary">Complete cooking for items before packaging.</p>
        ) : null}
        {packagingItems.map((item) => (
          <label key={item.id} className="flex items-center gap-2 rounded-control bg-bg-surface p-3 text-sm">
            <input
              type="checkbox"
              checked={packagingDone.has(item.id)}
              onChange={() => togglePackaging(item.id)}
            />
            <span className={packagingDone.has(item.id) ? "line-through text-text-secondary" : ""}>{item.name}</span>
          </label>
        ))}
      </Card>
    </div>
  );
}
