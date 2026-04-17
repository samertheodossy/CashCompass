# CashCompass — System Briefing

A personal financial planning app built on top of Google Sheets. Two consumption surfaces today: a **web dashboard** (Apps Script `doGet`) and a **spreadsheet sidebar**. Product tagline: *Guiding your money decisions.*

---

## 1. High-level architecture

Three layers, loosely coupled:

- **Data layer — Google Sheets workbook.** Authoritative source of truth for every number. Split into:
  - `INPUT - *` tabs — user-edited inputs (Cash Flow, Debts, Bills, House Values, Bank Accounts, Investments, Donations, Upcoming Expenses).
  - `SYS - *` tabs — sheet-side rollups (Accounts, Assets, House Assets); refreshed by planner runs but never *originate* user data.
  - `HOUSES - {Property}` — per-property expense ledgers.
  - `OUT - History` — planner run snapshots (rolled-up totals, one row per run).
  - `LOG - Activity` — discrete event audit log (Quick add, bill skip/autopay, house expense, donation, upcoming lifecycle, bank add).

- **Backend — Google Apps Script (server-side JavaScript).** One large module set. The important files for this briefing:
  - `rolling_debt_payoff.js` — the decision engine (~8k LOC). Single public entry point: `getRollingDebtPayoffPlan(options)`.
  - `planner_core.js` — shared debt normalization, alias map, waterfall primitives.
  - `dashboard_data.js` — general dashboard snapshot + Bills Due + net-worth baselines.
  - `quick_add_payment.js` — the Quick Add entry point (`quickAddPayment`, `getQuickAddPreview`, prefill API).
  - `activity_log.js` — `LOG - Activity` writes + dashboard reads.
  - Feature files (`bank_accounts.js`, `investments.js`, `house_values.js`, `house_expenses.js`, `donations.js`, `upcoming_expenses.js`, `debts.js`, `property_performance.js`, `retirement.js`, `purchase_simulator.js`).
  - `webapp.js` (`doGet`), `html_includes.js` (`includeHtml_` — raw content, no nested templates).

- **UI layer — two flavors:**
  - **HTML/JS dashboard** (`PlannerDashboardWeb.html` wrapper + `Dashboard_Body.html` + a set of `Dashboard_Script_*.html` includes and `Dashboard_Styles.html`). Per-tab script modules (render, bills-due, payments, house values, bank/investments, donations, activity, etc.). This is where 90% of tabs live.
  - **Prebuilt React bundle for Rolling Debt Payoff** — `components/RollingDebtPayoffDashboard.tsx` + `components/mapPlannerPayloadToRollingDebtPayoffDashboardData.ts`, compiled into `RollingDebtPayoffDashboardBundle.html`. Embedded inside the same host page; it talks to the host via a small set of globals.

**Data flow**

- **Read path (dashboard render):** Host JS calls `google.script.run.someBackendFn()` → Apps Script reads Sheets → returns a JSON payload → host JS renders (or, for Rolling Debt Payoff, passes the payload into the React bundle via `mapPlannerPayloadToRollingDebtPayoffDashboardData`).
- **Write path (Quick Add, skip, save):** UI form → `google.script.run.quickAddPayment(payload)` (or equivalent) → backend writes the INPUT sheet cell, optionally updates a dependent tab, appends a `LOG - Activity` row, optionally triggers a debt-planner rerun → returns a result → UI updates status line + calls `loadDashboardData` / `loadBillsDueUi_` / etc. to refresh the affected panel.
- **Cross-feature handoff (the new pattern):** The Rolling Debt Payoff React bundle triggers host-owned flows via window globals (`window.prefillQuickPayment`, `window.showPage`, `window.showTab`). The React side never calls `google.script.run` directly for writes.

---

## 2. Core models and data structures

### 2.1 Cash model (liquidity)

Computed per run by `rolling_debt_payoff.js` from `SYS - Accounts`. Delivered to the UI as the `liquidity` block:

- `total_cash` — sum of all liquid balances.
- `reserve` — sum of balances on accounts flagged `DO_NOT_TOUCH` (hard-earmarked).
- `buffer` — sum of per-account `Min Buffer` for non-`DO_NOT_TOUCH`, policy-eligible accounts.
- `cash_available_to_use` — `total_cash − reserve − buffer` (before upcoming holds).
- `near_term_planned_hold` — cash reserved for planned `INPUT - Upcoming Expenses` within a 90-day window.
- `unmapped_card_risk_hold` — safety reserve for card-funded planned expenses that cannot be matched to a known debt/card payee.
- `deployable_max_calculated` (a.k.a. **Safe to use**) — `cash_available_to_use − near_term_planned_hold − unmapped_card_risk_hold`, floored at 0.
- `cash_to_use_now` — the user's live input.
- `execute_now` — `min(cash_to_use_now, deployable_max_calculated)`.

The legacy $100k reserve / $100k buffer / $50k monthly cap constants still exist in the code for audit, but are not used in the numbers the user sees.

### 2.2 Debt model

Normalized by `planner_core.js → normalizeDebts_` from `INPUT - Debts`:

- `accountName`, `type` (Credit Card / Loan / HELOC / other), `currentBalance`, `minPayment`, `apr`, `active`.
- Priority class: `LOW_RATE_KEEP_LAST` is applied automatically to any debt with APR ≤ 2.25% or the specific name `Loan Depot - San Jose House`.
- Debt minimums are **reference only** in Rolling Debt Payoff — actual cash-out comes from `INPUT - Cash Flow`, so minimums are never double-counted on top of what the user already paid via CF.

### 2.3 Payment / allocation model

The monthly waterfall, built inside `rolling_debt_payoff.js` (`rollingRunStrictExecuteWaterfall_` and friends). Conceptually:

1. **Small balances first** (`Cleanup` bucket) — pay off low-balance accounts to simplify and free minimum payments.
2. **Focus debt** (`Primary`) — the highest-priority target after cleanup, usually the highest-APR active credit card.
3. **Next debt** (`Secondary`) — spill if Focus debt is balance-capped or the strategy calls for it.
4. **Excess** (`Overflow`) — anything that doesn't fit the above (e.g. low-rate lines kept last).

Per-account output (`_paid` in allocation audit, `row.paid` in the React table) is the dollar amount the plan actually applied this month to that account, above and beyond what Cash Flow already contributed. The Payment Result table shows only accounts the plan *touches* this month.

**Two strategies exist internally:**

- **Standard** — the conservative default. Cleanup first, then Primary, spill to Secondary at cap.
- **Aggressive (Phase 2)** — concentrates ~90% of the post-cleanup remainder onto Focus debt before spilling. Audited by `buildAggressivePhase2Audit_` and validated against Focus debt balance caps.

The engine names (`Cleanup / Primary / Secondary / Overflow`) are internal; the UI exposes them as **Small balance / Focus debt / Next debt / Excess** via a single constant (`PAYMENT_RESULT_ROLE_LABEL`).

### 2.4 HELOC model

The HELOC advisor is a **decision-support layer**, not a mutator — it never changes the waterfall, it only recommends where to apply cash.

Inputs (derived by backend, consumed by `buildHelocAdvisorSnapshot` in the mapping layer):

- HELOC debt line (balance, APR, minimum) from `INPUT - Debts`.
- Eligible debts (active debts whose APR beats the HELOC by a required spread).
- Recurring monthly repayment capacity (free cash after baseline ops + min payments).
- One-time cash from `cash_to_use_now` (after reserving near-term holds).
- Planned-expense exposure in the next 120 days (especially card-funded ones → double-debt-trap risk).
- Recurring monthly card spend signal (used for realism) — split into *typical* and *spiky* sources with `sourceDecision` / `spikySourceDecision` labels.
- Optional credit-limit estimate; draw is capped at roughly 30–40% of limit when known.

