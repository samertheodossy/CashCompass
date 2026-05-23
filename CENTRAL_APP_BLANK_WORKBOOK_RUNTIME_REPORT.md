# CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md

Manual runtime test report template for the **bound-mode blank-workbook walkthrough** recommended in `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §8.1 Pass 1`.

**Template only.** This file is a checklist to be filled in by hand during a runtime test session. It is **not** a record of a completed test until the tester fills in the `Observed`, `Result`, and `Notes` columns. The empty version of this template is committed so the structure is reviewed before the test runs.

**No code change in this document, in this pass, or in the test run itself.** The runtime test is observation only — it does not authorize any fix. Gaps surfaced here become inputs to future narrow additive ensure-\* implementation prompts per `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §8.2 Pass 2`.

Cross-references:
- `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md` — static audit that motivated this runtime test.
- `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §5.bis / §10.2` — onboarding-first family beta direction; this test feeds into it.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md → §7 Testing checklist` — broader bound-mode-parity testing posture.
- `sheet_bootstrap.js` — the registry whose coverage this test exercises.
- `WORKING_RULES.md` / `TESTING_PLAN.md` — two-track regression discipline.

---

## 0. Safety preamble

> **DO NOT run this test against the real production workbook.** The real workbook holds months of live financial data, the active LOG - Activity audit trail, and the production planner history. Any first-time-create side effect from an ensure-\* helper running against the real workbook is, by the additive contract, a no-op — but the **point of this test is to surface the ensure-\* helpers that are not yet additive**, or that misbehave in unexpected ways. The test must run against a **disposable, fully blank, throwaway workbook** that can be deleted without consequence.
>
> Before clicking anything, confirm in writing:
>
> - [ ] The active deployment URL or bound spreadsheet is **not** the production workbook.
> - [ ] The test workbook contains zero rows of real financial data.
> - [ ] The test workbook is in a folder the tester is comfortable deleting wholesale.
> - [ ] The production workbook has been opened in a separate tab and is verified to be untouched at the start of the session.
>
> If any of those four checks cannot be confirmed, **stop and do not run the test**.

---

## 1. Purpose

This test answers the questions the static audit (`CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md`) could not:

- For each major dashboard surface, what does a brand-new user *actually* see on a fully blank workbook?
- Which surfaces lazy-bootstrap calmly (the expected path)?
- Which surfaces surface a red banner or unrecoverable error (the gap path)?
- Which sheets exist after each interaction, and in what order do they appear?
- What does `LOG - Activity` look like after one end-to-end pass — does it accumulate noise from no-op ensure calls, or only real user events?
- Do any concurrent dashboard RPCs race against the ensure-\* chain on the very first overview load?

The output is a filled-in copy of this template, committed alongside the empty template, with the gap list in §6 driving the next round of additive ensure-\* implementation prompts.

This test does **not** validate:

- Central App deployment posture (that is the post-Pass-2 deployment-posture spike).
- Drive API workbook creation (a separate proof in `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §6.3`).
- Per-user mapping store behavior (§6.2 of the same doc).
- Any module's correctness against populated data (covered by the standard two-track regression in `TESTING_PLAN.md`).

Scope: blank-workbook UX only, in bound mode, on a throwaway workbook.

---

## 2. Setup

### 2.1 Required setup steps

Performed by the tester before the test begins. Each step is a checklist item with an `Observed` column for any deviation.

| # | Step | Expected | Observed (fill in) |
|---|---|---|---|
| 2.1.1 | Sign in to Google with the test account (not the developer's primary account if avoidable). | Google login screen completes. | |
| 2.1.2 | Create a brand-new Google Sheets file in Drive (`Drive → New → Google Sheets → Blank spreadsheet`). | A fresh untitled spreadsheet opens with one empty `Sheet1` tab. | |
| 2.1.3 | Rename the spreadsheet to something obviously disposable (e.g. `CashCompass — BLANK TEST — YYYY-MM-DD`). | The tab in the browser shows the new name. | |
| 2.1.4 | Open `Extensions → Apps Script`. Verify there is **no** bound script project yet. | Apps Script editor opens with an empty `Code.gs` and no other files. | |
| 2.1.5 | Bind a copy of the CashCompass script project. Either: (a) install via `clasp clone` into this new bound script, or (b) copy/paste every `.js` / `.html` file from the developer's local checkout into the empty project, preserving filenames. **Do not** push from a `clasp` instance that is currently bound to the production project. | All `*.js` and `*.html` files from the workspace appear in the bound script project. `appsscript.json` matches the production manifest's bound-mode settings (`executeAs: USER_DEPLOYING`, `access: MYSELF`). | |
| 2.1.6 | Save the script project. | `File → Save` confirms. | |
| 2.1.7 | From the spreadsheet, open the CashCompass web app via the existing menu / sidebar entry. If `onOpen` is wired, the custom menu should appear after reloading the spreadsheet tab. | The CashCompass menu appears under the menu bar. | |
| 2.1.8 | Authorize the script when prompted. Standard OAuth consent surface. | Consent grant completes without error. | |

### 2.1.9 Pre-test guards

Before launching the dashboard:

- [ ] Confirm the bound workbook still has **only** the default `Sheet1` tab.
- [ ] Confirm `Sheet1` is empty (no rows, no headers).
- [ ] Confirm the script project is bound to this workbook (Apps Script editor shows the workbook name in its window title).
- [ ] Confirm `appsscript.json` has not been customized for this test in a way that diverges from production.

If any check fails, return to §2.1 and resolve before proceeding.

### 2.2 What the test must NOT use

- [ ] The real production CashCompass workbook (the developer's daily-use workbook).
- [ ] Any workbook that contains real bank balances, debts, bills, or other financial data.
- [ ] A workbook shared with anyone other than the tester.
- [ ] A workbook bound to a script project that is also bound elsewhere (avoid `clasp` cross-binding accidents).
- [ ] The production deployment URL (the deployment that serves the developer's daily dashboard). The test runs against the bound script via the bound web app or the Apps Script editor only.

---

## 3. Expected initial sheet state

After §2 setup is complete and **before** any dashboard interaction:

| Sheet name | Expected | Observed (fill in) |
|---|---|---|
| `Sheet1` | Present (the default Google Sheets blank tab). | |
| `INPUT - *` | None. | |
| `SYS - *` | None. | |
| `OUT - *` | None. | |
| `LOG - Activity` | None. | |
| `HOUSES - *` | None. | |
| `HOME` | None. | |
| Any other CashCompass-shaped sheet | None. | |

If any CashCompass-shaped sheet (`INPUT - ...`, `SYS - ...`, `OUT - ...`, `LOG - ...`, `HOUSES - ...`, or `HOME`) is present **before** the dashboard is opened, the workbook is not actually blank — stop and create a fresh one.

---

## 4. Per-screen test matrix

Each row is one user action against the blank workbook. The tester fills in `Observed`, `Sheets created (delta)`, `Banners`, `Activity Log delta`, `Result`, and `Notes` after performing the action.

Result codes:
- **W** — Works calmly. No red banner, no exception, calm empty state, expected sheets created (if any).
- **L** — Lazy-bootstraps. Sheet did not exist before the action; it was created additively during the action and the action completed.
- **P** — Partially works. The screen renders or the action completes, but with a degraded surface (e.g. one card shows an error while the rest render).
- **F** — Fails. Red banner, exception, or unrecoverable error.
- **U** — Unknown / inconclusive. Test was inconclusive; rerun or follow up.

### 4.1 Initial dashboard load

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.1.1 | Open the bound web app (via custom menu or `doGet` URL). | Dashboard loads. Overview tab is selected by default. `state: 'notSetUp'` is reflected in the UI (calm "set up to get started" tone). | | | | | | |
| 4.1.2 | Observe the Overview tab's cards (Cash, Debt, Investments, House Equity, Net Worth, deltas). | Each card renders `$0.00` or "—" with no red banner. Delta cards may show "No history yet." | | | | | | |
| 4.1.3 | Observe whether `LOG - Activity` appeared during the load. | `LOG - Activity` is created by `ensureActivityLogSheet_` inside `buildDashboardSnapshot_`. Header row present, no data rows. | | `LOG - Activity` | | (empty) | | |
| 4.1.4 | Refresh the browser. Repeat. | Same state. No duplicate sheets created. No race-condition red banner. | | none | | (unchanged) | | |
| 4.1.5 | Confirm the routing probe (`getStartupRoutingFromDashboard`) reports `isBlankWorkbook: true` until the bootstrap registry creates the core sheets, or `false` once any `INPUT - *` / `SYS - *` sheet exists. (Inspect via Apps Script `Logger.log` or browser DevTools if exposed.) | Behavior matches the rule. | | n/a | n/a | n/a | | |

### 4.2 Setup / Review (Welcome / Onboarding)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.2.1 | Open Setup / Review via the dashboard. | Welcome screen renders. No red banner. | | | | | | |
| 4.2.2 | Step into the Bank Accounts panel. | `INPUT - Bank Accounts` is created on demand by `ensureOnboardingBankAccountsSheetFromDashboard`. Panel renders with no rows. | | `INPUT - Bank Accounts` (expected) | | | | |
| 4.2.3 | Step into the Bills panel. | `INPUT - Bills` is created on demand. Panel renders with no rows. | | `INPUT - Bills` (expected) | | | | |
| 4.2.4 | Step into the Debts panel. | `INPUT - Debts` is created on demand. Panel renders with no rows. | | `INPUT - Debts` (expected) | | | | |
| 4.2.5 | Step into the Cash Flow panel. | `INPUT - Cash Flow <currentYear>` is created on demand. Canonical MMM-YY columns and Summary row present. | | `INPUT - Cash Flow <year>` (expected) | | | | |
| 4.2.6 | Step into the Upcoming Expenses panel. | `INPUT - Upcoming Expenses` is created on demand. Panel renders with no rows. | | `INPUT - Upcoming Expenses` (expected) | | | | |
| 4.2.7 | Step into the Profile / Settings panel. | `INPUT - Settings` is created on demand by `ensureInputSettingsSheet_`. Key/Value header row present. | | `INPUT - Settings` (expected) | | | | |
| 4.2.8 | Save a Profile DOB value (any test date). | Value persists into `INPUT - Settings`. No red banner. Derived ages refresh. | | none | | (one entry) | | |
| 4.2.9 | Return to Overview. Confirm `state` field. | `state: 'notSetUp'` until `SYS - Accounts` exists. | | none | | | | |

### 4.3 Quick Add Payment

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.3.1 | Open Quick Add Payment on a fresh workbook (without going through Setup / Review first). | Form renders with empty payee dropdown, calm empty state. No red banner. (`getQuickAddPaymentUiData` short-circuits when `INPUT - Cash Flow <year>` is missing.) | | none | | | | |
| 4.3.2 | Add a $10 test expense (Type=Expense, Payee="Test Payee", Account/Source any value). | `INPUT - Cash Flow <currentYear>` is created via `ensureCashFlowYearSheet_` if not already. Row appears at the canonical month column. `LOG - Activity` records one `quick_pay` entry. Status banner: "Payment recorded — <Month-YY> cash flow updated". | | `INPUT - Cash Flow <year>` (if not already) | | (one `quick_pay`) | | |
| 4.3.3 | Refresh the dashboard. Confirm Overview reflects the new entry. | Cash Flow card shows the test value. No red banner. | | none | | | | |

### 4.4 Cash Flow page

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.4.1 | Open the Cash Flow page on a fresh workbook (before any Quick Add). | Page renders with calm empty state. No red banner. | | none | | | | |
| 4.4.2 | Open the Donations card / Donations form. | **Risk:** `INPUT - Donation` has no ensure helper (audit §5.1). Expected outcome: red banner `Missing sheet "INPUT - Donation"…`. Confirm. | | none | (likely error) | | | |
| 4.4.3 | Open the Upcoming Expenses card. | If `INPUT - Upcoming Expenses` exists (after §4.2.6), renders calmly. If not, renders empty state. | | none / `INPUT - Upcoming Expenses` | | | | |
| 4.4.4 | Add one Upcoming Expense. | Row appears, activity log entry written. | | none | | (one `upcoming_add` or similar) | | |

### 4.5 Bills

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.5.1 | Open the Bills Due page on a fresh workbook (before any bills added). | Calm empty state. No red banner. | | none | | | | |
| 4.5.2 | Open the Manage Bills page on a fresh workbook (before Setup / Review). | Calm empty state. No red banner. | | none | | | | |
| 4.5.3 | Add one Bill via Add bill. | `INPUT - Bills` created (if not already). Row written. Bill appears on Bills Due if due. | | `INPUT - Bills` (if not already) | | (one `bill_add`) | | |
| 4.5.4 | Pay the new bill via Bills Due → Pay. | Deep-link to Quick Add succeeds; payment writes to Cash Flow; activity log records both `quick_pay` and any associated bill_pay event. Bills Due updates. | | none | | (entries) | | |
| 4.5.5 | Skip a Bill via Bills Due → Skip. | Skip handled, no red banner. | | none | | (one `bill_skip` or similar) | | |

### 4.6 Debts

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.6.1 | Open the Manage Debts page on a fresh workbook. | Calm empty state. No red banner. | | none | | | | |
| 4.6.2 | Add one Debt via Add Debt. | `INPUT - Debts` created (if not already). Row written. | | `INPUT - Debts` (if not already) | | (one `debt_add`) | | |
| 4.6.3 | Edit / update the Debt. | Update succeeds. | | none | | (one `debt_update`) | | |

### 4.7 Bank Accounts (Assets → Bank Accounts)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.7.1 | Open the Bank Accounts page on a fresh workbook. | Calm empty state. No red banner. | | none | | | | |
| 4.7.2 | Add a new Bank Account via Add new. | `SYS - Accounts` and `INPUT - Bank Accounts` created (if not already) by `ensureSysAccountsSheet_` / canonical helpers. First-year block created. Opening balance written. Snapshot reflects the new account. | | `SYS - Accounts`, `INPUT - Bank Accounts` (if not already) | | (one `bank_account_add`) | | |
| 4.7.3 | Update the account's current-month balance. | Month write succeeds; prior months untouched. | | none | | (one `bank_account_update`) | | |
| 4.7.4 | Refresh Overview. Confirm `state: 'partial'` or `'ready'` depending on Debts. | State field updates. | | none | | | | |

### 4.8 Investments

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.8.1 | Open the Investments page on a fresh workbook. | Calm empty state. No red banner. | | none | | | | |
| 4.8.2 | Add an Investment. | `INPUT - Investments` and `SYS - Assets` created (if not already). | | `INPUT - Investments`, `SYS - Assets` (if not already) | | (one `investment_add`) | | |

### 4.9 House Values (Assets → Houses)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.9.1 | Open the House Values page on a fresh workbook. | Calm empty state. No red banner. (Page short-circuits when `INPUT - House Values` is missing per `getHouseUiData` defensive read.) | | none | | | | |
| 4.9.2 | Setup / Review → Houses → "Open Houses editor" → enter Test House → click **Create house**. | `INPUT - House Values`, `SYS - House Assets`, **and `HOUSES - <Name>`** created (if not already). New row written. Activity log `house_add` entry. | **Originally FAILED (preserved for record).** Error: `Missing sheet (after retry+flush): INPUT - House Values`. Sheets present at failure: `Sheet1`, `INPUT - Settings`, `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, `INPUT - Cash Flow 2026`, `LOG - Activity`, `INPUT - Retirement`, `INPUT - Upcoming Expenses` (note: none of the three House sheets created). **Retested after fix commit `4e6af6d` (2026-05-22) — PASSES.** Property type dropdown shows the canonical defaults (Primary Residence / Vacation Home / Rental / Other (custom)…); Create house succeeds; `INPUT - House Values`, `SYS - House Assets`, **and `HOUSES - Test House`** are all created in one transaction; no red banner. | `INPUT - House Values`, `SYS - House Assets`, `HOUSES - Test House` (on retest pass) | none on retest pass | one `house_add` entry on retest pass | **F → ✅ FIXED** | **Original root cause** (preserved): `addHouseFromDashboard` (`house_values.js:1486`) called `validateNewHouseName_(payload.houseName)` on line 1489 **before** the ensure-before-write guards on lines 1540–1554. `validateNewHouseName_` (line 943) calls `getHousesFromHouseValues_()` → `getSheet_(ss, 'HOUSE_VALUES')` which threw on a blank workbook. A second blocker also surfaced on retest before the fix: `onboardingOpenHousesPage()` did not call `loadHouseSection()`, so on a blank workbook the Add-form **Property type** dropdown was left with only the static `— Select type —` placeholder option, blocking save with `Property type is required.`. **Fix shipped in `4e6af6d`** — two changes: (a) `house_values.js` `addHouseFromDashboard` reorders the ensure block to run before `validateNewHouseName_`; (b) `Dashboard_Script_Onboarding.html` `onboardingOpenHousesPage` calls `loadHouseSection()` after `enterSetupEditorMode(...)` so the dropdown is populated on the first-run Setup / Review handoff. **New runtime evidence (this retest):** `addHouseFromDashboard` already creates the per-house `HOUSES - <Name>` sheet automatically as step 4 of its write transaction via `createHousesExpenseSheet_(ss, houseName)` (`house_values.js:1617`), with rollback semantics if the create fails. The pre-fix runtime test never reached this step because the validate-before-ensure failure aborted the function early, which is why the bootstrap audit's §5.2 originally classified the per-house tabs as "no canonical creator" — that classification is now corrected (see audit §5.2 superseded-by-runtime-evidence note). **Remaining concern** (not blocking): the generated `INPUT - House Values` / `SYS - House Assets` sheet formatting on a brand-new workbook is functional but visually unpolished (header widths, alignment, banded styling). The sheets are correct for downstream readers; the polish gap is tracked separately in §6 row 4. This is the same shape of bug the audit's risk class §7.3 covers — static analysis missed it because the guards looked correct at first glance. |
| 4.9.3 | Edit the House Value for the current month. | Write succeeds. | (was blocked by 4.9.2 prior to commit `4e6af6d`; unblocked once §4.9.2 was fixed — testable in a follow-up retest pass) | none | | | | |

