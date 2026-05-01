# ENHANCEMENTS

Durable product/engineering backlog for the financial planning system. Grounded in the current architecture (Sheets → Apps Script → React bundle) and the Rolling Debt Payoff UX as it ships today. Intended to be consumed one item at a time.

---

## 0. Current phase — V1.2 / controlled improvement mode (V1.1 closed out)

V1.1 is closed. See `SESSION_NOTES.md → V1 trust baseline — complete` and `SESSION_NOTES.md → V1.1 — Retirement Profile Integration (DOB Source of Truth)` for the phase-history summaries, `PROJECT_CONTEXT.md → Current phase` for the product framing, and `WORKING_RULES.md → Current phase` for the rules every V1.2 change runs under (identical rules to V1.1).

Scope for this phase:

- **In scope (V1.2):** small, localized polish that preserves existing populated-workbook behavior, and only after passing the blank + populated two-track manual checks in `TESTING_PLAN.md`. Candidates are pulled one at a time from `TODO.md → V1.2 work queue → V1.2 candidates`.
- **Out of scope for V1.2 unless explicitly approved:** large refactors (Queued — post Next Actions stabilization, full `dashboard_data.js` split, onboarding factory refactor, broader regression/test harness), any change to `doGet` / `includeHtml_` / snapshot shape, destructive sheet changes, and any item listed under `TODO.md → Later (post-V1.2 / future phase)`.

Items below that are fully delivered still carry their original "DELIVERED" tag so the rationale and history stay visible; they are not re-opened. Items tagged "DELIVERED" under a phase (1, 2, 3, …) are phase history, not V1.2 work.

### Active / Next / Later at a glance

Authoritative live queue lives in `TODO.md → V1.2 work queue`. Mirror here is short on purpose:

- **Active now:** *(none in flight — Bank Import Step 2a is queued; see `TODO.md → Bank Import — status & resume plan`)*
- **V1.2 candidates (A — immediate follow-ups, low risk):** Profile DOB parser symmetry (accept Date objects on save-side validation), Overview Retirement Outlook copy alignment with `needsProfileDob`, blank-workbook empty-state consistency sweep, copy/Help polish sweep.
- **V1.2 candidates (B — product improvements):** Profile completeness indicator / badge, better Retirement setup guidance / linking to Profile, optional spouse UX clarity (single vs partnered).
- **V1.2 candidates (C — future ideas, do not act yet):** legacy sheet cleanup tool (remove inert `Your Current Age` / `Spouse Current Age` rows on existing `INPUT - Retirement` sheets), Profile → other modules integration, notifications / SMS using the existing Profile phone field.
- **Deferred from V1.1 (re-qualify before pulling):** planner email guardrails telemetry (informational only), low-risk codebase cleanups, dead-code prune for the retirement profile integration (`readRetirementHouseholdSafe_`, `getRetirementHouseholdInputs_`, `writeRetirementHouseholdInputs_`, `saveRetirementBasics` stub).
- **Later (post-V1.2 / future phase):** onboarding factory refactor, Activity smart-undo Phases 2–4, Cash Strategy, HELOC advisor refinement, Plaid-style sync, broader regression / test harness, two-dashboards unification, and the other big-product items captured below and in `TODO.md → Historical backlog`.

### Delivered — retirement profile integration (V1.1 close-out)

Shipped end-to-end in V1.1 (commits `92c8673` → `6d25c0e`). **Profile is now the single source of truth for Date of Birth.** Full phase summary in `SESSION_NOTES.md → V1.1 — Retirement Profile Integration (DOB Source of Truth)`. Headlines:

- **Profile** gained **Date of Birth** plus a full spouse/partner block (`Spouse Name / Email / Phone / Address / Date of Birth`) in the flat `INPUT - Settings` store. Existing required fields (`Name`, `Email`) unchanged; all new fields optional.
- **Retirement** derives current age exclusively from Profile DOB. The Retirement Basics edit form is removed; per-scenario age fields are display-only (plain divs, no spinner arrows). A new `needsProfileDob` readiness state routes users to **Open Profile** when DOB is missing. The DOB parser accepts both Date objects and `YYYY-MM-DD` strings, fixing the silent Sheets-auto-date coercion bug. New `INPUT - Retirement` sheets no longer seed the now-unused age rows.
- **Backward compatibility preserved** — populated workbooks are untouched byte-for-byte. Legacy age rows on existing retirement sheets are left inert (no read, no write, no planner consumption). No forced migration.

### Delivered — Bank Import Step 1 scaffold (V1.2 prep)

**Bank Import — Step 1 Complete.** Scaffold shipped in commit `8ced838`. New file `bank_import.js` with three inert ensure helpers:

- `ensureImportStagingBankAccountsSheet_()` creates `SYS - Import Staging — Bank Accounts` with the 13-column staging header (bold, frozen), no data rows.
- `ensureImportIgnoredBankAccountsSheet_()` creates `SYS - Import Ignored — Bank Accounts` with the 7-column ignore registry (bold, frozen), no data rows.
- `ensureAccountsExternalIdColumn_(accountsSheet)` appends the `External Account Id` column to `SYS - Accounts` flush to the last non-empty header cell. Never reorders existing columns. Never writes to data rows.

What Step 1 explicitly **did not** ship: no ingestion logic, no UI, no planner impact. Existing modules do not call any of these helpers, so planner, overview, retirement, cash flow, and the manual bank account UI are unaffected on both populated and blank workbooks. Full scope, Step 2a plan, resume rules, and manual test checklist (A–E) live in `TODO.md → Bank Import — status & resume plan`.

### Delivered — Debts fast save + activity log + background planner (V1.2)

**Debts — Update field editing feels instant again.** Shipped in commit `c26c11c`. Planning → Debts → Update now shows a proper `Saving… → Saved.` status row, optimistically repaints the right-hand info panel with the saved value so users see the change without a server round-trip, refreshes the Overview snapshot (`refreshSnapshot()`), and fires `runPlannerAndRefreshDashboard()` as a **silent background RPC** so Rolling Debt Payoff and other planner-dependent cards catch up shortly after without blocking the save itself.

The previous behavior ran the debt planner inline inside `updateDebtField`, which held the UI on `Saving…` for several seconds on large workbooks. That inline call is gone; the planner now runs only after the save completes, off the critical path.

Every field edit is also written to `LOG - Activity` as a new **`debt_update`** event:

- Classified as **Debt** kind (`activity_log.js::classifyActivityKind_`).
- Dynamic action label from `debtUpdateActionLabel_()` — e.g. *Updated Account Balance to $54,000.00*, *Updated Int Rate to 7.50%*, *Updated Due Day to 15*, *Updated Credit Limit to $25,000.00*.
- **Amount** renders `—` instead of `$0.00` (added to `activityLogIsNonMonetaryEvent_`) so field edits don’t double-count against Activity totals.
- Previous + new raw + display values and the `fieldKind` (currency / percent / integer / text) are preserved in the event’s `details` JSON (`detailsVersion: 1`) for future undo tooling — no second lookup needed when a revert action is built later.

User-facing Help was also updated: `Dashboard_Help.html` → *Planning → Debts → Update* (new flow description), Activity log (`debt_update` event), Amount column description (non-monetary list), and Remove button greyed-out list.

