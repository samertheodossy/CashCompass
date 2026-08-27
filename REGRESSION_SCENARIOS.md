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
- Status: fixed; isolated Central `@116` runtime PASS; obsolete rollback builders
  removed locally and Y:BB support-table cleanup added; updated disposable
  runtime scenario pending
- Affected files: planner History output and performance timing
- Root cause: every refresh rebuilt six embedded `OUT - History` charts that no
  product surface used, adding 11.507 seconds to the measured repeat run.
- Repro (future performance harness): run first/repeat planner refreshes on the
  representative disposable fixture through an explicit-spreadsheet seam.
- Expected result: History rows still append/deduplicate and feed comparisons,
  the sheet contains zero chart objects and no Y:BB chart-support tables, timing
  uses `cleanup_history_charts`, no production chart builder remains, and the
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
- Status: fixed; isolated `@197` and `@201` runtime replays passed
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

### REG-022 — Browser evidence required continuous watching and manual account switching
- Category: REGRESSION / TEST EVIDENCE / OPERATIONS
- Date discovered: 2026-07-27
- Status: fixed and isolated runtime replay passed
- Affected files: `webapp.js`, `FirstRunE2ETestingUI.html`,
  `PopulatedDashboardE2ETestingUI.html`, `RecoveryTestingUI.html`,
  `PerformanceSamplingUI.html`, `scripts/checkP1EvidenceRegressions.mjs`
- Root cause: every authenticated browser suite opened a manual control page.
  The operator had to switch to the disposable account, confirm, start or resume,
  watch for completion, return to the console, refresh evidence, repeat for the
  next suite, and manually restore the writer flag.
- Repro: repeatedly switch an administrator browser between the Validation
  console and the disposable Google account for First-Run and Populated runs.
- Expected result: an agent-controlled browser session stays authenticated only
  as the fixed non-admin disposable identity. Each guarded internal route
  self-starts when `unattended=1`, still accepts no email or workbook ID, and
  completes only after exact-fixture Trash verification. The administrator
  console remains the evidence inventory, not a cross-account popup controller.
- Runtime evidence: isolated `@201` direct unattended First-Run run
  `FR-844dbba4-d4d1-4a40-b760-96aab3275c8e` passed 11/11; Populated run
  `FR-b09df630-db92-4dc5-a65d-ad043a65fbed` passed 14/14. Both used new
  Restricted single-owner fixtures and verified Trash cleanup.
- Permanent coverage: `npm run test:p1-evidence` forbids caller-selected
  email/workbook targets, verifies all four self-start seams, and rejects the
  fragile Google AccountChooser popup pattern.

### REG-023 — Bank/Debt detail failures or stale responses could expose unsafe editor state
- Category: REGRESSION / UI RELIABILITY / WRITE SAFETY
- Date discovered: 2026-07-23
- Status: fixed; isolated `@203` Populated Dashboard V5 runtime replay passed
- Affected files: `Dashboard_Script_AssetsBankInvestments.html`,
  `Dashboard_Script_Planning.html`,
  `Dashboard_Script_PopulatedDashboardE2E.html`,
  `populated_dashboard_e2e.js`,
  `scripts/checkP1EvidenceRegressions.mjs`
- Risk: a failed or out-of-order account-details read must never leave Save
  enabled against missing or mismatched data, and an older response must never
  replace the newest selected-record state.
- Expected result: Save is disabled immediately while matching details load and
  stays disabled after failure; the bounded pure-read retry can recover; a late
  stale success or failure is ignored; only the newest successful response can
  make the selected record ready.
- Runtime evidence: isolated `@203` run
  `FR-33e93e20-8a46-41e6-8709-696782922076` passed 16/16 in 171.670 s.
  `bank_loading_resilience` and `debt_loading_resilience` both passed, no browser
  errors were captured, and the Restricted single-owner fixture received exact
  verified Trash cleanup.
- Permanent coverage: `npm run test:p1-evidence` requires the V5 evidence key,
  both assertion IDs, controlled failure/disabled-state/recovery steps, and
  newest-before-stale response ordering. The browser journey replays the checks
  against production editor code without performing a workbook write.

### REG-024 — Bill Skip could fail or reappear, and Stop tracking lacked one durable safety journey
- Category: REGRESSION / UI RELIABILITY / WRITE SAFETY
- Date discovered: 2026-07-27
- Status: fixed; isolated `@206` Populated Dashboard V6 runtime replay passed
- Affected files: `Dashboard_Script_BillsDue.html`, `dashboard_data.js`,
  `Dashboard_Help.html`, `Dashboard_Script_PopulatedDashboardE2E.html`,
  `populated_dashboard_e2e.js`, `scripts/checkDashboardUxRegressions.mjs`,
  `scripts/checkP1EvidenceRegressions.mjs`
- Root cause: Skip had no explicit consequence confirmation; a visible active
  bill without its best-effort Cash Flow row could not resolve a write target;
  monthly recurrence did not honor the durable `bill_skip` marker; and
  overlapping Bills loads had no newest-request gate, so a slower pre-Skip
  response could restore a cleared card. Stop tracking already had a stale-row
  server guard, but no browser journey proved rejection, recovery, soft
  deactivation, and preserved source/history evidence together.
- Expected result: Skip confirms that no payment is recorded and future
  occurrences remain; an absent Cash Flow row permits marker-only handling only
  for a verified active tracked bill; no Cash Flow row is fabricated and no
  populated value is overwritten; monthly and expanded recurrence honor the
  exact marker; stale Bills responses are ignored. Stop tracking rejects a
  tampered stale payee, then succeeds after restoring the valid identity while
  preserving the inactive row, due day, amount, frequency, notes, and immutable
  history with exactly one `bill_skip` and one `bill_deactivate` event.
- Runtime evidence: isolated `@206` run
  `FR-68e32831-070f-4a40-b023-64b7a67a7115` passed 17/17 in 176.243 s,
  including `bill_skip_stop_safety` and `clean_console_navigation`. Sharing was
  Restricted with one owner and exact-fixture Trash cleanup was verified.
- Permanent coverage: Dashboard UX assertions lock the confirmation/outcome
  language, action-store reset, newest-response gate, active-bill fallback gate,
  blank-only zero guard, marker metadata, and monthly marker suppression.
  Populated V6 requires the ordered Skip → stale Stop → valid Stop journey plus
  exact-fixture server inspection and invalidates older saved evidence.

### REG-025 — Compact Retirement sheets were read using stale legacy row numbers
- Category: REGRESSION / UI TRUST / FINANCIAL TRUTH / COMPATIBILITY
- Date discovered: 2026-07-27
- Status: fixed; isolated `@211` First-Run V6 and Populated V7 runtime replays passed
- Affected files: `retirement.js`, `Dashboard_Script_FirstRunE2E.html`,
  `Dashboard_Script_PopulatedDashboardE2E.html`, `first_run_e2e.js`,
  `populated_dashboard_e2e.js`, `test_harness_suites.js`,
  `scripts/checkDashboardUxRegressions.mjs`,
  `scripts/checkP1EvidenceRegressions.mjs`
- Root cause: the Retirement sheet removed the former in-sheet household-age
  block for newly provisioned workbooks, but scenario reads and writes still
  used fixed row numbers from the older layout. A correctly seeded compact
  workbook was therefore classified as missing assumptions even though the Base
  scenario values were present.
- Expected result: every scenario input row is resolved by its exact label.
  Compact new sheets and legacy sheets use the same read/write path. Missing DOB
  or assumptions show guidance with both result walls hidden; a valid DOB and
  computable Base scenario reveal meaningful scenario cards and analysis.
- Runtime evidence: isolated `@211` First-Run V6 run
  `FR-a3b654b7-8343-4776-9991-2e7118f6e6fb` passed 12/12, including
  `retirement_guidance_not_ready`. Populated V7 run
  `FR-0c1c2b85-0851-414d-b8ab-c4c91636b9d6` passed 18/18, including
  `retirement_ready_results`. Both recorded zero browser errors, Restricted
  single-owner sharing, and verified exact-fixture Trash cleanup.
- Permanent coverage: Dashboard UX rejects a hard-coded Retirement row map and
  requires label lookup; P1 evidence requires the V6/V7 evidence keys, explicit
  production Retirement loading, hidden guidance panels, and meaningful ready
  outputs. Older saved browser evidence cannot satisfy the new contract.

### REG-026 — Quick Add did not explain that repeated entries are cumulative
- Category: REGRESSION / UI TRUST / MONEY-ENTRY LANGUAGE
- Date discovered: 2026-07-26
- Status: fixed locally; isolated runtime confirmation pending
- Affected files: `Dashboard_Body.html`, `Dashboard_Help.html`,
  `scripts/checkDashboardUxRegressions.mjs`
- Root cause: Quick Add said an existing monthly entry “may be updated
  automatically,” which did not tell the user whether the entered amount would
  be added to or replace the existing monthly total.
- Expected result: the action surface and Help both state that Quick Add adds
  the entered amount to the payee’s selected-month total and does not replace an
  amount already recorded. Missing-row behavior remains conditional on the
  existing checkbox.
- Permanent coverage: `npm run test:dashboard-ux` locks the exact action/Help
  contract and cross-checks it against the production cumulative writer and
  `currentValue + addValue` helper.

### REG-027 — Upcoming Dismiss did not explain its no-payment/history consequences
- Category: REGRESSION / UI TRUST / LIFECYCLE LANGUAGE
- Date discovered: 2026-07-26
- Status: fixed locally; isolated runtime confirmation pending
- Affected files: `Dashboard_Body.html`,
  `Dashboard_Script_CashFlowUpcoming.html`, `Dashboard_Help.html`,
  `upcoming_expenses.js`, `scripts/checkDashboardUxRegressions.mjs`
- Root cause: **Dismiss** was described only as removing an item from active
  planning while preserving “history,” leaving unclear whether it recorded a
  payment, changed Cash Flow, or retained the underlying Upcoming row.
- Expected result: the action surface, action hint, success message, and Help
  state that Dismiss removes the item from active planning, records no payment,
  changes no Cash Flow value, and preserves the Upcoming row plus Activity
  history.
- Permanent coverage: `npm run test:dashboard-ux` locks the customer wording
  and verifies the bounded server function remains a status-only soft removal
  with an Activity lifecycle event and no Cash Flow writer.

### REG-028 — Newly added Upcoming rows did not inherit body-row formatting
- Category: REGRESSION / WORKBOOK PRESENTATION / APPEND SAFETY
- Date discovered: 2026-07-27
- Status: fixed locally; isolated disposable-workbook confirmation pending
- Affected files: `upcoming_expenses.js`, `bills.js`, `debts.js`,
  `donations.js`,
  `scripts/checkDashboardUxRegressions.mjs`
- Root cause: `addUpcomingExpense` appended values to an existing sheet but
  reasserted only the Due Date and Amount number formats. The canonical
  Operational-family body style runs only when the sheet is first created, so a
  later unused/default row could retain smaller text and different row geometry.
- Expected result: each new Upcoming row copies formatting and row height only
  from the nearest populated Upcoming sibling. A first data row receives the
  canonical body-row fallback. Values, formulas, headers, existing rows, and
  sheet-wide formatting remain untouched; date and currency formats are
  reasserted after the format copy.
