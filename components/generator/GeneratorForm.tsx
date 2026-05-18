import type { ClientDTO } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPicker } from "./MonthPicker";
import { PostCountInput } from "./PostCountInput";
import { SpecialDaysInput, type RunSpecialDay } from "./SpecialDaysInput";
import { SuggestedSpecialDaysPanel } from "./SuggestedSpecialDaysPanel";
import { Input } from "@/components/ui/input";

interface GeneratorFormProps {
  clients: ClientDTO[];
  clientId: string;
  onClientChange: (id: string) => void;
  year: number;
  onYearChange: (y: number) => void;
  months: number[];
  onMonthsChange: (m: number[]) => void;
  postOverride?: number;
  onPostOverrideChange: (v: number | undefined) => void;
  carouselOverride?: number;
  onCarouselOverrideChange: (v: number | undefined) => void;
  animatedOverride?: number;
  onAnimatedOverrideChange: (v: number | undefined) => void;
  clientUseCarousels?: boolean;
  extraSpecialDays: RunSpecialDay[];
  onExtraSpecialDaysChange: (rows: RunSpecialDay[]) => void;
  /** Selected client’s saved default for helper text */
  clientDefaultPosts?: number;
  /** Fixed carousel rows saved on the client (subset of monthly rows). */
  clientDefaultCarousels?: number;
  clientDefaultAnimated?: number;
  clientLabel?: string;
  clientSpecialties?: string[];
  /** First selected month (for AI suggestions) */
  suggestionMonth?: number;
  suggestionYear?: number;
  aiSuggestedDays?: RunSpecialDay[];
  aiSuggestedSelected?: boolean[];
  onAiSuggestedToggle?: (index: number, checked: boolean) => void;
  onSuggestSpecialDays?: () => void;
  /** Bypass browser cache and call Claude again. */
  onSuggestSpecialDaysForceApi?: () => void;
  suggestListSource?: null | "cache" | "api";
  suggestCacheSavedAt?: number | null;
  suggestSpecialDaysLoading?: boolean;
  suggestSpecialDaysError?: string | null;
  /** When false, hide AI suggestion panel */
  showSuggestedSpecialDays?: boolean;
  /** Minimum rows needed for selected special days + carousel count (parent-computed). */
  minRowsFromSelections?: number;
}

export function GeneratorForm({
  clients,
  clientId,
  onClientChange,
  year,
  onYearChange,
  months,
  onMonthsChange,
  postOverride,
  onPostOverrideChange,
  carouselOverride,
  onCarouselOverrideChange,
  animatedOverride,
  onAnimatedOverrideChange,
  clientUseCarousels,
  extraSpecialDays,
  onExtraSpecialDaysChange,
  clientDefaultPosts,
  clientDefaultCarousels,
  clientDefaultAnimated,
  clientLabel,
  clientSpecialties,
  suggestionMonth,
  suggestionYear,
  aiSuggestedDays,
  aiSuggestedSelected,
  onAiSuggestedToggle,
  onSuggestSpecialDays,
  onSuggestSpecialDaysForceApi,
  suggestListSource,
  suggestCacheSavedAt,
  suggestSpecialDaysLoading,
  suggestSpecialDaysError,
  showSuggestedSpecialDays = true,
  minRowsFromSelections,
}: GeneratorFormProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Client</Label>
          <Select value={clientId} onValueChange={onClientChange}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — {c.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            className="mt-1"
            type="number"
            value={year}
            min={2020}
            max={2100}
            onChange={(e) => onYearChange(Number(e.target.value))}
          />
        </div>
      </div>

      <MonthPicker value={months} onChange={onMonthsChange} />
      <PostCountInput
        value={postOverride}
        onChange={onPostOverrideChange}
        clientDefaultPosts={clientDefaultPosts}
        clientDefaultCarousels={clientDefaultCarousels}
        clientLabel={clientLabel}
        clientUseCarousels={clientUseCarousels}
        carouselValue={carouselOverride}
        onCarouselChange={onCarouselOverrideChange}
        clientDefaultAnimated={clientDefaultAnimated}
        animatedValue={animatedOverride}
        onAnimatedChange={onAnimatedOverrideChange}
        minRowsFromSelections={minRowsFromSelections}
      />
      {showSuggestedSpecialDays &&
      suggestionMonth != null &&
      suggestionYear != null &&
      clientSpecialties &&
      onSuggestSpecialDays &&
      onSuggestSpecialDaysForceApi &&
      onAiSuggestedToggle ? (
        <SuggestedSpecialDaysPanel
          specialties={clientSpecialties}
          month={suggestionMonth}
          year={suggestionYear}
          disabled={!clientId || clientSpecialties.length === 0}
          loading={Boolean(suggestSpecialDaysLoading)}
          error={suggestSpecialDaysError ?? null}
          listSource={suggestListSource ?? null}
          cacheSavedAt={suggestCacheSavedAt ?? null}
          rows={aiSuggestedDays ?? []}
          selected={aiSuggestedSelected ?? []}
          onToggle={onAiSuggestedToggle}
          onSuggest={onSuggestSpecialDays}
          onRefreshFromAi={onSuggestSpecialDaysForceApi}
        />
      ) : null}
      <SpecialDaysInput value={extraSpecialDays} onChange={onExtraSpecialDaysChange} />
    </div>
  );
}
