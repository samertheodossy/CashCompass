## Earlier session work (misc)

- **Quick payment / bill pay**: sped up screen updates (faster round-trip pattern).
- **Debts / credit cards**: show cards in the UI even when balance is $0 where applicable.
- **Debts — non-loan payments**: payment amount subtracted from the displayed balance for non-loan debt rows (see debt sheet logic).
- **Bills Due / recurring**: `hasHistory` guard removed in `getRecurringBillsWithoutDueDateForDashboard()` in `dashboard_data.js` so unmapped Cash Flow rows can still surface; a short comment in code documents how to restore the old gate if needed.

---

## Properties — Property performance tab (commit: feature + HOUSES matching + tabs layout)

- **Planner Dashboard → Properties**: new sub-tab **Property performance** next to **House Expenses** (CSS: `properties-tabs` uses two columns like other tab rows).
- **Data**: `property_performance.js` + `getPropertyPerformanceData` — per row in **SYS - House Assets**: equity, rent (calendar year from **INPUT - Cash Flow** `Income` rows whose Payee matches `Rent {House name}` with optional suffix), expenses (sum **Cost + Service Fees** on **HOUSES - …** for that year). Portfolio mini-cards sum columns.
- **HOUSES sheet column / expenses**: resolve tab by exact `HOUSES - {House}` first, then normalized match on location suffix (case/spacing) so casing mismatches don’t show false “—”. Expense totals use the resolved sheet’s location key.
- **Files**: `property_performance.js`, `Dashboard_Script_PropertyPerformance.html`, `Dashboard_Body.html`, `Dashboard_Script_Render.html`, `PlannerDashboardWeb.html`, `Dashboard_Styles.html`.
- **Sheet naming**: align **INPUT - House Values** `House`, **SYS - House Assets** `House`, **`HOUSES - {same}`**, and Cash Flow **`Rent {same}`**; optional mismatch handled by normalized HOUSES lookup only when strings match after normalize.

---

## Date parsing — local ISO `YYYY-MM-DD` (avoid UTC month shift)

- **Bug**: `new Date('2026-04-01')` is parsed as **UTC** midnight, so in US timezones the **local** month/day can be the **previous** calendar day → wrong month label and wrong month column (e.g. Apr 1 → Mar-xx).
- **Fix**: use **`parseIsoDateLocal_`** from `quick_add_payment.js` (`new Date(y, m-1, d)` in script timezone) for HTML `<input type="date">` payloads.
- **Touched**: `house_values.js` (get/update house value), `bank_accounts.js`, `investments.js`, `house_expenses.js` (`addHouseExpense`), `upcoming_expenses.js` (`addUpcomingExpense`). Quick Add Payment already used the helper.

---

## House Expenses — Type dropdown label

- **Change**: display label **Tax** → **Property Tax** in Add House Expense (Type). The option still uses **`value="Tax"`** so existing HOUSES sheet rows and stored values stay valid.
- **Files**: `Dashboard_Body.html`, `HouseExpensesUI.html`, `PlannerDashboardWeb-FULLCOPY.html`.

---

## Operations Snapshot — Bills next 7 days

- **UI**: first row in **Operations Snapshot** card: **Bills Next 7 Days** — sum of **`amount`** for bills in **`getBillsDueFromCashFlowForDashboard()`** `next7` (same as Bills Due list). Click opens **Cash Flow → Bills Due**.
- **Files**: `Dashboard_Body.html`, `Dashboard_Script_BillsDue.html`. (`Dashboard_Script_DueCards.html` mirrors the same helpers but is not included by `PlannerDashboardWeb.html`.)

---

## Overview — Weekly net worth change (replaces duplicate “What changed” / “Net worth Attribution”)

- **Behavior**: One card **Weekly net worth change**. Deltas = **live** balances (assets / house values / debts / net worth from sheets) **minus** a **baseline row** from **`OUT - History`**: the **latest** run whose **Run Date** is on or **before** (today − 7 calendar days). If no run is that old, **fallback** to the **earliest** row in History and show a short note in the card.
- **Removed**: `buildNetWorthAttribution_(latest, previous)` (consecutive History rows). **Revert**: restore that function and wire `buildDashboardSnapshot_` to it; restore two Overview cards + `renderRecentChanges` / `renderAttribution` in `Dashboard_Script_Render.html`, `Dashboard_Body.html`, `Dashboard_Script_Features_2.html`, `Dashboard_Script_Core.html`, `PlannerDashboardWeb-FULLCOPY.html`.
- **Files touched**: `dashboard_data.js` (`getAllHistorySnapshotRows_`, `pickWeeklyBaselineFromRows_`, `buildNetWorthAttributionWeekly_`, `parseHistoryRunDate_`), `Dashboard_Body.html`, `Dashboard_Script_Render.html`, `Dashboard_Script_Features_2.html`, `Dashboard_Script_Core.html`, `PlannerDashboardWeb-FULLCOPY.html`.