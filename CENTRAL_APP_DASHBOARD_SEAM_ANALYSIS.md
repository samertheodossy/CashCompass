# CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md

Dashboard-layer (`dashboard_data.js`) seam analysis for the next round of Central App resolver migrations. **Analysis/design only.** No Apps Script code, no HTML/JS, no deployment changes, no implementation.

> **Status — Phase 4 shipped in `99bcf37`.** The recommended next dashboard seam in §9 (`getDebtPaymentBreakdownForDashboard()` at `dashboard_data.js:1235`) was migrated to `getUserSpreadsheet_()` in one line. The resolver body remained the same one-line pass-through (no central mode, no `PropertiesService`, no `openById`, no user mapping, no deployment change). Bills Due dashboard surface stayed stable through smoke testing; the Overview load-time slowdown observed during the post-implementation reload was investigated and **traced to Apps Script web-app cold-start / transient platform latency, not to the seam** — `getDebtPaymentBreakdownForDashboard()` is not on the initial Overview load path (see §11 below). After Phase 4: **4 production call sites migrated / 131 remaining** across 26 modules. `dashboard_data.js` now has **9** production `SpreadsheetApp.getActiveSpreadsheet()` call sites remaining (was 10). All Steps B–F in §6 remain deferred and intentionally untouched, including every ensure-\* helper and `buildDashboardSnapshot_()`.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — overall migration architecture.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — preferred deployment direction.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle and backward-compatibility contract.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged roadmap.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — call-site inventory and risk classification (the source of the candidate shortlist).
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — family beta scope.
- `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` / `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` / `CENTRAL_APP_THIRD_RESOLVER_SEAM.md` — per-phase designs and shipped outcomes.

---

## 1. Purpose

This document is the *prep* for migrating any of the `dashboard_data.js` call sites. It is deliberately a stand-alone analysis rather than a Phase 4 design pick because `dashboard_data.js` is the audit's largest single read module (10 production `SpreadsheetApp.getActiveSpreadsheet()` call sites, 1 of which is a write path) and the entire previous three phases have explicitly avoided it.

The Phase 2 and Phase 3 designs both pinned the rule **"no dashboard aggregation seam yet"** for a reason: `dashboard_data.js` carries the application's main snapshot read entry, the Bills Due cards, the recurring-bills fallback, four history-snapshot readers, and a write entry (`skipDashboardBill`) — all in one file, all on the dashboard hot path, all visible to every user on every load. A single careless migration here could fragment a coherent future module pass, regress the snapshot, or introduce a behavior difference under blank-workbook conditions.

The goal of this document is to:

- enumerate every `SpreadsheetApp.getActiveSpreadsheet()` call site in `dashboard_data.js`,
- classify each by read-only vs ensure-\* vs write,
- recommend the safest first dashboard seam (without yet authorizing implementation),
- list the dashboard seams that should be deferred,
- pin a manual smoke test plan that any future dashboard seam pass must run.

When a Phase 4 design prompt arrives later, it picks one candidate from this document and produces its own per-phase design doc, the same way Phases 1–3 did.

---

## 2. Inventory of active spreadsheet call sites in `dashboard_data.js`

`dashboard_data.js` contains **10** production `SpreadsheetApp.getActiveSpreadsheet()` call sites. Each is enumerated below with function, line, behavior class, user-visible surface, and the downstream helpers called.

### 2.1 `buildDashboardSnapshot_()` — line 73

- **Behavior class:** READ + **ensure-\***. Reads `SYS - Accounts`, `INPUT - Debts`, `SYS - Assets`, `SYS - House Assets`, `OUT - History`, the prior-month investments path. Calls **`ensureActivityLogSheet_(ss)`** at line 74 (creates `LOG - Activity` on blank workbooks). No `setValue` or `appendRow` writes anywhere in the body — but the ensure helper is a behavior surface that distinguishes this from a pure read.
- **User-visible surface:** **Highest possible.** This is the canonical entry point for every dashboard load. Overview KPIs, Net Worth attribution, deltas vs. the last planner run, buffer runway, financial health score, suggested actions, and the issues list all flow from this function's return value.
- **Downstream helpers called:** `ensureActivityLogSheet_(ss)`, `getSheet_(ss, 'ACCOUNTS' | 'DEBTS')`, `sumColumnByHeaderForOptionalSheet_(ss, 'ASSETS' | 'HOUSE_ASSETS', …)`, `getLatestHistorySnapshots_(2)` (which itself acquires its own `ss` — see 2.2), `getPlannerHistoryMetricsByOffset_(…)` (2.4), `getPriorMonthPlannerHistoryMetrics_()` (2.5), `getUpcomingExpenseMetricsSafe_`, `buildDashboardIssues_(ss, snapshot)`, `buildSuggestedActions_`, `buildBufferRunway_`, `buildFinancialHealthScore_`, `getDashboardSourceUpdatedMap_`.
- **Blank-workbook posture:** explicit `try/catch` around `getSheet_(ss, 'ACCOUNTS')` and `getSheet_(ss, 'DEBTS')` so missing-sheet errors degrade to `snapshotState = 'notSetUp'` instead of throwing. The `ensureActivityLogSheet_` call is unconditional, so a blank workbook unavoidably gets `LOG - Activity` created on the first dashboard load today.

