"use client";

import { SKILLS, SKILL_LABEL, SKILL_BLURB, type Skill } from "@/lib/skills";
import { SkillIcon } from "@/components/skill-icons";

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
            aria-pressed={active}
            className={`card card-lift cursor-pointer p-4 text-left ${
              active ? "border-gold bg-gold/10" : ""
            }`}
          >
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
