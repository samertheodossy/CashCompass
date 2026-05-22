# CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md

Inventory + analysis of the additive bootstrap coverage that already exists in the CashCompass codebase, with a determination of how close the app is today to zero-sheet onboarding.

**Analysis only.** No Apps Script code change, no HTML change, no deployment change, no implementation. This document does **not** authorize implementation. Any follow-up coverage gap requires its own Cursor implementation prompt with explicit user approval, per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9` and `CENTRAL_APP_DESIGN.md → §9 Guardrails`.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — additive bootstrap contract.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — onboarding states, bootstrap semantics, recovery.
- `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §5.bis / §6.4 / §10.2` — this audit is the recommended next step.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md → §4 / §6 Phase 3` — additive bootstrap is the family beta path.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — call-site inventory for the resolver migration.
- `sheet_bootstrap.js` — the existing centralized bootstrap registry.

---

## 1. Purpose

The product decision in `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §5.bis` pins the family beta proof to a real onboarding flow: a brand-new user opens the central app URL, the app creates a workbook in the user's Drive, and the existing additive ensure-\* chain creates canonical structure on demand until the user reaches Setup / Review and the dashboard hands-off.

That plan rides on a single, untested assumption: **the existing ensure-\* coverage is complete enough that a freshly created blank workbook can become a usable CashCompass workbook without the developer manually pre-creating sheets.**

This audit determines whether that assumption holds. It answers six concrete questions:

1. Which canonical sheets does the current codebase already create automatically, and through which entry points?
2. Which canonical sheets have *no* safe automatic creator today?
3. For each major dashboard surface, what happens on a fully blank workbook — does it render a calm empty state, render incorrectly, or surface a red banner?
4. Where does the per-domain ensure-\* pattern break the additive contract (e.g. destructive reset, overwrites populated sheets, assumes active spreadsheet incorrectly)?
5. What would a central-mode first-run path still need on top of the existing ensure-\* chain to reach Setup / Review hands-off?
6. Which Decision Pending items in `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` are actually blocking the first family beta proof, and which are deferrable?

The output is a structured map — not implementation. Every gap surfaced becomes its own future Cursor implementation prompt, scoped to a single additive ensure-\* helper, with the same safety contract as the existing helpers in `sheet_bootstrap.js`.

This audit is **inventory + analysis only**. No code is modified.

---

## 2. Required workbook surfaces

The canonical sheet schema, gathered from `config.js → getSheetNames_()`, `profile.js → PROFILE_SETTINGS_SHEET_NAME_`, `donations.js → DONATION_SHEET_NAME_`, `activity_log.js → ACTIVITY_LOG_SHEET_NAME`, `upcoming_expenses.js → 'INPUT - Upcoming Expenses'`, `retirement.js → 'INPUT - Retirement'`, and `home.js → 'HOME'`.

### 2.1 Required INPUT sheets (user-facing data)

| Sheet name | Owning area | Required by | Notes |
|---|---|---|---|
| `INPUT - Settings` | Profile / household setup | Profile DOB, Retirement Outlook, Setup / Review | Key/Value table; self-heals empty header row. |
| `INPUT - Bank Accounts` | Accounts / bank balances | Bank Accounts UI, sync, Cash totals | Per-year block, MMM-YY columns, Active column. |
| `INPUT - Investments` | Investments | Investments UI, sync, Investment totals | Per-year block, MMM-YY columns, Active column. |
| `INPUT - House Values` | House Values | House Values UI, Property Performance | Per-year block, MMM-YY columns, Active column. |
| `INPUT - Bills` | Bills | Bills Due, Manage Bills, Bills add/edit/stop | Single flat table with `Active` self-heal. |
| `INPUT - Debts` | Debts | Debts UI, Planner, Bills Due (debt bills), Rolling Debt Payoff, Debt Payoff Projection | Flat list of debts, `Active` column self-healed. |
| `INPUT - Cash Flow <year>` | Cash Flow | Quick Add, Bills Due, Property Performance, Donations, every dashboard cash card | Per-year sheet with Type/Flow Source/Payee/Active + MMM-YY columns + Total + Summary row. |
| `INPUT - Donation` | Donations | Donations UI, donations log undo | Year-blocked layout, no flat header. |
| `INPUT - Upcoming Expenses` | Upcoming Expenses | Cash Flow page → Upcoming card, Quick Add deep-link | Flat table with ID/Status/etc. |
| `INPUT - Retirement` | Retirement | Retirement Outlook card, scenario save | Scenario table with Setting/Value/Conservative/Base/Aggressive rows. |

### 2.2 Required SYS sheets (canonical aggregations)

| Sheet name | Owning area | Required by | Notes |
|---|---|---|---|
| `SYS - Accounts` | Bank Accounts | `buildDashboardSnapshot_` (Cash total), Planner, Quick Add, Bank Import target | Flat table; canonical headers. |
| `SYS - Assets` | Investments | Dashboard Investments total | Flat table, includes Active column. |
| `SYS - House Assets` | Houses | Dashboard House Equity, Property Performance, Bills-from-House-Expenses, House Values UI | Flat table; House + Type + Current Value + Loan Amount Left + Active. |
| `SYS - Import Staging — Bank Accounts` | Bank Import | Bank Import scaffold | Lazy-created by `ensureImportStagingBankAccountsSheet_`. |
| `SYS - Import Ignored — Bank Accounts` | Bank Import | Bank Import ignore list | Lazy-created by `ensureImportIgnoredBankAccountsSheet_`. |

### 2.3 Required LOG / OUT / per-house sheets

| Sheet name | Owning area | Required by | Notes |
|---|---|---|---|
| `LOG - Activity` | Activity log | Every write path that logs events; Activity page | Ensured lazily on every `buildDashboardSnapshot_` call. |
| `OUT - Dashboard` | Planner output | `writeRecommendations_` (planner run) | Planner-owned. **Destructively rebuilt every run.** |
| `OUT - History` | Planner history | Planner snapshot history; dashboard delta cards | Created by `ensureHistorySheet_` during planner run. |
| `HOUSES - <Name>` (one per house) | House Expenses | House Expenses page, Property Performance | **No automatic creator.** Sheets must already exist. |
| `HOME` (optional admin) | Tab index | `buildHomePage` (developer menu) | Developer-facing only; not part of the user flow. |

### 2.4 Sheets not directly required at first run

`OUT - Dashboard` and `OUT - History` are not required to render the web app dashboard. They are written by the planner. The web app's `buildDashboardSnapshot_` builds its own snapshot from INPUT and SYS sheets and reads `OUT - History` defensively (`if (!sheet) return [];`). The planner-output sheets only materialize when the user explicitly runs the planner.

