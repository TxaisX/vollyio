import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { captchaSiteKey } from "@/lib/captcha";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { createClient } from "@/lib/supabase/server";
import { startAnonymously } from "../actions";
import { FunnelBeacon } from "../funnel-beacon";
import { CaptchaField } from "../captcha-field";
import { SubmitButton } from "../submit-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Score one rep, free",
  description:
    "Film one rep, mark yourself on the frame, and get the full breakdown. No account, no card.",
  alternates: { canonical: "/try" },
};

/**
 * D-118. The top of the funnel, and the only page in the product whose job is
 * to hand somebody a session they did not ask for.
 *
 * It exists as a page rather than a button on the landing page because two
 * things have to happen before the anonymous session is minted, and both of
 * them need somewhere to live: the captcha widget has to have rendered and
 * produced a token, and the assent under the button has to have been READ. A
 * one-tap CTA that mints on click would mean footage arriving from someone who
 * was never shown the age line or the recording line, and the recording line is
 * the one that matters here, because by the time signup happens the clip is
 * already uploaded and already read.
 */
export default async function Try({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Anyone holding a session is sent on, anonymous included. The action guards
  // this too and is the guard that counts, but a page that still rendered "Score
  // my rep" to somebody who already has a session would be advertising a second
  // free read that the button deliberately will not hand out.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/analyze");

  const siteKey = captchaSiteKey();

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="hero-glow" />
        <div className="animate-drift absolute inset-0">
          <SeamArcs className="absolute inset-0 h-full w-full" opacity={0.12} />
        </div>
      </div>
      <FunnelBeacon event="try_view" />
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
            One rep, no account
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold">
            Score one rep, free
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-chalk-dim">
            Film one rep of one skill, tap yourself on the frame, and read the
            whole breakdown: the score, the checkpoints in order, and the one fix
            worth making next. Nothing is held back and there is no card.
          </p>
          {error && (
            <p id="form-error" role="alert" className="mt-3 text-sm text-coral">
              {error}
            </p>
          )}
          <form action={startAnonymously} className="mt-6 flex flex-col gap-4">
            {/*
              Consent by submission, in the same shape the signup form uses and
              for the same reason: a checkbox here would be a required tap that
              produces no information nobody has already decided to give.

              The RECORDING line is the one this page adds, and it is not
              decoration. On the old funnel this sat at signup, which came
              before any footage existed. It now has to come before the upload,
              because the upload is what puts a real person on our storage, and
              the clip is usually filmed at a gym full of other people's kids.
            */}
            <p className="text-xs leading-relaxed text-chalk-dim">
              By starting you confirm you are at least 13 years old, that you have
              the right to upload the footage you are about to send, and you agree
              to the{" "}
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
              idleLabel="Score my rep"
              pendingLabel="Getting the camera ready…"
              trackEvent="try_start"
            />
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
