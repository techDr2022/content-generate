"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OpenAiCreditsDTO } from "@/hooks/useOpenAiCredits";
import type { DashboardPeriod } from "@/lib/dashboardPeriod";
import type { UseQueryResult } from "@tanstack/react-query";

type Props = {
  credits: UseQueryResult<OpenAiCreditsDTO | null>;
  period: DashboardPeriod;
  periodName: string;
  formatUsd: (amount: number | null | undefined) => string;
};

export function OpenAiCreditsCard({ credits, period, periodName, formatUsd }: Props) {
  const data = credits.data;

  return (
    <Card className="border-amber-500/25 bg-amber-500/[0.04]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">OpenAI credits</CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Prepaid balance for poster images (same as platform.openai.com billing). Refreshes every minute.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data?.configured ? (
          <p className="text-sm text-muted-foreground">
            Add <code className="text-xs">OPENAI_API_KEY</code> in your environment to generate posters and track
            usage here.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Credits remaining</p>
              <p className="text-2xl font-semibold tabular-nums">
                {credits.isLoading ? "…" : formatUsd(data.creditsRemainingUsd)}
              </p>
              {data.balanceSource === "openai" ? (
                <p className="text-[11px] text-muted-foreground mt-0.5">Live from OpenAI</p>
              ) : data.balanceSource === "manual" ? (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  From OPENAI_CREDIT_BALANCE_USD minus app-tracked spend
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Set OPENAI_CREDIT_BALANCE_USD to your platform balance, or enable live sync via API key
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Spent this period</p>
              <p className="text-2xl font-semibold tabular-nums">
                {credits.isLoading ? "…" : formatUsd(data.periodSpendUsd)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {data.imagesInPeriod} poster image{data.imagesInPeriod === 1 ? "" : "s"}
                {period !== "all" ? ` · ${periodName}` : ""}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last image (est.)</p>
              <p className="text-2xl font-semibold tabular-nums">
                {credits.isLoading ? "…" : formatUsd(data.lastImageCostUsd)}
              </p>
              {data.lastImageAt ? (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(data.lastImageAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Auto-recharge</p>
              <p className="text-2xl font-semibold tabular-nums">
                {data.autoRechargeUsd != null ? formatUsd(data.autoRechargeUsd) : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Set OPENAI_AUTO_RECHARGE_USD=10 to match your OpenAI setting
              </p>
            </div>
          </div>
        )}
        {data?.configured &&
        data.creditsRemainingUsd != null &&
        data.lastImageCostUsd != null &&
        data.lastImageCostUsd > 0 ? (
          <p className="text-xs text-muted-foreground">
            ≈ {Math.max(0, Math.floor(data.creditsRemainingUsd / data.lastImageCostUsd))} more poster images at your
            last image cost ({formatUsd(data.lastImageCostUsd)} each).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
