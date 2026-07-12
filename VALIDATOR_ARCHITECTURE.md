# CashCompass Validator Architecture

*The read-only Validator subsystem: architecture, current state, and roadmap —
plus the developer-only **Test Harness / Regression Runner**, the writer
counterpart that drives scenarios and calls the Validator to judge health (§12).*

**Status:** Documentation. **Phase 1 is complete** — the Golden Workbook parity
comparison + recommendation engine + scoped family runners are implemented in the
main app, **disabled by default**, **admin-gated**, **read-only**, with **no
runtime/UI/provisioning call sites**. It is run manually from the Apps Script
editor. Phase 1 drove the **2026-07 Golden Workbook convergence milestone**
(Operational, Financial Ledger, SYS, and Special families converged — see
`WORKBOOK_PARITY_CHECKLIST.md`). Remaining capabilities (single-workbook
rules-based validators, conditional-format capture, provisioning validation) are
**Phase 2+ future work** — see §10.

**Phase 2 — architecture designed (2026-07-12), not implemented.** Phase 2 shifts
the Validator from **two-workbook Canonical comparison** to **single-workbook
Workbook Health validation** (does *this* workbook match the canonical rules?).
Its full module architecture, execution order, report format, phased plan, risks,
and recommended first implementation are specified in **§10 → Phase 2
architecture**. No Phase 2 code exists yet; the design is documentation only.

**Related docs:** `GOLDEN_WORKBOOK.md` (visual source of truth + design
families), `WORKBOOK_PARITY_CHECKLIST.md` (per-sheet convergence status),
`ENGINEERING_STANDARDS.md` (canonical styling/geometry constants and safety
rules), `PROJECT_CONTEXT.md`.

---

## 1. Purpose

A single, read-only Validator subsystem that supports (implemented) or will
support (planned):

- **Golden Workbook parity comparison** *(implemented)* — a freshly provisioned
  workbook vs the live Golden Workbook, differences grouped by design family.
- **Schema validation** *(planned)* — column order, types, canonical schema evolution.
- **Required-sheet validation** *(planned)* — every canonical sheet exists.
- **Header validation** *(planned)* — header text/positions match the canonical schema.
- **Formula validation** *(planned)* — expected formula shapes (e.g. `=SUM` totals, Delta chains).
- **Formatting validation** *(planned)* — fonts, colors, geometry, freeze panes, number formats.

The Validator is a **trust asset**, not a runtime dependency. It reports; it
never repairs, restyles, or mutates. Repair remains the job of the existing
provisioning / self-heal code, which is explicitly out of scope here.

### 1a. Recommendation engine (implemented)

The parity comparison does not just list raw differences — it assigns **exactly
one recommendation** to every diff (`validator_format_compare.js →
validatorRecommendation_`), which is what made the 2026-07 convergence milestone
tractable. The vocabulary (fixed print order, `VALIDATOR_RECO_ORDER_`):

- **AdoptGolden** — Central is objectively worse and should match Golden (mainly
  Golden column is **wider** while Central sits near Sheets defaults, or a header
  Central left unstyled/white while Golden has a real fill). *These are the
  actionable engineering items.*
- **KeepCentral** — Golden reflects an untouched Sheets default while Central's
  value is the ratified canonical standard (canonical row heights, `middle`
  vertical align, negative-aware currency formats, columns already ≥ Golden).
- **ProductDecision** — a deliberate design call with no single right answer
  (palette background hexes, single-value font colours, font **size** — Golden is
  bigger on ledgers but smaller on SYS).
- **IgnoreNoise** — non-actionable (mature-vs-fresh row presence, expected totals /
  year banners, blank-cell default number formats, Arial↔Calibri font-family drift).
- **NeedsReview** — anything the rules can't confidently classify.

The report shapes these into a **Recommendation Summary** (headline counts), a
**Family Summary** (per-design-family counts + owning helper via
`validatorSuggestedHelper_`), and a **Convergence Priority** (the focused set of
sheets present in both workbooks). The workflow is: run a scoped family runner →
implement only the **AdoptGolden** items → rerun until AdoptGolden = 0 → the
remaining KeepCentral / ProductDecision / IgnoreNoise are intentional. This is the
**Validator-driven development workflow** used across Operational, Financial
Ledger, SYS, and Special (see `WORKBOOK_PARITY_CHECKLIST.md`).

---

## 2. Core framing — one guarded, read-only subsystem in the main app

Earlier drafts split the subsystem across two physical projects (an in-app
validator and a separate `dev-tools/` parity comparator). **That split has been
retired.** The parity comparator was migrated into the main app as guarded,
read-only Validator code, and `dev-tools/` was removed. Both kinds of check now
live in one place and are protected by the same guard:

| | **Single-workbook, rules-based** *(planned)* | **Two-workbook parity** *(implemented)* |
|---|---|---|
| Question it answers | "Does *this one* workbook match the **rules**?" | "Does a Central workbook match the **Golden Workbook**?" |
| Input | 1 workbook the caller resolves | 2 workbooks, by ID |
| Reference | Canonical **rule definitions** (in code) | A live **reference spreadsheet** (Golden) |
| Uses `openById` | No (uses `getUserSpreadsheet_()`) | Yes (two IDs, read-only) |
| Location | Main app, `validator_*` | Main app, `validator_*` |
| Guard | `assertValidatorAllowed_()` | `assertValidatorAllowed_()` |
| OAuth scope | reuses existing `spreadsheets` | reuses existing `spreadsheets` |

