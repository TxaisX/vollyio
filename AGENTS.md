<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Sideout conventions

- Commit messages carry no attribution trailers of any kind (no Co-Authored-By, no generated-with lines).
- No vendor names in UI, docs, or user-visible errors. The AI layer is referred to as "the coaching service"; the only vendor-named string in the repo is the `ANTHROPIC_API_KEY` env var, server-side only.
- Design tokens live in `app/globals.css` `@theme` (navy/chalk/gold/teal) — never introduce new colors or fonts.
- Middleware is `proxy.ts` in Next 16, not `middleware.ts`.
- Dependency budget is deliberately small; do not add chart, state, or SW libraries.
