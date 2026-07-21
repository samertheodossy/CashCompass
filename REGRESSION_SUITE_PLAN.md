# Regression / End-to-End Test Suite — Plan

*The forward-looking roadmap for expanding the Test Harness from one smoke scenario
into a full beta-readiness regression suite that exercises CashCompass end to end.*

**Status:** **Plan / design; first scenarios shipping incrementally.** Test Harness
**Foundation V1** is working (`test_harness_*.js` + the Validation & Testing
console). Implemented scenarios: `SMOKE-PROVISION-DONATION` and, as the first real
regression scenarios: the pure recurrence pack **`REGRESSION-BILLS-MONTHLY`**,
**`-WEEKLY`**, **`-WEEKLY-ON-DAY`**, **`-BIWEEKLY`** (recurrence-engine math only) plus
the inspectable workbook-integration scenarios **`REGRESSION-BILLS-MONTHLY-INTEGRATION`**
(visible `INPUT - Bills` + `LOG - Activity`) and **`REGRESSION-BILLS-MONTHLY-CASHFLOW`**
(adds a canonical `INPUT - Cash Flow 2026` with the bill's Expense row and asserts the
Bills ↔ Cash Flow linkage), all in `test_harness_scenarios_bills.js`. Scenarios now
declare an **`executionLevel`** (`PURE` / `INTEGRATION` / `E2E`) so a tester
immediately knows what to expect — see `TEST_HARNESS_ARCHITECTURE.md §3.1`. Keep both
levels: PURE scenarios prove engine math, INTEGRATION scenarios prove visible workbook
behavior. This document specifies *what* the full suite
should cover and *in what order to build it*. It does **not** authorize implementing
any additional scenario — each ships in its own approved milestone.

> **Guiding principle — the regression suite is CashCompass's primary confidence
> mechanism.** This is the project's **Regression-First Development** standard
> (`ENGINEERING_STANDARDS.md → §12`): every significant change leaves coverage equal
> or greater, never reduced. After any significant bug fix or architectural change,
> running the appropriate regression packs must quickly and reliably answer *"did this
> introduce unintended side effects?"* The suite is a **ratchet**: coverage only ever
> increases (every fixed production bug becomes a permanent `REG-###`; §4.9), and it
> is intended to become the **required gate for every beta and production release**
> (Release Certification, Level 18). Breadth is built incrementally, but the bar is
> that a green suite means "safe to ship."

**How the test docs relate:**

| Doc | Role |
|---|---|
| `TEST_HARNESS_ARCHITECTURE.md` | **How** the harness runs (lifecycle, guard, scenario model, disposable-workbook safety). |
| **`REGRESSION_SUITE_PLAN.md`** (this doc) | **What** the full E2E suite covers and the **build order** to get there. |
| `REGRESSION_SCENARIOS.md` | **Permanent memory** — one `REG-###` per fixed historical bug (a subset of the REGRESSION suite below). |
| `RELEASE_READINESS.md` | **How results roll up** into a single go/no-go verdict. |

**Related:** `VALIDATOR_ARCHITECTURE.md` (the read-only judge), `ROADMAP.md → P1`.

---

## Regression suite policy (this document is intentionally additive)

This plan is a **living, additive** document, not a fixed one-time spec:

- **Add on discovery, not at implementation time.** As new risks, bugs, modules,
  workflows, or edge cases surface, record them here immediately as **candidate
  suites or scenarios** — even if there is no intention to build them soon. Capturing
  the risk is the point; scheduling comes later.
- **Scenarios have a lifecycle.** A scenario may start as **planned**, then later
  become **implemented**. Mark status inline (`planned` / `implemented`) rather than
  deleting or gatekeeping candidates.
- **Every major bug fix must be covered.** It must either **map to an existing
  scenario** or **create a new `REG-###` historical regression scenario** in
  `REGRESSION_SCENARIOS.md` (§4.9). No significant fix ships without a regression
  home.
- **Coverage only grows.** Regression coverage is a **one-way ratchet** — scenarios
  are added over time and effectively never removed. Consolidation (merging
  overlapping scenarios) is allowed; silently dropping coverage is not.
- **Goal.** Over the life of the project this suite becomes the **primary confidence
  mechanism** and the **required gate** for every beta and production release
  (Release Certification, Level 18).

> **How to add a candidate.** Drop it in the most relevant pack (§3/§4) with a one-line
> description and a `planned` marker, or as a new `REG-###` in `REGRESSION_SCENARIOS.md`
> if it is a fixed production bug. Precision can follow; **do not wait** to record it.

---

## Regression Discovery Policy (test-coverage expansion)

*The additive policy above says coverage must grow; **this** policy says **how to
discover** what to add — every time CashCompass changes.* Whenever a change fixes a
bug, adds a feature, changes architecture, modifies dashboard logic, updates a
workbook schema, or touches a financial calculation, work through the matching
trigger checklist below and record the results (new/affected scenarios, packs, and
assertions) — as `planned` candidates if not built now. The copy-paste **Regression
Discovery prompt block** for future tasks is in the Appendix (§A).

**1. Coverage is additive.** Discovery only ever *adds* candidates; it never removes
coverage (consolidation excepted). See the additive policy above.

**2. Every bug fix must ask:**
- Does this map to an existing `REG-###` historical regression?
- If not, should a **new `REG-###`** be added (`REGRESSION_SCENARIOS.md`)?
- **What exact behavior failed?** (the precise wrong output / crash)
- **What exact assertion would catch it next time?** (structural gate and/or numeric)

**3. Every new feature must ask:**
- What **Smoke** scenario proves provisioning works (which sheets → `expectedSheets`)?
- What **functional** scenario proves correctness?
- What **dashboard / card / summary** outputs are affected?
- What **Recovery** or **edge-case** scenarios should be added?
- What **System Integrity** assertions are affected (totals/reconciliation)?

**4. Every schema / workbook change must ask:**
- Does **Provisioning** need a new expectation (required sheet/header, `*_REQUIRED_HEADERS_`)?
- Does **Schema Evolution** need a new compatibility case (era/generation)?
- Does **Workbook Drift** need a new advisory rule (width/style/geometry)?
- Does **Recovery** need a missing/malformed-workbook case?

**5. Every dashboard / summary change must ask:**
- What **counts / totals** should be asserted?
- What **cross-sheet reconciliation** should be asserted (source rows ↔ snapshot)?
- What **no-double-counting** assertion applies (§4.8 net-worth identity)?

**6. Every recurrence / date change must ask** (which date-boundary scenarios apply):
- Weekly? Weekly-on-day? Biweekly? Monthly? Yearly?
- Month-end / 31st-of-month? Leap year? Month boundary? Year rollover?
- Overdue? Paid-occurrence suppression? Next-occurrence calculation?

**7. Every financial-calculation change must ask:**
- What **exact numeric assertion** should be added?
- **Exact equality or tolerance-based** comparison? (see §8 open question 8)
- What **totals must reconcile across sheets**?
- What **dashboard values must agree with source sheets** (§4.8)?

> **Cursor's role.** Future task prompts should include the §A prompt block, and
> Cursor should **report suggested test-coverage changes as part of every meaningful
> implementation or bug-fix task** — proposing new/affected scenarios, packs, and
> assertions even when it is not implementing them. This makes regression coverage
> grow naturally with the product.

---

## 0. Non-negotiable safety invariants (inherited from the harness)

Every scenario in this plan runs under the harness safety model
(`TEST_HARNESS_ARCHITECTURE.md → §0, §2`). Restated because they gate the entire
suite:

- **Disposable workbooks only.** Each scenario runs against a freshly created,
  test-marked disposable workbook and passes `assertDisposableTarget_` before every
  write.
- **Existing populated Central workbooks are never modified.**
- **Existing bound workbooks are never modified.**
- **The Canonical workbook is never modified.** Its ID is explicitly refused by
  `assertDisposableTarget_`.
