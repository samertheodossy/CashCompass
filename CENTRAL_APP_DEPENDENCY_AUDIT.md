# CENTRAL_APP_DEPENDENCY_AUDIT.md

Audit of current bound-workbook assumptions in the CashCompass codebase.

> **Update — Phases 1–3 shipped (`b2798a7` → `1b68c71` → `72d82b1`).** Of the ~135 production call sites of `SpreadsheetApp.getActiveSpreadsheet()` catalogued below, **three** have been migrated through the resolver: `getCashToUse()` in `cash_to_use.js:77` (Phase 1, `b2798a7`), `getQuickAddPaymentUiData()` in `quick_add_payment.js:35` (Phase 2, `1b68c71`), and `getDebtPayoffReadData()` in `debt_payoff_projection.js:17` (Phase 3, `72d82b1`). All three call `getUserSpreadsheet_()` defined in `central_resolver.js` as a one-line pass-through (body unchanged since Phase 1). The remaining **132** call sites are intentionally unchanged. The §3 inventory below is preserved as the original audit; updated counts after Phase 3 are: `cash_to_use.js` now has 0 (was 1), `quick_add_payment.js` now has 2 (was 3 — lines 185 and 248 remain on the platform call as documented write-path entries), `debt_payoff_projection.js` now has 0 (was 1 — **first fully resolver-routed module**), and `central_resolver.js` contains the canonical 1 occurrence inside the resolver body. No other counts change. See `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` / `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` / `CENTRAL_APP_THIRD_RESOLVER_SEAM.md` for the per-phase designs and `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 1` for status.

This document is an **audit only**. No Apps Script code, no HTML/JS, no deployment settings, no implementation. Its purpose is to inform the first Central App migration step by surfacing where the codebase assumes the active spreadsheet, which helpers are already migration-ready, and which modules carry the largest blast radius if migrated carelessly.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — migration architecture, abstraction point.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — preferred deployment direction.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle and recovery semantics.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged roadmap and implementation gate.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — private family beta scope.

---

## 1. Purpose

The Central App migration replaces `SpreadsheetApp.getActiveSpreadsheet()` with a single resolver, one module at a time, while preserving bound-sheet behavior byte-for-byte (per `CENTRAL_APP_DESIGN.md → §6`).

This audit:

- Inventories every place in the codebase that today assumes the active spreadsheet.
- Identifies helpers that **already accept an explicit `ss` parameter** and are therefore migration-ready underneath the seam.
- Classifies modules by migration risk (read paths vs write paths, single-cell writes vs multi-sheet effects).
- Proposes the smallest first abstraction seam — the single call site that the first implementation pass should swap.

The audit does **not** authorize any code change. Implementation still requires the gate in `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9` (a separate Cursor implementation prompt with explicit user approval).

### Search terms used

The following patterns were searched across the repo (production code, excluding `node_modules` and docs unless explicitly noted):

- `SpreadsheetApp.getActive`
- `SpreadsheetApp.getActiveSpreadsheet()`
- `SpreadsheetApp.getActive()`
- `SpreadsheetApp.getActiveSheet()`
- `getActiveRange()`
- `SpreadsheetApp.openById`
- `Session.getEffectiveUser` / `Session.getActiveUser`
- `function ensure*_` / `function getOrCreate*_`
- Function signatures that accept `ss` as a parameter (regex: `function [A-Za-z_][A-Za-z0-9_]*\([^)]*\bss\b`)
- `function getSheet_`
- `function doGet` / `function doPost` / `function includeHtml_`

---

## 2. Summary of findings

