import Link from "next/link";

// The inside-a-hub switcher. The primary nav holds five tabs (D-088), and two
// of them are hubs: Train covers the plan, the drill catalog and the learn
// libraries; Progress covers the trend charts, the rep list and milestones.
// This strip is how a player moves inside a hub without the top-level nav
// growing back to eleven items. Same chip vocabulary as the discipline
// switchers, so it reads as "views of this place" rather than more nav.
//
// Server component on purpose: each page states which chip is active, so the
// strip renders on public pages (/learn, /drills) without client hooks or a
// Suspense boundary.
type SectionNavItem = { key: string; href: string; label: string };

// "This week" (/plan) is hidden as of 2026-08-05. It was built as a weekly
// training plan but is wanted as a dietary check-in instead, so it is out of
// scope until that is designed. The route, its server action and
// `weekly_plans` are all untouched and the page still renders if reached by
// URL; only the ways in are gone. Restoring it is re-adding this one entry and
// pointing the Train tab in components/app-nav.tsx back at /plan.
export const TRAIN_NAV: SectionNavItem[] = [
  { key: "drills", href: "/drills", label: "Drills" },
  { key: "technique", href: "/learn", label: "Technique" },
  // "Injury & recovery", not "Recovery". The library underneath is about what
  // volleyball injuries are and when to stop and get seen, and the tab inside
  // it and the back link on every entry both already said so; this chip was the
  // one place that read as a training-recovery day and sent the wrong player in.
  { key: "recovery", href: "/learn?tab=rehab", label: "Injury & recovery" },
];

export const PROGRESS_NAV: SectionNavItem[] = [
  { key: "trends", href: "/progress", label: "Trends" },
  { key: "reps", href: "/history", label: "Reps" },
  { key: "milestones", href: "/progress/milestones", label: "Milestones" },
];

function SectionNav({
  label,
  items,
  active,
}: {
  label: string;
  items: SectionNavItem[];
  active: string;
}) {
  return (
    <nav aria-label={label} className="mt-4">
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.key === active ? "page" : undefined}
              className={`chip min-h-11 ${item.key === active ? "chip-active" : ""}`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TrainNav({ active }: { active: "week" | "drills" | "technique" | "recovery" }) {
  return <SectionNav label="Train sections" items={TRAIN_NAV} active={active} />;
}

export function ProgressNav({ active }: { active: "trends" | "reps" | "milestones" }) {
  return <SectionNav label="Progress sections" items={PROGRESS_NAV} active={active} />;
}
