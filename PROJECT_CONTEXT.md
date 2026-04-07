# Samer Financial Planner - Project Context

We are building a Google Apps Script Planner Dashboard for personal finance / property / debt planning.

## Overall system areas already in the app
- Dashboard snapshot / overview
- Bills Due
- Quick Payment
- Upcoming Expenses
- House values
- House expenses
- Bank accounts
- Investments
- Debts
- Retirement planner
- Monte Carlo / retirement success
- Purchase simulator / big purchase sim
- Planner run + OUT history snapshot logic
- **LOG - Activity** — append-only ledger of script actions (Quick Pay, bill skip, bill autopay, **house expense** on save; nested Quick Pay can suppress its own log row to avoid duplicates). Not a substitute for **OUT - History** (planner snapshots). Created automatically if missing (`activity_log.js`). **Activity** top-nav page: **getActivityDashboardData** — date range, payee, **type** filter (sheet-derived kinds), amount range, sort on full filtered set (up to **500** rows), **20** per page.

## Current architecture

### Main web app
- PlannerDashboardWeb.html = main wrapper
- Dashboard_Styles.html
- Dashboard_Body.html
- Dashboard_Script_Render.html (overview + shared globals/helpers)
- Dashboard_Script_AssetsHouseValues.html
- Dashboard_Script_PropertiesHouseExpenses.html
- Dashboard_Script_AssetsBankInvestments.html
- Dashboard_Script_PlanningDebts.html
- Dashboard_Script_CashFlowUpcoming.html
- Dashboard_Script_PlanningRetirement.html
- Dashboard_Script_PlanningPurchaseSim.html
- Dashboard_Script_PropertyPerformance.html
- Dashboard_Script_Payments.html
- Dashboard_Script_BillsDue.html
- Dashboard_Script_Activity.html

### Backend files
- webapp.js = main doGet()
- html_includes.js = `includeHtml_()` — **raw** file content only; nested `<?!= … ?>` inside included files does **not** run (see `WORKING_RULES.md` § HtmlService includes).
- dashboard_data.js = main dashboard snapshot + bills due backend
- activity_log.js = LOG - Activity append-only audit (`appendActivityLog_`, dedupe keys for bill autopay, `getActivityDashboardData` / `getActivityLogForDashboard`, house expense + suppress duplicate Quick Pay)
- other feature files exist for house, debts, payments, retirement, etc.

## Important resolved infra issues
- Duplicate doGet() caused template problems before. Only keep one active doGet().
- Duplicate includeHtml_() caused malformed HTML/script include problems before.
- Correct include helper should use raw content, not HTML parsing, for included script files. **Contributor detail:** `WORKING_RULES.md` explains why included fragments cannot contain their own template tags.
- The dashboard now renders correctly again.

## Current business rules for bills / cash flow
- Blank Cash Flow cell = due / unhandled
- 0 in Cash Flow = skipped / handled
- Non-zero value in Cash Flow = paid / handled

## Bills Due design now

### Debt bills
- come from DEBTS

### Mapped recurring non-debt bills
- come from INPUT - Bills

### Fallback recurring bills
- should remain visible in the Recurring Bills (No Due Date) section until they are migrated into INPUT - Bills

## INPUT - Bills structure
Columns:
- Payee
- Category
- Due Day
- Default Amount
- Varies
- Autopay
- Active
- Frequency
- Start Month
- Notes

## Bills behavior wanted
- If current month due date passed and Cash Flow cell is blank, show overdue
- If current month is handled, roll forward and show next cycle when appropriate
- Quarterly bills should only apply in scheduled months
- Autopay = Yes and Varies = No → okay to auto-write
- Autopay = Yes and Varies = Yes → do not auto-write
- Fallback recurring bills should show overdue or upcoming correctly

## Current UI state
- Bills Due is rendering
- Labels exist: category, autopay, varies, source
- Some fallback recurring bills are missing and need fixing

## Important files most likely to edit next
- dashboard_data.js
- Dashboard_Script_BillsDue.html

## Next task
See **`TODO.md`** for current priorities (there is no separate next-task file).