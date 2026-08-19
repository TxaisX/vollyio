import Link from "next/link";
import { BadgeIcon } from "@/components/badge-icons";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_KEY,
  type EarnedAchievement,
} from "@/lib/achievements";

// The glanceable trophy case for the dashboard: the latest badges, the count,
// and the way to the full grid. Server component; the celebration moment is
// the toasts (components/xp-toast.tsx), not this card.
export function BadgeShelf({ earned }: { earned: EarnedAchievement[] }) {
  const latest = earned.slice(0, 3);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold-ink">
          Milestones
        </h2>
        {/* Padded for the 44px target, negative-margined so the header row
            keeps its height, same trick as the dashboard's View all links. */}
        <Link
          href="/progress/milestones"
          className="-my-4 py-4 font-mono text-[11px] text-chalk-dim transition-colors hover:text-chalk"
        >
          View all
        </Link>
      </div>
      {earned.length === 0 ? (
        <p className="mt-2 text-body text-chalk-dim">
          Badges land here as you film reps, finish goals, and keep the streak
          alive.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {latest.map((e) => {
              const def = ACHIEVEMENT_BY_KEY[e.key];
              return (
                <li key={e.key} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-gold/10 text-gold-ink">
                    <BadgeIcon badge={e.key} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm font-bold">
                      {def.name}
                    </span>
                    <span className="block font-mono text-[10px] text-chalk-dim">
                      +{def.xp} XP
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
            {earned.length} of {ACHIEVEMENTS.length} earned
          </p>
        </>
      )}
    </div>
  );
}

// The full grid: earned badges in gold, the rest hollow, the same met versus
// not-visible vocabulary the pointer checklist taught the player to read.
export function BadgeGrid({ earned }: { earned: EarnedAchievement[] }) {
  const earnedAt = new Map(earned.map((e) => [e.key, e.earned_at]));
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ACHIEVEMENTS.map((def) => {
        const when = earnedAt.get(def.key);
        const has = when != null;
        return (
          <li
            key={def.key}
            className={`card p-4 ${has ? "border-gold/40" : ""}`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                has
                  ? "border-gold/50 bg-gold/10 text-gold-ink"
                  : "border-line text-chalk-dim"
              }`}
            >
              <BadgeIcon badge={def.key} className="h-4.5 w-4.5" />
            </span>
            <p className="mt-2.5 font-display text-sm font-bold">
              {def.name}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-chalk-dim">
              {def.description}
            </p>
            <p
              className={`mt-2 font-mono text-[10px] uppercase tracking-wide ${
                has ? "text-gold-ink" : "text-chalk-dim"
              }`}
            >
              {has
                ? `+${def.xp} XP · ${new Date(when).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}`
                : `+${def.xp} XP`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
