# Samer Financial Planner - Project Context

We are building **CashCompass** — a Google Apps Script web dashboard (and spreadsheet sidebar) for personal finance / property / debt planning. Tagline: *Guiding your money decisions.*

## Current Product Status (June 2026)

- **Architecture:** Central App operational — **stable, family-beta capable**. The production / bound workbook remains protected (bound mode unchanged); the central architecture is operational and runtime-validated.
- **Completed (working in central mode):** Provisioning, Workbook Mapping, Dashboard, Planner, Assets, Properties, Cash Flow, Bills, Debts, Income, Activity, Email.
- **Recently completed (this initiative):**
  - **Diagnostics** — Phase 2A Admin Diagnostics (read-only workbook detection / classification / mapping + orphan audit, admin-gated).
  - **Debt parity** — Phase 3.1 TOTAL DEBT summary row.
  - **Bank Accounts parity** — Phase 3.2a Total Accounts row + Phase 3.2b Delta row.
  - **Add-New dropdown fix** — Bank Accounts / Debts Type dropdowns now merge canonical + server-provided options (no longer collapse after an add).
  - **Identity markers** — Phase 6A Workbook Identity & Recovery design + Phase 6B Workbook Identity Markers (durable identity markers + reverse index + `SYS - Meta`, with admin marker diagnostics; no provisioning/resolution behavior change).
  - **Recovery stack (shipped behind flags, default OFF):** Phase 6C.1 Adopt-Before-Create, Phase 6D.1 Recovery Page, Phase 6D.2a Reconnect, Phase 6E.1 Admin Inspect + Clear Mapping. All committed; **healthy-path validated (2026-06-09)** with recovery + admin-repair flags ON and auto-adopt OFF (dashboard loads normally, existing workbook resolves, no recovery page, no regression; Admin Diagnostics + Repair Toolkit + Inspect/preview/confirm UI all work). **Destructive/edge paths still unvalidated** — see `## Flag Registry`, `## Recovery Validation Inventory`, and `TODO.md → Open testing inventory`.
- **Current focus — Recovery Validation (6F):** run the destructive/edge-path validation pass (adopt with flag ON → real recovery page via stale mapping → executed reconnect → executed admin clear → ambiguous handling) on a disposable account, then flags back OFF. Remaining recovery slices: 6D.2b Create New Workbook, 6E.2 Admin Set Mapping.
- **Status snapshot (2026-06-09):** Central Architecture ~95%+; Recovery Architecture ~85–90% implemented; Recovery Validation partial (healthy-path done, destructive paths pending); Family Beta Readiness improving; External Beta Readiness dependent on recovery validation.
- **Future:** External beta readiness / hardening, family-beta expansion + user-lifecycle handling, Chat Assistant, Paid Product framework.

Roadmap: `## Launch Readiness Roadmap (high-level)` below (detail in `TODO.md → Launch Readiness Roadmap`). Live architecture: `## Current architecture — Central App (live)` below. Workbook recovery summary: `## Workbook Identity & Recovery (live + roadmap)` below.

> **Roadmap-label note (disambiguation):** the **Workbook Identity & Recovery** sub-series uses working labels **Phase 6A–6E**. These are the detailed expansion of the macro roadmap's **Phase 2 — Family Beta Hardening → 2B Workbook Recovery**, and are **not** the same as the macro **"Phase 6 — External Beta Readiness."** Where this doc says "Phase 6A/6B/6C…" it means the Identity & Recovery track.

## Launch Readiness Roadmap (high-level)

High-level view of the next 6–12 months. **The authoritative, detailed roadmap lives in `TODO.md → Launch Readiness Roadmap`** (objective, why it matters, major deliverables, dependencies, and priority per phase) — this is the single source to avoid drift. The summary below carries phase names, objectives, and priorities only. Every phase runs under `WORKING_RULES.md → Current phase` and, for central-mode work, `→ Central App Transition Rules` (active).

**Priority scale:** P0 = now / in progress · P1 = next, gates family beta · P2 = high, needed before external beta · P3 = gates external beta · P4 = post-beta / longest horizon.

- **Phase 1 — Documentation Cleanup** *(P0, ✅ complete)* — `PROJECT_CONTEXT.md` + `TODO.md` are the single authoritative source of truth for architecture, status, and roadmap (kept current by ongoing doc passes).
- **Phase 2 — Family Beta Hardening** *(P1, in progress)* — make per-user provisioning robust, recoverable, and observable enough to safely onboard a small family beta. **2A — Workbook Diagnostics** (read-only detection/classification/audit) is ✅ complete. **2B — Workbook Recovery** is expanded as the **Workbook Identity & Recovery** series: 6A design ✅, 6B markers ✅, and the **recovery stack (6C.1 / 6D.1 / 6D.2a / 6E.1) is implemented and committed, flag-gated OFF, and healthy-path validated (2026-06-09) — destructive/edge paths still pending**. The active step is **Recovery Validation (6F)** (destructive/edge-path test pass); remaining slices are 6D.2b + 6E.2 — see `## Workbook Identity & Recovery (live + roadmap)`. Design in `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`.
- **Phase 3 — Workbook Totals Project** *(P1–P2, ✅ complete for current scope)* — newly provisioned workbooks reach visual + functional parity with production via canonical summary rows: TOTAL DEBT (3.1), Bank Accounts Total Accounts (3.2a), Bank Accounts Delta (3.2b). Investments / House Values summary parity remains a later follow-up if needed.
- **Phase 4 — Chat Assistant v1** *(P2, future)* — ship a read-only natural-language assistant over the existing canonical read models (write-capable assistant is future).
- **Phase 5 — Web App UX Improvements** *(P2)* — polish the central web-app experience (onboarding, empty-states, error handling, guidance, dashboard + planner polish) and cut help text / content to reduce cognitive load.
- **Phase 6 — External Beta Readiness** *(P3, future)* — move from family beta to a wider invited external beta (support, feedback, onboarding, recovery, diagnostics, beta-user management). *(Distinct from the Identity & Recovery "6A–6E" labels — see the disambiguation note above.)*
- **Phase 7 — Paid Product Readiness** *(P4, future)* — prepare to monetize (pricing/subscription, entitlements, plan enforcement, privacy policy, ToS, support, monitoring).

**Workbook Identity & Recovery (6A–6F) — expansion of Phase 2B, the active near-term track:**

- **6A — Workbook Identity & Recovery design** *(✅ complete)* — identity-marker model, adopt-before-create decision tree, recovery UX, admin-repair safeguards, and migration strategy.
- **6B — Workbook Identity Markers** *(✅ complete)* — durable identity markers + reverse index + `SYS - Meta`, lazy backfill, admin marker diagnostics. **No provisioning/resolution behavior change.**
- **6C.1 — Adopt-Before-Create** *(✅ implemented, flag `CENTRAL_AUTO_ADOPT` default OFF)* — when a mapping is lost but exactly one strict candidate workbook exists, adopt it instead of silently creating a duplicate; ≥2 → `AmbiguousWorkbookError`.
- **6D.1 — Recovery Page** *(✅ implemented)* — display-only recovery screen for stale / ambiguous / unavailable resolution failures (no raw errors).
- **6D.2a — Reconnect** *(✅ implemented, flag `CENTRAL_RECOVERY_ACTIONS` default OFF)* — self-scoped, user-initiated relink to a single existing candidate.
- **6E.1 — Admin Inspect + Clear Mapping** *(✅ implemented, flag `CENTRAL_ADMIN_REPAIR` default OFF)* — admin-gated read-only inspect + guarded, audited, mapping-store-only clear (no Drive writes).
- **6F — Recovery Validation** *(current, P1)* — flag-on runtime validation of the full recovery stack on a disposable account, then flags OFF.
- **6D.2b — Create New Workbook** *(remaining, P1)* — self-service "start fresh" recovery action (designed; not implemented).
- **6E.2 — Admin Set Mapping** *(remaining, P2)* — guarded admin remap (designed; not implemented).

## Current phase — Central App live + Family Beta readiness

The app has moved beyond the V1.2 "controlled improvement" framing. **The Central App architecture is live**, and the active work is hardening it toward a Family Beta. Two foundations carry forward from earlier phases (V1 trust baseline, V1.1 retirement profile integration) and remain true, but they are no longer the headline.

**What is live now (see `## Current architecture — Central App (live)` below for the full picture):**

