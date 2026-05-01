## Purpose of this file

TODO.md is a working list of ideas, bugs, and tasks.

- It may contain unstructured, exploratory, or incomplete items.
- It is not the authoritative roadmap.

Only items that are refined, structured, and prioritized should be promoted to `ENHANCEMENTS.md`.

---

## Current phase — V1.2 / controlled improvement mode (V1.1 closed out)

V1.1 is closed. The headline V1.1 item — **Retirement profile integration** — shipped end-to-end (Profile DOB → derived current age; manual age removed from Retirement; DOB parser accepts Date objects + strings; display-only UI with no spinner arrows; new-sheet seed cleaned). The V1 trust baseline (blank-workbook stability, no fake states, gated planner email, UI copy consistency pass) remains the foundation the project builds on.

Working rules for V1.2 are the same as V1.1 (`WORKING_RULES.md → Current phase`): one issue at a time, minimal / localized / safe diff, blank + populated workbook manual test steps. See `SESSION_NOTES.md` for the chronological record.

Open items below are either:

- **V1.2 candidates** — small, localized polish + product improvements (see section immediately below).
- Existing backlog kept as-is for historical continuity. Do not pull from the old lists wholesale — each pick must still satisfy the V1.2 working rules.

---

## V1.2 work queue — Active / Next / Later

One flat queue, three buckets. Pull **one** item at a time under the V1.2 working rules (`WORKING_RULES.md → Current phase`). Completed items get moved into `## DONE (history)` at the bottom so this queue stays short.

### Active now

- *(none in flight — pick the next Active item from the V1.2 candidates below before starting work. Bank Import Step 2a is queued and documented under `## Bank Import — status & resume plan` below.)*

### V1.2 candidates

#### A. Immediate follow-ups (low risk)

Small, localized polish. Must pass the blank + populated two-track manual checks in `TESTING_PLAN.md`.

- **Profile DOB parser symmetry** — `profile.js::isValidProfileDateString_` still assumes strict `YYYY-MM-DD` text. Retirement's `computeAgeFromDob_` was widened to also accept Date objects (`6d25c0e`); apply the same normalization on the Profile save-side so a Sheets-auto-coerced DOB cell does not fail re-save validation. Tiny diff.
- **Overview Retirement copy alignment** — verify the Retirement Outlook card copy routes users to Profile (for DOB) when `analysis` is null, aligning with the new `needsProfileDob` framing on the Retirement tab.
- **Blank-workbook empty-state consistency pass** — final sweep across any panel that still renders a blank table instead of the standard `No <things> yet.` / `Add your <things> in Setup / Review …` pattern.
- **Copy & Help polish sweep** — any residual user-facing wording that still reads `"error:"` / `"please fix …"` / `"Missing sheet …"` / sheet-internal names should be normalized to the V1 trust-safe phrasing from the UI copy consistency pass.

#### B. Product improvements

Slightly larger than A but still bounded. Each must have a clear user-visible benefit.

- **Profile completeness indicator / badge** — a small signal on Overview / Retirement cards showing *why* a section is gated (e.g. "Profile complete", or "Add DOB in Profile"). Pure UX, no math change.
- **Better Retirement setup guidance / linking to Profile** — deeper cross-linking from Retirement and Overview empty states back into the specific Profile field the user needs to fill, building on the new **Open Profile** CTA.
- **Optional spouse UX clarity (single vs partnered)** — wording + layout pass on the Profile spouse section and the Retirement spouse-age display so users know spouse fields are optional and what happens when they're left blank.

#### C. Future ideas (do not act yet)

Captured so the idea isn't lost. Require an explicit product decision before being pulled up.

- **Legacy sheet cleanup tool** — one-shot tidy for populated workbooks that still carry the inert `Household Input` header + `Your Current Age` / `Spouse Current Age` rows on `INPUT - Retirement`. Current design leaves them alone (safe); a later opt-in tool could remove them with user confirmation.
- **Profile → other modules integration** — extend the Profile-as-source-of-truth pattern to other modules where identity data is manually re-entered (name, email, address).
- **Notifications / SMS** — uses the existing Profile phone field to send planner reminders / alerts via SMS or similar. Infrastructure-heavy; treat as a separate product conversation.

### Deferred from V1.1 (re-qualify before pulling)

Residual V1.1 candidates that did not ship and were not promoted into V1.2 A/B/C. Re-evaluate each under V1.2 rules before picking.

- **Planner email guardrails telemetry** — optional, informational only: surface a small neutral status line when the planner run was meaningful but email was skipped because no recipient is configured. No behavior change.
- **Low-risk codebase cleanups** — `status / planner_status` audit, Help cross-links, A11y tightening. See the historical `Codebase cleanups` subsection for detail. Anything touching `doGet`, `includeHtml_`, or snapshot shape stays **Later**.
- **Dead-code prune from retirement profile integration** — `readRetirementHouseholdSafe_`, `getRetirementHouseholdInputs_`, `writeRetirementHouseholdInputs_`, and the `saveRetirementBasics` stub in `retirement.js` are now unused. Safe to remove in a future cleanup pass; keeping them one more release cycle so any stale cached client that still calls `saveRetirementBasics` gets the friendly error rather than a silent crash.

### Later (post-V1.2 / future phase)

Captured so the idea isn't lost; **not** in scope for V1.2. Requires an explicit product decision before being pulled up.

- **Onboarding factory refactor** — consolidate the per-step Setup / Review helpers (see `PROJECT_CONTEXT.md → Queued product work`). Touches onboarding shape.
- **Activity log — smart undo Phases 2–4** — Phase 1 (donation) is shipped. Phases 2 (`quick_pay`), 3 (`house_expense`), and 4 (bill skip / autopay) require logging upgrades first. See historical "Activity — Smart undo / reverse transaction" section below.
- **Larger product work** — Cash Strategy, HELOC advisor refinement, Plaid-style bank / card / loan sync, car / vehicle expenses as a first-class dashboard surface, subscriptions, income / expense classification, tax workflow, credit-card segmentation, etc. See the historical body below for full design notes.
- **Two dashboards unification** — `PlannerDashboard.html` (sidebar) vs `PlannerDashboardWeb.html` (web) shared-source strategy.
- **Broader regression / test harness** — automated unit / integration tests per `TESTING_PLAN.md`.

---

## Future Phases (VNext — not active work)

Forward-looking phases captured so the long-term direction is durable. **None of this is on the V1.2 roadmap.** Pulling any of it in requires an explicit product decision and the migration discipline laid out in `WORKING_RULES.md → Central App Transition Rules` and `WORKING_RULES.md → Monetization Rules`. Full rationale lives in `PROJECT_CONTEXT.md → Future architecture — Central App` and `ENHANCEMENTS.md → Future direction — Central App / Future direction — Monetization`.

### VNext — Central App Migration

Goal: move from per-copy app to one centralized Apps Script web app, where users access a single deployed URL and each user gets their own bound spreadsheet on first run.