- **The Validator remains read-only** — it judges the disposable workbook's end
  state; it never writes.
- **Any repair/recovery scenario is explicit and isolated** — it deliberately
  damages *its own* disposable workbook, asserts the Validator detects the damage,
  runs the real self-heal path, and asserts recovery. It never touches real data.
- **Keep vs Trash** is per run: trash after validation by default; keep the
  disposable workbook for inspection on request (or on failure). Every scenario
  emits a structured **JSON report**.

---

## 1. Two things the suite must judge (structure vs. numbers)

The Validator answers *"is this workbook structurally healthy?"* (sheets, headers,
frozen panes, schema era, drift). Most of the coverage requested for the E2E suites
— **correct counts, correct totals, correct dashboard cards, no double-counting** —
is **numeric/functional correctness**, which the read-only Validator does **not**
compute. The suite therefore has two assertion layers:

| Layer | Judged by | Example |
|---|---|---|
| **Structural / health** | Validator (`validateProvisioning_` / Drift / Schema), scenario-scoped via `expectedSheets` | required sheet present, headers correct, `CENTRAL_CURRENT / FULLY_CURRENT` |
| **Functional / numeric** | **Harness-level assertions** in `expectedOutcome` (read shipping getters, compare to expected values) | dashboard `netWorth` equals expected; Bills Due returns the right occurrence; no duplicate rows |

> **Design consequence.** Building the Dashboard / Income / House / Retirement
> suites requires a small **functional-assertion capability** in the harness
> (`expectedOutcome` can assert numeric equality against values read back through
> shipping getters such as `getDashboardSnapshot()`, `getBillsDueFromCashFlowForDashboard()`,
> `getPropertyPerformanceData()`, `getRetirementSummarySafe_()`). This is additive to
> V1 and is called out in the build order (§7). It does **not** give the Validator
> write power or numeric responsibility — the assertions live in the harness.
>
> **Full design of this capability:** `FUNCTIONAL_ASSERTION_ARCHITECTURE.md` (E0a) —
> the sources/comparators/collector model, assertion vocabulary + tolerance policy,
> the per-module result envelope, `expectedOutcome(ctx)` integration, and the
> gate/aggregation rules.

---

## 2. The workbook-resolution prerequisite (the real blocker)

Foundation V1 revealed that the top-level workflows
(`addBillFromDashboard`, `addIncomeSourceFromDashboard`, `addHouseFromDashboard`,
`addInvestmentAccountFromDashboard`, `addDonation`, `addBankAccountFromDashboard`,
`addDebtFromDashboard`, …) resolve their workbook via **`getUserSpreadsheet_()`**,
which has **no injection seam** — calling them from the harness could write to a
**real** user workbook. V1 stayed safe by invoking workbook-**scoped** seams
(`runMinimalBootstrap_(ss)`) and the exact **pure** row helpers directly.

Two ways forward, per scenario:

1. **Pure-helper path (available today).** Provision with `runMinimalBootstrap_(ss)`
   + the domain `ensure*Sheet_` helpers that accept (or can be called on) an
   explicit `ss`, then write rows with the pure builders the public function uses.
   Higher fidelity risk (the scenario stitches the steps rather than calling the one
   public entry point).
2. **ss-injection refactor (`TEST_HARNESS_ARCHITECTURE.md → §9`).** Give the
   top-level workflows an optional `ss` parameter (defaulting to
   `getUserSpreadsheet_()`), so scenarios can call the **exact** production entry
   point against the disposable workbook. This is the **highest-leverage enabler**
   for the whole suite and should precede the functional REGRESSION scenarios.

> **Per-scenario readiness** is flagged in §7 as **[pure]** (buildable today via
> path 1) or **[needs seam]** (best built after the ss-injection refactor).

---

## 3. Suite taxonomy (eighteen packs)

Each pack the runner can enable independently. Gate semantics: Provisioning ERRORs
FAIL; Schema/Drift are advisory; functional assertions FAIL the scenario when a
value is wrong. The packs group into four bands:

| Band | Packs | Focus |
|---|---|---|
| **A. Foundational** | 1 Smoke · 2 Bills Recurrence · 3 Income · 4 Investments · 4b Retirement · 5 Houses · 6 Financial Ledger/Activity Log | per-module correctness |
| **B. Whole-system** | 7 Dashboard E2E · 11 System Integrity · 12 Multi-Year · 13 Edit/Delete | cross-module truth |
| **C. Non-functional** | 9 Stress · 15 Performance · 16 UI · 17 Security/Safety | scale, rendering, safety |
| **D. Recovery & gates** | 8 Recovery · 14 Import/Migration · 10 Release Readiness · 18 Release Certification | damage/heal + release gating |

> **Retirement is its own pack (4b).** Level 4 (Investments) and Level 4b
> (Retirement) share the `SMOKE-PROVISION-INVESTMENTS-RETIREMENT` provision proof but
> are **separate functional packs** — retirement projection correctness is distinct
> from investment-balance/no-double-count correctness (coverage: §4.3 vs §4.6).

### Level 1 — Smoke Suite
*Fast happy-path proof that each module provisions and accepts one record.* Runs on
every suite invocation.

- `SMOKE-PROVISION-DONATION` *(exists)* → `INPUT - Settings`, `INPUT - Donation`, `SYS - Meta`
- `SMOKE-PROVISION-INCOME` → Cash Flow year sheet + one Income row
- `SMOKE-PROVISION-BILLS` → `INPUT - Bills` + one bill
- `SMOKE-PROVISION-BANK-ACCOUNTS` → `INPUT - Bank Accounts` + `SYS - Accounts`
- `SMOKE-PROVISION-DEBTS` → `INPUT - Debts` + one debt
- `SMOKE-PROVISION-HOUSE-VALUES` → `INPUT - House Values` + `SYS - House Assets`
- `SMOKE-PROVISION-HOUSE-EXPENSES` → `HOUSES - <name>` + one expense
- `SMOKE-PROVISION-INVESTMENTS-RETIREMENT` → `INPUT - Investments` + `SYS - Assets` + `INPUT - Retirement`
- `SMOKE-PROVISION-ACTIVITY-LOG` → `LOG - Activity`

**Assertion:** provisioning PASS (scenario-scoped), no exception thrown, one record
present.

### Level 2 — Bills Recurrence Regression
*The recurrence engine is the highest-risk correctness surface.* See the matrix in
§4.1. Covers weekly, weekly-on-weekday, biweekly (anchor-driven), monthly, yearly,
AutoPay, manual Pay, overdue, paid-occurrence suppression, next-occurrence
calculation, month-boundary, 31st-of-month, and year-boundary.

> **Suite runner shipped (V1).** All ten implemented Bills scenarios (8 PURE +
> 2 INTEGRATION) can now be run as one action via **`SUITE-BILLS-REGRESSION`** — the
> first registered Test Harness *suite* (`test_harness_suites.js`,
> `testRunBillsSuite()` / console **Run Suite**). Each scenario still runs
> independently in its own disposable workbook; the suite only aggregates results
> (overall PASS iff every scenario PASSes). V1 disposition is **uniform** — the
> panel's keep/trash selection applies to every scenario (per-verdict policies such
> as *keep-failures-only* are documented but deferred). This is the pattern future
> packs (Income / Houses / Retirement / System Integrity / Release Readiness) will
> register into. See TEST_HARNESS_ARCHITECTURE.md §4.0.

### Level 3 — Income Regression
*Income totals must flow into Cash Flow and the dashboard.* See §4.2. **Caveat:**
income cadence (weekly/biweekly/semi-monthly/one-time) is **not modeled distinctly**
today (income = monthly Cash Flow rows). Documented as open questions (§8); the
buildable-now coverage is monthly / multiple sources / dashboard reflection.

### Level 4 — Investments Regression
*Multiple accounts, contributions/balance updates, current balances, and
**no double-counting** between investments, debts, accounts, and net worth.* See §4.3.

