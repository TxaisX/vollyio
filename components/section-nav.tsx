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

export const TRAIN_NAV: SectionNavItem[] = [
  { key: "week", href: "/plan", label: "This week" },
  { key: "drills", href: "/drills", label: "Drills" },
  { key: "technique", href: "/learn", label: "Technique" },
  { key: "recovery", href: "/learn?tab=rehab", label: "Recovery" },
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
