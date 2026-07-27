# Regression Scenarios — Historical Bug Registry

*Permanent project memory. Every production bug fixed becomes a **Regression
Scenario** so it can never silently return.*

**Status:** **Living registry; coverage implemented incrementally.** REG-009 has an
executable Harness guard and full isolated runtime evidence; REG-010–014 retain
their static/manual evidence and explicit future automated homes. This file is the
source of truth for *what* the regression pack covers; the harness is *how*.

> **Scope of this file vs. the suite plan.** This registry is **permanent memory of
> fixed historical bugs** — one `REG-###` per bug so it can never silently return.
> The broader **forward-looking end-to-end suite roadmap** (Smoke / Bills Recurrence
> / Income / Investments / Houses / Dashboard / Recovery / Stress / Release
> Readiness, with coverage matrices and build order) lives in
> **`REGRESSION_SUITE_PLAN.md`**. The historical `REG-###` entries below are a subset
> of that suite's REGRESSION level.

> **Note on seeded entries:** the initial `REG-###` entries below are reconstructed
> from project history (`SESSION_NOTES.md`, the Central-migration audit, and recent
> milestones). **Dates, root causes, and affected files should be confirmed against
> `SESSION_NOTES.md` / git history when each scenario is implemented.**

---

## Workflow — fix a bug → add a scenario

> **Trigger:** every bug fix runs the **Regression Discovery Policy**
> (`REGRESSION_SUITE_PLAN.md → Regression Discovery Policy`, §2) — *does this map to
> an existing `REG-###`, or does it need a new one? What exact behavior failed, and
> what exact assertion would catch it next time?* Use the copy-paste **Regression
> Discovery** prompt block (`REGRESSION_SUITE_PLAN.md → §A`).

Whenever a production bug is fixed:

1. Add a new `REG-###` entry below (next sequential id; never reuse).
2. Fill in: bug title · date discovered · root cause · affected files · **expected
   result** (Validator gate and/or harness assertion) · repro fixture · status.
3. Add the matching scenario to the `REGRESSION` pack (`test_harness_scenarios.js`),
   with any repro data in `test_harness_data.js`.
4. The scenario must **fail on the old (buggy) behavior and pass on the fix** —
   that is what makes it a real regression guard.

---

## Entry format

```
### REG-### — <bug title>
- Category: REGRESSION
- Date discovered: <YYYY-MM-DD>
- Status: <fixed | scenario-pending | covered>
- Affected files: <files>
- Root cause: <one-paragraph cause>
- Repro (harness): <how the scenario reproduces it, incl. fixture>
- Expected result: <Validator gate AND/OR harness assertion — e.g. "no exception
  thrown + Validator PASS", or "Validator detects <finding>, then PASS after heal">
```

> **Why "expected result" is often more than a Validator gate.** The Validator
> judges *workbook health* (end state). Many historical bugs were **runtime
> crashes** (e.g. a null spreadsheet), which the Validator alone cannot catch. For
> those, the scenario asserts **both**: (a) the workflow completes **without
> throwing** in a Central-resolved context, **and** (b) the resulting workbook
> passes the Validator health check. The Harness catches the crash; the Validator
> confirms the end state.

---

## Seeded registry (reconstructed from project history)

### REG-001 — Donations page crash in Central mode (`getSheetByName` on null)
- Category: REGRESSION
- Date discovered: ~2026-07-11 (Special-family closeout)
- Status: fixed (`ensureInputDonationSheet_` now uses `getUserSpreadsheet_()`)
- Affected files: `donations.js`
- Root cause: `ensureInputDonationSheet_` resolved the workbook with
  `SpreadsheetApp.getActiveSpreadsheet()`, which returns **null** in the standalone
  Central project (no bound/active spreadsheet). Every downstream
  `ss.getSheetByName(...)` then threw *"Cannot read properties of null (reading
  'getSheetByName')"* on the Donations page.