### Level 4b — Retirement Regression *(separated from Investments)*
*Retirement projection correctness — multiple retirement accounts, contributions,
growth assumptions, projections, dashboard summary, retirement readiness, and
projection consistency across runs.* See §4.6.

### Level 5 — Houses / House Values / House Expenses Regression
*Multi-property aggregation, value updates over time, expenses, performance, net
worth impact, mortgage/debt linkage.* See §4.4.

### Level 6 — Financial Ledger / Activity Log Regression
*Cash Flow ledger integrity and the Activity Log audit trail.*

- Cash Flow Summary row present + formulas + financial-health colors (product decision)
- Every write path (bill AutoPay, house expense, quick-add payment, donation) appends
  a correctly shaped, **deduped** `LOG - Activity` row
- No duplicate Activity rows across re-runs (dedupe-key correctness)
- Bank Accounts `Total Accounts` / `Delta` rows and Debts `TOTAL DEBT` row reconcile

### Level 7 — Dashboard End-to-End Regression
*A realistic seeded workbook validated whole.* See §4.5. Seeds multiple incomes,
bills, debts, investments, houses, house expenses, donations, bank accounts, and
activity-log entries, then asserts counts, totals, cards, house performance,
retirement summary, cash-flow summary, and Bills Due — with **no missing-sheet
errors** and **no duplicate records**.

### Level 8 — Recovery Suite
*Deliberate, isolated damage → detect → heal.* (Formalizes `REGRESSION_SCENARIOS.md
→ REC-###`.)

- `RECOVERY-MISSING-CASHFLOW-SHEET` → delete Cash Flow sheet → Validator `SHEET_MISSING`
  → re-run ensure path → PASS
- `RECOVERY-MISSING-REQUIRED-SHEET` (Accounts/Bills/Debts) → same shape
- `RECOVERY-MISSING-ROWS` → remove seeded rows → workflow re-materializes → PASS
- `RECOVERY-CORRUPT-HEADER` → corrupt a header row → schema finding → heal → PASS
- `RECOVERY-CENTRAL-RESOLUTION-FAILURE` → unresolvable user → assert a **clear error**,
  never a silent wrong-workbook write

### Level 9 — Stress Suite
*Scale + performance; records timing for the Release Readiness Performance line.*

- `STRESS-LARGE-ACTIVITY-LOG` (guards REG-007, the ~51s Bills Due regression)
- `STRESS-MANY-BILLS`, `STRESS-MANY-ACCOUNTS`, `STRESS-MANY-PROPERTIES`
- `STRESS-MULTI-YEAR-CASHFLOW`, `STRESS-LARGE-IMPORT`

### Level 10 — Release Readiness Suite
*The aggregate go/no-go **report mechanism*** — rolls every executed pack's result
into one verdict per `RELEASE_READINESS.md`. Overall `READY FOR BETA` only when no
line is FAIL. This is the **report/aggregation format** that the Release
Certification gate (Level 18) consumes; the two are not duplicates (§3.1).

### Level 11 — System Integrity
*Does the entire financial model stay internally consistent?* Cross-sheet math must
reconcile. Seeds a full multi-module workbook (the "Family" fixture, §4.7) and
asserts totals reconcile independently of the dashboard's own computation. See §4.8.

- `SYSTEM-NET-WORTH` — seed multiple bank accounts, investments, houses, mortgages,
  debts, donations, income, bills → assert **Assets · Liabilities · Net Worth ·
  House Equity · Investment totals · Cash totals** all reconcile.
- `SYSTEM-CASHFLOW` — Cash Flow monthly totals + Summary row reconcile with the
  seeded income/expense/AutoPay/house-expense rows.
- `SYSTEM-ASSET-RECONCILIATION` — `cash` (`SYS - Accounts`) + `investments`
  (`SYS - Assets`) + `houseValues` (`SYS - House Assets`) equal the sum of their
  source rows; SYS mirrors match their `INPUT -` year blocks.
- `SYSTEM-LIABILITY-RECONCILIATION` — `debt` (`INPUT - Debts`) + `houseLoans`
  (`SYS - House Assets`) equal the sum of their source rows; no liability missed.
- `SYSTEM-NO-DOUBLE-COUNTING` — the authoritative invariant
  `netWorth = cash + investments + houseValues − debt`; nothing counted twice
  (e.g., a mortgage in both `houseLoans` **and** `INPUT - Debts`). *(Consolidates the
  earlier `REGRESSION-INVESTMENTS-NO-DOUBLE-COUNT`; §3.1.)*
- `SYSTEM-DASHBOARD-RECONCILIATION` — the numbers System Integrity computes from raw
  sheets match what `getDashboardSnapshot()` surfaces. *(Shares the Family fixture
  with Level 7; §3.1.)*

### Level 12 — Multi-Year Regression
*Correctness across year boundaries and multi-year history.*

- `MULTIYEAR-YEAR-ROLLOVER` — `createNextYearCashFlowSheet()` clones the prior year
  correctly (headers, Summary row, Active rows carried, amounts reset per design).
- `MULTIYEAR-JAN-DEC-BOUNDARY` — Dec→Jan transitions for cadence + reporting.
- `MULTIYEAR-HOUSE-VALUES` — multi-year `INPUT - House Values` blocks; deltas and
  Current Value resolve to the latest year.
- `MULTIYEAR-YEARLY-BILLS` — a Yearly bill produces exactly one occurrence per year
  across a rollover.
- `MULTIYEAR-YEARLY-INCOME` — annual income (e.g., a yearly bonus) reflected in the
  correct year's Cash Flow.
- `MULTIYEAR-RETIREMENT` — retirement projection consistency across multiple years.

### Level 13 — Edit / Delete Regression
*Every module's full lifecycle, not just create.* For each of bills, debts, income,
investments, bank accounts, houses, house expenses, donations:

- **create → edit → delete/deactivate → (undo/reactivate where applicable)**
- dashboard totals/counts update to match after each step
- `LOG - Activity` gets the correct event rows (and undo removes/marks them)
- **no orphan records** (e.g., deactivating a debt leaves no dangling Cash Flow
  payee; renaming syncs Cash Flow payees)

Representative IDs: `EDITDELETE-BILLS`, `EDITDELETE-DEBTS` (incl. rename/reactivate),
`EDITDELETE-INCOME`, `EDITDELETE-INVESTMENT`, `EDITDELETE-BANK-ACCOUNT`,
`EDITDELETE-HOUSE`, `EDITDELETE-DONATION`, `EDITDELETE-ACTIVITY-UNDO`
(`deleteActivityLogRow`).

> **Note:** most modules use a **soft-delete lifecycle** (`Active = No`) rather than
> hard row deletion; "delete" scenarios assert the deactivate/reactivate path and its
> dashboard/ledger consequences.

### Level 14 — Import / Migration Regression *(future-proof)*
*Provisioning, legacy compatibility, imports, and repair paths.*

- `MIGRATION-CENTRAL` — a fresh Central-provisioned disposable workbook resolves and
  operates without `getActiveSpreadsheet()`-null crashes (guards the REG-001…006
  class); classifies `CENTRAL_CURRENT / FULLY_CURRENT`.
- `MIGRATION-LEGACY-WORKBOOK` — a deliberately legacy-shaped workbook
  (`createsLegacyStructure`) validates as **Compatible Legacy** (Schema Evolution),
  **not** a provisioning FAIL.
- `IMPORT-BANK` — `bank_import.js` staging/ignored sheets created and populated
  correctly (`SYS - Import Staging — Bank Accounts` / `— Ignored`).
- `REPAIR-WORKFLOWS` — self-heal / re-provision repairs missing structure (overlaps
  Recovery, Level 8 — §3.1).
- `VALIDATOR-COMPATIBILITY` — Schema Evolution yields the right Workbook Type +
  Compatibility across generations.

