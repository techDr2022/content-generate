import { useId } from "react";
import {
  MAX_ANIMATED_PER_MONTH,
  MAX_CALENDAR_ROWS_PER_MONTH,
  MAX_CAROUSELS_PER_MONTH,
  MAX_POSTS_PER_MONTH,
} from "@/lib/constants/cadence";
import { maxAnimatedForCadence, maxCarouselsForCadence } from "@/lib/cadenceClamps";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface PostCountInputProps {
  value?: number;
  onChange: (v: number | undefined) => void;
  /** Client profile default when no override */
  clientDefaultPosts?: number;
  clientLabel?: string;
  /** When set, client allows carousels in profile (helper text only). */
  clientUseCarousels?: boolean;
  /** Client profile: fixed carousel rows per month (0 = not set). */
  clientDefaultCarousels?: number;
  carouselValue?: number;
  onCarouselChange?: (v: number | undefined) => void;
  clientDefaultAnimated?: number;
  animatedValue?: number;
  onAnimatedChange?: (v: number | undefined) => void;
  /** At least this many rows are required for the selected special days and carousel count. */
  minRowsFromSelections?: number;
}

/**
 * Poster count and optional carousel count are fully controlled by the parent
 * so Generate always receives the same values the UI shows (no stale local checkbox state).
 */
