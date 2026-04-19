## Recent — Bills page: Manage bills, Flow Source, header tolerance

- **Bills page split** — The Cash Flow **Bills** panel is now an internal two-view surface with a lightweight segmented switch: **Due this period** (execution, unchanged behavior — Pay / Skip on dated cards) and **Manage bills** (new table over **INPUT - Bills** with inline sortable **Payee** / **Due Day** columns; default sort Due Day ascending). Heading renamed from "Bills Due" to **Bills** in both the TOC and the section header; anchors (`#help-bills-due`) preserved. Segmented switch restyled as inline buttons with a subtle inactive state (CSS: `.bills-view-switch`, `.bills-view-switch-btn`; container styling removed).
- **Manage bills actions**
  - **Add bill** opens an inline form that writes a new row to **INPUT - Bills** via `addBillFromDashboard` (`bills.js`). Required fields: **Payee**, **Category**, **Due Day**, **Default Amount**, **Payment Source** (CASH / CREDIT_CARD). Optional: **Frequency**, **Start Month**, **Varies**, **Autopay**, **Notes**. Client and server both enforce **Category** (dedicated error, not the generic "missing field" message).
  - **Stop tracking** sets **Active = No** on the INPUT - Bills row (never deletes). Bill stays in the sheet for history/audit.
- **Flow Source on Bills → Pay** — New Cash Flow rows created from a Bills pay action now populate **Flow Source** from **INPUT - Bills.Payment Source**. Debt-backed bills (no INPUT - Bills row) infer **CREDIT_CARD** when the debt **Type** is Credit Card, else **CASH**. Implementation: UI passes `flowSource` through `window.__pendingQuickAddFlowSource` → `savePayment` → `quickAddPayment`, and a server-side fallback `resolveFlowSourceFromBillOrDebt_` in `quick_add_payment.js` derives it from `INPUT - Bills` / `INPUT - Debts` for any caller that loses the field in transit (sidebar dashboard, upcoming auto-writes, stale client bundles).
  - **Existing rows** are never silently overwritten. Flow Source is only filled on existing rows when the caller explicitly provided it.
  - **Months before Start Month** stay blank on new rows — no backfill, no zero, no dash.
- **Header tolerance (case + trailing spaces)** — Real workbooks ship **INPUT - Bills** with variant headers such as `PAYMENT SOURCE` or `Payment Source ` (trailing space). `indexOf` was returning -1 on reads, silently blanking `paymentSource` downstream and leaving Flow Source empty on created Cash Flow rows. Fix: `bills.js`, `dashboard_data.js` (`getInputBillsDueRows_`), and `quick_add_payment.js` (`resolveFlowSourceFromBillOrDebt_`) now normalize both the sheet header and the lookup label with `trim().toLowerCase()` before matching.
- **Self-heal INPUT - Bills** — `addBillFromDashboard` auto-inserts any missing optional columns (**Payment Source**, **Category**, **Frequency**, **Start Month**, **Notes**) before writing a new row, so new installs / older workbooks don't silently drop fields.
- **Activity log — bill lifecycle** — `bill_add` fires on successful Add bill; `bill_deactivate` fires on Stop tracking. Both render on the **Activity** page with Type **Bill** and Action sub-labels (**Bill added** / **Tracking stopped**). Tracking stopped shows **—** in the Amount column because no money moved.
- **Help refactor (Dashboard_Help.html)** — Readability pass only (no behavior changes). Shorter paragraphs, per-section subheads (**What it does / What gets logged / What the buttons do / What the numbers mean / Notes**), bullets over prose. Most-reshaped sections: Activity log, Bills, Rolling Debt Payoff, Debt Planner email, Sheet names. All 15 section anchors preserved (`help-intro` … `help-sheets`).
- **Files** — `bills.js` (new; `addBillFromDashboard`, `deactivateBillFromDashboard`, `headerIndex_` helper, self-heal), `dashboard_data.js` (`getInputBillsDueRows_` header tolerance + `Start Month` hard-skip guard), `quick_add_payment.js` (`resolveFlowSourceFromBillOrDebt_` + `callerProvidedFlowSource` guard on existing rows), `Dashboard_Script_BillsDue.html` (internal view switch, Manage table, Add bill form, inline sort), `Dashboard_Script_Payments.html` (`window.__pendingQuickAddFlowSource` plumbing), `Dashboard_Body.html` (Bills page markup + Add bill form), `Dashboard_Styles.html` (inline segmented switch, sort headers), `activity_log.js` (`bill_add` / `bill_deactivate` Type + Action rendering), `Dashboard_Help.html` (readability refactor; Bills section retitled).

