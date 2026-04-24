# ENHANCEMENTS

Durable product/engineering backlog for the financial planning system. Grounded in the current architecture (Sheets → Apps Script → React bundle) and the Rolling Debt Payoff UX as it ships today. Intended to be consumed one item at a time.

---

## 0. Current phase — V1.2 / controlled improvement mode (V1.1 closed out)

V1.1 is closed. See `SESSION_NOTES.md → V1 trust baseline — complete` and `SESSION_NOTES.md → V1.1 — Retirement Profile Integration (DOB Source of Truth)` for the phase-history summaries, `PROJECT_CONTEXT.md → Current phase` for the product framing, and `WORKING_RULES.md → Current phase` for the rules every V1.2 change runs under (identical rules to V1.1).

Scope for this phase:

- **In scope (V1.2):** small, localized polish that preserves existing populated-workbook behavior, and only after passing the blank + populated two-track manual checks in `TESTING_PLAN.md`. Candidates are pulled one at a time from `TODO.md → V1.2 work queue → V1.2 candidates`.
- **Out of scope for V1.2 unless explicitly approved:** large refactors (Queued — post Next Actions stabilization, full `dashboard_data.js` split, onboarding factory refactor, broader regression/test harness), any change to `doGet` / `includeHtml_` / snapshot shape, destructive sheet changes, and any item listed under `TODO.md → Later (post-V1.2 / future phase)`.

Items below that are fully delivered still carry their original "DELIVERED" tag so the rationale and history stay visible; they are not re-opened. Items tagged "DELIVERED" under a phase (1, 2, 3, …) are phase history, not V1.2 work.

### Active / Next / Later at a glance

Authoritative live queue lives in `TODO.md → V1.2 work queue`. Mirror here is short on purpose:

- **Active now:** *(none in flight — Bank Import Step 2a is queued; see `TODO.md → Bank Import — status & resume plan`)*
- **V1.2 candidates (A — immediate follow-ups, low risk):** Profile DOB parser symmetry (accept Date objects on save-side validation), Overview Retirement Outlook copy alignment with `needsProfileDob`, blank-workbook empty-state consistency sweep, copy/Help polish sweep.
- **V1.2 candidates (B — product improvements):** Profile completeness indicator / badge, better Retirement setup guidance / linking to Profile, optional spouse UX clarity (single vs partnered).
- **V1.2 candidates (C — future ideas, do not act yet):** legacy sheet cleanup tool (remove inert `Your Current Age` / `Spouse Current Age` rows on existing `INPUT - Retirement` sheets), Profile → other modules integration, notifications / SMS using the existing Profile phone field.
- **Deferred from V1.1 (re-qualify before pulling):** planner email guardrails telemetry (informational only), low-risk codebase cleanups, dead-code prune for the retirement profile integration (`readRetirementHouseholdSafe_`, `getRetirementHouseholdInputs_`, `writeRetirementHouseholdInputs_`, `saveRetirementBasics` stub).
- **Later (post-V1.2 / future phase):** onboarding factory refactor, Activity smart-undo Phases 2–4, Cash Strategy, HELOC advisor refinement, Plaid-style sync, broader regression / test harness, two-dashboards unification, and the other big-product items captured below and in `TODO.md → Historical backlog`.

### Delivered — retirement profile integration (V1.1 close-out)

Shipped end-to-end in V1.1 (commits `92c8673` → `6d25c0e`). **Profile is now the single source of truth for Date of Birth.** Full phase summary in `SESSION_NOTES.md → V1.1 — Retirement Profile Integration (DOB Source of Truth)`. Headlines:

