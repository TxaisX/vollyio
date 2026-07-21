import type { Discipline, Level, Skill } from "@/lib/skills";

// One source of truth for the registration funnel vocabulary: the quiz steps
// on /start (pre-signup) and /welcome (post-signup fallback), the server
// action that applies answers, and the localStorage handoff between them.

export const LEVELS = ["beginner", "intermediate", "expert", "pro"] as const;

export const LEVEL_OPTIONS: { value: Level; label: string; detail: string }[] = [
  { value: "beginner", label: "Beginner", detail: "Learning the basics, building touches" },
  { value: "intermediate", label: "Intermediate", detail: "Solid fundamentals, inconsistent under pressure" },
  { value: "expert", label: "Expert", detail: "Refining details, chasing consistency" },
  { value: "pro", label: "Pro", detail: "Competing or training at the professional level" },
];

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
  pro: "Pro",
};

export const POSITIONS = [
  "setter",
  "outside",
  "opposite",
  "middle",
  "libero",
  "blocker",
  "defender",
  "all_around",
] as const;

export type Position = (typeof POSITIONS)[number];

export const POSITION_OPTIONS: Record<
  Discipline,
  { value: Position; label: string }[]
> = {
  indoor: [
    { value: "setter", label: "Setter" },
    { value: "outside", label: "Outside hitter" },
    { value: "opposite", label: "Opposite" },
    { value: "middle", label: "Middle blocker" },
    { value: "libero", label: "Libero" },
    { value: "all_around", label: "All-around / not sure yet" },
  ],
  beach: [
    { value: "blocker", label: "Blocker" },
    { value: "defender", label: "Defender" },
    { value: "all_around", label: "I split / not sure yet" },
  ],
  grass: [
    { value: "setter", label: "Setter" },
    { value: "outside", label: "Outside hitter" },
    { value: "opposite", label: "Opposite" },
    { value: "middle", label: "Middle blocker" },
    { value: "libero", label: "Libero" },
    { value: "all_around", label: "All-around / not sure yet" },
  ],
};

export const POSITION_LABEL: Record<Position, string> = {
  setter: "Setter",
  outside: "Outside hitter",
  opposite: "Opposite",
  middle: "Middle blocker",
  libero: "Libero",
  blocker: "Blocker",
  defender: "Defender",
  all_around: "All-around",
};

export const FREQUENCIES = [
  "rarely",
  "weekly",
  "several_per_week",
  "daily",
] as const;

export type PlayFrequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_OPTIONS: { value: PlayFrequency; label: string; detail: string }[] = [
  { value: "rarely", label: "A few times a month", detail: "Open gyms and pickup when it happens" },
  { value: "weekly", label: "About once a week", detail: "A regular session or league night" },
  { value: "several_per_week", label: "Several times a week", detail: "Practices plus matches" },
  { value: "daily", label: "Every day", detail: "Training is part of the routine" },
];

export const FREQUENCY_LABEL: Record<PlayFrequency, string> = {
  rarely: "A few times a month",
  weekly: "About once a week",
  several_per_week: "Several times a week",
  daily: "Every day",
};

// Targets carry the rubric's own band vocabulary (~40 developing, ~70 solid,
// ~90 advanced; see lib/ratings.ts and the Learn anchors) so the numbers mean
// something before a player has ever been scored.
export const TARGET_OPTIONS: { value: number; band: string; detail: string }[] = [
  { value: 60, band: "Closing on solid", detail: "Fundamentals hold up on most reps" },
  { value: 70, band: "Solid", detail: "Dependable technique, the rubric's solid bar" },
  { value: 80, band: "Solid, consistently", detail: "Clean reps even under pressure" },
  { value: 90, band: "Advanced", detail: "Near-flawless, every rep the same" },
];

export const TIMEFRAMES = [30, 90, 180] as const;

export type TimeframeDays = (typeof TIMEFRAMES)[number];

// Answers collected before an account exists, parked in localStorage across
// signup (and the email-confirm bounce on the same device), then applied by
// the FunnelHandoff once an authed page mounts.
export const FUNNEL_STORAGE_KEY = "sideout.funnel.v1";

export type FunnelAnswers = {
  discipline: Discipline;
  level: Level;
  position?: Position;
  play_frequency?: PlayFrequency;
  skill: Skill;
  target_rating?: number;
  timeframe_days?: TimeframeDays;
};