- **`SpreadsheetApp.getActiveSpreadsheet()` is used in roughly 135 production call sites across 28 modules.** Concentrated in: `house_values.js` (17), `investments.js` (16), `bank_accounts.js` (15), `onboarding.js` (12), `dashboard_data.js` (10), `debts.js` (9), `bank_import.js` (9), `bills.js` (5), `income_sources.js` (4), `retirement.js` (4), `cashflow_setup.js` (3), `house_expenses.js` (3), `planner_output.js` (3), `quick_add_payment.js` (3), `sheet_bootstrap.js` (3), `activity_log.js` (2), `profile.js` (2), `property_performance.js` (2), `rolling_debt_payoff.js` (2), `sortSheets.js` (2), `cash_to_use.js` (1), `code.js` (1), `debt_payoff_projection.js` (1), `donations.js` (1), `home.js` (1), `next_actions.js` (1), `upcoming_expenses.js` (1), `config.js` (1 plus 1 in a comment about freshness).
- **`SpreadsheetApp.getActive()` (the short form), `SpreadsheetApp.getActiveSheet()`, and `getActiveRange()` are not used in production code.** Only `getActive()` appears in a doc file (`ONBOARDING_TODO.md`). This is a clean signal: there is **one** active-spreadsheet idiom across the codebase, not several.
- **`SpreadsheetApp.openById(...)` is not used in production code.** Only mentioned conceptually in `CENTRAL_APP_DESIGN.md`. The migration adds this as a new code path; it does not have to displace an existing one.
- **`Session.getEffectiveUser()` / `Session.getActiveUser()` are used in three production locations**, all for email recipient or audit-label purposes (not for spreadsheet lookup): `profile.js:611`, `bank_import.js:2041`, and a comment in `planner_output.js`. None of these violate the design rule that identity resolution for workbook lookup lives in one place — that helper does not exist yet.
- **The central low-level helper `getSheet_(ss, key)` already accepts `ss` explicitly** (`config.js:26`). Every call site that uses it passes an `ss` it just obtained. This is the most important single finding: when the resolver replaces the wrapper `const ss = ...`, every downstream call to `getSheet_(ss, key)` works unchanged.
- **17 production files already define helpers that accept `ss` as a parameter.** The "outer wrapper does `getActiveSpreadsheet()`, inner helper accepts `ss`" pattern is the dominant pattern, not the exception. The migration mostly affects the outer wrappers.
- **Web app entry points (`doGet` in `webapp.js`, `includeHtml_` in `html_includes.js`) do NOT call `getActiveSpreadsheet()` directly.** They render HTML; spreadsheet access happens inside server functions invoked via `google.script.run`. This means the migration does not have to touch the entry point itself.

---

## 3. Active spreadsheet usage inventory

Production call sites grouped by module. Counts come from a literal-string grep for `SpreadsheetApp.getActiveSpreadsheet()`.

### Heavy users (≥9 call sites)
- `house_values.js` — 17. House valuation history (parallel to bank accounts).
- `investments.js` — 16. Investment account history (parallel to bank accounts).
- `bank_accounts.js` — 15. Bank account history, opening balances, year blocks.
- `onboarding.js` — 12. Onboarding probes, Setup / Review backend, TEST mode.
- `dashboard_data.js` — 10. Snapshot builder, Bills Due, planner-history reads, debt-payment breakdown, skip-bill handler.
- `debts.js` — 9. Debts CRUD, distinct-column reads.
- `bank_import.js` — 9. Import staging, review, link/match/apply/ignore.

### Moderate users (3–8 call sites)
- `bills.js` — 5. Bills CRUD, categories, management list.
- `income_sources.js` — 4. (Note: superseded per `PROJECT_CONTEXT.md`; still in repo.)
- `retirement.js` — 4. Retirement scenarios and current-assets read.
- `cashflow_setup.js` — 3. Year-sheet creation and Summary-row seed.
- `house_expenses.js` — 3. House expenses UI data + read.
- `planner_output.js` — 3. Planner OUT - History writer and activity log appenders.
- `quick_add_payment.js` — 3. Quick Add Payment UI data + write.
- `sheet_bootstrap.js` — 3. First-run bootstrap entry points.

