import Link from "next/link";
import { CourtFilm } from "@/components/court-film";
import { CinematicHero } from "@/components/cinematic-hero";
import { StickyCta } from "@/components/sticky-cta";
import { CursorGlow, SpotlightGroup, Tilt } from "@/components/cursor-glow";
import { LandingNav } from "@/components/landing-nav";
import { Reveal, CountUp } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { Radar } from "@/components/radar";
import { ScoreRing } from "@/components/score-ring";
import { SkillIcon } from "@/components/skill-icons";
import { AnalyticsShowcase } from "@/components/analytics-showcase";
import { SKILLS, SKILL_LABEL, SKILL_BLURB } from "@/lib/skills";
import { SUPPORT_EMAIL } from "@/lib/site";

const STEPS = [
  {
    n: "01",
    title: "Upload a rep",
    body: "Film with your camera app and upload up to 10 seconds of one skill. iPhone or Android.",
  },
  {
    n: "02",
    title: "Get the breakdown",
    body: "Each metric scored 0–100, timestamped insights, and every note tied to the exact frame it happened in.",
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
        on iOS, Android, and desktop, and you can install it like an app.
      </p>
    ),
  },
  {
    q: "What does it cost?",
    a: (
      <p>
        Your first breakdown is free and we don&rsquo;t ask for a card. If we
        introduce paid plans, the price is shown in the app before you&rsquo;re
        asked to pay anything, and you will never be charged without explicitly
        choosing a plan.
      </p>
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
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
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
        Every note is pinned to the exact frame it came from, so you can
        see what the score saw and disagree with it. Treat it as a sharp
        second opinion whose work you can always check, not ground truth.
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

export default function Landing() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Vollyio",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web, iOS, Android",
    description:
      "Upload a rep, get frame-by-frame form analysis for every volleyball skill.",
    featureList: [
      "Frame-by-frame breakdown",
      "Six skills scored 0-100",
      "One priority fix per rep",
      "Rolling skill rating",
      "Coach chat",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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
      <CursorGlow />
      <LandingNav />

      <main id="main" tabIndex={-1} className="relative">
        <CinematicHero />

        <section id="film" className="cinematic-film-section scroll-mt-24 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
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
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
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
                    <span className="font-mono text-sm text-gold">{step.n}</span>
                    <h3 className="mt-3 font-display text-xl font-bold">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
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
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
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
                <span className="stat-num text-gold text-6xl md:text-7xl">
                  <CountUp to={6} />
                </span>
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
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
                    <div className="card card-lift spot h-full p-6">
                      <div className="flex items-center gap-3">
                        <span className="text-gold">
                          <SkillIcon skill={skill} />
                        </span>
                        <h3 className="font-display text-lg font-bold">
                          {SKILL_LABEL[skill]}
                        </h3>
                      </div>
                      <p className="mt-3 text-sm text-chalk-dim">
                        {SKILL_BLURB[skill]}
                      </p>
                    </div>
                  </Tilt>
                </Reveal>
              ))}
            </SpotlightGroup>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2 md:items-center md:px-8 md:py-28">
            <div>
              <Reveal>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
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
                        <p className="text-sm text-chalk">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-line pt-4">
                  <span className="tag uppercase">
                    Example · cited: frame 6 · t=1.2s
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="progress" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
                Progress
              </p>
              <h2 className="mt-3 max-w-lg font-display text-3xl font-bold tracking-tight md:text-4xl">
                A rating that moves when you do.
              </h2>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
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
                    <span className="stat-num text-gold text-5xl">
                      <CountUp to={12} />
                    </span>
                    <p className="mt-2 font-display font-bold">day streak</p>
                    <p className="mt-1 text-sm text-chalk-dim">
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
                    <p className="mt-3 text-sm text-chalk-dim">
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
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
                  Coach chat
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                  A coach that has actually seen you play.
                </h2>
                <p className="mt-4 max-w-md text-chalk-dim">
                  Ask anything. The coach answers from your own scores,
                  breakdowns, and goals, not generic tips.
                </p>
              </Reveal>
            </div>
            <Reveal delay={140}>
              <div className="card p-6">
                <div className="space-y-3">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gold px-4 py-2.5 text-sm font-medium text-navy">
                    Why is my passing score stuck at 64?
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-navy-light px-4 py-2.5 text-sm text-chalk">
                    Your last three reps all lost points on the same metric:
                    platform angle. You&rsquo;re swinging your arms instead of
                    riding your legs. Run Wall Platform Holds before Thursday
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
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
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
                        className="h-4 w-4 shrink-0 text-gold transition-transform duration-200 ease-court group-open:rotate-45"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </summary>
                    <div className="space-y-3 px-5 pb-5 text-sm leading-relaxed text-chalk-dim">
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
              <div className="mt-8 flex justify-center">
                <Link href="/start" className="btn-primary text-base">
                  Analyze your first rep
                </Link>
              </div>
              <p className="mx-auto mt-5 max-w-md text-sm text-chalk-dim">
                No card required, and your first breakdown is free. Your film stays
                private to your account:{" "}
                <Link
                  href="/privacy"
                  className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
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
              <p className="mt-1 max-w-xs text-sm text-chalk-dim">
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