- Implement **`getUserSpreadsheet_()`** as the single resolver that returns the caller's bound `Spreadsheet`. Identity comes from `Session.getEffectiveUser().getEmail()` (or equivalent).
- Introduce **per-user sheet creation** on first run — bootstrap a fresh workbook from a known-good template / seed structure when a new user has no mapping.
- Migrate key modules **one at a time** to use `getUserSpreadsheet_()` instead of `SpreadsheetApp.getActiveSpreadsheet()`. Order TBD when the work is approved; planner / dashboard / debts / bills / accounts / retirement / activity log / bank import are all affected.
- **Maintain backward compatibility during transition.** Until the resolver is wired everywhere, both modes must coexist:
  - existing bound-sheet users keep working unchanged,
  - new central-app users go through the bootstrap flow.
- Decide where the user → workbook mapping lives: `PropertiesService.getUserProperties()` or a central registry sheet (e.g. `SYS - User Workbooks`). Document the choice when the work begins.

### VNext — Monetization

Goal: introduce free + paid tiers with feature gating inside the codebase. Mirror of `ENHANCEMENTS.md → Future direction — Monetization`.

- **Add `SYS - Users` sheet** with columns: `Email | Plan | CreatedAt`.
  - `Email` — canonical user identifier (matches the Central App identity resolver).
  - `Plan` — short string, e.g. `free`, `paid`, `trial`. Free is default and assumed when missing.
  - `CreatedAt` — first-seen timestamp; useful for trial-window logic later.
- **Implement plan checks** with two helpers:
  - `getUserPlan_(email)` — returns the plan string; defaults to `'free'` when no record exists.
  - `isPaidUser_()` — convenience boolean built on top of `getUserPlan_()`.
  - Both helpers must be **defensive**: any error reading `SYS - Users` returns the free / unblocked default, never an exception that breaks an existing free-tier user.
- **Gate the first feature: bank import.** Initial gating candidate is the in-flight Bank Import work — once Step 2a (and later steps) ship, the import / sync entry point becomes the first paid-tier feature.
- Additional gating candidates (not commitments): advanced planner features (multi-scenario retirement, premium reports), usage limits on heavy operations.
- Gating must follow `WORKING_RULES.md → Monetization Rules`: never gate core functionality, always fail gracefully, only paid-tier features may be gated.

### Sequencing

Monetization is meaningful only **after** the Central App migration is in place — gating per-copy installs is not enforceable. The intended order is:

1. Central App migration lands (`getUserSpreadsheet_()` resolver, bootstrap flow, key modules migrated).
2. `SYS - Users` schema + helpers (`getUserPlan_`, `isPaidUser_`) ship as additive scaffolding.
3. Bank import becomes the first gated feature.

---

## Bank Import — status & resume plan

Captured so work can resume cleanly from a pause. This section is deliberately self-contained — read it first when returning to Bank Import work.

### Bank Import — Step 1 Complete

Scaffold shipped in commit `8ced838`:

- **`SYS - Import Staging — Bank Accounts`** — ensure helper creates the sheet with the full 13-column staging header (bold, frozen, no data rows): `Staging Id | First Seen | Last Seen | External Account Id | External Institution | Display Name | Last 4 | Type | Currency | Latest Balance | Latest Balance As Of | Status | Pending Reason`.
- **`SYS - Import Ignored — Bank Accounts`** — ensure helper creates the 7-column ignore registry (bold, frozen, no data rows): `External Account Id | Institution | Display Name | Last 4 | Ignored At | Ignored By | Scope`.
- **`External Account Id` column on `SYS - Accounts`** — ensure helper appends the header flush to the last non-empty header cell. Never reorders existing columns. Never writes to data rows.

What Step 1 explicitly **did not** ship:

- No ingestion logic.
- No UI.
- No planner impact — the new sheets are inert and no existing module calls the helpers.

### Next Step — Step 2a (not started)

Ingestion pipeline only. Scope is intentionally narrow:

- Exact-id auto-match against `SYS - Accounts.External Account Id`.
- Ignored handling — **permanent only** (no until-changed logic yet, even if the `Scope` column exists for future compatibility).
- Pending staging — unmatched accounts land in `SYS - Import Staging — Bank Accounts` with `Status = pending review`.
- Activity logging for each ingestion outcome (events such as `bank_import_auto_matched`, `bank_import_pending`, `bank_import_ignored`).
- Dev harness only for invocation (no menu, no dashboard button, no web UI).

Explicitly **out of scope for Step 2a**:

- No UI (review screen, suggestion scoring, edit flows, etc.).
- No external sync (Plaid / Finicity / aggregator calls).
- No planner integration — pending rows do not affect planner math; this is enforced by pending rows living only in the staging sheet, which no existing module reads.

### Rules to resume work

Apply to every Bank Import step from 2a onward. These are the V1.2 working rules with extra emphasis for this feature:

- **One step at a time.** Do not bundle Step 2a with Step 2b, UI, or sync in a single pass.
- **No bundling changes.** Each step must stand on its own and pass manual tests before the next one begins.
- **Test before commit** — run the blank + populated workbook manual checks (see `TESTING_PLAN.md` and the Step 1 / 2a test checklist) before staging anything.
- **No UI until ingestion logic is stable** and has shipped at least one clean test run against a real payload in the dev harness.
- **No planner integration until a review system exists.** Pending rows stay invisible to planner math until a human-visible review surface has been added.
- **Additive only.** No edits to existing module files unless strictly required; no reordering of existing sheet columns; no destructive migrations.

### How to resume

When the next session starts:

1. *(Optional)* Run the scaffold ensure helpers from the Apps Script editor on the target workbook to confirm the schema is in place:
   - `ensureImportStagingBankAccountsSheet_()`
   - `ensureImportIgnoredBankAccountsSheet_()`
   - `ensureAccountsExternalIdColumn_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SYS - Accounts'))`
2. Implement **Step 2a** exactly per the scope above. Do not broaden.
3. Run the Step 2a manual test checklist (A–E) before committing:
   - **A.** Exact-id auto-match against `SYS - Accounts.External Account Id` — incoming row matches, no staging row added, activity row logged, `SYS - Accounts` data rows untouched.
   - **B.** New unknown account → pending row lands in `SYS - Import Staging — Bank Accounts` with `Status = pending review`; planner, overview, and cash flow unchanged.
   - **C.** Ignored account (`External Account Id` present in `SYS - Import Ignored — Bank Accounts`) → no staging row written; activity row `bank_import_ignored` logged.
   - **D.** Blank workbook — ensure helpers run clean on first call, idempotent on second call, no regressions in bootstrap or onboarding.
   - **E.** Manual account flow unchanged — existing Bank Accounts Add new / Update / Stop tracking paths still work byte-for-byte.

---

## Historical backlog (pre-V1.2 context)