---

## 3. Existing ensure-\* helpers — inventory

Each row records: helper name, owning file, sheet it creates, additive-vs-destructive contract, entry points that invoke it, whether it accepts `ss` explicitly or assumes the active spreadsheet, and any caveats.

### 3.1 The central bootstrap registry

`sheet_bootstrap.js` is the load-bearing centralized layer.

- `ensureBootstrapSheet_(key, mode)` — single-sheet resolver. Looks up `key` in `getBootstrapSheetRegistry_()`, resolves the canonical name, and delegates to the safe per-domain creator only when the sheet is missing.
- `ensureOnboardingCoreSheetsFromDashboard(mode)` — bulk resolver. Iterates `BOOTSTRAP_CORE_KEYS_`: `SETTINGS`, `BANK_ACCOUNTS`, `DEBTS`, `BILLS`, `UPCOMING`, `CASH_FLOW_YEAR`.
- `getOnboardingBootstrapStatusFromDashboard()` — read-only diagnostic. Returns per-key `{exists, supported}` state without creating anything.
- `getStartupRoutingFromDashboard()` — read-only blank-workbook probe used by the web app at startup. Returns `isBlankWorkbook: true` only when the workbook contains zero sheets with `INPUT - `, `SYS - `, `OUT - `, or `LOG - ` prefixes.
- `workbookHasAnyAppSheet_(ss)` — internal helper for the probe.

Safety properties enforced by the registry: never deletes, never renames, never replaces, never clears, never rewrites headers on populated sheets, idempotent. Unsupported keys are surfaced with `unsupported: true` and a `blockerReason` rather than guessed.

### 3.2 Per-domain canonical creators

| Helper | File | Sheet | Contract | Entry points | Uses `ss` | Notes |
|---|---|---|---|---|---|---|
| `ensureInputSettingsSheet_` | `profile.js:166` | `INPUT - Settings` | Additive; self-heals blank header row | Profile read/write, bootstrap registry | active spreadsheet | Safe. |
| `ensureOnboardingBankAccountsSheetFromDashboard(mode)` | `onboarding.js:1874` | `INPUT - Bank Accounts` | Additive; never overwrites | Bank Accounts onboarding, bootstrap registry | active spreadsheet | Test-mode-aware; canonical headers. |
| `ensureOnboardingDebtsSheetFromDashboard(mode)` | `onboarding.js:986` | `INPUT - Debts` | Additive; never overwrites | Debts onboarding, bootstrap registry | active spreadsheet | Test-mode-aware; canonical headers. |
| `ensureOnboardingBillsSheetFromDashboard(mode)` | `onboarding.js:1193` | `INPUT - Bills` | Additive; never overwrites | Bills onboarding, bootstrap registry | active spreadsheet | Test-mode-aware. |
| `ensureOnboardingUpcomingSheetFromDashboard(mode)` | `onboarding.js:1389` | `INPUT - Upcoming Expenses` | Additive; delegates to `getOrCreateUpcomingExpensesSheet_` | Upcoming onboarding, bootstrap registry | active spreadsheet | Wrapper. |
| `ensureOnboardingCashFlowYearSheetFromDashboard(mode)` | `cashflow_setup.js:795` | `INPUT - Cash Flow <year>` | Additive; wraps `ensureCashFlowYearSheet_` | Cash Flow onboarding, bootstrap registry | active spreadsheet | Wrapper. |
| `ensureCashFlowYearSheet_(year)` | `cashflow_setup.js:473` | `INPUT - Cash Flow <year>` | Additive; canonical MMM-YY headers + Summary row | Quick Add, Bills Due writes, planner | active spreadsheet | Seeds Summary row formulas. |
| `ensureCashFlowSummaryRow_(sheet)` | `cashflow_setup.js:607` | Summary row inside Cash Flow | Additive; appends if missing | Cash Flow creation | n/a | Idempotent. |
| `getOrCreateUpcomingExpensesSheet_` | `upcoming_expenses.js:678` | `INPUT - Upcoming Expenses` | Additive; canonical headers | Upcoming Expenses add | active spreadsheet | Hardcoded sheet name (not via `getSheetNames_()`). |
| `getOrCreateRetirementSheet_` | `retirement.js:722` | `INPUT - Retirement` | Additive; seeds scenario template rows on first creation | Retirement read/save | active spreadsheet | Idempotent. |
| `ensureSysAccountsSheet_` | `bank_accounts.js:24` | `SYS - Accounts` | Additive; canonical headers | Bank Account add, sync | active spreadsheet | Race-safe insert. |
| `ensureSysAssetsSheet_` | `investments.js:124` | `SYS - Assets` | Additive; canonical headers | Investment add, sync | active spreadsheet | Race-safe insert. |
| `ensureSysHouseAssetsSheet_` | `house_values.js:98` | `SYS - House Assets` | Additive; canonical headers | House add, sync, House Values UI | active spreadsheet | Race-safe insert. |
| `ensureInputInvestmentsSheet_` | `investments.js:52` | `INPUT - Investments` | Additive; first-year block + canonical headers | Investments UI, add | active spreadsheet | Race-safe insert. |
| `ensureInputHouseValuesSheet_` | `house_values.js:35` | `INPUT - House Values` | Additive; first-year block + canonical headers | House Values UI, add | active spreadsheet | Race-safe insert. |
| `ensureActivityLogSheet_(ss)` | `activity_log.js:56` (delegates to `:60`) | `LOG - Activity` | Additive; self-heals empty header row | `buildDashboardSnapshot_`, Bills Due, every write path that logs | accepts `ss` | Race-safe insert. |
| `getOrCreateActivityLogSheet_(ss)` | `activity_log.js:60` | `LOG - Activity` | Additive; canonical headers | Internal | accepts `ss` | Self-heals empty header row. |
| `ensureHistorySheet_(ss)` | `planner_output.js:867` | `OUT - History` | **Destructive on header drift** — calls `sheet.clear()` if headers differ from canonical | Planner run | accepts `ss` | Header drift triggers full sheet reset. |
| `ensureImportStagingBankAccountsSheet_` | `bank_import.js:30` | `SYS - Import Staging — Bank Accounts` | Additive; canonical headers | Bank Import scaffold | active spreadsheet | Race-safe insert. |
| `ensureImportIgnoredBankAccountsSheet_` | `bank_import.js:75` | `SYS - Import Ignored — Bank Accounts` | Additive; canonical headers | Bank Import ignore list | active spreadsheet | Race-safe insert. |

