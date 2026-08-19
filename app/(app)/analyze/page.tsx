import type { Metadata } from "next";
import { AnalyzeFlow } from "@/components/analyze-flow";
import { LimitNotice } from "@/components/limit-notice";
import { createClient } from "@/lib/supabase/server";
import { shouldEnforceFreeTier, UPGRADE_URL } from "@/lib/billing";
import {
  allowanceLine,
  allowanceTone,
  readAllowance,
  resetDate,
} from "@/lib/allowance";
import { isDiscipline, isSkill } from "@/lib/skills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analyze a rep",
  description: "Upload a rep and get it scored against the checkpoints for that skill.",
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

  // None left: the flow is not offered at all. Every path through it ends at
  // the same 402, so rendering the picker would be asking for a clip we already
  // know will be refused, and the refusal would land after the upload instead
  // of before it. A read that failed leaves `allowance` null and the flow
  // renders as normal, because the server is still the thing that decides.
  if (allowance && allowanceTone(allowance) === "out") {
    return (
      <section className="max-w-xl">
        <LimitNotice
          headingAs="h1"
          plan={allowance.plan}
          allowance={allowance.allowance}
          resetsOn={resetDate(allowance)}
          canBuy={UPGRADE_URL !== null}
        />
      </section>
    );
  }

  return (
    <>
      {allowance && (
        // At one left this reads as a warning rather than a fact: gold, not the
        // coral error colour, because running out is a state and not a mistake
        // the player made.
        <p
          className={`mb-5 font-mono text-[11px] ${
            allowanceTone(allowance) === "last" ? "text-gold-ink" : "text-chalk-dim"
          }`}
        >
          {allowanceLine(allowance)}
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