- Permanent coverage: `npm run test:dashboard-ux` requires the bounded
  `PASTE_FORMAT`-only sibling inheritance, canonical first-row fallback,
  row-height inheritance, number-format reassertion, and absence of any
  sheet-wide styling or data writer inside the formatting helper. Runtime
  confirmation must use a harness-created disposable workbook. The same source
  regression also closes matching latent row-height/first-row gaps in Bills,
  Debts, and Donations; Bank Accounts, Investments, and Houses already had
  equivalent format-only inheritance.

### REG-029 — Activity events lacked durable operation identity and exact target state
- Category: REGRESSION / FINANCIAL SAFETY / AUDIT IDENTITY / CORRECTION FOUNDATION
- Date discovered: 2026-07-27
- Status: fixed; local regressions and isolated `@214` Populated V8 runtime
  replay passed 19/19 with verified cleanup
- Affected files: `activity_log.js`, `quick_add_payment.js`,
  `test_harness_scenarios_bills_pay.js`, `populated_dashboard_e2e.js`,
  `Dashboard_Script_PopulatedDashboardE2E.html`,
  `test_harness_suites.js`, `scripts/checkDashboardUxRegressions.mjs`,
  `scripts/checkP1EvidenceRegressions.mjs`
- Root cause: Activity rows were independent descriptive records. Quick Add
  created a browser receipt UUID and captured before/after values, but did not
  persist that identity or exact target state in Activity. Other Activity rows
  had neither a unique event identity nor a shared versioned envelope, so a
  future correction could not safely correlate effects or prove authorization
  and current state.
- Expected result: every newly appended Activity row has a unique `eventId`
  inside the existing Details JSON and a server-generated `operationId`.
  Direct Quick Add creates its operation ID before the first write and persists
  versioned Cash Flow/Debt target descriptors with normalized before/after
  state plus opaque workbook/actor identity. Read-only preview succeeds only
  when all targets still match the logged post-state and fails closed for
  legacy, malformed, ambiguous, changed, cross-workbook, or cross-actor
  evidence. Existing columns and historical rows are untouched; legacy rows
  remain read-only.
- Permanent coverage: `npm run test:dashboard-ux` dynamically verifies shared
  operation IDs, unique event IDs, preserved legacy detail fields, complete
  target requirements, legacy read-only classification, exact-state preview,
  changed-state rejection, cross-workbook rejection, and creation of the
  Quick Add operation context before its money write. The guarded
  `E2E-BILLS-DUE-PAY` disposable-workbook scenario now verifies the persisted
  Quick Add envelope and a `READY` server preview. Populated Dashboard V8 run
  `FR-dbe0482c-0c10-47c7-8189-109be59be6a4` passed 19/19 on isolated Central
  `@214` in 239.225 s, with Restricted single-owner sharing, no browser errors,
  and verified exact-fixture Trash cleanup.

### REG-030 — Direct Quick Add entries could not be safely corrected from Activity
- Category: REGRESSION / FINANCIAL SAFETY / IMMUTABLE CORRECTION
- Date discovered: 2026-07-28
- Status: fixed; local regressions and isolated `@218` runtime validation pass
- Affected files: `activity_log.js`, `quick_add_payment.js`,
  `Dashboard_Body.html`, `Dashboard_Script_Activity.html`,
  `Dashboard_Styles.html`, Quick Add callers, Help, and Test Harness registry
- Root cause: Activity retained audit evidence but had no guarded writer that
  could reverse a direct Quick Add as one operation. A naive subtract/delete
  would risk overwriting newer Cash Flow values, leaving a credit-card balance
  inconsistent, deleting a row later edited by the user, or partially reversing
  a linked Bill/Upcoming/House workflow.
- Expected result: only explicitly identified new direct Quick Add operations
  expose **Correct entry**. Server preview and the locked writer require every
  Cash Flow/debt target to match its recorded post-state. Existing rows restore
  exact prior values; app-created rows are removed only when their complete
  value/formula fingerprint remains unchanged; credit-card balance and derived
  availability are restored together. The original Activity event remains and
  an immutable non-monetary correction event prevents a second reversal.
  Linked, legacy, unclassified, and changed operations remain read-only.
- Permanent coverage: `npm run test:dashboard-ux` locks the action/drawer,
  direct-origin gate, exact-before-state writer, and linked-path tagging. The
  registered `REGRESSION-DIRECT-QUICK-ADD-CORRECTION` scenario uses only its own
  guarded disposable workbook to prove existing-row plus credit-card reversal,
  created-row removal, immutable evidence, retry prevention, and changed-state
  refusal. Final Populated Dashboard run
  `FR-34e460e8-9421-47f8-a59f-9f3319070483` passed 19/19 on isolated Central
  `@218` in 187.193 s, including exact-state correction, retry refusal, and
  `REG-031` UI reconciliation, with zero browser errors, Restricted single-owner
  sharing, and verified Trash cleanup.

### REG-031 — Successful Quick Add reversal left a spinner and false write-conflict warning
- Category: REGRESSION / UI RELIABILITY / FINANCIAL TRUST
- Date discovered: 2026-07-28
- Status: fixed; isolated `@218` Populated Dashboard runtime pass
- Affected files: `Dashboard_Styles.html`,
  `Dashboard_Script_Activity.html`, `Dashboard_Script_Payments.html`,
  `Dashboard_Body.html`, and Populated Dashboard E2E
- Root cause: `.dash-loading` forced a display value without an explicit
  `[hidden]` override, so the correction preview spinner remained visible after
  success. The browser-session Quick Add verification receipt also remained
  active after an intentional exact-state reversal, causing the late-write
  monitor to misclassify the restored prior value as an external overwrite.
- Expected result: successful reversal hides the loading state, shows
  **Entry reversed**, retires that operation's browser receipt before Activity
  and dashboard refreshes, suppresses any already-rendered warning, and cannot
  be reintroduced by an in-flight verification response. Unrelated receipts
  continue to be monitored.
- Permanent coverage: the Dashboard UX suite locks the hidden-loader CSS,
  receipt retirement ordering, in-flight suppression, and warning dismissal.
  Populated Dashboard E2E exercises the same final browser state inside its
  guarded disposable-workbook journey. Run
  `FR-34e460e8-9421-47f8-a59f-9f3319070483` passed 19/19 in 187.193 s on
  isolated Central `@218`, including hidden completion loading, retired
  expected-reversal warning, zero browser errors, Restricted single-owner
  sharing, and verified Trash cleanup.

### REG-032 — Quick Add preview exposed an internal Cash Flow worksheet name
- Category: REGRESSION / CUSTOMER LANGUAGE / IMPLEMENTATION PRIVACY
- Date discovered: 2026-07-28
- Status: fixed; local suite and isolated `@221` guarded runtime pass
- Affected files: `quick_add_payment.js`, `dashboard_data.js`, and Dashboard UX
  regressions
- Root cause: prior-month preview failures were assembled in the server helper
  with physical worksheet/tab names and returned directly to the Quick Add
  information panel. Two Bills payload labels carried the same implementation
  terminology even though normal rendering did not currently surface both.
- Expected result: unavailable prior-month history is explained in customer
  terms for missing-year, missing-payee, and missing-month cases. No customer
  payload or visible message names an internal workbook tab.
- Permanent coverage: the Dashboard UX suite executes all three preview failure
  branches and rejects `INPUT`/`SYS`/`OUT`/`LOG`, sheet, tab, and column
  terminology in their returned customer messages.

### REG-033 — A late Quick Add verification warned against a newer valid Quick Add
- Category: REGRESSION / UI RELIABILITY / FINANCIAL TRUST
- Date discovered: 2026-07-28
- Status: fixed; local suite and isolated `@221` guarded runtime pass
- Affected files: `Dashboard_Script_Payments.html` and Dashboard UX regressions
- Root cause: an asynchronous verification of an earlier Quick Add could return
  after a second Quick Add had superseded the receipt for the same Cash Flow
  cell. The late callback saved its captured obsolete receipt back into browser
  storage and misclassified the correct cumulative total as an external edit.
- Expected result: verification responses reconcile only with receipts that
  are still current when the response returns. A superseded operation cannot
  reappear or create a warning; the newest receipt remains monitored normally.
- Permanent coverage: the Dashboard UX suite recreates an obsolete `$100`
  response arriving while a newer `$25` receipt is current, proves the newer
  receipt survives, and proves the old warning result is discarded.

### REG-034 — Correction success did not show the resulting financial values
- Category: REGRESSION / UI TRUST / CORRECTION FEEDBACK
- Date discovered: 2026-07-28
- Status: fixed; local suite and isolated `@221` guarded runtime pass
- Affected files: `Dashboard_Body.html`, `Dashboard_Script_Activity.html`,
  `Dashboard_Styles.html`, and Dashboard UX regressions
- Root cause: the correction result already returned its verified impacts, but
  the success panel rendered only a generic sentence. Users had to inspect the
  workbook to confirm the new Cash Flow or credit-card balance.
- Expected result: the open success panel shows the Cash Flow month, reversed
  entry amount, before-correction value, and current value for every verified
  impact, including a linked credit-card balance when present.
- Permanent coverage: the Dashboard UX suite renders a `$25` reversal from a
  `-$125` Cash Flow total and asserts the visible current total is `-$100`.
  The guarded direct-correction scenario continues verifying both Cash Flow
  and credit-card values server-side.

### REG-035 — Direct Quick Add correction rejected safe middle and earlier entries
- Category: REGRESSION / FINANCIAL SAFETY / SEQUENCE CORRECTION
- Date discovered: 2026-07-28
- Status: fixed; local chain regressions and isolated `@221` guarded runtime pass
- Affected files: `activity_log.js`, Quick Add correction harnesses, Populated
  Dashboard E2E, and Dashboard UX regressions
- Root cause: correction compared the selected operation's recorded post-state
  directly with the current cell. Any later valid Quick Add therefore looked
  like an external change, so only the newest entry could be reversed.
- Expected result: the server reconstructs the ordered operation ledger,
  verifies the complete current state, then replays every still-active
  operation except the selected one. Newest, middle, and earlier entries can be
  corrected while later verified entries remain intact. Corrections and Quick
  Adds created after a correction remain independently verifiable.
- Permanent coverage: pure Cash Flow and credit-card chain tests cover
  `$100 + $25 + $50`, middle and earlier correction, and a new `$10` entry after
  correction. The guarded Populated Dashboard journey performs the same
  newest/middle/earlier sequence against its marker-verified disposable
  workbook. Isolated run `FR-5490cb51-aea7-4538-b756-6fb866f60d1c` passed
  19/19 on `@221` in 218.515 s with zero browser errors and verified Trash
  cleanup.

### REG-036 — Eventual consistency briefly displayed a false yellow Quick Add warning
- Category: REGRESSION / UI RELIABILITY / FINANCIAL TRUST
- Date discovered: 2026-07-28
- Status: fixed; local receipt regressions and isolated `@221` guarded runtime pass
- Affected files: `Dashboard_Script_Payments.html` and Dashboard UX regressions
- Root cause: a single provisional verification mismatch could render the
  external-change warning while Sheets was still converging to the just-written
  value; a later read then removed it.
- Expected result: one mismatch schedules a short recheck. The warning appears
  only after the same mismatch is confirmed twice; a matching read resets the
  evidence. Genuine newer external values continue to fail closed.
- Permanent coverage: dynamic receipt tests prove provisional mismatch,
  confirmed mismatch, MATCH reset, and confirmed-only warning rendering.