- Repro (harness): run the Donation ensure/read workflow in a Central-resolved
  context against a disposable workbook.
- Expected result: **no exception thrown** + `INPUT - Donation` present + Validator
  PASS (provisioning + schema).

### REG-002 — Central-incompatible workbook access: bank import
- Category: REGRESSION
- Date discovered: ~2026-07-11 (Central migration bug sweep)
- Status: fixed (all `getActiveSpreadsheet()` → `getUserSpreadsheet_()`)
- Affected files: `bank_import.js`
- Root cause: same class as REG-001 — import staging/review resolved the workbook
  via `getActiveSpreadsheet()`, null in Central.
- Repro (harness): run the import staging/review workflow in a Central-resolved
  context.
- Expected result: no exception + staging/ignored sheets present + Validator PASS.

### REG-003 — Central-incompatible workbook access: rolling debt payoff
- Category: REGRESSION
- Date discovered: ~2026-07-11 (Central migration bug sweep)
- Status: fixed (two sites → `getUserSpreadsheet_()`)
- Affected files: `rolling_debt_payoff.js`
- Root cause: same class as REG-001 at two call sites.
- Repro (harness): run the rolling debt payoff read/compute workflow in Central.
- Expected result: no exception + Validator PASS.

### REG-004 — Central-incompatible workbook access: quick add payment
- Category: REGRESSION
- Date discovered: ~2026-07-11 (Central migration bug sweep)
- Status: fixed (two sites → `getUserSpreadsheet_()`)
- Affected files: `quick_add_payment.js`
- Root cause: same class as REG-001.
- Repro (harness): run quick-add-payment against a disposable workbook's Cash Flow.
- Expected result: no exception + payment row written + Validator PASS.

### REG-005 — Central-incompatible workbook access: next actions
- Category: REGRESSION
- Date discovered: ~2026-07-11 (Central migration bug sweep)
- Status: fixed (`getActiveSpreadsheet()` → `getUserSpreadsheet_()`)
- Affected files: `next_actions.js`
- Root cause: same class as REG-001.
- Repro (harness): run the next-actions read path in Central.
- Expected result: no exception + Validator PASS.

### REG-006 — Bootstrap registry straggler used active spreadsheet
- Category: REGRESSION
- Date discovered: ~2026-07-11 (Central migration bug sweep)
- Status: fixed (`ensureBootstrapSheet_` → `getUserSpreadsheet_()`)
- Affected files: `sheet_bootstrap.js`
- Root cause: the coarse-grained bootstrap registry resolved via
  `getActiveSpreadsheet()`, null in Central.
- Repro (harness): drive the bootstrap ensure path in Central.
- Expected result: no exception + required sheets present + Validator PASS.

### REG-007 — Bills Due performance regression (~51s)
- Category: STRESS / performance (regression-tracked)
- Date discovered: Stage 2 (Product Hardening)
- Status: fixed (~51s → ~5.6s via per-request Cash Flow row-map + Activity Log
  dedupe caching)
- Affected files: Bills Due / dashboard data path
- Root cause: repeated per-row lookups without a per-request cache.
- Repro (harness): STRESS fixture — large Activity Log + many bills; time the Bills
  Due computation.
- Expected result: Validator PASS **and** runtime under an agreed threshold
  (recorded on the **Performance** line of the Release Readiness report).

### REG-008 — AutoPay concurrency (double-post race)
- Category: REGRESSION
- Date discovered: 2026-07-09 (Recurrence Engine V2)
- Status: fixed (AutoPay concurrency hardening via `LockService`)
- Affected files: bills / autopay path
- Root cause: concurrent AutoPay runs could post twice without a lock.
- Repro (harness): simulate overlapping AutoPay invocations against a disposable
  workbook.
- Expected result: exactly one posting + Validator PASS (no duplicate rows).

