# Samer Financial Planner - Project Context

We are building **CashCompass** — a Google Apps Script web dashboard (and spreadsheet sidebar) for personal finance / property / debt planning. Tagline: *Guiding your money decisions.*

## Decision Layer (product framing)

The app has two layers. Do not conflate them:

- **Input / execution layer** — source-of-truth editors and ledgers. Bills, Upcoming, Debts, Bank Accounts, Investments, House Values / Expenses, Donations, Cash Flow (Quick Add), LOG - Activity. These own the data; they are the only places that write canonical rows.
- **Decision layer (Planning tab)** — answers *"what should I do next?"* by interpreting data from Bills, Upcoming, Debts, Bank Accounts, and Cash Flow. It is **not** a source-of-truth editor and **not** a ledger; it reads existing sources and does not create new data.

### Next Actions (primary entry point, v1 delivered)

- **"Next Actions"** is the featured sub-tab inside Planning and the primary entry point for users. It is the default landing view inside Planning.
- Action-first (no editing), short lists (3–5 items per section). Urgent is uncapped in the backend so `urgentTotal` always reconciles with the visible list; the UI groups the tail into a single "Other bills due soon" row for readability.
- The single payment path remains **Cash Flow → Quick Add**; Next Actions routes the user there (and to source pages) rather than duplicating detail.

### Relationship to existing Planning tabs

All current Planning sub-tabs stay as they are and are re-framed as **tools / deep dives**:

- **Debts**, **Retirement**, **Purchase Sim**, **Debt Overview**, **Rolling Debt Payoff**

Intended flow: **Next Actions → drill into these tabs**. No new top-level tabs; no new dashboards stacked on top of Planning.

### Design principles

- Do not add multiple new top-level tabs.
- Do not overload Planning with dashboards.
- Keep Next Actions simple (3–5 items per section).
- Single payment path remains Quick Add.
- Decision layer does not create new data; it reads existing sources.

### Roadmap

- **Phase 1 — Next Actions (v1)** ✅ Delivered as the featured Planning entry point.
- **Phase 2 — Cash Strategy** (later).
- **Phase 3 — HELOC Advisor refinement** (later).

See `ENHANCEMENTS.md` for the backlog entry and `SESSION_NOTES.md` for the shift summary. End-user documentation lives in the in-app Help page under **Planning → Next Actions** (`#help-next-actions`).

### Setup / Review (Onboarding Phase 1, delivered)

- **"Setup / Review"** is the top-right entry in the dashboard header. It opens a focused, **read-only** walkthrough of the five input areas Next Actions reads: Bank Accounts, Debts, Bills, Upcoming Expenses, Income — plus a Finish summary.
- Flow: **Welcome → status grid → per-step detail screen → (optional) editor in Setup mode**. Each step has a status badge (*Setup complete* / *Not set up*), a short product-language summary, and a primary action.
- **Setup-mode editor handoff** — detail CTAs open the existing editor in a simplified shell: main top nav, page sub-tabs, *Setup / Review*, and *Run Planner + Refresh Snapshot* are hidden; a **Back to Setup** bar appears. Normal navigation to the same editor is unchanged.
- **Income** is derived from the latest `INPUT - Cash Flow <year>` — there is **no** `INPUT - Income Sources` sheet. Recurring income is grouped conservatively (e.g. *Cisco Pay 1/2/3 → Cisco Salary*); excluded categories (Bonus, RSU, ESPP, Refund, …) are surfaced separately as "Other detected income".
- **Sheet safeguards** — Setup ensures `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, and `INPUT - Upcoming Expenses` exist with the canonical headers before opening their editor. It does **not** create Cash Flow year sheets.
- Read-only guarantee: viewing Setup never writes, never touches `SYS -` sheets, never writes to `LOG - Activity`.
- End-user documentation lives in `Dashboard_Help.html` under **Setup / Review** (`#help-setup`). Full phase notes and remaining follow-ups are in `ENHANCEMENTS.md → § 4 → Onboarding (Phase 1)`.

