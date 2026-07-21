# Handoff — sideout

_Last updated 2026-07-21. Persistent in-repo project handoff; rewritten each
session. Older session-log entries (pre-D-027) live in
`archive/handoff-history.md`. The authoritative account of the current system is
`docs/decisions.md` D-027 onward._

## Goal
Sideout - volleyball skill-analysis and coaching web app. Next.js 16 (App Router,
React 19), Supabase (auth + Postgres 17, RLS on every table), the coaching service
(a vision model) server-side. Deployed on Vercel; a push to `master` auto-deploys
production. Live at https://sideout-jet.vercel.app.

## State (post-D-033: the model does the whole read)

- **No on-device ML.** D-033 removed the entire on-device pose engine after two
  blind kill gates on the owner's own footage: the measured-checkpoint arm lost
  13-0 to plain vision and produced 34% physically-impossible values above the
  honesty floor, and the tracker rang the wrong player 43% of the time versus the
  model's 97.4%. The coaching service now does assessment and cross-frame subject
  tracking by looking at the frames.
- **Subject marking** (D-030, D-036). The user taps their athlete, or picks from
  coach-spotted candidates (`app/api/players`: one frame returns up to six
  kit-and-position descriptions with torso points, numbered on the frame). The
  pick is a raw normalized coordinate; `injectMarkTime` guarantees a sent frame at
  that instant; `burnMark` draws a hollow gold ring client-side; `marker_frame_index`
  binds the ringed athlete across every frame; `subject_check` reports
  confirmed / mismatch / unmarked. Scrubbing >250ms from a mark clears it. The
  analyze-without-marking path stays one level down, never a dead end.
- **Scoring is a pointer checklist** (D-039, D-040, D-037, D-038). `lib/ai/pointers.ts`
  holds 120 cues (4 pointers x 5 checkpoints x 6 skills), each judged
  met | partial | missed | not_visible. The number is derived in code
  (fraction of met over visible pointers, raw band 30..95), with no display curve
  (D-040) and one scoring standard for every account (D-037). A checkpoint whose
  mechanics were never visible is excluded from the overall, not counted against
  the athlete (D-038). Unknown or invented statuses degrade to not_visible, which
  can never manufacture a score. The results page renders the full checklist under
  each bar (met gold, partial faded, missed coral, not-visible hollow).
- **Frame coverage is uniform and dense** (D-041). Extraction covers the whole
  trim window at up to 6fps, capped MAX_FRAMES=40, at 1024px to fit the 4MB body.
  Motion-guided sampling is deleted; the dense send set is the record. The tap
  instant still gets an exact frame.
- **Coach voice** (D-035). One shared coach voice fronts every rubric; disciplines
  resolve to indoor or outdoor (grass and sand judged together, `grass` the stored
  value, `beach` legacy). Player level shapes voice and expected gains only.
- **Model config** (D-027, D-004). The coaching read runs at opus-low effort; coach
  chat at sonnet-medium. Roughly 30k input tokens and ~$0.15-0.20 per full-window
  analysis - **derived, not yet measured live** (Phase 2 telemetry will measure it).
- **PRODUCTION IS DOWN.** The account API key hit its **monthly spend cap** on
  2026-07-20 ("regain access 2026-08-01 00:00 UTC"). The same key serves local
  validation and production, so live analyze/coach calls 502 until the owner raises
  the monthly usage limit in the provider billing console (owner-only). This blocks
  every live-run validation this session, including telemetry and the eval baseline.
- **Security** is live and is authored by `docs/security.md`: atomic per-endpoint
  quotas, entitlement reservations, least-privilege grants, bounded uploads;
  migrations 011-013 applied. Read/update its matrices with any surface change.
- **Git**: branch `feat/pinpoint-motion`. Push to `master` auto-deploys.
- **Repo hygiene (2026-07-21, this session)**: benchmark artifacts and retired docs
  moved to `archive/`, eval footage out of `public/`, docs pruned to a living set,
  `README.md` and this file rewritten to current reality (D-042).

