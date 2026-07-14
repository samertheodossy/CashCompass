# Test Harness / Regression Runner — Architecture

*The developer-only **writer/mutator** that drives scenarios against disposable
workbooks and asks the read-only **Validator** to confirm nothing broke.*

**Status:** **Foundation V1 implemented — editor + admin UI.** `test_harness_core.js`,
`test_harness_scenarios.js`, and `test_harness_report.js` exist: the full guard +
disposable-workbook lifecycle + `assertDisposableTarget_` + **one** SMOKE scenario
(Provision + one Donation row) + report shaping. It runs from the editor via
`testRunSmoke()` / `testRunSmokeTrash()` **and** from the Validation & Testing admin
console — a collapsible **Test Harness** card (writer) that runs the smoke scenario
with a Keep/Trash disposition, backed by the thin server wrappers
`vtListHarnessScenarios()` / `vtRunHarnessScenario()` (guarded by
`assertHarnessAllowed_()`; they never accept a client workbook ID and always create
the harness's own disposable workbook). Scenario packs, Regression/Recovery/Stress,
and Release Readiness remain unbuilt. Sequenced in `ROADMAP.md → P1` **after** the
Validator Phase 2 foundation: (1) Validator Phase 2A/2B → **(2) Test Harness
foundation *(V1 done)* → (3) Scenario packs → (4) Release Readiness gate**.

> **Two deviations the V1 implementation revealed (design corrections):**
> 1. **Marker primitive.** `PropertiesService.getDocumentProperties()` is scoped to
>    the script's *own* container document and cannot be attached to a workbook
>    created by this standalone script. V1 therefore uses the hidden `_HARNESS_META`
>    sheet (authoritative) **+ spreadsheet-level developer metadata**
>    (`addDeveloperMetadata`) as the forge-resistant markers, instead of Document
>    Properties (§2.2/§2.4 updated in spirit).
> 2. **Workflow-invocation seam.** The top-level create-a-workbook workflows
>    (`ensureInputDonationSheet_`/`addDonation`, `ensureCashFlowYearSheet_`, …)
>    resolve their workbook via `getUserSpreadsheet_()`, which has **no injection
>    seam** — calling them from the Harness could write to a REAL workbook. (Cash Flow
>    is the first to gain an ss-scoped core: `buildCashFlowYearSheet_(ss, year)` was
>    extracted from `ensureCashFlowYearSheet_`, so the Cash Flow integration scenario
>    now reuses the **exact** production builder — structure + all formatting — with no
>    harness duplication; only the `getUserSpreadsheet_()`-bound wrapper stays
>    off-limits.) V1 stays
>    inside the disposable target by invoking the workbook-SCOPED real seams
>    (`runMinimalBootstrap_(ss)`) and the exact **pure** row helpers `addDonation()`
>    uses (`findDonationBlockForTaxYear_` → `getDonationAppendRow1_` →
>    `buildDonationOutputRow_`, + `applyDonationSheetStyling_`). A future
>    ss-injection refactor (§9) will let scenarios call the top-level workflows
>    verbatim, closing the last fidelity gap.
> 3. **Harness bootstrap — SYS - Meta identity marker (Central-style by default).**
>    `runMinimalBootstrap_(ss)` provisions structure but does NOT stamp identity
>    markers (those live in the Central provision path via
>    `ensureWorkbookIdentityMarkers_`, which needs a fileId + email and writes global
>    side effects), so a harness workbook would otherwise validate as
>    `BOUND_LEGACY / UPGRADE_RECOMMENDED`. `runScenario_` therefore calls
>    `harnessStampIdentityMarkers_(ss, runId)` after setup/actions (unless
>    `scenario.createsLegacyStructure === true`). It stamps ONLY the in-workbook
>    `SYS - Meta` marker via the ss-scoped `ensureSysMetaMarker_` — deliberately NOT
>    the `ensureWorkbookIdentityMarkers_` orchestrator, because that also writes the
>    **global** reverse-index script property (`wbid::<id>`), which would pollute the
>    real mapping store AND make `assertDisposableTarget_` refuse the workbook, plus
>    Drive appProperties the Validator does not read. Result: a clean harness
>    workbook now reports **`CENTRAL_CURRENT / FULLY_CURRENT`**.
> 4. **Scenario-scoped validation.** A scenario only provisions the sheets it needs,
>    so judging it against the *full* canonical model produces misleading WARNs for
>    canonical sheets it never created (`LOG - Activity`, `Cash Flow`,
>    `SYS - Accounts`, `Bank Accounts`, `Upcoming Expenses`). Scenarios therefore
>    declare `expectedSheets` — the sheets they intentionally create — and
>    `runScenario_` forwards `{ sheetNames: expectedSheets }` to all three Validator
>    seams. This scopes the model **for this run only** via the shared
>    `validatorScopeModel_(model, options)` helper (in `validator_provisioning.js`,
>    reused by Drift and Schema) — it does **not** change global canonical rules, and
>    omitting `expectedSheets` still validates the full model. `SMOKE-PROVISION-DONATION`
>    scopes to `INPUT - Settings`, `INPUT - Donation`, `SYS - Meta` and now reports
>    **Provisioning PASS / WARN 0**. Fixture rows also use realistic short data
>    (charity `Local Food Bank`, comment `Smoke test donation`) — the workbook *name*
>    already carries the `— SAFE TO DELETE` marker, so rows stay representative and
>    un-clipped.

**Related docs:** `VALIDATOR_ARCHITECTURE.md` (the read-only judge — §10 Workbook
Health, §12 boundary), `REGRESSION_SCENARIOS.md` (the historical-bug registry /
permanent project memory), `RELEASE_READINESS.md` (the release report + workflow),
`VALIDATION_TESTING_CONSOLE.md` (the admin-only UI surface that drives
`runRegressionSuite` and renders the Release Readiness verdict), `ROADMAP.md`,
`ENGINEERING_STANDARDS.md`.

---

## 0. The boundary (non-negotiable)

| | **Validator** (`validator_*`) | **Test Harness** (`test_harness_*`) |
|---|---|---|
| Role | **Judges** workbook health | **Creates + exercises** disposable workbooks |
| Writes? | **Never** (getters only) | **Yes — only to disposable, test-marked workbooks it created** |
| Provisions / mutates / repairs? | Never | Yes, into disposable workbooks, via the **real production helpers** |
| Target | Any workbook the admin can read | **Only** disposable workbooks it created |
| Relationship | Called *by* the Harness | Calls the Validator after each scenario |

The Harness never touches the Canonical workbook, a real user workbook, or the
bound production workbook. The Validator never gains write power. They live in
**separate files** so the Validator's read-only guarantee (and its CI no-write
guard) stays absolute.