### 3.3 Column / row self-heal helpers

These ensure missing columns are appended without overwriting existing data. All are additive and bounded.

- `ensureAccountsActiveColumn_(sheet)` — `bank_accounts.js:1164` — appends `Active` to `SYS - Accounts`.
- `ensureBankAccountsActiveColumnForBlock_(sheet, block)` — `bank_accounts.js:1217` — per-year-block Active column on `INPUT - Bank Accounts`.
- `ensureHouseAssetsActiveColumn_(sheet)` — `house_values.js:760` — appends `Active` to `SYS - House Assets`.
- `ensureHouseValuesActiveColumnForBlock_(sheet, block)` — `house_values.js:844` — per-year-block Active on `INPUT - House Values`.
- `ensureAssetsActiveColumn_(sheet)` — `investments.js:806` — appends `Active` to `SYS - Assets`.
- `ensureInvestmentsActiveColumnForBlock_(sheet, block)` — `investments.js:859` — per-year-block Active on `INPUT - Investments`.
- `ensureDebtsActiveColumn_(sheet)` — `debts.js:958` — appends `Active` to `INPUT - Debts`.
- `ensureAccountsExternalIdColumn_(accountsSheet)` — `bank_import.js:123` — appends `External Account Id` to `SYS - Accounts`.
- `ensureRowByName_(sheet, name, col, startRow)` — `planner_helpers.js:329` — finds-or-appends a labeled row.

### 3.4 Trigger / infra helpers

- `ensureDebouncePlannerTrigger_` — `debounce_planner.js:231` — creates the planner debounce trigger. Out of bootstrap scope but worth noting.

### 3.5 What is **not** an ensure-\* helper

These functions touch sheets but are **not** part of the additive bootstrap chain. They are listed because their inclusion has been considered and rejected:

- `buildHomePage()` — `home.js:1` — **destructive**. Calls `sheet.clearContents()` + `sheet.clearFormats()` on `HOME`. Developer-facing tab index only, run via a custom menu. Not on any user-flow path.
- `writeRecommendations_(ss, summary)` — `planner_output.js:1` — **destructive**. Calls `sheet.clearContents()` + `sheet.clearFormats()` on `OUT - Dashboard`. Planner-owned and only runs when the user explicitly runs the planner.
- `createNextYearCashFlowSheet` — `cashflow_setup.js` — clone-from-previous-year only; cannot create the first Cash Flow sheet from scratch.

---

## 4. Blank-workbook behavior by module

For each major surface, classified as:

- **Works** — calmly renders an empty state on a fully blank workbook, no red banners, no exceptions.
- **Partially works** — degrades cleanly for the missing sheet but still surfaces a red banner or partial failure on another sheet it depends on.
- **Does not work** — throws an unrecoverable error on a blank workbook today.
- **Lazy-bootstraps** — calmly creates the canonical sheet on first interaction and continues.
- **Unknown** — coverage is plausible but has not been verified end-to-end in a real blank-workbook run.

### 4.1 Dashboard (Overview)
- **Works.** `buildDashboardSnapshot_` (`dashboard_data.js:72`) explicitly tolerates missing `SYS - Accounts` and `INPUT - Debts` (lines 84–100), uses `sumColumnByHeaderForOptionalSheet_` for `SYS - Assets` / `SYS - House Assets`, and reports `state: 'notSetUp'` / `'partial'` / `'ready'`. It also calls `ensureActivityLogSheet_(ss)` at the top so `LOG - Activity` always exists after the first overview load.
- Caveats: a number of sub-cards inside Overview (rolling debt payoff, retirement outlook, Bills Due summary) depend on additional sheets that may not exist. They are read defensively (`getRetirementSummarySafe_`, `getUpcomingExpenseMetricsSafe_`) and return `null` rather than throw, but the exact UI rendering of "no data" varies card-by-card and should be confirmed in a runtime test.

### 4.2 Setup / Review (Welcome / Onboarding)
- **Works (with explicit support).** `Dashboard_Script_Onboarding.html` is the canonical landing surface for first-run. The five area panels (Bank Accounts, Bills, Debts, Cash Flow, Upcoming) each trigger their own `ensureOnboarding*FromDashboard` helper when the user opens them.
- `getStartupRoutingFromDashboard()` already exists as the read-only probe to route a blank workbook to Welcome instead of the normal dashboard.

### 4.3 Quick Add Payment
- **Lazy-bootstraps.** `getQuickAddPaymentUiData()` (`quick_add_payment.js:34`) has an explicit blank-workbook short-circuit (lines 44–52): if `INPUT - Cash Flow <year>` does not exist, it returns a neutral payload shape. The actual `quickAddPayment` write path calls `ensureCashFlowYearSheet_` and `ensureActivityLogSheet_` before writing.

### 4.4 Cash Flow page
- **Lazy-bootstraps.** Page reads from `INPUT - Cash Flow <year>`. On a blank workbook, the read defensively short-circuits to empty rows. The first Quick Add or first Bill Pay triggers `ensureCashFlowYearSheet_` and the sheet materializes.
- Risk: the per-year cash flow sheet does **not** exist until the user makes a write. If the user's first action is to read the Cash Flow page on a fresh workbook, they see an empty card — by design.

### 4.5 Bills
- **Works (mixed coverage).** Bills Due render (`dashboard_data.js:1828`) uses `ss.getSheetByName(getSheetNames_().BILLS)` directly and returns empty on missing sheet. Bills add (`bills.js:879`) is gated by `ensureOnboardingBillsSheetFromDashboard` via the Setup / Review path. Direct Bills add without going through Setup is **unverified** for blank-workbook safety.

### 4.6 Debts (Manage Debts)
- **Works on read; gated on write.** `debts.js:51` uses `ss.getSheetByName` directly; missing debts sheet returns empty. The Add Debt path goes through `ensureOnboardingDebtsSheetFromDashboard` before writing — confirmed in `bank_accounts.js`-style "ensure before write" pattern.

### 4.7 Bank Accounts (Assets → Bank Accounts)
- **Lazy-bootstraps.** Add path calls `ensureSysAccountsSheet_` and `ensureOnboardingBankAccountsSheetFromDashboard` (transitively, via the onboarding hand-off) before writing. SESSION_NOTES references a `SpreadsheetApp.flush()` defense for the stale-handle case where the just-inserted sheet is invisible to a previously captured `Spreadsheet` handle.