**Shared primitive:** both use the read-only **formatting snapshot** extractor
(`validator_snapshot.js`). Parity needs no rule set (the Golden Workbook *is* the
truth); single-workbook validation needs no Golden workbook (the rules *are* the
truth).

**Why parity lives in-app (not a separate dev project):** keeping one guarded,
default-off, admin-only subsystem is simpler to reason about and to protect than
two projects, and the guard model below already makes the `openById` capability
safe (flag + admin + no wiring). The stronger "physical absence" isolation is no
longer used; safety now rests on the layered guard (§5) and CI guards (§8).

---

## 3. File layout

All Validator code lives in the main app (flat project, `validator_` prefix),
read-only, guarded, and **not referenced by any runtime flow**.

### Implemented

```
validator_core.js            # guard + the single public entry point
validator_snapshot.js        # read-only formatting snapshot extractor
validator_format_compare.js  # Golden ↔ Central parity diff, grouped by family
validator_report.js          # log / JSON report shaping
```

### Planned (Phase 2 — single-workbook, rules-based Workbook Health validators)

```
validator_rules.js    # the CANONICAL MODEL: required/optional sheets, header
                      #   schemas, canonical widths/typography, expected formula
                      #   shapes, expected conditional-format signatures, expected
                      #   named ranges — all DERIVED FROM the same constants and
                      #   ensure*/apply*/write* helpers provisioning already uses
                      #   (references, never copies — see §10)
validator_checks.js   # pure read-only check functions, one per module:
                      #   checkRequiredSheets_, checkHeaders_/checkSchema_,
                      #   checkFormulas_, checkConditionalFormats_, checkNamedRanges_
validator_health.js   # Workbook Health orchestrator + scoring + report shaping
                      #   (validateActiveWorkbook / runWorkbookHealth_)
```

Phase 2 also **extends `validator_snapshot.js`** with read-only capture of
conditional-format rules, named ranges, and targeted formula reads (see §10).

### Planned (Test Harness / Regression Runner — a *separate* writer subsystem)

The Test Harness is **not** part of the Validator — it is the **writer/mutator**
counterpart that drives scenarios and calls the read-only Validator to judge the
result (see §12). It lives in its own `test_harness_*` files so the read-only
guarantee of `validator_*` is never blurred:

```
test_harness_core.js       # guard + disposable-workbook lifecycle + run loop
test_harness_scenarios.js  # declarative scenario packs (setup + actions + expected health)
test_harness_data.js       # synthetic fixture-data generators (incl. historical-bug repro data)
test_harness_report.js     # Release Readiness report aggregation
validator_health.js        # (Validator, §10) the read-only health entry the harness calls
```

> `dev-tools/` (the earlier standalone parity project) has been **removed**; the
> root `.claspignore` no longer contains a `dev-tools/**` rule.

---

## 4. Public vs internal functions

Repo convention: a **trailing `_` marks an internal/private** function; no
underscore marks a public entry point. (Apps Script has no true per-function
access control — see the guard model in §5.)

### Implemented

**Public (guarded) — the core entry point**
- `validateGoldenParityReport(options)` — snapshot two workbooks by ID and report
  formatting differences grouped by design family. Read-only; **`redactValues`
  defaults to `true`**; `outputMode` is `'log'` (default) | `'json'` | `'both'`;
  `snapshotOptions.sheetNames` optionally scopes both snapshots to an exact-name
  allow-list. All runners below funnel through this function, so the guard
  (`VALIDATOR_ENABLED` + admin) always applies.

**Public developer runners (no-arg — appear in the editor Run dropdown)**
These are intentionally **non-underscore** so the Apps Script editor lists them
(some editor versions hide trailing-underscore functions). Each is still fully
guarded via `validateGoldenParityReport`, takes no arguments, reads workbook IDs
from Script Properties, and runs read-only (`redactValues: true`, `outputMode: 'log'`).
- `validatorRunGoldenParity()` — full parity across **every** INPUT/SYS/OUT/HOUSES/LOG
  sheet present in both workbooks. On a mature Golden workbook this can approach the
  6-minute execution limit — prefer a scoped runner below.
- **Scoped family runners** (each limits both snapshots to that family's
  convergence-priority sheets via `snapshotOptions.sheetNames`, keeping runs fast
  and timeout-safe — these drove the 2026-07 convergence milestone):
  - `validatorRunGoldenParityFinancialLedger()` → `INPUT - Bank Accounts`, `INPUT - Cash Flow 2026` (`VALIDATOR_SCOPE_FINANCIAL_LEDGER_`).
  - `validatorRunGoldenParityOperational()` → `INPUT - Upcoming Expenses`, `LOG - Activity` (`VALIDATOR_SCOPE_OPERATIONAL_`).
  - `validatorRunGoldenParitySys()` → `SYS - Accounts` (`VALIDATOR_SCOPE_SYS_`).
  - `validatorRunGoldenParitySpecial()` → `INPUT - Settings`, `INPUT - Donation` (`VALIDATOR_SCOPE_SPECIAL_`).

