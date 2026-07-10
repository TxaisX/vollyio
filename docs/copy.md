# Copy (Lisa, Phase 0)

Every new or corrected user-visible string, in the project voice. Jerry and Dave pull final copy from here; do not invent strings at implementation time.

## Voice law (applies to every string below)
- Second person to the player. Plain declarative sentences.
- No em dashes (`—`) anywhere in user-visible text, including tab titles, aria labels, and live-region text. En dashes (`–`) are allowed only inside numeric ranges and scorelines that already ship (`0–100`, `5–3`); prose uses "to" and commas instead.
- No vendor names. The AI layer is "the coaching service". The coach persona is the only first-person voice, and only when the coach itself is speaking; UI text *about* the coach stays second/third person.
- Match shipped anchors: "Fix the one thing holding your game back", "Record a rep", "Your move".

Legend: **WHERE** = file + surface, **PURPOSE** = what the string is for. Live-region rows are `aria-live` unless noted.

---

## 1. Live regions (async / streaming / scoring surfaces)

### recorder.tsx
Add one visually-hidden `role="status" aria-live="polite"` region. The visible timer badge stays but is `aria-hidden`. Announce sparsely; never announce every 0.1s tick.

| WHERE | PURPOSE | STRING |
|---|---|---|
| recorder.tsx, camera ready (`phase === "ready"`) | camera opened | `Camera ready. Press Start to record.` |
| recorder.tsx, on `start()` | recording started | `Recording started. 45 seconds max.` |
| recorder.tsx, countdown (throttled: fire once at 10s left, once at 5s left) | counting | `10 seconds left.` / `5 seconds left.` |
| recorder.tsx, auto-stop at cap | auto-stopped | `Recording stopped at the 45 second limit. Analyzing your rep.` |
| recorder.tsx, manual Stop | stopped | `Recording stopped. Analyzing your rep.` |
| recorder.tsx, `getUserMedia`/`MediaRecorder` throws | capture failed | `Your camera could not start. Upload a clip instead.` |
| recorder.tsx, `<video>` element | label the live preview | aria-label: `Camera preview` |
| recorder.tsx, Stop button | shared coral action label (visible) | `Stop and analyze` (drop the `&amp;`; use the word) |

### coach-chat.tsx
Message list becomes `role="log" aria-live="polite"`. Each bubble gets a visually-hidden speaker prefix. Typing indicator gets a label. Error banner moves into a live region.

| WHERE | PURPOSE | STRING |
|---|---|---|
| coach-chat.tsx, before each user bubble (visually hidden) | speaker attribution | `You:` |
| coach-chat.tsx, before each assistant bubble (visually hidden) | speaker attribution | `Coach:` |
| coach-chat.tsx, typing indicator (the three dots), `role="status"` | typing state | aria-label: `Coach is typing.` |
| coach-chat.tsx, error banner wrapper | make errors announced | wrap existing error text in `role="alert"` (no new copy; strings below stay) |
| coach-chat.tsx, fetch not ok / no body | service down | `The coaching service is unavailable. Try again.` (shipped, keep) |
| coach-chat.tsx, empty stream | no answer | `The coach didn't answer. Try again.` (shipped, keep) |
| coach-chat.tsx, generic catch | fallback | `Something went wrong. Try again.` (shipped, keep) |
| coach-chat.tsx, retry button | retry the failed message | `Retry` (shipped, keep) |
| coach-chat.tsx, composer textarea | label | aria-label: `Message your coach` (shipped, keep) |

### scoreboard.tsx
Add one visually-hidden `role="status" aria-live="polite"` region driven by the last scoring action. Serving is currently a color/shape-only pulse dot: fold it into the tap-zone accessible name so it is not conveyed by color alone.

| WHERE | PURPOSE | STRING |
|---|---|---|
| scoreboard.tsx, on `point(team)` | point-scored confirmation | `Point ${name}. ${teamA} ${a}, ${teamB} ${b}.` |
| scoreboard.tsx, on set won | set complete | `Set ${n} to ${name}. Sets ${winsA} to ${winsB}.` |
| scoreboard.tsx, on match won | match complete | `${winnerName} wins the match, ${setLine}.` |
| scoreboard.tsx, on `minusOne` | point removed | `Point removed from ${name}. ${teamA} ${a}, ${teamB} ${b}.` |
| scoreboard.tsx, on `undo` | rally undone | `Undone. ${teamA} ${a}, ${teamB} ${b}.` |
| scoreboard.tsx, TapZone button | name carries score + serving state | aria-label: `Point for ${name}${serving ? ", serving" : ""}. Score ${score}.` |
| scoreboard.tsx, serving dot | keep as visual reinforcement only | keep `aria-hidden`; the aria-label above is the text equivalent |
| scoreboard.tsx, "No matches yet" | empty state (add trailing period) | `No matches yet.` (was `No matches yet`) |

