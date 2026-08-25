import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REHAB, rehabBySlug } from "@/content/rehab";
import {
  REGION_LABEL,
  TRIAGE_LABEL,
  TRIAGE_NOTE,
  type RehabEntry,
} from "@/content/rehab-types";
import { Reveal } from "@/components/motion";
import { LinkPending } from "@/components/link-pending";
import { SkillIcon } from "@/components/skill-icons";
import { SKILL_LABEL } from "@/lib/skills";

// The library is small and changes rarely, so the shell is prerendered from the
// authored module and the row is read at request time. A correction made in the
// table therefore shows up without a deploy, which is the whole reason the
// table exists (D-074).
export async function generateStaticParams() {
  return REHAB.map((e) => ({ slug: e.slug }));
}

// ONE read per request. `generateMetadata` and the component are separate
// invocations of this module and Next does not dedupe a supabase-js call
// between them, so every view of an entry resolved it twice. `cache()` scopes
// the result to the request. This matters more now than it did yesterday: these
// pages stopped serving noindex, so a crawler is about to start walking all 39
// of them.
const load = cache(async (slug: string): Promise<RehabEntry | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rehab_entries")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  // Fall back to the authored module rather than 404ing on a read failure:
  // public reference content should not vanish because the database blinked.
  return (data as RehabEntry | null) ?? rehabBySlug(slug) ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = await load(slug);
  // A slug with no entry keeps the (app) group's inherited noindex, which is
  // what should happen to a 404. Only a real entry overrides it.
  if (!entry) return { title: "Not found" };
  return {
    title: `${entry.name} in volleyball`,
    description: entry.summary,
    // Overrides the (app) group's noindex, same reason as /learn. Someone set
    // the canonical on all three library pages for SEO and missed the robots
    // line, so every entry carried a canonical telling Google which URL to rank
    // and a robots tag telling it not to.
    robots: { index: true, follow: true },
    alternates: { canonical: `/learn/rehab/${slug}` },
  };
}

const TRIAGE_STYLE: Record<RehabEntry["triage"], string> = {
  urgent: "border-coral text-coral-ink",
  get_assessed: "border-gold text-gold-ink",
  self_manage: "border-teal text-teal-ink",
};