**Developer runner (internal)**
- `validatorRunGoldenParity_(centralSpreadsheetIdOverride?)` — the underscore
  implementation the public `validatorRunGoldenParity()` delegates to; accepts an
  optional Central-ID override. `validatorRunGoldenParityScoped_(sheetNames)` is the
  shared internal helper the four scoped runners call. Replaces the old temporary
  `runParity()` wrapper — no throwaway files needed.

**Internal**
- `assertValidatorAllowed_()`, `isValidatorEnabled_()` — the guard (`validator_core.js`).
- `getValidatorGoldenWorkbookId_()`, `getValidatorDefaultCentralWorkbookId_()` —
  centralized Script-Property accessors (fail-closed with a clear error if unset).
- `validatorSnapshotById_`, `validatorSnapshotWorkbook_`, `validatorSnapshotSheet_` — snapshot.
- `validatorSheetFamily_`, `validatorSuggestedHelper_`, `validatorIncludesSheet_`,
  `validatorIsKeyRowType_`, `validatorRedactValue_`, `validatorClassifyRowType_` — snapshot helpers.
- `validatorCompareSnapshots_`, `validatorCompareSheets_`, `validatorCompareKeyRows_`,
  `validatorCmpScalar_`, `validatorPushDiff_`, `validatorGroupBy_`, `validatorUniqueSorted_` — compare.
- `validatorLogChunked_`, `validatorLogComparisonReport_` — report.

### Planned (Phase 2)

**Public (guarded)**
- `validateActiveWorkbook(options)` — the single new public entry point: run the
  Workbook Health checks against the caller's **resolved** workbook
  (`getUserSpreadsheet_()` — no `openById`) and return/log a Workbook Health
  report. Guarded by `assertValidatorAllowed_()` (flag + admin), read-only,
  `redactValues` defaults to `true`.
- `validatorRunWorkbookHealth()` — optional no-arg developer runner (editor Run
  dropdown), delegating to `validateActiveWorkbook`.

**Internal**
- Orchestration/scoring (`validator_health.js`): `runWorkbookHealth_`,
  `aggregateFindings_`, `computeHealthScore_`, `getValidatorRules_`.
- Checks (`validator_checks.js`): `checkRequiredSheets_`, `checkHeaders_` /
  `checkSchema_`, `checkFormulas_`, `checkConditionalFormats_`, `checkNamedRanges_`,
  plus normalizers `normalizeFormulaShape_`, `normalizeCfRule_`.
- Snapshot extensions (`validator_snapshot.js`): `snapshotConditionalFormatRules_`,
  `snapshotNamedRanges_`, targeted-formula reads.

---

## 5. Guard model

Apps Script has **no per-function ACL** — any global function in a deployed
project is technically callable by name via `google.script.run`. Guarding is
therefore layered:

1. **Flag gate.** Script property `VALIDATOR_ENABLED` (default **off**).
   `assertValidatorAllowed_()` throws unless it equals the literal string
   `"true"`. Mirrors the fail-closed `isCentralModeEnabled_()` / `isAdminRepairEnabled_()`
   pattern (`isValidatorEnabled_()` in `validator_core.js`).
2. **Admin identity gate.** Reuses `isAdminUser_()` (`central_diagnostics.js`) —
   the same allow-list (`ADMIN_EMAILS`, falling back to `BETA_CONTACT_EMAIL`)
   that gates admin repair / clear-mapping. Non-admin callers get a generic
   denial. Even if a client names `validateGoldenParityReport`, a normal user is
   rejected.
3. **No wiring.** Validators are never called from `webapp.js` `doGet`,
   `central_resolver.js`, `central_provisioning.js`, `dashboard_data.js`,
   `onboarding.js`, planner code, or any `Dashboard_Script_*.html`.
4. **No triggers / no auto-run.** No time-driven or installable triggers; no
   `onOpen` auto-run and no menu item. The only entry today is a **manual editor
   Run** (a future admin-gated Admin Diagnostics action is optional).
5. **Default-off.** With `VALIDATOR_ENABLED` unset, the entire subsystem is inert.

```
validateGoldenParityReport(opts)
  └─ assertValidatorAllowed_()   // throws unless VALIDATOR_ENABLED==="true" AND isAdminUser_()
  └─ golden  = validatorSnapshotById_(opts.goldenSpreadsheetId,  {redactValues:true,...})
  └─ central = validatorSnapshotById_(opts.centralSpreadsheetId, {redactValues:true,...})
  └─ report  = validatorCompareSnapshots_(golden, central)      // read-only, pure
```

### Script properties

All Validator configuration lives in Script Properties (never hardcoded):

| Property | Required | Purpose |
|---|---|---|
| `VALIDATOR_ENABLED` | yes (to enable) | Must equal `"true"`; otherwise the subsystem is inert. |
| `ADMIN_EMAILS` (or `BETA_CONTACT_EMAIL`) | yes | Admin allow-list used by `isAdminUser_()`. |
| `VALIDATOR_GOLDEN_WORKBOOK_ID` | for the runner | The Golden / reference workbook spreadsheet ID. |
| `VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID` | optional | Default Central workbook to compare when the runner is called with no override. |

### How to run (developer, from the Apps Script editor)

