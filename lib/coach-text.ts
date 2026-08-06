/**
 * Long dashes, removed from anything the coach says to a player.
 *
 * House style has never allowed them in copy anyone writes here, and the policy
 * lint enforces that on SOURCE. Model output is the hole in that: it reaches the
 * player without ever passing through a file the linter reads, and this model
 * reaches for an em dash constantly. It looks generated, which is the opposite
 * of what a coach should sound like.
 *
 * Applied at RENDER rather than before storing, so it also cleans conversations
 * that are already in the database, and so the stored transcript stays a
 * faithful record of what the provider actually returned.
 *
 * The prompt asks for this too. That is guidance and this is the guarantee; the
 * two are not redundant, because a prompt rule is obeyed most of the time and
 * "most of the time" is what a player notices.
 */
export function stripLongDashes(text: string): string {
  return (
    text
      // A range keeps its meaning as a hyphen: "8-10 reps", "70-75".
      .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1-$2")
      // Everything else is a parenthetical break, which is a comma in this
      // voice. The lookbehind stops ", ," when the model already punctuated.
      .replace(/\s*[\u2013\u2014]\s*/g, (match, offset: number, whole: string) => {
        const before = whole.slice(0, offset).trimEnd().slice(-1);
        return /[,.;:!?]/.test(before) ? " " : ", ";
      })
      // A dash that opened the line has nothing to attach to.
      .replace(/^\s*,\s*/, "")
  );
}
