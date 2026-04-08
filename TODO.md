SAMER Financial Planner

TO DO and issues I see in the testing

*(Numbers below keep the original list IDs; gaps **5**, **9**, **11** in the product list and **17** in codebase items are recorded under **DONE** at the bottom.)*

---

## Open items (not done)

### Important — Activity / HISTORY flow (LOG - Activity vs OUT - History)

**LOG - Activity** = **event** ledger (who/when/amount); dashboard **Remove** is **donation-only** for now (**`deleteActivityLogRow`**); donations may also remove a matching **INPUT - Donation** row. Other event types: greyed UI + delete on the sheet if needed. **Smart undo** for Quick Pay / house expense / bills — phased list below. **OUT - History** = **planner run** snapshots. Implementation: **`activity_log.js`**, **`appendActivityLog_`**, Help **Activity log**.

**Done (recent)**  
- **Phase 4 — House expenses** — **`house_expense`** after **`addHouseExpense`**; if the form also posts to Cash Flow, **`quickAddPayment`** runs with **`suppressActivityLog: true`** so you do not get a second **`quick_pay`** row for the same save. Activity **Type** uses the House Expenses form type (Repair, **Maintenance**, Utilities, etc.; stored **Tax** displays as **Property Tax**).  
- **Activity page UI** — Logged **date range** (from/to on one row in the toolbar), **Payee** contains, **Type** dropdown (options computed from all rows in **LOG - Activity**, same rules as the Type column), **Amount** min/max, sortable table, **20 rows per page** with Previous/Next (**500** matching rows max per Apply; summary notes if truncated). Backend: **`getActivityDashboardData`**.  
- **Debt Planner email** — Short action block (overdue, pay‑now / pay‑soon line items), debts omitted when the current Cash Flow month is already “handled,” definitions in Help **Debt Planner email** (not repeated in the email body).

**Still open**  
- **Phase 3 — Upcoming** — Dedicated events for add / status / paid / push to Cash Flow (today, push to CF only adds **`quick_pay`**).  
- **Phase 5 (optional)** — Correlate events to **OUT - History** / planner run.  
- **Optional:** Activity **CSV export**; **last N events** on Overview; **onEdit** logging for manual Cash Flow typing.

**Pattern (reference)**  
- Audit after successful writes; log rows removable from UI for mistakes; deeper “reverse transaction” only when phased preconditions are met. **v1:** script-driven paths. **Later:** onEdit, etc.

| Flow | Status |
|------|--------|
| Quick Add Payment | **Done** — `quick_pay` at end of **`quickAddPayment`**. |
| Bills Due → Skip | **Done** — **`skipDashboardBill`**. |
| Bills Due → Autopay | **Done** — dedupe key on refresh. |
| Upcoming expenses | **Open** — Phase 3. |
| House expenses | **Done** — **`addHouseExpense`** → `house_expense`; CF via Quick Pay + **`suppressActivityLog`**. |

**Phased rollout**  
1. **Phase 1 — Quick Pay** — **Done**  
2. **Phase 2 — Skip + autopay** — **Done**  
3. **Phase 3 — Upcoming** — **Open**  
4. **Phase 4 — House expenses** — **Done**  
5. **Phase 5 — OUT - History tie-in** — **Open** (optional)  
6. **Activity UI** — **Done** (filters, type from sheet, paging, sort); **CSV export** optional later

### Activity — Smart undo / “reverse transaction”

**Context:** Activity **Remove** always deletes the **LOG - Activity** row. **Phase 1 (donation)** is **implemented**: see **`tryDeleteDonationRowForActivityUndo_`** in **`donations.js`** and **`deleteActivityLogRow`** in **`activity_log.js`**. Phases 2–4 below are still optional follow-ons.

**Fool-proof principles (apply to any phase)**

1. **No guessing** — Never infer missing prior state (e.g. cell value before a skip wrote `0`); only use what was stored in log **Details** (consider `detailsVersion` if shape evolves).
2. **Precondition gate** — Before mutating INPUT/SYS: e.g. current cell **===** logged `newValue` (with same rounding rules as writes); donation row still matches a **fingerprint** of logged fields + `sheetRow`.
3. **UX** — Keep **Remove log only**; add a **separate** explicit action for “Reverse transaction and remove log” with a **second** confirmation listing exact sheet / row / cell / values.
4. **Idempotent / safe failure** — If the sheet changed since the log row was written, **abort** with a clear message (no partial silent fixes).
5. **Audit** — Prefer explicit success text listing what changed; optional future `activity_undo` log row if you want a paper trail.

**Phased implementation (in order)**

