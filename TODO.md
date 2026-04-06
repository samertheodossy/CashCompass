SAMER Financial Planner

TO DO and issues I see in the testing

*(Numbers below keep the original list IDs; gaps **5**, **9**, **11** in the product list and **17** in codebase items are recorded under **DONE** at the bottom.)*

---

## Open items (not done)

### Important — prioritize (before most items below)

**Activity / HISTORY flow** — Event ledger for bills paid, expenses entered, skips, etc. (searchable by date/type/payee/category/account). **Not** a replacement for **OUT - History**: that tab is **planner-run snapshots** (one row per run: rolled-up cash, debt, net worth, health inputs, etc.) and answers “how did the plan look after this run?” The activity log is **discrete mutations** with business dates and payees — different grain; **add** it rather than overload OUT - History.

**Pattern (minimal behavior change)**  
- Append-only audit: **`appendActivityLog_(payload)`** (or similar) called **after** a successful write. Same cells, same errors, same user messages; only append a row when the mutation actually committed.  
- **v1 scope:** script-driven actions only. **Optional later:** bank / investment / house balance updates, or **onEdit** triggers for manual Cash Flow typing (heavier).

**Where to hook (existing code)**  

| Flow | Log after / in |
|------|------------------|
| Quick Add Payment | End of **`quickAddPayment`** (`quick_add_payment.js`) — type, payee, entry date, amount, sheet/month context, optional debt-adjustment note. |
| Bills Due → Skip | After successful **`skipDashboardBill`** (`dashboard_data.js`) — e.g. “skip / wrote 0”, payee, due date, cash-flow target. |
| Bills Due → Autopay | Today autopay calls **`writeDashboardBillValuePreserveFormat_`** from **`getInputBillsDueRows_`** on **read/refresh**. Do **not** blindly log inside the low-level writer (runs often). Log only on **real transition** (e.g. cell was unhandled → now has value), or only in the autopay branch after a successful write, with a stable **dedupe key** (payee + due month + amount) so repeated dashboard loads do not duplicate rows. |
| Upcoming expenses | **`addUpcomingExpense`** and any path that changes status or **adds to Cash Flow** (`upcoming_expenses.js`; several `touchDashboardSourceUpdated_` sites). |
| House expenses | **`addHouseExpense`** (`house_expenses.js`). |

**Storage (sheet-friendly)**  
- New tab e.g. **`OUT - Activity`** or **`LOG - Activity`**, **append-only**. Suggested columns: **Logged At** (script timestamp, ISO); **Event Type** (`quick_pay`, `bill_autopay`, `bill_skip`, `upcoming_added`, `upcoming_paid`, `upcoming_to_cash_flow`, `house_expense`, …); **Entry Date** (user-chosen / due — “when it happened in life”); **Amount** (pick one convention: signed expense negative, or always positive + **Direction**); **Payee / Name**; **Category**; **Account / Source**; **Cash Flow sheet name** + **month column** (optional, “where it landed”); **Reference / Details** (upcoming ID, skip key, short JSON). Optional: **Result** if logging failures (usually log success only to reduce noise).  
- **Scale:** Filter/sort in Apps Script or client; later: monthly archive tabs or row-cap trim if needed.

**Using the data (UI — can ship after logging works)**  
- **Activity / History** page: date range, type multi-select, payee search, optional CSV export.  
- **Cash Flow** remains **ledger of record** for totals; activity log is **provenance** (“we recorded this action at this time”).  
- Optional: **last N events** on Overview with link to full history (keep uncluttered).

**Risks / decisions**  
- **Autopay + dashboard refresh:** idempotency required (see table above).  
- **Manual cell edits** in Cash Flow: invisible to log unless triggers or accepted gap.  
- **Privacy:** same workbook sensitivity as other INPUT/OUT tabs.

**Phased rollout (stick to this order)**  
1. **Phase 1 — Quick Pay only:** ~~highest signal, single choke point (`quickAddPayment`)~~ **Done** — `LOG - Activity` + `activity_log.js`.  
2. **Phase 2 — Bill skip + bill autopay** ~~(with dedupe / transition-only logging)~~ **Done** — skip logs `bill_skip`; INPUT - Bills autopay logs `bill_autopay` with dedupe on refresh.  
3. **Phase 3 — Upcoming** lifecycle (add, paid, push to cash flow).  
4. **Phase 4 — House expenses** (`addHouseExpense`).  
5. **Phase 5 (optional):** Correlate to **OUT - History** (e.g. planner run date / id column after `runPlanner`) for “what activity sat around this run?”  
6. **UI (any phase):** Activity / History page to filter/sort/export (sheet is readable manually until then).