### goals.tsx
Add one visually-hidden `role="status" aria-live="polite"` region for the create result; move focus back to the trigger after a successful add.

| WHERE | PURPOSE | STRING |
|---|---|---|
| goals.tsx GoalForm, on success | goal added confirmation | `Goal added.` |
| goals.tsx ActiveGoalCard, target reached | replace em-dash line | `Target hit. Mark it done.` (was `Target hit &mdash; mark it done`) |
| goals.tsx, field errors | already in voice (from actions.ts), wire via `aria-describedby`/`aria-invalid` | keep: `Give the goal a name.` / `Keep it under 80 characters.` / `Pick one of the six skills.` / `Enter a number.` / `Whole numbers only.` / `Target is 1 to 100.` / `Pick a valid date.` / `Deadline must be today or later.` / `Could not save the goal. Try again.` |

### analyze-flow.tsx
The status region already exists (`aria-live="polite"`). Copy fixes only.

| WHERE | PURPOSE | STRING |
|---|---|---|
| analyze-flow.tsx, reading | pulling frames | `Pulling key frames…` (shipped, keep) |
| analyze-flow.tsx, sending | scoring | `Scoring your rep, frame by frame…` (shipped, keep) |
| analyze-flow.tsx, service error | fallback message from API | `The coaching service is unavailable. Try again.` (shipped, keep) |
| analyze-flow.tsx, retry | resend | `Send it again` (shipped, keep) |

### clip-viewer.tsx (frame-change announcement)
Add one visually-hidden `role="status" aria-live="polite"` region. Fire on Prev/Next, thumbnail select, and each auto-advance step (auto-advance itself pauses under reduced motion).

| WHERE | PURPOSE | STRING |
|---|---|---|
| clip-viewer.tsx FramePlayer, on frame change | frame-change announcement | `Frame ${active + 1} of ${frames.length}${time_s != null ? \`, ${time_s} seconds\` : ""}.` |
| clip-viewer.tsx, active thumbnail | non-color selection cue | set `aria-current="true"` on the selected thumbnail (no visible copy change) |
| clip-viewer.tsx, zero-frame guard | empty state (prevents the `1 / 0` NaN crash) | `No frames to show for this rep.` |
| clip-viewer.tsx, play/pause | control labels | `Play` / `Pause` (shipped, keep) |

---

## 2. xp-toast.tsx (manual dismiss)

Add a dismiss control so a keyboard user is not stuck under the 4s timer.

| WHERE | PURPOSE | STRING |
|---|---|---|
| xp-toast.tsx, dismiss button | manual-dismiss label | aria-label: `Dismiss` (visible glyph `×`, `aria-hidden`) |
| xp-toast.tsx, toast body | reward text | `+${amount} XP` then `rep analyzed` (shipped, keep) |

---

## 3. share-card.tsx (canvas-fail message)

Add a small `role="status"` line beside the trigger. Show it when `getContext` returns null or `toBlob` yields null.

| WHERE | PURPOSE | STRING |
|---|---|---|
| share-card.tsx, canvas/context/blob null | canvas-fail message | `Couldn't build the share card. Try again.` |
| share-card.tsx, trigger idle | button label | `Share card` (shipped, keep) |
| share-card.tsx, trigger busy | rendering label | `Rendering…` (shipped, keep) |

---

## 4. offline (/offline) forward action

The page is currently a dead end. Keep the shipped heading and body; add a forward action and a way back.

| WHERE | PURPOSE | STRING |
|---|---|---|
| app/offline/page.tsx, heading | offline title | `You're offline` (shipped, keep) |
| app/offline/page.tsx, body | reassurance | `Sideout needs a connection to analyze reps. Your saved analyses will be here when you're back online.` (shipped, keep) |
| app/offline/page.tsx, primary action | try again (reloads / retries current route) | `Try again` |
| app/offline/page.tsx, secondary link | back into the app | `Back to dashboard` |

