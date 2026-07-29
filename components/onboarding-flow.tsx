"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SkillPicker } from "@/components/skill-picker";
import { completeOnboarding } from "@/app/(app)/welcome/actions";
import {
  FREQUENCY_LABEL,
  FREQUENCY_OPTIONS,
  FUNNEL_STORAGE_KEY,
  LEVEL_LABEL,
  LEVEL_OPTIONS,
  POSITION_LABEL,
  POSITION_OPTIONS,
  TARGET_OPTIONS,
  TIMEFRAMES,
  type FunnelAnswers,
  type PlayFrequency,
  type Position,
  type TimeframeDays,
} from "@/lib/funnel";
import {
  DISCIPLINE_LABEL,
  ANALYZE_DISCIPLINES,
  SKILL_LABEL,
  type Discipline,
  type Level,
  type Skill,
} from "@/lib/skills";

const STEPS = [
  "Your court",
  "Your level",
  "Your position",
  "Your reps",
  "Your focus",
  "Your target",
  "Your read",
] as const;

const DISCIPLINE_DETAIL: Record<Discipline, string> = {
  indoor: "Six a side, rotations, a roof",
  beach: "Outdoors on grass or sand, wind and sun",
  grass: "Outdoors on grass or sand, wind and sun",
};

/**
 * The registration funnel. mode="public" runs before an account exists
 * (/start): answers park in localStorage and the close hands off to /signup.
 * mode="authed" is the post-signup fallback (/welcome) for players who
 * skipped the funnel: the close submits straight to the server action.
 */
