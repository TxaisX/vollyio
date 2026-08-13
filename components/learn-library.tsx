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

type Tab = "training" | "rehab";

const TABS: { id: Tab; label: string; blurb: string; placeholder: string }[] = [
  {
    id: "training",
    label: "Training",
    blurb:
      "What good looks like, and the drills that get you there. Start with the skill you want to fix.",
    placeholder: "Search training: a skill, a checkpoint, a drill…",
  },
  {
    id: "rehab",
    label: "Injury & recovery",
    blurb:
      "What common volleyball injuries are, how this sport causes them, what recovery usually looks like, and the signs that mean stop and get seen. Education, not a diagnosis.",
    placeholder: "Search injuries: jumper's knee, rolled ankle, sore shoulder…",
  },
];

const TONE_CLASS: Record<NonNullable<LibraryItem["tone"]>, string> = {
  urgent: "text-coral",
  assess: "text-gold",
  self: "text-teal",
};

export function LearnLibrary({
  training,
  rehab,
  initialTab = "training",
}: {
  training: LibraryItem[];
  rehab: LibraryItem[];
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  // The query deliberately SURVIVES a tab switch and is re-run against the
  // other library. Someone who typed "shoulder" under Training and switched has
  // not changed their mind about what they are looking for.
  const [query, setQuery] = useState("");

  const active = tab === "training" ? training : rehab;
  const meta = TABS.find((t) => t.id === tab)!;

  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return active;
    // Every token must appear somewhere. "sore knee" should not match anything
    // that merely mentions a knee.
    return active.filter((item) => tokens.every((t) => item.terms.includes(t)));
  }, [active, query]);

  return (
    <div className="mt-5">
      <div
        role="tablist"
        aria-label="Library"
        className="flex flex-wrap items-center gap-2"
      >
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`lib-tab-${t.id}`}
              aria-selected={selected}
              aria-controls="lib-panel"
              onClick={() => setTab(t.id)}
              className={`chip min-h-11 ${selected ? "chip-active" : ""}`}
            >
              {t.label}
              <span className="ml-1.5 font-mono text-[10px] opacity-70">
                {(t.id === "training" ? training : rehab).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kept word for word, just quieter. This is orientation copy, not the
          thing anyone came for, and the injury blurb in particular ran four
          lines of text-body straight under the page title. Nothing is cut here
          on purpose: the injury one is safety framing, and trimming safety
          framing to save two lines is not a trade worth making. */}
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-chalk-dim">
        {meta.blurb}
      </p>

      <div className="mt-3">
        <label htmlFor="lib-search" className="sr-only">
          Search the {tab === "training" ? "training" : "injury"} library
        </label>
        <input
          id="lib-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={meta.placeholder}
          autoComplete="off"
          className="input-field"
        />
        <p aria-live="polite" className="mt-2 font-mono text-[11px] text-chalk-dim">
          {query
            ? `${results.length} of ${active.length} in ${meta.label.toLowerCase()}`
            : `${active.length} in ${meta.label.toLowerCase()}`}
        </p>
      </div>

      <div
        role="tabpanel"
        id="lib-panel"
        aria-labelledby={`lib-tab-${tab}`}
        className="mt-4"
      >
        {results.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="font-display text-base font-bold">
              Nothing in {meta.label.toLowerCase()} matches that.
            </p>
            <p className="mx-auto mt-1 max-w-sm text-body text-chalk-dim">
              {tab === "training"
                ? "Try a skill name, a checkpoint like toss or platform, or the name of a drill."
                : "Try where it hurts, like knee, shoulder or ankle, or what you call it, like jumper's knee."}
            </p>
            <button
              type="button"
              onClick={() => setTab(tab === "training" ? "rehab" : "training")}
              className="btn-ghost mt-5 inline-flex min-h-11 text-sm"
            >
              Search {tab === "training" ? "injury & recovery" : "training"} instead
            </button>
          </div>
        ) : (
          // THE GRID IS THE RIGHT SHAPE and stays one (D-117). These are
          // thirty-odd things to CHOOSE between, not six of one thing with a
          // number each, so there is no ranking a single axis would reveal -
          // and folding two columns into one on a library this long doubles the
          // scroll on every screen wide enough to hold both. What was wrong was
          // the density, so that is what changed: the padding, and a ceiling on
          // the blurb.
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
                      under it, so the list read as a wall of headlines. The
                      display face and the weight still separate a title from
                      its blurb without the extra size doing it as well. */}
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
                      tallest of them (`items-stretch`), and the injury summaries
                      run to six lines where a drill's runs to two, so one entry
                      was setting the height of the card beside it. Nothing is
                      lost: the entry's own page carries the full text, which is
                      where anyone reading past three lines is going anyway. */}
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
