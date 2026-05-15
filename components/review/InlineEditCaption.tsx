"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface InlineEditCaptionProps {
  value: string;
  disabled?: boolean;
  onSave: (next: string) => void;
  debounceMs?: number;
}

export function InlineEditCaption({ value, disabled, onSave, debounceMs = 800 }: InlineEditCaptionProps): JSX.Element {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  function scheduleSave(next: string): void {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSave(next);
    }, debounceMs);
  }

  return (
    <Textarea
      value={local}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        setLocal(next);
        scheduleSave(next);
      }}
      onBlur={() => {
        if (timer.current) clearTimeout(timer.current);
        onSave(local);
      }}
      rows={4}
      className="text-sm"
    />
  );
}
