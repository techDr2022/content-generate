import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface PostCountInputProps {
  value?: number;
  onChange: (v: number | undefined) => void;
  /** Client profile default when no override */
  clientDefaultPosts?: number;
  clientLabel?: string;
}

export function PostCountInput({
  value,
  onChange,
  clientDefaultPosts,
  clientLabel,
}: PostCountInputProps) {
  const id = useId();
  const checkboxId = `${id}-custom-posters`;
  const inputId = `${id}-poster-count`;

  const [customEnabled, setCustomEnabled] = useState(() => typeof value === "number" && value > 0);

  useEffect(() => {
    if (value === undefined) {
      setCustomEnabled(false);
    }
  }, [value]);

  const seedCount =
    typeof clientDefaultPosts === "number" && clientDefaultPosts > 0 ? clientDefaultPosts : 15;

  const defaultDescription =
    typeof clientDefaultPosts === "number"
      ? `${clientDefaultPosts} poster${clientDefaultPosts === 1 ? "" : "s"}${clientLabel ? ` — ${clientLabel}` : ""}`
      : "each client’s saved posts-per-month";

  const displayCount =
    typeof value === "number" && value >= 1 && value <= 62 ? value : seedCount;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={customEnabled}
          onCheckedChange={(checked) => {
            const on = checked === true;
            setCustomEnabled(on);
            if (!on) {
              onChange(undefined);
              return;
            }
            onChange(typeof value === "number" && value >= 1 ? value : seedCount);
          }}
          className="mt-0.5"
        />
        <div className="min-w-0 space-y-1">
          <Label htmlFor={checkboxId} className="cursor-pointer text-base font-medium leading-snug">
            Custom number of posters
          </Label>
          <p className="text-sm text-muted-foreground">
            {customEnabled
              ? "Claude will aim for this many poster rows (subject to special-day rules in the prompt)."
              : `Uncheck to use ${defaultDescription}.`}
          </p>
        </div>
      </div>

      {customEnabled ? (
        <div className="space-y-2 pl-7">
          <Label htmlFor={inputId}>Posters to generate</Label>
          <Input
            id={inputId}
            type="number"
            min={1}
            max={62}
            className="max-w-[140px]"
            value={displayCount}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                return;
              }
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              const clamped = Math.min(62, Math.max(1, Math.round(n)));
              onChange(clamped);
            }}
          />
          <p className="text-xs text-muted-foreground">Allowed range: 1–62 (matches server limits).</p>
        </div>
      ) : null}
    </div>
  );
}
