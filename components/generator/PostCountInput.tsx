import { useId } from "react";
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
  minRowsFromSelections,
}: PostCountInputProps) {
  const id = useId();
  const checkboxId = `${id}-custom-posters`;
  const inputId = `${id}-poster-count`;
  const carouselCheckboxId = `${id}-custom-carousels`;
  const carouselInputId = `${id}-carousel-count`;

  const posterCustomOn = typeof value === "number" && value >= 1;
  const carouselCustomOn = typeof carouselValue === "number";

  const clientCarousels =
    typeof clientDefaultCarousels === "number" && clientDefaultCarousels > 0 ? clientDefaultCarousels : 0;

  const seedCount =
    typeof clientDefaultPosts === "number" && clientDefaultPosts > 0 ? clientDefaultPosts : 15;

  const defaultDescription =
    typeof clientDefaultPosts === "number"
      ? `${clientDefaultPosts} total calendar row${clientDefaultPosts === 1 ? "" : "s"}${
          clientCarousels > 0 ? `, including ${clientCarousels} fixed carousel row${clientCarousels === 1 ? "" : "s"}` : ""
        }${clientLabel ? ` — ${clientLabel}` : ""}`
      : "each client’s saved posts-per-month";

  const displayCount =
    typeof value === "number" && value >= 1 && value <= 62 ? value : seedCount;

  const minNeed = typeof minRowsFromSelections === "number" ? minRowsFromSelections : 1;
  const rawCarousel =
    carouselCustomOn && typeof carouselValue === "number" && Number.isFinite(carouselValue)
      ? Math.max(0, Math.round(carouselValue))
      : 0;

  let maxCarousels: number;
  let displayCarousel: number;

  if (posterCustomOn) {
    /** Carousels stack on top of poster rows; only the 62-row month cap limits count (not specials floor). */
    const posterCap = Math.max(0, 62 - displayCount);
    maxCarousels = posterCap;
    displayCarousel = carouselCustomOn ? Math.min(Math.max(0, rawCarousel), maxCarousels) : Math.min(3, maxCarousels);
  } else {
    const effT = Math.min(62, Math.max(seedCount, minNeed));
    maxCarousels = Math.min(62, effT);
    displayCarousel = carouselCustomOn ? Math.min(Math.max(0, rawCarousel), maxCarousels) : Math.min(3, maxCarousels);
  }

  const userRowTotalIntent = posterCustomOn ? displayCount + (carouselCustomOn ? displayCarousel : 0) : seedCount;
  const maxPostersWhenCarouselsOn = carouselCustomOn ? Math.max(1, 62 - displayCarousel) : 62;

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
              onChange(typeof value === "number" && value >= 1 ? value : seedCount);
            }}
            className="mt-0.5"
          />
          <div className="min-w-0 space-y-1">
            <Label htmlFor={checkboxId} className="cursor-pointer text-base font-medium leading-snug">
              Custom number of posters
            </Label>
            <p className="text-sm text-muted-foreground">
              {posterCustomOn
                ? "How many single-image Poster rows to generate. Carousel rows are added on top (max 62 poster + carousel rows in one month). Special-day rules can raise the total on the server."
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
              min={1}
              max={maxPostersWhenCarouselsOn}
              className="max-w-[140px]"
              value={displayCount}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  return;
                }
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                const clamped = Math.min(maxPostersWhenCarouselsOn, Math.max(1, Math.round(n)));
                onChange(clamped);
              }}
            />
            <p className="text-xs text-muted-foreground">
              1–{maxPostersWhenCarouselsOn} posters (room for carousels within 62 total rows).
            </p>
            {minNeed > userRowTotalIntent ? (
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                Generate will use at least {minNeed} total calendar rows for your selected special days, posters, and
                carousels (your posters + carousels = {userRowTotalIntent}).
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
    </div>
  );
}