### 4.10 House Expenses

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.10.1 | Open the House Expenses page after §4.9.2 (one house exists in `SYS - House Assets`). | **Updated expectation (per retest of §4.9.2):** the `HOUSES - <Name>` tab **already exists** because `addHouseFromDashboard` creates it as step 4 of its write transaction (`createHousesExpenseSheet_`, `house_values.js:1617`). The House Expenses page picker (`getHouseExpenseUiData`, `house_expenses.js:10`) scans `HOUSES - *` tabs and should surface the test house in the dropdown. **Original expectation** (preserved): `HOUSES - <Name>` tab has no ensure helper — that assumption was **superseded by runtime evidence** during the §4.9.2 retest. | | none | | | | |
| 4.10.2 | Attempt to add a House Expense for the house added in §4.9.2. | **Updated expectation:** write succeeds against the existing `HOUSES - <Name>` sheet (created in §4.9.2). One `house_expense_add` activity entry. **Original expectation** (preserved): `addHouseExpense` was expected to throw `'House sheet not found: HOUSES - <Name>'` per the audit §5.2 "confirmed gap" classification — that classification is now reframed; see audit §5.2 superseded-by-runtime-evidence note. Residual risk (legacy / edge case only): for a house already present in `SYS - House Assets` that does **not** have a corresponding `HOUSES - <Name>` tab (e.g. a workbook hand-edited to add a house row without going through `addHouseFromDashboard`), `addHouseExpense` still throws because it does not lazy-create the per-house tab. Not on the blank-workbook first-run path. | | none | | | | |

