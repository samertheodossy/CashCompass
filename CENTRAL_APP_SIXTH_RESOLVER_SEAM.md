# CENTRAL_APP_SIXTH_RESOLVER_SEAM.md

Design analysis for the next Central App resolver seam (Phase 6). **Analysis/design only.** No Apps Script code, no HTML/JS, no deployment changes, no implementation. Implementation requires its own Cursor prompt with explicit user approval per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9`.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — overall migration architecture.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle and backward-compatibility contract.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged roadmap.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — call-site inventory and risk classification.
- `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` / `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` / `CENTRAL_APP_THIRD_RESOLVER_SEAM.md` / `CENTRAL_APP_FIFTH_RESOLVER_SEAM.md` — per-phase designs for shipped phases.
- `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md` — dashboard-module seam analysis and shipped Phase 4 outcome (§11).

---

## 1. Purpose

Pick the safest *next* pure-read seam after Phases 1–5. This document weighs cross-module candidates against the precedent established by the shipped phases and recommends a single Phase 6 target.

Phase 6 must satisfy every constraint that bound Phases 1–5:

- **Pure read only.** No `setValue`, no `appendRow`, no `insertSheet`, no `clearContents`, no `clearFormats` anywhere in the function body or its downstream call graph.
- **No ensure-\* helper called.** `ensureActivityLogSheet_`, `ensureCashFlowYearSheet_`, `ensureOnboarding…`, `ensureSysAccountsSheet_`, etc. are all out of scope until `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2`.
- **No `buildDashboardSnapshot_()` migration.** That migrates last among dashboard reads per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §6 Step E`.
- **No central mode.** Resolver body stays the one-line pass-through to `SpreadsheetApp.getActiveSpreadsheet()`. Body unchanged since Phase 1 (`b2798a7`).
- **No `openById`, no `PropertiesService`, no user mapping, no identity helper, no `Session.getActiveUser()` plumbing, no `appsscript.json` change, no deployment-setting change, no HTML change.**
- **One small seam only.** Exactly one line changed in exactly one file.

---

## 2. Current state going into Phase 6

- **Migrated production call sites:** 5 (`cash_to_use.js:77`, `quick_add_payment.js:35`, `debt_payoff_projection.js:17`, `dashboard_data.js:1235`, `property_performance.js:17`).
- **Remaining production call sites:** 130 across 26 modules, all intentionally unchanged.
- **Resolver body:** still the one-line pass-through. Body unchanged since Phase 1.
- **Fully resolver-routed modules:** 1 — `debt_payoff_projection.js` (achieved Phase 3).
- **Partially resolver-routed modules:** 4 — `cash_to_use.js` (0 residual), `quick_add_payment.js` (2 residual write-path lines), `dashboard_data.js` (9 residual), `property_performance.js` (1 residual at line 102 — `getHouseNamesFromHouseAssets_`).
- **Dashboard module status:** first seam shipped (`getDebtPaymentBreakdownForDashboard()`); 9 residual platform calls in `dashboard_data.js`.
- **Architectural boundaries preserved:** no central mode, no `PropertiesService`, no `openById`, no identity helper, no user mapping, no deployment change, no ensure-\* helper routed through the resolver, no write-path migration.

---

## 3. Candidate review

Three candidates were evaluated against the Phase 6 constraints. Each is rated on three axes:

- **Precedent match** — does the function match the Phase 1–5 public-entry boundary? (Public entry vs. internal helper.) Phase 5 has already opened the door for internal-helper migrations because Phases 1–5 have largely exhausted the high-value pure-read public entries that lack ensure-\* coupling. Phase 6 will be the first internal-helper seam — and is the right time to do it precisely because Phase 5 explicitly recorded the unavoidable intermediate state ("one entry through the seam, one inner helper still bypassing").
- **Mechanical cleanliness** — single downstream `ss` consumer, no ensure-\* call, no try/catch around `ss.getSheetByName` for branching behavior, caller already verifies sheet existence (extra safety belt).
- **Blast radius** — what surface the user would see if the migration accidentally broke something. Smaller is safer.

