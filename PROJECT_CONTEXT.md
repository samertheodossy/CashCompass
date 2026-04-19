# Samer Financial Planner - Project Context

We are building **CashCompass** — a Google Apps Script web dashboard (and spreadsheet sidebar) for personal finance / property / debt planning. Tagline: *Guiding your money decisions.*

## Overall system areas already in the app
- Dashboard snapshot / overview
- **Bills** (Cash Flow tab) — Internal two-view panel: **Due this period** (dated Pay / Skip cards) and **Manage bills** (table over **INPUT - Bills** with inline sort on **Payee** / **Due Day**, **Add bill**, and **Stop tracking** which sets **Active = No**). Server entry points: `addBillFromDashboard`, `deactivateBillFromDashboard` in `bills.js`. Category is a required field on Add bill.
- **Quick add** (Cash Flow tab) — expense/income lines to **INPUT - Cash Flow** (UI wording; activity log event type remains **`quick_pay`**)
- Upcoming Expenses
- House values — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateHouseFromDashboard` in `house_values.js`: sets **Active = No** on every **INPUT - House Values** row for the house and on the mirror **SYS - House Assets** row; preserves history, the **HOUSES - {House}** sheet, and name reservation. Logs **`house_deactivate`**. Inactive houses drop out of the House Values dropdown, House Expenses selector, and Property Performance rows/cards — all via the shared `getInactiveHousesSet_` rule: explicit `No / n / false / inactive` = inactive; blank = active.)
- House expenses
- Bank accounts — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateBankAccountFromDashboard` in `bank_accounts.js`: sets **Active = No** on every **INPUT - Bank Accounts** row for the account across all year blocks and on the mirror **SYS - Accounts** row; preserves month history, totals / delta, **Current Balance**, **Available Now**, **Min Buffer**, **Type**, **Use Policy**, **Priority**, and reserves the name. Logs **`bank_account_deactivate`**. `addBankAccountFromDashboard` appends a row to **INPUT - Bank Accounts** (current year block) and **SYS - Accounts** with `Active = Yes`, optionally seeding an opening balance into the matching month; Type is chosen from a controlled dropdown of existing types in **SYS - Accounts**; **Priority** is a whole-number input (1–99, default **9**) that writes the canonical **SYS - Accounts → Priority** column consumed by `planner_core.js → normalizeAccounts_`; new **SYS - Accounts** rows inherit neighbor row formatting (borders, font, number formats, row height) via `findAccountsTemplateRow_` + `PASTE_FORMAT`; logs **`bank_account_add`** with Amount = opening balance (or 0 when not supplied). Inactive accounts drop out of the Bank Account dropdown via the shared filter: explicit `No / n / false / inactive` = inactive; blank = active.)
- Investments — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateInvestmentAccountFromDashboard` in `investments.js`: sets **Active = No** on every **INPUT - Investments** row for the account across all year blocks and on the mirror **SYS - Assets** row; preserves month history, totals / delta, Current Balance, and reserves the name. Logs **`investment_deactivate`**. `addInvestmentAccountFromDashboard` appends a row to **INPUT - Investments** (current year block) and **SYS - Assets** with `Active = Yes`, optionally seeding a starting value into the matching month; Type is chosen from a controlled dropdown of existing types in **SYS - Assets**; logs **`investment_add`**. Inactive accounts drop out of the Investment Account dropdown via the shared filter: explicit `No / n / false / inactive` = inactive; blank = active.)
- Debts
- **Debt Overview** (Planning tab) — Read-only reference view of debt structure (balances, minimums, APRs, estimated payoff at current minimums) from **INPUT - Debts** plus **CF paid** trailing-two-year sums from **INPUT - Cash Flow**. Renamed from the older "Payoff Path"; not an action planner.
- **Rolling Debt Payoff** (Planning tab) — Monthly decision engine. Standalone React bundle (`components/RollingDebtPayoffDashboard.tsx` → `RollingDebtPayoffDashboardBundle.html`). Opens in **Standard** mode (Cash-to-use-now input, narrative Decision card with Recommendation/Why/Caution, HELOC strategy card with *What would change this?* levers, compact Payment result table using **Small balance / Focus debt / Next debt / Excess** role labels and **Paid off (this month) / Partially paid** actions, per-row **[Add payment]** pill that calls host `window.prefillQuickPayment` to open **Cash Flow → Quick add** pre-filled, **Why not more?** breakdown whose `[View]` pills route to **Cash Flow → Upcoming**). A single **Show details / Hide details** toggle reveals the full planner output (cash bridge audit, allocation audit, 12-month cash table, yearly projection, diagnostics, JSON). Liquidity model is calculated from **SYS - Accounts** (Safe-to-use = Total cash − Reserve − Buffer − Near-term hold − Unmapped card risk hold); legacy $100k/$100k hardcoded constants retained for audit only.
- Retirement planner
- Monte Carlo / retirement success
- Purchase simulator / big purchase sim
- Planner run + OUT history snapshot logic
- **LOG - Activity** — Ledger of script actions (**quick_pay**, bill skip, bill autopay, **bill_add**, **bill_deactivate**, **house_expense**, **house_add**, **house_deactivate**, **investment_add**, **investment_deactivate**, **bank_account_add**, **bank_account_deactivate**, **donation**, upcoming lifecycle; when **Quick add** runs inside house expense with **`suppressActivityLog`**, the extra **`quick_pay`** row is omitted because **`house_expense`** already logged the save). Rows can be removed from the **Activity** page: dashboard **Remove** is enabled for **`donation`** only (may also delete a matching **INPUT - Donation** row when the fingerprint matches); other event types are sheet-only for now. Not a substitute for **OUT - History** (planner snapshots). Created automatically if missing (`activity_log.js`). **Activity** page: **getActivityDashboardData** — filters, sort, up to **500** matches, **20** per page. **Tracking stopped** rows render with **—** in Amount since no money moved.
- **INPUT - Donation** — Charitable giving by tax-year blocks (`Year` row + header row + data). **Cash Flow → Donations** appends rows (`donations.js`); does not write **INPUT - Cash Flow**.
- **Car / vehicle expenses** — Often a **separate dedicated sheet** in the workbook today; **not** integrated in the dashboard yet. See **`TODO.md`** (Product / testing) for the open design item.

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
- Dashboard_Script_Donations.html
- Dashboard_Script_PlanningRetirement.html
- Dashboard_Script_PlanningPurchaseSim.html
- Dashboard_Script_PropertyPerformance.html
- Dashboard_Script_Payments.html
- Dashboard_Script_BillsDue.html
- Dashboard_Script_Activity.html
- RollingDebtPayoffDashboardBundle.html — prebuilt React bundle for the **Rolling Debt Payoff** tab (source: `components/RollingDebtPayoffDashboard.tsx`; build: `npm run build:rolling-dashboard`; typecheck: `npx tsc --noEmit -p tsconfig.rolling-dashboard.json`). Calls host globals `window.prefillQuickPayment`, `window.showPage`, `window.showTab` with defensive guards for standalone environments.

### Backend files
- webapp.js = main doGet()
- html_includes.js = `includeHtml_()` — **raw** file content only; nested `<?!= … ?>` inside included files does **not** run (see `WORKING_RULES.md` § HtmlService includes).
- dashboard_data.js = main dashboard snapshot + bills due backend (case/whitespace-tolerant `INPUT - Bills` header lookup in `getInputBillsDueRows_`)
- activity_log.js = LOG - Activity (`appendActivityLog_`, `deleteActivityLogRow` donation-only from web UI, dedupe keys for bill autopay, `getActivityDashboardData` / `getActivityLogForDashboard`, house expense + suppress duplicate **`quick_pay`** when CF is posted from the same save, `bill_add` / `bill_deactivate` / `house_add` / `house_deactivate` / `investment_add` / `investment_deactivate` / `bank_account_deactivate` classification; `bill_deactivate`, `house_deactivate`, `investment_deactivate`, and `bank_account_deactivate` marked non-monetary so Amount renders as **—**. `bank_account_add` is monetary — Amount shows the supplied opening balance, or 0 when none was provided.)
- investments.js = `addInvestmentAccountFromDashboard`, `deactivateInvestmentAccountFromDashboard`, `getInvestmentUiData` (active-only accounts + Type dropdown options). Self-heals the **Active** column on every **INPUT - Investments** year block and on **SYS - Assets**; preserves totals / delta rows when inserting new account rows.
- bank_accounts.js = `addBankAccountFromDashboard`, `deactivateBankAccountFromDashboard`, `getBankAccountUiData` (active-only accounts + Type dropdown options + Use Policy datalist). Self-heals the **Active** column on every **INPUT - Bank Accounts** year block and on **SYS - Accounts**; preserves totals / delta rows; appended **SYS - Accounts** rows inherit neighbor row formatting (borders, font, number formats, row height) via `findAccountsTemplateRow_` + `PASTE_FORMAT`. Writes **Priority** (default 9, range 1–99) to the canonical **SYS - Accounts → Priority** column when present.
- bills.js = `addBillFromDashboard`, `deactivateBillFromDashboard`; case/whitespace-tolerant header lookup; self-heals **INPUT - Bills** by auto-adding missing optional columns (Payment Source, Category, Frequency, Start Month, Notes) before append
- quick_add_payment.js = `quickAddPayment`, `getQuickAddPreview`, prefill API; `resolveFlowSourceFromBillOrDebt_` server-side fallback populates **Flow Source** on newly created Cash Flow rows from **INPUT - Bills.Payment Source** (or inferred CREDIT_CARD / CASH from **INPUT - Debts**) when the caller doesn't pass one
- donations.js = **INPUT - Donation** append (`getDonationsFormData`, `addDonation`)
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
Columns (header lookup is **case- and whitespace-tolerant** — `PAYMENT SOURCE` and `Payment Source ` with a trailing space both match):
- Payee
- Category *(required for new bills via Add bill)*
- Due Day
- Default Amount
- Varies
- Autopay
- Active *(Stop tracking sets this to `No`)*
- Payment Source *(CASH | CREDIT_CARD — drives **Flow Source** on Cash Flow rows created from Bills → Pay)*
- Frequency
- Start Month *(rows created from Bills → Pay leave months before this blank)*
- Notes

Missing optional columns (Payment Source, Category, Frequency, Start Month, Notes) are auto-added by `addBillFromDashboard` before writing a new row.

## Bills behavior wanted
- If current month due date passed and Cash Flow cell is blank, show overdue
- If current month is handled, roll forward and show next cycle when appropriate
- Quarterly bills should only apply in scheduled months
- Autopay = Yes and Varies = No → okay to auto-write
- Autopay = Yes and Varies = Yes → do not auto-write
- Default Amount = 0 → still list in Bills Due when unhandled; autopay does not write (use Pay / manual Cash Flow for the amount)
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

## Release / “how far from 1.0?”
See **`GoingToProduction.md`** — Goal A vs B, suggested **v0.9** label, three-bar interpretation of **1.0**, and what blocks broader distribution. Update that file when the readiness story changes so chat sessions don’t re-derive it.

## First-time setup
- Step-by-step (workbook, deploy web app, smoke check): **`FIRST_RUN.md`**.  
- **Canonical template workbook (optional):** Add a “known good” Google Sheets link here when you freeze one for your household—omit from public repos if the URL is sensitive.  
  - *Template link: (none yet — add when ready.)*