### Light users (1–2 call sites)
- `activity_log.js` — 2. Activity log writers (one is read-only).
- `profile.js` — 2. Profile settings sheet creation and edit save.
- `property_performance.js` — 2. Property tab UI data.
- `rolling_debt_payoff.js` — 2. Execution plan + planner-coupled writes.
- `sortSheets.js` — 2. Utility script (bound-context only; not a runtime path).
- `cash_to_use.js` — 1. Read-only, already hardened with `state` field.
- `code.js` — 1. Web app glue.
- `debt_payoff_projection.js` — 1. Read-only.
- `donations.js` — 1. Sheet getter.
- `home.js` — 1. Home page wrapper.
- `next_actions.js` — 1. Read-only.
- `upcoming_expenses.js` — 1. Sheet getter.
- `config.js` — 1 production call (in `getSheet_`-adjacent freshness path) + 1 in an explanatory comment.

### Common usage pattern
Across all modules, the pattern is nearly always:

> Public/dashboard-facing entry function calls `const ss = SpreadsheetApp.getActiveSpreadsheet();` once at the top, then passes `ss` to internal helpers (`getSheet_`, ensure-\* helpers, header lookups, write helpers).

This pattern is *the* migration seam: replacing the one line at the top of each entry function with a resolver call is sufficient to centralize that module.

---

## 4. Functions already compatible with explicit `ss`

These helpers either accept `ss` as a parameter or operate against a `Spreadsheet` handle passed by the caller. They are already migration-ready and **do not need to change** when the resolver replaces the wrapper call above them.

### Universal sheet resolver
- `getSheet_(ss, key)` (`config.js:26`). The single low-level helper used across every module to open a sheet by canonical key. **Already accepts `ss`.** This is the most important pre-existing migration affordance.

### Helpers with explicit `ss`-bearing signatures
Functions identified with `function name(ss…)`-shaped signatures across the codebase. Verified files include:

- `planner_helpers.js` — `ensureRowByName_(sheet, name, col, startRow)`, plus the shared helpers `getCashFlowSheetForYear_(ss, year)` and `getMonthColumnByDate_` (referenced in earlier sessions). These are the per-year and per-month resolution helpers used throughout planner and Cash Flow code.
- `planner_output.js` — `ensureHistorySheet_(ss)`.
- `activity_log.js` — `ensureActivityLogSheet_(ss)`, `getOrCreateActivityLogSheet_(ss)`.
- `bank_accounts.js`, `house_values.js`, `investments.js`, `debts.js` — per-active-column helpers (`ensure*ActiveColumn_(sheet)`, `ensure*ActiveColumnForBlock_(sheet, block)`) accept a `sheet` handle directly, which is even better than `ss`.
- `upcoming_expenses.js`, `income_sources.js`, `onboarding.js`, `activity_log.js`, `config.js`, `dashboard_data.js`, `quick_add_payment.js`, `planner_output.js`, `sheet_bootstrap.js`, `rolling_debt_payoff.js`, `home.js`, `debt_payoff_projection.js`, `house_values.js`, `property_performance.js`, `planner_helpers.js`, `donations.js`, `bank_import.js` — at least one helper per file accepts `ss` (or `sheet`) explicitly.

### Implication for migration

The migration seam lives in the **outer wrappers** (the functions that today contain `const ss = SpreadsheetApp.getActiveSpreadsheet();`). The inner helpers are already shaped for the post-migration world.

This is the largest single piece of good news in the audit: when the resolver is introduced, no helper rewrites are required. A migration pass on a given module is exactly "swap the wrapper's spreadsheet acquisition; everything downstream is already correct."

---

## 5. High-risk modules

Modules where a migration mistake could corrupt data, regress core flows, or produce silent wrong-workbook writes. These migrate **after** the resolver is proven against a low-risk module.

### `bank_accounts.js` — 15 call sites
- **Risk:** writes to multi-year year blocks; opening-balance flow creates SYS rows and INPUT rows in lockstep; manual Update path is the primary daily-use surface.
- **Why high:** parallel structure to investments and house_values; a bad migration would propagate the same defect across three modules.

