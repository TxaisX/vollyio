import type { Skill } from "@/lib/skills";

// The injury library's shape.
//
// This is EDUCATION, not treatment. The product is not licensed to diagnose or
// prescribe, and the difference shows up in the schema itself: there is a
// `red_flags` field and a `phases` field, but no field anywhere for "do these
// three exercises on day four". Phases describe what a recovery typically LOOKS
// LIKE so an adult player can recognise where they are and have a useful
// conversation with a clinician. `prevention` is the one place with concrete
// prescribed work, because prehab is ordinary training and always appropriate.

export const REGIONS = [
  "shoulder",
  "knee",
  "ankle",
  "back",
  "hand",
  "hip",
  "calf",
  "head",
] as const;

export type Region = (typeof REGIONS)[number];

export const REGION_LABEL: Record<Region, string> = {
  shoulder: "Shoulder",
  knee: "Knee",
  ankle: "Ankle & foot",
  back: "Back & trunk",
  hand: "Hand, wrist & fingers",
  hip: "Hip & thigh",
  calf: "Calf & Achilles",
  head: "Head & neck",
};

/**
 * How urgently a player should get this looked at by someone qualified.
 *
 * `urgent` is not a severity ranking of pain. It means the cost of being wrong
 * is high enough that the app should refuse to be the thing standing between
 * the player and a professional.
 */
export const TRIAGE = ["self_manage", "get_assessed", "urgent"] as const;
export type Triage = (typeof TRIAGE)[number];

export const TRIAGE_LABEL: Record<Triage, string> = {
  self_manage: "Usually self-managed",
  get_assessed: "Get it assessed",
  urgent: "Same-day medical care",
};

export const TRIAGE_NOTE: Record<Triage, string> = {
  self_manage:
    "Most cases settle with load management and consistent work. See someone if it is not improving over a few weeks.",
  get_assessed:
    "Worth a proper assessment before you build a plan around it. Getting the diagnosis right changes what the right work is.",
  urgent:
    "Do not train through this and do not wait to see how it feels tomorrow. Get medical care today.",
};

/** One stage of a typical recovery. Describes what it looks like, never what
 *  to do on a given day. */
export type RehabPhase = {
  name: string;
  goal: string;
  /** Honest ranges, with the spread that real recoveries have. */
  typical_window: string;
  /** What tells a player they are actually in this phase, and what tells them
   *  they are ready to leave it. */
  markers: string[];
};

export type RehabEntry = {
  slug: string;
  name: string;
  /** What players and coaches actually call it. Feeds the search index, since
   *  nobody types "patellar tendinopathy" into a search box. */
  also_called: string[];
  region: Region;
  triage: Triage;
  /** One line, for the card. */
  summary: string;
  what_it_is: string;
  /** The volleyball-specific mechanism. This is what makes the library worth
   *  reading instead of a generic search result. */
  how_it_happens: string;
  signs: string[];
  /** Stop and get seen. Every entry has at least one. */
  red_flags: string[];
  phases: RehabPhase[];
  /** The one section that prescribes, because prehab is just training. */
  prevention: string[];
  /** What "ready to play" actually means, in observable terms. */
  return_markers: string[];
  /** Which volleyball skills load this structure hardest, so the library can
   *  be reached from a player's own weakest skill. */
  loads: Skill[];
};
