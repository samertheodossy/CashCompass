# CashCompass Validator Architecture

*The read-only Validator subsystem: architecture, current state, and roadmap —
plus the developer-only **Test Harness / Regression Runner**, the writer
counterpart that drives scenarios and calls the Validator to judge health (§12).*

**Status:** Documentation. **Phase 1 is complete** — the Golden Workbook parity
comparison + recommendation engine + scoped family runners are implemented in the
main app, **disabled by default**, **admin-gated**, **read-only**, with **no
runtime or provisioning call sites** (the only UI call site is the admin-gated
**Validation & Testing console**, `?view=validation`; nothing runs a validator in
the normal app flow). It is run manually from the Apps Script editor or that
console. Phase 1 drove the **2026-07 Golden Workbook convergence milestone**
(Operational, Financial Ledger, SYS, and Special families converged — see
`WORKBOOK_PARITY_CHECKLIST.md`). Single-workbook rules-based validators,
conditional-format capture, and provisioning validation are implemented and
runtime-proven as **Phase 2 Workbook Health** — see §10.

**Phase 2 — aggregate Workbook Health runtime-proven on isolated Central `@122` (2026-07-21).** Phase 2
shifts the Validator from **two-workbook Canonical comparison** to
**single-workbook Workbook Health validation** (does *this* workbook match the
canonical rules?). Its full module architecture, execution order, report format,
phased plan, risks, and recommended first implementation are specified in **§10 →
Phase 2 architecture**. Implemented: **2A Provisioning** (`validator_rules.js` +
`validator_provisioning.js` + `validatorRunProvisioning()`), **2B Workbook Drift**
(`validator_drift.js`), and **2B″ Schema Evolution V1** (`validator_schema.js`).
The formal schema registry, targeted Formula and Conditional-Formatting validation,
thin Named-Range validation, and aggregate Workbook Health (`validator_health.js`)
are implemented. Dedicated suite run `20260721-120759-5dc2` passed on a Restricted
populated disposable workbook with zero warnings, 9/9 functional assertions, and
verified Trash cleanup. The initial run's 25 advisory formula findings led to narrow
normalization/fixture corrections and permanent regression guards before closeout.

**Three validation questions (Provisioning + Drift refined 2026-07-13 → §10.0a;
Schema Evolution added 2026-07-13 → §10.0b).** Workbook Health answers *three
distinct questions* that must not be conflated:

1. **Provisioning Validation** — *"Was this workbook created correctly?"*
   Structural correctness that any era's workbook must satisfy (required sheets,
   required header *presence*). **Gating** — can FAIL.
2. **Schema Evolution Validation** — *"Is this workbook using a supported legacy
   schema, or a genuinely broken/too-old one?"* Version-attributable structural
   differences (missing `SYS - Meta`, header *ordering*, frozen-pane conventions,
   older year-block/naming conventions) reconciled against a schema-version
   registry. **Advisory & version-aware** — never FAILs on its own; it *downgrades*
   era-explained structural deltas to "supported legacy" and yields a
   **Compatibility** verdict. Only a schema too old to support maps to
   *Upgrade Required*.
3. **Workbook Drift Validation** — *"Has this workbook diverged cosmetically from
   the current canonical product standard?"* Per-workbook cosmetic/semantic
   divergence (canonical widths, row heights, styling, formulas, conditional
   formatting, ratified product-decision colors). **Advisory only** — never FAILs;
   drift is normal on lived-in workbooks.

*The dividing line between #2 and #3:* Schema Evolution explains differences that
correlate with the workbook's **creation era/version** (a whole generation of
workbooks looks this way); Drift explains **per-workbook** cosmetic changes (this
one workbook was edited). Both are advisory; neither FAILs the gate.

