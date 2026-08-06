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
  // THE ORDER IS STABLE, and that is a decision rather than an oversight.
  //
  // This briefly hoisted the active chip to the front, so a scroll container
  // that always opens at offset 0 would open on the page you are already on.
  // It worked, and it cost more than it bought: the chips then sit in different
  // slots on different pages of the hub, so nobody can ever learn that
  // Technique is the middle one. Positional memory is worth more than never
  // having to drag, especially at three entries, where the row barely overflows
  // and the page heading already says where you are.
  //
  // If a hub ever grows past a handful of entries this becomes worth revisiting,
  // and the answer then is a stable order PLUS a small client effect that
  // scrolls the active chip into view, not a reorder. Reordering is the thing
  // that breaks the learning.
  return (
    <nav aria-label={label} className="mt-3">
      {/* One row that scrolls sideways, never two rows that wrap: on a phone a
          wrapped strip is a second line of chrome shoving the page content
          down. The negative margin plus matching padding lets the row bleed
          through the app shell's px-5 gutter (app/(app)/layout.tsx gives main
          `px-5 md:px-10`), so a chip is visibly cut by the screen edge and it
          reads as "there is more to the right" rather than as a full row. Both
          are dropped at md, where the row fits and the desktop gutter is
          wider. tabIndex makes the scroll region reachable and arrow-key
          scrollable in engines that do not focus scrollers on their own. The
          scrollbar is hidden because under a 44px strip it is noise, and drag,
          wheel and arrow keys all still scroll. py-1 is the room the 2px focus
          ring needs, since overflow-x clips vertically too; mt-3 plus that
          padding lands the chips exactly where mt-4 used to put them. */}
      <ul
        tabIndex={0}
        className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-px-5 px-5 py-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <li key={item.key} className="shrink-0 snap-start">
            <Link
              href={item.href}
              aria-current={item.key === active ? "page" : undefined}
              className={`chip min-h-11 whitespace-nowrap ${item.key === active ? "chip-active" : ""}`}
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
