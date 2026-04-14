SAMER Financial Planner

TO DO and issues I see in the testing

*(Numbers below keep the original list IDs; gaps **5**, **9**, **11** in the product list and **17** in codebase items are recorded under **DONE** at the bottom.)*

---

## Open items (not done)

### Easy wins (quick fixes)

Small HTML/docs/a11y tasks; check off when shipped. *(Unnumbered — pick in any order.)*

- [ ] **Bank Add new — sidebar hint** — Add a short muted note next to the **Add new** form in **`PlannerDashboard.html`** (parity with the web app’s **`Dashboard_Body.html`** info column) so spreadsheet-menu users see the same “where rows go / year block” context.
- [ ] **Bank Add new — DRY inline copy** — On **`Dashboard_Body.html`**, replace the two-paragraph right-column blurb with **one line** plus **Help → Assets** so the canonical detail stays in **`Dashboard_Help.html`**.
- [ ] **Docs — Bank add one-liner** — Add a single bullet to **`PROJECT_CONTEXT.md`** and/or **`SESSION_NOTES.md`**: Assets → Bank Accounts → Add new (INPUT + SYS rows, no full planner on save, run **Run Planner + Refresh Snapshot** after).
- [ ] **Status lines (item 19 sweep)** — Grep for **`setStatus('planner_status', …)`**; move any remaining **panel-specific** errors to the same pattern as Bills Due / Quick add (see **Codebase cleanups → 19** below). Keep truly global init errors on **`planner_status`**.
- [ ] **Help — cross-link to Assets** — In **`Dashboard_Help.html`** **Introduction** or **Overview**, add one sentence with a link to **`#help-assets`** so “create / edit bank accounts” is discoverable from the top of Help.
- [ ] **A11y — Bank mode segment** — For **Update \| Add new**, tighten **`role` / `aria-selected`** (already partly there) with **`aria-controls`** on the tab buttons pointing at the two mode wraps, or a visible **`fieldset` / `legend`**, in **`Dashboard_Body.html`** and **`PlannerDashboard.html`**.

### Important — Activity / HISTORY flow (LOG - Activity vs OUT - History)

**LOG - Activity** = **event** ledger (who/when/amount); dashboard **Remove** is **donation-only** for now (**`deleteActivityLogRow`**); donations may also remove a matching **INPUT - Donation** row. Other event types: greyed UI + delete on the sheet if needed. **Smart undo** for **Quick add** (`quick_pay`) / house expense / bills — phased list below. **OUT - History** = **planner run** snapshots. Implementation: **`activity_log.js`**, **`appendActivityLog_`**, Help **Activity log**.

**Done (recent)**  
- **Phase 3 — Upcoming** — **`upcoming_add`** / **`upcoming_status`** / **`upcoming_cashflow`** in **`upcoming_expenses.js`**; Cash Flow from Upcoming uses **`quickAddPayment`** with **`suppressActivityLog: true`** so **`quick_pay`** is not duplicated; **`quick_add_payment.js`** returns **`activitySnapshot`** for callers.  
- **Phase 4 — House expenses** — **`house_expense`** after **`addHouseExpense`**; if the form also posts to Cash Flow, **`quickAddPayment`** runs with **`suppressActivityLog: true`** so you do not get a second **`quick_pay`** row for the same save. Activity **Type** uses the House Expenses form type (Repair, **Maintenance**, Utilities, etc.; stored **Tax** displays as **Property Tax**).  
- **Activity page UI** — Logged **date range** (from/to on one row in the toolbar), **Payee** contains, **Type** dropdown (options computed from all rows in **LOG - Activity**, same rules as the Type column), **Amount** min/max, sortable table, **20 rows per page** with Previous/Next (**500** matching rows max per Apply; summary notes if truncated). Backend: **`getActivityDashboardData`**.  
- **Debt Planner email** — Short action block (overdue, pay‑now / pay‑soon line items), debts omitted when the current Cash Flow month is already “handled,” definitions in Help **Debt Planner email** (not repeated in the email body).  
- **Assets → Bank Accounts — Add new** — **`addBankAccountFromDashboard`** (**`bank_accounts.js`**): rows on **INPUT - Bank Accounts** (current year block) + **SYS - Accounts**; **`bank_account_add`** on **LOG - Activity**; UI **Update \| Add new**; stable **Bank Accounts** heading; Help **Assets** subsection updated.

**Still open**  
- **Phase 5 (optional)** — Correlate events to **OUT - History** / planner run.  
- **Optional:** Activity **CSV export**; **last N events** on Overview; **onEdit** logging for manual Cash Flow typing.

