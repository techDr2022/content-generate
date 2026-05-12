import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RunSpecialDay {
  label: string;
  date: string;
  type: "festival" | "awareness" | "campaign";
}

interface SpecialDaysInputProps {
  value: RunSpecialDay[];
  onChange: (rows: RunSpecialDay[]) => void;
}

export function SpecialDaysInput({ value, onChange }: SpecialDaysInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Manual extra days for this run</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...value, { label: "", date: "", type: "awareness" }])}
        >
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {value.map((row, idx) => (
          <div key={idx} className="grid gap-2 md:grid-cols-4">
            <Input
              placeholder="Label"
              value={row.label}
              onChange={(e) => {
                const copy = [...value];
                copy[idx] = { ...row, label: e.target.value };
                onChange(copy);
              }}
            />
            <Input
              type="date"
              value={row.date}
              onChange={(e) => {
                const copy = [...value];
                copy[idx] = { ...row, date: e.target.value };
                onChange(copy);
              }}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={row.type}
              onChange={(e) => {
                const copy = [...value];
                copy[idx] = { ...row, type: e.target.value as RunSpecialDay["type"] };
                onChange(copy);
              }}
            >
              <option value="festival">Festival</option>
              <option value="awareness">Awareness</option>
              <option value="campaign">Campaign</option>
            </select>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