---

### Product / testing

1. Subscriptions

2. Donnations - add a new UI for it too

3. Income/Expense Classification

4. Recurring Payments

6. Add ability to add new cards/loans etc to Debts Pages

7. Add new bills to INPUT - Bills

8. Cleanup the Debts/Bills sheets now that we have the other stuff
   - Only Debts should be here and other move to Bills

10. On the Debt update page we should update the screen on the bottom and right like we did for Quick Pay
   - The right updates but takes way too long - a BUG
   - The bottom is never shown we should add it - new

12. On Upcoming bills additions - Few changes
   - Bring a list of categories from a pull down menu
   - A2. If other - provide a field to add your own
   - B. Acount/Source
   - Make it a pull down from the list of Accounts or Credit Cards

13. We should split credit card into 2 parts
   - Normal ones I can use for everything
   - Merchant Specific like HD/Lowes/Macys etc…

14. tune loans/HELOC (principal vs interest, or partial paydown rules) to reduce from Debts

15. Need to hook up Tax workflow into the system

### Codebase cleanups (do over time)

Technical debt and consistency work suggested from repo review; no rush—pick off incrementally.

16. **Two dashboards** — `PlannerDashboardWeb` + modular `Dashboard_*` is canonical (`doGet`). `PlannerDashboard.html` is sidebar HTML from the spreadsheet menu. Decide: Web-only maintenance, or one shared source of scripts/styles so fixes aren’t duplicated.

18. **HtmlService includes** — `includeHtml_` uses `getRawContent()`; nested `<?!= … ?>` inside included HTML does not run. Document once in `WORKING_RULES.md` or `PROJECT_CONTEXT.md` for contributors.

19. **Status / `planner_status` audit** — After Bills Due → `bills_due_status`, scan remaining `setStatus('planner_status', …)` for actions that belong next to a specific panel.

20. **Large `dashboard_data.js`** — Optional long-term split by feature (bills, snapshot, etc.) behind stable exported function names if that file keeps growing.

21. **Client globals** — `window.__dashboardBills` / `__dashboardRecurring`; optional single namespace object to avoid future collisions.

22. **Help vs inline UI** — Keep dense explanations in Help (pattern used for Bills Due); same pass later for Upcoming, Quick Payment edge cases.

23. **Light safety net** — Manual checklist after risky changes, or a small check (e.g. grep) for duplicate dashboard script drift if new mirrors are added later.

24. **Dashboard charts (long term)** — Add trends without cluttering the UI. **Effort:** moderate; drawing is easy, the real work is **clean time series** from the backend (e.g. roll `OUT - History` or per-tab monthly series in `dashboard_data.js`). **Keep calm:** prefer **sparklines** in snapshot cards; at most **one** larger chart above the fold per page; extra charts behind **“Show trend”** or on **detail tabs** (e.g. full retirement chart on Planning, not Overview). **Good targets:** optional sparkline under **Net Worth** (or Cash) on Overview; health **score-over-time** inside **“Why this score?”**; **Buffer Runway** vs months; **Assets** panels (house/bank/investments) for **selected** entity only; **Debts** balance over time; **Cash Flow** income vs expenses if monthly history exists. **Skip / low value:** charting every row in Bills Due or dense forms.

---

## DONE (history)

Completed items kept for reference (original list numbers preserved).

**5.** Fix SKIP issue in the Due Payments — adds 0 but does not refresh the screen (BUG). *(Marked done in prior testing; skip flow + UI refresh addressed.)*

**9.** Credit card should always list regardless of value in the Input Debts since we might have charged to them but not showing up or is that already there? *(Marked done.)*

**11.** New request on anything in debt other than the loans we should subtract that amount from the balance as long as it does not go < 0. If <0 then set that value to 0 after the payment is done. *(Marked done.)*

**17.** **Codebase — removed unused HTML** (done in repo): `Dashboard_Script_DueCards.html`, `Dashboard_Script_Core.html`, `Dashboard_Script_Utils.html` — were not referenced by any `includeHtml_` or `createHtmlOutputFromFile`. *Revert from git if a mirror is needed again.*
