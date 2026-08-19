import Link from "next/link";
import { CourtFilm } from "@/components/court-film";
import { CinematicHero } from "@/components/cinematic-hero";
import { StickyCta } from "@/components/sticky-cta";
import { CursorGlow, SpotlightGroup, Tilt } from "@/components/cursor-glow";
import { LandingNav } from "@/components/landing-nav";
import { InstallApp } from "@/components/install-app";
import { Reveal, CountUp } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { Radar } from "@/components/radar";
import { ScoreRing } from "@/components/score-ring";
import { SkillIcon } from "@/components/skill-icons";
import { AnalyticsShowcase } from "@/components/analytics-showcase";
import { SKILLS, SKILL_LABEL, SKILL_BLURB } from "@/lib/skills";
import { SUPPORT_EMAIL } from "@/lib/site";
// Quoted from the same constants the plan card, the limit offer and the terms
// read, never retyped. A price on the marketing page that disagrees with the
// one at checkout is a false statement about money, and this page carried one
// for weeks: it said "if we introduce paid plans" while billing was live.
import {
  MONTHLY_ALLOWANCE,
  SIGNUP_GRANT,
  PLAN_LABEL,
  PRO_PRICE_LABEL,
  allowanceSentence,
} from "@/lib/plans";
import { DRILLS } from "@/content/drills";

// The homepage owns "/" as its canonical; the root layout deliberately sets
// none, because a layout-level canonical leaks onto every page beneath it.
export const metadata = {
  alternates: { canonical: "/" },
};

// The bare amount, for sentences that already say "a month" and would otherwise
// read "18 a month for $9.99/mo". Same derivation the terms page uses, so both
// still quote the one constant rather than a retyped number.
const PRO_PRICE = PRO_PRICE_LABEL.replace("/mo", "");

// The bare numeric amount, for schema.org, which wants "9.99" and not "$9.99".
const PRO_PRICE_AMOUNT = PRO_PRICE.replace(/[^0-9.]/g, "");

