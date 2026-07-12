import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { login } from "../actions";
import { SubmitButton } from "../submit-button";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Sideout account.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="hero-glow" />
        <div className="animate-drift absolute inset-0">
          <SeamArcs className="absolute inset-0 h-full w-full" opacity={0.12} />
        </div>
      </div>
      <Reveal className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex min-h-11 items-center justify-center gap-2 font-display text-2xl font-bold tracking-tight"
        >
          <Image src="/icon-mark.png" alt="" width={30} height={30} />
          Sideout
        </Link>
        <div className="card border-chalk/15 bg-navy/90 p-7 shadow-lift backdrop-blur-xl">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
            Welcome back
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold">Log in</h1>
          {message && (
            <p role="status" className="mt-3 text-sm text-teal">
              {message}
            </p>
          )}
          {error && (
            <p id="form-error" role="alert" className="mt-3 text-sm text-coral">
              {error}
            </p>
          )}
          <form action={login} className="mt-6 flex flex-col gap-4">
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
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "form-error" : undefined}
                className="input-field text-sm"
              />
            </div>
            <SubmitButton idleLabel="Log in" pendingLabel="Logging in…" />
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-chalk-dim">
          New here?{" "}
          <Link
            href="/signup"
            className="text-gold underline-offset-4 transition-colors hover:underline"
          >
            Create an account
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