Everything below this line is preserved as reference. Use it for background and rationale only — do not pull items directly from here without re-qualifying them against the V1.2 queue above.

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
- **Assets → Bank Accounts — Final cleanup (SYS row formatting + Priority + activity Amount)** — `appendAccountsRowForNewBank_` (`bank_accounts.js`) now clones neighbor-row formatting (borders, font, number formats, row height) onto newly appended **SYS - Accounts** rows via a new `findAccountsTemplateRow_` helper + `PASTE_FORMAT`, matching the Investments pattern. New **Priority** field (`<input type="number">`, range **1–99**, default **9**) on the Add form in both `Dashboard_Body.html` and `PlannerDashboard.html`; `createBankAccount` validates and sends it; `addBankAccountFromDashboard` writes it to the canonical **SYS - Accounts → Priority** column consumed by `planner_core.js → normalizeAccounts_` (no schema change to **INPUT - Bank Accounts**, which has no Priority column). `bank_account_add` removed from `activityLogIsNonMonetaryEvent_` so **Amount** now shows the supplied opening balance in **LOG - Activity** (or $0.00 when none was provided); `bank_account_deactivate` stays non-monetary with Amount as **—**. Help, `PROJECT_CONTEXT.md`, and `SESSION_NOTES.md` updated.
- **Assets → Bank Accounts — Stop tracking + Active + UX parity** — **`deactivateBankAccountFromDashboard`** (**`bank_accounts.js`**): flips **Active = No** on every **INPUT - Bank Accounts** row across year blocks (self-heals the Active column at col 14 per block) + mirror **SYS - Accounts** row; preserves month history, Available Now, Min Buffer, Type, Use Policy, and reserves the name. **`bank_account_deactivate`** on **LOG - Activity** (Type: **Bank**, Action: **Tracking stopped**, Amount: **—**). UI is a secondary **Stop tracking** button in **Update** mode on web + sidebar with inline confirm; Add-new Type is a controlled `<select>` populated from existing **SYS - Accounts** types; inline name-error slot replaces popups; create/stop flows show action-specific status text ("Creating bank account…" / "Stopping tracking…"). Inactive accounts drop out of the Bank Account dropdown via shared `getInactiveBankAccountsSet_` (blank / missing / unknown = active for backward compatibility). Active writes inherit row formatting via `writeActiveCellWithRowFormat_` (retrofitted into the add-account writers too). Help **Bank Accounts** + **Bank Accounts Stop tracking** subsections updated.
- **Assets → House Values — Add new** — **`addHouseFromDashboard`** (**`house_values.js`**): rows on **INPUT - House Values** (Loan Amount Left in col 2) + **SYS - House Assets** (neighbor row formatting copied), plus auto-creation of **HOUSES - {House}** with canonical headers + column widths copied from an existing HOUSES sheet; transactional rollback on any write failure. **`house_add`** on **LOG - Activity** (Type: **House Expenses**, Action: **House added**). UI **Update \| Add new** on web + sidebar; inline **`.field-error`** under the House name field for duplicate/invalid names (focuses + selects). **Properties → House Expenses** selector refreshes on every tab nav (`Dashboard_Script_Render.html`), so new houses are usable immediately. Help **Assets → House Values**, **Activity log**, **Properties**, **HOUSES sheet**, and **Sheet names** sections updated.
- **Assets → House Values — Stop tracking (soft sale)** — **`deactivateHouseFromDashboard`** (**`house_values.js`**): flips **Active = No** on every **INPUT - House Values** row for the house across all year blocks (canonical source; self-heals the Active column per block) and mirrors the same flag on **SYS - House Assets**. Preserves history (month values, Loan Amount Left, Current Value, Type) and the **HOUSES - {House}** sheet; name stays reserved so it can't be reused. **`house_deactivate`** on **LOG - Activity** (Type: **House Expenses**, Action: **Tracking stopped**, Amount: **—**). UI is a secondary **Stop tracking** button in **Update** mode on web + sidebar with an inline confirm; on success, the Update dropdown, House Expenses selector, and Property Performance rows/cards drop the house immediately via the shared `getInactiveHousesSet_` rule (reused by `getHouseUiData`, `getHouseExpenseUiData`, and now `getHouseNamesFromHouseAssets_` in `property_performance.js`). New **Yes / No** writes inherit row text formatting via `writeActiveCellWithRowFormat_` (retrofitted into the add-house writers too). Help **House Values → Stop tracking**, **Activity log**, and **Property performance → Active houses only** sections added.
- **Planning → Debts — Consistency pass: Active + Add new + Stop tracking** — **`addDebtFromDashboard`** / **`deactivateDebtFromDashboard`** (**`debts.js`**) on the canonical **INPUT - Debts** sheet only (no `SYS - Debts` mirror). Self-healing `Active` column via `ensureDebtsActiveColumn_`; `TOTAL DEBT` summary row is never stamped/touched and is rejected as a reserved name on Add. Shared active rule: explicit `No / n / false / inactive` = inactive; blank / missing / unknown = active; legacy fallback (`balance > 0 || minPayment > 0`) used only when the Active column is absent. Duplicate-name validation spans active + inactive debts via `getAllDebtAccountNamesIncludingInactive_`. New rows inherit neighbor row formatting (borders/font/number formats/row height) via `findDebtTemplateRow_` + `PASTE_FORMAT`; Active cell written via `writeActiveCellWithRowFormat_`. Filtered readers now skip inactive debts: `getDebtsUiData` / `getDebtRows_`, `planner_core.js → normalizeDebts_` (so Rolling Debt Payoff waterfall, HELOC gate, focus/next-debt, payment windows, and liability summary), `dashboard_data.js` (`sumDebtBalances_`, `getHighUtilizationDebtIssues_`, `getDebtBillsDueRows_`, `getDebtPayeeMap_`), `quick_add_payment.js` (`adjustDebtsBalanceAfterQuickPayment_`, `resolveFlowSourceFromBillOrDebt_`). `activity_log.js → buildActivityKindLookup_` intentionally does NOT filter by Active so historical `quick_pay` / bill rows keep their **Debt** classification after a debt is stop-tracked. New activity events: **`debt_add`** (Type **Debt**, Action **Account added**, Amount = opening balance or 0) and **`debt_deactivate`** (Type **Debt**, Action **Tracking stopped**, Amount **—**; added to `activityLogIsNonMonetaryEvent_`). UI parity with Bank Accounts / Investments / House Values: `Dashboard_Body.html` Debts panel is a segmented **Update | Add new** switch with a secondary **Stop tracking** button in Update mode; inline name-error slot; action-specific status text ("Creating debt account…" / "Stopping tracking…"). Sidebar `DebtsUI.html` stays update-only (inactive debts auto-drop via filtered `getDebtsUiData`). Help **Planning → Debts** subsections and Activity bullets updated.

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
| Bills → Pay (Flow Source) | **Done** — new Cash Flow rows populate **Flow Source** from **INPUT - Bills.Payment Source**, with server-side fallback (`resolveFlowSourceFromBillOrDebt_`) + case/whitespace-tolerant header lookup. |
| Manage bills → Add bill | **Done** — `bill_add` after **`addBillFromDashboard`** (`bills.js`); Category required. |
| Manage bills → Stop tracking | **Done** — `bill_deactivate` after **`deactivateBillFromDashboard`** (`bills.js`); sets **Active = No** on INPUT - Bills, shows **—** in Activity Amount. |
| Upcoming expenses | **Done** — Action-model cleanup: Upcoming is now an open-obligations board. Status is display-only (`Planned` / `Paid` / `Dismissed`; legacy `Skipped` sorts/filters the same as `Dismissed`); two actions per row — **Quick add payment** (single payment path, opens Quick Add with payee / due date / **remaining amount** / optional `CASH` / `CREDIT_CARD` flow-source hint pre-filled) and **Dismiss** (soft-deactivate preserving the row). Partial payments decrement the `Amount` column and keep the row on the board; full payments clamp remaining to 0, flip Status → `Paid`, and drop the row off the active board. `applyPaymentToUpcomingExpense` is called by `savePayment` after a successful Quick Add when `window.__pendingUpcomingPaymentId` is set. Activity: `upcoming_add` (monetary original planned amount), `upcoming_payment` (**non-monetary** audit trail — the money row is the paired `quick_pay`), `upcoming_status` (Dismiss), legacy `upcoming_cashflow` still rendered but no longer emitted. Action labels: **Upcoming added** / **Applied $X.XX (Remaining $Y.YY)** or **Applied $X.XX (Fully paid)** (falls back to **Payment applied** for legacy rows) / **Dismissed** / **Pushed to cash flow**. Retired: `updateUpcomingExpenseStatus`, `markUpcomingExpensePaid_`, `addUpcomingExpenseToCashFlow`, and the client's `setUpcomingStatus` / `addUpcomingToCashFlow` / `openUpcomingInQuickPayment`. |
| House expenses | **Done** — **`addHouseExpense`** → `house_expense`; CF via **Quick add** + **`suppressActivityLog`**. |
| Bank Accounts → Add new | **Done** — `bank_account_add` after **`addBankAccountFromDashboard`** (`bank_accounts.js`); INPUT + SYS rows (with `Active = Yes` stamped via `writeActiveCellWithRowFormat_`); Type is a controlled `<select>` from existing **SYS - Accounts** types; **Priority** numeric input (1–99, default 9) writes the canonical **SYS - Accounts → Priority** column; new **SYS - Accounts** rows inherit neighbor row formatting (borders/font/number formats/row height) via `findAccountsTemplateRow_` + `PASTE_FORMAT`; does not re-run full planner. **Amount in LOG - Activity** now shows the opening balance when provided (or $0.00 when blank) — no longer rendered as —. |
| Bank Accounts → Stop tracking | **Done** — `bank_account_deactivate` after **`deactivateBankAccountFromDashboard`** (`bank_accounts.js`); sets **Active = No** on every **INPUT - Bank Accounts** row across year blocks (self-heals the Active column per block at col 14) + mirror **SYS - Accounts**; preserves month history, Available Now, Min Buffer, Type, Use Policy, Priority, and reserves the name. Inactive accounts drop out of the Bank Account dropdown via `getInactiveBankAccountsSet_` (shared rule). Amount shows **—** in Activity. |
| House Values → Add new | **Done** — `house_add` after **`addHouseFromDashboard`** (`house_values.js`); INPUT + SYS rows + auto-created **HOUSES - {House}** sheet (canonical headers + column widths copied from an existing HOUSES tab); transactional rollback on partial failure. |
| House Values → Stop tracking | **Done** — `house_deactivate` after **`deactivateHouseFromDashboard`** (`house_values.js`); sets **Active = No** on every **INPUT - House Values** row (across year blocks) + mirror **SYS - House Assets**; preserves history + **HOUSES - {House}** sheet + name reservation. Inactive houses filtered out of House Values dropdown, House Expenses selector, and Property Performance via shared `getInactiveHousesSet_`. Amount shows **—** in Activity. |
| Investments → Add new | **Done** — `investment_add` after **`addInvestmentAccountFromDashboard`** (`investments.js`); INPUT - Investments row in the current-year block (with self-healed `Active` column) + mirror **SYS - Assets** row with neighbor-row formatting + optional month-seeded starting value; Type is a controlled `<select>` from existing **SYS - Assets** types. Transactional rollback on any write failure. Duplicate-name validation spans all year blocks (active + inactive) and SYS. Activity Type: **Investment**, Action: **Account added**. |
| Investments → Stop tracking | **Done** — `investment_deactivate` after **`deactivateInvestmentAccountFromDashboard`** (`investments.js`); sets **Active = No** on every **INPUT - Investments** row across year blocks + mirror **SYS - Assets**; preserves month history, Current Balance, Type, totals / delta, and reserves the name. Inactive accounts drop out of the Investment Account dropdown via `getInactiveInvestmentsSet_` (shared rule). Amount shows **—** in Activity. |
| Debts → Add new | **Done** — `debt_add` after **`addDebtFromDashboard`** (`debts.js`); appends a row to **INPUT - Debts** only (no `SYS - Debts` mirror) with `Active = Yes` stamped via `writeActiveCellWithRowFormat_`; neighbor-row formatting inherited via `findDebtTemplateRow_` + `PASTE_FORMAT`; `Acct PCT Avail` recomputed; `TOTAL DEBT` rejected as reserved; duplicate check spans active + inactive. Amount shows opening balance (or $0.00 when blank) in Activity. |
| Debts → Stop tracking | **Done** — `debt_deactivate` after **`deactivateDebtFromDashboard`** (`debts.js`); sets **Active = No** on the matching **INPUT - Debts** row only (never deletes, never renames, never touches `TOTAL DEBT`). Inactive debts drop out of the Debts dropdown (web + sidebar), `planner_core.js → normalizeDebts_` (Rolling Debt Payoff waterfall / HELOC gate / focus/next-debt / payment windows), Debt Overview, Bills Due debt matching, Quick add Flow Source inference, high-utilization issues, and debt-balance totals via the shared explicit-wins-with-fallback rule. Historical activity classification is intentionally preserved. Amount shows **—** in Activity. |

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