---

## Recent — Rolling Debt Payoff: Standard-mode UX sweep

- **Two Planning tabs, clear split** — **Debt Overview** (renamed from the old "Payoff Path") is a read-only reference view of balances/minimums/APRs and estimated payoff at current minimums; **Rolling Debt Payoff** is the monthly decision engine. Help **Planning**, **Debt Overview**, and **Rolling Debt Payoff** sections updated to reflect the split.
- **Standard vs Details mode** — Rolling Debt Payoff opens in a compact decision layout; a single **Show details / Hide details** toggle reveals the full planner report (cash bridge audit, allocation audit, 12-month table, yearly projection, diagnostics, JSON). Replaces the previous "Include DEBUG DETAILS" checkbox wording.
- **User-facing waterfall role names** — `CompactPaymentResultRoleKey` stays `Cleanup | Primary | Secondary | Overflow` internally, but the Standard view labels rows via `PAYMENT_RESULT_ROLE_LABEL` as **Small balance**, **Focus debt**, **Next debt**, and **Excess** (same rename reflected in allocation audits, progress bars, extras section copy, and audit tables). Help **Rolling Debt Payoff** documents the mapping.
- **Narrative decision card** — New `CompactDecisionCard` renders three lines: **Recommendation** (what to do), **Why** (short reason), **Caution** (near-term risk / why conservative). Driven by the same planner JSON (`action_decision_box` + context).
- **HELOC card — "What would change this?"** — Compact HELOC advisor card lists the actionable levers (APR spread, eligible-debt threshold, upcoming-expense hold, recurring monthly repayment) with current values anchored inline so the user sees what drives the recommendation.
- **Payment result enhancements** — Compact table with the four columns (Account + role / Action / Remaining / Add payment):
  - **Action wording** — `'Closed' | 'Paid down'` → **'Paid off (this month)' | 'Partially paid'**. Green tone on the paid-off row updated to match.
  - **[Add payment] pill** — Per-row button (only when `row.paid > 0`) calls host `window.prefillQuickPayment({ entryType: 'Expense', payee: row.account, entryDate: today, amount: Math.round(row.paid) })` to open **Cash Flow → Quick add** pre-filled. Hidden in standalone contexts (no `prefillQuickPayment` global). Quick add preview stays visible after prefill so the user can accept/adjust.
  - `CompactPaymentResultRow` gained a public `paid` field (replaces the stripped `_paid`); overflow footer `colSpan` is dynamic (3 or 4).
