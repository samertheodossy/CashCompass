# CENTRAL_APP_FIFTH_RESOLVER_SEAM.md

> **Superseded / Historical — Central App migration document.**
>
> The Central App architecture described here is **now live** — the two-project central deployment has shipped and is in family-beta use. This file is retained as a historical migration record and is **not** the current source of truth. Specific internal details below (commit hashes, "one-line pass-through" resolver descriptions, and "planned/next" framing) reflect the state at the time of authoring and may be out of date.
>
> **Current sources of truth:** `PROJECT_CONTEXT.md` · `TODO.md` · `README.md` · `WORKING_RULES.md`
>
> _Banner added in the Documentation Archive Preparation pass; the document body below is unchanged._

Design analysis for the next Central App resolver seam (Phase 5). **Analysis/design only.** No Apps Script code, no HTML/JS, no deployment changes, no implementation. Implementation requires its own Cursor prompt with explicit user approval per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9`.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — overall migration architecture.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle and backward-compatibility contract.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged roadmap.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — call-site inventory and risk classification.
- `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` / `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` / `CENTRAL_APP_THIRD_RESOLVER_SEAM.md` — per-phase designs for shipped phases.
- `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md` — dashboard-module seam analysis and shipped Phase 4 outcome (§11).

---

## 1. Purpose

Pick the safest *next* pure-read seam after Phases 1–4. This document weighs cross-module candidates against the same Phase 1–4 precedent ("migrate at the public-entry boundary, where the `const ss = …` line lives at the top of a server-callable function") and recommends a single Phase 5 target.

Phase 5 must satisfy every constraint that bound Phases 1–4:

- **Pure read only.** No `setValue`, no `appendRow`, no `insertSheet`, no `clearContents`, no `clearFormats` anywhere in the function body or its downstream call graph.
- **No ensure-\* helper called.** `ensureActivityLogSheet_`, `ensureCashFlowYearSheet_`, `ensureOnboarding…`, `ensureSysAccountsSheet_`, etc. are all out of scope until `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2`.
- **No `buildDashboardSnapshot_()` migration.** That migrates last among dashboard reads per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §6 Step E`.
- **No central mode.** Resolver body stays the one-line pass-through to `SpreadsheetApp.getActiveSpreadsheet()`. Body unchanged since Phase 1 (`b2798a7`).
- **No `openById`, no `PropertiesService`, no user mapping, no identity helper, no `Session.getActiveUser()` plumbing, no `appsscript.json` change, no deployment-setting change, no HTML change.**
- **One small seam only.** Exactly one line changed in exactly one file.

---

## 2. Current state going into Phase 5

- **Migrated production call sites:** 4 (`cash_to_use.js:77`, `quick_add_payment.js:35`, `debt_payoff_projection.js:17`, `dashboard_data.js:1235`).
- **Remaining production call sites:** 131 across 26 modules, all intentionally unchanged.
- **Resolver body:** still the one-line pass-through. Body unchanged since Phase 1.
- **Fully resolver-routed modules:** 1 — `debt_payoff_projection.js` (achieved Phase 3).
- **Dashboard module status:** first seam shipped (`getDebtPaymentBreakdownForDashboard()`); 9 residual platform calls in `dashboard_data.js`.
- **Architectural boundaries preserved:** no central mode, no `PropertiesService`, no `openById`, no identity helper, no user mapping, no deployment change, no ensure-\* helper routed through the resolver, no write-path migration.

---

## 3. Candidate review

Five candidates were evaluated against the Phase 5 constraints. Each is rated on three axes:

- **Precedent match** — does the function match the Phase 1–4 public-entry boundary? (Public entry vs. internal helper.)
- **Mechanical cleanliness** — explicit blank-workbook short-circuit, no ensure-\* call, single downstream `ss` consumer, no try/catch around `ss.getSheetByName` for branching behavior.
- **Blast radius** — what surface the user would see if the migration accidentally broke something. Smaller is safer.

### 3.1 Candidate A — `getLatestHistorySnapshots_(count)` (`dashboard_data.js:273`)