**Status — Shipped (split into two Planning tabs).** The original scope landed as two products: **Debt Overview** (read-only reference view, renamed from the earlier working name "Payoff Path") and **Rolling Debt Payoff** (monthly decision engine with Standard / Details modes, narrative decision card, HELOC advisor, Payment result table with `[Add payment]` → Cash Flow → Quick add, and the "Why not more?" explainer). See **Help → Debt Overview** and **Help → Rolling Debt Payoff**, plus **SESSION_NOTES.md § Rolling Debt Payoff: Standard-mode UX sweep**. The design notes below are kept for historical context.

**Intent:** One **Planning** tab with **real projections** grounded in **sheet data**: **INPUT - Debts** (balances, APRs, minimums, active flags) plus **INPUT - Cash Flow** across **2025 / 2026** (and later years) to infer **typical payment pace** toward debt-linked payees. **Simulation** on top: **“If I pay $X more per month to account Y, how does the story change?”** (timeline, interest, ordering). **Read-only** for early phases — no writes to INPUT from this feature until explicitly scoped. Complements **Run Planner** (now-centric) with a **trajectory** view.

**Why Cash Flow over OUT - History for pace:** **OUT - History** is sparse (per planner run). **INPUT - Cash Flow** month columns hold **realized** payments — better for **median / typical** paydown and variability. **OUT - History** stays an **optional** default or sanity check, not the primary source.

**Caveats:** Revolving assumptions (no new charges, simplified interest/minimums), **payee → debt** mapping via alias rules, **scenario math** — document in Help.

#### Where it fits in the planner (UI)

**Planning → fourth tab** (“Payoff path” / “Debt projection”) — **`Dashboard_Body.html`** `#page_planning`, **`Dashboard_Script_PlanningDebtPayoff.html`**, **`PlannerDashboardWeb.html`** include. Optional: Overview link to this tab.

#### Data inputs (by role)

| Role | Source | Use |
|------|--------|-----|
| **Levels / rates** | **INPUT - Debts** + **`normalizeDebts_`** / alias map | Starting balances, APR, minimums, allocation |
| **Historical payment pace** | **INPUT - Cash Flow** (per-year sheets, e.g. 2025–2026) | Aggregate per month for lines mapped to debts; derive **typical monthly $** + date range for provenance |
| **Optional** | **OUT - History** | Fallback when CF coverage is thin |

