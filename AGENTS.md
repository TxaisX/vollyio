<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Sideout conventions

- Commit messages carry no attribution trailers of any kind (no Co-Authored-By, no generated-with lines).
- No vendor names in UI, docs, or user-visible errors. The AI layer is referred to as "the coaching service"; the only vendor-named string in the repo is the `ANTHROPIC_API_KEY` env var, server-side only.
- Design tokens live in `app/globals.css` `@theme` (navy/chalk/gold/teal; Space Grotesk display, Instrument Sans body, IBM Plex Mono labels) — never introduce new colors or fonts. Shared component classes (`card`, `btn-primary`, `btn-ghost`, `chip`, `input-field`, `spot`, `reveal`, `text-sheen`) live there too — reuse them, don't reinvent per page.
- Motion: hand-rolled only (`components/motion.tsx` Reveal/CountUp, `components/cursor-glow.tsx`), 150-300ms, `--ease-court`, `prefers-reduced-motion` always respected. No animation libraries.
- Middleware is `proxy.ts` in Next 16, not `middleware.ts`.
- Dependency budget is deliberately small; do not add chart, state, or SW libraries.
