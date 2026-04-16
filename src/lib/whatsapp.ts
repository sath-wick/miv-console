import type { InventoryItem, MenuForDate } from "@/types/models";

function formatItems(lines: InventoryItem[]): string[] {
  return lines.map((item) => `- ${item.name} - ${formatMenuPrice(item.priceInPaise)}`);
}

function gatherMealItems(
  menu: MenuForDate,
  inventoryMap: Map<string, InventoryItem>,
  meal: "breakfast" | "lunch" | "dinner"
): InventoryItem[] {
  if (meal === "breakfast") {
    return menu.breakfastItemIds
      .map((id) => inventoryMap.get(id))
      .filter((entry): entry is InventoryItem => Boolean(entry));
  }

  const bucket = menu[meal];
  const ids = Object.values(bucket).flat();
  return ids
    .map((id) => inventoryMap.get(id))
    .filter((entry): entry is InventoryItem => Boolean(entry));
}

function formatMenuPrice(valueInPaise: number): string {
  const rupees = valueInPaise / 100;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(rupees);
  return `₹${formatted}`;
}

function toOrdinal(day: number): string {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatMenuDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  const dayText = toOrdinal(date.getDate());
  const monthText = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date);
  return `${dayText}  ${monthText} ${date.getFullYear()}`;
}

export function buildWhatsappMessage(
  menu: MenuForDate,
  inventoryItems: InventoryItem[]
): string {
  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));
  const breakfastItems = gatherMealItems(menu, inventoryMap, "breakfast");
  const lunchItems = gatherMealItems(menu, inventoryMap, "lunch");
  const dinnerItems = gatherMealItems(menu, inventoryMap, "dinner");

  return [
    `*Date: ${formatMenuDate(menu.dateKey)}*`,
    "",
    "*Breakfast*☀️ ",
    ...formatItems(breakfastItems),
    "",
    "*Lunch*🍜 ",
    ...formatItems(lunchItems),
    "",
    "*Dinner*🌙 ",
    ...formatItems(dinnerItems),
    "",
    "Thank You!"
  ].join("\n");
}
