import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
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
  const userId = await getAuthUserId(supabase);

  let query = supabase
    .from("analyses")
    .select("id, skill, overall_score, created_at, result")
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(100);
  if (activeSkill) query = query.eq("skill", activeSkill);

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data as Row[] | null) ?? [];

  return (
    <section className="max-w-4xl">
      <Reveal>
        {/* Same header rhythm as the dashboard and settings: kicker, title,
            controls, then one rule closing the block off from the content. */}
        <div className="border-b border-line pb-5">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
            History
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            The film room
          </h1>

          <div className="mt-3 flex flex-wrap gap-2">
            {/* aria-current, because the active filter is otherwise carried by
                the gold fill alone. */}
            <Link
              href="/history"
              aria-current={!activeSkill ? "page" : undefined}
              className={`chip min-h-11 ${!activeSkill ? "chip-active" : ""}`}
            >
              All
            </Link>
            {SKILLS.map((s) => (
              <Link
                key={s}
                href={`/history?skill=${s}`}
                aria-current={activeSkill === s ? "page" : undefined}
                className={`chip min-h-11 ${activeSkill === s ? "chip-active" : ""}`}
              >
                {SKILL_LABEL[s]}
              </Link>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Same-route crossfade: the skill filter changes ?skill= on the same
          /history route. Keying the ViewTransition on the active filter lets
          React crossfade the list in place (share="auto") instead of a hard
          swap, while the heading and chips above stay put. The Reveal around
          it stays mounted across filters, so this only animates the swap. */}
      <Reveal delay={80}>
        <ViewTransition
          key={activeSkill ?? "all"}
          name="history-list"
          share="auto"
          default="none"
        >
          {rows.length === 0 ? (
            <div className="card mt-6 p-8 text-center">
              <p className="font-display text-lg font-bold">Nothing here yet.</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-chalk-dim">
                {activeSkill
                  ? `No ${SKILL_LABEL[activeSkill].toLowerCase()} reps logged.`
                  : "No reps logged yet."}
              </p>
              <Link href="/analyze" className="btn-primary mt-5 inline-flex text-sm">
                Film a rep
              </Link>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-line">
              {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/analysis/${r.id}`}
                  className="group flex min-h-11 items-start gap-3 rounded-control p-3 transition-colors hover:bg-navy-light"
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
                      {/* Shared-element morph source: this score appears to
                          travel into the breakdown's score ring when the row
                          is opened. share="morph" so it only fires on that
                          shared navigation, not on the filter crossfade. */}
                      <ViewTransition
                        name={`rep-${r.id}`}
                        share="morph"
                        default="none"
                      >
                        <span className="font-display text-sm font-bold text-gold">
                          {r.overall_score}
                        </span>
                      </ViewTransition>
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
          )}
        </ViewTransition>
      </Reveal>
    </section>
  );
}
