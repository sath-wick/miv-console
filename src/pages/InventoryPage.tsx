import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { formatInrFromPaise } from "@/lib/money";
import { deleteInventoryItem, listInventory } from "@/services/firestore";
import type { InventoryItem, MealType } from "@/types/models";

type InventoryFilter = "all" | MealType;

export function InventoryPage() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [mealFilter, setMealFilter] = useState<InventoryFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const items = await listInventory();
      setInventory(items);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filteredItems = useMemo(() => {
    if (mealFilter === "all") {
      return inventory;
    }
    return inventory.filter((item) => item.mealType === mealFilter);
  }, [inventory, mealFilter]);

  async function onDelete(item: InventoryItem) {
    const confirmed = window.confirm(`Delete inventory item ${item.name}?`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteInventoryItem(item.id);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete inventory item.");
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <Card className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-text-secondary">Meal Type</span>
          <Select value={mealFilter} onChange={(event) => setMealFilter(event.target.value as InventoryFilter)}>
            <option value="all">All</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </Select>
        </label>
        <Button
          onClick={() =>
            navigate("/inventory/new", {
              state: { defaultMealType: mealFilter === "all" ? "breakfast" : mealFilter }
            })
          }
        >
          Add Inventory Item
        </Button>
      </Card>

      <Card className="space-y-2">
        {loading ? <p className="text-sm text-text-secondary">Loading inventory...</p> : null}
        {!loading && filteredItems.length === 0 ? (
          <p className="text-sm text-text-secondary">No inventory items found.</p>
        ) : null}

        {filteredItems.map((item) => (
          <article key={item.id} className="rounded-control border border-border-subtle bg-bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-text-secondary">
                  <span className="capitalize">{item.mealType}</span>
                  {item.mealType === "breakfast" ? "" : ` | ${item.category ?? "others"}`} | {formatInrFromPaise(item.priceInPaise)}
                </p>
                {item.alternateName ? <p className="text-xs text-text-secondary">{item.alternateName}</p> : null}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => navigate(`/inventory/${item.id}/edit`)}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => void onDelete(item)}>
                Delete
              </Button>
            </div>
          </article>
        ))}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </Card>
    </div>
  );
}
