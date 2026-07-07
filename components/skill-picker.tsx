"use client";

import { SKILLS, SKILL_LABEL, SKILL_BLURB, type Skill } from "@/lib/skills";

export function SkillPicker({
  value,
  onChange,
}: {
  value: Skill | null;
  onChange: (skill: Skill) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {SKILLS.map((skill) => {
        const active = value === skill;
        return (
          <button
            key={skill}
            type="button"
            onClick={() => onChange(skill)}
            className={`rounded-lg border p-4 text-left transition ${
              active
                ? "border-gold bg-gold/10"
                : "border-line bg-navy-light hover:border-gold/50"
            }`}
          >
            <div className="font-display font-bold">{SKILL_LABEL[skill]}</div>
            <div className="mt-1 text-xs text-chalk-dim">{SKILL_BLURB[skill]}</div>
          </button>
        );
      })}
    </div>
  );
}