- **Central App is operational.** `getUserSpreadsheet_()` is a real resolver (not a pass-through). It branches on the `CENTRAL_MODE` script property and, in central mode, routes to per-user workbook provisioning in `central_provisioning.js`.
- **Per-user workbook provisioning works** end-to-end — runtime-validated against the developer account (Phase A) and a disposable second account (Phase B). Each allow-listed user gets their own Drive-owned `CashCompass — <email>` workbook on first access.
- **Workbook mapping works** — `mapping::<sha256(email)>` keys in the central project's script properties (raw emails never stored).
- **Family Beta styling shipped** for four input sheets — Bank Accounts, Debts, Bills, Upcoming Expenses (see `## Family Beta workbook styling` below).
- The high-level roadmap is in `## Launch Readiness Roadmap (high-level)` above; the detailed roadmap is authoritative in `TODO.md → Launch Readiness Roadmap`. The forward queue is no longer "V1.2 candidates."

Full migration history (per-slice, with commit/run evidence) lives in `SESSION_NOTES.md → Current State — Post V1.2 Prep` and the `CENTRAL_APP_*.md` planning docs. The legacy V1 / V1.1 narrative below is preserved as the stability foundation the Central App builds on.

### Foundation — V1 trust baseline + V1.1 (preserved history)

The V1 trust baseline shipped, and V1.1 closed out with the retirement profile integration. These are complete and stable. Concretely:

- V1 trust baseline is complete.
- Blank / fresh workbooks are stable end-to-end (dashboard, Setup / Review, Planning tabs, Assets, Cash Flow, Activity).
- The major "Missing sheet …" and "(after retry+flush)" crashes across dashboard and planner modules are fixed.
- Misleading zero / fake states were removed — panels either show real data, a calm empty state, or a setup-aware CTA to Setup / Review.
- The planner email is properly gated: it sends only when the recipient is explicitly configured in `INPUT - Settings.Email` **and** the planner summary is meaningful (has at least one of: debts, assets, scheduled payments, or a recommendation). No more silent "owner got an email from a blank workbook" behavior.
- The bounded UI copy consistency pass is complete (ellipses, error tone, calm exception messages, empty/setup wording, sheet-name leakage removed from user-facing strings).

**V1.1 shipped — retirement profile integration.** Profile is now the single source of truth for **Date of Birth**, and Retirement derives current age from it automatically. The Retirement Basics edit form was removed; per-scenario age fields are display-only. A new `needsProfileDob` readiness state routes users to **Open Profile** when DOB is missing, and the DOB parser accepts both Date objects and `YYYY-MM-DD` strings. Populated workbooks are preserved byte-for-byte — legacy age rows on existing retirement sheets are left inert. Full phase summary in `SESSION_NOTES.md → V1.1 — Retirement Profile Integration (DOB Source of Truth)`.

Working rules are in `WORKING_RULES.md → Current phase` (the V1.2 change discipline still applies — one issue at a time, minimal/localized/safe, both workbook states), plus `WORKING_RULES.md → Central App Transition Rules` which is now the **active** policy governing the migration. Completed items are captured chronologically in `SESSION_NOTES.md`. Forward-looking work lives under `## Launch Readiness Roadmap (high-level)` above, with full detail in `TODO.md → Launch Readiness Roadmap`.

## Decision Layer (product framing)

The app has two layers. Do not conflate them:

- **Input / execution layer** — source-of-truth editors and ledgers. Bills, Upcoming, Debts, Bank Accounts, Investments, House Values / Expenses, Donations, Cash Flow (Quick Add), LOG - Activity. These own the data; they are the only places that write canonical rows.
- **Decision layer (Planning tab)** — answers *"what should I do next?"* by interpreting data from Bills, Upcoming, Debts, Bank Accounts, and Cash Flow. It is **not** a source-of-truth editor and **not** a ledger; it reads existing sources and does not create new data.

### Next Actions (primary entry point, v1 delivered)

- **"Next Actions"** is the featured sub-tab inside Planning and the primary entry point for users. It is the default landing view inside Planning.
- Action-first (no editing), short lists (3–5 items per section). Urgent is uncapped in the backend so `urgentTotal` always reconciles with the visible list; the UI groups the tail into a single "Other bills due soon" row for readability.
- The single payment path remains **Cash Flow → Quick Add**; Next Actions routes the user there (and to source pages) rather than duplicating detail.

### Relationship to existing Planning tabs

All current Planning sub-tabs stay as they are and are re-framed as **tools / deep dives**:

- **Debts**, **Retirement**, **Purchase Sim**, **Debt Overview**, **Rolling Debt Payoff**

Intended flow: **Next Actions → drill into these tabs**. No new top-level tabs; no new dashboards stacked on top of Planning.

### Design principles

- Do not add multiple new top-level tabs.
- Do not overload Planning with dashboards.
- Keep Next Actions simple (3–5 items per section).
- Single payment path remains Quick Add.
- Decision layer does not create new data; it reads existing sources.

### Roadmap

- **Phase 1 — Next Actions (v1)** ✅ Delivered as the featured Planning entry point.
- **Phase 2 — Cash Strategy** (later).
- **Phase 3 — HELOC Advisor refinement** (later).

See `ENHANCEMENTS.md` for the backlog entry and `SESSION_NOTES.md` for the shift summary. End-user documentation lives in the in-app Help page under **Planning → Next Actions** (`#help-next-actions`).

### Setup / Review (Onboarding Phase 1, delivered)

- **"Setup / Review"** is the top-right entry in the dashboard header. It opens a focused, **read-only** walkthrough of the five input areas Next Actions reads: Bank Accounts, Debts, Bills, Upcoming Expenses, Income — plus a Finish summary.
- Flow: **Welcome → status grid → per-step detail screen → (optional) editor in Setup mode**. Each step has a status badge (*Setup complete* / *Not set up*), a short product-language summary, and a primary action.
- **Setup-mode editor handoff** — detail CTAs open the existing editor in a simplified shell: main top nav, page sub-tabs, *Setup / Review*, and *Run Planner + Refresh Snapshot* are hidden; a **Back to Setup** bar appears. Normal navigation to the same editor is unchanged.
- **Income** is derived from the latest `INPUT - Cash Flow <year>` — there is **no** `INPUT - Income Sources` sheet. Recurring income is grouped conservatively (e.g. *Cisco Pay 1/2/3 → Cisco Salary*); excluded categories (Bonus, RSU, ESPP, Refund, …) are surfaced separately as "Other detected income".
- **Sheet safeguards** — Setup ensures `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, and `INPUT - Upcoming Expenses` exist with the canonical headers before opening their editor. It does **not** create Cash Flow year sheets.
- Read-only guarantee: viewing Setup never writes, never touches `SYS -` sheets, never writes to `LOG - Activity`.
- End-user documentation lives in `Dashboard_Help.html` under **Setup / Review** (`#help-setup`). Full phase notes and remaining follow-ups are in `ENHANCEMENTS.md → § 4 → Onboarding (Phase 1)`.
- **Startup routing & Welcome gate** — `getStartupRoutingFromDashboard` in `sheet_bootstrap.js` classifies a workbook as blank only when it has no `INPUT -`, `SYS -`, `OUT -`, or `LOG -` sheets via `workbookHasAnyAppSheet_`; populated workbooks land on the normal dashboard and `initDashboard()` sets `window.__cashCompassDashboardInited = true`. The Welcome screen inside **Setup / Review** is gated separately and is driven purely by the six Setup probes: `loadOnboardingSection()` in `Dashboard_Script_Onboarding.html` renders the status grid whenever any step reports `status !== 'missing'`, and renders Welcome only when every step is `missing`. The gate deliberately ignores `sheetExists` and `window.__cashCompassDashboardInited` because scaffold sheets (empty `INPUT - Cash Flow <year>`, empty `INPUT - Upcoming Expenses`, bootstrapped during first-run flows) would otherwise suppress Welcome on a freshly deployed workbook even though Setup itself is empty. Probe failures (malformed payload or server error) fail closed to the grid, which surfaces the error inline and exposes Refresh + Back to Dashboard — Welcome has neither. Both **Back to Dashboard** on Welcome and **Back to Dashboard** on the status grid call `onboardingBackToDashboard()`, which runs `window.initDashboard()` when needed and switches to `overview` — the grid's Back intentionally exits Setup instead of bouncing back to Welcome, so showing Welcome on a genuinely empty workbook is never a loop.
- **First-run bank account creation** — `addBankAccountFromDashboard` (bank_accounts.js) calls `ensureOnboardingBankAccountsSheetFromDashboard('normal')` and `ensureSysAccountsSheet_()` before any `getSheet_()` read, so the Assets → Bank Accounts → Add new flow works on a completely blank workbook instead of throwing *Missing sheet: INPUT - Bank Accounts* / *Missing sheet: SYS - Accounts*. Both helpers are idempotent no-ops when the sheet already exists; the INPUT creator writes the same Year-block structure (`Year | <year>` on row 1, `Account Name | Jan-YY … Dec-YY | Total` on row 2) that `getBankAccountsYearBlock_` parses on the very next line, so the first save's opening-balance write works without any extra self-heal step.