function List({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: "danger";
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-8">
      <h2
        className={`font-display text-sm font-bold uppercase tracking-wide ${
          tone === "danger" ? "text-coral-ink" : ""
        }`}
      >
        {title}
      </h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-body leading-relaxed">
            <span
              aria-hidden
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === "danger" ? "bg-coral" : "bg-gold"
              }`}
            />
            <span className={tone === "danger" ? "text-chalk" : "text-chalk-dim"}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function RehabDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = await load(slug);
  if (!entry) notFound();

  // MedicalWebPage, and deliberately NOT MedicalCondition.
  //
  // These are the pages a stranger reaches at 11pm searching "jumper's knee"
  // or "volleyball shoulder pain", both of which the keyword harvest confirms
  // are frequent real queries. Marking them up is what lets a search or answer
  // engine surface them at all. But the type chosen says "a page ABOUT a
  // medical topic", not "a description OF a condition": the second invites an
  // engine to present this as clinical fact about the reader, and the
  // library's whole posture, stated on every entry and in the disclaimer, is
  // that it is education and cannot examine anyone. `lastReviewed` is absent
  // rather than invented; there is no review date to claim.
  const medical = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: `${entry.name} in volleyball`,
    description: entry.summary,
    audience: { "@type": "Audience", audienceType: "Volleyball players" },
    about: { "@type": "Thing", name: entry.name },
    specialty: "Sports medicine",
    isAccessibleForFree: true,
    inLanguage: "en",
  };

  return (
    <section className="max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(medical).replace(/</g, "\\u003c"),
        }}
      />
      <Reveal>
        <Link
          href="/learn/rehab"
          className="relative font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim transition-colors hover:text-gold-ink"
        >
          &larr; Injury &amp; recovery
          <LinkPending />
        </Link>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
          {REGION_LABEL[entry.region]}
        </p>
        <h1 className="mt-2 text-balance font-display text-page-title">
          {entry.name}
        </h1>
        {entry.also_called.length > 0 && (
          <p className="mt-2 text-body text-chalk-dim">
            Also called {entry.also_called.join(", ")}.
          </p>
        )}
      </Reveal>

      {/* Triage first, above everything. If the honest answer is "stop reading
          and go and see someone", that has to beat the article. */}
      <Reveal delay={60}>
        <div
          className={`mt-6 rounded-card border-l-[3px] bg-navy-lighter p-5 ${TRIAGE_STYLE[entry.triage]}`}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.1em]">
            {TRIAGE_LABEL[entry.triage]}
          </p>
          <p className="mt-1.5 text-body leading-relaxed text-chalk">
            {TRIAGE_NOTE[entry.triage]}
          </p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="mt-8">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide">
            What it is
          </h2>
          <p className="mt-3 text-body leading-relaxed text-chalk-dim">
            {entry.what_it_is}
          </p>
        </div>

        <div className="mt-8">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide">
            How volleyball causes it
          </h2>
          <p className="mt-3 text-body leading-relaxed text-chalk-dim">
            {entry.how_it_happens}
          </p>
          {entry.loads.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-2">
              {entry.loads.map((skill) => (
                <Link key={skill} href={`/learn/${skill}`} className="chip">
                  <SkillIcon skill={skill} className="h-3.5 w-3.5" />
                  {SKILL_LABEL[skill]}
                </Link>
              ))}
            </p>
          )}
        </div>
      </Reveal>

      <Reveal delay={140}>
        <List title="What it feels like" items={entry.signs} />
      </Reveal>

      {/* Red flags sit ABOVE the recovery phases on purpose. A player who reads
          "here is what recovery looks like" first is a player who has already
          decided to manage it themselves. */}
      <Reveal delay={180}>
        <List title="Stop and get it seen if" items={entry.red_flags} tone="danger" />
      </Reveal>

      <Reveal delay={220}>
        <div className="mt-8">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide">
            What recovery usually looks like
          </h2>
          <p className="mt-2 text-xs text-chalk-dim">
            Stages, not a schedule. Everyone moves through these at their own
            pace, and the ranges are wide because real recoveries are.
          </p>
          <ol className="mt-4 space-y-3">
            {entry.phases.map((phase, i) => (
              <li key={i} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-lg font-bold">
                    {i + 1}. {phase.name}
                  </p>
                  <p className="font-mono text-[11px] uppercase text-chalk-dim">
                    {phase.typical_window}
                  </p>
                </div>
                <p className="mt-2 text-body leading-relaxed text-chalk-dim">
                  {phase.goal}
                </p>
                <ul className="mt-3 space-y-2">
                  {phase.markers.map((m, mi) => (
                    <li key={mi} className="flex gap-2.5 text-sm text-chalk-dim">
                      <span
                        aria-hidden
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-chalk-dim"
                      />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      <Reveal delay={260}>
        <List title="Ready to play again when" items={entry.return_markers} />
      </Reveal>

      <Reveal delay={300}>
        <div className="mt-8">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide">
            Keeping it from coming back
          </h2>
          <p className="mt-2 text-xs text-chalk-dim">
            This is ordinary training, so unlike the rest of this page it does
            tell you what to do.
          </p>
          <ul className="mt-3 space-y-2.5">
            {entry.prevention.map((p, i) => (
              <li key={i} className="flex gap-3 text-body leading-relaxed">
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
                />
                <span className="text-chalk-dim">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={340}>
        <p className="mt-10 border-t border-line pt-5 text-xs leading-relaxed text-chalk-dim">
          This is general education, not a diagnosis and not treatment. Vollyio
          cannot examine you, and injuries that feel identical often are not.
          Nothing here replaces a doctor or a physiotherapist, and no part of it
          should be used to talk yourself out of seeing one.
        </p>
      </Reveal>
    </section>
  );
}