### 4.11 Property Performance

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.11.1 | Open the Property Performance page on a fresh workbook (before §4.9). | Calm "No houses yet" envelope. No red banner. (Audit §4.11 — explicit short-circuit confirmed.) | | none | | | | |
| 4.11.2 | After §4.9.2, reload Property Performance. | Page renders the new house with zeroed totals. | | none | | | | |

### 4.12 Retirement (Outlook + Scenario)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.12.1 | Open the Retirement page on a fresh workbook (before §4.2.7 Profile DOB save). | Calm empty state or "set DOB to see outlook" prompt. No red banner. | | none | | | | |
| 4.12.2 | After Profile DOB save (§4.2.8), reload Retirement. | Derived ages appear. Scenario table renders. | | none | | | | |
| 4.12.3 | Save a Retirement Scenario. | `INPUT - Retirement` created (if not already) by `getOrCreateRetirementSheet_`. Scenario template rows seeded on first creation. Save succeeds. Overview Retirement Outlook card refreshes. | | `INPUT - Retirement` (if not already) | | (one event) | | |

### 4.13 Upcoming Expenses (detailed)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.13.1 | Open Cash Flow → Upcoming Expenses on a fresh workbook (before §4.2.6). | Calm empty state. `INPUT - Upcoming Expenses` may or may not exist depending on Setup / Review path. | | maybe `INPUT - Upcoming Expenses` | | | | |
| 4.13.2 | Add an Upcoming Expense (loan / financing type). | Lazy-creates `INPUT - Upcoming Expenses` if needed. Row written. Activity log entry. | | maybe `INPUT - Upcoming Expenses` | | (one entry) | | |
| 4.13.3 | Quick-Add-from-Upcoming. | Quick Add deep-link succeeds; cash flow row written; upcoming row status updates. | | none | | | | |