const STEPS = [
  {
    n: "01",
    title: "Upload a rep",
    body: "Film with your camera app and upload up to 10 seconds of one skill. iPhone or Android.",
  },
  {
    n: "02",
    title: "Get the breakdown",
    body: "One score out of 100 for the rep, the five checkpoints a coach watches, and what was seen at each one.",
  },
  {
    n: "03",
    title: "Run the fix",
    body: "One priority fix per rep, the change that buys the most, with drills matched to it.",
  },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What do I need to get started?",
    a: (
      <p>
        A phone and a browser. Film up to 10 seconds of one skill with your
        camera app and upload it, or trim a clip you already have. One rep
        reads better than a rally, and a whole game is not what this scores.
        iPhone and Android clips both work. No
        wearables, no rig, no second person required. Vollyio runs on the web
        on iOS, Android, and desktop, and installs to your home screen like an
        app, full screen with no address bar.
      </p>
    ),
  },
  {
    q: "What does it cost?",
    a: (
      <>
        <p>
          {PLAN_LABEL.free} is {allowanceSentence("free")}, at no cost and with
          no card. {PLAN_LABEL.pro} is {allowanceSentence("pro")} for{" "}
          {PRO_PRICE}, and it renews on the day you subscribed rather than on
          the 1st. Both limits are DAILY and reset at midnight UTC: the monthly
          figures ({MONTHLY_ALLOWANCE.free} and {MONTHLY_ALLOWANCE.pro}) are
          just those day rates across thirty days, so you cannot save them up
          and spend a month&rsquo;s worth at one tournament.
        </p>
        <p>
          You are never charged without choosing {PLAN_LABEL.pro} yourself, and
          you can cancel from Settings at any time and keep it until the end of
          the period you paid for. Full detail is in the{" "}
          <Link
            href="/terms"
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
          >
            terms
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    q: "What happens to my film?",
    a: (
      <>
        <p>
          Your clips stay private to your account: never published, never
          shared with other users, never sold. Frames from your clip are
          processed by the coaching service to produce your breakdown, and
          your footage helps train future features only if you opt in. It
          is off by default.
        </p>
        <p>
          Want something gone? Contact us and we&rsquo;ll delete footage or
          your whole account. The details live in the{" "}
          <Link
            href="/privacy"
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    q: "How accurate is the analysis?",
    a: (
      <p>
        Every skill is graded on the checkpoints a coach actually watches: on
        a serve, that&rsquo;s toss, arm swing, contact, and follow-through.
        Every note says what was seen in the rep, so you can play your own
        clip back against it and disagree. Treat it as a sharp second
        opinion whose work you can always check, not ground truth.
      </p>
    ),
  },
  {
    q: "What is the rating?",
    a: (
      <p>
        A rolling 0&ndash;100 rating per skill, built from your most recent
        scored reps. It weighs your latest film, not a lifetime average, so it
        reflects how you play now, and it moves when you do.
      </p>
    ),
  },
];

/**
 * The FAQ answers again, as plain text, for FAQPage structured data.
 *
 * WHY A SECOND COPY EXISTS. The rendered answers above are React nodes with
 * links and multiple paragraphs; there is no way to hand those to JSON-LD.
 * Authoring twice is normally the exact mistake this file's other comments
 * warn about, so the drift that actually matters is closed the only way that
 * works: every NUMBER here is the same imported constant the rendered answer
 * interpolates. The prose can fall out of step and cost clarity; the price,
 * the allowance and the grant cannot fall out of step and become false, which
 * is the failure mode that reaches an answer engine and gets quoted at a
 * stranger. `lib/landing-faq.test.ts` pins the two lists to the same length
 * and the same questions.
 */
const FAQ_PLAIN: { q: string; a: string }[] = [
  {
    q: "What do I need to get started?",
    a: `A phone and a browser. Film up to 10 seconds of one skill with your camera app and upload it, or trim a clip you already have. One rep reads better than a rally, and a whole game is not what this scores. iPhone and Android clips both work. No wearables, no rig, and no second person required. Vollyio runs on the web on iOS, Android and desktop, and installs to your home screen like an app.`,
  },
  {
    q: "What does it cost?",
    a: `${PLAN_LABEL.free} is ${allowanceSentence("free")}, at no cost and with no card. ${PLAN_LABEL.pro} is ${allowanceSentence("pro")} for ${PRO_PRICE}, and it renews on the day you subscribed rather than on the 1st. Both limits are daily and reset at midnight UTC, so the monthly figures (${MONTHLY_ALLOWANCE.free} and ${MONTHLY_ALLOWANCE.pro}) are those day rates across thirty days rather than a balance you can save up. You are never charged without choosing ${PLAN_LABEL.pro} yourself, and you can cancel from Settings at any time and keep it until the end of the period you paid for.`,
  },
  {
    q: "What happens to my film?",
    a: `Your clips stay private to your account: never published, never shared with other users, never sold. Images from your clip are processed by the coaching service to produce your breakdown, and your footage helps train future features only if you opt in, which is off by default. Ask and we will delete footage or your whole account.`,
  },
  {
    q: "How accurate is the analysis?",
    a: `Every skill is graded on the checkpoints a coach actually watches: on a serve that is toss, arm swing, contact and follow-through. Every note says what was seen in the rep, so you can play your own clip back against it and disagree. It reads about one low-resolution sample a second, so it judges the rep as a whole rather than any single moment inside it. Treat it as a sharp second opinion whose work you can always check, not as ground truth.`,
  },
  {
    q: "What is the rating?",
    a: `A rolling 0-100 rating per skill, built from your most recent scored reps. It weighs your latest film rather than a lifetime average, so it reflects how you play now, and it moves when you do.`,
  },
];

export default function Landing() {
  // FAQPage is the single highest-value markup on this site for answer
  // engines: it is the shape they lift verbatim when someone asks "how much
  // is Vollyio" or "is my volleyball footage private". Publishing it is how
  // the product's own words get quoted instead of a model's guess at them.
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_PLAIN.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Vollyio",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web, iOS, Android",
    // The description and the first feature both claimed per-frame analysis
    // until 2026-08-11. Structured data is the claim that reaches a parent, a
    // search engine and an answer engine BEFORE any rendered page does, which
    // is exactly the argument the comment below already made about price, so
    // the same standard applies to capability: the video path samples roughly
    // one frame a second and `/api/analyze` sets `timeAt = () => null`. The
    // 6e351ba sweep rewrote the visible copy and never opened this object.
    description:
      "Upload a rep, get it scored 0-100 against the checkpoints for that skill, with the one fix that matters most.",
    // Both tiers, because a single price "0" told every search and answer
    // engine the product was free while a paid auto-renewing subscription
    // was on sale. Structured data is the claim that reaches a parent before
    // any page does, so it is the one that has to be right first. Prices are
    // quoted from lib/plans, never retyped.
    featureList: [
      "Whole-rep breakdown, scored against five checkpoints",
      "Six skills scored 0-100",
      "One priority fix per rep",
      "Rolling skill rating",
      // Listed as of 2026-08-06, when coach chat stopped being dark. The rule
      // this line has to keep obeying is the one that kept it out before:
      // structured data may only name a feature the product actually serves. If
      // COACH_ENABLED is ever set to false, this entry comes out with it.
      "Coach chat grounded in your own scores",
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      highPrice: PRO_PRICE_AMOUNT,
      offerCount: 2,
      offers: [
        {
          "@type": "Offer",
          name: `${PLAN_LABEL.free} plan`,
          price: "0",
          priceCurrency: "USD",
          description: `${allowanceSentence("free")}, no card required.`,
        },
        {
          "@type": "Offer",
          name: `${PLAN_LABEL.pro} plan`,
          price: PRO_PRICE_AMOUNT,
          priceCurrency: "USD",
          // The free offer beside this one already quoted the day rate; this
          // one quoted the month and was the only place left where a machine
          // could read "540 a month" and repeat it as a monthly balance.
          description: `${allowanceSentence("pro")}, billed monthly and renewing on the day you subscribe until cancelled.`,
        },
      ],
    },
  };
  return (
    <div className="relative overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary"
      >
        Skip to content
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqLd).replace(/</g, "\\u003c"),
        }}
      />
      <CursorGlow />
      {/* First thing on the page, above the nav. The install is the one
          distribution surface that needs nobody's permission, and it was only
          reachable by scrolling to the closing CTA. It renders nothing on a
          browser that cannot install, nothing once installed, and nothing once
          dismissed, so it costs a returning visitor no height at all. */}
      <InstallApp variant="banner" />
      <LandingNav />

      <main id="main" tabIndex={-1} className="relative">
        <CinematicHero />

        <section id="film" className="cinematic-film-section scroll-mt-24 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
                The film room
              </p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">
                Watch a rep get read.
              </h2>
              <p className="mt-4 max-w-xl text-chalk-dim">
                This is the read itself: you tap your player, a gold ring
                marks exactly who to analyze, the coach follows them through the
                rep, scores every checkpoint, and hands back
                the one fix that buys the most. The whole read, in a
                ten-second loop.
              </p>
              {/* The zero-cost way to evaluate the product (D-080): three
                  real breakdowns, browsable with no account, so "let me see
                  what it actually does" never costs a signup or a rep. */}
              <p className="mt-4">
                <Link
                  href="/samples"
                  className="font-mono text-xs uppercase tracking-[0.08em] text-gold-ink transition-colors hover:text-chalk"
                >
                  Or browse three real breakdowns first &rarr;
                </Link>
              </p>
            </Reveal>
            <Reveal delay={120}>
              {/* max kept at 2deg: the film is the attention object, the tilt
                  only signals "this is an object you can examine". */}
              <Tilt max={2}>
                <div className="relative mt-10 aspect-video overflow-hidden rounded-card border border-line bg-navy-light shadow-lift">
                  <CourtFilm
                    src="/vollyio-court-vision.mp4"
                    srcWebm="/vollyio-court-vision.webm"
                    poster="/vollyio-court-vision-poster.webp"
                    label="Ten-second loop: a two-player rep is scanned, the tapped hitter is ringed in gold, spike checkpoints are scored, and the spike scores 82 with one priority fix."
                    posterAlt="A two-player volleyball spike: the tapped hitter ringed in gold, scored attack checkpoints, and a spike score of 82."
                    className="absolute inset-0"
                    controlCorner="bottom-4 right-4"
                    sizes="(min-width: 1200px) 1104px, calc(100vw - 2.5rem)"
                  />
                </div>
              </Tilt>
            </Reveal>
            <Reveal delay={200}>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  "Tap a player, mark the whole rep",
                  "Every checkpoint scored",
                  "One priority fix",
                ].map((chip) => (
                  <span key={chip} className="tag">
                    {chip}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 md:px-8 md:py-28">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
              From clip to correction in under a minute.
            </h2>
          </Reveal>
          <SpotlightGroup className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 90} className="reveal-3d h-full">
                <Tilt className="h-full">
                  <div className="card card-lift spot h-full p-6">
                    <span className="font-mono text-sm text-gold-ink">{step.n}</span>
                    <h3 className="mt-3 font-display text-xl font-bold">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-body leading-relaxed text-chalk-dim">
                      {step.body}
                    </p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </SpotlightGroup>
        </section>

        <section id="analytics" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
                Analytics that coach you
              </p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">
                Turn every rep into a reason to take the next one.
              </h2>
              <p className="mt-4 max-w-xl text-chalk-dim">
                Vollyio connects the score to the motion that made it, then turns
                that evidence into one clear adjustment for your next rep.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-10">
                <AnalyticsShowcase />
              </div>
            </Reveal>
          </div>
        </section>

        <section id="skills" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <div className="flex items-end gap-4">
                <span className="stat-num text-gold-ink text-6xl md:text-7xl">
                  <CountUp to={6} />
                </span>
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
                    Skills scored
                  </p>
                  <h2 className="mt-2 max-w-lg font-display text-3xl font-bold tracking-tight md:text-4xl">
                    The whole game, not just your swing.
                  </h2>
                </div>
              </div>
            </Reveal>
            <SpotlightGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SKILLS.map((skill, i) => (
                <Reveal key={skill} delay={i * 60} className="reveal-3d h-full">
                  <Tilt className="h-full">
                    {/* Each card is the entry to that skill's technique page.
                        Those pages were already public and already carried real
                        titles and descriptions, but nothing on this site linked
                        to them, so the only way in was to already know the URL. */}
                    <Link
                      href={`/learn/${skill}`}
                      className="card card-lift spot h-full p-6"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gold-ink">
                          <SkillIcon skill={skill} />
                        </span>
                        <h3 className="font-display text-lg font-bold">
                          {SKILL_LABEL[skill]}
                        </h3>
                      </div>
                      <p className="mt-3 text-body text-chalk-dim">
                        {SKILL_BLURB[skill]}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-gold-ink">
                        Read the technique
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        >
                          <path d="M6 3l5 5-5 5" />
                        </svg>
                      </span>
                    </Link>
                  </Tilt>
                </Reveal>
              ))}
            </SpotlightGroup>
            <Reveal delay={120}>
              <p className="mt-8 text-center text-body text-chalk-dim">
                Or go straight to the{" "}
                <Link
                  href="/drills"
                  className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
                >
                  drill library
                </Link>
                : {DRILLS.length} drills across every skill, free to read
                without an account.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2 md:items-center md:px-8 md:py-28">
            <div>
              <Reveal>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
                  Evidence, not vibes
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                  Every note points at a frame.
                </h2>
                <p className="mt-4 max-w-md text-chalk-dim">
                  No &ldquo;looks good&rdquo; feedback. Each insight is pinned
                  to the moment it happened, so you can see exactly what the
                  score saw, and argue with it if you want. Every skill is
                  graded on the checkpoints a coach actually watches: on a
                  serve, that&rsquo;s toss, arm swing, contact, and
                  follow-through.
                </p>
              </Reveal>
            </div>
            <Reveal delay={140}>
              <div className="card p-6">
                <div className="space-y-4">
                  {[
                    ["0:00.4", "teal", "High, repeatable toss. Keep it."],
                    ["0:01.2", "coral", "Elbow drops before contact. Power leaks here."],
                    ["0:01.6", "teal", "Clean wrist snap through the ball."],
                  ].map(([t, tone, text]) => (
                    <div key={t as string} className="flex gap-3">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          tone === "teal" ? "bg-teal" : "bg-coral"
                        }`}
                      />
                      <div>
                        <span className="font-mono text-[11px] uppercase text-chalk-dim">
                          {t}
                        </span>
                        <p className="text-body text-chalk">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-line pt-4">
                  {/* This tag used to cite a specific sampled image and an
                      instant within the clip. The product cannot produce
                      either: the scoring path takes roughly one low-resolution
                      sample a second and `/api/analyze` returns no instant at
                      all, so the claim was false on a page a parent reads
                      first. Saying the read covers the whole rep is the honest
                      version, and it is what the breakdown actually shows.
                      lib/landing-cinematic.test.ts holds the whole claim
                      family down, comments included, which is why this note
                      describes the ban rather than restating the words. */}
                  <span className="tag uppercase">
                    Example · read across the whole rep
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="progress" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
                Progress
              </p>
              <h2 className="mt-3 max-w-lg font-display text-3xl font-bold tracking-tight md:text-4xl">
                A rating that moves when you do.
              </h2>
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-chalk-dim">
                Example data. Yours starts at your first rep.
              </p>
            </Reveal>
            <SpotlightGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Reveal className="reveal-3d h-full">
                <Tilt className="h-full">
                  <div className="card card-lift spot flex h-full flex-col items-center justify-center gap-2 p-6">
                    <ScoreRing score={72} size={110} label="Overall" />
                    <p className="font-mono text-[11px] uppercase text-chalk-dim">
                      Rolling skill rating
                    </p>
                  </div>
                </Tilt>
              </Reveal>
              <Reveal delay={70} className="reveal-3d h-full">
                <Tilt className="h-full">
                  <div className="card card-lift spot flex h-full items-center justify-center p-4">
                    <Radar
                      size={190}
                      ratings={{
                        serve: 78,
                        pass: 64,
                        set: 71,
                        attack: 82,
                        block: 55,
                        dig: 68,
                      }}
                    />
                  </div>
                </Tilt>
              </Reveal>
              <Reveal delay={140} className="reveal-3d h-full">
                <Tilt className="h-full">
                  <div className="card card-lift spot flex h-full flex-col justify-center p-6">
                    <span className="stat-num text-gold-ink text-5xl">
                      <CountUp to={12} />
                    </span>
                    <p className="mt-2 font-display font-bold">day streak</p>
                    <p className="mt-1 text-body text-chalk-dim">
                      Saved on the server. A phone restart can&rsquo;t take it
                      from you.
                    </p>
                  </div>
                </Tilt>
              </Reveal>
              <Reveal delay={210} className="reveal-3d h-full">
                <Tilt className="h-full">
                  <div className="card card-lift spot flex h-full flex-col justify-center p-6">
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-chalk-dim">
                      Level 4
                    </span>
                    <div className="mt-3 h-1.5 rounded-full bg-line/60">
                      <div className="h-full w-3/5 rounded-full bg-gold" />
                    </div>
                    <p className="mt-3 text-body text-chalk-dim">
                      XP for every rep, challenge, and finished goal.
                    </p>
                  </div>
                </Tilt>
              </Reveal>
            </SpotlightGroup>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2 md:items-center md:px-8 md:py-28">
            <div>
              <Reveal>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
                  Coach chat{" "}
                  <span className="ml-2 inline-block rounded-full border border-line-control px-2.5 py-0.5 text-[10px] tracking-[0.12em] text-chalk-dim">
                    Coming soon
                  </span>
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                  A coach that has actually seen you play.
                </h2>
                <p className="mt-4 max-w-md text-chalk-dim">
                  Next up for Vollyio: ask anything, and the coach answers from
                  your own scores, breakdowns, and goals, not generic tips.
                </p>
              </Reveal>
            </div>
            <Reveal delay={140}>
              <div className="card p-6">
                <div className="space-y-3">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gold px-4 py-2.5 text-sm font-medium text-deep">
                    Why is my passing score stuck at 64?
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-navy-light px-4 py-2.5 text-sm text-chalk">
                    Your last three reps all lost points on the same metric:
                    platform angle. You&rsquo;re swinging your arms instead of
                    riding your legs. Run Wall Platform Reps before Thursday
                    and re-film.
                  </div>
                </div>
                <div className="mt-4 border-t border-line pt-3">
                  <span className="font-mono text-[11px] uppercase text-chalk-dim">
                    Coach · knows your film
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
                Straight answers
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                Before you hand us your film.
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <div className="mt-8 space-y-3">
                {FAQ.map(({ q, a }) => (
                  <details key={q} className="card group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-display font-bold [&::-webkit-details-marker]:hidden">
                      {q}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden
                        focusable="false"
                        className="h-4 w-4 shrink-0 text-gold-ink transition-transform duration-200 ease-court group-open:rotate-45"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </summary>
                    <div className="space-y-3 px-5 pb-5 text-body leading-relaxed text-chalk-dim">
                      {a}
                    </div>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="relative border-t border-line">
          <SeamArcs className="absolute inset-0 h-full w-full animate-drift" opacity={0.07} />
          <div className="relative mx-auto max-w-3xl px-5 py-20 text-center md:py-24">
            <Reveal>
              <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
                <span className="text-sheen">Your move.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-chalk-dim">
                Made for players who film their own reps and want them scored
                like a coach would. The next one you film is the first one that
                counts.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3">
                <Link href="/start" className="btn-primary text-base">
                  Analyze your first rep
                </Link>
                {/* Secondary on purpose. Installing before there is anything to
                    come back to is the wrong first move, so this sits under the
                    real CTA and renders nothing at all on a browser that cannot
                    install (see components/install-app.tsx). */}
                <InstallApp />
              </div>
              {/* The offer, in the open. This page used to say only "your
                  first breakdown is free" and put the real numbers behind a
                  collapsed FAQ, which asked a stranger to commit before they
                  could see what they were committing to. */}
              {/* STATED AS A DAY RATE, which is the wall a player actually
                  meets. This said "90 a month" and "540 a month", and both
                  are the hidden asterisk D-110 exists to refuse: they are
                  arithmetically true and practically unreachable, because the
                  limit that binds is daily. Someone reading "540 a month"
                  reasonably plans to film a tournament on Saturday and finds
                  out at rep 19 that they cannot. `allowanceSentence` in
                  lib/plans.ts has encoded the honest phrasing all along; this
                  page simply was not using it. */}
              <p className="mx-auto mt-6 max-w-md text-body">
                <span className="text-chalk">
                  {PLAN_LABEL.free} is {allowanceSentence("free")}. No card.
                </span>{" "}
                <span className="text-chalk-dim">
                  {PLAN_LABEL.pro} is {allowanceSentence("pro")} for {PRO_PRICE},
                  cancel any time.
                </span>
              </p>
              <p className="mx-auto mt-3 max-w-md text-body text-chalk-dim">
                Your film stays private to your account:{" "}
                <Link
                  href="/privacy"
                  className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
                >
                  see how we handle it
                </Link>
                .
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div>
              <p className="font-display text-lg font-bold">Vollyio</p>
              <p className="mt-1 max-w-xs text-body text-chalk-dim">
                Built for players who watch their own film.
              </p>
            </div>
            <nav
              aria-label="Footer"
              className="grid grid-cols-2 gap-x-8 gap-y-8 text-sm sm:grid-cols-3"
            >
              <div className="space-y-2.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                  Product
                </p>
                <a
                  href="#how"
                  className="block text-chalk-dim transition-colors hover:text-chalk"
                >
                  How it works
                </a>
                <a
                  href="#faq"
                  className="block text-chalk-dim transition-colors hover:text-chalk"
                >
                  Pricing &amp; FAQ
                </a>
              </div>
              <div className="space-y-2.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                  Legal
                </p>
                <Link
                  href="/privacy"
                  className="block text-chalk-dim transition-colors hover:text-chalk"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className="block text-chalk-dim transition-colors hover:text-chalk"
                >
                  Terms of Service
                </Link>
              </div>
              <div className="space-y-2.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                  Account
                </p>
                <Link
                  href="/login"
                  className="block text-chalk-dim transition-colors hover:text-chalk"
                >
                  Log in
                </Link>
                <Link
                  href="/start"
                  className="block text-chalk-dim transition-colors hover:text-chalk"
                >
                  Analyze your first rep
                </Link>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="block text-chalk-dim transition-colors hover:text-chalk"
                >
                  Contact
                </a>
              </div>
            </nav>
          </div>
          <p className="mt-10 border-t border-line pt-6 font-mono text-xs text-chalk-dim">
            © 2026 Vollyio
          </p>
        </div>
      </footer>

      <StickyCta
        watch="hero-cta"
        label="Analyze your first rep"
        href="/start"
      />
      <div
        className="md:hidden"
        style={{ height: "calc(5rem + env(safe-area-inset-bottom))" }}
      />
    </div>
  );
}
