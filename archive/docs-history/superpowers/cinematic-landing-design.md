# Cinematic Landing Design

## Objective

Give Sideout a cinematic first impression by making the real court film the
opening narrative, then carrying that visual language directly into the film
room. The page must still communicate the product in one glance and preserve
the existing primary conversion path.

## Signature moment

The first viewport behaves like a live film read. The court clip fills the
frame, the headline enters over a controlled navy exposure, and a compact
analysis rail reports the same example shown in the film: hitter acquired,
frame 12, elbow angle at contact, and spike score 82. The scan aperture creates
depth while the court plate stays visually locked.

## Narrative order

The film room follows the hero immediately so the tracked-player language in
the opening resolves into the full example breakdown. The three-step explainer
then follows as supporting context. Later analytics, skills, evidence,
progress, coach, FAQ, and closing CTA sections keep their current content.

## Interaction and motion

- Open on a static court plate with a clear Play control; playback stays muted,
  looping, and pausable once requested.
- Keep in-view autoplay only in the dedicated film-room example.
- Add only transform and opacity motion to the analysis overlays.
- Reuse the existing reduced-motion hook so reduced-motion visitors receive
  the poster as the settled end state.
- Keep the headline and primary action server rendered and usable without
  JavaScript.
- Do not add a runtime dependency or replace native scrolling.

## Responsive behavior

Desktop presents a widescreen composition with the analysis rail spanning the
bottom edge. Mobile keeps the athlete in frame, stacks the copy above a compact
two-column readout, preserves 44px controls, and avoids horizontal overflow.

## Acceptance criteria

- The first viewport has one dominant cinematic moment grounded in real film.
- The film-room section appears before the how-it-works section.
- The primary CTA and film pause control remain keyboard accessible.
- Decorative analysis labels do not create duplicate assistive-tech output.
- Reduced-motion visitors receive a static, complete composition.
- Policy lint, TypeScript, tests, build, and desktop/mobile browser inspection
  pass before the preview is handed to the owner.