- **Profile** gained **Date of Birth** plus a full spouse/partner block (`Spouse Name / Email / Phone / Address / Date of Birth`) in the flat `INPUT - Settings` store. Existing required fields (`Name`, `Email`) unchanged; all new fields optional.
- **Retirement** derives current age exclusively from Profile DOB. The Retirement Basics edit form is removed; per-scenario age fields are display-only (plain divs, no spinner arrows). A new `needsProfileDob` readiness state routes users to **Open Profile** when DOB is missing. The DOB parser accepts both Date objects and `YYYY-MM-DD` strings, fixing the silent Sheets-auto-date coercion bug. New `INPUT - Retirement` sheets no longer seed the now-unused age rows.
- **Backward compatibility preserved** — populated workbooks are untouched byte-for-byte. Legacy age rows on existing retirement sheets are left inert (no read, no write, no planner consumption). No forced migration.

### Delivered — Bank Import Step 1 scaffold (V1.2 prep)

**Bank Import — Step 1 Complete.** Scaffold shipped in commit `8ced838`. New file `bank_import.js` with three inert ensure helpers:

- `ensureImportStagingBankAccountsSheet_()` creates `SYS - Import Staging — Bank Accounts` with the 13-column staging header (bold, frozen), no data rows.
- `ensureImportIgnoredBankAccountsSheet_()` creates `SYS - Import Ignored — Bank Accounts` with the 7-column ignore registry (bold, frozen), no data rows.
- `ensureAccountsExternalIdColumn_(accountsSheet)` appends the `External Account Id` column to `SYS - Accounts` flush to the last non-empty header cell. Never reorders existing columns. Never writes to data rows.

What Step 1 explicitly **did not** ship: no ingestion logic, no UI, no planner impact. Existing modules do not call any of these helpers, so planner, overview, retirement, cash flow, and the manual bank account UI are unaffected on both populated and blank workbooks. Full scope, Step 2a plan, resume rules, and manual test checklist (A–E) live in `TODO.md → Bank Import — status & resume plan`.

### Delivered — Debts fast save + activity log + background planner (V1.2)

**Debts — Update field editing feels instant again.** Shipped in commit `c26c11c`. Planning → Debts → Update now shows a proper `Saving… → Saved.` status row, optimistically repaints the right-hand info panel with the saved value so users see the change without a server round-trip, refreshes the Overview snapshot (`refreshSnapshot()`), and fires `runPlannerAndRefreshDashboard()` as a **silent background RPC** so Rolling Debt Payoff and other planner-dependent cards catch up shortly after without blocking the save itself.

The previous behavior ran the debt planner inline inside `updateDebtField`, which held the UI on `Saving…` for several seconds on large workbooks. That inline call is gone; the planner now runs only after the save completes, off the critical path.

Every field edit is also written to `LOG - Activity` as a new **`debt_update`** event:

- Classified as **Debt** kind (`activity_log.js::classifyActivityKind_`).
- Dynamic action label from `debtUpdateActionLabel_()` — e.g. *Updated Account Balance to $54,000.00*, *Updated Int Rate to 7.50%*, *Updated Due Day to 15*, *Updated Credit Limit to $25,000.00*.
- **Amount** renders `—` instead of `$0.00` (added to `activityLogIsNonMonetaryEvent_`) so field edits don’t double-count against Activity totals.
- Previous + new raw + display values and the `fieldKind` (currency / percent / integer / text) are preserved in the event’s `details` JSON (`detailsVersion: 1`) for future undo tooling — no second lookup needed when a revert action is built later.

User-facing Help was also updated: `Dashboard_Help.html` → *Planning → Debts → Update* (new flow description), Activity log (`debt_update` event), Amount column description (non-monetary list), and Remove button greyed-out list.

### Delivered — Quick Add robust Saving… indicator + $0 amount allowed (V1.2)

**Quick Add — reliable click→Saving…→Saved feedback, and $0 is now a legitimate amount.** Shipped in commits `098fef0` → `29f29a2`.