---

## 1. Test Harness lifecycle

```
                ┌─────────────────────────────────────────────┐
                │  runRegressionSuite(options)  (guarded)      │
                └─────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─── for each enabled scenario ───┐
         ▼                                                            │
1. Create disposable workbook   SpreadsheetApp.create(<test name>)    │
         │                       + write disposable marker            │
         ▼                                                            │
2. Provision                    real provisioning / ensure* helpers   │
         │                       (assertDisposableTarget_ before write)│
         ▼                                                            │
3. Run scenario                 scenario.setup() + scenario.actions[] │
         │                       (real production workflows)          │
         ▼                                                            │
4. Run Validator                validateActiveWorkbook()  READ-ONLY   │
         │                                                            │
         ▼                                                            │
5. Collect findings             compare to scenario.expectedOutcome   │
         │                                                            │
         ▼                                                            │
6. Continue / Stop              by stopOnSeverity threshold ──────────┘
         │
         ▼
7. Generate Release Readiness report      test_harness_report.js
         │
         ▼
8. Archive or delete workbook   trash (default) | keep-on-failure | archive
```

Each step is idempotent and resumable; a crash mid-suite leaves only clearly
marked disposable workbooks, cleaned by the sweep (§2).

---

## 2. Workbook management

Every write-side safety guarantee lives here. **Accidental execution against the
Canonical, a real user, or the production workbook must be impossible — fail
closed.**

### 2.1 Naming convention

```
CASHCOMPASS TEST — <pack>/<scenario> — <runId> — SAFE TO DELETE
```

- `runId` = `yyyymmdd-hhmmss-<4char random>` (unique per suite run; also the
  concurrency key, §2.6).
- The literal prefix `CASHCOMPASS TEST —` and suffix `SAFE TO DELETE` are
  **required** — the cleanup sweep and the disposable check both key off them.

### 2.2 Metadata (the disposable marker)

On creation the Harness stamps the workbook with a marker that is **hard to forge
and easy to verify**:

- **Document Properties** (`PropertiesService.getDocumentProperties()` on the new
  ss): `HARNESS_DISPOSABLE = "true"`, `HARNESS_RUN_ID = <runId>`,
  `HARNESS_CREATED_AT = <iso>`, `HARNESS_SCENARIO = <id>`.
- A hidden **`_HARNESS_META`** sheet with the same fields (human-visible proof +
  survives property edge cases).

### 2.3 Labeling

Beyond the name: an obvious top-row banner on the first sheet
(`⚠ DISPOSABLE CASHCOMPASS TEST WORKBOOK — SAFE TO DELETE — <runId>`) so a human
who stumbles on it in Drive cannot mistake it for real data.

### 2.4 Safe deletion (fail-closed target check)

`assertDisposableTarget_(ss)` runs **before every write** and before any
teardown/trash. **All** of the following must be true or it throws:

1. `HARNESS_DISPOSABLE === "true"` **and** `HARNESS_RUN_ID` matches the current run.
2. The workbook name starts with `CASHCOMPASS TEST —`.
3. The `_HARNESS_META` marker sheet exists and agrees.
4. The workbook ID is **not** any known production ID — explicitly refuse:
   - `VALIDATOR_GOLDEN_WORKBOOK_ID` (Canonical),
   - `VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID`,
   - any ID present in the Central user→workbook mapping,
   - the currently bound workbook (if any).

Unknown / ambiguous → **refuse** (fail closed). Teardown soft-deletes via the
Advanced Drive Service — `Drive.Files.update({ trashed: true }, id)` — **only**
after this check passes. It deliberately does **not** use
`DriveApp.getFileById().setTrashed()`: the project declares the narrow `drive.file`
scope (no `drive`/`drive.readonly`), under which `DriveApp.getFileById()` is not
permitted, whereas `Drive.Files.update` honors the per-file `drive.file` grant on
script-created workbooks.

### 2.5 Cleanup strategy

- **Per-run teardown:** trash each workbook after its scenario (unless
  `keepOnFailure` and the scenario failed, or `archive` is set).
- **Sweep:** a guarded `harnessCleanupStragglers()` finds workbooks whose name
  carries the required prefix **and** the disposable marker **and** are older than
  a threshold (e.g. 24h), and trashes them — never touching anything without the
  marker. Safe to run any time.

### 2.6 Multiple concurrent runs

- The `runId` isolates every run: names, markers, and teardown are all scoped to
  it, so two runs never collide or trash each other's workbooks.
- Optional `LockService.getUserLock()` around suite start to serialize a single
  developer's runs; cross-developer runs are naturally isolated by `runId` +
  ownership.

---

## 3. Scenario framework

Scenarios are **data**, not ad-hoc scripts.

### 3.1 Scenario model

```
Scenario {
  id,             // stable, e.g. 'SMOKE-PROVISION' or 'REG-014'
  category,       // 'SMOKE' | 'REGRESSION' | 'RECOVERY' | 'STRESS'
  executionLevel, // 'PURE' | 'INTEGRATION' | 'E2E' — what a tester should EXPECT
                  //   (see the classification table below; single source of truth is
                  //   HARNESS_EXECUTION_LEVELS_ + harnessExecutionLevelInfo_ in
                  //   test_harness_scenarios.js). Surfaced in the console UI + report.
  description,    // human summary
  prerequisites,  // other scenario ids / capabilities that must pass first
  setup(ctx),     // build initial state via REAL production helpers + fixtures
  actions(ctx),   // the workflow(s) under test (real production functions)
  expectedSheets, // sheets this scenario creates → scopes validation to just these
                  //   (V1, via validatorScopeModel_); omit to validate the full model
  expectedOutcome,// declarative: expected Validator gate + allowed/expected findings
  validatorChecks,// which Validator modules to run (default: all) + scope
  cleanup(ctx)    // scenario-specific teardown (workbook teardown is automatic)
}
```

- `ctx` carries the disposable `ss`, the `runId`, and the fixture-data API.
- `setup`/`actions` **call shipping code** (ensure*/apply*/write*/quick-add/import/
  rollover) — scenarios **never reimplement** behavior, only invoke it, so drift
  from production is impossible.
