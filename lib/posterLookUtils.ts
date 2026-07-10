import type { ClientBrandKit } from "@/lib/types/brandKit";
import type { PosterLookId } from "@/lib/types/posterLook";

export function resolvePosterLookForIndex(
  kit: ClientBrandKit | null | undefined,
  index: number,
  sessionFallback: PosterLookId,
  sessionCustom?: string
): { posterLook: PosterLookId; posterLookCustom?: string } {
  if (kit?.rotatePosterStyles && kit.posterLookPool?.length) {
    const look = kit.posterLookPool[index % kit.posterLookPool.length]!;
    if (look === "custom") {
      const custom = kit.posterLookCustom?.trim();
      return custom ? { posterLook: "custom", posterLookCustom: custom } : { posterLook: sessionFallback };
    }
    return { posterLook: look };
  }

  if (kit?.defaultPosterLook) {
    if (kit.defaultPosterLook === "custom") {
      const custom = kit.posterLookCustom?.trim();
      return custom
        ? { posterLook: "custom", posterLookCustom: custom }
        : { posterLook: sessionFallback };
    }
    return { posterLook: kit.defaultPosterLook };
  }

  if (sessionFallback === "custom") {
    const custom = sessionCustom?.trim();
    return custom ? { posterLook: "custom", posterLookCustom: custom } : { posterLook: "text_only" };
  }

  return { posterLook: sessionFallback };
}
