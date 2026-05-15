"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HashtagEditorProps {
  value: string;
  disabled?: boolean;
  onSave: (commaSeparated: string) => void;
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[,#\s]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean);
}

export function HashtagEditor({ value, disabled, onSave }: HashtagEditorProps): JSX.Element {
  const [tags, setTags] = useState<string[]>(() => parseTags(value));
  const [input, setInput] = useState("");

  useEffect(() => {
    setTags(parseTags(value));
  }, [value]);

  const joined = useMemo(() => tags.join(", "), [tags]);

  function commit(merged: string[]): void {
    setTags(merged);
    onSave(merged.join(", "));
  }

  return (
    <div
      className="space-y-2"
      onBlur={(e) => {
        if (disabled) return;
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onSave(joined);
        }
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1 font-normal">
            #{t}
            {!disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1"
                onClick={() => commit(tags.filter((x) => x !== t))}
              >
                ×
              </Button>
            ) : null}
          </Badge>
        ))}
      </div>
      {!disabled ? (
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add hashtag"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const extra = parseTags(input);
                if (extra.length === 0) return;
                const merged = [...new Set([...tags, ...extra])];
                setInput("");
                commit(merged);
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const extra = parseTags(input);
              if (extra.length === 0) return;
              const merged = [...new Set([...tags, ...extra])];
              setInput("");
              commit(merged);
            }}
          >
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}
