"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-navy text-chalk">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="card w-full max-w-sm p-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
              Sideout
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold">
              Something broke.
            </h1>
            <p className="mt-3 text-sm text-chalk-dim">
              The app hit an error it couldn&apos;t recover from. Reload to keep
              going.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary mt-6 w-full"
            >
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