Temporary wrapper files (e.g. the old `runParity()`) are **no longer needed** —
the permanent no-arg runner reads its inputs from Script Properties:

1. Set `VALIDATOR_ENABLED="true"` and ensure your account is in the admin allow-list.
2. Set `VALIDATOR_GOLDEN_WORKBOOK_ID` and `VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID`.
3. `clasp push`, open the editor, select **`validatorRunGoldenParity_`**, click **Run**,
   authorize the (existing) `spreadsheets` scope on first run, and read the grouped
   report in **Executions / Logs**.

**To change the compared Central workbook:** either update
`VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID`, or call the runner with an override from a
one-liner, e.g. `validatorRunGoldenParity_('OTHER_CENTRAL_ID')`. The Golden ID is
always read from `VALIDATOR_GOLDEN_WORKBOOK_ID`.

---

## 6. OAuth scope model

**No new scopes.** The Validator reuses the already-granted
`https://www.googleapis.com/auth/spreadsheets`. `SpreadsheetApp.openById(...)`
reads any spreadsheet the executing admin can already access; the code uses only
read getters. No Drive, Mail, ScriptApp, or UI APIs — zero additional consent and
no `appsscript.json` change.

---

## 7. Read-only enforcement

The app's full `spreadsheets` (read+write) scope *can* write, so the Validator's
read-only guarantee is enforced by **code + review + CI**, not by scope:

- Validator functions use **getters only** — no `setValue`, `setBackground`,
  `setFontSize`, `setNumberFormat`, `insertSheet`, `deleteRow/Column`,
  `appendRow`, `setFormula`, `merge`, `setFrozenRows/Columns`, etc.
- The formatting snapshot uses bulk getters over a **capped block**
  (default 80 rows × 40 cols) so it never scans huge blank grids.
- Values are **redacted by default** (`redactValues` defaults to `true`) so real
  financial data does not reach the execution logs.
- Borders are **not** readable via Apps Script (no `getBorder(s)` API) — border
  parity is verified visually and is documented as a known limitation in reports.

---

## 8. CI guard recommendations

Add lightweight checks under `scripts/` (run in CI and/or a pre-commit hook):

1. **No-write guard** — fail the build if any `validator_*.js` contains a write
   API. Grep an explicit deny-list:
   `set(Value|Values|Background|Backgrounds|FontSize|FontWeight|FontColor|FontFamily|NumberFormat|Formula|Formulas|Border|FrozenRows|FrozenColumns|ColumnWidth|RowHeight|HorizontalAlignment|VerticalAlignment)|insertSheet|deleteSheet|deleteRow|deleteColumn|appendRow|clear(Content|Format)?|merge\(`.
2. **No-hot-path guard** — fail if any runtime file (`webapp.js`,
   `central_resolver.js`, `central_provisioning.js`, `dashboard_data.js`,
   `onboarding.js`, `planner_*.js`, `Dashboard_Script_*.html`) references
   `validate*` (e.g. `validateGoldenParityReport`) or any `validator*_` symbol.
3. **Guard-presence guard** — fail if any public `validate*` entry point does not
   call `assertValidatorAllowed_()` as its first statement.

---

## 9. Runtime / provisioning exclusion rules

The Validator must never enter the hot path:

- **Not imported or called by:** `webapp.js` (`doGet`), `central_resolver.js`,
  `central_provisioning.js`, `dashboard_data.js`, `onboarding.js`, `planner_*`,
  any `Dashboard_Script_*.html`.
- **No triggers** (time-driven or installable), **no `onOpen` auto-run**, and no
  menu item.
- The two-workbook parity capability (and its `openById`-of-two-IDs power) is
  gated behind the flag + admin guard (§5), disabled by default, and reachable
  only by a manual editor Run.
- Default posture is **off** (`VALIDATOR_ENABLED` unset) so the subsystem is inert
  until an admin explicitly enables it.

---

## 10. Roadmap

- **Phase 0 — done.** Prototyped the read-only snapshot + comparison in a
  standalone `dev-tools/` project.
- **Phase 1 — done.** Migrated the parity comparator into the main app as the
  first Validator module (`validator_core.js`, `validator_snapshot.js`,
  `validator_format_compare.js`, `validator_report.js`); exposed the guarded entry
  point `validateGoldenParityReport()` plus the public no-arg runners (full +
  four scoped family runners); added the **recommendation engine** (§1a); removed
  `dev-tools/`. Phase 1 drove the **2026-07 Golden Workbook convergence
  milestone** to `AdoptGolden = 0` for the audited families.
- **Phase 2 — Workbook Health validation — architecture designed (2026-07-12),
  not implemented.** Single-workbook, rules-based validation across six modules
  (Provisioning · Schema · Formula · Conditional Formatting · Named Range ·
  Workbook Health report). Adds `validator_rules.js` (the canonical model),
  `validator_checks.js`, and `validator_health.js`; extends `validator_snapshot.js`;
  exposes `validateActiveWorkbook()` behind `assertValidatorAllowed_()`. Full
  architecture, execution order, report format, phased plan, risks, and
  recommended first implementation are in **§10 → Phase 2 architecture** below.
- **Phase 4 — planned (optional).** An admin-gated Admin Diagnostics UI action to
  run validators without the editor (the user-facing **Workbook Health** workflow,
  §10).