export function PostCountInput({
  value,
  onChange,
  clientDefaultPosts,
  clientLabel,
  clientUseCarousels,
  clientDefaultCarousels,
  carouselValue,
  onCarouselChange,
  clientDefaultAnimated,
  animatedValue,
  onAnimatedChange,
  minRowsFromSelections,
}: PostCountInputProps) {
  const id = useId();
  const checkboxId = `${id}-custom-posters`;
  const inputId = `${id}-poster-count`;
  const carouselCheckboxId = `${id}-custom-carousels`;
  const carouselInputId = `${id}-carousel-count`;
  const animatedCheckboxId = `${id}-custom-animated`;
  const animatedInputId = `${id}-animated-count`;

  const posterCustomOn = typeof value === "number" && value >= 0;
  const carouselCustomOn = typeof carouselValue === "number";
  const animatedCustomOn = typeof animatedValue === "number";

  const clientCarousels =
    typeof clientDefaultCarousels === "number" && clientDefaultCarousels > 0 ? clientDefaultCarousels : 0;
  const clientAnimated =
    typeof clientDefaultAnimated === "number" && clientDefaultAnimated > 0 ? clientDefaultAnimated : 0;

  const seedCount =
    typeof clientDefaultPosts === "number" && clientDefaultPosts > 0 ? clientDefaultPosts : 15;

  const defaultDescription =
    typeof clientDefaultPosts === "number"
      ? `${clientDefaultPosts} poster row${clientDefaultPosts === 1 ? "" : "s"}${
          clientCarousels > 0
            ? ` + ${clientCarousels} carousel row${clientCarousels === 1 ? "" : "s"}`
            : ""
        }${
          clientAnimated > 0
            ? ` + ${clientAnimated} animated row${clientAnimated === 1 ? "" : "s"}`
            : ""
        }${clientLabel ? ` — ${clientLabel}` : ""}`
      : "each client’s saved posts-per-month";

  const displayCount =
    typeof value === "number" && value >= 0 && value <= MAX_POSTS_PER_MONTH ? value : seedCount;

  const minNeed = typeof minRowsFromSelections === "number" ? minRowsFromSelections : 1;
  const rawCarousel =
    carouselCustomOn && typeof carouselValue === "number" && Number.isFinite(carouselValue)
      ? Math.max(0, Math.round(carouselValue))
      : 0;
  const rawAnimated =
    animatedCustomOn && typeof animatedValue === "number" && Number.isFinite(animatedValue)
      ? Math.max(0, Math.round(animatedValue))
      : 0;

  const displayCarousel = carouselCustomOn
    ? Math.min(
        rawCarousel,
        posterCustomOn
          ? maxCarouselsForCadence(displayCount, rawAnimated)
          : MAX_CAROUSELS_PER_MONTH
      )
    : 0;
  const displayAnimated = animatedCustomOn
    ? Math.min(
        rawAnimated,
        posterCustomOn
          ? maxAnimatedForCadence(displayCount, displayCarousel)
          : MAX_ANIMATED_PER_MONTH
      )
    : 0;

  const maxCarousels = posterCustomOn
    ? maxCarouselsForCadence(displayCount, displayAnimated)
    : MAX_CAROUSELS_PER_MONTH;
  const maxAnimated = posterCustomOn
    ? maxAnimatedForCadence(displayCount, displayCarousel)
    : MAX_ANIMATED_PER_MONTH;

  const addonRows =
    (carouselCustomOn ? displayCarousel : 0) + (animatedCustomOn ? displayAnimated : 0);
  const userRowTotalIntent = posterCustomOn ? displayCount + addonRows : seedCount + clientCarousels + clientAnimated;
  const maxPostersWhenAddonsOn = Math.min(
    MAX_POSTS_PER_MONTH,
    Math.max(0, MAX_CALENDAR_ROWS_PER_MONTH - (carouselCustomOn ? displayCarousel : 0) - (animatedCustomOn ? displayAnimated : 0))
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id={checkboxId}
            checked={posterCustomOn}
            onCheckedChange={(checked) => {
              const on = checked === true;
              if (!on) {
                onChange(undefined);
                return;
              }
              onChange(typeof value === "number" && value >= 0 ? value : seedCount);
            }}
            className="mt-0.5"
          />
          <div className="min-w-0 space-y-1">
            <Label htmlFor={checkboxId} className="cursor-pointer text-base font-medium leading-snug">
              Custom number of posters
            </Label>
            <p className="text-sm text-muted-foreground">
              {posterCustomOn
                ? `How many single-image Poster rows to generate (0–${MAX_POSTS_PER_MONTH}). Carousel and Animated rows are added on top. Special-day rules can raise the total on the server.`
                : `Uncheck to use ${defaultDescription}.`}
            </p>
          </div>
        </div>

        {posterCustomOn ? (
          <div className="space-y-2 pl-7">
            <Label htmlFor={inputId}>Posters to generate</Label>
            <Input
              id={inputId}
              type="number"
              min={0}
              max={carouselCustomOn || animatedCustomOn ? maxPostersWhenAddonsOn : MAX_POSTS_PER_MONTH}
              className="max-w-[140px]"
              value={displayCount}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  return;
                }
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                const cap = carouselCustomOn || animatedCustomOn ? maxPostersWhenAddonsOn : MAX_POSTS_PER_MONTH;
                const clamped = Math.min(cap, Math.max(0, Math.round(n)));
                onChange(clamped);
              }}
            />
            <p className="text-xs text-muted-foreground">
              0–{carouselCustomOn || animatedCustomOn ? maxPostersWhenAddonsOn : MAX_POSTS_PER_MONTH} posters (Carousel
              and Animated rows added on top; server may raise total for special days).
            </p>
            {minNeed > userRowTotalIntent ? (
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                Generate will use at least {minNeed} total calendar rows for your selected special days, posters, and
                rows (your posters + carousels + animated = {userRowTotalIntent}).
              </p>
            ) : null}
          </div>
        ) : null}
        {!posterCustomOn && minNeed > seedCount ? (
          <p className="text-xs text-amber-800 dark:text-amber-200/90 pl-7">
            This run needs at least {minNeed} rows for selected special days and carousels (client default is {seedCount}
            ).
          </p>
        ) : null}
      </div>

      {onCarouselChange ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id={carouselCheckboxId}
              checked={carouselCustomOn}
              onCheckedChange={(checked) => {
                const on = checked === true;
                if (!on) {
                  onCarouselChange(undefined);
                  return;
                }
                const start =
                  typeof carouselValue === "number" && carouselValue >= 0
                    ? Math.min(carouselValue, maxCarousels)
                    : clientCarousels > 0
                      ? Math.min(clientCarousels, maxCarousels)
                      : Math.min(clientUseCarousels ? 3 : 2, maxCarousels);
                onCarouselChange(start);
              }}
              className="mt-0.5"
            />
            <div className="min-w-0 space-y-1">
              <Label htmlFor={carouselCheckboxId} className="cursor-pointer text-base font-medium leading-snug">
                Custom number of carousel posts (this run)
              </Label>
              <p className="text-sm text-muted-foreground">
                {carouselCustomOn
                  ? `Exactly this many rows will use type "Carousel"; the other rows will be "Poster" (up to ${maxCarousels} carousel row${maxCarousels === 1 ? "" : "s"}: 62 total rows minus your poster count).`
                  : clientCarousels > 0
                    ? `This client’s profile fixes ${clientCarousels} carousel row${clientCarousels === 1 ? "" : "s"} per month unless you check above for a one-off count.`
                    : clientUseCarousels
                      ? "Uncheck to let Claude decide from the client profile (carousels allowed for eligible styles only)."
                      : "Client profile has flexible carousels off — you can still set a count here for this run only."}
              </p>
            </div>
          </div>

          {carouselCustomOn ? (
            <div className="space-y-2 pl-7">
              <Label htmlFor={carouselInputId}>Carousel rows in this calendar</Label>
              <Input
                id={carouselInputId}
                type="number"
                min={0}
                max={maxCarousels}
                className="max-w-[140px]"
                value={displayCarousel}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    return;
                  }
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  const clamped = Math.min(maxCarousels, Math.max(0, Math.round(n)));
                  onCarouselChange(clamped);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Range 0–{maxCarousels} (0 = all single-image posters). Server clamps to final row count if special
                days raise the total.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {onAnimatedChange ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id={animatedCheckboxId}
              checked={animatedCustomOn}
              onCheckedChange={(checked) => {
                const on = checked === true;
                if (!on) {
                  onAnimatedChange(undefined);
                  return;
                }
                const start =
                  typeof animatedValue === "number" && animatedValue >= 0
                    ? Math.min(animatedValue, maxAnimated)
                    : clientAnimated > 0
                      ? Math.min(clientAnimated, maxAnimated)
                      : Math.min(2, maxAnimated);
                onAnimatedChange(start);
              }}
              className="mt-0.5"
            />
            <div className="min-w-0 space-y-1">
              <Label htmlFor={animatedCheckboxId} className="cursor-pointer text-base font-medium leading-snug">
                Custom number of animated posts (this run)
              </Label>
              <p className="text-sm text-muted-foreground">
                {animatedCustomOn
                  ? `Exactly this many rows will use type "Animated" (up to ${maxAnimated} animated row${maxAnimated === 1 ? "" : "s"}).`
                  : clientAnimated > 0
                    ? `This client’s profile fixes ${clientAnimated} animated row${clientAnimated === 1 ? "" : "s"} per month unless you check above for a one-off count.`
                    : "Set a count here for motion-style posts this run only."}
              </p>
            </div>
          </div>

          {animatedCustomOn ? (
            <div className="space-y-2 pl-7">
              <Label htmlFor={animatedInputId}>Animated rows in this calendar</Label>
              <Input
                id={animatedInputId}
                type="number"
                min={0}
                max={maxAnimated}
                className="max-w-[140px]"
                value={displayAnimated}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    return;
                  }
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  const clamped = Math.min(maxAnimated, Math.max(0, Math.round(n)));
                  onAnimatedChange(clamped);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Range 0–{maxAnimated} (0 = no animated rows this run).
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
