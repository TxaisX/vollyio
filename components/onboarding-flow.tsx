"use client";

import { useState } from "react";
import Link from "next/link";
import { SkillPicker } from "@/components/skill-picker";
import { completeOnboarding } from "@/app/(app)/welcome/actions";
import { SKILL_LABEL, type Level, type Skill } from "@/lib/skills";

const LEVEL_OPTIONS: { value: Level; label: string; detail: string }[] = [
  { value: "beginner", label: "New to the game", detail: "Learning the basics, building touches" },
  { value: "intermediate", label: "Club or school player", detail: "Solid fundamentals, inconsistent under pressure" },
  { value: "advanced", label: "Competitive player", detail: "Refining details, chasing consistency" },
  { value: "elite", label: "High level", detail: "Small edges decide your matches" },
];

const LEVEL_LABEL: Record<Level, string> = {
  beginner: "New to the game",
  intermediate: "Club or school player",
  advanced: "Competitive player",
  elite: "High level",
};

const TARGET_OPTIONS = [60, 70, 80, 90];

const STEPS = ["Your level", "Your focus", "Your target", "Your read"] as const;

export function OnboardingFlow({ name }: { name: string | null }) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<Level | null>(null);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [target, setTarget] = useState<number | null>(null);

  const stepMeta = (
    <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
      {STEPS[step]} · {step + 1} of {STEPS.length}
    </p>
  );

  const skipLink = (
    <Link
      href="/dashboard"
      className="mx-auto mt-6 block w-fit min-h-11 py-2 text-center text-sm text-chalk-dim underline-offset-4 hover:underline"
    >
      Skip for now
    </Link>
  );

  return (
    <section className="mx-auto max-w-xl">
      {step === 0 && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            {name ? `${name}, where` : "Where"} are you right now?
          </h1>
          <p className="mt-2 text-sm text-chalk-dim">
            Honest beats impressive. This sets how your breakdowns are written.
          </p>
          <div className="mt-6 space-y-3">
            {LEVEL_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setLevel(o.value);
                  setStep(1);
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
          {skipLink}
        </div>
      )}

      {step === 1 && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1
            id="onboarding-skill"
            className="mt-2 font-display text-3xl font-bold tracking-tight"
          >
            What are you working on?
          </h1>
          <p className="mt-2 text-sm text-chalk-dim">
            Pick the skill you want to fix first. The rest stay a tap away.
          </p>
          <div className="mt-6">
            <SkillPicker
              value={skill}
              onChange={(s) => {
                setSkill(s);
                setStep(2);
              }}
              labelledBy="onboarding-skill"
            />
          </div>
          <BackButton onClick={() => setStep(0)} />
          {skipLink}
        </div>
      )}

      {step === 2 && skill && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Where&rsquo;s this going?
          </h1>
          <p className="mt-2 text-sm text-chalk-dim">
            Your {SKILL_LABEL[skill].toLowerCase()} rating starts at your first
            breakdown. Set where it should be in 90 days and it becomes a goal
            on your dashboard.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {TARGET_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTarget(t);
                  setStep(3);
                }}
                className={`card card-lift p-4 text-center ${
                  target === t ? "border-gold" : ""
                }`}
              >
                <span className="font-display text-2xl font-bold">{t}</span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
                  rating
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setTarget(null);
              setStep(3);
            }}
            className="btn-ghost mx-auto mt-4 block text-sm"
          >
            I just want feedback
          </button>
          <BackButton onClick={() => setStep(1)} />
          {skipLink}
        </div>
      )}

      {step === 3 && level && skill && (
        <div className="animate-fade-up">
          {stepMeta}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Here&rsquo;s your read.
          </h1>
          <dl className="card mt-6 space-y-4 p-5">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-xs uppercase tracking-[0.16em] text-chalk-dim">
                Level
              </dt>
              <dd className="font-display font-bold">{LEVEL_LABEL[level]}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-xs uppercase tracking-[0.16em] text-chalk-dim">
                Working on
              </dt>
              <dd className="font-display font-bold">{SKILL_LABEL[skill]}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-xs uppercase tracking-[0.16em] text-chalk-dim">
                90-day target
              </dt>
              <dd className="font-display font-bold">
                {target ? `${target} rating` : "Feedback first"}
              </dd>
            </div>
          </dl>
          <form action={completeOnboarding} className="mt-6">
            <input type="hidden" name="level" value={level} />
            <input type="hidden" name="skill" value={skill} />
            {target && <input type="hidden" name="target_rating" value={target} />}
            <button type="submit" className="btn-primary min-h-11 w-full">
              This is me · film my first rep
            </button>
          </form>
          <p className="mt-3 text-center text-xs text-chalk-dim">
            Your first breakdown is free. No card.
          </p>
          <BackButton onClick={() => setStep(2)} />
        </div>
      )}
    </section>
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