## Standing rules
`AGENTS.md` + `docs/security.md` + `docs/decisions.md` D-001 bind every change. No
attribution trailers; no vendor names in UI/docs (the AI layer is "the coaching
service", the only vendor string is the `ANTHROPIC_API_KEY` env var); design tokens
locked in `app/globals.css @theme`; middleware is `proxy.ts`; dependency budget
gated by the 10.5 viability gate. Every route handler and server action
authenticates and authorizes inside itself; cookie-authenticated mutations also
same-origin-check; paid calls consume an atomic quota first. TDD where behavior
changes (watch the test fail first). Gates before any commit: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, all green. Decisions of
consequence get numbered entries in `docs/decisions.md`.

## Open items needing the owner
1. **Raise the API monthly spend cap** - production is down until then. Ideally
   split a production key from an experiments key, with per-key spend limits and a
   spend alert.
2. **Rotate the briefly-exposed Supabase credentials** (`SUPABASE_JWT_SECRET` and
   siblings were removed from prod env but never rotated).
3. **Resolve the likeness gate** on `public/film-court.webp` (D-022): consent, swap
   to the synthetic plate, or accept knowingly. Record the choice in `docs/decisions.md`.
4. **Supabase->GitHub deploy integration looks misconfigured** (a Windows absolute
   path where a repo-relative one belongs); may re-apply old migrations if it starts.
5. **Counsel skim of `/privacy` and `/terms`** before any marketing push.
6. **Eval labeling** (see `evals/LABELING.md`): label all 18 active cases, source
   intermediate/expert footage, then run a scored baseline and stability check.

## Device-verification checklist (current flow)
Nothing in the post-D-033 flow has been eyeballed in a browser. Once the API cap is
raised, the owner runs one clip end to end on a real phone against production and
marks each item pass/fail with a date (commit as
`archive/receipts/device-verify-YYYY-MM-DD.md`):
1. Framing card opens on upload; scrubbing shows coach-spotted candidates as a
   numbered list with dots (D-036), or a direct tap works.
2. Tap-and-ring: the pick burns a hollow gold ring on the frame; scrubbing >250ms
   away clears a stale mark.
3. Analyze runs dense uniform coverage over the trim window with visible progress
   and completes inside `maxDuration`.
4. Results render the pointer checklist under each metric bar with correct colors
   (met gold, partial faded, missed coral, not-visible hollow) and cue text.
5. Unobserved checkpoints show "Not visible" with a dashed track and are excluded
   from the overall.
6. The `subject_check` line reads confirmed / mismatch / unmarked correctly for the
   ringed athlete.
7. The number is blunt and uncurved; notes name faults by pointer without softening.

## Next step
Ship this session's Phase 1 foundation commit (repo truth), then the Phase 2
degraded-service + telemetry commit. The single highest-leverage owner action is
**raising the API spend cap** so production works and the eval baseline and live
telemetry can run.

## Session log
- **2026-07-21 (Session 1 foundation)** - Repo made to tell the truth. Located the
  live repo (`G:\OneDrive\Documents\Projects\sideout`; two stale copies exist on
  disk). Moved ~90 MB of benchmark artifacts and retired docs into `archive/`
  (heavy footage-laden outputs untracked and gitignored, the small reproducible
  methodology kept tracked in `scripts/benchmark/`, D-042); confirmed no
  git-tracked artifact exceeds 10 MB (no history bloat). Moved eval footage out of
  `public/` into `evals/footage/` (gitignored). Pruned `docs/` to a living set,
  folded frontend+motion+tooling into one `docs/frontend.md` and validation-plan
  into the roadmap, wrote `docs/README.md` and `archive/README.md`, rewrote
  `README.md` and this file to the post-D-033 world. Then Phase 2 degraded-service
  handling + analyze telemetry, Phase 3 eval labeling path. Gates green per commit.
- **2026-07-20 (architecture arc, D-027 -> D-041)** - See `docs/decisions.md`. In
  order: reasoning effort pinned per tier (D-027); pose engine swapped to a
  shippable licence then removed entirely after two blind kill gates (D-028, D-033);
  free tier now with billing documented as future (D-029); mandatory subject choice
  with model accountability (D-030); eval harness stopped reporting agreement it had
  not earned (D-031); score calibration curve, then one coach voice, mechanics-only,
  one standard, unobserved-excluded, pointer checklist, all hedges removed, dense
  uniform coverage (D-034 -> D-041). Production hit its monthly API spend cap
  mid-validation of D-041.