- **Behavior class:** READ-only. Reads `OUT - History`.
- **Pub/priv:** Internal (trailing underscore).
- **Blank-workbook short-circuit:** **Yes** — `const sheet = ss.getSheetByName('OUT - History'); if (!sheet) return [];` at lines 274–275.
- **Downstream `ss` consumers:** None — values + display arrays parsed inline.
- **Call-graph reachability:** Only reached transitively via `buildDashboardSnapshot_()` (and `getPriorMonthTotalDebtFromHistory_()` for one of the four) — the snapshot itself still calls `SpreadsheetApp.getActiveSpreadsheet()` directly at `dashboard_data.js:73`, so a Phase 5 migration here exercises the resolver only when the snapshot runs and only inside the inner helper (the outer wrapper still bypasses the seam).
- **Precedent match:** **No** — internal helper, not a public entry.
- **Mechanical cleanliness:** **Highest possible** — cleanest seam shape in the entire `dashboard_data.js` audit.
- **Blast radius:** Indirect. Feeds the Overview snapshot's history-deltas, Recent Snapshots section, and weekly-baseline picker.
- **Verdict:** Tempting because of mechanical cleanliness, but breaks the Phase 1–4 public-entry precedent and produces the "inner helpers go through the resolver while the outer wrapper still calls the platform" awkward intermediate state — same caveat noted in `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §3` for these four readers.

### 3.2 Candidate B — `getAllHistorySnapshotRows_()` / `getPlannerHistoryMetricsByOffset_()` / `getPriorMonthPlannerHistoryMetrics_()` (`dashboard_data.js:374` / `:578` / `:618`)

