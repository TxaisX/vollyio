# Checked-in agent skills

Skills committed here load automatically in every Claude session on this
repo — cloud, desktop, and terminal — and become invokable as
`/<folder-name>`.

## Layout

```
.claude/skills/
└── <skill-name>/
    └── SKILL.md      # required: the skill's instructions
        (plus any reference files the skill ships with)
```

## Installing a skill

- From your machine, at the repo root: `npx skills add <owner>/<repo>`
  (skills.sh CLI), then commit the new folder here.
- Or paste/upload a skill folder into this directory in any session and
  ask the agent to commit it.

Note for cloud sessions: skills.sh is not reachable from the managed
environment's network policy, so installs happen from a local machine or
by handing the agent the skill's exact GitHub `owner/repo` and asking it
to add the repo to the session.

## House rules

Skills advise; the repo's constitution decides. Any skill-driven change
still goes through `AGENTS.md` and `docs/decisions.md` (D-001): locked
design tokens (no new colors or fonts), the gated dependency budget
(10.5 viability gate + Decision Log entry), and the motion discipline
(10.2: reduced-motion always wins, transform/opacity, 150-300ms on
--ease-court, Lighthouse >= 90). A skill suggesting something those rules
forbid gets the D-016 treatment: adopt the craft, decline the violation,
record the reasoning.