### REG-037 — Quick Add completion waited on presentation-only history reads
- Category: REGRESSION / PERFORMANCE / DAILY TASK
- Date discovered: 2026-07-28
- Status: fixed; local performance/source regressions and isolated `@221` runtime pass
- Affected files: `quick_add_payment.js`,
  `Dashboard_Script_Payments.html`, and performance regressions
- Root cause: the money write waited synchronously for prior-month and chart
  history reads even though those values are explanatory UI data, not write
  preconditions.
- Expected result: the guarded money write, operation envelope, and exact
  target evidence remain synchronous. The user receives completion immediately
  after that authoritative result; history and prior-month presentation refresh
  quietly in the background.
- Permanent coverage: source regression prohibits the Quick Add writer from
  calling the two presentation-only preview helpers and preserves the existing
  operation-envelope assertions.

### REG-038 — Correction summary displayed raw parsed dates and the wrong calendar day
- Category: REGRESSION / CUSTOMER LANGUAGE / CORRECTION FEEDBACK
- Date discovered: 2026-07-28
- Status: fixed; local renderer regressions and isolated `@221` guarded runtime pass
- Affected files: `activity_log.js`, `Dashboard_Script_Activity.html`,
  `Dashboard_Styles.html`, and Dashboard UX regressions
- Root cause: summary labels were derived from auto-parsed Activity cell values,
  which exposed a JavaScript timezone string and could shift the displayed day.
- Expected result: entry date and Cash Flow month come from the immutable
  operation target locator, render as concise customer dates/months, and the
  completed correction uses the standard soft-blue confirmation treatment.
- Permanent coverage: source and renderer regressions require immutable
  locator date/month use, reject raw timezone output, and lock the soft-blue
  result panel.

### REG-039 — Middle-entry reversal left a later Quick Add receipt warning active
- Category: REGRESSION / UI RELIABILITY / SEQUENCE CORRECTION
- Date discovered: 2026-07-28
- Status: fixed; local receipt matrix and isolated `@223` guarded runtime pass
- Affected files: `Dashboard_Script_Payments.html`,
  `Dashboard_Script_Activity.html`, Populated Dashboard E2E, Quick Add harness,
  and Dashboard/P1 evidence regressions
- Root cause: successful correction retired only the selected operation's
  browser receipt. Because one browser receipt represents the newest expected
  value for a Cash Flow target, reversing an earlier or middle operation left
  that later receipt comparing its old total with the valid corrected total.
  Returning to Activity then displayed a false yellow external-change warning.
- Expected result: successful correction retires every browser-session receipt
  for the corrected Cash Flow target and suppresses their in-flight responses.
  Unrelated target receipts remain monitored, and the next Quick Add registers
  a fresh receipt from the corrected value.
- Permanent coverage: the dynamic browser-receipt test seeds a later same-target
  receipt plus an unrelated receipt, corrects the middle operation, and requires
  only the unrelated receipt to remain with the warning closed. The guarded
  Populated journey uses the real later-operation snapshot returned by its
  disposable sequence, corrects middle/earlier/post-correction entries, and
  requires same-target warning retirement. A second live rendered-app replay,
  `FR-9df0e56c-31af-4a88-a2cd-db17cbd2abc1`, passed 19/19 on isolated `@223`
  in 230.544 s. The browser walkthrough observed the real populated Overview,
  account, Bills, loading, refresh, and correction journey; the final Activity
  return exposed no yellow conflict notice, raw worksheet name, stuck progress,
  console warning, or browser error. Restricted single-owner sharing and exact
  fixture Trash cleanup also passed.

### REG-040 — Returning to Quick Add after a correction showed the old total
- Category: REGRESSION / UI RELIABILITY / SAME-PAGE STATE
- Date discovered: 2026-07-28
- Status: fixed in `433bfed`; user-verified on isolated Central `@299`
- Affected files: `Dashboard_Script_Payments.html`,
  `Dashboard_Script_Activity.html`, Populated Dashboard E2E, and Dashboard UX
  regressions
- Root cause: Activity correction refreshed Activity and the dashboard snapshot
  but did not invalidate Quick Add's separately loaded preview and history.
  Returning to the already-open Quick Add panel could therefore keep the
  selected payee while displaying its pre-correction monthly total and chart.
- Expected result: a successful correction quietly reloads the Quick Add payee
  inventory, selected month value, prior-month explanation, and recorded
  history without a page reload. The current type, payee, date, and amount
  inputs remain unchanged. Older preview responses are ignored so they cannot
  restore stale values after the correction refresh.
- Permanent coverage: the Dashboard UX suite executes the reconciliation
  helper with an in-flight form mutation and requires the captured type, payee,
  and date to be restored before a quiet preview refresh. Populated Dashboard
  E2E deliberately replaces the visible value/history with the stale
  pre-correction total, runs the real same-page refresh against its
  marker-verified disposable workbook, and requires the authoritative value,
  chart, and form selection without reloading the browser.

### REG-041 — Bill Skip used a browser-native confirmation instead of the CashCompass drawer pattern
- Category: REGRESSION / UX CONSISTENCY / WRITE SAFETY
- Date discovered: 2026-08-01
- Status: fixed locally; isolated Central runtime confirmation pending
- Affected files: `Dashboard_Body.html`, `Dashboard_Script_BillsDue.html`,
  Populated Dashboard E2E, and Dashboard UX regressions
- Root cause: the Skip action called `window.confirm`, leaving the browser to
  render a platform-specific embedded-page prompt with no CashCompass styling,
  focus lifecycle, inline failure state, or protected busy state.
- Expected result: Skip opens an accessible CashCompass drawer naming the bill,
  amount, and due date and explaining that no payment is recorded, the current
  occurrence leaves Bills, and future occurrences remain active. Cancel,
  Escape, and idle-backdrop close issue no RPC. Confirm issues exactly one RPC,
  disables dismissal while busy, keeps a failed request open and retryable, and
  closes plus refreshes Bills and dashboard summaries after success.
- Permanent coverage: Dashboard UX checks require the dialog semantics and
  consequence copy, prove the Skip route contains no native confirmation,
  exercise idle dismissal and busy protection, assert one server call per
  confirmation, and require retryable failure handling. Populated Dashboard E2E
  executes the real drawer path against its marker-verified disposable workbook.
  The user also confirmed the styled Skip drawer visually on isolated Central
  `@299` before this documentation checkpoint.

### REG-042 — A debt and tracked Bill with the same payee produced duplicate Bills Due cards
- Category: REGRESSION / READ MODEL / FINANCIAL CLARITY
- Date discovered: 2026-08-01
- Status: fixed in `433bfed`; user-verified on isolated Central `@299`
- Affected files: `dashboard_data.js` and Dashboard UX regressions
- Root cause: Bills Due concatenated active debt-derived payment rows with
  tracked-Bill occurrence rows without first establishing which source owned a
  normalized payee. A debt payment date and explicit Bill due date could
  therefore appear as separate cards for the same obligation.
- Expected result: an active explicit tracked Bill is authoritative for the
  normalized payee in Bills Due, even when its current occurrence is handled or
  outside the visible seven-day window. Only the matching debt-derived queue
  card is suppressed. Unrelated debts remain, inactive Bills do not suppress a
  debt, and the underlying debt remains unchanged and visible everywhere debts
  are normally shown. The tracked Bill's amount, date, cadence, and markers win.
- Permanent coverage: the pure authority-filter regression covers exact and
  normalized payee matches, unrelated debts, empty authority, inactive-source
  behavior through the active Bills map, and integration before queue merge.
  Isolated Central `@299` user verification confirmed one matching card in
  Bills while the debt account remained visible in Assets & Liabilities.

### REG-043 — Renaming a Bill left its linked Cash Flow payee behind
- Category: REGRESSION / FINANCIAL SAFETY / CROSS-SHEET ENTITY LINK
- Date discovered: 2026-08-03
- Status: fixed/pushed in `456c988` and user-validated in bounded mode;
  disposable runtime scenario implemented, not yet run
- Root cause: Bill Edit updated `INPUT - Bills.Payee` in isolation and left the
  Cash Flow row created by Add unchanged.
- Expected result: under a user lock, a rename requires exactly one current-year
  Expense row with the old exact Payee, rejects Bill and Cash Flow destination
  collisions, verifies both writes, appends one mandatory `bill_update` audit,
  and restores all accompanying Bill edits plus the linked Payee on failure.
  Historical Cash Flow years remain unchanged.
- Permanent coverage: `REGRESSION-BILLS-EDIT-INTEGRITY` exercises exact
  propagation, collision refusal, one audit entry, and forced audit-failure
  rollback on its own marker-verified disposable workbook.

### REG-044 — Bill Edit reported “Category is required” while categories loaded
- Category: REGRESSION / UI RELIABILITY / ASYNC FORM STATE
- Date discovered: 2026-08-03
- Status: fixed/pushed in `456c988`; local dynamic regression and bounded user
  validation passed
- Root cause: Add category loading and Edit prefill issued overlapping requests;
  a later response rebuilt the select and cleared the edited category.
- Expected result: Add and Edit share one in-flight request, queued Edit prefill
  runs after options install, and only the newest Edit target may apply. An
  omitted server category retains the lock-verified row value; a truly blank
  legacy category still fails closed.
- Permanent coverage: `scripts/checkMaintenanceRegressions.mjs` reproduces the
  response race dynamically; `REGRESSION-BILLS-EDIT-INTEGRITY` covers the server
  fallback.

### REG-045 — Recent Donations comments could not be corrected safely
- Category: REGRESSION / AUDITABILITY / STABLE-ROW EDIT
- Date discovered: 2026-08-03
- Status: fixed/pushed in `456c988` and user-validated in bounded mode;
  disposable runtime scenario implemented, not yet run
- Root cause: Recent Donations was read-only and had no narrow metadata writer
  with stable-row verification or immutable audit history. The first correction
  UI also crowded Edit comments into the Add donation side panel instead of a
  dedicated management surface.
- Expected result: Donation comments can be corrected only through a verified
  management writer. Under a user lock the server verifies row, tax year,
  charity, date, signed amount, prior comments, and payment type; flushes and
  verifies; appends immutable audit history; refuses stale state; and restores
  prior data on failure. The final Manage donations UI routes this through the
  broader full-donation editor described by REG-047.
- Permanent coverage: `REGRESSION-DONATION-COMMENTS-EDIT` covers success, stale
  refusal, audit count, and forced audit-failure rollback on a disposable
  workbook; the local maintenance check pins the UI/server contracts.

### REG-046 — AutoPay displayed a bare or non-red negative amount
- Category: REGRESSION / WORKBOOK PRESENTATION / FINANCIAL CLARITY
- Date discovered: 2026-08-03
- Status: fixed/pushed in `456c988` and user-validated in bounded mode;
  disposable runtime scenario implemented, not yet run
- Root cause: AutoPay preserved or copied a blank/sibling number format after
  writing, so General or legacy black-negative formatting could survive.
- Expected result: monthly and expanded-occurrence AutoPay both finish with
  `CASH_FLOW_MONEY_FORMAT_`, producing red negative currency such as `-$75.00`
  without restyling unrelated properties.
- Permanent coverage: `REGRESSION-BILLS-AUTOPAY-FORMAT` runs production monthly
  AutoPay at a fixed date and asserts `-75`, `-$75.00`, and the exact canonical
  format. The local maintenance check pins both AutoPay branches.