**Pattern (reference)**  
- Audit after successful writes; log rows removable from UI for mistakes; deeper “reverse transaction” only when phased preconditions are met. **v1:** script-driven paths. **Later:** onEdit, etc.

| Flow | Status |
|------|--------|
| Quick add | **Done** — `quick_pay` at end of **`quickAddPayment`**. |
| Bills Due → Skip | **Done** — **`skipDashboardBill`**. |
| Bills Due → Autopay | **Done** — dedupe key on refresh. |
| Upcoming expenses | **Done** — Phase 3: **`upcoming_add`** / **`upcoming_status`** / **`upcoming_cashflow`**; CF push uses **`suppressActivityLog`** (no duplicate **`quick_pay`**). |
| House expenses | **Done** — **`addHouseExpense`** → `house_expense`; CF via **Quick add** + **`suppressActivityLog`**. |

**Phased rollout**  
1. **Phase 1 — Quick add** (`quick_pay`) — **Done**  
2. **Phase 2 — Skip + autopay** — **Done**  
3. **Phase 3 — Upcoming** — **Done**  
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

### Next big item — Planning: Debt payoff projection (“path out of debt”)

**Intent:** One **Planning** workspace where the user can see a **month-by-month (or month-aggregated) projection** of balances going to zero, **assuming** current **INPUT - Debts** balances, APRs, minimums, and a clear rule for **how much per month** goes to debt (a fixed “extra to debt” knob plus strategy). **Read-only v1** — no sheet writes; scenario math only. Complements **Run Planner** (point-in-time liquidity + pay-now / extra target) with a **trajectory** view.

#### How valuable is it?

**High for the right user story:** a single place that answers “If I keep paying roughly like this, **when** am I out of debt and **how much interest** do I eat?” is motivating and easier to reason about than scattered **INPUT - Debts** rows plus a one-off **Run Planner** snapshot. It complements what you already have: the planner run is **now-centric** (liquidity, pay-now, one extra target); a payoff projection is **path-centric** (months/years, ordering, totals).

**Caveats (honesty sells the feature):** revolving cards need clear assumptions (e.g. **no new charges**, fixed APR, minimum rules). Variable spending means the model is **scenario math**, not a promise—label it that way and it stays trustworthy.

#### How doable is it?

**Doable in phases.** You already have normalized debts, minimums, APRs, balances, and planner-side concepts (**`planner_core.js`**, **`runDebtPlanner`** in **`code.js`**, **`OUT - History`**). A first version can be **read-only simulation** (no sheet writes): inputs from **INPUT - Debts** (+ optional “monthly amount available for debt” from latest snapshot or a user-entered number), output as a **table + payoff month per account**.

**Harder parts (defer or simplify v1):** exact issuer minimum formulas, promo APR windows, cards with mixed balances, and syncing “I already paid this month” with Cash Flow the same way the email does—v1 can ignore that nuance or use a single **“effective monthly debt payment”** knob.

#### Where it fits in the planner (UI)

**Best fit:** **Planning → new tab** alongside **Debts**, **Retirement**, **Purchase Sim** (in **`Dashboard_Body.html`** under **`#page_planning`**, plus a new **`Dashboard_Script_PlanningDebtPayoff.html`** or similar include in **`PlannerDashboardWeb.html`**).

| Option | Pros | Cons |
|--------|------|------|
| **Fourth Planning tab** (“Payoff path” / “Debt projection”) | Clear mental model; matches Retirement / Purchase “what if” | One more tab to maintain |
| **Expand Debts panel** | Same topic | Crowded; Debts today is **field edit** UX, not analytics |
| **Overview card → drill-in** | Discovery | Easy to miss; projection deserves space |

**Recommendation:** fourth tab on **Planning**, with a one-line link from **Overview** (e.g. “Open payoff projection”) optional later.

**Concrete wiring (same as earlier spec):**

- **Planning** page (`#page_planning` in **`Dashboard_Body.html`**) — fourth tab, e.g. **Payoff path** or **Debt projection**.
- **New include:** **`Dashboard_Script_PlanningDebtPayoff.html`** in **`PlannerDashboardWeb.html`** (same pattern as **`Dashboard_Script_PlanningRetirement.html`** / Purchase Sim).

#### Suggested implementation plan (slices)

**Product spec (short)**

- **Assumptions:** no new charges on cards; APR from sheet; pay minimums unless user sets “extra to debt per month”; optional strategy: avalanche vs snowball vs minimum-only.
- **Output:** payoff date per debt, total interest (rough), month when all consumer debt hits zero.

