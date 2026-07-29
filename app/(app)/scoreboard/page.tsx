import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { Scoreboard } from "@/components/scoreboard";
import { Reveal } from "@/components/motion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scoreboard",
  description: "Keep the score for a live match, set by set.",
};

type SetScore = { a: number; b: number };
type GameRow = {
  id: string;
  team_a: string;
  team_b: string;
  sets: SetScore[];
  winner: "a" | "b" | null;
  started_at: string;
};

export default async function ScoreboardPage() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);

  const { data, error } = await supabase
    .from("games")
    .select("id, team_a, team_b, sets, winner, started_at")
    .eq("user_id", userId!)
    .order("started_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  const games = (data as GameRow[] | null) ?? [];

  return (
    <section className="max-w-4xl">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-gold">Scoreboard</p>
      <h1 className="mt-1 font-display text-page-title">Track a match</h1>

      <div className="mt-6">
        <Scoreboard />
      </div>

      <Reveal delay={80}>
        <h2 className="mt-10 mb-3 font-display text-sm font-bold">Recent matches</h2>
        {games.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="font-display font-bold">No matches yet</p>
            <p className="mt-1 text-body text-chalk-dim">
              Start a match above and your results will land here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {games.map((g) => {
              const sets = Array.isArray(g.sets) ? g.sets : [];
              const winsA = sets.filter((s) => s.a > s.b).length;
              const winsB = sets.filter((s) => s.b > s.a).length;
              const winner = g.winner ?? (winsA > winsB ? "a" : "b");
              return (
                <li key={g.id} className="py-3">
                  <div className="flex items-baseline gap-3">
                    <span className="w-14 shrink-0 font-mono text-xs text-chalk-dim">
                      {new Date(g.started_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <p className="font-display text-sm font-bold">
                      <span className={winner === "a" ? "text-gold" : undefined}>{g.team_a}</span>
                      <span className="px-1.5 text-chalk-dim">
                        {winsA}–{winsB}
                      </span>
                      <span className={winner === "b" ? "text-gold" : undefined}>{g.team_b}</span>
                    </p>
                  </div>
                  <p className="mt-1 pl-[4.25rem] font-mono text-xs text-chalk-dim">
                    {sets.map((s) => `${s.a}-${s.b}`).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>
    </section>
  );
}
