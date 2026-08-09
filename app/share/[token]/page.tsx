import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { analysisByShareToken } from "@/lib/share-read";
import { BreakdownBody } from "@/components/breakdown-body";
import { Reveal } from "@/components/motion";
import { ScoreRing } from "@/components/score-ring";
import { scoreBand } from "@/lib/ratings";
import { SKILL_LABEL } from "@/lib/skills";

export const dynamic = "force-dynamic";

// The public face of one shared analysis (D-049): everything comes from the
// bounded RPC projection, the clip streams through the token-validated route,
// and the page dies with the link (revoked or expired reads as not found).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const shared = await analysisByShareToken(supabase, token);
  if (!shared) {
    return { title: "Breakdown not found", robots: { index: false, follow: false } };
  }
  const label = SKILL_LABEL[shared.skill];
  const title = `${label} breakdown, ${shared.overall_score}/100`;
  const description = `A ${label.toLowerCase()} rep scored ${shared.overall_score} out of 100 on Vollyio. Priority fix: ${shared.result.priority_fix.title}`;
  // openGraph and twitter are restated rather than left to inherit `title` and
  // `description` above. The ROOT layout sets openGraph.title explicitly, and an
  // explicit parent value wins over a child's plain `title`, so every shared
  // breakdown unfurled as the site-wide "Vollyio · Volleyball Form Coach" while
  // the browser tab correctly read "Passing breakdown, 87/100".
  //
  // That is the whole first impression of the one channel that has ever brought
  // this product visitors: a share link accounted for 74 of the first 219. The
  // card already carried the real score and the real priority fix in its IMAGE;
  // the headline beside it was a generic pitch, which reads as an advert in a
  // place where the specific number reads as a person sharing a rep.
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { type: "article", siteName: "Vollyio", title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedBreakdown({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const shared = await analysisByShareToken(supabase, token);
  if (!shared) notFound();

  const dateLabel = new Date(shared.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    // Wider only when there is a clip to put beside the scores. A breakdown
    // with no clip is a column of prose, and stretching that to 64rem hurts it.
    <main
      className={`mx-auto px-4 py-10 sm:px-6 ${
        shared.clip_path ? "max-w-5xl" : "max-w-3xl"
      }`}
    >
      <Reveal>
        <div className="flex items-center justify-between border-b border-line pb-5">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-wide text-gold"
          >
            Vollyio
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
            Shared breakdown
          </span>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
              {SKILL_LABEL[shared.skill]} · {dateLabel}
            </p>
            <h1 className="mt-2 font-display text-page-title">
              Breakdown
            </h1>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={shared.overall_score} size={84} />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
              {scoreBand(shared.overall_score)}
            </span>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
          Scored like a coach · 40 developing · 70 solid · 90 advanced
        </p>
        {typeof shared.result.coverage_pct === "number" && (
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
            Graded on {shared.result.coverage_pct}% of the checklist
          </p>
        )}
      </Reveal>

      {/* Same split as the owner's own breakdown: clip on the right from tablet
          up, scores on the wider left. Without it the clip ran the full column
          width on every screen and a stranger had to scroll past a full-bleed
          video before reaching the thing the link was sent to show them. */}
      <div className="mt-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-start md:gap-8">
        {shared.clip_path && (
          <div className="md:order-2 md:sticky md:top-8">
            <Reveal delay={100}>
              <video
                controls
                playsInline
                preload="metadata"
                src={`/share/${token}/clip`}
                className="max-h-[55vh] w-full rounded-card border border-line bg-navy-light object-contain"
              />
            </Reveal>
          </div>
        )}

        <div className="mt-8 min-w-0 md:order-1 md:mt-0">
          <BreakdownBody
            skill={shared.skill}
            result={shared.result}
          />
        </div>
      </div>

      <Reveal delay={360}>
        <div className="card mt-10 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0 max-w-md">
            <p className="font-display font-bold">Want your own breakdown?</p>
            <p className="mt-1 text-xs text-chalk-dim">
              Film one rep and get scored like this, with the one fix that
              moves your game fastest.
            </p>
          </div>
          <Link href="/" className="btn-primary min-h-11 px-5 text-sm">
            Try Vollyio
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
