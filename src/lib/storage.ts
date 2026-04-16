import type { MealType } from "@/types/models";

type BoardType = "cooking" | "packaging";

function storageKey(dateKey: string, mealType: MealType, boardType: BoardType): string {
  return `miv:${boardType}:${dateKey}:${mealType}`;
}

export function loadBoardState(
  dateKey: string,
  mealType: MealType,
  boardType: BoardType
): Set<string> {
  const key = storageKey(dateKey, mealType, boardType);
  const raw = localStorage.getItem(key);
  if (!raw) {
    return new Set();
  }
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveBoardState(
  dateKey: string,
  mealType: MealType,
  boardType: BoardType,
  ids: Set<string>
): void {
  const key = storageKey(dateKey, mealType, boardType);
  localStorage.setItem(key, JSON.stringify(Array.from(ids)));
}
