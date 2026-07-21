# Validation & Testing — Admin Console (Architecture / Design)

*A single admin-only operator console for the read-only **Validator** (Workbook
Health) and the writer **Test Harness** (Regression Runner), plus the aggregated
**Release Readiness** verdict.*

**Status:** **V1 implemented; later phases still design.** Live today
(`ValidationTestingUI.html` + `validation_testing_server.js`, admin-gated route
`?view=validation` in `webapp.js`): **Section A Target** (Configured Central default
/ Explicit ID) with a read-only safety readout; **Section B Workbook Health** —
Provisioning (gating), Workbook Drift (advisory), and Schema Evolution (advisory,
standalone) with status cards, findings, and a JSON viewer; and **Section C Test
Harness** — a collapsible writer card with dynamic scenario and suite selectors,
Keep/Trash disposition, per-scenario detail, and JSON reports
(`vtListHarnessScenarios()` / `vtRunHarnessScenario()` /
`vtListHarnessSuites()` / `vtRunHarnessSuite()`). **Still design only:** multi-select
pack composition and the aggregate Release Certification orchestrator,
the mapped-user and disposable target types, Formula / Conditional-Formatting
validation buttons, the Release Readiness verdict, and extracting the inline client
controller into a separate `validation_testing.js`. This document remains the design
of record for those; it sits on top of the subsystems in `VALIDATOR_ARCHITECTURE.md`
(§10 Phase 2 Workbook Health) and `TEST_HARNESS_ARCHITECTURE.md`, and the report
format in `RELEASE_READINESS.md`.

**Why a page (vs editor functions / Admin Diagnostics):** the editor runners stay
available for development but are secondary — they log to Executions and require an
operator comfortable in the Apps Script editor. Burying these in Admin Diagnostics
mixes a *judging + mutating* toolset into a general diagnostics surface. A dedicated
console gives one place to (1) pick a target workbook with an explicit safety
readout, (2) run Validator/Workbook-Health checks, (3) run Test-Harness suites, and
(4) read a Release Readiness verdict — with the target workbook ID shown on every
action.

---

## 0. Boundary (inherited, non-negotiable)

The console is only a **surface**. It changes none of the guarantees below; it
merely calls the existing guarded subsystems and renders their structured results.

| | **Validator** (`validator_*`) | **Test Harness** (`test_harness_*`) |
|---|---|---|
| Role | Read-only **judge** | **Writer** — creates + exercises disposable workbooks |
| Writes? | Never (getters only) | Only to disposable, test-marked workbooks it created |
| Console section | B. Workbook Validation | C. Regression Testing |
| Allowed targets | any workbook the admin can read | **only** disposable test workbooks |

The console never introduces a new way to write to a real workbook. Harness "Run"
actions are enabled **only** for a `DISPOSABLE_TEST` target, enforced **server-side**
by `assertDisposableTarget_` (never by client state).

---

## 1. Page architecture

```
doGet(?page=validation-testing)                    (admin-only route)
        │  server-side admin check BEFORE render; non-admins get the normal app
        ▼
ValidationTestingUI.html   ──renders──►  A Target · B Validation · C Regression · D Safety
        │                                        ▲
        │ google.script.run (per action)         │ structured report objects (NOT logs)
        ▼                                        │
validation_testing_server.js  ── guarded API layer (admin + feature flags) ──┐
        │                                                                    │
        ├─ Validator actions → validator_* pure seams (read-only)            │
        │     validateProvisioning_(ss) [gating] · validateSchema_(ss) ·     │
        │     validateDrift_(ss) [advisory] · validateFormulas_(ss) ·        │
        │     validateConditionalFormatting_(ss) ·                           │
        │     validateWorkbookHealth_(ss)   [validator_health.js]            │
        │                                                                    │
        └─ Harness actions → test_harness_core.js (guarded, writer)          │
              runRegressionSuite(options) · pack runners · cleanup           │
                                                                             │
validation_testing.js  ── client controller: state, calls, rendering ◄───────┘
```