### Delivered — Quick Add robust Saving… indicator + $0 amount allowed (V1.2)

**Quick Add — reliable click→Saving…→Saved feedback, and $0 is now a legitimate amount.** Shipped in commits `098fef0` → `29f29a2`.

Client-side (`Dashboard_Script_Payments.html::savePayment()`): the status row below **Add to Cash Flow** now layers plain-text `setStatus('pay_status', 'Saving…', false)` under `setStatusLoading(…)`. This mirrors the proven pattern from the legacy sidebar `PlannerDashboard.html::savePayment()` and ensures the label appears between click and `Saved to Cash Flow.` regardless of deploy timing or CSS state drift. On success, the status flips to the backend-supplied *Saved to Cash Flow.* message.

Server-side (`quick_add_payment.js::quickAddPayment`): amount validator relaxed from `amount <= 0` to `isNaN(amount) || amount < 0`, with new error message *Amount must be a valid number.* `Math.abs()` already coerces the stored value, so the negative branch is defensive only. Users can now save $0 on Quick add to:

- Zero out a month cell (e.g. reset a budget line).
- Correct a prior bad entry down to 0.
- Seed a placeholder payee row so it shows up in Bills Due / Upcoming selectors before the first real payment lands.

Scope discipline: Upcoming Expenses (`upcoming_expenses.js:193`), Income Sources (`income_sources.js:382`), and the Purchase Simulator (`purchase_simulator.js:29`) still require `amount > 0`. Those are different forms with different semantics and were intentionally left alone.

Help updated: `Dashboard_Help.html` → Cash Flow → Quick add now documents `$0` is a valid amount and describes the Saving… → Saved status feedback.

### Delivered — Asset save sync: stop hanging on every save (V1.2)

**Investment / Bank Account / House Value saves no longer hold the UI on `Saving…` for tens of seconds.** Uncommitted at the time of writing; sibling commits `f13d928` (asset activity logs + fast save) and `6c0953d` (collapse repeat reads + Saving label) shipped earlier in the session and removed the inline planner run from these saves, but a deeper bottleneck remained.

Root cause: after a value write, the save still called `syncAllAssetsFromLatestCurrentYear_()` (and the matching `syncAllAccountsFromLatestCurrentYear_()` / `syncAllHouseAssetsFromLatestCurrentYear_()`) to mirror the latest current-year value into SYS. That sync was doing two slow things on every save:

1. **`getLatest*ValuesForYear_` made ~4 Sheets API round-trips per row** in the year block (per-row display lookup + `getLatestNonEmptyMonthColumnForRow_`'s header read + value-row read + matched-cell read). On a workbook with ~15–20 investments that's 60–80 round-trips at 200–800 ms each.
2. **The SYS write loops re-wrote every row** through the format-preserving `setCurrencyCellPreserveRowFormat_`, even when the value hadn't changed. Two to three more round-trips per row.

Fix in `investments.js`, `bank_accounts.js`, `house_values.js`:

- **Batched read.** Each `getLatest*ValuesForYear_` now does **2 round-trips total** — one full-sheet `getDisplayValues()` (also reused for `getXxxYearBlock_` via the existing optional `display` parameter) and one batched `getRange(dataStartRow, 1, numRows, lastCol).getValues()`. The "find latest non-empty month for this row" loop is now pure in-memory work using `parseMonthHeader_` against the already-loaded header row.
- **Skip-if-unchanged.** The `syncAll*FromLatestCurrentYear_` write loops now compare the new value against the existing `targetRaw[r][balanceColZero]` (rounded to 2dp on both sides to avoid floating-point noise) and **skip the format-preserving write when unchanged**. In the common case where the user only changed one account, this collapses N writes to 1.
- **Header-map reuse.** The sync functions now pass the already-loaded display to `getAccountsHeaderMap_` / `getAssetsHeaderMap_` / `getHouseAssetsHeaderMap_` instead of letting them re-read the header row.

Behavior preservation: same latest-value math, same writes when something actually changed, same activity logging (`bank_account_update` / `investment_update` / `house_value_update`), planner still runs in the background as a silent RPC. The only observable difference is that `Saved.` arrives in a second or two on populated workbooks where it used to take tens of seconds. Bank Account and House Value saves benefit from the same fix as defense-in-depth even though only Investments was reported.

### Delivered — Asset updates: activity log + fast save without waiting on planner (V1.2)

**Bank Account, House Value, and Investment balance updates now feel instant and produce an audit row.** Shipped in commit `f13d928`.

Two issues fixed in one pass:

1. **No activity log entry.** Manual balance updates on Assets → Bank Accounts / House Values / Investments wrote to the canonical sheet (`INPUT - Bank Accounts` / `INPUT - House Values` / `INPUT - Investments`) and mirrored into SYS, but produced no `LOG - Activity` row. New events: `bank_account_update` / `house_value_update` / `investment_update`. Classified as **Bank** / **House Expenses** / **Investment** kind respectively. Action label includes the month and new balance (e.g. *Updated May-26 balance to $1,234.56*). **Amount** renders `—` (added to `activityLogIsNonMonetaryEvent_`) so balance updates don't double-count against Activity totals; previous + new raw values are preserved in the event's `details` JSON for future undo tooling.

2. **UI hung waiting for the planner.** `updateBankAccountValueByDate` / `updateHouseValueByDate` / `updateInvestmentValueByDate` previously ran `runDebtPlanner()` inline before returning, holding the UI on `Saving…` for several seconds on populated workbooks. The inline call is gone. Client-side save handlers in `Dashboard_Script_AssetsBankInvestments.html` and `Dashboard_Script_AssetsHouseValues.html` now call `runPlannerAndRefreshDashboard()` as a **silent background RPC** after the save returns, so Rolling Debt Payoff and Overview snapshot still catch up shortly after — just without blocking the save.

Help updated: `Dashboard_Help.html` → Bank Accounts, House Values, Investments (status feedback paragraph + activity log entries) and the Activity log Bank / House / Investment list (`bank_account_update`, `house_value_update`, `investment_update` event descriptions, Remove-button greyed-out list).

### Delivered — Asset pages: collapse repeat sheet reads + show "Saving…" instead of "Loading…" (V1.2)

**Page loads, dropdown selection RPCs, and the post-save status flip on Bank Accounts / Investments / House Values / Debts are noticeably snappier and the `Saved.` message no longer gets clobbered.** Shipped in commit `6c0953d`.

Two related fixes in one pass:

1. **Performance — collapse repeat sheet reads.** The page-load RPCs (`getBankAccountUiData` / `getInvestmentUiData` / `getHouseUiData` / `getDebtsUiData`) and the per-selection field RPCs each made 2–4 full-sheet `getDataRange().getValues()` / `getDisplayValues()` calls — one for Type options, one for the inactive set, one for the header map, etc. Each read is a 300–800 ms round-trip on populated workbooks. Consolidated to a single `getDisplayValues()` per RPC and threaded into helpers via new **optional `display` / `headers` parameters** so older callers stay byte-for-byte compatible. The block helpers (`getBankAccountsYearBlock_` / `getHouseValuesYearBlock_` / `getInvestmentsYearBlock_`) and header-map helpers (`getAccountsHeaderMap_` / `getHouseAssetsHeaderMap_` / `getAssetsHeaderMap_` / `getDebtsHeaderMap_`) all gained the optional pre-loaded array parameter. The row-finder helpers (`findBankAccountRowInBlock_` / `findHouseRowInBlock_` / `findInvestmentRowInBlock_`) replaced their per-row `getRange(row, col).getDisplayValue()` loops with single batched range reads of column A across the block.

2. **UX — "Saving…" stays "Saving…".** After the asset fast-save fix landed, the post-save quiet refresh would re-trigger `setStatusLoading()` inside the load helpers and overwrite the `Saved.` message with the default `Loading…` label. Two-part fix: save handlers (`saveBank`, `saveInvestment`, `saveHouse`) now pass an explicit `'Saving…'` label to `setStatusLoading()`, and `loadBankData / loadHouseData / loadInvestmentData` accept a new `quiet` parameter (default `false`) that skips both the leading `setStatusLoading()` and the trailing `setStatus('', false)` so the `Saved.` message survives the post-save refresh.

### Delivered — Quick Add: instant Activity ledger refresh + background planner (V1.2)

**Quick Add payments now show up on the Activity tab immediately instead of after the full planner run.** Shipped in commit `d743458`.

`Dashboard_Script_Payments.html::savePayment()` success handler now calls `loadActivitySection()` immediately so the new `quick_pay` row appears on the Activity tab without waiting for the planner, and the planner is fired as a silent background RPC (`runPlannerAndRefreshDashboard()`) — same pattern as the Debts save from `c26c11c`. The previous flow held the UI on the success state for several seconds while the planner ran inline before the Activity tab reflected the new row.

### Delivered — Quick Add: Bill Pay prefill race + explicit Other payee option (V1.2)

**Two related Quick Add fixes.** Shipped in commit `1305c40`.

1. **Bill Pay prefill race.** Launching Quick Add from a bill on a cold tab (Bills → Pay) failed to populate the **Existing Payee** dropdown because `prefillQuickPayment` ran synchronously before `paymentPayees` finished loading. The typed payee input had the right value, but the dropdown was blank. Fix stashes the wanted payee in `window.__pendingQuickAddPayee` and applies it via a new `consumePendingQuickAddPayeePrefill_()` helper called from `loadPaymentSection`'s success handler — *after* the dropdown is populated. A guard checks the typed input first, so a user edit is never overwritten.

2. **Explicit "Other (type new payee)" option.** Previously the only way to add a payee that wasn't in the dropdown was to ignore the dropdown and type into the free-text input below it — which felt invisible to new users. Added a sentinel option (`QUICK_ADD_PAYEE_OTHER_SENTINEL_ = '__OTHER__'`) at the bottom of the Existing Payee dropdown labeled **Other (type new payee)**. `syncPaymentPayeeInput()` clears + focuses the typed input when the sentinel is selected; `currentPaymentPayee()` treats the sentinel as no-selection so the typed value wins.

Help updated: `Dashboard_Help.html` → Cash Flow → Quick add documents the Other payee option and the bill-pay prefill behavior.

### Delivered — Bank Import: Step 2a ingestion pipeline (V1.2)

**First server-side ingestion built on the Step 1 scaffold.** Shipped in commit `03d2c4a`. Continues the multi-step Bank Import plan documented in `TODO.md → Bank Import — status & resume plan`.

`processBankImportBatch_(payload)` handles, in order:

- **Ignored check (permanent only).** If the incoming row matches a row in `SYS - Import Ignored — Bank Accounts` by exact non-blank `External Account Id` (or by composite `institution + displayName + last4` when external id is blank), the row is dropped and a `bank_import_ignored_hit` event is logged. Blank or unknown `Scope` is treated as `permanent` — `until_changed` logic is intentionally **not** implemented yet even though the column exists for future compatibility.
- **Exact-id auto-match.** Auto-match only when **all** of: incoming `externalAccountId` is non-empty; exactly one active `SYS - Accounts` row has matching `External Account Id`; currency is exactly `USD`; incoming type does not conflict with a non-blank existing type. On match: write the balance through the existing proven bank-account history/update path, sync current balances through the existing sync path, log `bank_import_auto_matched` with the balance fingerprint as `dedupeKey`, leave **Available Now / Min Buffer / Use Policy / Priority / Active** untouched. Per-row `runDebtPlanner` is intentionally **not** called from auto-match — left to the user's manual Run Planner trigger.
- **Pending staging.** Everything not ignored or auto-matched lands in `SYS - Import Staging — Bank Accounts` with `Status = pending` and a Pending Reason from the fixed enum (`no_exact_id_match`, `currency_mismatch`, `type_conflict`, `inactive_match`, `ambiguous_external_id`, `stale_balance`). Stable `Staging Id` keyed from `externalAccountId` + `YYYY-MM(balanceAsOf)` allows upserts (insert if new, update `Last Seen` + latest payload fields if pending row already exists — no duplicate pending rows).
- **Balance fingerprint dedupe.** Fingerprint is `externalAccountId + YYYY-MM(balanceAsOf) + balance + balanceAsOf`. If the same fingerprint already exists in recent `LOG - Activity` for `bank_import_auto_matched`, do nothing — no extra log row, no extra writes.

Strict deviations from the approved Step 2a checklist, recorded for the resume plan:

1. **Currency must be exactly `USD` for auto-match.** A blank `currency` is treated as `currency_mismatch` and routed to pending, per the literal interpretation of the requirement.
2. **Stale-balance threshold defined as 90 days (or any future date).** New constant `BANK_IMPORT_STALE_BALANCE_DAYS = 90`. Future-dated `balanceAsOf` is always stale.
3. **Per-row `runDebtPlanner` is deliberately not called from auto-match.** The underlying helper functions are called directly to keep batch runs fast; the planner run is left to the user's manual trigger.

Dev/test harness only — no UI, no external sync, no menu, no dashboard button. `_devRunBankImportSample()` runs a representative payload; `_devRunBankImportCustom_(payload)` accepts arbitrary input. Pending rows live only in the staging sheet, which no existing module reads, so planner / overview / cash flow / retirement / debts are all unaffected on both populated and blank workbooks.

### Delivered — Planner email: handled-this-month check now uses each debt's next-due month (V1.2)

**Loan payments due in the next calendar month no longer drop out of the Debt Planner email's *Pay now* / *Pay soon* sections.** Shipped in commit `bae82c9`.

Symptom (reproduced on a workbook with mortgage payments due May 1 while the email ran on April 24): generic recurring bills appeared in *Pay now* / *Pay soon* but loan payments did not — every loan payment was silently filtered out.

Root cause in `runDebtPlanner.js::buildUpcomingPayments_`: the function checked whether each debt was "handled this month" against the current calendar month's Cash Flow cell, even when the payment's `nextDueDate` fell in a different month. If the user had already paid April for a debt whose May payment was now in the upcoming window, the May payment was incorrectly filtered out as "handled".

Fix:

- `buildDebtMinimumHandledMap_` rewritten to return a **month-keyed nested map** (`{ monthHeader → { debtKey → handledFlag } }`) so the planner can check handled status per month, not just for the current month.
- `isDebtMinimumHandledThisMonth_` signature widened to accept a `monthHeader` parameter that selects which month's handled map to consult.
- `buildUpcomingPayments_` now computes `dueDate` and resolves the correct `dueMonthHeader` (via `getMonthHeaderForDate_`, with a new `getNextMonthHeader_` helper) for each upcoming payment before checking handled status.
- `runDebtPlanner` passes `[currentMonthHeader, nextMonthHeader]` to `buildDebtMinimumHandledMap_` so both months are pre-built; the bills (non-debt) path was already correct and is unchanged.

Edge cases verified: same-month payments still filter the same way; debts whose `nextDueDate` is more than 1 month out still resolve to the right month header (the helper map lookups gracefully return "not handled" for months that weren't pre-built, which is the correct conservative answer for the email).

### Delivered — Bills Due inactive filter fix (V1.2)

**Bills Due — inactive debts and inactive Cash Flow rows no longer leak into the recurring fallback.** Shipped in commit `9bf3234`.

Symptom: the **Recurring Bills (No Due Date)** section on the Bills Due page was surfacing debts that had been marked `Active = No` in `INPUT - Debts` (reproduced with *Laith VCS Account*). The Cash Flow row for the same payee also had `Active = NO` but was still being promoted into the fallback list.

Root cause in `dashboard_data.js::getRecurringBillsWithoutDueDateForDashboard()`:

- The function excluded payees only via `getInputBillsPayeeMap_` (INPUT - Bills, active-only) and `getDebtPayeeMap_` (INPUT - Debts, active-only).
- It never read the Cash Flow row's own `Active` column.
- Deactivating a debt therefore *removed* it from `debtBills`, and the still-present Cash Flow row fell through the guards and got pushed into the fallback list as if it were an unmapped recurring expense.

Fix — two bounded guards inside the existing loop plus one new sibling helper:

1. **Cash Flow `Active = No` guard.** Explicit `no / n / false / inactive` (case-insensitive) on the Cash Flow row short-circuits the iteration. Blank is still treated as active — that matches the documented convention on `getCashFlowHeaderMap_` and every other consumer of this column.
2. **Debt name-reservation across all statuses.** New helper `getDebtPayeeMapAllStatuses_(ss)` returns all payee names in `INPUT - Debts` regardless of Active. Used only as a fallback exclusion set — it does *not* affect planner math, totals, or the Debts list's own active/inactive filtering (those still use `isDebtSheetRowInactive_`).

Scope discipline: `dashboard_data.js` only. `getRecurringBillsWithoutDueDateForDashboard` has a single caller in the entire codebase — `Dashboard_Script_BillsDue.html:324` — so blast radius is strictly the "Recurring Bills (No Due Date)" section on Bills Due. Planner, Overview snapshot, Retirement, credit-card totals, Debts list, Bills Due (Next 7 / Overdue), Upcoming Expenses, and the email path are untouched.

Edge cases verified:

- **Legacy workbook without `Active` on Cash Flow** — `activeColZero === -1`, active-check block is skipped entirely, behavior matches pre-fix.
- **Blank `Active` cell** — still treated as active. No regressions for the common case.
- **Reactivated debt** — as soon as `INPUT - Debts` flips back to `Active = Yes`, the payee moves from the all-statuses name-reservation set into the normal active `debtBills` set. Either way it stays out of the fallback, and a valid Due Day resurfaces it in the proper Debts Due area.
- **Blank workbook** — `getDebtPayeeMapAllStatuses_` returns `{}` when the sheet is missing or empty, same pattern as the active-only sibling.

No Help or documentation changes required for this fix — the "Recurring Bills (No Due Date)" section is not separately called out in Help; the user-visible behavior now simply matches Help's existing Bills Due description (active items only).

---

## Future direction — Central App (post-V1.2, not active work)

Long-term architecture target. **Documented for durability — not on the V1.2 roadmap.** Pulling this in requires an explicit product decision and the migration discipline laid out in `WORKING_RULES.md → Central App Transition Rules`. Mirror of `PROJECT_CONTEXT.md → Future architecture — Central App (post-V1.2)`.

### Central App Model

- Move from a per-copy distribution to **one centralized Apps Script web app** that all users share.
- Users access the app via a single deployment URL — no code copying, no script editor, no manual updates.
- Each user gets their **own spreadsheet**, automatically created and bound to their identity on first run.
- A single deployed script version drives every user's experience, so a fix shipped once reaches everyone immediately.

### Core change

- Replace direct `SpreadsheetApp.getActiveSpreadsheet()` usage across all backend modules with a single resolver: **`getUserSpreadsheet_()`**.
- `getUserSpreadsheet_()` resolves the caller's identity (typically `Session.getEffectiveUser().getEmail()`), looks up their workbook, and returns the bound `Spreadsheet` object.
- **Bootstrap on first run** — when a new user has no mapping, create a fresh workbook from a known-good template (or seed structure), record the mapping, and continue normally.
- **User → sheet mapping** — stored in `PropertiesService.getUserProperties()` (per-user, lightweight) or a central registry sheet (e.g. `SYS - User Workbooks` in an admin spreadsheet); the choice is part of the migration design pass.

### Benefits

- **Instant updates for all users** — script version is the source of truth; no version drift across copies.
- **No version drift / no copy-paste deploys** — every user is on the same code at the same time.
- **Easier support and debugging** — a single canonical code path; user-specific issues isolate to data, not code.
- **Foundation for monetization** — the user mapping registry is the natural anchor for plan / entitlement records (see *Future direction — Monetization* below).

### Why this is documented now and not started

- Active phase is V1.2 (controlled improvement mode). Architectural changes of this magnitude are explicitly out of scope per `WORKING_RULES.md → Current phase`.
- This change touches `getActiveSpreadsheet()` call sites across nearly every backend module (planner, dashboard, debts, bills, accounts, retirement, activity log, bank import, etc.). It must be staged module by module behind the single resolver, not done in one pass.

---

## Future direction — Monetization (post-V1.2, not active work)

Captured so the long-term plan is durable and aligned with the Central App migration. **Not on the V1.2 roadmap.** Mirror lives in `TODO.md → Future Phases — VNext Monetization`.

### Monetization model

- **Free + paid tiers.** Core financial planning functionality stays free; paid tiers unlock advanced / higher-cost features.
- **Feature gating inside code** — gating decisions live next to the feature implementation, not in a separate authorization layer.
- Per `WORKING_RULES.md → Monetization Rules`, gating must never block core functionality and must always fail gracefully (no crashes if plan lookup fails or the user record is missing).

### Minimal implementation

- **New sheet: `SYS - Users`** with columns: `Email | Plan | CreatedAt`.
  - `Email` — canonical user identifier (matches the same identity resolver used by `getUserSpreadsheet_()`).
  - `Plan` — short string (e.g. `free`, `paid`, `trial`); free is default and assumed when missing.
  - `CreatedAt` — first-seen timestamp; useful for trial-window calculations later.
- This sheet pairs naturally with the Central App user mapping; it can live alongside `SYS - User Workbooks` in the same admin spreadsheet, or in a per-user sheet when bound mode is still in use.

### Code helpers

- **`getUserPlan_(email)`** — returns the plan string for the given email; returns `'free'` when no record exists.
- **`isPaidUser_()`** — convenience boolean built on top of `getUserPlan_()`. Wraps the plan check so call sites stay short and readable.
- Both helpers must be defensive: any error reading `SYS - Users` returns the free / unblocked default, never an exception that would break a feature for an existing free-tier user.

### Initial gated features (candidates only)

These are **candidates**, not commitments. Final gating decisions happen when the work is pulled in.

- **Bank import / sync** (the in-flight Bank Import work) — natural first paid feature; advanced data ingestion fits the paid tier shape.
- **Advanced planner features** — e.g. multi-scenario retirement, advanced rolling debt payoff strategies, premium reports.
- **Usage limits** — per-day / per-month caps on heavy operations (planner runs, sync refreshes) for the free tier.

### Why this is documented now and not started

- Same reason as Central App — this is post-V1.2 work and explicitly out of scope under current `WORKING_RULES.md → Current phase` rules.
- Monetization is meaningful only after Central App migration; gating per-copy installs is not enforceable. Sequencing: **Central App migration → minimal `SYS - Users` schema → first gated feature** (in that order).

---

## 1. Current product state

What is working well right now:

- **Rolling Debt Payoff is the main monthly decision tool.** It tells the user what to do *this month* with a single input (Cash to use now) and a single output (per-account payments + HELOC recommendation).
- **Standard vs Details split is intentional and holding.** Standard surface is four compact blocks (cash input, Decision card, HELOC card, Payment Result). Details is a power-user drawer behind one toggle.
- **HELOC section is simplified and decision-oriented.** `status` + `advised_draw` + the anchored **"What would change this?"** levers replace the previous wall of metrics. Advisor never mutates the waterfall.
- **"Why not more?" explains constraints and links to source data.** Near-term planned hold and unmapped card risk hold each have a `[View]` pill that routes to Cash Flow → Upcoming.
- **Payment Result supports execution via `[Add payment]` → Quick Add.** Per-row pill pre-fills Quick Add with the planner's `_paid` amount; save still goes through the normal `quickAddPayment` flow with its own audit entry.
- **Debt Overview is a reference layer, not a competing decision tool.** Structure/balances/minimums snapshot, no planner invocation — which removed the analysis-paralysis the old Payoff Path tab created.

---

## 2. Architectural strengths

- **Sheets as source of truth.** Every number is traceable to a user-owned cell. Auditable, editable, recoverable.
- **Apps Script as computation layer.** One public entry point per surface (`getRollingDebtPayoffPlan`, `quickAddPayment`, …). Heavy logic (waterfall, HELOC advisor, card-spend model) stays server-side where it belongs.
- **React bundle as decision UI.** Purely presentational. Fast to iterate on, strongly typed, and easy to reason about because it doesn't write data directly.
- **Mapping layer as contract.** `mapPlannerPayloadToRollingDebtPayoffDashboardData.ts` is the single seam between backend JSON and React types. Adding a field is a three-step ritual (emit → map → consume), but it's explicit and grep-able.
- **Host-global navigation/prefill pattern.** `window.prefillQuickPayment`, `window.showPage`, `window.showTab` give the React bundle a clean, testable bridge to host flows without tangling `google.script.run` into the component.
- **Standard / Details separation.** Protects the default surface from noise while still preserving full auditability for debugging and future power-user needs.

---

## 0. Locked product decisions

Decisions below are settled. Do not casually revisit them inside an enhancement — revisiting requires its own explicit product conversation.

- Rolling Debt Payoff is the primary monthly decision tool.
- Standard vs Details split is intentional and must be preserved.
- Debt Overview remains a reference layer, not a decision tool.
- Aggressive strategy remains hidden until fully product-defined.
- React bundle is presentation/navigation only (no direct writes).
- Navigation to source pages (`[View]` / `[Add payment]`) is preferred over duplicating detail inside the planner.

---

## 3. Key known gaps

### No automated regression harness
There is no integration or unit test suite; validation today is a manual checklist. Any waterfall or HELOC refactor has to be sanity-checked by eye, which slows down willingness to change the engine.

### Alias / payee mapping is hidden and hard to repair
The payee → debt map lives in code/config. When Upcoming Expenses or CF rows fail to map, the UI surfaces it as "unmapped card risk" but the user has no in-app way to fix the mapping. Fixes require a code edit.

### Client-side re-pour can drift slightly from backend truth
When the user types into "Cash to use now" below the Safe-to-use cap, the React layer re-pours allocations in-memory. For edge cases (small-balance payoffs, non-linear caps) the result can be off by a few dollars vs a fresh server run. Acceptable today; will hurt once we expose more strategies.

### Card spend model has approximation limits
Without a true statement-balance feed, CF card-expense rows are treated as *cash out* rather than *new spend*. The engine flags this (`credit_card_spend_confidence = LOW`) but the downstream HELOC realism check and unmapped-hold sizing carry that uncertainty silently.

### Aggressive strategy exists but is not product-defined or exposed
The allocator, validators, and Phase 2 audit are fully implemented. The toggle is hidden because the UX (Focus debt selection, confirmation, explanation) is not designed. Carrying dead UI paths is a tax on every engine change.

### Execution flow is improved but still distributed
`[Add payment]` is a big win, but execution still touches three surfaces (Rolling Debt Payoff → Cash Flow Quick add → LOG/Upcoming). There is no single "accept the plan" action, and no post-execution confirmation loop back into the planner. This is acceptable for now and aligns with the current separation of concerns (decision layer vs. write layer), but leaves room for future streamlining.

---

## 4. Prioritized enhancement opportunities

### Tier 1 — Highest-value next improvements

**Decision Layer — "Next Actions" entry point (Phase 1) — DELIVERED (v1)**
- Status: **Delivered.** Live as the featured Planning entry point. Backed by `getNextActionsData()` (backend aggregator) + `getCashToUse()` (conservative liquidity model). Help section `#help-next-actions` documents current behavior.
- Why it matters: Previously the input / execution layer (Bills, Upcoming, Debts, Bank Accounts, Cash Flow, LOG) was complete but users still had to open five tabs to decide *"what should I do next?"* Next Actions v1 closes that gap with a single, low-noise entry point on top of Planning.
- What v1 ships: compact summary row (Cash to use / Due soon / Available after urgent), Urgent / Recommended / Optimize buckets, grouped "Other bills due soon" tail row for urgent noise control, collapsed "Why this cash amount?" disclosure for liquidity auditability, and per-card "Open …" routing into the existing deep-dive tools via `showTab()`.
- Guardrails held: action-first, no editing, short lists; single payment path remains Cash Flow → Quick Add; no new sheets / columns; Planning's existing deep-dive tools are untouched and accessible via the secondary "Planning tools" row.
- Risk retained: **Low.** Still read-only aggregation over already-canonical sheets; no write path.

**Next Actions — v1 decision-logic design (delivered; reference)**

The full spec lives in `PROJECT_CONTEXT.md → Decision Layer → Next Actions v1 — design note`. Summarized here as the delivered implementation contract:

- **Action object shape** — `priorityBucket` (`urgent` | `recommended` | `optimize`), `actionType`, `title`, `reason`, `amount`, `dueDate`, `sourceEntity {type, name}`, `target {page, tab}`.
- **Priority buckets** —
  - `urgent` = overdue / due soon / unpaid minimums / near-term obligations / cash gap.
  - `recommended` = next best moves once urgent is covered.
  - `optimize` = optional improvements only after urgent is safe.
- **Action types (v1)** — `pay_bill`, `pay_debt_minimum`, `pay_upcoming`, `finish_upcoming`, `review_cash_gap`, `pay_extra_debt`. HELOC strategy is intentionally **not** a Next Actions action type; it lives on the Rolling Debt Payoff *HELOC strategy* card.
- **Data sources (no new ones)** — `INPUT - Bills` (active), `INPUT - Upcoming Expenses` (remaining balance only), `INPUT - Debts` (active), bank / usable cash via the existing liquidity model (`SYS - Accounts` → Safe-to-use / Available Now / Min Buffer), and the existing `getRollingDebtPayoffPlan` output. No engine re-run.
- **Deterministic rules** — build urgent obligations first; compare `sum(urgent)` vs cash-to-use; emit `review_cash_gap` at the top of `urgent` when obligations exceed cash and suppress `recommended` money-movement until resolved; the preferred extra-debt target is the Rolling Debt Payoff focus debt.
- **Explainability rule** — every emitted action must be describable in **one sentence** from the current snapshot (amount / due date / remaining balance / bucket rule / Rolling-Debt-Payoff reason code). If not, it's not emitted.
- **Non-goals (v1)** — retirement optimization, investment allocation advice, purchase simulation, scenario / what-if planning, automatic execution. Quick Add remains the single payment path; Next Actions only routes.

Implementation order, as shipped: backend aggregator (`next_actions.js::getNextActionsData`) + liquidity reader (`cash_to_use.js::getCashToUse`) landed first, followed by the Planning → Next Actions panel (`Dashboard_Body.html` + `Dashboard_Script_PlanningNextActions.html`) rendering the three bucket groups, then help copy (`#help-next-actions`). No mapping-layer changes were needed — the panel calls the backend directly via `google.script.run`, not through the Rolling Debt Payoff React bundle.

**Next Actions — v1 liquidity model (`cash_to_use`) — delivered**

Foundation for Next Actions v1. Full spec lives in `PROJECT_CONTEXT.md → Decision Layer → Liquidity model v1 — cash_to_use`. Delivered contract:

- **Scope** — conservative, buffer-respecting, current-state dollars **safely available right now**. Not the same as Rolling Debt Payoff's *Safe-to-use* (which folds in near-term holds, reserves, and unmapped card risk). Keep the two models separate.
- **Inputs** — Bank Accounts only: `balance`, `minBuffer`, `active`, `usePolicy` from `INPUT - Bank Accounts` + `SYS - Accounts`. No new sheets, no new columns.
- **Formula** — `usable = max(0, balance - minBuffer)` per account; `cash_to_use = Σ usable` over eligible accounts.
- **Eligibility** — active accounts only (shared inactive rule); exclude explicit restricted / do-not-use accounts; v1 Use Policy is a binary include/exclude (finer policies stay for Phase 2 Cash Strategy).
- **Output** — `{ cashToUse, accounts: [{ name, balance, minBuffer, usable, included, excludedReason? }] }`. The per-account array is part of the contract so the UI can show the breakdown and any excluded-reason.
- **Consumers in Next Actions** — compares `cashToUse` vs `sum(urgent)`, drives `review_cash_gap`, and feeds leftover to `pay_extra_debt`.
- **Guardrails** — never negative per account; buffers are sacred; no future-income, pending-transfer, or timing assumptions; no credit / HELOC / investments. HELOC strategy lives on the Rolling Debt Payoff *HELOC strategy* card, not in Next Actions.
- **Non-goals (v1)** — no forecasting, no time-based modeling, no cross-account optimization.

Ship ordering held: the reader landed **before** the Next Actions aggregator and is called from it directly. Exposed as a single server entry point returning the output object above; no changes to Bank Account editors or the existing liquidity consumers (Rolling Debt Payoff keeps its richer model unchanged).

**Decision Layer roadmap**
- **Phase 1 — Next Actions (v1).** ✅ Delivered. First landing surface inside Planning.
- **Phase 2 — Cash Strategy.** Later. Intended to pair Next Actions with a forward-looking liquidity / deployment view. Not scoped yet.
- **Phase 3 — HELOC Advisor refinement.** Later. Continues the existing advisor-anchored "What would change this?" pattern. Not scoped yet.

**Confidence / assumptions layer**
- Status: Proposed
- Why it matters: The planner already internally distinguishes high- and low-confidence inputs (`credit_card_spend_confidence`, `irregular_income_flag`, `unmapped_card_risk_hold > 0`, HELOC realism flags). None of that reaches the Standard surface. Users can't tell when a recommendation is rock-solid vs pattern-matched.
- System touchpoints: backend (expose existing flags on a stable field), mapping layer (add a typed `assumptions` block), React (one compact "What this is based on" strip under the Decision card).
- Risk: **Low.** Additive only; no math changes.
- Timing: **Now.**

**"Why this account?" explanation**
- Status: Proposed
- Why it matters: The Payment Result table shows *what* is being paid but not *why that account*. For Focus debt especially, users ask "why this one, not another?" A one-line rationale per role (highest APR above $X; smallest balance under $Y; spill to next by balance cap) builds trust and teaches the model.
- System touchpoints: backend (emit a short reason code per row alongside `_paid`), mapping layer, React (tooltip or inline muted line per row).
- Risk: **Low.** Presentation on top of data the engine already knows.
- Timing: **Now.**

**Data quality / mapping transparency**
- Status: Proposed
- Why it matters: The two biggest silent contributors to a conservative plan are (a) unmapped card-funded upcoming expenses and (b) low-confidence card spend. Today they're invisible unless you open Details. A visible "Data quality" indicator next to "Why not more?" makes the cause legible — even before we fix the underlying mapping.
- System touchpoints: backend (aggregate a small list of unmapped payees + low-confidence sources), mapping layer, React ("Why not more?" block extension).
- Risk: **Low.** Read-only exposure.
- Timing: **Now.**

**Stronger execution-readiness cues**
- Status: Proposed
- Why it matters: `[Add payment]` works but there's no feedback loop — after a user adds a payment, the planner doesn't visibly acknowledge it on rerun. A simple "X of Y planned payments entered this month" cue turns the table into a checklist.
- System touchpoints: backend (cross-reference `LOG - Activity` Quick add rows against current-month planned payees), mapping layer, React (row-level ✓ or header counter).
- Risk: **Low–Medium.** Needs a stable match rule between planned payee and logged payee.
- Timing: **Now / Soon.**

### Tier 2 — High-value but more coupled

**Alias / mapping repair workflow**
- Status: Proposed
- Why it matters: Fixes the root cause behind "unmapped card risk hold" and mis-classified CF rows. Today the only fix path is a code change.
- System touchpoints: backend (persisted alias table in a new `SYS - Aliases` sheet + resolver), Apps Script write endpoint, a small UI (likely inside Cash Flow or a dedicated "Payees" admin panel), and updates to every resolver that currently reads from the code-side map.
- Risk: **Medium.** New write surface + migration from code config to sheet.
- Timing: **Soon.**

**Reducing client/server allocation drift**
- Status: Proposed
- Why it matters: Prevents the small-balance/edge-case drift from becoming visible or wrong as we expose more strategies. Could be solved either by (a) serving a pre-computed allocation table at multiple cap points, or (b) lightweight debounced server round-trip for exact truth.
- System touchpoints: backend (multi-cap allocation emitter or a fast sub-endpoint), mapping layer, React memo graph.
- Risk: **Medium.** Touches the hottest path in the UI.
- Timing: **Soon.**

**Improving card-spend accuracy**
- Status: Proposed
- Why it matters: The card-spend model is the quiet driver of HELOC realism and unmapped-hold sizing. A true statement-balance ingest (even manual monthly entry) would upgrade `credit_card_spend_confidence` and tighten several decisions.
- System touchpoints: new INPUT sheet or column set, `buildHelocFlowSourceCardSpend_` + `buildHelocBillsCardObligationModel_` rewrites, confidence reclassification.
- Risk: **Medium–High.** Affects HELOC status/advised_draw downstream.
- Timing: **Soon.**

**Execution-flow streamlining**
- Status: Proposed
- Why it matters: Reduces friction from "see plan → execute six payments → come back" to something closer to a guided flow. Could be as small as a "Return to Rolling Debt Payoff" button after Quick add save, or as ambitious as a per-month execution tray.
- System touchpoints: Cash Flow Quick add save handler (return address), Rolling Debt Payoff refetch hook, possibly a new summary strip.
- Risk: **Medium.** UX-heavy; easy to over-design.
- Timing: **Soon.**

### Tier 3 — Strategic / later

**Exposing Aggressive strategy safely**
- Status: Proposed
- Why it matters: The allocator already exists; what's missing is the product wrapper — when it's appropriate, how Focus debt is chosen, confirmation UX, and guardrails against user surprise.
- System touchpoints: host strategy control (un-hide), Decision card (strategy-aware language), help/onboarding copy, validators.
- Risk: **Medium–High.** Product judgement heavier than code effort.
- Timing: **Later** (after confidence layer + readiness cues exist — they're prerequisites for trust).

**Larger workflow unification**
- Status: Proposed
- Why it matters: Long-term, the sidebar dashboard and the web app dashboard should share a single set of fragments. Reduces the drift tax called out in `TODO.md` #16.
- System touchpoints: `PlannerDashboard.html`, `PlannerDashboardWeb.html`, includes refactor.
- Risk: **Medium.** Mechanical but touches every tab.
- Timing: **Later.**

**Deeper model simulations / what-if tools**
- Status: Proposed
- Why it matters: Once confidence + assumptions are visible, users will ask "what if I deploy $X more?" or "what if APR on card Y drops?". Infrastructure for this mostly exists backend-side (`purchase_simulator.js`, yearly projections) — it's a UI + contract problem.
- System touchpoints: new React surface, new backend endpoint, careful isolation from the monthly decision surface to avoid noise.
- Risk: **High** if merged into Standard view; **Low** if kept as a dedicated Details or Planning sub-tab.
- Timing: **Later.**

**Broader regression / test harness investment**
- Status: Proposed
- Why it matters: Every other Tier 2/3 item gets safer once there's a regression net around the waterfall and HELOC advisor. Today's manual checklist is the ceiling on refactor ambition.
- System touchpoints: test runner (clasp-friendly), fixtures for `INPUT - *` tabs, snapshot assertions on payload shape.
- Risk: **Medium.** Non-trivial setup; high long-term ROI.
- Timing: **Later** (but pulled forward if engine changes become frequent).

### Queued — post Next Actions stabilization

Captured-but-not-scheduled product work. These items are *intent only* — structure and constraints are pinned here so they do not drift, but no implementation should start until overlap cleanup and Next Actions stabilization are complete (see **Prioritization order** at the end of this subsection).

**Debug mode control**
- Status: Proposed
- Purpose: Hide developer / debug information from normal users so the default surface reads as a product, not a diagnostics page.
- Concept: Introduce a single global `isDebugMode` flag (host-global, same pattern as `window.showTab` / `window.prefillQuickPayment`). No per-surface toggles.
- Debug-only items (hidden by default; shown only when `isDebugMode` is true):
  - "Why this cash amount?" liquidity breakdown on Next Actions.
  - Any explicit debug / internal-reasoning labels surfaced in the current UI (planner diagnostics, allocation audit, cash-bridge audit on Rolling Debt Payoff when appropriate, etc. — inventory on implementation).
  - Raw JSON exports where they don't aid a normal user.
- User-facing mode shows: summary rows, action cards, decision cards, payment result, help text. Nothing that requires internal vocabulary to read.
- Non-goals (v1): no user-visible toggle control is required in v1 — the flag can be a URL / query-string switch or a session-local key. Designing a "Developer mode" settings UI is a later pass.
- System touchpoints: new host-global, a shared `isDebugMode()` helper consumed by the affected render functions; **no** backend changes; **no** new sheets.
- Risk: **Low.** Pure presentation gating.
- Timing: **After** Next Actions stabilization (see prioritization order below).

**Income Sources (new input surface)**
- Status: Proposed
- Purpose: Give users a structured place to record income so future planning surfaces (forecast, Cash Strategy, onboarding) have a canonical read target. Replaces today's implicit "income = whatever shows up as Cash Flow inflow."
- Proposed location: **Assets → Income Sources** (primary candidate) or **Cash Flow → Income Setup** (fallback). Decide on location during design; do not implement both.
- Canonical fields (v1):
  - `source name` (string)
  - `amount` (number)
  - `frequency` (enum: weekly / biweekly / semimonthly / monthly / quarterly / annual — pin the exact list at design time)
  - `active` (boolean, same inactive rule as the rest of the app)
- Non-goals (v1):
  - No planner integration. Rolling Debt Payoff continues to derive income exactly as it does today (Cisco + configured recurring rent payees, variable-income 50/30/20 split). Income Sources is **not** read by the waterfall in v1.
  - No forecasting. No 12-month projected income timeline from these rows.
  - No automatic Cash Flow posting. Rows here do not mint `INPUT - Cash Flow` entries or LOG rows on their own. Quick Add stays the only write path.
- System touchpoints: new `INPUT - Income Sources` sheet (columns match the v1 fields + `Active`); Apps Script reader following the existing reader patterns (`readSheetAsObjects_` + a small `normalizeIncomeSources_`); a new panel (location TBD) with the usual Add / Update / Stop tracking actions and a matching `income_source_add` / `income_source_deactivate` event type in `LOG - Activity`. No mapping layer or React bundle changes.
- Risk: **Low–Medium.** New write surface, but it is isolated — nothing else reads these rows in v1.
- Timing: **After** debug mode (see prioritization order).

**Onboarding (Phase 1)**
- Status: **Delivered** as **Setup / Review** (top-right dashboard button).
- Purpose: Guide a household through first-time setup instead of handing them an empty workbook. Reduces the cliff between "I opened CashCompass" and "I can trust the numbers on Next Actions."
- Delivered scope (in order, as implemented):
  - **Welcome** screen → **status grid** (card per step with *Setup complete* / *Not set up* badge and short summary).
  - **Bank Accounts** detail — reads the current-year block on `INPUT - Bank Accounts`.
  - **Debts** detail — reads active rows from `INPUT - Debts`.
  - **Bills** detail — reads active rows from `INPUT - Bills`.
  - **Upcoming Expenses** detail — reads *Planned* rows from `INPUT - Upcoming Expenses`.
  - **Income** detail — derived from the latest `INPUT - Cash Flow <year>`; **no** `INPUT - Income Sources` sheet. Recurring detections are grouped conservatively; excluded categories (Bonus, RSU, ESPP, Refund, …) are surfaced as "Other detected income".
  - **Finish** summary — per-step status list with *Review* deep-links and a *Go to Next Actions* CTA.
- Editor handoff:
  - Every per-step CTA opens the **existing** editor (Bank Accounts, Debts, Bills, Upcoming, Cash Flow → Income) in **Setup mode**: main top nav, page sub-tabs, *Setup / Review*, and *Run Planner + Refresh Snapshot* are hidden; a slim **Back to Setup** bar returns the user to the matching detail screen. Normal navigation to the same editor is unchanged.
- Sheet safeguards:
  - Setup creates `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, and `INPUT - Upcoming Expenses` with canonical headers when missing, reusing existing codebase schema (e.g. `getDebtsHeaderMap_`, `getOrCreateUpcomingExpensesSheet_`). It does **not** invent Cash Flow year sheets — if the latest year is missing, the Income step reports that explicitly.
- Read-only guarantee:
  - Viewing Setup never writes, never touches `SYS -` sheets, and never appends to `LOG - Activity`. Writes only happen through the underlying editors, which use the same save logic as the normal path.
- Non-goals (still intentionally out of scope):
  - No advanced strategy content (HELOC, Aggressive payoff, Cash Strategy, what-if tools).
  - No automated import; Setup guides *where* and *in what order*, not *what* to type.
  - No gamification or progress persistence — this is a walkthrough, not a state machine.
- Documentation: Help copy lives in `Dashboard_Help.html → Setup / Review` (`#help-setup`). Product framing is in `PROJECT_CONTEXT.md → Setup / Review (Onboarding Phase 1, delivered)`.
- Follow-ups (tracked in `PROJECT_CONTEXT.md`): retire `?onboarding=test` / `TEST -` fallbacks; consolidate the five per-step `*SetStatus_` / `*LoadDetail_` / `*RenderDetail_` / `*Open*Page` groups in `Dashboard_Script_Onboarding.html` into a shared factory once the flow has been exercised in real use.

**Prioritization order (for the queued items above)**

Do not shuffle without an explicit product decision:

1. **Finish overlap cleanup.** The Next Actions / Debt Overview / Rolling Debt Payoff cleanup pass (duplicate decision content removed, cross-links added, Next Actions wording tightened) must land cleanly before any new surface work begins. This is the current in-flight work.
2. **Stabilize Next Actions.** Let the v1 decision surface bake against real daily use: confirm urgent grouping, recommended sizing, routing, and "Why this cash amount?" disclosure all hold under normal household operation. No new queued items start while Next Actions is still being corrected.
3. **Debug mode control.** First net-new item. Smallest scope, lowest risk, unblocks the rest by ensuring debug/internal content has a single gating pattern before more surfaces add their own.
4. **Income Sources.** Structured income input. Can land without planner integration because debug mode already hides work-in-progress surfaces from normal users if needed.
5. **Onboarding (Phase 1).** **Delivered** as *Setup / Review*. Built after debug mode and in place of a standalone Income Sources surface — income is now managed inside Setup from the latest `INPUT - Cash Flow <year>`. Remaining onboarding follow-ups are scoped to TEST-mode retirement and an internal factory refactor of the per-step client handlers; neither changes user-visible behavior.

---

## 5. Recommended next item

**Confidence / assumptions layer.**

Why this is the best next move:

- **Value is immediate and visible.** Today the Decision card says *what* to do. Adding a tight "What this is based on" strip tells the user *how sure* the planner is — which is the missing piece behind almost every "should I trust this?" moment.
- **All the inputs already exist.** The engine already tracks `credit_card_spend_confidence`, `irregular_income_flag`, unmapped-hold presence, HELOC realism gates, and planned-expense hold sources. We don't have to compute anything new — we have to *surface* what's there.
- **Fits the current architecture cleanly.** Backend emits a new `assumptions` object, mapping layer types it, React renders a compact block under the Decision card. No waterfall changes, no new write surface, no navigation glue.
- **Safer than bigger changes right now.** Unlike the Tier 2 items (alias repair, drift reduction, card-spend accuracy) it doesn't change math, doesn't add write paths, and doesn't change the shape of any existing decision. Worst case: we hide it behind the Details toggle if it feels noisy.
- **It's a prerequisite for Tier 3 work.** Exposing Aggressive strategy safely, or any what-if tooling, only makes sense after users can read *why* the current recommendation looks the way it does.

First concrete step when we pick this up: enumerate the existing backend flags that should feed the layer, agree on a priority order (which gets shown first when multiple fire), and draft the three-to-five short sentences that render in the UI.

---

## 6. Enhancement guardrails

Rules that apply to every future change in this backlog:

- **Preserve Standard-mode simplicity.** New information lands in Details by default. It only graduates to Standard once it passes a "would this change a decision?" test.
- **Do not expose unfinished strategy choices.** Aggressive, what-if, and any new planner modes stay dark until their UX, explanation, and guardrails are designed.
- **Do not duplicate source-of-truth data.** Sheets are canonical. New UI reads; it does not cache, re-store, or shadow sheet state.
- **Prefer navigation to source pages over duplicating details.** The `[View]` and `[Add payment]` patterns are the template — point users at the real source, don't rebuild it inside the planner.
- **Keep React as presentation/navigation layer, not direct write layer.** All writes go through Apps Script endpoints, with `LOG - Activity` entries. The React bundle calls host globals; it does not call `google.script.run` for writes.
- **Add new logic backend-first, then map forward.** Emit from Apps Script → type in the mapping layer → consume in React. No parallel client-side derivations.
- **Execute one improvement area at a time and lock it before moving on.** Ship, document in `SESSION_NOTES.md` / `Dashboard_Help.html`, then pick the next one. No stacking half-shipped features.
- **Rebuild the React bundle after any component change.** `RollingDebtPayoffDashboardBundle.html` is a prebuilt artifact. Any edit to `components/*.tsx` or the mapping layer requires running `npm run build:rolling-dashboard`. Skipping this step means UI changes will not appear in the dashboard.

---

## 7. Working method

How this backlog should be used:

- **Pick one enhancement at a time** from the prioritized list — start at the top of Tier 1 unless there's a reason to deviate.
- **Review current behavior first** in both backend (what fields exist today) and frontend (what the user sees). Confirm the gap is real in the current build.
- **Make scoped changes only.** Touch the minimum set of files — backend emitter, mapping, one React block, help copy. Resist the urge to refactor adjacent code "while we're in there."
- **Validate in UI.** Run `npm run build:rolling-dashboard`, load the web app, confirm the change in Standard and Details modes, confirm nothing moved in the existing compact cards.
- **Lock before moving to the next item.** Update `SESSION_NOTES.md`, update `Dashboard_Help.html` if user-facing, update `TODO.md` / this file's status if needed, then commit. Only then pick the next enhancement.