### REG-047 — Manage Donations could edit only comments
- Category: REGRESSION / AUDITABILITY / FULL-ROW EDIT
- Date discovered: 2026-08-03
- Status: fixed/pushed in `456c988` and user-validated in bounded mode;
  disposable runtime scenario implemented, not yet run
- Root cause: the first management surface exposed only the narrow comments
  writer even though the dedicated Manage donations view is the appropriate
  place to correct the entire saved donation.
- Expected result: Manage donations edits charity, date, amount, tax year,
  payment type, and comments under a user lock with exact-row verification,
  mandatory `donation_update` audit history, stale refusal, and rollback. A tax
  year change moves the verified data between existing year blocks without row
  deletion or structural shifting. Add donation retains the blue, read-only
  Previous donations panel and exposes no edit action.
- Permanent coverage: `REGRESSION-DONATION-FULL-EDIT` covers an in-place edit,
  tax-year move, immutable audit count, forced audit-failure rollback, and stale
  refusal on a marked disposable workbook; the focused maintenance check pins
  the Add/Manage separation and all submitted fields.

### REG-048 — Weekly AutoPay ignored Weekday and posted Due Day 1
- Category: REGRESSION / FINANCIAL INTEGRITY / DEPLOYMENT COMPATIBILITY
- Date discovered: 2026-08-03
- Status: fixed in `faae64a`, pushed and user-validated in bounded mode;
  disposable runtime scenarios implemented, not yet run
- Root cause: an older still-active bounded deployment (`@495`) predates
  Weekday-aware recurrence and calls the Weekly engine with Due Day only. Bills
  configured with Due Day 1 therefore posted on August 1 even though their
  existing Weekday cells said Sunday or Monday. The writer also changed Cash
  Flow before confirming its immutable Activity marker.
- Expected result: current source keeps occurrence identity as stable calendar
  components; Weekly AutoPay requires a recognized Weekday and re-verifies that
  the candidate lands on it; Due-Day fallback may remain visible for manual
  reconciliation but can never AutoPay. Cash Flow amount/format and a newly
  verified `bill_autopay` marker succeed together or the exact prior cell is
  restored. Old version-pinned deployment URLs must not be used for validation.
- Permanent coverage: `REGRESSION-BILLS-WEEKDAY-AUTOPAY-GUARD` reproduces
  Due Day 1 with Sunday/Monday schedules and a missing-Weekday fail-closed row;
  `REGRESSION-BILLS-AUTOPAY-ROLLBACK` forces audit failure and verifies value,
  format, marker, and visible-occurrence recovery.

### REG-049 — Manage Donations rejected repair of a blank Payment type
- Category: REGRESSION / UI RELIABILITY / LEGACY DATA REPAIR / STABLE ROW
- Date discovered: 2026-08-03
- Status: fixed locally; focused source regression passed; disposable runtime
  scenario extended, not yet run
- Root cause: the editor correctly sent the legacy saved Payment type as the
  old snapshot and the entered value as `newPaymentType`, but the server treated
  a blank old `paymentType` as a missing request field. A legacy donation could
  therefore display an entered replacement such as `Cash` and still fail with
  `Missing required field: paymentType` before stable-row verification.
- Expected result: a blank old Payment type is accepted only as the expected
  snapshot. The locked writer still requires the sheet row to contain the same
  blank value, requires a nonblank replacement, verifies the write, and records
  immutable `donation_update` history with the existing rollback behavior.
- Permanent coverage: `scripts/checkMaintenanceRegressions.mjs` pins the client
  old/new payload contract and server preconditions. The existing marked-
  disposable `REGRESSION-DONATION-FULL-EDIT` scenario now repairs a blank legacy
  Payment type to `Cash` and includes that success in its audit-count assertion.

### REG-050 — Manage Donations displayed a raw edit amount
- Category: REGRESSION / UI CONSISTENCY / CURRENCY PRESENTATION
- Date discovered: 2026-08-03
- Status: fixed locally; focused source regression passed; runtime visual
  confirmation pending
- Root cause: the Manage Donations table formatted Amount as currency, but its
  dynamically rendered edit input copied the stored numeric value directly and
  did not attach the shared currency focus/blur behavior. Opening an `$800.00`
  donation therefore displayed `800` in the editor.
- Expected result: the edit input immediately displays canonical currency such
  as `$800.00`, exposes the plain numeric value while focused for easy editing,
  and restores canonical currency on blur. Submission continues through the
  existing numeric parser and does not change stored donation values.
- Permanent coverage: `scripts/checkMaintenanceRegressions.mjs` dynamically
  opens a stored `800` editor, verifies `$800.00`, focus to `800`, and blur back
  to `$800.00`, while also pinning the shared handler wiring.

### REG-051 — Bill Pay showed Done before its history chart finished
- Category: REGRESSION / UI RELIABILITY / ASYNC RECEIPT / CUSTOMER CONFIDENCE
- Date discovered: 2026-08-03
- Status: fixed locally; focused dynamic regression passed; runtime visual
  confirmation pending
- Root cause: after the authoritative payment write and occurrence-clear
  confirmation succeeded, the drawer launched its supplementary read-only
  payment-history request but immediately enabled and focused `Done`. The
  footer therefore presented a completed state while the chart was still
  loading.
- Expected result: the successful payment receipt remains authoritative while
  the chart area says `Loading payment history…` and the visible footer is a
  disabled `Finishing…`. A successful history response renders the chart before
  enabling `Done`. Failure or a fifteen-second last-resort timeout presents calm
  nonblocking guidance and enables `Done`. A valid late response may still
  replace that timeout guidance with the chart in the same open receipt, while
  a stale response from another drawer remains ignored. None of these
  supplementary paths retries or changes the completed payment.
- Permanent coverage: `scripts/checkDashboardUxRegressions.mjs` dynamically
  verifies loading, success, read failure, chart-render failure, bounded timeout,
  late chart recovery, and stale-drawer behavior, plus the accessible live
  status and reserved chart layout.

### REG-052 — Activity writes could not identify their Apps Script deployment
- Category: REGRESSION / AUDIT DIAGNOSTICS / DEPLOYMENT TRACEABILITY
- Date discovered: 2026-08-04
- Status: fixed locally; focused and full local regressions passed; runtime log
  confirmation pending
- Root cause: `LOG - Activity` preserved event, operation, actor, and workbook
  identity but not the Apps Script web-app deployment that served the writer.
  Diagnosing the invalid M1 `8/1` AutoPay therefore required pulling and
  comparing every active deployment version.
- Expected result: every newly appended Activity Details JSON receives a
  versioned `writerProvenance` object. It contains the exact deployment ID and
  `exec`/`dev` mode parsed from the Apps Script service URL when available;
  unavailable or unrecognized contexts remain explicit and never guess a
  deployment. Existing Details fields, Activity columns, historical rows, and
  the customer-facing CashCompass Activity display remain unchanged.
- Permanent coverage: `npm run test:dashboard-ux` dynamically verifies exact
  production deployment parsing, development-mode distinction, safe unavailable
  fallback, preservation of event-specific Details, and deliberate absence of
  writer provenance from the CashCompass Activity client.

### REG-053 — Property Performance controls crowded financial summaries
- Category: REGRESSION / UI HIERARCHY / RESPONSIVE LAYOUT / FINANCIAL CLARITY
- Date discovered: 2026-08-04
- Status: fixed locally; focused and full local regressions passed; runtime
  visual confirmation pending
- Root cause: the Year selector and Refresh action consumed half of the desktop
  content width while five portfolio KPIs were confined to the other half. KPI
  labels wrapped heavily, values were visually compressed, and the final Net
  cash flow outcome lacked sufficient hierarchy.
- Expected result: wide layouts reserve one quarter of the row for compact
  inline Year/Refresh controls and three quarters for five equal KPI cards.
  Financial values use larger tabular figures, shorter labels, and an emphasized
  Net cash flow card whose treatment follows its sign. Intermediate layouts
  stack the controls above a three-column KPI grid with a wider Net result;
  tablet and phone layouts reflow to two and one columns. Property calculations,
  loading behavior, and the detail table remain unchanged.
- Permanent coverage: `npm run test:dashboard-ux` pins the 25/75 desktop grid,
  five-card summary row, sign-aware Net cash flow treatment, compact control
  structure, and responsive reflow rules.

### REG-054 — Planner maintained unused embedded Dashboard charts
- Category: STRESS / PERFORMANCE / GENERATED OUTPUT
- Date discovered: 2026-08-05
- Status: fixed; focused static/dynamic regression and isolated Central `@308`
  disposable runtime scenario passed
- Root cause: Refresh Financial Plan still maintained six embedded charts and
  duplicate O:Z chart-support tables on `OUT - Dashboard`, even though the
  CashCompass web display does not consume that sheet or those chart objects.
  The measured Dashboard-chart stage previously cost 4.848 seconds on the
  optimized repeat run and 9.425 seconds on the original repeat baseline.
- Expected result: each planner refresh preserves the tabular Dashboard output
  and `OUT - History`, removes only the six known planner-owned Dashboard chart
  titles, leaves unknown or unreadable customer charts untouched, keeps O:Z
  support cells empty, and performs no Dashboard chart-data writes or builds.
  The repository contains no active or rollback-only embedded-chart builder.
- Permanent coverage: `npm run test:performance-timing` rejects the former
  writer/build path and dynamically verifies exact-title cleanup with unknown
  chart preservation. `PERFORMANCE-PLANNER-FIRST-REPEAT` requires zero generated
  charts on both OUT sheets and blank Dashboard chart-support columns on its
  marker-verified disposable fixture.

### REG-055 — Stale sheet retry could escape an explicit disposable workbook
- Category: REGRESSION / TEST SAFETY / WORKBOOK ROUTING
- Date discovered: 2026-08-05
- Status: fixed; focused/full local regressions and isolated Central `@308`
  exact-workbook disposable scenario passed
- Root cause: when a requested sheet was initially absent, `getSheet_()` retried
  through `getUserSpreadsheet_()`. An explicit harness spreadsheet could
  therefore be replaced by the disposable test user's mapped workbook instead
  of reopening the caller-selected workbook.
- Expected result: stale-handle recovery reopens only `ss.getId()` and can never
  resolve a different mapped, active, configured-default, bounded, or canonical
  workbook. Planner outputs and assertions remain on the marker-verified
  disposable workbook, which is Restricted and verified in Trash after the run.
- Permanent coverage: `npm run test:performance-timing` requires exact-ID reopen
  and rejects mapped-user retry. The isolated first/repeat scenario confirms the
  OUT sheets exist on the disposable target and all routing-sensitive assertions
  pass before verified cleanup.

### REG-056 — Generated Dashboard formatting repeatedly re-read its own output
- Category: STRESS / PERFORMANCE / GENERATED OUTPUT
- Date discovered: 2026-08-05
- Status: fixed; focused dynamic and full local regressions passed; isolated
  Central `@310` production-path timing and formatting read-back PASS
- Root cause: after writing the complete normalized Dashboard row matrix,
  `formatRecommendationsSheet_()` read individual cells throughout two row
  loops, scanned the full sheet again for the stability label, and re-read the
  entire sheet once for each of eight formatted sections. It also set equal
  column widths individually.
