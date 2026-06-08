# ENHANCEMENTS

Durable product/engineering backlog for the financial planning system. Grounded in the current architecture (Sheets → Apps Script → React bundle) and the Rolling Debt Payoff UX as it ships today. Intended to be consumed one item at a time.

---

## 0. Current phase — Central App live + Family Beta readiness

The app has moved past "V1.2 / controlled improvement mode." **The Central App architecture is live** (CENTRAL_MODE routing, per-user workbook provisioning, workbook mapping), and Family Beta styling shipped for four input sheets. The authoritative forward plan is the detailed **`Launch Readiness Roadmap`** in `TODO.md` (7 phases; a high-level summary lives in `PROJECT_CONTEXT.md`); product framing is in `PROJECT_CONTEXT.md → Current architecture — Central App (live)` and `PROJECT_CONTEXT.md → Family Beta workbook styling`.

The V1 trust baseline and V1.1 retirement profile integration remain the stable foundation (`SESSION_NOTES.md → V1 trust baseline — complete` / `→ V1.1 — Retirement Profile Integration`). The full per-slice migration history is in `SESSION_NOTES.md → Current State — Post V1.2 Prep` and the `CENTRAL_APP_*.md` docs.

Change discipline for every edit (unchanged from V1.2):

- **In scope:** small, localized changes that preserve existing populated-workbook behavior, after passing the blank + populated two-track manual checks in `TESTING_PLAN.md`. Central App changes additionally follow `WORKING_RULES.md → Central App Transition Rules` (now active): one module at a time, both modes coexist, no destructive sheet changes.
- **Out of scope unless explicitly approved:** large refactors (full `dashboard_data.js` split, onboarding factory refactor, broader regression/test harness), any change to `doGet` / `includeHtml_` / snapshot shape, and destructive sheet changes.

Items below that are fully delivered still carry their original "DELIVERED" tag so the rationale and history stay visible; they are not re-opened.

### Active / Next / Later at a glance

Authoritative roadmap lives in `TODO.md → Launch Readiness Roadmap` (high-level summary in `PROJECT_CONTEXT.md`). Mirror here is short on purpose:

- **Active now:** Phase 1 — Documentation Cleanup (this pass). Next up: Phase 2 — Family Beta Hardening — **2A Workbook Diagnostics** (read-only duplicate / orphan / stale detection, classification, mapping audit) then **2B Workbook Recovery** (auto-adopt, repair tools, stale-mapping recovery UX). Design: `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`.
- **Delivered (headline):** Central App migration (resolver + provisioning + mapping, live), Family Beta styling for Bank Accounts / Debts / Bills / Upcoming Expenses.
- **V1.2 candidates (A — immediate follow-ups, low risk):** Profile DOB parser symmetry (accept Date objects on save-side validation), Overview Retirement Outlook copy alignment with `needsProfileDob`, blank-workbook empty-state consistency sweep, copy/Help polish sweep.
- **V1.2 candidates (B — product improvements):** Profile completeness indicator / badge, better Retirement setup guidance / linking to Profile, optional spouse UX clarity (single vs partnered).
- **V1.2 candidates (C — future ideas, do not act yet):** legacy sheet cleanup tool (remove inert `Your Current Age` / `Spouse Current Age` rows on existing `INPUT - Retirement` sheets), Profile → other modules integration, notifications / SMS using the existing Profile phone field.
- **Deferred from V1.1 (re-qualify before pulling):** planner email guardrails telemetry (informational only), low-risk codebase cleanups, dead-code prune for the retirement profile integration (`readRetirementHouseholdSafe_`, `getRetirementHouseholdInputs_`, `writeRetirementHouseholdInputs_`, `saveRetirementBasics` stub).
- **Later (post-V1.2 / future phase):** onboarding factory refactor, Activity smart-undo Phases 2–4, Cash Strategy, HELOC advisor refinement, Plaid-style sync, broader regression / test harness, two-dashboards unification, and the other big-product items captured below and in `TODO.md → Historical backlog`.

### Delivered — retirement profile integration (V1.1 close-out)

Shipped end-to-end in V1.1 (commits `92c8673` → `6d25c0e`). **Profile is now the single source of truth for Date of Birth.** Full phase summary in `SESSION_NOTES.md → V1.1 — Retirement Profile Integration (DOB Source of Truth)`. Headlines:

- **Profile** gained **Date of Birth** plus a full spouse/partner block (`Spouse Name / Email / Phone / Address / Date of Birth`) in the flat `INPUT - Settings` store. Existing required fields (`Name`, `Email`) unchanged; all new fields optional.
- **Retirement** derives current age exclusively from Profile DOB. The Retirement Basics edit form is removed; per-scenario age fields are display-only (plain divs, no spinner arrows). A new `needsProfileDob` readiness state routes users to **Open Profile** when DOB is missing. The DOB parser accepts both Date objects and `YYYY-MM-DD` strings, fixing the silent Sheets-auto-date coercion bug. New `INPUT - Retirement` sheets no longer seed the now-unused age rows.
- **Backward compatibility preserved** — populated workbooks are untouched byte-for-byte. Legacy age rows on existing retirement sheets are left inert (no read, no write, no planner consumption). No forced migration.

### Delivered — Upcoming Expenses: Account / Source dropdown + Loan / Financing excluded from Rolling Debt Payoff cash reserve (V1.2)

**`Account / Source` on the Upcoming Expenses Add+Edit form is now a controlled dropdown, and Loan / Financing rows no longer reduce Rolling Debt Payoff "Safe to use" by the financed purchase price.** Shipped in `115943b`.

User-visible problem: a planned Lexus TX 500h purchase (Amount `$90,000`, Source `loan`, Due Date set) was reducing Rolling Debt Payoff "Safe to use" by the full $90k, dragging the deployable-cash recommendation from ~$141k down to ~$51k. The intent of a loan / financing row is "I'm going to take on debt to buy this" — the financed purchase price *should not* hit cash reserves today, and it *should not* be modeled as a card balance either. Two root causes:

1. **Free-text `Account / Source` input** — there was no canonical vocabulary, so users typed whatever was on hand (`loan`, `Chase Sapphire`, `wells fargo cd account`, house names, blank). The Rolling Debt Payoff classifier had to guess from substrings.
2. **`rollingClassifyPlannedExpenseFunding_` had no loan branch** — the classifier in `rolling_debt_payoff.js` only checked for credit-card and cash keywords. The string `loan` matched neither, so it fell through to the generic fallback at the bottom of the function (treat as **cash**), which then funneled the full $90k into `near_term_cash_total` via `buildRollingPlannedExpenseImpactModel_`.

Design decisions:

- **Controlled dropdown for the canonical funding cases.** The Add+Edit form's `Account / Source` input becomes a `<select>` with five canonical options (**Cash**, **Credit Card**, **Cash + Credit Card**, **Loan / Financing**, **Other / Unknown**) plus an **Other (custom)…** sentinel that toggles a sibling text input. This mirrors the existing **Bank Accounts → Use Policy** "Other (custom)…" pattern users already know from `Dashboard_Script_AssetsBankInvestments.html`. Legacy free-text values (existing rows) hydrate cleanly: any value that isn't one of the five canonical options falls through to **Other (custom)…** with the original string preserved in the text input, so an edit-save round-trip is a no-op for legacy rows. **No schema change** — the underlying `INPUT - Upcoming Expenses → Account / Source` column stays a single free-text cell; the dropdown only constrains *new* input.
- **Five canonical options, deliberately chosen.** Cash, Credit Card, Cash + Credit Card, Loan / Financing, Other / Unknown. The first four are the dominant real-world funding modes; **Other / Unknown** is the explicit "I don't know yet / doesn't matter" option that maps to the conservative cash fallback. The split between **Cash + Credit Card** and pure **Credit Card** exists because in v1 we don't model split-funding — both route through the card branch, but **Cash + Credit Card** signals user intent (some cash is involved) which a future split-funding feature can build on without breaking back-compat. **Loan / Financing** is the new option that fixes the bug.
- **Classifier gains a `'loan'` branch that runs before cash/card checks.** `rollingClassifyPlannedExpenseFunding_` in `rolling_debt_payoff.js` now matches `loan`, `financing`, `financed`, `auto loan`, and `car loan` substrings (case-insensitive, post-trim) **before** falling through to the existing credit-card and cash branches. Ordering matters: a string like `auto loan` would otherwise match the cash fallback. The loan-funded amount is excluded from both `near_term_cash_total` (so it doesn't reduce deployable cash) and `unmapped_card_funded_cash_risk_total` (so it isn't treated as a card-risk hold either) — it's tracked separately in a new `loan_funded_near_term_total` aggregate for visibility in the Why-not-more breakdown.
- **Other funding-type behavior preserved.** **Cash** still subtracts from deployable cash via the near-term hold. **Credit Card** still maps to a specific card debt via `rollingResolveCcDebtNameForPlannedExpense_` when a match exists, otherwise reserves the amount as an unmapped card-risk hold. **Cash + Credit Card** still routes through the card branch (conservative; no split-funding in v1). **Other / Unknown** and blank still fall back to the cash branch. None of these branches changed math — only the classifier ordering / loan branch is new.
- **No new debt creation. No amortization. No payment schedule.** A loan / financing row is purely a "don't reduce cash for this" signal in v1. We don't auto-create a debt in **INPUT - Debts** for the financed amount, we don't model the monthly payment, we don't subtract a down payment. If the user wants to track the down payment, the Help copy tells them to enter it as a separate **Cash** Upcoming Expense — explicit, user-controlled, no surprises.
- **UI hint only on Loan / Financing.** A muted-text hint below the dropdown reads *"Loan / financing: the financed purchase price won't reduce cash today and isn't modeled as a card balance. Enter any down payment as a separate Cash upcoming expense."* It shows only when **Loan / Financing** is selected, to keep the Add form quiet for the default Cash case. Same pattern as the existing per-section hints in the Add form.

Client-side wiring:

- Three new helpers in `Dashboard_Script_CashFlowUpcoming.html` own the dropdown ↔ custom-input bookkeeping: `syncUpcomingAccountSourceCustom_` (toggles the custom-input row and the loan hint based on the dropdown's current value), `getUpcomingAccountSourceValue_` (returns the effective value — the dropdown's value unless it's the **Other (custom)…** sentinel, in which case the custom input's trimmed value), and `setUpcomingAccountSourceValue_` (sets the dropdown + custom-input pair from a single string — picks the canonical option if the value matches, otherwise falls back to **Other (custom)…** with the original string in the text input).
- All four direct touchpoints to `up_accountSource.value` were routed through the helpers: edit-mode hydration in `enterUpcomingEditMode_`, Add-mode reset in `resetUpcomingFormToAddMode_`, save-payload construction in `saveUpcomingExpense`, and post-success reset in `saveUpcomingExpense`. No other client-side code reads or writes `up_accountSource` directly anymore.
- The dropdown fires `change` to call `syncUpcomingAccountSourceCustom_` so toggling visibility is immediate and doesn't wait for re-render.

Server-side:

- No write-path change. `addUpcomingExpense` and `updateUpcomingExpenseFromDashboard` in `upcoming_expenses.js` continue to write the `Account / Source` field as a free-text string, exactly as before — the value just happens to come from a constrained set now (or from the custom input). **No new Activity event type**; loan rows still log `upcoming_add` / `upcoming_update` like any other Upcoming row.
- The only server-side change is in `rolling_debt_payoff.js`: `rollingClassifyPlannedExpenseFunding_` gains the new `'loan'` branch, and `buildRollingPlannedExpenseImpactModel_` gains a near-term loan branch that aggregates `loan_funded_near_term_total` and explicitly skips the cash and card-risk holds for loan rows.

Runtime validation:

- Test case: planned Lexus TX 500h Upcoming row, Amount `$90,000`, Due Date set ~6 weeks out, original Source `loan` (free text).
- **Before classification fix**: Rolling Debt Payoff "Safe to use" ≈ `$51,000`. `unmapped_card_funded_cash_risk_total` ≈ `$120,500` (the Lexus row was being lumped into the cash-risk reserve via the fallback).
- **After**: the Lexus row's Source was changed to **Loan / Financing** via the new dropdown; the planner re-ran; `unmapped_card_funded_cash_risk_total` dropped to ≈ `$30,500` (the remaining unmapped card-funded Upcoming rows); `loan_funded_near_term_total` registered ≈ `$90,000` separately; **Safe to use** recovered to ≈ `$141,000`. The cash-funded Solar Addition (`$9,500`) still reserved correctly; the credit-card Roof Replacement still behaved as before. A clean ~$90k delta matching the row amount, with no math change for any other funding type.

What was intentionally **not** done:

- **No Central App migration files were touched** *(by this Upcoming Expenses pass; statement was accurate at the time of that commit)*. `central_resolver.js`, `cash_to_use.js`, and every `CENTRAL_APP_*.md` were untouched by this pass. **Superseded note:** the "Phase 1 resolver seam … remains the only Central App change" framing is no longer true — the Central App migration has since landed in full (live resolver + provisioning + mapping). See `PROJECT_CONTEXT.md → Current architecture — Central App (live)`.
- **No schema change to `INPUT - Upcoming Expenses`.** The `Account / Source` column stays free-text.
- **No new Activity event types.** Loan rows generate `upcoming_add` / `upcoming_update` like any other Upcoming row.
- **No split-funding model.** **Cash + Credit Card** still routes entirely through the card branch in v1.
- **No new debt creation, no amortization, no payment-schedule modeling.** A loan / financing row is purely a "don't reduce cash for this" signal.

Files touched:

- `Dashboard_Body.html` — replaced the `Account / Source` text input with a `<select>` (5 canonical options + **Other (custom)…** sentinel), a hidden sibling text input row, and a hidden Loan / Financing hint.
- `Dashboard_Script_CashFlowUpcoming.html` — added `syncUpcomingAccountSourceCustom_` / `getUpcomingAccountSourceValue_` / `setUpcomingAccountSourceValue_` helpers and routed the four `up_accountSource.value` touchpoints (edit hydration, Add-mode reset, save payload, post-success reset) through them.
- `rolling_debt_payoff.js` — added the `'loan'` branch to `rollingClassifyPlannedExpenseFunding_` (runs before cash/card checks), added the loan branch to `buildRollingPlannedExpenseImpactModel_` with the new `loan_funded_near_term_total` aggregate, and explicitly excluded loan rows from `near_term_cash_total` and `unmapped_card_funded_cash_risk_total`.
- `Dashboard_Help.html` — expanded the **Add Upcoming Expense** bullet under **Upcoming expenses → Actions** to enumerate the five canonical funding options and what each one does to the Rolling Debt Payoff cash reserves.

### Delivered — Bank Import: Step 2b Review UI for staged bank accounts (V1.2)

**Cash Flow → Bank Accounts now has a third "Review imports" segment for resolving pending imported bank accounts.** Uncommitted at the time of writing.

User-visible problem: Step 2a's `processBankImportBatch_` (shipped earlier) successfully drops unknown imported bank accounts onto `SYS - Import Staging — Bank Accounts` with `Status = 'pending'` and a pending reason from the fixed allow-list (`no_exact_id_match` / `currency_mismatch` / `type_conflict` / `inactive_match` / `ambiguous_external_id` / `stale_balance`). But there was no UI to do anything with those rows — they just accumulated on the staging sheet, invisible to the planner / Overview / SYS - Accounts (intentional: pending-rows-do-not-count was the safety guarantee). User asked: "Add a safe review UI for staged bank accounts so the user can review pending imported bank accounts and choose: Add as new account / Match to existing account / Ignore."

Design decisions captured for the next session:

- **Reuse the segmented control, don't build a separate page.** The Bank panel already had Update / Add new as two segments. Adding **Review imports** as a third segment is byte-for-byte consistent with the existing pattern, lives on the same `#bank` panel that owns SYS - Accounts state, and shares the single `#bank_status` row for all feedback. No new top-level tab, no separate page, no modal.
- **Status-flip-only resolution.** No new column on the staging sheet. Step 2a already writes `Status = 'pending'`; the three resolution paths flip it to `'resolved_added'` / `'resolved_matched'` / `'resolved_ignored'`. The reader filters `Status === 'pending'` so resolved rows fall off the review list immediately. Once the External Account Id is on `SYS - Accounts` (Add-new / Match) or on the Ignored sheet (Ignore), the next ingestion's auto-match / ignored-check fires *before* the staging upsert path and never re-stages the same fingerprint — so resolved rows stay stable forever without us policing the Status column. The Step 2a upsert path (`bankImportUpsertPendingStagingRow_`) only force-resets Status to `'pending'` when re-staging the same Staging Id, which by construction can only happen for unresolved rows.
- **Add-as-new reuses `addBankAccountFromDashboard`.** Same validation, same INPUT - Bank Accounts row insert, same SYS - Accounts append, same opening-balance write, same full rollback on failure. The only thing layered on top is stamping the staged External Account Id onto the new account's row via the new helper `bankImportSetAccountExternalId_(sheet, accountName, externalId, refuseIfDifferent=false)`. Opening balance + date come from the staged snapshot (not the payload) so the row the user reviewed is the one persisted — the Add inline form only collects Use Policy / Priority / the two checkboxes, which Add new requires.
- **Add-new partial-success is recoverable, not destructive.** If the External Account Id stamp fails after the new account succeeded (transient sheet error, flush race), we still flip the staging row to `resolved_added` and surface the partial state in the activity row's details (`linkExternalIdSucceeded: false`, `linkExternalIdError: <message>`). The new account exists from the user's perspective; they can re-link via Match. We chose this over rolling back the new account because the cost of re-linking is one click while the cost of re-running Add new is filling the form again.
- **Match conflict guard refuses, never overwrites.** If the user picks an existing active account that already has a *different* non-blank External Account Id, the call throws the canonical `'That account is already linked to a different external id. Match aborted.'` message. No confirmation dialog, no overwrite path. The dropdown UI flags accounts with `(already linked)` so the user can see *something* is linked before picking, but the conflict guard fires server-side because the External Account Id value isn't sent to the client (security/UX choice — clients don't need to see existing external ids to make match decisions).
- **Match is a single-cell write, never balances or planner fields.** Only the `External Account Id` cell on the chosen account is touched. Available Now, Min Buffer, Use Policy, Priority, Active, Type, and the entire INPUT - Bank Accounts side are left alone. The match is purely a "future ingestion routing hint" — it doesn't tell the user the balance was applied (it wasn't; the snapshot stays on staging marked `resolved_matched`). If the user wants the balance reflected, they update Available Now via the regular Update mode like any other balance change.
- **Ignore is permanent-scope only for Step 2b.** Step 2a's ignored-matcher only honors `Scope = 'permanent'` (until_changed handling is deferred to a later step). Exposing both scopes in the UI now would just be misleading dead-ends. The Ignore form is a single confirmation card explaining the permanent semantics; we'll add scope choice when until_changed is honored end-to-end. Idempotent: re-Ignoring an entry already on the Ignored sheet skips the append but still flips the staging row's Status so the UI clears it.
- **Document lock per resolution.** Every entry point takes a 30s `LockService.getDocumentLock()` (same pattern as `processBankImportBatch_`) so two browser tabs can't race-resolve the same row. The lock guards the read-then-write of staging Status + the External-Id-or-Ignored write together.
- **Cross-tab stale resolution returns a friendly message.** If tab A resolves a row first, tab B's subsequent click on the same row hits the canonical `'Staged row is no longer pending. It may have been resolved in another tab.'` message via the same status-check path. Same for the "row was deleted from staging by hand" case (`'Staged row not found. It may have been removed from the staging sheet.'`). No hard error, no console stack — the user sees a one-line status banner and the review list refreshes.
- **Single new "Bank Import" activity kind covers Step 2a + Step 2b.** A single new prefix rule in `classifyActivityKind_` (`if (etEarly.indexOf('bank_import_') === 0) return 'Bank Import';`) classifies all seven events under one filterable Type. The user can pull the entire import audit trail with a single Type filter without confusing it with the Bank kind (which still covers `bank_account_add` / `_update` / `_deactivate`). The dollar value lives on the eventual `bank_account_add` row when Add-as-new is taken, so all three review events render Amount as `—` to avoid double-counting against Activity totals.
- **Refresh chains intentionally narrow.** Match / Ignore success → only `loadBankImportReviewSection()` (no `refreshSnapshot()` because no planner inputs change). Add-as-new success → `loadBankImportReviewSection()` + `loadBankSection()` (the new account needs to surface in the Update-mode dropdown) + `refreshSnapshot()` (the new account legitimately changes the planner / Overview cash inventory).

Concurrency edges already handled:

- Two tabs racing the same row → 30s document lock + Status check inside the lock → second call returns the friendly already-resolved message.
- Staging sheet deleted by hand → friendly not-found message; Add-as-new doesn't fire the underlying `addBankAccountFromDashboard` because the look-up fails before that.
- Account name pre-fill in Add inline form collides with an existing account → `addBankAccountFromDashboard` throws its existing duplicate-name error verbatim; the user can edit the name field before re-saving.
- Existing account selected for Match was deactivated between page load and click → match writes the External Account Id onto the inactive row (allowed; the column is independent of Active state). Future ingestions still won't auto-match against an inactive row (Step 2a's `bankImportLookupAccountByExternalId_` filters by active first), so the row will land in pending again with `inactive_match` reason — which is a desired outcome, not a bug.

Activity log details JSON for Step 2b review events: `{ detailsVersion: 1, bankImportStep: '2b', stagingId, externalAccountId, institution, displayName, last4, type, currency, balance, balanceAsOf, ...extraDetails }`. `extraDetails` carries `accountName` for add/match, `scope` + `alreadyIgnored` for ignore, `pendingReason` from the row that was reviewed, and the partial-success flags for add-new. `bankImportStep: '2b'` distinguishes review events from Step 2a ingestion events without inspecting eventType prefixes (future observability hook).

Files touched:

- `bank_import.js` — added 4 public entry points (`getBankImportReviewData`, `addStagedBankAccountAsNew`, `matchStagedBankAccountToExisting`, `ignoreStagedBankAccount`) and 9 helpers (`bankImportLoadStagingHeaderMap_`, `bankImportListPendingStagedRows_`, `bankImportFindStagingRowByStagingId_`, `bankImportSetStagingRowStatus_`, `bankImportListExistingAccountSummaries_`, `bankImportSetAccountExternalId_`, `bankImportIgnoredEntryExists_`, `bankImportAppendIgnoredEntry_`, `bankImportLogReviewActivity_`). Plus 3 status constants, 3 event constants, and 3 friendly-message string constants. ~430 lines added; existing Step 1 / Step 2a code untouched.
- `activity_log.js` — added one prefix rule in `classifyActivityKind_` (covers Step 2a + 2b events at once), 3 new static action-label cases (`bank_import_review_add_new` → 'Created account from import', `_match` → 'Matched to existing account', `_ignore` → 'Ignored bank import'), 3 new entries in `activityLogIsNonMonetaryEvent_`. ~20 lines added across three switches.
- `Dashboard_Body.html` — 1 new segment button (`#bank_mode_review_btn` with embedded `#bank_mode_review_badge` count span) + 1 new wrap div (`#bank_mode_review_wrap` containing description + `#bank_import_review_list` container). No new CSS — re-uses `.bank-mode-wrap` / `.segmented` / `.muted` / `.upcoming-item` / `.upcoming-actions` / `.small-btn` / `.check-row` / `.field-error`.
- `Dashboard_Script_AssetsBankInvestments.html` — extended `setBankPanelMode` to handle `'review'`, added `__bankImportReviewState` module-level state, plus 13 review-section helpers (`loadBankImportReviewSection`, `updateBankImportReviewBadge_`, `renderBankImportReviewList_`, `renderBankImportReviewCard_`, `toggleBankImportReviewAction_`, `renderBankImportReviewAddForm_`, `onBankImportReviewAddPolicyChange_`, `renderBankImportReviewMatchForm_`, `renderBankImportReviewIgnoreForm_`, `confirmBankImportReviewAddNew_`, `confirmBankImportReviewMatch_`, `confirmBankImportReviewIgnore_`). ~250 lines added.
- `Dashboard_Help.html` — 1 new `<h4>Bank Accounts — Review imports</h4>` block with action descriptions, conflict-guard message, resolved status values, and the cross-tab friendly message; 3 new bullets under the Activity log section for the new event types.

No schema changes (only `Status` cell writes on staging, only `External Account Id` cell writes on Accounts, only appends to Ignored). No planner / Overview impact for pending rows. No external sync, no automated polling, no monetization architecture, no broad UI redesign.

### Delivered — Upcoming Expenses: bounded edit mode for Planned rows (V1.2)

**Cash Flow → Upcoming now supports editing existing Planned rows in place via the existing Add form.** Shipped in `af438a1`.

User-visible problem: every Upcoming card had Quick add payment + Dismiss buttons, but no way to change a Due Date, fix a typo, or re-budget the Amount once a row was saved. The user asked: "I need a way to edit the upcoming events like the date etc..." The only existing workaround was to Dismiss the row and re-add it from scratch, which broke any partial-payment history attached to it.

Design decisions captured for the next session:

