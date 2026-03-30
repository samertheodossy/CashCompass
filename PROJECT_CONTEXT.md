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

## Current architecture

### Main web app
- PlannerDashboardWeb.html = main wrapper
- Dashboard_Styles.html
- Dashboard_Body.html
- Dashboard_Script_Render.html
- Dashboard_Script_Features_1.html
- Dashboard_Script_Payments.html
- Dashboard_Script_BillsDue.html

### Backend files
- webapp.js = main doGet()
- html_includes.js = includeHtml_() using raw content
- dashboard_data.js = main dashboard snapshot + bills due backend
- other feature files exist for house, debts, payments, retirement, etc.

## Important resolved infra issues
- Duplicate doGet() caused template problems before. Only keep one active doGet().
- Duplicate includeHtml_() caused malformed HTML/script include problems before.
- Correct include helper should use raw content, not HTML parsing, for included script files.
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
Refine Bills Due logic without breaking other features.