#### Backend shape (stable core)

1. **`simulateDebtPayoffSchedule_(normalizedDebts, monthlyTotalToDebt, strategy, options)`** — month loop; minimums + extra (**avalanche** / **snowball** / **minimum-only**); accrue interest (document simplification); cap months (e.g. 600) and payload size.
2. **`getDebtPayoffProjection(payload)`** — load debts, run simulator, return JSON `{ summary, byMonth[], perDebtPayoffMonth, … }`; payload selects **manual** vs **inferred** monthly total when Phase 2 exists.
3. **Phase 2+** — **`inferDebtPaymentPaceFromCashFlow_(ss, years, aliasMap)`** (name TBD): roll Cash Flow rows into mapped buckets → **median** (or trimmed) monthly payment + metadata for UI (“Based on CF **…**”).

#### Phased delivery — **start Phase 1** to see shape end-to-end

| Phase | Scope | Purpose |
|-------|--------|---------|
| **1 — Core sim + shell** | Fourth tab + **`getDebtPayoffProjection`** + **manual** monthly $ to debt + strategy + **Run projection** → table + summary (payoff month per account, approximate interest, debt-free month). **`debt_payoff_projection.js`** (split with **`planner_core.js`** as needed). Help stub. | **Visible vertical slice** without CF ingestion. |
| **2 — Real sheet defaults** | Infer pace from **2025/2026** (configurable) **INPUT - Cash Flow**; default monthly $ with **override**; **provenance** + low-coverage warning. | **Projections tied to actual payments.** |
| **3 — Outlined plan** | Milestone narrative from the same schedule object the table uses (single source of truth). | Readable “plan” beside numbers. |
| **4 — What-if** | +$X/mo to account **Y** vs baseline; **delta** (months, interest, outline). | Show how paying more changes the story. |
| **5 — Polish** | Chart, CSV, optional OUT - History line for defaults, edge rules (promo APR, HELOC) if needed. | Depth. |

**Order:** Engine + UI **first** (Phase **1**); then **real data** ( **2** ), **outline** ( **3** ), **simulation** ( **4** ).

**Frontend:** Reuse **`fmtCurrency`**, **`setStatus`**, Planning patterns; extend controls after Phase 1.

**Testing / docs:** **`TESTING_PLAN.md`** (avalanche/snowball, inactive, zero APR, **sparse CF**); **`PROJECT_CONTEXT.md`** when Phase 1 ships; **`SESSION_NOTES.md`** per phase.

**Explicit non-goals (early phases):** Auto-posting results to Cash Flow / **INPUT - Debts**; full issuer minimum engines.

**Related code:** **`code.js`** (`runDebtPlanner`, `buildUpcomingPayments_`); **`planner_core.js`** (`normalizeDebts_`); **`readCashFlowSheetAsObjects_`** / year tabs; **`Dashboard_Script_PlanningDebts.html`**; **`PlannerDashboardWeb.html`** includes.

---

### Rolling debt payoff (new Planning tab — separate from Debt Overview)

**Status — Shipped.** Now the **Rolling Debt Payoff** Planning tab (sibling to **Debt Overview**, which was the working name "Payoff Path" in this design note). Implementation lives in `components/RollingDebtPayoffDashboard.tsx` → `RollingDebtPayoffDashboardBundle.html`. Standard-mode UX (Cash-to-use-now, Decision card, HELOC card, Payment result table with **Small balance / Focus debt / Next debt / Excess** roles and **Paid off (this month) / Partially paid** actions, per-row **[Add payment]** → Cash Flow → Quick add, "Why not more?" breakdown → Cash Flow → Upcoming) and a single **Show details** toggle for the full planner output. The locked defaults below were preserved end-to-end; see **Help → Rolling Debt Payoff** and **SESSION_NOTES.md**. Historical design notes kept below.

**UI:** New sub-tab **next to** Debt Overview: **“Rolling debt payoff”** — own panel + script + server function; do **not** merge with Debt Overview.

**Locked defaults (implementation)**

1. **Mortgage / loan cash out vs debt mins**  
   - **Required expenses:** **INPUT - Cash Flow** Expense lines = source of truth for **actual cash out** (including mortgage/loan payments if present that month).  
   - **Minimum debt payments:** from **INPUT - Debts** only — **metadata / strategy context** in output; **do not add** to total required expenses (no double count).  
   - If CF has the mortgage/loan payment for that month, that amount is the required expense for that cash out.

2. **Stable vs variable rent**  
   - **Stable (recurring rent):** `Rent Mo House`, `Rent Oakley House - Section 8`, `Rent Oakley House - Tenant Part 1`, `Rent Oakley House - Tenant Part 2`, `Rent Oakley House - Tenant Part 3`, `Rent San Diego House`, `Rent MN House`.  
   - **Variable / non-recurring:** `Deposit San Diego House`, `Rent Oakley House - Section 8 Extra`, one-time catch-up rent, late fees, reimbursements, deposit-related amounts.  
   - **Tahoe:** do **not** treat as rent unless explicit Tahoe rental income is added later.

3. **San Jose low-rate “keep last”**  
   - Exact **INPUT - Debts** account name: **`Loan Depot - San Jose House`**.  
   - Add debts helper **`Priority Class`** (or equivalent): auto **`LOW_RATE_KEEP_LAST`** when account name is `Loan Depot - San Jose House` **or** APR **≤ 2.25%**.

4. **Minimum cash reserve**  
   - Default **`100000`**.  
   - Target: **assumptions/config sheet**; until it exists, **hardcode 100000** with a single constant / TODO to migrate to config.

5. **First month anchor**  
   - **Not** system date: anchor = **latest month column present** on **INPUT - Cash Flow** (e.g. `Apr-26` → that month is “this month”; next projected month is `May-26`).

6. **Credit card spend spike**  
   - **Primary:** per CC payee (match debt/card payees): current month vs **trailing 6-month median** for that payee — spike if **> 150%** of median **and** **≥ $500** above median.  
   - **Fallback** if **&lt; 3** months history: total CC spend vs **trailing 3-month average** of total CC — spike if **> 125%** of that average.  
   - **Portfolio:** total monthly CC spend **> 130%** of trailing 6-month median of **total** CC spend.  
   - Prefer distinguishing **new card spend** vs **payments**; if only net cash out, use expense as card cash out but **label confidence lower**.

8. **Credit card spend estimation (critical)**  
   - **Problem:** CF expense lines for cards may be **payments**, not true new spend.  
   - **If statement balance data exists:**  
     `New Spend = Current Statement Balance − Previous Statement Balance + Payments`  
   - **If only payments exist (no balance tracking):** treat CF card expense as **cash out**, **not** true spend; set **`credit_card_spend_confidence = LOW`**.  
   - **Optional:** track monthly card balances in a **separate table** for accurate spend.  
   - **Planning:** never assume **payment = overspending** automatically; **spike detection = warning**, not a hard constraint.

9. **RSU / stock income smoothing**  
   - **Do not** treat RSU as stable income; tag RSU / stock sales as **variable**.  
   - **RSU monthly baseline** = trailing **12-month average** of RSU sales (for projection context only).  
   - **Base plan:** ignore RSU baseline (**conservative**).  
   - **Projection (optional):** may include **50%** of RSU baseline.  
   - **Label:** `RSU income confidence = MEDIUM` (depends on company / vesting).