### 4.8 Investments (Assets → Investments)
- **Lazy-bootstraps.** Add path calls `ensureSysAssetsSheet_` and `ensureInputInvestmentsSheet_` before writing. Dashboard read uses `sumColumnByHeaderForOptionalSheet_` (no throw on missing).

### 4.9 House Values (Assets → Houses)
- **Static analysis said: Lazy-bootstraps for the canonical sheets** (`ensureSysHouseAssetsSheet_` + `ensureInputHouseValuesSheet_` are present at `house_values.js:1539–1554`).
- **Runtime test (`CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4.9.2`) FAILED on this surface.** On a blank workbook, Setup / Review → Houses → "Open Houses editor" → Create house throws `Missing sheet (after retry+flush): INPUT - House Values` and aborts before any sheet is created. **The ensure-before-write guards in `addHouseFromDashboard` are unreachable on a blank workbook** because `validateNewHouseName_(payload.houseName)` runs on line 1489 — before the ensure block on lines 1539–1555 — and `validateNewHouseName_` (line 943) calls `getHousesFromHouseValues_()` → strict `getSheet_(ss, 'HOUSE_VALUES')` which throws when `INPUT - House Values` is missing. The static analysis missed this because the ensure guards looked correct at the surface; the pre-validation read path was not traced.
- **Reclassified:** confirmed gap §5.6 below. `getHouseUiData` (page read path at `house_values.js:154`) remains defensive — the gap is specific to the **write path's pre-validation strict read**, not the page render.
- **Does not bootstrap per-house sheets.** A `HOUSES - <Name>` sheet has **no automatic creator**. `addHouseExpense` throws `'House sheet not found: ' + payload.house` (`house_expenses.js:49`). Separate gap §5.2.

### 4.10 House Expenses
- **Does not work on a blank workbook without manual setup.** Requires a `HOUSES - <Name>` sheet per house, and there is no `ensureHousesSheet_` helper. Listing surface (`getHouseExpenseUiData`, `house_expenses.js:10`) tolerates missing house tabs (returns empty list), but any write throws.

### 4.11 Property Performance
- **Works.** `property_performance.js:25` has an explicit blank-workbook short-circuit for `SYS - House Assets` (returns a zeroed envelope per `CENTRAL_APP_FIFTH_RESOLVER_SEAM.md → §4.5`).

### 4.12 Retirement (Outlook + Scenario)
- **Lazy-bootstraps.** `getOrCreateRetirementSheet_` creates `INPUT - Retirement` on first read. Profile DOB is read from `INPUT - Settings` via `ensureInputSettingsSheet_`.

### 4.13 Upcoming Expenses
- **Lazy-bootstraps.** `getOrCreateUpcomingExpensesSheet_` creates `INPUT - Upcoming Expenses` on demand. Dashboard read uses `getUpcomingExpenseMetricsSafe_` to tolerate missing sheet.

### 4.14 Donations
- **Does not work on a blank workbook.** `getDonationsSheet_()` (`donations.js:17`) throws `'Missing sheet "INPUT - Donation". Add it to this spreadsheet with Year sections (see Help → Donations).'` There is **no `ensureInputDonationSheet_` helper.** A user who opens the Donations form on a blank workbook hits this error.

### 4.15 Rolling Debt Payoff (Planning page)
- **Unknown / likely partial.** Reads INPUT - Debts and other planner inputs. Behavior on a blank workbook needs a runtime test; the strict read path may throw if `INPUT - Debts` is missing and the page is opened directly. Note: `INPUT - Debts` is the bootstrap registry's responsibility, so it can be created from a Setup / Review pass before Rolling Debt Payoff is opened.

### 4.16 Debt Payoff Projection (Planning page)
- **Likely partial.** `debt_payoff_projection.js:28` reads via `getSheetNames_()` lookup but the strict read paths may throw on missing sheets. Unknown without runtime test.

### 4.17 Activity Log
- **Lazy-bootstraps.** `ensureActivityLogSheet_(ss)` is called by `buildDashboardSnapshot_` at the top of every Overview load. Also called by every write path that records an event. After one Overview load, `LOG - Activity` always exists.

### 4.18 Planner / Run Planner Now
- **Partial — destructive footprint.** Running the planner creates `OUT - Dashboard` (destructively, via `writeRecommendations_`) and ensures `OUT - History` (destructive on header drift, via `ensureHistorySheet_`). The planner is not on the first-run critical path and need not run for the family beta proof.