### Queued product work (post Next Actions stabilization)

Captured-but-not-scheduled. Intent only — full specs live in `ENHANCEMENTS.md → § 4 → Queued — post Next Actions stabilization`:

- **Debug mode control** — delivered (see above). Retained here for historical priority ordering.
- **Income Sources (new input surface)** — **superseded.** Income is now derived from the latest `INPUT - Cash Flow <year>` inside Setup / Review; no separate `INPUT - Income Sources` sheet will be reintroduced.
- **TEST mode retirement** — the `?onboarding=test` path and `TEST -` sheet fallbacks in `onboarding.js` are in light deprecation. New work should target the live path only; existing TEST code stays until it is removed in a dedicated cleanup pass.
- **Onboarding factory refactor** — consolidate the five per-step `*SetStatus_` / `*LoadDetail_` / `*RenderDetail_` / `*Open*Page` groups in `Dashboard_Script_Onboarding.html` into a shared factory once the flow has been exercised in real use.

Intended order: **(1) finish overlap cleanup → (2) stabilize Next Actions → (3) debug mode → (4) onboarding (delivered) → (5) TEST mode retirement → (6) onboarding factory refactor.** Do not reorder without an explicit product decision.

### Next Actions v1 — decision logic (delivered)

Locks the backend decision logic and product rules. Implemented by `next_actions.js::getNextActionsData()` and consumed by `Dashboard_Script_PlanningNextActions.html`.

**1. Purpose**
- Answers: *"What should I do next, in priority order?"*
- Interprets existing data only. No writes. Not a replacement for source-of-truth pages.

**2. v1 output model (compact action object)**
Each action is a plain object with:
- `priorityBucket` — `urgent` | `recommended` | `optimize`
- `actionType` — one of the types in §6
- `title` — short imperative label (e.g. *"Pay PG&E bill"*)
- `reason` — one-sentence justification built from current data (see §7)
- `amount` — dollar amount (may be 0 when N/A, e.g. `review_cash_gap`)
- `dueDate` — ISO date or null
- `sourceEntity` — `{ type, name }` where `type` ∈ `bill | upcoming | debt | bank_account | heloc | cash_plan`
- `target` — `{ page, tab }` the user is routed to (Quick Add stays the single payment path)

**3. v1 data sources (no new sources)**
- `INPUT - Bills` (active)
- `INPUT - Upcoming Expenses` — **remaining balance only** (the live `Amount` column)
- `INPUT - Debts` (active; balance / min payment / due day)
- Bank Accounts / usable cash — via the existing liquidity model (`SYS - Accounts` → Safe-to-use / Available Now / Min Buffer)
- Rolling Debt Payoff recommendation — reuse `getRollingDebtPayoffPlan` output; do not re-run the engine

**4. v1 priority buckets**
- **Urgent** — overdue items, due soon, unpaid debt minimums for the current cycle, near-term obligations (next ~7 days), and any detected cash gap. Must be addressed before anything else is surfaced as money-movement.
- **Recommended** — next best moves once urgent items are covered (typical case: extra payment toward the Rolling Debt Payoff focus debt; finishing a partially-paid Upcoming).
- **Optimize** — optional improvements that only make sense once urgent items are safe (sparse by design; usually empty). HELOC strategy is **not** surfaced here — it lives on the Rolling Debt Payoff *HELOC strategy* card.

**5. v1 deterministic rules**
- Build the **urgent obligations** list first, from Bills + Debts + Upcoming + near-term windows.
- Compare `sum(urgent obligations)` vs **cash-to-use** (Safe-to-use from the liquidity model).
- If obligations exceed cash-to-use, emit `review_cash_gap` at the top of `urgent` — recommending / pay_extra actions are **suppressed** until the gap is resolved.
- Only emit `pay_extra_debt` (and other `recommended` money-movement) **after** urgent obligations are covered.
- When recommending an extra debt payment, use the **Rolling Debt Payoff** recommendation as the preferred target; do not invent a new waterfall.
- All rules are deterministic over the current snapshot — same inputs, same output.

**6. v1 action types**
- `pay_bill` — active bill due in the current cycle, unhandled in Cash Flow.
- `pay_debt_minimum` — debt with unpaid minimum for the current cycle.
- `pay_upcoming` — Upcoming row with remaining > 0 and due within the urgent window.
- `finish_upcoming` — partially-paid Upcoming row (remaining > 0, already touched) worth closing out.
- `review_cash_gap` — informational; shown when obligations exceed cash-to-use.
- `pay_extra_debt` — extra principal toward the Rolling Debt Payoff focus debt once urgent is clear. Reason is intentionally short (*"Confirm in Rolling Debt Payoff"*) so Next Actions does not duplicate the Rolling Debt Payoff Focus-debt narrative.

HELOC strategy is intentionally **not** a Next Actions action type. It lives on the Rolling Debt Payoff *HELOC strategy* card (single source of truth for HELOC recommendations).

**7. Explainability rule**
Every emitted action must be explainable in **one sentence** built entirely from current snapshot data (amount, due date, remaining balance, bucket rule, or Rolling Debt Payoff reason code). If an action can't be explained that way, it is not emitted.

**8. Non-goals for v1**
- Retirement optimization
- Investment allocation advice
- Purchase simulation outputs
- Scenario / what-if planning
- Automatic execution (Quick Add remains the single payment path; Next Actions only routes)

### Liquidity model v1 — `cash_to_use` (delivered)

Defines the safe, conservative "how much can I actually act on right now" number consumed by Next Actions v1. This is an explicit contract, not a re-derivation of the Rolling Debt Payoff *Safe-to-use* math — Next Actions uses this simpler model directly.

**1. Definition**
- `cash_to_use` = total amount of money **safely available right now** across active bank accounts.
- Conservative, buffer-respecting, **current-state only** — no forecasts, no future income, no credit lines, no investments.

**2. Data sources**
- Bank Accounts only (canonical: `INPUT - Bank Accounts` + the `SYS - Accounts` mirror already read by the dashboard).
- Per-account fields consumed:
  - `balance` (current balance — same field the Bank Accounts panel surfaces)
  - `minBuffer` (Min Buffer)
  - `active` flag (shared filter: explicit `No / n / false / inactive` = inactive; blank = active)
  - `usePolicy` (existing Use Policy column)

**3. Core formula**
- Per account: `usable = max(0, balance - minBuffer)` — never negative.
- Total: `cash_to_use = Σ usable` across eligible accounts (§4).
- Round to cents at the total; per-account values render at cents too.

**4. Eligibility rules**
- **Include** only accounts where `active !== inactive` (shared rule).
- **Exclude** accounts flagged as restricted / do-not-use.
- **Use Policy** (v1 simplified): include most policies; exclude only accounts with an explicit "do not use" / restricted policy. More granular policies (spend-first, reserve, etc.) stay for a later phase — v1 either counts an account fully eligible or fully excluded.

**5. Output model**
Single object returned by the liquidity reader:
- `cashToUse` — total dollars, rounded to cents.
- `accounts` — array of `{ name, balance, minBuffer, usable, included, excludedReason? }` for every considered row, so the UI can show the breakdown and the reason any account was skipped.

**6. Usage in Next Actions**
- Compare `cashToUse` vs `sum(urgent obligations)` (from the Next Actions v1 rules).
- If `cashToUse < sum(urgent)`, emit **`review_cash_gap`** at the top of `urgent` and suppress `recommended` money-movement until resolved.
- Otherwise, use `cashToUse − sum(urgent handled)` as the pool for `recommended` actions (e.g. `pay_extra_debt` against the Rolling Debt Payoff focus debt).

**7. Guardrails**
- Never allow negative contributions from any single account (`max(0, …)` clamp).
- Always respect `minBuffer` — buffer is sacred in v1.
- No future-income assumptions, no pending transfers, no optimistic timing.
- No credit lines, no investments, no HELOC draw counted as "cash_to_use". HELOC strategy is a separate surface (Rolling Debt Payoff *HELOC strategy* card), not a Next Actions signal.

