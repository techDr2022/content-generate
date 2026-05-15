"use client";

import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RejectionDrawerProps {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function RejectionDrawer({ open, value, onChange, disabled }: RejectionDrawerProps): JSX.Element {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="space-y-2 border-l-4 border-rose-400 bg-rose-50/80 p-3">
          <Label htmlFor="reject-reason">Rejection reason (required)</Label>
          <Textarea
            id="reject-reason"
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="What should change?"
            className="text-sm"
          />
        </div>
      </div>
    </div>
  );
}
