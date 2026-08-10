import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { TesterInvite } from "@/components/tester-invite";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Tell the coaching service where you are and where you're headed.",
};

export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ retry?: string }>;
}) {
  const supabase = await createClient();
  const { retry } = await searchParams;
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");

  // Returning players have nothing to set up; this page is a first-session ramp.
  const { count } = await supabase
    .from("analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) redirect("/dashboard");

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