10. **Irregular expense smoothing**  
   - For any expense category: if **monthly value > 2× trailing 6-month median** → classify **irregular spike**.  
   - **Smoothed monthly expense** = **median of last 6 months** (use for **forward projections**).  
   - **Keep actual** value in historical / audit trail.  
   - **Examples:** Federal taxes, property taxes, large maintenance, one-time travel.

11. **Rental income normalization**  
   - **Per rental:** trailing **3-month average** rent.  
   - If **variance > 20%**, mark rental **unstable**.  
   - **Planning:** use **lower of** (trailing 3-month average, last known stable rent).  
   - **Confidence:** Section 8 rent = **HIGH**; market rent (San Diego, MO, etc.) = **MEDIUM**.

12. **Cash buffer accuracy**  
   - **Total cash** = all liquid accounts.  
   - **Available cash** = Total cash − **reserved buckets** (earmarked taxes, repairs, etc.).  
   - If reserved buckets **not** tracked: **`Available Cash = 85%` of total cash** (conservative haircut).  
   - **Planning:** use **Available cash** for decisions, not total cash.

13. **Debt paydown accuracy**  
   - If sheet balances **updated:** use directly.  
   - If **not:** estimate  
     `New Balance ≈ Prior Balance − Principal portion of payment`  
   - If principal unknown:  
     `Principal ≈ Payment − (Balance × APR / 12)`  
   - Mark **estimated balances** = **MEDIUM** confidence.

14. **Monthly plan stability guardrail**  
   - **Do not** shift long-term trajectory on **one** good/bad month.  
   - Require **2–3 consecutive** months of signal before adjusting projection / trajectory.  
   - **Example:** one bad month → ignore for projection shift; three bad months → adjust plan.

15. **San Diego property monitoring**  
   - **Monthly loss** = expenses − rent (per agreed definitions).  
   - If **trailing 6-month average loss > $1,500/month** → trigger **`REVIEW`**.  
   - If loss **persists 12 months** **and** **appreciation < 3%** → trigger **`CONSIDER_SALE`** (advisory only; **do not** force).

16. **Confidence scoring**  
   - Each **major number** in the plan should carry a **per-field confidence**: `HIGH` | `MEDIUM` | `LOW`.  
   - **Defaults by category:**  
     - **HIGH:** salary / payroll, mortgage payments (from CF as agreed), Section 8 rent.  
     - **MEDIUM:** market rent, RSU (and similar) **smoothed averages**, estimated loan balances when not sheet-updated.  
     - **LOW:** credit card “spend” when **no** statement balance data (payment-only / net cash out), highly irregular expenses.  
   - **Output:** include an **`overall_plan_confidence`** (aggregate score or label, e.g. weighted or worst-of-critical-path — **define in implementation** with a short rubric in Help) so the UI and JSON show how much to trust the month’s recommendations.

**Income buckets**

- **Variable income:** RSU sales, ESPP sales, bonus, tax refunds, other stock sales.  
- **Stable income:** **Cisco regular pay** + **recurring rents** (list above) only.

**Lump-sum split (variable inflows)**  
- **50%** debt · **30%** reserve/cash · **20%** flexible (configurable later).

**Extra debt payoff order (after CCs cleared by highest APR)**  
1. HELOC  
2. Tahoe mortgage  
3. San Diego mortgage  
4. MO mortgage  
5. San Jose mortgage **last** (`Loan Depot - San Jose House` / `LOW_RATE_KEEP_LAST`)

**Property stance**  
- **San Diego:** **HOLD / REVIEW** — flag persistent negative cash flow; **do not** force sale.  
- **Tahoe:** **protected lifestyle asset** — do **not** recommend sale.

**Output shape (reminder):** executive summary, **12-month** detail table, **84-month** roll with lighter long-range + annual debt totals, alerts/triggers, suggested actions, **per-field confidence** + **`overall_plan_confidence`**, **machine-readable JSON** (see prior chat schema).

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

7. ~~Add new bills to INPUT - Bills~~ — **Done.** Cash Flow → **Bills** → **Manage bills** → **Add bill** writes to **INPUT - Bills** via **`addBillFromDashboard`** (`bills.js`). Required: Payee, Category, Due Day, Default Amount, Payment Source. **Stop tracking** sets **Active = No** (never deletes). Activity events: **`bill_add`** / **`bill_deactivate`**. Header lookup is case/whitespace tolerant; missing optional columns (Payment Source, Category, Frequency, Start Month, Notes) are auto-added before write. See **SESSION_NOTES.md § Bills page: Manage bills, Flow Source, header tolerance**.

8. Cleanup the Debts/Bills sheets now that we have the other stuff
   - Only Debts should be here and other move to Bills

10. ~~On the Debt update page we should update the screen on the bottom and right like we did for **Quick add**~~ — **Done.** Planning → Debts → Update now shows a proper `Saving…` → `Saved.` status row below the button (same pattern as Quick add), optimistically repaints the right-hand info panel with the saved value, refreshes the Overview snapshot, and kicks off the debt planner as a silent background RPC so the save feels instant while Rolling Debt Payoff catches up shortly after. Also logs every field edit to **LOG - Activity** as a new `debt_update` event with a dynamic action label (e.g. *Updated Account Balance to $54,000.00*), classified as **Debt**, amount `—`, and previous / new values preserved in the event details JSON. Server-side `updateDebtField` no longer runs the planner inline. See **SESSION_NOTES.md § Debts — fast save + activity log + background planner** and Help **Activity log → `debt_update`**. Shipped in `c26c11c`.

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

**Planner email — debounce per-save runs + send to spouse too (V1.2)** — uncommitted at the time of writing. User reported "I do 50 saves at month-start and get 50 emails" plus "not sure spouse gets the email today." Fixed both in one pass. **(1) Multi-recipient resolution.** New `readPlannerEmailRecipientsStrict_()` in `planner_output.js` reads both `Email` and `Spouse Email` from `INPUT - Settings`, validates each against `PROFILE_EMAIL_REGEX_`, dedupes case-insensitive, and returns `{ valid, fields, invalidFields }`. `sendPlannerEmailIfConfigured_(summary, options)` joins valid addresses on the `To:` line in a single `MailApp.sendEmail` so spouse always gets the same copy. Legacy single-recipient `readPlannerEmailFromSettingsStrict_` removed. **(2) Debounce.** Per-save background planner runs are now invoked with `runDebtPlanner({ emailMode: 'defer' })` — they still re-run the planner and refresh Overview / Rolling Debt Payoff in the background, but they bump a `LAST_SAVE_AT` timestamp in `DocumentProperties` and log `planner_email_deferred` instead of sending. New file `debounce_planner.js` owns the queue (constants `DEBOUNCE_QUIET_WINDOW_MS_ = 10 min`, `DEBOUNCE_TRIGGER_INTERVAL_MIN_ = 5`). Time-driven trigger `debouncePlannerEmailRun` registered idempotently from `getDashboardSnapshot()` via `ensureDebouncePlannerTrigger_()`; on each fire it checks whether `now - LAST_SAVE_AT >= 10 min` and `LAST_PLANNER_EMAIL_AT < LAST_SAVE_AT`, and if so runs `runDebtPlanner({ emailMode: 'send' })` once to flush a single email. `markDebouncePlannerEmailSettled_()` (called whenever a `'send'` run completes — even when the meaningfulness gate or no-recipients gate skips actual mail) clears the queue so the trigger doesn't keep polling. **Manual button** (`Run Planner + Refresh Snapshot`) keeps sending immediately because `runPlannerAndRefreshDashboard()` defaults to `emailMode === 'send'`. New save-flow RPC `runPlannerAndRefreshDashboardFromSave()` defers; five client save sites in `Dashboard_Script_AssetsBankInvestments.html` (×2), `Dashboard_Script_AssetsHouseValues.html`, `Dashboard_Script_PlanningDebts.html`, `Dashboard_Script_Payments.html` switched to it. `house_expenses.js` server-side `runDebtPlanner()` call now passes `{ emailMode: 'defer' }`. New activity events `planner_email_deferred` / `planner_email_sent` / `planner_email_invalid_recipient` (classified as **Planner** kind, all non-monetary, all ineligible for the Activity Remove button); details JSON for `planner_email_sent` includes `recipientCount` and `recipientFields` (field names only — the addresses themselves are deliberately never logged so a typo can't leak into Activity). Worst-case email latency from a final save is ~10–15 minutes (10 min quiet window + up to 5 min until the next trigger fire). Help updated (`Dashboard_Help.html` → Debt Planner email → "Who gets the email" + "When the email is sent (debounce)" sections + Activity log new event descriptions + Remove button greyed list).

