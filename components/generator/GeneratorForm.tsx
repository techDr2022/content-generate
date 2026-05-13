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
  extraSpecialDays: RunSpecialDay[];
  onExtraSpecialDaysChange: (rows: RunSpecialDay[]) => void;
  /** Selected client’s saved default for helper text */
  clientDefaultPosts?: number;
  clientLabel?: string;
  clientSpecialties?: string[];
  /** First selected month (for AI suggestions) */
  suggestionMonth?: number;
  suggestionYear?: number;
  aiSuggestedDays?: RunSpecialDay[];
  aiSuggestedSelected?: boolean[];
  onAiSuggestedToggle?: (index: number, checked: boolean) => void;
  onSuggestSpecialDays?: () => void;
  suggestSpecialDaysLoading?: boolean;
  suggestSpecialDaysError?: string | null;
  /** When false, hide AI suggestion panel */
  showSuggestedSpecialDays?: boolean;
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
  extraSpecialDays,
  onExtraSpecialDaysChange,
  clientDefaultPosts,
  clientLabel,
  clientSpecialties,
  suggestionMonth,
  suggestionYear,
  aiSuggestedDays,
  aiSuggestedSelected,
  onAiSuggestedToggle,
  onSuggestSpecialDays,
  suggestSpecialDaysLoading,
  suggestSpecialDaysError,
  showSuggestedSpecialDays = true,
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
        clientLabel={clientLabel}
      />
      {showSuggestedSpecialDays &&
      suggestionMonth != null &&
      suggestionYear != null &&
      clientSpecialties &&
      onSuggestSpecialDays &&
      onAiSuggestedToggle ? (
        <SuggestedSpecialDaysPanel
          specialties={clientSpecialties}
          month={suggestionMonth}
          year={suggestionYear}
          disabled={!clientId || clientSpecialties.length === 0}
          loading={Boolean(suggestSpecialDaysLoading)}
          error={suggestSpecialDaysError ?? null}
          rows={aiSuggestedDays ?? []}
          selected={aiSuggestedSelected ?? []}
          onToggle={onAiSuggestedToggle}
          onSuggest={onSuggestSpecialDays}
        />
      ) : null}
      <SpecialDaysInput value={extraSpecialDays} onChange={onExtraSpecialDaysChange} />
    </div>
  );
}
