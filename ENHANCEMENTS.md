# ENHANCEMENTS

Durable product/engineering backlog for the financial planning system. Grounded in the current architecture (Sheets → Apps Script → React bundle) and the Rolling Debt Payoff UX as it ships today. Intended to be consumed one item at a time.

---

## 1. Current product state

What is working well right now:

- **Rolling Debt Payoff is the main monthly decision tool.** It tells the user what to do *this month* with a single input (Cash to use now) and a single output (per-account payments + HELOC recommendation).
- **Standard vs Details split is intentional and holding.** Standard surface is four compact blocks (cash input, Decision card, HELOC card, Payment Result). Details is a power-user drawer behind one toggle.
- **HELOC section is simplified and decision-oriented.** `status` + `advised_draw` + the anchored **"What would change this?"** levers replace the previous wall of metrics. Advisor never mutates the waterfall.
- **"Why not more?" explains constraints and links to source data.** Near-term planned hold and unmapped card risk hold each have a `[View]` pill that routes to Cash Flow → Upcoming.
- **Payment Result supports execution via `[Add payment]` → Quick Add.** Per-row pill pre-fills Quick Add with the planner's `_paid` amount; save still goes through the normal `quickAddPayment` flow with its own audit entry.
- **Debt Overview is a reference layer, not a competing decision tool.** Structure/balances/minimums snapshot, no planner invocation — which removed the analysis-paralysis the old Payoff Path tab created.

---

## 2. Architectural strengths

- **Sheets as source of truth.** Every number is traceable to a user-owned cell. Auditable, editable, recoverable.
- **Apps Script as computation layer.** One public entry point per surface (`getRollingDebtPayoffPlan`, `quickAddPayment`, …). Heavy logic (waterfall, HELOC advisor, card-spend model) stays server-side where it belongs.
- **React bundle as decision UI.** Purely presentational. Fast to iterate on, strongly typed, and easy to reason about because it doesn't write data directly.
- **Mapping layer as contract.** `mapPlannerPayloadToRollingDebtPayoffDashboardData.ts` is the single seam between backend JSON and React types. Adding a field is a three-step ritual (emit → map → consume), but it's explicit and grep-able.
- **Host-global navigation/prefill pattern.** `window.prefillQuickPayment`, `window.showPage`, `window.showTab` give the React bundle a clean, testable bridge to host flows without tangling `google.script.run` into the component.
- **Standard / Details separation.** Protects the default surface from noise while still preserving full auditability for debugging and future power-user needs.

---

## 3. Key known gaps

### No automated regression harness
There is no integration or unit test suite; validation today is a manual checklist. Any waterfall or HELOC refactor has to be sanity-checked by eye, which slows down willingness to change the engine.

### Alias / payee mapping is hidden and hard to repair
The payee → debt map lives in code/config. When Upcoming Expenses or CF rows fail to map, the UI surfaces it as "unmapped card risk" but the user has no in-app way to fix the mapping. Fixes require a code edit.

### Client-side re-pour can drift slightly from backend truth
When the user types into "Cash to use now" below the Safe-to-use cap, the React layer re-pours allocations in-memory. For edge cases (small-balance payoffs, non-linear caps) the result can be off by a few dollars vs a fresh server run. Acceptable today; will hurt once we expose more strategies.

### Card spend model has approximation limits
Without a true statement-balance feed, CF card-expense rows are treated as *cash out* rather than *new spend*. The engine flags this (`credit_card_spend_confidence = LOW`) but the downstream HELOC realism check and unmapped-hold sizing carry that uncertainty silently.

### Aggressive strategy exists but is not product-defined or exposed
The allocator, validators, and Phase 2 audit are fully implemented. The toggle is hidden because the UX (Focus debt selection, confirmation, explanation) is not designed. Carrying dead UI paths is a tax on every engine change.

### Execution flow is improved but still distributed
`[Add payment]` is a big win, but execution still touches three surfaces (Rolling Debt Payoff → Cash Flow Quick add → LOG/Upcoming). There is no single "accept the plan" action, and no post-execution confirmation loop back into the planner.

---

## 4. Prioritized enhancement opportunities

### Tier 1 — Highest-value next improvements

**Confidence / assumptions layer**
- Why it matters: The planner already internally distinguishes high- and low-confidence inputs (`credit_card_spend_confidence`, `irregular_income_flag`, `unmapped_card_risk_hold > 0`, HELOC realism flags). None of that reaches the Standard surface. Users can't tell when a recommendation is rock-solid vs pattern-matched.
- System touchpoints: backend (expose existing flags on a stable field), mapping layer (add a typed `assumptions` block), React (one compact "What this is based on" strip under the Decision card).
- Risk: **Low.** Additive only; no math changes.
- Timing: **Now.**

