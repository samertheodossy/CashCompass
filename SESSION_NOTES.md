## Cash Flow — Quick Payment: last month's payment (info box)

- **Behavior**: **Last month's payment** = **cell value** on the **prior calendar month** for the same **Type + Payee** on that year's **INPUT - Cash Flow** tab. **January** date → **December** of the **previous calendar year** → read from **INPUT - Cash Flow (year−1)** (e.g. Jan-26 on 2026 tab → Dec-25 on **2025** tab). Each tab only has **Jan-YY … Dec-YY** for that year, so “last month” for January is **never** on the current year’s tab. Not a delta.
- **No match / messages**: Missing **prior-year** tab, **no payee row** on that tab (new payee in the new year, rename, etc.), or month column missing → specific `priorMonthUnavailableMessage` (replacing generic copy).
- **Server**: `computeQuickAddPriorMonthPreview_` + `getQuickAddPreview` / `quickAddPayment` preview in `quick_add_payment.js`.
- **UI**: `pay_priorMonthLabel`, `pay_priorMonthPayment`; `Dashboard_Body.html`, `PlannerDashboard.html`, `Dashboard_Script_Payments.html`, `QuickAddPaymentUI.html`.

---

## Assets — Bank & Investments: change vs prior month

- **Behavior**: Same as House Values — **stored INPUT value for the selected month** minus **INPUT** (`BANK_ACCOUNTS` / `INVESTMENTS`) for the **same account** and **prior calendar month**. Missing prior → **—**.
- **Server**: `getBankAccountValueForDate` (`bank_accounts.js`) and `getInvestmentValueForDate` (`investments.js`) add `deltaFromPreviousMonth` via `getBankAccountHistoryValueForMonth_` / `getInvestmentHistoryValueForMonth_` on the prior month date.
- **UI**: Separator + **Change vs prior month** after the last info line — `bank_deltaPriorMonth`, `inv_deltaPriorMonth`; `Dashboard_Body.html`, `PlannerDashboard.html`, `Dashboard_Script_AssetsBankInvestments.html`.

---

## Assets — House Values: change vs prior month (commit `81b46d6`)

- **Behavior**: **Change vs prior month** = **stored INPUT value for the selected month** minus **INPUT - House Values** for the **same house** and **calendar month before** the selected date. Missing/invalid prior month → **—**.
- **Server**: `getHouseValueForDate` in `house_values.js` sets `deltaFromPreviousMonth` (and `previousMonthLabel`); prior month via `getHouseValueFromHistoryForMonth_` on the prior month’s date.
- **UI**: Blue info box — four existing lines, then a **separator** (`.house-value-delta-sep`), then **Change vs prior month** (`house_deltaPriorMonth`, `fmtSignedCurrency` in client scripts).
- **Files**: `house_values.js`, `Dashboard_Body.html`, `Dashboard_Script_AssetsHouseValues.html`, `Dashboard_Styles.html`, `PlannerDashboard.html`.

---

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
- **Files**: `Dashboard_Body.html`, `HouseExpensesUI.html`.

---

## Operations Snapshot — Bills next 7 days

- **UI**: first row in **Operations Snapshot** card: **Bills Next 7 Days** — sum of **`amount`** for bills in **`getBillsDueFromCashFlowForDashboard()`** `next7` (same as Bills Due list). Click opens **Cash Flow → Bills Due**.
- **Files**: `Dashboard_Body.html`, `Dashboard_Script_BillsDue.html`. (`Dashboard_Script_DueCards.html` mirrors the same helpers but is not included by `PlannerDashboardWeb.html`.)

---

## Overview — Weekly net worth change (replaces duplicate “What changed” / “Net worth Attribution”)