### 4.14 Activity Log page

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.14.1 | Open the Activity Log page after every preceding test step. | Page renders with all events accumulated from §4.1 onward. Default filter shows recent entries. Filter UI works. | | none | | | | |
| 4.14.2 | Count the entries; cross-check against the expected entries per the per-action `Activity Log delta` columns above. | Count matches expected. **No spurious "ensure-helper" entries** — only real user events. | | n/a | | | | |

### 4.15 Rolling Debt Payoff (Planning page)

> **✅ Status (2026-05-23): runtime-confirmed working on blank workbook.** Both rows resolved PASS by the §4A addendum runtime session. Original "Unknown per audit §5.3." framing preserved verbatim below for historical record. See §4A closure for the detailed evidence.

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.15.1 | Open the Rolling Debt Payoff page on a fresh workbook (before §4.6.2). | **Unknown per audit §5.3.** Expected: calm empty state. Possible: red banner if `INPUT - Debts` read is strict. Confirm. | Page opens cleanly. Calm not-set-up card renders with the documented setup-message copy. No React mount. | none | **none** | (none — read-only) | **✅ PASS** | Resolved 2026-05-23 by §4A.3.1 + §4A.4.2. Confirms the `getRollingDebtPayoffPlan` short-circuit branch fires correctly with prerequisites absent. |
| 4.15.2 | After §4.6.2, reload Rolling Debt Payoff. | Page renders with the one debt. Plan output reflects it. | Populated path renders the one debt; plan output reflects it. No red banner. No sheet writes. | none | none | (none — read-only) | **✅ PASS** | Resolved 2026-05-23 by §4A.5.5. |

### 4.16 Debt Payoff Projection (Planning page)

> **✅ Status (2026-05-23): runtime-confirmed working on blank workbook.** Both rows resolved PASS by the §4A addendum runtime session. Original "Unknown per audit §5.3." framing preserved verbatim below for historical record. See §4A closure for the detailed evidence.

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.16.1 | Open Debt Payoff Projection on a fresh workbook (before §4.6.2). | **Unknown per audit §5.3.** Expected: calm empty state. Possible: red banner. Confirm. | Page opens cleanly. Calm zeroed envelope renders; per-debt table empty; summary card shows `$0.00`. No red banner. | none | **none** | (none — read-only) | **✅ PASS** | Resolved 2026-05-23 by §4A.3.2 + §4A.4.3. Confirms the `getDebtPayoffReadData` short-circuit branch fires correctly with prerequisites absent. |
| 4.16.2 | After §4.6.2, reload Debt Payoff Projection. | Page renders with the one debt. Projection output reflects it. | Populated path renders the one debt with rough-payoff estimate; summary card shows non-zero totals. No red banner. No sheet writes. | none | none | (none — read-only) | **✅ PASS** | Resolved 2026-05-23 by §4A.5.6. |

### 4.17 Purchase Simulator (Planning page)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.17.1 | Open Purchase Simulator on a fresh workbook. | Calm empty state. No red banner. | | none | | | | |
| 4.17.2 | Run one simulated purchase. | Computation runs locally; no sheet writes; no red banner. | | none | | | | |

### 4.18 Next Actions (Planning page)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.18.1 | Open Next Actions on a fresh workbook. | Calm empty state. No red banner. | | none | | | | |
| 4.18.2 | After data exists (debts + accounts), reload Next Actions. | Suggestions render. | | none | | | | |

### 4.19 Bank Import (sanity only — out of family beta scope)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.19.1 | If Bank Import is visible in the UI on this build, open it on a fresh workbook. (May be hidden per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §3 Non-goals`.) | Calm empty state or hidden. No red banner. | | maybe `SYS - Import *` | | | | |

### 4.20 Run Planner Now (optional, after data exists)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.20.1 | After at least one Bank Account, one Debt, and one Cash Flow entry exist, run the planner. | `OUT - Dashboard` and `OUT - History` are created by the planner. Snapshot history grows by one row. Overview deltas refresh. | | `OUT - Dashboard`, `OUT - History` | | (one `planner_run` or similar) | | |
| 4.20.2 | Re-run the planner. | Subsequent runs append to `OUT - History`; `OUT - Dashboard` is destructively rebuilt (planner-owned, expected). | | none | | (one more entry) | | |

---

## 4A. Addendum (2026-05-22) — Resolve planner-page blank-workbook unknowns

**Purpose of this addendum.** §4.15 (Rolling Debt Payoff) and §4.16 (Debt Payoff Projection) were both classified "Unknown / likely partial" by the static audit (`CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §5.3`). After the §5.6 fix shipped in commit `4e6af6d` and the §5.2 reclassification, these two are the only remaining runtime unknowns on the family beta first-run path per `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md → §4.2 / §6.1`. This addendum makes the next runtime session deterministic: it lists the exact navigation steps, the prerequisite state, the expected behavior, the PASS / PARTIAL / FAIL criteria, the red-banner expectations, the sheet-creation expectations, the planner-execution expectations, and the evidence that clears the unknown status. **No code change is authorized by this addendum** — it is a test plan only.

### 4A.1 Why these two pages need a runtime check

Both modules have explicit blank-workbook defensive short-circuits in the server-side entry point and a calm not-set-up branch in the client renderer. Specifically:

- **Rolling Debt Payoff** (`rolling_debt_payoff.js:2862–2924`, function `getRollingDebtPayoffPlan`) checks `ss.getSheetByName(sheetNamesEarly.DEBTS)` and `ss.getSheetByName(sheetNamesEarly.ACCOUNTS)` at the top. If either is missing, the function returns a neutral `{ not_set_up: true, setup_message: 'Add your debts and cash accounts in Setup / Review to see your rolling debt payoff plan.', summary: { plan_status: 'NOT_SET_UP', … }, … }` envelope. The client renderer at `Dashboard_Script_RollingDebtPayoff.html:744–759` reads `data.not_set_up === true` and renders a `<p class="muted">` setup-message card, skipping React mount and demo fallback and hiding the debug JSON panel.
- **Debt Payoff Projection** (`debt_payoff_projection.js:16–51`, function `getDebtPayoffReadData`) performs the same `ss.getSheetByName(sheetNames.DEBTS) / .ACCOUNTS` guard at the top and returns a zeroed envelope `{ projectionYears, debts: [], summary: { totalDebtBalance: 0, … }, recommendations: [], warnings: [], missingCashFlowSheets: [] }`. The page renders the empty / zeroed state via its existing renderer.

