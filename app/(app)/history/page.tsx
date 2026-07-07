import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SKILLS, SKILL_LABEL, isSkill, type Skill } from "@/lib/skills";

export const dynamic = "force-dynamic";

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
  const rows = (data as Row[] | null) ?? [];

  return (
    <section className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold">History</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip label="All" href="/history" active={!activeSkill} />
        {SKILLS.map((s) => (
          <FilterChip
            key={s}
            label={SKILL_LABEL[s]}
            href={`/history?skill=${s}`}
            active={activeSkill === s}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-chalk-dim">No reps logged yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/analysis/${r.id}`} className="flex items-start gap-3 py-3">
                <span className="w-12 shrink-0 pt-1 font-mono text-xs text-chalk-dim">
                  {new Date(r.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-navy-light px-2 py-0.5 font-mono text-[10px] uppercase text-chalk-dim">
                      {SKILL_LABEL[r.skill]}
                    </span>
                    <span className="font-display text-sm font-bold text-gold">
                      {r.overall_score}
                    </span>
                  </div>
                  {r.result?.priority_fix?.title && (
                    <p className="mt-1 text-sm text-chalk">{r.result.priority_fix.title}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active ? "border-gold bg-gold/10 text-gold" : "border-line text-chalk-dim hover:border-gold/50"
      }`}
    >
      {label}
    </Link>
  );
}