- `ValidationTestingUI.html` — markup + minimal inline bootstrap only.
- `validation_testing.js` — **client** controller (bundled into the HTML via an
  include): holds page state (selected target, selected suites), issues
  `google.script.run` calls, renders returned report objects, wires copy buttons.
- `validation_testing_server.js` — **server** API layer: every function
  admin-gated + flag-gated, resolves the target, calls the pure Validator seams or
  the guarded Harness, and **returns structured objects** (never relies on
  `Logger`). This is the only new server surface; it owns no validation/harness
  logic itself — it orchestrates and shapes.

**Design rule (important):** server functions **return structured report objects**,
not log output. The existing editor runners log *and* return; the console calls the
pure, `ss`-parameterized seams (`validateProvisioning_(ss)`, …) and the Harness
suite functions, and returns their objects straight to the client for rendering.

---

## 2. UI layout

### A. Target Workbook

Selects the one workbook every action in B (and, for disposable targets, C) runs
against. Target type is chosen here; the safety readout updates immediately.

Target options (radio):

- **Configured default Central workbook** — `VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID`.
- **Explicit workbook ID** — free-text ID (one-off diagnostics / investigations).
- **Selected mapped user workbook** — chosen from the Central user→workbook mapping
  (admin diagnostics already enumerates mappings). *Validation only — never a
  Harness target.*
- **New disposable test workbook** — created by the Harness on run. *Test Harness
  only; never used by section B against real data.*

Always displayed for the resolved target:

```
Name          : <workbook name>
ID            : <workbook id>
Target type   : CONFIGURED_DEFAULT | EXPLICIT_ID | MAPPED_USER | DISPOSABLE_TEST
Safety status : READ-ONLY SAFE | WRITABLE (DISPOSABLE) | REFUSED (production/unknown)
Workbook type : CENTRAL_CURRENT | CENTRAL_LEGACY | BOUND_CURRENT | BOUND_LEGACY   (Schema Evolution V1 — §10.0b)
Compatibility : FULLY_CURRENT | COMPATIBLE_LEGACY | UPGRADE_RECOMMENDED | UPGRADE_REQUIRED   (Schema Evolution V1)
```

The safety status is computed **server-side** (`classifyTarget_`) and echoed to the
client; the client renders it but never decides it.

**Workbook Type + Compatibility (Schema Evolution V1 — implemented; see
`VALIDATOR_ARCHITECTURE.md → §10.0b`).** The console shows the detected **Workbook
Type** (Central/Bound × Current/Legacy) and a **Compatibility** verdict (Fully
Current / Compatible Legacy / Upgrade Recommended / Upgrade Required). Both are
computed **server-side** (`validateSchemaEvolution_` → `classifyWorkbook_`, via the
`vtRunSchemaEvolution` seam) from structural signals and echoed to the client, which
renders but never decides them. In V1 they populate after a **Schema Evolution** or
**Run Workbook Health** run (before that they read *"not run"*); a future slice may
compute them at inspect time. Their purpose is to let an operator read a legacy/bound
workbook as *Compatible Legacy* at a glance rather than mistaking version deltas for
provisioning failures.

### B. Workbook Validation (Validator — read-only)

Actions are grouped by class (see `VALIDATOR_ARCHITECTURE.md → §10.0a`) —
**gating** (can FAIL) vs **advisory / Workbook Drift** (divergence only, never FAIL).
Buttons are disabled until their module ships:

*Gating (Provisioning):*
- Run Provisioning Validation *(available now — Phase 2A; structural: required sheets, header presence, frozen, hidden, `SYS - Meta` markers)*

*Advisory & version-aware (Schema Evolution V1 — §10.0b):*
- Run Schema Evolution *(available now — Phase 2B″ V1; detects Workbook Type + Compatibility; reclassifies version-attributable deltas — missing `SYS - Meta`, header ordering, frozen-pane conventions — as *supported legacy* rather than provisioning failures. Note: Provisioning findings shown after this run are the RECONCILED set, with those deltas moved to the Schema section.)*

*Advisory (Workbook Drift):*
- Run Workbook Drift *(available now — widths; row heights, styling, product-decision colors — Phase 2B′)*
- Run Conditional Formatting Validation *(Phase 2C — Drift-class)*
- Run Formula Validation *(Phase 2D — Drift-class)*

