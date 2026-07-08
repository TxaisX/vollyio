"use client";

import { useRef } from "react";
import { SKILLS, SKILL_LABEL, SKILL_BLURB, type Skill } from "@/lib/skills";
import { SkillIcon } from "@/components/skill-icons";

export function SkillPicker({
  value,
  onChange,
  labelledBy,
}: {
  value: Skill | null;
  onChange: (skill: Skill) => void;
  labelledBy?: string;
}) {
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Exactly one option owns the tab stop (roving tabindex): the selected one,
  // or the first option when nothing is selected yet.
  const activeIndex = value ? SKILLS.indexOf(value) : 0;

  function move(index: number) {
    const next = (index + SKILLS.length) % SKILLS.length;
    onChange(SKILLS[next]);
    optionsRef.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(index - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(SKILLS.length - 1);
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Pick a skill"}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {SKILLS.map((skill, i) => {
        const active = value === skill;
        return (
          <button
            key={skill}
            ref={(el) => {
              optionsRef.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => onChange(skill)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`card card-lift relative cursor-pointer p-4 text-left ${
              active ? "border-gold bg-gold/10" : ""
            }`}
          >
            {active && (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute right-3 top-3 h-4 w-4 text-gold"
                aria-hidden="true"
              >
                <path d="M3 8.5l3.5 3.5L13 5" />
              </svg>
            )}
            <div className="flex items-center gap-2">
              <span className={active ? "text-gold" : "text-chalk-dim"}>
                <SkillIcon skill={skill} className="h-5 w-5" />
              </span>
              <span className="font-display font-bold">{SKILL_LABEL[skill]}</span>
            </div>
            <div className="mt-2 text-xs leading-relaxed text-chalk-dim">
              {SKILL_BLURB[skill]}
            </div>
          </button>
        );
      })}
    </div>
  );
}
