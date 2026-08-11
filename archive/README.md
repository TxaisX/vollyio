# archive/

Historical material kept on disk for reference, not part of the living repo. The
current system is described only by `docs/decisions.md` (D-027 onward), `README.md`,
and `HANDOFF.md`. Everything here predates or documents something that has since
been deleted or superseded.

Tracking: retired text docs and small report cards were moved here with `git mv`
and stay tracked (history preserved, still greppable). Heavy regenerable outputs
and footage frames are untracked and gitignored (see `.gitignore`); the
methodology that reproduces them lives in `scripts/benchmark/`.

**ARCHIVED TESTS MUST BE RENAMED OFF NODE'S DISCOVERY PATTERNS, AND
`lib/archive-hygiene.test.ts` ENFORCES IT.** `tsconfig.json` excludes this
folder, so archived code is not typechecked, and that is easy to mistake for
"archive/ is out of the build". It is not out of the TEST run: `npm test` is a
bare `node --test` whose default discovery walks the whole repository, here
included.

Moving `owner-alert.test.ts` in on 2026-08-11 left all 17 of its tests running
against a module no request could reach, and **the suite total did not move**,
632 before and 632 after, which is exactly how it goes unnoticed. A green suite
that is green about deleted code is worse than a red one, because it reads as
coverage.

Node 24 has no `--test-exclude`, and narrowing the script to explicit globs would
silently drop any future directory nobody remembered to list, which is the worse
failure because nothing reports it at all. So the rule is the rename:
`owner-alert.test.ts` became `owner-alert.tests-archived.ts`, still a readable
`.ts` file and no longer a collected test. Suite went 632 to 615.

A rule in a README is enforced by whoever remembers to read it, which is the same
kind of guarantee that just failed, so it is now a test. `lib/archive-hygiene.test.ts`
walks this folder against every one of node's default patterns (`*.test.*`,
`*-test.*`, `*_test.*`, `test.*`, `test-*.*`, and any `test/` or `__tests__/`
directory), fails with the offending paths and the fix, and pins the pattern list
itself so a transcription error cannot pass silently.

## Subfolders

- **2026-07-model-benchmarks/** - The two 2026-07-20 model-and-effort studies: the
  GPT-family attacker report (`sideout-attacker-model-effort-report.html`, ~18 MB,
  frames inlined) and the Anthropic-family cost ladder (`model-effort-cost-ladder.html`),
  plus their raw frames, run-output JSON, judging, `ab/` summaries, and build scratch.
  Evidence cited by **D-027** (reasoning-effort choice) and the A/B kill gates behind
  **D-033**. Untracked and heavy; regenerate from `scripts/benchmark/`.
- **docs-history/** - Retired docs describing deleted systems or finished one-time
  efforts: `pose-model-selection.md`, `cv-phase1-spec.*`, `ORCHESTRATION_STATE.md`,
  `ledger.md`, `reportcards.md`, `acceptance.md`, `quality-floor.md`, `qa.md`,
  `qa-learn-eval.md`, `animation-library-pool.md`, `pro-technique-study.html`, two
  report-card HTMLs, and the `superpowers/` plans. The on-device pose engine they
  describe was removed in **D-033**. Also `vollyio-breakdown.md`, a full repo
  read written 2026-07-21 and moved here by **D-078**: it was accurate when
  written and is now wrong in ways that matter (40 frames at 6fps against the
  current 64, "billing is deliberately inert" against a live subscription, a
  decision log stopping at D-041). Kept because a dated snapshot of how the
  system was understood is worth more than a deleted one, and harmful only if
  read as current.
- **reports/** - Historical HTML report cards and next-steps notes
  (`agent-setup-report-card.html`, `pose-engine-investigation-report.html`,
  `sideout-next-steps.html`). The pose-engine investigation is background to **D-033**.
- **orchestration/** - The old `sideout-perfection-orchestration-prompt.md`,
  superseded by the road-to-100 playbook, and `vollyio-improvement-prompt.md`, a
  one-off session prompt moved here by **D-078**. The latter pins its reader to
  "D-027 through D-041 is the ONLY accurate description of the current system",
  which was true when written and is now 36 decisions out of date, so running it
  as written would brief an agent on a system that no longer exists.
- **scoreboard-d088/** - The match-tracker UI removed by **D-088** on 2026-08-03:
  `scoreboard/page.tsx`, its `actions.ts` and `loading.tsx`, `components/scoreboard.tsx`,
  and a stray `goals-loading.tsx`. It sat in a `_to_delete/` folder at the repo root
  until 2026-08-05, where it broke `next build` and put two permanent errors in every
  typecheck run, because the root is inside `tsconfig.json`'s `include` and `archive/`
  is not. Moved here rather than deleted: the `games` table and its rows still exist
  (see `docs/security.md`), so the code that wrote them is worth being able to read.
- **owner-alert-d102/** - `lib/owner-alert.ts` and its 17 tests, moved 2026-08-11.
  It emailed the owner when the platform spend backstop tripped, and **D-104
  deleted the backstop** (`lib/ai/budget.ts`, 2026-08-06) without deleting this,
  so from that day it was a module nothing called and a test file exercising code
  no request could reach. `docs/deploy.md` recorded it as "pending an
  owner-approved cleanup"; this is that cleanup. Kept rather than deleted for one
  reason: if a credits-exhausted alert is ever built, the interval claim, the
  failed-send backdate, and the comment explaining why an un-unref'd timer is the
  correct choice are all worked out here, together with the honest note that a
  process-memory claim bounds mail per INSTANCE rather than per trip. What it
  does NOT tell you, and what matters more: **nothing warns the owner about
  spend today.**
- **misc/** - One-off scratch (`.mcp.json.bak`, an old restart note).
- **handoff-history.md** - Session-log entries from before D-027, moved out of
  `HANDOFF.md` when it was rewritten to the current system on 2026-07-20.
