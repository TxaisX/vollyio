// The breakdown's Basic / Advanced switch, and the two class strings that
// answer it.
//
// WHAT GOES WHERE, and why. Basic is the four things a player can act on
// tonight and nothing else: the summary, what worked beside what to change,
// and the drills. Advanced is everything BEHIND those calls: the five named
// checkpoints of the skill and the scoring ladder inside each one, the scored
// metric bars and their per-cue verdicts, the timeline, the per-rep notes and
// spread, and the read's own confidence. The split is "act on it" versus
// "check my work", not "important" versus "unimportant", which is why nothing
// is deleted at either level and why Basic is the default: the first thing on
// screen should be the one change to make, not a wall of numbers proving how
// the change was chosen.
//
// The checkpoints started on the Basic side and moved here 2026-08-06. They
// are the same five rows on every rep whatever the clip showed, so they read
// as reference rather than as this rep's verdict, and five standing cards
// between the fixes and the drills was most of the scrolling the owner asked
// us to cut on a phone. Moved, not trimmed: opening Advanced still shows all
// five, unchanged.
//
// A v1 row (result_version absent or 1) carries metrics, per-pointer verdicts
// and a timeline and NOTHING ELSE explains its score, so Advanced is where all
// three live and they are still all there. A v2 row has none of them; its
// Advanced is the checkpoints section, the ladder under each checkpoint and
// the confidence line. Both shapes therefore have a Basic worth reading and an
// Advanced worth opening.
//
// THE MECHANISM IS PURE CSS ON PURPOSE. Two real radios in a fieldset carry
// the state, and `:has()` on the checked one reveals the rest. No client
// component, no hydration, no state: the switch works on the server-rendered
// HTML before any JavaScript arrives and keeps working if none ever does,
// which matters because on a v1 row the Advanced half is the only account of
// where the score came from. Hiding that behind useState would mean a failed
// hydration takes a player's whole scorecard with it.

/** Put this on the one element that wraps BOTH the switch and everything it
 *  governs. `group-has-*` resolves against the nearest ancestor `.group`. */
export const DETAIL_SCOPE = "group";

/** Hidden until the reader switches to Advanced. */
export const ADVANCED_ONLY = "hidden group-has-[.detail-advanced:checked]:block";

/** The condensed stand-in that Advanced replaces. */
export const BASIC_ONLY = "group-has-[.detail-advanced:checked]:hidden";

export function DetailSwitch() {
  return (
    // A fieldset rather than two buttons: radios give the group an accessible
    // name from the legend, arrow-key movement between the options, and a
    // checked state assistive tech already knows how to announce, none of
    // which we would have to write. The chip styling comes from the
    // `input.sr-only:checked + .chip` rule the design system already carries
    // for exactly this pattern (see app/globals.css).
    <fieldset className="mt-6 flex min-w-0 flex-wrap items-center gap-2">
      <legend className="sr-only">How much detail to show</legend>
      <span
        aria-hidden="true"
        className="font-mono text-[10px] uppercase tracking-[0.1em] text-chalk-dim"
      >
        Detail
      </span>
      <label className="cursor-pointer">
        <input
          type="radio"
          name="breakdown-detail"
          defaultChecked
          className="sr-only"
        />
        <span className="chip min-h-11">Basic</span>
      </label>
      <label className="cursor-pointer">
        <input
          type="radio"
          name="breakdown-detail"
          className="detail-advanced sr-only"
        />
        <span className="chip min-h-11">Advanced</span>
      </label>
    </fieldset>
  );
}