**"Why this account?" explanation**
- Why it matters: The Payment Result table shows *what* is being paid but not *why that account*. For Focus debt especially, users ask "why this one, not another?" A one-line rationale per role (highest APR above $X; smallest balance under $Y; spill to next by balance cap) builds trust and teaches the model.
- System touchpoints: backend (emit a short reason code per row alongside `_paid`), mapping layer, React (tooltip or inline muted line per row).
- Risk: **Low.** Presentation on top of data the engine already knows.
- Timing: **Now.**

**Data quality / mapping transparency**
- Why it matters: The two biggest silent contributors to a conservative plan are (a) unmapped card-funded upcoming expenses and (b) low-confidence card spend. Today they're invisible unless you open Details. A visible "Data quality" indicator next to "Why not more?" makes the cause legible — even before we fix the underlying mapping.
- System touchpoints: backend (aggregate a small list of unmapped payees + low-confidence sources), mapping layer, React ("Why not more?" block extension).
- Risk: **Low.** Read-only exposure.
- Timing: **Now.**

**Stronger execution-readiness cues**
- Why it matters: `[Add payment]` works but there's no feedback loop — after a user adds a payment, the planner doesn't visibly acknowledge it on rerun. A simple "X of Y planned payments entered this month" cue turns the table into a checklist.
- System touchpoints: backend (cross-reference `LOG - Activity` Quick add rows against current-month planned payees), mapping layer, React (row-level ✓ or header counter).
- Risk: **Low–Medium.** Needs a stable match rule between planned payee and logged payee.
- Timing: **Now / Soon.**

### Tier 2 — High-value but more coupled

**Alias / mapping repair workflow**
- Why it matters: Fixes the root cause behind "unmapped card risk hold" and mis-classified CF rows. Today the only fix path is a code change.
- System touchpoints: backend (persisted alias table in a new `SYS - Aliases` sheet + resolver), Apps Script write endpoint, a small UI (likely inside Cash Flow or a dedicated "Payees" admin panel), and updates to every resolver that currently reads from the code-side map.
- Risk: **Medium.** New write surface + migration from code config to sheet.
- Timing: **Soon.**

**Reducing client/server allocation drift**
- Why it matters: Prevents the small-balance/edge-case drift from becoming visible or wrong as we expose more strategies. Could be solved either by (a) serving a pre-computed allocation table at multiple cap points, or (b) lightweight debounced server round-trip for exact truth.
- System touchpoints: backend (multi-cap allocation emitter or a fast sub-endpoint), mapping layer, React memo graph.
- Risk: **Medium.** Touches the hottest path in the UI.
- Timing: **Soon.**

**Improving card-spend accuracy**
- Why it matters: The card-spend model is the quiet driver of HELOC realism and unmapped-hold sizing. A true statement-balance ingest (even manual monthly entry) would upgrade `credit_card_spend_confidence` and tighten several decisions.
- System touchpoints: new INPUT sheet or column set, `buildHelocFlowSourceCardSpend_` + `buildHelocBillsCardObligationModel_` rewrites, confidence reclassification.
- Risk: **Medium–High.** Affects HELOC status/advised_draw downstream.
- Timing: **Soon.**

**Execution-flow streamlining**
- Why it matters: Reduces friction from "see plan → execute six payments → come back" to something closer to a guided flow. Could be as small as a "Return to Rolling Debt Payoff" button after Quick add save, or as ambitious as a per-month execution tray.
- System touchpoints: Cash Flow Quick add save handler (return address), Rolling Debt Payoff refetch hook, possibly a new summary strip.
- Risk: **Medium.** UX-heavy; easy to over-design.
- Timing: **Soon.**

### Tier 3 — Strategic / later