- **Reuse the Add form, don't build a modal.** Each Planned card gets a third **Edit** button. Clicking it hydrates the existing Add Upcoming Expense form with the row's values, flips the Save button label from `Add Upcoming Expense` → `Save changes`, surfaces a `Cancel edit` link, and shows an `Editing: <expense name>` banner above the inputs. One validation + status surface to maintain; no new UI surface to build.
- **Edit Planned rows only.** The Edit button is rendered only inside the Planned-row card template (which is what `renderUpcomingList` already filters to). Server-side, the new `updateUpcomingExpenseFromDashboard` refuses with `Only active (Planned) upcoming expenses can be edited.` if Status isn't `Planned`. Paid / Dismissed / legacy Skipped rows are intentionally locked — use the dedicated lifecycle paths or re-add to change them.
- **Editable surface = exactly the 8 fields the Add form already exposes.** Expense Name, Category, Payee, Due Date, Amount, Account / Source, Auto Add To Cash Flow, Notes. ID, Status, and Added To Cash Flow are *never* written by Edit so the existing payment-applied / dismissed lifecycle (and its `upcoming_payment` / `upcoming_status` audit events) stays consistent. Editing Amount rewrites the *remaining* balance — not the original total — which matches the Add form contract and is called out in the Help.
- **No-change saves are silent.** When all 8 fields equal their existing values after normalization, `updateUpcomingExpenseFromDashboard` returns `{ ok: true, message: 'No changes.', changedFields: [] }` without touching the sheet, without bumping `touchDashboardSourceUpdated_`, and without writing an Activity row. Avoids ledger noise when the user opens Edit just to look at a row.
- **Per-cell writes for the typical 1–2 changed-field edit.** Rather than re-writing the full 11-column row, the server diffs `previous` vs. `next` for each editable column and only fires `setValue` on the columns that changed. Re-applies the Due Date (`yyyy-mm-dd`) and Amount (currency) number formats only on those two cells when they change. Cheaper round-trip cost than a whole-row write and avoids touching unchanged cells.
- **Single-field action labels are specialized; multi-field is generic.** The new `upcomingUpdateActionLabel_` helper renders `Updated Due Date to 2026-05-19` / `Updated Amount to $9,500.00` / `Updated <Field>` for single-field edits and `Updated N fields` for multi-field edits — same shape pattern as `debtUpdateActionLabel_`. Defensive fallback to `Updated` for legacy / partial-detail rows so a future schema bump can't crash old activity rows.
- **Edit-success refresh is intentionally narrow.** Only `loadUpcomingSection()` fires after a successful save (which re-paints both the in-page mini-cards and the Overview `ov_upcoming_*` KPIs because `renderUpcomingSummary` already fills both). No `loadDashboardActionSections` / `refreshSnapshot` / silent planner — Upcoming Expenses aren't in the debt planner's input set, and the snapshot already gets stale-detected on the next tab navigation if needed. Add path keeps its full refresh chain unchanged.
- **Cancel edit returns to Add mode without a server round-trip.** Clears edit state, blanks the form (matches the existing Add post-save reset), hides the Cancel button + mode banner, and resets the Save button label. No RPC; cheap.

Concurrency:

- If the row gets dismissed / paid by another tab while Edit is open, the next Save fails cleanly with `Only active (Planned) upcoming expenses can be edited.`. The client surfaces the message; the user reloads the list and sees the row has fallen off the active board. No partial write, no orphaned `upcoming_update` row.
- Server-side validation matches Add (`expenseName / dueDate / amount > 0`) so the inline name-error helper and the status row both behave identically — no client-side branch needed for failure UX.

