# Functional Assertion Framework — Architecture / Design

*The Test Harness layer that judges **functional, business-logic, and financial
correctness** — the numeric counterpart to the read-only Validator's structural
checks. This is the foundation (enabler **E0a**) that every future regression
scenario builds on.*

**Status:** **Design of record — Slices 1–4 implemented (pipeline + read layer +
presence assertions + `dateEquals` and the first real regression scenario); later
slices design only.** The end-to-end pipeline exists (`test_harness_assert.js`:
`assertEquals_` + `assertExists_` + `assertDateEquals_` + `makeAssertionCollector_()`
exposing `equals` / `exists` / `notExists` / `dateEquals`; `test_harness_read.js`:
`makeReadLayer_` → `ctx.read.sheetValue` / `ctx.read.sheetRange`; `ctx.read` +
`ctx.assert` + `expectedOutcome(ctx)` in `runScenario_`; the `functional` report
section + gate in `test_harness_report.js`; a scenario registry
(`getHarnessScenarios_` / `getHarnessScenarioById_`) run via `testRunScenarioById_`
and the console; `SMOKE-PROVISION-DONATION` asserts *Donation sheet exists* +
*amount == 100*, and **`REGRESSION-BILLS-MONTHLY`** asserts the pure recurrence
engine's occurrence count + prior/next occurrence + one-month advancement via
`dateEquals`; a Functional card in `ValidationTestingUI.html`). Everything else in
this document — `near`/`reconciles`, the richer temporal comparators, the richer
readers, clock, seed profiles, categories, and the remaining §17 slices — is still
design only. The Bills recurrence engine is already deterministic (explicit
`todayOnly` anchor), so **no clock seam (E0c) was required**. The Validator remains
read-only and untouched. Sits on top of `TEST_HARNESS_ARCHITECTURE.md` (the writer) and
`REGRESSION_SUITE_PLAN.md` (§1 structural-vs-functional split, §5 scenario model,
E0a in the build order).

---

## 0. Scope & non-goals

**In scope (design):** how a scenario declares what a *correct* result looks like,
how those checks are evaluated and reported, and how they aggregate scenario → pack →
suite.

**Explicit non-goals (unchanged by this doc):**
- The **Validator stays read-only and structural.** Assertions never live in
  `validator_*`; they never give the Validator write power or numeric responsibility.
- No change to the **disposable-workbook safety model** (`assertDisposableTarget_`,
  flag + admin gate). The write gate `ctx.assertWritable()` is untouched and remains
  distinct from functional assertions (see §6 naming note).
- No Bills recurrence, no scenario packs, no UI edits, no runtime wiring — all later.

---

## 1. Responsibility split (why this is a separate layer)

The suite must judge **two different kinds of truth**. The Validator already owns the
first; this framework owns the second.

| Layer | Judged by | Read/write | Example |
|---|---|---|---|
| **Structural / health** | Validator (`validateProvisioning_` / `validateDrift_` / `validateSchemaEvolution_`), scenario-scoped via `expectedSheets` | read-only | required sheet present, headers correct, `CENTRAL_CURRENT / FULLY_CURRENT` |
| **Functional / numeric** | **Harness assertions** in `expectedOutcome(ctx)` | read-only reads of shipping getters + pure compare | dashboard `netWorth` equals expected; Bills next occurrence date; assets − liabilities reconcile |

**Key principle — separate *reading* from *comparing*.** Assertions themselves are
**pure comparators** (no I/O). A scenario first *reads* an actual value (via a
shipping getter or a sheet read), then *compares* it to an expected value. This makes
the comparator library deterministic and unit-testable, and keeps all getter-name
coupling in one thin read layer.

```
seedData ──setup──▶ disposable workbook ──actions──▶ mutated workbook
                                                        │
                              ctx.read.* (shipping getters, read-only)
                                                        │  actual values
                                                        ▼
                    expectedOutcome(ctx): ctx.assert.equals/near/... (pure compare)
                                                        │  assertion results
                                                        ▼
                              functional section of the scenario report
```

---

## 2. Three-layer model

1. **Sources (read layer)** — `test_harness_read.js`. Thin, read-only wrappers that
   return an `actual` value (or collection) from the disposable `ss`. One place that
   knows the shipping getter names, so a getter rename touches one file:
   - `ctx.read.sheetValue(sheetName, row, column)` — a single cell. *(implemented — Slice 2)*
   - `ctx.read.sheetRange(sheetName, row, column, numRows, numCols)` — a 2-D array. *(implemented — Slice 2)*
   - `ctx.read.dashboard()` — `getDashboardSnapshot(ss)` (subject to E0b, §13). *(future)*
   - `ctx.read.billsDue()` — `getBillsDueFromCashFlowForDashboard(ss)`.
   - `ctx.read.propertyPerformance()` — `getPropertyPerformanceData(ss)`.
   - `ctx.read.retirementSummary()` — `getRetirementSummarySafe_(ss)`.
   - `ctx.read.jsonPath(obj, 'a.b[0].c')` — safe dotted/indexed lookup.
   Readers never throw on missing data; they return `undefined` (so `exists` can catch
   it) plus a `location` string for reporting.

