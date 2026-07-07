import type { Skill } from "@/lib/skills";

const PATHS: Record<Skill, React.ReactNode> = {
  serve: (
    <>
      <circle cx="15" cy="8" r="4.25" />
      <path d="M3 19c3.5-5 7-7.5 11.5-8.5" strokeDasharray="1 3" />
    </>
  ),
  pass: (
    <>
      <circle cx="16" cy="7" r="3.25" />
      <path d="M4 18l8-4.5 8 3" />
      <path d="M4 18l-.5 2M20 16.5l1 2" />
    </>
  ),
  set: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 17c1-2.5 2.5-4 4-4.5M18.5 17c-1-2.5-2.5-4-4-4.5" />
    </>
  ),
  attack: (
    <>
      <circle cx="8.5" cy="7" r="3.25" />
      <path d="M10.5 9.5L19 18M19 18h-4.5M19 18v-4.5" />
    </>
  ),
  block: (
    <>
      <rect x="5" y="5.5" width="4.5" height="13" rx="1.5" />
      <rect x="14.5" y="5.5" width="4.5" height="13" rx="1.5" />
    </>
  ),
  dig: (
    <>
      <circle cx="17" cy="6.5" r="3" />
      <path d="M3.5 8c1.5 7 8 10 16.5 5" />
    </>
  ),
};

export function SkillIcon({
  skill,
  className = "h-6 w-6",
}: {
  skill: Skill;
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
    >
      {PATHS[skill]}
    </svg>
  );
}