- **"Why not more?" block** — Renders the two holds (Near-term planned hold, Unmapped card risk hold) as wide text rows; each exposes an inline **[View]** pill that routes to **Cash Flow → Upcoming** via `window.showPage('cashflow')` + `window.showTab('upcoming')` when the hold is materially driven by upcoming planned expenses. The second bullet only shows the [View] pill when `unmappedCardRiskHold` is upcoming-fed; otherwise it stays plain text. Inline styles explicitly reset conflicting host CSS (`width`, `margin`, `background`, `color`, `border-radius`) so the pills render consistently inside the React bundle embedded in the host page.
- **Anchored HELOC bullets, stable header** — Header copy no longer flickers when inputs change; HELOC `What would change this?` bullets are stable (single ordered list keyed by lever).
- **Files** — `components/RollingDebtPayoffDashboard.tsx` (Standard-mode cards, payment-result column, role labels, action wording, host navigation callbacks), `RollingDebtPayoffDashboardBundle.html` (rebuilt), `Dashboard_Help.html` (§ Rolling Debt Payoff rewritten + Debt Overview section), `Dashboard_Styles.html` (added `.help-section h4` rule for subsection headings).
- **Host integration** — `window.prefillQuickPayment` lives in `Dashboard_Script_Payments.html`; `window.showPage` / `window.showTab` in `Dashboard_Script_Render.html`. The React component calls these defensively and silently no-ops in standalone environments. `npx tsc --noEmit -p tsconfig.rolling-dashboard.json` and `npm run build:rolling-dashboard` pass.

---

## Recent — Status targets + Help Upcoming

- **Debt Planner email — Pay now / Pay soon** — Merges **INPUT - Bills** (same dated, unhandled rows as Bills Due) with **INPUT - Debts** minimums via `buildInputBillPlannerPaymentWindows_` + `mergeDebtAndBillPaymentWindows_` in `code.js` / `dashboard_data.js` / `planner_core.js`. Totals, `buildActionPlan_`, history, and email use the merged lists; dedupe key is `normalizeBillName_(account)|dueDate` (debt row wins). Email lines for `type === 'Bill'` omit the word “min”. Help **Debt Planner email** updated.
- **Product name** — Web dashboard and sidebar HTML titles rebranded to **CashCompass**; tagline *Guiding your money decisions.* Sheet menu: **Open CashCompass (sidebar)** / **Open CashCompass Web** / **Set CashCompass Web App URL**. Script property key `PLANNER_DASHBOARD_WEBAPP_URL` unchanged. `Dashboard_Body.html`, `PlannerDashboard.html`, `dashboard.js`, `webapp.js`, `code.js`, Help, `PROJECT_CONTEXT.md`, `FIRST_RUN.md`.
- **Logo** — Top bar shows tight-cropped **CashCompass** mark: **PNG** embedded as `data:image/png;base64,…` in `Dashboard_Body.html` (256px max dimension for bundle size). Source files: `assets/CashCompass-logo-cropped.png`, `assets/CashCompass-logo-cropped-256.png`. Framed in `product-logo-wrap` (`Dashboard_Styles.html`). Apps Script `doGet` does not serve standalone images; inline data avoids extra hosting.
- **Overview — Suggested Actions vs Issues** — `buildSuggestedActions_` no longer copies the top 3 `issues` (removes duplicate utilization lines). Suggested Actions keeps cash-flow / runway / retirement nudges only. Hint under **Suggested Actions** when issues exist: points to **Issues** (no numeric count — full `issues` list mixes severities and types). `dashboard_data.js`, `Dashboard_Script_Render.html`, `Dashboard_Body.html`, `Dashboard_Styles.html`, Help **Overview**.
- **INPUT - Bills Default Amount 0** — `getInputBillsDueRows_` no longer skips zero defaults; bills still show in Overdue / Next 7 when the Cash Flow cell is unhandled. Autopay only runs when **Default Amount > 0**. `dashboard_data.js`; Help **Bills Due**; `PROJECT_CONTEXT.md`.
- **Bills Due load failure** (`loadBillsDueUi_`) → **`bills_due_status`** (was `planner_status`). Overview Bills card still shows the same error text in the summary. `Dashboard_Script_BillsDue.html`.
- **Debt planner after Quick add** (`runDebtPlannerAfterQuickPayment_` failure) → **`pay_status`** (was `planner_status`). `Dashboard_Script_Payments.html`.
- **Help**: **Upcoming expenses** section + TOC; Cash Flow intro links to Upcoming / Donations / Bills Due; **Bills Due** documents load errors under the panel heading; sheet list includes **INPUT - Upcoming Expenses**. `Dashboard_Help.html`.