At every phase: read-only, guarded, default-off, and covered by the CI guards.

### Phase 2 architecture — Workbook Health validation *(designed 2026-07-12; not implemented)*

> **Status:** **Architecture only.** Golden Workbook convergence is complete, so
> Phase 2 is now unblocked, but **no Phase 2 code exists yet.** This section is the
> design of record; implementation is a separate, later step.

**Goal.** After Central provisions (or self-heals) a workbook, run a **read-only**
validation that verifies *this one* workbook matches the **canonical CashCompass
architecture** — and produce a **Workbook Health** report. This is the pivot from
Phase 1's *two-workbook Canonical comparison* to Phase 2's *single-workbook,
rules-based Workbook Health* (the "single-workbook, rules-based" column of the §2
table).

**Design principles (non-negotiable).**

- The Validator **validates** provisioning; it **never performs** provisioning.
- The Validator **remains read-only** (getters only; §7).
- **One source of truth.** The canonical model **derives its expectations from the
  same constants and `ensure*/apply*/write*` helpers provisioning already uses** —
  it **references, never copies**. Provisioning and the Validator must never drift.
- Same guard, scope, and CI posture as Phase 1 (flag + admin, no new OAuth scope,
  no hot-path wiring, default-off).

#### 10.0 Shared foundation — the Canonical Model (`validator_rules.js`)

The keystone of Phase 2. A single in-code description of "what a correct workbook
looks like," expressed **per sheet** and derived from existing sources of truth:

| Canonical fact | Existing source of truth (reuse, do not duplicate) |
|---|---|
| Required / optional sheets + who creates them | `sheet_bootstrap.js` registry (delegates to `ensure*Sheet_`; already flags `unsupported`), `central_provisioning.js → runMinimalBootstrap_` |
| Header schema (text + order) | the `*_REQUIRED_HEADERS_` constants (e.g. `DONATION_REQUIRED_HEADERS_`) + the header lists passed to `mapHeaders_` |
| Canonical column widths | the `*_CANONICAL_WIDTHS_` header-keyed maps (Cash Flow, SYS Accounts, Upcoming Expenses, Donation, Activity Log, SYS House Assets) |
| Typography / geometry | the canonical font-size + row-height constants in `sheet_bootstrap.js` (single source) |
| Family styling (header yellow, banners) | `CANON_HEADER_YELLOW_` + the `apply*Style_` helpers (`applyFinancialLedgerBaseStyle_`, `applyOperationalFlatSheetStyling_`, `applySysSheetBaseStyle_`) |
| Conditional-format signatures | `applyCashFlowRowTypeColorRules_`, `applyCashFlowSummaryHealthColorRules_` + shared color constants (`CASH_FLOW_HEALTH_COLOR_POSITIVE_/NEGATIVE_`) |
| Expected formula shapes | the `write*Formulas_` functions (e.g. `writeCashFlowSummaryFormulas_`, Delta writers) |
| Named ranges | **none today** — the app defines no named ranges (see Module 5) |

> **Key architectural decision (and the biggest risk — see Risks):** several
> canonical facts are currently expressed **inline** (e.g. header lists inside
> `mapHeaders_(...)` calls). To honor "one source of truth," Phase 2 begins by
> **extracting those inline definitions into named constants** (as `Donation`
> already does with `DONATION_REQUIRED_HEADERS_`) so both provisioning **and**
> `validator_rules.js` read the *same* symbol. `validator_rules.js` must contain
> **references/adapters**, not copied literals.

#### 10.1 Module 1 — Provisioning Validation

- **Purpose:** verify the workbook has the correct **set of sheets** — every
  required sheet present, module-conditional sheets present iff their module is
  enabled, and no unexpected/misnamed core sheets.
- **Responsibilities:** enumerate actual sheets; resolve the *expected* set
  (required + module-conditional); classify each sheet `present | missing |
  unexpected | optional-absent`; know which sheets have **no canonical creator**
  (e.g. `INPUT - Cash Flow <year>` is clone-only) and report accordingly rather
  than flagging a false defect.
- **Inputs:** resolved workbook (`getUserSpreadsheet_()`), canonical required/optional
  sheet set (from the `sheet_bootstrap` registry), module-enablement signals.
- **Outputs:** per-sheet presence findings + a required-sheet coverage summary.
- **Public entry points:** none of its own — invoked by the Workbook Health runner (Module 6).
- **Internal helpers:** `checkRequiredSheets_`, `resolveExpectedSheetSet_`, `classifySheetPresence_`.
- **Dependencies:** `getUserSpreadsheet_`, `sheet_bootstrap.js` registry, `validator_rules.js`.
- **Reuse:** the bootstrap registry **already** maps entity → canonical creator and
  flags `unsupported`; Module 1 mirrors that list instead of re-listing sheets.

#### 10.2 Module 2 — Schema Validation

- **Purpose:** verify each present sheet's **header row** matches the canonical
  header schema (text, order, position); flag missing / extra / reordered / renamed
  columns.
- **Responsibilities:** read the header row; diff against the canonical header
  vector; be tolerant of **schema-evolution columns** added by self-heal (e.g.
  Bills `Weekday` / `Anchor Date` / `Schedule Effective Date`) by expressing them
  in the canonical model as expected-added; optionally advise on body column
  data-type expectations (currency/date) as low severity.
