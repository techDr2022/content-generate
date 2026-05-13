import type { ClientDTO } from "@/lib/types";
import { MEDICAL_SPECIALTIES } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientCard } from "./ClientCard";

interface ClientListProps {
  clients: ClientDTO[];
  search: string;
  onSearchChange: (v: string) => void;
  specialtyFilter: string;
  onSpecialtyChange: (v: string) => void;
  onOpenClient: (client: ClientDTO) => void;
}

export function ClientList({
  clients,
  search,
  onSearchChange,
  specialtyFilter,
  onSpecialtyChange,
  onOpenClient,
}: ClientListProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Name, doctor, clinic, city..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div>
          <Label>Specialty filter</Label>
          <Select value={specialtyFilter || "all"} onValueChange={(v) => onSpecialtyChange(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All specialties" />
            </SelectTrigger>
            <SelectContent className="max-h-[min(70vh,320px)]">
              <SelectItem value="all">All specialties</SelectItem>
              {MEDICAL_SPECIALTIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {clients.map((c) => (
          <ClientCard key={c.id} client={c} onOpen={onOpenClient} />
        ))}
      </div>
      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clients match your filters yet.</p>
      ) : null}
    </div>
  );
}