### `house_values.js` — 17 call sites
- **Risk:** parallel to bank_accounts; valuation history writes use the same year-block discipline.
- **Why high:** highest single call-site count in the codebase; broadest surface area for inconsistent migration.

### `investments.js` — 16 call sites
- **Risk:** parallel to bank_accounts; investment history shares the same pattern. Save was previously identified as a performance hotspot (per `SESSION_NOTES.md` and earlier optimization passes).
- **Why high:** save-path performance is sensitive; introducing extra resolver overhead must be measured.

### `dashboard_data.js` — 10 call sites
- **Risk:** snapshot builder is the most-called read entry point. Bills Due logic was the subject of a recent fix involving normalized-payee row aggregation.
- **Why high:** any regression here is visible to every user on every page load.

### `debts.js` — 9 call sites
- **Risk:** Debts feed Bills Due, planner allocation, and the rolling debt payoff dashboard. CRUD changes touch sorted insertion logic.
- **Why high:** downstream coupling. A wrong-workbook read here cascades into planner and Bills Due.

### `bank_import.js` — 9 call sites
- **Risk:** Staging / Review / Apply pipeline; multi-sheet writes (staging, accounts, ignored, audit trail); audit logging via Session identity at one call site (line 2041).
- **Why high:** largest single subsystem in the codebase by surface area; first gating candidate for monetization. Per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §10`, default beta posture hides Bank Import.

### `onboarding.js` — 12 call sites
- **Risk:** Setup / Review backend, the user-facing first-run experience. Already runs in two modes (`normal` / `test`); the central-app migration will eventually intersect this module.
- **Why high:** Setup / Review is the primary first-impression surface for new users.

### `planner_output.js` + `quick_add_payment.js` + `cashflow_setup.js` — combined 9 call sites
- **Risk:** Cash Flow writes and year-sheet creation. Planner OUT - History append. Activity log appenders.
- **Why high:** Cash Flow is the canonical "did my money move?" surface. A wrong-workbook write here is the worst possible failure mode in the entire app.

### `bills.js` — 5 call sites
- **Risk:** Add / Edit / Stop tracking write surfaces; payee normalization couples to Bills Due.
- **Why high:** bill-edit was a recent feature with stale-payload guards; migrating must not regress those guards.

---

## 6. Low-risk modules

Modules where the resolver can be introduced with minimal risk because the call sites are read-only, single-cell, or contained to a non-critical surface.

### `cash_to_use.js` — 1 call site
- **Why low:** already hardened with `state` field, read-only, single entry function. The cleanest test-bed in the codebase.

### `next_actions.js` — 1 call site
- **Why low:** read-only, single entry function. Decision-layer output, not a write path.

### `debt_payoff_projection.js` — 1 call site
- **Why low:** read-only, single entry function.

### `home.js` — 1 call site
- **Why low:** home-page wrapper only. Renders, does not write.

### `donations.js` — 1 call site
- **Why low:** small write surface; ensure-helper-style sheet getter.

### `upcoming_expenses.js` — 1 call site
- **Why low:** ensure-helper-style sheet getter; the rest of upcoming-expenses code already passes `ss` to helpers.

### `property_performance.js` — 2 call sites
- **Why low:** read-only UI data plus a house-name lookup. No writes.

### `profile.js` — 2 call sites
- **Why low:** Profile is identity-and-DOB only. The two call sites are settings-sheet ensure plus edit save.

### `activity_log.js` — 2 call sites
- **Why low:** appenders are well-isolated; per-event writes; downstream consumers tolerate missing sheets.

### `sortSheets.js` — 2 call sites
- **Why low:** developer utility, not invoked by the web app at runtime. Defer or exclude from the migration.

### `code.js` — 1 call site
- **Why low:** single entry; not on a hot path.

---

## 7. Candidate first abstraction seam

Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §4`, the first implementation phase introduces a resolver that returns the active spreadsheet (bound mode only) and swaps **one** wrapper call site through it. The candidate should be the smallest call that still exercises the seam under real traffic.