### REG-009 — Central recovery silently created a duplicate workbook
- Category: REGRESSION / RECOVERY
- Date discovered: 2026-07-07
- Status: covered and fully runtime-validated; Apps Script scenario 7/7 and Recovery suite 1/1 passed, and every live decision branch passed including MEDIUM auto-adopt ON. No duplicate was created.
- Affected files: `central_provisioning.js`, `central_diagnostics.js`,
  `sheet_bootstrap.js`, `Dashboard_Script_Render.html`, `Dashboard_Body.html`
- Root cause: after a mapping was cleared, `provisionWorkbookForUser_` searched
  for an existing workbook only when `CENTRAL_AUTO_ADOPT` was enabled. With the
  default-off flag—or when candidate search/verification failed—the resolver
  fell through to `Drive.Files.create`, even if a viable CashCompass workbook
  still existed.
- Repro (harness): `REGRESSION-RECOVERY-DUPLICATE-GUARD` exercises the pure
  candidate matrix on a disposable harness workbook. The separate Central
  runtime matrix creates and identifies one disposable CashCompass workbook,
  clears only its mapping, and repeats with multiple candidates, Drive-list
  failure, and candidate verification failure.
- Expected result: candidate detection always runs. Exactly zero confirmed
  candidates is the only path that calls `Drive.Files.create`; one marker
  candidate relinks, one name-only candidate requests explicit confirmation,
  two or more candidates stop as ambiguous, and search/verify failures stop as
  unavailable. No branch silently creates a duplicate.

### REG-010 — Blank/fresh workspace opened with no default subpanel
- Category: REGRESSION / UI
- Date discovered: 2026-07-20
- Status: fixed; automated UI scenario pending
- Affected files: dashboard workspace routing/render scripts
- Root cause: top-level Cash Flow, Properties, and Planning entry could leave no
  selected child panel on first entry.
- Repro (future UI harness): open every top-level workspace on a fresh disposable
  workbook without clicking a subtab first.
- Expected result: Assets → House Values, Cash Flow → Quick add, Properties → House
  Expenses, and Planning → Next Actions render immediately while preserving an
  already selected subtab on return.

### REG-011 — Setup surfaced internal sheet names and raw failure detail
- Category: REGRESSION / UI
- Date discovered: 2026-07-20
- Status: fixed; static checks present, UI scenario pending
- Affected files: onboarding server/UI copy
- Root cause: onboarding status messages reused internal workbook identifiers and
  raw error text instead of product guidance.
- Repro (future UI harness): load Setup on blank, partial, and probe-failure fixtures.
- Expected result: calm product language, no `INPUT -`/`SYS -` identifiers in normal
  guidance, and a retryable fail-closed message rather than raw server errors.

### REG-012 — Empty editors allowed invalid Save/Stop/Add actions
- Category: REGRESSION / UI
- Date discovered: 2026-07-20
- Status: fixed; static checks present, UI scenario pending
- Affected files: Bank, Investment, Debt, and House Expense dashboard editors
- Root cause: action controls were enabled before an account/debt/house selection
  existed, inviting no-target writes and confusing failures.
- Repro (future UI harness): open each editor on a fresh disposable workbook and
  inspect controls before and after creating/selecting a representative record.
- Expected result: actions remain disabled with guidance until their target exists,
  then enable and complete against the selected disposable record.

### REG-013 — Financial Plan refresh rebuilt unused History charts
- Category: STRESS / performance
- Date discovered: 2026-07-20
- Status: fixed; static guard present, runtime performance scenario pending
- Affected files: planner History output and performance timing
- Root cause: every refresh rebuilt six embedded `OUT - History` charts that no
  product surface used, adding 11.507 seconds to the measured repeat run.
- Repro (future performance harness): run first/repeat planner refreshes on the
  representative disposable fixture through an explicit-spreadsheet seam.
- Expected result: History rows still append/deduplicate and feed comparisons, the
  sheet contains zero chart objects, timing uses `cleanup_history_charts`, and the
  operation stays within the ratified planner budget.

