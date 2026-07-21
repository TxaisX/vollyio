# archive/

Historical material kept on disk for reference, not part of the living repo. The
current system is described only by `docs/decisions.md` (D-027 onward), `README.md`,
and `HANDOFF.md`. Everything here predates or documents something that has since
been deleted or superseded.

Tracking: retired text docs and small report cards were moved here with `git mv`
and stay tracked (history preserved, still greppable). Heavy regenerable outputs
and footage frames are untracked and gitignored (see `.gitignore`); the
methodology that reproduces them lives in `scripts/benchmark/`.

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
  describe was removed in **D-033**.
- **reports/** - Historical HTML report cards and next-steps notes
  (`agent-setup-report-card.html`, `pose-engine-investigation-report.html`,
  `sideout-next-steps.html`). The pose-engine investigation is background to **D-033**.
- **orchestration/** - The old `sideout-perfection-orchestration-prompt.md`,
  superseded by the road-to-100 playbook.
- **misc/** - One-off scratch (`.mcp.json.bak`, an old restart note).
- **handoff-history.md** - Session-log entries from before D-027, moved out of
  `HANDOFF.md` when it was rewritten to the current system on 2026-07-20.