### 4.19 Bank Import
- **Lazy-bootstraps the scaffold.** `ensureImportStagingBankAccountsSheet_` and `ensureImportIgnoredBankAccountsSheet_` create the SYS sheets. The pipeline itself is the largest non-onboarding subsystem and is **explicitly out of family beta scope** per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §3 Non-goals`.

### 4.20 HOME admin tab
- **Out of scope.** `buildHomePage()` is developer-facing only and never runs on a user-flow path.

---

## 5. Missing bootstrap coverage

The following canonical sheets / surfaces are referenced by the app but have **no safe automatic creator** today.

### 5.1 `INPUT - Donation` — confirmed gap
- **Owning module:** `donations.js`.
- **Behavior on blank workbook:** `getDonationsSheet_()` throws an explicit `'Missing sheet "INPUT - Donation"...'` error. Surfaces as a red banner on the Donations page.
- **Why this matters:** the Donations form is reachable from the Cash Flow page in the dashboard. A first-time user clicking Donations on a fresh workbook is the most likely path to encounter this error.
- **Recommended fix:** add `ensureInputDonationSheet_` to `donations.js`, register it under a new `BOOTSTRAP_KEY_DONATION_` in `sheet_bootstrap.js`, and call it from `getDonationsSheet_` (replacing the throw with a lazy create). The year-blocked layout means the canonical creator only needs to seed the header row pattern; the year sections appear as the user adds rows.
- **Or:** mark `INPUT - Donation` as required-only-on-write and add a UI gate that surfaces a calm "Set up Donations" call-to-action on the Donations page when the sheet is missing.

### 5.2 `HOUSES - <Name>` per-house tabs — confirmed gap
- **Owning module:** `house_expenses.js` (writes), `house_values.js` (selectors only).
- **Behavior on blank workbook:** `getHouseExpenseUiData` returns an empty list; `addHouseExpense` throws `'House sheet not found: ' + payload.house`.
- **Why this matters:** any user who adds a house (which creates a row in `SYS - House Assets` / `INPUT - House Values` via `ensureSysHouseAssetsSheet_` / `ensureInputHouseValuesSheet_`) and then tries to add a house expense for that house will get a red banner. The per-house sheet is genuinely needed for the House Expenses module to work.
- **Recommended fix:** add `ensureHousesSheetForName_(name)` that creates a `HOUSES - <Name>` sheet with the canonical year-block layout from a known template. Invoke it from both `addHouseFromDashboard` (the moment a house is registered) and from `addHouseExpense` (just-in-time safeguard).
- **Open question:** the per-house layout includes formulas and styled blocks that the current codebase does not have a canonical from-scratch creator for. Same shape as the historical `INPUT - Cash Flow <year>` gap, which was closed in `ensureCashFlowYearSheet_`. A similar canonical creator would need to be written.

### 5.3 Rolling Debt Payoff / Debt Payoff Projection blank-workbook behavior — unknown
- Both modules read `INPUT - Debts`. After the bootstrap registry creates `INPUT - Debts` via `ensureOnboardingDebtsSheetFromDashboard`, the page may render an empty calm state — but **this has not been verified end-to-end on a fully blank workbook.** Adding it to the runtime test matrix (§8) is the cheapest path to certainty.

### 5.4 `INPUT - Cash Flow <year>` year-roll-over edge case
- **Confirmed coverage exists** via `ensureOnboardingCashFlowYearSheetFromDashboard` / `ensureCashFlowYearSheet_`. The historical "no from-scratch creator" gap mentioned in `sheet_bootstrap.js:42` (now superseded) is closed.
- **Open question:** on a fresh workbook created mid-year, the current-year sheet is created on demand. On a fresh workbook created on the first day of a new year, the current-year sheet is created on demand and `createNextYearCashFlowSheet` (clone-from-previous-year) is irrelevant. No gap, but worth runtime confirmation.

### 5.6 House Values write path — pre-validation read throws on blank workbook — **confirmed runtime gap**
- **Owning module:** `house_values.js`.
- **Behavior on blank workbook:** Setup / Review → Houses → "Open Houses editor" → Create house throws `Missing sheet (after retry+flush): INPUT - House Values`. Confirmed via `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4.9.2`.
- **Root cause:** `addHouseFromDashboard` (line 1486) has ensure-before-write guards (lines 1539–1555), but those guards run **after** `validateNewHouseName_(payload.houseName)` on line 1489. `validateNewHouseName_` (line 943) calls `getHousesFromHouseValues_()` (line 271) which strictly calls `getSheet_(ss, 'HOUSE_VALUES')` and throws on the missing sheet. The ensure guards never execute.
- **Why the audit missed it:** static analysis traced the explicit ensure-before-write block but did not trace the pre-validation read path. The audit's §7.3 risk class ("Modules that assume existing sheets") covers this shape of bug in principle but did not surface this specific instance.
- **Recommended fix (for a separate Pass 2 implementation prompt — NOT authorized by this audit update):** move the ensure block from lines 1539–1555 to the top of `addHouseFromDashboard`, before `validateNewHouseName_` is called. The simpler ordering — ensure → validate → write — also matches the order used in the additive contract pattern. As a defense-in-depth follow-up, consider making `validateNewHouseName_` tolerate a missing `INPUT - House Values` (treat it as "no existing houses" since the sheet's absence proves there cannot be a duplicate name) — this would mirror the defensive read pattern already used in `getHouseUiData` at `house_values.js:154`.
- **Audit follow-up:** the runtime test should now explicitly check every other Add path for the same shape — does any pre-validation step read a sheet strictly before the ensure block runs? Specifically inspect `addBankAccountFromDashboard`, `addDebtFromDashboard`, `addInvestmentAccountFromDashboard`. (Likely safe per `bank_accounts.js:81–90` which captures the ensure return value directly, but not verified.)

### 5.5 No version marker / canonical schema fingerprint
- **No `SYS - Version` or equivalent sheet exists** to record the schema version of the workbook. This is a deferred concern for `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §6 Schema migration`, but it would be valuable as part of a first-run bootstrap: the bootstrap chain could write the schema version it bootstrapped against, and future runs could detect drift.
- Not blocking the first family beta proof; flagged as a Decision Pending for the post-audit pass.

---

## 6. Central App first-run implications

A central-mode first-run bootstrap, layered on top of the existing additive ensure-\* chain, would need to do the following — in order — for a first-time family beta user.

### 6.1 Pre-resolver phase (deployment / mapping)
1. Beta user opens the deployment URL under `executeAs: USER_ACCESSING`. (Out of audit scope; documented in `CENTRAL_APP_DEPLOYMENT_OPTIONS.md`.)
2. Resolver reads identity via `Session.getEffectiveUser().getEmail()` and consults the per-user mapping store (`PropertiesService.getUserProperties()` per `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §6.2`).
3. No mapping → hand off to bootstrap.

### 6.2 Workbook creation phase
4. Bootstrap helper creates the workbook in the user's Drive via Drive API (or `SpreadsheetApp.create()`). Per `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §6.3`.
5. Bootstrap writes the mapping (`cashCompassWorkbookId`) before returning.
6. Bootstrap returns the freshly created spreadsheet handle to the resolver.

### 6.3 Additive bootstrap phase (the part this audit covers)
7. Call `ensureOnboardingCoreSheetsFromDashboard('normal')` to create the six canonical core sheets: `INPUT - Settings`, `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, `INPUT - Upcoming Expenses`, `INPUT - Cash Flow <currentYear>`. This is **already implemented** in `sheet_bootstrap.js:352`.
8. Call `ensureActivityLogSheet_(ss)` to create `LOG - Activity`. **Already implemented and already called by `buildDashboardSnapshot_`.**
9. Leave SYS sheets, OUT sheets, per-house sheets, donations, retirement, and investments to **lazy-bootstrap on first interaction** with each surface. This is the existing pattern and works for every module that has an ensure helper.

### 6.4 Land the user
10. Route the user to Setup / Review (`getStartupRoutingFromDashboard()` would report `isBlankWorkbook: true` until step 7 runs; once step 7 runs, `existingCoreSheetCount > 0` and the existing routing logic takes over).
11. The user walks through Setup / Review, then lands on the dashboard. The dashboard's `notSetUp` / `partial` / `ready` state field surfaces calmly during the in-between states.

### 6.5 What the existing chain handles, vs what is still needed

**Already handled by existing helpers (no new code required):**
- All six core sheets in the bootstrap registry.
- `LOG - Activity` (auto-created by `buildDashboardSnapshot_`).
- All five SYS / INPUT helpers that lazy-create on first add (Bank Accounts, Investments, House Values, Debts variants).
- Cash Flow per-year sheets (lazy on first Quick Add / first Bill Pay).
- Retirement, Upcoming Expenses (lazy via `getOrCreate*`).
- Bills Due / Bills read paths (defensive on missing sheet).
- Dashboard Overview (`notSetUp` / `partial` / `ready` semantics).
- Property Performance (explicit blank-workbook short-circuit).

