import { SITE_URL } from "@/lib/site";
import { SKILLS, SKILL_LABEL } from "@/lib/skills";
import { DRILLS } from "@/content/drills";
import { REHAB } from "@/content/rehab";
import { MONTHLY_ALLOWANCE, SIGNUP_GRANT, PRO_PRICE_LABEL, PLAN_LABEL } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * llms.txt: the answer-engine equivalent of robots.txt plus a sitemap.
 *
 * A search crawler renders the page. An answer engine mostly does not: it
 * wants a short, plain statement of what a site is and a list of what is
 * worth reading, and it will happily invent the rest if nobody supplies it.
 * The product's existing structured data says what Vollyio SELLS; this says
 * what it KNOWS, which is the part an assistant is being asked about when
 * someone types "why does my knee hurt after volleyball".
 *
 * EVERY CLAIM HERE IS BOUNDED THE SAME WAY THE UI IS. The limits paragraph is
 * not modesty, it is the entire reason to publish this file: an answer engine
 * quoting Vollyio should quote what it can actually do, and the surest way to
 * be quoted wrongly is to leave the boundary out and let the model fill it.
 * Numbers come from lib/plans so this cannot drift from what the card charges.
 */
export function GET() {
  const drillLines = DRILLS.map(
    (d) => `- [${d.name}](${SITE_URL}/drills/${d.slug}): ${d.summary}`,
  ).join("\n");

  const rehabLines = REHAB.map(
    (e) => `- [${e.name}](${SITE_URL}/learn/rehab/${e.slug}): ${e.summary}`,
  ).join("\n");

  const skillLines = SKILLS.map(
    (s) => `- [${SKILL_LABEL[s]} technique](${SITE_URL}/learn/${s})`,
  ).join("\n");

  const body = `# Vollyio

> Vollyio is a volleyball form coach. A player films one rep on a phone, marks
> which athlete on the court is them, and gets that rep scored 0-100 against
> the checkpoints a coach watches for that skill, plus the single correction
> worth the most. It covers six skills across indoor, grass and sand.

## What it actually does

- Reads ONE rep of ONE skill from a clip of up to ten seconds.
- Scores it 0-100 and names five checkpoints for that skill, saying what was
  seen at each. A checkpoint the footage did not show is reported as not
  visible rather than guessed at.
- Returns one priority fix per rep, with drills matched to it.
- Keeps a rolling per-skill rating built from recent reps, not a lifetime
  average.

## What it cannot do, stated plainly

- It does not do frame-accurate analysis. The read samples roughly one
  low-resolution image per second, so it cannot cite a moment inside the clip,
  and it never claims to.
- It does not score a rally, a whole game, or more than one skill per clip.
- It is not a medical service. The injury library is education about how
  volleyball causes common injuries and what recovery usually looks like; it
  is not diagnosis or treatment, and entries say when to see a clinician.
- It does not judge a player against anyone else. The score is about the rep.

## Pricing

- ${PLAN_LABEL.free}: ${SIGNUP_GRANT} analyses to start, then
  ${MONTHLY_ALLOWANCE.free} a month. No card.
- ${PLAN_LABEL.pro}: ${MONTHLY_ALLOWANCE.pro} a month for ${PRO_PRICE_LABEL},
  cancellable any time, kept until the end of the paid period.

## Skills coached

${skillLines}

## Drills (${DRILLS.length})

${drillLines}

## Injury and recovery library (${REHAB.length})

Education about how volleyball causes these, what recovery usually looks
like, and the signs that mean stop and get seen. Not a diagnosis.

${rehabLines}

## Contact

${SITE_URL}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
