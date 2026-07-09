# QA — post-mission surfaces: `/learn` and `/api/eval`

Adversarial audit + fix loop for the two surfaces that were merged from a parallel `master` stream (knowledge-core/Learn, eval harness) and never went through the perfection mission. Audited against the same bar as `docs/qa.md` / `docs/quality-floor.md` / `docs/acceptance.md`, then fixed and re-verified. Date: 2026-07-08.

Bar recap (the rules these surfaces were graded on): token purity (10 colors / 3 fonts only), no vendor names in user-visible strings, no silent fetch-error masking, per-route loading skeletons, ≥44px touch targets, aria labeling + reduced-motion, second-person voice with no em dashes (middot ·), and every route sets its own title.

## Learn surface — 5 majors + 2 minors, all cleared

| ID | Sev | Rule | Where | Resolution |
|---|---|---|---|---|
| L1 | major | No user-facing em dashes | `learn/page.tsx:35` (1) + `content/technique.ts` (43, rendered as the route's primary prose) | `page.tsx` copy rephrased with a colon; all 43 em dashes in `technique.ts` swept to middots / restructured sentences. Zero `—` remain on the route. |
| L2 | major | Every route sets its own title; dynamic shareable routes implement `generateMetadata` | `learn/page.tsx`, `learn/[skill]/page.tsx` (neither set a title) | Added `export const metadata` (title "Learn") to the index and `generateMetadata` (skill label + overview description + OG) to `[skill]`, mirroring `drills/[slug]`. |
| L3 | major | Bad slug renders a token/voice not-found, not the framework 404 | `learn/[skill]` called `notFound()` with no boundary | Added `app/(app)/learn/[skill]/not-found.tsx` in brand voice with a recovery link, mirroring `drills/[slug]/not-found.tsx`. |
| L4 | major | List/detail routes each get a matching loading skeleton | No `learn/loading.tsx`; both routes render dynamically and fell back to the generic 4-card grid | Added `learn/loading.tsx` (2-col index skeleton) and `learn/[skill]/loading.tsx` (single-column article skeleton), both `.skeleton` + `vt-reveal-out`. |
| L5 | major | ≥44px touch targets (= Phase-2 D4) | Discipline chips `learn/page.tsx:44`, `learn/[skill]/page.tsx:83` (~30px) | Added `min-h-11` to both chip class strings. |
| L6 | minor | ≥44px touch targets | "Drills that fix this" chips `learn/[skill]/page.tsx:176` | Added `min-h-11`. |
| L7 | minor | ≥44px touch targets | Back-to-Learn link `learn/[skill]/page.tsx:50-67` (~16px hit area) | Added `min-h-11` to the inline-flex link. |

Learn already passed on: token purity, shared-class reuse, reduced motion (CSS `Reveal` only), no-color-alone active state (`aria-current`), decorative-icon handling (`focusable="false"` + `aria-hidden`), and no vendor names.

## Eval surface — 1 major + 4 minors

`/api/eval` is a **dev-only** harness (returns 404 when `NODE_ENV === "production"`), so its blast radius is limited, but it carried one correctness major plus consistency minors.

| ID | Sev | Rule | Where | Resolution |
|---|---|---|---|---|
| E1 | major | Harness must replay the SAME scoring path as `/api/analyze` (its stated purpose) | `eval/route.ts` sent only `[getRubric]` (dropped `outputSpec`) and hardcoded `level: intermediate` | System array now `[getRubric, outputSpec(skill, level)]` identical to analyze; added a validated `level` field to `EvalCase` (default "intermediate") threaded into the user text. The harness now measures the shipped prompt. |
| E2 | minor | CS-7 backoff on every coaching-service call | `parse()` had no options arg (SDK default only) | Pass `{ maxRetries: 4 }` to match `/api/analyze`. |
| E3 | minor | No vendor/model name in surfaced strings; error-masking discipline | `route.ts:166` echoed the raw SDK `e.message` into JSON | Replaced with a fixed `"run failed"` string + `console.error(e)` server-side. |
| E5 | minor | Citation validation completeness | `frameIndices` omitted `raw.ball_track[*].frame_index`, so an out-of-range ball-track index passed `citations_valid` | Ball-track indices now included in the validated set. |
| E4 | minor (accepted) | Unlisted dev routes excluded from the prod build | Route is compiled into prod, gated only at runtime (404) | **Accepted as an intentional runtime-gated dev tool** — not publicly reachable (404 in production) and requires `ANTHROPIC_API_KEY`. Documented here rather than excluded from the build. |

## Post-fix verdict

| Surface | Before | After |
|---|---|---|
| `/learn` | FAIL (L1, L2, L4, L5) | **PASS** |
| `/learn/[skill]` | FAIL (L1, L2, L3, L4, L5, L6, L7) | **PASS** |
| `content/technique.ts` (rendered) | FAIL (L1) | **PASS** — zero em dashes |
| `/api/eval` | FAIL (E1 + minors) | **PASS** — E1–E3, E5 fixed; E4 accepted + documented |

## Gate note
All three machine gates were green before these fixes (the defects were quality-floor/semantic, not compile errors) and are re-verified green after: `tsc --noEmit` clean, `node --test`, and `next build`. New files (`learn/loading.tsx`, `learn/[skill]/loading.tsx`, `learn/[skill]/not-found.tsx`) build as standard segment boundaries.

## Files touched
- `app/(app)/learn/page.tsx` — metadata, copy, chip target
- `app/(app)/learn/[skill]/page.tsx` — generateMetadata, chip + drill-chip + back-link targets
- `app/(app)/learn/loading.tsx`, `app/(app)/learn/[skill]/loading.tsx`, `app/(app)/learn/[skill]/not-found.tsx` — new boundaries
- `content/technique.ts` — em-dash sweep
- `app/api/eval/route.ts` — fidelity, retries, error masking, citation set