- **Behavior**: One card **Weekly net worth change**. Deltas = **live** balances (assets / house values / debts / net worth from sheets) **minus** a **baseline row** from **`OUT - History`**: the **latest** run whose **Run Date** is on or **before** (today − 7 calendar days). If no run is that old, **fallback** to the **earliest** row in History and show a short note in the card.
- **Removed**: `buildNetWorthAttribution_(latest, previous)` (consecutive History rows). **Revert**: restore that function and wire `buildDashboardSnapshot_` to it; restore two Overview cards + `renderRecentChanges` / `renderAttribution` in `Dashboard_Script_Render.html` and `Dashboard_Body.html`.
- **Files touched**: `dashboard_data.js` (`getAllHistorySnapshotRows_`, `pickWeeklyBaselineFromRows_`, `buildNetWorthAttributionWeekly_`, `parseHistoryRunDate_`), `Dashboard_Body.html`, `Dashboard_Script_Render.html`. (`Dashboard_Script_Core.html` is an offline mirror of render helpers — not loaded by `PlannerDashboardWeb.html`.)

---

## Overview — Snapshot month-over-month + net worth + health + buffer runway (2026)

- **Top snapshot cards — “Change vs MMM yyyy”** (script timezone, **prior calendar month**). **`fmtPriorMonthDelta`** in `Dashboard_Script_Render.html` / Core mirror.
  - **Total cash**: sum **INPUT - Bank Accounts** prior month column vs **SYS - Accounts** current (`getPriorMonthCashTotalFromBankInput_` in `bank_accounts.js`).
  - **Total investments**: sum **INPUT - Investments** prior month vs **SYS - Assets** (`getPriorMonthInvestmentsTotalFromInput_` in `investments.js`). Not from `OUT - History` for this line.
  - **Real estate value**: sum **INPUT - House Values** prior month vs **SYS - House Assets** (`getPriorMonthHouseValuesTotalFromHouseValuesInput_` in `house_values.js`).
  - **Total debt**: no monthly INPUT; **latest `OUT - History` run in prior month** → **Total Liabilities** (`getPriorMonthTotalDebtFromHistory_` in `dashboard_data.js`).
  - **Net worth (Option 1)**: prior month reconstructed only if all three exist: **INPUT** inv + house − **History** debt; delta = current NW − prior. Current **NW = cash + investments + house values − total debt** (`dashboard_data.js`); **`runDebtPlanner`** **`totalAssets`** includes bank **Current Balance** sum + financial + RE (`code.js`) so History aligns after planner runs.
- **Financial Health**: score still from latest planner metrics + live upcoming; **trend** = **current score − score recomputed from prior month’s History row** with **no upcoming penalty** (`computeFinancialHealthScoreNumber_`, `getPriorMonthPlannerHistoryMetrics_`). UI: **`fmtHealthTrendPoints`** (“Change vs Mar 2026: +3 pts”). **`readPlannerHistoryMetricsRow_`** shared by offset + prior-month pick.
- **Buffer Runway**: keep **detail** message; add **`runway_months_line`** (`monthsLine`). **Negative projected cash flow**: same as before (usable ÷ burn). **Non-negative**: **`usable ÷ Total Minimum Payments`** when min payments &gt; 0; else **“Many months+”** if usable &gt; 0; else **—**. Style: **`.runway-months-line`** in `Dashboard_Styles.html`.

---

## Planner Dashboard — split workspace scripts (replaces `Dashboard_Script_Features_1.html`)

- **Was**: one large `Dashboard_Script_Features_1.html` (House Values, House Expenses, Bank, Investments, Debts, Upcoming, Retirement, Purchase sim).
- **Now**: seven includes after `Dashboard_Script_Render` in `PlannerDashboardWeb.html`: `Dashboard_Script_AssetsHouseValues`, `Dashboard_Script_PropertiesHouseExpenses`, `Dashboard_Script_AssetsBankInvestments`, `Dashboard_Script_PlanningDebts`, `Dashboard_Script_CashFlowUpcoming`, `Dashboard_Script_PlanningRetirement`, `Dashboard_Script_PlanningPurchaseSim`.
- **Globals** (`bankCurrentData`, `houseExpenseOptions`, etc.) stay in `Dashboard_Script_Render.html`.
