import { useEffect, useMemo, useRef, useState } from "react";

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (nextValue: DateRangeValue) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function normalizeDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatInputDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${day}-${month}-${year}`;
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => normalizeDay(value.startDate ?? new Date()));
  const [draftRange, setDraftRange] = useState<DateRangeValue>({
    startDate: value.startDate,
    endDate: value.endDate
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftRange({
      startDate: value.startDate,
      endDate: value.endDate
    });
    setViewMonth(normalizeDay(value.startDate ?? new Date()));
  }, [open, value.endDate, value.startDate]);

  const daysInMonth = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate(),
    [viewMonth]
  );
  const monthStartWeekday = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay(),
    [viewMonth]
  );
  const calendarCells = useMemo(() => {
    const cells: Array<{ key: string; day: Date | null }> = [];
    for (let i = 0; i < monthStartWeekday; i += 1) {
      cells.push({ key: `empty-start-${i}`, day: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ key: `day-${day}`, day: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day) });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: `empty-end-${cells.length}`, day: null });
    }
    return cells;
  }, [daysInMonth, monthStartWeekday, viewMonth]);

  const inputText = useMemo(() => {
    if (!value.startDate) {
      return "";
    }
    const startText = formatInputDate(value.startDate);
    const endText = formatInputDate(value.endDate ?? value.startDate);
    return `${startText} to ${endText}`;
  }, [value.endDate, value.startDate]);

  function inSelectedRange(day: Date): boolean {
    const start = draftRange.startDate ? normalizeDay(draftRange.startDate).getTime() : null;
    const end = draftRange.endDate ? normalizeDay(draftRange.endDate).getTime() : null;
    const target = normalizeDay(day).getTime();

    if (start === null) {
      return false;
    }
    if (end === null) {
      return target === start;
    }
    const from = Math.min(start, end);
    const to = Math.max(start, end);
    return target >= from && target <= to;
  }

  function isRangeEdge(day: Date): boolean {
    if (!draftRange.startDate) {
      return false;
    }
    if (isSameDay(day, draftRange.startDate)) {
      return true;
    }
    return draftRange.endDate ? isSameDay(day, draftRange.endDate) : false;
  }

  function onDaySelect(day: Date) {
    const selectedDay = normalizeDay(day);
    const start = draftRange.startDate ? normalizeDay(draftRange.startDate) : null;
    const end = draftRange.endDate ? normalizeDay(draftRange.endDate) : null;

    if (!start || (start && end)) {
      setDraftRange({ startDate: selectedDay, endDate: null });
      return;
    }

    if (selectedDay.getTime() < start.getTime()) {
      setDraftRange({ startDate: selectedDay, endDate: start });
      return;
    }

    setDraftRange({ startDate: start, endDate: selectedDay });
  }

  function onApply() {
    setOpen(false);
    const start = draftRange.startDate ? normalizeDay(draftRange.startDate) : null;
    const end = draftRange.endDate ? normalizeDay(draftRange.endDate) : null;
    if (!start) {
      onChange({ startDate: null, endDate: null });
      return;
    }
    if (end && end.getTime() < start.getTime()) {
      onChange({ startDate: end, endDate: start });
      return;
    }
    onChange({ startDate: start, endDate: end });
  }

  return (
    <div className="relative w-full" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="min-h-11 w-full rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm text-text-primary"
      >
        {inputText}
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-card border border-border-strong bg-bg-elevated p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-control border border-border-subtle bg-bg-surface px-2 py-1 text-xs text-text-secondary"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
            >
              Prev
            </button>
            <p className="text-sm font-medium">{formatMonthLabel(viewMonth)}</p>
            <button
              type="button"
              className="rounded-control border border-border-subtle bg-bg-surface px-2 py-1 text-xs text-text-secondary"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-1 text-center text-[11px] text-text-secondary">
                {weekday}
              </div>
            ))}
            {calendarCells.map((cell) =>
              cell.day ? (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => onDaySelect(cell.day as Date)}
                  className={`rounded-control py-2 text-sm transition ${
                    inSelectedRange(cell.day)
                      ? isRangeEdge(cell.day)
                        ? "border border-[rgba(196,106,58,0.5)] bg-accent-soft text-text-primary"
                        : "bg-accent-soft text-text-primary"
                      : "text-text-primary hover:bg-bg-surface"
                  }`}
                >
                  {cell.day.getDate()}
                </button>
              ) : (
                <div key={cell.key} className="py-2" />
              )
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-text-secondary">Select start date, then end date.</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-control border border-border-subtle bg-bg-surface px-2 py-1 text-xs text-text-secondary"
                onClick={() => setDraftRange({ startDate: null, endDate: null })}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-control border border-border-subtle bg-accent-soft px-2 py-1 text-xs text-text-primary"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onApply();
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
