import type { ReactNode } from "react";

export default function ReviewGroupLayout({ children }: { children: ReactNode }): JSX.Element {
  return <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</div>;
}
