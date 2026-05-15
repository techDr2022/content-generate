"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MAIN_NAV_LINKS, NAV_FOOTER_NOTE } from "./navLinks";

export function MobileNav(): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const FooterIcon = NAV_FOOTER_NOTE.icon;

  return (
    <div className="shrink-0 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Open navigation menu">
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent
          className={cn(
            "left-0 right-auto w-[min(20rem,calc(100vw-1rem))] max-w-[85vw] border-l-0 border-r p-0 sm:max-w-none",
            "flex flex-col gap-0"
          )}
        >
          <SheetHeader className="border-b px-4 py-4 text-left">
            <SheetTitle className="text-base">Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch]">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Navigation</div>
            {MAIN_NAV_LINKS.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-100",
                    isActive && "bg-primary/10 text-primary"
                  )}
                >
                  <link.icon className="h-5 w-5 shrink-0" aria-hidden />
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-auto border-t pt-3">
              <div className="flex items-center gap-2 px-2 pb-1 text-xs text-muted-foreground">
                <FooterIcon className="h-4 w-4 shrink-0" aria-hidden />
                {NAV_FOOTER_NOTE.text}
              </div>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
