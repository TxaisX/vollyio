import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { FUNNEL_PENDING_COOKIE } from "@/lib/funnel";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { TesterInvite } from "@/components/tester-invite";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Tell the coaching service where you are and where you're headed.",
};

export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ retry?: string; manual?: string }>;
}) {
  const supabase = await createClient();
  const { retry, manual } = await searchParams;
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");

  // Returning players have nothing to set up; this page is a first-session ramp.
  const { count } = await supabase
    .from("analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) redirect("/dashboard");

  // The quiz-first funnel's arrival (D-122 polish). When /start parked answers,
  // it also set this cookie, so the first authenticated frame can be "saving
  // your plan" instead of the quiz re-asked from step 1 while the handoff in
  // the (app) layout applies the answers and redirects to /analyze. The
  // handoff deletes the cookie on its first run whatever it finds, and
  // refreshes this page if the storage turned out to be empty, so this card
  // resolves within one round trip in every case. Two params bypass it:
  // `retry` is applyFunnel saying the answers did NOT stick, and `manual` is
  // the player choosing the quiz over the wait - separate params because retry
  // carries an error banner the manual path has not earned.
  const funnelPending =
    !retry && !manual && (await cookies()).get(FUNNEL_PENDING_COOKIE) !== undefined;
  if (funnelPending) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
        <span aria-hidden="true" className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" />
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal [animation-delay:400ms]" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">
          Saving your plan to your account
        </h1>
        <p className="mt-2 max-w-prose text-body text-chalk-dim">
          Your answers from the quiz are being written to your new account. This
          takes a moment.
        </p>
        <Link
          href="/welcome?manual=1"
          className="mt-8 text-sm text-chalk-dim underline-offset-4 hover:underline"
        >
          Taking too long? Set up manually
        </Link>
      </section>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  return (
    <>
      {retry && (
        <p
          role="alert"
          className="mx-auto mb-4 max-w-xl rounded-card border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-chalk"
        >
          That didn&rsquo;t save. Run through it once more and it will stick.
        </p>
      )}
      <OnboardingFlow name={profile?.display_name ?? null} />
      {/* End of the funnel, which is the only moment anyone is plausibly
          willing to do a favour: they wanted this enough to make an account.
          Below the onboarding flow, never inside it, so it cannot compete with
          the thing they actually came here to finish. */}
      <TesterInvite className="mx-auto mt-8 max-w-xl" />
    </>
  );
}