**Asset save sync — stop hanging on every save (V1.2)** — uncommitted at the time of writing; sibling commits `f13d928` (asset activity logs + fast save) and `6c0953d` (collapse repeat reads + Saving label) shipped earlier in the session. Saving an Investment value held the UI on `Saving…` for tens of seconds on populated workbooks. Root cause: `syncAllAssetsFromLatestCurrentYear_` (and the matching bank / house siblings) walked the year block with ~4 Sheets API round-trips per row to compute the latest-value map, then unconditionally re-wrote every SYS row through the format-preserving `setCurrencyCellPreserveRowFormat_`. For ~15–20 investments that produced 100+ round-trips per save. Fix in `investments.js`, `bank_accounts.js`, `house_values.js`: (1) rewrite `getLatest*ValuesForYear_` to do **2 round-trips total** (one full-sheet display, one batched data-range `getValues()`) and resolve the latest non-empty month in memory; (2) skip the format-preserving SYS write when the new value equals the existing rounded value, collapsing N writes to 1 in the common single-account-edit case; (3) reuse the already-loaded display when calling the header-map helpers. Same latest-value math, same activity logging, planner still runs in the background as a silent RPC. Bank Account and House Value saves get the same fix as defense-in-depth. See **SESSION_NOTES.md § Current State — Post V1.2 Prep → Asset save sync — stop hanging on every save**.

**Asset updates — activity log + fast save without waiting on planner (V1.2)** — shipped in `f13d928`. Bank Account, House Value, and Investment balance updates now log `bank_account_update` / `house_value_update` / `investment_update` events to `LOG - Activity` (previously these manual updates produced no audit entry at all), and the client-side save flows now decouple the UI refresh + activity log from the full planner run, mirroring the Debts pattern from `c26c11c`. Status flips through `Saving… → Saved.`, summary panel and activity log update immediately, and `runPlannerAndRefreshDashboard()` runs as a silent background RPC. Action labels include the month and new balance (e.g. *Updated May-26 balance to $1,234.56*); **Amount** renders `—` (non-monetary). Help updated.

**Asset pages — collapse repeat sheet reads + show "Saving…" instead of "Loading…" (V1.2)** — shipped in `6c0953d`. Two related fixes. (1) Performance: Bank Accounts / Investments / House Values / Debts page-load and dropdown-selection RPCs each made 2–4 full-sheet reads; consolidated to a single `getDataRange().getDisplayValues()` per RPC and threaded into helpers via new optional `display` / `headers` parameters (backward compatible). Per-row `getRange(row, col).getDisplayValue()` loops in the row-finder helpers were replaced with single batched range reads. (2) UX: after the asset fast-save fix, the load helpers were re-triggering `setStatusLoading()` and clobbering the `Saved.` message with `Loading…`. Save handlers now pass an explicit `'Saving…'` label, and `loadBankData / loadHouseData / loadInvestmentData` accept a `quiet` parameter that skips status updates so the `Saved.` message survives the post-save refresh.

**Quick Add — instant Activity ledger refresh + background planner (V1.2)** — shipped in `d743458`. Saving a Quick Add payment now calls `loadActivitySection()` immediately on success and fires the planner as a silent background RPC, so the new row appears on the Activity tab without waiting for the planner. Mirrors the Debts pattern.

**Quick Add — Bill Pay prefill race + explicit Other payee option (V1.2)** — shipped in `1305c40`. (1) Launching Quick Add from a bill on a cold tab failed to populate the **Existing Payee** dropdown because the prefill ran before `paymentPayees` finished loading. Fix stashes the wanted payee in `window.__pendingQuickAddPayee` and applies it from `loadPaymentSection`'s success handler with a guard that won't overwrite a user edit. (2) Added an explicit **Other (type new payee)** sentinel option (`__OTHER__`) at the bottom of the Existing Payee dropdown for adding a payee that isn't in the list yet; selecting it clears + focuses the typed input. Help updated.

**Bank Import — Step 2a ingestion pipeline (V1.2)** — shipped in `03d2c4a`. First server-side ingestion built on the Step 1 scaffold. `processBankImportBatch_(payload)` handles ignored checks (permanent only), exact-id auto-match against `SYS - Accounts.External Account Id`, pending staging upserts for everything else, balance-fingerprint dedupe against recent `LOG - Activity`, and four new event types (`bank_import_auto_matched` / `bank_import_pending` / `bank_import_ignored_hit` / `bank_import_row_error`). Dev/test harness only — no UI, no external sync, no planner impact. Strict deviations recorded: blank `currency` is `currency_mismatch`, `BANK_IMPORT_STALE_BALANCE_DAYS = 90` (future-dated `balanceAsOf` always stale), planner intentionally not called from auto-match.

**Planner email — handled-this-month check now uses each debt's next-due month (V1.2)** — shipped in `bae82c9`. The Debt Planner email's *Pay now* / *Pay soon* sections were silently dropping loan payments due in the next calendar month if the user had already paid the *current* month. Root cause: `buildUpcomingPayments_` checked the "handled" flag against the current calendar month's Cash Flow cell even when the payment's `nextDueDate` fell in a different month. Fix: `buildDebtMinimumHandledMap_` now returns a month-keyed nested map; `isDebtMinimumHandledThisMonth_` accepts a `monthHeader`; `buildUpcomingPayments_` resolves the correct month header for each upcoming payment before checking handled status. `runDebtPlanner` passes `[currentMonth, nextMonth]` so both months are pre-built.

