# Vollyio on Google Play — runbook

**Account type:** Personal (chosen). This means the 12-testers / 14-days closed-testing
gate applies before production. Budget ~3 weeks of calendar, not of work.

**Cost:** $25 one-time, forever.

**Approach:** Trusted Web Activity (TWA) wrapping the existing PWA. No rewrite. Vollyio
already has a service worker with a fetch handler (`public/sw.js`), a maskable icon set,
and a Lighthouse budget above the bar — which is most of what a TWA needs.

---

## 0. The deadline that sets the schedule

**New apps submitted after 31 August 2026 must target Android 16 (API level 36).**
Today is 3 August 2026. You have 28 days before the bar moves.

This does not mean "ship by the 31st" — it means **build against API 36 from the first
build**, so you never do this twice. Use the current `@bubblewrap/cli`, then verify
`targetSdkVersion` in the generated `twa-manifest.json` is **36** before your first upload.
If Bubblewrap defaults lower, set it manually and rebuild.

An extension to 1 November 2026 can be requested, but there is no reason to need one.

Source: <https://support.google.com/googleplay/android-developer/answer/11926878>

---

## 1. Code changes (do these first — they gate everything else)

### 1a. `app/manifest.ts`

Replace with the version delivered alongside this document. Four changes matter:

| Field | Why |
|---|---|
| `scope: "/"` | **The important one.** A TWA opens any URL *outside* scope in a Custom Tab with visible browser chrome. Left implicit, scope is derived from `start_url`, which breaks the moment `start_url` gains a path segment. |
| `start_url: "/?source=pwa"` | Was `/dashboard`. A Play install launches a never-signed-in user at the launch URL, and `guardDecision` redirects `/dashboard` → `/login`. First run would be a bare auth wall with no idea what the app is. Signed-in users still land on the dashboard via the guard. The query param gives you free install attribution. |
| `id: "/"` | Pins app identity so a future `start_url` change doesn't read as a different app. |
| `screenshots` | Richer Android install prompt. Same files the Play listing uses. |

Also added: `orientation`, `lang`, `dir`, `categories` — all cosmetic, all free.

### 1b. `public/.well-known/assetlinks.json`

Digital Asset Links is what makes the TWA full-screen instead of a browser tab with a URL
bar. Ship the delivered file at exactly:

```
https://vollyio.com/.well-known/assetlinks.json
```

It must return `200` with `Content-Type: application/json` and **no redirect** — a redirect
from `vollyio.com` to `www.vollyio.com` (or the reverse) fails verification silently.

You need **two** SHA-256 fingerprints in it:

1. **Play App Signing key** — from Play Console → your app → *Test and release* → *Setup* →
   *App signing*. This is the one that matters for installs from the Play Store.
2. **Upload / local key** — `bubblewrap fingerprint list`, or
   `keytool -list -v -keystore android.keystore -alias android`. This is what lets you
   verify a locally-installed build during development.

Ship both. Omitting the local one is the single most common cause of "it works from the
Play Store but shows a URL bar when I sideload it."

### 1c. `proxy.ts` — one-line matcher change

The middleware matcher currently does **not** exclude `.well-known`, so every asset-links
request runs the full Supabase auth path before serving a static file. It will probably
still serve (the guard should fall through to `default`), but "probably" is not a good
property for the file that decides whether your app has browser chrome.

Add `\.well-known` to the negative lookahead:

```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|icon-|apple-icon|manifest|offline|robots\\.txt|sitemap\\.xml|opengraph-image|\\.well-known|api/).*)",
  ],
};
```

**Verify after deploy, before building the TWA:**

```bash
curl -sSLI https://vollyio.com/.well-known/assetlinks.json | head -20
curl -sS  https://vollyio.com/.well-known/assetlinks.json
```

Then confirm Google sees it:
<https://developers.google.com/digital-asset-links/tools/generator>

### 1d. CSP — no change needed

`default-src 'self'` is correct for a TWA; everything stays same-origin. Worth knowing:
if you later add Play Billing via the Digital Goods API, that's a browser API, not a
network origin, so the CSP still doesn't change.

---

## 2. Build the TWA

Prereqs: Node 18+, and a JDK + Android SDK — Bubblewrap offers to install both on first run.