- `expectedOutcome` lets a scenario assert either "clean PASS" or "these specific
  findings are expected" (e.g. a recovery scenario that intentionally starts
  corrupted and expects the Validator to detect it, then re-heals and expects PASS).

**Execution level (`executionLevel`).** Orthogonal to `category`, this tells a tester
what to expect from the disposable workbook a run produces. It is surfaced in the
Workbook Health console (pill on the scenario dropdown + result summary) and the human
report. Single source of truth: `HARNESS_EXECUTION_LEVELS_` in
`test_harness_scenarios.js`.

| Level | Workbook expectation | Example scenarios |
|---|---|---|
| **PURE** | Minimal disposable workbook. **No visual inspection expected.** Validates algorithms only. | `REGRESSION-BILLS-MONTHLY` / `-WEEKLY` / `-WEEKLY-ON-DAY` / `-BIWEEKLY` (recurrence-engine math) |
| **INTEGRATION** | **Visible workbook artifacts expected.** Intended for workbook inspection. Validates production sheet behavior. | `REGRESSION-BILLS-MONTHLY-INTEGRATION`, `REGRESSION-BILLS-MONTHLY-CASHFLOW`, `SMOKE-PROVISION-DONATION` |
| **E2E** | Validates a complete feature workflow — workbook + dashboard + activity log + cash flow + summaries. | *(none yet; reserved)* |

**Integration Scenario Principle.** Integration scenarios must exercise **production
code whenever it is safely possible** — an integration scenario only earns confidence
when the workbook it produces is built by the *same* code production runs. Preference
order (use a lower option only after ruling out the ones above):

1. **Pure production functions** (deterministic, no I/O — e.g. the recurrence engine).
2. **Sheet-scoped production helpers** (take a `Sheet` — e.g. `insertCashFlowRow_`,
   `applyCashFlowSheetStyling_`, `ensureCashFlowSummaryRow_`).
3. **Spreadsheet-scoped production helpers** (take an explicit `ss`, never resolve their
   own workbook — e.g. `buildCashFlowYearSheet_(ss, year)`, `appendActivityLog_(ss, …)`).
4. **Small helper extraction from production** — when only a `getUserSpreadsheet_()`-bound
   wrapper exists, extract its ss-scoped core (behavior-preserving) and have the wrapper
   delegate, then reuse the core; **never copy** the logic. (`buildCashFlowYearSheet_`
   was extracted from `ensureCashFlowYearSheet_` this way.)
5. **Harness-specific implementation — last resort only, with documented justification**
   (permitted only when extraction is unsafe/unreasonable; document *why* in the scenario).

The safety constraints in the fidelity notes above are never traded away for fidelity:
no `getUserSpreadsheet_()`-bound calls from the harness, no broadened access, no touching
the Central default / bound workbook, no formatting wash over populated workbooks. When
fidelity and safety conflict, safety wins and the gap is documented. Full standard:
`ENGINEERING_STANDARDS.md §13`.

### 3.2 Categories

- **SMOKE** — fast happy-path coverage of the critical create/provision paths; run
  on every suite invocation.
- **REGRESSION** — one scenario per historical production bug (see §5 +
  `REGRESSION_SCENARIOS.md`); each fixed bug becomes permanent.
- **RECOVERY** — deliberately damaged workbooks (missing sheets/rows, partial
  corruption); assert the Validator detects the damage and, after re-running
  provisioning/self-heal, assert it clears.
- **STRESS** — scale/performance (large activity logs, many accounts/properties,
  multi-year workbooks); asserts health + records timing for the Performance line
  of the Release Readiness report.

---

## 4. Scenario packs

> **Full E2E suite roadmap → `REGRESSION_SUITE_PLAN.md`.** That doc specifies the
> **eighteen packs** in four bands (Foundational: Smoke · Bills Recurrence · Income ·
> Investments · Retirement · Houses · Financial Ledger/Activity Log — Whole-system:
> Dashboard E2E · System Integrity · Multi-Year · Edit/Delete — Non-functional:
> Stress · Performance · UI · Security/Safety — Recovery & gates: Recovery ·
> Import/Migration · Release Readiness · Release Certification), the per-module
> coverage matrices, reusable fixture families, the scenario-model contract, the
> recommended build order, and the two cross-cutting enablers (a functional-assertion
> capability + the ss-injection refactor). This section is the summary; the plan is
> the source of truth for *what to build next*.

Packs group scenarios by category and let a run enable a subset. Target coverage:

- **Smoke:** Provision · Settings · Cash Flow · Bills · Donation (+ Bank Accounts,
  Upcoming Expenses as they stabilize).
- **Regression:** every historical bug fixed to date (§5).
- **Recovery:** Missing sheets · Missing rows · Partial corruption · Corrupted
  header row · Central-resolution failure surfaced (not masked).
- **Stress:** Large activity logs · Many accounts · Many properties · Multi-year
  workbooks · Large imports.

Per-family functional coverage grows over time: onboarding, profile/settings, bank
accounts, cash flow, bills, quick add payment, upcoming expenses, donations,
houses, loans / house financial accuracy, imports, rolling debt payoff, year
rollover.

---

## 5. Historical bug registry (`REGRESSION_SCENARIOS.md`)

Every production bug fixed becomes a permanent **Regression Scenario ###**. The
registry is **permanent project memory** — a bug that has a scenario can never
silently return. Each entry records:

- **Regression Scenario ID** (`REG-###`)
- **Bug title**
- **Date discovered**
- **Root cause**
- **Expected Validator result** (what the scenario asserts after the fix)
- *(plus: affected files, the repro fixture in `test_harness_data.js`, and status)*

The registry format, workflow ("fix a bug → add a scenario"), and the seeded
initial entries (Central-migration `getActiveSpreadsheet()`-null class, etc.) live
in **`REGRESSION_SCENARIOS.md`**. `test_harness_scenarios.js` implements the
`REGRESSION` pack from that registry.

> **Coverage grows by policy, not by luck.** The **Regression Discovery Policy**
> (`REGRESSION_SUITE_PLAN.md`) requires every bug fix / feature / schema / dashboard /
> recurrence / financial-calc change to identify new & affected scenarios, packs, and
> assertions — via the reusable **Regression Discovery** prompt block
> (`REGRESSION_SUITE_PLAN.md → §A`) appended to future task prompts.

---

## 6. Release Readiness (`RELEASE_READINESS.md`)

The suite aggregates every scenario's Validator result into a single go/no-go
report:

```
Provisioning            PASS
Schema                  PASS
Formula                 PASS
Conditional Formatting  PASS
Regression              PASS
Performance             PASS
──────────────────────────────
Overall                 READY FOR BETA
```

- Each line = worst severity across the scenarios that exercise that dimension.
- **Overall gate:** `READY` only when no line is FAIL (WARN allowed with sign-off).
- The report template, severity/scoring rules, and the pre-release workflow live in
  **`RELEASE_READINESS.md`**; `test_harness_report.js` produces it (reusing the
  `Finding`/severity model + chunked log/JSON shaping from `validator_report.js`).

---

## 7. File layout

```
test_harness_core.js       # guard + disposable-workbook lifecycle + run loop
test_harness_scenarios.js  # declarative scenario packs (SMOKE/REGRESSION/RECOVERY/STRESS)
test_harness_data.js       # synthetic fixture-data generators + historical-bug repro data
test_harness_report.js     # Release Readiness report aggregation
validator_health.js        # (Validator, read-only) the health entry the harness calls
```

**Public (guarded) entry points** — `test_harness_core.js`:

> **Implemented today (V1):** `testRunSmoke(options)` and the no-arg convenience
> `testRunSmokeTrash()` (forwards `{ trash: true }`). These are the current editor
> runners; the console reaches the same scenario via `vtRunHarnessScenario()`. The
> multi-suite entry points below are the planned end state and are **not** built yet.

- `runRegressionSuite(options)` — `{ enabledPacks, stopOnSeverity, keepOnFailure,
  archive }`.
- `harnessRunSmoke()` / `harnessRunRegression()` / `harnessRunAll()` — no-arg dev
  runners (editor Run dropdown).
- `harnessCleanupStragglers()` — guarded sweep.

**Internal helpers:** `assertHarnessAllowed_`, `createDisposableWorkbook_`,
`assertDisposableTarget_`, `runScenario_`, `teardownDisposableWorkbook_`,
`archiveDisposableWorkbook_`.

---

## 8. Guard model (stronger than the Validator — because it writes)

Layered, fail-closed, mirroring the Validator guard but **stricter**:

1. **Flag gate** — `TEST_HARNESS_ENABLED` script property (default **off**);
   `assertHarnessAllowed_()` throws unless it equals `"true"`. Separate from
   `VALIDATOR_ENABLED`.