### Level 15 — Performance Regression
*Scale fixtures + explicit timing thresholds.* **Consolidated with Stress
(Level 9):** Stress supplies the scale fixtures; Performance adds the timing
assertion and records it on the Release Readiness **Performance** line (§3.1).

- `PERF-100-BILLS`, `PERF-1000-ACTIVITY-ROWS` (guards REG-007, the ~51s→~5.6s Bills
  Due regression), `PERF-LARGE-DONATIONS`, `PERF-LARGE-INVESTMENT-HISTORY`,
  `PERF-MULTIPLE-HOUSES`, `PERF-LARGE-DASHBOARD`.
- `PERF-PLANNER-STAGES` — with `PERFORMANCE_TIMING_ENABLED=true`, execute first-run
  and repeat manual planner refreshes on a disposable workbook; assert one
  privacy-safe timing envelope per run, stable stage names, non-negative stage
  durations, no user/workbook/financial values, and total time within the ratified
  planner budget. With the flag unset/OFF, assert no timing envelope or log.
  **Baseline evidence (2026-07-20, isolated Central `@115`):** instrumentation and
  privacy assertions PASS; first/repeat totals were 81.455 s / 77.275 s, so the
  proposed ≤60-second p95 release budget does not yet pass. Flag restored OFF and
  disposable workbook returned to Trash.
  **History-chart retirement follow-up — PASS on isolated Central `@116`
  (2026-07-20):** History rows still appended,
  deduplicate as before, existing `OUT - History` chart objects are removed, no
  chart objects are rebuilt, History-backed dashboard comparisons remain valid,
  and the trace uses `cleanup_history_charts`. First/repeat cleanup was
  0.650 s / 0.165 s and total server time was 42.378 s / 43.946 s. Timing was
  restored OFF and the disposable workbook returned to Trash.
- **Assertion:** Validator PASS **and** execution under an agreed threshold (per
  operation; recorded, trend-tracked).

### Level 16 — UI Regression
*Rendering + interaction correctness of the web surfaces.*

> **Mechanism note (important):** the Test Harness is **server-side** and cannot
> assert DOM rendering. **V1 is a manual checklist**; an **automated UI/headless
> harness is a separate future capability** (open question §8). This pack documents
> *what* to check, not an auto-runnable harness pack yet.

Surfaces: Dashboard, **Validation & Testing console**, **Test Harness card**, House
pages, Bills, Income, Debts, and mobile layout where applicable. Check: no rendering
regressions, cards populate, empty states render, actions round-trip, disabled/locked
states correct (e.g., harness disabled-state UX).

### Level 17 — Security / Safety Regression
*The guardrails that keep the writer subsystem safe — many are auto-assertable.*

- `SECURITY-ADMIN-GATING` — non-admin callers are denied on Validator / Harness /
  console entry points.
- `SECURITY-VALIDATOR-READONLY` — the Validator never writes (CI no-write guard holds).
- `SECURITY-HARNESS-DISPOSABLE-ONLY` — `assertDisposableTarget_` permits only
  test-marked disposable workbooks.
- `SECURITY-PROTECTED-WORKBOOK-REFUSAL` — Canonical, Central default, mapped-user, and
  bound workbook IDs are **refused** by `assertDisposableTarget_` (assert against each
  known-ID class).
- `SECURITY-FAIL-CLOSED` — with `TEST_HARNESS_ENABLED` / `VALIDATOR_ENABLED` unset,
  the subsystems are inert.
- `SECURITY-OAUTH-ASSUMPTIONS` — teardown trashes via `Drive.Files.update` under the
  narrow `drive.file` scope (documents the `DriveApp.getFileById` limitation).

### Level 18 — Release Certification
*The master pre-release gate — the required check before every beta/public release.*
Runs the executable packs and aggregates them **plus** non-executable checks:

- Executable: Smoke · Regression · Recovery · Stress/Performance · System Integrity ·
  Dashboard E2E · Validator (provisioning/drift/schema).
- Non-executable inputs: **Documentation** current (this plan + status docs) ·
  **Known Issues** reviewed and signed off.
- Consumes the Level 10 Release Readiness aggregate report.
- **Result:** `READY FOR RELEASE` (no FAIL; WARNs signed off) or `BLOCK RELEASE`.

### 3.1 Overlap & consolidation

Several requested packs overlap; kept as distinct concerns but explicitly reconciled
so nothing is built twice:

| Overlap | Resolution |
|---|---|
| **9 Stress ↔ 15 Performance** | One workstream. **Stress = scale fixtures** (large logs, many accounts/properties, multi-year); **Performance = the timing assertion/threshold** layered on those fixtures. Build once; reference from both. |
| **10 Release Readiness ↔ 18 Release Certification** | **10 is the report format/aggregation mechanism** (`RELEASE_READINESS.md`); **18 is the end-to-end release gate** that runs all packs + Documentation + Known Issues and emits READY/BLOCK. 10 is a component of 18. |
| **7 Dashboard E2E ↔ 11 System Integrity** | Both use the same **Family fixture** (§4.7). **11 asserts raw cross-sheet math reconciles**; **7 asserts `getDashboardSnapshot()` surfaces those numbers**. `SYSTEM-DASHBOARD-RECONCILIATION` is the bridge. |
| **4 Investments ↔ 4b Retirement** | Split: 4 = balances/no-double-count; 4b = projection correctness. Shared provision proof only. |
| **8 Recovery ↔ 14 Import/Migration (`REPAIR-WORKFLOWS`)** | Recovery = deliberate damage→heal on a disposable workbook; Migration repair = provisioning/self-heal of legacy/partial workbooks. Repair scenarios live in 14 and **reuse** Recovery's heal assertions. |
| **`SYSTEM-NO-DOUBLE-COUNTING` ↔ former `REGRESSION-INVESTMENTS-NO-DOUBLE-COUNT`** | Consolidated into the System Integrity invariant (§4.8). The Investments pack keeps only balance-level assertions. |

---

## 4. Coverage matrices

Sheet names, headers, and helper functions below are the real CashCompass names.

### 4.1 Bills recurrence (Level 2)

Bill row fields on `INPUT - Bills`: `Payee, Category, Due Day, Default Amount,
Varies, Autopay, Active, Payment Source, Frequency, Start Month, Notes, Weekday,
Anchor Date, Schedule Effective Date`. Engine: `buildRuleFromBillRow_` →
`generateOccurrences_`; Bills Due: `getBillsDueFromCashFlowForDashboard` /
`getInputBillsDueRows_`; actions: `markDashboardBillOccurrencePaid`,
`skipDashboardBill`.