- Expected result: formatting targets are derived once from the existing row
  matrix; the formatting path performs no cell or full-sheet reads, batches
  repeated range styles and equal-width columns, and preserves the exact
  generated values, section/header styling, number formats, stability colors,
  widths, wrapping, merged title, and Central/bounded output contract.
- Permanent coverage: `npm run test:performance-timing` dynamically verifies
  representative section, header, currency, integer, decimal, percent, and
  stability targets; source guards reject post-write `getValue()`,
  `getDataRange()`, and restoration of `formatSectionTable_()`. The guarded
  disposable scenario additionally reads back the merged title, colors,
  currency format, stability style, and all A:K widths. On isolated `@310`, all
  14 assertions passed; `format_dashboard` measured 0.428 s first / 0.378 s
  repeat, Restricted sharing passed, and Trash cleanup was verified.

### REG-057 — Overview snapshot calculated every retirement scenario and repeated supporting reads
- Category: STRESS / PERFORMANCE / DASHBOARD SNAPSHOT
- Date discovered: 2026-08-05
- Status: fixed in the current uncommitted candidate; focused/full local
  regressions and isolated Central `@317` disposable runtime PASS
- Root cause: Overview built all three retirement analyses even though it
  displayed only the selected scenario. Snapshot helpers also re-read History,
  prior-month ledgers, Settings, and the Cash Flow grid within one response.
- Expected result: Overview calculates only the selected retirement scenario;
  the Retirement workspace retains its full three-scenario on-demand reader.
  Snapshot History and ledger reads are shared or batched, Setup readiness uses
  the explicit workbook, and Income validates/classifies one already-read Cash
  Flow grid. Totals, readiness, freshness, and the selected scenario remain
  unchanged.
- Permanent coverage: `npm run test:performance-timing` rejects restored
  per-row prior-month reads, duplicate Overview scenario calculation, loss of
  explicit-workbook routing, duplicate Income-grid classification reads, and
  loss of privacy-safe snapshot stage timings. The guarded runtime scenario
  asserts current totals and the selected retirement payload. Planner hands its
  fresh canonical position to the same-call snapshot without a global cache;
  canonical-ready domains skip unused legacy fallbacks. Isolated `@317` passed
  all functional assertions, Restricted sharing, and verified Trash cleanup;
  current-position construction fell from 5.508 s on `@316` to 0.128 s and the
  total snapshot fell from 13.026 s to 4.867 s. The single sample does not
  ratify p50/p95.

### REG-058 — Populated initial page load had no retrievable stage breakdown
- Category: PERFORMANCE / OBSERVABILITY / PRIVACY
- Date discovered: 2026-08-05
- Status: fixed in the current uncommitted candidate; focused local regression
  PASS; populated runtime evidence pending
- Root cause: server planner/snapshot traces described explicit refresh work,
  but the normal page eagerly issued many independent read RPCs and exposed no
  correlated breakdown for a fully populated workbook. Manual stopwatch timing
  could measure only the full page and could not identify the slow section.
- Expected result: `?debug=1` starts one initial-load trace before the routing
  RPC, measures routing and every initial read through its renderer, and emits one aggregate
  `[PERF-CLIENT]` server log record after all stages settle or after 45 seconds.
  Ordinary URLs remain uninstrumented. The log contains only fixed stage names,
  durations, outcomes, a random run ID, and a server timestamp; it never logs
  workbook/user identity, financial values, sheet content, or error messages.
  The sanitized report remains in the caller's user cache for at most six hours
  so an admin can retrieve it read-only when `clasp logs` is unavailable.
- Operator workflow: the Validation page also exposes a one-click Dashboard Read
  Profile for its selected target. This is the primary repeatable scale diagnostic
  and may read an explicitly selected bounded workbook. It uses only raw sheet/range
  getters in two passes, returns fixed stage labels plus aggregate size/timing, and
  never returns cell values or workbook-derived sheet names. Missing areas are
  reported, not repaired. It deliberately avoids production dashboard getters
  because some include self-heal writes.
- Permanent coverage: `npm run test:performance-timing` dynamically proves one
  complete load emits exactly one aggregate report and that the server rebuilds
  the log envelope from its allow-list. Static checks require pre-RPC debug
  initialization, the two visible startup stages, and preserved instrumentation
  for deferred loaders. Extra/private metadata is discarded, malformed or
  unknown stages are rejected without logging, and
  temporary retrieval remains per-user and admin-gated. `npm run test:p1-evidence`
  dynamically profiles a synthetic explicit bounded target, proves both passes and
  the admin/selected-ID boundary, rejects writer/persistence calls statically, and
  proves private cell values and workbook-derived sheet names do not escape.

---

### REG-059 — Overview startup eagerly loaded every hidden workspace
- Category: PERFORMANCE / DASHBOARD STARTUP / LAZY LOADING
- Date discovered: 2026-08-05
- Status: fixed in the current uncommitted candidate; focused/full local
  regressions PASS; populated bounded remeasurement pending
- Root cause: `initDashboard()` launched Overview plus Houses, Property
  Expenses, Bank, Investments, Debts, Quick Add, Upcoming, Retirement,
  Purchase Simulator, Bills, and Income at the same time. Those hidden RPCs
  competed with the canonical Overview snapshot and delayed the first useful
  screen on populated workbooks.
- Expected result: startup requests only routing and the authoritative Overview
  snapshot. Every hidden workspace hydrates on its first tab entry and refreshes
  through its existing navigation behavior. No automatic background sweep runs
  while the user is viewing Overview.
- Financial truth guard: Overview continues to use the canonical active-only
  snapshot. It must not substitute visible sheet footer rows such as `Total
  Accounts`, `Account Totals`, or `TOTAL DEBT`, because those rows are gross
  sums by design and can include inactive or stop-tracked records.
- Permanent coverage: `npm run test:dashboard-ux` proves the startup function
  contains no hidden loaders and every deferred tab retains its loader;
  `npm run test:performance-timing` proves the initial browser trace consists
  only of `startup_routing` and `snapshot` while the server preserves its fixed
  privacy allow-list for diagnostic compatibility.

---

### REG-060 — Heavy Overview details blocked the top financial cards
- Category: PERFORMANCE / PROGRESSIVE RENDERING / FINANCIAL TRUTH
- Date discovered: 2026-08-05
- Status: fixed in the current uncommitted candidate; focused/full local
  regressions PASS; bounded visual timing pending
- Root cause: even after hidden tabs became lazy, the initial Overview RPC did
  not return until History deltas, health, attribution, runway, retirement,
  readiness, income, issues, and suggested actions were complete. Trigger
  registration and Activity-sheet first-create maintenance also remained ahead
  of the response.
- Expected result: startup first returns and paints the canonical Cash,
  Investments, Real Estate, Debt, and Net Worth cards. Only after a browser
  paint does it request the full Overview payload. Existing Activity and
  debounce-trigger maintenance runs after the full response. A later refresh
  invalidates older in-flight responses so stale background data cannot replace
  a newer save. The background request consumes a random single-use,
  workbook-bound, two-minute user-cache continuation containing aggregate
  current-position values only, so it does not repeat the canonical source and
  mirror reads completed for the fast cards.
- Financial truth guard: the fast response uses the same canonical active-only
  current-position builder as the full snapshot; it does not use gross footer
  totals or a stale persisted financial cache.
- Permanent coverage: `npm run test:dashboard-ux` requires progressive startup,
  a double animation-frame paint yield, stale-request identity, and post-render
  maintenance ordering. `npm run test:performance-timing` requires one shared
  canonical current-position builder and rejects maintenance from both Overview
  read endpoints. It also requires a user-scoped, single-use, workbook-bound
  continuation and rejects caching canonical account-level rows.

---

### REG-061 — Lazy workspace entry left the visible Quick Add panel unhydrated
- Category: REGRESSION / DASHBOARD NAVIGATION / LAZY LOADING
- Date discovered: 2026-08-05
- Status: fixed in the current uncommitted candidate; focused local regression
  PASS; runtime confirmation pending
- Root cause: the performance optimization correctly removed eager reads for
  hidden workspaces, but Quick Add was already marked active in the initial
  HTML. Opening Cash Flow preserved that visible panel and therefore skipped
  `showTab('payments')`, which is the lazy entry point that loads Expense and
  Income payees. The selector consequently contained only its blank and Other
  options even though the workbook data remained intact.
- Expected result: clicking Assets & Liabilities, Cash Flow, Properties, or
  Planning hydrates the panel already visible in that workspace. If no child
  panel is active, the existing remembered/default-tab path remains responsible
  for selecting and hydrating it, avoiding a duplicate workbook read.
- Safety guard: this changes browser navigation only. It does not write to a
  workbook, restore eager all-tab startup, change payee filtering, or alter
  Quick Add financial behavior.
- Permanent coverage: `npm run test:dashboard-ux` dynamically proves that Cash
  Flow entry hydrates a pre-active Quick Add panel and that a workspace with no
  active child does not receive a second hydration call.

---

### REG-062 — New Quick Add Expense rows could omit Flow Source
- Category: REGRESSION / FINANCIAL DATA INTEGRITY / QUICK ADD
- Date discovered: 2026-08-05
- Status: fixed in the current uncommitted candidate; focused/full local
  regressions PASS; bounded runtime confirmation pending
- Root cause: the Quick Add form exposed Type, Payee, Date, and Amount but no
  Payment Source. The writer allowed blank Flow Source for legacy compatibility
  and could only infer it when the new payee matched a Bill or Debt. A genuinely
  new direct Expense therefore created a Cash Flow row with blank source.
- Expected result: a genuinely new direct Expense asks for Cash or Credit card
  before saving. An existing Expense with a blank source asks once and repairs
  that cell; complete existing rows retain their stored source. Linked workflows
  use their authoritative source without asking again, and new Income rows use CASH.
- Safety guard: the server rejects a stale direct client before any row or money
  write when the new Expense source is missing. The disposable harness proves
  the rejected attempt creates no row and verifies both Expense persistence and
  Income defaulting.
- Permanent coverage: `npm run test:dashboard-ux` covers both Quick Add UIs,
  the pure prompt decision, payload wiring, server prerequisite, and the
  marker-verified disposable harness assertions.

---

### REG-063 — Progressive Overview left lower cards blank during refresh
- Category: PERFORMANCE / PROGRESSIVE RENDERING / PERCEIVED LOAD
- Date discovered: 2026-08-05
- Status: fixed in the current uncommitted candidate; focused/full local
  regressions PASS; bounded runtime confirmation pending
- Root cause: top totals were split into a fast request, but every lower card
  still waited for one complete heavy snapshot. The second request could take
  longer than the former single request and presented blank placeholders until
  all detail reads finished.
- Expected result: after one completed Overview read, subsequent loads paint the
  last completed lower-card payload immediately, restore freshly read top totals,
  and refresh lower details in the background. Bills and Operations use focused
  Overview-only render paths so they populate without hydrating hidden workspaces.
- Safety guard: the cache is short-lived, user-scoped, and workbook-scoped. It
  never writes workbook data, never crosses users or workbooks, and never
  overrides the fresh top totals.
- Permanent coverage: `npm run test:dashboard-ux` proves cached details are
  applied before fresh top totals and that every completed background detail
  read refreshes the scoped cache. It also requires all three authoritative
  operational summary reads while prohibiting hidden-workspace renderers.

---