2. **Comparators (assert layer)** — `test_harness_assert.js`. Pure functions that take
   `(actual, expected, opts)` and return an **assertion result** (§5). No I/O.

3. **Collector** — `makeAssertionCollector_()` → `ctx.assert`. Accumulates results as
   the scenario calls `ctx.assert.equals(...)`, tags each with `module`/`label`, and
   exposes `.results` for the report builder. This lets one `expectedOutcome(ctx)`
   register many checks and compute expecteds from `seedData` at runtime.

---

## 3. Assertion vocabulary (answers design-question 1 & 6)

A **small, composable** set — richer semantics come from combining these, not from a
sprawling API. Each returns an assertion result (§5).

| Method (`ctx.assert.`) | Signature | Use for |
|---|---|---|
| `equals` | `(label, actual, expected, opts)` | exact match: integers, strings, booleans, enums, counts *(implemented — Slice 1)* |
| `near` | `(label, actual, expected, opts{tolerance})` | **currency / percentage / floats** — tolerance compare (§4) |
| `isTrue` / `isFalse` | `(label, actual, opts)` | boolean flags (`Active`, AutoPay pending, `isOverdue`) |
| `exists` / `notExists` | `(label, actual, opts)` | presence/absence (row created, cell populated, no orphan) *(implemented — Slice 3)* |
| `contains` | `(label, haystack, needle, opts)` | substring, array membership, "collection includes X" |
| `count` | `(label, collection, expected, opts)` | length equality (sugar over `equals` on `.length`) |
| `dateEquals` | `(label, actual, expected, opts)` | **calendar-date** equality (Bills next occurrence, due date) — compares year/month/day, ignores time-of-day *(implemented — Slice 4; `granularity` option deferred, day-only for now)* |
| `reconciles` | `(label, parts[], total, opts{tolerance})` | **cross-sheet / no-double-count**: `sum(parts) ≈ total` (System Integrity) |
| `advancesBy` | `(label, prev, next, interval)` | **recurrence advancement** — asserts `next − prev` equals a cadence (`7d` / `14d` / `1mo` / `1yr`); temporal (§16) |
| `landsOnWeekday` | `(label, date, weekday)` | weekly-on-day correctness; temporal (§16) |
| `withinYear` | `(label, date, year)` | prev-year read vs current-year write boundaries; temporal (§16) |

Notes:
- **`exists` / `notExists` semantics (implemented — Slice 3):** `assertExists_(actual)`
  treats a value as **present** unless it is `undefined`, `null`, or a blank/whitespace-only
  string (`''`) — because the read layer (§2.1) returns `undefined` for a missing
  sheet/cell and Sheets returns `''` for an empty cell. Crucially, `0`, `false`, and
  `NaN` are **present** (real values, just falsy) — so `exists` never confuses a zero
  amount with a missing one. `notExists` is the exact inverse. Both take
  `(label, actual, opts)`, do no I/O, and pair naturally with `ctx.read.sheetValue(...)`.
- The last three are **temporal** comparators (see §16) layered on `dateEquals` — they
  exist so a failure reads *"advanced 14d not 7d"* instead of a bare `expected/actual`.
  They are still pure comparators; temporal is a **category tag**, not a parallel API.
- **`sheet value` / `dashboard value` / `JSON value` are *sources*, not comparison
  kinds** — they are produced by the read layer (§2.1) and then fed into a comparator.
  This keeps the vocabulary about *how to compare*, not *where the value came from*.
- **Recommended model:** namespaced collector methods (`ctx.assert.equals(...)`) as
  the primary API, backed by flat pure primitives (`assertEquals_`, `assertNear_`, …)
  in `test_harness_assert.js` that the collector wraps. This gives readable scenarios
  **and** independently unit-testable comparators. A future declarative sugar
  (`assertions: [{kind:'near', ...}]`) can compile down to the same primitives if
  desired — but the imperative `expectedOutcome(ctx)` form is the recommended base
  because it scales to reconciliation and seed-derived expecteds.

---

## 4. Tolerance policy (answers design-question 6: exact vs tolerance)

Default per value type; every call may override via `opts.tolerance`.

| Value type | Default comparison | Rationale |
|---|---|---|
| Integer / count | **exact** (`equals`) | counts are exact by definition |
| String / enum / boolean | **exact** (`equals`) | no rounding |
| Calendar date | **exact by granularity** (`dateEquals`, default `day`) | ignores time-of-day/timezone drift |
| **Currency** | **tolerance** (`near`, default **abs $0.01**) | float/rounding across sheets |
| **Percentage / rate** | **tolerance** (`near`, default **abs 0.0001**) | display rounding |
| Computed ratios | **tolerance** (`near`, caller sets) | model-dependent |

`near` supports **absolute** and/or **relative** tolerance (`{abs, rel}`); pass fails
only if it exceeds **both** when both are set. The exact default figures are ratified
in `REGRESSION_SUITE_PLAN.md → §8 open question 8` — this doc fixes the *mechanism*;
the numbers are a starting recommendation.

---

## 5. Assertion result envelope (answers design-question 3)

Every assertion — pass or fail — produces the same shape, so the report and UI are
uniform and failures are fully diagnosable:

```js
{
  id:        'BILLS-WEEKLY-NEXT-OCCURRENCE',   // stable, from label (slugified) or explicit
  module:    'Bills',                          // grouping key (§6)
  category:  'Temporal',                        // Numeric | Temporal | Reconciliation | Performance (§16)
  kind:      'dateEquals',                      // which comparator
  label:     'Weekly bill next occurrence',    // human text
  pass:      false,
  expected:  '2026-08-15',
  actual:    '2026-08-22',
  delta:     '+7 days',                         // numeric/temporal difference (null if N/A)
  tolerance: null,                              // effective tolerance used (null = exact)
  location:  "INPUT - Cash Flow 2026!D14 (via generateOccurrences_)", // where actual came from
  reason:    'Next occurrence advanced by 14 days instead of 7'       // why it failed (blank on pass)
}
```

- **expected / actual / delta / location / reason** are all present — the five things
  needed to debug a failure without re-running.
- `location` is supplied by the read layer (sheet!cell) or the getter path, so a
  failure points at the source of truth.

---

## 6. Scenario integration (answers design-questions 2 & 4)

**Assertions become part of the scenario definition** via a new `expectedOutcome(ctx)`
function — already the documented contract in `REGRESSION_SUITE_PLAN.md → §5`. The
recommended form is **a function** (not a static `assertions:[...]` array) because
expecteds are frequently computed from `seedData` and actuals are read at runtime:

```js
{
  id:            'BILLS-RECURRENCE-WEEKLY',
  category:      'REGRESSION',
  module:        'Bills',                 // default module for this scenario's assertions
  description:   'Weekly bill advances 7 days from the anchor.',
  clock:         '2026-08-08',            // frozen logical "today" for this run (§14)
  seedProfile:   'FamilyA',               // reusable base fixture (§15) …
  seedOverrides: { bills: [ /* only the one bill under test */ ] }, // … modify just this slice
  expectedSheets:[ 'INPUT - Bills', 'INPUT - Cash Flow 2026' ],
  actions:       function (ctx) { /* call shipping code against ctx.ss */ },
  expectedOutcome: function (ctx) {
    // (a) structural gate is still the Validator (Provisioning must PASS).
    // (b) functional numeric/temporal assertions (expecteds derived from ctx.clock):
    var occ = ctx.read.jsonPath(ctx.read.billsDue(), 'weekly.nextOccurrence');
    ctx.assert.dateEquals('Weekly bill next occurrence', occ, ctx.clock.addDays(7));
  }
}
```

- **Grouping by module (Q2): yes.** Each assertion carries a `module`; it defaults to
  the scenario's `module` and can be overridden per-assertion (`opts.module`). Reports
  group by module, then pack, then suite (§7). This is what lets the UI show
  `Bills · Weekly PASS / Monthly PASS / Biweekly FAIL`.
- **Naming note (avoid confusion):** `ctx.assertWritable()` remains the **safety write
  gate** (calls `assertDisposableTarget_`). The **functional** collector is
  `ctx.assert.*` — a distinct object on `ctx`. They never interact.
- `ctx` gains `{ read, assert, clock }` alongside the existing `{ ss, runId, actions,
  assertWritable }` — the harness-only clock (§14) and the reusable seed profiles
  (§15) make time-dependent, realistically-seeded scenarios deterministic.

---

## 7. Run-loop, gate, and aggregation (answers design-question 7)

**Run loop (`runScenario_`) — one added step, no behavior change to existing paths:**
after `actions(ctx)` and the Validator calls, if `typeof scenario.expectedOutcome ===
'function'`, run it inside the same try/catch; collect `ctx.assert.results`. A thrown
error in `expectedOutcome` is captured like any scenario error (→ FAIL), never
escapes.

**Gate change (in `buildHarnessScenarioReport_`):** the scenario `overall` becomes:

```
PASS  iff  no error  AND  Provisioning === PASS  AND  every functional assertion passed
```

Schema Evolution and Workbook Drift stay **advisory** (never fail). Functional
assertions are a **new gating dimension** next to Provisioning.

**Report envelope gains a `functional` section:**

```js
functional: {
  overall: 'FAIL',                  // PASS iff all pass
  counts:  { pass: 5, fail: 1 },
  byModule: { Bills: { pass: 2, fail: 1 }, Dashboard: { pass: 3, fail: 0 } },
  results: [ /* assertion result envelopes (§5) */ ]
}
```

**Aggregation scenario → pack → suite** (the future multi-scenario runner):

```
Scenario overall = worst(Provisioning gate, functional gate)     [Schema/Drift advisory]
Pack overall     = worst(scenario overalls in the pack)
Suite overall    = worst(pack overalls)
```

Each level reports counts + a rollup line, e.g.:

```
Smoke.........PASS
Bills.........FAIL   (1 of 6 assertions failed)
Income........PASS
Dashboard.....PASS
Overall.......FAIL
```

---

## 8. UI presentation (answers design-question 5) — design only

*No UI is changed by this doc.* When implemented, the harness card in
`ValidationTestingUI.html` gains a **Functional** status card beside Provisioning /
Schema / Drift, plus a per-module collapsible findings block — reusing the existing
status-grid + `details` pattern:

```
Functional ....... 🔴 5 pass · 1 fail

▾ Bills
   Weekly .......... 🟢 PASS
   Monthly ......... 🟢 PASS
   Biweekly ........ 🔴 FAIL
        expected  2026-08-15
        actual    2026-08-22
        Δ         +7 days
        where     INPUT - Cash Flow 2026!D14
▾ Dashboard
   Net worth ....... 🟢 PASS   (expected $125,000.00 · actual $125,000.00)
```

Failures show expected / actual / Δ / where inline; passes collapse to one line. The
raw JSON viewer already present shows the full `functional.results` array.

---

## 9. Files that would eventually be added (deliverable 2)

| File | Responsibility |
|---|---|
| `test_harness_assert.js` | **Pure comparators** (`assertEquals_`, `assertNear_`, `assertDateEquals_`, `assertReconciles_`, …) + tolerance defaults + the collector factory `makeAssertionCollector_()` → `ctx.assert`. No I/O. |
| `test_harness_read.js` *(created — Slice 2)* | **Read-only source helpers** → `ctx.read.*`. Shipped: `sheetValue` / `sheetRange` via `makeReadLayer_(ss)`. Future (same file): dashboard, bills due, property performance, retirement summary, `jsonPath`, cross-sheet readers. One place coupling to shipping getter names. |
| `test_harness_clock.js` | **Harness-only logical clock** (§14) → `ctx.clock` (`today`/`currentYear`/`setToday`/`freeze` + boundary helpers). Pure; no production dependency, no `new Date()` override. |
| `test_harness_data.js` *(already planned)* | Declarative `seedData` → workbook via real `ensure*` / pure builders. Assertions depend on deterministic seeds; listed for completeness. |
| `test_harness_profiles.js` | **Reusable seed profiles** (§15) → `getSeedProfile_` / `applySeedProfile_` / `composeProfiles_`. Base personas + modifier mixins; each profile is the single source of truth for both the seeded rows **and** the expected aggregates. |
| `test_harness_reconcile.js` *(later, Level 11)* | Specialized **System Integrity** recomputation (assets/liabilities/net-worth/cash-flow/no-double-count) built on `assert.reconciles`. Optional; can start inside scenarios. |

Existing files change **only** at integration time (not now): `test_harness_core.js`
(one `expectedOutcome` step in `runScenario_`), `test_harness_report.js` (the
`functional` section + gate), `ValidationTestingUI.html` (the Functional card).

---

## 10. Example assertion report (deliverable 4)

**JSON (scenario level):**

```json
{
  "type": "harnessScenario",
  "scenario": { "id": "BILLS-RECURRENCE", "category": "REGRESSION", "module": "Bills" },
  "overall": "FAIL",
  "validators": { "provisioning": { "overall": "PASS" }, "schema": {"...": "advisory"}, "drift": {"...": "advisory"} },
  "functional": {
    "overall": "FAIL",
    "counts": { "pass": 2, "fail": 1 },
    "byModule": { "Bills": { "pass": 2, "fail": 1 } },
    "results": [
      { "module":"Bills","kind":"dateEquals","label":"Weekly","pass":true,"expected":"2026-08-15","actual":"2026-08-15" },
      { "module":"Bills","kind":"dateEquals","label":"Monthly","pass":true,"expected":"2026-09-01","actual":"2026-09-01" },
      { "module":"Bills","kind":"dateEquals","label":"Biweekly","pass":false,"expected":"2026-08-15","actual":"2026-08-22","delta":"+7 days","location":"INPUT - Cash Flow 2026!D14","reason":"advanced 14d not 7d" }
    ]
  },
  "gate": { "basis": "Provisioning PASS + all functional assertions PASS; Schema/Drift advisory" }
}
```

**Human log (scenario):**

```
Functional results (Bills):
  Weekly ....... PASS
  Monthly ...... PASS
  Biweekly ..... FAIL   expected 2026-08-15  actual 2026-08-22  (Δ +7 days)  @ INPUT - Cash Flow 2026!D14
OVERALL ......... FAIL
```

**Suite rollup (future multi-pack run):**

```
Smoke........PASS
Bills........FAIL
Income.......PASS
Dashboard....PASS
Overall......FAIL
```

---

## 11. Advantages & tradeoffs (deliverable 5)

**Advantages**
- **Clean responsibility split** — Validator stays read-only/structural; numeric truth
  lives in the harness, matching the plan's two-truths model.
- **Pure comparators** — deterministic, no I/O, independently unit-testable; the read
  layer isolates all getter coupling to one file.
- **Uniform result envelope** — every failure carries expected/actual/Δ/where/why, so
  the log, JSON, and UI are consistent and debuggable.
- **Scales to all packs** — the same `equals/near/dateEquals/reconciles` vocabulary
  covers Bills dates, Income/Dashboard totals, House equity, Retirement projections,
  and System-Integrity reconciliation; grouping-by-module drives the rollup.
- **Additive** — one optional step in `runScenario_`; existing SMOKE and the Validator
  path are unchanged when `expectedOutcome` is absent.