| Scenario ID | Case | Seed (bill config) | Assertion |
|---|---|---|---|
| `REGRESSION-BILLS-MONTHLY` **✅ implemented** | Monthly (pure engine) | Frequency=Monthly, Due Day=15 | occurrence on the 15th; count/prior/next occurrence + one-month advancement (pure `buildInputBillDueCandidates_`, explicit anchor, `dateEquals`) — `test_harness_scenarios_bills.js` |
| `REGRESSION-BILLS-MONTHLY-INTEGRATION` **✅ implemented** | Monthly (workbook integration) | Payee=City Utilities, Amount=125, Frequency=Monthly, Due Day=15, Manual pay | seeds a visible canonical `INPUT - Bills` row + `LOG - Activity` bill_add row on the disposable workbook; asserts sheet/row exist, payee/amount/due day, next occurrence (`dateEquals`), and the bill_add activity row + content **unconditionally** (bill add always logs) — `test_harness_scenarios_bills.js` (mirrors production write path via sheet-/ss-scoped helpers; Cash Flow + Dashboard deferred) |
| `REGRESSION-BILLS-MONTHLY-CASHFLOW` **✅ implemented** | Monthly (Bills → Cash Flow integration) | Payee=City Utilities, Amount=125, Monthly, Due Day=15, Manual (CASH) | builds `INPUT - Bills` + a **canonical `INPUT - Cash Flow 2026`** (header + month columns + Summary, via real sheet-scoped helpers) + `LOG - Activity`; seeds the bill's Cash Flow Expense row exactly as `addBillFromDashboard` does (`findCashFlowRowByTypeAndPayee_` + `insertCashFlowRow_`); asserts both sheets exist, the Expense row (Type/Payee/Flow Source), and the **Bills ↔ Cash Flow payee linkage** — `test_harness_scenarios_bills.js`. Cash Flow *amount* is intentionally not asserted (production writes structural columns only at add time; amounts are a pay/autopay concern). Dashboard deferred |
| `REGRESSION-BILLS-WEEKLY` **✅ implemented** | Weekly (legacy, no weekday) | Frequency=Weekly, Due Day=10 | count=11 across window; in-month 7-day cadence; prior/current/next; **per-month RE-ANCHOR** pinned (Dec 31 → Jan 10 = 10 days, not 7 — legacy weekly restarts at Due Day each month) — `test_harness_scenarios_bills.js` |
| `REGRESSION-BILLS-WEEKLY-ON-DAY` **✅ implemented** | Weekly on weekday | Frequency=Weekly, Weekday=Sunday (Due Day ignored) | count=12; **every** occurrence is a Sunday (`getDay()===0`); continuous +7 across month/year boundaries (all gaps===7); next Sunday on/after anchor — `test_harness_scenarios_bills.js` |
| `REGRESSION-BILLS-BIWEEKLY` **✅ implemented** | Biweekly (anchor-driven) | Frequency=Biweekly, Weekday=Monday, Anchor=Dec 15 2025 | count=6; anchor is first occurrence; true 14-day cadence (all gaps===14, no monthly re-anchor); **month + YEAR crossing** (Dec 29 → Jan 12 2026); correct next occurrence — `test_harness_scenarios_bills.js` |
| `REGRESSION-BILLS-YEARLY` **✅ implemented** | Yearly | Frequency=Yearly, Due Day 15, Start Month 6 (June) | exactly one occurrence in the start month (Jun 15 2026); same date one year later (Jun 15 2027 — yearly cadence); zero occurrences off-cycle (Sep window); prior-month look-back the month after start (Jul → Jun 15). Reuses the non-clamping monthly path — see 31st/leap edge cases below — `test_harness_scenarios_bills.js` |
| `REGRESSION-BILLS-AUTOPAY` | AutoPay | Autopay=Yes, Varies≠Yes, due date passed | Cash Flow cell written **once** + one `bill_autopay` Activity row; **no double-post** (guards REG-008) |
| `REGRESSION-BILLS-MANUAL-PAY` | Manual Pay | Autopay=No | Pay writes payment + `bill_paid` marker; occurrence suppressed |
| `REGRESSION-BILLS-OVERDUE` | Overdue | Due Day in the past, unpaid | appears in `overdue` bucket with overdue styling semantics |
| `REGRESSION-BILLS-PAID-OCCURRENCE` | Paid occurrence | pay one occurrence of a recurring bill | that exact occurrence suppressed; others remain |
| `REGRESSION-BILLS-NEXT-OCCURRENCE` | Next occurrence | any recurring bill | `generateOccurrences_` next date matches expected within the [-1,0,+1] month window |
| `REGRESSION-BILLS-MONTH-BOUNDARY` | Month boundary | weekly/biweekly spanning end of month | cadence continuous across the boundary |
| `REGRESSION-BILLS-31ST` **✅ implemented** | 31st-of-month | Due Day=31, Monthly, anchored Apr 15 2026 | **CHARACTERIZATION** of current behavior: Mar (31d)→Mar 31 exact; Apr (30d)→**OVERFLOWS to May 1** (no clamp); May (31d)→May 31 exact; asserts no occurrence lands in April. **⚠ Product Decision (open):** the Monthly path does NOT clamp Due Day — `new Date(y, m, 31)` OVERFLOWS into the next month — while the Weekly/Biweekly path DOES clamp. Behavior asserted exactly; not changed — `test_harness_scenarios_bills.js` |
| `REGRESSION-BILLS-LEAP-FEB29` **✅ implemented** | Leap Feb 29 | Due Day=29, Monthly, anchors Feb 10 2028 (leap) & Feb 10 2027 (non-leap) | **CHARACTERIZATION:** leap-year Feb→Feb 29 2028 (exact); non-leap Feb→**OVERFLOWS to Mar 1 2027** (no clamp), no February-dated occurrence. Same overflow Product Decision as 31st. Behavior asserted exactly; not changed — `test_harness_scenarios_bills.js` |
| `REGRESSION-BILLS-YEAR-BOUNDARY` **✅ implemented** | Year boundary | Monthly, Due Day 15, anchors Dec 20 2025 & Jan 5 2026 | Dec-anchor: Nov 15 / Dec 15 2025 / **next crosses to Jan 15 2026** (year transition asserted via `getFullYear`); Jan-anchor: **prior look-back reaches back to Dec 15 2025** (previous year) / Jan 15 / Feb 15 2026 — `test_harness_scenarios_bills.js` |

### 4.2 Income (Level 3)

Income = `Type=Income, Flow Source=CASH, Payee=<name>, Active=YES` rows on
`INPUT - Cash Flow <year>`. Functions: `addIncomeSourceFromDashboard` [needs seam],
`getActiveIncomeSourcesForManagementFromDashboard`, `buildIncomeAllocation_(ss)`,
`listActiveIncomeMonthlyTotals_`.

| Scenario ID | Case | Buildable | Assertion |
|---|---|---|---|
| `REGRESSION-INCOME-MONTHLY` | Monthly income | yes | income appears on Cash Flow; `buildIncomeAllocation_` income total correct |
| `REGRESSION-INCOME-MULTIPLE-SOURCES` | Multiple sources | yes | totals sum correctly; each source distinct in management list |
| `REGRESSION-INCOME-DASHBOARD-REFLECTION` | Dashboard reflection | yes | `getDashboardSnapshot().incomeAllocation` (10/70/20) matches seeded income |
| `REGRESSION-INCOME-WEEKLY` | Weekly income | **open (§8)** | requires a cadence model income does not have today |
| `REGRESSION-INCOME-BIWEEKLY` | Biweekly income | **open (§8)** | same |
| `REGRESSION-INCOME-SEMI-MONTHLY` | Semi-monthly income | **open (§8)** | same |
| `REGRESSION-INCOME-ONE-TIME` | One-time income | partial | one-offs surface under "Other detected income", not recurring — assert classification |

### 4.3 Investments (Level 4)

Sheets: `INPUT - Investments`, `SYS - Assets`. Functions:
`addInvestmentAccountFromDashboard` / `updateInvestmentValueByDate` [needs seam],
`ensureInputInvestmentsSheet_`, `ensureSysAssetsSheet_`,
`syncAllAssetsFromLatestCurrentYear_`.

| Scenario ID | Case | Assertion |
|---|---|---|
| `REGRESSION-INVESTMENTS-MULTIPLE-ACCOUNTS` | Multiple accounts (401k, Roth, brokerage) | each present on `INPUT - Investments`; `SYS - Assets` mirror in sync; **investment count** correct |
| `REGRESSION-INVESTMENTS-CONTRIBUTIONS` | Contributions / balance updates | month value updates reflected in current balance |
| `REGRESSION-INVESTMENTS-CURRENT-BALANCES` | Current balances | dashboard `investments` = sum of `SYS - Assets` Current Balance |

*(No-double-count is asserted in System Integrity, §4.8. Retirement projection is its
own pack, §4.6.)*

### 4.4 Houses / House Values / House Expenses (Level 5)

Sheets: `INPUT - House Values`, `SYS - House Assets`, `HOUSES - <name>`. Functions:
`addHouseFromDashboard` / `updateHouseValueByDate` [needs seam],
`ensureInputHouseValuesSheet_`, `ensureSysHouseAssetsSheet_`,
`createHousesExpenseSheet_`, `addHouseExpense` [needs seam],
`getPropertyPerformanceData`, `syncAllHouseAssetsFromLatestCurrentYear_`.

