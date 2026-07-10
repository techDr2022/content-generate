import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardList,
  Download,
  History,
  ImageIcon,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

export interface MainNavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const MAIN_NAV_LINKS: MainNavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/reviews", label: "Reviews", icon: ClipboardList },
  { href: "/generator", label: "Generator", icon: Sparkles },
  { href: "/image-generation", label: "Image Generation", icon: ImageIcon },
  { href: "/bulk-export", label: "Bulk export", icon: Download },
  { href: "/jobs", label: "Job history", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const NAV_FOOTER_NOTE = {
  icon: CalendarDays,
  text: "Internal agency tool",
} as const;