- Run Full Workbook Health *(runs the stable pipeline: **Provisioning + Workbook Drift**. Schema Evolution V1 is intentionally EXCLUDED — it stays a standalone action until validated across workbook types, then can be promoted into this pipeline deliberately.)*

Output panel:

- **Workbook Type + Compatibility badge** *(Schema Evolution — live via the standalone
  action; not part of the Full Workbook Health pipeline)* — top-line read of the
  workbook's schema generation so legacy/bound targets are legible at a glance.
- Overall badge: **PASS / WARN / FAIL** — driven by **gating (Provisioning)**
  findings only; advisory Schema Evolution and Drift findings surface as WARN/INFO
  and never flip the badge to FAIL (the sole exception is *Upgrade Required*, which
  by definition is a residual Provisioning ERROR).
- Counts: **ERROR / WARN / INFO / OK**.
- Three grouped sections — **Structural (Provisioning)**, **Schema (Schema
  Evolution)** *(live via the standalone action)*, and **Divergence (Drift)** — each
  with per-module sub-sections, badge + counts.
- Per-sheet findings table: `sheet · presence · status · [severity][kind] message`.
- **Copy JSON** (the raw report object) and **Copy text summary** (the human report).

### C. Regression Testing (Test Harness — writer, disposable targets only)

> **V1 SLICE IMPLEMENTED (dynamic scenario registry).** A collapsible **Test Harness**
> card is live on `ValidationTestingUI.html`, below Workbook Health. Its selector
> reads the registered scenarios, including `SMOKE-POPULATED-FIXTURE`, and renders the harness
> report (Overall · Run ID · Workbook link · Disposition + Provisioning / Schema
> Evolution / Drift cards + raw JSON). Server: `vtListHarnessScenarios()` and
> `vtRunHarnessScenario(scenarioId, options)` in `validation_testing_server.js` —
> thin wrappers over the guarded scenario runner, guarded by `assertHarnessAllowed_()`,
> that never accept a client workbook ID and never use the Target selector (the
> harness always creates its own disposable workbook; `assertDisposableTarget_`
> stays authoritative for the trash). The full multi-suite selector below remains
> future work (phase C3+).

Actions:

- Run Smoke suite
- Run Regression suite
- Run Recovery suite
- Run Stress suite
- Run Full Release Readiness

Suite selector (checklist + dropdown):

- pick packs and/or individual scenarios; each row shows **scenario ID**,
  **category**, **description**, and the **expected Validator checks / gate**
  (from the scenario model in `TEST_HARNESS_ARCHITECTURE.md §3`).

Output panel:

- Suite status badge.
- Scenario-by-scenario results: `id · category · PASS/FAIL · failed step (if any)`.
- Validator findings after each scenario (the same report shape as section B).
- Final **Release Readiness verdict** (`READY FOR BETA / NOT READY`) per
  `RELEASE_READINESS.md`.
- Copy JSON / copy text.

### D. Safety (always visible)

A persistent panel restating the guarantees and the live gate state:

- Admin-only; `VALIDATOR_ENABLED` gates section B; `TEST_HARNESS_ENABLED` gates
  section C (both shown as on/off).
- Validator is read-only; Harness writes only to disposable test workbooks.
- Harness refuses the Canonical workbook, any mapped real user workbook, the
  production workbook, or an unknown/ambiguous workbook (fail closed).
- Every destructive/test action confirms with the **target workbook ID shown**.
- Disposable test workbooks are named `CASHCOMPASS TEST — … — SAFE TO DELETE`.

### E. Files (proposed — see §7 for the full architecture)

`ValidationTestingUI.html`, `validation_testing.js`, `validation_testing_server.js`,
`test_harness_core.js`, `test_harness_scenarios.js`, `test_harness_report.js`,
`validator_health.js`.

---

## 3. Safety model

Layered and **server-authoritative** — the client is never trusted for any
authorization or target decision (per the app's client-side + authorization
standards).

1. **Route guard.** The `?page=validation-testing` route runs an admin check in
   `doGet` **before** rendering; non-admins receive the normal app (no hint the
   page exists).