---

## Recent — Quick add wording + Activity page

- **Quick add** (UI) vs **`quick_pay`** (sheet event): aligned across `TESTING_PLAN.md`, `GoingToProduction.md`, `TODO.md` (incl. `planner_status` inventory #19), `PROJECT_CONTEXT.md`, `SESSION_NOTES.md`, `Dashboard_Help.html`, `activity_log.js` header comment.
- **Activity** (`Dashboard_Body.html` `#page_activity`): removed redundant intro paragraph; full explanation stays in **Help → Activity log**. Removed unused `.activity-intro` from `Dashboard_Styles.html`.

---

## LOG - Activity (audit log)

- **Tab**: `LOG - Activity` — created on first log if missing; header row: Logged At, Event Type, Entry Date, Amount, Direction, Payee, Category, Account / Source, Cash Flow Sheet, Cash Flow Month, Dedupe Key, Details.
- **Phase 1**: `quick_pay` after successful `quickAddPayment` (`quick_add_payment.js`); Details JSON includes previous/new cell values, signed amount, `createIfMissing`, optional debt balance note. Payload may set **`suppressActivityLog: true`** when a higher-level flow already logged the action (e.g. **House Expense** saves that also post to Cash Flow — avoids a second `quick_pay` row next to `house_expense`).
- **Phase 2**: `bill_skip` when Bills Due skip writes **0** into Cash Flow (`skipDashboardBill` in `dashboard_data.js`); `bill_autopay` after INPUT - Bills autopay write; **dedupe** on `bill_autopay::…` so dashboard refresh does not duplicate rows (`buildBillAutopayDedupeKey_`, `activityLogDedupeKeyExists_`).
- **Phase 4**: `house_expense` after **`addHouseExpense`** (`house_expenses.js`); **Category** on the log row matches the House Expenses form **Type** (Repair, Maintenance, Utilities, etc.; stored **Tax** → **Property Tax** in the Activity **Type** column).
- **Server**: `activity_log.js` — `getActivityDashboardData` (filters + derived kinds + **500** match cap; each row includes **sheetRow** for the physical line on **LOG - Activity**). **`deleteActivityLogRow(row)`** accepts **only** **`donation`** event type (others return error). For donations, may call **`tryDeleteDonationRowForActivityUndo_`** (`donations.js`) when **Details** + fingerprint match, then deletes the log row. **Entry Date** on the log is normalized with **`activityLogEntryDateToYyyyMmDd_`** before compare—`getValues()` often returns a **Date** for that column, not the literal `yyyy-MM-dd` string, which previously made fingerprint date checks always fail. Append failures use `Logger.log` and do not block payments/skips.
- **Tab visibility**: `ensureActivityLogSheet_(ss)` runs at the start of **`buildDashboardSnapshot_`** and **`getBillsDueFromCashFlowForDashboard`** so **LOG - Activity** exists after **Overview refresh** or **Bills Due load**, even before any row is appended. Skip logging no longer requires `getDashboardBillByKey_` to succeed (fallback payee + month column from the Cash Flow header row).
- **Web UI**: **Activity** page (top nav) — logged **from/to** on one row, **Payee** contains, **Type** `<select>` (options = distinct kinds from **LOG - Activity**, same derivation as the Type column), amount min/max, **Apply** → up to **500** matches; table **sort** applies to that full filtered set, then **20 rows per page** with Previous/Next; **Remove** is **enabled only for `donation`** rows (others greyed out); **`deleteActivityLogRow`** rejects non-donation. For donations, removes log row and may remove matching **INPUT - Donation** row. `Dashboard_Script_Activity.html`, `Dashboard_Body.html` `#page_activity`.
- **Debt Planner email** — Compact action block (overdue, pay now / pay soon line items); debts omitted when the **current** Cash Flow month already “handles” that payment (same rule as Bills Due); term definitions in Help **Debt Planner email** only.

---

## SYS - House Assets — Property type column

- **Layout**: `House | Type | Loan Amount Left | Current Value` (optional **Type**; if absent, code behaves as before).
- **Sync**: `syncAllHouseAssetsFromLatestCurrentYear_` still updates **Current Value** only (by header); **Type** and **Loan Amount Left** are never overwritten from INPUT - House Values.
- **API**: `getHouseAssetsHeaderMap_` / `getHouseAssetRowData_` expose **propertyType**; `getHouseValueForDate` returns **propertyType** for UIs.
- **Property performance**: Cash Flow **rent** is summed only when **Type** is **Rental** or **Renal** (typo); **Home**, **Vacation Home**, etc. show **$0** rent. Empty **Type** keeps legacy behavior (still sum rent). Table includes a **Type** column (from SYS).
- **Planner**: `normalizeHouseAssets_` includes **propertyType** from column **Type**.

---

## Cash Flow — Quick add: previous month (info box)

- **Behavior**: **Previous month** in the UI = **cell value** on the **prior calendar month** for the same **Type + Payee** on that year's **INPUT - Cash Flow** tab. **January** date → **December** of the **previous calendar year** → read from **INPUT - Cash Flow (year−1)** (e.g. Jan-26 on 2026 tab → Dec-25 on **2025** tab). Each tab only has **Jan-YY … Dec-YY** for that year, so “last month” for January is **never** on the current year’s tab. Not a delta.
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

- **Quick add** / **Bills Due** (bill pay): sped up screen updates (faster round-trip pattern).
- **Debts / credit cards**: show cards in the UI even when balance is $0 where applicable.
- **Debts — non-loan payments**: payment amount subtracted from the displayed balance for non-loan debt rows (see debt sheet logic).
- **Bills Due / recurring**: `hasHistory` guard removed in `getRecurringBillsWithoutDueDateForDashboard()` in `dashboard_data.js` so unmapped Cash Flow rows can still surface; a short comment in code documents how to restore the old gate if needed.

---

## Properties — Property performance tab (commit: feature + HOUSES matching + tabs layout)

- **CashCompass web → Properties**: new sub-tab **Property performance** next to **House Expenses** (CSS: `properties-tabs` uses two columns like other tab rows).
- **Data**: `property_performance.js` + `getPropertyPerformanceData` — per row in **SYS - House Assets**: **Type** (SYS column), equity, rent (calendar year from **INPUT - Cash Flow** `Income` rows whose Payee matches `Rent {House name}` with optional suffix), expenses (sum **Cost + Service Fees** on **HOUSES - …** for that year). Portfolio mini-cards sum columns. Property performance table shows **Type** next to **House**.
- **HOUSES matching / expenses**: resolve tab by exact `HOUSES - {House}` first, then normalized match on location suffix (case/spacing). Expense totals use the resolved sheet’s location key (UI no longer shows a Yes/— column).
- **Files**: `property_performance.js`, `Dashboard_Script_PropertyPerformance.html`, `Dashboard_Body.html`, `Dashboard_Script_Render.html`, `PlannerDashboardWeb.html`, `Dashboard_Styles.html`.
- **Sheet naming**: align **INPUT - House Values** `House`, **SYS - House Assets** `House`, **`HOUSES - {same}`**, and Cash Flow **`Rent {same}`**; optional mismatch handled by normalized HOUSES lookup only when strings match after normalize.

---

## Date parsing — local ISO `YYYY-MM-DD` (avoid UTC month shift)

- **Bug**: `new Date('2026-04-01')` is parsed as **UTC** midnight, so in US timezones the **local** month/day can be the **previous** calendar day → wrong month label and wrong month column (e.g. Apr 1 → Mar-xx).
- **Fix**: use **`parseIsoDateLocal_`** from `quick_add_payment.js` (`new Date(y, m-1, d)` in script timezone) for HTML `<input type="date">` payloads.
- **Touched**: `house_values.js` (get/update house value), `bank_accounts.js`, `investments.js`, `house_expenses.js` (`addHouseExpense`), `upcoming_expenses.js` (`addUpcomingExpense`). **Quick add** already used the helper.

---

## House Expenses — Type dropdown label

- **Change**: display label **Tax** → **Property Tax** in Add House Expense (Type). The option still uses **`value="Tax"`** so existing HOUSES sheet rows and stored values stay valid.
- **Files**: `Dashboard_Body.html`, `HouseExpensesUI.html`.

---

## Operations Snapshot — Bills next 7 days

- **UI**: first row in **Operations Snapshot** card: **Bills Next 7 Days** — sum of **`amount`** for bills in **`getBillsDueFromCashFlowForDashboard()`** `next7` (same as Bills Due list). Click opens **Cash Flow → Bills Due**.
- **Files**: `Dashboard_Body.html`, `Dashboard_Script_BillsDue.html`.
- **Bills Due cards (compact UI)**: Each card shows **name**, **amount**, **due date**, **Pay** / **Skip** only—no duplicate “suggested amount,” no category/autopay/varies/source line. Details in Help **`#help-bills-due`**. Recurring row: one short meta line. Styles: `.bill-card-compact`, `.bill-card-actions` in `Dashboard_Styles.html`.
- **Bills Due status**: `bills_due_status` under the Bills Due panel head; Pay/Skip success and errors use it, and **initial load** failures for `getBillsDueFromCashFlowForDashboard` use it too (not `planner_status`). Overview Bills card summary still shows the load error when applicable.

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
- **Buffer Runway**: **detail** + **`runway_months_line`** (`monthsLine`). **Non-negative projected cash flow**: **`monthsLine`** = **`usable ÷ Total Minimum Payments`** when min payments &gt; 0; else **“Many months+”** if usable &gt; 0; else **—**. **Negative cash flow (burn)**: **`label`** = months from usable ÷ burn; **`monthsLine`** omitted (no duplicate under headline). Style: **`.runway-months-line`**; **`:empty`** hidden in `Dashboard_Styles.html`.

---

## CashCompass web — split workspace scripts (replaces `Dashboard_Script_Features_1.html`)

- **Was**: one large `Dashboard_Script_Features_1.html` (House Values, House Expenses, Bank, Investments, Debts, Upcoming, Retirement, Purchase sim).
- **Now**: seven includes after `Dashboard_Script_Render` in `PlannerDashboardWeb.html`: `Dashboard_Script_AssetsHouseValues`, `Dashboard_Script_PropertiesHouseExpenses`, `Dashboard_Script_AssetsBankInvestments`, `Dashboard_Script_PlanningDebts`, `Dashboard_Script_CashFlowUpcoming`, `Dashboard_Script_PlanningRetirement`, `Dashboard_Script_PlanningPurchaseSim`.
- **Globals** (`bankCurrentData`, `houseExpenseOptions`, etc.) stay in `Dashboard_Script_Render.html`.

---

## CashCompass web — Help page (no nav tab)

- **Entry**: Prominent **Help** button in the top bar with Run Planner; opens `page_help` via `showPage('help')` (not a sixth page tab).
- **Content**: `Dashboard_Help.html` included from **`PlannerDashboardWeb.html`** after `Dashboard_Body` (same template level — `includeHtml_` uses `getRawContent()`, so nested `<?!= … ?>` inside Body does not run).
- **JS**: `scrollHelpToSection`, `openHelpToSection`; delegated clicks on `.help-toc a` use `preventDefault` + `scrollIntoView` to avoid hash/sticky layout jumps (Safari).
- **CSS**: `.help-toc-wrap` sticky wrapper, `.help-section` `scroll-margin-top`; styles in `Dashboard_Styles.html`.
- **Property performance**: Table has no **HOUSES sheet** column (matching is documented in Help only); no in-panel footnote.
- **Help — property performance copy**: **HOUSES sheet** paragraph explains tab alignment (not a table column); **Expenses** + **HOUSES sheet** split for clarity.

---

## CashCompass web — loading spinner (CSS + `setStatusLoading`)

- **CSS** (`Dashboard_Styles.html`): `.dash-loading`, `.dash-loading-spinner`, `.dash-loading--block`, `.dash-loading--center`, `dash-loading-spin` keyframes; `prefers-reduced-motion` tames animation.
- **JS** (`Dashboard_Script_Render.html`): `loadingIndicatorHtml`, `loadingBlockHtml`, `setStatusLoading` (after `escapeHtml`).
- **Used for**: house/bank/investments/debt fetch status lines; property performance status + table row; **Run planner** status; house expense summaries/recent; bills due lists + recurring; initial placeholders in `Dashboard_Body.html`.
- **Standalone**: `PlannerDashboard.html` includes same spinner styles + `setStatusLoading` for assets tabs.

---

## Dead code — removed unreferenced dashboard HTML

- **Removed**: `Dashboard_Script_DueCards.html`, `Dashboard_Script_Core.html`, `Dashboard_Script_Utils.html` (never `includeHtml_`’d from `PlannerDashboardWeb.html` nor `createHtmlOutputFromFile` elsewhere). **Revert**: restore those files from git history if a mirror is needed again.

---

## Donations — INPUT - Donation (web dashboard)

- **UI:** **Cash Flow → Donations** (`Dashboard_Body.html`, `Dashboard_Script_Donations.html`, `PlannerDashboardWeb.html` include). **`showTab('donations')`** switches to Cash Flow and loads form data.
- **Backend:** `donations.js` — `getDonationsFormData` (tax years from `Year` rows, distinct **Name of Charity** and **Payment type** lists), `addDonation` (find block by tax year, append after last non-empty row in block; headers must match **Name of Charity**, **Date**, **Amount**, **Tax Year**, **Comments**, **Payment type**). Successful saves append **LOG - Activity** with `eventType` **donation** (`appendActivityLog_`); Activity **Type** = **Donation** (`classifyActivityKind_` in `activity_log.js`).
- **UI:** Charity and payment type are `<select>` lists from the sheet + **Other…**; **payment type is required**. Sheet values **Check #4768** etc. collapse to one **Check** option; choosing Check shows **Check #** field and saves as `Check #` + number. **Recent donations** (right column) lists newest rows across all year blocks. Details in **Help → Donations**.
- **Formats:** New rows copy **PASTE_FORMAT** from the last existing data row in that tax-year block when possible; first row in an empty block keeps explicit Date/Amount formats.
- **Help:** `Dashboard_Help.html` § Donations + sheet list **INPUT - Donation**.

---

## First run doc

- **`FIRST_RUN.md`** — One-page setup: prerequisites, time zone, workbook/template, clasp vs editor, web app deploy (`USER_DEPLOYING` / `MYSELF`), Script Properties URL, smoke check, “do not rename” warnings. Linked from **`INIT_PROMPT.md`**, **`GoingToProduction.md`** Phase 1, **`PROJECT_CONTEXT.md`** § First-time setup (optional template link placeholder).

---

## Contributor docs — `includeHtml_` + release safety net (TODO #18, #23)

- **`WORKING_RULES.md`** — New § **HtmlService includes (`includeHtml_`)**: `getRawContent()` / no nested template tags in included fragments; where to put `<?!= … ?>`.
- **`PROJECT_CONTEXT.md`** — Backend bullet + resolved-infra pointer to that section; **Next task** now defers to **`TODO.md`**.
- **`TESTING_PLAN.md`** — § **Light safety net**: manual checklist after risky dashboard edits; `grep` commands to list `PlannerDashboardWeb.html` includes and flag orphan `Dashboard_Script_*.html`; note on `PlannerDashboard.html` vs web app.
