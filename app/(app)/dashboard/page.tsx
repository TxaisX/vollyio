import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScoreRing } from "@/components/score-ring";
import { Radar } from "@/components/radar";
import { Sparkline } from "@/components/sparkline";
import { overallScore } from "@/lib/ratings";
import { SKILLS, SKILL_LABEL, type Skill } from "@/lib/skills";

export const dynamic = "force-dynamic";

type RatingRow = { skill: Skill; rating: number };
type AnalysisRow = { id: string; skill: Skill; overall_score: number; created_at: string };

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: ratingsData }, { data: analysesData }] = await Promise.all([
    supabase.from("skill_ratings").select("skill, rating").eq("user_id", user!.id),
    supabase
      .from("analyses")
      .select("id, skill, overall_score, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const ratings = Object.fromEntries(
    (ratingsData as RatingRow[] | null)?.map((r) => [r.skill, r.rating]) ?? [],
  ) as Partial<Record<Skill, number>>;
  const analyses = (analysesData as AnalysisRow[] | null) ?? [];

  const overall = overallScore(SKILLS.map((s) => ratings[s] ?? null));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const weekCount = analyses.filter((a) => new Date(a.created_at).getTime() > weekAgo).length;

  const seriesFor = (skill: Skill) =>
    analyses
      .filter((a) => a.skill === skill)
      .slice(0, 10)
      .reverse()
      .map((a) => a.overall_score);

  return (
    <section className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold">Dashboard</h1>

      <div className="mt-6 flex flex-wrap items-center gap-6 rounded-xl border border-line bg-navy-light p-6">
        <ScoreRing score={overall} label="Overall" />
        <div className="flex-1">
          <Radar ratings={ratings} />
        </div>
        <div className="font-mono text-xs text-chalk-dim">
          {weekCount} analysis{weekCount === 1 ? "" : "es"} this week
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SKILLS.map((skill) => {
          const rating = ratings[skill];
          const series = seriesFor(skill);
          return (
            <Link
              key={skill}
              href={`/history?skill=${skill}`}
              className="rounded-lg border border-line bg-navy-light p-4 transition hover:border-gold/50"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-sm font-bold">{SKILL_LABEL[skill]}</span>
                <span className="font-display text-xl font-bold text-gold">
                  {rating != null ? Math.round(rating) : "—"}
                </span>
              </div>
              <div className="mt-3">
                <Sparkline values={series} />
              </div>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-8 mb-3 font-display text-sm font-bold">Recent</h2>
      {analyses.length === 0 ? (
        <p className="text-sm text-chalk-dim">
          No analyses yet.{" "}
          <Link href="/analyze" className="text-gold underline">
            Record your first rep.
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {analyses.slice(0, 8).map((a) => (
            <li key={a.id}>
              <Link
                href={`/analysis/${a.id}`}
                className="flex items-center justify-between py-3 text-sm"
              >
                <span className="font-mono text-xs text-chalk-dim">
                  {new Date(a.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="flex-1 px-4 font-display">{SKILL_LABEL[a.skill]}</span>
                <span className="font-display font-bold text-gold">{a.overall_score}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