---

## 5. Boundaries: error and not-found copy (Dave builds files; copy is final here)

### app/global-error.tsx
| PURPOSE | STRING |
|---|---|
| heading | `Something broke.` |
| body | `The app hit an error it couldn't recover from. Reload to keep going.` |
| button (reload) | `Reload` |

### app/(app)/error.tsx
| PURPOSE | STRING |
|---|---|
| heading | `This didn't load.` |
| body | `The page ran into an error. Try again, or head back to your dashboard.` |
| primary button (calls `reset()`) | `Try again` |
| secondary link | `Back to dashboard` |

### app/(app)/analysis/[id]/not-found.tsx
| PURPOSE | STRING |
|---|---|
| heading | `Breakdown not found.` |
| body | `This breakdown doesn't exist or isn't yours. It may have been deleted.` |
| link | `Back to your history` (`/history`) |

### app/(app)/drills/[slug]/not-found.tsx
| PURPOSE | STRING |
|---|---|
| heading | `Drill not found.` |
| body | `There's no drill at this link. Browse the full library instead.` |
| link | `All drills` (`/drills`) |

### app/not-found.tsx (top-level 404, optional but recommended for full coverage)
| PURPOSE | STRING |
|---|---|
| heading | `Page not found.` |
| body | `This page doesn't exist. Check the link, or head back home.` |
| link | `Back home` (`/`) |

### analysis/[id] signed-URL failure (frames could not be signed)
Render this in the player area instead of blank images when every frame URL is empty.
| PURPOSE | STRING |
|---|---|
| message | `These frames couldn't load right now. Your scores and notes are still below.` |

---

## 6. Pending states (server actions, no double-submit)

Wire with `useFormStatus` (Dave). Buttons disable while pending; label swaps to the pending copy.

| WHERE | PURPOSE | IDLE | PENDING |
|---|---|---|---|
| app/(auth)/login/page.tsx submit | login pending | `Log in` | `Logging in…` |
| app/(auth)/signup/page.tsx submit | signup pending | `Start your first breakdown` | `Creating your account…` |
| app/(app)/layout.tsx logout | logout pending | `Log out` | `Logging out…` |
| dashboard daily challenge form | challenge submit | `Mark complete` | `Marking…` |

---

## 7. Loading states (skeletons: visually-hidden SR text)

Skeletons carry no visible copy. Add a visually-hidden line inside each `aria-busy` region so screen-reader users hear that content is loading.

| WHERE | PURPOSE | STRING |
|---|---|---|
| app/(app)/loading.tsx | generic app load | `Loading.` |
| app/(app)/dashboard/loading.tsx | dashboard load | `Loading your dashboard.` |
| app/(app)/analysis/[id]/loading.tsx (new, 2-column) | breakdown load | `Loading your breakdown.` |
| coach route loading (if added) | chat load | `Loading your chat.` |

---

## 8. Data-visual accessible names (aria labels)

These SVG/visual atoms need an accessible name or a visually-hidden data equivalent. No state by color alone.

| WHERE | PURPOSE | STRING |
|---|---|---|
| score-ring.tsx, `role="img"` (with label) | scored | aria-label: `${label}: ${score} out of 100` |
| score-ring.tsx, `role="img"` (with label, null score) | not rated | aria-label: `${label}: not rated yet` |
| score-ring.tsx, `role="img"` (no label) | scored | aria-label: `Score ${score} out of 100` |
| score-ring.tsx, `role="img"` (no label, null) | not rated | aria-label: `No score yet` |
| radar.tsx | already labeled (keep) | aria-label: `Skill ratings out of 100: ${summary}` / `Skill ratings, no reps yet` (shipped, keep) |
| metric-bar.tsx, `role="progressbar"` | metric value | aria-label: `${label}`, `aria-valuenow={clamped}`, `aria-valuemin={0}`, `aria-valuemax={100}`, aria-valuetext: `${score} out of 100` |
| sparkline.tsx, `role="img"` (>= 2 points) | trend | aria-label: `Rating trend over your last ${values.length} reps.` (caller may prefix the skill, e.g. `Serving rating trend…`) |
| sparkline.tsx, `< 2` points | not-enough-data (replaces the skeleton-looking bar) | aria-label + visually-hidden text: `Not enough reps to chart yet.` |
| skill-icons.tsx | optional label for icon-only use | aria-label prop value = `${SKILL_LABEL[skill]}` when no adjacent text; else `aria-hidden` |
| filmstrip.tsx / clip-viewer thumbnails | frame label | alt: `Frame ${index + 1}` (shipped, keep); add `${time_s}s` context where known |