**Backend (Apps Script)**

- Pure function e.g. **`simulateDebtPayoffSchedule_(debts, monthlyTotalToDebt, strategy, opts)`** in a small new file or **`planner_core.js`**.
- New **`google.script.run`** entry: **`getDebtPayoffProjection(payload)`** reading the spreadsheet the same way **`runDebtPlanner`** / dashboard debt loaders do — **no writes in v1**.

**Frontend**

- New script include + minimal HTML block: inputs (slider or number for extra payment, strategy dropdown), **Run projection** button, results table + simple text summary.
- Reuse currency / format helpers from existing dashboard scripts.

**Help**

- One **Planning** subsection: assumptions, limitations; link from **Debt Planner email** in Help if useful.

**Stretch (later)**

- Chart (months vs balance).
- Tie “monthly surplus” default to last **`OUT - History`** or last planner run fields.
- Export CSV.

**Data sources (reuse existing loaders)**

- **`INPUT - Debts`** through the same normalization path as **`runDebtPlanner`** / **`normalizeDebts_`** (`planner_core.js`, `code.js`): account name, type, balance, minimum payment, APR, due day, active flag, alias map where applicable.
- **Default “monthly $ to debt”** for v1: user-entered number; **stretch** suggest a default from **last `OUT - History`** / last planner summary — do **not** block v1 on perfect Cash Flow integration.

**Backend shape (Apps Script)**

1. **Pure simulation** — e.g. `simulateDebtPayoffSchedule_(normalizedDebts, monthlyTotalToDebt, strategy, options)`  
   - **Strategies (v1):** **minimum-only**, **avalanche** (extra to highest APR), **snowball** (extra to smallest balance).  
   - **Month loop:** apply minimums; allocate `monthlyTotalToDebt - sum(minimums)` per strategy; accrue interest monthly (document formula in code + Help — e.g. APR/12 on average balance or standard revolving simplification).  
   - **Safety:** cap max simulated months (e.g. 600) and cap rows returned to the client to avoid timeouts.
2. **Server entry** — e.g. `getDebtPayoffProjection(payload)` in **`debt_payoff_projection.js`** (or extend an existing debt module): read spreadsheet, normalize debts, run simulator, return JSON `{ summary, byMonth[], perDebtPayoffMonth }`.  
3. **No writes in v1** — no mutations to **INPUT - Debts** or Cash Flow from this tab.

**Frontend shape**

- Inputs: **monthly amount allocated to debt** (number), **strategy** (dropdown), **Run projection**; optional filters later (active only, exclude **Taxes** type — align with **`runDebtPlanner`** / email if product wants parity).
- Output: table (month index, aggregate balance, interest paid to date, optional per-account columns or drill-down); short summary: **first debt-free month**, **approximate total interest**.
- Reuse currency helpers and status-line patterns from other Planning scripts.

**Phased delivery (suggested)**

| Phase | Scope |
|-------|--------|
| **1 — MVP** | Fourth Planning tab + UI shell + `getDebtPayoffProjection` + strategies (minimum-only, avalanche, snowball) + fixed monthly total + table + summary; **Help** subsection under **Planning** (assumptions + limitations). |
| **2** | Pre-fill monthly payment from **last planner run** / **OUT - History** with user override + stale-data note. |
| **3** | Simple chart (balance vs month); CSV export. |
| **4** | Deeper rules only if needed: promo APR windows, tighter minimum math, HELOC draw behavior. |

**Testing / docs when shipped**

- **`TESTING_PLAN.md`** — cases: two-card avalanche ordering, snowball ordering, inactive debt excluded, zero-APR edge.  
- **`PROJECT_CONTEXT.md`** — one bullet under Planning.  
- **`SESSION_NOTES.md`** — ship note.

**Explicit non-goals (v1)**

- Auto-posting simulator results to Cash Flow or **INPUT - Debts**.  
- Full issuer-specific minimum-payment engines without a dedicated rules project.

**Related code to read before building**

- **`code.js`** — `runDebtPlanner`, `buildUpcomingPayments_`, recommendation / extra-payment paths.  
- **`planner_core.js`** — debt normalization, interest / payoff helpers.  
- **`Dashboard_Script_PlanningDebts.html`** — `google.script.run` + status + DOM update pattern.  
- **`PlannerDashboardWeb.html`** — `includeHtml_` list for adding the new script fragment.

---

### Consider — Bank / card / loan sync (Plaid or similar)

