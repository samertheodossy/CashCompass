# CENTRAL_APP_SECOND_RESOLVER_SEAM.md

> **Superseded / Historical — Central App migration document.**
>
> The Central App architecture described here is **now live** — the two-project central deployment has shipped and is in family-beta use. This file is retained as a historical migration record and is **not** the current source of truth. Specific internal details below (commit hashes, "one-line pass-through" resolver descriptions, and "planned/next" framing) reflect the state at the time of authoring and may be out of date.
>
> **Current sources of truth:** `PROJECT_CONTEXT.md` · `TODO.md` · `README.md` · `WORKING_RULES.md`
>
> _Banner added in the Documentation Archive Preparation pass; the document body below is unchanged._

> **Status — shipped in `1b68c71` (Phase 2).** The design below is preserved as a historical record of what was decided before implementation. The actual landed seam matches this design exactly: `getQuickAddPaymentUiData()` in `quick_add_payment.js:35` was migrated by replacing `const ss = SpreadsheetApp.getActiveSpreadsheet();` with `const ss = getUserSpreadsheet_();`. Single line changed, one-line reversible, no other file touched. Lines 185 and 248 in the same file (the Quick Add **write** entries) were intentionally left unchanged, as the design specified. No central-mode behavior, no `PropertiesService`, no `openById`, no user mapping, no deployment change. Manual smoke test in the bound workbook passed: Quick Add payee dropdown matched the baseline, Type and Flow Source dropdowns unchanged, a Quick Add save still wrote to Cash Flow + `LOG - Activity` correctly, and the Phase 1 invariant (`Usable cash after buffers`) was preserved. After Phase 2: 2 production call sites migrated / 133 remaining. Phase 3 has since landed (`72d82b1`); this banner was added retroactively as part of that Phase 3 documentation pass. The text below records the design as authored; it has not been retroactively rewritten.

Design analysis for the **second** Central App resolver seam — the next read-only call site to migrate through `getUserSpreadsheet_()` after Phase 1 shipped in `b2798a7`.

**Analysis/design only.** No Apps Script code, no HTML/JS, no deployment changes, no implementation.

This document is the bridge between the Phase 1 outcome (recorded in `CENTRAL_APP_FIRST_RESOLVER_SEAM.md`) and the eventual Phase 2 implementation prompt. Its purpose is to pick the next call site to migrate, justify the pick against the audit's risk classification, and pre-commit the regression posture.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — overall migration architecture.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — preferred deployment direction.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle and backward-compatibility contract.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged roadmap. Phase 2 corresponds to `§5 step 1` *"…or a few low-risk module entry points…"* and `§5 step 3` *"Read-only dashboard paths"*.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — family beta scope.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — call-site inventory and risk classification (the source of the candidate shortlist).
- `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` — Phase 1 design and shipped outcome (the precedent this design must match).

---

## 1. Phase 1 recap (what's true today)

Phase 1 (`b2798a7`) shipped a single seam:

- **`central_resolver.js`** exists at the repo root and contains exactly one function, `getUserSpreadsheet_()`, whose body is a one-line pass-through to `SpreadsheetApp.getActiveSpreadsheet()`.
- **`cash_to_use.js:77`** was the single migrated call site; `getCashToUse()` now obtains its spreadsheet handle via `getUserSpreadsheet_()`.
- **134 other `SpreadsheetApp.getActiveSpreadsheet()` call sites remain unchanged** across 27 modules. None of `appsscript.json`, identity helpers, `openById`, `PropertiesService`, deployment settings, or onboarding paths were touched.
- **Smoke test** against the bound workbook passed; the dashboard Bills "Recurring Bills (No Due Date)" empty-state concern raised during testing was investigated separately and found unrelated to the seam.

Phase 2's job is to **migrate one more call site through the same resolver**, with the same byte-for-byte invariant and the same one-line reversibility. It does **not** change the resolver body, the resolver location, the resolver signature, or the deployment posture.

---

## 2. Constraints (binding for Phase 2)

These constraints come from the parent task prompt and from `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §7 / §9`. Any candidate that violates one of these is rejected.

