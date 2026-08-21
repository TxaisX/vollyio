import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { captchaSiteKey } from "@/lib/captcha";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { requestPasswordReset } from "../actions";
import { CaptchaField } from "../captcha-field";
import { SubmitButton } from "../submit-button";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a link to set a new Vollyio password.",
  alternates: { canonical: "/forgot" },
  robots: { index: false, follow: false },
};

export default async function Forgot({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const siteKey = captchaSiteKey();

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
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
            Locked out
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold">
            Reset your password
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-chalk-dim">
            We will email you a link to set a new one. It works even if you never
            confirmed your account, so this is also how you finish signing up.
          </p>
          {message && (
            <p role="status" className="mt-3 text-sm text-teal-ink">
              {message}
            </p>
          )}
          {error && (
            <p id="form-error" role="alert" className="mt-3 text-sm text-coral-ink">
              {error}
            </p>
          )}
          <form action={requestPasswordReset} className="mt-6 flex flex-col gap-4">
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
            <CaptchaField siteKey={siteKey} />
            <SubmitButton idleLabel="Email me a link" pendingLabel="Sending…" />
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-chalk-dim">
          Remembered it?{" "}
          <Link
            href="/login"
            className="-my-3 inline-block py-3 text-gold-ink underline-offset-4 transition-colors hover:underline"
          >
            Log in
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