**Still needed for hands-off zero-sheet onboarding:**
- `ensureInputDonationSheet_` — gap §5.1. Small, additive, mirrors existing creators.
- `ensureHousesSheetForName_(name)` — gap §5.2. Larger; needs a canonical from-scratch creator for the per-house year-block layout.
- **Reorder `addHouseFromDashboard` ensure block to precede `validateNewHouseName_` — gap §5.6.** Smallest fix: move the ensure block from lines 1539–1555 to the top of the function. Defense-in-depth follow-up: make `validateNewHouseName_` defensive against the missing sheet.
- (Optional, Decision Pending) `ensureSysVersionSheet_` or equivalent schema-version marker — gap §5.5.
- Runtime confirmation of Rolling Debt Payoff / Debt Payoff Projection on a fully blank workbook — gap §5.3.
- **Static recheck of every other Add path** for the same shape (pre-validation strict read before ensure block) — `addBankAccountFromDashboard`, `addDebtFromDashboard`, `addInvestmentAccountFromDashboard`. Per §5.6 audit follow-up.

**Out of scope for the first family beta proof:**
- Bank Import pipeline — explicit non-goal in `CENTRAL_APP_FAMILY_BETA_PLAN.md → §3`.
- HOME admin tab — developer-facing only.
- `OUT - Dashboard` and `OUT - History` — only materialize when the user runs the planner, which is not on the first-run path.

### 6.6 Bound mode preservation
The existing ensure-\* helpers and the bootstrap registry already preserve bound mode byte-for-byte:
- Every helper is idempotent and returns immediately if the sheet exists.
- No helper deletes, renames, or clears an existing sheet (verified across the inventory in §3).
- The bootstrap registry's `ensureBootstrapSheet_` explicitly returns `{ok: true, created: false}` for existing sheets.

A central-mode first-run pass running against a developer's bound workbook (which is already populated) would be a long no-op chain — every ensure helper would short-circuit. No risk to existing data.

---

## 7. Risk areas

Categorized risks the audit surfaced. Each is an item that future implementation prompts must address explicitly.

### 7.1 Helpers that assume active spreadsheet
- **Every per-domain ensure helper except `ensureActivityLogSheet_` / `getOrCreateActivityLogSheet_` and `ensureHistorySheet_` calls `SpreadsheetApp.getActiveSpreadsheet()` internally.** Under bound deployment this returns the correct workbook. Under `executeAs: USER_ACCESSING` and central deployment with multiple potential workbooks, this returns "the active spreadsheet in the current execution context," which after the resolver opens a workbook by ID is **the workbook the resolver just opened** — but this behavior depends on Apps Script web-app semantics that have not been runtime-tested.
- **Implication:** the family beta proof is the first end-to-end test of whether ensure helpers behave correctly under central deployment. The Approach A internal platform spike (`CENTRAL_APP_MINIMAL_BETA_PROOF.md → §5 retracted recommendation`, now reframed as a deployment-posture spike in `§5.bis` and `§10`) is the cheapest way to surface any platform-semantics surprise.
- **Mitigation:** if the audit-driven runtime test surfaces an ensure helper that opens the wrong workbook, the per-helper resolver migration (Phase 7+) accelerates. Each helper that needs migration is its own narrow implementation prompt.

### 7.2 Helpers that create sheets during reads
- `getOrCreateUpcomingExpensesSheet_`, `getOrCreateRetirementSheet_`, `ensureInputSettingsSheet_` (via `readAllSettingsMap_`), `ensureActivityLogSheet_` (via `buildDashboardSnapshot_`) all **create sheets during read paths**. This is intentional and additive, but it means **a read operation has side effects on a blank workbook**.
- **Implication:** anyone reasoning about the resolver as "read-only" must remember that the underlying ensure helpers may create sheets. Resolver migration of read paths still effectively runs writes downstream.
- **Mitigation:** the existing ensure helpers are idempotent and additive, so the side effects are bounded to first-time-only creates. No change recommended.

### 7.3 Modules that assume existing sheets
- **`donations.js:17`** — throws on missing `INPUT - Donation`. Confirmed gap §5.1.
- **`house_expenses.js:49`** — throws on missing `HOUSES - <Name>`. Confirmed gap §5.2.
- **`debts.js`, `bills.js`, `dashboard_data.js` debt-bill paths** — most reads use `ss.getSheetByName` with defensive `if (!sheet) return [...]` patterns. Confirmed safe.
- **`debt_payoff_projection.js`, `rolling_debt_payoff.js`** — read INPUT - Debts via `getSheetNames_()` lookup; unknown whether strict throw or defensive. Needs runtime verification.

### 7.4 Hidden formulas and seeded defaults
- `ensureCashFlowYearSheet_` seeds the Summary row with SUMIF formulas via `ensureCashFlowSummaryRow_`. **Load-bearing**: `insertCashFlowRow_` uses the Summary row as its anchor for Income / Expense placement.
- `getOrCreateRetirementSheet_` seeds a scenario template with neutral defaults (Conservative / Base / Aggressive headers, blank user-input rows, default return / inflation / SWR values).
- `ensureInputInvestmentsSheet_`, `ensureInputHouseValuesSheet_` seed a Year banner + MMM-YY headers for the current year.
- **Implication:** the bootstrap chain is not just "create the sheet" — it seeds canonical structure that downstream code depends on. Anyone modifying these helpers must respect the seed.

### 7.5 Non-additive behavior in the inventory
The **only non-additive helpers** in the bootstrap-adjacent code are:
- `ensureHistorySheet_(ss)` — calls `sheet.clear()` if headers differ from canonical. **Acceptable** because `OUT - History` is fully planner-owned, never user-edited, and only ever called from planner runs.
- `writeRecommendations_(ss, summary)` — destructively rebuilds `OUT - Dashboard`. **Acceptable** for the same reason.
- `buildHomePage()` — destructively rebuilds `HOME`. Developer-facing only.

None of these are on the first-run path. The additive contract holds for every user-facing creator.

### 7.6 Named ranges
- The codebase does **not** rely on named ranges for canonical sheet structure. Column identities are resolved by header label (`getCashFlowHeaderMap_`, `getAccountsHeaderMap_`, `getHouseAssetsHeaderMap_`, etc.). No named-range bootstrap is required.