Client-side (`Dashboard_Script_Payments.html::savePayment()`): the status row below **Add to Cash Flow** now layers plain-text `setStatus('pay_status', 'Saving…', false)` under `setStatusLoading(…)`. This mirrors the proven pattern from the legacy sidebar `PlannerDashboard.html::savePayment()` and ensures the label appears between click and `Saved to Cash Flow.` regardless of deploy timing or CSS state drift. On success, the status flips to the backend-supplied *Saved to Cash Flow.* message.

Server-side (`quick_add_payment.js::quickAddPayment`): amount validator relaxed from `amount <= 0` to `isNaN(amount) || amount < 0`, with new error message *Amount must be a valid number.* `Math.abs()` already coerces the stored value, so the negative branch is defensive only. Users can now save $0 on Quick add to:

- Zero out a month cell (e.g. reset a budget line).
- Correct a prior bad entry down to 0.
- Seed a placeholder payee row so it shows up in Bills Due / Upcoming selectors before the first real payment lands.

Scope discipline: Upcoming Expenses (`upcoming_expenses.js:193`), Income Sources (`income_sources.js:382`), and the Purchase Simulator (`purchase_simulator.js:29`) still require `amount > 0`. Those are different forms with different semantics and were intentionally left alone.

Help updated: `Dashboard_Help.html` → Cash Flow → Quick add now documents `$0` is a valid amount and describes the Saving… → Saved status feedback.

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

## 0. Locked product decisions

Decisions below are settled. Do not casually revisit them inside an enhancement — revisiting requires its own explicit product conversation.

- Rolling Debt Payoff is the primary monthly decision tool.
- Standard vs Details split is intentional and must be preserved.
- Debt Overview remains a reference layer, not a decision tool.
- Aggressive strategy remains hidden until fully product-defined.
- React bundle is presentation/navigation only (no direct writes).
- Navigation to source pages (`[View]` / `[Add payment]`) is preferred over duplicating detail inside the planner.

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
`[Add payment]` is a big win, but execution still touches three surfaces (Rolling Debt Payoff → Cash Flow Quick add → LOG/Upcoming). There is no single "accept the plan" action, and no post-execution confirmation loop back into the planner. This is acceptable for now and aligns with the current separation of concerns (decision layer vs. write layer), but leaves room for future streamlining.

---

## 4. Prioritized enhancement opportunities

### Tier 1 — Highest-value next improvements

**Decision Layer — "Next Actions" entry point (Phase 1) — DELIVERED (v1)**
- Status: **Delivered.** Live as the featured Planning entry point. Backed by `getNextActionsData()` (backend aggregator) + `getCashToUse()` (conservative liquidity model). Help section `#help-next-actions` documents current behavior.
- Why it matters: Previously the input / execution layer (Bills, Upcoming, Debts, Bank Accounts, Cash Flow, LOG) was complete but users still had to open five tabs to decide *"what should I do next?"* Next Actions v1 closes that gap with a single, low-noise entry point on top of Planning.
- What v1 ships: compact summary row (Cash to use / Due soon / Available after urgent), Urgent / Recommended / Optimize buckets, grouped "Other bills due soon" tail row for urgent noise control, collapsed "Why this cash amount?" disclosure for liquidity auditability, and per-card "Open …" routing into the existing deep-dive tools via `showTab()`.
- Guardrails held: action-first, no editing, short lists; single payment path remains Cash Flow → Quick Add; no new sheets / columns; Planning's existing deep-dive tools are untouched and accessible via the secondary "Planning tools" row.
- Risk retained: **Low.** Still read-only aggregation over already-canonical sheets; no write path.

**Next Actions — v1 decision-logic design (delivered; reference)**

The full spec lives in `PROJECT_CONTEXT.md → Decision Layer → Next Actions v1 — design note`. Summarized here as the delivered implementation contract:

- **Action object shape** — `priorityBucket` (`urgent` | `recommended` | `optimize`), `actionType`, `title`, `reason`, `amount`, `dueDate`, `sourceEntity {type, name}`, `target {page, tab}`.
- **Priority buckets** —
  - `urgent` = overdue / due soon / unpaid minimums / near-term obligations / cash gap.
  - `recommended` = next best moves once urgent is covered.
  - `optimize` = optional improvements only after urgent is safe.
