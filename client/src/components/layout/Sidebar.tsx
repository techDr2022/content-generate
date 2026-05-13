import { NavLink } from "react-router-dom";
import { CalendarDays, Download, History, ImageIcon, LayoutDashboard, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/generator", label: "Generator", icon: Sparkles },
  { to: "/poster-images", label: "Poster images", icon: ImageIcon },
  { to: "/bulk-export", label: "Bulk export", icon: Download },
  { to: "/jobs", label: "Job history", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="sticky top-14 z-40 hidden max-h-[calc(100vh-3.5rem)] min-h-[calc(100vh-3.5rem)] w-56 shrink-0 self-start overflow-y-auto border-r bg-white md:block">
      <div className="flex min-h-full flex-col gap-1 p-3">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Navigation</div>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100",
                isActive && "bg-primary/10 text-primary"
              )
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
        <div className="mt-auto px-2 pb-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Internal agency tool
          </div>
        </div>
      </div>
    </aside>
  );
}