### 7.7 Execution-order dependencies
- **`SpreadsheetApp.flush()` defense.** SESSION_NOTES references a class of bug where a freshly inserted sheet is invisible to a `Spreadsheet` handle captured before the insert. `config.js:48` flushes pending writes before retrying a missing-sheet lookup. The pattern is in place but not universally applied — any new ensure helper that creates a sheet and immediately reads it must respect this.
- **Stale handles within a single Apps Script execution.** `bank_accounts.js:81` explicitly captures `targetSheet` from `ensureSysAccountsSheet_()` (returning the freshly-created sheet directly) rather than re-acquiring it via `getSheet_(ss, 'ACCOUNTS')`. Future ensure-then-read patterns must follow this convention.

### 7.8 Performance / cold-start
- A first-run flow that calls `ensureOnboardingCoreSheetsFromDashboard` synchronously may insert up to six sheets in one Apps Script execution. Apps Script's per-execution structural-write overhead is non-trivial; this could noticeably extend first-run latency.
- **Mitigation:** keep the eager bootstrap to the minimum required to clear the Welcome gate (likely just `INPUT - Settings` and the current-year Cash Flow sheet), and let the remaining four canonical sheets lazy-bootstrap as the user touches Setup / Review pages. Decision Pending — see §9.

### 7.9 Concurrency / race conditions
- Every `insertSheet` call in the inventory is wrapped with a "race: retry getSheetByName" pattern. Confirmed safe under concurrent dashboard RPCs.
- The activity log helper has explicit racing-thread documentation (`activity_log.js:71–88`) — the dashboard fires multiple concurrent reads at startup, each of which may call `ensureActivityLogSheet_`. The race-safe insertSheet pattern handles it.

---

## 8. Recommended next step

The audit closes the question of whether the existing ensure-\* coverage is sufficient. Findings:

- **Two confirmed gaps** for hands-off zero-sheet onboarding: `INPUT - Donation` (§5.1) and `HOUSES - <Name>` per-house tabs (§5.2). Both are additive ensure-\* helper opportunities that mirror the existing pattern.
- **One unknown** that needs a runtime check, not a code change: Rolling Debt Payoff / Debt Payoff Projection blank-workbook behavior (§5.3).
- **One optional follow-up**: schema-version marker (§5.5).
- **Otherwise**, the existing additive bootstrap chain in `sheet_bootstrap.js`, plus the per-domain ensure helpers, plus the dashboard's `notSetUp` / `partial` / `ready` semantics, plus the per-module blank-workbook short-circuits, already covers the family beta first-run path.

Given that picture, the recommended next step is **two passes in sequence**, not one large pass:

### 8.1 Pass 1 — Runtime blank-workbook test matrix (analysis-leaning)

