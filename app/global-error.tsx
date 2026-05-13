"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Application error</h1>
        <p className="max-w-md text-sm text-slate-600">
          {error.message || "The app failed to load. Please refresh the page."}
        </p>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