**Tradeoffs / risks**
- **Depends on E0b (ss-injection)** for the high-value getters that resolve their own
  workbook (`getDashboardSnapshot`, bills-due, property, retirement). Until then,
  assertions are limited to `[pure]` sources (direct sheet reads + pure engines like
  `generateOccurrences_`). Flagged per-scenario as `[pure]` vs `[needs seam]`.
- **Tolerance policy must be ratified** (open question 8) to avoid false pass/fail on
  currency/percentages.
- **Expected values require determinism** — time-dependent logic (AutoPay "today",
  growth projections) needs an injected clock / seeded dates (plan §8 Q3, Q4).
- Slightly larger scenario authoring surface (`seedData` + `expectedOutcome`), but the
  payoff is real correctness coverage rather than structure-only checks.

---

## 12. Recommended first implementation step (deliverable 6)

> **Full slice-by-slice roadmap: §17.** This section is the *first* slice only; §17
> sequences every slice from the pipeline proof through profiles, reconciliation, and
> the clock.

**E0a, smallest vertical slice — prove the pipeline before Bills:**

1. Add `test_harness_assert.js` with the pure comparators + `makeAssertionCollector_()`
   and the result envelope (§5). Unit-testable with no workbook.
2. Add a minimal `test_harness_read.js` with **`sheetValue` / `sheetRange` / `jsonPath`
   only** (the `[pure]` sources that need no ss-injection).
3. Wire one optional `expectedOutcome(ctx)` step into `runScenario_` and a `functional`
   section + gate into `buildHarnessScenarioReport_`.
4. Add **one trivial assertion to the existing `SMOKE-PROVISION-DONATION`** scenario —
   e.g. `ctx.assert.near('Donation amount', ctx.read.sheetValue('INPUT - Donation', <amountCell>), 100)` —
   to prove read → compare → report → (later) UI end-to-end.

