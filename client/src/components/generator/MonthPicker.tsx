import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface MonthPickerProps {
  value: number[];
  onChange: (months: number[]) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  function toggle(m: number): void {
    if (value.includes(m)) {
      const next = value.filter((x) => x !== m).sort((a, b) => a - b);
      if (next.length === 0) return;
      onChange(next);
    } else {
      onChange([...value, m].sort((a, b) => a - b));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>Months</Label>
        <span className="text-xs text-muted-foreground">At least one month required</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {MONTHS.map((label, idx) => {
          const month = idx + 1;
          const checked = value.includes(month);
          return (
            <label key={label} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
              <Checkbox checked={checked} onCheckedChange={() => toggle(month)} />
              {label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