### 2.2 `getLatestHistorySnapshots_(count)` — line 273

- **Behavior class:** READ-only. Reads `OUT - History`. Has `const sheet = ss.getSheetByName('OUT - History'); if (!sheet) return [];` at lines 274–275 — cleanest possible blank-workbook short-circuit.
- **User-visible surface:** indirect — feeds the dashboard snapshot's history-deltas and the Recent Snapshots section. Not a publicly-named entry; trailing underscore marks it as an internal helper called from `buildDashboardSnapshot_` and `getPriorMonthTotalDebtFromHistory_`.
- **Downstream helpers called:** none (in-line `getValues` / `getDisplayValues` + index walking).

### 2.3 `getAllHistorySnapshotRows_()` — line 374

- **Behavior class:** READ-only. Reads `OUT - History`. Same `if (!sheet) return [];` short-circuit. Used by the weekly-baseline picker (`pickWeeklyBaselineFromRows_`).
- **User-visible surface:** indirect — feeds Net Worth attribution and weekly-baseline deltas on the Overview card.
- **Downstream helpers called:** none.

### 2.4 `getPlannerHistoryMetricsByOffset_(offsetFromLatest)` — line 578

- **Behavior class:** READ-only. Reads `OUT - History`. Returns a metrics envelope or `null`. Same short-circuit pattern.
- **User-visible surface:** indirect — feeds buffer runway and financial-health-score baselines.
- **Downstream helpers called:** `readPlannerHistoryMetricsRow_` (pure index reader).

### 2.5 `getPriorMonthPlannerHistoryMetrics_()` — line 618

- **Behavior class:** READ-only. Reads `OUT - History`. Returns `{metrics, label}`. Same short-circuit pattern.
- **User-visible surface:** indirect — used for month-over-month deltas on the dashboard.
- **Downstream helpers called:** `readPlannerHistoryMetricsRow_`.

### 2.6 `getDebtPaymentBreakdownForDashboard()` — line 1235

