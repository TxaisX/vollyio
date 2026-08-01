# docs/

The living documentation set. Each file is authoritative for one thing. When a
file here and a memory or an older note disagree, this set wins. History that
describes deleted or superseded systems lives in `../archive/`, not here.

- **decisions.md** - The decision log (D-001 onward). The single accurate account
  of how the current system works; read D-027 onward for today's architecture.
- **security.md** - The authority on who may call each operation. Update its
  endpoint, database, and storage matrices in the same change as any route, action,
  table, policy, role, or paid-call change.
- **backend.md** - Data, state, and platform layer (Supabase schema, auth, storage).
- **deploy.md** - Deploy and CI: how a push reaches production and the gates that guard it.
- **frontend.md** - How to build UI correctly: design tokens, shared component
  classes, motion discipline, the dependency gate, and the local commands.
- **copy.md** - Product voice and the rules for user-facing text.
- **assets.md** - The asset register (images, films) and their likeness status.
- **metadata.md** - Route metadata, sitemap, and SEO conventions.
- **billing.md** - Plans, allowances, and the paid path (built and LIVE, D-078).
- **billing-runbook.md** - Operator runbook for the provider dashboard.
- **plan-matrix.md** - What each plan includes, mirrored by `lib/entitlement-features.ts`.
- **stripe-account-setup.md** - How the provider account objects were created.
- **ui.md** - The UI structure standard (routes, surfaces, layout patterns).
- **legal-review.md** - The privacy/terms review notes awaiting counsel.
- **post-cap-validation.md** - The runbook executed after the 2026-07-22 spend-cap raise.
- **analysis-validation-roadmap.md** - The analysis-quality validation plan, eval
  release gates, and the go-to-market validation strategy. Partially superseded by
  D-033 (its measurement-layer sections are void); its eval gates and strategy stand.
- **vollyio-commercialization.html** - The original paid-tier plan referenced by
  D-029 (historical input to what shipped; billing.md is the authority now).

Operational status is in the repo root: `README.md` (what Vollyio is) and
`HANDOFF.md` (current state and next step).
