"use client";

import { Card, CardContent } from "@/components/ui/card";

export function PostCardSkeleton(): JSX.Element {
  return (
    <Card className="overflow-hidden border-slate-200">
      <div className="aspect-square w-full animate-pulse bg-slate-200" />
      <CardContent className="space-y-3 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-20 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-full animate-pulse rounded bg-slate-200" />
      </CardContent>
    </Card>
  );
}