Outputs:

- `status` — `recommended` / `not_recommended` / `blocked` with a reason.
- `advised_draw` — sized against eligible debt balances, future-expense exposure, and the repayment capacity needed to clear it within 9–12 months.
- **"What would change this?"** bullets — anchored, named levers (APR spread, repayment capacity, upcoming-expense hold, card-spend burden) each with its current value.
- **Trap risk** flag when a HELOC draw would clear cards that the user is very likely to re-run up (based on the card-spend model).

### 2.5 Card spend model

Produced by `buildHelocFlowSourceCardSpend_` + `buildHelocBillsCardObligationModel_` + combined by `buildHelocCardSpendCombinedPayload_`.

- **Recurring monthly card spend** — estimated from recent months of CF data plus the INPUT - Bills card obligations.
- **Spiky component** — separately tracked (e.g. tuition, large one-offs).
- Each has a `sourceDecision` enum (e.g. `bills_dominated`, `bills_only`, `cash_flow_majority`, etc.) that the UI uses to pick a short human label.
- Feeds the HELOC realism layer (post-card-spend effective repayment capacity) and the "unmapped card risk hold" sizing.

### 2.6 Planned expenses model

Read from `INPUT - Upcoming Expenses` and classified by `buildRollingPlannedExpenseImpactModel_`:

- **Horizon:** near-term (≤ 90 days, but the HELOC layer uses 120 days) vs later.
- **Funding classification:** cash-funded vs card-funded, and whether a card-funded planned expense can be *mapped* to a known debt/card payee (via alias map + debt list).

Two holds feed the liquidity model:

- `near_term_planned_hold` — cash-funded near-term planned expenses (and mapped card-funded ones that will need cash paydown).
- `unmapped_card_risk_hold` — card-funded near-term planned expenses that could not be matched to a known card. This is deliberately conservative.

Both of these drive the **Why not more?** block in the UI — they are exactly what's keeping the user from deploying the full Safe-to-use amount.

---

## 3. Core computations (plain language)

- **Safe to use** — start with total cash; subtract what you promised not to touch (reserve), what each account must keep (buffer), cash earmarked for the next 90 days of known expenses (near-term hold), and cash earmarked for upcoming card usage you can't yet map to a card (unmapped hold). What's left is safe to deploy this month.

- **Execute now** — whichever is smaller: how much the user wants to deploy (Cash to use now), or how much the plan says is safe (Safe to use). This is the pool the waterfall actually allocates.

- **Planned payment per account this month** — The engine doesn't simulate one payment per account in isolation. It pours Execute-now through the waterfall: first small balances get cleared, then what remains goes to Focus debt up to its balance cap, remainder spills to Next debt, anything still left goes to Excess. Each account's `paid` value falls out of that pour — which is why the Payment Result table shows only the accounts that actually received extra cash this month.

- **HELOC recommendation** — A HELOC is recommended only when (a) there's at least one active debt whose APR beats the HELOC by the required spread, (b) the user has enough recurring monthly capacity to clear the proposed draw within the target window, and (c) a realism check says the draw won't just get re-run up by ongoing card spend in the next ~120 days. Otherwise the card stays `not_recommended` and the reason is surfaced directly in the card.

- **"What would change this?"** — The HELOC card lists each gate (APR spread, eligible-debt availability, repayment capacity, planned-expense exposure, card-spend burden) as a bullet with the *current measured value* next to it, so the user can see which dial they'd have to turn to unlock a different recommendation. Each bullet is anchored by a stable key so the list doesn't reshuffle on rerender.

---

## 4. UI structure (frontend)

### 4.1 Overall dashboard

Single-page app with top nav: **Overview / Assets / Cash Flow / Activity / Properties / Planning**, plus a prominent **Help** button. Each nav page is rendered by its own `Dashboard_Script_*` module against DOM in `Dashboard_Body.html`.