2. **Admin identity gate** — reuse `isAdminUser_()` (`ADMIN_EMAILS` /
   `BETA_CONTACT_EMAIL`).
3. **Disposable-target gate** — `assertDisposableTarget_` before every write (§2.4).
4. **No automatic runtime wiring** — never called from `doGet`, `onOpen`, a menu,
   or a trigger. It runs only on an explicit, guarded request: a manual editor Run
   (`testRunSmoke()` / `testRunSmokeTrash()`) **or** an admin action in the
   Validation & Testing console (`vtRunHarnessScenario()`, itself
   `assertHarnessAllowed_()`-guarded). No path invokes it as a side effect of
   loading the app.
5. **Default-off** — inert unless an admin explicitly enables it.

### Script properties

| Property | Required | Purpose |
|---|---|---|
| `TEST_HARNESS_ENABLED` | yes (to enable) | Must equal `"true"`; else inert. |
| `ADMIN_EMAILS` (or `BETA_CONTACT_EMAIL`) | yes | Admin allow-list (`isAdminUser_()`). |
| `VALIDATOR_ENABLED` | yes | The Harness calls the Validator, which has its own gate. |
| `VALIDATOR_GOLDEN_WORKBOOK_ID` / `VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID` | yes | Read by `assertDisposableTarget_` to **refuse** these IDs. |

### Scope note

Unlike the Validator (no new OAuth scope), the Harness needs **create/trash**
(Drive) — but the app already creates and trashes workbooks for Central
provisioning (`central_provisioning.js`), so no new consent surface is introduced.
The extra power is contained by the guard above, not by scope.

---

## 9. Reuse opportunities

- **Provisioning:** `central_provisioning.js` (`provisionWorkbookForUser_`,
  `runMinimalBootstrap_`) and the `sheet_bootstrap.js` registry + `ensure*Sheet_`
  helpers to build initial state through real code paths.
- **Workflows under test:** the shipping feature functions (bills/recurrence, quick
  add payment, imports `bank_import.js`, rolling debt payoff, year rollover,
  donations, houses).
- **Judging:** `validator_health.js` (§10 of `VALIDATOR_ARCHITECTURE.md`).
- **Reporting:** `validator_report.js` `Finding`/severity model + chunked
  log/JSON shaping.
- **Guarding:** the `assertValidatorAllowed_` / `isAdminUser_` pattern.

---

## 10. Recommended implementation order

1. **Validator Phase 2A/2B first** (Provisioning + Schema) — the judge must exist.
2. **Harness foundation** — `test_harness_core.js` lifecycle + full guard +
   `assertDisposableTarget_` + **one** SMOKE scenario (Provision) +
   `test_harness_report.js` skeleton. **Prove the safety model end-to-end on a
   single disposable workbook before adding any breadth.**
3. **Smoke pack** — Settings, Cash Flow, Bills, Donation.
4. **Regression pack** — stand up `REGRESSION_SCENARIOS.md`; seed with the known
   historical bugs; add scenarios as bugs are fixed going forward.
5. **Recovery pack**, then **Stress pack**.
6. **Release Readiness gate** — `RELEASE_READINESS.md` + aggregation + the pre-beta
   go/no-go threshold.

---

## 11. Risks

- **Accidental write to a real / Canonical workbook (highest).** *Mitigation:*
  multi-factor `assertDisposableTarget_` (marker + name + meta sheet + explicit
  production-ID refusal), fail-closed, run before **every** write.
- **Orphaned test workbooks in Drive.** *Mitigation:* mandatory naming + per-run
  teardown + marker-based cleanup sweep.
- **6-minute execution limit** across many scenarios. *Mitigation:* one pack at a
  time, resumable scenarios, scoped Validator runs.
- **Drive create/trash quota.** *Mitigation:* lean suites; optional small reuse pool.
- **Scenario drift from production.** *Mitigation:* scenarios call **real**
  production functions; never reimplement.
- **Flaky teardown leaving state.** *Mitigation:* keep-on-failure for debugging +
  idempotent sweep.
- **Concurrency collisions.** *Mitigation:* `runId` isolation + optional user lock.
- **Stronger power than the Validator.** *Mitigation:* separate flag, admin gate,
  default-off, no runtime wiring, CI guards keeping harness writes out of
  `validator_*` and every hot-path file.
