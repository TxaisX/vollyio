// The content corpus, assembled once for the native client.
//
// Drills, technique and rehab live as checked-in TypeScript, which the web
// renders server-side behind the (app) layout's session. The native app has no
// page to render, so this is the same corpus as one JSON payload, served only
// to a proven credential (app/api/app/content). Bundling it into the APK was
// considered and rejected: an APK is a zip anybody can open, and D-122's whole
// point is that the corpus is what an account buys.
import { DRILLS } from "../content/drills.ts";
import { TECHNIQUE } from "../content/technique.ts";
import { REHAB } from "../content/rehab.ts";
import { REGION_LABEL, TRIAGE_LABEL, TRIAGE_NOTE } from "../content/rehab-types.ts";
import {
  SKILLS,
  SKILL_LABEL,
  SKILL_BLURB,
  DISCIPLINE_LABEL,
  ANALYZE_DISCIPLINES,
} from "./skills.ts";

/**
 * Bumped when the shape changes in a way an old client would misread.
 * The client checks it and falls back to "update the app" rather than
 * guessing at fields it does not know.
 */
export const APP_CONTENT_VERSION = 1;

export function appContentPayload() {
  return {
    version: APP_CONTENT_VERSION,
    skills: SKILLS.map((key) => ({
      key,
      label: SKILL_LABEL[key],
      blurb: SKILL_BLURB[key],
    })),
    discipline_labels: DISCIPLINE_LABEL,
    analyze_disciplines: ANALYZE_DISCIPLINES,
    drills: DRILLS,
    technique: TECHNIQUE,
    rehab: {
      region_labels: REGION_LABEL,
      triage_labels: TRIAGE_LABEL,
      triage_notes: TRIAGE_NOTE,
      entries: REHAB,
    },
  };
}