### REG-014 — Bank formatted balance replacement concatenated the loaded value
- Category: REGRESSION / UI
- Date discovered: 2026-07-23
- Status: fixed; static guard + isolated Central `@175` interactive writer replay PASS
- Affected files: shared dashboard currency-focus helper and Bank balance editor
- Root cause: Bank loaded the stored balance as a formatted currency string and
  focus converted it to raw digits without establishing a whole-value replacement
  selection. The observed Browser replacement of `$12,500` with `12600` therefore
  submitted `$1,250,012,600`, which the valid-number path accepted and saved.
- Repro (UI harness): on a guarded populated disposable workbook, select the Bank
  account whose loaded value is `$12,500`, focus the balance editor, replace it with
  `12600` through typing and paste variants, and save.
- Expected result: first-focus typing/paste replaces the complete loaded value;
  the submitted and stored value is exactly `$12,600`; Activity records only the
  intended update; every non-Bank currency editor preserves its existing caret
  behavior.

### REG-015 — Standalone browser evidence inherited stale candidate metadata
- Category: REGRESSION / TEST EVIDENCE
- Date discovered: 2026-07-23
- Status: fixed; standalone fail-closed path runtime-proven on isolated `@178`
  and dedicated exact-owner Release Readiness path runtime-proven on isolated
  `@181`
- Affected files: all browser-suite launchers, runner preparation state, and the
  Release Readiness candidate-ownership handoff
- Root cause: the first correction stopped reading mutable candidate metadata at
  completion, but campaign preparation still treated any saved `IN_PROGRESS`
  Release Readiness state as its owner. The intentionally parked `@141` run
  therefore made direct standalone `@175`–`@177` runs look release-owned.
- Repro: deploy a later isolated candidate without starting a new formal Release
  Readiness candidate while an older `IN_PROGRESS` run remains saved, then open
  the generic/standalone Populated Dashboard E2E and inspect the report.
- Expected result: the generic suite launcher and direct runner URL supply no
  owner, so the report saves `releaseEligible: false`, `candidate: null`, and no
  release run id even while an older run is active. Only the dedicated Release
  Readiness table may pass its exact current run id; the server validates that id
  before launch and revalidates it at completion.
- Runtime evidence: isolated `@178` standalone runs did not inherit the parked
  `@141` owner. The final full run
  `FR-c298ef4e-77a3-4e06-8917-3e76aba0c1df` passed all 12 browser assertions with
  `releaseEligible: false`, `candidate: null`, an empty `releaseRunId`, zero
  captured errors, Restricted owner-only sharing, and verified Trash cleanup.
  Two preceding attempts also failed closed and cleaned up correctly, although
  one timed out in the journey and one encountered an Apps Script HTTP 0
  connection failure.
- Exact-owner runtime evidence: Release Readiness run
  `RR-0e6941fb-6548-4c45-b5c3-6304ad0af686` owned candidate
  `Central Apps Script version 181 · isolated @181`. Its dedicated launcher
  produced browser run `FR-13656973-a9c6-49ed-a54a-d6731daf01b6`, which passed
  all 12 assertions with `releaseEligible: true`, the exact owning run id and
  candidate, Restricted single-owner sharing, zero errors, and verified Trash
  cleanup.

### REG-016 — Income and Setup classified the same salary differently
- Category: REGRESSION / UI
- Date discovered: 2026-07-23
- Status: shared-classifier fix + required browser-harness assertion; isolated
  `@178` interactive replay PASS
- Affected files: Income classification/read models and Setup income status/detail
- Root cause: Setup classified a non-excluded source with one positive month as
  recurring, while Income required three positive months and placed the same
  source under Other detected.
- Repro: on a populated disposable fixture, add or seed one active non-excluded
  salary source with a positive value in one month, then compare Income with
  Setup / Review.
