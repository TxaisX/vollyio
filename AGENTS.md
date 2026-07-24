<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vollyio conventions

- Commit messages carry no attribution trailers of any kind (no Co-Authored-By, no generated-with lines).
- No vendor names in UI, docs, or user-visible errors. The AI layer is referred to as "the coaching service"; the only vendor-named string in the repo is the `ANTHROPIC_API_KEY` env var, server-side only.
- Design tokens live in `app/globals.css` `@theme` (navy/chalk/gold/teal; Space Grotesk display, Instrument Sans body, IBM Plex Mono labels) — never introduce new colors or fonts. Shared component classes (`card`, `btn-primary`, `btn-ghost`, `chip`, `input-field`, `spot`, `reveal`, `text-sheen`) live there too — reuse them, don't reinvent per page.
- Motion: hand-rolled primitives (`components/motion.tsx` Reveal/CountUp, `components/cursor-glow.tsx`) and shipped ambient/reveal durations stay. New keyframes, easing, longer motion, and a third-party animation/motion library are allowed under the section 10.2 discipline (see `docs/decisions.md` D-001): `prefers-reduced-motion` always wins via a JS `matchMedia` self-guard that settles at the end state, no layout shift/jank, Lighthouse perf stays >=90 on landing + dashboard, any library is tree-shaken with cost justified in the Decision Log, and motion never conveys state alone. 150-300ms on `--ease-court` remains the default for ordinary interaction transitions. Absent a section 10 grant, the default is still no.
- Middleware is `proxy.ts` in Next 16, not `middleware.ts`.
- Dependency budget stays deliberately small but is now gated, not closed (see `docs/decisions.md` D-001): an animation/motion library (10.2) and added MCP servers (10.5) are allowed once they clear the 10.5 viability gate (publisher/provenance, exact scopes, security + least privilege, necessity, licensing, pinned version) plus a Decision Log entry. Chart, state-management, and service-worker libraries remain out unless they clear that same gate; the service worker stays hand-rolled (`components/pwa-register.tsx` + `public/sw.js`).
- Security authority is `docs/security.md`. Read and update its access-control matrices whenever changing a route handler, server action, table, storage policy, role, or paid external call.
- Treat every route handler and server action as directly callable. Authenticate and authorize inside it; cookie-authenticated mutation routes also require a same-origin check.
- Paid or high-amplification work consumes an atomic quota before the external call. Read-then-count queries are not rate limits.
- Exposed tables require explicit grants plus ownership RLS. Player-editable metadata never decides authorization or billing entitlement.
- Secrets remain server-only. Uploads stay private and must constrain owner, analysis path, fixed filename, MIME type, and object size.
