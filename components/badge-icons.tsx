import type { AchievementKey } from "@/lib/achievements";

// One stroke glyph per badge, in the same 24-box hand-drawn language as
// skill-icons and the nav. No directive on purpose: the milestones grid
// renders these on the server and the reward toasts render them on the
// client.
const GLYPHS: Record<AchievementKey, React.ReactNode> = {
  // A frame with the subject ringed: the first read.
  first_read: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <circle cx="12" cy="12" r="3.25" />
    </>
  ),
  // Stacked reps.
  ten_reps: (
    <>
      <path d="M5 8.5h14M5 12h14M5 15.5h9" />
      <path d="M5 5h14" />
    </>
  ),
  // A filmstrip.
  film_junkie: (
    <>
      <rect x="4" y="4.5" width="16" height="15" rx="1.5" />
      <path d="M8 4.5v15M16 4.5v15M4 9h4M4 15h4M16 9h4M16 15h4" />
    </>
  ),
  // Six sides, one for each skill.
  all_six: (
    <>
      <path d="M12 3.5 19 7.75v8.5L12 20.5 5 16.25v-8.5L12 3.5Z" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </>
  ),
  // A rising line clearing the bar.
  eighty_club: (
    <>
      <path d="M4 18h16" />
      <path d="M6 14.5 10.5 10l3 2.5L19 6" />
      <path d="M15.5 6H19v3.5" />
    </>
  ),
  // The diamond.
  ninety_club: (
    <>
      <path d="M12 3.5 20 12l-8 8.5L4 12l8-8.5Z" />
      <path d="M7.5 12H16.5" />
    </>
  ),
  // The target, hit.
  finisher: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  // Three marks.
  hat_trick: (
    <>
      <path d="M4 8l2 2 3.5-4" />
      <path d="M4 15l2 2 3.5-4" />
      <path d="M13 9.5h7M13 16.5h7" />
    </>
  ),
  // The clock, beaten.
  ahead_of_schedule: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 1.75" />
    </>
  ),
  // The checklist.
  ten_challenges: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="1.5" />
      <path d="M8.5 9l1.5 1.5L12.5 8M8.5 14.5l1.5 1.5 2.5-2.5M15 9.5h1.5M15 15h1.5" />
    </>
  ),
  // The flame from the streak pill.
  full_week: (
    <path d="M12 3c.5 3-1.5 4.5-2.5 6C8.5 10.5 8 12 8 13.5A4.4 4.4 0 0 0 12.5 18a4.6 4.6 0 0 0 4.5-4.75c0-2.25-1.25-3.5-2-5.25-.5 1-1.5 1.5-1.5 3C12 8.5 12.5 5.5 12 3Z" />
  ),
  // The flame, banked into something that stays lit.
  habit: (
    <>
      <path d="M12 4c.4 2.2-1.1 3.3-1.9 4.4C9.3 9.5 9 10.6 9 11.7A3.4 3.4 0 0 0 12.4 15a3.5 3.5 0 0 0 3.6-3.6c0-1.7-1-2.6-1.6-3.9-.4.8-1.2 1.1-1.2 2.2 0-1.8.4-4 .1-5.7Z" />
      <path d="M5 19.5h14" />
    </>
  ),
};

export function BadgeIcon({
  badge,
  className = "h-5 w-5",
}: {
  badge: AchievementKey;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      {GLYPHS[badge]}
    </svg>
  );
}