### REG-064 — Transient Apps Script storage failure aborted repeat Overview load
- Category: REGRESSION / UI RELIABILITY / DASHBOARD STARTUP
- Date discovered: 2026-08-05
- Status: fixed in the current uncommitted candidate; focused/full local
  regressions PASS; bounded recovery confirmation pending
- Root cause: the shared safe read-retry classifier covered browser transport
  failures such as HTTP 0, but not the narrow Apps Script
  `server error occurred while reading from storage` / `FAILED_PRECONDITION`
  response observed on an immediate repeat Overview load. The core request
  therefore failed before details and operational summaries could start.
- Expected result: the progressive Overview core read retries exactly once for
  that exact storage signature. A recovered attempt continues the existing
  core/details/operations sequence; a persistent failure stops after the second
  attempt and surfaces one customer-safe failure. Unrelated preconditions and
  business errors are never retried.
- Safety guard: recovery wraps only the progressive core endpoint. That endpoint
  does not write the workbook; its only side effects are best-effort,
  user-scoped, short-lived presentation caches. Writers, full refreshes, and
  post-render maintenance remain outside automatic retry.
- Permanent coverage: `npm run test:dashboard-ux` proves exact signature
  classification, recovery eligibility, rejection of unrelated preconditions,
  and the two-attempt ceiling. `npm run test:performance-timing` proves cache
  outages fall back without failing the authoritative Overview read.
- Runtime reproduction: the bounded Validation trace recorded a successful
  21.351-second first load, then an immediate repeat whose core snapshot failed
  at 6.561 seconds with the observed storage precondition response; the trace
  closed at the 45-second diagnostic timeout. Post-fix bounded recovery evidence
  is intentionally pending the user-owned push and deployment.

---

### REG-065 — Populated Manage views briefly claimed no tracked records
- Category: REGRESSION / UI TRUTH / ASYNC LOADING
- Date discovered: 2026-08-06
- Status: fixed; focused/full regressions pass; isolated Central `@326`
  Populated run `FR-91155508-65ef-436c-9e3a-fb46fe4177ad` passed 24/24 with
  Restricted sharing and verified cleanup; user visual confirmation complete
- Root cause: Bank Accounts, Investments, and Houses built their shared Manage
  list from the hidden Update selector before the lazy read had completed. An
  unresolved selector has no real options, so the shared renderer treated it as
  an authoritative empty result and briefly displayed “No active ...” on a
  populated workbook.
- Expected result: unresolved Manage inventories show a contextual loader;
  successful zero-item responses alone may show the empty/Add-first state; and
  read failures show an unavailable state with Try again. A genuine new workbook
  still routes to Add new after its successful empty response.
- Safety guard: the change is presentation-only. It does not alter the read
  endpoints, tracked-item writers, stored values, empty-workbook routing, or
  destructive lifecycle controls.
- Permanent coverage: `npm run test:dashboard-ux` requires the shared renderer
  to resolve loading and failure before empty, binds each affected Manage list
  to its authoritative selector state, and requires failures to replace the
  loader rather than fall through to an empty claim.

### REG-066 — Retirement blocked selected results on all three scenario calculations
- Category: REGRESSION / PERFORMANCE / UI TRUTH / STALE RESPONSE SAFETY
- Date discovered: 2026-08-06
- Status: fixed and runtime-proven on isolated Central `@328`; Populated V11
  run `FR-72b047d7-4f26-469a-9287-2bfda293023e` passed 25/25 with Restricted
  sharing and verified cleanup; user visual confirmation complete
- Root cause: the Retirement UI used one RPC that repeatedly read individual
  scenario cells, recalculated all three Monte Carlo paths, and rewrote selected
  output cells before returning any meaningful content. The selected scenario
  therefore waited for work needed only by the two comparison cards.
- Expected result: one batched, read-only request renders the selected scenario
  first. A second read-only request calculates only the two alternatives and
  merges them after the first paint. A generation token plus the persisted
  selected-scenario check rejects responses that race a reload or Save.
- Safety guard: the legacy no-argument full reader remains available for stale
  clients; Retirement math, scenario inputs, workbook schema, and Save-time
  output persistence are unchanged. Comparison failures leave the selected
  result usable and never write the workbook.
- Permanent coverage: `npm run test:performance-timing` requires the selected
  first/read-only seam, batched comparison reader, and stale-response guard.
  Populated Dashboard V11 seeds three meaningful scenarios and records both
  selected meaningful-content time and all-comparison completion time in the
  privacy-safe Validation evidence panel.
- Runtime result: the initial `@327` split measured 8.626 s selected / 13.167 s
  all comparisons. Reusing Overview's authoritative selected payload at `@328`
  reduced those measurements to 1 ms / 5.648 s, both within the directional
  6 s / 15 s targets. The comparison request itself completed in 5.647 s.

### REG-067 — Customer-visible money used inconsistent signs, precision, and grouping
- Category: REGRESSION / UI CONSISTENCY / CURRENCY PRESENTATION / EVIDENCE SAFETY
- Date discovered: 2026-08-06
- Status: fixed and runtime-proven on isolated Central `@331`; Populated V12
  run `FR-f7719f23-9248-41fa-9f5c-7327db963ce3` passed 26/26 with Restricted
  single-owner sharing, zero browser errors, and verified cleanup
- Root cause: several client and server presentation paths bypassed the shared
  currency contract, used literal `$0` guidance, omitted grouping/decimals, or
  placed a negative sign after the dollar symbol. The first V12 probe also
  exposed a harness-only false positive when adjacent Bills table cells merged
  `$180.00` and due day `12` into the text token `$180.0012`.
- Expected result: every finite normal-path monetary display uses grouped
  `$x.xx`, with any sign before `$`; percentages, counts, ages, dates, and
  numeric-entry behavior retain their own semantics. Non-finite values never
  render as customer money.
- Safety guard: stored numeric values, workbook formulas, schemas, writers,
  business rules, and worksheet formatting are unchanged. The populated probe
  inspects individual text nodes so table-cell boundaries cannot manufacture a
  malformed amount.
- Permanent coverage: `npm run test:dashboard-ux` executes the canonical client
  and server formatters against zero, cents, grouped thousands, negatives, and
  non-finite input; `npm run test:p1-evidence` locks the text-node-safe V12
  browser contract. The guarded Populated journey checks Overview, Assets,
  Properties, Upcoming, Bills, and Income plus seeded representative amounts.
- Runtime result: isolated `@331` passed `money_format_consistency`, all other 25
  assertions, clean-console navigation, Restricted sharing, and exact verified
  Trash cleanup. Beta remained `@106`; the bounded deployment and workbook were
  untouched.

### REG-068 — Debt Edit split rename from the rest of one user change
- Category: REGRESSION / ENTITY LIFECYCLE / CROSS-SHEET CONSISTENCY / ROLLBACK
- Date discovered: 2026-08-07
- Status: fixed and runtime-proven on isolated Central `@334`
- Expected result: editing a Debt name and its other fields uses one **Save
  changes** action. Linked Cash Flow references, immutable Activity evidence,
  rollback, and locking remain internal implementation details.
- Permanent coverage: Dashboard UX, maintenance, and production-path audits
  protect the single-action UI and guarded coordinator.
- Runtime result: Populated run `FR-2abc5049-2b4a-4f3b-b938-10f78ddc9244`
  passed 26/26, including rename and restore, with Restricted sharing and
  verified Trash cleanup.

### REG-069 — Bank lifecycle split rename, details, and reactivation
- Category: REGRESSION / ENTITY LIFECYCLE / CROSS-SHEET CONSISTENCY / ROLLBACK
- Date discovered: 2026-08-07
- Status: fixed through isolated Central `@338`
- Expected result: Bank Manage provides one guarded Edit/Save path for name and
  details plus explicit Stop/Reactivate lifecycle actions, while dated balance
  Update remains separate.
- Permanent coverage: static and dynamic regressions protect duplicate/stale
  refusal, linked history updates, audit evidence, rollback, and presentation.
- Runtime result: run `FR-02e19b9d-9757-4847-afe0-55fd5a03be32` passed the exact
  rename/restore and Stop/Reactivate assertion before a later unrelated HTTP 0;
  the marker-verified fixture was explicitly trashed.

### REG-070 — App-written text and numeric columns could clip current values
- Category: REGRESSION / WORKBOOK PRESENTATION / APP-WRITE CONSISTENCY
- Date discovered: 2026-08-07
- Status: fixed and runtime-proven on isolated Central `@341`
- Root cause: entity writers either left existing column widths unchanged or
  applied a Bank-only name fit, so longer text and larger formatted money could
  remain clipped after otherwise successful app writes.
- Expected result: supported Debt, Bill, Bank, Investment, House, and Income
  add/edit/rename/value-save paths fit every authoritative or linked text and
  numeric column they actually change, add a 24 px rendering gutter, and cap
  width at 1000 px. A presentation failure never fails the entity write.
- Scope boundary: manual sheet edits and unrelated non-entity writers are not
  part of this app-triggered contract.
- Permanent coverage: Dashboard UX, maintenance, and P1 evidence checks protect
  the shared helper and each supported writer. `REGRESSION-BILLS-EDIT-INTEGRITY`
  forces narrow Payee and Default Amount columns, renames the Bill, writes a
  `$1,234,567,890,123.45` amount, and verifies linked text, formatted currency,
  and the exact gutter.
- Runtime result: disposable run `20260807-154251-d5e9` passed 14/14 in 24 s on
  isolated `@341`; disposition was `TRASHED`, and the runner returned OFF. Beta
  remained `@106`; bounded code and workbook were untouched.

### REG-071 — Investment history could masquerade as a current editable account

- Area: Investments / Entity lifecycle / Cross-sheet consistency / UI truth.
- Root cause: the Investment selector and Manage inventory began with every
  account name found in every historical `INPUT - Investments` year block, then
  removed only names explicitly marked inactive in `SYS - Assets`. An account
  present only in an older year, with no current-year row and no SYS mirror,
  therefore appeared active even though Edit and Stop had no stable row to use.
- Expected result: a current editable investment must have both a current-year
  tracking row and a matching active `SYS - Assets` row. Older-year-only names
  render under **Inactive investments** as historical records, without broken
  Edit/Stop/Reactivate controls. Explicitly inactive current accounts keep the
  guarded Reactivate action.
- Lifecycle result: Manage exposes one Edit/Save for Account name and Type.
  The coordinator updates every matching year block plus the stable SYS row
  under a user lock with duplicate, stale-row, and ambiguous-history guards;
  partial writes roll back. Stop/Reactivate uses the same stable identity and
  rollback discipline. Dated values, formulas, and immutable Activity history
  remain unchanged.
- Permanent coverage: Dashboard UX source contracts protect the one-save form,
  current-year/SYS active predicate, historical-only inactive explanation,
  stable lifecycle RPC payloads, lock/rollback behavior, Activity labels, and
  changed-column fitting. Populated Dashboard E2E performs rename, restore,
  Stop, and Reactivate on its own marker-verified fixture.
- Runtime status: full local regressions pass and the source is deployed only
  to isolated Central `@343`. Populated Dashboard run
  `FR-ec5cf708-d20a-4bd2-a539-2a3cc139aefc` passed 26/26, including exact
  Investment rename/restore plus Stop/Reactivate, with Restricted single-owner
  sharing, zero browser errors, verified Trash cleanup, and `active: null`.
  The user visually confirmed name propagation in `INPUT - Investments` and
  `SYS - Assets`. Beta remains `@106`; bounded is untouched by Codex.

