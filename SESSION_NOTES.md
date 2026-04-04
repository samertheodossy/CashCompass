## SYS - House Assets — Property type column

- **Layout**: `House | Type | Loan Amount Left | Current Value` (optional **Type**; if absent, code behaves as before).
- **Sync**: `syncAllHouseAssetsFromLatestCurrentYear_` still updates **Current Value** only (by header); **Type** and **Loan Amount Left** are never overwritten from INPUT - House Values.
- **API**: `getHouseAssetsHeaderMap_` / `getHouseAssetRowData_` expose **propertyType**; `getHouseValueForDate` returns **propertyType** for UIs.
- **Property performance**: Cash Flow **rent** is summed only when **Type** is **Rental** or **Renal** (typo); **Home**, **Vacation Home**, etc. show **$0** rent. Empty **Type** keeps legacy behavior (still sum rent). Table includes a **Type** column (from SYS).
- **Planner**: `normalizeHouseAssets_` includes **propertyType** from column **Type**.

---

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
- **Data**: `property_performance.js` + `getPropertyPerformanceData` — per row in **SYS - House Assets**: **Type** (SYS column), equity, rent (calendar year from **INPUT - Cash Flow** `Income` rows whose Payee matches `Rent {House name}` with optional suffix), expenses (sum **Cost + Service Fees** on **HOUSES - …** for that year). Portfolio mini-cards sum columns. Property performance table shows **Type** next to **House**.
- **HOUSES matching / expenses**: resolve tab by exact `HOUSES - {House}` first, then normalized match on location suffix (case/spacing). Expense totals use the resolved sheet’s location key (UI no longer shows a Yes/— column).
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
- **Files**: `Dashboard_Body.html`, `Dashboard_Script_BillsDue.html`.
- **Bills Due cards (compact UI)**: Each card shows **name**, **amount**, **due date**, **Pay** / **Skip** only—no duplicate “suggested amount,” no category/autopay/varies/source line. Details in Help **`#help-bills-due`**. Recurring row: one short meta line. Styles: `.bill-card-compact`, `.bill-card-actions` in `Dashboard_Styles.html`.
- **Bills Due status**: `bills_due_status` under the Bills Due panel head; Pay/Skip success and errors use it (not `planner_status`). Load failures for the bills API still use `planner_status` for visibility.

---

## Overview — Weekly net worth change (replaces duplicate “What changed” / “Net worth Attribution”)

- **Behavior**: One card **Weekly net worth change**. Deltas = **live** balances (assets / house values / debts / net worth from sheets) **minus** a **baseline row** from **`OUT - History`**: the **latest** run whose **Run Date** is on or **before** (today − 7 calendar days). If no run is that old, **fallback** to the **earliest** row in History and show a short note in the card.
- **Removed**: `buildNetWorthAttribution_(latest, previous)` (consecutive History rows). **Revert**: restore that function and wire `buildDashboardSnapshot_` to it; restore two Overview cards + `renderRecentChanges` / `renderAttribution` in `Dashboard_Script_Render.html` and `Dashboard_Body.html`.
- **Files touched**: `dashboard_data.js` (`getAllHistorySnapshotRows_`, `pickWeeklyBaselineFromRows_`, `buildNetWorthAttributionWeekly_`, `parseHistoryRunDate_`), `Dashboard_Body.html`, `Dashboard_Script_Render.html`.

---

## Overview — Snapshot month-over-month + net worth + health + buffer runway (2026)

- **Top snapshot cards — “Change vs MMM yyyy”** (script timezone, **prior calendar month**). **`fmtPriorMonthDelta`** in `Dashboard_Script_Render.html`.
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

---

## Planner Dashboard — Help page (no nav tab)

- **Entry**: Prominent **Help** button in the top bar with Run Planner; opens `page_help` via `showPage('help')` (not a sixth page tab).
- **Content**: `Dashboard_Help.html` included from **`PlannerDashboardWeb.html`** after `Dashboard_Body` (same template level — `includeHtml_` uses `getRawContent()`, so nested `<?!= … ?>` inside Body does not run).
- **JS**: `scrollHelpToSection`, `openHelpToSection`; delegated clicks on `.help-toc a` use `preventDefault` + `scrollIntoView` to avoid hash/sticky layout jumps (Safari).
- **CSS**: `.help-toc-wrap` sticky wrapper, `.help-section` `scroll-margin-top`; styles in `Dashboard_Styles.html`.
- **Property performance**: Table has no **HOUSES sheet** column (matching is documented in Help only); no in-panel footnote.
- **Help — property performance copy**: **HOUSES sheet** paragraph explains tab alignment (not a table column); **Expenses** + **HOUSES sheet** split for clarity.

---

## Planner Dashboard — loading spinner (CSS + `setStatusLoading`)

- **CSS** (`Dashboard_Styles.html`): `.dash-loading`, `.dash-loading-spinner`, `.dash-loading--block`, `.dash-loading--center`, `dash-loading-spin` keyframes; `prefers-reduced-motion` tames animation.
- **JS** (`Dashboard_Script_Render.html`): `loadingIndicatorHtml`, `loadingBlockHtml`, `setStatusLoading` (after `escapeHtml`).
- **Used for**: house/bank/investments/debt fetch status lines; property performance status + table row; **Run planner** status; house expense summaries/recent; bills due lists + recurring; initial placeholders in `Dashboard_Body.html`.
- **Standalone**: `PlannerDashboard.html` includes same spinner styles + `setStatusLoading` for assets tabs.

---

## Dead code — removed unreferenced dashboard HTML

- **Removed**: `Dashboard_Script_DueCards.html`, `Dashboard_Script_Core.html`, `Dashboard_Script_Utils.html` (never `includeHtml_`’d from `PlannerDashboardWeb.html` nor `createHtmlOutputFromFile` elsewhere). **Revert**: restore those files from git history if a mirror is needed again.
