"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAIN_NAV_LINKS, NAV_FOOTER_NOTE } from "./navLinks";

export function Sidebar() {
  const pathname = usePathname();
  const FooterIcon = NAV_FOOTER_NOTE.icon;

  return (
    <aside className="sticky top-14 z-40 hidden max-h-[calc(100vh-3.5rem)] min-h-[calc(100vh-3.5rem)] w-56 shrink-0 self-start overflow-y-auto border-r bg-white md:block">
      <div className="flex min-h-full flex-col gap-1 p-3">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Navigation</div>
        {MAIN_NAV_LINKS.map((link) => {
          const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100",
                isActive && "bg-primary/10 text-primary"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
        <div className="mt-auto px-2 pb-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <FooterIcon className="h-4 w-4" />
            {NAV_FOOTER_NOTE.text}
          </div>
        </div>
      </div>
    </aside>
  );
}