**8. Non-goals (v1)**
- No forecasting (no 7-day / 30-day projection of cash).
- No time-based modeling (same number whether asked at 8 AM or 5 PM on the same day).
- No optimization across accounts (no "drain this one first" logic — that's a later phase paired with Cash Strategy).

## Overall system areas already in the app
- Dashboard snapshot / overview
- **Bills** (Cash Flow tab) — Internal two-view panel: **Due this period** (dated Pay / Skip cards) and **Manage bills** (table over **INPUT - Bills** with inline sort on **Payee** / **Due Day**, **Add bill**, **Edit** (in-place dual-mode reuse of the Add form — Payee / Default Amount / Due Day / Frequency / Payment Source / Category / Autopay / Varies / Notes; **Start Month** and **Active** are hidden in edit mode), and **Stop tracking** which sets **Active = No**). Server entry points: `addBillFromDashboard`, `updateTrackedBillFromDashboard`, `deactivateBillFromDashboard` in `bills.js`. Category is a required field on Add bill. Edit refuses inactive bills, never moves the row in **INPUT - Bills**, and never retroactively renames the Cash Flow row seeded at Add time (a Payee rename leaves the old Cash Flow row in place — history is preserved on purpose). A save with no diff returns **No changes.** and is not logged.
- **Quick add** (Cash Flow tab) — expense/income lines to **INPUT - Cash Flow** (UI wording; activity log event type remains **`quick_pay`**)
- **Upcoming Expenses** (Cash Flow tab) — Add / Edit / Quick-pay / Dismiss against **INPUT - Upcoming Expenses**. `Account / Source` on the Add+Edit form is a controlled dropdown with canonical funding options **Cash / Credit Card / Cash + Credit Card / Loan / Financing / Other / Unknown** plus an **Other (custom)…** sentinel that toggles a sibling text input (matches the Bank Accounts → Use Policy "Other (custom)…" pattern; legacy free-text values hydrate through the custom sentinel without data loss). The picked value is what the Rolling Debt Payoff planner reads to classify each row's funding type — see the Rolling Debt Payoff bullet for what each option does to the liquidity model. No schema change: column stays a single free-text "Account / Source" cell on **INPUT - Upcoming Expenses**; the dropdown only constrains *new* input.
- House values — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateHouseFromDashboard` in `house_values.js`: sets **Active = No** on every **INPUT - House Values** row for the house and on the mirror **SYS - House Assets** row; preserves history, the **HOUSES - {House}** sheet, and name reservation. Logs **`house_deactivate`**. Inactive houses drop out of the House Values dropdown, House Expenses selector, and Property Performance rows/cards — all via the shared `getInactiveHousesSet_` rule: explicit `No / n / false / inactive` = inactive; blank = active.)
- House expenses
- Bank accounts — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateBankAccountFromDashboard` in `bank_accounts.js`: sets **Active = No** on every **INPUT - Bank Accounts** row for the account across all year blocks and on the mirror **SYS - Accounts** row; preserves month history, totals / delta, **Current Balance**, **Available Now**, **Min Buffer**, **Type**, **Use Policy**, **Priority**, and reserves the name. Logs **`bank_account_deactivate`**. `addBankAccountFromDashboard` appends a row to **INPUT - Bank Accounts** (current year block) and **SYS - Accounts** with `Active = Yes` and seeds the (required) opening balance into the matching month when non-zero; Type is chosen from a controlled dropdown of existing types in **SYS - Accounts**; **Use Policy** is a dropdown of canonical tokens (`DO_NOT_TOUCH` / `USE_FOR_BILLS` / `USE_FOR_DEBT` / `USE_WITH_CAUTION`) plus an **Other (custom)…** sentinel that stores a user-typed string (planner treats unmapped policies like `DO_NOT_TOUCH`); **Priority** is a dropdown of **Use first (1)** / **Use after others (5)** / **Use last (9)** that defaults to **Use last** and writes the numeric value to the canonical **SYS - Accounts → Priority** column consumed by `planner_core.js → normalizeAccounts_`; new **SYS - Accounts** rows inherit neighbor row formatting (borders, font, number formats, row height) via `findAccountsTemplateRow_` + `PASTE_FORMAT`; logs **`bank_account_add`** with Amount = opening balance. Opening balance is required on the Add-new form (prefilled to 0.00; 0 is allowed); **Also set Available Now to opening amount** and **Also set Min Buffer to opening amount** both default to checked. First-run safe: `ensureSysAccountsSheet_` creates **SYS - Accounts** with canonical headers on blank workbooks without touching any pre-existing sheet. Inactive accounts drop out of the Bank Account dropdown via the shared filter: explicit `No / n / false / inactive` = inactive; blank = active.)
- Investments — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateInvestmentAccountFromDashboard` in `investments.js`: sets **Active = No** on every **INPUT - Investments** row for the account across all year blocks and on the mirror **SYS - Assets** row; preserves month history, totals / delta, Current Balance, and reserves the name. Logs **`investment_deactivate`**. `addInvestmentAccountFromDashboard` appends a row to **INPUT - Investments** (current year block) and **SYS - Assets** with `Active = Yes`; **Starting value** is required on the Add-new form (prefilled to 0.00; 0 is allowed). **Starting value date** stays optional — blank resolves to today server-side so the amount always lands in a real month column; month cells are left empty when the amount is 0. Type is a dropdown merging existing **SYS - Assets** types with fallback options (*Brokerage*, *Retirement*, *Education*) plus an **Other (custom)…** sentinel that stores a user-typed string. Logs **`investment_add`**. Inactive accounts drop out of the Investment Account dropdown via the shared filter: explicit `No / n / false / inactive` = inactive; blank = active.)
- Debts — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateDebtFromDashboard` in `debts.js`: sets **Active = No** on the matching **INPUT - Debts** row; the row is never deleted so balance / minimum payment / credit limit / interest rate / due day and the name all stay intact for history. Logs **`debt_deactivate`**. `addDebtFromDashboard` appends a row to **INPUT - Debts** only — there is no **SYS - Debts** mirror — with `Active = Yes`; logs **`debt_add`** with Amount = opening balance (or 0 when not supplied). Active semantics: for UI / dashboard / Cash Flow readers, only explicit `No / n / false / inactive` on the **Active** column counts as inactive — blank / missing column = active, so legacy workbooks show every debt in the dropdown exactly like pre-Active-column builds. The planner (`planner_core.js → normalizeDebts_`) additionally applies the legacy `balance > 0 || minPayment > 0` fallback when the column is absent, so rolling payoff still skips dormant debts. The column is self-healed on the first add/stop-tracking write. Inactive debts drop out of the Planning Debts selector, `normalizeDebts_()` (so Rolling Debt Payoff waterfall / HELOC gate / focus/next-debt / payment windows), Debt Overview, Bills Due (debt matching), Quick add Flow Source inference, high-utilization issues, and debt-balance totals. Historical `LOG - Activity` classification is intentionally NOT filtered by Active so old quick_pay rows tied to a now-inactive debt still render with the right **Type / Kind**.)
- **Debt Overview** (Planning tab) — Read-only reference view of debt structure (balances, minimums, APRs, estimated payoff at current minimums) from **INPUT - Debts** plus **CF paid** trailing-two-year sums from **INPUT - Cash Flow**. Renamed from the older "Payoff Path"; not an action planner.
- **Rolling Debt Payoff** (Planning tab) — Monthly decision engine. Standalone React bundle (`components/RollingDebtPayoffDashboard.tsx` → `RollingDebtPayoffDashboardBundle.html`). Opens in **Standard** mode (Cash-to-use-now input, narrative Decision card with Recommendation/Why/Caution, HELOC strategy card with *What would change this?* levers, compact Payment result table using **Small balance / Focus debt / Next debt / Excess** role labels and **Paid off (this month) / Partially paid** actions, per-row **[Add payment]** pill that calls host `window.prefillQuickPayment` to open **Cash Flow → Quick add** pre-filled, **Why not more?** breakdown whose `[View]` pills route to **Cash Flow → Upcoming**). A single **Show details / Hide details** toggle reveals the full planner output (cash bridge audit, allocation audit, 12-month cash table, yearly projection, diagnostics, JSON). Liquidity model is calculated from **SYS - Accounts** (Safe-to-use = Total cash − Reserve − Buffer − Near-term hold − Unmapped card risk hold); legacy $100k/$100k hardcoded constants retained for audit only. Planned Upcoming Expenses are classified by `Account / Source` (see Upcoming Expenses bullet) before they hit the holds: **Cash** subtracts from deployable cash via the near-term hold; **Credit Card** maps to a specific card debt via `rollingResolveCcDebtNameForPlannedExpense_` when a match exists, otherwise reserves the amount as an unmapped card-risk hold; **Cash + Credit Card** intentionally routes through the card branch (conservative — no split-funding in v1); **Loan / Financing** is excluded from both cash and card-risk holds (the financed purchase price doesn't reduce deployable cash today and isn't modeled as a card balance — surfaced separately as a `loan_funded_near_term_total` aggregate in the Why-not-more breakdown); **Other / Unknown** and blank fall back to the cash branch.
- Retirement planner
- Monte Carlo / retirement success
- Purchase simulator / big purchase sim
- Planner run + OUT history snapshot logic
- **LOG - Activity** — Ledger of script actions (**quick_pay**, bill skip, bill autopay, **bill_add**, **bill_update**, **bill_deactivate**, **house_expense**, **house_add**, **house_deactivate**, **investment_add**, **investment_deactivate**, **bank_account_add**, **bank_account_deactivate**, **debt_add**, **debt_deactivate**, **donation**, upcoming lifecycle, the Bank Import family — **bank_import_auto_matched** / **bank_import_pending** / **bank_import_ignored_hit** / **bank_import_row_error** (Step 2a ingestion) and **bank_import_review_add_new** / **bank_import_review_match** / **bank_import_review_unlink_match** / **bank_import_review_ignore** / **bank_import_apply_balance** (Step 2b / 2d review + Apply) — and the Planner email family **planner_email_sent** / **planner_email_invalid_recipient** (per-save defers are no longer logged — the count is rolled up onto the next `planner_email_sent` row as `(N saves batched)` via `details.deferredSaveCount`; legacy `planner_email_deferred` rows already on the sheet still render); when **Quick add** runs inside house expense with **`suppressActivityLog`**, the extra **`quick_pay`** row is omitted because **`house_expense`** already logged the save). Rows can be removed from the **Activity** page: dashboard **Remove** is enabled for **`donation`** only (may also delete a matching **INPUT - Donation** row when the fingerprint matches); other event types are sheet-only for now. Not a substitute for **OUT - History** (planner snapshots). Created automatically if missing (`activity_log.js`). **Activity** page: **getActivityDashboardData** — filters, sort, up to **500** matches, **20** per page. **Tracking stopped** rows render with **—** in Amount since no money moved.
- **INPUT - Donation** — Charitable giving by tax-year blocks (`Year` row + header row + data). **Cash Flow → Donations** appends rows (`donations.js`); does not write **INPUT - Cash Flow**.
- **Car / vehicle expenses** — Often a **separate dedicated sheet** in the workbook today; **not** integrated in the dashboard yet. See **`TODO.md`** (Product / testing) for the open design item.