- Same shape and same caveats as Candidate A. Three more internal helpers with identical mechanical structure.
- **Verdict:** Each is a separate future implementation pass per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §6 Step B`. None matches the public-entry precedent. Defer until after the snapshot wrapper or a public-entry candidate (like C) ships.

### 3.3 Candidate C — `buildInputBillPlannerPaymentWindows_(today, tz, payNowWindowDays, paySoonWindowDays)` (`dashboard_data.js:2023`)

- **Behavior class:** READ-only. Calls `getInputBillsDueRows_(ss, today, tz)` (helper accepts `ss` explicitly).
- **Pub/priv:** Internal (trailing underscore).
- **Blank-workbook short-circuit:** No — relies on `getInputBillsDueRows_` to surface the missing-sheet condition.
- **Downstream `ss` consumers:** One — `getInputBillsDueRows_(ss, today, tz)`.
- **Call-graph reachability:** Internal planner-email helper called from `runDebtPlanner` to build the email's Pay Now / Pay Soon windows for `INPUT - Bills`. Fires only when the planner runs, which on this app is the planner trigger or the manual "Run Planner + Refresh Snapshot" button.
- **Precedent match:** **No** — internal helper.
- **Mechanical cleanliness:** Medium — one downstream `ss` consumer; no ensure-\* call; clean uniform-`ss` flow.
- **Blast radius:** Indirect. The function's effect is visible only in the planner email's Pay Now / Pay Soon sections — which means smoke-testing the seam requires *triggering* the planner and *inspecting the email*. Not a tab-load surface; harder to validate in real time.
- **Verdict:** Defer. The async-validation friction makes it a poor first-after-Phase-4 pick when a comparable read-shape candidate exists at a real tab surface.

### 3.4 Candidate D — `nextActionsPickRollingDebtTarget_()` (`next_actions.js:417`)

- **Behavior class:** READ-only. Reads `INPUT - Debts` via `readSheetAsObjects_(ss, 'DEBTS')`, applies `normalizeDebts_(rows, getAliasMap_())`, filters active debts with `balance > 0.005`. Wrapped in `try/catch` with `Logger.log('getNextActionsData rolling target: ' + e); return null;` fallback at line 444.
- **Pub/priv:** Internal (trailing underscore). Called from `getNextActionsData()` (the public entry consumed by `Dashboard_Script_PlanningNextActions.html` via `google.script.run`).
- **Blank-workbook short-circuit:** Implicit — `readSheetAsObjects_` throws on missing sheet, the wrapping try/catch returns `null`, and `getNextActionsData()` continues with the other action builders.
- **Downstream `ss` consumers:** One — `readSheetAsObjects_(ss, 'DEBTS')`. Plus `normalizeDebts_(rows, …)` which doesn't take `ss`.
- **Call-graph reachability:** **On the Planning → Next Actions public load path.** Exercises the resolver from a public surface every time the user opens or refreshes Next Actions.
- **Precedent match:** **No** — internal helper, not the public entry boundary. But `next_actions.js` has exactly one production `SpreadsheetApp.getActiveSpreadsheet()` call site (this one), so migrating it makes `next_actions.js` the **second fully resolver-routed production module** — the same milestone Phase 3 produced for `debt_payoff_projection.js`.
- **Mechanical cleanliness:** High — try/catch wrapper handles failures gracefully; single downstream `ss` consumer; same `readSheetAsObjects_(ss, 'DEBTS')` shape as Phase 4's just-shipped seam.
- **Blast radius:** Bounded. Affects only the "rolling debt target" recommendation card in Next Actions; the rest of the Next Actions surface (urgent / recommended / optimize buckets, cash gap, near-term upcoming) is unaffected.
- **Verdict:** Strong candidate. The "internal helper" precedent break is mitigated by the fully-routed-module milestone and by the fact that the function shares Phase 4's exact downstream shape. But it does break the public-entry precedent, and Phase 5 has a strictly precedent-matching alternative (Candidate E). Defer to a later phase that specifically aims at the fully-routed-module milestone.

### 3.5 Candidate E — `getPropertyPerformanceData(payload)` (`property_performance.js:17`)

- **Behavior class:** READ-only. Reads `SYS - House Assets`, `HOUSES - *` expense sheets, and the current/selected-year `INPUT - Cash Flow YYYY` to compute per-house Equity / Rent / Expenses / Net Cash + portfolio totals.
- **Pub/priv:** **Public entry** — no trailing underscore, called via `google.script.run.getPropertyPerformanceData(...)` from `Dashboard_Script_PropertyPerformance.html`. Matches the Phase 1–4 public-entry precedent exactly.
- **Blank-workbook short-circuit:** **Yes** — explicit `if (!ss.getSheetByName(getSheetNames_().HOUSE_ASSETS))` at line 25 returns a zeroed envelope with `rows: []` and `portfolio: { equity: 0, rent: 0, expenses: 0, netCash: 0 }` so blank workbooks render `No houses yet.` cleanly without throwing.
- **Downstream `ss` consumers (at this entry):** Two helpers consume `ss` explicitly — `tryGetCashFlowSheet_(ss, year)` at line 37 and `findHousesSheetNameForAssetHouse_(ss, name)` at line 55. Strong uniform-`ss` flow at the entry point.
- **Other call sites in `property_performance.js`:** **One** — `getHouseNamesFromHouseAssets_()` at line 102 acquires its own `ss` separately (called from line 36 of `getPropertyPerformanceData`). Migrating only line 17 leaves that inner helper still on the platform call. Same intermediate state Phase 4 produced for `dashboard_data.js` — one entry through the seam, one inner helper still bypassing. Acceptable per the Phase 1–4 precedent (each phase migrates exactly one line; the second `property_performance.js` call site migrates in a separate later phase).
- **Mechanical cleanliness:** **High** — explicit blank-workbook short-circuit, no ensure-\* call, two downstream helpers that already accept `ss` explicitly, clean uniform-`ss` flow at the entry boundary.
- **Blast radius:** Bounded to the **Property Performance** tab (Assets → Property Performance). Per-house rows + portfolio totals are readily verifiable against a pre-change baseline. Property Performance is not on the Overview load path; a regression at this seam does not affect Overview, Bills Due, Cash Flow, Planning, Activity, or any other tab.
- **Precedent match:** **Yes — exactly.** This is the first cross-module pure-read public entry with the same shape as Phase 1 (`getCashToUse`), Phase 2 (`getQuickAddPaymentUiData`), Phase 3 (`getDebtPayoffReadData`), and Phase 4 (`getDebtPaymentBreakdownForDashboard`): `const ss = SpreadsheetApp.getActiveSpreadsheet();` at the top of a server-callable function, read-only body, no ensure-\* call, uniform-`ss` flow downstream.
- **Verdict:** **Recommended Phase 5 target.**

---

## 4. Recommendation — Phase 5 target

**`getPropertyPerformanceData(payload)` at `property_performance.js:17`.**

Exact change (one line, one file):

```
function getPropertyPerformanceData(payload) {
  const year = getCurrentOrSelectedYear_(payload && payload.year);
- const ss = SpreadsheetApp.getActiveSpreadsheet();
+ const ss = getUserSpreadsheet_();
  // … rest of the function unchanged …
```

Rationale, summarized:

- **Public-entry boundary.** The only Phase 5 candidate that matches the Phase 1–4 precedent exactly. `getPropertyPerformanceData` is called via `google.script.run` from `Dashboard_Script_PropertyPerformance.html`; the `const ss = …` line lives at the top of a server-callable function.
- **Pure read.** No `setValue`, no `appendRow`, no sheet creation, no Activity log write, no planner trigger.
- **No ensure-\* helper called.** Avoids the ensure-helper-interaction question entirely (deferred to `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2`).
- **Explicit blank-workbook short-circuit.** Missing `SYS - House Assets` → returns a zeroed envelope. Materially equivalent in safety to Phase 3's `getDebtPayoffReadData` and Phase 4's `getDebtPaymentBreakdownForDashboard`.
- **Strong uniform-`ss` flow at the entry.** Two downstream helpers (`tryGetCashFlowSheet_`, `findHousesSheetNameForAssetHouse_`) already accept `ss` explicitly. The third (`getHouseNamesFromHouseAssets_`) acquires its own `ss` — that inner-helper seam is a separate later phase (same pattern as `quick_add_payment.js` Phase 2, where lines 185 and 248 remained on the platform call as documented residual seams).
- **Bounded user-visible surface.** Property Performance is its own tab; regression is bounded to that tab. Not on the Overview load path; cannot affect any other surface.
- **New-module exercise.** First Phase to exercise the resolver from a *new* module / tab outside of `cash_to_use.js`, `quick_add_payment.js`, `debt_payoff_projection.js`, and `dashboard_data.js`. Widens module coverage from 4 modules to 5.
- **One-line reversibility.** Identical to Phases 1–4. Restoring `const ss = SpreadsheetApp.getActiveSpreadsheet();` returns the file to its pre-Phase-5 state in one diff.
- **No new Decision Pending item.** Test harness, mapping storage, onboarding UI, version markers, and entitlement model all stay deferred per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §8`.

---

## 5. Expected files touched by the future implementation pass

When the implementation prompt for Phase 5 eventually arrives, it should touch exactly **one** file:

- **`property_performance.js`** — one line, line 17. `const ss = SpreadsheetApp.getActiveSpreadsheet();` → `const ss = getUserSpreadsheet_();`.

Files that **must not** be touched in the Phase 5 implementation pass:

- `central_resolver.js` — resolver body stays the one-line pass-through. Phase 5 does not extend it.
- Every other `.js` — no other module's `SpreadsheetApp.getActiveSpreadsheet()` call site is migrated in Phase 5.
- Every `.html` — no client / UI change.
- `appsscript.json` — no deployment-setting / scope change.
- Every `CENTRAL_APP_*.md` other than the per-phase status banners updated as part of a separate documentation pass after the implementation lands.

---

## 6. Expected runtime tests

Run before and after the implementation pass. The "before" run captures the baseline that the "after" run must match.

### Populated workbook (developer reference workbook)

1. **Property Performance tab loads.** Open Assets → Property Performance. Confirm the per-house list renders the same rows in the same order. For each house, verify: **Equity**, **Rent (YTD)**, **Expenses (YTD)**, **Net Cash (YTD)** — each matches the pre-change value to the cent.
2. **Portfolio totals match.** The portfolio row at the bottom (Total Equity / Total Rent / Total Expenses / Total Net Cash) matches the pre-change values.
3. **Year switcher works.** Toggling the year selector loads the correct year's data; the year options list (`yearOptions`) is unchanged.
4. **Property Type filter behavior unchanged.** Rental vs. non-rental distinction in `isHouseAssetsRentalForCashFlow_` is preserved (no rent summation for non-rentals; rentals + blank type still sum rent — backward-compatibility behavior intact).
5. **Inactive houses still excluded.** Houses marked `Active = No` on `SYS - House Assets` do not appear in the table (handled by `getHouseNamesFromHouseAssets_` → `getInactiveHousesSet_`, unchanged).
6. **No new Activity rows from the read.** After loading Property Performance, `LOG - Activity` row count is unchanged (the function is read-only by contract; this is the critical post-pass invariant).
7. **Phase 1 invariant.** `Usable cash after buffers` on the Overview matches the pre-change value.
8. **Phase 2 invariant.** Cash Flow → Quick Add payee dropdown is unchanged.
9. **Phase 3 invariant.** Debt Overview per-debt table, summary block, recommendations, and warnings are unchanged.
10. **Phase 4 invariant.** Bills Due payNow / paySoon debt-payment breakdown card unchanged.

### Blank workbook (or wiped reference workbook)

11. **Property Performance on blank workbook.** Confirm the tab loads with the empty-state envelope (`rows: []`, `portfolio: { equity: 0, rent: 0, expenses: 0, netCash: 0 }`, empty `message`) and shows the calm "No houses yet." copy. **No red banner.** Blank-workbook short-circuit at line 25 still fires.
12. **Cash Flow sheet missing message.** On a populated `SYS - House Assets` but missing `INPUT - Cash Flow YYYY`, confirm the `message` field still surfaces the legacy *Cash Flow sheet "INPUT - Cash Flow YYYY" not found; rent totals are $0.* string. (Driven by `tryGetCashFlowSheet_(ss, year)` returning `null`.)

### Cross-checks (both workbooks)

13. **No write side effects.** Confirm no `setValue` / `appendRow` / sheet creation operation happens during the read. `getPropertyPerformanceData` is read-only by contract; this verifies the migration did not accidentally introduce a write.
14. **Subjective latency.** The Property Performance tab should feel identical to before. One extra function-call frame is below the noise floor; if the tab feels measurably slower, suspect cold start (same investigation as Phase 4) and confirm via the second reload.

### Stop-on-regression posture

Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §6`: if any of the above tests fail, the Phase 5 pass is reverted (single line restored to `SpreadsheetApp.getActiveSpreadsheet()`) and re-planned. The pass is not patched in place.

---

## 7. Risk level

**Low.** Materially equivalent to Phases 3 and 4 (`getDebtPayoffReadData` and `getDebtPaymentBreakdownForDashboard`).

- Read-only function with explicit blank-workbook short-circuit.
- No ensure-\* helper call.
- One line changed in one file.
- One-line reversible.
- Bounded surface — Property Performance tab only, not on the Overview load path.
- Same resolver body (one-line pass-through, unchanged since Phase 1).
- Same downstream helpers (`tryGetCashFlowSheet_`, `findHousesSheetNameForAssetHouse_`) already accept `ss` explicitly.

The risk profile is unchanged from Phase 4. The seam exercises a new tab surface (Property Performance) but does not introduce any new architectural risk.

---

## 8. Sequencing — before or after additional dashboard internal readers?

**Phase 5 should ship before the four dashboard internal history readers (`getLatestHistorySnapshots_`, `getAllHistorySnapshotRows_`, `getPlannerHistoryMetricsByOffset_`, `getPriorMonthPlannerHistoryMetrics_`).** Three reasons:

1. **Precedent match.** Phases 1–4 each migrated at a public-entry boundary. Phase 5 should continue that pattern. The four dashboard history readers are internal helpers; migrating them next would break the "public-entry first, internal helpers second" sequencing established by Phases 1–4.
2. **Module diversity.** Phase 5 widens seam coverage to a new module (`property_performance.js`) and a new tab (Property Performance). The four dashboard history readers all live in the same module already exercised by Phase 4 (`dashboard_data.js`); migrating them next would not exercise a new module. Module diversity is a stronger signal of "the resolver works under bound mode across the codebase" than depth-within-one-module.
3. **Intermediate-state asymmetry.** Migrating one of the four history readers next would produce a state where `dashboard_data.js` has the snapshot wrapper (line 73) still on the platform call while one of its internal helpers goes through the resolver — the awkward intermediate that `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §3` calls out. Phase 5 against `property_performance.js` avoids that asymmetry entirely (the property module is exercised at its public entry, with its inner helper as a documented future seam).

After Phase 5 ships, the recommended order resumes per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §6`:

- **Phase 6 candidate:** one of the four dashboard history readers (Step B). Likely `getLatestHistorySnapshots_` first because it is the most-called of the four (snapshot's history-delta path + `getPriorMonthTotalDebtFromHistory_`).
- **Phase 7+:** the remaining three history readers, then `buildInputBillPlannerPaymentWindows_` (Step C), then the ensure-backed reads (Step D), then `buildDashboardSnapshot_` (Step E), then the write entries (Step F / §5 step 4–5).

Alternative ordering: a future prompt could re-pick Candidate D (`nextActionsPickRollingDebtTarget_` in `next_actions.js`) for Phase 5 instead, on the grounds that landing a second fully resolver-routed production module is a stronger milestone signal. Both orderings are defensible. The default recommendation here is **Candidate E (`getPropertyPerformanceData`)** because it strictly matches the Phase 1–4 public-entry precedent; Candidate D is the right pick if the next prompt explicitly prioritizes the fully-routed-module milestone over the public-entry precedent.

---

## 9. Architectural boundaries reaffirmed for Phase 5

- Resolver body remains the **one-line pass-through** to `SpreadsheetApp.getActiveSpreadsheet()`. Body unchanged since Phase 1 (`b2798a7`).
- **No central mode.** No identity resolution, no workbook lookup, no fallback path.
- **No `PropertiesService`.** No user-properties read, no script-properties write related to the resolver.
- **No `SpreadsheetApp.openById(...)`.** Not introduced anywhere; the function does not exist in production code today and Phase 5 does not add it.
- **No user mapping.** No `SYS - User Workbooks`, no central registry sheet, no per-user lookup table.
- **No `Session.getActiveUser()` / `Session.getEffectiveUser()` plumbing related to spreadsheet identity.** The three existing production uses of `Session.getActiveUser()` (per `CENTRAL_APP_DEPENDENCY_AUDIT.md → §2`) are unrelated and not touched.
- **No write-path migration.** Every write entry in the codebase stays on the platform call. Quick Add Payment writes (lines 185, 248 of `quick_add_payment.js`), `skipDashboardBill`, planner output, Bills / Debts / Assets / Property writes — all unchanged.
- **No ensure-\* helper routed through the resolver.** `ensureActivityLogSheet_`, `ensureCashFlowYearSheet_`, `ensureOnboardingBankAccountsSheetFromDashboard`, etc. all continue to call `SpreadsheetApp.getActiveSpreadsheet()` inside their own bodies; Phase 5 does not touch them. They migrate together in `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2`.
- **No `buildDashboardSnapshot_()` migration.** The canonical dashboard aggregation entry at `dashboard_data.js:73` is intentionally untouched and migrates last among dashboard reads per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §6 Step E`.
- **No `appsscript.json` change.** Scopes, runtime, web-app posture all unchanged. Deployment posture remains `executeAs: USER_DEPLOYING`, `access: MYSELF`.
- **No HTML / CSS / schema change.** No client-side code touched, no sheet headers added or renamed, no Activity event added.

---

## 10. Closing notes

This document does **not** authorize implementation. The Phase 5 implementation pass requires its own Cursor implementation prompt with explicit user approval, per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9`.

When that prompt eventually arrives, it should:

- name `getPropertyPerformanceData(payload)` at `property_performance.js:17` as the target (or override with a written reason),
- migrate exactly one line,
- run the §6 checklist before and after,
- update the audit banner (5 migrated / 130 remaining) and the relevant doc set (`CENTRAL_APP_DEPENDENCY_AUDIT.md`, `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 1`, `PROJECT_CONTEXT.md`, `SESSION_NOTES.md`),
- add a "Status — shipped in `<hash>`" banner to this document as a separate documentation pass after the implementation lands (mirroring the pattern set by `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` / `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` / `CENTRAL_APP_THIRD_RESOLVER_SEAM.md` / `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §11`).

Until then, the migration remains design work. `property_performance.js` continues to call the platform directly. The resolver continues to be a one-line pass-through. No central mode, no `PropertiesService`, no `openById`, no identity helper, no user mapping, no deployment change.

---

End of document.