### 3.1 Candidate A — `getHouseNamesFromHouseAssets_()` (`property_performance.js:101`)

- **Behavior class:** READ-only. Acquires `ss`, calls `getSheet_(ss, 'HOUSE_ASSETS')`, reads `getDataRange().getDisplayValues()`, computes the inactive-houses set, and returns a sorted list of active house names. Wrapped in a try/catch around `getInactiveHousesSet_()` only (with `Logger.log` and a `Object.create(null)` fallback) — the rest of the body has no defensive branching.
- **Pub/priv:** Internal (trailing underscore).
- **Single caller:** `getPropertyPerformanceData()` at `property_performance.js:36`. Verified via repo-wide grep — no other call site exists in production code.
- **Blank-workbook short-circuit:** **Implicit + extra safety belt.** The function itself returns `[]` when `display.length < 2`. **More importantly**, the *only* caller already short-circuits the blank-workbook case at `property_performance.js:25` (`if (!ss.getSheetByName(getSheetNames_().HOUSE_ASSETS)) { return zeroed-envelope; }`) before reaching the `getHouseNamesFromHouseAssets_()` call at line 36. That means `getHouseNamesFromHouseAssets_()` is invoked *only* on workbooks where `SYS - House Assets` has already been verified to exist. This is a stronger safety property than any prior phase has had.
- **Downstream `ss` consumers:** One — `getSheet_(ss, 'HOUSE_ASSETS')` at line 103 (already accepts `ss` explicitly — has done so since Phase 1's invariant). `getInactiveHousesSet_()` does not consume the local `ss` and is on its own platform call (an existing residual seam in another module, intentionally unchanged in Phase 6).
- **Call-graph reachability:** **On the Property Performance public load path** through Phase 5's already-migrated entry (`getPropertyPerformanceData`). Exercises the resolver from a public surface every time the user opens or refreshes Property Performance — exactly the same testing surface Phase 5 was just smoke-tested against.
- **Precedent match:** **No** — internal helper, not the public-entry boundary. But it is the natural follow-up to Phase 5: closes the intermediate state Phase 5 explicitly recorded (`CENTRAL_APP_FIFTH_RESOLVER_SEAM.md → §3.5`: *"Migrating only line 17 leaves that inner helper still on the platform call. … the second `property_performance.js` call site migrates in a separate later phase."*).
- **Mechanical cleanliness:** **Highest in this candidate set.** One downstream `ss` consumer; no ensure-\* call; caller already verified the sheet exists; no try/catch around `ss.getSheetByName` for branching; existing try/catch is around `getInactiveHousesSet_()` only, which is unaffected by the resolver swap.
- **Blast radius:** Bounded to the **Property Performance** tab. Same surface Phase 5 already covers. A regression here cannot reach Overview, Bills Due, Cash Flow, Planning, Activity, or any other tab — they don't call `getHouseNamesFromHouseAssets_()`.
- **Milestone:** Migrating this line makes `property_performance.js` the **second fully resolver-routed production module** (after `debt_payoff_projection.js` achieved this in Phase 3). Two of 27 production modules fully routed is a meaningful inflection — it lets the migration narrative shift from "we have a seam in N modules" to "we have closed out N modules."
- **Verdict:** **Recommended Phase 6 target.**

### 3.2 Candidate B — `nextActionsPickRollingDebtTarget_()` (`next_actions.js:417`)

- **Behavior class:** READ-only. Reads `INPUT - Debts` via `readSheetAsObjects_(ss, 'DEBTS')`, applies `normalizeDebts_(rows, getAliasMap_())`, filters active debts with `balance > 0.005`. Whole body wrapped in `try/catch` with `Logger.log('getNextActionsData rolling target: ' + e); return null;` fallback at lines 443–446.
- **Pub/priv:** Internal (trailing underscore). Called from `getNextActionsData()` (the public entry consumed by `Dashboard_Script_PlanningNextActions.html` via `google.script.run`).
- **Single caller:** `getNextActionsData()` at `next_actions.js:177`. Verified via repo-wide grep.
- **Blank-workbook short-circuit:** Implicit — `readSheetAsObjects_` throws on missing sheet, the wrapping try/catch returns `null`, and `getNextActionsData()` continues with the other action builders. Same mechanism that has been in place since Next Actions v1 shipped.
- **Downstream `ss` consumers:** One — `readSheetAsObjects_(ss, 'DEBTS')`. Plus `normalizeDebts_(rows, …)` which doesn't take `ss`.
- **Call-graph reachability:** **On the Planning → Next Actions public load path.** Exercises the resolver from a public surface every time the user opens or refreshes Next Actions.
- **Precedent match:** **No** — internal helper. But `next_actions.js` has exactly one production `SpreadsheetApp.getActiveSpreadsheet()` call site (this one), so migrating it makes `next_actions.js` the **second fully resolver-routed production module** — same milestone Candidate A produces.
- **Mechanical cleanliness:** High — try/catch wrapper handles failures gracefully; single downstream `ss` consumer; same `readSheetAsObjects_(ss, 'DEBTS')` shape as Phase 4's just-shipped seam.
- **Blast radius:** Bounded. Affects only the "rolling debt target" recommendation card in Next Actions; the rest of the Next Actions surface (urgent / recommended / optimize buckets, cash gap, near-term upcoming) is unaffected. Same surface Phase 5 has *not* covered — a different tab from any prior phase.
- **Milestone:** Same as Candidate A — second fully resolver-routed production module. Plus a module-coverage widening (5 modules touched → 6).
- **Verdict:** **Strong alternative.** Defer to Phase 7. Phase 6 prioritizes closing the intermediate state Phase 5 explicitly recorded over widening coverage to a new module. See §4 for the tiebreaker rationale.

### 3.3 Candidate C — `getLatestHistorySnapshots_(count)` (`dashboard_data.js:273`)

- **Behavior class:** READ-only. Reads `OUT - History`.
- **Pub/priv:** Internal (trailing underscore).
- **Single caller:** `buildDashboardSnapshot_()` at `dashboard_data.js:122`. Verified via repo-wide grep.
- **Blank-workbook short-circuit:** **Yes** — `const sheet = ss.getSheetByName('OUT - History'); if (!sheet) return [];` at lines 274–275.
- **Downstream `ss` consumers:** None — values + display arrays parsed inline.
- **Call-graph reachability:** Only reached transitively via `buildDashboardSnapshot_()` — the snapshot itself still calls `SpreadsheetApp.getActiveSpreadsheet()` directly at `dashboard_data.js:73`, so a Phase 6 migration here exercises the resolver only when the snapshot runs and only inside this inner helper (the outer wrapper still bypasses the seam). This produces the asymmetric "snapshot wrapper on the platform call, inner helper through the resolver" intermediate that `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §3` calls out and `CENTRAL_APP_FIFTH_RESOLVER_SEAM.md → §8` explicitly used as the reason to ship Phase 5 against `property_performance.js` first.
- **Precedent match:** **No** — internal helper, not a public entry.
- **Mechanical cleanliness:** **Highest possible in `dashboard_data.js`** — cleanest seam shape in that module per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §2.2`.
- **Blast radius:** Indirect. Feeds the Overview snapshot's history-deltas, Recent Snapshots section, and weekly-baseline picker. Larger than Candidates A or B because Overview is the highest-traffic surface in the app.
- **Milestone:** None. Does not widen module coverage (`dashboard_data.js` was already touched in Phase 4). Does not produce a fully-routed-module milestone (`dashboard_data.js` has 9 residual platform calls).
- **Verdict:** **Defer to a later phase that specifically takes on dashboard internal readers as a group** (per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §6 Step B`, the four history readers — `getLatestHistorySnapshots_`, `getAllHistorySnapshotRows_`, `getPlannerHistoryMetricsByOffset_`, `getPriorMonthPlannerHistoryMetrics_` — are a coherent group and should be migrated together to avoid arbitrary partial-routing inside the dashboard).