| Phase | Event type(s) | Risk | What it entails |
|-------|----------------|------|------------------|
| **1 — Done** | **`donation`** | **Lowest** | **Shipped:** Details carry **`sheetRow`** + fingerprint fields; **`deleteActivityLogRow`** calls **`tryDeleteDonationRowForActivityUndo_`** when safe, then deletes the log row. Older donation logs without **`sheetRow`** only remove the log line. |
| **2** | **`quick_pay`** | Medium | Details must include **`previousValue` / `newValue`** (and stable CF sheet + row + month resolution). Reverse **only if** current cell matches logged `newValue`. Debt balance change: undo only if Details allow **verification** of post-state, or **exclude** from v1 and document manual **INPUT - Debts**. |
| **3** | **`house_expense`** | Higher | Log must store house sheet, inserted row, and if CF was touched the same previous/new gates as Phase 2. Dual preconditions. |
| **4** | **`bill_skip` / `bill_autopay`** | High until logging fixed | **First** extend writers to log **previousValue**, **newValue**, and coordinates; **then** same cell-match reversal as Phase 2. **Do not** ship auto-undo for these without that logging. |

**Explicit non-goals**

- Generic undo from payee + amount + date alone.
- “Subtract logged amount from current cell” without proving current value still equals logged **newValue**.

**Activity Remove — dashboard scope (temporary)**  
- **Remove** in the web UI is **enabled only for `donation`** rows (`eventType` **donation**). Other types show a **greyed-out** control; **`deleteActivityLogRow`** rejects non-donation with a clear error (sheet-only delete still works). **Re-enable per type** as Phases 2–4 ship: set **`quick_pay`**, **`house_expense`**, then skip/autopay after logging upgrades—each needs UI enable + server gate + undo implementation.

---

### Product / testing

**Car expenses (dedicated sheet today)**  
- **Open — design only for now:** Vehicle costs live on **their own sheet** in the workbook (not yet first-class in the web dashboard like **HOUSES - …** / house expenses). **Decide later:** integrate into the app (which nav tab, mirror house-expense pattern, tie to Cash Flow or not), keep as sheet-only with optional **LOG - Activity** later, or fold into another category. Capture requirements before building.

1. Subscriptions

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

19. **Status / `planner_status` audit** — After Bills Due → `bills_due_status`, scan remaining `setStatus('planner_status', …)` for actions that belong next to a specific panel.

20. **Large `dashboard_data.js`** — Optional long-term split by feature (bills, snapshot, etc.) behind stable exported function names if that file keeps growing.

21. **Client globals** — `window.__dashboardBills` / `__dashboardRecurring`; optional single namespace object to avoid future collisions.

22. **Help vs inline UI** — Keep dense explanations in Help (pattern used for Bills Due); same pass later for Upcoming, Quick add edge cases.

24. **Dashboard charts (long term)** — Add trends without cluttering the UI. **Effort:** moderate; drawing is easy, the real work is **clean time series** from the backend (e.g. roll `OUT - History` or per-tab monthly series in `dashboard_data.js`). **Keep calm:** prefer **sparklines** in snapshot cards; at most **one** larger chart above the fold per page; extra charts behind **“Show trend”** or on **detail tabs** (e.g. full retirement chart on Planning, not Overview). **Good targets:** optional sparkline under **Net Worth** (or Cash) on Overview; health **score-over-time** inside **“Why this score?”**; **Buffer Runway** vs months; **Assets** panels (house/bank/investments) for **selected** entity only; **Debts** balance over time; **Cash Flow** income vs expenses if monthly history exists. **Skip / low value:** charting every row in Bills Due or dense forms.

---

## DONE (history)

Completed items kept for reference (original list numbers preserved).

**Activity ledger / UI (unnumbered)** — `house_expense` logging; no double ledger row when House Expense also writes Cash Flow; Activity **Type** filter + **getActivityDashboardData**; 20-row paging; inline date fields; Debt Planner email + Help **Debt Planner email**; Pay now/soon respect Cash Flow “handled” for current month.

**5.** Fix SKIP issue in the Due Payments — adds 0 but does not refresh the screen (BUG). *(Marked done in prior testing; skip flow + UI refresh addressed.)*

**9.** Credit card should always list regardless of value in the Input Debts since we might have charged to them but not showing up or is that already there? *(Marked done.)*

**11.** New request on anything in debt other than the loans we should subtract that amount from the balance as long as it does not go < 0. If <0 then set that value to 0 after the payment is done. *(Marked done.)*

**17.** **Codebase — removed unused HTML** (done in repo): `Dashboard_Script_DueCards.html`, `Dashboard_Script_Core.html`, `Dashboard_Script_Utils.html` — were not referenced by any `includeHtml_` or `createHtmlOutputFromFile`. *Revert from git if a mirror is needed again.*

**18.** **HtmlService includes** — Documented in `WORKING_RULES.md` § HtmlService includes (`includeHtml_` + `getRawContent()`; no nested template tags in fragments). Cross-reference in `PROJECT_CONTEXT.md`.

**23.** **Light safety net** — Manual checklist + `rg` include/orphan checks in `TESTING_PLAN.md` § Light safety net; notes on `PlannerDashboard.html` vs web app drift.

**2.** **Donations UI** — **Cash Flow → Donations** tab: append rows to **INPUT - Donation** by tax-year block (`donations.js`, `Dashboard_Script_Donations.html`, Help **Donations**). *(Sidebar-only UI not required for this item.)*
