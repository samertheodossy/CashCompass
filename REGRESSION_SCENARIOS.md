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
- Status: local fail-closed fix + regression guard; isolated runtime replay pending
- Affected files: populated-dashboard browser evidence and Release Readiness
  candidate-metadata handoff
- Root cause: the standalone Populated Dashboard runner saved a new PASS while
  `releaseCurrentCandidateMetadata_()` still held the previous formal candidate,
  so the `@175` run was labeled `Central Apps Script version 141` /
  `isolated @141`.
- Repro: deploy a later isolated candidate without starting a new formal Release
  Readiness candidate, then run the standalone Populated Dashboard E2E and inspect
  the saved report's `candidate`.
- Expected result: a browser suite either receives and verifies the exact active
  candidate from the owning Validation-console run or refuses to save
  release-eligible evidence; it must never silently inherit a stale candidate.

### REG-016 — Income and Setup classified the same salary differently
- Category: REGRESSION / UI
- Date discovered: 2026-07-23
- Status: local shared-classifier fix + required browser-harness assertion; isolated interactive replay pending
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
| REG-015 | Standalone browser evidence inherited stale candidate metadata | REGRESSION / TEST EVIDENCE | local fail-closed fix + regression guard; isolated runtime replay pending |
| REG-016 | Income and Setup classified the same salary differently | REGRESSION / UI | local shared-classifier fix + required browser assertion; isolated interactive replay pending |
| REC-001–004 | Recovery/heal guards | RECOVERY | design |