---

## 4. Recommendation — Phase 6 target

**`getHouseNamesFromHouseAssets_()` at `property_performance.js:102`.** (Function defined at line 101; the `const ss = SpreadsheetApp.getActiveSpreadsheet();` line to migrate is line 102.)

Exact change (one line, one file):

```
function getHouseNamesFromHouseAssets_() {
- const ss = SpreadsheetApp.getActiveSpreadsheet();
+ const ss = getUserSpreadsheet_();
  const sheet = getSheet_(ss, 'HOUSE_ASSETS');
  // … rest of the function unchanged …
```

Rationale, summarized:

- **Closes the intermediate state Phase 5 recorded.** Phase 5's design doc (`CENTRAL_APP_FIFTH_RESOLVER_SEAM.md → §3.5`) explicitly noted that migrating `getPropertyPerformanceData()` alone leaves `getHouseNamesFromHouseAssets_()` as a residual platform call, and named that residual call as "a separate later phase." Phase 6 *is* that later phase. The narrative payoff — *"Property Performance is fully resolver-routed"* — is exactly what the Phase 5 doc promised would be available "in a separate later phase."
- **Achieves the second fully resolver-routed production module milestone.** After Phase 6, `property_performance.js` joins `debt_payoff_projection.js` as a module with **zero** residual `SpreadsheetApp.getActiveSpreadsheet()` calls. 2 of 27 production modules fully routed.
- **Tightest call graph in the candidate set.** Exactly one caller, and that caller is itself already resolver-routed (Phase 5). No other module reaches `getHouseNamesFromHouseAssets_()`. Compare with Candidate C, where the snapshot wrapper still bypasses the seam.
- **Caller-verified sheet existence — strongest safety property of any phase so far.** The only caller (`getPropertyPerformanceData`) short-circuits the blank-workbook case at line 25 *before* invoking `getHouseNamesFromHouseAssets_()`. By construction, this function is *never* reached on a workbook without `SYS - House Assets`. The migration cannot regress a missing-sheet path because no missing-sheet path reaches the migrated line.
- **No try/catch around the migrated line.** The existing try/catch at lines 116–120 wraps `getInactiveHousesSet_()` only; the `const ss = ...` line and the `getSheet_(ss, 'HOUSE_ASSETS')` line are outside it. The migration does not interact with the try/catch in either direction.
- **Pure read.** No `setValue`, no `appendRow`, no sheet creation, no Activity log write, no planner trigger. Identical safety profile to Phases 1–5.
- **No ensure-\* helper called.** Avoids the ensure-helper-interaction question entirely (deferred to `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2`).
- **Strong uniform-`ss` flow.** `getSheet_(ss, 'HOUSE_ASSETS')` already accepts `ss` explicitly. The function passes `ss` to exactly one downstream helper, and that helper has had the `(ss, key)` signature since the original `config.js:26` definition.
- **Same testing surface Phase 5 just exercised.** No new tab to learn, no new payload shape to verify. Whatever validation discipline was applied to Phase 5 applies unchanged to Phase 6. The Phase 5 cold-start investigation (`CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §11.4`) covers this surface and is reusable as the latency baseline.
- **One-line reversibility.** Identical to Phases 1–5. Restoring `const ss = SpreadsheetApp.getActiveSpreadsheet();` returns the file to its pre-Phase-6 state in one diff.
- **No new Decision Pending item.** Test harness, mapping storage, onboarding UI, version markers, and entitlement model all stay deferred per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §8`.

### Tiebreaker against Candidate B

Both candidates produce the second fully resolver-routed module. The tiebreaker:

- **Candidate A** closes a known intermediate state (the Phase 5 doc literally promised this phase) inside the module the user *just smoke-tested*. The testing burden is "open Property Performance again and verify nothing changed." Cognitive load: very low.
- **Candidate B** widens module coverage to a new module (`next_actions.js`, the Planning → Next Actions tab) and requires the user to validate a different surface. Cognitive load: low, but not as low as Candidate A.

For Phase 6 specifically — the first internal-helper phase, and the first phase where we deliberately leave the strict public-entry precedent of Phases 1–5 — minimizing cognitive load is the right discipline. Candidate A wins the tiebreaker. Candidate B is the recommended **Phase 7** target if the next prompt continues the internal-helper pattern.

---

## 5. Expected files touched by the future implementation pass

When the implementation prompt for Phase 6 eventually arrives, it should touch exactly **one** file:

- **`property_performance.js`** — one line, line 102. `const ss = SpreadsheetApp.getActiveSpreadsheet();` → `const ss = getUserSpreadsheet_();`.

Files that **must not** be touched in the Phase 6 implementation pass:

- `central_resolver.js` — resolver body stays the one-line pass-through. Phase 6 does not extend it.
- Every other `.js` — no other module's `SpreadsheetApp.getActiveSpreadsheet()` call site is migrated in Phase 6.
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
4. **House ordering preserved.** The sorted house list returned by `getHouseNamesFromHouseAssets_()` is identical to the pre-change ordering (`names.sort()` runs at the end of the function and is unaffected by the resolver swap, but verifying preserves byte-for-byte parity).
5. **Inactive houses still excluded.** Houses marked `Active = No` on `SYS - House Assets` continue to be excluded from the table (handled by `getInactiveHousesSet_()` — the try/catch around that call is unaffected by Phase 6).
6. **Property Type filter behavior unchanged.** Rental vs. non-rental distinction in `isHouseAssetsRentalForCashFlow_` is preserved (no rent summation for non-rentals; rentals + blank type still sum rent — backward-compatibility behavior intact).
7. **No new Activity rows from the read.** After loading Property Performance, `LOG - Activity` row count is unchanged (`getHouseNamesFromHouseAssets_()` is read-only by contract; this is the critical post-pass invariant).
8. **Phase 1 invariant.** `Usable cash after buffers` on the Overview matches the pre-change value.
9. **Phase 2 invariant.** Cash Flow → Quick Add payee dropdown is unchanged.
10. **Phase 3 invariant.** Debt Overview per-debt table, summary block, recommendations, and warnings are unchanged.
11. **Phase 4 invariant.** Bills Due payNow / paySoon debt-payment breakdown card unchanged.
12. **Phase 5 invariant.** Property Performance entry behavior (year selection, blank-workbook empty envelope) unchanged.

### Blank workbook (or wiped reference workbook)

13. **Property Performance on blank workbook.** Confirm the tab loads with the empty-state envelope (`rows: []`, `portfolio: { equity: 0, rent: 0, expenses: 0, netCash: 0 }`, empty `message`) and shows the calm "No houses yet." copy. **No red banner.** The blank-workbook short-circuit at line 25 of `property_performance.js` still fires *before* reaching the migrated line — so the Phase 6 change is logically unreachable on a blank workbook. This is the strongest possible safety property and should be explicitly verified.
14. **Cash Flow sheet missing message.** On a populated `SYS - House Assets` but missing `INPUT - Cash Flow YYYY`, confirm the `message` field still surfaces the legacy *Cash Flow sheet "INPUT - Cash Flow YYYY" not found; rent totals are $0.* string. (Driven by `tryGetCashFlowSheet_(ss, year)` returning `null`; unaffected by Phase 6.)

### Cross-checks (both workbooks)

15. **No write side effects.** Confirm no `setValue` / `appendRow` / sheet creation operation happens during the read. `getHouseNamesFromHouseAssets_()` is read-only by contract; this verifies the migration did not accidentally introduce a write.
16. **Subjective latency.** The Property Performance tab should feel identical to before. One extra function-call frame is below the noise floor; if the tab feels measurably slower, suspect cold start (same investigation as Phase 4) and confirm via the second reload.
17. **Fully-routed-module assertion.** Verify by repo-wide grep that `property_performance.js` contains **zero** occurrences of `SpreadsheetApp.getActiveSpreadsheet()` after the pass. This is the new milestone Phase 6 introduces and should be confirmed as part of the post-pass documentation update.

### Stop-on-regression posture

Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §6`: if any of the above tests fail, the Phase 6 pass is reverted (single line restored to `SpreadsheetApp.getActiveSpreadsheet()`) and re-planned. The pass is not patched in place.