---

## 9. Voice corrections to shipped copy (remove em dashes, tighten over-promises)

These strings currently ship with an em dash or an over-promise and breach the voice law. Replace exactly.

| WHERE | BEFORE | AFTER |
|---|---|---|
| app/page.tsx hero paragraph | `Record a rep. Sideout breaks it down frame by frame — serve, pass, set, attack, block, and defense — scored the way a coach scores it.` | `Record a rep. Sideout breaks it down frame by frame across serve, pass, set, attack, block, and defense, scored the way a coach scores it.` |
| app/page.tsx STEPS[2].body | `One priority fix per rep — the change that buys the most — with drills matched to it.` | `One priority fix per rep, the change that buys the most, with drills matched to it.` |
| app/page.tsx MockAnalysisCard fix | `Contact is behind your head — toss six inches further into the court.` | `Contact is behind your head. Toss six inches further into the court.` |
| app/page.tsx evidence paragraph | `…so you can see exactly what the score saw — and argue with it if you want.` | `…so you can see exactly what the score saw, and argue with it if you want.` |
| analyze-flow.tsx preview empty-state | `Your captured rep shows up here — full-size frames, and the clip to play back.` | `Your captured rep shows up here, frame by frame.` |
| analyze-flow.tsx busy placeholder | `Working on your clip…` | `Reading your rep…` (photos have no clip) |

Note on the dashboard `Deadline` helper (goals.tsx): `${days} days left` / `Due today` / `${-days} days overdue` are in voice; keep. The `en` dash in scorelines (`${winsA}–${winsB}`, set lines) and ranges (`0–100`) is not an em dash; leave it. Do not "fix" a scoreline en dash into a hyphen.

---

## 10. Empty states reviewed (keep as shipped)

These already meet voice; listed so they are not rewritten. Only the trailing-period fix in scoreboard (section 1) applies.

- dashboard recent: `No film yet.` / `Your rating starts with one rep. Forty-five seconds, any skill.` / CTA `Film your first rep`.
- dashboard goals card: `Nothing on the board.` + `Set a target.`
- goals empty: `One number to chase gives every session a direction.`
- history empty: `Nothing here yet.` / `No ${skill} reps logged.` / `No reps logged yet.` / CTA `Film a rep`.
- coach empty: `Your coach knows your game.` / `Ask about your scores, your priority fixes, or what to train next. Every answer comes from your own analyses.`

Cross-reference: the section 10.6 logo accessible name (`Sideout, home`) and all volleyball-visual alt text live in `docs/metadata.md`.

---

## 11. CV Phase 1 additions (2026-07-10)

New user-facing strings introduced with the measurement pipeline. The
capability is always called "motion tracking" in copy; the vendor-name rule
applies as everywhere.

| Surface | String |
|---|---|
| analyze-flow consent dialog kicker | `One-time question` |
| analyze-flow consent dialog title | `Help improve motion tracking?` |
| analyze-flow consent dialog body | `Allow your uploaded clips and extracted frames to help train future analysis features, like automatic ball tracking. Your footage stays private to your account either way, and you can change this any time from your dashboard.` |
| analyze-flow consent buttons | `Allow` / `Not now` |
| dashboard settings heading | `Settings` |
| dashboard consent row title | `Improve motion tracking` |
| dashboard consent row body | `Allow your clips and frames to help train future analysis features, like automatic ball tracking. Footage stays private to your account either way.` |
| dashboard consent toggle states | `Allowed` / `Not allowed` |
| clip player trace toggle | `Motion trace` + helper `Tracked body lines over your rep` |
| frame player ball caption | `Ball marker: estimated position` |

## 12. Coach sessions (2026-07-10)

| Surface | String |
|---|---|
| coach session bar new-chat chip | `+ New chat` |
| coach session delete label | `Delete session: {title}` (aria) |
| legacy backfill session title | `Earlier conversations` |
| session not found (API) | `That session doesn't exist.` |
| session create failure (API) | `Couldn't start a session.` |

Coach session sidebar (desktop rail) additions: button `New chat`, list label
`Sessions`, empty state `Your conversations show up here.`, relative dates
`Today` / `Yesterday` / `{n} days ago`.