### REG-072 — Manage Donations could not capture a check number

- Category: REGRESSION / UI CORRECTNESS / DONATION EDITING
- Date discovered: 2026-08-23
- Status: fixed locally; focused/full local regressions passed
- Root cause: Add donation treated Check as a structured choice and revealed a
  Check # field, but the Manage donations editor rendered Payment type as one
  plain text input. A customer changing an existing donation to Check therefore
  had no supported way to provide the number or produce the canonical
  `Check #number` value.
- Expected result: Manage donations uses the same controlled payment choices,
  reveals and requires Check # when Check is selected, preloads the number from
  an existing canonical Check value, and preserves uncommon legacy payment
  labels through Other. The existing locked full-row writer, stable snapshot,
  immutable audit, and rollback behavior remain unchanged.
- Permanent coverage: `scripts/checkMaintenanceRegressions.mjs` dynamically
  proves existing Check parsing, legacy Other preservation, missing-number
  refusal before the writer call, and canonical Check replacement submission.

### REG-073 — Chase statement facts could blur source and Planning semantics

- Category: REGRESSION / FINANCIAL FACTS / IDENTITY / REPLAY / PRIVACY
- Date added: 2026-08-23
- Status: Phase A implemented locally; focused/full local regressions passed
- Contract: `STATEMENT_BALANCE` is closed-cycle evidence, not current or
  optimization balance. Chase statement association requires explicit
  confirmation to an active verified revolving account, never last four alone.
  QFX/PDF replay uses protected semantic keys that exclude Observed At and raw
  file bytes. Chase component APRs can never manufacture canonical `APR`.
- Permanent coverage: Financial Facts proves typed/zero/currency behavior,
  semantic replay, corrected-cycle conflict, and no Planning requirement;
  Identity proves confirmation, active/type/status, ambiguity, and protected
  keys; Debt Import pins exact Chase profile metadata and rejects canonical APR;
  Data readiness proves statement balance is nonblocking in V1.

### REG-074 — A completed institution authorization could expire locally and consume a duplicate Trial Item

- Category: REGRESSION / PLAID LINK / DUPLICATE PREVENTION / TRIAL CAPACITY
- Date discovered: 2026-08-24
- Status: fixed and deployed; focused/full validation passed; the next BofA
  connection consumed exactly one Trial Item
- Root cause: CashCompass reduced every provider-returned Link expiration to 15
  minutes. A longer Chase OAuth flow could therefore finish within Plaid's valid
  initial-Link window but fail CashCompass correlation, inviting a second normal
  Link that represented the same institution/account.
- Expected result: New Link sessions honor the provider-returned expiration up
  to the documented four-hour maximum; Update Mode uses its separate 30-minute
  maximum. Missing, elapsed, or invalid provider expiration fails closed. An
  expired new-Link success callback becomes `COMPLETION_REVIEW_REQUIRED`, and a
  later normal Link is blocked until that unresolved completion is reviewed.
  An exchange still marked `EXCHANGING` also blocks a new Link across reloads
  or tabs. The browser prevents re-entrant Connect and keeps retry disabled
  after an ambiguous post-authorization exchange failure.
- Permanent coverage: Plaid backend tests prove a 31-minute OAuth completion is
  accepted, invalid expiration creates no session, expired CREATE completion is
  quarantined, unresolved exchange state blocks retry across reloads/tabs, and
  a second provider Link call is refused. Plaid import source regression pins
  the browser's in-flight and ambiguous-failure guards.

### REG-075 — Central and bounded could diverge into separate Plaid experiences

- Risk: an iframe, redirect, standalone Plaid page, bounded-only UI, or
  browser-trusted workbook/user identity could create two product designs,
  expose an OAuth error, or route connected evidence to the wrong authority.
- Required behavior: Bank Accounts, Debts, and Investments render the same
  native inline Connected client in Central and bounded. Runtime mode,
  authenticated user, environment, protected backend subject, and workbook are
  server-derived; bounded active and resolved workbook IDs must match.
  Browser-supplied authority fields fail closed. Unknown runtime modes fail
  closed. A Connected failure leaves the dashboard usable and shows exactly
  `Connected data is temporarily unavailable.` inside the affected panel.
- Safety boundary: no iframe, redirect, second tab, separate Plaid page,
  duplicated provider infrastructure, Apply control, canonical financial
  writer, workbook write, or new/reconnected Item is permitted by this
  regression.
- Permanent coverage: `checkPlaidImportRegressions.mjs`,
  `checkPlaidMainAppRegressions.mjs`, and `checkPlaidBridgeRegressions.mjs`
  pin the bounded scope, explicit modes, bounded workbook equality, browser
  authority rejection, shared native client, domain filtering, failure
  isolation, and no-Apply boundary.

### REG-076 — A future Plaid Apply could omit or leak audit evidence

- Risk: a later approved canonical mutation could be unauditable or could place
  provider secrets/raw identifiers in Activity Log.
- Required behavior: there is no Apply writer at this checkpoint. Any later
  separately approved successful mutation must log the sanitized canonical
  entity/field, prior/new values, timestamp, source `PLAID`, explicit user
  approval, observed time, and effective time when supplied. Refreshes,
  ignored/rejected candidates, failed previews, and comparison-only mappings
  are not financial updates.
- Prohibited evidence: credentials, access tokens, Item IDs, raw account IDs,
  raw payloads, and secrets never enter Activity Log.
- Permanent coverage: the Plaid import regression pins this documentation
  contract and continues to reject any current Apply or financial writer.

---

## 3a loading-state consistency coverage

- Contextual loading labels replace generic placeholders across Overview,
  Planning, tracked-entity pickers, onboarding, and Admin Diagnostics.
- Async pickers remain disabled while loading. Empty/failure completion is a
  terminal state, and dependent House, Investment, and House Expense actions
  cannot become writable without a valid selection.
- Overlapping Bank requests are generation-guarded so an older success or
  failure cannot overwrite the newest section state.
- Paired Overview placeholders expose only one live-region announcement for a
  single load, avoiding duplicate screen-reader noise.
- Permanent checks run in `npm run test:dashboard-ux --if-present` and
  `npm run test:p1-evidence`; the full `npm test` gate also covers performance,
  populated-harness safety, and production-path audit checks.
- Read-only isolated Central `@294` confirmed contextual House Expense,
  Next Actions, Debt Overview, and Rolling Payoff loaders; disabled picker and
  dependent-action behavior; settled empty pickers; rapid Bank/Debt navigation;
  a 390 px layout with no horizontal overflow; and zero browser warnings/errors.

---

## 3b empty/error-state consistency coverage

- Empty Bank, Investment, and Debt responses open their editors directly in
  **Add new**. Malformed responses leave the current editor mode intact
  and are not misclassified as authoritative empty results.
- Purchase results remain hidden before a successful simulation, during a run,
  and after a failed run; guidance remains visible until a result is ready.
- Shared unavailable/error states provide a manual retry. A successful retry
  removes the stale failure state rather than leaving contradictory UI behind.
- Empty Upcoming hides the contextual Dismiss explanation until at least one
  active expense exists. A truly empty Bills workspace opens **Add bill** only
  after an authoritative empty response; active or unavailable states do not.
- Permanent checks run in `npm run test:dashboard-ux --if-present` and
  `npm run test:p1-evidence`; the full `npm test` gate covers the remaining
  performance, populated-harness safety, and production-path audits.
- Guarded First-Run run `FR-e92641a0-2c59-45da-a90c-8b8780410f76` passed
  14/14 on isolated Central `@296`, including `empty_editors_open_add` and
  `purchase_guidance_before_results`, with Restricted sharing, zero browser
  errors, and verified exact-fixture Trash cleanup. The final contextual
  Upcoming/Bills checks were user-verified on a fresh workbook at isolated
  `@298` and are enforced by the local/browser contracts. The completed slice
  is committed and pushed as `3e2db4f` on `origin/main`.