---

## 7. Risk level

**Very low.** Materially equivalent to Phase 5, with two additional safety properties:

- **Caller already verified sheet existence.** The only path to the migrated line passes through Phase 5's blank-workbook short-circuit (`property_performance.js:25`), which guarantees `SYS - House Assets` exists before `getHouseNamesFromHouseAssets_()` is invoked. The migrated line is *unreachable* on a blank workbook by construction. No prior phase has had this property.
- **No try/catch around the migrated line.** The existing try/catch wraps `getInactiveHousesSet_()` only; the migration touches none of the catch-branch behavior. The set of code paths that can throw is unchanged.

Plus the standard Phase 1–5 safety baseline:

- Read-only function.
- No ensure-\* helper call.
- One line changed in one file.
- One-line reversible.
- Bounded surface — Property Performance tab only, not on the Overview load path.
- Same resolver body (one-line pass-through, unchanged since Phase 1).
- Same downstream helper (`getSheet_`) already accepts `ss` explicitly.

The risk profile is *strictly lower* than Phase 4 (`dashboard_data.js`) and Phase 5 (`property_performance.js` public entry). The seam exercises a known tab surface and removes the intermediate state Phase 5 deliberately left in place.

---

## 8. Sequencing — before or after additional dashboard internal readers or `next_actions.js`?