**Question:** How hard is it to hook **Plaid** (or **Finicity**, **MX**, **Yodlee**, etc.) into this app so **bank, credit card, and loan balances** land directly in the workbook / dashboard?

**Context (today’s stack):** **Google Sheets** is the system of record; **Apps Script** reads **`ACCOUNTS`**, **`DEBTS`**, **`BANK_ACCOUNTS`** / year blocks (`readSheetAsObjects_`, `bank_accounts.js`, `dashboard_data.js`, `runDebtPlanner` in **`code.js`**). Any aggregator should **still end by writing normalized rows** into those tabs (or a **staging** tab + merge) so the **rest of the planner stays unchanged**.

#### Short answer

**Not “drop-in easy” in Apps Script alone.** These APIs expect a **backend you control** that holds **`client_id` / `secret`**, creates **link tokens**, exchanges **public_token** for **access_token**, and optionally handles **webhooks**. That does not map cleanly to “only GAS + spreadsheet” because:

- **Secrets** must not live in the browser; **Script Properties** help in GAS, but you still need a **safe Plaid Link** flow and **token lifecycle** (refresh, revoke). **Webhooks** want an always-on HTTPS endpoint — awkward for GAS unless you add another service.
- **Plaid Link** runs in the **browser**; your dashboard is **HtmlService** — doable, but the real work is **Link → bridge → Sheets**, not a single REST call from the sheet.

**Practical shape:** **moderate effort with a small bridge service**; **high effort** if you insist on **100% Apps Script** with no other infra and production-grade behavior.

#### Architecture that fits this app

1. **Tiny backend** (common choices: **Node** on **Cloud Run**, **Cloud Functions**, **Firebase**) — stores Plaid secrets; implements e.g. **`/api/create-link-token`**, **`/api/exchange-token`**, optional **`/webhooks/plaid`**.
2. **Web dashboard** — loads **Plaid Link** (JS), receives **`public_token`**, sends it to the bridge; bridge stores **`access_token`** keyed to **user id** (not in the spreadsheet).
3. **Sync job** — schedule or **“Sync balances”** button: bridge calls **Plaid** (balances / liabilities), **maps** institutions → your **`Account Name`** / debt rows, **writes** via **Google Sheets API** *or* calls an **Apps Script web app** `doPost` with a shared secret (weaker pattern; document risk).

Apps Script can stay **consumer-only** (reads sheet after sync) or **orchestrator** that calls the bridge with **`UrlFetchApp`** + **Script Properties** (`BRIDGE_URL`, `BRIDGE_API_KEY`).

#### Effort rough cut

| Approach | Difficulty | Notes |
|----------|------------|--------|
| **Manual / CSV / OFX** | Low | No aggregator; bank export → import. |
| **Plaid + small bridge + sheet writes** | **Medium** | Usual “right” first production shape; mapping + secrets + Link + one sync path. |
| **Plaid entirely in GAS** | Medium–high | Secrets + Link + refresh + errors in one place; webhooks harder; tighter security review. |
| **Full bidirectional + reconciliation UI** | High | Payee matching, duplicates, pending vs posted, multi-currency, liability fields vs custom **DEBTS** columns. |

#### Product / risk notes

- **Matching** — Plaid names **≠** your **`ACCOUNTS`** / **`DEBTS`** labels; need a **mapping table** (e.g. Plaid `account_id` → sheet row) and **merge rules** (overwrite balance only vs full row).
- **Liabilities** — Plaid **liabilities** help for cards; **loans** may still need **manual** planner fields (min payment rules, promo APR) unless you invest in normalization.
- **Compliance** — Provider **developer agreement**, **use case** review, **data retention**; not “just an API key.”
- **Multi-user** — Single household today is simpler; **per-user tokens** + auth is a large scope jump.

#### Alternatives to Plaid (same problem space)

- **Spreadsheet-first aggregators** (e.g. Tiller-style) that already write to Google Sheets.
- **Bank “export to Sheets”** or scheduled **CSV** import — low tech, no aggregator contract.
- **Finicity / MX / Yodlee** — same class: still want a **bridge** pattern and mapping.

#### Bottom line (planning)

Treat **aggregator → Sheets** as a **small sidecar + mapping layer**; keep the app **sheet-driven**. Reasonable to design and estimate; **not a trivial Apps Script–only weekend** if you want it **safe and maintainable**.

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

10. On the Debt update page we should update the screen on the bottom and right like we did for **Quick add**
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