### Queued product work (post Next Actions stabilization)

Captured-but-not-scheduled. Intent only — full specs live in `ENHANCEMENTS.md → § 4 → Queued — post Next Actions stabilization`:

- **Debug mode control** — delivered (see above). Retained here for historical priority ordering.
- **Income Sources (new input surface)** — **superseded.** Income is now derived from the latest `INPUT - Cash Flow <year>` inside Setup / Review; no separate `INPUT - Income Sources` sheet will be reintroduced.
- **TEST mode retirement** — the `?onboarding=test` path and `TEST -` sheet fallbacks in `onboarding.js` are in light deprecation. New work should target the live path only; existing TEST code stays until it is removed in a dedicated cleanup pass.
- **Onboarding factory refactor** — consolidate the five per-step `*SetStatus_` / `*LoadDetail_` / `*RenderDetail_` / `*Open*Page` groups in `Dashboard_Script_Onboarding.html` into a shared factory once the flow has been exercised in real use.

Intended order: **(1) finish overlap cleanup → (2) stabilize Next Actions → (3) debug mode → (4) onboarding (delivered) → (5) TEST mode retirement → (6) onboarding factory refactor.** Do not reorder without an explicit product decision.

### Next Actions v1 — decision logic (delivered)

Locks the backend decision logic and product rules. Implemented by `next_actions.js::getNextActionsData()` and consumed by `Dashboard_Script_PlanningNextActions.html`.

**1. Purpose**
- Answers: *"What should I do next, in priority order?"*
- Interprets existing data only. No writes. Not a replacement for source-of-truth pages.

**2. v1 output model (compact action object)**
Each action is a plain object with:
- `priorityBucket` — `urgent` | `recommended` | `optimize`
- `actionType` — one of the types in §6
- `title` — short imperative label (e.g. *"Pay PG&E bill"*)
- `reason` — one-sentence justification built from current data (see §7)
- `amount` — dollar amount (may be 0 when N/A, e.g. `review_cash_gap`)
- `dueDate` — ISO date or null
- `sourceEntity` — `{ type, name }` where `type` ∈ `bill | upcoming | debt | bank_account | heloc | cash_plan`
- `target` — `{ page, tab }` the user is routed to (Quick Add stays the single payment path)

**3. v1 data sources (no new sources)**
- `INPUT - Bills` (active)
- `INPUT - Upcoming Expenses` — **remaining balance only** (the live `Amount` column)
- `INPUT - Debts` (active; balance / min payment / due day)
- Bank Accounts / usable cash — via the existing liquidity model (`SYS - Accounts` → Safe-to-use / Available Now / Min Buffer)
- Rolling Debt Payoff recommendation — reuse `getRollingDebtPayoffPlan` output; do not re-run the engine

**4. v1 priority buckets**
- **Urgent** — overdue items, due soon, unpaid debt minimums for the current cycle, near-term obligations (next ~7 days), and any detected cash gap. Must be addressed before anything else is surfaced as money-movement.
- **Recommended** — next best moves once urgent items are covered (typical case: extra payment toward the Rolling Debt Payoff focus debt; finishing a partially-paid Upcoming).
- **Optimize** — optional improvements that only make sense once urgent items are safe (sparse by design; usually empty). HELOC strategy is **not** surfaced here — it lives on the Rolling Debt Payoff *HELOC strategy* card.

**5. v1 deterministic rules**
- Build the **urgent obligations** list first, from Bills + Debts + Upcoming + near-term windows.
- Compare `sum(urgent obligations)` vs **cash-to-use** (Safe-to-use from the liquidity model).
- If obligations exceed cash-to-use, emit `review_cash_gap` at the top of `urgent` — recommending / pay_extra actions are **suppressed** until the gap is resolved.
- Only emit `pay_extra_debt` (and other `recommended` money-movement) **after** urgent obligations are covered.
- When recommending an extra debt payment, use the **Rolling Debt Payoff** recommendation as the preferred target; do not invent a new waterfall.
- All rules are deterministic over the current snapshot — same inputs, same output.

