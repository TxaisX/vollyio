# Play store listing copy

Rewritten 2026-08-11. The earlier draft was lost (never committed, absent from
git history). Category is **Sports**, not Health & Fitness: the app coaches a
sport skill, and Health & Fitness invites the medical-claims reading the
Data safety and health declarations already work to avoid.

Two standing constraints on every line here:

- **No em dashes** anywhere, including inside generated images.
- **No claim of frame-level timing.** The video path samples roughly one frame
  per second, so "the exact frame" and "Frame 12 / CONTACT POINT" describe a
  precision the engine does not have. Copy says what it actually returns: a
  score, named checkpoints, and the one fix worth making next.

## App name (30 max)

```
Vollyio: Volleyball Form Coach
```
29 characters.

## Short description (80 max)

```
Film one rep. Get it scored, see what worked, and get the one fix that matters.
```
78 characters.

## Full description (4000 max)

```
Vollyio scores your volleyball technique from a single clip and tells you the
one thing to change next.

Film one rep on your phone. Upload it. In about fifteen seconds you get a score
out of 100, a read on each checkpoint of that skill, and a priority fix written
as something you can actually do at the next practice.

WHAT YOU GET BACK

- An overall score for the rep, on a scale calibrated against coached standards
- What worked, named specifically, not generic praise
- Your number one fix, with the reason it matters and how long it takes to hold
- Drills matched to that fix, with a time and a difficulty
- A coach you can ask follow-up questions, in the same place as the breakdown

SIX SKILLS

Serve, pass, set, attack, block and dig. Every skill has its own checkpoints
drawn from how that skill is actually taught, so an attack is judged on approach
rhythm, jump timing, contact height and follow-through rather than on a generic
form score.

HONEST ABOUT WHAT IT CAN SEE

If the footage does not show the skill clearly, Vollyio says so instead of
inventing a number. A rep it cannot read costs you nothing.

TRACK THE REPS THAT COUNT

Your scores build a rating per skill over time, so you can see whether the fix
you worked on actually moved. Share any breakdown with a coach or a teammate
through a link, and revoke that link whenever you want.

FREE AND PRO

Free gives you three analyses a day. Pro gives you eighteen a day, which is
three of every skill, plus the full history. No advertising anywhere in the app.

YOUR FOOTAGE

Clips are stored privately to your account and are never shared with other
users. Vollyio is built for players aged 13 and over.
```

## Assets

Built 2026-08-11, in the scratchpad at `play-assets/`:

| Asset | File | Size |
|---|---|---|
| App icon | `app-icon-512.png` (copy of `public/icon-512.png`) | 512x512 |
| Feature graphic | `feature-graphic-1024x500.png` | 1024x500 |
| Phone screenshot 1 | `screenshot-1-breakdown-score.png` | 412x732 |
| Phone screenshot 2 | `screenshot-2-drills-cta.png` | 412x732 |

Screenshots are real renders of the live share page for analysis
`a49925a7-3084-4e6f-99c1-5969c16c4ce2` (attack, scored 89) at a true 412px
phone viewport with the scrollbar suppressed. Nothing is mocked up. The
feature graphic is built from the app's own tokens (navy `#0f212c`, gold
`#e8b93b`, teal `#6fbfae`, Space Grotesk) rather than a one-off palette.

**Only two screenshots are ready, and Play allows up to eight.** The reason is
in `handoff.md`: at phone width the breakdown's verdict grid is hardcoded to two
columns, so the most compelling part of the product, the coaching itself,
currently renders as two 185px columns with clipped text. Fix that first, then
the middle of the breakdown becomes the best screenshot in the set.
