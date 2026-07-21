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
- **analysis-validation-roadmap.md** - The analysis-quality validation plan, eval
  release gates, and the go-to-market validation strategy. Partially superseded by
  D-033 (its measurement-layer sections are void); its eval gates and strategy stand.
- **sideout-commercialization.md/html** - The paid-tier plan referenced by D-029
  (kept as a future reference; billing is not built).

Operational status is in the repo root: `README.md` (what Sideout is) and
`HANDOFF.md` (current state and next step).