**Phase 6 should ship before the four `dashboard_data.js` internal history readers AND before `nextActionsPickRollingDebtTarget_()`.** Three reasons:

1. **Promise honoring.** Phase 5's design doc explicitly named the `property_performance.js:102` migration as "a separate later phase." Honoring that promise as Phase 6 keeps the migration narrative coherent — Phase 5 said "we'll come back to this," Phase 6 *is* coming back to it. Re-ordering would leave the Phase 5 intermediate state in place longer than necessary while widening to other surfaces.
2. **Lowest cognitive load.** The migrated line lives in the module the user just smoke-tested in Phase 5. The testing payload (Property Performance tab, per-house values, portfolio totals) is identical. The user does not need to learn or validate a new surface for Phase 6.
3. **Milestone clarity.** "Property Performance is fully resolver-routed" is a clean, narrative-friendly statement after Phase 6 completes. Compare with the Candidate C path, which leaves `dashboard_data.js` with 8 residual platform calls and produces no new fully-routed module.

After Phase 6 ships, the recommended order is:

- **Phase 7 candidate: `nextActionsPickRollingDebtTarget_()` in `next_actions.js:417`.** Same fully-routed-module milestone (third such module), widens module coverage to 6 modules. The natural follow-up: having proven the internal-helper pattern works in Phase 6, apply it to a new module to maximize coverage signal.
- **Phase 8+: the four `dashboard_data.js` history readers as a coherent group** per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §6 Step B`. Migrating them together (rather than one-at-a-time) avoids leaving an arbitrary partial-routing inside `dashboard_data.js` between phases. Likely 2–3 phases depending on how the group is sized.
- **Phase N+: `buildInputBillPlannerPaymentWindows_` (`dashboard_data.js:2023`)** — internal planner-email helper, lower priority because its effect is only visible in the planner email and requires email-inspection to validate.
- **Phase N+1+: ensure-backed reads, snapshot wrapper, write entries** — per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 steps 2–5`.