Both short-circuits are static-analyzed but unverified on a real blank workbook. The runtime test answers three concrete questions:
1. Does the page load cleanly when **both** `INPUT - Debts` and `SYS - Accounts` are absent?
2. Does the page load cleanly when **`INPUT - Debts` exists** (the bootstrap registry seeds it eagerly via `ensureOnboardingCoreSheetsFromDashboard`) but `SYS - Accounts` does not yet (which only appears after the user adds their first bank account)?
3. Does the page load cleanly after both prerequisites exist but no Cash Flow data has been entered yet?

State (2) is the most interesting one because it is the realistic state of a workbook after Setup / Review's first pass: `INPUT - Debts` is one of the six core bootstrap sheets, so it exists from the very first Setup / Review interaction, but `SYS - Accounts` does not appear until the user adds their first bank account. If either guard fails to handle this intermediate state, the user hits a red banner during Setup / Review.

### 4A.2 Prerequisites for the addendum runtime session

- A disposable, blank, throwaway workbook bound to a non-production deployment. **The §0 safety preamble of this report applies in full.** If the prior runtime session's workbook still exists and is still disposable, reuse it; otherwise create a new one per §2.
- The script project must include commit `4e6af6d` or later (the House onboarding fix). Verify by inspecting `house_values.js → addHouseFromDashboard` and confirming the ensure block precedes `validateNewHouseName_`. If the deployment predates the fix, redeploy or push the latest before running this addendum.
- The runtime session can run independently of the §4 main matrix. The Rolling Debt Payoff and Debt Payoff Projection pages do not write any sheet on read, so observations are non-destructive and rerunnable.

### 4A.3 State-1 test — fully blank workbook, no Setup / Review interaction yet

Both prerequisite sheets are absent. This is the cold-start path.

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4A.3.1 | On a brand-new workbook (only `Sheet1` plus whatever `INPUT - Settings` / `LOG - Activity` the first dashboard load creates), open Planning → **Rolling Debt Payoff** directly via the main nav (without going through Setup / Review first). | Calm setup message card: `<p class="muted">Add your debts and cash accounts in Setup / Review to see your rolling debt payoff plan.</p>`. Status row reads `Updated.` once the RPC resolves. No React mount. No debug JSON panel. **No red banner. No sheet writes.** No Activity Log entries from this read. | | none expected | **none** | (none — page is read-only) | | Confirms `getRollingDebtPayoffPlan` short-circuit branch fires when both `INPUT - Debts` and `SYS - Accounts` are missing. |
| 4A.3.2 | On the same workbook, open Planning → **Debt Payoff Projection** directly. | Calm zeroed envelope: per-debt table is empty (`No active debts.` / equivalent zero-state copy); summary card shows `$0.00` for `totalDebtBalance` / `totalMinimumPayments` / `usableCashAfterBuffers` / `totalAvailableNow` / `totalBuffers`; recommendations and warnings lists empty. **No red banner. No sheet writes.** No Activity Log entries from this read. | | none expected | **none** | (none — page is read-only) | | Confirms `getDebtPayoffReadData` short-circuit branch fires when both prerequisites are missing. |

### 4A.4 State-2 test — partial Setup / Review state (`INPUT - Debts` exists, `SYS - Accounts` does not)

This is the **realistic intermediate state** after Setup / Review's first pass and is the highest-value state to verify.

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4A.4.1 | From State-1, navigate Setup / Review → Bills (or any step that triggers `ensureOnboardingCoreSheetsFromDashboard`). Confirm `INPUT - Debts` now exists in the workbook tab strip. **Do not** add any bank account yet — `SYS - Accounts` must remain absent. | `INPUT - Debts` present; `SYS - Accounts` absent. | | `INPUT - Debts` (if not already) | none | | | Prerequisite step for §4A.4.2 / §4A.4.3 — not itself the test. |
| 4A.4.2 | Open Planning → **Rolling Debt Payoff**. | **Still the calm setup message** — because the guard checks both sheets and either being absent triggers the short-circuit. **No red banner.** No React mount. | | none | **none** | (none) | | Verifies the `||` guard ordering and that `SYS - Accounts`-absence alone is sufficient to trigger the not-set-up branch. |
| 4A.4.3 | Open Planning → **Debt Payoff Projection**. | Still the calm zeroed envelope. **No red banner.** | | none | **none** | (none) | | Verifies the equivalent guard in `getDebtPayoffReadData`. |

### 4A.5 State-3 test — both prerequisites exist, no Cash Flow data yet

This is the state immediately after the user adds their first bank account and their first debt via Setup / Review. The strict short-circuits no longer apply; the populated path runs.

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4A.5.1 | From State-2, complete Setup / Review → Bank Accounts → Add a single test account (e.g. *Test Checking*, Type: Bank, Use Policy: Standard, Priority: 9, no opening balance). | `SYS - Accounts` and a populated `INPUT - Bank Accounts` Year block now exist. One `bank_account_add` activity entry. | | `SYS - Accounts`, `INPUT - Bank Accounts` (Year block populated) | none | one `bank_account_add` | | Prerequisite for §4A.5.2 / §4A.5.3. |
| 4A.5.2 | From State-3 (still no debt rows; `INPUT - Debts` exists from §4A.4.1 but is empty), open Planning → **Rolling Debt Payoff**. | The populated path runs. The page renders **a calm "no active debts" state** (zero rows, zero totals, no plan output). `findRollingCashFlowAnchor_(ss)` may surface a `current_focus: '—'` / `anchor_month: '—'` set on the summary card because no current-year Cash Flow rows exist yet. **No red banner**, but a calm advisory message (e.g. `No active debts.`) is acceptable. **No sheet writes.** No Activity Log entries. | | none expected | none expected | (none) | | This is the realistic transition state. Acceptable to see a calm "no data" envelope; **not** acceptable to see `Missing sheet: …` or any other error banner. |
| 4A.5.3 | Open Planning → **Debt Payoff Projection**. | Same shape — empty `debts` array, zeroed summary, no recommendations, no warnings. **No red banner.** **No sheet writes.** | | none expected | none expected | (none) | | The `try` / `catch` around `readCashFlowSheetAsObjects_` at lines 69–76 swallows missing Cash Flow year sheets — confirm no banner leaks from that path. |
| 4A.5.4 | Add a single test debt via Setup / Review → Debts → Add a credit card row (e.g. *Test Card*, Type: Credit Card, Balance $500, Min $25, Credit Limit $1000, Int Rate 18%, Due Day 15). | `INPUT - Debts` gains one row; one `debt_add` activity entry. | | `INPUT - Debts` (gains row) | none | one `debt_add` | | Prerequisite for §4A.5.5 / §4A.5.6. |
| 4A.5.5 | Open Planning → **Rolling Debt Payoff**. | Page renders the one debt; plan output reflects the one debt and the one zero-balance bank account; `current_focus` resolves to *Test Card* (or its alias); `anchor_month` resolves to the current calendar month; `default_output` populates. **No red banner.** **No sheet writes.** | | none expected | none expected | (none — read-only) | | Closes §4.15.2 from the main matrix. |
| 4A.5.6 | Open Planning → **Debt Payoff Projection**. | Page renders the one debt with rough-payoff estimate; summary card shows non-zero `totalDebtBalance` and `totalMinimumPayments`. **No red banner.** **No sheet writes.** | | none expected | none expected | (none — read-only) | | Closes §4.16.2 from the main matrix. |

