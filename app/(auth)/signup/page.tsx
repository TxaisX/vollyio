import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { captchaSiteKey } from "@/lib/captcha";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { enabledOAuthProviders } from "@/lib/oauth";
import { SIGNUP_GRANT } from "@/lib/plans";
import { signup } from "../actions";
import { FunnelBeacon } from "../funnel-beacon";
import { OAuthButtons } from "../oauth-buttons";
import { CaptchaField } from "../captcha-field";
import { SubmitButton } from "../submit-button";

export const metadata: Metadata = {
  title: "Sign up",
  // Quoted from the plan constant, never retyped: this line said "your first
  // breakdown free" while the grant was 3, which undersold the offer for a
  // month before anyone noticed.
  description: `Create your Vollyio account and get your first ${SIGNUP_GRANT} breakdowns free.`,
  alternates: { canonical: "/signup" },
};

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const providers = enabledOAuthProviders(process.env.OAUTH_PROVIDERS);
  const siteKey = captchaSiteKey();

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="hero-glow" />
        <div className="animate-drift absolute inset-0">
          <SeamArcs className="absolute inset-0 h-full w-full" opacity={0.12} />
        </div>
      </div>
      <FunnelBeacon event="auth_signup_view" data={{ oauth: providers.length }} />
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
          <OAuthButtons providers={providers} />
          <form action={signup} className="mt-6 flex flex-col gap-4">
            {/* D-121. The wall on a locked breakdown arrives with ?next= so the
                claim branch of the action can send the player back to the page
                they were refused. Allowlisted server-side (claimDestination);
                absent or mangled it falls back to /welcome. */}
            {next && <input type="hidden" name="next" value={next} />}
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
            {/*
              Consent by submission, disclosed immediately above the button that
              gives it, which is where it is actually read. The checkbox this
              replaced was a required tap that produced no information: nobody
              who wanted an account ever answered it "no", and everyone who
              missed it got an error telling them to agree to something they had
              already decided to agree to.

              The age statement stays a STATEMENT rather than being softened
              into the Terms link. It is a COPPA line on a product built for
              youth athletes, so it has to be legible on the page, not one click
              away inside a legal document.
            */}
            <p className="text-xs leading-relaxed text-chalk-dim">
              By creating an account you confirm you are at least 13 years old and
              agree to the{" "}
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
            </p>
            <CaptchaField siteKey={siteKey} />
            <SubmitButton
              idleLabel="Start your first breakdown"
              pendingLabel="Creating your account…"
              trackEvent="auth_signup_submit"
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