Run the existing app against a **fully blank workbook** under bound mode (developer's deployment, no central mode involved) and walk through every dashboard surface listed in §4. The test does not require any code change; it requires:

- A second Google account (or a copy of the developer's account) with no CashCompass data.
- A fresh, empty Google Sheet bound to a test copy of the script project (or a deployment that runs against a chosen blank sheet).
- A pre-written checklist of clicks per module: open the tab, exercise the first read, attempt the first write, exercise the recovery path, screenshot the state.

The output is a **runtime test report** — a new design doc (proposed name `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md`) — that records what actually happens for each surface in §4 and converts each "Unknown" into a confirmed "Works" / "Partially works" / "Does not work."

**Why this comes first.** The audit catalogs the code paths but cannot observe the runtime behavior. Two of the §4 items are flagged "Unknown" precisely because static analysis is insufficient. A 1–2 hour runtime walk is the cheapest path to certainty.

**No code change** in Pass 1. If the runtime test surfaces a new gap not in §5, it is added to the gap list and queued for Pass 2.

### 8.2 Pass 2 — Minimal additive ensure-\* gap fills (one prompt per helper)

After Pass 1 produces the runtime report, fill each confirmed gap with its own narrow Cursor implementation prompt. Each prompt is:
- One ensure helper.
- One file modified (plus a one-line registration entry in `sheet_bootstrap.js` if applicable).
- One additive change, mirroring an existing canonical creator.
- Verified against both a populated workbook (no-op) and a blank workbook (creates the sheet).
- Reversible via revert.

Anticipated Pass 2 prompts:
- **2.a** — `ensureInputDonationSheet_` in `donations.js` + bootstrap-registry entry. Replace `getDonationsSheet_`'s throw with a lazy create.
- **2.b** — `ensureHousesSheetForName_(name)` in `house_expenses.js` (or `house_values.js`). Wire it into `addHouseFromDashboard` and `addHouseExpense`.
- **2.c** — Optional: schema-version marker if §5.5 is decided in.
- **2.d** — Any unexpected gap surfaced by Pass 1.

Each prompt is independently shippable. None blocks any other. The dashboard's `notSetUp` / `partial` / `ready` state already tolerates partial progress.

### 8.3 Why not jump straight to a central bootstrap coordinator

A larger "central bootstrap coordinator" implementation prompt is tempting but premature. The existing `ensureOnboardingCoreSheetsFromDashboard` is **already** the coordinator — it iterates `BOOTSTRAP_CORE_KEYS_` and delegates to the canonical creators. The Central App work that follows the gap fills is a single new call site that invokes this coordinator from the bootstrap step in `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §6.3`, plus the per-user mapping store and Drive API workbook creation. None of that requires writing a new bootstrap coordinator; the existing one is the one we ship.

### 8.4 Why not a first-run bootstrap checklist (paper-only)

A paper-only first-run checklist would re-encode information that already lives in `sheet_bootstrap.js` and this audit. The remaining uncertainty is **runtime behavior**, not coordination. Hence Pass 1 is a runtime test, not another paper checklist.

---

## 9. Decision Pending items

The audit pins the following Decision Pending items for the post-audit prompts. None of these blocks the audit's conclusions; each must be resolved before the corresponding implementation prompt is written.

### 9.1 Exact first-run bootstrap sequence
- Should the central first-run path call `ensureOnboardingCoreSheetsFromDashboard` eagerly (all six core sheets up front), or only `ensureInputSettingsSheet_` + `ensureCashFlowYearSheet_(currentYear)` and let the remaining four canonical sheets lazy-bootstrap as the user touches Setup / Review pages?
- Trade-off: eager produces a clean blank state earlier (Welcome gate clears, dashboard renders calmly) at the cost of ~3–5 seconds of bootstrap latency. Lazy spreads the latency across user interactions but means the Setup / Review walkthrough may surface "creating sheet…" interstitials.
- **Recommended after audit:** eager, scoped to the six core sheets, because the cost is one-time and the calmness gain is large.

### 9.2 Minimum required sheets at app launch
- Equivalent restatement of §9.1. The current `BOOTSTRAP_CORE_KEYS_` list is the candidate minimum. Whether to add `INPUT - Donation` and a future schema-version marker to the core list is the open question.

### 9.3 Which sheets can remain lazy-created
- Confirmed lazy-OK by inventory: `SYS - Accounts`, `SYS - Assets`, `SYS - House Assets`, `INPUT - Investments`, `INPUT - House Values`, `INPUT - Retirement`, `LOG - Activity`, all Bank Import SYS sheets, per-house `HOUSES - <Name>` (once §5.2 is fixed).
- Confirmed eager-only: nothing strictly requires eager creation beyond what is in `BOOTSTRAP_CORE_KEYS_`. The eager case in §9.1 is for UX calmness, not correctness.

### 9.4 Where the workbook version marker lives
- Three candidate locations:
  - **(a)** `INPUT - Settings` Key/Value row: simple, additive, requires no new sheet.
  - **(b)** New `SYS - Version` sheet: more explicit, schema-style, requires a new ensure helper.
  - **(c)** Document metadata via `PropertiesService.getDocumentProperties()`: invisible to the user, but Apps Script-native and cheap.
- **Recommended after audit:** (a) — keeps the bootstrap chain unchanged, makes the version visible to the user if they inspect Settings, and is the lowest-effort.

### 9.5 Whether Setup / Review owns first-run completion
- Today's Welcome / Setup / Review surface in `Dashboard_Script_Onboarding.html` is the natural owner of "first-run done" semantics. Whether to add an explicit `setup_completed_at` row in `INPUT - Settings` (or equivalent), and whether the dashboard re-routes to Welcome until that row exists, is a Decision Pending the first family beta proof can answer with one runtime observation.
- **Recommended after audit:** keep the existing routing in `getStartupRoutingFromDashboard()` (blank-workbook → Welcome; populated → dashboard). Adding a "completion" flag is a separate, smaller prompt.

### 9.6 How to recover from partial bootstrap failure
- Today's ensure helpers are idempotent — the next request resumes. But the family beta proof should pin user-visible recovery semantics:
  - If `ensureOnboardingCoreSheetsFromDashboard` returns `{ok: false, failed: [...]}`, what does the user see?
  - If Drive API creates the workbook but the mapping write fails, what does the next page load do?
- **Recommended after audit:** the existing `{ok, created, sheetName, mode, reason}` shape carries enough detail to surface a calm "X step failed, retry?" message. Wording is Decision Pending; structure is in place.

### 9.7 OAuth scopes for the bootstrap path
- Minimum scopes for `ensureOnboardingCoreSheetsFromDashboard` running on a user-owned workbook under `USER_ACCESSING`: Sheets read/write of the user's own workbook is sufficient. Drive scope is required only for the create-workbook step (§6.2), not the bootstrap step.
- **Recommended after audit:** keep bootstrap scopes minimal; Drive scope is requested by the workbook-creation step alone.

---

## 10. Scope guardrails

To prevent the Pass 1 runtime test and the Pass 2 gap fills from drifting into adjacent work:

- **No monetization, billing, plan gating, marketplace listing, GA onboarding, admin portal, large-scale migration, or advanced support tooling.** All explicitly out of scope per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §3 Non-goals` and `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §7`.
- **No new ensure helper invented beyond what the audit identifies.** Pass 2 fills exactly the gaps in §5 (plus whatever §8.1 surfaces). It does not preemptively widen the bootstrap registry.
- **No resolver migration of ensure helpers in Pass 2.** Each ensure helper continues to use `SpreadsheetApp.getActiveSpreadsheet()` internally. Migration to the resolver is a separate (Phase 7+) decision, made after Pass 1 surfaces what actually breaks under central deployment.
- **No changes to existing ensure helpers' contracts** except where Pass 2 explicitly replaces a throw with a lazy create (e.g. `getDonationsSheet_`).
- **No deployment-settings changes** in either pass. Pass 1 is bound-mode-only. Pass 2 is bound-mode-only. Central mode is the step after Pass 2.

---

## 11. Summary

- **Blank-workbook readiness today:** moderately strong but with one runtime-confirmed regression in the Houses path. Most major surfaces work or lazy-bootstrap calmly; the six canonical core sheets are covered by `sheet_bootstrap.js`'s registry. Dashboard Overview, Setup / Review, Quick Add, Cash Flow, Bills (read), Debts (read), Bank Accounts, Investments, Property Performance, Retirement, Upcoming Expenses, and Activity Log all handle blank state correctly per static analysis. House Values write path fails on a blank workbook (gap §5.6).
- **Confirmed gaps:** three — (§5.1) `INPUT - Donation` no ensure helper, (§5.2) `HOUSES - <Name>` per-house tabs no canonical creator, **(§5.6) House Values write path's pre-validation strict read runs before its ensure-before-write guard — confirmed via runtime test `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4.9.2`**.
- **Unknown:** one — Rolling Debt Payoff / Debt Payoff Projection blank-workbook behavior. Runtime check needed.
- **Optional:** one — schema-version marker. Not blocking.
- **Static-analysis miss surfaced by runtime test:** the audit's §4.9 originally classified House Values onboarding as "Lazy-bootstraps." The runtime test in `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4.9.2` falsified that classification. Root cause traced to a pre-validation read path the static trace did not follow (§5.6). This is exactly the value the runtime test was designed to produce — static analysis catches structural gaps, runtime catches ordering and execution-path gaps. The runtime test should be re-extended to explicitly check every other Add-path for the same shape.
- **Recommended next step:** Pass 2 — narrow additive ensure-\* / reorder prompts per confirmed gap (§5.1, §5.2, §5.6). Each is a separate Cursor implementation prompt requiring explicit user approval. Plus a small static recheck of every other Add path (`addBankAccountFromDashboard`, `addDebtFromDashboard`, `addInvestmentAccountFromDashboard`) for the same pre-validation-before-ensure pattern, before the family beta proof runs.
- **Family beta proof readiness:** after Pass 2 closes the three confirmed gaps, the additive ensure-\* chain is sufficient for a hands-off first-run flow against a user-created workbook. The remaining layers needed for the family beta proof (Drive API workbook creation, per-user mapping store, central deployment posture, first-run UX, recovery surfaces, rollback procedure) are documented in `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §6` and are independent of this audit's conclusions.

---

End of document.