- **Inputs:** the snapshot (it **already captures** `headerRowNum` + `headerLabels`
  per sheet), canonical header lists.
- **Outputs:** per-sheet header diff `{ missing, extra, misordered, renamed }`.
- **Public entry points:** none — invoked by Module 6.
- **Internal helpers:** `checkHeaders_` / `checkSchema_`, `compareHeaderVectors_`.
- **Dependencies:** `validator_snapshot.js` (header capture), `validator_rules.js`,
  the `mapHeaders_` header lists.
- **Reuse:** `mapHeaders_` is the existing header-mapping primitive; the snapshot
  already classifies the header row (`validatorClassifyRowType_`). Highest-value,
  lowest-cost module because the data is already captured.

#### 10.3 Module 3 — Formula Validation

- **Purpose:** verify key cells still contain the **expected formula shapes**
  (`=SUM` totals, Delta chains, Cash Flow Summary formulas) and were not
  overwritten by static values.
- **Responsibilities:** read formulas at canonical **anchor cells**; normalize to a
  structural shape (strip absolute markers / concrete row indices) so A1 drift
  doesn't cause noise; classify `ok | missing | altered | hardcoded-over-formula`.
- **Inputs:** targeted `getFormula(s)` reads (read-only) at anchor ranges; canonical
  formula templates.
- **Outputs:** per-target `{ expected pattern, actual, status }`.
- **Public entry points:** none — invoked by Module 6.
- **Internal helpers:** `checkFormulas_`, `normalizeFormulaShape_`, `expectedFormulaTargets_`.
- **Dependencies:** canonical formula definitions derived from the `write*Formulas_`
  functions; a small **snapshot extension** for targeted formula reads (the current
  80×40 value snapshot is not formula-aware).
- **Reuse:** the formula-writing functions are the source of truth for the expected
  shapes — extract patterns from them rather than hardcoding strings.

#### 10.4 Module 4 — Conditional Formatting Validation

- **Purpose:** close the **current Validator blind spot** — the snapshot captures
  rendered styles + number formats but **not conditional-format rules**, so
  CF-driven visuals (positive/negative coloring, Income/Expense row colors) cannot
  be attributed or verified today.
- **Responsibilities:** snapshot `getConditionalFormatRules()` per sheet; normalize
  each rule to a comparable **signature** — ranges (A1), boolean condition
  type/criteria/formula (e.g. `=$A1="Income"`), font/background color, and
  ordering/priority where it matters; diff against the canonical CF rule set;
  report `missing | extra | altered` rules.
- **Inputs:** `sheet.getConditionalFormatRules()` (a getter), canonical CF signatures.
- **Outputs:** per-sheet CF diff — especially Cash Flow Income/Expense/Summary
  health colors.
- **Public entry points:** none — invoked by Module 6.
- **Internal helpers:** `snapshotConditionalFormatRules_` (snapshot extension),
  `normalizeCfRule_`, `checkConditionalFormats_`.
- **Dependencies:** `validator_snapshot.js` extension; canonical CF definitions from
  `applyCashFlowRowTypeColorRules_` / `applyCashFlowSummaryHealthColorRules_` and
  their shared color constants.
- **Reuse:** the CF-creating helpers + color constants are the source of truth.
  **Bonus:** capturing CF rules also **upgrades Phase 1 parity** so it can finally
  verify CF-driven visual parity between Canonical and Central.
- **Safety:** `getConditionalFormatRules()` is read-only; this module **detects and
  reports only** — the Cash Flow Summary positive/negative behavior remains a
  ratified **ProductDecision**, never auto-changed.

#### 10.5 Module 5 — Named Range Validation

- **Purpose:** verify named ranges match the canonical set.
- **Reality check:** the app **defines no named ranges today** (no `addNamedRange` /
  `getRangeByName` anywhere). So the near-term job is (a) confirm **no unexpected**
  named ranges have crept in (manual edits, imports), and (b) provide the seam for
  future named-range adoption. **Lowest ROI — sequence last.**
- **Responsibilities:** enumerate `ss.getNamedRanges()`; diff against the canonical
  named-range set (empty today); report `unexpected` (advisory/low severity now) and,
  once named ranges are adopted, `missing | misscoped` (higher severity).
- **Inputs:** `ss.getNamedRanges()` (getter: `getName`, `getRange().getA1Notation()`).
- **Outputs:** `{ expected, present, unexpected, missing }`.
- **Public entry points:** none — invoked by Module 6.
- **Internal helpers:** `checkNamedRanges_`, `snapshotNamedRanges_`.
- **Dependencies:** `validator_rules.js` (canonical list — empty today), snapshot extension.
- **Reuse:** minimal; deliberately deferred to avoid over-building an unused capability.

#### 10.6 Module 6 — Workbook Health report

- **Purpose:** orchestrate Modules 1–5 into a **single read-only Workbook Health
  report + score** for one workbook. The only module with a public entry point.
- **Responsibilities:** resolve the workbook; run the enabled checks **in execution
  order**; aggregate `Finding`s by module + severity; compute a **health
  score/grade** and a `PASS | WARN | FAIL` gate; shape log/JSON output.
- **Inputs:** resolved workbook, `options { modules?, outputMode, redactValues,
  sheetNames? }`.