- Expected result: both surfaces use the same shared classifier; the salary
  appears as one tracked recurring source on both, while excluded categories
  and negative/non-positive groups remain Other detected.
- Runtime evidence: isolated `@178` run
  `FR-c298ef4e-77a3-4e06-8917-3e76aba0c1df` passed
  `income_setup_consistency`; Income and Setup classified the one-month synthetic
  salary as the same tracked recurring source.

### REG-017 — Overlapping Debt loads cleared the selected account
- Category: REGRESSION / UI RELIABILITY
- Date discovered: 2026-07-23
- Status: fixed; dynamic reversed-completion regression + isolated `@179`
  interactive replay PASS
- Affected files: Debt account section loading and the Populated Dashboard browser
  selection journey
- Root cause: opening the Debt tab started `loadDebtSection()`, then the guarded
  browser journey immediately started `loadDebtSectionThenSelect_()`. Both called
  `getDebtsUiData()` and both success handlers mutated the same selector. When the
  ordinary tab request returned last, `filterDebtAccounts()` reset the selected
  account and started an empty detail load, invalidating the selected account's
  in-flight detail request.
- Repro: start the ordinary Debt tab load, immediately request load-and-select for
  a known account, then complete the load-and-select section request first and the
  ordinary section request last.
- Expected result: only the newest Debt section request may update the selector,
  fields, or status. A stale success or failure response is ignored, the requested
  account remains selected, its details finish loading, and guarded actions become
  available.
- Runtime evidence: isolated `@179` run
  `FR-3f6f2cf7-f823-4b74-a033-5e964f66b05e` passed all 12 browser assertions,
  including `debt_selection_actions`, with zero captured errors, Restricted
  owner-only sharing, and verified Trash cleanup.

### REG-018 — Apps Script HTTP 0 exposed a raw failure with no bounded recovery
- Category: REGRESSION / UI RELIABILITY
- Date discovered: 2026-07-23
- Status: fixed; deterministic injected regression + isolated `@181`
  integration replay PASS
- Affected files: shared dashboard RPC/error helpers and the read-only loaders
  exercised by the populated dashboard journey
- Root cause: dashboard reads called `google.script.run` directly. A transient
  browser-to-Apps-Script connection failure therefore terminated the read on its
  first `HTTP 0` response, and the generic error boundary allowed the raw
  `NetworkError: Connection failure due to HTTP 0` text to reach the visible UI.
  Automatically applying the same retry to writers would be unsafe because an
  `HTTP 0` response does not prove that the server failed before committing.
- Repro: inject `NetworkError: Connection failure due to HTTP 0` into the first
  attempt of a dashboard read, then allow the second attempt to succeed. Separately
  inject the same response into a writer failure boundary.
- Expected result: an explicitly read-only call retries once after a calm
  “connection interrupted” transition and then either succeeds or shows
  customer-safe guidance. Business-validation failures are never retried. Writers
  are never wrapped by the retry helper; their uncertain outcome is stated calmly
  and the user is asked to verify current state before trying again.
- Permanent coverage: `npm run test:dashboard-ux` dynamically proves exactly two
  attempts for the transient read, one attempt for a business error, safe customer
  wording, and the no-auto-retry contract for representative writers.
- Runtime evidence: the isolated `@181` exact-owner Populated Dashboard run
  `FR-13656973-a9c6-49ed-a54a-d6731daf01b6` passed all 12 normal-path assertions
  with no raw transport errors or captured browser errors. A forced live
  `HTTP 0` remains unclaimed because the browser harness has no supported
  transport-failure injection seam; the injected dynamic regression is the
  deterministic recovery proof.

### REG-019 — Refresh status did not ingest completed browser evidence
- Category: REGRESSION / TEST EVIDENCE
- Date discovered: 2026-07-24
- Status: fixed; dynamic regression + isolated `@182` runtime replay PASS
- Affected files: Release Readiness status refresh and exact-candidate browser
  evidence reconciliation
