SAMER Financial Planner

TO DO and issues I see in the testing


	1.	Subscriptions
	2.	Donnations - add a new UI for it too
	3.	Income/Expense Classification
	4.	Recurring Payments
	5.	Fix SKIP issue in the Due Payments - adds 0 but does not refresh the screen (BUG)
	    ⁃	   DONE
	6.	Add ability to add new cards/loans etc to Debts Pages
	7.	Add new bills to INPUT - Bills
	8.	Cleanup the Debts/Bills sheets now that we have the other stuff 
	    ⁃	Only Debts should be here and other move to Bills
	9.	Credit card should always list regardless of value in the Input Debts since we might have charged to them but not showing up or is that already there ?
	    ⁃	DONE
	10.	On the Debt update page we should update the screen on the bottom and right like we did for Quick Pay 
	⁃	The right updates but takes way too long - a BUG 
	⁃	The bottom is never shown we should add it - new 
	11.	 New request on anything in debt other than the loans we should subtract that amount from the balance as long as it does not go < 0. If <0 then set that value to 0 after the payment is done
	    ⁃	DONE 
	12.	On Upcoming bills additions - Few changes
	    ⁃	Bring a list of categories from a pull down menu
	    ⁃	A2. If other - provide a field to add your own
	    ⁃	B. Acount/Source 
	    ⁃	Make it a pull down from the list of Accounts or Credit Cards 
	13.	We should split credit card into 2 parts
	    ⁃	Normal ones I can use for everything 
	    ⁃	Merchant Specific like HD/Lowes/Macys etc…
    14. tune loans/HELOC (principal vs interest, or partial paydown rules) to reduce from Debts
	15. Need to hook up Tax workflow into the system

---

## Codebase cleanups (do over time)

Technical debt and consistency work suggested from repo review; no rush—pick off incrementally.

16. **Two dashboards** — `PlannerDashboardWeb` + modular `Dashboard_*` is canonical (`doGet`). `PlannerDashboard.html` is sidebar HTML from the spreadsheet menu. Decide: Web-only maintenance, or one shared source of scripts/styles so fixes aren’t duplicated.

17. **Mirrored scripts** — `Dashboard_Script_BillsDue.html` vs `Dashboard_Script_DueCards.html` (DueCards not included by web app). Remove unused file, or merge to a single include; avoid two copies drifting.

18. **`Dashboard_Script_Core.html` vs `Dashboard_Script_Render.html`** — “Offline mirror” of render helpers. Single source of truth, or documented sync rule, or delete Core if nothing uses it.

19. **`Dashboard_Script_Utils.html`** — Not wired into `PlannerDashboardWeb.html`. Confirm dead vs used elsewhere; remove or document.

20. **HtmlService includes** — `includeHtml_` uses `getRawContent()`; nested `<?!= … ?>` inside included HTML does not run. Document once in `WORKING_RULES.md` or `PROJECT_CONTEXT.md` for contributors.

21. **Status / `planner_status` audit** — After Bills Due → `bills_due_status`, scan remaining `setStatus('planner_status', …)` for actions that belong next to a specific panel.

22. **Large `dashboard_data.js`** — Optional long-term split by feature (bills, snapshot, etc.) behind stable exported function names if that file keeps growing.

23. **Client globals** — `window.__dashboardBills` / `__dashboardRecurring`; optional single namespace object to avoid future collisions.

24. **Help vs inline UI** — Keep dense explanations in Help (pattern used for Bills Due); same pass later for Upcoming, Quick Payment edge cases.

25. **Light safety net** — Manual checklist after risky changes, or a small check (e.g. grep) so BillsDue/DueCards (or Render/Core) don’t silently diverge on critical strings.

