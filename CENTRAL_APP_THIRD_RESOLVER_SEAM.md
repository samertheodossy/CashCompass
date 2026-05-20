# CENTRAL_APP_THIRD_RESOLVER_SEAM.md

Design analysis for the **third** Central App resolver seam — the next read-only, non-dashboard call site to migrate through `getUserSpreadsheet_()` after Phases 1 and 2 shipped.

**Analysis/design only.** No Apps Script code, no HTML/JS, no deployment changes, no implementation.

This document is the bridge between the Phase 2 outcome (recorded in `CENTRAL_APP_SECOND_RESOLVER_SEAM.md`, shipped in `1b68c71`) and the eventual Phase 3 implementation prompt. Its purpose is to pick the next call site, justify the pick against the audit and the prior-phase precedent, and pre-commit the regression posture.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — overall migration architecture.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — preferred deployment direction.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle and backward-compatibility contract.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged roadmap. Phase 3 corresponds to `§5 step 3` *"Read-only dashboard paths"*, extended here to *non-dashboard read-only paths* to keep the dashboard aggregation seam (`buildDashboardSnapshot_`) deliberately off-limits until cross-module read migration is broader.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — family beta scope.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — call-site inventory and risk classification.
- `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` — Phase 1 design + shipped outcome (`b2798a7`).
- `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` — Phase 2 design + shipped outcome (`1b68c71`).

---

## 1. Phases 1 + 2 recap (what's true today)

| Phase | Commit  | Resolver body | Migrated call site                                    | Module                  | Triggers ensure-\*? |
|-------|---------|---------------|-------------------------------------------------------|-------------------------|--------------------|
| 1     | `b2798a7` | pass-through  | `getCashToUse()` — `cash_to_use.js:77`                | `cash_to_use.js`        | No                 |
| 2     | `1b68c71` | pass-through  | `getQuickAddPaymentUiData()` — `quick_add_payment.js:35` | `quick_add_payment.js`  | No                 |

State of the resolver:

- **`central_resolver.js`** exists; body is unchanged from Phase 1 — a one-line pass-through to `SpreadsheetApp.getActiveSpreadsheet()`.
- **133 production call sites** of `SpreadsheetApp.getActiveSpreadsheet()` remain across 26 modules (was 134 after Phase 1, was ~135 before Phase 1).
- **Two modules** have had at least one entry routed through the resolver (`cash_to_use.js`, `quick_add_payment.js`).
- **No central mode, no `PropertiesService`, no `openById`, no identity helper, no deployment change.**

Phase 3's job is to widen seam coverage to a **third module**, still under the exact same invariants: read-only, no ensure-\* coupling, one line, one file, one-line reversibility. Phase 3 does **not** change the resolver body, the resolver location, the resolver signature, or the deployment posture.

---

## 2. Constraints (binding for Phase 3)

These constraints come from the parent task prompt and from `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §7 / §9`. Any candidate that violates one of these is rejected.

- **No dashboard aggregation seam yet.** Anything in `dashboard_data.js` is deferred. Specifically: `buildDashboardSnapshot_`, `getDebtPaymentBreakdownForDashboard`, `getRecurringBillsWithoutDueDateForDashboard`, `getBillsDueFromCashFlowForDashboard`, the history readers, and the issues/actions builders are all off-limits for Phase 3. Their eventual migration is a coherent full-module pass, planned for a later phase.
- **No write paths.** The Phase 3 target must be read-only. Anything that calls `setValue`, `appendRow`, `insertSheet`, `clearContents`, or `clearFormats` is rejected.
- **No central mode.** The resolver body stays a one-line pass-through.
- **No `openById`.** The resolver does not open a workbook by ID.
- **No `PropertiesService`.** No reads, no writes, no namespace registration.
- **No user mapping.** No `SYS - Users`, no email-to-workbook lookup, no identity-bound spreadsheet selection.
- **No deployment changes.** `appsscript.json` untouched.
- **No broad refactor.** Exactly one call site migrates. Sibling functions in the same file are not migrated unless they are part of the same entry-point line.
- **Bound-mode behavior identical byte-for-byte.** Same return shape, same return values, same blank-workbook posture, same hot-path latency floor.