Related completed UX slices are contextual loading-state consistency (`3a`) in
`be76bdb` through isolated Central `@294`, and Debt destination/routing
consistency (`3c`) in `7c0e2ac` through isolated Central `@293`.

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
| REG-013 | Planner rebuilt unused History charts | STRESS / performance | fixed; isolated `@116` PASS; rollback builders removed locally; updated runtime scenario pending |
| REG-014 | Bank formatted balance replacement concatenated loaded value | REGRESSION / UI | fixed; static guard + isolated `@175` interactive writer replay PASS |
| REG-015 | Standalone browser evidence inherited stale candidate metadata | REGRESSION / TEST EVIDENCE | fixed; standalone `@178` + exact-owner `@181` runtime PASS |
| REG-016 | Income and Setup classified the same salary differently | REGRESSION / UI | fixed; isolated `@178` interactive replay PASS |
| REG-017 | Overlapping Debt loads cleared the selected account | REGRESSION / UI RELIABILITY | fixed; dynamic reversed-completion regression + isolated `@179` replay PASS |
| REG-018 | Apps Script HTTP 0 exposed a raw failure with no bounded recovery | REGRESSION / UI RELIABILITY | fixed; injected regression + isolated `@181` integration PASS |
| REG-019 | Refresh status did not ingest completed browser evidence | REGRESSION / TEST EVIDENCE | fixed; dynamic regression + isolated `@182` runtime PASS |
| REG-020 | Unsupported Activity rows displayed misleading Remove controls | REGRESSION / UI TRUST | fixed; isolated `@196` runtime PASS |
| REG-021 | Overview displayed Strong health before prerequisites were trustworthy | REGRESSION / UI TRUST / FINANCIAL TRUTH | fixed; isolated `@197` First-Run V5 11/11 + Populated V4 14/14 PASS |
| REG-022 | Browser evidence required continuous watching and manual account switching | REGRESSION / TEST EVIDENCE / OPERATIONS | fixed; isolated First-Run 11/11 and Populated 14/14 PASS with verified cleanup |
| REG-023 | Bank/Debt detail failures or stale responses could expose unsafe editor state | REGRESSION / UI RELIABILITY / WRITE SAFETY | fixed; isolated `@203` Populated V5 16/16 PASS with verified cleanup |
| REG-024 | Bill Skip could fail or reappear, and Stop tracking lacked one durable safety journey | REGRESSION / UI RELIABILITY / WRITE SAFETY | fixed; isolated `@206` Populated V6 17/17 PASS with verified cleanup |
| REG-025 | Compact Retirement sheets were read using stale legacy row numbers | REGRESSION / UI TRUST / FINANCIAL TRUTH / COMPATIBILITY | fixed; isolated `@211` First-Run V6 12/12 + Populated V7 18/18 PASS |
| REG-026 | Quick Add did not explain that repeated entries are cumulative | REGRESSION / UI TRUST / MONEY-ENTRY LANGUAGE | fixed locally; isolated runtime confirmation pending |
| REG-027 | Upcoming Dismiss did not explain its no-payment/history consequences | REGRESSION / UI TRUST / LIFECYCLE LANGUAGE | fixed locally; isolated runtime confirmation pending |
| REG-028 | Newly added Upcoming rows did not inherit body-row formatting | REGRESSION / WORKBOOK PRESENTATION / APPEND SAFETY | fixed locally; isolated disposable-workbook confirmation pending |
| REG-029 | Activity events lacked durable operation identity and exact target state | REGRESSION / FINANCIAL SAFETY / AUDIT IDENTITY / CORRECTION FOUNDATION | fixed; isolated `@214` Populated V8 19/19 PASS with verified cleanup |
| REG-030 | Direct Quick Add entries could not be safely corrected from Activity | REGRESSION / FINANCIAL SAFETY / IMMUTABLE CORRECTION | fixed; isolated `@218` Populated Dashboard 19/19 PASS with verified cleanup |
| REG-031 | Successful Quick Add reversal left a spinner and false write-conflict warning | REGRESSION / UI RELIABILITY / FINANCIAL TRUST | fixed; isolated `@218` Populated Dashboard 19/19 PASS with verified cleanup |
| REG-032 | Quick Add preview exposed an internal Cash Flow worksheet name | REGRESSION / CUSTOMER LANGUAGE / IMPLEMENTATION PRIVACY | fixed; isolated `@221` guarded runtime pass |
| REG-033 | A late Quick Add verification warned against a newer valid Quick Add | REGRESSION / UI RELIABILITY / FINANCIAL TRUST | fixed; isolated `@221` guarded runtime pass |
| REG-034 | Correction success did not show the resulting financial values | REGRESSION / UI TRUST / CORRECTION FEEDBACK | fixed; isolated `@221` guarded runtime pass |
| REG-035 | Direct Quick Add correction rejected safe middle and earlier entries | REGRESSION / FINANCIAL SAFETY / SEQUENCE CORRECTION | fixed; isolated `@221` guarded runtime pass |
| REG-036 | Eventual consistency briefly displayed a false yellow Quick Add warning | REGRESSION / UI RELIABILITY / FINANCIAL TRUST | fixed; isolated `@221` guarded runtime pass |
| REG-037 | Quick Add completion waited on presentation-only history reads | REGRESSION / PERFORMANCE / DAILY TASK | fixed; isolated `@221` guarded runtime pass |
| REG-038 | Correction summary displayed raw parsed dates and the wrong calendar day | REGRESSION / CUSTOMER LANGUAGE / CORRECTION FEEDBACK | fixed; isolated `@221` guarded runtime pass |
| REG-039 | Middle-entry reversal left a later Quick Add receipt warning active | REGRESSION / UI RELIABILITY / SEQUENCE CORRECTION | fixed; isolated `@223` guarded runtime pass |
| REG-040 | Returning to Quick Add after a correction showed the old total | REGRESSION / UI RELIABILITY / SAME-PAGE STATE | fixed locally; isolated Central runtime confirmation pending |
| REG-041 | Bill Skip used a browser-native confirmation instead of the CashCompass drawer pattern | REGRESSION / UX CONSISTENCY / WRITE SAFETY | fixed in `433bfed`; isolated `@299` user-verified |
| REG-042 | A debt and tracked Bill with the same payee produced duplicate Bills Due cards | REGRESSION / READ MODEL / FINANCIAL CLARITY | fixed in `433bfed`; isolated `@299` user-verified |
| REG-043 | Renaming a Bill left its linked Cash Flow payee behind | REGRESSION / FINANCIAL SAFETY / CROSS-SHEET ENTITY LINK | fixed/pushed; bounded user validation passed; disposable runtime scenario pending |
| REG-044 | Bill Edit reported “Category is required” while categories loaded | REGRESSION / UI RELIABILITY / ASYNC FORM STATE | fixed/pushed; local dynamic and bounded user validation passed |
| REG-045 | Recent Donations comments could not be corrected safely | REGRESSION / AUDITABILITY / STABLE-ROW EDIT | fixed/pushed; bounded user validation passed; disposable runtime scenario pending |
| REG-046 | AutoPay displayed a bare or non-red negative amount | REGRESSION / WORKBOOK PRESENTATION / FINANCIAL CLARITY | fixed/pushed; bounded user validation passed; disposable runtime scenario pending |
| REG-047 | Manage Donations could edit only comments | REGRESSION / AUDITABILITY / FULL-ROW EDIT | fixed/pushed; bounded user validation passed; disposable runtime scenario pending |
| REG-048 | Weekly AutoPay ignored Weekday and posted Due Day 1 | REGRESSION / FINANCIAL INTEGRITY / DEPLOYMENT COMPATIBILITY | fixed/pushed; bounded user validation passed; disposable runtime scenarios pending |
| REG-049 | Manage Donations rejected repair of a blank Payment type | REGRESSION / UI RELIABILITY / LEGACY DATA REPAIR / STABLE ROW | fixed locally; focused source regression passed; extended disposable runtime scenario pending |
| REG-050 | Manage Donations displayed a raw edit amount | REGRESSION / UI CONSISTENCY / CURRENCY PRESENTATION | fixed locally; focused source regression passed; runtime visual confirmation pending |
| REG-051 | Bill Pay showed Done before its history chart finished | REGRESSION / UI RELIABILITY / ASYNC RECEIPT / CUSTOMER CONFIDENCE | fixed locally; focused dynamic regression passed; runtime visual confirmation pending |
| REG-052 | Activity writes could not identify their Apps Script deployment | REGRESSION / AUDIT DIAGNOSTICS / DEPLOYMENT TRACEABILITY | fixed locally; focused/full local regressions passed; runtime log confirmation pending |
| REG-053 | Property Performance controls crowded financial summaries | REGRESSION / UI HIERARCHY / RESPONSIVE LAYOUT / FINANCIAL CLARITY | fixed locally; focused/full local regressions passed; runtime visual confirmation pending |
| REG-054 | Planner maintained unused embedded Dashboard charts | STRESS / PERFORMANCE / GENERATED OUTPUT | fixed; focused static/dynamic regression + isolated `@308` disposable runtime PASS |
| REG-055 | Stale sheet retry could escape an explicit disposable workbook | REGRESSION / TEST SAFETY / WORKBOOK ROUTING | fixed; focused/full regressions + isolated `@308` exact-workbook disposable runtime PASS |
| REG-056 | Generated Dashboard formatting repeatedly re-read its own output | STRESS / PERFORMANCE / GENERATED OUTPUT | fixed; focused/full regressions + isolated `@310` formatting read-back and stage timing PASS |
| REG-057 | Overview snapshot calculated every retirement scenario and repeated supporting reads | STRESS / PERFORMANCE / DASHBOARD SNAPSHOT | fixed in current candidate; focused/full regressions + isolated `@317` disposable runtime PASS |
| REG-058 | Populated initial page load had no retrievable stage breakdown | PERFORMANCE / OBSERVABILITY / PRIVACY | fixed in current candidate; focused regression PASS; populated runtime evidence pending |
| REG-059 | Overview startup eagerly loaded every hidden workspace | PERFORMANCE / DASHBOARD STARTUP / LAZY LOADING | fixed in current candidate; focused/full local regressions PASS; bounded remeasurement pending |
| REG-060 | Heavy Overview details blocked the top financial cards | PERFORMANCE / PROGRESSIVE RENDERING / FINANCIAL TRUTH | fixed in current candidate; focused/full local regressions PASS; bounded visual timing pending |
| REG-061 | Lazy workspace entry left the visible Quick Add panel unhydrated | REGRESSION / DASHBOARD NAVIGATION / LAZY LOADING | fixed in current candidate; focused local regression PASS; runtime confirmation pending |
| REG-062 | New Quick Add Expense rows could omit Flow Source | REGRESSION / FINANCIAL DATA INTEGRITY / QUICK ADD | fixed in current candidate; focused/full local regressions PASS; bounded runtime confirmation pending |
| REG-063 | Progressive Overview left lower cards blank during refresh | PERFORMANCE / PROGRESSIVE RENDERING / PERCEIVED LOAD | fixed in current candidate; focused/full local regressions PASS; bounded runtime confirmation pending |
| REG-064 | Transient Apps Script storage failure aborted repeat Overview load | REGRESSION / UI RELIABILITY / DASHBOARD STARTUP | fixed in current candidate; focused/full local regressions PASS; bounded recovery confirmation pending |
| REG-065 | Populated Manage views briefly claimed no tracked records | REGRESSION / UI TRUTH / ASYNC LOADING | fixed; full regressions + isolated `@326` Populated 24/24 PASS + user visual confirmation |
| REG-066 | Retirement blocked selected results on all three scenario calculations | REGRESSION / PERFORMANCE / UI TRUTH / STALE RESPONSE SAFETY | fixed; full regressions + isolated `@328` Populated V11 25/25 PASS; selected/all comparisons 1 ms/5.648 s; user visual confirmation |
| REG-067 | Customer-visible money used inconsistent signs, precision, and grouping | REGRESSION / UI CONSISTENCY / CURRENCY PRESENTATION / EVIDENCE SAFETY | fixed; full regressions + isolated `@331` Populated V12 26/26 PASS; clean console, Restricted sharing, verified cleanup |
| REG-068 | Debt Edit required a separate Rename action and could leave linked references split | REGRESSION / ENTITY LIFECYCLE / CROSS-SHEET CONSISTENCY / ROLLBACK | fixed; full regressions + isolated `@334` Populated 26/26 PASS with one-save rename/restore and verified cleanup |
| REG-069 | Bank lifecycle split rename/details and lacked guarded Reactivate behavior | REGRESSION / ENTITY LIFECYCLE / CROSS-SHEET CONSISTENCY / ROLLBACK | fixed; focused/full regressions + isolated `@335` exact lifecycle assertion PASS; marker-verified cleanup after unrelated HTTP 0 |
| REG-070 | App-written text and formatted numeric values could remain clipped after entity changes | REGRESSION / WORKBOOK PRESENTATION / APP-WRITE CONSISTENCY | fixed; focused/full regressions + isolated `@341` Bills integrity 14/14 PASS in 24 s; linked text, large currency, exact 24 px gutter, TRASHED disposition, runner OFF |
| REG-071 | Historical-only Investment names appeared as current editable accounts | REGRESSION / ENTITY LIFECYCLE / CROSS-SHEET CONSISTENCY / UI TRUTH | fixed; full regressions + isolated `@343` Populated 26/26 PASS with exact Investment lifecycle assertion, Restricted sharing, zero browser errors, verified Trash, and `active: null` |
| REG-072 | Manage Donations could not capture a check number | REGRESSION / UI CORRECTNESS / DONATION EDITING | fixed locally; focused/full local regressions passed |
| REG-073 | Chase statement facts could blur source and Planning semantics | REGRESSION / FINANCIAL FACTS / IDENTITY / REPLAY / PRIVACY | Phase A implemented locally; focused/full local regressions passed |
| REG-074 | Completed institution authorization expired locally and allowed duplicate Trial consumption | REGRESSION / PLAID LINK / DUPLICATE PREVENTION / TRIAL CAPACITY | fixed and deployed; focused/full validation passed; next BofA connection consumed exactly one Trial Item |
| REG-075 | Central and bounded could diverge into separate Plaid experiences | REGRESSION / PLAID UX / AUTHORITY / FAILURE ISOLATION | fixed locally; focused/full local validation passed; bounded owner push/authorization pending |
| REG-076 | A future Plaid Apply could omit or leak audit evidence | REGRESSION / PLAID APPLY / ACTIVITY LOG / SENSITIVE DATA | contract pinned locally; no Apply writer exists; future implementation remains separately approval-gated |
| REC-001–004 | Recovery/heal guards | RECOVERY | design |