2. **Per-call guards.** *Every* `validation_testing_server.js` function re-checks
   admin + the relevant feature flag first — never assumes the page guard ran.
   Validator actions require `assertValidatorAllowed_()`; Harness actions require
   `assertHarnessAllowed_()`.
3. **Target classification is server-side.** `classifyTarget_(type, id)` resolves
   the workbook, computes the safety status, and refuses production IDs
   (`VALIDATOR_GOLDEN_WORKBOOK_ID`, `VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID` for
   *harness* writes, any mapped user ID, the bound workbook). The client's chosen
   "type" is validated, not trusted.
4. **Validator = read-only.** Section B calls only `validate*_(ss)` getters — no
   write path exists, regardless of target.
5. **Harness = disposable-only.** Section C can only act on a workbook the Harness
   itself created and that passes `assertDisposableTarget_` (marker + name + meta
   sheet + explicit production-ID refusal) **before every write** — enforced in
   `test_harness_core.js`, not the UI.
6. **Confirmation with ID.** Any run that writes (Harness) requires an explicit
   confirm dialog that prints the target workbook **ID + name**.
7. **Feature flags default off.** With both flags off the page renders but every
   action is inert/blocked server-side.

---

## 4. Target selection model

```
Target {
  type,          // 'CONFIGURED_DEFAULT' | 'EXPLICIT_ID' | 'MAPPED_USER' | 'DISPOSABLE_TEST'
  id,            // resolved spreadsheet ID (empty for a not-yet-created disposable)
  name,          // resolved workbook name
  safety,        // 'READ_ONLY_SAFE' | 'WRITABLE_DISPOSABLE' | 'REFUSED'
  refuseReason,  // when REFUSED: 'canonical' | 'mapped_user' | 'production' | 'unknown'
  allow: {       // computed server-side — which sections may act
    validate,    // B allowed (any readable workbook)
    harness      // C allowed (only DISPOSABLE_TEST that passes assertDisposableTarget_)
  }
}
```

Rules:

- `CONFIGURED_DEFAULT` / `EXPLICIT_ID` / `MAPPED_USER` → `validate: true`,
  `harness: false`, safety `READ_ONLY_SAFE` (or `REFUSED` if unreadable).
- `DISPOSABLE_TEST` → `harness: true` (once created + marker-verified); `validate`
  also allowed against it. Safety `WRITABLE_DISPOSABLE`.
- Any target whose ID matches a production/Canonical/mapped ID is `REFUSED` for
  **harness**; still readable for **validation** (that's the whole point of the
  read-only judge).
- The resolved `id` is displayed and included in every server call and every
  returned report (`report.workbookId`), so the acted-upon workbook is unambiguous.

---

## 5. Suite selection model

```
SuiteSelection {
  packs: ['SMOKE'|'REGRESSION'|'RECOVERY'|'STRESS'...],  // enabled categories
  scenarioIds: ['SMOKE-PROVISION','REG-001', ...],       // optional explicit subset
  stopOnSeverity,   // 'ERROR' (default) | 'WARN' | 'none'
  keepOnFailure,    // keep disposable workbook when a scenario fails (debugging)
  fullReleaseReadiness // run all packs + emit the Release Readiness verdict
}
```

- The selector is populated from `listScenarios()` (server) which reads the
  declarative packs in `test_harness_scenarios.js` — each entry exposes `id`,
  `category`, `description`, and `expectedOutcome` / `validatorChecks`.
- Maps directly onto `runRegressionSuite(options)` from
  `TEST_HARNESS_ARCHITECTURE.md §7` — the console builds `options`, the Harness
  owns execution.

---

## 6. Report rendering model

One shared renderer for section B and per-scenario results, because both use the
Validator's `Finding` shape.

