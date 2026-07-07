import Link from "next/link";

export default function Landing() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-gold">
        Volleyball form coach
      </p>
      <h1 className="font-display text-5xl font-bold tracking-tight">Sideout</h1>
      <p className="max-w-md text-chalk-dim">
        Record a rep. Get a frame-by-frame breakdown of your serve, pass, set,
        attack, block, and defense — with the one fix that matters most.
      </p>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-gold px-6 py-3 font-display font-bold text-navy transition hover:bg-gold-dim"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-line px-6 py-3 font-display font-bold text-chalk transition hover:border-gold"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
