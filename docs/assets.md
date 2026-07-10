# Asset Register (section 10.3 / 10.4)

Every sourced or generated volleyball visual lands here before it ships.
Required per asset: file path · source (URL/tool) · license + rights-clearance for this use · dimensions/format · optimized (next/image or equiv, lazy off-screen, no CLS) · reduced-motion behavior (still poster fallback if it moves) · alt text (project voice, from Lisa) or `aria-hidden` if decorative · on-token chrome confirmed (10.1).

Prefer the fewest, best assets over volume. Assets that fight the navy/gold world or read as stock filler do not ship.

| Asset | Source | License | Dims/Format | A11y (alt / aria-hidden) | Reduced-motion | Verified (Sierra) |
|---|---|---|---|---|---|---|
| `public/volleyball-hero.webp` | Built-in image generation, created specifically for Sideout; prompt recorded in D-007 | Generated original with no third-party source, logos, or watermark; cleared for project use | 1774×888 WebP, 63.1 KiB; rendered through `next/image` with fixed fill container and responsive `sizes` | Landing: “A volleyball player meeting the ball at full reach during a jump serve.” Auth use is decorative with empty alt | One-time photo settle collapses to 0.01ms with zero delay; still image remains fully visible | PASS 2026-07-10: visual inspection, desktop/390/360 framing, build |
| `public/sideout-launch.mp4` | Project-local launch route rendered from the Sideout UI and generated hero asset | Original project composition with no third-party footage, logos, or watermark; cleared for project use | 1280×720 H.264 MP4, 19.77s, 1.9 MiB, 30fps | The `/launch` route carries a descriptive main landmark; the film communicates every score and action in visible text | `/launch` replaces the timed sequence with a settled final brand frame when reduced motion is requested | PASS 2026-07-10: five-scene visual inspection, frame extraction, metadata check, build |
