# Animation library pool

Reviewed 2026-07-16. This is a source shortlist, not a standing permission to
add runtime dependencies. A candidate moves into `package.json` only when a
named product interaction needs it and clears the section 10.5 gate in
`docs/decisions.md`.

The transcript's names normalize to Lenis, GSAP, Vanta, and React Bits.

## Intake result

| Candidate | Current source | Status | Sideout use |
|---|---|---|---|
| GSAP | `gsap@3.15.0`, official npm package, zero dependencies, standard no-charge license | Primary runtime candidate | Admit only for a concrete multi-element timeline, SVG path/morph, or scroll sequence that the existing CSS and `components/motion.tsx` primitives cannot express cleanly. |
| React Bits | Official component registry and GitHub source, MIT + Commons Clause | Approved source catalog | Pull one component at a time. Preserve the required copyright and license notice, audit its transitive dependencies, copy only the TypeScript/Tailwind variant, replace every color and type choice with Sideout tokens, and add Sideout's reduced-motion end state before it lands. |
| Lenis | `lenis@1.3.25`, official npm package, MIT, zero dependencies | Hold | Reconsider only for a specified velocity-driven or synchronized scroll experience. Native scroll remains the default because Sideout relies on anchors, fixed navigation, nested scrollers, touch, and accessibility behavior. |
| Vanta | `vanta@0.5.24`, official npm package, MIT | Rejected | It requires a Three.js or p5.js WebGL runtime for decorative backgrounds. D-016 and D-017 already reject that cost while the court films carry the product story. The npm release was last modified in 2022. |

## Adoption rules

1. Start with a motion brief that names the user action, attention target, and
   static end state.
2. Reuse `Reveal`, `CountUp`, view transitions, CSS scroll progress, reward
   motion, and `Tilt` before adding source or a dependency.
3. Pin an admitted package exactly. Do not use caret or tilde ranges.
4. Import only the required module or plugin. Do not import an all-in bundle.
5. JS motion must self-guard with live `prefers-reduced-motion` handling and
   settle at the end state. Every effect needs cleanup on unmount.
6. Prefer transform and opacity. Never animate layout-affecting properties;
   any other property needs an existing sanctioned pattern or performance
   evidence. Motion may not carry state alone or introduce colors or fonts
   outside `app/globals.css` tokens.
7. Run policy lint, typecheck, tests, the production build, reduced-motion QA,
   mobile overflow QA, and landing plus dashboard Lighthouse before merging.

## Exact install path when a trigger exists

GSAP is the first-choice runtime for an approved complex timeline:

```powershell
npm.cmd install --save-exact gsap@3.15.0
```

Lenis is intentionally not paired with GSAP by default. If a future motion
brief proves the scroll requirement, repeat the version, security, bundle,
and browser-compatibility review before installing it.

React Bits is not installed wholesale. Use the official registry command from
the selected component's page only after its source and dependencies pass the
same review, and retain the source's required copyright and license notice.
Vanta has no approved install path.

## Sources

- Lenis: <https://github.com/darkroomengineering/lenis>
- GSAP: <https://github.com/greensock/GSAP>
- Vanta: <https://github.com/tengbao/vanta>
- React Bits: <https://github.com/DavidHDev/react-bits>