### 4A.6 PASS / PARTIAL / FAIL criteria

For each row in §4A.3 / §4A.4 / §4A.5, the result column is filled in using the following rubric:

- **PASS** — Every expectation in the row's *Expected* column was observed verbatim. Specifically: (a) no red banner, (b) the documented calm copy or populated render appeared, (c) no unexpected sheet was created, (d) no Activity Log entry was written by the read path, (e) the page status row reached `Updated.` (Rolling) or its equivalent (Projection) without spinning indefinitely.
- **PARTIAL** — The page loaded without a red banner **but** at least one secondary expectation was not met. Acceptable PARTIAL outcomes include: (a) the calm copy text drifted from the verbatim setup message (cosmetic only), (b) an unexpected-but-additive sheet was created (e.g. the page triggered an upstream lazy ensure that materialized a non-blocking sheet), (c) an Activity Log entry was written by the read path (this would be a regression worth tracking but not a hard failure). PARTIAL rows must be recorded with a verbatim description of what diverged.
- **FAIL** — Any of: (a) a red banner appears, (b) the page never resolves (infinite spinner), (c) an Apps Script execution exception surfaces in the dashboard status row or developer console, (d) an unexpected destructive write occurs (e.g. an `OUT - *` sheet is rebuilt by a planner run that should not have fired). FAIL must be reported with verbatim banner text, the sheets present at the moment of failure, and a screenshot if practical. A FAIL on any of §4A.3 / §4A.4 / §4A.5 promotes the corresponding surface back to a confirmed gap in the audit.

### 4A.7 Red-banner expectations

**On every row in §4A.3, §4A.4, §4A.5**: the expected red-banner count is **zero**. The Rolling Debt Payoff and Debt Payoff Projection pages have explicit not-set-up branches and zeroed envelopes; the read paths do not throw on missing prerequisites. The only acceptable error path on these pages is an Apps Script platform error (cold start timeout, deployment misconfiguration), which is not a code-level regression.

If a red banner appears that mentions `Missing sheet`, `getSheet_`, `readSheetAsObjects_`, or any sheet-name string from `getSheetNames_()`, that is a FAIL and a confirmed gap. Record the banner verbatim and add a row to §6.

### 4A.8 Sheet-creation expectations

- **§4A.3 (State-1, no prerequisites):** zero new sheets from opening either page. Both functions are read-only and the short-circuit branch does not write.
- **§4A.4 (State-2, only `INPUT - Debts` exists):** zero new sheets from opening either page. Same reason — the short-circuit branch is reached and does not write.
- **§4A.5 (State-3, both prerequisites exist):** zero new sheets from opening either page. The populated path is read-only; no `ensureCashFlowYearSheet_` / no `OUT - Dashboard` / no `OUT - History` is created by these RPCs. The Cash Flow year sheet is lazy-created only on Quick Add / Bill Pay write paths. The `OUT - *` sheets are created only by `runDebtPlanner` (Run Planner Now), not by the Rolling Debt Payoff page load.

If a new sheet appears as a side effect of opening either page on a blank workbook, that is at least a PARTIAL and worth investigating before final PASS.

### 4A.9 Planner-execution expectations

- **Rolling Debt Payoff (`getRollingDebtPayoffPlan`)** does **not** invoke `runDebtPlanner`. It reads `INPUT - Debts` / `SYS - Accounts` and any present Cash Flow year sheets, runs its own deterministic waterfall projection in-memory, and returns a payload. The planner-run pipeline (`OUT - Dashboard` / `OUT - History` writes, email send, debounce trigger) is **not** triggered by this page load.
- **Debt Payoff Projection (`getDebtPayoffReadData`)** is read-only and similarly does not invoke `runDebtPlanner`. It reads `INPUT - Debts`, `SYS - Accounts`, and the current-year Cash Flow sheet (defensively, inside a `try` / `catch`), and computes rough payoff months in-memory.
- The only planner-execution path on these pages is the **manual "Run Planner + Refresh Snapshot" button** elsewhere in the UI. That button is covered separately by §4.20 of this report and is **out of scope** for this addendum.

If the runtime observation shows `OUT - Dashboard` or `OUT - History` materializing as a side effect of opening either page, that is a FAIL (unauthorized destructive write on a read path).

### 4A.10 Evidence that clears the unknown status

The addendum is **fully resolved** when:

- Every row in §4A.3 is filled in with PASS, OR
- Every row in §4A.4 is filled in with PASS, OR
- Every row in §4A.5 (specifically §4A.5.2, §4A.5.3, §4A.5.5, §4A.5.6) is filled in with PASS.

The minimum sufficient evidence is **§4A.3 + §4A.4 PASS rows for both surfaces** — those two states cover the only realistically reachable blank-workbook states a first-run family beta user would hit. §4A.5 is a nice-to-have that closes the matrix's §4.15.2 / §4.16.2 rows.

