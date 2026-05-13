"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function ProtectedLayout({ children }: { children: ReactNode }): JSX.Element | null {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const u = JSON.parse(raw) as { name?: string };
        setUserName(u.name);
      } catch {
        setUserName(undefined);
      }
    }
    setAuthorized(true);
  }, [router]);

  if (!authorized) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header userName={userName} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
