import Link from "next/link";

// Lands whenever a share token no longer resolves: revoked, expired, or never
// real. Recipients are guests, not players, so it explains the door is closed
// and offers the product instead of a bare 404.
export default function SharedBreakdownNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between border-b border-line pb-5">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-wide text-gold-ink"
        >
          Vollyio
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
          Shared breakdown
        </span>
      </div>

      <div className="card mt-10 p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          This link is off or expired.
        </h1>
        <p className="mt-2 max-w-md text-body text-chalk-dim">
          The player turned sharing off, or the link ran out of time.
          Breakdowns stay private unless someone chooses to share them.
        </p>
        <Link href="/" className="btn-primary mt-5 inline-block min-h-11 px-5 py-2.5 text-sm">
          Try Vollyio
        </Link>
      </div>
    </main>
  );
}