19. **Status / `planner_status` audit** — After Bills Due → `bills_due_status`, move remaining global status to panel-specific elements where it makes UX sense. **Inventory (repo scan — update if code moves):**
   - **`Dashboard_Body.html`** — Markup: `#planner_status` container in the top bar (no `setStatus` here; anchor for all writers).
   - **`Dashboard_Script_Render.html`** — `runPlannerNow`: `setStatusLoading` / `setStatus('planner_status', …)` for planner run (success/error). *Expected:* stays near **Run Planner** in top bar.
   - **`Dashboard_Script_BillsDue.html`** — **Done:** `loadBillsDueUi_` **failure** → `bills_due_status` when `getBillsDueFromCashFlowForDashboard` fails.
   - **`Dashboard_Script_Payments.html`** — **Done:** `runDebtPlannerAfterQuickPayment_` failure → `pay_status` for `runDebtPlanner` errors.
   - **`PlannerDashboardWeb.html`** — `window.onerror` and `initDashboard` catch → write to `planner_status` (global init/JS errors). *Reasonable to keep global.*
   - **`PlannerDashboard.html`** (sidebar) — same pattern if still maintained (`TODO` item 16).

20. **Large `dashboard_data.js`** — Optional long-term split by feature (bills, snapshot, etc.) behind stable exported function names if that file keeps growing.

21. **Client globals** — `window.__dashboardBills` / `__dashboardRecurring`; optional single namespace object to avoid future collisions.

22. **Help vs inline UI** — Keep dense explanations in Help (pattern used for Bills Due); Bank Accounts add flow is covered in Help **Assets**; optional same pass for other tabs (Quick add edge cases, etc.).

24. **Dashboard charts (long term)** — Add trends without cluttering the UI. **Effort:** moderate; drawing is easy, the real work is **clean time series** from the backend (e.g. roll `OUT - History` or per-tab monthly series in `dashboard_data.js`). **Keep calm:** prefer **sparklines** in snapshot cards; at most **one** larger chart above the fold per page; extra charts behind **“Show trend”** or on **detail tabs** (e.g. full retirement chart on Planning, not Overview). **Good targets:** optional sparkline under **Net Worth** (or Cash) on Overview; health **score-over-time** inside **“Why this score?”**; **Buffer Runway** vs months; **Assets** panels (house/bank/investments) for **selected** entity only; **Debts** balance over time; **Cash Flow** income vs expenses if monthly history exists. **Skip / low value:** charting every row in Bills Due or dense forms.

---

## DONE (history)

Completed items kept for reference (original list numbers preserved).

**Activity ledger / UI (unnumbered)** — `house_expense` logging; no double ledger row when House Expense also writes Cash Flow; Activity **Type** filter + **getActivityDashboardData**; 20-row paging; inline date fields; Debt Planner email + Help **Debt Planner email**; Pay now/soon respect Cash Flow “handled” for current month; **Phase 3 Upcoming** activity events + no duplicate **`quick_pay`** when pushing from Upcoming.

**Bank Accounts (unnumbered)** — **Add new** path shipped (**`bank_accounts.js`**, dashboard + sidebar HTML/JS); **`bank_account_add`** activity; Help + panel title cleanup (see **Done (recent)** above for pointers).

**5.** Fix SKIP issue in the Due Payments — adds 0 but does not refresh the screen (BUG). *(Marked done in prior testing; skip flow + UI refresh addressed.)*

**9.** Credit card should always list regardless of value in the Input Debts since we might have charged to them but not showing up or is that already there? *(Marked done.)*

**11.** New request on anything in debt other than the loans we should subtract that amount from the balance as long as it does not go < 0. If <0 then set that value to 0 after the payment is done. *(Marked done.)*

**17.** **Codebase — removed unused HTML** (done in repo): `Dashboard_Script_DueCards.html`, `Dashboard_Script_Core.html`, `Dashboard_Script_Utils.html` — were not referenced by any `includeHtml_` or `createHtmlOutputFromFile`. *Revert from git if a mirror is needed again.*

**18.** **HtmlService includes** — Documented in `WORKING_RULES.md` § HtmlService includes (`includeHtml_` + `getRawContent()`; no nested template tags in fragments). Cross-reference in `PROJECT_CONTEXT.md`.

**23.** **Light safety net** — Manual checklist + `rg` include/orphan checks in `TESTING_PLAN.md` § Light safety net; notes on `PlannerDashboard.html` vs web app drift.

**2.** **Donations UI** — **Cash Flow → Donations** tab: append rows to **INPUT - Donation** by tax-year block (`donations.js`, `Dashboard_Script_Donations.html`, Help **Donations**). *(Sidebar-only UI not required for this item.)*
