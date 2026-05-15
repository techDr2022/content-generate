"use client";

import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/MobileNav";

interface HeaderProps {
  userName?: string;
}

export function Header({ userName }: HeaderProps) {
  const router = useRouter();

  function logout(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-white px-3 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[50%] md:max-w-none">
        <MobileNav />
        <div className="min-w-0 truncate text-sm font-semibold text-primary">techDr Content Studio</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground sm:gap-2 md:gap-3">
        <span className="hidden min-[400px]:inline-flex min-w-0 max-w-[28vw] items-center gap-1 truncate sm:max-w-[10rem] md:max-w-[14rem] lg:max-w-none">
          <User className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{userName ?? "User"}</span>
        </span>
        <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1 px-2 sm:px-3" asChild>
          <Link href="/settings" title="Settings">
            <Settings className="h-4 w-4 sm:mr-0.5" aria-hidden />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1 px-2 sm:px-3" onClick={logout} title="Log out">
          <LogOut className="h-4 w-4 sm:mr-0.5" aria-hidden />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}
