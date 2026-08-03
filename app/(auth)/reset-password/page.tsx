import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { updatePassword } from "../actions";
import { SubmitButton } from "../submit-button";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new Vollyio password.",
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: false },
};

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Verifying the recovery link left a session behind, and that session is the
  // only thing that authorizes the change. Checking it here means a player who
  // opened this page without a live link is told so BEFORE typing a password
  // twice, rather than after. This is not the security boundary: the auth
  // service rejects the update itself, and updatePassword reports that too.
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);

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
            Almost back in
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold">
            Choose a new password
          </h1>
          {userId ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-chalk-dim">
                This replaces whatever password the account had before, including
                one you set on an earlier signup attempt.
              </p>
              {error && (
                <p id="form-error" role="alert" className="mt-3 text-sm text-coral">
                  {error}
                </p>
              )}
              <form action={updatePassword} className="mt-6 flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-chalk-dim"
                  >
                    New password
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
                <div>
                  <label
                    htmlFor="confirm"
                    className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-chalk-dim"
                  >
                    Type it again
                  </label>
                  <input
                    id="confirm"
                    name="confirm"
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
                <SubmitButton idleLabel="Save and sign in" pendingLabel="Saving…" />
              </form>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm leading-relaxed text-chalk-dim">
                This page needs a live reset link, and yours is not active. Links
                expire after an hour and each new one replaces the last, so ask
                for a fresh one and open the newest email.
              </p>
              <Link href="/forgot" className="btn-primary mt-6 block w-full text-center">
                Send me a new link
              </Link>
            </>
          )}
        </div>
        <p className="mt-5 text-center text-sm text-chalk-dim">
          Know your password?{" "}
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