If any FAIL surfaces, the addendum is **not resolved** and the corresponding surface is reclassified as a confirmed gap. A new row is added to §6 with:
- Verbatim banner text.
- Sheets present at the moment of failure.
- State (1 / 2 / 3) where the failure surfaced.
- Suggested smallest additive fix (likely: extend the existing `||` guard, OR add a `try` / `catch` around the strict-read call, mirroring the pattern already present in `getDebtPayoffReadData`'s Cash Flow read at lines 69–76).

Once §4A is fully resolved with PASS rows:
1. Update `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §5.3` to reclassify Rolling Debt Payoff / Debt Payoff Projection from "Unknown / likely partial" to "Runtime-confirmed working on blank workbook."
2. Update `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §11` summary to remove the "Unknown: one" line.
3. Update `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md → §4.2` to mark the planner-page unknown as resolved.
4. The remaining true onboarding blocker list collapses to **§5.1 Donations only**, clearing the path for the next deliberate choice (Option A or Option C per the checkpoint's §7 framing).

### 4A.11 Estimated session cost

- **Setup:** 5 minutes (reuse the disposable workbook from the prior session, or create a fresh one).
- **State-1 (§4A.3):** 5 minutes (two page opens, two observations).
- **State-2 (§4A.4):** 5 minutes (one Setup / Review step to seed `INPUT - Debts`, then two page opens).
- **State-3 (§4A.5):** 10 minutes (add one bank account, two page opens, add one debt, two page opens).
- **Doc updates after the session:** 10 minutes (fill in the observation columns, update audit / readiness-checkpoint cross-references).

**Total: ~35 minutes** for the full addendum, or ~15 minutes if only §4A.3 + §4A.4 are run (the minimum sufficient evidence).

### 4A.12 Closure — runtime evidence (2026-05-23)

**Status: ✅ ADDENDUM FULLY RESOLVED.** The §4A runtime session was executed on a disposable blank workbook against a deployment containing commit `d489824` (which includes the §5.6 House onboarding fixes from `4e6af6d` per the prerequisite in §4A.2). The two planner-page surfaces previously classified "Unknown / likely partial" by `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §5.3` are now **runtime-confirmed working on blank workbook**. No new onboarding gap was discovered; no red banner surfaced on any row; no unexpected sheet creation; no planner execution side-effect. The §4.15 / §4.16 rows in the main matrix are updated accordingly with the PASS results and link back to this closure.

**Observed results (summary):**

- **§4A.3 (State-1 — fully blank, no Setup / Review interaction):** PASS for both pages. Calm not-set-up card on Rolling; calm zeroed envelope on Projection. No red banner. No sheet writes. No Activity Log entries from the read paths.
- **§4A.4 (State-2 — `INPUT - Debts` exists from bootstrap registry, `SYS - Accounts` still absent):** PASS for both pages. The `||` guard fires correctly when only one prerequisite is missing; the short-circuit branch is reached and the calm copy / zeroed envelope render exactly as in State-1.
- **§4A.5 (State-3 — both prerequisites present; populated path runs):** PASS for both pages. With zero debts, both surfaces render their calm zero-state. With one debt added (the credit-card test row per §4A.5.4), both surfaces render the populated state — Rolling resolves `current_focus` to the test card and `anchor_month` to the current calendar month; Projection shows the per-debt row with its rough-payoff estimate; summary card shows non-zero `totalDebtBalance` / `totalMinimumPayments`. No red banner. No sheet writes.

**Behavior confirmed against the runtime-evidence rubric in §4A.6 / §4A.7 / §4A.8 / §4A.9:**

- **Red banners (§4A.7):** zero on every row. No banner mentioned `Missing sheet`, `getSheet_`, `readSheetAsObjects_`, or any `getSheetNames_()` value.
- **Sheet creation (§4A.8):** zero new sheets from opening either page in any of the three states. The only sheets created during the addendum session were the expected prerequisites added by Setup / Review itself (`INPUT - Debts` via the bootstrap registry, then `SYS - Accounts` + `INPUT - Bank Accounts` via `addBankAccountFromDashboard`) — none were caused by opening the planner pages.
- **Planner execution (§4A.9):** zero `OUT - Dashboard` / `OUT - History` materializations from the page-open paths. Neither page invokes `runDebtPlanner`; both run their in-memory projection only.
- **Activity Log:** zero entries from page-open reads. Activity entries only appeared for the explicit user-action prerequisites (`bank_account_add`, `debt_add`).
- **Dependency guidance (§4A.1 questions 1 / 2 / 3):** Each of the three reachable states (no prerequisites, partial prerequisites, full prerequisites) renders cleanly. The setup-message copy on the not-set-up card is understandable and actionable — points the user back to Setup / Review without leaking internal sheet names or implementation details.
- **Planner assumptions explained correctly:** the Rolling Debt Payoff card's `current_focus: '—'` / `anchor_month: '—'` placeholders during the zero-debt populated state (§4A.5.2) are calmly explained by the existing UI — no error, just a "nothing yet" rendering.

**Documentation cross-references updated as a result of this closure:**

- This report's §4.15 / §4.16 main-matrix rows now carry the PASS results and the historical-Unknown banner.
- `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §5.3` reclassified from "unknown" to "runtime-confirmed working on blank workbook" (with the original wording preserved verbatim and the resolution annotated).
- `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §11` summary updated to remove the "Unknown: one" line and reclassify the runtime-matrix status as complete.
- `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md → §4.2 / §6.1 / §7` updated to reflect that Option B is now complete and the next deliberate choice collapses to Option A (Donations bootstrap gap) or Option C (begin central-mode planning).
- `SESSION_NOTES.md` updated with the closure milestone.

**What the addendum did not change:**

- No code change. No HTML change. No deployment-setting change. No schema change. No new ensure helper. No new sheet name. No new activity event type.
- The latent pre-validation-before-ensure shape in `addDebtFromDashboard` / `addInvestmentAccountFromDashboard` (runtime-report §6 row 5) is still latent — not surfaced by this runtime session and not in scope for the addendum.
- The cosmetic House Values / House Assets first-create polish (runtime-report §6 row 4) is still optional and still tracked.
- The legacy / edge-case `addHouseExpense` lazy-create concern (runtime-report §6 row 2 reframed) is still optional and still tracked.
- `INPUT - Donation` bootstrap gap (audit §5.1) is still open — now the **only** remaining confirmed onboarding blocker on the family beta first-run path.

**Net effect on blank-workbook onboarding readiness.** The blank-workbook runtime matrix is **effectively complete**. Every surface that has been deemed in-scope for the family beta first-run path is either runtime-confirmed working, runtime-confirmed lazy-bootstrapping calmly, runtime-confirmed degrading gracefully via a calm zero-state, or a confirmed gap with a known smallest-fix. The remaining "true onboarding blocker" list is **one item**: Donations (§5.1). Everything else is either optional defense-in-depth, optional cosmetic polish, deferred non-goal, or future central-mode work.

---

## 5. Aggregate observations

To be filled in after §4 is complete.

### 5.1 Sheets created during the test (final inventory)

List every sheet present in the workbook at the end of the test, in the order it appeared:

| Order | Sheet name | Created by (which §4 step) | Notes |
|---|---|---|---|
| 1 | Sheet1 | §2 (pre-existing) | Default tab. |
| 2 | … | … | |

### 5.2 Red banners observed

For each red banner or visible error during the test:

| # | Where (which §4 step) | Banner text (verbatim) | Reproducible? | Maps to which audit gap? |
|---|---|---|---|---|
| 1 | | | | |

### 5.3 Activity Log audit

- [ ] Final `LOG - Activity` entry count: ____ (vs expected count per Σ of per-step deltas).
- [ ] Any unexpected event types?
- [ ] Any duplicate entries (concurrency race)?
- [ ] Any entries with `Dedupe Key` collisions?
- [ ] Did the activity log capture every real user event in §4?

### 5.4 Race / concurrency observations

- [ ] Did the very first Overview load surface any "Sheet already exists" error? (Per `getOrCreateActivityLogSheet_` race-safe insert; should not surface.)
- [ ] Did any rapid double-click produce a duplicate sheet or duplicate activity entry?

### 5.5 Performance observations

- [ ] First Overview load latency (cold-start, no sheets yet): ____ seconds.
- [ ] Subsequent Overview load (sheets already exist): ____ seconds.
- [ ] First Quick Add latency: ____ seconds.
- [ ] First Bank Account Add latency (creates `SYS - Accounts` + `INPUT - Bank Accounts` + first-year block): ____ seconds.

### 5.6 Bound-mode parity

- [ ] After the test, reload the developer's **production** workbook (in a separate tab) and confirm no regression versus the captured baseline. The production workbook is untouched by this test (no shared script project, no shared deployment) — this is a sanity confirmation, not a re-run.

---

## 6. Recommended follow-up gaps

After §4 and §5 are filled in, summarize the runtime gaps here. Each row becomes a candidate input for a Pass 2 implementation prompt per `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §8.2`.

| # | Gap | Severity | Surfaced in step | Recommended Pass 2 prompt |
|---|---|---|---|---|
| 1 | `INPUT - Donation` missing — Donations form throws on blank workbook. | High (audit §5.1) | §4.4.2 | Add `ensureInputDonationSheet_` in `donations.js`; register under new `BOOTSTRAP_KEY_DONATION_` in `sheet_bootstrap.js`; replace `getDonationsSheet_`'s throw with a lazy create. |
| 2 | ~~`HOUSES - <Name>` per-house tab missing — House Expense add throws.~~ **Superseded by runtime evidence (2026-05-22 retest).** `addHouseFromDashboard` already creates the per-house tab via `createHousesExpenseSheet_` (`house_values.js:1617`). The pre-fix runtime test never reached that step because the validate-before-ensure failure aborted the function early; once the Houses onboarding gap (§5.6 / row 3 above) was fixed in commit `4e6af6d`, the per-house tab is now created end-to-end on a blank workbook. **Residual concern (legacy / edge case only, not a first-run onboarding blocker):** `addHouseExpense` (`house_expenses.js:49`) does **not** lazy-create the per-house tab — it throws `'House sheet not found: <name>'` if a row exists on `SYS - House Assets` without a corresponding `HOUSES - <Name>` tab (only possible via hand-edits or an import that bypassed `addHouseFromDashboard`). | Low — was High; now legacy-only edge case | §4.9.2 retest + code inspection of `house_values.js:1617` | Optional defense-in-depth Pass 2 (hardening, not onboarding): lazy-create the per-house tab inside `addHouseExpense` by calling `createHousesExpenseSheet_(ss, locationName)` when `ss.getSheetByName(payload.house)` is null. Strictly additive; no schema change; preserves the existing creator's rollback behavior. Not required for the family beta first-run path. |
| 3 | ~~**Houses onboarding fails on blank workbook — `validateNewHouseName_` reads `INPUT - House Values` strictly before the ensure-before-write guards run.**~~ **✅ FIXED in commit `4e6af6d` (2026-05-22).** Two changes shipped together: (a) `house_values.js` `addHouseFromDashboard` reorders the `ensureInputHouseValuesSheet_()` / `ensureSysHouseAssetsSheet_()` / `SpreadsheetApp.flush()` block to run **before** `validateNewHouseName_`; (b) `Dashboard_Script_Onboarding.html` `onboardingOpenHousesPage` calls `loadHouseSection()` after `enterSetupEditorMode(...)` so the Add-form Property type dropdown is populated on first-run navigation (the second blocker was uncovered while retesting the first fix — `populateHouseAddDatalists_` was never running because `initDashboard()` is skipped on the blank-workbook route). Pre-fix static recheck of `addBankAccountFromDashboard` / `addDebtFromDashboard` / `addInvestmentAccountFromDashboard` was performed: Bank Accounts already runs ensure-before-validate; **Debts and Investments still have the same pre-validation-before-ensure shape** and remain a latent risk (no runtime regression observed because both bootstrap their canonical sheets earlier via the core onboarding registry, but the shape is fragile — see §6.4 below). Retest §4.9.2 PASSES. | Originally High; now resolved. | §4.9.2 | _Fix shipped_ — no Pass 2 prompt required. |
| 4 | **Generated House Values / House Assets sheet formatting on first creation is unpolished (visual only, not blocking).** After §4.9.2 retest pass, the freshly created `INPUT - House Values` and `SYS - House Assets` are structurally correct but visually rough (header widths, alignment, banded styling). Downstream readers are unaffected (data round-trips correctly through `getHouseUiData`, `getHousesFromHouseValues_`, `getHouseAssetsHeaderMap_`, etc.) and the planner / Overview surfaces render correctly. | Low — cosmetic only, no functional impact | §4.9.2 retest | Possible Pass 2 (cosmetic polish): tighten the default column widths / freeze row / banded styling inside `ensureInputHouseValuesSheet_` and `ensureSysHouseAssetsSheet_` first-create branches. Strictly additive — only the first-create path runs the polish, and even there it should be applied only when the sheet was just inserted in the current execution (`created === true` from the existing race-safe insertSheet pattern), so populated workbooks remain byte-for-byte untouched. Not blocking the family beta proof. |
| 5 | **Latent risk: `addDebtFromDashboard` / `addInvestmentAccountFromDashboard` follow the same pre-validation-before-ensure shape that caused the Houses gap.** `validateNewDebtAccountName_` reads `INPUT - Debts` strictly via `getAllDebtAccountNamesIncludingInactive_()`; `validateNewInvestmentAccountName_` reads `INPUT - Investments` / `SYS - Assets` strictly via `getInvestmentsFromHistory_()` / `assetExistsInAssetsSheet_()`. Both calls happen **before** the in-function ensure block. The bug is masked today because the family beta onboarding registry creates `INPUT - Debts` eagerly via `ensureOnboardingCoreSheetsFromDashboard`, and most blank-workbook routes hit Investments only after Bank Accounts. Surfaced during the static recheck performed as part of the §4.9.2 fix. | Medium — no current runtime regression but matches the failure shape | static recheck inside §4.9.2 fix | Possible Pass 2 (defense-in-depth, narrow): reorder the ensure block to precede the strict-read validator in both `debts.js` `addDebtFromDashboard` and `investments.js` `addInvestmentAccountFromDashboard`. Mirrors the Houses fix. Each is a 1-file change with no schema or contract change. Not on the critical path for the family beta proof; queue behind the §5.1 / §5.2 gap fills. |
| 6 | (Fill in any new gap surfaced by a future runtime test.) | | | |

### 6.1 Unknown rows that became Known

| Audit §4 row | Pre-test classification | Post-test classification | Step that resolved it |
|---|---|---|---|
| 4.15 Rolling Debt Payoff | Unknown | **Works (PASS) — runtime-confirmed 2026-05-23** | §4A.3.1 + §4A.4.2 + §4A.5.5 |
| 4.16 Debt Payoff Projection | Unknown | **Works (PASS) — runtime-confirmed 2026-05-23** | §4A.3.2 + §4A.4.3 + §4A.5.6 |
| (others) | — | — | — |

After 2026-05-23 there are **no remaining Unknown rows** in the runtime matrix for the family beta first-run path.

### 6.2 Notes for the next implementation prompt set

Free-form notes. Anything the next implementation pass needs to know that does not fit the structured tables above — e.g. unexpected sheet ordering, an ensure helper that ran in an unexpected order, a banner that surfaced once but not on retry.

---

## 7. Sign-off

When this report is complete and committed:

- [ ] Every §4 row has `Observed`, `Result`, and `Notes` filled in.
- [ ] §5 aggregate sections are filled in.
- [ ] §6 gap list is finalized.
- [ ] Tester confirms: the production workbook is untouched.
- [ ] Tester confirms: the throwaway test workbook is moved to Drive Trash (or kept in a dedicated "experiments" folder, clearly labeled).
- [ ] Tester confirms: the bound script project for the throwaway workbook is either deleted or clearly labeled as a test project.
- [ ] Tester confirms: the production deployment URL was not used at any point.

After sign-off, the gap list in §6 drives the next implementation prompts per `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §8.2 Pass 2`.

---

End of document.
