# Overnight work plan - 2026-08-19

Working list for the unattended session. Graded outcomes live in
`report-card-2026-08-19.md`; this file is the checklist it was graded against.

## 1. Design: daylight on sand (D-126)
- [x] Palette measured against WCAG AA before adoption (all pairs pass)
- [x] Token values remapped in place so existing usages keep their role
- [x] Accent text swept to `-ink` variants (222 usages)
- [x] Component layer rewritten for light UI (warm shadows, not glows)
- [x] Dark kept as an explicit choice, not an OS inheritance
- [x] Verified live on vollyio.com: body #FDFBF7 on #14262F

## 2. Device-adaptive
- [x] Audited 8 routes x 7 viewports (375 to 1920) with a scripted sweep
- [x] /film scaled with container query units: was 850-905px of overflow
- [x] Horizontal overflow now zero everywhere, measured
- [x] Sentence-carrying labels lifted off the 11px floor
- [x] Standalone auth links given 44px hit areas
- [x] 16px input floor so iOS stops zooming on focus
- [ ] Landscape phone and foldable postures still unaudited

## 3. Content truth pass
- [x] Frame and instant citations removed from landing and film scene
- [x] Monthly allowance headlines replaced with the daily wall
- [x] "under a minute" verified against 46 production analyses
- [x] "unlimited while early" verified against actual daily counts
- [x] Every href checked to resolve to a real route
- [x] Lint rule added for the frame/instant claim family
- [x] Tests added for the allowance claim family and the FAQ constants

## 4. Learn IA restructure (owner request)
- [x] Technique keeps only the environment filter
- [x] Injury & recovery has its own address, /learn/rehab
- [x] Same split shipped in the Android app
- [x] Corpus expanded: 7 outdoor drills, 30 -> 37
- [x] The environment filter now filters drills, not just prose

## 5. Marketing: SEO / AEO
- [x] Keyword harvest, 3,254 phrases, free source
- [x] llms.txt generated from the content modules
- [x] HowTo on every drill, MedicalWebPage on every injury entry
- [x] FAQPage on the landing page
- [x] Injury index added to the sitemap
- [ ] Metadata titles not yet rewritten against the rank-0 terms
- [ ] No inbound links anywhere; content alone will not rank

## 6. Business analysis
- [x] `business-position.md`: measured state, unit economics, ranked moves
- [x] Break-even stated plainly: 3 Pro subscribers
- [x] Tester purchase priced as a listing fee with its two failure modes

## 7. Android parity
- [x] No web redirects, re-verified rather than assumed
- [x] Theme parity with D-126, dark as a Settings choice
- [x] Technique and injury split into separate destinations
- [x] 2.4.0 (8) built and signed, both artifacts verified
- [ ] NEVER RUN ON A DEVICE

## 8. Report card
- [x] `report-card-2026-08-19.md`
