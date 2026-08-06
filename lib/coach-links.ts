/**
 * Turning the coach's emphasis into somewhere to go.
 *
 * The coach is told to recommend drills by their exact catalog name, and it
 * bolds them. Until now that bold was decoration: the player read "work on
 * **Toss and Freeze**", and then had to go find it. Every one of those names
 * already has a page, so the emphasis becomes the link.
 *
 * Built on the SERVER and passed down as a small map. The alternative, importing
 * the catalogs into the chat component, drags the entire drill and injury
 * libraries into the client bundle to look up a handful of strings.
 *
 * Nothing here decides what the coach may SAY. It only decides whether a phrase
 * it already chose resolves to a page, so a miss is silent and the text renders
 * bold exactly as it did before.
 */

export type CoachLinkMap = Record<string, string>;

/**
 * Case, punctuation and possessives removed, so "Toss and Freeze",
 * "toss and freeze" and "the Toss-and-Freeze drill" all reach the same key.
 * Deliberately lossy: this matches PHRASES a coach typed, not identifiers.
 */
export function normalizePhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    // Curly and straight apostrophes vanish rather than becoming a space, so
    // "jumper's knee" keys the same as "jumpers knee".
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Phrases short or generic enough that linking them would be noise rather than
// help. "Set" is a skill AND the most common verb in volleyball coaching, so
// bolding it must not turn every sentence into a link.
const TOO_GENERIC = new Set(["set", "pass", "serve", "block", "dig", "attack", "hit"]);

export function buildCoachLinks(input: {
  drills: readonly { name: string; slug: string }[];
  rehab: readonly { name: string; slug: string; also_called?: readonly string[] }[];
  skills: readonly { skill: string; label: string }[];
}): CoachLinkMap {
  const map: CoachLinkMap = {};
  // Order matters where two sources collide: skills are added first and drills
  // last, so a drill named after a skill wins. A drill is the more specific
  // thing and the more useful destination.
  for (const s of input.skills) {
    const key = normalizePhrase(s.label);
    if (key && !TOO_GENERIC.has(key)) map[key] = `/learn/${s.skill}`;
  }
  for (const e of input.rehab) {
    for (const alias of [e.name, ...(e.also_called ?? [])]) {
      const key = normalizePhrase(alias);
      if (key && !TOO_GENERIC.has(key)) map[key] = `/learn/rehab/${e.slug}`;
    }
  }
  for (const d of input.drills) {
    const key = normalizePhrase(d.name);
    if (key && !TOO_GENERIC.has(key)) map[key] = `/drills/${d.slug}`;
  }
  return map;
}

/**
 * The href for a phrase the coach emphasised, or null.
 *
 * Trailing punctuation is stripped because a coach writes "**Toss and Freeze**,"
 * and the emphasis often swallows the comma. Nothing else is guessed at: a
 * phrase either names something the app has a page for or it does not.
 */
export function resolveCoachLink(map: CoachLinkMap, phrase: string): string | null {
  const key = normalizePhrase(phrase);
  if (!key) return null;
  return map[key] ?? null;
}
