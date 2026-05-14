import { useEffect, useMemo, useState } from "react";
import type { ClientDTO, SpecialDayDTO } from "@/lib/types";
import {
  getAvailableServicesForSpecialties,
  getCustomServiceValidationMessage,
  getCustomSpecialtyValidationMessage,
  isCatalogMedicalSpecialty,
  isValidCustomServiceName,
  isValidCustomSpecialtyName,
  MAX_CUSTOM_SERVICE_LENGTH,
  MAX_CUSTOM_SPECIALTY_LENGTH,
  MAX_SERVICES_PER_CLIENT,
  MAX_SPECIALTIES_PER_CLIENT,
  MEDICAL_SPECIALTIES,
  SPECIALTY_SERVICES,
} from "@/lib/types";
import { ChevronDown, ChevronUp, Loader2, Search, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useSuggestServices } from "@/hooks/useClients";

export interface ClientFormValues {
  name: string;
  doctorName: string;
  clinicName: string;
  city: string;
  specialty: string[];
  services: string[];
  brandType: "clinic" | "personal" | "hospital";
  postsPerMonth: number;
  /** Carousel-type rows within postsPerMonth (0 = no fixed count on the profile). */
  carouselsPerMonth: number;
  useCarousels: boolean;
  notes: string;
  /** Verbatim block placed before hashtags in generated supporting text */
  supportingTextDefault: string;
  specialDays: { label: string; date: string; type: "festival" | "awareness" | "campaign" }[];
}

function sanitizeServicesForSpecialties(services: string[], specialty: string[]): string[] {
  if (specialty.length === 0) return [];
  const allowed = new Set(getAvailableServicesForSpecialties(specialty));
  return services.filter((s) => allowed.has(s) || isValidCustomServiceName(s));
}

/** Keep posts/month in range; used on blur and when the number input is cleared. */
function clampPostsPerMonthState(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 15;
  return Math.min(62, Math.floor(n));
}

function clampCarouselsState(carousels: number, postsPerMonth: number): number {
  if (!Number.isFinite(carousels) || carousels < 0) return 0;
  return Math.min(62, postsPerMonth, Math.floor(carousels));
}