```bash
npm install -g @bubblewrap/cli

# Generates twa-manifest.json + the Android project from your live manifest
bubblewrap init --manifest=https://vollyio.com/manifest.webmanifest

# Answer prompts: package id com.vollyio.app, app name Vollyio,
# theme #0f212c, and CREATE A NEW SIGNING KEY when asked.

# >>> Before building: open twa-manifest.json and confirm targetSdkVersion is 36 <<<

bubblewrap build          # produces app-release-bundle.aab (upload this) + a signed APK
bubblewrap install        # side-load the APK to a connected phone to test
bubblewrap fingerprint list   # the SHA-256 for assetlinks.json step 1b
```

**Upload the `.aab`, not the `.apk`.** Play requires App Bundles for new apps.

### Signing key — the one irreversible thing here

Bubblewrap generates `android.keystore` plus a password. **Back both up somewhere you will
still have in five years.** Lose the upload key and you can recover via Play support; lose
it *and* opt out of Play App Signing and you can never update the app again — you'd have to
publish a new listing and lose every install and review.

Opt **into** Play App Signing when Play offers it (it's the default for new apps). Add
`android.keystore` and any `*.jks` to `.gitignore` — they are secrets, and `docs/security.md`
rules apply to them like any other key.

### Sanity check before you upload

Side-load the APK and confirm:

- [ ] No URL bar / browser chrome anywhere in the app (if you see one, asset links failed)
- [ ] Navigating from landing → login → dashboard → results stays in-app
- [ ] The camera/file picker opens for clip upload
- [ ] Back button behaves (doesn't dump you out of the app from mid-flow)
- [ ] Offline route renders when you kill the network
- [ ] Stripe checkout opens and completes (see §5)

---

## 3. Play Console setup

1. Create the developer account — $25, one time: <https://play.google.com/console/signup>
   Identity verification takes a few days; start it today.
2. Create the app. Name **Vollyio**, English (US), **App** (not game), **Free** with in-app
   purchases.
3. Complete every item in *Dashboard → Set up your app*. Nothing publishes until all of it
   is green.

---

## 4. Store listing copy

**App name** (30 char limit) — 24 used:

```
Vollyio: Volleyball Form
```

*Alternative if you'd rather lead with the category:* `Volleyball Form Coach` (21).
The first is better for brand, the second for search. You can change it later.

**Short description** (80 char limit) — 78 used:

```
Upload a rep. Get a checkpoint-by-checkpoint read of your volleyball technique.
```

**Full description** (4000 char limit):

```
Vollyio reads one volleyball rep and tells you what your technique actually did.

Record a clip on your phone, tap the athlete to analyze, and pick a skill: serve,
pass, set, attack, block, or dig. You get a breakdown of that rep against a fixed
checklist — five checkpoints per skill, four observable cues at each one.

WHY THE SCORE MEANS SOMETHING

Most feedback apps hand you a number and leave you to trust it. Vollyio derives the
number from the checklist instead of inventing it. Every cue is judged as met,
partial, missed, or not visible, and the score is the fraction of cues met over the
cues that were actually visible in your footage. The full checklist renders under
each bar, so a score explains itself line by line.

WHAT IT WILL NOT DO

If your camera angle hides your contact point, Vollyio says so. That checkpoint is
excluded from your overall score rather than counted against you, and it is marked
on screen as not visible. No score is softened by a display curve. Nothing is
inferred from footage that does not show it. You will never get a confident-sounding
read of something the camera never saw.

That honesty is the point. A form score you cannot check is worth nothing.

HOW IT WORKS

1. Film one rep — a phone, from the side, is enough
2. Upload it and tap the athlete in the frame
3. Choose the skill
4. Get the checkpoint breakdown, plus the single highest-impact fix to work on

Analyze the same skill again later and the breakdown opens with what changed since
last time.

PLANS

Free: 6 analyses when you sign up, then 1 a month.
Pro: $9.99 a month for 24 analyses.

An analysis that fails or times out costs you nothing — the count reads completed
results only.

YOUR FOOTAGE

Your clips are private to your account. They are not public, not shared with other
users, and not used to train anything. You can delete your account and everything in
it from inside the app.

Vollyio is not affiliated with any league, federation, or governing body.
```

That's ~1,750 characters. It leads with the mechanism, states the limitation as a feature,
and makes no claim the product can't support — consistent with the rest of the site's voice.

**One deliberate omission:** no accuracy or agreement percentage anywhere. You don't have
that number yet (it's the cue-agreement study). Adding one now would be the exact kind of
unsupported claim the whole product is built to avoid — and Play does enforce against
misleading claims.

---

## 5. The billing question — better news than expected

Google Play normally requires Play Billing for digital goods sold in-app, which would put a
cut on top of your already-thin margin. That changed.

Following the Epic v. Google injunction (Ninth Circuit, 12 Sep 2025; policy live
29 Oct 2025), Google **no longer prohibits in-app payment methods other than Google Play
Billing for US users**, and per Play's own help page Google is **currently not assessing a
service fee** on alternative billing. The published future structure is 10% for
auto-renewing subscriptions (and the first $1M of annual earnings at 10% regardless).

**What that means for you:** keep Stripe. Do not rebuild on the Digital Goods API. At a
future 10% on auto-renewing subs, your $9.99 nets ~$8.99 against ~$9.40 on Stripe alone —
about 4 points of margin, not 15.

**But treat this as verify-before-you-rely.** The policy is contingent on live litigation
(a revised modified injunction landed 4 March 2026), and the help page references a
**28 January 2026 enrollment deadline** for developers already offering alternative billing
outside the pilot — that date has passed, so confirm the current enrollment path in Play
Console before your first release rather than assuming you're covered.

Requirements if you stay on Stripe: PCI-DSS compliance (Stripe hosted checkout keeps you at
SAQ-A), a customer support and dispute process, and users must be able to see order history
and manage their subscription. Point 3 is worth checking against what your account page
actually exposes today.

Sources:
- <https://support.google.com/googleplay/android-developer/answer/15582165>
- <https://support.google.com/googleplay/android-developer/answer/16497028>

---

## 6. Console declarations, pre-answered

### App access — **do not skip this one**

Vollyio is behind auth, so review cannot see anything without credentials. Under
*App access*, choose "All or some functionality is restricted" and provide:

- A **permanent** demo account (email + password) that is not your own
- Step-by-step: sign in → dashboard → upload the provided clip → tap athlete → pick skill
- Give the demo account a Pro allowance so review can reach the paid surface

Missing or expired test credentials is the #1 cause of rejection for gated apps. Make the
account permanent and put a note in `HANDOFF.md` so future-you doesn't delete it.

### Data safety

Declare **collected**, all encrypted in transit, all deletable in-app (you have 30-day
self-serve deletion):

| Data type | Collected | Purpose | Optional? |
|---|---|---|---|
| Email address | Yes | Account management | Required |
| Photos / videos | Yes | App functionality | Required |
| Purchase history | Yes | App functionality | Required (Pro only) |
| App interactions | Yes | Analytics | Required |
| Crash logs / diagnostics | Yes | Analytics | Required |

Answer **No** to: shared with third parties for advertising, used for advertising or
marketing, data sold. Answer **Yes** to: encrypted in transit, users can request deletion.

Payment processors and infrastructure vendors are *processors*, not "sharing" — but read
Play's definition yourself rather than taking my word for it, because the distinction is
where most data-safety violations come from.

### Content rating (IARC questionnaire)

Answer honestly and it should land at **Everyone** or **Teen**. The one question that
matters: **user-generated content**. Yes, users upload video — but it is private to the
uploading account, never shared with other users, and there is no social feed, no messaging,
and no public profile. Say exactly that. UGC that is never distributed is rated far more
lightly than UGC that is.

### The minors question — handle it deliberately

Your users are overwhelmingly teenage. Under *Target audience and content*:

- If you select any age band under 13, **Play Families Policy applies in full** and it is a
  significantly heavier compliance regime.
- Your Terms already carry a 13+ attestation, so select **13+** and make sure the signup
  flow actually enforces it rather than only the Terms. That mismatch — Terms say 13+, form
  asks nothing — is a real exposure and it's a few hours of work to close.
- Do not market the app to under-13s anywhere in the listing or screenshots.

### Also required

- Privacy policy URL: `https://vollyio.com/privacy`
- Ads: **No**
- Government app: **No**
- Financial features: **No**
- Health apps declaration: **No** (form analysis is not health data — but if you ever add
  injury-risk language, that changes)

---

## 7. The 12-testers / 14-days gate

**The rule:** personal developer accounts created on or after 13 November 2023 must have at
least **12 testers opted in continuously for 14 days** before applying for production
access. It was 20 until 2025.

**Four things that catch people out:**

1. **Opt-in means clicking the link and installing** — collecting 12 email addresses does
   nothing. Each tester must accept via the Play Store opt-in URL.
2. **The clock starts when the 12th tester opts in.** Days spent at 11 don't count.
3. **Dropping below 12 breaks continuity** and the window rebuilds. Recruit **15–18** so an
   uninstall doesn't cost you two weeks.
4. **Google evaluates actual engagement**, not just opt-in count. Testers who install and
   never open it are a risk. Ask each to run one real analysis.

**Where your 12 come from** — you need real Google accounts, so:

- Teammates and training partners (the fastest 6–8)
- Family and friends with Android phones — they don't need to be volleyball players to
  install and open it, though engaged testers are better
- The 5–10 individual players from Card D outreach, if that has run
- A volleyball Discord or a club group chat — offer early access

**Do not use tester-swap groups or paid tester services.** They violate Play policy, Google
detects the pattern, and account termination is not appealable in any practical sense.
Twelve real people is genuinely achievable; don't risk a $25 account and a launch on it.

**Sequence it right:** start the closed test the day your first build is uploadable. The 14
days run in the background while you finish the listing, the screenshots, and the
declarations. Done in the wrong order this adds two weeks; done in the right order it adds
roughly zero.

---

## 8. Order of operations

| # | Step | Blocks | Time |
|---|---|---|---|
| 1 | Create Play developer account ($25), start identity verification | everything | 15 min + days |
| 2 | Ship manifest + assetlinks + proxy patch to production | build | 1 hour |
| 3 | Verify assetlinks with the Google generator tool | build | 5 min |
| 4 | `bubblewrap init` / `build`, confirm targetSdk 36, back up the keystore | upload | 1–2 hours |
| 5 | Side-load, run the §2 checklist on a real phone | upload | 30 min |
| 6 | Create the app in Console, upload the `.aab` to closed testing | testers | 30 min |
| 7 | **Recruit 15–18 testers, send opt-in link — start the 14-day clock** | production | 1 day + 14 days |
| 8 | Capture screenshots, build feature graphic, write listing | production | 2–3 hours |
| 9 | Complete data safety, content rating, app access, target audience | production | 1 hour |
| 10 | Apply for production access, submit for review | — | 1 day + review |

**Realistic total: ~3 weeks**, of which about 6 hours is actual work. Step 7 is the whole
schedule — start it as early as physically possible.

---

## 9. Graphic assets you still need

| Asset | Spec | Notes |
|---|---|---|
| App icon | 512×512 PNG, 32-bit, **no transparency** | `icon-any-512.png` is 512×512 — flatten the alpha onto `#0f212c` and it's done |
| Feature graphic | 1024×500 PNG/JPG, no transparency | Required. Court imagery + wordmark; keep text away from the edges, it gets cropped in places |
| Phone screenshots | 2–8 required, 16:9 or 9:16, min 320px, max 3840px | 1080×1920 is the safe default |
| Tablet screenshots | Optional | Skip for now |

**Shoot these three screenshots**, in this order — they mirror the listing copy and the
manifest `screenshots` array:

1. The upload/tap-the-athlete moment
2. A results page with the checklist expanded under a bar
3. A checkpoint marked **not visible** — this is your actual differentiator and no
   competitor's store listing shows anything like it

Use your own footage only, per the likeness rule.

---

## 10. Two things to verify yourself before submitting

I researched these on 3 Aug 2026 and they are both moving targets:

1. **Alternative billing enrollment.** The published 28 Jan 2026 enrollment deadline has
   passed and the policy is tied to live litigation. Confirm the current path in Play
   Console before release — don't assume Stripe is fine because this document says so.
2. **Target API level.** Confirm `targetSdkVersion: 36` in `twa-manifest.json` before your
   first upload. Bubblewrap's default tracks the current requirement, but the 31 Aug 2026
   cutover is close enough that you should look rather than trust.