- Root cause: `releaseReadinessGetStatus()` returned the compact state saved when
  the run began. Newly completed browser evidence was reloaded only by
  `releaseReadinessFinalize()`, even though the console instructs the administrator
  to return and use **Refresh status** after a browser suite. Finalizing would
  prematurely close a partially complete run as `NOT_READY`.
- Repro: start an exact candidate, complete a dedicated browser suite with the
  matching run id and candidate, then use **Refresh status** before finalization.
- Expected result: an `IN_PROGRESS` refresh re-runs the existing fail-closed
  evidence filter, persists only matching compact evidence, keeps the run open,
  and shows the suite as `PASS` with its verified cleanup result. Stale,
  standalone, mismatched-candidate, or mismatched-run evidence remains absent.
- Permanent coverage: `npm run test:p1-evidence` dynamically saves exact-owner
  Populated Dashboard evidence after run start, proves Refresh ingests and
  persists it, and proves the readiness run remains `IN_PROGRESS`.
- Runtime evidence: isolated validation `@182` loaded exact-owner run
  `RR-0e6941fb-6548-4c45-b5c3-6304ad0af686`, reconciled browser run
  `FR-13656973-a9c6-49ed-a54a-d6731daf01b6` as `PASS / Verified`, and preserved
  `IN_PROGRESS`, 15/15 server checks, Workbook Health `PASS`, and the other
  genuinely missing browser suites. A second explicit **Refresh status** retained
  the same result without creating or modifying a workbook.

### REG-020 — Unsupported Activity rows displayed misleading Remove controls
- Category: REGRESSION / UI TRUST
- Date discovered: 2026-07-26
- Status: fixed locally; dynamic UI/server regressions pass; isolated runtime
  replay pending
- Affected files: `Dashboard_Script_Activity.html`,
  `Dashboard_Styles.html`, `activity_log.js`,
  `scripts/checkDashboardUxRegressions.mjs`
- Root cause: the Activity table labeled its final column **Remove (Donation)**
  and rendered a disabled **Remove** button for every unsupported event. That
  presentation implied that Planner/email, import/diagnostic, Bill, and other
  audit rows had a removal operation even though the server correctly accepted
  only eligible Donation rows.
- Repro: render a mixed Activity result containing an eligible `donation` row
  and an unsupported `planner_email_sent` row, then attempt a forged
  `deleteActivityLogRow` request for the unsupported row.
- Expected result: the neutral column heading is **Action**; only the eligible
  Donation row exposes a specifically named **Remove donation** button;
  unsupported rows expose no action control; and the server rejects a forged
  non-Donation removal request.
- Permanent coverage: `npm run test:dashboard-ux` dynamically renders both row
  types, asserts the exact control contract, prevents the old heading from
  returning, and executes the server handler with a forged Planner/email row to
  prove the donation-only gate remains enforced.

### REG-021 — Overview displayed Strong health before prerequisites were trustworthy
- Category: REGRESSION / UI TRUST / FINANCIAL TRUTH
- Date discovered: 2026-07-26
- Status: fixed locally; pure/UI regressions pass; isolated runtime replay pending
- Affected files: `dashboard_data.js`, `onboarding.js`,
  `Dashboard_Script_FirstRunE2E.html`,
  `Dashboard_Script_PopulatedDashboardE2E.html`,
  `scripts/checkDashboardUxRegressions.mjs`
- Root cause: Financial Health scored the latest History metrics without
  consulting the five required Setup probes or verifying that both the planner
  run and planned month were current. Light penalties also allowed negative
  projected cash flow and zero usable cash to retain an 85 / Strong result.
- Repro: supply otherwise high-scoring History metrics while Setup is 1/5;
  repeat with a prior-month run; then use current metrics with negative projected
  cash flow and zero usable cash.
- Expected result: incomplete Setup shows **Setup incomplete** and no score; an
  old or invalid baseline shows **Needs refresh** and no score; contradictory
  cash conditions score at most 84 and never show **Strong**; a complete,
  current, healthy baseline can still show **Strong**.
