import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { signup } from "../actions";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your Sideout account and get your first breakdown free.",
};

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <SeamArcs className="absolute inset-0 h-full w-full" opacity={0.08} />
      <Reveal className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 block text-center font-display text-2xl font-bold tracking-tight"
        >
          Sideout
        </Link>
        <div className="card p-7 shadow-lift">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
            First rep is free
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold">
            Create your account
          </h1>
          {error && (
            <p id="form-error" role="alert" className="mt-3 text-sm text-coral">
              {error}
            </p>
          )}
          <form action={signup} className="mt-6 flex flex-col gap-4">
            <div>
              <label
                htmlFor="display_name"
                className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-chalk-dim"
              >
                Name
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                autoComplete="name"
                placeholder="What your team calls you"
                className="input-field text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-chalk-dim"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@club.com"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "form-error" : undefined}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-chalk-dim"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="8+ characters"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "form-error" : undefined}
                className="input-field text-sm"
              />
            </div>
            <button type="submit" className="btn-primary mt-2 w-full">
              Start your first breakdown
            </button>
            <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
              No card. Your first breakdown in about a minute.
            </p>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-chalk-dim">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-gold underline-offset-4 transition-colors hover:underline"
          >
            Log in
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
