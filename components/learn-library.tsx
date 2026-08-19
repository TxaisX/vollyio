"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LinkPending } from "@/components/link-pending";

/** One searchable thing, from either library. Both libraries are flattened to
 *  this shape on the server so one search box can serve both without knowing
 *  anything about skills, drills or injuries. */
export type LibraryItem = {
  id: string;
  title: string;
  subtitle: string;
  /** The small line: "Serving, 10 min" or "Knee, get it assessed". */
  meta: string;
  href: string;
  /** Pre-lowercased haystack built on the server, so filtering is a substring
   *  test rather than re-deriving the searchable text on every keystroke. */
  terms: string;
  /** Rehab only: drives the triage colour. */
  tone?: "urgent" | "assess" | "self";
};

const TONE_CLASS: Record<NonNullable<LibraryItem["tone"]>, string> = {
  urgent: "text-coral-ink",
  assess: "text-gold-ink",
  self: "text-teal-ink",
};

/**
 * ONE LIBRARY, SEARCHED. Not two behind a switcher.
 *
 * This carried its own Training / Injury-and-recovery tab row until the IA
 * changed. The hub strip directly above it already offered exactly those two
 * destinations, so the page asked the same question twice, three chip rows
 * deep, and the two answers could disagree: the URL said Technique while the
 * panel sat on Injury. Technique is now technique, injury and recovery is its
 * own page, and the only filter left on either is the one that changes what
 * the content SAYS, which is the discipline you play.
 *
 * The search box, the live count and the empty state survive unchanged;
 * those were never the problem.
 */
export function LearnLibrary({
  items,
  label,
  blurb,
  placeholder,
  emptyHint,
}: {
  items: LibraryItem[];
  /** Lower-case noun for the counts and the empty state: "technique". */
  label: string;
  blurb: string;
  placeholder: string;
  emptyHint: string;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items;
    // Every token must appear somewhere. "sore knee" should not match anything
    // that merely mentions a knee.
    return items.filter((item) => tokens.every((t) => item.terms.includes(t)));
  }, [items, query]);

  return (
    <div className="mt-5">
      {/* Orientation copy, kept quiet. It is not the thing anyone came for,
          and on the injury page it is safety framing, which is never trimmed
          to save two lines. */}
      <p className="max-w-prose text-sm leading-relaxed text-chalk-dim">{blurb}</p>

      <div className="mt-3">
        <label htmlFor="lib-search" className="sr-only">
          Search the {label} library
        </label>
        <input
          id="lib-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="input-field"
        />
        <p aria-live="polite" className="mt-2 font-mono text-[11px] text-chalk-dim">
          {query
            ? `${results.length} of ${items.length} in ${label}`
            : `${items.length} in ${label}`}
        </p>
      </div>

      <div className="mt-4">
        {results.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="font-display text-base font-bold">Nothing in {label} matches that.</p>
            <p className="mx-auto mt-1 max-w-sm text-body text-chalk-dim">{emptyHint}</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="btn-ghost mt-5 inline-flex min-h-11 text-sm"
            >
              Clear the search
            </button>
          </div>
        ) : (
          // THE GRID IS THE RIGHT SHAPE and stays one (D-117). These are
          // thirty-odd things to CHOOSE between, not six of one thing with a
          // number each, so there is no ranking a single axis would reveal -
          // and folding two columns into one on a library this long doubles
          // the scroll on every screen wide enough to hold both.
          <ul className="grid items-stretch gap-2.5 sm:grid-cols-2">
            {results.map((item) => (
              <li key={item.id} className="h-full">
                <Link
                  href={item.href}
                  transitionTypes={["nav-forward"]}
                  className="learn-card card card-lift group relative block h-full p-3.5 sm:p-4"
                >
                  {/* text-base, not text-lg. This grid is thirty-odd cards
                      long and every title was set two steps above the copy
                      under it, so the list read as a wall of headlines. */}
                  <span className="font-display text-base font-bold leading-snug">
                    {item.title}
                  </span>
                  <span
                    className={`mt-1 block font-mono text-[11px] uppercase tracking-[0.06em] ${
                      item.tone ? TONE_CLASS[item.tone] : "text-chalk-dim"
                    }`}
                  >
                    {item.meta}
                  </span>
                  {/* Clamped to three lines. Cards in a row stretch to the
                      tallest of them, and the injury summaries run to six
                      lines where a drill's runs to two, so one entry was
                      setting the height of the card beside it. The entry's own
                      page carries the full text. */}
                  <span className="mt-1.5 line-clamp-3 block text-sm leading-relaxed text-chalk-dim">
                    {item.subtitle}
                  </span>
                  <LinkPending />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
