import type { Metadata } from "next";
import { AnalyzeFlow } from "@/components/analyze-flow";
import { createClient } from "@/lib/supabase/server";
import { shouldEnforceFreeTier } from "@/lib/billing";
import { allowanceCopy, readAllowance } from "@/lib/allowance";
import { isDiscipline, isSkill } from "@/lib/skills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analyze a rep",
  description: "Upload a rep and get it scored frame by frame.",
};

export default async function Analyze({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; discipline?: string }>;
}) {
  const { skill, discipline } = await searchParams;

  // Above the flow, so it is read before the camera comes out rather than at
  // the 402 (docs/billing.md 4.6). Only when the cap is really enforced, and
  // nothing at all if the read fails: a missing counter is invisible, a wrong
  // one is a lie.
  const allowance = shouldEnforceFreeTier()
    ? await readAllowance(await createClient())
    : null;

  return (
    <>
      {allowance && (
        <p className="mb-5 font-mono text-[11px] text-chalk-dim">
          {allowanceCopy(allowance)}
        </p>
      )}
      <AnalyzeFlow
        initialSkill={skill && isSkill(skill) ? skill : null}
        initialDiscipline={
          discipline && isDiscipline(discipline) ? discipline : null
        }
      />
    </>
  );
}