interface ClientFormProps {
  initial?: ClientDTO | null;
  onSubmit: (values: ClientFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  onDelete?: () => Promise<void> | void;
  deleting?: boolean;
}

function mapInitial(client: ClientDTO | null | undefined): ClientFormValues {
  if (!client) {
    return {
      name: "",
      doctorName: "",
      clinicName: "",
      city: "",
      specialty: [],
      services: [],
      brandType: "clinic",
      postsPerMonth: 15,
      carouselsPerMonth: 0,
      useCarousels: false,
      notes: "",
      supportingTextDefault: "",
      specialDays: [],
    };
  }
  return {
    name: client.name,
    doctorName: client.doctorName,
    clinicName: client.clinicName,
    city: client.city,
    specialty: [...client.specialty],
    services: sanitizeServicesForSpecialties([...(client.services ?? [])], client.specialty),
    brandType: client.brandType as ClientFormValues["brandType"],
    postsPerMonth: clampPostsPerMonthState(client.postsPerMonth),
    carouselsPerMonth: clampCarouselsState(client.carouselsPerMonth ?? 0, clampPostsPerMonthState(client.postsPerMonth)),
    useCarousels: client.useCarousels,
    notes: client.notes ?? "",
    supportingTextDefault: client.supportingTextDefault ?? "",
    specialDays: (client.specialDays as SpecialDayDTO[] | undefined)?.map((s) => ({
      label: s.label,
      date: s.date,
      type: s.type as ClientFormValues["specialDays"][number]["type"],
    })) ?? [],
  };
}

export function ClientForm({ initial, onSubmit, onCancel, submitting, onDelete, deleting }: ClientFormProps) {
  const baseline = useMemo(() => mapInitial(initial), [initial]);
  const [values, setValues] = useState<ClientFormValues>(baseline);
  const [customServiceDraft, setCustomServiceDraft] = useState("");
  const [customSpecialtyDraft, setCustomSpecialtyDraft] = useState("");
  const [specialtySearchQuery, setSpecialtySearchQuery] = useState("");
  const suggestServices = useSuggestServices();

  useEffect(() => {
    setValues(mapInitial(initial));
    setCustomServiceDraft("");
    setCustomSpecialtyDraft("");
    setSpecialtySearchQuery("");
  }, [initial]);

  function toggleSpecialty(s: string): void {
    setValues((v) => {
      const specialty = v.specialty.includes(s) ? v.specialty.filter((x) => x !== s) : [...v.specialty, s];
      if (specialty.length === 0) {
        return { ...v, specialty, services: [] };
      }
      return {
        ...v,
        specialty,
        services: sanitizeServicesForSpecialties(v.services, specialty),
      };
    });
  }

  function toggleService(svc: string): void {
    setValues((v) => ({
      ...v,
      services: v.services.includes(svc) ? v.services.filter((x) => x !== svc) : [...v.services, svc],
    }));
  }

  function moveService(idx: number, dir: -1 | 1): void {
    setValues((v) => {
      const j = idx + dir;
      if (j < 0 || j >= v.services.length) return v;
      const copy = [...v.services];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return { ...v, services: copy };
    });
  }

  function removeServiceAt(idx: number): void {
    setValues((v) => ({
      ...v,
      services: v.services.filter((_, i) => i !== idx),
    }));
  }

  function addCustomService(): void {
    const t = customServiceDraft.trim();
    if (!isValidCustomServiceName(t)) return;
    setValues((v) => {
      if (v.services.length >= MAX_SERVICES_PER_CLIENT) return v;
      if (v.services.some((s) => s.toLowerCase() === t.toLowerCase())) return v;
      return { ...v, services: [...v.services, t] };
    });
    setCustomServiceDraft("");
  }

  function removeCustomSpecialty(label: string): void {
    setValues((v) => {
      const specialty = v.specialty.filter((x) => x !== label);
      if (specialty.length === 0) {
        return { ...v, specialty, services: [] };
      }
      return {
        ...v,
        specialty,
        services: sanitizeServicesForSpecialties(v.services, specialty),
      };
    });
  }

  function addCustomSpecialty(): void {
    const t = customSpecialtyDraft.trim();
    if (!isValidCustomSpecialtyName(t)) return;
    setValues((v) => {
      if (v.specialty.length >= MAX_SPECIALTIES_PER_CLIENT) return v;
      if (v.specialty.some((s) => s.toLowerCase() === t.toLowerCase())) return v;
      const specialty = [...v.specialty, t];
      return {
        ...v,
        specialty,
        services: sanitizeServicesForSpecialties(v.services, specialty),
      };
    });
    setCustomSpecialtyDraft("");
  }

  async function handleSuggestServicesWithAi(): Promise<void> {
    if (values.specialty.length === 0) return;
    if (values.services.length > 0) {
      const ok = window.confirm(
        "Replace your current service picks with a new ordered list from AI? (You can still edit after.)"
      );
      if (!ok) return;
    }
    const list = await suggestServices.mutateAsync({
      specialties: values.specialty,
      clinicName: values.clinicName.trim() || undefined,
      city: values.city.trim() || undefined,
      doctorName: values.doctorName.trim() || undefined,
      notes: values.notes.trim() || undefined,
    });
    setValues((v) => ({
      ...v,
      services: sanitizeServicesForSpecialties(list, v.specialty),
    }));
  }

  const filteredCatalogSpecialties = useMemo(() => {
    const q = specialtySearchQuery.trim().toLowerCase();
    if (!q) return [...MEDICAL_SPECIALTIES];
    return MEDICAL_SPECIALTIES.filter((s) => s.toLowerCase().includes(q));
  }, [specialtySearchQuery]);

  const hiddenSelectedCatalog = useMemo(() => {
    const q = specialtySearchQuery.trim();
    if (!q) return [];
    const visible = new Set<string>(filteredCatalogSpecialties);
    return values.specialty.filter((s) => isCatalogMedicalSpecialty(s) && !visible.has(s));
  }, [specialtySearchQuery, values.specialty, filteredCatalogSpecialties]);

  const customDraftTrim = customServiceDraft.trim();
  const customValidationMsg = getCustomServiceValidationMessage(customServiceDraft);
  const customIsDuplicate =
    customDraftTrim.length >= 2 &&
    values.services.some((s) => s.toLowerCase() === customDraftTrim.toLowerCase());
  const canAddCustom =
    values.services.length < MAX_SERVICES_PER_CLIENT &&
    isValidCustomServiceName(customServiceDraft) &&
    !customIsDuplicate;

  const customSpecTrim = customSpecialtyDraft.trim();
  const customSpecValidationMsg = getCustomSpecialtyValidationMessage(customSpecialtyDraft);
  const customSpecIsDup =
    customSpecTrim.length >= 2 &&
    values.specialty.some((s) => s.toLowerCase() === customSpecTrim.toLowerCase());
  const canAddCustomSpecialty =
    values.specialty.length < MAX_SPECIALTIES_PER_CLIENT &&
    isValidCustomSpecialtyName(customSpecialtyDraft) &&
    !customSpecIsDup;

  return (
    <form
      className="flex min-h-0 flex-col gap-4 pb-1"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(values);
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="doctor">Doctor name</Label>
          <Input
            id="doctor"
            value={values.doctorName}
            onChange={(e) => setValues({ ...values, doctorName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="clinic">Clinic / brand name</Label>
          <Input
            id="clinic"
            value={values.clinicName}
            onChange={(e) => setValues({ ...values, clinicName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" value={values.city} onChange={(e) => setValues({ ...values, city: e.target.value })} required />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Monthly calendar cadence</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Total rows per month and how many use multi-slide Carousels. The generator uses these unless you set a
            one-off override on the Generator page.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="ppm">Posts per month</Label>
            <Input
              id="ppm"
              type="number"
              inputMode="numeric"
              className="mt-1"
              value={values.postsPerMonth}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setValues({ ...values, postsPerMonth: 15 });
                  return;
                }
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                const posts = clampPostsPerMonthState(n);
                setValues({
                  ...values,
                  postsPerMonth: posts,
                  carouselsPerMonth: clampCarouselsState(values.carouselsPerMonth, posts),
                });
              }}
              onBlur={() =>
                setValues((v) => {
                  const posts = clampPostsPerMonthState(v.postsPerMonth);
                  return {
                    ...v,
                    postsPerMonth: posts,
                    carouselsPerMonth: clampCarouselsState(v.carouselsPerMonth, posts),
                  };
                })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">Total calendar rows (posters + carousels), 1–62.</p>
          </div>
          <div>
            <Label htmlFor="cpm">Carousels for month</Label>
            <Input
              id="cpm"
              type="number"
              inputMode="numeric"
              className="mt-1"
              min={0}
              max={values.postsPerMonth}
              value={values.carouselsPerMonth}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setValues({ ...values, carouselsPerMonth: 0 });
                  return;
                }
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                setValues({
                  ...values,
                  carouselsPerMonth: clampCarouselsState(n, values.postsPerMonth),
                });
              }}
              onBlur={() =>
                setValues((v) => ({
                  ...v,
                  carouselsPerMonth: clampCarouselsState(v.carouselsPerMonth, v.postsPerMonth),
                }))
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Rows that use type Carousel (0–{values.postsPerMonth}). Remaining rows are single-image posters.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="carousels"
            className="mt-0.5"
            checked={values.useCarousels}
            onCheckedChange={(c) => setValues({ ...values, useCarousels: Boolean(c) })}
          />
          <Label htmlFor="carousels" className="cursor-pointer text-sm font-normal leading-snug">
            Use carousels for eligible formats (when not using a fixed count above, Claude may pick carousels for
            step-by-step, comparisons, etc.)
          </Label>
        </div>
      </div>

      <div>
        <Label id="specialties-label">Specialties</Label>
        <p id="specialties-scroll-hint" className="mt-1 text-xs text-muted-foreground">
          Search the catalog, tick to select, or add a custom specialty below. Up to {MAX_SPECIALTIES_PER_CLIENT} total.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="specialty-search"
              type="search"
              className="pl-9"
              placeholder="Search catalog specialties…"
              value={specialtySearchQuery}
              onChange={(e) => setSpecialtySearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredCatalogSpecialties.length === 1) {
                    toggleSpecialty(filteredCatalogSpecialties[0]);
                  }
                }
              }}
              autoComplete="off"
              aria-describedby="specialties-scroll-hint"
            />
          </div>
          {specialtySearchQuery.trim() ? (
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setSpecialtySearchQuery("")}>
              Clear search
            </Button>
          ) : null}
        </div>
        {hiddenSelectedCatalog.length > 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Selected but not in current filter:{" "}
            <span className="font-medium text-foreground">{hiddenSelectedCatalog.join(", ")}</span>
            {" · "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => setSpecialtySearchQuery("")}
            >
              Show full catalog
            </button>
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {specialtySearchQuery.trim()
            ? `Showing ${filteredCatalogSpecialties.length} of ${MEDICAL_SPECIALTIES.length} catalog specialties.`
            : `${MEDICAL_SPECIALTIES.length} catalog specialties — use search to narrow the list.`}
          {filteredCatalogSpecialties.length === 1 ? " Press Enter in search to toggle the only match." : null}
        </p>
        <div
          role="group"
          aria-labelledby="specialties-label"
          aria-describedby="specialties-scroll-hint"
          className="mt-2 max-h-56 overflow-y-auto overscroll-y-contain rounded-md border border-input bg-muted/15 p-3 shadow-inner [-webkit-overflow-scrolling:touch]"
        >
          {filteredCatalogSpecialties.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No catalog matches. Try another spelling, clear search, or add a custom specialty below.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredCatalogSpecialties.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={values.specialty.includes(s)} onCheckedChange={() => toggleSpecialty(s)} />
                  <span className="leading-snug">{s}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {values.specialty.some((s) => !isCatalogMedicalSpecialty(s)) ? (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Custom specialties">
            {values.specialty
              .filter((s) => !isCatalogMedicalSpecialty(s))
              .map((s) => (
                <div
                  key={s}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  <span className="min-w-0 truncate" title={s}>
                    {s}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove custom specialty ${s}`}
                    onClick={() => removeCustomSpecialty(s)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
          </div>
        ) : null}
        <div className="mt-3 rounded-md border border-dashed border-primary/30 bg-muted/25 p-3">
          <Label htmlFor="custom-specialty" className="text-sm font-medium">
            Add custom specialty
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Use when your focus is not in the list (e.g. &quot;Sleep Medicine&quot;, &quot;Sports Cardiology&quot;). Custom labels have no preset service catalog — add service lines with{" "}
            <span className="font-medium text-foreground">Add custom service</span> later, or use Suggest with AI.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <Input
                id="custom-specialty"
                placeholder="e.g. Bariatric & metabolic medicine"
                maxLength={MAX_CUSTOM_SPECIALTY_LENGTH}
                value={customSpecialtyDraft}
                onChange={(e) => setCustomSpecialtyDraft(e.target.value)}
                aria-invalid={Boolean(customSpecValidationMsg || (customSpecIsDup && customSpecTrim.length >= 2))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (canAddCustomSpecialty) addCustomSpecialty();
                  }
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {customSpecTrim.length} / {MAX_CUSTOM_SPECIALTY_LENGTH} · Enter to add · {values.specialty.length} /{" "}
                {MAX_SPECIALTIES_PER_CLIENT} specialties
              </p>
              {customSpecValidationMsg ? (
                <p className="mt-1 text-xs text-destructive" role="alert">
                  {customSpecValidationMsg}
                </p>
              ) : null}
              {customSpecIsDup && customSpecTrim.length >= 2 ? (
                <p className="mt-1 text-xs text-destructive" role="alert">
                  That specialty is already selected.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={!canAddCustomSpecialty}
              title={
                values.specialty.length >= MAX_SPECIALTIES_PER_CLIENT
                  ? `Maximum ${MAX_SPECIALTIES_PER_CLIENT} specialties`
                  : customSpecIsDup
                    ? "Already selected"
                    : customSpecTrim.length === 0
                      ? "Type a label, then add"
                      : !isValidCustomSpecialtyName(customSpecialtyDraft)
                        ? "Fix the issues shown below the field"
                        : "Add to selected specialties"
              }
              onClick={addCustomSpecialty}
            >
              Add specialty
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <Label>Services offered</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick lines from each specialty catalog below, <span className="font-medium text-foreground">add your own custom lines</span> (not in the catalog), or use &quot;Suggest with AI&quot;. Order matters: the generator treats earlier rows as higher priority. Reorder with the arrows.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 gap-1.5"
            disabled={values.specialty.length === 0 || suggestServices.isPending || submitting}
            title={
              values.specialty.length === 0
                ? "Select at least one specialty first"
                : "Use Claude to propose services from your specialty catalogs"
            }
            onClick={() => void handleSuggestServicesWithAi().catch(() => undefined)}
          >
            {suggestServices.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            Suggest with AI
          </Button>
        </div>
        {suggestServices.isError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {suggestServices.error instanceof Error ? suggestServices.error.message : "Could not get suggestions"}
          </p>
        ) : null}
        {values.specialty.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Select at least one specialty to see services.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-dashed border-primary/30 bg-muted/25 p-3">
              <Label htmlFor="custom-service" className="text-sm font-medium">
                Add custom service
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Any line not in the catalog below — e.g. a named package, ward, or program. It is saved on the client and used like catalog lines (ordering + generator). Up to {MAX_SERVICES_PER_CLIENT} lines total including catalog picks.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <Input
                    id="custom-service"
                    placeholder="e.g. Saturday walk-in skin clinic"
                    maxLength={MAX_CUSTOM_SERVICE_LENGTH}
                    value={customServiceDraft}
                    onChange={(e) => setCustomServiceDraft(e.target.value)}
                    aria-invalid={Boolean(customValidationMsg || (customIsDuplicate && customDraftTrim.length >= 2))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (canAddCustom) addCustomService();
                      }
                    }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {customDraftTrim.length} / {MAX_CUSTOM_SERVICE_LENGTH} characters · Press Enter to add
                  </p>
                  {customValidationMsg ? (
                    <p className="mt-1 text-xs text-destructive" role="alert">
                      {customValidationMsg}
                    </p>
                  ) : null}
                  {customIsDuplicate && customDraftTrim.length >= 2 ? (
                    <p className="mt-1 text-xs text-destructive" role="alert">
                      That line is already in your priority list.
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={!canAddCustom}
                  title={
                    values.services.length >= MAX_SERVICES_PER_CLIENT
                      ? `Maximum ${MAX_SERVICES_PER_CLIENT} services`
                      : customIsDuplicate
                        ? "Already in the list"
                        : customDraftTrim.length === 0
                          ? "Type a service line, then add"
                          : !isValidCustomServiceName(customServiceDraft)
                            ? "Fix the issues shown below the field"
                            : "Add this line to the priority list"
                  }
                  onClick={addCustomService}
                >
                  Add to list
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Priority order ({values.services.length} / {MAX_SERVICES_PER_CLIENT})
              </p>
              {values.services.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a custom line above and/or tick catalog items below.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {values.services.map((svc, idx) => (
                    <li
                      key={`${svc}-${idx}`}
                      className="flex items-center gap-2 rounded-md border border-transparent bg-muted/40 px-2 py-1.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate" title={svc}>
                        {svc}
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={idx === 0}
                          aria-label="Move service up"
                          onClick={() => moveService(idx, -1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={idx === values.services.length - 1}
                          aria-label="Move service down"
                          onClick={() => moveService(idx, 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Remove service"
                          onClick={() => removeServiceAt(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              role="region"
              aria-label="Service catalog by specialty"
              className="rounded-md border p-3"
            >
              <p className="mb-3 text-xs text-muted-foreground">Catalog — tick to add; untick to remove (same list as above).</p>
              <div className="space-y-4">
                {values.specialty.map((sp) => {
                  const list = (SPECIALTY_SERVICES as Readonly<Record<string, readonly string[]>>)[sp];
                  if (list?.length) {
                    return (
                      <div key={sp}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{sp}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {list.map((svc) => (
                            <label key={svc} className="flex items-start gap-2 text-sm leading-snug">
                              <Checkbox
                                className="mt-0.5"
                                checked={values.services.includes(svc)}
                                onCheckedChange={() => toggleService(svc)}
                              />
                              <span>{svc}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={sp}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sp}</p>
                      <p className="text-sm text-muted-foreground">
                        No preset catalog for this label. Add services with <span className="font-medium text-foreground">Add custom service</span> above, or use Suggest with AI.
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Brand type</Label>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {(
            [
              ["clinic", "Clinic"],
              ["personal", "Personal"],
              ["hospital", "Hospital"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="brandType"
                value={value}
                checked={values.brandType === value}
                onChange={() => setValues({ ...values, brandType: value })}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Special days</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setValues({
                ...values,
                specialDays: [...values.specialDays, { label: "", date: "", type: "awareness" }],
              })
            }
          >
            Add day
          </Button>
        </div>
        <div className="space-y-2">
          {values.specialDays.map((row, idx) => (
            <div key={idx} className="grid gap-2 rounded-md border p-3 md:grid-cols-4">
              <Input
                placeholder="Label"
                value={row.label}
                onChange={(e) => {
                  const copy = [...values.specialDays];
                  copy[idx] = { ...row, label: e.target.value };
                  setValues({ ...values, specialDays: copy });
                }}
              />
              <Input
                type="date"
                value={row.date}
                onChange={(e) => {
                  const copy = [...values.specialDays];
                  copy[idx] = { ...row, date: e.target.value };
                  setValues({ ...values, specialDays: copy });
                }}
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={row.type}
                onChange={(e) => {
                  const copy = [...values.specialDays];
                  copy[idx] = { ...row, type: e.target.value as ClientFormValues["specialDays"][number]["type"] };
                  setValues({ ...values, specialDays: copy });
                }}
              >
                <option value="festival">Festival</option>
                <option value="awareness">Awareness</option>
                <option value="campaign">Campaign</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const copy = values.specialDays.filter((_, i) => i !== idx);
                  setValues({ ...values, specialDays: copy });
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <Label htmlFor="supporting-default">Default supporting text</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. Inserted verbatim right before the hashtag block on every post (after the main caption body; e.g. disclaimers, booking info).
          </p>
        </div>
        <Textarea
          id="supporting-default"
          rows={5}
          placeholder="e.g. Book online at example.com · Mon–Sat 9am–6pm · Emergency line …"
          maxLength={8000}
          value={values.supportingTextDefault}
          onChange={(e) => setValues({ ...values, supportingTextDefault: e.target.value })}
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {values.supportingTextDefault.length} / 8000 characters
        </p>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Internal notes for your team only — not injected into generated captions.
        </p>
        <Textarea
          id="notes"
          rows={4}
          className="mt-1"
          value={values.notes}
          onChange={(e) => setValues({ ...values, notes: e.target.value })}
        />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div>
          {initial && onDelete ? (
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void onDelete()}
            >
              Delete client
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {initial ? "Save client" : "Create client"}
          </Button>
        </div>
      </div>
    </form>
  );
}