### 4.2 Rolling Debt Payoff (Planning tab)

Hosted inside `Dashboard_Script_RollingDebtPayoff.html`, which mounts the React bundle into `#rolling_debt_payoff_dashboard_root`. The outer host script owns:

- The **Presentation mode** control (Standard / Automation). Automation is an alternate read-only view intended for export/automation consumers.
- An **Advanced view** checkbox (power-user toggle; enables audit/debug panels backend-side).
- A **Payoff strategy** (`standard` / `aggressive`) — currently hidden on purpose (see §6).
- The fetch loop: `loadRollingDebtPayoffSection()` calls `getRollingDebtPayoffPlan` with the composed mode tokens and re-renders on success.

Inside the React bundle (`RollingDebtPayoffDashboard.tsx`), the STANDARD surface has four top-level building blocks:

- **`CashToUseNowInputCard`** — the one interactive input. Lives at the top. Shows the user's value, the cap, and a live `min(cash_to_use_now, Safe to use)` line.
- **`CompactDecisionCard`** — three lines: **Recommendation**, **Why**, **Caution**. Narrative only, no tables. Driven by `action_decision_box` plus a small context resolver.
- **HELOC strategy card** — rendered when `helocStrategyModel` is present. Shows status, advised draw, and the anchored **"What would change this?"** bullets.
- **`CompactPaymentResult`** — the per-account table (Account with role, Action, Remaining, `[Add payment]`). Driven by a memo (`displayExecutionPlan`) that is the **single source of truth** for anything payment-related in the UI.

Plus two supporting blocks:

- **"Why not more?"** — explainer for the two holds (near-term planned, unmapped card risk). Each bullet has a `[View]` pill that routes to Cash Flow → Upcoming when the hold is driven by upcoming rows.
- **`ShowDetails` toggle** — single boolean. When on, the dashboard appends the full planner output: Cash Bridge (audit), Allocation audit (month 0), 12-month cash table, yearly projection, Aggressive Phase 2 audit, expense baseline diagnostics, raw JSON.

### 4.3 Debt Overview (separate Planning tab)

Plain HTML/JS (no React). Read-only reference view of balances, minimums, APRs, estimated payoff at current minimums, and a two-year CF-paid roll. Does **not** run the rolling engine — it's a static snapshot of the debt structure. Explicitly *not* an action planner.

---

## 5. Interaction patterns

- **Show details toggle** — client-side only. Controls which React sections are rendered. Does **not** refetch from the server.
- **Changing "Cash to use now"** — client-side only. The React component recomputes `displayExecutionPlan` via `useMemo` against the payload already in memory. The backend waterfall was already pre-computed for the full Safe-to-use pool; the client re-pours that allocation against the lower cap without a round-trip. This is why typing feels instantaneous. The value is persisted per anchor month in `localStorage`.
- **Changing presentation mode / advanced view / payoff strategy** — host-side. Each call re-invokes `google.script.run.getRollingDebtPayoffPlan(...)` because these affect backend output.
- **Navigation — "View" → Upcoming.** Each `[View]` pill calls `window.showPage('cashflow')` then `window.showTab('upcoming')`. Both are defined in `Dashboard_Script_Render.html`. The React component defensively checks for them and silently no-ops if absent (e.g. standalone dev server).
- **Navigation — "Add payment" → Quick add.** Each `[Add payment]` pill calls `window.prefillQuickPayment({ entryType: 'Expense', payee, entryDate, amount })` defined in `Dashboard_Script_Payments.html`. That function switches to the Cash Flow tab, opens Quick add, pre-fills the form fields, and re-fetches the Quick add preview so the user can confirm/adjust before saving. Save still goes through the normal `quickAddPayment` server function (with its own activity log row).

---

## 6. Key product decisions / constraints