- **Outputs:** a `WorkbookHealthReport` (see report format below).
- **Public entry points:** `validateActiveWorkbook(options)` (guarded) + optional
  no-arg `validatorRunWorkbookHealth()` dev runner.
- **Internal helpers:** `runWorkbookHealth_`, `aggregateFindings_`, `computeHealthScore_`.
- **Dependencies:** all modules, `validator_core.js` guard, `validator_report.js`
  (reused chunked log/JSON shaping), `getUserSpreadsheet_` (**single workbook — no
  `openById`**).
- **Reuse:** the guard (`assertValidatorAllowed_`), `validator_report.js`, and the
  recommendation-style vocabulary/severity model from Phase 1.

#### 10.7 Execution order

Foundational/cheap → dependent/expensive, short-circuiting per sheet when a
prerequisite fails:

```
1. Provisioning (required sheets)   ← everything depends on sheets existing
2. Schema / Headers                 ← needs sheets present; anchors later checks
3. Formulas                         ← needs headers to locate anchor columns
4. Conditional Formatting           ← needs sheets; independent of formulas
5. Named Ranges                     ← workbook-level, cheap, independent (low priority)
6. Workbook Health aggregation      ← always last; consumes all findings + scores
```

#### 10.8 Report format

Every check emits a uniform **`Finding`**:

```
Finding {
  module,        // 'provisioning' | 'schema' | 'formula' | 'cf' | 'namedRange'
  sheet,         // sheet name or '(workbook)'
  target,        // header / cell / rule id (redaction-safe)
  severity,      // 'INFO' | 'WARN' | 'ERROR'
  code,          // stable machine code, e.g. 'SHEET_MISSING'
  message,       // human summary
  expected, actual,   // redacted by default (redactValues: true)
  recommendation      // advisory next step (never auto-applied)
}
```

The **`WorkbookHealthReport`** shapes findings into sections:

```
Workbook Health — <workbook name>
  Health Summary   : score N/100 · grade · PASS|WARN|FAIL · counts by severity
  Provisioning     : required-sheet coverage; missing / unexpected
  Schema           : per-sheet header diffs
  Formulas         : altered / missing / hardcoded anchors
  Conditional Fmt  : missing / extra / altered CF rules
  Named Ranges     : unexpected (today) / missing (future)
  Per-sheet rollup : one line per sheet, worst severity
```

Score model: weighted, ERROR-heavy (a missing required sheet outweighs a cosmetic
INFO). `FAIL` on any ERROR, `WARN` on WARN-only, `PASS` when clean. Reuses
`validator_report.js` chunked logging; `outputMode` `'log' | 'json' | 'both'` like
Phase 1; **`redactValues` defaults to `true`**.

#### 10.9 Future user-facing Workbook Health workflow

Today: admin/editor only. Future (optional **Phase 4** UI): an **admin-gated Admin
Diagnostics** action — "Check Workbook Health" — that runs `validateActiveWorkbook`
and renders a **read-only report card** (score + top issues + an "advisory only"
banner). It **never repairs**; if the user wants to fix issues, a separate button
invokes the **existing provisioning / self-heal** code (not the Validator),
preserving the "validate ≠ provision" boundary:

```
Provision / Self-heal Workbook
        ↓
   Workbook Health Check   (read-only)
        ↓
  PASS   or   Actionable Report
                    ↓
       Fix via existing provisioning / self-heal
                    ↓
       Re-run Workbook Health Check
```

#### 10.10 Phased implementation plan (sub-phases within Phase 2)

- **2A — Foundation.** Stand up `validator_rules.js` (the canonical model seam) +
  **extract inline header lists into `*_REQUIRED_HEADERS_` constants**; define the
  `Finding` / severity model; scaffold `validateActiveWorkbook` + `validator_health.js`
  behind the guard, reusing `validator_report.js`. No checks beyond wiring.
- **2B — Provisioning + Schema (Modules 1–2).** Highest value, lowest cost — Module 2
  reuses the snapshot's already-captured headers; Module 1 reuses the bootstrap
  registry. Ship the first real Workbook Health report here.
- **2C — Conditional Formatting (Module 4).** Add `snapshotConditionalFormatRules_`;
  closes the known blind spot and **upgrades Phase 1 parity** as a bonus.
- **2D — Formulas (Module 3).** Add targeted formula reads + `normalizeFormulaShape_`.
- **2E — Named Ranges (Module 5) + Health scoring polish (Module 6) + optional
  Admin Diagnostics UI (Phase 4).**

> The **Release Readiness gate** referenced above is not a Validator feature — it is
> realized by the **Test Harness / Regression Runner (§12)**, which drives scenarios
> against disposable workbooks and calls `validator_health.js` to judge each one.
> The Validator judges; the Harness writes. Their boundary is spelled out in §12.

#### 10.11 Risks

- **Source-of-truth duplication (highest).** If `validator_rules.js` copies schemas
  instead of referencing shared constants, drift returns. *Mitigation:* extract
  inline definitions to constants first (2A); a CI guard can assert the rules module
  references those constants rather than string literals.
- **6-minute execution limit** on mature workbooks. *Mitigation:* single-workbook
  scope, `sheetNames` scoping, targeted reads, and the existing 80×40 snapshot cap.