- Permanent coverage: `npm run test:dashboard-ux` executes all four states
  against the production score functions. First-Run V5 and Populated V4 require
  exact browser evidence that an incomplete fixture cannot expose a score.

---

## RECOVERY scenarios (design — not historical bugs)

These are not past bugs but permanent damage/heal guards (RECOVERY pack):

- **REC-001 — Missing required sheet:** delete a required sheet → Validator reports
  `SHEET_MISSING` → re-run provisioning/self-heal → Validator PASS.
- **REC-002 — Missing rows:** remove seeded rows → workflow re-materializes them →
  Validator PASS.
- **REC-003 — Partial corruption:** corrupt a header row → Validator reports a
  schema finding → heal → Validator PASS.
- **REC-004 — Central resolution failure surfaced, not masked:** simulate an
  unresolvable user → assert a **clear error** is raised (never a silent
  wrong-workbook write).

---

## Index

| ID | Title | Category | Status |
|---|---|---|---|
| REG-001 | Donations Central null crash | REGRESSION | fixed |
| REG-002 | Bank import — active-spreadsheet null | REGRESSION | fixed |
| REG-003 | Rolling debt payoff — active-spreadsheet null | REGRESSION | fixed |
| REG-004 | Quick add payment — active-spreadsheet null | REGRESSION | fixed |
| REG-005 | Next actions — active-spreadsheet null | REGRESSION | fixed |
| REG-006 | Bootstrap registry straggler | REGRESSION | fixed |
| REG-007 | Bills Due performance (~51s) | STRESS | fixed |
| REG-008 | AutoPay concurrency race | REGRESSION | fixed |
| REG-009 | Central recovery silent duplicate workbook | REGRESSION / RECOVERY | covered; scenario 7/7 + suite 1/1 + HIGH-marker runtime reproduction PASS |
| REG-010 | Blank/fresh workspace lacked default subpanel | REGRESSION / UI | fixed; UI scenario pending |
| REG-011 | Setup leaked internal identifiers/raw errors | REGRESSION / UI | fixed; static guard; UI scenario pending |
| REG-012 | Empty editor actions were enabled | REGRESSION / UI | fixed; static guard; UI scenario pending |
| REG-013 | Planner rebuilt unused History charts | STRESS / performance | fixed; static guard; runtime scenario pending |
| REG-014 | Bank formatted balance replacement concatenated loaded value | REGRESSION / UI | fixed; static guard + isolated `@175` interactive writer replay PASS |
| REG-015 | Standalone browser evidence inherited stale candidate metadata | REGRESSION / TEST EVIDENCE | fixed; standalone `@178` + exact-owner `@181` runtime PASS |
| REG-016 | Income and Setup classified the same salary differently | REGRESSION / UI | fixed; isolated `@178` interactive replay PASS |
| REG-017 | Overlapping Debt loads cleared the selected account | REGRESSION / UI RELIABILITY | fixed; dynamic reversed-completion regression + isolated `@179` replay PASS |
| REG-018 | Apps Script HTTP 0 exposed a raw failure with no bounded recovery | REGRESSION / UI RELIABILITY | fixed; injected regression + isolated `@181` integration PASS |
| REG-019 | Refresh status did not ingest completed browser evidence | REGRESSION / TEST EVIDENCE | fixed; dynamic regression + isolated `@182` runtime PASS |
| REG-020 | Unsupported Activity rows displayed misleading Remove controls | REGRESSION / UI TRUST | fixed locally; dynamic UI/server regressions pass; runtime pending |
| REG-021 | Overview displayed Strong health before prerequisites were trustworthy | REGRESSION / UI TRUST / FINANCIAL TRUTH | fixed locally; pure/UI regressions pass; runtime pending |
| REC-001–004 | Recovery/heal guards | RECOVERY | design |