- **HELOC is conservative by default.** It's a decision-support layer, never a mutator. All rolling-engine numbers are computed *without* HELOC action; the advisor lives on top. Trap-risk, future-expense, and card-spend gates are all defaults-on because getting HELOC wrong has outsized downside.
- **Only Standard strategy is user-facing.** The Aggressive (Phase 2) allocator is fully implemented and audited but the control is hidden (`rollingDebtPayoffUpdateStrategyVisibility_` always sets `display: none`). Rationale: avoiding a choice the user isn't equipped to make, and avoiding user surprise if Aggressive picks an unexpected Focus debt.
- **Decision layer ≠ reference layer.** Debt Overview (reference) and Rolling Debt Payoff (decision) are deliberately separate Planning tabs. Debt Overview is a snapshot of structure; Rolling Debt Payoff tells the user what to do this month. Merging them would reintroduce the analysis-paralysis problem the earlier "Payoff Path" tab had.
- **Standard view is intentionally thin.** The backend produces dozens of fields (diagnostics, irregular flags, multiple audits, long-range projections). Exposing them all was too noisy for monthly decision-making, so the default surface is four compact cards. The full output is one click away via Show details.
- **Cash to use now is the only knob in Standard.** Everything else is derived. This is deliberate — it's the one dial that maps cleanly to the user's real question ("how much can I throw at debt this month?").
- **`LOG - Activity` is a separate ledger from `OUT - History`.** Event-level audit is never merged with planner-run snapshots; those are two different semantics.

---

## 7. Extension points

### Safe to extend

- **New decision rules inside the rolling engine** — Add helpers in `rolling_debt_payoff.js` and wire them into `buildActionDecisionBox_` / `buildThisMonthPlan_` so the Decision card picks them up. Backend JSON stays stable; the React component reads named fields.
- **New "Why not more?" drivers** — Add a new hold field to the `liquidity` block (same shape as `near_term_planned_hold`), update `buildCashBridgeFromLiquidity`, add a bullet in the React component's `WhyNotMore` block. The `[View]` navigation pattern is the template.
- **New UI cards in Standard view** — The React component is structured as small presentational functions (`CompactDecisionCard`, `CompactPaymentResult`, HELOC card, etc.) consuming already-mapped data. Drop a new component alongside them; feed it from the existing `displayExecutionPlan` memo or add a new memo against `data`.
- **New navigation flows** — Follow the `window.prefillQuickPayment` / `window.showPage` pattern: define a global in the relevant `Dashboard_Script_*.html`, have the React bundle probe for it defensively, never call `google.script.run` from the React side.
- **New `LOG - Activity` event types** — `appendActivityLog_` + a new dedupe key builder if needed. Type derivation for the Activity page happens in `classifyActivityKind_`.
- **New Help content** — `Dashboard_Help.html`. Section IDs are used by the TOC; preserve them.

### Tightly coupled / fragile