| Scenario ID | Case | Assertion |
|---|---|---|
| `REGRESSION-HOUSE-MULTI-PROPERTY` | Multiple properties | each on `INPUT - House Values`; `SYS - House Assets` mirror in sync; **property count** correct |
| `REGRESSION-HOUSE-VALUE-UPDATES` | Value updates over time | month-block updates change Current Value; deltas correct |
| `REGRESSION-HOUSE-APPRECIATION` | Appreciation | multi-period value increases resolve to the latest Current Value; appreciation delta correct |
| `REGRESSION-HOUSE-EQUITY` | Equity | per-property + aggregate `houseEquity = Current Value − Loan Amount Left` |
| `REGRESSION-HOUSE-EXPENSES` | House expenses | `HOUSES - <name>` expense row present; optional Cash Flow expense row written |
| `REGRESSION-HOUSE-MORTGAGE-CHANGES` | Mortgage changes | updating `Loan Amount Left` re-derives equity + `houseLoans` correctly |
| `REGRESSION-HOUSE-PERFORMANCE-MULTI-PROPERTY` | Performance across properties | `getPropertyPerformanceData` aggregates rent (Cash Flow) + expenses (HOUSES) per property correctly |
| `REGRESSION-HOUSE-MORTGAGE-LINKAGE` | Mortgage/debt linkage | `Loan Amount Left` reflected in `houseLoans`; loan payee ties to `INPUT - Debts` where applicable |
| `REGRESSION-HOUSE-NET-WORTH-IMPACT` | Net worth impact | `houseEquity` contributes to `netWorth` exactly once |
| `REGRESSION-HOUSE-DASHBOARD-AGGREGATION` | Dashboard aggregation | `getDashboardSnapshot()` `houseValues/houseLoans/houseEquity` = sum across all properties |

*(Dashboard **house count**: the snapshot exposes aggregated values, not a count —
assert via `getHousesFromHouseValues_()` / `getHouseNamesFromHouseAssets_()`; see §8.)*

### 4.5 Dashboard End-to-End (Level 7)

`REGRESSION-DASHBOARD-FULL-MONTH` — seed the **Family A** realistic fixture (§4.7),
then validate the whole workbook via shipping getters:

| Aspect | Getter / source | Assertion |
|---|---|---|
| Account counts | `getBankAccountUiData()` / row scan | seeded account count matches |
| Investment counts | `getInvestmentUiData()` / `SYS - Assets` | seeded investment count matches |
| Property counts | `getHousesFromHouseValues_()` | seeded property count matches |
| Totals | `getDashboardSnapshot()` | `cash`, `investments`, `houseValues`, `houseLoans`, `houseEquity`, `debt`, `netWorth` all correct |
| Dashboard cards | `getDashboardSnapshot()` | `incomeAllocation`, `bufferRunway`, `health`, `issues`, `suggestedActions` populate sanely |
| House performance | `getPropertyPerformanceData()` | per-property rent/expense aggregation correct |
| Retirement summary | `getRetirementSummarySafe_()` | projection outputs correct for seeded assumptions |
| Cash flow summary | Cash Flow Summary row | monthly totals + Summary formulas correct |
| Bills Due | `getBillsDueFromCashFlowForDashboard()` | overdue/next7 buckets correct |
| Upcoming Expenses | `getUpcomingBillsDueForDashboard()` | seeded upcoming items surface correctly |
| No missing sheets | Validator (full model) | provisioning PASS |
| No duplicates | Activity Log dedupe + row scans | no duplicate records |

### 4.6 Retirement (Level 4b) — *separated from Investments*

Sheet: `INPUT - Retirement`. Functions: `getOrCreateRetirementSheet_`,
`getRetirementUiData`, `saveRetirementInputs` [needs seam],
`getRetirementSummary_` / `getRetirementSummarySafe_`, `getRetirementModelData_`,
`writeRetirementOutputs_`, `getCurrentInvestableAssetsForRetirement_` (pulls from
`SYS - Assets`).

| Scenario ID | Case | Assertion |
|---|---|---|
| `REGRESSION-RETIREMENT-MULTIPLE-ACCOUNTS` | Multiple retirement accounts | investable-assets basis includes each 401k/Roth/etc. from `SYS - Assets` |
| `REGRESSION-RETIREMENT-CONTRIBUTIONS` | Contributions | contribution assumptions feed the projection inputs |
| `REGRESSION-RETIREMENT-GROWTH` | Growth assumptions | Conservative/Base/Aggressive scenarios produce ordered outputs (aggressive ≥ base ≥ conservative) |
| `REGRESSION-RETIREMENT-PROJECTIONS` | Projections | `getRetirementSummarySafe_()` outputs match expected values for seeded assumptions |
| `REGRESSION-RETIREMENT-DASHBOARD-SUMMARY` | Dashboard summary | `getDashboardSnapshot().retirement` matches the retirement model |
| `REGRESSION-RETIREMENT-READINESS` | Retirement readiness | readiness/gap indicator correct for a known input set |
| `REGRESSION-RETIREMENT-CONSISTENCY` | Projection consistency | re-running with unchanged inputs yields identical outputs (determinism — §8) |

### 4.7 Fixture families (realistic seeds)

Reusable, named fixtures so Dashboard (Level 7) and System Integrity (Level 11)
assert against the same known-good numbers. Fixtures live in `test_harness_data.js`
and are applied by `setup(ctx)`.

**Family A — full household:**

| Domain | Seeded records |
|---|---|
| Bank accounts | Checking, Savings |
| Investments | Brokerage, 401k, Roth IRA |
| Houses | Primary House, Rental Property |
| House values | multi-period value history per property |
| Mortgages / loans | Mortgage (Primary), HELOC, Car Loan → `Loan Amount Left` + `INPUT - Debts` |
| Debts | Credit Cards, Car Loan |
| Bills | Utilities, Insurance (mixed cadence + AutoPay) |
| Income | Weekly Paycheck, Monthly Salary, Yearly Bonus |
| House expenses | expenses on `HOUSES - Primary House` / `HOUSES - Rental Property` |
| Donations | one or more `INPUT - Donation` rows |
| Activity log | entries generated by the above write paths |

**Expected assertions against Family A** (used by Levels 7 & 11): Dashboard cards ·
house performance · retirement summary · Cash Flow Summary · Bills Due · Upcoming
Expenses · Net Worth · account counts · investment counts · property counts · **no
missing sheets · no duplicate records**.

> **Income cadence caveat:** "Weekly Paycheck" / "Yearly Bonus" describe the
> *household*, but income has no distinct cadence model today (§8). Family A seeds
> them as **monthly-equivalent Cash Flow income rows** (plus a yearly-bonus row in
> its month) until an income-cadence feature exists.

### 4.8 System Integrity reconciliation (Level 11)

Independent recomputation from raw sheets, then compare to the dashboard. The
authoritative net-worth identity:

```
Assets       = cash (SYS - Accounts) + investments (SYS - Assets) + houseValues (SYS - House Assets)
Liabilities  = debt (INPUT - Debts) + houseLoans (SYS - House Assets)
Net Worth    = Assets − Liabilities            (== cash + investments + houseValues − debt, with houseLoans inside debt/liabilities)
House Equity = houseValues − houseLoans
```

| Scenario ID | Assertion |
|---|---|
| `SYSTEM-NET-WORTH` | Assets, Liabilities, Net Worth, House Equity, Investment totals, Cash totals all reconcile from raw rows |
| `SYSTEM-CASHFLOW` | Cash Flow monthly totals + Summary row reconcile with seeded flows |
| `SYSTEM-ASSET-RECONCILIATION` | each SYS mirror equals its `INPUT -` source; asset total = sum of parts |
| `SYSTEM-LIABILITY-RECONCILIATION` | debt + house loans = sum of liability rows; none missed |
| `SYSTEM-NO-DOUBLE-COUNTING` | nothing counted twice (mortgage not in both `houseLoans` and `INPUT - Debts`) |
| `SYSTEM-DASHBOARD-RECONCILIATION` | independently-computed totals == `getDashboardSnapshot()` values |