**6. v1 action types**
- `pay_bill` — active bill due in the current cycle, unhandled in Cash Flow.
- `pay_debt_minimum` — debt with unpaid minimum for the current cycle.
- `pay_upcoming` — Upcoming row with remaining > 0 and due within the urgent window.
- `finish_upcoming` — partially-paid Upcoming row (remaining > 0, already touched) worth closing out.
- `review_cash_gap` — informational; shown when obligations exceed cash-to-use.
- `pay_extra_debt` — extra principal toward the Rolling Debt Payoff focus debt once urgent is clear. Reason is intentionally short (*"Confirm in Rolling Debt Payoff"*) so Next Actions does not duplicate the Rolling Debt Payoff Focus-debt narrative.

HELOC strategy is intentionally **not** a Next Actions action type. It lives on the Rolling Debt Payoff *HELOC strategy* card (single source of truth for HELOC recommendations).

**7. Explainability rule**
Every emitted action must be explainable in **one sentence** built entirely from current snapshot data (amount, due date, remaining balance, bucket rule, or Rolling Debt Payoff reason code). If an action can't be explained that way, it is not emitted.

**8. Non-goals for v1**
- Retirement optimization
- Investment allocation advice
- Purchase simulation outputs
- Scenario / what-if planning
- Automatic execution (Quick Add remains the single payment path; Next Actions only routes)

### Liquidity model v1 — `cash_to_use` (delivered)

Defines the safe, conservative "how much can I actually act on right now" number consumed by Next Actions v1. This is an explicit contract, not a re-derivation of the Rolling Debt Payoff *Safe-to-use* math — Next Actions uses this simpler model directly.

**1. Definition**
- `cash_to_use` = total amount of money **safely available right now** across active bank accounts.
- Conservative, buffer-respecting, **current-state only** — no forecasts, no future income, no credit lines, no investments.

**2. Data sources**
- Bank Accounts only (canonical: `INPUT - Bank Accounts` + the `SYS - Accounts` mirror already read by the dashboard).
- Per-account fields consumed:
  - `balance` (current balance — same field the Bank Accounts panel surfaces)
  - `minBuffer` (Min Buffer)
  - `active` flag (shared filter: explicit `No / n / false / inactive` = inactive; blank = active)
  - `usePolicy` (existing Use Policy column)

**3. Core formula**
- Per account: `usable = max(0, balance - minBuffer)` — never negative.
- Total: `cash_to_use = Σ usable` across eligible accounts (§4).
- Round to cents at the total; per-account values render at cents too.

**4. Eligibility rules**
- **Include** only accounts where `active !== inactive` (shared rule).
- **Exclude** accounts flagged as restricted / do-not-use.
- **Use Policy** (v1 simplified): include most policies; exclude only accounts with an explicit "do not use" / restricted policy. More granular policies (spend-first, reserve, etc.) stay for a later phase — v1 either counts an account fully eligible or fully excluded.

**5. Output model**
Single object returned by the liquidity reader:
- `cashToUse` — total dollars, rounded to cents.
- `accounts` — array of `{ name, balance, minBuffer, usable, included, excludedReason? }` for every considered row, so the UI can show the breakdown and the reason any account was skipped.

**6. Usage in Next Actions**
- Compare `cashToUse` vs `sum(urgent obligations)` (from the Next Actions v1 rules).
- If `cashToUse < sum(urgent)`, emit **`review_cash_gap`** at the top of `urgent` and suppress `recommended` money-movement until resolved.
- Otherwise, use `cashToUse − sum(urgent handled)` as the pool for `recommended` actions (e.g. `pay_extra_debt` against the Rolling Debt Payoff focus debt).