- **No write paths.** The Phase 2 target must be read-only. The first write-path migration is `§5 step 4` of the implementation plan — not now.
- **No central mode.** The resolver body stays a one-line pass-through. Phase 2 does not consult `PropertiesService`, does not call `openById`, and does not query identity.
- **No `openById`.** Same as above, listed separately because it is the most tempting "small" addition.
- **No `PropertiesService`.** No reads, no writes, no namespace registration.
- **No user mapping.** No `SYS - Users`, no per-user spreadsheet ID storage, no email-to-workbook lookup.
- **No deployment changes.** `appsscript.json` untouched. `executeAs` stays `USER_DEPLOYING`. `access` stays `MYSELF`. No new OAuth scopes.
- **No broad refactor.** Exactly one call site migrates. Helpers it transitively calls are not migrated. Sibling functions in the same file are not migrated. Other files are not touched (except docs).
- **Bound-mode behavior identical byte-for-byte.** Same return shape, same return values, same blank-workbook posture, same hot-path latency floor.

The Phase 1 doc's §4 ("Why initial behavior should still return the active spreadsheet") and §5 ("Why this preserves backward compatibility") apply unchanged to Phase 2. The seam is still empty; Phase 2 only widens its coverage.

---

## 3. Candidate shortlist

The audit's §6 ("Low-risk modules") and §7 ("Candidate first abstraction seam → Alternates") are the source of the shortlist. Below, each candidate is evaluated against the constraints in §2.

Each candidate is described by:

- **File / function / line** — where the resolver call would land.
- **Call sites touched** — how many lines change in Phase 2.
- **Writes data?** — does the function (or anything it transitively calls before the resolver result is consumed) write to a cell, sheet, or schema?
- **Triggers ensure-\* helpers?** — does the function call `ensure*_` or `getOrCreate*_` after acquiring `ss`? These can create sheets on blank workbooks, which is a behavior surface (even though it's the *existing* behavior — Phase 2 must not change *when* the helper runs).
- **Dashboard visibility** — what does the user see if this function returns wrong data?
- **Regression risk** — relative to Phase 1's baseline.
- **Rollback simplicity** — how many lines / files to revert.
- **Testing requirements** — what manual smoke tests need to be run before and after.
- **Phase 2 verdict** — should be / should not be Phase 2, with rationale.

---

### 3.1 Candidate A — `buildDashboardSnapshot_()` (`dashboard_data.js:73`)

- **Call sites touched:** 1 line in 1 file.
- **Writes data?** No, but **calls `ensureActivityLogSheet_(ss)` at line 74**, which can create the `LOG - Activity` sheet on a blank workbook. The ensure helper itself is `ss`-aware (per the audit `§4`), so the helper receives whatever handle the resolver returns — that is the entire migration footprint downstream. Reads `SYS - Accounts`, `INPUT - Debts`, `SYS - Assets`, `SYS - House Assets`, `OUT - History`, and the prior-month investments path; tolerates each of those being missing via `try/catch` and explicit `getSheetByName` probes (lines 86–100, 105–107, 122, 148).
- **Triggers ensure-\* helpers?** **Yes** — `ensureActivityLogSheet_(ss)` unconditionally. This is the single most important characteristic that distinguishes this candidate from a textbook read-only seam. Phase 2's invariant ("behavior is identical, only the `ss` source changed") still holds — the ensure helper would run *exactly* as it does today, just with `ss` from the resolver — but the ensure-helper interaction is a fact that needs to be acknowledged, not hidden.
- **Dashboard visibility:** **Highest possible.** This function is the canonical entry point for every dashboard load. Overview KPIs, Net Worth attribution, deltas vs. last planner run, buffer runway, financial health score, suggested actions, and the issues list all flow from its return value. Indirectly: `getCashToUse()` (the Phase 1 migrated function) is called inside this snapshot path via the cash-to-use card on the overview. A Phase 2 migration here would make every consumer of `buildDashboardSnapshot_` go through the resolver once.
- **Regression risk:** **Medium.** The function itself is read-only and well-guarded for blank workbooks, but its surface area is enormous. A subtle divergence in `ss` semantics (which Phase 1 already ruled out at the platform level — the resolver returns the same object the platform call returns) would touch every overview field at once. Phase 2 is too early to take that bet against a high-visibility surface when an equivalent migration exists against a quieter surface.
- **Rollback simplicity:** One line. Identical to Phase 1.
- **Testing requirements:** Load every dashboard tab (Overview, Cash Flow, Bills Due, Planning, Assets, Activity); confirm every KPI matches a pre-change baseline; confirm the `LOG - Activity` sheet is not unexpectedly created on a populated workbook (it already exists); confirm a blank workbook still gets `LOG - Activity` created on first load (existing behavior — must not regress).
- **Phase 2 verdict:** **No — defer to Phase 3.** The function is the right *eventual* target, but it is too central for the **second** migration. Phase 2 should prove that the seam works across more than one *module* (Phase 1 only proved one). `buildDashboardSnapshot_` lives in `dashboard_data.js`, the highest-risk read module in the audit. A cleaner Phase 2 picks a second module first; `dashboard_data.js` migrates after the cross-module path is proven.

---

### 3.2 Candidate B — `getQuickAddPaymentUiData()` (`quick_add_payment.js:35`)

- **Call sites touched:** 1 line in 1 file.
- **Writes data?** **No.** Reads the current-year `INPUT - Cash Flow YYYY` sheet to build a payee suggestion list, the type list (`['Expense', 'Income']`), and the canonical flow-source vocabulary. Returns a `{year, payees, types, flowSources, flowSourceColumnPresent}` envelope. No cell write, no sheet creation, no schema change. The actual Quick Add *write* lives in a different function (`submitQuickAddPayment` / `recordQuickAddPayment_`); Phase 2 does not touch that.
- **Triggers ensure-\* helpers?** **No.** The function checks `ss.getSheetByName(getCashFlowSheetName_(year))` directly (line 44) and returns a neutral payload if the sheet is absent. It does **not** call `ensureCashFlowYearSheet_` or any other ensure helper. This is exactly the property that makes it the cleanest second seam: the resolver result flows straight into the consuming function with zero intermediate behavior to perturb.
- **Dashboard visibility:** Cash Flow → Quick Add tab. Visible every time the user opens Quick Add. Payee suggestions, the Type dropdown, and the Flow Source dropdown all come from this function. A regression here would show up as missing payees / wrong dropdown contents on the most-used write surface — visible immediately on first interaction.
- **Regression risk:** **Low.** Read-only with an explicit blank-workbook short-circuit (lines 44–52 and 57–65). The return shape is stable and well-documented. The function does not consult identity, does not consult `PropertiesService`, does not touch any sheet outside the current-year Cash Flow.
- **Rollback simplicity:** One line. Identical to Phase 1.
- **Testing requirements:** Open Cash Flow → Quick Add on a populated workbook; verify the Payee dropdown shows the same names in the same order as before; verify the Type dropdown shows Expense / Income; verify Flow Source is present when the column exists. Open Quick Add on a blank workbook (no current-year Cash Flow sheet); verify the page renders with empty payees and the canonical Type / Flow Source defaults — no red banner. Add a Quick Add payment after the seam lands; confirm the existing write path still works end-to-end (it does not go through the resolver — this test confirms the seam did not accidentally widen its scope).
- **Phase 2 verdict:** **Yes — recommended.** This is the cleanest second seam in the codebase. It introduces the resolver to a *new module* (`quick_add_payment.js`) without coupling to writes, without ensure-\* helpers, and without identity calls. Its blast radius is bounded by a single tab's hydration call. The Phase 1 invariant ("if anything regresses, restore the single line") holds verbatim. Migrating this function in Phase 2 also has a useful symbolic property: it demonstrates that the resolver crosses module boundaries safely, which is exactly the proof Phase 2 should produce before Phase 3 attempts the higher-traffic `buildDashboardSnapshot_`.

---

### 3.3 Candidate C — `getDebtPayoffReadData()` (`debt_payoff_projection.js:17`)

- **Call sites touched:** 1 line in 1 file.
- **Writes data?** **No.** Reads `INPUT - Debts`, `SYS - Accounts`, and trailing-two-year cash flow rows. Returns the `projectionYears / debts / summary / recommendations / warnings / missingCashFlowSheets` envelope consumed by the Debt Overview tab.
- **Triggers ensure-\* helpers?** **No.** Has explicit blank-workbook short-circuit at lines 28–51 (returns a fully-zeroed envelope when `INPUT - Debts` or `SYS - Accounts` is absent). The hot path uses `readSheetAsObjects_(ss, 'DEBTS' | 'ACCOUNTS')`; no ensure call.
- **Dashboard visibility:** Debt Overview tab (Planning section). A read-only reference view; not on the dashboard hot path the way the snapshot or Quick Add hydration is.
- **Regression risk:** **Low.** Equivalent to Phase 1's `getCashToUse()` in shape — single read entry, hardened blank-workbook branch, no writes, no ensure helpers.
- **Rollback simplicity:** One line. Identical to Phase 1.
- **Testing requirements:** Open the Debt Overview tab on a populated workbook; verify every debt row, the summary block, recommendations, and warnings match a pre-change baseline. Open the tab on a blank workbook; verify the empty-state envelope renders cleanly (no red banner, no NaN, no missing fields).
- **Phase 2 verdict:** **Acceptable alternate.** Mechanically clean and risk-equivalent to Phase 1. The reason `getQuickAddPaymentUiData()` is preferred over this one is module diversity: Quick Add hydration sits in `quick_add_payment.js`, which the migration plan will eventually have to migrate end-to-end anyway (the *write* entry point at `quick_add_payment.js:185` is on `§5 step 4` of the implementation plan). Proving the read-only hydration through the resolver in Phase 2 gets the resolver into that module's import graph without coupling to the write path. `debt_payoff_projection.js`'s read-only entry is similarly safe, but the module is much smaller (1 production call site total) and the seam exercise is correspondingly narrower.

---

### 3.4 Candidate D — `nextActionsPickRollingDebtTarget_()` (`next_actions.js:417`)

- **Call sites touched:** 1 line in 1 file. (The function uses `var ss = SpreadsheetApp.getActiveSpreadsheet();` — `var` rather than `const`, but that has no functional implication.)
- **Writes data?** **No.** Reads `INPUT - Debts` via `readSheetAsObjects_`, normalizes via `normalizeDebts_`, and returns a single picked debt object or `null`.
- **Triggers ensure-\* helpers?** **No.**
- **Dashboard visibility:** Feeds the Next Actions panel's "extra debt payment" recommendation. Internal helper, not an externally-exposed entry function.
- **Regression risk:** **Low.** Read-only, narrow output, no writes, no ensure.
- **Rollback simplicity:** One line.
- **Testing requirements:** Load the dashboard; confirm the Next Actions panel still surfaces the same "extra debt payment" target as before (focus-debt name, balance, APR).
- **Phase 2 verdict:** **No — defer.** Mechanically clean, but this function is an *internal helper*, not a module entry point. Phase 1's precedent is to migrate at the entry-point boundary, where the `const ss = …` line lives at the top of a public function. Migrating an internal helper first inverts that discipline and would establish a precedent that subsequent module migrations would have to either follow (more invasive) or break (inconsistent). Keep this one for the eventual `next_actions.js` module pass, where the entry function `getNextActionsForDashboard` (or equivalent) is the right migration boundary.

---

### 3.5 Candidate E — `getDebtPaymentBreakdownForDashboard()` (`dashboard_data.js:1234`)

- **Call sites touched:** 1 line in 1 file.
- **Writes data?** **No.** Reads `INPUT - Debts`, normalizes, and returns a `{payNow, paySoon}` envelope.
- **Triggers ensure-\* helpers?** **No.**
- **Dashboard visibility:** Bills Due / debt-payment breakdown card on the dashboard.
- **Regression risk:** **Low.**
- **Rollback simplicity:** One line.
- **Testing requirements:** Load the dashboard; confirm the debt payments breakdown card still lists the same debts in the same order with the same amounts and due dates.
- **Phase 2 verdict:** **No — defer.** Same module-discipline reason as Candidate A: this function lives in `dashboard_data.js` (10 call sites of `SpreadsheetApp.getActiveSpreadsheet()`, highest-risk read module). Migrating one of its ten call sites in Phase 2 fragments the eventual module pass. Better to migrate the *whole* `dashboard_data.js` module in a later phase as a coherent unit. Until then, no individual call site here is a Phase 2 target.

---

### 3.6 Candidate F — `getRecurringBillsWithoutDueDateForDashboard()` / `getBillsDueFromCashFlowForDashboard()` (`dashboard_data.js:1405` / `1339`)

- Both call `ensureActivityLogSheet_(ss)` and `ensureCashFlowYearSheet_(...)` (the latter inside a try/catch). Behavior is the same shape as Candidate A: read entry that runs ensure helpers as a defensive prelude.
- **Phase 2 verdict:** **No — defer.** Same reasoning as Candidates A and E. These belong to the eventual `dashboard_data.js` module pass.

---

### 3.7 Candidate G — `buildHomePage()` (`home.js:2`)

- **Writes data?** **Yes.** `sheet.clearContents()`, `sheet.clearFormats()`, `insertSheet`, and dozens of `setValue` calls to construct the in-workbook HOME sheet.
- **Phase 2 verdict:** **No.** Violates the Phase 2 "no write paths" constraint.

---

### 3.8 Candidate H — `property_performance.js` UI entry (`property_performance.js:17`)

- **Call sites touched:** 1 line in 1 file (line 17). The second line in the file (line 102) is a separate function — not part of Phase 2.
- **Writes data?** **No.** UI data path for the Property Performance tab.
- **Triggers ensure-\* helpers?** Not at the entry point.
- **Dashboard visibility:** Property Performance tab.
- **Regression risk:** **Low.**
- **Rollback simplicity:** One line.
- **Phase 2 verdict:** **Acceptable alternate, third choice.** Slightly lower visibility than Quick Add hydration, slightly higher complexity than `getDebtPayoffReadData`. Quick Add wins on both module diversity and dashboard visibility; this one stays in reserve for Phase 3 alongside the second `property_performance.js` call site.

---

## 4. Recommended Phase 2 target

**Recommendation: migrate `getQuickAddPaymentUiData()` in `quick_add_payment.js:35`.**

Rationale, summarized:

- **Read-only by construction.** No cell writes, no sheet creation, no schema mutation. The function returns a UI hydration envelope; the actual Quick Add write is a separate function that is *not* part of Phase 2.
- **No ensure-\* helpers fire.** The function uses `ss.getSheetByName(...)` directly to short-circuit on blank workbooks (lines 44–52). The resolver result flows straight into the consuming code with zero intermediate behavior.
- **Single call site, single line, single file.** Same diff shape as Phase 1: one new function call replaces one platform call. No helper rewrites, no sibling-function changes, no cross-file edits.
- **High-visibility but bounded surface.** Every Cash Flow → Quick Add open exercises the seam. A regression would surface immediately as missing payee suggestions or a broken dropdown, both of which are obvious on first interaction. The blast radius is bounded by one tab.
- **Module diversity vs. Phase 1.** Phase 1 migrated `cash_to_use.js`. Phase 2 migrating `quick_add_payment.js` proves the resolver works across module boundaries — the missing proof Phase 1 left for later. After Phase 2, the resolver has been exercised by two unrelated modules, which is the foundation Phase 3 needs before attempting `dashboard_data.js` or any module with 5+ call sites.
- **One-line reversibility.** The same rollback story as Phase 1: revert one line; the function returns to platform-call behavior.

The recommendation is **not** `buildDashboardSnapshot_()` because that function carries an ensure-\* call and lives in the highest-risk read module (`dashboard_data.js`). It is the right *eventual* target, but it is a Phase 3 candidate after cross-module read migration is proven.

The recommendation is **not** `getDebtPayoffReadData()` because, while mechanically clean, it does not add the module-diversity signal that Quick Add hydration does. It remains an acceptable fallback if Quick Add hydration turns out to be blocked for any reason discovered during implementation review.

---

## 5. Exact expected code touch surface (Phase 2)

This mirrors `CENTRAL_APP_FIRST_RESOLVER_SEAM.md → §7`. Anything outside this list is out of scope for Phase 2.

### Files created
- **None.** `central_resolver.js` already exists from Phase 1; its body does not change.

### Files modified
- **`quick_add_payment.js`** — exactly one line changed.
  - Line 35 changes from `const ss = SpreadsheetApp.getActiveSpreadsheet();` to `const ss = getUserSpreadsheet_();`.
  - No other change to `quick_add_payment.js`. Lines 185 and 248 (the write-path call sites in `submitQuickAddPayment` / its helpers) remain unchanged.

### Files not modified
- **`central_resolver.js`** — resolver body is unchanged. Still a one-line pass-through. No new parameters, no caching, no logging, no fallback.
- **`config.js`** — `getSheet_` is unaffected. Stale-handle retry at line 52 continues to call `SpreadsheetApp.getActiveSpreadsheet()` directly, by design.
- **`cash_to_use.js`** — already migrated in Phase 1; not re-touched.
- **Every other `.js` file** — unchanged. After Phase 2, 133 production call sites of `SpreadsheetApp.getActiveSpreadsheet()` remain unchanged (was 134 after Phase 1).
- **Every `.html` file** — unchanged. The seam is server-side only.
- **`appsscript.json`** — unchanged. No new scopes, no deployment posture change.

### Files possibly touched for documentation (Phase 2 implementation pass)
- `SESSION_NOTES.md` — one new "Current State" bullet noting the second seam landed and the regression baseline matched.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — banner updated to reflect 2 migrated call sites, 133 remaining.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — `§5 step 1` annotation extended to mention the second migrated call site.
- `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` (this file) — banner added at the top confirming the design matched the implementation, the same way `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` was annotated after Phase 1.

These doc touches happen in the implementation pass, not in this analysis pass.

### Total expected Phase 2 footprint
- **0 new files.**
- **1 modified `.js` file** (`quick_add_payment.js`, 1 line changed).
- **0 deployment changes.**
- **0 HTML changes.**
- **0 schema changes.**
- **0 changes to the resolver body or signature.**

---

## 6. Risk level

**Low.** Specifically:

- **Return-value identity:** the resolver returns the same `Spreadsheet` object the platform call returns. Already proven in Phase 1.
- **Helper compatibility:** `getCashFlowSheetForYear_(ss, year)` accepts `ss` explicitly (per the audit `§4`). The handle from the resolver is consumed the same way it has been since the codebase was written.
- **Blank-workbook posture:** preserved — the existing `if (!ss.getSheetByName(...))` short-circuit at line 44 is upstream of any further `ss` use and returns a neutral envelope.
- **Hot-path latency:** unchanged — one extra function-call frame, below the noise floor.
- **No write coupling:** the migrated function returns a UI envelope; the Quick Add write entry points at `quick_add_payment.js:185` and `:248` are not in scope.

Risk is materially lower than Candidate A (`buildDashboardSnapshot_`) because there is no ensure-\* helper interaction and the visible blast radius is one tab, not every tab.

---

## 7. Manual smoke tests required (Phase 2)

Run before and after the implementation pass. The "before" run captures the baseline that the "after" run must match.

### Populated workbook (developer reference workbook)

1. **Open Cash Flow → Quick Add.** Confirm the page loads without a red banner.
2. **Payee dropdown.** Verify the payee suggestion list contains the same names in the same order as before (compare to a pre-change snapshot — even a screenshot of the dropdown is sufficient).
3. **Type dropdown.** Verify it shows exactly `Expense` and `Income` in that order.
4. **Flow Source dropdown.** Verify it shows the canonical `FLOW_SOURCE_ALLOWED_VALUES_` list when `Flow Source` is present on the current-year Cash Flow sheet. If the column is absent (legacy workbooks), confirm `flowSourceColumnPresent: false` in the returned payload (visible via the form behaving as it does today on those workbooks).
5. **Make a Quick Add payment.** Save an expense and an income against the current-year Cash Flow sheet. Confirm the write succeeds, the activity log records a `quick_pay` row, and the status banner reads `Payment recorded — <Month-YY> cash flow updated`. *(Confirms the write path is untouched by the Phase 2 read-path seam.)*
6. **Reload the Cash Flow → Quick Add page after the save.** Confirm the new payee (if it was a new one) appears in the dropdown — i.e. the hydration round-trip still works.
7. **Open the dashboard Overview.** Confirm `Usable cash after buffers` matches the pre-change baseline. *(This is the Phase 1 migrated function's output. Phase 2 must not regress it.)*

### Blank workbook (or wiped reference workbook)

1. **Open Cash Flow → Quick Add** on a workbook with no `INPUT - Cash Flow <currentYear>` sheet. Confirm the page loads cleanly with empty payees and the canonical Type / Flow Source defaults. No red banner.
2. **Open the dashboard Overview.** Confirm the `notSetUp` envelope still renders cleanly for `getCashToUse` (Phase 1 invariant) and the rest of the snapshot.

### Cross-checks (both workbooks)

- **`LOG - Activity` is not unexpectedly created.** The migrated function does not call `ensureActivityLogSheet_`; the sheet should be present only because it was already present (or because some other call in the same session created it — Phase 2 does not introduce a new ensure trigger).
- **No new activity log entries** are written by Phase 2's diff itself. The seam swap does not log.
- **Latency.** Subjective: the Quick Add page should feel identical to before. Phase 2 does not change measurable timing.

### Stop-on-regression posture

Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §6`: if any of the above tests fail against the changed app, the Phase 2 pass is reverted and re-planned. The pass is not patched in place. Restoring `quick_add_payment.js:35` to `const ss = SpreadsheetApp.getActiveSpreadsheet();` returns the app to the post-Phase-1 baseline in one line.

---

## 8. Rollback simplicity

Identical to Phase 1. The seam is reversible by the same diff that introduces it.

- **Forward direction:** change line 35 of `quick_add_payment.js` from the platform call to the resolver call.
- **Reverse direction:** restore the same line to the platform call.

That's it. No schema migration, no `PropertiesService` cleanup, no user notification, no deployment redeploy. After rollback, the resolver still exists (introduced in Phase 1, used by `cash_to_use.js`), but it is no longer called from `quick_add_payment.js`.

Rollback methods, in increasing order of severity:

- **Soft rollback (preferred):** `git revert` the implementation commit.
- **Manual rollback:** edit `quick_add_payment.js:35` back to the platform call.
- **Emergency rollback:** redeploy the Apps Script version immediately before the Phase 2 deployment.

All three return the app to the post-Phase-1 state. There is no half-migrated transitional state.

---

## 9. Why Phase 2 is the right sequencing

Phase 1 proved a single migration. Phase 2 proves migration *across modules*. That ordering matters because:

- **Phase 3 (`buildDashboardSnapshot_()`) is more dangerous than Phase 2** by every measure: more downstream consumers, more ensure-\* interaction, more module entanglement. Phase 3 should not be the second-ever migration; it should be the first migration after cross-module behavior is proven.
- **The audit identified `dashboard_data.js` (10 call sites) as the largest single read module.** Migrating one of its call sites in Phase 2 fragments the eventual full-module pass. Better to migrate the whole module as one coherent unit later than to leave 9 of 10 call sites on the platform call.
- **`quick_add_payment.js` has 3 call sites.** Phase 2 migrates the read entry (line 35); the remaining 2 (lines 185 and 248) are write paths and are out of scope for Phase 2. The module then has a mixed posture (1 of 3 migrated), which is acceptable: the read entry is the boundary the user hits when opening the tab; the write entries are downstream events that migrate when the write-path phase arrives (`§5 step 4` of the implementation plan).
- **No Decision Pending item is unblocked by Phase 2.** Phase 2 does not require resolving mapping storage, test harness, onboarding UI, workbook version markers, or entitlement model. Those are all gated on later phases. Phase 2's job is to widen the seam, not to make new architectural decisions.

---

## 10. Decision Pending items (Phase 2 specific)

These are open questions that the eventual Phase 2 implementation prompt must resolve before the pass is run. Most are already resolved by Phase 1's precedent; they are listed for completeness.

- **Resolver body.** Resolved by Phase 1: stays a one-line pass-through. Phase 2 does not change it.
- **Resolver location / signature.** Resolved by Phase 1: `getUserSpreadsheet_()` in `central_resolver.js`, nullary. Phase 2 does not change either.
- **Target file.** Recommended: `quick_add_payment.js`. The implementation prompt may override with `debt_payoff_projection.js` (Candidate C) if a reason emerges during review. Either is acceptable.
- **Target call site within the file.** Recommended: line 35 only. The implementation prompt must **not** migrate lines 185 or 248 in the same pass; those are write entries and belong to a later phase.
- **Test-mode override on the resolver.** Still **no** in Phase 2. Adding an optional parameter to the resolver would be a separate design decision and a separate pass.
- **Doc update scope.** Recommended: same pass — one `SESSION_NOTES.md` "Current State" bullet, one banner on this file confirming the design matched the implementation, one banner update on `CENTRAL_APP_DEPENDENCY_AUDIT.md` reflecting the new call-site count (2 migrated / 133 remaining), one annotation on `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 1`.
- **Smoke-test capture.** Recommended: written notes are sufficient for Phase 2 given the resolver's continuing pass-through nature. A structured JSON snapshot of `getQuickAddPaymentUiData()` output (payees array, types array, flow sources array) is even better but not required.

---

End of document.
