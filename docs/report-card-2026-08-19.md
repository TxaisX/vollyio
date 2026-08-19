# Report card, overnight session 2026-08-19

Graded against the state at the start of the session. Every grade cites
evidence that can be re-run; where something is unverified it is graded down
for that reason rather than talked up.

| Dimension | Before | After | Why |
|---|---|---|---|
| Device-adaptive | **D** | **A-** | /film carried 850-905px of horizontal scroll on every phone. Now zero overflow across 7 viewports x 8 routes, measured. |
| Visual design | **C+** | **A-** | Dark navy everywhere. Now a measured light system, WCAG AA on every pairing, with dark kept as a choice. |
| Content truth | **C** | **A** | Three false or misleading claims shipped on the highest-traffic pages. All fixed, all three now guarded by tests or lint. |
| Information architecture | **C** | **A-** | Technique and injury shared one page and one URL. Now separate addresses, on web and app. |
| SEO | **C** | **B+** | Sitemap and metadata existed; the 34-page injury library had no index, no address and no schema. Now indexed with structured data. |
| AEO | **F** | **B+** | Nothing. Now llms.txt, FAQPage, HowTo, MedicalWebPage, all live and verified. |
| Android parity | **B-** | **A-** | Correct but dark-only and mixing technique with injury. Now theme and IA parity with the web. |
| Business clarity | **D** | **B** | No written unit economics against goals. Now measured, with the tester purchase priced honestly. |
| Device-tested app | **F** | **F** | 2.4.0 still has never run on a physical device. Unchanged, and the one thing I cannot do for you. |

## What was actually wrong, and is not now

**Three claims the product could not keep.** These matter most because they
were on the pages a stranger meets first.

1. The landing page and the film scene each cited a specific sampled image and
   an instant inside the clip. The scoring path takes roughly one
   low-resolution sample a second and the analyze route returns no instant at
   all. The policy lint now fails the build on that whole claim family.
2. The landing page advertised "540 a month" and "90 a month" in the pricing
   block, the FAQ, and the JSON-LD offer. The wall players meet is DAILY, and
   `lib/plans.ts` has said so since D-110 in a comment that reads "540 a month
   is true and unreachable". The helper that phrases it honestly already
   existed and the page simply was not calling it. Someone planning around a
   monthly figure would film a tournament on Saturday and be refused at rep 19.
   Now guarded by `lib/allowance-claims.test.ts`.
3. `/learn` with the injury tab selected was a Technique URL, with a Technique
   title and canonical, rendering an injury library.

**Two claims were checked and are TRUE**, measured rather than assumed:
"under a minute" holds against 46 production analyses (median 36.7s, p90
48.4s, max 56.0s, none over 60s), and "analyses are unlimited while we are
early" holds because the cap is genuinely off, confirmed by 5 user-days
running past the free daily rate with a maximum of 8 in one day.

## The design change

Light-first, and every pairing measured before adoption rather than eyeballed:
ink on sand 15.07, ink-dim 6.04, gold-ink 5.73, teal-ink 5.87, coral-ink 5.75,
sky 5.23, ink on a gold fill 7.18. All clear WCAG AA for body text. The
control border sits at 50% ink because that is the lowest value clearing 3:1
on the sunk surface, which is the binding one.

The token NAMES did not move, only their values, which is what let roughly a
thousand existing usages flip correctly in one commit instead of a thousand
hand edits. The one structural addition is that accents now come in pairs: a
bright fill that carries ink on top, and a deep ink that is safe as type,
because a fill cheerful enough to want is never dark enough to read on white.

Dark survives as a choice rather than an OS inheritance. Most phones ship
dark-on, so following the system setting would have meant the daylight
identity was the one most players never saw.

## Marketing

Keyword research used the one free source that reflects real demand: Google's
autocomplete endpoint ranks by query frequency. 3,254 distinct phrases across
20 seeds.

The product ranked for none of its own money terms. "volleyball video
analysis", "volleyball training app", "volleyball form" and "improve
volleyball skills" all sit at the most frequent rank. The injury corpus
already owns real queries: "jumpers knee volleyball", "volleyball shoulder
pain" and "volleyball ankle" are all rank 0, and those 34 pages were the least
discoverable thing on the site. "beach volleyball drills to do by yourself"
and "for 2 people" are rank 4 and 5, which is exactly what one phone and one
clip serves.

## Content added

Seven outdoor drills, because the primary target is grass and sand and the
catalog had **zero** references to either. They teach what soft ground
actually changes: a two-step approach because sand swallows an indoor run-up,
a shuffle that never crosses, wind-read serving, beach hand-set tolerance and
the bump set that beats it, the cut/line/deep shot menu, the block-or-pull
decision an indoor blocker never faces, and two-player court coverage. The
environment filter now filters drills rather than only re-cutting prose:
indoor sees 36 entries, grass and sand 43.

## What I could not do

- **Smoke-test 2.4.0 on a device.** No emulator or device on this machine. The
  signed sideload APK is committed and ready.
- **Invite the Play service account.** The automation classifier blocks the
  entire Play Console invite surface.
- **Create the two subscription products.** The Subscriptions page stayed
  locked behind Play's billing detection all night.

## Tomorrow, in order

1. Sideload `vollyio-native-2.4.0-sideload.apk`, run the core loop once.
2. Invite `play-billing@vollyio.iam.gserviceaccount.com` in Users and
   permissions with the three account permissions.
3. Buy the testers, after checking the gig's countries against the track's
   four. Budget it as a listing fee, not marketing.
4. Post where volleyball players actually are. It is free, it is the
   highest-converting audience this product will get, and the data says it has
   never been tried at volume.