## Current architecture

### Main web app
- PlannerDashboardWeb.html = main wrapper
- Dashboard_Styles.html
- Dashboard_Body.html
- Dashboard_Script_Render.html (overview + shared globals/helpers)
- Dashboard_Script_AssetsHouseValues.html
- Dashboard_Script_PropertiesHouseExpenses.html
- Dashboard_Script_AssetsBankInvestments.html
- Dashboard_Script_PlanningDebts.html
- Dashboard_Script_CashFlowUpcoming.html
- Dashboard_Script_Donations.html
- Dashboard_Script_PlanningRetirement.html
- Dashboard_Script_PlanningPurchaseSim.html
- Dashboard_Script_PropertyPerformance.html
- Dashboard_Script_Payments.html
- Dashboard_Script_BillsDue.html
- Dashboard_Script_Activity.html
- RollingDebtPayoffDashboardBundle.html — prebuilt React bundle for the **Rolling Debt Payoff** tab (source: `components/RollingDebtPayoffDashboard.tsx`; build: `npm run build:rolling-dashboard`; typecheck: `npx tsc --noEmit -p tsconfig.rolling-dashboard.json`). Calls host globals `window.prefillQuickPayment`, `window.showPage`, `window.showTab` with defensive guards for standalone environments.

### Backend files
- webapp.js = main doGet()
- html_includes.js = `includeHtml_()` — **raw** file content only; nested `<?!= … ?>` inside included files does **not** run (see `WORKING_RULES.md` § HtmlService includes).
- central_resolver.js = Central App resolver seam (**live — no longer a pass-through**). `getUserSpreadsheet_()` branches on `isCentralModeEnabled_()` (the `CENTRAL_MODE` script property): when off (default, bound mode) it returns `SpreadsheetApp.getActiveSpreadsheet()` byte-for-byte; when on (central mode) it routes to `getOrProvisionUserSpreadsheet_()` in `central_provisioning.js`. The file also owns `isCentralModeEnabled_()` (fail-closed script-property read) and `getCurrentUserEmail_()` (identity via `Session.getEffectiveUser()` — `getActiveUser()` is deliberately avoided because it returns empty for non-Workspace users under `USER_ACCESSING`). Provisioning logic lives in `central_provisioning.js`, not here — this file stays small and seam-like. See `## Current architecture — Central App (live)` below. Historical per-slice migration detail (Phases 1–4 resolver seams, the standalone-project build, runtime evidence) is preserved in `SESSION_NOTES.md → Current State — Post V1.2 Prep` and the `CENTRAL_APP_*.md` planning docs.
- central_provisioning.js = Central App provisioning + mapping (the workbook lifecycle behind the resolver). Allow-list (`FAMILY_BETA_ALLOWLIST`), mapping store (`mapping::<sha256(email)>` script-property keys), `getOrProvisionUserSpreadsheet_`, `provisionWorkbookForUser_` (creates `CashCompass — <email>` in the caller's Drive via `Drive.Files.create` under `LockService`, bootstraps `INPUT - Settings`, writes the mapping), `handleStaleMapping_` (throws `StaleMappingError`, never auto-reprovisions), and `clearMappingForUser_` (manual recovery). Soft-delete (`setTrashed`) is the only file-modifying action ever taken on a user-owned workbook, and only before the mapping write.
- dashboard_data.js = main dashboard snapshot + bills due backend (case/whitespace-tolerant `INPUT - Bills` header lookup in `getInputBillsDueRows_`)
- activity_log.js = LOG - Activity (`appendActivityLog_`, `deleteActivityLogRow` donation-only from web UI, dedupe keys for bill autopay, `getActivityDashboardData` / `getActivityLogForDashboard`, house expense + suppress duplicate **`quick_pay`** when CF is posted from the same save, `bill_add` / `bill_update` / `bill_deactivate` / `house_add` / `house_deactivate` / `investment_add` / `investment_deactivate` / `bank_account_deactivate` classification; `bill_update`, `bill_deactivate`, `house_deactivate`, `investment_deactivate`, and `bank_account_deactivate` marked non-monetary so Amount renders as **—**. `bill_update` carries an inline label (`Updated Default Amount to $X.XX` / `Updated Due Day to N` / `Updated <Field>` / `Updated N fields`) via `billUpdateActionLabel_`. `bank_account_add` is monetary — Amount shows the supplied opening balance, or 0 when none was provided.)
- investments.js = `addInvestmentAccountFromDashboard`, `deactivateInvestmentAccountFromDashboard`, `getInvestmentUiData` (active-only accounts + Type dropdown options). Self-heals the **Active** column on every **INPUT - Investments** year block and on **SYS - Assets**; preserves totals / delta rows when inserting new account rows.
- bank_accounts.js = `addBankAccountFromDashboard`, `deactivateBankAccountFromDashboard`, `getBankAccountUiData` (active-only accounts + Type dropdown options + Use Policy datalist). Self-heals the **Active** column on every **INPUT - Bank Accounts** year block and on **SYS - Accounts**; preserves totals / delta rows; appended **SYS - Accounts** rows inherit neighbor row formatting (borders, font, number formats, row height) via `findAccountsTemplateRow_` + `PASTE_FORMAT`. Writes **Priority** (default 9, range 1–99) to the canonical **SYS - Accounts → Priority** column when present.
- bank_import.js = Bank Import pipeline. **Step 2a** ingestion (`processBankImportBatch_(payload)`): ignored-check, exact-`External Account Id` auto-match against **SYS - Accounts**, pending staging upserts on **SYS - Import Staging — Bank Accounts** with `Status = pending` and a fixed `Pending Reason` enum, balance-fingerprint dedupe. **Step 2b / 2d** review + Apply public entry points (all `LockService.getDocumentLock()` wrapped): `getBankImportReviewData()`, `addStagedBankAccountAsNew(payload)` (link-only — no opening balance written), `matchStagedBankAccountToExisting(payload)` (writes only the External Account Id cell; refuses cross-link overwrites), `unlinkMatchedStagedBankAccount(payload)` (Change match — clears External Account Id, flips Status back to `pending`), `ignoreStagedBankAccount(payload)` (appends to **SYS - Import Ignored — Bank Accounts** with `Scope = permanent`), and `applyStagedBankAccountBalance(payload)` (writes the staged snapshot to the matching month on **INPUT - Bank Accounts** using the same write path Bank → Update uses; mirrors **SYS - Accounts.Current Balance**; refuses on `stale_balance` / `currency_mismatch` / `type_conflict` / inactive linked account / missing Year block; `bankImportEnsureInputRowForApply_` auto-creates a missing **INPUT - Bank Accounts** row when the year block exists but the account row is absent, logged as `autoCreatedInputRow: true` on the apply activity row). **Step 3a** CSV-paste backend wrapper (`processBankImportCsvPasteBatchFromDashboard(payload)`, gated behind UI flag `BANK_IMPORT_CSV_PASTE_ENABLED`, default `false`) routes through `processBankImportBatch_` with `source = 'csv_paste_v1'`. **Dev harness** (`devRunBankImportSampleFromDashboard()`, `_devRunBankImportSample()`, `_devRunBankImportCustom_(payload)`) gated by UI flag `BANK_IMPORT_DEV_TOOLS_ENABLED`, default `false`. Activity events all go through `bankImportLogActivity_` / `bankImportLogApplyBalanceActivity_`; classification falls under the **Bank Import** kind via the `bank_import_*` prefix rule in `activity_log.js`.
- debounce_planner.js = Planner email debounce queue (`ensureDebouncePlannerTrigger_()` registers a 5-minute time-driven trigger from `getDashboardSnapshot()`; `bumpDebouncePlannerLastSaveAt_()` / `bumpDebouncePlannerDeferredCount_()` update `DocumentProperties` on every deferred save; `debouncePlannerEmailRun()` fires after a 10-minute quiet window and runs `runDebtPlanner({ emailMode: 'send' })` once; `readDebouncePlannerDeferredCount_()` returns the rolled-up `deferredSaveCount` so the `planner_email_sent` row reports `(N saves batched)`; `markDebouncePlannerEmailSettled_()` clears the queue and the deferred-count after every `'send'` run — even when the meaningfulness gate or no-recipients gate skips actual mail).
- bills.js = `addBillFromDashboard`, `updateTrackedBillFromDashboard` (in-place edit on an active row — Payee / Default Amount / Due Day / Frequency / Payment Source / Category / Autopay / Varies / Notes; per-field diff with **only changed cells** written; refuses inactive rows and stale `expectedPayee`; no-op saves return `No changes.` without logging; never moves the row, never touches Active / Start Month, never retroactively rewrites Cash Flow rows), `deactivateBillFromDashboard`; case/whitespace-tolerant header lookup; self-heals **INPUT - Bills** by auto-adding missing optional columns (Payment Source, Category, Frequency, Start Month, Notes) before append. `getActiveBillsForManagementFromDashboard` returns `notes` so the Edit form can pre-fill it.
- quick_add_payment.js = `quickAddPayment`, `getQuickAddPreview`, prefill API; `resolveFlowSourceFromBillOrDebt_` server-side fallback populates **Flow Source** on newly created Cash Flow rows from **INPUT - Bills.Payment Source** (or inferred CREDIT_CARD / CASH from **INPUT - Debts**) when the caller doesn't pass one
- donations.js = **INPUT - Donation** append (`getDonationsFormData`, `addDonation`)
- other feature files exist for house, debts, payments, retirement, etc.

## Current architecture — Central App (live)

CashCompass now runs in **two coexisting shapes** that share one codebase. The boundary is enforced by the `CENTRAL_MODE` script property and by deployment-pinning. The Central App is no longer a "future direction" — it is operational and runtime-validated; the migration discipline in `WORKING_RULES.md → Central App Transition Rules` is the **active** governing policy.

### Two projects / two modes

- **Bound Project (legacy / developer data path).** The original Apps Script project bound to the developer's personal workbook. With `CENTRAL_MODE` unset/off (the default), `getUserSpreadsheet_()` returns `SpreadsheetApp.getActiveSpreadsheet()` byte-for-byte — existing bound behavior is fully preserved. Its deployment is pinned to a pre-central script version so the developer's live data keeps working unchanged.
- **Central App Project (standalone).** A separate Apps Script project, `CashCompass — Central App` (not bound to any spreadsheet), with its own deployment URL. It **always runs central mode** as a structural invariant (no flag branch in that project's resolver). Each allow-listed Google account that opens the deployment gets its own Drive-owned workbook provisioned on first access.

### CENTRAL_MODE

- Script property read by `isCentralModeEnabled_()` in `central_resolver.js`. Only the literal string `"true"` enables central mode; anything else (including unset) is bound mode. Reads fail closed (any error → off).
- In the bound project the flag is the live switch between legacy and central behavior; in the standalone central project central mode is unconditional.
- **Rollback is tier-1 immediate:** flipping `CENTRAL_MODE` back to off reverts the resolver to the legacy `getActiveSpreadsheet()` pass-through across every execution context, no redeploy required, no user workbook deleted.

### Provisioning

- Lives in `central_provisioning.js`, behind `getOrProvisionUserSpreadsheet_()`.
- `doGet` enforces the **allow-list gate** (`FAMILY_BETA_ALLOWLIST`, CSV of emails; empty = nobody → fail closed) before render; unauthorized callers see `renderAllowlistRejection_()` with no Drive create, no mapping write, no data access.
- First access with no mapping → `provisionWorkbookForUser_(email)` acquires `LockService.getUserLock().tryLock(30000)`, double-checks inside the lock, then `Drive.Files.create({ name: 'CashCompass — <email>', mimeType: 'application/vnd.google-apps.spreadsheet' })` in the caller's Drive root, `SpreadsheetApp.openById(fileId)`, `runMinimalBootstrap_(ss)` (creates the canonical `INPUT - Settings` tab; all other sheets are created lazily on dashboard render), then `writeSpreadsheetIdForUser_(email, fileId)`. Any failure before the mapping write soft-deletes the orphan file (`setTrashed`) — **never a hard delete** of a user-owned workbook.
- **Stale mapping** (mapped workbook trashed/unreachable) → `handleStaleMapping_` throws `StaleMappingError` with a human-readable message; **no auto-reprovision**. Manual recovery is `clearMappingForUser_(email)`.

### Workbook mapping

- Stored as `mapping::<sha256(email)>` keys in the **central project's** script properties (raw emails are never stored). Bound mode does not use the mapping store.

### Family Beta readiness

- Provisioning runtime-validated: **Phase A** (developer account) and **Phase B** (disposable second account) both PASS — separate user-owned workbooks, `INPUT - Settings` bootstrapped, mappings written, no cross-user data leakage, bound deployment unaffected.
- Current maturity: **stable and family-beta capable.** Read-only admin diagnostics (Phase 2A) and durable workbook identity markers (Phase 6B) are live; the recovery stack (6C.1 / 6D.1 / 6D.2a / 6E.1) is implemented and **flag-gated OFF**, with **healthy-path validation done (2026-06-09)** but the **destructive/edge paths still unvalidated**. The production / bound workbook stays protected throughout.
- **Known hardening items (Phase 2 — Family Beta Hardening, see `TODO.md → Roadmap` and `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`):** read-only diagnostics (Phase 2A) ✅ and identity markers (Phase 6B) ✅ are done; the recovery stack is **built and healthy-path validated but destructive-path unvalidated** (6C.1 adopt, 6D.1 recovery page, 6D.2a reconnect, 6E.1 admin inspect/clear). The active step is **Recovery Validation (6F)** (destructive/edge-path test pass). Remaining slices: 6D.2b Create New Workbook, 6E.2 Admin Set Mapping. Also remaining: Tier 2 `getActiveSpreadsheet()` migration of the full dashboard, and the bound project's manifest revert once central is primary.
- Full per-slice migration history (manifest prep, resolver/provisioning slice, standalone project build, runtime evidence) is in `SESSION_NOTES.md → Current State — Post V1.2 Prep` and the `CENTRAL_APP_*.md` planning docs (`CENTRAL_APP_DESIGN.md`, `CENTRAL_APP_CENTRAL_PROJECT_SETUP_CHECKLIST.md`, `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md`, `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md`, others).
- **Active Phase 2 design:** `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md` — read-only duplicate / orphan / stale workbook detection, classification, marker strategy, and admin audit functions (Phase 2A), with Phase 2B recovery scope recorded in its `§10`.

### Benefits (now being realized)

- **Instant updates for all users** — the deployed script version is the single source of truth; no per-copy redeploys.
- **No version drift** — every central user runs the same code at the same time.
- **Easier support** — one canonical code path; user-specific issues isolate to data, not code.
- **Foundation for monetization** — the mapping store is the natural anchor for per-user plan / entitlement records (see `ENHANCEMENTS.md → Future direction — Monetization` and `TODO.md → Monetization`).

## Workbook Identity & Recovery (live + roadmap)

The Central App can lose track of a user's workbook (cleared/lost mapping, trashed workbook, two-project migration, manual edits). To make recovery safe and prevent silent duplicate provisioning, each workbook now carries **durable identity markers** and the central project keeps a **reverse index**. This section is intentionally high-level — implementation detail lives in `central_provisioning.js`, `central_diagnostics.js`, and `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md` so it does not go stale here.

**What's live — identity (Phase 6B, no behavior change):**

- **Identity markers** — a workbook is stamped with a durable identity marker at create time, with **lazy backfill** when a mapped workbook opens without one. The markers let diagnostics and recovery confidently confirm "this workbook belongs to this user."
- **Reverse index** — the central project keeps a `spreadsheetId → user` index so a found workbook can be traced back to its owner without opening it as that user.
- **`SYS - Meta` sheet** — a lightweight, hidden in-workbook marker sheet that survives Drive-level metadata loss (e.g. file copy), as a secondary identity signal.
- **Admin marker diagnostics** — read-only, admin-gated visibility into which markers are present / matching for a given user.

**What's implemented — recovery stack (shipped behind flags, default OFF; healthy-path validated 2026-06-09, destructive/edge paths pending — see `## Recovery Validation Inventory`):**

- **6C.1 Adopt-Before-Create** (`CENTRAL_AUTO_ADOPT`) — at provisioning time, with no mapping: 1 strict candidate → adopt; ≥2 → `AmbiguousWorkbookError`; 0 → create. Creates/deletes nothing when adopting.
- **6D.1 Recovery Page** — display-only recovery screen (stale / ambiguous / unavailable) instead of raw errors; routed from the startup gate.
- **6D.2a Reconnect** (`CENTRAL_RECOVERY_ACTIONS`) — self-scoped, user-initiated relink to a single existing candidate (no Drive create).
- **6E.1 Admin Inspect + Clear Mapping** (`CENTRAL_ADMIN_REPAIR`) — admin read-only inspect + guarded, audited, mapping-store-only clear (deletes mapping + reverse-index property; **no Drive writes, no file deletion**).

Because every recovery/adopt/repair write is behind a fail-closed flag (default OFF) and the central-mode gate, **steady-state behavior is unchanged until a flag is turned on** for testing. See `## Flag Registry`.

**Recovery roadmap (remaining):**

- **6F — Recovery Validation** *(current)* — healthy-path load validated (2026-06-09); remaining = destructive/edge-path test pass (adopt ON, real stale-mapping recovery, executed reconnect + admin clear, ambiguous handling) on a disposable account, then flags OFF.
- **6D.2b — Create New Workbook** — self-service "start fresh" action (designed; not implemented). Separate flag, confirm, duplicate-avoidance-first.
- **6E.2 — Admin Set Mapping** — guarded admin remap to an admin-supplied ID (designed; not implemented).

## Flag Registry

Feature flags are central-project **script properties** (`PropertiesService`), read at runtime, **default OFF**, and **fail closed** (absent / unparseable → treated as OFF). They gate the recovery stack so it can ship dark and be enabled only for a controlled validation pass. Set a value to `true` (string) to enable; delete or set anything else to disable.

| Flag | Default | Status | Gates | Behavior when OFF |
| --- | --- | --- | --- | --- |
| `CENTRAL_AUTO_ADOPT` | OFF | Implemented, **not fully runtime-validated** | 6C.1 Adopt-Before-Create at provisioning time (`tryAdoptWorkbookBeforeCreate_`) | No adoption; provisioning creates a new workbook as before. |
| `CENTRAL_RECOVERY_ACTIONS` | OFF | Implemented, **healthy-path validated** | 6D.2a user-initiated Reconnect action on the recovery page (`recoveryReconnectSelf`) | Recovery page is display-only; the Reconnect button is hidden. |
| `CENTRAL_ADMIN_REPAIR` | OFF | Implemented, **healthy-path validated** | 6E.1 admin Inspect + Clear Mapping (`adminInspectUser`, `adminClearMapping`) | Admin repair endpoints return disabled / no-op; no mapping writes. |

**Healthy-path validation note (2026-06-09):** the central dashboard was loaded with `CENTRAL_RECOVERY_ACTIONS=true` + `CENTRAL_ADMIN_REPAIR=true` + `CENTRAL_AUTO_ADOPT=false`. The existing workbook resolved correctly, no recovery page triggered, no regression. Admin Diagnostics loaded with the Repair Toolkit visible; Inspect User, mapping preview, reverse-index visibility, and the confirm-before-clear UI all rendered. **Not yet exercised:** the destructive/edge paths — an actual mapping clear, a real stale-mapping recovery, ambiguous-candidate handling, and any adopt with `CENTRAL_AUTO_ADOPT=true`. See `## Recovery Validation Inventory`.

Per-flag detail:

- **`CENTRAL_AUTO_ADOPT`**
  - **Purpose:** at provisioning time with no mapping, adopt a single strict candidate workbook instead of silently creating a duplicate (≥2 candidates → `AmbiguousWorkbookError`).
  - **Risk:** **High** — it is the only flag that changes the provisioning/create path and can relink a user to a workbook automatically. A wrong adopt would point a user at the wrong workbook.
  - **Recommended usage:** keep OFF until the 6F validation pass exercises adopt + ambiguous handling on a disposable account; do not enable in family beta until validated.
- **`CENTRAL_RECOVERY_ACTIONS`**
  - **Purpose:** show the self-service "Reconnect existing workbook" action on the recovery page so a user can relink a single candidate themselves.
  - **Risk:** **Medium** — user-initiated and self-scoped, but it does write a mapping. The reconnect path is unproven end-to-end (the relink itself hasn't been run live).
  - **Recommended usage:** safe to enable for controlled testing (healthy-path load is validated); validate the actual reconnect-relink on a disposable account before family-beta reliance.
- **`CENTRAL_ADMIN_REPAIR`**
  - **Purpose:** expose the admin Repair Toolkit — read-only Inspect User + a guarded, audited Clear Mapping (mapping store + reverse index only).
  - **Risk:** **Medium** — Inspect is read-only and admin-gated; Clear Mapping is a guarded write to the mapping store only (**no Drive writes, no file deletion**), but clearing the wrong user's mapping would force a re-provision/recovery on their next visit.
  - **Recommended usage:** safe to enable for admin testing (inspect/preview/confirm UI validated); only run an actual Clear Mapping against a disposable test user until the destructive path is validated.

Notes:

- These are **independent** of `CENTRAL_MODE` (which selects central vs bound) and of the existing `FAMILY_BETA_ALLOWLIST` / `ADMIN_EMAILS` properties.
- The **Recovery Page (6D.1)** itself is **not** flag-gated — it always replaces a raw resolution error with a friendly screen. Only the *self-service action* on it (Reconnect) is gated by `CENTRAL_RECOVERY_ACTIONS`.
- All three flags are **OFF in the committed state**; the recovery stack is inert until deliberately enabled. Healthy-path load was validated on 2026-06-09; the destructive/edge paths still need the **Recovery Validation (6F)** pass, after which flags return OFF for steady state.

## Recovery Validation Inventory

Tracks how far each recovery-stack capability has actually been **runtime-validated** (vs merely implemented). As of **2026-06-09** a healthy-path validation pass ran with `CENTRAL_RECOVERY_ACTIONS=true` + `CENTRAL_ADMIN_REPAIR=true` + `CENTRAL_AUTO_ADOPT=false`. **6F Part 2 (2026-06-10)** additionally validated the **Admin Repair disabled-path** (all flags OFF → clicked Clear returns "Repair is disabled (flag off)." with no writes). The remaining work is the destructive/edge-path pass with flags ON (**6F**). Risk = blast radius if the path misbehaves.

**Implemented + tested (validated):**

- **Identity markers (6B)** — Status: validated (in use since 6B; markers/reverse-index/`SYS - Meta` written + read). Risk: Low. Timing: done.
- **Admin Inspect User (6E.1, read-only)** — Status: validated — Diagnostics page + Repair Toolkit load, Inspect User works, mapping preview + reverse-index visibility render. Risk: Low (read-only, admin-gated). Timing: done.
- **Recovery flags healthy-path load** — Status: validated — dashboard loads normally with recovery + admin-repair flags ON and auto-adopt OFF; existing workbook resolves; no recovery page; no regression. Risk: Low. Timing: done.
- **Confirm-before-clear UI (6E.1)** — Status: validated — the confirmation UI renders (the *prompt*, not an executed clear). Risk: Low (UI only). Timing: done.
- **Admin Repair disabled-path enforcement (6E.1)** — Status: validated (6F Part 2, 2026-06-10) — with `CENTRAL_ADMIN_REPAIR=false`, Inspect/preview work but a clicked **Clear Mapping** returns "Repair is disabled (flag off)." with **no** mapping / reverse-index / workbook change. Confirms the server-side flag gate fails closed. Risk: Low. Timing: done.

**Implemented + partially tested:**

- **Recovery Page (6D.1)** — Status: code present + does not trigger on the healthy path; **not** yet triggered by a real failure. Risk: Medium (it's the user-facing failure surface). Timing: 6F — force a stale mapping on a disposable account and confirm the page renders for stale/ambiguous/unavailable.
- **Reconnect action (6D.2a)** — Status: button/flag wired and visible; the actual self-scoped relink has **not** been executed live. Risk: Medium (writes a mapping). Timing: 6F — run an end-to-end reconnect on a disposable account.

**Implemented + not yet tested:**

- **Adopt-Before-Create with `CENTRAL_AUTO_ADOPT=true` (6C.1)** — Status: not tested (flag was OFF during validation). Risk: **High** (changes the provisioning/create path; can auto-relink). Timing: 6F, isolated, disposable account only.
- **Recovery stale-mapping flow (end-to-end)** — Status: not tested (no failure has been induced). Risk: Medium–High. Timing: 6F — induce a safe stale mapping (clear only the test user's mapping via `clearMappingForUser_`, data untouched).
- **Ambiguous-candidate handling (≥2 → `AmbiguousWorkbookError`)** — Status: not tested. Risk: Medium. Timing: 6F.
- **Admin Clear Mapping action (executed with flag ON) (6E.1)** — Status: UI + **disabled-path enforcement** validated (6F Part 2); the **executed clear with `CENTRAL_ADMIN_REPAIR=true`** has not been run. Risk: Medium (mapping-store write; wrong target forces re-provision/recovery). Timing: 6F, disposable test user only.

## Bound Project Safety

**Current conclusion: SAFE TO PUSH TO BOUND.** The recovery stack does not change bound-mode behavior, because:

- **Central code is gated by `CENTRAL_MODE`** — the resolver routes to provisioning/recovery only in central mode; in bound mode `getUserSpreadsheet_()` returns the active spreadsheet as before.
- **Recovery actions fail closed** — all three flags default OFF and unparseable/absent → OFF; adopt/reconnect/admin-repair write paths are unreachable when OFF.
- **`SYS - Meta` creation is downstream of Central provisioning** — markers are written on the central create/adopt path, not on any bound write path.
- **Bound workbook is unaffected** — no recovery/adopt/repair code runs against the bound workbook; the production data path is untouched.

**Operational precondition (before any future bound deployment):** verify the **allow-list** (`FAMILY_BETA_ALLOWLIST`) and the **bound deployment configuration** (manifest `executeAs` / `access`, pinned vs head version) before redeploying the bound URL to head — a fail-closed allow-list means an unset property would show the rejection page on the bound URL too.

## Family Beta workbook styling

Newly provisioned (and first-create) workbooks are styled to a shared **Family Beta** standard so they visually match the production/bound workbook. Styling is **first-create-only** and uses **widen-only** column logic, so it never reformats or shrinks an existing populated sheet (honors `WORKING_RULES.md → No destructive sheet changes`).

**Family Beta standard:** yellow header band (`#ffe599`, bold, 16pt, ~40px height, vertical-middle); white body (14pt); subtle gray section/year rows (`#d9d9d9` with a `#999999` bottom border); defensive green totals (`#b6d7a8`, applied only if a total row is present); defensive tan delta (`#fce5cd`); frozen header/year rows + first column; widen-only widths tuned for the 16pt header.

**Completed (helpers + first-create wiring):**

- **Bank Accounts** — `applyBankAccountsSheetStyling_` (bank_accounts.js). Gray Year banner, yellow header, white data rows; includes the empty-block **first-account-row** fix in `insertNewBankAccountHistoryRow_` (the first account in a fresh block no longer inherits header styling).
- **Debts** — `applyDebtsSheetStyling_` (debts.js). Yellow header, white body, tuned widths, defensive green `TOTAL DEBT` band when present.
- **Bills** — `applyBillsSheetStyling_` (bills.js). Yellow header, white body, tuned widths.
- **Upcoming Expenses** — `applyUpcomingExpensesSheetStyling_` (upcoming_expenses.js), wired in `getOrCreateUpcomingExpensesSheet_`'s create branch.

**Pending (later phases):** Investments, House Values, and Cash Flow palette migration (their existing styling helpers run on bound-mode write paths, so they must be gated to first-create only); Retirement bespoke section-aware styling; an optional shared `applyReadableColumnWidths_` helper. Detailed plans live in `CENTRAL_APP_FAMILY_BETA_PLAN.md` and `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`. The **Workbook Totals Project** (TOTAL DEBT / Total Accounts / Delta row generation) is Phase 3 in `TODO.md → Roadmap`.

## Important resolved infra issues
- Duplicate doGet() caused template problems before. Only keep one active doGet().
- Duplicate includeHtml_() caused malformed HTML/script include problems before.
- Correct include helper should use raw content, not HTML parsing, for included script files. **Contributor detail:** `WORKING_RULES.md` explains why included fragments cannot contain their own template tags.
- The dashboard now renders correctly again.

## Current business rules for bills / cash flow
- Blank Cash Flow cell = due / unhandled
- 0 in Cash Flow = skipped / handled
- Non-zero value in Cash Flow = paid / handled

## Bills Due design now

### Debt bills
- come from DEBTS

### Mapped recurring non-debt bills
- come from INPUT - Bills

### Fallback recurring bills
- should remain visible in the Recurring Bills (No Due Date) section until they are migrated into INPUT - Bills

## INPUT - Bills structure
Columns (header lookup is **case- and whitespace-tolerant** — `PAYMENT SOURCE` and `Payment Source ` with a trailing space both match):
- Payee
- Category *(required for new bills via Add bill)*
- Due Day
- Default Amount
- Varies
- Autopay
- Active *(Stop tracking sets this to `No`)*
- Payment Source *(CASH | CREDIT_CARD — drives **Flow Source** on Cash Flow rows created from Bills → Pay)*
- Frequency
- Start Month *(rows created from Bills → Pay leave months before this blank)*
- Notes

Missing optional columns (Payment Source, Category, Frequency, Start Month, Notes) are auto-added by `addBillFromDashboard` before writing a new row.

## Bills behavior wanted
- If current month due date passed and Cash Flow cell is blank, show overdue
- If current month is handled, roll forward and show next cycle when appropriate
- Quarterly bills should only apply in scheduled months
- Autopay = Yes and Varies = No → okay to auto-write
- Autopay = Yes and Varies = Yes → do not auto-write
- Default Amount = 0 → still list in Bills Due when unhandled; autopay does not write (use Pay / manual Cash Flow for the amount)
- Fallback recurring bills should show overdue or upcoming correctly

## Current UI state
- Bills Due is rendering
- Labels exist: category, autopay, varies, source
- Some fallback recurring bills are missing and need fixing

## Important files most likely to edit next
- dashboard_data.js
- Dashboard_Script_BillsDue.html

## Next task
See **`TODO.md`** for current priorities (there is no separate next-task file).

## Release / “how far from 1.0?”
See **`GoingToProduction.md`** — Goal A vs B, suggested **v0.9** label, three-bar interpretation of **1.0**, and what blocks broader distribution. Update that file when the readiness story changes so chat sessions don’t re-derive it.

## First-time setup
- Step-by-step (workbook, deploy web app, smoke check): **`FIRST_RUN.md`**.  
- **Canonical template workbook (optional):** Add a “known good” Google Sheets link here when you freeze one for your household—omit from public repos if the URL is sensitive.  
  - *Template link: (none yet — add when ready.)*