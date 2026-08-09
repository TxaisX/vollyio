# Vollyio Growth Command Center Design

## Goal

Build a self-contained browser dashboard that turns Vollyio's pricing, funnel, organic marketing, and paid advertising assumptions into an editable operating model.

## Audience and use

The dashboard is an owner tool, not a player-facing product surface. It must answer five questions without requiring a spreadsheet:

1. What do weekly and annual subscribers contribute after fees and usage?
2. How many customers and visitors are required to reach a monthly profit target?
3. Which organic channels are expected to create customers?
4. What can paid advertising afford to cost before it destroys margin?
5. Which current constraint deserves attention next?

## Format

The artifact is one HTML file in `docs/`. It runs without a server, has no external data connection, saves scenarios in browser local storage, and exports or imports JSON. It uses only HTML, CSS, and JavaScript.

## Information architecture

- Command bar: scenario selection, save, duplicate, export, import, and reset.
- Executive view: monthly billings, normalized revenue, operating profit, active customers, blended CAC, profit gap, and progress toward target.
- Assumptions: editable pricing, fees, usage, fixed costs, plan mix, retention, and current customer base.
- Funnel: visitor-to-signup, signup-to-account, activation, paid conversion, and the required traffic for the target.
- Organic planner: editable activity, traffic yield, and conversion assumptions for sharing, founder content, coaches, communities, creators, and search.
- Paid planner: editable budget, CPM, click-through rate, activation, paid conversion, and calculated CPC, CAC, ROAS, and payback.
- Pricing lab: weekly and annual contribution, margins, LTV, break-even CAC, and the annual discount relative to weekly.
- Decision panel: deterministic warnings and recommendations derived from current inputs.

## Calculation rules

- Payment fee per charge equals price multiplied by the percentage fee plus the fixed fee.
- Weekly contribution equals price minus payment fee minus analyses per week multiplied by analysis cost.
- Weekly lifetime contribution equals weekly contribution multiplied by retention weeks.
- Annual contribution equals price minus payment fee minus analyses per year multiplied by analysis cost.
- Paid funnel customers equal impressions multiplied by click-through, landing conversion, activation, and activated-to-paid conversion.
- Organic customers equal the sum of each channel's activity multiplied by visits per activity and its three conversion stages.
- Steady-state weekly active customers equal existing weekly customers plus new weekly customers per month multiplied by retention weeks divided by 4.345.
- Steady-state annual active customers equal existing annual customers plus new annual customers per month multiplied by 12 divided by one minus annual renewal rate. Renewal is capped below 100% for a finite model.
- Normalized monthly revenue recognizes weekly billing at 4.345 charges per month and annual billing at one twelfth of annual price.
- Operating profit subtracts payment fees, analysis usage, fixed costs, and paid media from normalized revenue.
- Cash collected and normalized revenue are displayed separately.

## Defaults

Defaults reflect the current commercial discussion: $7.99 weekly, $39.99 annual, $0.024 per analysis, 2.9% plus $0.30 payment fees, $46.25 monthly fixed costs, eight-week weekly retention, 50% annual renewal, and a $2,000 monthly operating profit target. Existing measured funnel values are labeled where used; all other values are explicitly editable assumptions.

## Visual system

Use Vollyio's navy, chalk, gold, teal, and coral tokens with Space Grotesk, Instrument Sans, and IBM Plex Mono. The layout must remain readable on mobile, use no background grid, avoid motion beyond ordinary interaction transitions, and not depend on color alone for status.

## Safety and boundaries

- Do not modify production pricing, billing, authentication, or entitlement code.
- Do not connect advertising accounts or external analytics.
- Do not transmit or persist data outside the current browser.
- Validate imported scenarios before applying them.
- Do not include vendor or model names in the interface.

## Acceptance criteria

- Every business assumption can be edited and recalculates immediately.
- Organic and paid channel outputs roll into the same acquisition and profit model.
- The dashboard distinguishes cash collected, normalized revenue, contribution, and operating profit.
- Scenarios can be saved, duplicated, reset, exported, and imported.
- Invalid inputs cannot create `NaN`, infinite output, or negative funnel counts.
- A built-in status panel explains whether CAC, conversion, retention, traffic, or pricing is the main constraint.
- The page is usable at 360px width and with keyboard navigation.