```
ValidationReport {           // returned by every validator server action
  type,                      // 'provisioning' | 'schema' | ... | 'workbookHealth'
  workbook, workbookId,
  overall,                   // 'PASS' | 'WARN' | 'FAIL'
  counts: { error, warn, info, ok },
  modules?: [ { name, overall, counts, sheets, findings } ],  // full-health only
  sheets: [ { name, presence, status, findings:[Finding] } ],
  findings: [ Finding ]      // { severity, sheet, kind, message } — structural only
}

SuiteReport {                // returned by harness server actions
  runId, packs,
  scenarios: [ { id, category, status, failedStep?, report:ValidationReport } ],
  releaseReadiness?: { lines:[{dimension,status}], overall }  // 'READY FOR BETA'|'NOT READY'
}
```

Rendering:

- Overall badge color: PASS=green, WARN=amber, FAIL=red (reuse the existing
  Cash-Flow-style semantic palette conceptually; UI-only).
- Counts chips: ERROR/WARN/INFO/OK.
- Collapsible per-module (full health) and per-sheet sections; findings as a compact
  table.
- **Copy JSON** = `JSON.stringify(report)`; **Copy text** = the same human summary
  `validatorFormatProvisioningReport_` (and siblings) already produce, returned as a
  string field so the client copies without re-deriving.
- Findings are **structural/metadata only** (sheet names, headers, frozen panes,
  hidden state, marker keys, and — on the advisory Drift side — column widths / row
  heights / style attributes) — **no user cell values** — so nothing needs
  redaction in the UI.

---

## 7. Proposed files

> **Implemented today (V1) — note the naming/shape differences from the proposal
> below.** Files: `ValidationTestingUI.html` (with the client controller **inline**,
> not a separate `validation_testing.js`) + `validation_testing_server.js`. Shipped
> server functions: `vtGetDefaultTarget()`, `vtInspectTarget(id)`,
> `vtRunProvisioning(spreadsheetId)`, `vtRunWorkbookDrift(spreadsheetId)`,
> `vtRunSchemaEvolution(spreadsheetId)`, `vtListHarnessScenarios()`,
> `vtRunHarnessScenario(scenarioId, options)`. The `(type, id)` argument model,
> `vtRunFormulas` / `vtRunConditionalFormatting` / `vtRunWorkbookHealth`,
> `vtRunSuite`, `vtRunReleaseReadiness`, and `vtCleanupStragglers` below remain the
> design for later phases.

New (this console):

```
ValidationTestingUI.html        # page markup + inline CLIENT controller (state, google.script.run, rendering)
validation_testing_server.js    # SERVER API: guarded, resolves targets, returns objects
                                #   (a separate validation_testing.js controller is deferred)
```

Depended-upon (designed elsewhere; built in their own milestones):

```
validator_health.js             # Validator: full Workbook Health entry + per-module seams (read-only)
test_harness_core.js            # Harness: guard + disposable lifecycle + run loop (writer)
test_harness_scenarios.js       # Harness: declarative scenario packs
test_harness_report.js          # Harness: Release Readiness aggregation
```

**Server API surface (`validation_testing_server.js`) — all admin + flag gated,
all return structured objects:**

- `vtGetTargetInfo(type, id)` → `Target` (name, id, safety, allow). *Resolution +
  classification only; no run.*
- `vtRunProvisioning(type, id)` → `ValidationReport` *(wraps `validateProvisioning_`)*.
- `vtRunSchema(type, id)` → `ValidationReport` *(Phase 2B)*.
- `vtRunFormulas(type, id)` → `ValidationReport` *(Phase 2C)*.
- `vtRunConditionalFormatting(type, id)` → `ValidationReport` *(Phase 2D)*.
- `vtRunWorkbookHealth(type, id)` → `ValidationReport` with `modules[]` *(all
  available)*.
- `vtListScenarios()` → `[{id,category,description,expectedChecks}]`.
- `vtRunSuite(selection)` → `SuiteReport` *(wraps `runRegressionSuite`; disposable
  target only)*.
- `vtRunReleaseReadiness(selection)` → `SuiteReport` with `releaseReadiness`.
- `vtCleanupStragglers()` → `{trashed:[ids]}` *(wraps `harnessCleanupStragglers`)*.

Each server function: **guard → resolve/classify target → refuse if not allowed for
that action → call the pure seam / guarded harness → return the object.** No
function trusts the client's `type`; it re-resolves and re-classifies.

