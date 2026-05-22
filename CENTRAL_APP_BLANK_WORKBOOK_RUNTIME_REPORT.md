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
| 4.9.2 | Setup / Review → Houses → "Open Houses editor" → enter Test House → click **Create house**. | `INPUT - House Values` and `SYS - House Assets` created (if not already). New row written. Activity log `house_add` entry. | **FAIL — confirmed gap.** Error: `Missing sheet (after retry+flush): INPUT - House Values`. Sheets present at failure: `Sheet1`, `INPUT - Settings`, `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, `INPUT - Cash Flow 2026`, `LOG - Activity`, `INPUT - Retirement`, `INPUT - Upcoming Expenses` (note: `INPUT - House Values` not created). | none — write aborted before sheet creation | red banner: `Missing sheet (after retry+flush): INPUT - House Values` | (none — no entry written) | **F** | Root cause located via code inspection: `addHouseFromDashboard` (`house_values.js:1486`) calls `validateNewHouseName_(payload.houseName)` on line 1489 **before** the ensure-before-write guards on lines 1540–1554. `validateNewHouseName_` (line 943) calls `getHousesFromHouseValues_()` → `getSheet_(ss, 'HOUSE_VALUES')` which throws on a blank workbook. The ensure guards were added but the pre-validation read path still throws first. This is the same shape of bug the audit's risk class §7.3 ("Modules that assume existing sheets") covers — static analysis missed it because the guards looked correct at first glance. |
| 4.9.3 | Edit the House Value for the current month. | Write succeeds. | (blocked by 4.9.2 — not testable until gap is fixed) | none | | | | |

### 4.10 House Expenses

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.10.1 | Open the House Expenses page after §4.9.2 (one house exists in `SYS - House Assets` but no `HOUSES - <Name>` tab). | **Risk:** `HOUSES - <Name>` tab has no ensure helper (audit §5.2). Page list may render empty (defensive read) or surface "No house tabs found." | | none | | | | |
| 4.10.2 | Attempt to add a House Expense for the house added in §4.9.2. | **Expected to fail:** `addHouseExpense` throws `'House sheet not found: HOUSES - <Name>'` (audit §5.2 confirmed gap). Red banner. | | none | (likely error) | | | |

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

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.15.1 | Open the Rolling Debt Payoff page on a fresh workbook (before §4.6.2). | **Unknown per audit §5.3.** Expected: calm empty state. Possible: red banner if `INPUT - Debts` read is strict. Confirm. | | none | | | | |
| 4.15.2 | After §4.6.2, reload Rolling Debt Payoff. | Page renders with the one debt. Plan output reflects it. | | none | | | | |

### 4.16 Debt Payoff Projection (Planning page)

| # | Action | Expected | Observed | Sheets created (delta) | Banners | Activity Log delta | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 4.16.1 | Open Debt Payoff Projection on a fresh workbook (before §4.6.2). | **Unknown per audit §5.3.** Expected: calm empty state. Possible: red banner. Confirm. | | none | | | | |
| 4.16.2 | After §4.6.2, reload Debt Payoff Projection. | Page renders with the one debt. Projection output reflects it. | | none | | | | |

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
| 2 | `HOUSES - <Name>` per-house tab missing — House Expense add throws. | High (audit §5.2) | §4.10.2 | Add `ensureHousesSheetForName_(name)` with canonical from-scratch creator for the per-house year-block layout; wire into `addHouseFromDashboard` and `addHouseExpense`. |
| 3 | **Houses onboarding fails on blank workbook — `validateNewHouseName_` reads `INPUT - House Values` strictly before the ensure-before-write guards run.** Setup / Review → Houses → "Open Houses editor" → Create house throws `Missing sheet (after retry+flush): INPUT - House Values` even though `addHouseFromDashboard` has ensure guards. | High — confirmed runtime fail | §4.9.2 | Move the ensure-before-write guards in `addHouseFromDashboard` (`house_values.js:1486`) to run **before** `validateNewHouseName_(payload.houseName)`, OR make `validateNewHouseName_` tolerate the missing sheet (treat "no existing houses" as the empty case, mirroring the defensive read pattern used in `getHouseUiData` at `house_values.js:154`). The smaller change is reordering: move the `ensureInputHouseValuesSheet_()` / `ensureSysHouseAssetsSheet_()` / `SpreadsheetApp.flush()` block from lines 1539–1555 to the top of `addHouseFromDashboard`, before `validateRequired_` returns. Pre-conditions for the prompt: confirm the same gap does not exist in `addBankAccountFromDashboard` / `addDebtFromDashboard` / `addInvestmentAccountFromDashboard` (likely safe but worth a static check before the prompt is written, since the runtime test surfaced a static-analysis miss). |
| 4 | (Fill in any new gap surfaced by the runtime test.) | | | |

### 6.1 Unknown rows that became Known

| Audit §4 row | Pre-test classification | Post-test classification | Step that resolved it |
|---|---|---|---|
| 4.15 Rolling Debt Payoff | Unknown | (fill in: Works / Partial / Fails) | §4.15.1 |
| 4.16 Debt Payoff Projection | Unknown | (fill in: Works / Partial / Fails) | §4.16.1 |
| (others) | | | |

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