Activity log details JSON for `upcoming_update` is unchanged from the proposal: `detailsVersion / upcomingId / expenseName / payee / changedFields / previous / new`, where `previous` and `new` always carry full 8-field snapshots regardless of which fields changed. Future undo tooling can reconstruct the prior state directly from `previous` without re-deriving from earlier rows. Activity row fields: `entryDate` = new (post-edit) Due Date so the row sorts alongside the obligation; `payee` = new payee (or new Expense Name as fallback); `category` = new category; `amount = 0` (non-monetary, rendered `—`); `dedupeKey = ''` (edits aren't idempotent in the way `upcoming_add::<id>` is).

Files touched:

- `upcoming_expenses.js` — added `updateUpcomingExpenseFromDashboard(payload)` and `appendUpcomingActivityUpdate_(...)`. Existing functions (`addUpcomingExpense`, `dismissUpcomingExpense`, `applyPaymentToUpcomingExpense`, `findUpcomingExpenseRowById_`, the lifecycle helpers) are unchanged.
- `activity_log.js` — added `upcoming_update` to the action-label switch (delegating to the new helper), added `upcomingUpdateActionLabel_` + `upcomingUpdateFieldDisplayName_` helpers, added `upcoming_update` to `activityLogIsNonMonetaryEvent_`. Classification falls through automatically (`upcoming_*` → `Upcoming` via the existing prefix rule); Remove-button greying is automatic too because only `donation` rows are removable.
- `Dashboard_Body.html` — added hidden `#up_form_mode` banner above the Add form inputs, gave the Save button an `#up_save_btn` id, added a hidden `#up_cancel_btn` next to it. No new CSS; the banner reuses `.muted` and the cancel button reuses `.small-btn`.
- `Dashboard_Script_CashFlowUpcoming.html` — added module-level `__upcomingEditingId` state, helpers `enterUpcomingEditMode_` / `resetUpcomingFormToAddMode_` / `editUpcoming(id)` / `cancelUpcomingEdit()`, an `Edit` button in `renderUpcomingList`, and a dual-mode branch in `saveUpcomingExpense()` that calls `updateUpcomingExpenseFromDashboard` when editing.
- `Dashboard_Help.html` — Edit bullet under **Upcoming expenses → Actions** (covers the `Planned`-only constraint, the editable field list, the validation contract, and the "Amount represents the remaining balance" note); `upcoming_update` description in the Activity log section; cross-reference under the main Activity log index.

### Delivered — Bills + Debts: insert new rows sorted by Due Day (V1.2)

**New bills and new debts are now inserted into their underlying sheets in Due-Day-ascending order instead of always landing at the bottom.** Shipped in `484db5c`.

User-visible problem: the dashboard's Manage Bills table and Debts dropdown both sort by Due Day for display, but the underlying `INPUT - Bills` and `INPUT - Debts` sheets drifted out of order over time because every new add was appended at the end (or, for debts, parked just above `TOTAL DEBT` regardless of Due Day). Anyone scrolling the raw sheet to find a freshly added row had to hunt for it. User asked: "when adding a new bill to the table can we make sure it is inserted sorted based on the due date? same applies for debts."

Insertion rule (mirrored across both files):

- Scan existing rows top-down, insert **before** the first row whose Due Day is strictly greater than the new row's.
- Same-day ties land **after** existing same-day rows (newest at the bottom of the same-day group), matching the dashboard's stable sort.
- Legacy rows with a blank Due Day sink to the bottom — numeric rows are inserted above the first blank row encountered.
- When no row has a strictly greater Due Day and there are no blanks to displace, fall through to append at the end.

Bills (`bills.js → addBillFromDashboard`):

- New helper `findBillsSortedInsertRow_(sheet, dueDayCol1Based, newDueDay)` does one bounded `getValues()` over the Due Day column and returns the 1-based row to `insertRowBefore()`, or `-1` to append.
- New helper `copyBillsRowFormattingFromInsertSiblingRow_(sheet, newRow)` paints PASTE_FORMAT from the closest already-styled sibling — prefers the row immediately below the insert (it was at the insert position before the shift), falls back to the row above when the insert lands at the very last data row. Never copies row 1 (the header) so we don't inherit bold/header styling.
- The append fallback continues to use the existing `copyBillsRowFormattingFromPreviousRow_` so first-time-add and end-of-sheet cases are byte-for-byte unchanged.

Debts (`debts.js → addDebtFromDashboard`):

- New helper `findDebtsSortedInsertRow_(sheet, headerMap, templateRow, newDueDay)` constrains the scan to the **active region** (rows 2..templateRow) above `TOTAL DEBT`. Stop-tracked rows below the summary are intentionally not considered — they're soft-deleted and shouldn't influence active-region ordering.
- When the new debt belongs at the end of the active region (its Due Day is greater than every existing active row), the helper returns `templateRow + 1`, preserving the legacy "insert just above TOTAL DEBT" placement and so leaving the blank buffer + `TOTAL DEBT` + any stop-tracked rows untouched.
- Format-copy logic is sibling-aware: prefer the row immediately below the insert when the insert lands mid-region; prefer the row above when the insert lands at `templateRow + 1` (where the row below would now be buffer / `TOTAL DEBT`).
- The existing `findDebtTemplateRow_` is left unchanged.

Defensive guards in both helpers:

- Missing Due Day / Due Date header → fall back to legacy append behavior rather than scrambling the sheet.
- Non-numeric Due Day input (which the form validators already reject upstream) → also falls back rather than misbehaving.

Safe diff — every read path elsewhere joins by name (`findRowByName_`, `getInputBillsDueRows_`, `lookupRowByName_`, `getDebtsHeaderMap_`, `normalizeDebts_`, `getDebtBillsDueRows_`, planner readers, Cash Flow lookups), so shifting row positions has no row-number-keyed callers to update. Populated workbooks are unchanged unless the user adds a new row, and even then the only difference is *where* the new row lands in the sheet. Activity logs (`bill_add` / `debt_add`), Cash Flow auto-seed for debts, Acct PCT Avail recompute, Active cell stamping, snapshot refresh, and the silent background planner run all continue unchanged on the new row.

Help updated: `Dashboard_Help.html` → Cash Flow → Add bill (notes the sorted-insert rule), Activity log → `bill_add` and `debt_add` (mention Due-Day order), Planning → Debts → Add new (explains active-region insert + legacy end-of-region placement when Due Day exceeds existing).

### Delivered — Quick Add: optimistic Activity row prepend (V1.2)

**Quick Add payments now appear in the Activity table instantly via an optimistic client-side prepend, with a quiet background reconcile.** Shipped in `f66bed4` alongside the planner-email debounce.

User-visible problem: saving an income via Quick Add appeared to take "forever" to show in the Activity ledger — visibly only after the full planner run finished. Root cause was UI, not server. The success handler in `Dashboard_Script_Payments.html::savePayment()` kicks off five concurrent `google.script.run` RPCs (`loadActivitySection`, `refreshSnapshot`, `loadUpcomingSection`, `loadDashboardActionSections`, `runPlannerAndRefreshDashboardFromSave`) and meanwhile blanked the activity table with a `Loading activity…` placeholder. Whenever the planner queued ahead of the activity reload — or just dominated the shared client/network budget — the table sat on `Loading…` for the full duration of the planner run.

Fix has two parts:

1. **Optimistic prepend.** New helper `prependOptimisticQuickPayActivityRow_(snapshot)` in `Dashboard_Script_Activity.html` constructs an Activity row from `res.activitySnapshot` (which `quickAddPayment` already returns with every field we need: `entryType`, `payee`, `entryDate`, `amount`, `cashFlowSheet`, `cashFlowMonth`) and prepends it to `window.__activityRows`, then re-renders the current page. The user sees the new row at the top before the next animation frame — even on slow connections. The optimistic row carries `optimistic: true` and `sheetRow: 0` (Remove button stays disabled, which matches `quick_pay` policy anyway).

2. **Quiet reconcile mode.** `loadActivitySection(opts)` now accepts `opts.quiet`; when `true`, skips the `Loading activity…` placeholder write, status reset, summary clear, page reset, and pager hide. The optimistic row stays visible while the server reload is in flight. When the server returns, `window.__activityRows` is replaced with the authoritative list (which contains the same event at the top from `appendActivityLog_` written synchronously inside `quickAddPayment()`), so the user perceives no flicker — same row, slightly different timestamp granularity (sub-second).

Other callers of `loadActivitySection()` keep the original placeholder behavior because `opts.quiet` defaults to false:

- `Dashboard_Script_Render.html` tab navigation handler (`name === 'activity'`)
- `Dashboard_Body.html` Apply filter button
- `Dashboard_Script_Activity.html` post-delete reload

Behavior preservation: same server-side logic for `getActivityDashboardData`, same audit row written by `appendActivityLog_`, same kindLabel / actionLabel / non-monetary classification. The optimistic kindLabel for `quick_pay` mirrors `classifyActivityKind_`'s common-case mapping (`income` → `Income`, `expense` → `Bill`); edge cases (HOA / Tuition / debt-typed payees) get reclassified by the reload — for the typical row there is no observable diff. If `activitySnapshot` is missing or the activity wrap isn't yet rendered, the helper is a no-op and the user falls through to the existing reload path (defensive — no save flow can break because of a missing optimistic update).

Help updated: `Dashboard_Help.html` → Cash Flow → Quick Add → Activity tab refresh paragraph rewritten to note "instantly via the server's save response" and "quiet background reconcile".

### Delivered — Planner email debounce + multi-recipient (V1.2)

**Planner email — debounce per-save runs + send to spouse too.** Shipped in `82c52f7` alongside the asset-save sync fix. Two long-running pain points addressed in one pass.

**Problem 1: 50 saves at month-start = 50 emails.** The user reported that during heavy update sessions (typical month-start reconciliation: bank balances, investment values, debts, quick-add payments) every save fired a fresh planner email, blasting their inbox with near-duplicate updates. The planner email itself was already gated by a meaningfulness check, but per-save background runs always sent immediately.

**Problem 2: spouse never got the email.** Profile has long had a `Spouse Email` field, but only `Email` (primary) was wired into the planner email path. The legacy `readPlannerEmailFromSettingsStrict_()` only looked up the `Email` key.

**Fix — Multi-recipient resolution.** New `readPlannerEmailRecipientsStrict_()` in `planner_output.js`:

- Reads both `PROFILE_KEYS_.EMAIL` and `PROFILE_KEYS_.SPOUSE_EMAIL` from `INPUT - Settings` in a single sheet read.
- Validates each value against `PROFILE_EMAIL_REGEX_` (the same regex Profile uses on save).
- Deduplicates on case-insensitive match (so a user with the same address in both fields doesn't double-email themselves).
- Returns `{ valid: string[], fields: string[], invalidFields: string[] }`. `valid` is what we send to; `fields` records which Profile keys contributed (for audit JSON); `invalidFields` records keys whose stored value failed regex (these get a `planner_email_invalid_recipient` activity row naming the field — never the bad value).

`sendPlannerEmailIfConfigured_(summary, options)` was reworked to accept `options.emailMode` and dispatch on it:

- `'send'` (default) — gates on meaningfulness, resolves recipients, joins them on the `To:` line in a single `MailApp.sendEmail` call so spouse always gets the same copy as primary, then logs `planner_email_sent` (with `recipientCount` + `recipientFields` in details JSON) and marks the debounce queue settled.
- `'defer'` — bumps `LAST_SAVE_AT` and logs `planner_email_deferred`. Returns without sending.

**Fix — Debounce.** New file `debounce_planner.js` owns the queue mechanics. Constants: `DEBOUNCE_QUIET_WINDOW_MS_ = 10 * 60 * 1000` (10 min), `DEBOUNCE_TRIGGER_INTERVAL_MIN_ = 5`. State is stored in `DocumentProperties` (per-spreadsheet, not script-global — keeps the design correct under future Central App / multi-tenant deployment).

Time-driven trigger `debouncePlannerEmailRun` is registered idempotently from `getDashboardSnapshot()` via `ensureDebouncePlannerTrigger_()` so first dashboard load wires it up; if a user manually deletes the trigger from the Apps Script Triggers UI, the next dashboard load re-installs it. The handler reads `LAST_SAVE_AT`, returns immediately if no work is pending or if the quiet window hasn't elapsed, and otherwise runs `runDebtPlanner({ emailMode: 'send' })` once. `markDebouncePlannerEmailSettled_()` is called from inside `sendPlannerEmailIfConfigured_` whenever a `'send'` run completes — even when the meaningfulness gate or no-recipients gate skipped actual mail — so the trigger doesn't keep polling forever in those cases.

`runDebtPlanner(options)` in `code.js` was extended to accept and forward `options` to `sendPlannerEmailIfConfigured_(summary, options)`. Default behavior is `emailMode === 'send'`, preserving byte-for-byte compatibility with legacy callers (menu's "Run Planner" item, the legacy sidebar HTML callers).

**Routing — manual vs background.** Two separate RPCs in `dashboard_data.js`:

- `runPlannerAndRefreshDashboard()` — manual button (`Run Planner + Refresh Snapshot`). Calls `runDebtPlanner()` with no args → emails immediately. **Unchanged.**
- `runPlannerAndRefreshDashboardFromSave()` — new save-flow RPC. Calls `runDebtPlanner({ emailMode: 'defer' })` → defers email through the queue.

Five client save sites were switched from `.runPlannerAndRefreshDashboard()` to `.runPlannerAndRefreshDashboardFromSave()`:

- `Dashboard_Script_AssetsBankInvestments.html` — bank balance update + investment update
- `Dashboard_Script_AssetsHouseValues.html` — house value update
- `Dashboard_Script_PlanningDebts.html` — debt field update
- `Dashboard_Script_Payments.html` — quick-add payment

The server-side direct caller in `house_expenses.js` (after a house expense add) was switched from `runDebtPlanner()` to `runDebtPlanner({ emailMode: 'defer' })`.

**Activity log.** Three new event types in `activity_log.js`, all classified as **Planner** kind, all in `activityLogIsNonMonetaryEvent_` (Amount = "—"), all ineligible for the dashboard Remove button:

- `planner_email_deferred` — per-save background run skipped immediate send. Sub-label: *Email deferred*.
- `planner_email_sent` — actual email went out. Sub-label includes recipient count: *Email sent to 2 recipients*. Details JSON has `recipientCount` and `recipientFields` (field names like `['Email', 'Spouse Email']`); the addresses themselves are deliberately never logged so a typo can't leak into Activity.
- `planner_email_invalid_recipient` — Profile had a value in `Email` or `Spouse Email` that failed regex validation, so that recipient was dropped. Sub-label names the field: *Invalid Spouse Email — skipped*. Details JSON has only `field` (no value).

**Worst-case latency.** Email arrives ~10–15 minutes after the user's final save (10 min quiet window + up to 5 min until the next trigger fire). Acceptable for a daily summary; users who want it now click the manual button.

**Failure modes.**

- Trigger creation failure → swallowed in `ensureDebouncePlannerTrigger_`, logged via `console.error`. Dashboard still loads; emails fall back to legacy "send on every run" behavior (less efficient but no missed emails).
- Activity log failure during defer/send → swallowed by the `appendPlannerEmail*Activity_` wrappers. Email itself still sends; only the audit row is missed.
- `DocumentProperties` failure during defer → bump silently swallowed. The deferred email never gets debounced; next manual click or next save with working DocumentProperties resets the queue. Conservative failure mode (no missed emails, just less consolidation).

Help updated: `Dashboard_Help.html` → Debt Planner email section gained "Who gets the email" and "When the email is sent (debounce)" subsections; Activity log gained the three new event descriptions; Remove-button greyed list extended.

### Delivered — Bank Import Step 1 scaffold (V1.2 prep)

**Bank Import — Step 1 Complete.** Scaffold shipped in commit `8ced838`. New file `bank_import.js` with three inert ensure helpers:

- `ensureImportStagingBankAccountsSheet_()` creates `SYS - Import Staging — Bank Accounts` with the 13-column staging header (bold, frozen), no data rows.
- `ensureImportIgnoredBankAccountsSheet_()` creates `SYS - Import Ignored — Bank Accounts` with the 7-column ignore registry (bold, frozen), no data rows.
- `ensureAccountsExternalIdColumn_(accountsSheet)` appends the `External Account Id` column to `SYS - Accounts` flush to the last non-empty header cell. Never reorders existing columns. Never writes to data rows.

What Step 1 explicitly **did not** ship: no ingestion logic, no UI, no planner impact. Existing modules do not call any of these helpers, so planner, overview, retirement, cash flow, and the manual bank account UI are unaffected on both populated and blank workbooks. Full scope, Step 2a plan, resume rules, and manual test checklist (A–E) live in `TODO.md → Bank Import — status & resume plan`.

### Delivered — Debts fast save + activity log + background planner (V1.2)

**Debts — Update field editing feels instant again.** Shipped in commit `c26c11c`. Planning → Debts → Update now shows a proper `Saving… → Saved.` status row, optimistically repaints the right-hand info panel with the saved value so users see the change without a server round-trip, refreshes the Overview snapshot (`refreshSnapshot()`), and fires `runPlannerAndRefreshDashboard()` as a **silent background RPC** so Rolling Debt Payoff and other planner-dependent cards catch up shortly after without blocking the save itself.

The previous behavior ran the debt planner inline inside `updateDebtField`, which held the UI on `Saving…` for several seconds on large workbooks. That inline call is gone; the planner now runs only after the save completes, off the critical path.

Every field edit is also written to `LOG - Activity` as a new **`debt_update`** event:

- Classified as **Debt** kind (`activity_log.js::classifyActivityKind_`).
- Dynamic action label from `debtUpdateActionLabel_()` — e.g. *Updated Account Balance to $54,000.00*, *Updated Int Rate to 7.50%*, *Updated Due Day to 15*, *Updated Credit Limit to $25,000.00*.
- **Amount** renders `—` instead of `$0.00` (added to `activityLogIsNonMonetaryEvent_`) so field edits don’t double-count against Activity totals.
- Previous + new raw + display values and the `fieldKind` (currency / percent / integer / text) are preserved in the event’s `details` JSON (`detailsVersion: 1`) for future undo tooling — no second lookup needed when a revert action is built later.

User-facing Help was also updated: `Dashboard_Help.html` → *Planning → Debts → Update* (new flow description), Activity log (`debt_update` event), Amount column description (non-monetary list), and Remove button greyed-out list.

### Delivered — Quick Add robust Saving… indicator + $0 amount allowed (V1.2)

**Quick Add — reliable click→Saving…→Saved feedback, and $0 is now a legitimate amount.** Shipped in commits `098fef0` → `29f29a2`.

Client-side (`Dashboard_Script_Payments.html::savePayment()`): the status row below **Add to Cash Flow** now layers plain-text `setStatus('pay_status', 'Saving…', false)` under `setStatusLoading(…)`. This mirrors the proven pattern from the legacy sidebar `PlannerDashboard.html::savePayment()` and ensures the label appears between click and `Saved to Cash Flow.` regardless of deploy timing or CSS state drift. On success, the status flips to the backend-supplied *Saved to Cash Flow.* message.

Server-side (`quick_add_payment.js::quickAddPayment`): amount validator relaxed from `amount <= 0` to `isNaN(amount) || amount < 0`, with new error message *Amount must be a valid number.* `Math.abs()` already coerces the stored value, so the negative branch is defensive only. Users can now save $0 on Quick add to:

- Zero out a month cell (e.g. reset a budget line).
- Correct a prior bad entry down to 0.
- Seed a placeholder payee row so it shows up in Bills Due / Upcoming selectors before the first real payment lands.

Scope discipline: Upcoming Expenses (`upcoming_expenses.js:193`), Income Sources (`income_sources.js:382`), and the Purchase Simulator (`purchase_simulator.js:29`) still require `amount > 0`. Those are different forms with different semantics and were intentionally left alone.

Help updated: `Dashboard_Help.html` → Cash Flow → Quick add now documents `$0` is a valid amount and describes the Saving… → Saved status feedback.

### Delivered — Asset save sync: stop hanging on every save (V1.2)

**Investment / Bank Account / House Value saves no longer hold the UI on `Saving…` for tens of seconds.** Shipped in `fe02299`; sibling commits `f13d928` (asset activity logs + fast save) and `6c0953d` (collapse repeat reads + Saving label) shipped earlier in the session and removed the inline planner run from these saves, but a deeper bottleneck remained.

Root cause: after a value write, the save still called `syncAllAssetsFromLatestCurrentYear_()` (and the matching `syncAllAccountsFromLatestCurrentYear_()` / `syncAllHouseAssetsFromLatestCurrentYear_()`) to mirror the latest current-year value into SYS. That sync was doing two slow things on every save:

1. **`getLatest*ValuesForYear_` made ~4 Sheets API round-trips per row** in the year block (per-row display lookup + `getLatestNonEmptyMonthColumnForRow_`'s header read + value-row read + matched-cell read). On a workbook with ~15–20 investments that's 60–80 round-trips at 200–800 ms each.
2. **The SYS write loops re-wrote every row** through the format-preserving `setCurrencyCellPreserveRowFormat_`, even when the value hadn't changed. Two to three more round-trips per row.

Fix in `investments.js`, `bank_accounts.js`, `house_values.js`:

- **Batched read.** Each `getLatest*ValuesForYear_` now does **2 round-trips total** — one full-sheet `getDisplayValues()` (also reused for `getXxxYearBlock_` via the existing optional `display` parameter) and one batched `getRange(dataStartRow, 1, numRows, lastCol).getValues()`. The "find latest non-empty month for this row" loop is now pure in-memory work using `parseMonthHeader_` against the already-loaded header row.
- **Skip-if-unchanged.** The `syncAll*FromLatestCurrentYear_` write loops now compare the new value against the existing `targetRaw[r][balanceColZero]` (rounded to 2dp on both sides to avoid floating-point noise) and **skip the format-preserving write when unchanged**. In the common case where the user only changed one account, this collapses N writes to 1.
- **Header-map reuse.** The sync functions now pass the already-loaded display to `getAccountsHeaderMap_` / `getAssetsHeaderMap_` / `getHouseAssetsHeaderMap_` instead of letting them re-read the header row.

Behavior preservation: same latest-value math, same writes when something actually changed, same activity logging (`bank_account_update` / `investment_update` / `house_value_update`), planner still runs in the background as a silent RPC. The only observable difference is that `Saved.` arrives in a second or two on populated workbooks where it used to take tens of seconds. Bank Account and House Value saves benefit from the same fix as defense-in-depth even though only Investments was reported.

### Delivered — Asset updates: activity log + fast save without waiting on planner (V1.2)

**Bank Account, House Value, and Investment balance updates now feel instant and produce an audit row.** Shipped in commit `f13d928`.

Two issues fixed in one pass:

1. **No activity log entry.** Manual balance updates on Assets → Bank Accounts / House Values / Investments wrote to the canonical sheet (`INPUT - Bank Accounts` / `INPUT - House Values` / `INPUT - Investments`) and mirrored into SYS, but produced no `LOG - Activity` row. New events: `bank_account_update` / `house_value_update` / `investment_update`. Classified as **Bank** / **House Expenses** / **Investment** kind respectively. Action label includes the month and new balance (e.g. *Updated May-26 balance to $1,234.56*). **Amount** renders `—` (added to `activityLogIsNonMonetaryEvent_`) so balance updates don't double-count against Activity totals; previous + new raw values are preserved in the event's `details` JSON for future undo tooling.

2. **UI hung waiting for the planner.** `updateBankAccountValueByDate` / `updateHouseValueByDate` / `updateInvestmentValueByDate` previously ran `runDebtPlanner()` inline before returning, holding the UI on `Saving…` for several seconds on populated workbooks. The inline call is gone. Client-side save handlers in `Dashboard_Script_AssetsBankInvestments.html` and `Dashboard_Script_AssetsHouseValues.html` now call `runPlannerAndRefreshDashboard()` as a **silent background RPC** after the save returns, so Rolling Debt Payoff and Overview snapshot still catch up shortly after — just without blocking the save.

Help updated: `Dashboard_Help.html` → Bank Accounts, House Values, Investments (status feedback paragraph + activity log entries) and the Activity log Bank / House / Investment list (`bank_account_update`, `house_value_update`, `investment_update` event descriptions, Remove-button greyed-out list).

### Delivered — Asset pages: collapse repeat sheet reads + show "Saving…" instead of "Loading…" (V1.2)

**Page loads, dropdown selection RPCs, and the post-save status flip on Bank Accounts / Investments / House Values / Debts are noticeably snappier and the `Saved.` message no longer gets clobbered.** Shipped in commit `6c0953d`.

Two related fixes in one pass:

1. **Performance — collapse repeat sheet reads.** The page-load RPCs (`getBankAccountUiData` / `getInvestmentUiData` / `getHouseUiData` / `getDebtsUiData`) and the per-selection field RPCs each made 2–4 full-sheet `getDataRange().getValues()` / `getDisplayValues()` calls — one for Type options, one for the inactive set, one for the header map, etc. Each read is a 300–800 ms round-trip on populated workbooks. Consolidated to a single `getDisplayValues()` per RPC and threaded into helpers via new **optional `display` / `headers` parameters** so older callers stay byte-for-byte compatible. The block helpers (`getBankAccountsYearBlock_` / `getHouseValuesYearBlock_` / `getInvestmentsYearBlock_`) and header-map helpers (`getAccountsHeaderMap_` / `getHouseAssetsHeaderMap_` / `getAssetsHeaderMap_` / `getDebtsHeaderMap_`) all gained the optional pre-loaded array parameter. The row-finder helpers (`findBankAccountRowInBlock_` / `findHouseRowInBlock_` / `findInvestmentRowInBlock_`) replaced their per-row `getRange(row, col).getDisplayValue()` loops with single batched range reads of column A across the block.

2. **UX — "Saving…" stays "Saving…".** After the asset fast-save fix landed, the post-save quiet refresh would re-trigger `setStatusLoading()` inside the load helpers and overwrite the `Saved.` message with the default `Loading…` label. Two-part fix: save handlers (`saveBank`, `saveInvestment`, `saveHouse`) now pass an explicit `'Saving…'` label to `setStatusLoading()`, and `loadBankData / loadHouseData / loadInvestmentData` accept a new `quiet` parameter (default `false`) that skips both the leading `setStatusLoading()` and the trailing `setStatus('', false)` so the `Saved.` message survives the post-save refresh.

### Delivered — Quick Add: instant Activity ledger refresh + background planner (V1.2)

**Quick Add payments now show up on the Activity tab immediately instead of after the full planner run.** Shipped in commit `d743458`.

`Dashboard_Script_Payments.html::savePayment()` success handler now calls `loadActivitySection()` immediately so the new `quick_pay` row appears on the Activity tab without waiting for the planner, and the planner is fired as a silent background RPC (`runPlannerAndRefreshDashboard()`) — same pattern as the Debts save from `c26c11c`. The previous flow held the UI on the success state for several seconds while the planner ran inline before the Activity tab reflected the new row.

### Delivered — Quick Add: Bill Pay prefill race + explicit Other payee option (V1.2)

**Two related Quick Add fixes.** Shipped in commit `1305c40`.

1. **Bill Pay prefill race.** Launching Quick Add from a bill on a cold tab (Bills → Pay) failed to populate the **Existing Payee** dropdown because `prefillQuickPayment` ran synchronously before `paymentPayees` finished loading. The typed payee input had the right value, but the dropdown was blank. Fix stashes the wanted payee in `window.__pendingQuickAddPayee` and applies it via a new `consumePendingQuickAddPayeePrefill_()` helper called from `loadPaymentSection`'s success handler — *after* the dropdown is populated. A guard checks the typed input first, so a user edit is never overwritten.

2. **Explicit "Other (type new payee)" option.** Previously the only way to add a payee that wasn't in the dropdown was to ignore the dropdown and type into the free-text input below it — which felt invisible to new users. Added a sentinel option (`QUICK_ADD_PAYEE_OTHER_SENTINEL_ = '__OTHER__'`) at the bottom of the Existing Payee dropdown labeled **Other (type new payee)**. `syncPaymentPayeeInput()` clears + focuses the typed input when the sentinel is selected; `currentPaymentPayee()` treats the sentinel as no-selection so the typed value wins.

Help updated: `Dashboard_Help.html` → Cash Flow → Quick add documents the Other payee option and the bill-pay prefill behavior.

### Delivered — Bank Import: Step 2a ingestion pipeline (V1.2)

**First server-side ingestion built on the Step 1 scaffold.** Shipped in commit `03d2c4a`. Continues the multi-step Bank Import plan documented in `TODO.md → Bank Import — status & resume plan`.

`processBankImportBatch_(payload)` handles, in order:

- **Ignored check (permanent only).** If the incoming row matches a row in `SYS - Import Ignored — Bank Accounts` by exact non-blank `External Account Id` (or by composite `institution + displayName + last4` when external id is blank), the row is dropped and a `bank_import_ignored_hit` event is logged. Blank or unknown `Scope` is treated as `permanent` — `until_changed` logic is intentionally **not** implemented yet even though the column exists for future compatibility.
- **Exact-id auto-match.** Auto-match only when **all** of: incoming `externalAccountId` is non-empty; exactly one active `SYS - Accounts` row has matching `External Account Id`; currency is exactly `USD`; incoming type does not conflict with a non-blank existing type. On match: write the balance through the existing proven bank-account history/update path, sync current balances through the existing sync path, log `bank_import_auto_matched` with the balance fingerprint as `dedupeKey`, leave **Available Now / Min Buffer / Use Policy / Priority / Active** untouched. Per-row `runDebtPlanner` is intentionally **not** called from auto-match — left to the user's manual Run Planner trigger.
- **Pending staging.** Everything not ignored or auto-matched lands in `SYS - Import Staging — Bank Accounts` with `Status = pending` and a Pending Reason from the fixed enum (`no_exact_id_match`, `currency_mismatch`, `type_conflict`, `inactive_match`, `ambiguous_external_id`, `stale_balance`). Stable `Staging Id` keyed from `externalAccountId` + `YYYY-MM(balanceAsOf)` allows upserts (insert if new, update `Last Seen` + latest payload fields if pending row already exists — no duplicate pending rows).
- **Balance fingerprint dedupe.** Fingerprint is `externalAccountId + YYYY-MM(balanceAsOf) + balance + balanceAsOf`. If the same fingerprint already exists in recent `LOG - Activity` for `bank_import_auto_matched`, do nothing — no extra log row, no extra writes.

Strict deviations from the approved Step 2a checklist, recorded for the resume plan:

1. **Currency must be exactly `USD` for auto-match.** A blank `currency` is treated as `currency_mismatch` and routed to pending, per the literal interpretation of the requirement.
2. **Stale-balance threshold defined as 90 days (or any future date).** New constant `BANK_IMPORT_STALE_BALANCE_DAYS = 90`. Future-dated `balanceAsOf` is always stale.
3. **Per-row `runDebtPlanner` is deliberately not called from auto-match.** The underlying helper functions are called directly to keep batch runs fast; the planner run is left to the user's manual trigger.

Dev/test harness only — no UI, no external sync, no menu, no dashboard button. `_devRunBankImportSample()` runs a representative payload; `_devRunBankImportCustom_(payload)` accepts arbitrary input. Pending rows live only in the staging sheet, which no existing module reads, so planner / overview / cash flow / retirement / debts are all unaffected on both populated and blank workbooks.

### Delivered — Planner email: handled-this-month check now uses each debt's next-due month (V1.2)

**Loan payments due in the next calendar month no longer drop out of the Debt Planner email's *Pay now* / *Pay soon* sections.** Shipped in commit `bae82c9`.

Symptom (reproduced on a workbook with mortgage payments due May 1 while the email ran on April 24): generic recurring bills appeared in *Pay now* / *Pay soon* but loan payments did not — every loan payment was silently filtered out.

Root cause in `runDebtPlanner.js::buildUpcomingPayments_`: the function checked whether each debt was "handled this month" against the current calendar month's Cash Flow cell, even when the payment's `nextDueDate` fell in a different month. If the user had already paid April for a debt whose May payment was now in the upcoming window, the May payment was incorrectly filtered out as "handled".

Fix:

- `buildDebtMinimumHandledMap_` rewritten to return a **month-keyed nested map** (`{ monthHeader → { debtKey → handledFlag } }`) so the planner can check handled status per month, not just for the current month.
- `isDebtMinimumHandledThisMonth_` signature widened to accept a `monthHeader` parameter that selects which month's handled map to consult.
- `buildUpcomingPayments_` now computes `dueDate` and resolves the correct `dueMonthHeader` (via `getMonthHeaderForDate_`, with a new `getNextMonthHeader_` helper) for each upcoming payment before checking handled status.
- `runDebtPlanner` passes `[currentMonthHeader, nextMonthHeader]` to `buildDebtMinimumHandledMap_` so both months are pre-built; the bills (non-debt) path was already correct and is unchanged.

Edge cases verified: same-month payments still filter the same way; debts whose `nextDueDate` is more than 1 month out still resolve to the right month header (the helper map lookups gracefully return "not handled" for months that weren't pre-built, which is the correct conservative answer for the email).

### Delivered — Bills Due inactive filter fix (V1.2)

**Bills Due — inactive debts and inactive Cash Flow rows no longer leak into the recurring fallback.** Shipped in commit `9bf3234`.

Symptom: the **Recurring Bills (No Due Date)** section on the Bills Due page was surfacing debts that had been marked `Active = No` in `INPUT - Debts` (reproduced with *Laith VCS Account*). The Cash Flow row for the same payee also had `Active = NO` but was still being promoted into the fallback list.

Root cause in `dashboard_data.js::getRecurringBillsWithoutDueDateForDashboard()`:

- The function excluded payees only via `getInputBillsPayeeMap_` (INPUT - Bills, active-only) and `getDebtPayeeMap_` (INPUT - Debts, active-only).
- It never read the Cash Flow row's own `Active` column.
- Deactivating a debt therefore *removed* it from `debtBills`, and the still-present Cash Flow row fell through the guards and got pushed into the fallback list as if it were an unmapped recurring expense.

Fix — two bounded guards inside the existing loop plus one new sibling helper:

1. **Cash Flow `Active = No` guard.** Explicit `no / n / false / inactive` (case-insensitive) on the Cash Flow row short-circuits the iteration. Blank is still treated as active — that matches the documented convention on `getCashFlowHeaderMap_` and every other consumer of this column.
2. **Debt name-reservation across all statuses.** New helper `getDebtPayeeMapAllStatuses_(ss)` returns all payee names in `INPUT - Debts` regardless of Active. Used only as a fallback exclusion set — it does *not* affect planner math, totals, or the Debts list's own active/inactive filtering (those still use `isDebtSheetRowInactive_`).

Scope discipline: `dashboard_data.js` only. `getRecurringBillsWithoutDueDateForDashboard` has a single caller in the entire codebase — `Dashboard_Script_BillsDue.html:324` — so blast radius is strictly the "Recurring Bills (No Due Date)" section on Bills Due. Planner, Overview snapshot, Retirement, credit-card totals, Debts list, Bills Due (Next 7 / Overdue), Upcoming Expenses, and the email path are untouched.

Edge cases verified:

- **Legacy workbook without `Active` on Cash Flow** — `activeColZero === -1`, active-check block is skipped entirely, behavior matches pre-fix.
- **Blank `Active` cell** — still treated as active. No regressions for the common case.
- **Reactivated debt** — as soon as `INPUT - Debts` flips back to `Active = Yes`, the payee moves from the all-statuses name-reservation set into the normal active `debtBills` set. Either way it stays out of the fallback, and a valid Due Day resurfaces it in the proper Debts Due area.
- **Blank workbook** — `getDebtPayeeMapAllStatuses_` returns `{}` when the sheet is missing or empty, same pattern as the active-only sibling.

No Help or documentation changes required for this fix — the "Recurring Bills (No Due Date)" section is not separately called out in Help; the user-visible behavior now simply matches Help's existing Bills Due description (active items only).

---

## Central App — DELIVERED (architecture history)

> **Status: live.** This section is retained as the design rationale; the architecture it describes is now implemented and runtime-validated. The current, authoritative description is `PROJECT_CONTEXT.md → Current architecture — Central App (live)`. Remaining hardening is scheduled as Phase 2 (Family Beta Hardening) / Phase 6 (External Beta Readiness) in the `Launch Readiness Roadmap` (`TODO.md` / `PROJECT_CONTEXT.md`). The migration discipline in `WORKING_RULES.md → Central App Transition Rules` is now the **active** governing policy. Full per-slice history: `SESSION_NOTES.md → Current State — Post V1.2 Prep`.

### Central App Model

- Move from a per-copy distribution to **one centralized Apps Script web app** that all users share.
- Users access the app via a single deployment URL — no code copying, no script editor, no manual updates.
- Each user gets their **own spreadsheet**, automatically created and bound to their identity on first run.
- A single deployed script version drives every user's experience, so a fix shipped once reaches everyone immediately.

### Core change

- Replace direct `SpreadsheetApp.getActiveSpreadsheet()` usage across all backend modules with a single resolver: **`getUserSpreadsheet_()`**.
- `getUserSpreadsheet_()` resolves the caller's identity (typically `Session.getEffectiveUser().getEmail()`), looks up their workbook, and returns the bound `Spreadsheet` object.
- **Bootstrap on first run** — when a new user has no mapping, create a fresh workbook from a known-good template (or seed structure), record the mapping, and continue normally.
- **User → sheet mapping** — stored in `PropertiesService.getUserProperties()` (per-user, lightweight) or a central registry sheet (e.g. `SYS - User Workbooks` in an admin spreadsheet); the choice is part of the migration design pass.

### Benefits

- **Instant updates for all users** — script version is the source of truth; no version drift across copies.
- **No version drift / no copy-paste deploys** — every user is on the same code at the same time.
- **Easier support and debugging** — a single canonical code path; user-specific issues isolate to data, not code.
- **Foundation for monetization** — the user mapping registry is the natural anchor for plan / entitlement records (see *Future direction — Monetization* below).

### How it was staged (delivered)

- The migration was staged module by module behind the single resolver (not done in one pass), exactly as the discipline required: manifest/deployment prep → resolver + provisioning slice → standalone central project → Tier 1 startup/onboarding migration → runtime validation (Phase A/B). Tier 2 full-dashboard `getActiveSpreadsheet()` migration is the remaining tail (Phase 2 / Phase 6).

---

## Future direction — Monetization (future — Phase 7)

Captured so the long-term plan is durable and aligned with the (now-delivered) Central App migration. Scheduled as **Phase 7 — Paid Product Readiness** (`Launch Readiness Roadmap` in `TODO.md` / `PROJECT_CONTEXT.md`). Mirror lives in `TODO.md → Monetization (future)`.

### Monetization model

- **Free + paid tiers.** Core financial planning functionality stays free; paid tiers unlock advanced / higher-cost features.
- **Feature gating inside code** — gating decisions live next to the feature implementation, not in a separate authorization layer.
- Per `WORKING_RULES.md → Monetization Rules`, gating must never block core functionality and must always fail gracefully (no crashes if plan lookup fails or the user record is missing).

### Minimal implementation

- **New sheet: `SYS - Users`** with columns: `Email | Plan | CreatedAt`.
  - `Email` — canonical user identifier (matches the same identity resolver used by `getUserSpreadsheet_()`).
  - `Plan` — short string (e.g. `free`, `paid`, `trial`); free is default and assumed when missing.
  - `CreatedAt` — first-seen timestamp; useful for trial-window calculations later.
- This sheet pairs naturally with the Central App user mapping; it can live alongside `SYS - User Workbooks` in the same admin spreadsheet, or in a per-user sheet when bound mode is still in use.

### Code helpers

- **`getUserPlan_(email)`** — returns the plan string for the given email; returns `'free'` when no record exists.
- **`isPaidUser_()`** — convenience boolean built on top of `getUserPlan_()`. Wraps the plan check so call sites stay short and readable.
- Both helpers must be defensive: any error reading `SYS - Users` returns the free / unblocked default, never an exception that would break a feature for an existing free-tier user.

### Initial gated features (candidates only)

These are **candidates**, not commitments. Final gating decisions happen when the work is pulled in.

- **Bank import / sync** (the in-flight Bank Import work) — natural first paid feature; advanced data ingestion fits the paid tier shape.
- **Advanced planner features** — e.g. multi-scenario retirement, advanced rolling debt payoff strategies, premium reports.
- **Usage limits** — per-day / per-month caps on heavy operations (planner runs, sync refreshes) for the free tier.

### Why this is documented now and not started

- Monetization is meaningful only **after** the Central App migration — which has now landed. Gating per-copy installs was never enforceable; with central provisioning live, the mapping store is the natural anchor for plan/entitlement records.
- Remaining sequencing: **minimal `SYS - Users` schema → first gated feature** (Phase 7). Follow `WORKING_RULES.md → Monetization Rules` when the work is pulled in.

---

## Future Enhancements (Post-Core)

Forward-looking product ideas captured in prioritized tiers so the long-term direction is durable. **Not on the V1.2 roadmap** and **lower priority** than the in-flight Bank Import completion and the ongoing Bills / planner / Cash Flow accuracy work. Mirror lives in `TODO.md → Future Enhancements (Post-Core)`. Pulling any item in requires an explicit product decision under `WORKING_RULES.md → Current phase`.

### Tier 1 — High Impact (do after Bank Import + Bills)

Highest-value next moves once the current priorities are stable. All items are read-only and additive — no new sheets unless explicitly noted.

1. **Auto-reconciliation view.** Side-by-side imported bank balance vs current planned balance per active account, with a clear per-account delta. Reuses the Step 2d staged + Apply state.
2. **Cash safety alerts.** Proactive warnings for low buffer, upcoming bill pressure exceeding available cash, and a single safe / at-risk indicator on Overview. Derived from existing planner + Cash Flow data.
3. **Bulk "Apply all" flow.** Apply multiple already-linked staged balances for the same month in one click. Still respects Step 2d strict approval — never auto-applies unlinked or blocked rows.
4. **"What changed?" insights.** Explain the difference between the latest import and the prior import per account; highlight the biggest drivers (bills paid, large transfers, large new charges).

### Tier 2 — UX / Insight Improvements

Bigger product-shape changes once Tier 1 is stable.

5. **Account grouping.** Group accounts on Bank Accounts / Overview by type (Checking / Savings / etc.) and optional user-defined groups. UI only; canonical sheets unchanged.
6. **Scenario / simulation mode.** Read-only "what if" overlay (extra debt payment, paused income, larger expense) running against a copy of the planner inputs without writing back.
7. **Historical trends (lightweight).** Per-account balance history line / sparkline derived from the year-block month columns already on `INPUT - Bank Accounts`. No new storage.

### Tier 3 — Advanced / AI / Future

Reserved for after Tier 1 + Tier 2 ship cleanly. All items here are strictly read-only and must respect the constraints in the **Chat-based Finance Assistant (detailed)** subsection below.

8. **Chat-based Finance Assistant.** Natural-language read-only assistant. Full constraints + phased rollout live in the detailed subsection below — not duplicated here.
9. **Explain my finances (narrative insights).** Plain-language summary of the current state (e.g. *"You're safe because cash covers bills through next month"*, *"Cash dropped because of the property-tax payment on May 1"*). Generated from existing planner outputs.
10. **Root-cause queries.** Targeted answers to questions like *"Why is my balance lower?"* by diffing recent Cash Flow + Activity rows against the prior reference point. Deterministic in v1.
11. **Guided suggestions.** Recommend next actions (e.g. *"Move $X from Savings to Checking"*) without auto-execution. Quick Add stays the only write path.

### Chat-based Finance Assistant (detailed)

A natural-language assistant inside the dashboard that answers questions about the user's own finances, e.g.:

- *"How much cash do I have available?"*
- *"What bills are due this month?"*
- *"What are my account balances?"*

The assistant reads from the existing canonical sheets through the existing dashboard read helpers. It is **never** a write surface.

#### Hard constraints (apply to every phase)

- **Strict read-only.** No mutations to `INPUT - *` / `SYS - *` / `LOG - *` sheets and no bypass of Quick Add / Setup / Review write paths.
- **Reuses existing data sources only.** `SYS - Accounts`, `INPUT - Bank Accounts`, Cash Flow / Bills, planner outputs. No new sheets, no shadow stores, no caching that can drift from the canonical workbook.
- **Tool-based access only.** When AI is involved (Phase 3), the model talks to a curated set of read helpers — the same ones the dashboard already calls — and never receives raw sheet content as context.
- **Privacy and cost discipline.** Any external API call is opt-in, scoped, and rate-limited; no PII / account numbers / balances may leave the workbook without an explicit design + privacy pass.

#### Phased approach

1. **Phase 1 — Deterministic queries (no AI).** Predefined / keyword-based questions wired to existing read helpers (`getCashToUse`, `getBillsDueFromCashFlowForDashboard`, `getNextActionsData`, `getRollingDebtPayoffPlan`, `getDashboardSnapshot`). Demonstrates the surface end-to-end with zero external dependencies and zero LLM cost.
2. **Phase 2 — Natural-language parser.** Map free-text input → the known queries from Phase 1. Parser may live entirely in Apps Script (regex / keyword extraction) or in a small bundled NLU module. Same read-only surface; still no external API.
3. **Phase 3 — AI-assisted chat (optional).** External LLM (e.g. OpenAI) called from a small backend / Apps Script proxy that holds the API key in `PropertiesService.getScriptProperties()` (never client-side). Strictly tool-based — the model issues calls to the curated read helpers; it does not see raw sheet content. Still strictly read-only.

#### Non-goals (across all phases)

- **No money-movement actions.** Even when a future write surface exists elsewhere, the assistant does not initiate payments, status changes, or planner mutations. Quick Add stays the only payment path.
- **No automatic posting** to Cash Flow / Activity / Bills / Upcoming.
- **No retirement / investment advice generation** (different scope; different review needs).
- **No raw sheet exposure to any external service.**

#### Why this is documented now and not started

- Active priority is Bank Import (CSV → future real connections) and Bills / planner / Cash Flow accuracy. Adding a chat surface while those are still settling would dilute focus and create a moving target for question semantics.
- Phase 3 in particular requires its own product + privacy review (a written allow-list of fields permitted to leave the workbook, a cost model, and a rate-limit / abuse design) that has not started.
- Phases 1 and 2 are small and could be pulled in earlier than Phase 3 once Bank Import and planner accuracy work stabilizes, but neither should start until that stabilization is explicit.

### Product Direction Ideas (optional)

Captured for future product conversations; not committed work and not slotted into a tier.

12. **Financial state indicator.** Single-glance label on Overview — *Stable / Tight / Risk* — backed by the same signals as the Tier 1 Cash safety alerts.
13. **Weekly snapshot email.** Opt-in weekly summary covering balances, bills due, and any active alerts. Reuses the planner-email multi-recipient + debounce pipeline.
14. **Account health score.** Per-account composite score from volatility, buffer usage, and trend direction. Visualized as a small badge on Bank Accounts.

---

## 1. Current product state

What is working well right now:

- **Rolling Debt Payoff is the main monthly decision tool.** It tells the user what to do *this month* with a single input (Cash to use now) and a single output (per-account payments + HELOC recommendation).
- **Standard vs Details split is intentional and holding.** Standard surface is four compact blocks (cash input, Decision card, HELOC card, Payment Result). Details is a power-user drawer behind one toggle.
- **HELOC section is simplified and decision-oriented.** `status` + `advised_draw` + the anchored **"What would change this?"** levers replace the previous wall of metrics. Advisor never mutates the waterfall.
- **"Why not more?" explains constraints and links to source data.** Near-term planned hold and unmapped card risk hold each have a `[View]` pill that routes to Cash Flow → Upcoming.
- **Payment Result supports execution via `[Add payment]` → Quick Add.** Per-row pill pre-fills Quick Add with the planner's `_paid` amount; save still goes through the normal `quickAddPayment` flow with its own audit entry.
- **Debt Overview is a reference layer, not a competing decision tool.** Structure/balances/minimums snapshot, no planner invocation — which removed the analysis-paralysis the old Payoff Path tab created.

---

## 2. Architectural strengths

- **Sheets as source of truth.** Every number is traceable to a user-owned cell. Auditable, editable, recoverable.
- **Apps Script as computation layer.** One public entry point per surface (`getRollingDebtPayoffPlan`, `quickAddPayment`, …). Heavy logic (waterfall, HELOC advisor, card-spend model) stays server-side where it belongs.
- **React bundle as decision UI.** Purely presentational. Fast to iterate on, strongly typed, and easy to reason about because it doesn't write data directly.
- **Mapping layer as contract.** `mapPlannerPayloadToRollingDebtPayoffDashboardData.ts` is the single seam between backend JSON and React types. Adding a field is a three-step ritual (emit → map → consume), but it's explicit and grep-able.
- **Host-global navigation/prefill pattern.** `window.prefillQuickPayment`, `window.showPage`, `window.showTab` give the React bundle a clean, testable bridge to host flows without tangling `google.script.run` into the component.
- **Standard / Details separation.** Protects the default surface from noise while still preserving full auditability for debugging and future power-user needs.

---

## 0. Locked product decisions

Decisions below are settled. Do not casually revisit them inside an enhancement — revisiting requires its own explicit product conversation.

- Rolling Debt Payoff is the primary monthly decision tool.
- Standard vs Details split is intentional and must be preserved.
- Debt Overview remains a reference layer, not a decision tool.
- Aggressive strategy remains hidden until fully product-defined.
- React bundle is presentation/navigation only (no direct writes).
- Navigation to source pages (`[View]` / `[Add payment]`) is preferred over duplicating detail inside the planner.

---

## 3. Key known gaps

### No automated regression harness
There is no integration or unit test suite; validation today is a manual checklist. Any waterfall or HELOC refactor has to be sanity-checked by eye, which slows down willingness to change the engine.

### Alias / payee mapping is hidden and hard to repair
The payee → debt map lives in code/config. When Upcoming Expenses or CF rows fail to map, the UI surfaces it as "unmapped card risk" but the user has no in-app way to fix the mapping. Fixes require a code edit.

### Client-side re-pour can drift slightly from backend truth
When the user types into "Cash to use now" below the Safe-to-use cap, the React layer re-pours allocations in-memory. For edge cases (small-balance payoffs, non-linear caps) the result can be off by a few dollars vs a fresh server run. Acceptable today; will hurt once we expose more strategies.

### Card spend model has approximation limits
Without a true statement-balance feed, CF card-expense rows are treated as *cash out* rather than *new spend*. The engine flags this (`credit_card_spend_confidence = LOW`) but the downstream HELOC realism check and unmapped-hold sizing carry that uncertainty silently.

### Aggressive strategy exists but is not product-defined or exposed
The allocator, validators, and Phase 2 audit are fully implemented. The toggle is hidden because the UX (Focus debt selection, confirmation, explanation) is not designed. Carrying dead UI paths is a tax on every engine change.

### Execution flow is improved but still distributed
`[Add payment]` is a big win, but execution still touches three surfaces (Rolling Debt Payoff → Cash Flow Quick add → LOG/Upcoming). There is no single "accept the plan" action, and no post-execution confirmation loop back into the planner. This is acceptable for now and aligns with the current separation of concerns (decision layer vs. write layer), but leaves room for future streamlining.

---

## 4. Prioritized enhancement opportunities

### Tier 1 — Highest-value next improvements

**Decision Layer — "Next Actions" entry point (Phase 1) — DELIVERED (v1)**
- Status: **Delivered.** Live as the featured Planning entry point. Backed by `getNextActionsData()` (backend aggregator) + `getCashToUse()` (conservative liquidity model). Help section `#help-next-actions` documents current behavior.
- Why it matters: Previously the input / execution layer (Bills, Upcoming, Debts, Bank Accounts, Cash Flow, LOG) was complete but users still had to open five tabs to decide *"what should I do next?"* Next Actions v1 closes that gap with a single, low-noise entry point on top of Planning.
- What v1 ships: compact summary row (Cash to use / Due soon / Available after urgent), Urgent / Recommended / Optimize buckets, grouped "Other bills due soon" tail row for urgent noise control, collapsed "Why this cash amount?" disclosure for liquidity auditability, and per-card "Open …" routing into the existing deep-dive tools via `showTab()`.
- Guardrails held: action-first, no editing, short lists; single payment path remains Cash Flow → Quick Add; no new sheets / columns; Planning's existing deep-dive tools are untouched and accessible via the secondary "Planning tools" row.
- Risk retained: **Low.** Still read-only aggregation over already-canonical sheets; no write path.

**Next Actions — v1 decision-logic design (delivered; reference)**

The full spec lives in `PROJECT_CONTEXT.md → Decision Layer → Next Actions v1 — design note`. Summarized here as the delivered implementation contract:

- **Action object shape** — `priorityBucket` (`urgent` | `recommended` | `optimize`), `actionType`, `title`, `reason`, `amount`, `dueDate`, `sourceEntity {type, name}`, `target {page, tab}`.
- **Priority buckets** —
  - `urgent` = overdue / due soon / unpaid minimums / near-term obligations / cash gap.
  - `recommended` = next best moves once urgent is covered.
  - `optimize` = optional improvements only after urgent is safe.
- **Action types (v1)** — `pay_bill`, `pay_debt_minimum`, `pay_upcoming`, `finish_upcoming`, `review_cash_gap`, `pay_extra_debt`. HELOC strategy is intentionally **not** a Next Actions action type; it lives on the Rolling Debt Payoff *HELOC strategy* card.
- **Data sources (no new ones)** — `INPUT - Bills` (active), `INPUT - Upcoming Expenses` (remaining balance only), `INPUT - Debts` (active), bank / usable cash via the existing liquidity model (`SYS - Accounts` → Safe-to-use / Available Now / Min Buffer), and the existing `getRollingDebtPayoffPlan` output. No engine re-run.
- **Deterministic rules** — build urgent obligations first; compare `sum(urgent)` vs cash-to-use; emit `review_cash_gap` at the top of `urgent` when obligations exceed cash and suppress `recommended` money-movement until resolved; the preferred extra-debt target is the Rolling Debt Payoff focus debt.
- **Explainability rule** — every emitted action must be describable in **one sentence** from the current snapshot (amount / due date / remaining balance / bucket rule / Rolling-Debt-Payoff reason code). If not, it's not emitted.
- **Non-goals (v1)** — retirement optimization, investment allocation advice, purchase simulation, scenario / what-if planning, automatic execution. Quick Add remains the single payment path; Next Actions only routes.

Implementation order, as shipped: backend aggregator (`next_actions.js::getNextActionsData`) + liquidity reader (`cash_to_use.js::getCashToUse`) landed first, followed by the Planning → Next Actions panel (`Dashboard_Body.html` + `Dashboard_Script_PlanningNextActions.html`) rendering the three bucket groups, then help copy (`#help-next-actions`). No mapping-layer changes were needed — the panel calls the backend directly via `google.script.run`, not through the Rolling Debt Payoff React bundle.

**Next Actions — v1 liquidity model (`cash_to_use`) — delivered**

Foundation for Next Actions v1. Full spec lives in `PROJECT_CONTEXT.md → Decision Layer → Liquidity model v1 — cash_to_use`. Delivered contract:

- **Scope** — conservative, buffer-respecting, current-state dollars **safely available right now**. Not the same as Rolling Debt Payoff's *Safe-to-use* (which folds in near-term holds, reserves, and unmapped card risk). Keep the two models separate.
- **Inputs** — Bank Accounts only: `balance`, `minBuffer`, `active`, `usePolicy` from `INPUT - Bank Accounts` + `SYS - Accounts`. No new sheets, no new columns.
- **Formula** — `usable = max(0, balance - minBuffer)` per account; `cash_to_use = Σ usable` over eligible accounts.
- **Eligibility** — active accounts only (shared inactive rule); exclude explicit restricted / do-not-use accounts; v1 Use Policy is a binary include/exclude (finer policies stay for Phase 2 Cash Strategy).
- **Output** — `{ cashToUse, accounts: [{ name, balance, minBuffer, usable, included, excludedReason? }] }`. The per-account array is part of the contract so the UI can show the breakdown and any excluded-reason.
- **Consumers in Next Actions** — compares `cashToUse` vs `sum(urgent)`, drives `review_cash_gap`, and feeds leftover to `pay_extra_debt`.
- **Guardrails** — never negative per account; buffers are sacred; no future-income, pending-transfer, or timing assumptions; no credit / HELOC / investments. HELOC strategy lives on the Rolling Debt Payoff *HELOC strategy* card, not in Next Actions.
- **Non-goals (v1)** — no forecasting, no time-based modeling, no cross-account optimization.

Ship ordering held: the reader landed **before** the Next Actions aggregator and is called from it directly. Exposed as a single server entry point returning the output object above; no changes to Bank Account editors or the existing liquidity consumers (Rolling Debt Payoff keeps its richer model unchanged).

**Decision Layer roadmap**
- **Phase 1 — Next Actions (v1).** ✅ Delivered. First landing surface inside Planning.
- **Phase 2 — Cash Strategy.** Later. Intended to pair Next Actions with a forward-looking liquidity / deployment view. Not scoped yet.
- **Phase 3 — HELOC Advisor refinement.** Later. Continues the existing advisor-anchored "What would change this?" pattern. Not scoped yet.

**Confidence / assumptions layer**
- Status: Proposed
- Why it matters: The planner already internally distinguishes high- and low-confidence inputs (`credit_card_spend_confidence`, `irregular_income_flag`, `unmapped_card_risk_hold > 0`, HELOC realism flags). None of that reaches the Standard surface. Users can't tell when a recommendation is rock-solid vs pattern-matched.
- System touchpoints: backend (expose existing flags on a stable field), mapping layer (add a typed `assumptions` block), React (one compact "What this is based on" strip under the Decision card).
- Risk: **Low.** Additive only; no math changes.
- Timing: **Now.**

**"Why this account?" explanation**
- Status: Proposed
- Why it matters: The Payment Result table shows *what* is being paid but not *why that account*. For Focus debt especially, users ask "why this one, not another?" A one-line rationale per role (highest APR above $X; smallest balance under $Y; spill to next by balance cap) builds trust and teaches the model.
- System touchpoints: backend (emit a short reason code per row alongside `_paid`), mapping layer, React (tooltip or inline muted line per row).
- Risk: **Low.** Presentation on top of data the engine already knows.
- Timing: **Now.**

**Data quality / mapping transparency**
- Status: Proposed
- Why it matters: The two biggest silent contributors to a conservative plan are (a) unmapped card-funded upcoming expenses and (b) low-confidence card spend. Today they're invisible unless you open Details. A visible "Data quality" indicator next to "Why not more?" makes the cause legible — even before we fix the underlying mapping.
- System touchpoints: backend (aggregate a small list of unmapped payees + low-confidence sources), mapping layer, React ("Why not more?" block extension).
- Risk: **Low.** Read-only exposure.
- Timing: **Now.**

**Stronger execution-readiness cues**
- Status: Proposed
- Why it matters: `[Add payment]` works but there's no feedback loop — after a user adds a payment, the planner doesn't visibly acknowledge it on rerun. A simple "X of Y planned payments entered this month" cue turns the table into a checklist.
- System touchpoints: backend (cross-reference `LOG - Activity` Quick add rows against current-month planned payees), mapping layer, React (row-level ✓ or header counter).
- Risk: **Low–Medium.** Needs a stable match rule between planned payee and logged payee.
- Timing: **Now / Soon.**

### Tier 2 — High-value but more coupled

**Alias / mapping repair workflow**
- Status: Proposed
- Why it matters: Fixes the root cause behind "unmapped card risk hold" and mis-classified CF rows. Today the only fix path is a code change.
- System touchpoints: backend (persisted alias table in a new `SYS - Aliases` sheet + resolver), Apps Script write endpoint, a small UI (likely inside Cash Flow or a dedicated "Payees" admin panel), and updates to every resolver that currently reads from the code-side map.
- Risk: **Medium.** New write surface + migration from code config to sheet.
- Timing: **Soon.**

**Reducing client/server allocation drift**
- Status: Proposed
- Why it matters: Prevents the small-balance/edge-case drift from becoming visible or wrong as we expose more strategies. Could be solved either by (a) serving a pre-computed allocation table at multiple cap points, or (b) lightweight debounced server round-trip for exact truth.
- System touchpoints: backend (multi-cap allocation emitter or a fast sub-endpoint), mapping layer, React memo graph.
- Risk: **Medium.** Touches the hottest path in the UI.
- Timing: **Soon.**

**Improving card-spend accuracy**
- Status: Proposed
- Why it matters: The card-spend model is the quiet driver of HELOC realism and unmapped-hold sizing. A true statement-balance ingest (even manual monthly entry) would upgrade `credit_card_spend_confidence` and tighten several decisions.
- System touchpoints: new INPUT sheet or column set, `buildHelocFlowSourceCardSpend_` + `buildHelocBillsCardObligationModel_` rewrites, confidence reclassification.
- Risk: **Medium–High.** Affects HELOC status/advised_draw downstream.
- Timing: **Soon.**

**Execution-flow streamlining**
- Status: Proposed
- Why it matters: Reduces friction from "see plan → execute six payments → come back" to something closer to a guided flow. Could be as small as a "Return to Rolling Debt Payoff" button after Quick add save, or as ambitious as a per-month execution tray.
- System touchpoints: Cash Flow Quick add save handler (return address), Rolling Debt Payoff refetch hook, possibly a new summary strip.
- Risk: **Medium.** UX-heavy; easy to over-design.
- Timing: **Soon.**

### Tier 3 — Strategic / later

**Exposing Aggressive strategy safely**
- Status: Proposed
- Why it matters: The allocator already exists; what's missing is the product wrapper — when it's appropriate, how Focus debt is chosen, confirmation UX, and guardrails against user surprise.
- System touchpoints: host strategy control (un-hide), Decision card (strategy-aware language), help/onboarding copy, validators.
- Risk: **Medium–High.** Product judgement heavier than code effort.
- Timing: **Later** (after confidence layer + readiness cues exist — they're prerequisites for trust).

**Larger workflow unification**
- Status: Proposed
- Why it matters: Long-term, the sidebar dashboard and the web app dashboard should share a single set of fragments. Reduces the drift tax called out in `TODO.md` #16.
- System touchpoints: `PlannerDashboard.html`, `PlannerDashboardWeb.html`, includes refactor.
- Risk: **Medium.** Mechanical but touches every tab.
- Timing: **Later.**

**Deeper model simulations / what-if tools**
- Status: Proposed
- Why it matters: Once confidence + assumptions are visible, users will ask "what if I deploy $X more?" or "what if APR on card Y drops?". Infrastructure for this mostly exists backend-side (`purchase_simulator.js`, yearly projections) — it's a UI + contract problem.
- System touchpoints: new React surface, new backend endpoint, careful isolation from the monthly decision surface to avoid noise.
- Risk: **High** if merged into Standard view; **Low** if kept as a dedicated Details or Planning sub-tab.
- Timing: **Later.**

**Broader regression / test harness investment**
- Status: Proposed
- Why it matters: Every other Tier 2/3 item gets safer once there's a regression net around the waterfall and HELOC advisor. Today's manual checklist is the ceiling on refactor ambition.
- System touchpoints: test runner (clasp-friendly), fixtures for `INPUT - *` tabs, snapshot assertions on payload shape.
- Risk: **Medium.** Non-trivial setup; high long-term ROI.
- Timing: **Later** (but pulled forward if engine changes become frequent).

### Queued — post Next Actions stabilization

Captured-but-not-scheduled product work. These items are *intent only* — structure and constraints are pinned here so they do not drift, but no implementation should start until overlap cleanup and Next Actions stabilization are complete (see **Prioritization order** at the end of this subsection).

**Debug mode control**
- Status: Proposed
- Purpose: Hide developer / debug information from normal users so the default surface reads as a product, not a diagnostics page.
- Concept: Introduce a single global `isDebugMode` flag (host-global, same pattern as `window.showTab` / `window.prefillQuickPayment`). No per-surface toggles.
- Debug-only items (hidden by default; shown only when `isDebugMode` is true):
  - "Why this cash amount?" liquidity breakdown on Next Actions.
  - Any explicit debug / internal-reasoning labels surfaced in the current UI (planner diagnostics, allocation audit, cash-bridge audit on Rolling Debt Payoff when appropriate, etc. — inventory on implementation).
  - Raw JSON exports where they don't aid a normal user.
- User-facing mode shows: summary rows, action cards, decision cards, payment result, help text. Nothing that requires internal vocabulary to read.
- Non-goals (v1): no user-visible toggle control is required in v1 — the flag can be a URL / query-string switch or a session-local key. Designing a "Developer mode" settings UI is a later pass.
- System touchpoints: new host-global, a shared `isDebugMode()` helper consumed by the affected render functions; **no** backend changes; **no** new sheets.
- Risk: **Low.** Pure presentation gating.
- Timing: **After** Next Actions stabilization (see prioritization order below).

**Income Sources (new input surface)**
- Status: Proposed
- Purpose: Give users a structured place to record income so future planning surfaces (forecast, Cash Strategy, onboarding) have a canonical read target. Replaces today's implicit "income = whatever shows up as Cash Flow inflow."
- Proposed location: **Assets → Income Sources** (primary candidate) or **Cash Flow → Income Setup** (fallback). Decide on location during design; do not implement both.
- Canonical fields (v1):
  - `source name` (string)
  - `amount` (number)
  - `frequency` (enum: weekly / biweekly / semimonthly / monthly / quarterly / annual — pin the exact list at design time)
  - `active` (boolean, same inactive rule as the rest of the app)
- Non-goals (v1):
  - No planner integration. Rolling Debt Payoff continues to derive income exactly as it does today (Cisco + configured recurring rent payees, variable-income 50/30/20 split). Income Sources is **not** read by the waterfall in v1.
  - No forecasting. No 12-month projected income timeline from these rows.
  - No automatic Cash Flow posting. Rows here do not mint `INPUT - Cash Flow` entries or LOG rows on their own. Quick Add stays the only write path.
- System touchpoints: new `INPUT - Income Sources` sheet (columns match the v1 fields + `Active`); Apps Script reader following the existing reader patterns (`readSheetAsObjects_` + a small `normalizeIncomeSources_`); a new panel (location TBD) with the usual Add / Update / Stop tracking actions and a matching `income_source_add` / `income_source_deactivate` event type in `LOG - Activity`. No mapping layer or React bundle changes.
- Risk: **Low–Medium.** New write surface, but it is isolated — nothing else reads these rows in v1.
- Timing: **After** debug mode (see prioritization order).

**Onboarding (Phase 1)**
- Status: **Delivered** as **Setup / Review** (top-right dashboard button).
- Purpose: Guide a household through first-time setup instead of handing them an empty workbook. Reduces the cliff between "I opened CashCompass" and "I can trust the numbers on Next Actions."
- Delivered scope (in order, as implemented):
  - **Welcome** screen → **status grid** (card per step with *Setup complete* / *Not set up* badge and short summary).
  - **Bank Accounts** detail — reads the current-year block on `INPUT - Bank Accounts`.
  - **Debts** detail — reads active rows from `INPUT - Debts`.
  - **Bills** detail — reads active rows from `INPUT - Bills`.
  - **Upcoming Expenses** detail — reads *Planned* rows from `INPUT - Upcoming Expenses`.
  - **Income** detail — derived from the latest `INPUT - Cash Flow <year>`; **no** `INPUT - Income Sources` sheet. Recurring detections are grouped conservatively; excluded categories (Bonus, RSU, ESPP, Refund, …) are surfaced as "Other detected income".
  - **Finish** summary — per-step status list with *Review* deep-links and a *Go to Next Actions* CTA.
- Editor handoff:
  - Every per-step CTA opens the **existing** editor (Bank Accounts, Debts, Bills, Upcoming, Cash Flow → Income) in **Setup mode**: main top nav, page sub-tabs, *Setup / Review*, and *Run Planner + Refresh Snapshot* are hidden; a slim **Back to Setup** bar returns the user to the matching detail screen. Normal navigation to the same editor is unchanged.
- Sheet safeguards:
  - Setup creates `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, and `INPUT - Upcoming Expenses` with canonical headers when missing, reusing existing codebase schema (e.g. `getDebtsHeaderMap_`, `getOrCreateUpcomingExpensesSheet_`). It does **not** invent Cash Flow year sheets — if the latest year is missing, the Income step reports that explicitly.
- Read-only guarantee:
  - Viewing Setup never writes, never touches `SYS -` sheets, and never appends to `LOG - Activity`. Writes only happen through the underlying editors, which use the same save logic as the normal path.
- Non-goals (still intentionally out of scope):
  - No advanced strategy content (HELOC, Aggressive payoff, Cash Strategy, what-if tools).
  - No automated import; Setup guides *where* and *in what order*, not *what* to type.
  - No gamification or progress persistence — this is a walkthrough, not a state machine.
- Documentation: Help copy lives in `Dashboard_Help.html → Setup / Review` (`#help-setup`). Product framing is in `PROJECT_CONTEXT.md → Setup / Review (Onboarding Phase 1, delivered)`.
- Follow-ups (tracked in `PROJECT_CONTEXT.md`): retire `?onboarding=test` / `TEST -` fallbacks; consolidate the five per-step `*SetStatus_` / `*LoadDetail_` / `*RenderDetail_` / `*Open*Page` groups in `Dashboard_Script_Onboarding.html` into a shared factory once the flow has been exercised in real use.

**Prioritization order (for the queued items above)**

Do not shuffle without an explicit product decision:

1. **Finish overlap cleanup.** The Next Actions / Debt Overview / Rolling Debt Payoff cleanup pass (duplicate decision content removed, cross-links added, Next Actions wording tightened) must land cleanly before any new surface work begins. This is the current in-flight work.
2. **Stabilize Next Actions.** Let the v1 decision surface bake against real daily use: confirm urgent grouping, recommended sizing, routing, and "Why this cash amount?" disclosure all hold under normal household operation. No new queued items start while Next Actions is still being corrected.
3. **Debug mode control.** First net-new item. Smallest scope, lowest risk, unblocks the rest by ensuring debug/internal content has a single gating pattern before more surfaces add their own.
4. **Income Sources.** Structured income input. Can land without planner integration because debug mode already hides work-in-progress surfaces from normal users if needed.
5. **Onboarding (Phase 1).** **Delivered** as *Setup / Review*. Built after debug mode and in place of a standalone Income Sources surface — income is now managed inside Setup from the latest `INPUT - Cash Flow <year>`. Remaining onboarding follow-ups are scoped to TEST-mode retirement and an internal factory refactor of the per-step client handlers; neither changes user-visible behavior.

---

## 5. Recommended next item

**Confidence / assumptions layer.**

Why this is the best next move:

- **Value is immediate and visible.** Today the Decision card says *what* to do. Adding a tight "What this is based on" strip tells the user *how sure* the planner is — which is the missing piece behind almost every "should I trust this?" moment.
- **All the inputs already exist.** The engine already tracks `credit_card_spend_confidence`, `irregular_income_flag`, unmapped-hold presence, HELOC realism gates, and planned-expense hold sources. We don't have to compute anything new — we have to *surface* what's there.
- **Fits the current architecture cleanly.** Backend emits a new `assumptions` object, mapping layer types it, React renders a compact block under the Decision card. No waterfall changes, no new write surface, no navigation glue.
- **Safer than bigger changes right now.** Unlike the Tier 2 items (alias repair, drift reduction, card-spend accuracy) it doesn't change math, doesn't add write paths, and doesn't change the shape of any existing decision. Worst case: we hide it behind the Details toggle if it feels noisy.
- **It's a prerequisite for Tier 3 work.** Exposing Aggressive strategy safely, or any what-if tooling, only makes sense after users can read *why* the current recommendation looks the way it does.

First concrete step when we pick this up: enumerate the existing backend flags that should feed the layer, agree on a priority order (which gets shown first when multiple fire), and draft the three-to-five short sentences that render in the UI.

---

## 6. Enhancement guardrails

Rules that apply to every future change in this backlog:

- **Preserve Standard-mode simplicity.** New information lands in Details by default. It only graduates to Standard once it passes a "would this change a decision?" test.
- **Do not expose unfinished strategy choices.** Aggressive, what-if, and any new planner modes stay dark until their UX, explanation, and guardrails are designed.
- **Do not duplicate source-of-truth data.** Sheets are canonical. New UI reads; it does not cache, re-store, or shadow sheet state.
- **Prefer navigation to source pages over duplicating details.** The `[View]` and `[Add payment]` patterns are the template — point users at the real source, don't rebuild it inside the planner.
- **Keep React as presentation/navigation layer, not direct write layer.** All writes go through Apps Script endpoints, with `LOG - Activity` entries. The React bundle calls host globals; it does not call `google.script.run` for writes.
- **Add new logic backend-first, then map forward.** Emit from Apps Script → type in the mapping layer → consume in React. No parallel client-side derivations.
- **Execute one improvement area at a time and lock it before moving on.** Ship, document in `SESSION_NOTES.md` / `Dashboard_Help.html`, then pick the next one. No stacking half-shipped features.
- **Rebuild the React bundle after any component change.** `RollingDebtPayoffDashboardBundle.html` is a prebuilt artifact. Any edit to `components/*.tsx` or the mapping layer requires running `npm run build:rolling-dashboard`. Skipping this step means UI changes will not appear in the dashboard.

---

## 7. Working method

How this backlog should be used:

- **Pick one enhancement at a time** from the prioritized list — start at the top of Tier 1 unless there's a reason to deviate.
- **Review current behavior first** in both backend (what fields exist today) and frontend (what the user sees). Confirm the gap is real in the current build.
- **Make scoped changes only.** Touch the minimum set of files — backend emitter, mapping, one React block, help copy. Resist the urge to refactor adjacent code "while we're in there."
- **Validate in UI.** Run `npm run build:rolling-dashboard`, load the web app, confirm the change in Standard and Details modes, confirm nothing moved in the existing compact cards.
- **Lock before moving to the next item.** Update `SESSION_NOTES.md`, update `Dashboard_Help.html` if user-facing, update `TODO.md` / this file's status if needed, then commit. Only then pick the next enhancement.
