import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export interface SearchableOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  placeholder: string;
  onSelect: (value: string) => void;
  noResultsText?: string;
  className?: string;
}

export function SearchableSelect({
  options,
  placeholder,
  onSelect,
  noResultsText = "No options found.",
  className
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) {
      return [];
    }
    return options.filter((option) => option.label.toLowerCase().includes(lowered));
  }, [options, query]);

  const shouldShowDropdown = open && query.trim().length > 0;

  function selectValue(value: string) {
    onSelect(value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(query.trim().length > 0)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(next.trim().length > 0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && filteredOptions.length > 0) {
            event.preventDefault();
            selectValue(filteredOptions[0].value);
          }
        }}
      />
      {shouldShowDropdown ? (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-control border border-border-strong bg-bg-elevated p-1">
          {filteredOptions.length === 0 ? <p className="px-2 py-2 text-sm text-text-secondary">{noResultsText}</p> : null}
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="w-full rounded-control px-2 py-2 text-left text-sm hover:bg-bg-surface"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => selectValue(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
