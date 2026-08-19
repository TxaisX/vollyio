# Overnight work plan - 2026-08-19

Working list for the unattended session. Every item is either DONE with proof,
IN PROGRESS, or BLOCKED with the reason. The morning report card grades against
the "before" column.

## 1. Design: daylight on sand (D-126)
- [x] Palette measured against WCAG AA before adoption (contrast script, all pairs pass)
- [x] Token values remapped in place so existing usages keep their role
- [ ] Accent text sweep: `text-gold|teal|coral` -> `-ink` variants (light surfaces)
- [ ] Component layer rewritten for light UI (shadows, not glows)
- [ ] Dark mode retained via prefers-color-scheme (navy heritage)
- [ ] Visual verification at 5 viewports

## 2. Device-adaptive
- [ ] Audit every page at 360 / 390 / 414 / 768 / 1280 / 1920
- [ ] Safe-area insets for notched phones (env(safe-area-inset-*))
- [ ] Touch targets >= 44px, no horizontal scroll anywhere
- [ ] Dynamic viewport units (dvh) so mobile browser chrome stops clipping

## 3. Content truth pass
- [ ] Every page read for contradictions and false claims
- [ ] Numbers (allowances, prices, counts) reconciled against lib/plans.ts + offers.ts
- [ ] Lint rule added so a contradiction is caught mechanically, not by eye

## 4. Learn IA restructure (owner request)
- [ ] Technique: drop the "injury and recovery" and "training" tabs; those are
      not techniques. Keep indoor / grass-and-sand filtering, which is the
      environment split the scoring already uses.
- [ ] Injury & Recovery: its own section, containing only injury and recovery
- [ ] Expand the corpus: more drills, more rehab entries

## 5. Marketing: SEO / AEO
- [ ] Keyword research: volleyball, volleyball coach, beach/grass emphasis
- [ ] Metadata, JSON-LD, sitemap, robots, llms.txt audit
- [ ] AEO: answer-shaped content so assistants can cite the product

## 6. Business analysis
- [ ] Unit economics vs the goals (12 testers tomorrow, 14-day clock, then web marketing)
- [ ] What actually moves revenue, ranked by cost to reach

## 7. Android parity
- [ ] No web redirects anywhere (D-125 held)
- [ ] Theme parity with the new palette
- [ ] Same IA changes as web

## 8. Report card (before 99% of credits)
- [ ] Graded before/after per dimension, with evidence