### Recommended candidate: `getCashToUse()` in `cash_to_use.js`

- **Single call site** (`cash_to_use.js:77`).
- **Read-only**: returns a numeric value, never writes a cell.
- **Already hardened**: returns a `state` field for missing-sheet cases (`SESSION_NOTES.md` Phase A3). Even if the resolver were to misbehave, the function degrades gracefully instead of throwing.
- **Frequently invoked**: called by the dashboard snapshot path on every load, so the resolver gets real-traffic exercise immediately.
- **Reversible**: removing the resolver call and restoring `SpreadsheetApp.getActiveSpreadsheet()` is one line; the seam is reversible by construction.

### Alternate candidates (also acceptable, slightly broader scope)

- **`buildDashboardSnapshot_()` in `dashboard_data.js:72`** — the canonical entry point for every dashboard load. Larger blast radius than `getCashToUse()`, but the most-trafficked read path in the app. Suitable if the goal is to exercise the resolver against the full snapshot pipeline.
- **`getQuickAddPaymentUiData()` in `quick_add_payment.js:34`** — a read-only UI-data path that prefetches multiple pieces of state. Slightly broader than `getCashToUse()`, but also read-only and well-bounded.

### Not recommended as first seam

- Anything in `bank_accounts.js`, `house_values.js`, `investments.js`, `debts.js`, `bills.js`, `bank_import.js`, `planner_output.js`, `quick_add_payment.js`'s write entry point, or `cashflow_setup.js`. All carry write paths or multi-sheet effects. They migrate after the resolver is proven on a read-only surface.

### Conceptual shape of the seam (description only, no code)

A new helper — name and signature **Decision Pending** per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §8` — returns a `Spreadsheet` handle. In its first incarnation, the helper simply wraps `SpreadsheetApp.getActiveSpreadsheet()`. Inside `getCashToUse()`, the existing `const ss = SpreadsheetApp.getActiveSpreadsheet();` is replaced by a call to that helper. No other code changes.

That is the entire first migration pass.

---

## 8. Regression test implications

The seam introduces one new function and modifies one line. The regression suite around it is small but disciplined.

### Pre-change baseline (mandatory)
- **Bound-mode developer workbook:** call `getCashToUse()` via the existing dashboard load; record the return shape (`state`, numeric fields). This is the byte-for-byte target.
- **Blank workbook:** confirm `getCashToUse()` returns the `notSetUp` state cleanly without throwing.

### Post-change verification
- **Bound-mode developer workbook:** same return shape as the baseline. If any field changes, the migration pass is reverted.
- **Blank workbook:** same `notSetUp` state, no throw, no red banner.
- **Dashboard snapshot:** every tab still loads, every value still renders correctly (`buildDashboardSnapshot_()` calls `getCashToUse()` indirectly; the snapshot is the canonical integration test).
- **Activity log:** no new entries (the seam swap does not log anything).
- **No other module affected:** every other entry point still calls `SpreadsheetApp.getActiveSpreadsheet()` directly. Verifying this confirms the migration is staged, not swept.

### Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §6`
- Two-track regression: blank + populated.
- Stop on first regression; do not patch in the same pass.
- The pass either swaps the single call site successfully, or it is reverted; no in-between.

### Reversibility
- The pass is reversible in one line. If anything regresses, restoring `SpreadsheetApp.getActiveSpreadsheet()` at the single touched call site returns the app to baseline.

---

## 9. Recommended first implementation step