- **The waterfall allocator (`rollingRunStrictExecuteWaterfall_` and its validators).** Changing bucket semantics or the order of Cleanup → Primary → Secondary → Overflow breaks the execution-integrity validators (`rollingStrictWaterfallValidationErrors_`) which in turn flip `plan_status` to `PARTIALLY_VALID`. Any change here needs paired updates in the mapping layer (`buildExecutionExtraBuckets`, `buildExtraPaymentsFromWaterfallSnapshot`) and the React role labels.
- **The mapping layer** (`components/mapPlannerPayloadToRollingDebtPayoffDashboardData.ts`). This is the contract between backend JSON and the React component. Adding a field means updating the mapper, the React type, and the backend emitter — in that order. Skipping one produces silently stale UI.
- **Alias map + debt normalization** (`planner_core.js → normalizeDebts_` + alias resolvers). Many downstream features (CF payee matching, upcoming-expense funding classification, HELOC eligible-debt filter) depend on the same canonical keys.
- **Host-page global namespace.** `window.showPage`, `window.showTab`, `window.prefillQuickPayment`, `loadRollingDebtPayoffSection`, `setStatus` are all implicit contracts with the React bundle. Renaming any of them without updating the bundle (and rebuilding) will break navigation.
- **HtmlService includes** (`includeHtml_` in `html_includes.js`). Included fragments cannot contain their own `<?!= … ?>` template tags — they get raw-served. Documented in `WORKING_RULES.md`.
- **`PlannerDashboard.html` (sidebar) vs `PlannerDashboardWeb.html` (web).** Two dashboards share some script/style includes; fixes can be missed. Marked as tech debt in `TODO.md` (#16).

### To add a new *decision rule* safely

1. Compute it backend-side in `rolling_debt_payoff.js`, add it to the JSON under a new stable key.
2. Pass it through the mapping layer to a typed field on `RollingDebtPayoffDashboardData`.
3. Consume it in the relevant React card; do not add parallel fetches.
4. Document it in `Dashboard_Help.html` and `SESSION_NOTES.md`.

### To add a new *UI section*

1. Decide: Standard or Details? If it needs audit/validator data it belongs in Details.
2. Build it as a small functional component next to the existing compact cards.
3. Consume data from the existing memo graph — don't re-derive from raw payload.
4. If it needs to link somewhere, follow the `[View]` / `[Add payment]` pattern.

---

## 8. Known limitations / gaps

- **Credit card "spend" is approximate.** Without monthly statement-balance tracking, CF card-expense lines are treated as *cash out*, not true new spend. The engine flags this with `credit_card_spend_confidence = LOW`. A separate card-balance table would materially improve accuracy.
- **RSU / variable income is ignored in base projections.** Default is $0 (conservative). There is a 50% RSU baseline path available but it's off.
- **Forecast table is not an instruction list.** The 12-month cash table and yearly projection revealed by Show details are conservative model runs, not rolling month-by-month plans. Users are warned in Help; the UI itself could be clearer.
- **Aggressive strategy is dark.** The allocator exists and is audited, but the toggle is hidden. Re-exposing it will need a UX moment (confirmation, clear explanation of Focus debt selection).
- **Two dashboards co-exist.** `PlannerDashboard.html` (sidebar) and the web app (`PlannerDashboardWeb.html`) share some code; fixes can drift. Long-term: pick one, or share a single set of fragments.
- **Alias map is config-driven but not UI-edited.** Payee → debt mapping is defined in code/config today. Errors surface as "unmapped card risk" but fixing them still requires a code or sheet change.
- **No true undo for writes beyond donations.** The Activity page's **Remove** is donation-only. Extending it to Quick add / house expense / bill skip is scoped in `TODO.md` as Phases 2–4 — each requires logging `previousValue` + `newValue` first.
- **HELOC credit-limit estimate is optional.** When absent, the draw cap falls back to heuristics; a real limit would tighten the advisor.
- **`LOG - Activity` "Entry Date" normalization is timezone-sensitive.** Sheet reads return `Date`, not ISO strings; there's a helper (`activityLogEntryDateToYyyyMmDd_`) but every new reader has to remember to call it.
- **Rolling bundle is a prebuilt artifact.** `RollingDebtPayoffDashboardBundle.html` is committed. If someone edits the component without running `npm run build:rolling-dashboard`, the deployed dashboard won't pick up the change. Build step is documented but easy to forget.
- **Client-side `cash_to_use_now` recomputation assumes the pre-allocated waterfall holds.** The React mapping re-pours allocations against a lower cap client-side. For edge cases (e.g. a small-balance account whose payoff amount doesn't scale linearly), the optimistic client recomputation can be a hair off the backend's own sub-cap allocation until the next server fetch. Treated as acceptable drift today.
- **No test harness.** `TESTING_PLAN.md` defines a manual checklist and a light safety net; there is no automated integration or regression suite yet.