**Bills Due — inactive debts and inactive Cash Flow rows no longer leak into the recurring fallback (V1.2)** — shipped in `9bf3234`. `Recurring Bills (No Due Date)` on the Bills Due page was showing debts marked `Active = No` in `INPUT - Debts` (reproduced with *Laith VCS Account*). Root cause: `getRecurringBillsWithoutDueDateForDashboard()` in `dashboard_data.js` only excluded payees present in the active-only `debtBills` map and never checked the Cash Flow row's own `Active` column, so deactivating a debt actually *promoted* its still-present Cash Flow row into the fallback list. Fix adds two guards inside the existing loop: (1) skip Cash Flow rows explicitly marked `Active = No` (accepts `no / n / false / inactive`; blank still means active, matching the `getCashFlowHeaderMap_` convention), and (2) a new sibling helper `getDebtPayeeMapAllStatuses_(ss)` — name-reservation only, no totals/planner impact — so any payee that appears in `INPUT - Debts` (regardless of status) is excluded from the fallback. Scope: `dashboard_data.js` only; the recurring-fallback function is consumed exclusively by `Dashboard_Script_BillsDue.html` (line 324). Planner math, Overview snapshot, Retirement, credit-card totals, Debts list, and the active Bills Due (Next 7 / Overdue) paths are untouched — they already filter inactive debts via `isDebtSheetRowInactive_`. See **SESSION_NOTES.md § Current State — Post V1.2 Prep → Bills Due — inactive debts and inactive Cash Flow rows no longer leak into the recurring fallback**.

**Debts — fast save + activity log + background planner (V1.2)** — shipped in `c26c11c`. Planning → Debts → Update now shows a proper `Saving… → Saved.` status row, optimistically repaints the right-hand info panel with the saved value, refreshes the Overview snapshot, and fires `runPlannerAndRefreshDashboard()` as a silent background RPC so Rolling Debt Payoff catches up shortly after without blocking the save. Server-side `updateDebtField` no longer runs the debt planner inline — that inline call used to hang the UI on `Saving…` for several seconds on large workbooks. Every field edit also writes a new `debt_update` event to **LOG - Activity** with a dynamic action label (e.g. *Updated Account Balance to $54,000.00*, *Updated Int Rate to 7.50%*, *Updated Due Day to 15*). Classified as **Debt** kind; **Amount** renders `—` (non-monetary) so field edits don’t double-count; previous / new raw + display values and `fieldKind` preserved in the event `details` JSON for future undo tooling. See **SESSION_NOTES.md § Current State — Post V1.2 Prep → Debts — fast save + activity log + background planner** and Help **Activity log → `debt_update`**.

**Quick Add — robust Saving… indicator + $0 allowed (V1.2)** — shipped in `098fef0` → `29f29a2`. Cash Flow → Quick add → Add to Cash Flow now reliably shows `Saving…` between click and `Saved to Cash Flow.` — `savePayment()` layers plain-text `setStatus` under `setStatusLoading` so the label survives deploy / CSS state drift, mirroring the proven legacy sidebar pattern. Server-side `quickAddPayment` amount validator relaxed from `amount <= 0` to `isNaN(amount) || amount < 0` with new error string *Amount must be a valid number.*; users can now save $0 on Quick add to zero out a month cell, correct a bad entry, or seed a placeholder row so the payee shows up in Bills Due / Upcoming before the first real payment. Upcoming Expenses, Income Sources, and Purchase Simulator still require `> 0` (different semantics, intentionally left alone). See **SESSION_NOTES.md § Current State — Post V1.2 Prep → Quick Add — robust Saving… indicator + $0 allowed** and Help **Cash Flow → Quick add**.

**V1.1 — Retirement Profile Integration (DOB source of truth)** — shipped end-to-end (commits `92c8673` → `6d25c0e`). Profile gained **Date of Birth** + full spouse/partner block (`Spouse Name / Email / Phone / Address / Date of Birth`) in the flat `INPUT - Settings` store. Retirement current ages are now **display-only** and derived **only** from Profile DOB: the editable Retirement Basics form was removed, the `needsProfileDob` readiness state replaces the old `needsHouseholdBasics` gate, the **Open Profile** CTA routes users to the missing input, the DOB parser accepts both Date objects and `YYYY-MM-DD` strings (fixing the silent Sheets-auto-date coercion), spinner arrows are gone (plain read-only divs with DOB hint text), and new `INPUT - Retirement` sheets no longer seed the now-unused `Your Current Age` / `Spouse Current Age` rows. Populated workbooks are preserved byte-for-byte: legacy age rows are left inert, no forced migration, and the hardcoded retirement-sheet formatting ranges were shifted to match the new layout. Backend `saveRetirementBasics` is a friendly-error stub for stale clients. See `SESSION_NOTES.md → V1.1 — Retirement Profile Integration (DOB Source of Truth)` for the detailed phase record.

**Activity ledger / UI (unnumbered)** — `house_expense` logging; no double ledger row when House Expense also writes Cash Flow; Activity **Type** filter + **getActivityDashboardData**; 20-row paging; inline date fields; Debt Planner email + Help **Debt Planner email**; Pay now/soon respect Cash Flow “handled” for current month; **Phase 3 Upcoming** activity events + no duplicate **`quick_pay`** when pushing from Upcoming.

**Bank Accounts (unnumbered)** — **Add new** path shipped (**`bank_accounts.js`**, dashboard + sidebar HTML/JS); **`bank_account_add`** activity; Help + panel title cleanup (see **Done (recent)** above for pointers).

**House Values (unnumbered)** — **Add new house** path shipped (**`house_values.js`**, dashboard + sidebar HTML/JS). Writes **INPUT - House Values** + **SYS - House Assets** (neighbor row formatting copied) and auto-creates **HOUSES - {House}** with canonical expense headers + column widths cloned from an existing HOUSES tab. Transactional rollback on partial failure. **`house_add`** activity event (Type **House Expenses**, sub-label **House added**). Duplicate-name validation is inline with a **`.field-error`** block under the House name input and focuses + selects the field. **Properties → House Expenses** selector refreshes on every navigation (`Dashboard_Script_Render.html`) so new houses are immediately usable. See **SESSION_NOTES.md § Assets → House Values: Add new house + integration polish** and Help **Assets → House Values** / **Activity log** / **HOUSES sheets** / **Sheet names**.

**5.** Fix SKIP issue in the Due Payments — adds 0 but does not refresh the screen (BUG). *(Marked done in prior testing; skip flow + UI refresh addressed.)*

**9.** Credit card should always list regardless of value in the Input Debts since we might have charged to them but not showing up or is that already there? *(Marked done.)*

**11.** New request on anything in debt other than the loans we should subtract that amount from the balance as long as it does not go < 0. If <0 then set that value to 0 after the payment is done. *(Marked done.)*

**17.** **Codebase — removed unused HTML** (done in repo): `Dashboard_Script_DueCards.html`, `Dashboard_Script_Core.html`, `Dashboard_Script_Utils.html` — were not referenced by any `includeHtml_` or `createHtmlOutputFromFile`. *Revert from git if a mirror is needed again.*

**18.** **HtmlService includes** — Documented in `WORKING_RULES.md` § HtmlService includes (`includeHtml_` + `getRawContent()`; no nested template tags in fragments). Cross-reference in `PROJECT_CONTEXT.md`.

**23.** **Light safety net** — Manual checklist + `rg` include/orphan checks in `TESTING_PLAN.md` § Light safety net; notes on `PlannerDashboard.html` vs web app drift.

**2.** **Donations UI** — **Cash Flow → Donations** tab: append rows to **INPUT - Donation** by tax-year block (`donations.js`, `Dashboard_Script_Donations.html`, Help **Donations**). *(Sidebar-only UI not required for this item.)*
