"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-display text-2xl font-bold">This didn&apos;t load.</h1>
        <p className="mt-3 text-sm text-chalk-dim">
          We couldn&apos;t load this page. Try again, or head back to your
          dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary w-full"
          >
            Try again
          </button>
          <Link href="/dashboard" className="btn-ghost w-full">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