> **Net-worth definition note (open, §8):** confirm whether mortgages are represented
> as `houseLoans` **or** `INPUT - Debts` **or** both-but-deduped, so the identity and
> the `SYSTEM-NO-DOUBLE-COUNTING` assertion match the shipped `buildDashboardSnapshot_`
> semantics (`netWorth = cash + investments + houseValues − debt`).

### 4.9 Historical bugs → `REG-###` (the ratchet)

**Every production bug fixed becomes a permanent `REG-###` regression scenario** in
`REGRESSION_SCENARIOS.md` and is added to the REGRESSION pack. This is a one-way
ratchet: **regression coverage only ever increases.** Workflow (from
`REGRESSION_SCENARIOS.md`): fix bug → add `REG-###` (title · date · root cause ·
affected files · expected result · repro fixture) → add the matching scenario →
scenario must **fail on the old behavior, pass on the fix**. The seeded registry
already covers the Central `getActiveSpreadsheet()`-null class (REG-001…006), the
Bills Due performance regression (REG-007), and AutoPay concurrency (REG-008).

---

## 5. Scenario model (documentation contract for every future scenario)

Each scenario is **data**, declared in `test_harness_scenarios.js`, and must document
these fields (extends the implemented model in `TEST_HARNESS_ARCHITECTURE.md → §3.1`):

```
Scenario {
  id,              // stable, e.g. 'REGRESSION-BILLS-BIWEEKLY'
  category,        // 'SMOKE' | 'REGRESSION' | 'RECOVERY' | 'STRESS'
  description,     // human summary of what it proves
  expectedSheets,  // sheets it intentionally creates → scopes Validator to just these
  seedData,        // DECLARATIVE fixtures (bill rows, income rows, houses, …);
                   //   applied by setup(ctx) via the fixture API in test_harness_data.js
  actions(ctx),    // the workflow(s) under test — REAL production functions/seams
  expectedOutcome, // (a) Validator gate + allowed findings AND
                   //   (b) functional assertions (numeric equality via shipping getters)
  // execution options (run-level, not per-scenario data):
  //   keep/trash   — trash after validation (default) | keep for inspection
  //   JSON report  — every scenario emits a structured report object
}
```

- `seedData` is the **declarative** form of fixtures; `setup(ctx)` applies it using
  real `ensure*`/pure builders so the seeded state is production-shaped.
- `actions(ctx)` must call **shipping code**, never reimplement behavior. Prefer the
  public entry point once the ss-injection seam exists (§2); until then use the
  workbook-scoped seams + pure builders, per the **Integration Scenario Principle**
  (`ENGINEERING_STANDARDS.md §13`): pure fn → sheet-scoped helper → ss-scoped helper →
  small extraction → harness-specific code (last resort, documented). Duplicating
  production build/format logic is what caused the Cash Flow "10pt row" fidelity bug.
- `expectedOutcome` carries **both** the structural gate and any functional numeric
  assertions (§1).
- `keep`/`trash` and JSON reporting are already supported by Foundation V1.
- **Pack IDs vs. harness category.** Scenario ID prefixes (`SYSTEM-`, `MULTIYEAR-`,
  `EDITDELETE-`, `MIGRATION-`, `PERF-`, `SECURITY-`, …) are the **documentation
  grouping** (§3). The harness `category` field stays the coarse **execution class**
  (`SMOKE | REGRESSION | RECOVERY | STRESS`) that drives run selection and gate
  semantics; e.g., System Integrity / Multi-Year / Edit-Delete scenarios run as
  `REGRESSION`, Performance runs as `STRESS`. Adding new execution classes is a
  separate harness change, not required by this plan.

---

## 6. Summary of the plan

**Eighteen packs in four bands** (§3): **A. Foundational** (1 Smoke · 2 Bills
Recurrence · 3 Income · 4 Investments · 4b Retirement · 5 Houses · 6 Financial
Ledger/Activity Log) → **B. Whole-system** (7 Dashboard E2E · 11 System Integrity ·
12 Multi-Year · 13 Edit/Delete) → **C. Non-functional** (9 Stress · 15 Performance ·
16 UI · 17 Security/Safety) → **D. Recovery & gates** (8 Recovery · 14 Import/
Migration · 10 Release Readiness · 18 Release Certification). Two cross-cutting
enablers gate functional depth: a **functional-assertion capability** (§1) and the
**ss-injection refactor** (§2). Structural health is judged by the Validator
(scenario-scoped); numeric correctness is judged by harness assertions. Reusable
**fixture families** (§4.7) let Dashboard and System Integrity assert the same
known-good numbers. The suite is a **ratchet** — every fixed bug becomes a permanent
`REG-###` (§4.9) — and Release Certification (Level 18) is the intended required
gate for every release.

---

## 7. Recommended build order (beta-readiness first)

High value + buildable-soon first. `[pure]` = buildable today via workbook-scoped
seams + pure builders; `[needs seam]` = best after the ss-injection refactor (§2);
`[needs func]` = needs the functional-assertion capability (§1).

**Enabler 0 (do first, unblocks depth):**
- **E0a — Functional-assertion capability** in `expectedOutcome` (§1); full design in `FUNCTIONAL_ASSERTION_ARCHITECTURE.md`.
- **E0b — ss-injection refactor** for the top-level workflows (§2).

**Then the requested order:**

1. `SMOKE-PROVISION-INCOME` — `[pure]`
2. `SMOKE-PROVISION-BILLS` — `[pure]`
3. `SMOKE-PROVISION-HOUSE-VALUES` — `[pure]`
4. `SMOKE-PROVISION-HOUSE-EXPENSES` — `[pure]`
5. `SMOKE-PROVISION-INVESTMENTS-RETIREMENT` — `[pure]`
6. `REGRESSION-BILLS-MONTHLY` — `[pure]` (engine is pure; occurrence math testable directly) — **✅ implemented** (`test_harness_scenarios_bills.js`; `dateEquals` comparator)
7. `REGRESSION-BILLS-WEEKLY` — `[pure]` — **✅ implemented** (`test_harness_scenarios_bills.js`; legacy per-month re-anchor pinned)
8. `REGRESSION-BILLS-WEEKLY-ON-DAY` — `[pure]` — **✅ implemented** (weekday correctness + continuous +7)
9. `REGRESSION-BILLS-BIWEEKLY` — `[pure]` — **✅ implemented** (anchor-driven +14; month+year crossing)
9a. `REGRESSION-BILLS-YEAR-BOUNDARY` — `[pure]` — **✅ implemented** (monthly Dec/Jan window; both-sided year transition)
9b. `REGRESSION-BILLS-31ST` + `REGRESSION-BILLS-LEAP-FEB29` — `[pure]` — **✅ implemented** (characterize the non-clamping Monthly overflow; Product Decision reported)
10. `REGRESSION-BILLS-YEARLY` — `[pure]` — **✅ implemented**
11. `REGRESSION-INCOME-BIWEEKLY` — **open (§8)**; if income cadence is not built,
    substitute `REGRESSION-INCOME-MULTIPLE-SOURCES` + `-DASHBOARD-REFLECTION` `[needs func]`
12. `REGRESSION-DASHBOARD-FULL-MONTH` — `[needs func]` (+ `[needs seam]` for realistic seeding, Family A §4.7)
13. `REGRESSION-HOUSE-PERFORMANCE-MULTI-PROPERTY` — `[needs func]`
14. `REGRESSION-RETIREMENT-PROJECTIONS` — `[needs func]`
15. `RECOVERY-MISSING-CASHFLOW-SHEET` — `[pure]`