- **Behavior class:** READ-only. Reads `INPUT - Debts` via `readSheetAsObjects_(ss, 'DEBTS')`. **No ensure-\* call.** No writes. No blank-workbook short-circuit before the `readSheetAsObjects_` call — but the broader Bills Due / Overview pipeline that consumes this function already guards on `snapshotState` before drawing the cards, so a missing `INPUT - Debts` on this path would propagate as a normal "missing sheet" error and surface as a banner rather than a wrong value.
- **User-visible surface:** **public dashboard entry** (the `ForDashboard` naming convention is the project's marker for server functions exposed to the dashboard layer). **Call-graph correction (post-Phase 4 verification):** the function's only caller in the codebase is `getUpcomingBillsDueForDashboard()` at line 1294 of the same file. It is **not** invoked from `next_actions.js` (the prior version of this analysis incorrectly listed `next_actions.js` as a consumer — verified via repo-wide grep on `2026-05-21`; no `next_actions.js` reference exists). `getUpcomingBillsDueForDashboard()` itself currently has no callers (no `google.script.run.getUpcomingBillsDueForDashboard(…)` from any HTML client; no server-side caller in any other `.js`). That makes the function reachable only through its sibling wrapper — historically the **payNow / paySoon** debt-payment breakdown card on the Bills Due tab — so its present-day blast radius is genuinely minimal. This call-graph fact is **the reason the observed Overview slowdown after the Phase 4 implementation was not a regression** — see the status banner above and §11.
- **Downstream helpers called:** `readSheetAsObjects_(ss, 'DEBTS')`, `normalizeDebts_(rows, aliasMap)`, `buildUpcomingPayments_(debts, today, tz, 7, 30)`.

### 2.7 `getBillsDueFromCashFlowForDashboard(preloadedCurrentCashFlow)` — line 1339

- **Behavior class:** READ + **ensure-\***. Calls `ensureActivityLogSheet_(ss)` at line 1340 and `ensureCashFlowYearSheet_(today.getFullYear())` at line 1352 (wrapped in `try/catch`). Reads `INPUT - Bills` and the current-year `INPUT - Cash Flow YYYY` to compute `{overdue, next7}`.
- **User-visible surface:** **public dashboard entry.** Drives the Bills Due tab's Overdue / Next 7 buckets.
- **Downstream helpers called:** `ensureActivityLogSheet_(ss)`, `ensureCashFlowYearSheet_(...)`, `getDebtBillsDueRows_(ss, today, tz, preload)`, `getInputBillsDueRows_(ss, today, tz)`, `parseIsoDateAtLocal_`, `compareBillsByDueDate_`.

### 2.8 `getRecurringBillsWithoutDueDateForDashboard()` — line 1406

- **Behavior class:** READ + **ensure-\***. Calls `ensureCashFlowYearSheet_(currentYear)` at line 1419 (wrapped in `try/catch`). Reads the current-year `INPUT - Cash Flow YYYY` and (best-effort) next-year sheet. Reads `INPUT - Bills` and `INPUT - Debts` payee maps via `getInputBillsPayeeMap_(ss)` / `getDebtPayeeMap_(ss)` / `getDebtPayeeMapAllStatuses_(ss)`.
- **User-visible surface:** **public dashboard entry.** Drives the "Recurring Bills (No Due Date)" fallback card on the Bills Due tab. This is the function whose empty-state behavior was investigated during Phase 1 smoke testing (`SESSION_NOTES.md` notes the May 25 promotion window).
- **Downstream helpers called:** `ensureCashFlowYearSheet_(...)`, `getCashFlowSheet_(ss, currentYear)`, `tryGetCashFlowSheet_(ss, nextDate.getFullYear())`, `getInputBillsPayeeMap_(ss)`, `getDebtPayeeMap_(ss)`, `getDebtPayeeMapAllStatuses_(ss)`, `getCashFlowHeaderMap_`, `monthHeaderFromYearMonth_`, etc.

### 2.9 `buildInputBillPlannerPaymentWindows_(today, tz, payNowWindowDays, paySoonWindowDays)` — line 2023

- **Behavior class:** READ-only. Reads `INPUT - Bills` via `getInputBillsDueRows_(ss, today, tz)`. No ensure-\* call, no writes.
- **User-visible surface:** indirect — internal helper used by the planner email path to build the Pay Now / Pay Soon windows (mirrors the email-section logic for `INPUT - Bills`). Trailing underscore marks it private.
- **Downstream helpers called:** `getInputBillsDueRows_(ss, today, tz)`, `stripTime_`, `parseIsoDateAtLocal_`, `daysBetween_`, sorting helpers.

### 2.10 `skipDashboardBill(skipKey)` — line 2369

- **Behavior class:** **WRITE.** Writes `0` into the Cash Flow cell that backs the skipped bill (with full format-restoration), then appends a `bill_skip` row to `LOG - Activity` via `appendActivityLog_`. This is the only write entry in `dashboard_data.js`.
- **User-visible surface:** **public dashboard entry.** Triggered by the "Skip" button on the Bills Due tab.
- **Downstream helpers called:** `resolveDashboardBillSkipTarget_(ss, skipKey)`, `getDashboardBillByKey_(ss, skipKey)`, `appendActivityLog_(ss, …)`, plus cell-format read/write APIs.

---

## 3. Pure read candidates

Functions in `dashboard_data.js` that are read-only **and** call no ensure-\* helper:

| # | Function · Line | Pub/Priv | Blank-workbook short-circuit | Why a candidate |
|---|---|---|---|---|
| 2.6 | `getDebtPaymentBreakdownForDashboard` · 1235 | **Public entry** | No (relies on upstream `snapshotState` gating) | **Cleanest public-entry read in the file.** No ensure-\*. `ss` passes to exactly one helper (`readSheetAsObjects_`). Mirrors the Phase 1–3 entry-point precedent. |
| 2.2 | `getLatestHistorySnapshots_` · 273 | Internal | **Yes** (`if (!sheet) return [];`) | Cleanest mechanical seam in the file. But trailing underscore = internal helper, not an entry point. |
| 2.3 | `getAllHistorySnapshotRows_` · 374 | Internal | **Yes** | Same shape as 2.2. Internal. |
| 2.4 | `getPlannerHistoryMetricsByOffset_` · 578 | Internal | **Yes** | Same shape. Internal. |
| 2.5 | `getPriorMonthPlannerHistoryMetrics_` · 618 | Internal | **Yes** | Same shape. Internal. |
| 2.9 | `buildInputBillPlannerPaymentWindows_` · 2023 | Internal | No (relies on `getInputBillsDueRows_` to throw) | Internal planner-email helper. |

**Pattern:** the four history readers (2.2 / 2.3 / 2.4 / 2.5) are mechanically the cleanest seams in the file. Each starts with `const ss = SpreadsheetApp.getActiveSpreadsheet(); const sheet = ss.getSheetByName('OUT - History'); if (!sheet) return [];` and never re-acquires `ss`. They are also all consumed only by `buildDashboardSnapshot_` (transitively). Migrating them in isolation is safe but does not exercise the resolver from a public surface — they only ever run when `buildDashboardSnapshot_` itself runs, which means migrating them without first migrating their caller produces the slightly odd state where the snapshot's outer wrapper still calls the platform directly while four of its inner helpers go through the resolver. The seam exists at the right entry boundary either way, but it is not the boundary Phases 1–3 established as the precedent.

**Per the Phase 1–3 precedent** ("migrate at the public-entry boundary, where the `const ss = …` line lives at the top of a server-callable function"), candidate **2.6 (`getDebtPaymentBreakdownForDashboard`)** is the only candidate that matches the precedent exactly.

---

## 4. Ensure / side-effect candidates

Functions in `dashboard_data.js` that call ensure-\* helpers or otherwise touch sheet creation. These are **higher risk** because the ensure helper's `ss` argument is the resolver's output; if the resolver ever drifts from the platform's return, the ensure call would target a different workbook than the legacy code path. In Phase 1 (and beyond) the resolver is a pass-through so this is theoretical, but the design contract still applies.

| # | Function · Line | Ensure-\* calls | Why deferred |
|---|---|---|---|
| 2.1 | `buildDashboardSnapshot_` · 73 | `ensureActivityLogSheet_(ss)` | The canonical dashboard entry. Highest blast radius. Should migrate **last** among non-write candidates so a regression is caught early on the smaller seams. |
| 2.7 | `getBillsDueFromCashFlowForDashboard` · 1339 | `ensureActivityLogSheet_(ss)`, `ensureCashFlowYearSheet_(...)` | High-visibility (Bills Due tab). Two ensure calls compound risk. |
| 2.8 | `getRecurringBillsWithoutDueDateForDashboard` · 1406 | `ensureCashFlowYearSheet_(...)` | High-visibility (Bills Due fallback card). The empty-state window was the subject of the Phase 1 smoke-test investigation; migrating it should wait until after the cleaner seams prove the pattern. |

**Recommendation:** none of these should be the first dashboard seam. Defer until at least one pure-read dashboard seam has shipped and proven the pattern under bound mode.

A separate, even more conservative recommendation: the `ensureActivityLogSheet_` and `ensureCashFlowYearSheet_` helpers themselves should ultimately also resolve `ss` via the resolver (per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2`). But that is a different pass — routing the ensure helpers' internal `getActiveSpreadsheet()` calls through the resolver — and is **not** in scope for any dashboard seam phase. Dashboard seams migrate the outer wrapper's `ss` acquisition. Ensure-helper migration is a separate, broader scope that touches multiple files.

---

## 5. Dashboard aggregation risks

### 5.1 Is `buildDashboardSnapshot_()` too broad for the next seam?

**Yes.** The function aggregates 5+ separately-acquired `ss` handles (its own + four history readers each acquire their own + ensure-\* helpers it transitively triggers), reads from at least six different sheets, and feeds the entire dashboard's visible surface. Migrating it before any of its smaller siblings would mean:

- The first dashboard regression would be visible to the user as a broken Overview, with no smaller-scoped diff to bisect against.
- The blast radius of any rollback would be the entire dashboard, not just one card.
- The `ensureActivityLogSheet_(ss)` interaction would be the very first ensure-\* migration in the project — without any precedent for "what does the resolver do when its result reaches an ensure helper?"

### 5.2 Should `buildDashboardSnapshot_` wait until smaller dashboard functions migrate first?

**Yes.** The precedent established by Phases 1–3 is to widen seam coverage one entry boundary at a time, starting with the smallest blast radius. The smallest-blast-radius dashboard entry is `getDebtPaymentBreakdownForDashboard` (one card on one tab); the next smaller is one of the four history readers (no direct visible surface, but each is one line behind the snapshot). Both should ship and prove the pattern before the snapshot itself migrates.

### 5.3 Is a dashboard-specific facade needed later?

**Possibly, but not now.** A facade — for example, a `getDashboardSpreadsheet_()` helper that wraps `getUserSpreadsheet_()` with dashboard-specific caching, fallback, or error reporting — is a different kind of abstraction. It would conflate workbook-identity resolution with dashboard-specific concerns, which is precisely the opposite of what the seam was designed to do (the seam is *identity-only*, *workbook-only*, deliberately stupid).

The right time to revisit a facade is when:

- Phase 6+ adds real central-mode behavior to the resolver, and
- Some dashboard-specific concern (caching, batched reads, request-scoped memoization) emerges that is genuinely about *how the dashboard uses the spreadsheet*, not about *which spreadsheet to use*.

Until then, no facade. Dashboard functions call `getUserSpreadsheet_()` directly, the same way every other migrated entry does.

---

## 6. Recommended dashboard migration order

Cautious ordering. Each step is a separate future implementation pass with its own per-phase design doc and its own regression-testing pass.

### Step A — Smallest pure-read public entry (recommended next dashboard seam)

**Target:** `getDebtPaymentBreakdownForDashboard` at line 1235.

**Why this is the safest first dashboard seam:**

- Public-entry boundary (`ForDashboard` suffix is the project's marker for server functions exposed to the dashboard layer). Matches the Phases 1–3 precedent exactly.
- Read-only with no `setValue` / `appendRow` / sheet creation.
- No ensure-\* helper called.
- One downstream helper consumes `ss` (`readSheetAsObjects_(ss, 'DEBTS')`); strong uniform-`ss` flow.
- Bounded user-visible surface: Bills Due tab's debt-payment breakdown card (payNow / paySoon counts). A regression would be obvious on first interaction.
- One-line reversibility, identical to Phases 1–3.

### Step B — Internal history readers (mechanically cleanest)

**Targets (in any order, in separate passes):** `getLatestHistorySnapshots_` (line 273), `getAllHistorySnapshotRows_` (line 374), `getPlannerHistoryMetricsByOffset_` (line 578), `getPriorMonthPlannerHistoryMetrics_` (line 618).

**Rationale:** these are the simplest possible read shapes in the file and have explicit blank-workbook short-circuits. They are *internal* (trailing underscore) rather than public entries, so they don't perfectly match the Phase 1–3 precedent — but after Step A ships and proves a dashboard seam, migrating them is low-risk by every other measure. Each is one line; each is one pass.

Step B's four migrations together produce a `dashboard_data.js` state where the entire history-snapshot read path resolves through the seam. That's the prerequisite Phase 6+ needs before the resolver body changes (because the body change would otherwise mean the snapshot and its history readers come from *different* spreadsheets in central mode).

### Step C — `buildInputBillPlannerPaymentWindows_` (internal planner-email helper)

**Target:** line 2023.

**Rationale:** internal helper for the planner email path; small blast radius. Migrate alongside or just after Step B.

### Step D — Ensure-backed reads

**Targets (in two separate passes):** `getRecurringBillsWithoutDueDateForDashboard` (line 1406), `getBillsDueFromCashFlowForDashboard` (line 1339).

**Rationale:** these are public entries that call ensure-\* helpers. Their per-pass migration shape is identical to Step A's, but the ensure-\* interaction means the smoke-test surface needs to confirm that no unexpected sheet creation behavior changes (blank workbook unchanged: ensure helpers still create the missing sheets the same way; populated workbook unchanged: ensure helpers are no-ops). After Step A has proven that the resolver's pass-through behavior holds for a `dashboard_data.js` read, Step D is straightforward.

### Step E — `buildDashboardSnapshot_` (aggregation entry)

**Target:** line 73.

**Rationale:** the canonical dashboard entry. Migrates **last** among `dashboard_data.js` reads. By the time this pass runs, every smaller dashboard entry plus every history reader is already through the seam, so a regression in `buildDashboardSnapshot_` is visible only as an issue with the *outer wrapper's* `ss` acquisition — not as an interaction with any of its many downstream calls. The ensure-\* call (`ensureActivityLogSheet_(ss)`) at this point has been exercised through the resolver multiple times already.

### Step F — `skipDashboardBill` (write entry)

**Target:** line 2369.

**Rationale:** **out of scope** for any pure-dashboard-read phase. Migrates as part of the write-path phase (`CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 4`). Listed here only so the file is fully accounted for.

### What this ordering produces

After Steps A–E land, `dashboard_data.js` has 9 of 10 production `SpreadsheetApp.getActiveSpreadsheet()` call sites behind the resolver. The remaining one (`skipDashboardBill`) is a write entry and migrates with the write-path phase. At that point, `dashboard_data.js` joins `cash_to_use.js` and `debt_payoff_projection.js` as a fully resolver-routed file.

---

## 7. Testing checklist (any dashboard seam pass)

Run before and after the implementation pass. The "before" run captures the baseline that the "after" run must match.

### Populated workbook (developer reference workbook)

1. **Overview loads.** Open the dashboard. Confirm the Overview card renders without a red banner. Verify every KPI matches a pre-change snapshot: Cash, Investments, House Equity, Total Debt, Net Worth, the four weekly-delta arrows, the buffer runway, the financial health score, the suggested-actions list, the issues list.
2. **Operations Snapshot card** (per `PROJECT_CONTEXT.md` Overview section). Confirm the metrics tile, refreshedAt timestamp, and the snapshotState badge match.
3. **Bills Due card.** Open the Bills Due tab. Confirm Overdue / Next 7 buckets render the same rows in the same order; payNow / paySoon debt buckets render the same debts; the "Recurring Bills (No Due Date)" fallback card renders the same rows (note: per the May 25 promotion window documented in `SESSION_NOTES.md`, this card may be empty even on a populated workbook depending on the date — capture the baseline before).
4. **Upcoming card** (overview + Cash Flow → Upcoming tab). Confirm overdue / next-7 / `ov_upcoming_*` KPIs match the baseline.
5. **Property cards.** Open Property Performance. Confirm per-house rows and portfolio totals are unchanged. *(Property reads come from `property_performance.js`, not `dashboard_data.js`, but the dashboard's Property Equity figure flows through `buildDashboardSnapshot_` — verify it matches.)*
6. **Activity tab.** Confirm the Activity log loads with the same rows and filter behavior as before. Confirm **no new rows have been written** by the dashboard read pass: in particular, no new `quick_pay`, `bill_skip`, `bank_import_*`, or `donation` rows.
7. **No new Activity rows from reads.** This is the single most important post-pass invariant. The dashboard read functions either do not log (most cases) or only log inside an explicit write branch (e.g. `skipDashboardBill`). After a read pass, the `LOG - Activity` row count must be unchanged.
8. **Phase 1 invariant.** `Usable cash after buffers` on the Overview matches the pre-change value.
9. **Phase 2 invariant.** Cash Flow → Quick Add payee dropdown is unchanged.
10. **Phase 3 invariant.** Debt Overview per-debt table, summary block, recommendations, and warnings are unchanged.

### Blank workbook (or wiped reference workbook)

11. **Overview on blank workbook.** Confirm the dashboard loads with `snapshotState: 'notSetUp'` (or `'partial'` if only one of `SYS - Accounts` / `INPUT - Debts` is missing) and shows the calm empty state. **No red banner.**
12. **Bills Due tab on blank workbook.** Confirm the Bills Due tab renders empty / not-set-up state cleanly; the "Recurring Bills (No Due Date)" fallback shows the standard empty message.
13. **Activity tab on blank workbook.** Confirm `LOG - Activity` was created **only if** the pre-Phase-1 baseline would have created it (i.e. when `buildDashboardSnapshot_` ran). Migrating an entry that did *not* previously trigger `ensureActivityLogSheet_` must not start triggering it.

### Cross-checks (both workbooks)

14. **No write side effects.** Confirm no `setValue` / `appendRow` / sheet-creation operation happens during read traversal beyond what was already happening (i.e. the ensure-\* helpers in 2.1 / 2.7 / 2.8, unchanged).
15. **Subjective latency.** The dashboard should feel identical to before. A read pass adds one extra function-call frame, below the noise floor.

### Stop-on-regression posture

Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §6`: if any of the above tests fail, the dashboard seam pass is reverted and re-planned. The pass is not patched in place. Restoring the single touched line returns the file to the pre-pass baseline in one diff.

---

## 8. Decision Pending items

### 8.1 Migration granularity — one call site at a time?

**Recommendation: yes.** Phases 1–3 each migrated exactly one line in one file. The dashboard pass should not break that pattern. Each of the 9 read-only call sites in `dashboard_data.js` is its own implementation pass with its own per-phase design doc and its own regression run.

The temptation to bundle (e.g. "migrate all four history readers in one pass since they're mechanically identical") should be resisted. The bisection value of one-line-per-pass is the single biggest tool against regression; bundling four migrations into one diff would forfeit it.

**Status: Decision Pending for the implementer.** A counter-recommendation — migrate all four history readers in one pass on the grounds that they are functionally indistinguishable from the resolver's perspective — would also be defensible if the future Phase 4 prompt explicitly authorizes the bundle and the regression run covers all four together.

### 8.2 Ensure-\* helpers routed through resolver yet?

**Recommendation: no, not in any dashboard seam pass.** The ensure-\* helpers themselves (`ensureActivityLogSheet_`, `ensureCashFlowYearSheet_`, etc.) currently each call `SpreadsheetApp.getActiveSpreadsheet()` internally. Migrating those internal calls to the resolver is `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2`, which is a *separate* phase that affects every module that uses the ensure helpers — not just `dashboard_data.js`. Doing it as part of a dashboard pass would conflate scopes.

**Status: Decision Pending.** The implementer for the §5 step 2 phase will pick this up when its time comes. For dashboard seams, ensure-\* helpers are left untouched.

### 8.3 `buildDashboardSnapshot_()` deferred to last among read passes?

**Recommendation: yes.** Per §6 Step E, `buildDashboardSnapshot_` migrates last among the read entries — after `getDebtPaymentBreakdownForDashboard` (Step A), the four history readers (Step B), `buildInputBillPlannerPaymentWindows_` (Step C), and the two ensure-backed reads (Step D) have all proven the pattern. By that point, every helper the snapshot calls has already been exercised through the resolver, and the snapshot's own seam is the last remaining outer-wrapper migration in `dashboard_data.js`.

**Status: Decision Pending.** A future prompt may override this if a Phase 6+ migration (PropertiesService / openById) is imminent and the snapshot needs to be the first thing exercising the new resolver body. In that case, the order in §6 collapses.

### 8.4 Dashboard facade needed?

**Recommendation: no, not now.** Per §5.3, a dashboard-specific facade would conflate workbook-identity resolution with dashboard-specific concerns. The seam is designed to be identity-only. Revisit only if Phase 6+ introduces a dashboard-specific concern that genuinely belongs at the resolver layer (caching, batched reads, request-scoped memoization) — and even then, the right place for that is a separate helper *next to* `getUserSpreadsheet_()`, not inside it.

**Status: Decision Pending, no action expected in any dashboard seam phase.**

---

## 9. Recommended next dashboard seam

**`getDebtPaymentBreakdownForDashboard()` at `dashboard_data.js:1235`.**

Rationale, summarized:

- **Public-entry boundary** (`ForDashboard` suffix). Matches the Phase 1–3 precedent.
- **Read-only.** No `setValue`, no `appendRow`, no sheet creation.
- **No ensure-\* helper called.** Avoids the ensure-helper-interaction question entirely.
- **Single downstream `ss` consumer.** `readSheetAsObjects_(ss, 'DEBTS')` is the only helper that consumes `ss`. Strong uniform-`ss` flow.
- **Bounded user-visible surface.** Bills Due tab's debt-payment breakdown card (payNow / paySoon). A regression is bounded to one card.
- **One-line reversibility.** Identical to Phases 1–3.
- **No new Decision Pending item.** Test harness, mapping storage, onboarding UI, version markers, entitlement model — all stay deferred.

**Deferred dashboard seams (in order of when they should run after the recommended first):**

1. The four internal history readers (`getLatestHistorySnapshots_`, `getAllHistorySnapshotRows_`, `getPlannerHistoryMetricsByOffset_`, `getPriorMonthPlannerHistoryMetrics_`).
2. `buildInputBillPlannerPaymentWindows_` (internal planner-email helper).
3. `getRecurringBillsWithoutDueDateForDashboard` (ensure-backed public entry).
4. `getBillsDueFromCashFlowForDashboard` (ensure-backed public entry, two ensure-\* calls).
5. `buildDashboardSnapshot_` (the canonical dashboard entry — last among reads).
6. `skipDashboardBill` (write entry — defers to the write-path phase, not part of any dashboard read phase).

**Risk level:** **Low** for the recommended next dashboard seam (`getDebtPaymentBreakdownForDashboard`). Materially equivalent to Phase 3's `getDebtPayoffReadData`. The dashboard module as a whole is high-risk because of `buildDashboardSnapshot_`'s blast radius — but the recommended *first* seam in the module is one of the lowest-risk reads available.

---

## 10. Closing notes

This document does **not** authorize implementation. Phase 4 (the first dashboard seam) requires its own per-phase design doc (`CENTRAL_APP_FOURTH_RESOLVER_SEAM.md` or equivalent, mirroring the shape of `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` / `CENTRAL_APP_THIRD_RESOLVER_SEAM.md`) and its own implementation prompt with explicit user approval, per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9`.

When that prompt eventually arrives, it should:

- name `getDebtPaymentBreakdownForDashboard` at `dashboard_data.js:1235` as the target (or override with a written reason),
- migrate exactly one line,
- run the §7 checklist before and after,
- update the audit banner (4 migrated / 131 remaining),
- update `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 1` annotation,
- add a Current State bullet to `SESSION_NOTES.md`.

Until then, the dashboard module remains entirely on the platform call. The resolver continues to be a one-line pass-through. No central mode, no `PropertiesService`, no `openById`, no identity helper, no user mapping, no deployment change.

---

## 11. Phase 4 outcome (retroactive)

This section records the actual Phase 4 shipment to keep the analysis honest about what landed and what was tested.

### What shipped

- **Commit:** `99bcf37`.
- **Migrated function:** `getDebtPaymentBreakdownForDashboard()`.
- **File / line:** `dashboard_data.js:1235`.
- **Change:** `const ss = SpreadsheetApp.getActiveSpreadsheet();` → `const ss = getUserSpreadsheet_();`. Single line, one-line reversible.
- **Resolver body:** unchanged. Still the one-line pass-through that returns `SpreadsheetApp.getActiveSpreadsheet()`.

### What did not ship (intentional)

- **No ensure-\* helper migration.** `ensureActivityLogSheet_` and `ensureCashFlowYearSheet_` still call `SpreadsheetApp.getActiveSpreadsheet()` directly inside their own bodies; routing them through the resolver is `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2` and remains deferred.
- **No `buildDashboardSnapshot_()` migration.** The canonical dashboard entry at `dashboard_data.js:73` still calls `SpreadsheetApp.getActiveSpreadsheet()` directly. Per §6 Step E it migrates last among the read entries, after Steps B / C / D have proven the pattern.
- **No write-path migration.** `skipDashboardBill` (§2.10) was not touched.
- **No other `dashboard_data.js` migration.** Lines 73, 273, 374, 578, 618, 1339, 1406, 2023, and 2369 all still call the platform directly.
- **No central-mode behavior.** No `PropertiesService`, no `openById`, no identity helper, no user mapping, no `Session.getActiveUser()` plumbing.
- **No deployment / `appsscript.json` / HTML / schema / Activity event change.**

### Runtime validation outcome

- **Bills Due surface stable.** The payNow / paySoon debt-payment breakdown card rendered the same rows in the same order against the bound developer workbook. No banner. No regression.
- **Overview load remained stable on subsequent reloads.** Overview KPIs (Cash, Investments, House Equity, Total Debt, Net Worth, the four weekly-delta arrows, buffer runway, financial health score, suggested actions, issues list) all matched the pre-change baseline. `Usable cash after buffers` unchanged (Phase 1 invariant preserved). Cash Flow → Quick Add payee dropdown unchanged (Phase 2 invariant preserved). Debt Overview unchanged (Phase 3 invariant preserved).
- **No new Activity rows from reads.** `LOG - Activity` row count unchanged after the dashboard load. The §7 critical post-pass invariant ("no `quick_pay`, `bill_skip`, `bank_import_*`, or `donation` rows written by the read pass") held.
- **No deployment change.** `appsscript.json` not touched. Deployment posture remains `executeAs: USER_DEPLOYING`, `access: MYSELF`.

### Slowdown investigation outcome

Immediately after the implementation pass, the Overview rendered an extended empty-placeholder state on the first reload and then filled in normally. This was investigated as a possible regression with the following findings:

- **`getDebtPaymentBreakdownForDashboard()` is not invoked during the initial Overview load.** The initial Overview load fires `google.script.run.getDashboardSnapshot()` from `Dashboard_Script_Render.html:693`, which dispatches to `getDashboardSnapshot()` → `buildDashboardSnapshot_()` at `dashboard_data.js:72`. `buildDashboardSnapshot_()` does **not** call `getDebtPaymentBreakdownForDashboard()` anywhere in its body, and no helper it transitively calls does either. The function's only caller is `getUpcomingBillsDueForDashboard()` (line 1294), which itself is not invoked from any HTML client or any other server `.js`.
- **One extra pass-through call cannot account for the observed delay.** `getUserSpreadsheet_()` is a one-line wrapper around `SpreadsheetApp.getActiveSpreadsheet()`. Adding one V8 stack frame is sub-microsecond. Even if the function had been on the Overview load path, the body change at line 1235 cannot produce a multi-second empty-state.
- **Likely root cause: Apps Script web-app cold start / transient platform latency.** First load after a deploy or extended idle triggers a fresh V8 isolate, OAuth scope handshake, and Spreadsheet open — routinely 5–15 s, with the dashboard sitting on the empty placeholder until the single `getDashboardSnapshot()` round-trip completes. Subsequent reloads were normal speed.
- **Recommendation honored: commit (not revert).** The Phase 4 line was left in place and committed in `99bcf37`. No additional patches, no broadening of scope, no other function touched.

### Counts after Phase 4

- **Migrated production call sites:** 4 (Phase 1 `cash_to_use.js:77`, Phase 2 `quick_add_payment.js:35`, Phase 3 `debt_payoff_projection.js:17`, Phase 4 `dashboard_data.js:1235`).
- **Remaining production call sites:** 131 across 26 modules (was 132 before Phase 4).
- **`dashboard_data.js` residual call sites:** 9 (was 10). The seven read entries listed in §6 Steps B–E remain, plus the two ensure-backed reads (§2.7, §2.8) and the one write entry (§2.10).
- **Fully resolver-routed production modules:** still **1** (`debt_payoff_projection.js`, achieved in Phase 3). `dashboard_data.js` is not yet a fully resolver-routed module — 9 platform calls remain in the file.

### Architectural boundaries reaffirmed

- The resolver remains a **one-line pass-through** to `SpreadsheetApp.getActiveSpreadsheet()`. Body unchanged since Phase 1 (`b2798a7`).
- **No central mode** in any phase yet. The migration is exclusively about routing call sites through one abstraction, not about resolving identity to a workbook.
- **No `PropertiesService`, no `openById`, no identity helper, no user mapping, no deployment change** anywhere in the migration to date.
- **No write-path migrations yet.** `skipDashboardBill` and every other write entry across the codebase stay on the platform call until the §5 step 4 / step 5 phases.
- **Ensure-\* helpers stay intentionally deferred.** `ensureActivityLogSheet_`, `ensureCashFlowYearSheet_`, and the various `ensureOnboarding…` helpers are out of scope for any dashboard seam pass; they migrate together in `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 step 2`.

---

End of document.
