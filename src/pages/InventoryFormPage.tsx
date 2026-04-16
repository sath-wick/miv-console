import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toPaiseFromInput } from "@/lib/money";
import { createInventoryItem, listInventory, updateInventoryItem } from "@/services/firestore";
import { LD_CATEGORIES, type LDCategory, type MealType } from "@/types/models";

interface InventoryFormState {
  mealType: MealType;
  category?: LDCategory;
  name: string;
  alternateName: string;
  priceInput: string;
}

interface InventoryFormLocationState {
  defaultMealType?: MealType;
}

const EMPTY_FORM: InventoryFormState = {
  mealType: "breakfast",
  category: undefined,
  name: "",
  alternateName: "",
  priceInput: ""
};

function isMealType(value: unknown): value is MealType {
  return value === "breakfast" || value === "lunch" || value === "dinner";
}

export function InventoryFormPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const locationState = (location.state ?? {}) as InventoryFormLocationState;
  const defaultMealType = isMealType(locationState.defaultMealType) ? locationState.defaultMealType : "breakfast";
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<InventoryFormState>(() => {
    if (isEdit) {
      return EMPTY_FORM;
    }
    return {
      ...EMPTY_FORM,
      mealType: defaultMealType,
      category: defaultMealType === "breakfast" ? undefined : "others"
    };
  });

  const title = useMemo(() => (isEdit ? "Edit Inventory Item" : "Create Inventory Item"), [isEdit]);

  useEffect(() => {
    if (!isEdit || !id) {
      return;
    }

    async function loadItem() {
      setLoading(true);
      setError(null);
      try {
        const items = await listInventory();
        const item = items.find((entry) => entry.id === id);
        if (!item) {
          setNotFound(true);
          return;
        }
        setFormState({
          mealType: item.mealType,
          category: item.category,
          name: item.name,
          alternateName: item.alternateName ?? "",
          priceInput: (item.priceInPaise / 100).toFixed(2)
        });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load inventory item.");
      } finally {
        setLoading(false);
      }
    }

    void loadItem();
  }, [id, isEdit]);

  async function onSave() {
    const priceInPaise = toPaiseFromInput(formState.priceInput);
    if (!formState.name.trim() || priceInPaise < 0) {
      setError("Inventory item name and valid price are required.");
      return;
    }

    if (formState.mealType !== "breakfast" && !formState.category) {
      setError("Lunch and dinner items require a category.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        mealType: formState.mealType,
        name: formState.name.trim(),
        alternateName: formState.alternateName.trim() || undefined,
        priceInPaise,
        category: formState.mealType === "breakfast" ? undefined : formState.category
      };

      if (isEdit && id) {
        await updateInventoryItem(id, payload);
      } else {
        await createInventoryItem(payload);
      }
      navigate("/inventory");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save inventory item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex min-h-[calc(100dvh-180px)] flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 pb-28">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/inventory")}>
            Back
          </Button>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        {loading ? (
          <Card>
            <p className="text-sm text-text-secondary">Loading inventory item...</p>
          </Card>
        ) : null}

        {notFound ? (
          <Card className="space-y-3">
            <p className="text-sm text-text-secondary">Inventory item not found.</p>
            <Button type="button" variant="secondary" onClick={() => navigate("/inventory")}>
              Back to Inventory
            </Button>
          </Card>
        ) : null}

        {!loading && !notFound ? (
          <Card className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Meal Type</span>
              <Select
                value={formState.mealType}
                onChange={(event) => {
                  const mealType = event.target.value as MealType;
                  setFormState((prev) => ({
                    ...prev,
                    mealType,
                    category: mealType === "breakfast" ? undefined : prev.category ?? "others"
                  }));
                }}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </Select>
            </label>

            {formState.mealType !== "breakfast" ? (
              <label className="block space-y-1">
                <span className="text-xs text-text-secondary">Category</span>
                <Select
                  value={formState.category ?? "others"}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, category: event.target.value as LDCategory }))
                  }
                >
                  {LD_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Item Name</span>
              <Input value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Alternate Name (optional)</span>
              <Input
                value={formState.alternateName}
                onChange={(event) => setFormState((prev) => ({ ...prev, alternateName: event.target.value }))}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-text-secondary">Price (INR)</span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={formState.priceInput}
                onChange={(event) => setFormState((prev) => ({ ...prev, priceInput: event.target.value }))}
              />
            </label>
          </Card>
        ) : null}

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>

      {!notFound ? (
        <div className="sticky bottom-0 border-t border-border-subtle bg-bg-primary/95 p-3 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl">
            <Button type="submit" disabled={saving || loading} className="w-full text-base font-semibold">
              {saving ? "Saving..." : isEdit ? "Update Item" : "Create Item"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
