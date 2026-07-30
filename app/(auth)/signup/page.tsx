import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { signup } from "../actions";
import { SubmitButton } from "../submit-button";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your Vollyio account and get your first breakdown free.",
};

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
          Vollyio
        </Link>
        <div className="card border-chalk/15 bg-navy/90 p-7 shadow-lift backdrop-blur-xl">
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
                maxLength={80}
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
                maxLength={254}
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
                maxLength={128}
                autoComplete="new-password"
                placeholder="8+ characters"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "form-error" : undefined}
                className="input-field text-sm"
              />
            </div>
            <label
              htmlFor="terms"
              className="flex min-h-11 cursor-pointer items-start gap-3 text-xs leading-relaxed text-chalk-dim"
            >
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-gold"
              />
              <span>
                I am at least 13 years old and agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener"
                  className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener"
                  className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            <SubmitButton
              idleLabel="Start your first breakdown"
              pendingLabel="Creating your account…"
            />
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