> **Status:** Provisioning (#1) and Drift (#3) are implemented (Phase 2A/2B′).
> **Schema Evolution (#2) V1 is implemented** (Phase 2B″ — `validator_schema.js`:
> `validatorRunSchemaEvolution()` / `validateSchemaEvolution_(ss)`), reconciling the
> three initial supported legacy differences (missing `SYS - Meta`, header ordering,
> frozen-pane conventions) into a Workbook Type + Compatibility verdict.

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
- **Required-sheet validation** *(implemented, Phase 2A — Provisioning gate)* — every canonical sheet exists.
- **Header validation** *(implemented, Phase 2A)* — header **presence** is a Provisioning gate; header **ordering** is a version signal that will move to Schema Evolution (§10.0b).
- **Provisioning structure** *(implemented, Phase 2A)* — frozen panes, hidden system sheets, `SYS - Meta` identity markers. *(Slated to reclassify as Schema Evolution / advisory — §10.0b — since these are version-attributable, not creation defects, on legacy/bound workbooks.)*
- **Schema Evolution / version compatibility** *(implemented V1 — advisory, §10.0b; `validator_schema.js`)* — detect the workbook's schema generation, reconcile era-explained structural deltas (V1: missing `SYS - Meta`, header ordering, frozen-pane conventions) into a **Workbook Type** + **Compatibility** verdict. A formal schema-version registry is future work. Supersedes the older "Schema validation (Provisioning gate)" framing.
- **Formula validation** *(planned — Workbook Drift, advisory)* — expected formula shapes (e.g. `=SUM` totals, Delta chains).
- **Formatting / Drift validation** *(planned — Workbook Drift, advisory)* — canonical widths, row heights, fonts, colors, conditional formatting, product-decision colors.

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

### Test Harness / Regression Runner — a *separate* writer subsystem *(foundation V1 implemented)*

The Test Harness is **not** part of the Validator — it is the **writer/mutator**
counterpart that drives scenarios and calls the read-only Validator to judge the
result (see §12). It lives in its own `test_harness_*` files so the read-only
guarantee of `validator_*` is never blurred. Foundation V1 (guard + disposable
lifecycle + one SMOKE scenario + report) is implemented; the fuller file set below
reflects the planned end state (`test_harness_data.js` and the scenario packs are
still future):

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
   `onOpen` auto-run and no menu item. Validators run only on an explicit, guarded
   request: a **manual editor Run**, or an admin action in the **Validation &
   Testing console** (`?view=validation`), whose `validation_testing_server.js`
   functions each re-check `assertValidatorAllowed_()` before calling a pure seam.
   Nothing runs a validator as a side effect of loading the app.
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
| `VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID` | optional for parity; required for `validatorRunProvisioning()` with no override | Default Central workbook. Used by the parity runner when no Central override is passed, and as the default target validated by the provisioning runner (which throws if it is unset and no override is given). |

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

### Engineering rule — developer runners vs runtime APIs

> **Developer runners operate on Script Property–configured resources. Runtime /
> user-facing APIs operate on `getUserSpreadsheet_()`. Overrides remain supported
> for diagnostics and one-off investigations.**

This separates *developer tooling* from *runtime application behavior*. A developer
runner must be **deterministic** — it validates (or, for the future Test Harness,
mutates) exactly the workbook the operator configured, never "whatever
`getUserSpreadsheet_()` happens to resolve." This matters most in Central editor
mode, where `getUserSpreadsheet_()` resolves — and can even provision — the
*operator's own* mapped workbook rather than the workbook under test.

Consequences:

- Every developer runner reads its target(s) from Script Properties by default and
  accepts an optional explicit ID override (diagnostics / one-off runs). If the
  required Script Property is unset it throws a clear error — **no silent fallback
  to `getUserSpreadsheet_()`**.
- Conforming runners today: `validatorRunGoldenParity()` /
  `validatorRunGoldenParity*` (Golden + default Central IDs from properties) and
  `validatorRunProvisioning(spreadsheetIdOverride?, options?)` (override, else
  `VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID`). Future `validatorRunWorkbookHealth()`
  and Test Harness runners follow the same shape.
- **Runtime** application code (e.g. a future in-app Workbook Health check) does
  the opposite: it calls the pure, `ss`-parameterized seam — `validateProvisioning_(ss)`
  — with `getUserSpreadsheet_()`, so it always acts on the current user's own
  workbook. Runtime code must never call the developer runners.

Because of this, `VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID` is **required** when
`validatorRunProvisioning()` is called with no override (it is still optional for
the parity runner, which can take its Central override inline).

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
- **Phase 2 — Workbook Health validation — implemented and isolated-runtime proven.** Single-workbook,
  rules-based validation. **Implemented:** **2A Provisioning** (structural gate —
  `validator_rules.js` canonical model + `validator_provisioning.js` /
  `validatorRunProvisioning()`), **2B Workbook Drift** (advisory —
  `validator_drift.js` / `validatorRunWorkbookDrift()`), and **2B″ Schema Evolution
  V1** (advisory, version-aware — `validator_schema.js` /
  `validatorRunSchemaEvolution()`), Formula validation, Conditional-Formatting
  validation, Named-Range validation, and aggregate Workbook Health
  (`validator_health.js`). Full architecture, execution
  order, report format, phased plan, and risks are in **§10 → Phase 2 architecture**
  below.
- **Phase 4 — admin UI — implemented (V1).** The **Validation & Testing console**
  (`ValidationTestingUI.html` + `validation_testing_server.js`, admin-gated route
  `?view=validation`) runs Provisioning / Workbook Drift / Schema Evolution — and
  the Test Harness smoke scenario — from the browser without the editor. Formula /
  Conditional-Formatting / Full Workbook Health buttons and the Release Readiness
  verdict remain future additions to the same page (`VALIDATION_TESTING_CONSOLE.md`).

At every phase: read-only, guarded, default-off, and covered by the CI guards.

### Phase 2 architecture — Workbook Health validation *(designed 2026-07-12; runtime-proven 2026-07-21)*

> **Status:** **Partially implemented.** This section is the full design of record.
> Built so far: **Provisioning** (`validator_provisioning.js`), **Workbook Drift**
> (`validator_drift.js`), and **Schema Evolution V1** (`validator_schema.js`), all
> reachable from the admin **Validation & Testing console** (§13). The current local
> source also implements Formula validation, Conditional-Formatting validation,
> Named-Range validation, and the aggregate **Workbook Health report**
> (`validator_health.js`). Isolated Central runtime validation remains pending.

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

#### 10.0a Two validation questions — Provisioning vs Workbook Drift

The 2026-07 provisioning reports surfaced a modeling flaw: `validatorRunProvisioning`
emitted **column-width WARNs on healthy, lived-in workbooks**. Those are real and
useful, but they are **not provisioning failures** — a user legitimately resizing a
column, or an older workbook predating a widened canonical standard, is **drift**,
not a creation defect. Phase 2 therefore separates two questions that share one
check library but have different **gating semantics**:

| | **Provisioning Validation** | **Workbook Drift Validation** |
|---|---|---|
| Question | *Was this workbook created correctly?* | *Has this workbook diverged from the current canonical standard?* |
| Nature | Structural / functional correctness | Cosmetic / semantic divergence |
| Gate | **Gating** — ERROR ⇒ FAIL | **Advisory** — WARN/INFO only, **never FAIL** |
| Stable under user edits? | Yes — a created-correctly workbook stays PASS no matter how much data/formatting the user changes | No — expected to accumulate over a workbook's life |
| Checks | required/expected/optional **sheet presence**; **required headers** (schema); **frozen panes**; **hidden system sheets**; **`SYS - Meta` identity markers**; **required bootstrap metadata**; no **unexpected named ranges** | **canonical column widths**; **row heights**; **family styling / header-yellow / banner** drift; **canonical color / product-decision** drift; **formula-shape** drift; **conditional-format** drift |

**The dividing line:** *structural & set-once-at-create → Provisioning; cosmetic &
user-adjustable (or semantic divergence from an evolving standard) → Drift.* Frozen
panes stay in Provisioning (functional, set once, rarely touched); widths and row
heights move to Drift (cosmetic, widen-only, routinely resized).

**Width decision (evaluated: keep in Provisioning / move to Drift / make it a
mode).** **Move to Drift.** A width below canonical is *ambiguous* — it can mean
"first-create widths were never applied" (a defect) **or** "user narrowed the
column" / "older canonical standard" (drift) — and the Validator cannot tell which
read-only. Ambiguous, non-gating signals belong in the advisory Drift report, not
the pass/fail Provisioning gate. A mode toggle was rejected as needless config:
the two runners already express the distinction cleanly. Widen-only semantics are
preserved wherever widths are checked.

**One library, two runners, one umbrella.** The atomic unit is the per-check
function (`checkSheetHeaders_`, `checkSheetFrozen_`, `checkSheetWidths_`, …). Two
`ss`-parameterized seams compose them:

```
validateProvisioning_(ss)  → structural gate     (presence, headers, frozen, hidden, markers)   ERROR ⇒ FAIL
validateDrift_(ss)         → advisory divergence  (widths, row heights, styling, formulas, CF)  never FAIL
```

**Workbook Health (Module 6)** runs both and renders **Structural (Provisioning)**
and **Divergence (Drift)** sections — plus, once Schema Evolution ships (§10.0b), a
**Schema (Schema Evolution)** section and a top-line **Workbook Type +
Compatibility** badge — with a combined gate where **only Provisioning ERRORs
FAIL**. Module mapping to the buckets: Modules 1 (sheets) + 2 (required-header
*presence*) are **Provisioning-class (gating)**; the frozen/hidden/marker checks
and header *ordering* are **Schema-Evolution-class (advisory, version-aware —
§10.0b)**; widths/row-heights/styling + Module 3 (formulas) + Module 4 (conditional
formatting) are **Drift-class (advisory)**; Module 5 (named ranges) is structural
(Provisioning) but thin today.

#### 10.0b Schema Evolution — the third question (V1 implemented — `validator_schema.js`)

> **V1 status (2026-07-13).** Implemented as a read-only, advisory reconciliation
> lens in `validator_schema.js`: `validateSchemaEvolution_(ss)` runs the Provisioning
> gate, `classifyWorkbook_(provReport)` derives platform (Central/Bound) × generation
> (Current/Legacy) → **Workbook Type**, plus a **Compatibility** verdict
> (`FULLY_CURRENT` / `COMPATIBLE_LEGACY` / `UPGRADE_RECOMMENDED` / `UPGRADE_REQUIRED`),
> and `reclassifySchemaFindings_(...)` MOVES the supported legacy differences
> (missing `SYS - Meta`, header **ordering**, frozen-pane conventions) out of
> Provisioning and re-emits them under **Schema Evolution** as INFO
> (*"Supported legacy schema — …"*). It invents no new rules, never repairs, never
> migrates. Exposed via the guarded developer runner `validatorRunSchemaEvolution()`
> and the Workbook Health Console (server seam `vtRunSchemaEvolution`). A formal
> schema-version registry (per-version expected structures) remains future work.

**Origin (2026-07-13).** Workbook Health V1 was tested against a **newly
provisioned Central workbook** (clean) and an **older bounded production workbook**.
The bounded workbook exposed a modeling gap: the Provisioning gate emitted
structural WARNs — *missing `SYS - Meta`*, *different header ordering*, *different
frozen panes*, *older structural conventions* — that are **not creation defects**.
They are the fingerprints of an **earlier, still-supported schema generation**.
Flagging them as provisioning problems is misleading: nothing is broken; the
workbook simply predates the current schema.

**New question.** *"Is this workbook using a supported legacy schema?"* — distinct
from *"was it provisioned correctly?"* (Provisioning) and *"has it drifted
cosmetically?"* (Drift). Schema Evolution is **version-aware**: it interprets
structural deltas against the workbook's detected **schema generation**.

**Classification of the bounded-workbook findings:**

| Finding | V1 classification | Recommended class | Gate | Rationale |
|---|---|---|---|---|
| Missing `SYS - Meta` | Provisioning WARN (expected sheet) | **Schema Evolution** INFO (on Bound/Legacy) | Advisory | `SYS - Meta` is a current Central-era construct; legitimately absent pre-schema. On a *current Central* workbook it remains a real Provisioning/upgrade signal. |
| Different header ordering | Provisioning WARN (misordered) | **Schema Evolution** INFO | Advisory | The app maps columns by header *name*; order is a version convention, not a defect. |
| Different frozen panes | Provisioning WARN | **Schema Evolution** INFO (if version-correlated) / **Drift** WARN (if lone) | Advisory | Convention changed across versions *and* is user-adjustable — never gating. |
| Older structural conventions (year-block header row, legacy names) | Provisioning WARN/ERROR | **Schema Evolution** INFO/WARN | Advisory | Era-appropriate structure; supported legacy. |
| Missing **required** sheet (e.g. `INPUT - Settings`) | Provisioning ERROR | **Provisioning** ERROR *(stays)* | **Gating** | Broken regardless of era. |
| Missing **required header/column** | Provisioning ERROR | **Provisioning** ERROR *(stays, unless a legacy alias is registered)* | **Gating** | Functional break. |
| Column width below canonical | Drift WARN | **Drift** WARN *(stays)* | Advisory | Cosmetic. |

**Should Schema Evolution be its own class? Yes — as an advisory *reconciliation
lens*, not a fourth independent runner.** It reuses the existing structural check
functions and adds two things:

1. **A schema-version registry** (`validator_schema_versions.js`, future) — each
   supported generation described as a **delta from current canonical** (e.g.
   *v1 bound-era*: no `SYS - Meta`, header order A, frozen convention X; *v2*: adds
   `SYS - Meta` markers; *v3 current*). Declared as data, referencing the same
   production constants the model already uses.
2. **A reconciliation step** — for each structural finding, if it matches a
   supported legacy generation's delta, **downgrade** it from a Provisioning
   defect to a Schema Evolution INFO (*"supported legacy schema vN"*); otherwise it
   stays a true Provisioning finding.

**Workbook lifecycle model (Workbook Type × Compatibility).**

- **Workbook Type (2×2)** — detected server-side from structural signals:
  - *Bound vs Central* — Central workbooks are standalone and carry `SYS - Meta`
    identity markers / Drive app-properties; bound workbooks are the older
    container-bound sheets without them.
  - *Current vs Legacy* — detected schema generation `== latest` → Current, else
    Legacy.
  - → `Central Current` · `Central Legacy` · `Bound Current` · `Bound Legacy`.
- **Compatibility verdict** — derived from the detected generation + any residual
  true defects:
  - **Fully Current** — latest schema, no structural deltas.
  - **Compatible Legacy** — older supported schema; app works; informational only.
  - **Upgrade Recommended** — older schema with beneficial upgrades available
    (e.g. add `SYS - Meta`); still works, no action forced.
  - **Upgrade Required** — schema too old / a residual true defect (a required
    sheet/header truly missing with no legacy explanation). **This is the only
    Schema-Evolution outcome that couples to a gate** — it maps to a Provisioning
    FAIL.

**Which existing Provisioning checks stay vs move:**

- **Stay Provisioning (gating):** required **sheet presence**; required **header
  presence** (a canonical column existing at all, by name).
- **Move to Schema Evolution (advisory, version-aware):** `SYS - Meta`
  presence/hidden/markers; header **ordering**; frozen-pane **conventions**; legacy
  structural conventions (header-row position, older sheet names).
- **Stay Drift (advisory, cosmetic):** widths, row heights, colors, styling,
  formulas, conditional formatting.

**Report shape.** Workbook Health (Module 6) renders **three sections** —
*Structural (Provisioning, gating)*, *Schema (Schema Evolution, advisory)*, and
*Divergence (Drift, advisory)* — plus a top-line **Workbook Type** + **Compatibility**
badge. The overall gate still FAILs **only** on Provisioning ERRORs; Schema
Evolution and Drift never flip it to FAIL (except the *Upgrade Required* case,
which is by definition a residual Provisioning ERROR).

**Implementation status.** Schema Evolution **V1 is implemented**
(`validator_schema.js` — `validatorRunSchemaEvolution()` / `validateSchemaEvolution_`):
it performs the reclassification described above and yields the Workbook Type +
Compatibility verdict, surfaced in the Validation & Testing console (§13). Still
future: a formal **schema-version registry** (per-version expected structures) and
folding the three sections into the single aggregate **Workbook Health report**
(Module 6). Roadmap slice **2B″** (see §10.10).

#### 10.1 Module 1 — Provisioning Validation

- **Bucket:** **Provisioning (gating).** Structural correctness only — **no width,
  row-height, styling, formula, or CF checks** (those are Drift, §10.0a).
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

Today: **admin-only** — editor runners **plus** the admin **Validation & Testing
console** (`?view=validation`), which already runs Provisioning / Drift / Schema
against a chosen workbook. Still future: a **user-facing** "Check Workbook Health"
action (e.g. in the user's own app / Admin Diagnostics) that runs
`validateActiveWorkbook` on the caller's workbook and renders a **read-only report
card** (score + top issues + an "advisory only" banner). It **never repairs**; if the user wants to fix issues, a separate button
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
- **2B′ — Provisioning/Drift split (recommended next slice, see §10.0a).** The
  implemented `validatorRunProvisioning` currently mixes an advisory **width** check
  into the structural gate (it WARNs on healthy lived-in workbooks). Split it:
  keep `validateProvisioning_(ss)` **structural-only** (drop width findings) and
  add an advisory `validateDrift_(ss)` + `validatorRunWorkbookDrift()` that owns
  widths (and later row heights / styling / formulas / CF), **never** FAILing.
  Small — reuses the existing `checkSheetWidths_` function; mostly re-wiring. Do this
  before adding more Drift-class checks so every new check lands in the right bucket.
- **2B″ — Schema Evolution / version compatibility (V1 DONE — advisory, version-aware;
  see §10.0b; `validator_schema.js`).** A read-only reconciliation lens that detects the
  workbook's **Workbook Type** (Central/Bound × Current/Legacy) and **Compatibility**
  verdict, and reclassifies version-attributable structural deltas (V1: missing
  `SYS - Meta`, header ordering, frozen-pane conventions) as *supported legacy* rather
  than provisioning failures. Reuses the existing structural check functions; adds no
  new I/O beyond the Provisioning run. **Future:** a formal per-version schema registry
  and reconciling additional legacy structural conventions.
- **2C — Conditional Formatting (Module 4, Drift-class).** Add `snapshotConditionalFormatRules_`;
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

**Note.** This recommended first slice has **shipped** (Phase 2A): required-sheet +
header-presence validation (`validator_provisioning.js`), and the prerequisite
`*_REQUIRED_HEADERS_` constant extraction is done for the initial core sheets.
Conditional Formatting, Formulas, Named Ranges, and Workbook Health are runtime-
proven on isolated Central `@122`; run `20260721-120759-5dc2` is the closeout evidence.

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

## 12. Test Harness / Regression Runner *(foundation V1 implemented — the writer counterpart)*

> **Status:** **Foundation V1 implemented.** `test_harness_core.js`,
> `test_harness_scenarios.js`, and `test_harness_report.js` exist: the guard +
> disposable-workbook lifecycle + `assertDisposableTarget_` + one SMOKE scenario
> (Provision + one Donation row) + report shaping. It runs from the editor
> (`testRunSmoke()` / `testRunSmokeTrash()`) and from the Validation & Testing
> console's Test Harness card (Keep/Trash). Scenario packs, Regression/Recovery/
> Stress, and the Release Readiness gate remain unbuilt. Roadmap sequence
> (`ROADMAP.md → P1`): (1) Validator Phase 2A/2B → **(2) Test Harness foundation
> *(done)*** → (3) Scenario packs → (4) Release Readiness gate. Full design:
> `TEST_HARNESS_ARCHITECTURE.md`.

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

---

## 13. Validation & Testing admin console *(V1 implemented — the UI surface)*

> **Status:** **V1 implemented.** `ValidationTestingUI.html` +
> `validation_testing_server.js`, admin-gated route `?view=validation` in
> `webapp.js`. Live: **Target** selection (Configured Central default / Explicit ID)
> with a safety readout; **Workbook Health** — Provisioning (gating), Workbook Drift
> (advisory), Schema Evolution (advisory, standalone); and a single-scenario **Test
> Harness** card (Keep/Trash). Still future: the multi-suite selector, Formula/CF
> buttons, and the Release Readiness verdict. Full design of record:
> **`VALIDATION_TESTING_CONSOLE.md`**.

A dedicated admin-only page — **Validation & Testing** — is the operator surface for
both subsystems: (B) run Validator / Workbook Health checks against a chosen target,
(C) run Test-Harness suites against disposable workbooks, and render the aggregated
**Release Readiness** verdict. It picks a target workbook with an explicit
**safety readout** (name · ID · target type · READ-ONLY/WRITABLE/REFUSED) shown on
every action.

Key design rules carried by the console:

- **Server functions return structured report objects, not logs.** The console
  server layer (`validation_testing_server.js`) calls the pure, `ss`-parameterized
  seams (`validateProvisioning_(ss)`, the other `validate*_(ss)` in
  `validator_health.js`) and the guarded Harness suite functions, and returns their
  objects for the client to render.
- **Server is authoritative for admin/target/safety** — the client's chosen target
  type is re-resolved and re-classified server-side; Harness actions require a
  disposable target that passes `assertDisposableTarget_`.
- **Editor runners remain available for development but are secondary.**

Sequenced in `ROADMAP.md → P1`: console C1 (read-only Validator) after Validator
Phase 2A; the Regression Testing section after the Test Harness foundation.