- **Action types (v1)** — `pay_bill`, `pay_debt_minimum`, `pay_upcoming`, `finish_upcoming`, `review_cash_gap`, `pay_extra_debt`. HELOC strategy is intentionally **not** a Next Actions action type; it lives on the Rolling Debt Payoff *HELOC strategy* card.
- **Data sources (no new ones)** — `INPUT - Bills` (active), `INPUT - Upcoming Expenses` (remaining balance only), `INPUT - Debts` (active), bank / usable cash via the existing liquidity model (`SYS - Accounts` → Safe-to-use / Available Now / Min Buffer), and the existing `getRollingDebtPayoffPlan` output. No engine re-run.
- **Deterministic rules** — build urgent obligations first; compare `sum(urgent)` vs cash-to-use; emit `review_cash_gap` at the top of `urgent` when obligations exceed cash and suppress `recommended` money-movement until resolved; the preferred extra-debt target is the Rolling Debt Payoff focus debt.
- **Explainability rule** — every emitted action must be describable in **one sentence** from the current snapshot (amount / due date / remaining balance / bucket rule / Rolling-Debt-Payoff reason code). If not, it's not emitted.
- **Non-goals (v1)** — retirement optimization, investment allocation advice, purchase simulation, scenario / what-if planning, automatic execution. Quick Add remains the single payment path; Next Actions only routes.

Implementation order, as shipped: backend aggregator (`next_actions.js::getNextActionsData`) + liquidity reader (`cash_to_use.js::getCashToUse`) landed first, followed by the Planning → Next Actions panel (`Dashboard_Body.html` + `Dashboard_Script_PlanningNextActions.html`) rendering the three bucket groups, then help copy (`#help-next-actions`). No mapping-layer changes were needed — the panel calls the backend directly via `google.script.run`, not through the Rolling Debt Payoff React bundle.

**Next Actions — v1 liquidity model (`cash_to_use`) — delivered**

Foundation for Next Actions v1. Full spec lives in `PROJECT_CONTEXT.md → Decision Layer → Liquidity model v1 — cash_to_use`. Delivered contract:

- **Scope** — conservative, buffer-respecting, current-state dollars **safely available right now**. Not the same as Rolling Debt Payoff's *Safe-to-use* (which folds in near-term holds, reserves, and unmapped card risk). Keep the two models separate.
- **Inputs** — Bank Accounts only: `balance`, `minBuffer`, `active`, `usePolicy` from `INPUT - Bank Accounts` + `SYS - Accounts`. No new sheets, no new columns.
- **Formula** — `usable = max(0, balance - minBuffer)` per account; `cash_to_use = Σ usable` over eligible accounts.
- **Eligibility** — active accounts only (shared inactive rule); exclude explicit restricted / do-not-use accounts; v1 Use Policy is a binary include/exclude (finer policies stay for Phase 2 Cash Strategy).
- **Output** — `{ cashToUse, accounts: [{ name, balance, minBuffer, usable, included, excludedReason? }] }`. The per-account array is part of the contract so the UI can show the breakdown and any excluded-reason.
- **Consumers in Next Actions** — compares `cashToUse` vs `sum(urgent)`, drives `review_cash_gap`, and feeds leftover to `pay_extra_debt`.
- **Guardrails** — never negative per account; buffers are sacred; no future-income, pending-transfer, or timing assumptions; no credit / HELOC / investments. HELOC strategy lives on the Rolling Debt Payoff *HELOC strategy* card, not in Next Actions.
- **Non-goals (v1)** — no forecasting, no time-based modeling, no cross-account optimization.