**Exposing Aggressive strategy safely**
- Why it matters: The allocator already exists; what's missing is the product wrapper — when it's appropriate, how Focus debt is chosen, confirmation UX, and guardrails against user surprise.
- System touchpoints: host strategy control (un-hide), Decision card (strategy-aware language), help/onboarding copy, validators.
- Risk: **Medium–High.** Product judgement heavier than code effort.
- Timing: **Later** (after confidence layer + readiness cues exist — they're prerequisites for trust).

**Larger workflow unification**
- Why it matters: Long-term, the sidebar dashboard and the web app dashboard should share a single set of fragments. Reduces the drift tax called out in `TODO.md` #16.
- System touchpoints: `PlannerDashboard.html`, `PlannerDashboardWeb.html`, includes refactor.
- Risk: **Medium.** Mechanical but touches every tab.
- Timing: **Later.**

**Deeper model simulations / what-if tools**
- Why it matters: Once confidence + assumptions are visible, users will ask "what if I deploy $X more?" or "what if APR on card Y drops?". Infrastructure for this mostly exists backend-side (`purchase_simulator.js`, yearly projections) — it's a UI + contract problem.
- System touchpoints: new React surface, new backend endpoint, careful isolation from the monthly decision surface to avoid noise.
- Risk: **High** if merged into Standard view; **Low** if kept as a dedicated Details or Planning sub-tab.
- Timing: **Later.**

**Broader regression / test harness investment**
- Why it matters: Every other Tier 2/3 item gets safer once there's a regression net around the waterfall and HELOC advisor. Today's manual checklist is the ceiling on refactor ambition.
- System touchpoints: test runner (clasp-friendly), fixtures for `INPUT - *` tabs, snapshot assertions on payload shape.
- Risk: **Medium.** Non-trivial setup; high long-term ROI.
- Timing: **Later** (but pulled forward if engine changes become frequent).

---

## 5. Recommended next item

**Confidence / assumptions layer.**

Why this is the best next move:

- **Value is immediate and visible.** Today the Decision card says *what* to do. Adding a tight "What this is based on" strip tells the user *how sure* the planner is — which is the missing piece behind almost every "should I trust this?" moment.
- **All the inputs already exist.** The engine already tracks `credit_card_spend_confidence`, `irregular_income_flag`, unmapped-hold presence, HELOC realism gates, and planned-expense hold sources. We don't have to compute anything new — we have to *surface* what's there.
- **Fits the current architecture cleanly.** Backend emits a new `assumptions` object, mapping layer types it, React renders a compact block under the Decision card. No waterfall changes, no new write surface, no navigation glue.
- **Safer than bigger changes right now.** Unlike the Tier 2 items (alias repair, drift reduction, card-spend accuracy) it doesn't change math, doesn't add write paths, and doesn't change the shape of any existing decision. Worst case: we hide it behind the Details toggle if it feels noisy.
- **It's a prerequisite for Tier 3 work.** Exposing Aggressive strategy safely, or any what-if tooling, only makes sense after users can read *why* the current recommendation looks the way it does.

First concrete step when we pick this up: enumerate the existing backend flags that should feed the layer, agree on a priority order (which gets shown first when multiple fire), and draft the three-to-five short sentences that render in the UI.

---

## 6. Enhancement guardrails

Rules that apply to every future change in this backlog:

- **Preserve Standard-mode simplicity.** New information lands in Details by default. It only graduates to Standard once it passes a "would this change a decision?" test.
- **Do not expose unfinished strategy choices.** Aggressive, what-if, and any new planner modes stay dark until their UX, explanation, and guardrails are designed.
- **Do not duplicate source-of-truth data.** Sheets are canonical. New UI reads; it does not cache, re-store, or shadow sheet state.
- **Prefer navigation to source pages over duplicating details.** The `[View]` and `[Add payment]` patterns are the template — point users at the real source, don't rebuild it inside the planner.
- **Keep React as presentation/navigation layer, not direct write layer.** All writes go through Apps Script endpoints, with `LOG - Activity` entries. The React bundle calls host globals; it does not call `google.script.run` for writes.
- **Add new logic backend-first, then map forward.** Emit from Apps Script → type in the mapping layer → consume in React. No parallel client-side derivations.
- **Execute one improvement area at a time and lock it before moving on.** Ship, document in `SESSION_NOTES.md` / `Dashboard_Help.html`, then pick the next one. No stacking half-shipped features.

---

## 7. Working method

How this backlog should be used:

- **Pick one enhancement at a time** from the prioritized list — start at the top of Tier 1 unless there's a reason to deviate.
- **Review current behavior first** in both backend (what fields exist today) and frontend (what the user sees). Confirm the gap is real in the current build.
- **Make scoped changes only.** Touch the minimum set of files — backend emitter, mapping, one React block, help copy. Resist the urge to refactor adjacent code "while we're in there."
- **Validate in UI.** Run `npm run build:rolling-dashboard`, load the web app, confirm the change in Standard and Details modes, confirm nothing moved in the existing compact cards.
- **Lock before moving to the next item.** Update `SESSION_NOTES.md`, update `Dashboard_Help.html` if user-facing, update `TODO.md` / this file's status if needed, then commit. Only then pick the next enhancement.
