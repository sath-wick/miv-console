import type { InventoryItem, LDCategory, MealType, MenuForDate } from "@/types/models";

export function getMenuItemIdsByMeal(menu: MenuForDate, mealType: MealType): string[] {
  if (mealType === "breakfast") {
    return menu.breakfastItemIds;
  }
  const bucket = mealType === "lunch" ? menu.lunch : menu.dinner;
  return Object.values(bucket).flat();
}

export function groupInventoryByCategory(
  items: InventoryItem[]
): Record<"breakfast" | "lunch" | "dinner", Record<LDCategory | "uncategorized", InventoryItem[]>> {
  const base = {
    breakfast: { uncategorized: [], daal: [], curry: [], pickle: [], sambar: [], others: [] },
    lunch: { uncategorized: [], daal: [], curry: [], pickle: [], sambar: [], others: [] },
    dinner: { uncategorized: [], daal: [], curry: [], pickle: [], sambar: [], others: [] }
  } as Record<"breakfast" | "lunch" | "dinner", Record<LDCategory | "uncategorized", InventoryItem[]>>;

  for (const item of items) {
    if (item.mealType === "breakfast") {
      base.breakfast.uncategorized.push(item);
      continue;
    }
    const category = item.category ?? "others";
    base[item.mealType][category].push(item);
  }

  return base;
}