Editor runners (`validatorRunProvisioning`, `validatorRunGoldenParity*`,
`harnessRun*`) **remain available** for development but are secondary to the page.

---

## 8. Implementation phases

Layered so value ships the moment each underlying module exists; the console never
gates on the whole subsystem.

- **C1 — Read-only Validator console (after Phase 2A). ✅ Done.**
  `ValidationTestingUI.html` + `validation_testing_server.js` with **Section A
  (Target)** and **Section B (Provisioning)**. Proves the route guard, target
  resolution, structured-object return, and rendering end-to-end. *(The client
  controller currently lives inline in the HTML rather than a separate
  `validation_testing.js`; extraction is deferred.)*
- **C2 — More Validator modules. ◑ Partial.** Workbook Drift and Schema Evolution
  buttons are wired (`vtRunWorkbookDrift`, `vtRunSchemaEvolution`). Formula /
  Conditional-Formatting / Full Workbook Health buttons remain future as each
  Phase-2 module ships.
- **C3 — Regression Testing (after Test Harness foundation). ◑ V1 slice done.**
  Section C supports one registered scenario or one registered suite at a time,
  including `SMOKE-POPULATED-FIXTURE` and `SUITE-CENTRAL-SAFETY`, with Keep/Trash
  controls and detailed reports. The harness always creates its own disposable
  workbook and `assertDisposableTarget_` enforces teardown. Multi-select pack
  composition and bounded-chunk Release Certification remain future.
- **C4 — Release Readiness verdict.** Add the aggregated verdict rendering + "Run
  Full Release Readiness" once the gate (`RELEASE_READINESS.md`) exists.
- **C5 — Polish.** Long-run handling (per-pack runs / progress), cleanup-stragglers
  action, copy/export refinements.

Sequencing vs the roadmap: C1 follows P1 Validator 2A; C3+ follow the Test Harness
foundation + Release Readiness gate in `ROADMAP.md → P1`.

---

## 9. Risks

- **Web UI exposes admin power that used to require the editor (highest).**
  *Mitigation:* route guard + per-call admin/flag guards, both default-off; server
  is the sole authority; the page is invisible to non-admins.
- **Client tampering with target type to point Harness at a real workbook.**
  *Mitigation:* server re-resolves + `classifyTarget_` + `assertDisposableTarget_`
  before any write; the client's `type` is validated, never trusted.
- **Accidental destructive run.** *Mitigation:* Harness confirm dialog printing the
  target **ID + name**; Section C disabled unless a verified disposable target is
  selected.
- **`google.script.run` payload size / long-running suites vs the 6-min limit and
  client timeouts.** *Mitigation:* per-pack runs, scoped Validator runs, capped
  findings, optional progressive/polling execution; return trimmed objects (copy
  JSON offers the full detail on demand).
- **Duplicated report shaping between editor logs and the UI.** *Mitigation:* server
  returns both the structured object and the existing human `…FormatReport_`
  string; the UI never re-derives formatting.
- **Feature creep of `validation_testing_server.js` into holding logic.**
  *Mitigation:* it stays a thin orchestration/adapter layer; all validation lives in
  `validator_*`, all mutation in `test_harness_*`.

---

## 10. Documentation updates needed

When this is built (not now):

- **`VALIDATOR_ARCHITECTURE.md`** — add a short pointer (near §12) to this console
  as the UI surface for Workbook Health; note server functions return objects.
- **`TEST_HARNESS_ARCHITECTURE.md`** — note the console as the admin surface that
  drives `runRegressionSuite` and renders `RELEASE_READINESS.md`.
- **`RELEASE_READINESS.md`** — note the verdict is also rendered in the console.
- **`ROADMAP.md`** — add the console as a sequenced P1 surface (C1 after Validator
  2A; C3+ after the Harness foundation).
- **`README.md`** — add `VALIDATION_TESTING_CONSOLE.md` to the doc map.
- **`ENGINEERING_STANDARDS.md`** — record the rule: *console/UI server functions
  return structured report objects (not logs); developer editor runners remain
  secondary; server is authoritative for admin/target/safety.*

---

*V1 implemented (see Status header); later phases remain design only. This document is the design of record for the unbuilt phases.*