Ship ordering held: the reader landed **before** the Next Actions aggregator and is called from it directly. Exposed as a single server entry point returning the output object above; no changes to Bank Account editors or the existing liquidity consumers (Rolling Debt Payoff keeps its richer model unchanged).

**Decision Layer roadmap**
- **Phase 1 — Next Actions (v1).** ✅ Delivered. First landing surface inside Planning.
- **Phase 2 — Cash Strategy.** Later. Intended to pair Next Actions with a forward-looking liquidity / deployment view. Not scoped yet.
- **Phase 3 — HELOC Advisor refinement.** Later. Continues the existing advisor-anchored "What would change this?" pattern. Not scoped yet.

**Confidence / assumptions layer**
- Status: Proposed
- Why it matters: The planner already internally distinguishes high- and low-confidence inputs (`credit_card_spend_confidence`, `irregular_income_flag`, `unmapped_card_risk_hold > 0`, HELOC realism flags). None of that reaches the Standard surface. Users can't tell when a recommendation is rock-solid vs pattern-matched.
- System touchpoints: backend (expose existing flags on a stable field), mapping layer (add a typed `assumptions` block), React (one compact "What this is based on" strip under the Decision card).
- Risk: **Low.** Additive only; no math changes.
- Timing: **Now.**

**"Why this account?" explanation**
- Status: Proposed
- Why it matters: The Payment Result table shows *what* is being paid but not *why that account*. For Focus debt especially, users ask "why this one, not another?" A one-line rationale per role (highest APR above $X; smallest balance under $Y; spill to next by balance cap) builds trust and teaches the model.
- System touchpoints: backend (emit a short reason code per row alongside `_paid`), mapping layer, React (tooltip or inline muted line per row).
- Risk: **Low.** Presentation on top of data the engine already knows.
- Timing: **Now.**

**Data quality / mapping transparency**
- Status: Proposed
- Why it matters: The two biggest silent contributors to a conservative plan are (a) unmapped card-funded upcoming expenses and (b) low-confidence card spend. Today they're invisible unless you open Details. A visible "Data quality" indicator next to "Why not more?" makes the cause legible — even before we fix the underlying mapping.
- System touchpoints: backend (aggregate a small list of unmapped payees + low-confidence sources), mapping layer, React ("Why not more?" block extension).
- Risk: **Low.** Read-only exposure.
- Timing: **Now.**

**Stronger execution-readiness cues**
- Status: Proposed
- Why it matters: `[Add payment]` works but there's no feedback loop — after a user adds a payment, the planner doesn't visibly acknowledge it on rerun. A simple "X of Y planned payments entered this month" cue turns the table into a checklist.
- System touchpoints: backend (cross-reference `LOG - Activity` Quick add rows against current-month planned payees), mapping layer, React (row-level ✓ or header counter).
- Risk: **Low–Medium.** Needs a stable match rule between planned payee and logged payee.
- Timing: **Now / Soon.**

### Tier 2 — High-value but more coupled

**Alias / mapping repair workflow**
- Status: Proposed
- Why it matters: Fixes the root cause behind "unmapped card risk hold" and mis-classified CF rows. Today the only fix path is a code change.
- System touchpoints: backend (persisted alias table in a new `SYS - Aliases` sheet + resolver), Apps Script write endpoint, a small UI (likely inside Cash Flow or a dedicated "Payees" admin panel), and updates to every resolver that currently reads from the code-side map.
- Risk: **Medium.** New write surface + migration from code config to sheet.
- Timing: **Soon.**

**Reducing client/server allocation drift**
- Status: Proposed
- Why it matters: Prevents the small-balance/edge-case drift from becoming visible or wrong as we expose more strategies. Could be solved either by (a) serving a pre-computed allocation table at multiple cap points, or (b) lightweight debounced server round-trip for exact truth.
- System touchpoints: backend (multi-cap allocation emitter or a fast sub-endpoint), mapping layer, React memo graph.
- Risk: **Medium.** Touches the hottest path in the UI.
- Timing: **Soon.**

