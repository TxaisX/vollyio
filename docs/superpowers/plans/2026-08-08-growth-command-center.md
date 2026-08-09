# Vollyio Growth Command Center Implementation Plan

**Goal:** Build a self-contained, editable Vollyio marketing and unit-economics dashboard that models organic growth, paid acquisition, and the route to a monthly profit target.

**Architecture:** One portable HTML document owns the interface, styles, default scenario, pure calculation functions, local scenario persistence, JSON transfer, and rendering. A Node validator extracts the pure model block from the HTML and exercises canonical unit-economics and funnel cases without adding dependencies.

**Tech Stack:** HTML, CSS, browser JavaScript, Node.js built-in test and VM modules.

## Global Constraints

- Use only Vollyio's existing navy, chalk, gold, teal, coral, and typography tokens.
- Do not modify the production application, pricing, billing, authentication, or entitlement code.
- Keep the artifact self-contained and functional without a server.
- Store scenarios only in browser local storage and validate imports before applying them.
- Distinguish cash collected, normalized revenue, contribution, and operating profit.
- Do not include vendor names, attribution, background grids, or third-party dependencies.

---

### Task 1: Calculation model and validator

**Files:**
- Create: `docs/vollyio-growth-command-center.html`
- Create: `scripts/validate-growth-command-center.mjs`

**Interfaces:**
- Produces: `sanitizeScenario(value)`, `calculateScenario(scenario)`, and `DEFAULT_SCENARIO` in the marked model block.
- Produces: a validation script that extracts the model block and asserts canonical unit economics, funnel behavior, and finite outputs.

- [x] **Step 1:** Write validator assertions for weekly contribution, annual contribution, organic customers, paid CAC, and finite outputs.
- [x] **Step 2:** Run `node.exe scripts/validate-growth-command-center.mjs` and confirm it fails because the dashboard does not exist.
- [x] **Step 3:** Add the HTML shell, default scenario, sanitizer, and pure calculation model.
- [x] **Step 4:** Run the validator and confirm all model assertions pass.

### Task 2: Editable dashboard interface

**Files:**
- Modify: `docs/vollyio-growth-command-center.html`

**Interfaces:**
- Consumes: `DEFAULT_SCENARIO`, `sanitizeScenario(value)`, and `calculateScenario(scenario)`.
- Produces: generated input controls using `data-path`, live metric cards, funnel visualization, channel tables, pricing outputs, and decision guidance.

- [x] **Step 1:** Add semantic navigation and sections for overview, assumptions, funnel, organic, paid, pricing, and decisions.
- [x] **Step 2:** Render all editable assumptions from field definitions and channel rows.
- [x] **Step 3:** Bind delegated input events to sanitized nested scenario updates and immediate recalculation.
- [x] **Step 4:** Add responsive styling, focus states, status labels, table scrolling, and print behavior.
- [x] **Step 5:** Run the validator and inspect the HTML for every required section and control.

### Task 3: Scenario workflow and resilience

**Files:**
- Modify: `docs/vollyio-growth-command-center.html`
- Modify: `scripts/validate-growth-command-center.mjs`

**Interfaces:**
- Consumes: the active sanitized scenario and renderer.
- Produces: local save, load, duplicate, reset, JSON export, validated JSON import, and status announcements.

- [x] **Step 1:** Add browser-local scenario persistence under one versioned storage key.
- [x] **Step 2:** Add duplicate, reset, export, and import actions with validation and accessible status text.
- [x] **Step 3:** Expand the validator to assert required controls, storage key, and import sanitizer boundaries.
- [x] **Step 4:** Run `node.exe scripts/validate-growth-command-center.mjs` and confirm all assertions pass.

### Task 4: Final verification and documentation

**Files:**
- Modify: `docs/vollyio-growth-command-center.html`

**Interfaces:**
- Produces: a verified portable dashboard with embedded usage guidance and source labels.

- [x] **Step 1:** Run the repository lint and dashboard validator.
- [x] **Step 2:** Open the file in a browser and verify desktop and 360px layouts, editing, saving, duplication safety, and local persistence.
- [x] **Step 3:** Review the final diff to confirm only the dashboard, validator, design specification, and plan changed.
