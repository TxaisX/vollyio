import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/motion";
import { SkillIcon } from "@/components/skill-icons";
import { SKILLS, SKILL_LABEL, isSkill, type Skill } from "@/lib/skills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "History",
  description: "Every rep you have filmed, with the priority fix for each.",
};

type Row = {
  id: string;
  skill: Skill;
  overall_score: number;
  created_at: string;
  result: { priority_fix?: { title?: string } };
};

export default async function History({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const { skill: skillParam } = await searchParams;
  const activeSkill = skillParam && isSkill(skillParam) ? skillParam : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("analyses")
    .select("id, skill, overall_score, created_at, result")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (activeSkill) query = query.eq("skill", activeSkill);

  const { data } = await query;
  // Known gap (R-CGSH-2): a failed fetch coerces to empty here rather than
  // distinguishing a fetch error from a genuinely empty history.
  const rows = (data as Row[] | null) ?? [];

  return (
    <section className="max-w-2xl">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
          History
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          The film room
        </h1>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/history"
            className={`chip ${!activeSkill ? "chip-active" : ""}`}
          >
            All
          </Link>
          {SKILLS.map((s) => (
            <Link
              key={s}
              href={`/history?skill=${s}`}
              className={`chip ${activeSkill === s ? "chip-active" : ""}`}
            >
              {SKILL_LABEL[s]}
            </Link>
          ))}
        </div>
      </Reveal>

      {rows.length === 0 ? (
        <Reveal delay={80}>
          <div className="card mt-8 p-8 text-center">
            <p className="font-display font-bold">Nothing here yet.</p>
            <p className="mt-1 text-sm text-chalk-dim">
              {activeSkill
                ? `No ${SKILL_LABEL[activeSkill].toLowerCase()} reps logged.`
                : "No reps logged yet."}
            </p>
            <Link href="/analyze" className="btn-primary mt-5 inline-flex text-sm">
              Film a rep
            </Link>
          </div>
        </Reveal>
      ) : (
        <Reveal delay={80}>
          <ul className="mt-6 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/analysis/${r.id}`}
                  className="group flex items-start gap-3 rounded-control p-3 transition-colors hover:bg-navy-light"
                >
                  <span className="w-12 shrink-0 pt-1 font-mono text-xs text-chalk-dim">
                    {new Date(r.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded bg-navy-light px-2 py-0.5 font-mono text-[10px] uppercase text-chalk-dim">
                        <SkillIcon skill={r.skill} className="h-3 w-3" />
                        {SKILL_LABEL[r.skill]}
                      </span>
                      <span className="font-display text-sm font-bold text-gold">
                        {r.overall_score}
                      </span>
                    </div>
                    {r.result?.priority_fix?.title && (
                      <p className="mt-1 text-sm text-chalk">
                        {r.result.priority_fix.title}
                      </p>
                    )}
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-1 h-4 w-4 text-chalk-dim transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </section>
  );
}