export function OnboardingFlow({
  name,
  mode = "authed",
}: {
  name: string | null;
  mode?: "public" | "authed";
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [frequency, setFrequency] = useState<PlayFrequency | null>(null);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeDays | null>(null);

  const stepMeta = (
    <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
      {STEPS[step]} · {step + 1} of {STEPS.length}
    </p>
  );

  const skipLink =
    mode === "authed" ? (
      <Link
        href="/dashboard"
        className="mx-auto mt-6 block w-fit min-h-11 py-2 text-center text-sm text-chalk-dim underline-offset-4 hover:underline"
      >
        Skip for now
      </Link>
    ) : (
      <Link
        href="/signup"
        className="mx-auto mt-6 block w-fit min-h-11 py-2 text-center text-sm text-chalk-dim underline-offset-4 hover:underline"
      >
        Skip straight to signup
      </Link>
    );

  const saveAndSignup = () => {
    if (!discipline || !level || !skill) return;
    const answers: FunnelAnswers = {
      discipline,
      level,
      position: position ?? undefined,
      play_frequency: frequency ?? undefined,
      skill,
      target_rating: target ?? undefined,
      timeframe_days: target ? (timeframe ?? 90) : undefined,
    };
    try {
      localStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // Storage unavailable: the /welcome fallback re-asks after signup.
    }
    router.push("/signup");
  };

  return (
    <section className="mx-auto max-w-xl">
      {step === 0 && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            {name ? `${name}, where` : "Where"} do you play?
          </h1>
          <p className="mt-2 text-body text-chalk-dim">
            Indoor and outdoor are scored on their own standards; your ratings
            never blend.
          </p>
          <div className="mt-6 space-y-3">
            {ANALYZE_DISCIPLINES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  if (discipline !== d) setPosition(null);
                  setDiscipline(d);
                  setStep(1);
                }}
                className={`card card-lift block w-full p-4 text-left ${
                  discipline === d ? "border-gold" : ""
                }`}
              >
                <span className="font-display font-bold">
                  {DISCIPLINE_LABEL[d]}
                </span>
                <span className="mt-1 block text-xs text-chalk-dim">
                  {DISCIPLINE_DETAIL[d]}
                </span>
              </button>
            ))}
          </div>
          {skipLink}
        </div>
      )}

      {step === 1 && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Where are you right now?
          </h1>
          <p className="mt-2 text-body text-chalk-dim">
            Honest beats impressive. This sets the standard your breakdowns
            are judged against: Pro reads like a pro coach.
          </p>
          <div className="mt-6 space-y-3">
            {LEVEL_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setLevel(o.value);
                  setStep(2);
                }}
                className={`card card-lift block w-full p-4 text-left ${
                  level === o.value ? "border-gold" : ""
                }`}
              >
                <span className="font-display font-bold">{o.label}</span>
                <span className="mt-1 block text-xs text-chalk-dim">{o.detail}</span>
              </button>
            ))}
          </div>
          <BackButton onClick={() => setStep(0)} />
          {skipLink}
        </div>
      )}

      {step === 2 && discipline && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Where do you line up?
          </h1>
          <p className="mt-2 text-body text-chalk-dim">
            The coach reads your reps through your role.
          </p>
          <div className="mt-6 space-y-3">
            {POSITION_OPTIONS[discipline].map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setPosition(o.value);
                  setStep(3);
                }}
                className={`card card-lift block w-full p-4 text-left ${
                  position === o.value ? "border-gold" : ""
                }`}
              >
                <span className="font-display font-bold">{o.label}</span>
              </button>
            ))}
          </div>
          <BackButton onClick={() => setStep(1)} />
          {skipLink}
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            How often are you on a court?
          </h1>
          <p className="mt-2 text-body text-chalk-dim">
            Fixes are paced to the reps you can actually put in.
          </p>
          <div className="mt-6 space-y-3">
            {FREQUENCY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setFrequency(o.value);
                  setStep(4);
                }}
                className={`card card-lift block w-full p-4 text-left ${
                  frequency === o.value ? "border-gold" : ""
                }`}
              >
                <span className="font-display font-bold">{o.label}</span>
                <span className="mt-1 block text-xs text-chalk-dim">{o.detail}</span>
              </button>
            ))}
          </div>
          <BackButton onClick={() => setStep(2)} />
          {skipLink}
        </div>
      )}

      {step === 4 && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1
            id="onboarding-skill"
            className="mt-2 font-display text-3xl font-bold tracking-tight"
          >
            What are you working on?
          </h1>
          <p className="mt-2 text-body text-chalk-dim">
            Pick the skill you want to fix first. The rest stay a tap away.
          </p>
          <div className="mt-6">
            <SkillPicker
              value={skill}
              onChange={(s) => {
                setSkill(s);
                setStep(5);
              }}
              labelledBy="onboarding-skill"
            />
          </div>
          <BackButton onClick={() => setStep(3)} />
          {skipLink}
        </div>
      )}

      {step === 5 && skill && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Where&rsquo;s this going?
          </h1>
          <p className="mt-2 text-body text-chalk-dim">
            Your {SKILL_LABEL[skill].toLowerCase()} rating starts at your first
            breakdown. Set where it should be, and by when, and it becomes a
            goal on your dashboard.
          </p>
          <p className="mt-2 text-xs text-chalk-dim">
            Ratings run 0 to 100 on the coaching rubric: 40 reads as
            developing, 70 as solid, 90 as advanced technique.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {TARGET_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTarget(t.value)}
                className={`card card-lift p-4 text-center ${
                  target === t.value ? "border-gold" : ""
                }`}
              >
                <span className="font-display text-2xl font-bold">{t.value}</span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-wide text-gold">
                  {t.band}
                </span>
                <span className="mt-1 block text-xs text-chalk-dim">
                  {t.detail}
                </span>
              </button>
            ))}
          </div>
          {target && (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
                By when?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TIMEFRAMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTimeframe(t);
                      setStep(6);
                    }}
                    className={`chip min-h-11 ${
                      timeframe === t ? "border-gold text-gold" : ""
                    }`}
                    aria-pressed={timeframe === t}
                  >
                    {t} days
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setTarget(null);
              setTimeframe(null);
              setStep(6);
            }}
            className="btn-ghost mx-auto mt-4 block text-sm"
          >
            I just want feedback
          </button>
          <BackButton onClick={() => setStep(4)} />
          {skipLink}
        </div>
      )}

      {step === 6 && discipline && level && skill && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Here&rsquo;s your read.
          </h1>
          <dl className="card mt-6 space-y-4 p-5">
            <EchoRow label="Court" value={DISCIPLINE_LABEL[discipline]} />
            <EchoRow label="Level" value={LEVEL_LABEL[level]} />
            {position && (
              <EchoRow label="Position" value={POSITION_LABEL[position]} />
            )}
            {frequency && (
              <EchoRow label="On court" value={FREQUENCY_LABEL[frequency]} />
            )}
            <EchoRow label="Working on" value={SKILL_LABEL[skill]} />
            <EchoRow
              label="Target"
              value={
                target
                  ? `${target} rating in ${timeframe ?? 90} days`
                  : "Feedback first"
              }
            />
          </dl>
          {mode === "authed" ? (
            <form action={completeOnboarding} className="mt-6">
              <input type="hidden" name="discipline" value={discipline} />
              <input type="hidden" name="level" value={level} />
              <input type="hidden" name="skill" value={skill} />
              {position && (
                <input type="hidden" name="position" value={position} />
              )}
              {frequency && (
                <input type="hidden" name="play_frequency" value={frequency} />
              )}
              {target && (
                <input type="hidden" name="target_rating" value={target} />
              )}
              {target && (
                <input
                  type="hidden"
                  name="timeframe_days"
                  value={timeframe ?? 90}
                />
              )}
              <button type="submit" className="btn-primary min-h-11 w-full">
                This is me · film my first rep
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={saveAndSignup}
              className="btn-primary mt-6 min-h-11 w-full"
            >
              Create my account · save this plan
            </button>
          )}
          <p className="mt-3 text-center text-xs text-chalk-dim">
            Your first breakdown is free. No card.
          </p>
          <BackButton onClick={() => setStep(5)} />
        </div>
      )}
    </section>
  );
}

function EchoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-mono text-xs uppercase tracking-[0.16em] text-chalk-dim">
        {label}
      </dt>
      <dd className="font-display font-bold">{value}</dd>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-ghost mx-auto mt-6 block text-sm"
    >
      Back
    </button>
  );
}
