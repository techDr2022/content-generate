import type { ClientDTO } from "@hc/shared";
import { MapPin, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ClientCardProps {
  client: ClientDTO;
  onOpen: (client: ClientDTO) => void;
}

export function ClientCard({ client, onOpen }: ClientCardProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-lg">{client.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{client.doctorName}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onOpen(client)}>
          Manage
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {client.specialty.map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
        </div>
        {(client.services?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-1">
            {(client.services ?? []).slice(0, 4).map((svc) => (
              <Badge key={svc} variant="outline" className="max-w-[200px] truncate font-normal">
                {svc}
              </Badge>
            ))}
            {(client.services?.length ?? 0) > 4 ? (
              <span className="text-xs text-muted-foreground">+{(client.services ?? []).length - 4} more</span>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {client.city}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Stethoscope className="h-3 w-3" />
          {client.postsPerMonth} posts / month · {client.useCarousels ? "Carousels on" : "Posters only"}
        </div>
      </CardContent>
    </Card>
  );
}
