# CashCompass Validator Architecture

*The read-only Validator subsystem: architecture, current state, and roadmap.*

**Status:** Documentation. **Phase 1 is complete** — the Golden Workbook parity
comparison + recommendation engine + scoped family runners are implemented in the
main app, **disabled by default**, **admin-gated**, **read-only**, with **no
runtime/UI/provisioning call sites**. It is run manually from the Apps Script
editor. Phase 1 drove the **2026-07 Golden Workbook convergence milestone**
(Operational, Financial Ledger, SYS, and Special families converged — see
`WORKBOOK_PARITY_CHECKLIST.md`). Remaining capabilities (single-workbook
rules-based validators, conditional-format capture, provisioning validation) are
**Phase 2+ future work** — see §10.

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

### Planned (single-workbook, rules-based validators)

```
validator_rules.js    # canonical rule definitions (required sheets, headers,
                      #   schema, formula + formatting expectations)
validator_checks.js   # pure read-only check functions (one per capability)
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

### Planned

**Public (guarded)**
- `validateActiveWorkbook(options)` — validate the caller's resolved workbook against the rules.

**Internal**
- `runValidators_`, `getValidatorRules_`, `checkRequiredSheets_`, `checkHeaders_`,
  `checkSchema_`, `checkFormulas_`, `checkFormatting_`.

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
- **Phase 2 — Provisioning Validation — planned.** Add `validator_rules.js`
  (required-sheets + headers, **sourced from the existing canonical constants**
  used by provisioning) and `validator_checks.js` (`checkRequiredSheets_`,
  `checkHeaders_`); expose `validateActiveWorkbook()` behind
  `assertValidatorAllowed_()`. See the **Phase 2 milestone** detail below.
- **Phase 3 — planned.** Add `checkSchema_` (column order/types / canonical schema
  evolution), `checkFormulas_` (expected `=SUM` totals and Delta chains), and
  `checkFormatting_` (snapshot vs rule expectations).
- **Phase 4 — planned (optional).** An admin-gated Admin Diagnostics UI action to
  run validators without the editor.

At every phase: read-only, guarded, default-off, and covered by the CI guards.

### Phase 2 milestone — Provisioning Validation *(planned; do not start yet)*

> **Status:** Documented milestone, **not started.** This work intentionally
> begins **only after Golden Workbook convergence is complete** (see
> `TODO.md → Stage 3` and `GOLDEN_WORKBOOK.md`). Captured here so the next major
> Validator milestone is not forgotten while convergence finishes.

**Goal.** After Central provisions a workbook, run a **read-only** validation that
verifies the workbook matches the canonical CashCompass architecture.

**Design principle (non-negotiable).**

- The Validator **validates** provisioning.
- The Validator **never performs** provisioning.
- The Validator **remains read-only.**

**Scope (future validation should include):**

- Required sheets
- Optional sheets based on enabled modules
- Sheet schema
- Headers
- Frozen panes
- Canonical column widths
- Typography
- Family styling
- Named ranges
- Key formulas
- **Conditional-format rules** *(see "Future capability — conditional-format
  validation" below)*
- Hidden / protected support structures
- Metadata sheets
- Workbook version compatibility
- Cross-sheet integrity
- Regression detection

**Architecture notes.**

- The Validator **derives expectations from canonical constants and shared
  helpers** — the same source provisioning uses.
- The Validator **does not duplicate provisioning rules.**
- Provisioning and the Validator **must always share the same source of truth.**

**Future capability — conditional-format validation.**

Today the Validator captures **rendered cell styles and number formats**, but it
does **not** capture **conditional-format rules**. This is a real blind spot:
some visual behavior — especially positive/negative coloring and Income/Expense
row coloring — is driven by conditional formatting or by number-format color
sections (e.g. `[Red]`/`[Green]`), which the current snapshot cannot fully
attribute or verify. Without conditional-format capture the Validator cannot
fully verify this class of visual parity.

- **Capability:** snapshot conditional-format rules per sheet and compare them
  between Canonical and Central.
- **Scope of comparison:**
  - Rule ranges (the cells/columns each rule targets).
  - Formula conditions (e.g. `=$A1="Income"`).
  - Text / background / font color settings applied by each rule.
  - Ordering / priority where relevant (which rule wins when several match).
- **Use cases:**
  - Cash Flow **Income/Expense row colors** (`applyCashFlowRowTypeColorRules_`).
  - Cash Flow **Summary row positive/negative visual behavior**.
  - Future **financial-health color cues** (e.g. green-positive / red-negative
    nets).
- **Safety (unchanged from the rest of the Validator):**
  - **Read-only only** — snapshot and compare, never write.
  - **No repair / no mutation** of rules on either workbook.
  - **Reports differences only** — the report is advisory; humans decide.
- **Note:** the current Cash Flow Summary-row positive/negative behavior remains
  a **ProductDecision**, not a code change. This capability would only *detect
  and report* such differences; whether to change the behavior is a separate
  deliberate design call.

**Future workflow.**

```
Provision Workbook
        ↓
   Run Validator
        ↓
  PASS   or   Actionable Report
                    ↓
                   Fix
                    ↓
          Run Validator Again
```

**Note.** This work intentionally begins after Golden Workbook convergence is
complete. **Do not begin implementation now.**

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
