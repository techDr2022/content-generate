"use client";
import { useMemo, useState } from "react";
import axios from "axios";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientList } from "@/components/clients/ClientList";
import { ClientForm, type ClientFormValues } from "@/components/clients/ClientForm";
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from "@/hooks/useClients";
import type { ClientDTO } from "@/lib/types";

function clampPostsPerMonth(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 1) return 15;
  return Math.min(62, Math.floor(v));
}

function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (err.response?.status === 401) return "Session expired or not signed in. Please log in again.";
    if (err.response?.status) return `Request failed (${err.response.status}).`;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

export function ClientsPage() {
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDTO | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filters = useMemo(() => ({ q: search, specialty }), [search, specialty]);
  const clients = useClients(filters);
  const create = useCreateClient();
  const update = useUpdateClient();
  const remove = useDeleteClient();
  function openCreate(): void {
    setEditing(null);
    setSubmitError(null);
    setOpen(true);
  }

  function openEdit(client: ClientDTO): void {
    setEditing(client);
    setSubmitError(null);
    setOpen(true);
  }

  async function handleSubmit(values: ClientFormValues): Promise<void> {
    setSubmitError(null);
    if (values.specialty.length === 0) {
      setSubmitError("Select at least one medical specialty before saving.");
      return;
    }
    const payload = {
      name: values.name,
      doctorName: values.doctorName,
      clinicName: values.clinicName,
      city: values.city,
      specialty: values.specialty,
      brandType: values.brandType,
      postsPerMonth: clampPostsPerMonth(values.postsPerMonth),
      useCarousels: values.useCarousels,
      notes: values.notes || null,
      supportingTextDefault: values.supportingTextDefault.trim() || null,
      specialDays: values.specialDays.filter((s) => s.label && s.date),
      services: values.services,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload });
      } else {
        await create.mutateAsync(payload);
      }
      setOpen(false);
    } catch (err) {
      setSubmitError(apiErrorMessage(err));
    }
  }

  return (
    <PageWrapper
      title="Clients"
      description="Manage brands, specialties, service lines per specialty, cadence, and recurring special days."
      actions={
        <>
          <Button type="button" onClick={openCreate}>
            Add client
          </Button>
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setSubmitError(null);
                setEditing(null);
              }
            }}
          >
            <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden border bg-background p-0 shadow-lg sm:h-auto sm:max-h-[min(92dvh,920px)] sm:w-full sm:rounded-xl">
              <DialogHeader className="shrink-0 space-y-0 border-b px-4 pb-4 pt-6 text-left sm:px-6 sm:pb-4 sm:pt-6">
                <DialogTitle className="pr-8 text-left text-xl">
                  {editing ? "Edit client" : "New client"}
                </DialogTitle>
              </DialogHeader>
              {submitError ? (
                <p className="shrink-0 border-b px-4 py-3 text-sm text-destructive sm:px-6">
                  <span className="block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                    {submitError}
                  </span>
                </p>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-6 [-webkit-overflow-scrolling:touch]">
                <ClientForm
                  initial={editing}
                  submitting={create.isPending || update.isPending}
                  deleting={remove.isPending}
                  onCancel={() => setOpen(false)}
                  onSubmit={handleSubmit}
                  onDelete={
                    editing
                      ? async () => {
                          if (!window.confirm("Delete this client permanently?")) return;
                          await remove.mutateAsync(editing.id);
                          setOpen(false);
                          setEditing(null);
                        }
                      : undefined
                  }
                />
              </div>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      <ClientList
        clients={clients.data ?? []}
        search={search}
        onSearchChange={setSearch}
        specialtyFilter={specialty}
        onSpecialtyChange={setSpecialty}
        onOpenClient={(c) => {
          openEdit(c);
          setOpen(true);
        }}
      />
    </PageWrapper>
  );
}