The Phase 1 doc's §4 ("Why initial behavior should still return the active spreadsheet") and §5 ("Why this preserves backward compatibility") apply unchanged to Phase 3. The seam is still empty; Phase 3 only widens its coverage.

---

## 3. Candidate shortlist (non-dashboard, read-only)

The audit's §6 ("Low-risk modules") is the source. Dashboard-resident candidates are excluded per §2's constraint. Each candidate is evaluated using the same template as Phase 2's §3.

---

### 3.1 Candidate A — `getDebtPayoffReadData()` (`debt_payoff_projection.js:17`)

- **Module:** `debt_payoff_projection.js` (1 production `getActiveSpreadsheet()` call site total — the file is fully covered by a single migration).
- **Call sites touched:** 1 line in 1 file.
- **Writes data?** **No.** Reads `INPUT - Debts`, `SYS - Accounts`, and trailing-two-year `INPUT - Cash Flow YYYY` rows. Returns a `{projectionYears, debts, summary, recommendations, warnings, missingCashFlowSheets}` envelope consumed by the Debt Overview tab. No `setValue`, no `appendRow`, no sheet creation, no schema mutation.
- **Triggers ensure-\* helpers?** **No.** Has an explicit blank-workbook short-circuit at lines 29–51: `if (!ss.getSheetByName(sheetNames.DEBTS) || !ss.getSheetByName(sheetNames.ACCOUNTS))` returns a fully-zeroed envelope before any deeper reads run. The populated path uses `readSheetAsObjects_(ss, 'DEBTS')`, `readSheetAsObjects_(ss, 'ACCOUNTS')`, `readCashFlowSheetAsObjects_(ss, y)`, and the helper `sumExpensePaymentsForDebtPayee_(ss, ...)` — all of which consume `ss` as an explicit parameter and never re-acquire from the platform.
- **`ss` flow uniformity:** **Uniform.** The single `ss` acquired at line 17 is passed unchanged to every downstream helper that needs a `Spreadsheet` handle. No internal helper called from this entry re-calls `SpreadsheetApp.getActiveSpreadsheet()`. After Phase 3, the entire read-path call graph rooted at this entry would resolve its workbook via the seam. This is the strongest single property of this candidate.
- **User-visible surface:** Debt Overview tab (Planning section). A read-only reference view of debt structure: balances, minimums, APRs, estimated payoff at current minimums, plus `CF paid` trailing-two-year sums. Renders the bar chart, summary block, recommendations list, and warnings.
- **Identity calls:** None bound to the user. Uses `Session.getScriptTimeZone()` (script timezone, not user identity). Does not call `Session.getActiveUser()` or `Session.getEffectiveUser()`. Safe to migrate without entangling the identity layer.
- **Regression risk:** **Low.** Equivalent in shape to Phase 1's `getCashToUse()` — single read entry, hardened blank-workbook branch, no writes, no ensure helpers, uniform `ss` flow.
- **Rollback simplicity:** One line. Identical to Phases 1 and 2.
- **Required manual tests:** Open Debt Overview on a populated workbook → verify every debt row, summary block, `CF paid` totals, recommendations list, and any warnings match a pre-change baseline. Open Debt Overview on a blank workbook → verify the empty-state envelope renders cleanly (no red banner, no NaN). Verify the Phase 1 invariant (dashboard Overview `Usable cash after buffers` unchanged) and the Phase 2 invariant (Cash Flow → Quick Add hydration unchanged).
- **Why this is the right Phase 3 target:**
  - **Complete module migration in one line.** This file has exactly one production `SpreadsheetApp.getActiveSpreadsheet()` call site. After Phase 3, the file is fully resolver-routed — no follow-up pass needed for `debt_payoff_projection.js`. Phases 1 and 2 each left their target modules partially migrated (Phase 2's `quick_add_payment.js` still has lines 185 and 248 on the platform call); Phase 3 closes a module fully.
  - **Strongest possible "uniform `ss`" property.** Every helper called from this entry consumes `ss` explicitly. No hidden second platform call lurks downstream. This is the cleanest demonstration that the seam holds across the entire read-path call graph of a non-trivial function.
  - **New module diversity.** Phases 1 and 2 covered `cash_to_use.js` and `quick_add_payment.js`. Phase 3 adds `debt_payoff_projection.js` as a third unrelated module. Three modules is enough cross-module proof to confidently approach the multi-call-site `dashboard_data.js` migration in a later phase.
  - **No new Decision Pending item required.** Test harness, mapping storage, onboarding UI, version markers, entitlement model — all stay deferred. Phase 3 unblocks nothing and requires nothing new.

---

### 3.2 Candidate B — `getPropertyPerformanceData(payload)` (`property_performance.js:17`)

- **Module:** `property_performance.js` (2 production `getActiveSpreadsheet()` call sites: line 17 in this entry function, and line 102 in the internal helper `getHouseNamesFromHouseAssets_`).
- **Call sites touched:** 1 line in 1 file (line 17 only; line 102 is **not** in scope for Phase 3).
- **Writes data?** **No.** Reads `SYS - House Assets`, the current-year `INPUT - Cash Flow YYYY` (rent rows for rental properties), and the `HOUSES - {House}` expense tabs. Returns a `{year, yearOptions, rows, portfolio, message}` envelope.
- **Triggers ensure-\* helpers?** **No.** Has an explicit blank-workbook short-circuit at lines 25–34: `if (!ss.getSheetByName(getSheetNames_().HOUSE_ASSETS))` returns an empty envelope. The populated path uses `getHouseNamesFromHouseAssets_()`, `tryGetCashFlowSheet_(ss, year)`, `getAllHouseExpenseRows_()`, `getHouseAssetRowData_(name)`, `findHousesSheetNameForAssetHouse_(ss, name)`, and `sumHouseExpensesForYear_(...)`.
- **`ss` flow uniformity:** **Mixed.** Line 17's `ss` is passed to `tryGetCashFlowSheet_(ss, year)` and `findHousesSheetNameForAssetHouse_(ss, name)`. But `getHouseNamesFromHouseAssets_()` at line 36 does **not** accept `ss` — it re-acquires from the platform at line 102. After a Phase 3 migration of line 17 alone, the entry's `ss` would come from the resolver, but the helper's `ss` would still come from the platform. In bound mode both return the same workbook, so the behavior is identical — but the migration of this module's read path is not *complete* until line 102 also moves. This is the key difference vs Candidate A.
- **User-visible surface:** Property Performance tab. Per-house table (current value, loan, equity, rent year-to-date, expenses, net cash) and portfolio totals.
- **Identity calls:** None bound to the user. No `Session.getActiveUser()` / `Session.getEffectiveUser()`.
- **Regression risk:** **Low.** Read-only, blank-workbook short-circuit present, no writes, no ensure helpers. Slightly higher conceptual complexity than Candidate A because of the mixed `ss` flow, but in bound mode the conceptual issue has no behavioral effect.
- **Rollback simplicity:** One line.
- **Required manual tests:** Open Property Performance on a populated workbook → verify per-house rows (currentValue, loanAmount, equity, rent, expenses, netCash) and the portfolio totals match a pre-change baseline. Open Property Performance on a workbook with no `SYS - House Assets` sheet → confirm the "No houses yet." empty envelope renders cleanly. Verify Phase 1 and Phase 2 invariants.
- **Phase 3 verdict:** **Acceptable alternate, but not preferred.** Two reasons:
  1. **Partial module migration after a Phase 3 pass.** Line 17 would resolve via the resolver; line 102 would not. The file would be in an inconsistent state (one of two call sites migrated) that someone would have to remember to finish in a follow-up pass. Candidate A leaves no such residue.
  2. **Slightly more downstream complexity.** Several helpers are called from this entry; while none of them write or call ensure-\*, the call graph is wider than Candidate A's, which makes the smoke-test surface incrementally larger.
- These are not blocking concerns — Candidate B would migrate cleanly in Phase 3 — they are reasons to prefer Candidate A first and migrate `property_performance.js` as a complete two-call-site pass later.

---

### 3.3 Candidate C — Internal helper migrations (deferred)

Examples reviewed and rejected for Phase 3 because they are internal helpers, not entry-point boundaries (Phase 1's precedent migrates at the public entry-point boundary, where the `const ss = …` line lives at the top of a server-callable function):

- **`nextActionsPickRollingDebtTarget_()` — `next_actions.js:417`.** Internal helper called from the Next Actions entry function. Read-only, no ensure-\*, but not a public entry. Defer to the eventual `next_actions.js` module pass.
- **`getDonationsSheet_()` — `donations.js:18`.** Internal sheet getter (throws if `INPUT - Donation` is missing). Read-only, but called from several donation entry points (read and write). Migrating only the getter would leave the entry points still acquiring `ss` from the platform a second time. Defer.
- **`getHouseNamesFromHouseAssets_()` — `property_performance.js:102`.** Internal helper to Candidate B. Migrate together with line 17 in a future complete-module pass.

These are all excellent eventual seams; none are appropriate as Phase 3 specifically.

---

### 3.4 Candidate D — Write entries (rejected)

- **`runDebtPlanner(options)` — `code.js:80`.** This is the planner entry; it runs the rolling debt payoff engine and writes `OUT - History`. Violates the "no write paths" constraint.
- **`getOrCreateUpcomingExpensesSheet_()` — `upcoming_expenses.js:679`.** Ensure-\* helper that creates the sheet if missing. Violates the constraint against ensure-\* interactions for Phase 3 and is upstream of the Upcoming Expenses write path (Add / Edit / Quick-pay / Dismiss).
- **Anything in `bank_accounts.js`, `house_values.js`, `investments.js`, `debts.js`, `bills.js`, `bank_import.js`, `planner_output.js`, the `quick_add_payment.js` write entries (lines 185, 248), `cashflow_setup.js`, `bills.js`, `home.js`.** All carry write paths or multi-sheet effects. Defer to the write-path phase.

---

### 3.5 Candidate E — Dashboard-resident read entries (rejected by §2)

Explicitly out of scope for Phase 3 by the parent task's "no dashboard aggregation seam yet" constraint. Listed only so the reviewer can confirm they were considered and deliberately not picked:

- `buildDashboardSnapshot_` — `dashboard_data.js:73` (calls `ensureActivityLogSheet_(ss)`; eventual Phase 4+ target).
- `getDebtPaymentBreakdownForDashboard` — `dashboard_data.js:1234`.
- `getRecurringBillsWithoutDueDateForDashboard` — `dashboard_data.js:1405`.
- `getBillsDueFromCashFlowForDashboard` — `dashboard_data.js:1339` (calls `ensureActivityLogSheet_(ss)` and `ensureCashFlowYearSheet_(...)`).
- `getLatestHistorySnapshots_`, `getAllHistorySnapshotRows_`, `getPlannerHistoryMetricsByOffset_`, `getPriorMonthPlannerHistoryMetrics_` — all in `dashboard_data.js`.

The eventual `dashboard_data.js` module migration is a coherent later-phase pass and benefits from being done as a unit, not piecemeal in Phase 3.

---

## 4. Recommended Phase 3 target

**Recommendation: migrate `getDebtPayoffReadData()` in `debt_payoff_projection.js:17`.**

Rationale, summarized against the Phase 2 recommendation criteria:

- **Read-only by construction.** No cell writes, no sheet creation, no schema mutation. The actual debt-payment data lives in `INPUT - Debts` and is written by `debts.js` (which is not in scope for Phase 3).
- **No ensure-\* helpers fire.** The function checks for `INPUT - Debts` and `SYS - Accounts` directly via `ss.getSheetByName(...)` and short-circuits to a zeroed envelope if either is missing. The resolver result flows straight into the consuming code with zero intermediate behavior to perturb.
- **Uniform `ss` flow downstream.** The single `ss` acquired at line 17 is passed unchanged to every helper that needs a `Spreadsheet` handle. No internal helper re-acquires from the platform. After Phase 3, the entire read-path call graph rooted at this entry resolves through the seam — the strongest single property a Phase 3 candidate can have.
- **Complete module migration in one line.** `debt_payoff_projection.js` has exactly one production `SpreadsheetApp.getActiveSpreadsheet()` call site. After Phase 3, the file is fully resolver-routed and requires no follow-up pass. Phases 1 and 2 each left residual platform calls in their target modules; Phase 3 closes a module fully — a meaningful architectural milestone for the first time in the migration.
- **New module diversity.** Adds `debt_payoff_projection.js` as a third unrelated migrated module. Three modules — read-only entry, read-only UI hydration, read-only reference view — is enough cross-module proof to confidently approach the multi-call-site `dashboard_data.js` migration in a later phase.
- **One-line reversibility.** Same rollback story as Phases 1 and 2. Restore the platform call; done.
- **No new Decision Pending item.** Mapping storage, test harness, onboarding UI, version markers, entitlement model — all stay deferred. Phase 3 unblocks nothing and requires nothing new.

The recommendation is **not** `getPropertyPerformanceData()` because that function leaves `property_performance.js:102` unmigrated, producing a partially-migrated module that someone would have to remember to finish. Candidate B is the right next target for the module's eventual full-pass migration; it is not the right Phase 3 target when Candidate A offers a complete file in the same diff size.

The recommendation is **not** any internal helper (Candidate C) because Phase 1's precedent migrates at the public entry-point boundary. Internal helpers migrate when their owning module gets a full pass.

The recommendation is **not** any dashboard-resident read entry because of the explicit §2 constraint.

---

## 5. Exact expected code touch surface (Phase 3)

This mirrors the prior-phase docs (`CENTRAL_APP_FIRST_RESOLVER_SEAM.md → §7`, `CENTRAL_APP_SECOND_RESOLVER_SEAM.md → §5`). Anything outside this list is out of scope for Phase 3.

### Files created
- **None.** `central_resolver.js` already exists from Phase 1; its body does not change.

### Files modified
- **`debt_payoff_projection.js`** — exactly one line changed.
  - Line 17 changes from `const ss = SpreadsheetApp.getActiveSpreadsheet();` to `const ss = getUserSpreadsheet_();`.
  - No other change to `debt_payoff_projection.js`. The internal helper `sumExpensePaymentsForDebtPayee_(ss, ...)` continues to receive `ss` from its caller (i.e. from the resolver after the seam lands), as it does today; its signature does not change.

### Files not modified
- **`central_resolver.js`** — resolver body is unchanged. Still a one-line pass-through. No new parameters, no caching, no logging, no fallback.
- **`config.js`** — `getSheet_` is unaffected. Stale-handle retry at line 52 continues to call `SpreadsheetApp.getActiveSpreadsheet()` directly, by design.
- **`cash_to_use.js`** — Phase 1 already shipped; not re-touched.
- **`quick_add_payment.js`** — Phase 2 already shipped; not re-touched. Lines 185 and 248 (write entries) remain unchanged.
- **`property_performance.js`** — not touched by Phase 3. Both line 17 and line 102 stay on the platform call, awaiting a complete-module pass later.
- **`dashboard_data.js`** — not touched by Phase 3. All 10 call sites stay on the platform call, awaiting a later module pass.
- **Every other `.js` file** — unchanged. After Phase 3, 132 production call sites of `SpreadsheetApp.getActiveSpreadsheet()` remain unchanged (was 133 after Phase 2).
- **Every `.html` file** — unchanged. The seam is server-side only.
- **`appsscript.json`** — unchanged. No new scopes, no deployment posture change.

### Files possibly touched for documentation (Phase 3 implementation pass)
- `SESSION_NOTES.md` — one new "Current State" bullet noting the third seam landed and the regression baseline matched.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — banner updated to reflect 3 migrated call sites / 132 remaining.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 1` — annotation extended to mention the third migrated call site.
- `CENTRAL_APP_THIRD_RESOLVER_SEAM.md` (this file) — banner added at the top confirming the design matched the implementation, the same way the prior-phase docs were annotated after their seams shipped.

These doc touches happen in the implementation pass, not in this analysis pass.

### Total expected Phase 3 footprint
- **0 new files.**
- **1 modified `.js` file** (`debt_payoff_projection.js`, 1 line changed).
- **0 deployment changes.**
- **0 HTML changes.**
- **0 schema changes.**
- **0 changes to the resolver body or signature.**

---

## 6. Risk level

**Low.** Specifically:

- **Return-value identity:** the resolver returns the same `Spreadsheet` object the platform call returns. Already proven in Phases 1 and 2.
- **Helper compatibility:** every helper called from this entry (`readSheetAsObjects_`, `readCashFlowSheetAsObjects_`, `sumExpensePaymentsForDebtPayee_`) accepts `ss` explicitly. The handle from the resolver is consumed the same way as today.
- **Blank-workbook posture:** preserved — the existing `if (!ss.getSheetByName(...))` short-circuit at lines 29–32 is upstream of any further `ss` use and returns a fully-zeroed envelope.
- **Hot-path latency:** unchanged — one extra function-call frame, below the noise floor. Debt Overview is not on the dashboard hot path the way `buildDashboardSnapshot_` is, so even a measurable change would have lower user impact.
- **No write coupling:** the migrated function returns a UI envelope; debt CRUD lives in `debts.js`, which is not in scope.
- **`ss` flow uniformity:** the entry's `ss` reaches every helper that needs one. No surprises in the call graph.

Risk is materially equivalent to Phase 1 (`getCashToUse`) and slightly lower than Phase 2 (`getQuickAddPaymentUiData`) because the migrated function does not have any sibling functions in the same file that perform writes — there is nothing else in `debt_payoff_projection.js` that a reader would need to mentally exclude from the migration scope.

---

## 7. Manual smoke tests required (Phase 3)

Run before and after the implementation pass. The "before" run captures the baseline that the "after" run must match.

### Populated workbook (developer reference workbook)

1. **Open the dashboard → Planning → Debt Overview tab.** Confirm the page loads without a red banner.
2. **Per-debt table.** Verify every active debt row shows the same `name`, `type`, `balance`, `minimumPayment`, `interestRate`, `cashFlowPaid`, `estimatedPayoffMonths`, and `payoffEstimateMethod` as before. Use a pre-change snapshot (screenshot or noted values) for comparison.
3. **Summary block.** Verify `totalDebtBalance`, `totalMinimumPayments`, `usableCashAfterBuffers`, `totalAvailableNow`, `totalBuffers`, `projectedMonthNetCashFlow`, and `longestRoughPayoff` (account name + months) match the baseline.
4. **Recommendations list.** Verify each recommendation line is present, in the same order, with the same currency / percent formatting (Cash snapshot, minimum payments, ratio note, projected CF, highest-APR credit card line, longest-payoff line, CF paid years note).
5. **Warnings list.** If `missingCashFlowSheets` had any entries before the change, verify the same tab names appear after. If it was empty before, verify it stays empty.
6. **No write side effects.** Confirm `LOG - Activity` shows no new rows attributable to opening Debt Overview (the page is read-only by contract).
7. **Phase 1 invariant.** Open the dashboard Overview; confirm `Usable cash after buffers` is unchanged from before Phase 3.
8. **Phase 2 invariant.** Open Cash Flow → Quick Add; confirm the Payee dropdown contains the same names as before Phase 3.

### Blank workbook (or wiped reference workbook)

9. **Open Debt Overview** on a workbook with no `INPUT - Debts` and/or no `SYS - Accounts`. Confirm the page renders cleanly with empty rows, zeroed summary, no recommendations, no warnings. No red banner, no NaN, no missing fields. The full empty envelope structure must match the populated-path envelope shape exactly so the UI does not crash on a missing field.
10. **Open the dashboard Overview** on the same blank workbook; confirm the `notSetUp` state from `getCashToUse` (Phase 1 invariant) still renders cleanly.
11. **Open Quick Add** on the same blank workbook; confirm the Phase 2 empty envelope still renders cleanly.

### Cross-checks (both workbooks)

- **No `ensure-*` was added.** Re-confirm that opening Debt Overview did not unexpectedly create `LOG - Activity`, `INPUT - Cash Flow YYYY`, or any other sheet that did not previously exist. The migrated function does not call any ensure helper; the smoke test confirms this stays true.
- **No new activity log entries** are written by Phase 3's diff itself. The seam swap does not log.
- **Subjective latency.** The Debt Overview page should feel identical to before. Phase 3 does not change measurable timing.

### Stop-on-regression posture

Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §6`: if any of the above tests fail against the changed app, the Phase 3 pass is reverted and re-planned. The pass is not patched in place. Restoring `debt_payoff_projection.js:17` to `const ss = SpreadsheetApp.getActiveSpreadsheet();` returns the app to the post-Phase-2 baseline in one line.

---

## 8. Rollback simplicity

Identical to Phases 1 and 2. The seam is reversible by the same diff that introduces it.

- **Forward direction:** change line 17 of `debt_payoff_projection.js` from the platform call to the resolver call.
- **Reverse direction:** restore the same line to the platform call.

That's it. No schema migration, no `PropertiesService` cleanup, no user notification, no deployment redeploy. After rollback, the resolver still exists (introduced in Phase 1, used by `cash_to_use.js` and `quick_add_payment.js`), but it is no longer called from `debt_payoff_projection.js`.

Rollback methods, in increasing order of severity:

- **Soft rollback (preferred):** `git revert` the implementation commit.
- **Manual rollback:** edit `debt_payoff_projection.js:17` back to the platform call.
- **Emergency rollback:** redeploy the Apps Script version immediately before the Phase 3 deployment.

All three return the app to the post-Phase-2 state. There is no half-migrated transitional state.

---

## 9. Why Phase 3 is the right sequencing

Phase 1 proved a single migration in a single module. Phase 2 proved migration across modules (a second module joined). Phase 3 proves **complete module migration** — for the first time, a module's full production `SpreadsheetApp.getActiveSpreadsheet()` surface (all 1 of 1 call sites) lives behind the resolver. That ordering matters because:

- **Phase 4 candidates (the eventual `dashboard_data.js` pass, the `property_performance.js` two-call-site pass, the `bills.js`/`debts.js`/`bank_accounts.js` write-path passes) are all multi-call-site passes.** Phase 3's "single-line complete-module migration" is the smallest possible example of a complete-module pass, which is the right precedent to set before attempting larger ones.
- **`debt_payoff_projection.js` was identified by the audit as the cleanest read-only single-call-site module** (audit `§6 → Low-risk modules`). Migrating it now consumes the audit's most explicit single-line recommendation and frees the next-phase planning to reason about modules with internal complexity.
- **No Decision Pending item is unblocked or required by Phase 3.** Phase 3 does not require resolving mapping storage, test harness, onboarding UI, workbook version markers, or entitlement model. Those are all gated on later phases.
- **The Phase 1 invariant ("byte-for-byte identical behavior") becomes more credible with each module that proves it.** Three modules across three different surfaces (cash card on overview, Quick Add hydration, Debt Overview reference view) is a stronger foundation than two.

---

## 10. Decision Pending items (Phase 3 specific)

These are open questions that the eventual Phase 3 implementation prompt must resolve before the pass is run. Most are already resolved by Phase 1/2 precedent; they are listed for completeness.

- **Resolver body.** Resolved by Phase 1: stays a one-line pass-through. Phase 3 does not change it.
- **Resolver location / signature.** Resolved by Phase 1: `getUserSpreadsheet_()` in `central_resolver.js`, nullary. Phase 3 does not change either.
- **Target file.** Recommended: `debt_payoff_projection.js`. The implementation prompt may override with `property_performance.js` (Candidate B) if a reason emerges during review; in that case, the prompt must also state whether it migrates only line 17 (partial module) or both line 17 and line 102 in the same pass (complete module). The cleaner Phase 3 is Candidate A; the cleaner Candidate-B variant would be the full-module pass.
- **Target call site within the file.** Recommended: line 17 only. The implementation prompt must not migrate any internal helper (`sumExpensePaymentsForDebtPayee_`, `estimateRoughPayoffMonths_`, etc.) in the same pass — those helpers already accept `ss` from their callers and require no migration.
- **Test-mode override on the resolver.** Still **no** in Phase 3. Adding an optional parameter to the resolver would be a separate design decision and a separate pass.
- **Doc update scope.** Recommended: same pass — one `SESSION_NOTES.md` "Current State" bullet, one banner on this file confirming the design matched the implementation, one banner update on `CENTRAL_APP_DEPENDENCY_AUDIT.md` reflecting the new call-site count (3 migrated / 132 remaining), one annotation on `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 1`.

---

End of document.