Alternative ordering: a future prompt could re-pick Candidate B (`nextActionsPickRollingDebtTarget_`) for Phase 6 instead, on the grounds that widening module coverage to a new module is a stronger signal than closing an intermediate state inside an already-touched module. Both orderings are defensible. The default recommendation here is **Candidate A (`getHouseNamesFromHouseAssets_()`)** because it honors the Phase 5 promise, minimizes testing cognitive load, and produces the fully-routed-module milestone in the module the user just exercised; Candidate B is the right pick if the next prompt explicitly prioritizes module-coverage breadth over closing the Phase 5 intermediate.

---

## 9. Architectural boundaries reaffirmed for Phase 6

- Resolver body remains the **one-line pass-through** to `SpreadsheetApp.getActiveSpreadsheet()`. Body unchanged since Phase 1 (`b2798a7`).
- **No central mode.** No identity resolution, no workbook lookup, no fallback path.
- **No `PropertiesService`.** No user-properties read, no script-properties write related to the resolver.
- **No `SpreadsheetApp.openById(...)`.** Not introduced anywhere; the function does not exist in production code today and Phase 6 does not add it.
- **No user mapping.** No `SYS - User Workbooks`, no central registry sheet, no per-user lookup table.
- **No `Session.getActiveUser()` / `Session.getEffectiveUser()` plumbing related to spreadsheet identity.** The three existing production uses of `Session.getActiveUser()` (per `CENTRAL_APP_DEPENDENCY_AUDIT.md → §2`) are unrelated and not touched.
- **No write-path migration.** Every write entry in the codebase stays on the platform call. Quick Add Payment writes (lines 185, 248 of `quick_add_payment.js`), `skipDashboardBill`, planner output, Bills / Debts / Assets / Property writes — all unchanged.
- **No ensure-\* helper routed through the resolver.** `ensureActivityLogSheet_`, `ensureCashFlowYearSheet_`, `ensureOnboardingBankAccountsSheetFromDashboard`, etc. all continue to call `SpreadsheetApp.getActiveSpreadsheet()` inside their own bodies; Phase 6 does not touch them. They migrate together in `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2`.
- **No `buildDashboardSnapshot_()` migration.** The canonical dashboard aggregation entry at `dashboard_data.js:73` is intentionally untouched and migrates last among dashboard reads per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §6 Step E`.
- **No `appsscript.json` change.** Scopes, runtime, web-app posture all unchanged. Deployment posture remains `executeAs: USER_DEPLOYING`, `access: MYSELF`.
- **No HTML / CSS / schema change.** No client-side code touched, no sheet headers added or renamed, no Activity event added.

---

## 10. Closing notes

This document does **not** authorize implementation. The Phase 6 implementation pass requires its own Cursor implementation prompt with explicit user approval, per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9`.

When that prompt eventually arrives, it should:

- name `getHouseNamesFromHouseAssets_()` at `property_performance.js:102` as the target (or override with a written reason),
- migrate exactly one line,
- run the §6 checklist before and after,
- update the audit banner (6 migrated / 129 remaining), record the second fully-routed module (`property_performance.js`), and update the relevant doc set (`CENTRAL_APP_DEPENDENCY_AUDIT.md`, `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 1`, `PROJECT_CONTEXT.md`, `SESSION_NOTES.md`),
- add a "Status — shipped in `<hash>`" banner to this document as a separate documentation pass after the implementation lands (mirroring the pattern set by `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` / `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` / `CENTRAL_APP_THIRD_RESOLVER_SEAM.md` / `CENTRAL_APP_FIFTH_RESOLVER_SEAM.md` / `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §11`).

Until then, the migration remains design work. `property_performance.js:102` continues to call the platform directly. The resolver continues to be a one-line pass-through. No central mode, no `PropertiesService`, no `openById`, no identity helper, no user mapping, no deployment change.

---

End of document.