Only after this pipeline is green do we build **Bills Recurrence** on the pure
`generateOccurrences_` engine (the plan's next milestone). The richer getters +
`test_harness_data.js` fixtures follow once E0b lands.

---

## 13. Dependencies & open questions

- **E0b — ss-injection refactor** (`TEST_HARNESS_ARCHITECTURE.md → §9`,
  `REGRESSION_SUITE_PLAN.md → §2`): unblocks the dashboard/bills/property/retirement
  readers. E0a (this framework) can ship first with `[pure]` sources.
- **E0c — optional date-parameter seam** (§14): a *plain optional `Date`* on the few
  production functions whose own "today" must be exercised deterministically
  (defaulting to `new Date()`). Production never imports the harness clock — it just
  accepts an ordinary argument, exactly like the E0b `ss` seam. Most temporal coverage
  needs **no** production change (pure engines take an explicit `asOf`); E0c is only
  for wall-clock-driven behavior (e.g. AutoPay's due-window write).
- **Tolerance defaults** — ratify §4 figures (`REGRESSION_SUITE_PLAN.md → §8 Q8`).
- **Determinism** — the harness clock (§14) + seed profiles (§15) resolve the
  time-dependent / fixture questions (`REGRESSION_SUITE_PLAN.md → §8 Q3/Q4`).

---

## 14. Deterministic clock / temporal injection (Part 1)

**Core principle — the harness clock is harness-only and never overrides production
`new Date()`.** `ctx.clock` is a *logical* frozen "today" used by **scenario code**
to (1) generate seed dates, (2) compute expected values, and (3) pass an explicit
`asOf` into pure engines. It is not a global monkey-patch and production code has no
knowledge of it.

### 14.1 How production time-behavior is made deterministic (two mechanisms)

Because we may not silently change what production thinks "today" is, temporal
behavior is exercised one of two ways:

1. **Pure engine + explicit `asOf` (preferred, no production change).** The recurrence
   math lives in pure engines (`generateOccurrences_`, date helpers) that already take
   (or can take) an explicit reference date. The scenario passes `ctx.clock.today()`.
   Fully deterministic, needs nothing else. Flag: **`[pure-clock]`**.
2. **Optional date-parameter seam — E0c (only where wall-clock drives a *write*).** A
   few functions (e.g. AutoPay writing once the due date passes *now*) resolve their
   own `new Date()`. For those, add a **plain optional `Date` parameter defaulting to
   `new Date()`** — identical philosophy to the E0b `ss` seam. Production **does not
   depend on the harness clock**; it accepts an ordinary argument the harness happens
   to fill from `ctx.clock`. Flag: **`[needs clock seam]`**.

> This satisfies the constraint literally: the *clock abstraction* exists only in the
> harness; production gains at most an ordinary optional `Date` argument (no import of,
> or dependency on, the harness clock).

### 14.2 `ctx.clock` API (harness-only)

| Method | Returns | Purpose |
|---|---|---|
| `today()` | `Date` (midnight, script TZ) | the frozen logical date |
| `now()` | `Date` (with time) | when time-of-day matters |
| `currentYear()` | `number` | year of the frozen date |
| `iso()` | `string` | ISO of `now()` |
| `setToday(dateOrStr)` | — | move the frozen date |
| `freeze(dateOrStr)` | — | freeze (default: at scenario start) |
| `addDays(n)` / `addMonths(n)` / `addYears(n)` | `Date` | boundary math off `today()` |
| `startOfMonth()` / `endOfMonth()` | `Date` | month-boundary seeds/expecteds |
| `isLeapYear()` | `boolean` | Feb-29 logic |

### 14.3 Scenario config + determinism policy

- Scenarios declare an optional **`clock: '<yyyy-mm-dd>'`**; `runScenario_` freezes
  `ctx.clock` to it **before** `setup`. If absent, freeze to a fixed
  `HARNESS_DEFAULT_CLOCK_` constant (not real "now") so every run is reproducible.
- **Temporal scenarios must set `clock` explicitly** — reproducibility is required,
  not incidental.
- The clock governs **seed dates + explicit `asOf` args only**; it never changes a
  production `new Date()` unless that function was given the E0c seam.

### 14.4 Boundary coverage this enables

| `clock` | Exercises |
|---|---|
| `2026-12-31` | year rollover, month-end, current-year write vs next-year read |
| `2027-01-01` | new-year first day, previous-year lookups |
| `2028-02-29` | leap day, biweekly/weekly crossing Feb-29 |
| `2026-02-28` | non-leap Feb end |
| `2026-01-31` | 31st-of-month in a short following month |

Covers the temporal needs of **Bills Due (Weekly / Weekly-on-day / Biweekly / Monthly
/ Yearly), House Values, Dashboard, Retirement projections, Cash Flow, Activity Log,
and System Integrity** — via `[pure-clock]` wherever the engine takes an `asOf`, and
`[needs clock seam]` only for the rare wall-clock write path.

---

## 15. Reusable seed profiles (Part 2)

**A profile is a named, composable, declarative fixture** that provisions a realistic
disposable workbook — so a scenario seeds `FamilyA` and then mutates only the slice
under test instead of rebuilding dozens of rows.

### 15.1 Single-source-of-truth insight (why this is the key design point)

A profile's **declarative `seedData` is the single source of truth for both (a) what
rows get written and (b) the expected aggregates**. `applySeedProfile_` writes the
rows via real `ensure*`/pure builders; `expectedOutcome` derives its expecteds from
the **same** profile object (`profile.expected.netWorth`, `.monthlyBills`, …). Fixture
and expectation can never silently drift — the reconciliation target *is* the fixture.

### 15.2 Composition over a flat list (avoid combinatorial blow-up)

Rather than dozens of unrelated profiles, use **base personas + modifier mixins**:

| Kind | Names | Notes |
|---|---|---|
| **Base personas** | `MinimalWorkbook`, `SingleIncome`, `DualIncome`, `LargeFamily`, `HighNetWorth` | starting realistic states |
| **Modifier mixins** | `+RetirementHeavy`, `+DebtHeavy`, `+InvestmentHeavy`, `+RentalPropertyOwner` | layer onto any base |
| **Named compositions** | `FamilyA` = `DualIncome + RentalPropertyOwner`, `FamilyB` = `SingleIncome + DebtHeavy` | stable flagship fixtures for Dashboard / System Integrity, with fixed expected totals |

`RetirementHeavy` etc. are **composable** (`composeProfiles_('DualIncome',
'RetirementHeavy')`), not one-offs — the requested list maps onto base/mixin/alias.

### 15.3 Registry API

```js
getSeedProfile_(name, ctx)  // → { seedData, expected }  (expected derived from seedData; clock-relative dates)
applySeedProfile_(ctx, name, overrides)  // seed workbook + return resolved profile for assertions
composeProfiles_(base, ...mixins)        // layer mixins onto a base
```

- Profiles are **deterministic** — all dates come from `ctx.clock` (§14); no
  `Math.random()` (if a large profile ever needs generated rows, use a seeded PRNG —
  §18.1).
- Scenarios reference `seedProfile` + `seedOverrides` (or a `mutate(ctx)` step) to
  change only the relevant data (the `FamilyA → one modified bill → assert` flow).
- Built on `test_harness_data.js`; `actions(ctx)` still calls shipping code.

### 15.4 Profile versioning & immutability (document now; zero initial cost)

**Recommendation: document a lightweight versioning *convention* now — do not build
version-resolution machinery.** Once dozens of `REG-###` and functional scenarios pin
`FamilyA`, silently changing that profile would shift every dependent expectation.
Retrofitting versioning later is a painful, cross-cutting change; establishing the
convention now costs nothing because v1 is the only version.

The simplest forward-compatible design:

- **`version` metadata on the profile object** (an integer) plus `name`, `description`.
  Not a "profile schema version" and not a separate registry — just a field.
- **Published profiles are immutable.** Never mutate a released profile's composition;
  a breaking change ships as a **new version** (`FamilyA` v2) with v1 left intact.
  Regression scenarios that need stability keep pinning v1.
- **Default resolves to latest; pin only when stability matters.**
  `seedProfile: 'FamilyA'` → latest; `seedProfile: 'FamilyA', profileVersion: 1` → pinned.
- **Provenance in the report.** The scenario report records the resolved
  `profile.name` + `version`, so a functional failure is attributable to a profile
  version.

> **Why this does not complicate initial implementation.** With a single version, the
> resolver is "return the profile"; `profileVersion` defaults to latest and needs no
> lookup logic until a v2 actually exists. Slice 7 (§17) ships `FamilyA` **v1** with a
> `version` field and nothing more. The machinery arrives only if/when a v2 is needed.

- **Separate axis — profile *schema-generation* targeting (future note, §18.2):** the
  *data* version (v1→v2) is distinct from the workbook *schema generation* a profile
  seeds against (ties to Schema Evolution). Kept as a future note, not initial scope.

---

## 16. Assertion categories — does Temporal deserve its own? (Part 3)

**Recommendation: yes — Temporal is its own *category*, implemented as a tag plus a
few semantic comparators, not a parallel framework.**

- **Categories are a classification tag** on each assertion result
  (`category: Numeric | Temporal | Reconciliation | Performance`). *Structural* stays
  the Validator's job and appears as its own section in the combined report. The
  comparator set stays small; the category adds grouping, filtering, and per-category
  gating/tracking.
- **Why Temporal earns a category (not just `dateEquals`):** temporal correctness
  (recurrence advancement, month/year boundaries, leap year, prev-year read vs
  current-year write) is the **highest-risk** area and benefits from:
  1. **Semantic comparators** (`advancesBy`, `landsOnWeekday`, `withinYear` — §3) that
     encode *intent*, giving failures like *"advanced 14d not 7d"* instead of a bare
     date mismatch.
  2. A **report section** so the suite can show and trend temporal health distinctly
     (recurrence bugs are the most common class — REG-worthy).
  3. Natural pairing with the **clock** (§14): temporal assertions read `ctx.clock`.
- **Reconciliation** is likewise its own category (a cross-sheet subtype of Numeric)
  because no-double-count / net-worth identity deserves distinct visibility.
  **Performance** is a later category (timing assertions; needs a timing capability).

| Category | Backed by | Example |
|---|---|---|
| Numeric | `equals` / `near` | dashboard net worth, income totals |
| **Temporal** | `dateEquals` / `advancesBy` / `landsOnWeekday` / `withinYear` | weekly/biweekly advancement, year rollover, leap year |
| Reconciliation | `reconciles` | assets − liabilities = net worth; no double-count |
| Performance *(later)* | timing capability | Bills Due < N ms on 1000 rows |
| Structural | Validator (read-only) | required sheets/headers |

Report groups **by category, then module** (so the UI can show a Temporal section
across Bills/Cash Flow, or a Bills section across categories — both rollups from the
same tagged results).

---

## 17. Implementation roadmap — smallest vertical slices (Part 4)

Each slice ships a **runnable, useful** capability and de-risks the next. Tags:
`[pure]` buildable today · `[needs seam]` after E0b (ss-injection) · `[needs clock
seam]` after E0c.

| Slice | Adds | Proof / capability after this slice | Tag |
|---|---|---|---|
| **1 ✅ done** | `test_harness_assert.js`: `equals` + collector + result envelope; wire `ctx.assert` + `expectedOutcome(ctx)` into `runScenario_`; `functional` report section + gate; Functional UI card | **`assertEquals` — Donation amount == 100 → PASS** in the existing SMOKE scenario (pipeline proven end-to-end) | `[pure]` |
| **2 ✅ done** | `test_harness_read.js` pure sources (`sheetValue` / `sheetRange`) via `makeReadLayer_` → `ctx.read`; SMOKE now reads through `ctx.read.sheetValue` instead of inline (`jsonPath` + richer readers deferred) | assert any seeded cell/range without hand-reading; single read layer for all future functional assertions | `[pure]` |
| **3** | UI **Functional** status card + per-category/module findings block in `ValidationTestingUI.html` | functional results visible in the console (not just logs) | `[pure]` |
| **4** | `test_harness_clock.js` → `ctx.clock` (freeze/today/currentYear + boundary helpers); scenario `clock` config | deterministic dates for seeding + expecteds | `[pure]` |
| **5 ◑ started** | `dateEquals` (Temporal category) **✅ done** + the richer temporal comparators (`advancesBy`, `landsOnWeekday`, `withinYear`) *(deferred)* | **`dateEquals` — Bills recurrence** — **`REGRESSION-BILLS-MONTHLY` ✅ done** (Monthly, on the pure `buildInputBillDueCandidates_(todayOnly=…)` — no clock seam needed); Weekly/Biweekly/Yearly/etc. still to come | `[pure]` (engine takes explicit `todayOnly`) |
| **6** | `test_harness_data.js` fixture applier (`seedData` → workbook via real builders) | scenarios seed declaratively instead of hand-writing rows | `[pure]` |
| **7** | `test_harness_profiles.js`: `MinimalWorkbook` + `FamilyA` base + profile-derived `expected` | `FamilyA → modify one slice → assert` flow | `[pure]` |
| **8** | `reconciles` + Reconciliation category | **`reconciles` — Net Worth** (assets − liabilities) on FamilyA; no-double-count | `[pure]` |
| **9** | E0b ss-injection → rich readers (`dashboard`, `billsDue`, `propertyPerformance`, `retirementSummary`) | **Dashboard totals** agree with source sheets | `[needs seam]` |
| **10** | E0c optional date seam on the wall-clock write path(s) | deterministic AutoPay / due-window behavior | `[needs clock seam]` |
| **11** | Profile mixins (`RetirementHeavy` / `DebtHeavy` / `InvestmentHeavy` / `RentalPropertyOwner`) + named `FamilyB` | House/Retirement/Investment functional packs; richer System Integrity | `[pure]` / `[needs seam]` |
| **12** | Multi-year / year-rollover temporal scenarios; Performance timing category | year-boundary correctness; perf regression thresholds | `[pure-clock]` / later |

> **Shipped out of band:** `exists` / `notExists` (presence comparators, §3) were
> added right after the read layer — a tiny pure comparator that pairs with
> `ctx.read` (which returns `undefined` on absence). `SMOKE-PROVISION-DONATION` now
> makes **2 assertions** (`exists` Donation sheet + `equals` amount == 100). This is
> orthogonal to the UI slice below (still row 3) and needed no report/UI redesign.
>
> **First real regression scenario (Slice 4 / roadmap row 5 started):** `dateEquals`
> shipped **without a clock** because the Bills recurrence engine
> (`buildInputBillDueCandidates_`) already takes an explicit `todayOnly` anchor and
> does no `new Date()`. `REGRESSION-BILLS-MONTHLY` (`test_harness_scenarios_bills.js`)
> is the reference Bills scenario and the **template** for Weekly / Weekly-on-Day /
> Biweekly / Yearly / 31st-of-month / leap year / year-rollover / overdue / paid /
> AutoPay: minimal disposable workbook + pure-engine assertions with fixed dates. A
> tiny scenario **registry** (`getHarnessScenarios_` / `getHarnessScenarioById_`,
> run via `testRunScenarioById_`) now backs both the editor runners and the console
> dropdown, which auto-populates from `vtListHarnessScenarios()` (no HTML change).

**Risk-minimizing properties:** slices 1–3 prove the pipeline with zero temporal or
seam risk; the **clock (4) precedes Bills recurrence (5)** so recurrence is
deterministic from day one; **profiles (6–7) precede reconciliation (8)** so the
net-worth target is the fixture itself; the two **seams (9–10) are deferred** until
the pure capability is proven, and neither blocks earlier slices.

---

## 18. Future extension points (documented now, *out of initial scope*)

*These are design notes recorded while the architecture is still on paper, because
each one — if not anticipated — would force a cross-cutting redesign later. **None are
implemented; none change the slice scope in §17.** Each names the cheap "leave-room"
decision that keeps the door open.*

### 18.1 Deterministic-only fixtures / seeded PRNG *(design invariant — adopt now, build later)*
Fixtures must be **reproducible**. Small profiles are hand-declared (already
deterministic). If a large profile (`LargeFamily`, Stress) ever needs *generated*
rows, use a **seeded PRNG** (e.g. a tiny LCG seeded from a fixed constant, never the
`runId`), never `Math.random()`. *Leave-room decision:* state the invariant now
("fixtures are deterministic; generated data uses a seeded PRNG") so no scenario ever
introduces flakiness; a future `ctx.rand(seed)` helper is the only addition needed.

### 18.2 Profile schema-generation targeting *(future note)*
A profile could declare the **workbook schema generation** it seeds against (ties to
Schema Evolution's Workbook Type / Compatibility). *Leave-room decision:* keep the
`version` field (§15.4) a plain integer and let a future `schemaGeneration` field sit
beside it — do not overload one field for both axes.

### 18.3 Assumption sets — inflation / growth / retirement *(materially reduces redesign)*
Retirement and House projections depend on **growth, inflation, and contribution
assumptions**. Deterministic numeric assertions require these to be **explicit and
pinned**, not implicit. *Leave-room decision:* model them as a small **versioned
assumptions bundle** a scenario/profile references (e.g. `assumptions: 'RETIRE-BASE-v1'`),
following the exact same version+immutability convention as profiles (§15.4). This is
the most valuable future note — it prevents a Retirement-pack redesign — but stays
**out of initial scope** (the first temporal/numeric slices don't need it).

### 18.4 Locale / currency profiles *(light future note)*
CashCompass is single-currency/locale today. *Leave-room decision:* profiles *may*
carry an optional `locale` / `currency` field in future; until a multi-currency
product feature exists, **do not add the fields** — this note simply reserves the
extension so profiles aren't retrofitted.

### 18.5 Tax profile variants *(light future note)*
Donation already has a tax year; broader tax logic may follow. *Leave-room decision:*
tax assumptions would be a **mixin** (§15.2) and/or an assumptions bundle (§18.3), not
a new subsystem — recorded so the composition model absorbs it later.

> **Scope guard.** 18.1 and 18.3 are the two notes that *materially* reduce future
> redesign (they establish invariants/conventions the rest of the suite will rely on).
> 18.2 / 18.4 / 18.5 are reservations only. **All five are documentation; the §17
> implementation slices are unchanged.**

---

*Design only. No implementation, no code changes, no commit/push/deploy.*
