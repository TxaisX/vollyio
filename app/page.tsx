import Link from "next/link";
import { CursorGlow, Magnetic, SpotlightGroup } from "@/components/cursor-glow";
import { LandingNav } from "@/components/landing-nav";
import { Reveal, CountUp } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { Radar } from "@/components/radar";
import { ScoreRing } from "@/components/score-ring";
import { SkillIcon } from "@/components/skill-icons";
import { SKILLS, SKILL_LABEL, SKILL_BLURB } from "@/lib/skills";

const MARQUEE = [
  "Frame-by-frame breakdown",
  "One priority fix",
  "Six skills",
  "Evidence, not vibes",
  "Track your rating",
  "Built for the film room",
];

const STEPS = [
  {
    n: "01",
    title: "Record a rep",
    body: "Film up to 45 seconds of any skill, or upload a clip you already have. Photos work too.",
  },
  {
    n: "02",
    title: "Get the breakdown",
    body: "Each metric scored 0–100, timestamped insights, and every note tied to the exact frame it happened in.",
  },
  {
    n: "03",
    title: "Run the fix",
    body: "One priority fix per rep — the change that buys the most — with drills matched to it.",
  },
];

function MockAnalysisCard() {
  return (
    <div className="card spot rotate-1 p-5 shadow-lift md:p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-chalk-dim">
          Serve · 5 frames
        </span>
        <span className="rounded-full bg-gold px-2.5 py-0.5 font-display text-xs font-bold text-navy">
          78
        </span>
      </div>
      <div className="mt-4 flex gap-1.5">
        {[0.4, 0.8, 1.2, 1.6, 2.1].map((t, i) => (
          <div
            key={t}
            className={`h-14 flex-1 rounded-md border ${
              i === 4 ? "border-gold" : "border-line"
            } bg-gradient-to-b from-navy-lighter to-navy-light`}
          >
            <span className="block px-1.5 pt-1 font-mono text-[9px] text-chalk-dim">
              {t}s
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {[
          ["Toss placement", 82],
          ["Contact point", 74],
          ["Follow-through", 61],
        ].map(([label, score]) => (
          <div key={label as string}>
            <div className="flex justify-between font-mono text-[10px] uppercase text-chalk-dim">
              <span>{label}</span>
              <span className="text-chalk">{score}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-md border-l-2 border-gold bg-navy/60 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
          Priority fix · frame 5
        </p>
        <p className="mt-1 text-sm text-chalk">
          Contact is behind your head — toss six inches further into the court.
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Sideout",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web, iOS, Android",
    description:
      "Record a rep, get frame-by-frame form analysis for every volleyball skill.",
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
        <section className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-32 md:grid-cols-2 md:items-center md:gap-10 md:px-8 md:pb-28 md:pt-44">
          <SeamArcs className="absolute inset-0 -z-10 h-full w-full" />
          <div>
            <Reveal immediate>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
                AI volleyball coach
              </p>
            </Reveal>
            <Reveal delay={80} immediate>
              <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                Fix the one thing{" "}
                <span className="text-sheen">holding your game back.</span>
              </h1>
            </Reveal>
            <Reveal delay={160} immediate>
              <p className="mt-5 max-w-md text-lg text-chalk-dim">
                Record a rep. Sideout breaks it down frame by frame — serve,
                pass, set, attack, block, and defense — scored the way a coach
                scores it.
              </p>
            </Reveal>
            <Reveal delay={240} immediate>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Magnetic>
                  <Link href="/signup" className="btn-primary text-base">
                    Start your first breakdown
                  </Link>
                </Magnetic>
                <a href="#how" className="btn-ghost text-base">
                  See how it works
                </a>
              </div>
            </Reveal>
            <Reveal delay={320} immediate>
              <div className="mt-8 flex flex-wrap gap-2">
                {["Six skills", "Frame-cited feedback", "Free to start"].map(
                  (chip) => (
                    <span key={chip} className="tag">
                      {chip}
                    </span>
                  ),
                )}
              </div>
            </Reveal>
          </div>
          <Reveal delay={200} immediate className="md:justify-self-end">
            <SpotlightGroup>
              <MockAnalysisCard />
            </SpotlightGroup>
          </Reveal>
        </section>

        <div aria-hidden="true" className="overflow-hidden border-y border-line py-3">
          <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <span
                key={i}
                className="flex items-center gap-8 font-mono text-xs uppercase tracking-[0.2em] text-chalk-dim"
              >
                {item}
                <span className="text-gold">·</span>
              </span>
            ))}
          </div>
        </div>

        <section id="how" className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
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
              <Reveal key={step.n} delay={i * 90}>
                <div className="card card-lift spot h-full p-6">
                  <span className="font-mono text-sm text-gold">{step.n}</span>
                  <h3 className="mt-3 font-display text-xl font-bold">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </SpotlightGroup>
        </section>

        <section id="skills" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <div className="flex items-end gap-4">
                <span className="stat-num text-gold text-6xl md:text-7xl">6</span>
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
                <Reveal key={skill} delay={i * 60}>
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
                  score saw — and argue with it if you want. Every skill is
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
                    ["0:00.4", "teal", "High, repeatable toss — keep it."],
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
                        <span className="font-mono text-[10px] uppercase text-chalk-dim">
                          {t}
                        </span>
                        <p className="text-sm text-chalk">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-line pt-4">
                  <span className="tag uppercase">
                    Cited: frame 6 · t=1.2s
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="progress" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
                Progress
              </p>
              <h2 className="mt-3 max-w-lg font-display text-3xl font-bold tracking-tight md:text-4xl">
                A rating that moves when you do.
              </h2>
            </Reveal>
            <SpotlightGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Reveal>
                <div className="card card-lift spot flex h-full flex-col items-center justify-center gap-2 p-6">
                  <ScoreRing score={72} size={110} label="Overall" />
                  <p className="font-mono text-[11px] uppercase text-chalk-dim">
                    Rolling skill rating
                  </p>
                </div>
              </Reveal>
              <Reveal delay={70}>
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
              </Reveal>
              <Reveal delay={140}>
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
              </Reveal>
              <Reveal delay={210}>
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
                  breakdowns, and goals — not generic tips.
                </p>
              </Reveal>
            </div>
            <Reveal>
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
                  <span className="font-mono text-[10px] uppercase text-chalk-dim">
                    Coach · knows your film
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="relative border-t border-line">
          <SeamArcs className="absolute inset-0 h-full w-full" opacity={0.07} />
          <div className="relative mx-auto max-w-3xl px-5 py-24 text-center md:py-32">
            <Reveal>
              <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
                <span className="text-sheen">Your move.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-chalk-dim">
                The next rep you film is the first one that counts.
              </p>
              <p className="mx-auto mt-3 max-w-md font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                For volleyball players who film their reps and want them scored
                like a coach would.
              </p>
              <div className="mt-8 flex justify-center">
                <Magnetic>
                  <Link href="/signup" className="btn-primary text-base">
                    Start your first breakdown
                  </Link>
                </Magnetic>
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                No card. Your first breakdown is free.
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 md:flex-row md:px-8">
          <div>
            <p className="font-display text-lg font-bold">Sideout</p>
            <p className="mt-1 text-sm text-chalk-dim">
              Built for players who watch their own film.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm text-chalk-dim">
            <Link href="/login" className="transition-colors hover:text-chalk">
              Log in
            </Link>
            <Link href="/signup" className="transition-colors hover:text-chalk">
              Sign up
            </Link>
            <span className="font-mono text-xs">© 2026 Sideout</span>
          </div>
        </div>
      </footer>

      <div
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-navy/90 px-3 pt-3 backdrop-blur-md md:hidden"
      >
        <Link href="/signup" className="btn-primary w-full py-3.5">
          Start your first breakdown
        </Link>
      </div>
      <div
        className="md:hidden"
        style={{ height: "calc(5rem + env(safe-area-inset-bottom))" }}
      />
    </div>
  );
}
