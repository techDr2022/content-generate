import { useEffect, useMemo, useState } from "react";
import type { ClientDTO, MedicalSpecialty, SpecialDayDTO } from "@hc/shared";
import {
  getAvailableServicesForSpecialties,
  isValidCustomServiceName,
  MAX_CUSTOM_SERVICE_LENGTH,
  MAX_SERVICES_PER_CLIENT,
  MEDICAL_SPECIALTIES,
  SPECIALTY_SERVICES,
} from "@hc/shared";
import { ChevronDown, ChevronUp, Loader2, Sparkles, Trash2 } from "lucide-react";
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
  const suggestServices = useSuggestServices();

  useEffect(() => {
    setValues(mapInitial(initial));
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

      <div>
        <Label id="specialties-label">Specialties</Label>
        <p id="specialties-scroll-hint" className="mt-1 text-xs text-muted-foreground">
          Scroll up and down in the box below to browse all specialties.
        </p>
        <div
          role="group"
          aria-labelledby="specialties-label"
          aria-describedby="specialties-scroll-hint"
          className="mt-2 max-h-56 overflow-y-auto overscroll-y-contain rounded-md border border-input bg-muted/15 p-3 shadow-inner [-webkit-overflow-scrolling:touch]"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {MEDICAL_SPECIALTIES.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={values.specialty.includes(s)} onCheckedChange={() => toggleSpecialty(s)} />
                <span className="leading-snug">{s}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <Label>Services offered</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Options are grouped by each selected specialty. Pick catalog lines and/or add custom services. Order matters:
              the generator treats earlier rows as higher priority. Use the up and down controls to reorder.
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
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Priority order ({values.services.length} / {MAX_SERVICES_PER_CLIENT})</p>
              {values.services.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Select catalog items below or add a custom service.</p>
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
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label htmlFor="custom-service" className="text-xs">
                    Additional custom service
                  </Label>
                  <Input
                    id="custom-service"
                    className="mt-1"
                    placeholder="e.g. Saturday walk-in clinic"
                    maxLength={MAX_CUSTOM_SERVICE_LENGTH}
                    value={customServiceDraft}
                    onChange={(e) => setCustomServiceDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomService();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={values.services.length >= MAX_SERVICES_PER_CLIENT || !isValidCustomServiceName(customServiceDraft)}
                  onClick={addCustomService}
                >
                  Add
                </Button>
              </div>
            </div>

            <div
              role="region"
              aria-label="Service catalog by specialty"
              className="rounded-md border p-3"
            >
              <div className="space-y-4">
                {values.specialty.map((sp) => {
                  const list = SPECIALTY_SERVICES[sp as MedicalSpecialty];
                  if (!list?.length) return null;
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

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="ppm">Posts per month</Label>
          <Input
            id="ppm"
            type="number"
            inputMode="numeric"
            value={values.postsPerMonth}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setValues({ ...values, postsPerMonth: 15 });
                return;
              }
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              setValues({ ...values, postsPerMonth: n });
            }}
            onBlur={() =>
              setValues((v) => ({ ...v, postsPerMonth: clampPostsPerMonthState(v.postsPerMonth) }))
            }
          />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <Checkbox
            id="carousels"
            checked={values.useCarousels}
            onCheckedChange={(c) => setValues({ ...values, useCarousels: Boolean(c) })}
          />
          <Label htmlFor="carousels">Use carousels for eligible formats</Label>
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
