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
- Status: fixed locally; isolated Central runtime confirmation pending
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
  `@298` and are enforced by the local/browser contracts.

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
| REC-001–004 | Recovery/heal guards | RECOVERY | design |