- **Read-only enforcement for new getters.** `getConditionalFormatRules`,
  `getFormulas`, `getNamedRanges` are getters (safe); keep the CI no-write deny-list
  (§8) current and confirm no setter creeps in.
- **Module-conditional false positives.** Optional modules (Houses, Investments,
  Donation) must not be reported as "missing." *Mitigation:* a reliable
  enablement/`data-present` signal in `resolveExpectedSheetSet_`.
- **Schema-evolution columns.** Self-heal-added columns (Bills Weekday, etc.) must be
  expressed in the canonical model or they read as "extra." *Mitigation:* model them
  as expected-added.
- **CF normalization noise.** Rule ordering/priority + whole-column ranges can make
  diffs noisy. *Mitigation:* start at signature level, tolerant; refine later.
- **Over-building Named Ranges** (currently unused). *Mitigation:* sequence last;
  keep it a thin "no unexpected ranges" check until named ranges are actually adopted.

#### 10.12 Recommended first implementation

**Do 2A + 2B: Provisioning + Schema validation, built on existing infrastructure.**
Concretely, start with **required-sheet validation sourced from the `sheet_bootstrap`
registry** and **header/schema validation that reuses the snapshot's
already-captured header labels**. This is the highest value (directly answers "does
this provisioned workbook match the canonical architecture?"), the lowest risk, and
the greatest reuse (snapshot header capture + bootstrap registry already exist).
**Defer** Conditional Formatting (needs a snapshot extension), Formulas (needs
targeted reads), and Named Ranges (currently unused). The one prerequisite refactor
to do first: **extract inline header lists into `*_REQUIRED_HEADERS_` constants** so
provisioning and the Validator share one definition.

**Note.** Architecture only. **Do not begin implementation now.**

---

## 11. Decision rule

> **All validators live in the main app** as guarded, read-only `validator_*`
> code behind `assertValidatorAllowed_()` (flag + admin), with no runtime/UI/
> provisioning call sites.

Concretely:

- **Single-workbook, rules-based** validation → compares a workbook against
  **canonical rules in code** (`validator_rules.js` / `validator_checks.js`).
- **Two-workbook, reference-based** parity → compares a Central workbook against
  the **live Golden Workbook** (`validator_format_compare.js`), reachable via the
  guarded `validateGoldenParityReport()`.

The earlier rule that *two-workbook parity must stay in a separate `dev-tools/`
project* is **retired**. Parity now lives in the guarded in-app Validator; the
`openById` capability is made safe by the layered guard (§5) rather than by
physical separation, and `dev-tools/` has been removed.

---

## 12. Test Harness / Regression Runner *(planned — the writer counterpart; architecture only)*

> **Status:** **Architecture only, not implemented.** Sequenced in the roadmap
> **after** the Validator Phase 2 foundation (`ROADMAP.md → P1`): (1) Validator
> Phase 2A/2B → (2) Test Harness foundation → (3) Scenario packs → (4) Release
> Readiness gate.

### 12.1 The boundary (why this is a separate subsystem)

The Validator is a **read-only judge**. The Test Harness is the **writer/mutator**.
Keeping them separate is the whole point:

| | **Validator** (`validator_*`) | **Test Harness** (`test_harness_*`) |
|---|---|---|
| Role | **Judges** workbook health | **Creates** and **exercises** disposable workbooks |
| Writes? | **Never** (getters only, §7) | **Yes — but only to disposable test workbooks it created** |
| Provisions? | Never | Yes (into disposable workbooks, via the *real* production helpers) |
| Repairs / mutates? | Never | Only disposable workbooks |
| Target workbooks | Any the admin can read | **Only** disposable, test-marked workbooks |
| Relationship | Called *by* the Harness | Calls the Validator after each scenario |

The Harness **creates disposable test workbooks, runs real workflows, reproduces
historical bugs, and then asks the Validator to confirm nothing broke.** The
Validator never gains write power; the Harness never touches the Canonical or any
real user workbook.

### 12.2 Goal

A **developer-only regression system** runnable **before major changes and before
beta releases**: provision fresh workbooks, drive each family's workflows through
the **real production code paths**, reproduce known historical bugs, and have the
Validator health-check the result — aggregated into a single **Release Readiness**
go/no-go report.

### 12.3 Full design → `TEST_HARNESS_ARCHITECTURE.md`

The **implementation-ready** Test Harness design — lifecycle, workbook management
(naming / metadata / labeling / fail-closed `assertDisposableTarget_` / cleanup /
concurrency), the scenario model + categories (SMOKE / REGRESSION / RECOVERY /
STRESS), scenario packs, the guard model, file layout, reuse map, implementation
order, and risks — now lives in its own document so this Validator doc stays about
the read-only judge:

- **`TEST_HARNESS_ARCHITECTURE.md`** — the runner's architecture (design of record).
- **`REGRESSION_SCENARIOS.md`** — the historical-bug registry (permanent project
  memory): every fixed production bug becomes a permanent `REG-###` scenario.
- **`RELEASE_READINESS.md`** — the pre-release go/no-go report format + workflow
  (`Release Readiness gate = Harness × Validator`).

**What the Validator provides to the Harness:** the read-only single-workbook
health entry `validator_health.js` (§10). The Harness writes; the Validator judges;
neither crosses that line.
