import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import type { OpenAiImageOperation } from "./openaiImagePricing";

export type OpenAiCreditsSummary = {
  /** Prepaid balance from OpenAI (live) or manual env anchor minus tracked spend. */
  creditsRemainingUsd: number | null;
  creditsGrantedUsd: number | null;
  creditsUsedUsd: number | null;
  /** Where the balance number came from. */
  balanceSource: "openai" | "manual" | "estimated" | "unavailable";
  autoRechargeUsd: number | null;
  /** Sum of estimated image costs logged in this app (all time). */
  trackedSpendUsd: number;
  /** Spend in the selected dashboard period (UTC). */
  periodSpendUsd: number;
  imagesInPeriod: number;
  lastImageCostUsd: number | null;
  lastImageAt: string | null;
  configured: boolean;
};

type CreditGrantsResponse = {
  total_granted?: number;
  total_used?: number;
  total_available?: number;
};

let creditCache: { at: number; data: CreditGrantsResponse } | null = null;
const CREDIT_CACHE_MS = 60_000;

function openAiApiKey(): string | null {
  return (
    process.env.OPENAI_ADMIN_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    null
  );
}

function parseUsdEnv(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function fetchOpenAiCreditGrants(): Promise<CreditGrantsResponse | null> {
  const apiKey = openAiApiKey();
  if (!apiKey) return null;

  const now = Date.now();
  if (creditCache && now - creditCache.at < CREDIT_CACHE_MS) {
    return creditCache.data;
  }

  const urls = [
    "https://api.openai.com/v1/dashboard/billing/credit_grants",
    "https://api.openai.com/dashboard/billing/credit_grants",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as CreditGrantsResponse;
      if (typeof json.total_available === "number") {
        creditCache = { at: now, data: json };
        return json;
      }
    } catch (e) {
      logger.warn("OpenAI credit_grants fetch failed", {
        url,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return null;
}

export async function recordOpenAiImageUsage(input: {
  userId?: string;
  operation: OpenAiImageOperation;
  model: string;
  size?: string;
  quality?: string;
  costUsd: number;
}): Promise<void> {
  try {
    await prisma.openAiUsageLog.create({
      data: {
        userId: input.userId ?? null,
        operation: input.operation,
        model: input.model.slice(0, 120),
        size: input.size?.slice(0, 32) ?? null,
        quality: input.quality?.slice(0, 32) ?? null,
        costUsd: input.costUsd,
      },
    });
  } catch (e) {
    logger.warn("Failed to record OpenAI usage log", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function getOpenAiCreditsSummary(period?: {
  from?: Date;
  to?: Date;
}): Promise<OpenAiCreditsSummary> {
  const configured = Boolean(openAiApiKey());
  const autoRechargeUsd = parseUsdEnv("OPENAI_AUTO_RECHARGE_USD");
  const manualBalanceUsd = parseUsdEnv("OPENAI_CREDIT_BALANCE_USD");

  const from = period?.from;
  const to = period?.to;

  let trackedAgg = { _sum: { costUsd: null as number | null }, _count: 0 };
  let periodAgg = { _sum: { costUsd: null as number | null }, _count: 0 };
  let lastRow: { costUsd: number; createdAt: Date } | null = null;

  try {
    [trackedAgg, periodAgg, lastRow] = await Promise.all([
      prisma.openAiUsageLog.aggregate({ _sum: { costUsd: true }, _count: true }),
      prisma.openAiUsageLog.aggregate({
        where:
          from || to
            ? {
                createdAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : undefined,
        _sum: { costUsd: true },
        _count: true,
      }),
      prisma.openAiUsageLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { costUsd: true, createdAt: true },
      }),
    ]);
  } catch (e) {
    logger.warn("OpenAI usage log query failed — run prisma migrate", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const grants = await fetchOpenAiCreditGrants();

  const trackedSpendUsd = trackedAgg._sum.costUsd ?? 0;
  const periodSpendUsd = periodAgg._sum.costUsd ?? 0;
  const imagesInPeriod = periodAgg._count;

  let creditsRemainingUsd: number | null = null;
  let creditsGrantedUsd: number | null = null;
  let creditsUsedUsd: number | null = null;
  let balanceSource: OpenAiCreditsSummary["balanceSource"] = "unavailable";

  if (grants && typeof grants.total_available === "number") {
    creditsRemainingUsd = grants.total_available;
    creditsGrantedUsd = typeof grants.total_granted === "number" ? grants.total_granted : null;
    creditsUsedUsd = typeof grants.total_used === "number" ? grants.total_used : null;
    balanceSource = "openai";
  } else if (manualBalanceUsd != null) {
    creditsRemainingUsd = Math.max(0, manualBalanceUsd - trackedSpendUsd);
    balanceSource = "manual";
  } else if (configured && trackedSpendUsd > 0) {
    balanceSource = "estimated";
  }

  return {
    creditsRemainingUsd,
    creditsGrantedUsd,
    creditsUsedUsd,
    balanceSource,
    autoRechargeUsd,
    trackedSpendUsd,
    periodSpendUsd,
    imagesInPeriod,
    lastImageCostUsd: lastRow?.costUsd ?? null,
    lastImageAt: lastRow?.createdAt?.toISOString() ?? null,
    configured,
  };
}