**7. Guardrails**
- Never allow negative contributions from any single account (`max(0, …)` clamp).
- Always respect `minBuffer` — buffer is sacred in v1.
- No future-income assumptions, no pending transfers, no optimistic timing.
- No credit lines, no investments, no HELOC draw counted as "cash_to_use". HELOC strategy is a separate surface (Rolling Debt Payoff *HELOC strategy* card), not a Next Actions signal.

**8. Non-goals (v1)**
- No forecasting (no 7-day / 30-day projection of cash).
- No time-based modeling (same number whether asked at 8 AM or 5 PM on the same day).
- No optimization across accounts (no "drain this one first" logic — that's a later phase paired with Cash Strategy).

## Overall system areas already in the app
- Dashboard snapshot / overview
- **Bills** (Cash Flow tab) — Internal two-view panel: **Due this period** (dated Pay / Skip cards) and **Manage bills** (table over **INPUT - Bills** with inline sort on **Payee** / **Due Day**, **Add bill**, and **Stop tracking** which sets **Active = No**). Server entry points: `addBillFromDashboard`, `deactivateBillFromDashboard` in `bills.js`. Category is a required field on Add bill.
- **Quick add** (Cash Flow tab) — expense/income lines to **INPUT - Cash Flow** (UI wording; activity log event type remains **`quick_pay`**)
- Upcoming Expenses
- House values — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateHouseFromDashboard` in `house_values.js`: sets **Active = No** on every **INPUT - House Values** row for the house and on the mirror **SYS - House Assets** row; preserves history, the **HOUSES - {House}** sheet, and name reservation. Logs **`house_deactivate`**. Inactive houses drop out of the House Values dropdown, House Expenses selector, and Property Performance rows/cards — all via the shared `getInactiveHousesSet_` rule: explicit `No / n / false / inactive` = inactive; blank = active.)
- House expenses
- Bank accounts — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateBankAccountFromDashboard` in `bank_accounts.js`: sets **Active = No** on every **INPUT - Bank Accounts** row for the account across all year blocks and on the mirror **SYS - Accounts** row; preserves month history, totals / delta, **Current Balance**, **Available Now**, **Min Buffer**, **Type**, **Use Policy**, **Priority**, and reserves the name. Logs **`bank_account_deactivate`**. `addBankAccountFromDashboard` appends a row to **INPUT - Bank Accounts** (current year block) and **SYS - Accounts** with `Active = Yes`, optionally seeding an opening balance into the matching month; Type is chosen from a controlled dropdown of existing types in **SYS - Accounts**; **Priority** is a whole-number input (1–99, default **9**) that writes the canonical **SYS - Accounts → Priority** column consumed by `planner_core.js → normalizeAccounts_`; new **SYS - Accounts** rows inherit neighbor row formatting (borders, font, number formats, row height) via `findAccountsTemplateRow_` + `PASTE_FORMAT`; logs **`bank_account_add`** with Amount = opening balance (or 0 when not supplied). Inactive accounts drop out of the Bank Account dropdown via the shared filter: explicit `No / n / false / inactive` = inactive; blank = active.)
- Investments — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateInvestmentAccountFromDashboard` in `investments.js`: sets **Active = No** on every **INPUT - Investments** row for the account across all year blocks and on the mirror **SYS - Assets** row; preserves month history, totals / delta, Current Balance, and reserves the name. Logs **`investment_deactivate`**. `addInvestmentAccountFromDashboard` appends a row to **INPUT - Investments** (current year block) and **SYS - Assets** with `Active = Yes`, optionally seeding a starting value into the matching month; Type is chosen from a controlled dropdown of existing types in **SYS - Assets**; logs **`investment_add`**. Inactive accounts drop out of the Investment Account dropdown via the shared filter: explicit `No / n / false / inactive` = inactive; blank = active.)
- Debts — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateDebtFromDashboard` in `debts.js`: sets **Active = No** on the matching **INPUT - Debts** row; the row is never deleted so balance / minimum payment / credit limit / interest rate / due day and the name all stay intact for history. Logs **`debt_deactivate`**. `addDebtFromDashboard` appends a row to **INPUT - Debts** only — there is no **SYS - Debts** mirror — with `Active = Yes`; logs **`debt_add`** with Amount = opening balance (or 0 when not supplied). Active semantics: for UI / dashboard / Cash Flow readers, only explicit `No / n / false / inactive` on the **Active** column counts as inactive — blank / missing column = active, so legacy workbooks show every debt in the dropdown exactly like pre-Active-column builds. The planner (`planner_core.js → normalizeDebts_`) additionally applies the legacy `balance > 0 || minPayment > 0` fallback when the column is absent, so rolling payoff still skips dormant debts. The column is self-healed on the first add/stop-tracking write. Inactive debts drop out of the Planning Debts selector, `normalizeDebts_()` (so Rolling Debt Payoff waterfall / HELOC gate / focus/next-debt / payment windows), Debt Overview, Bills Due (debt matching), Quick add Flow Source inference, high-utilization issues, and debt-balance totals. Historical `LOG - Activity` classification is intentionally NOT filtered by Active so old quick_pay rows tied to a now-inactive debt still render with the right **Type / Kind**.)
- **Debt Overview** (Planning tab) — Read-only reference view of debt structure (balances, minimums, APRs, estimated payoff at current minimums) from **INPUT - Debts** plus **CF paid** trailing-two-year sums from **INPUT - Cash Flow**. Renamed from the older "Payoff Path"; not an action planner.
- **Rolling Debt Payoff** (Planning tab) — Monthly decision engine. Standalone React bundle (`components/RollingDebtPayoffDashboard.tsx` → `RollingDebtPayoffDashboardBundle.html`). Opens in **Standard** mode (Cash-to-use-now input, narrative Decision card with Recommendation/Why/Caution, HELOC strategy card with *What would change this?* levers, compact Payment result table using **Small balance / Focus debt / Next debt / Excess** role labels and **Paid off (this month) / Partially paid** actions, per-row **[Add payment]** pill that calls host `window.prefillQuickPayment` to open **Cash Flow → Quick add** pre-filled, **Why not more?** breakdown whose `[View]` pills route to **Cash Flow → Upcoming**). A single **Show details / Hide details** toggle reveals the full planner output (cash bridge audit, allocation audit, 12-month cash table, yearly projection, diagnostics, JSON). Liquidity model is calculated from **SYS - Accounts** (Safe-to-use = Total cash − Reserve − Buffer − Near-term hold − Unmapped card risk hold); legacy $100k/$100k hardcoded constants retained for audit only.
- Retirement planner
- Monte Carlo / retirement success
- Purchase simulator / big purchase sim
- Planner run + OUT history snapshot logic
- **LOG - Activity** — Ledger of script actions (**quick_pay**, bill skip, bill autopay, **bill_add**, **bill_deactivate**, **house_expense**, **house_add**, **house_deactivate**, **investment_add**, **investment_deactivate**, **bank_account_add**, **bank_account_deactivate**, **debt_add**, **debt_deactivate**, **donation**, upcoming lifecycle; when **Quick add** runs inside house expense with **`suppressActivityLog`**, the extra **`quick_pay`** row is omitted because **`house_expense`** already logged the save). Rows can be removed from the **Activity** page: dashboard **Remove** is enabled for **`donation`** only (may also delete a matching **INPUT - Donation** row when the fingerprint matches); other event types are sheet-only for now. Not a substitute for **OUT - History** (planner snapshots). Created automatically if missing (`activity_log.js`). **Activity** page: **getActivityDashboardData** — filters, sort, up to **500** matches, **20** per page. **Tracking stopped** rows render with **—** in Amount since no money moved.
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