When implementation is eventually authorized (via a separate Cursor implementation prompt per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9`), the first step should be:

1. **Add a single resolver helper.** Name **Decision Pending**; behavior in its first incarnation is identical to `SpreadsheetApp.getActiveSpreadsheet()`. The helper lives in a location to be decided (likely `config.js` alongside `getSheet_`, or a new dedicated file — Decision Pending).
2. **Swap exactly one call site.** Inside `getCashToUse()` (`cash_to_use.js:77`), replace `const ss = SpreadsheetApp.getActiveSpreadsheet();` with the resolver call. No other change.
3. **Run the regression suite from §8.** Confirm byte-for-byte parity with the pre-change baseline.
4. **Stop.** Do not migrate any other call site in the same pass.

This step accomplishes:

- The seam is introduced.
- The seam is exercised by every dashboard load.
- The seam is reversible.
- The seam does not touch any write path.
- The seam does not touch the deployment posture.

Subsequent migration passes — one per module, per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5` — extend the same pattern outward, one wrapper at a time.

---

## 10. Decision Pending items

The items below are surfaced by this audit and must be resolved (in writing) before the first implementation pass. Deeper Decision Pending lists live in the design / deployment / lifecycle / implementation-plan docs; this list is audit-specific.

### Resolver name and signature — Decision Pending
- The architecture docs use `getUserSpreadsheet_()` as a candidate. Whether the implementation uses that exact name (and whether the signature is nullary or accepts an optional override for testing) is **Decision Pending** per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §8`.

### Resolver location — Decision Pending
- Whether the resolver lives in `config.js` (alongside `getSheet_`), in a new file (e.g. `central_resolver.js`), or in `code.js` (web-app glue). Each choice has small but real implications for visibility and import order.

### First migrated module — Decision Pending
- `getCashToUse()` is recommended (§7), but the final pick may be `buildDashboardSnapshot_()` if the team wants to exercise the resolver under broader traffic from day one. Both options are read-only and reversible.

### Treatment of ensure-\* helpers that internally call `getActiveSpreadsheet()` — Decision Pending
- Examples: `ensureSysAccountsSheet_()`, `ensureInputHouseValuesSheet_()`, `ensureSysHouseAssetsSheet_()`, `ensureInputInvestmentsSheet_()`, `ensureImportStagingBankAccountsSheet_()`, `getOrCreateUpcomingExpensesSheet_()`, `getOrCreateRetirementSheet_()`, `ensureInputSettingsSheet_()`, `getDonationsSheet_()`.
- Options: (a) leave their internal `getActiveSpreadsheet()` call alone and let the resolver wrap it once-per-module-entry; (b) extend their signatures to accept an optional `ss` and pass through; (c) rewrite them to require `ss`.
- (a) is the minimum-diff choice. (b) is more future-proof but a broader change. (c) is out of scope for a migration pass.
- The choice gates how the resolver propagates through `bank_accounts.js`, `house_values.js`, `investments.js`, and `bank_import.js` (the heaviest users).

### Handling of `Session.getActiveUser()` call sites — Decision Pending
- Three production sites (`profile.js:611`, `bank_import.js:2041`, comment in `planner_output.js`) call `Session.getActiveUser()` for email or audit-label purposes.
- These are **not** spreadsheet lookups, so they do not violate the design rule. But under `executeAs: USER_ACCESSING` the semantics will change (active user becomes the calling user, which is what we want).
- Whether to consolidate these through an identity helper at migration time, or leave them untouched in the first phase, is **Decision Pending**.

### Handling of `sortSheets.js` — Decision Pending
- The script uses `getActiveSpreadsheet().getSheets()` and `moveActiveSheet(i + 1)`, which are bound-context utilities and not invoked at runtime by the web app.
- Options: leave it as a developer-only utility, exclude it from the migration, or migrate it for consistency.
- Recommendation: defer until everything else has migrated and revisit only if needed.

### How to record the baseline before the first pass — Decision Pending
- Whether the pre-change baseline is captured as screenshots, a structured JSON dump from `buildDashboardSnapshot_()`, or written notes is **Decision Pending**.
- A structured snapshot is the strongest evidence of byte-for-byte parity but requires a small tooling step. Written notes are weakest but cheapest.
- This decision affects Phase 0 of `CENTRAL_APP_FAMILY_BETA_PLAN.md → §6` and any future migration pass.

---

End of document.