**Improving card-spend accuracy**
- Status: Proposed
- Why it matters: The card-spend model is the quiet driver of HELOC realism and unmapped-hold sizing. A true statement-balance ingest (even manual monthly entry) would upgrade `credit_card_spend_confidence` and tighten several decisions.
- System touchpoints: new INPUT sheet or column set, `buildHelocFlowSourceCardSpend_` + `buildHelocBillsCardObligationModel_` rewrites, confidence reclassification.
- Risk: **Medium–High.** Affects HELOC status/advised_draw downstream.
- Timing: **Soon.**

**Execution-flow streamlining**
- Status: Proposed
- Why it matters: Reduces friction from "see plan → execute six payments → come back" to something closer to a guided flow. Could be as small as a "Return to Rolling Debt Payoff" button after Quick add save, or as ambitious as a per-month execution tray.
- System touchpoints: Cash Flow Quick add save handler (return address), Rolling Debt Payoff refetch hook, possibly a new summary strip.
- Risk: **Medium.** UX-heavy; easy to over-design.
- Timing: **Soon.**

### Tier 3 — Strategic / later

**Exposing Aggressive strategy safely**
- Status: Proposed
- Why it matters: The allocator already exists; what's missing is the product wrapper — when it's appropriate, how Focus debt is chosen, confirmation UX, and guardrails against user surprise.
- System touchpoints: host strategy control (un-hide), Decision card (strategy-aware language), help/onboarding copy, validators.
- Risk: **Medium–High.** Product judgement heavier than code effort.
- Timing: **Later** (after confidence layer + readiness cues exist — they're prerequisites for trust).

**Larger workflow unification**
- Status: Proposed
- Why it matters: Long-term, the sidebar dashboard and the web app dashboard should share a single set of fragments. Reduces the drift tax called out in `TODO.md` #16.
- System touchpoints: `PlannerDashboard.html`, `PlannerDashboardWeb.html`, includes refactor.
- Risk: **Medium.** Mechanical but touches every tab.
- Timing: **Later.**

**Deeper model simulations / what-if tools**
- Status: Proposed
- Why it matters: Once confidence + assumptions are visible, users will ask "what if I deploy $X more?" or "what if APR on card Y drops?". Infrastructure for this mostly exists backend-side (`purchase_simulator.js`, yearly projections) — it's a UI + contract problem.
- System touchpoints: new React surface, new backend endpoint, careful isolation from the monthly decision surface to avoid noise.
- Risk: **High** if merged into Standard view; **Low** if kept as a dedicated Details or Planning sub-tab.
- Timing: **Later.**

**Broader regression / test harness investment**
- Status: Proposed
- Why it matters: Every other Tier 2/3 item gets safer once there's a regression net around the waterfall and HELOC advisor. Today's manual checklist is the ceiling on refactor ambition.
- System touchpoints: test runner (clasp-friendly), fixtures for `INPUT - *` tabs, snapshot assertions on payload shape.
- Risk: **Medium.** Non-trivial setup; high long-term ROI.
- Timing: **Later** (but pulled forward if engine changes become frequent).

### Queued — post Next Actions stabilization

Captured-but-not-scheduled product work. These items are *intent only* — structure and constraints are pinned here so they do not drift, but no implementation should start until overlap cleanup and Next Actions stabilization are complete (see **Prioritization order** at the end of this subsection).

**Debug mode control**
- Status: Proposed
- Purpose: Hide developer / debug information from normal users so the default surface reads as a product, not a diagnostics page.
- Concept: Introduce a single global `isDebugMode` flag (host-global, same pattern as `window.showTab` / `window.prefillQuickPayment`). No per-surface toggles.
- Debug-only items (hidden by default; shown only when `isDebugMode` is true):
  - "Why this cash amount?" liquidity breakdown on Next Actions.
  - Any explicit debug / internal-reasoning labels surfaced in the current UI (planner diagnostics, allocation audit, cash-bridge audit on Rolling Debt Payoff when appropriate, etc. — inventory on implementation).
  - Raw JSON exports where they don't aid a normal user.
- User-facing mode shows: summary rows, action cards, decision cards, payment result, help text. Nothing that requires internal vocabulary to read.
- Non-goals (v1): no user-visible toggle control is required in v1 — the flag can be a URL / query-string switch or a session-local key. Designing a "Developer mode" settings UI is a later pass.
- System touchpoints: new host-global, a shared `isDebugMode()` helper consumed by the affected render functions; **no** backend changes; **no** new sheets.
- Risk: **Low.** Pure presentation gating.
- Timing: **After** Next Actions stabilization (see prioritization order below).

**Income Sources (new input surface)**
- Status: Proposed
- Purpose: Give users a structured place to record income so future planning surfaces (forecast, Cash Strategy, onboarding) have a canonical read target. Replaces today's implicit "income = whatever shows up as Cash Flow inflow."
- Proposed location: **Assets → Income Sources** (primary candidate) or **Cash Flow → Income Setup** (fallback). Decide on location during design; do not implement both.
- Canonical fields (v1):
  - `source name` (string)
  - `amount` (number)
  - `frequency` (enum: weekly / biweekly / semimonthly / monthly / quarterly / annual — pin the exact list at design time)
  - `active` (boolean, same inactive rule as the rest of the app)
- Non-goals (v1):
  - No planner integration. Rolling Debt Payoff continues to derive income exactly as it does today (Cisco + configured recurring rent payees, variable-income 50/30/20 split). Income Sources is **not** read by the waterfall in v1.
  - No forecasting. No 12-month projected income timeline from these rows.
  - No automatic Cash Flow posting. Rows here do not mint `INPUT - Cash Flow` entries or LOG rows on their own. Quick Add stays the only write path.
- System touchpoints: new `INPUT - Income Sources` sheet (columns match the v1 fields + `Active`); Apps Script reader following the existing reader patterns (`readSheetAsObjects_` + a small `normalizeIncomeSources_`); a new panel (location TBD) with the usual Add / Update / Stop tracking actions and a matching `income_source_add` / `income_source_deactivate` event type in `LOG - Activity`. No mapping layer or React bundle changes.
- Risk: **Low–Medium.** New write surface, but it is isolated — nothing else reads these rows in v1.
- Timing: **After** debug mode (see prioritization order).

**Onboarding (Phase 1)**
- Status: **Delivered** as **Setup / Review** (top-right dashboard button).
- Purpose: Guide a household through first-time setup instead of handing them an empty workbook. Reduces the cliff between "I opened CashCompass" and "I can trust the numbers on Next Actions."
- Delivered scope (in order, as implemented):
  - **Welcome** screen → **status grid** (card per step with *Setup complete* / *Not set up* badge and short summary).
  - **Bank Accounts** detail — reads the current-year block on `INPUT - Bank Accounts`.
  - **Debts** detail — reads active rows from `INPUT - Debts`.
  - **Bills** detail — reads active rows from `INPUT - Bills`.
  - **Upcoming Expenses** detail — reads *Planned* rows from `INPUT - Upcoming Expenses`.
  - **Income** detail — derived from the latest `INPUT - Cash Flow <year>`; **no** `INPUT - Income Sources` sheet. Recurring detections are grouped conservatively; excluded categories (Bonus, RSU, ESPP, Refund, …) are surfaced as "Other detected income".
  - **Finish** summary — per-step status list with *Review* deep-links and a *Go to Next Actions* CTA.
- Editor handoff:
  - Every per-step CTA opens the **existing** editor (Bank Accounts, Debts, Bills, Upcoming, Cash Flow → Income) in **Setup mode**: main top nav, page sub-tabs, *Setup / Review*, and *Run Planner + Refresh Snapshot* are hidden; a slim **Back to Setup** bar returns the user to the matching detail screen. Normal navigation to the same editor is unchanged.
- Sheet safeguards:
  - Setup creates `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, and `INPUT - Upcoming Expenses` with canonical headers when missing, reusing existing codebase schema (e.g. `getDebtsHeaderMap_`, `getOrCreateUpcomingExpensesSheet_`). It does **not** invent Cash Flow year sheets — if the latest year is missing, the Income step reports that explicitly.
- Read-only guarantee:
  - Viewing Setup never writes, never touches `SYS -` sheets, and never appends to `LOG - Activity`. Writes only happen through the underlying editors, which use the same save logic as the normal path.
- Non-goals (still intentionally out of scope):
  - No advanced strategy content (HELOC, Aggressive payoff, Cash Strategy, what-if tools).
  - No automated import; Setup guides *where* and *in what order*, not *what* to type.
  - No gamification or progress persistence — this is a walkthrough, not a state machine.
- Documentation: Help copy lives in `Dashboard_Help.html → Setup / Review` (`#help-setup`). Product framing is in `PROJECT_CONTEXT.md → Setup / Review (Onboarding Phase 1, delivered)`.
- Follow-ups (tracked in `PROJECT_CONTEXT.md`): retire `?onboarding=test` / `TEST -` fallbacks; consolidate the five per-step `*SetStatus_` / `*LoadDetail_` / `*RenderDetail_` / `*Open*Page` groups in `Dashboard_Script_Onboarding.html` into a shared factory once the flow has been exercised in real use.

**Prioritization order (for the queued items above)**

Do not shuffle without an explicit product decision:

1. **Finish overlap cleanup.** The Next Actions / Debt Overview / Rolling Debt Payoff cleanup pass (duplicate decision content removed, cross-links added, Next Actions wording tightened) must land cleanly before any new surface work begins. This is the current in-flight work.
2. **Stabilize Next Actions.** Let the v1 decision surface bake against real daily use: confirm urgent grouping, recommended sizing, routing, and "Why this cash amount?" disclosure all hold under normal household operation. No new queued items start while Next Actions is still being corrected.
3. **Debug mode control.** First net-new item. Smallest scope, lowest risk, unblocks the rest by ensuring debug/internal content has a single gating pattern before more surfaces add their own.
4. **Income Sources.** Structured income input. Can land without planner integration because debug mode already hides work-in-progress surfaces from normal users if needed.
5. **Onboarding (Phase 1).** **Delivered** as *Setup / Review*. Built after debug mode and in place of a standalone Income Sources surface — income is now managed inside Setup from the latest `INPUT - Cash Flow <year>`. Remaining onboarding follow-ups are scoped to TEST-mode retirement and an internal factory refactor of the per-step client handlers; neither changes user-visible behavior.

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
- **Rebuild the React bundle after any component change.** `RollingDebtPayoffDashboardBundle.html` is a prebuilt artifact. Any edit to `components/*.tsx` or the mapping layer requires running `npm run build:rolling-dashboard`. Skipping this step means UI changes will not appear in the dashboard.

---

## 7. Working method

How this backlog should be used:

- **Pick one enhancement at a time** from the prioritized list — start at the top of Tier 1 unless there's a reason to deviate.
- **Review current behavior first** in both backend (what fields exist today) and frontend (what the user sees). Confirm the gap is real in the current build.
- **Make scoped changes only.** Touch the minimum set of files — backend emitter, mapping, one React block, help copy. Resist the urge to refactor adjacent code "while we're in there."
- **Validate in UI.** Run `npm run build:rolling-dashboard`, load the web app, confirm the change in Standard and Details modes, confirm nothing moved in the existing compact cards.
- **Lock before moving to the next item.** Update `SESSION_NOTES.md`, update `Dashboard_Help.html` if user-facing, update `TODO.md` / this file's status if needed, then commit. Only then pick the next enhancement.