> **Note on the Bills engine:** `buildRuleFromBillRow_` / `generateOccurrences_` are
> pure date functions, so scenarios 6–10 can assert occurrence math **directly**
> with high confidence even before the ss-injection seam — making Bills Recurrence
> the best early ROI.

**Cheap early win (build alongside 6–10):**
- **Security / Safety (Level 17)** — `SECURITY-PROTECTED-WORKBOOK-REFUSAL`,
  `SECURITY-HARNESS-DISPOSABLE-ONLY`, `SECURITY-FAIL-CLOSED` are mostly **[pure]**
  guard assertions against known IDs/flags. They protect the writer subsystem itself
  and have very low cost — worth landing early.

**Later phases (whole-system → non-functional → gates), after the enablers land:**

16. **System Integrity (Level 11)** — `SYSTEM-NET-WORTH` first (flagship whole-model
    reconciliation on Family A), then `-ASSET-/-LIABILITY-/-NO-DOUBLE-COUNTING/-CASHFLOW/-DASHBOARD-RECONCILIATION`. `[needs func]`
17. **Multi-Year (Level 12)** — `MULTIYEAR-YEAR-ROLLOVER` first (highest risk). `[needs func]`
18. **Edit/Delete (Level 13)** — per module, reusing Family A builders. `[needs seam]`
19. **Performance/Stress (Levels 9+15)** — `PERF-1000-ACTIVITY-ROWS` first (guards REG-007). `[pure]`
20. **Import/Migration (Level 14)** — `MIGRATION-LEGACY-WORKBOOK` + `MIGRATION-CENTRAL`. `[pure]`
21. **Recovery breadth (Level 8)** — remaining `RECOVERY-*` beyond the cash-flow smoke.
22. **UI (Level 16)** — **manual checklist first**; automated UI harness is a separate future capability (§8).
23. **Release Readiness aggregation (Level 10)** → **Release Certification gate (Level 18)** — built last; makes the suite the required release gate.

---

## 8. Open questions about module behavior (resolve before implementing)

These must be answered so scenarios assert *correct* behavior rather than codifying
assumptions:

1. **Income cadence.** Income has **no** weekly/biweekly/semi-monthly/one-time model
   — it is monthly Cash Flow rows, and the management path hardcodes `Monthly`.
   *Question:* should the Income suite (a) cover only monthly + multi-source +
   dashboard reflection now, and (b) defer weekly/biweekly/semi-monthly/one-time
   until an income-cadence feature exists? (Recommended: yes.)
2. **Dashboard house count.** `getDashboardSnapshot()` exposes aggregated
   `houseValues/houseLoans/houseEquity` but **no explicit house count**. *Question:*
   assert the count via `getHousesFromHouseValues_()` / `getHouseNamesFromHouseAssets_()`
   instead, or is a dashboard count expected to be added?
3. **Retirement determinism / growth assumptions.** Are the retirement projection
   outputs fully deterministic from seeded assumptions (no time-based or random
   inputs)? Needed to assert exact numeric outputs vs. tolerance ranges.
4. **AutoPay time-dependence.** AutoPay writes only when the due date has passed
   within the rolling window. *Question:* what "today" does the harness inject so
   AutoPay scenarios are deterministic (fixed clock vs. seeding past-due dates)?
5. **31st-of-month & boundary expectations.** Confirm the intended behavior for
   Due Day=31 in short months and for weekly/biweekly cadence across month/year
   boundaries (should be codified from `SESSION_NOTES.md → Recurrence Engine V2`).
6. **Manual Pay / paid-occurrence suppression.** Confirm the exact key
   (`markDashboardBillOccurrencePaid`, payee + due-date) the scenario must reproduce
   to suppress a specific occurrence.
7. **No-double-count invariant.** Confirm the authoritative net-worth formula
   (`cash + investments + houseValues − debt`) and that no module contributes twice
   (e.g., a mortgage counted in both `houseLoans` and `INPUT - Debts`).
8. **Functional-assertion tolerance.** Exact-equality vs. rounding tolerance for
   currency/percentage assertions (affects E0a).
9. **UI regression mechanism.** The harness is server-side and cannot assert DOM
   rendering. *Question:* is a headless/automated UI harness in scope, or does UI
   regression (Level 16) stay a **manual checklist** for beta?
10. **Performance thresholds.** What are the agreed per-operation time budgets
    (Bills Due, dashboard build, planner refresh) that Performance (Level 15) asserts
    and trend-tracks?
11. **Year-rollover determinism.** Confirm exactly what `createNextYearCashFlowSheet()`
    carries vs. resets (Active rows, amounts, Summary formulas) so Multi-Year
    (Level 12) asserts the intended clone behavior.
12. **Edit/Delete semantics.** Which modules support hard delete vs. soft-delete
    (`Active = No`) vs. undo (`deleteActivityLogRow`)? Needed so Level 13 asserts the
    correct lifecycle + orphan-cleanup per module.
13. **Release Certification inputs.** How are the non-executable gate inputs
    (Documentation-current, Known-Issues-signed-off) recorded and checked for
    Level 18 — manual sign-off, a checklist file, or a status field?

---

## 9. Recommended next implementation milestone

After this documentation: **Bills Recurrence Regression (Level 2), scenarios 6–10**,
built on the **pure** `generateOccurrences_` engine — highest correctness ROI, no
seam dependency — preceded by **Enabler E0a (functional-assertion capability)** so
occurrence outputs can be asserted. Land the cheap **Security/Safety guard tests
(Level 17)** in parallel to protect the writer subsystem. Once E0a proves the
assertion pattern and **E0b (ss-injection)** lands, the flagship whole-model guard
is **System Integrity `SYSTEM-NET-WORTH` (Level 11)** on the Family A fixture,
followed by the Dashboard, House, Multi-Year, and Retirement suites. Release
Certification (Level 18) is built last and becomes the required release gate.

---

## A. Appendix — reusable "Regression Discovery" prompt block

*Paste this block at the end of any future CashCompass implementation or bug-fix
prompt. Cursor should answer it as part of the task and propose test-coverage changes
(as `planned` candidates when not implementing them). Backed by the Regression
Discovery Policy above.*

```
======================================================================
REGRESSION DISCOVERY
======================================================================

For this change, identify:

1. Existing regression scenarios affected.
2. New REG-### historical regression needed, if this fixes a bug.
   - What exact behavior failed?
   - What exact assertion would catch it next time?
3. New forward-looking scenario candidates needed (mark planned vs implementable now).
4. Affected suite packs (check all that apply):
   - Smoke
   - Bills Recurrence
   - Income
   - Investments
   - Retirement
   - Houses / House Performance
   - Financial Ledger / Activity Log
   - Dashboard E2E
   - System Integrity
   - Multi-Year
   - Edit/Delete
   - Import/Migration
   - Recovery
   - Stress / Performance
   - UI
   - Security / Safety
   - Release Certification
5. Exact assertions that would catch this issue in the future
   (structural gate and/or numeric; exact-equality vs tolerance).
6. Whether each scenario can be implemented now or should be documented as planned.
7. Documentation updates required
   (REGRESSION_SUITE_PLAN.md / REGRESSION_SCENARIOS.md / others).
======================================================================
```

**Change-type shortcuts** (which policy questions to focus on — see the Regression
Discovery Policy):

| Change type | Focus questions |
|---|---|
| Bug fix | Policy §2 (map to `REG-###` / add new; exact failure + assertion) |
| New feature | Policy §3 (smoke + functional + dashboard + recovery + system-integrity) |
| Schema / workbook change | Policy §4 (Provisioning / Schema Evolution / Drift / Recovery) |
| Dashboard / summary change | Policy §5 (counts/totals · cross-sheet reconciliation · no-double-count) |
| Recurrence / date change | Policy §6 (weekly … year rollover · overdue · paid-occurrence) |
| Financial-calculation change | Policy §7 (exact numeric assertion · equality/tolerance · reconciliation) |

---

*(No scenarios are implemented by this document. No commit, push, or deploy.)*
