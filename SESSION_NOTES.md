## V1 trust baseline — complete

The V1 trust baseline is shipped and locked, and V1.1 closed out with the retirement profile integration (see **V1.1 — Retirement Profile Integration (DOB Source of Truth)** section below). The project is now in **V1.2 / controlled improvement mode**. Working rules for this phase live in `WORKING_RULES.md → Current phase`; product framing lives in `PROJECT_CONTEXT.md → Current phase`. All prior phase notes below this header are preserved as-is for historical record.

### Phase history — what V1 shipped

Grouped summary of the work that closed out V1. Full per-change notes are in the dated sections further down in this file; do not condense them.

- **Core stability** — blank / fresh workbook no longer throws `Missing sheet (after retry+flush): …` across Overview, Planning tabs, Assets, Cash Flow, Activity, Setup / Review. Missing-sheet paths degrade calmly to empty states or Setup / Review CTAs.
- **Retirement trust fixes** — `needsHouseholdBasics` / `needsScenarioAssumptions` / `ready` states; incomplete scenarios treated as inactive; no fake defaults; Overview Retirement Outlook shows a calm setup hint when analysis is unavailable.
- **Overview trust layer fixes** — Buffer Runway no longer reads "Growing / stable" on blank workbooks; Suggested Actions and Issues route to Setup / Review instead of falsely confident "No active issues detected." / "No suggested actions right now." copy.
- **Planner / dashboard graceful degradation** — planner panels, Rolling Debt Payoff host, and Bills Due on blank workbooks render empty states or calm setup hints instead of red banners.
- **Activity log race-condition fix** — concurrent writes to `LOG - Activity` during first-run flows no longer drop rows or double-log paired `quick_pay` events.
- **Blank-workbook module fixes** — remaining module-by-module crashes fixed across Setup / Review, Bank Accounts, Investments, Debts, Upcoming, Donations, House Values / Expenses, Property Performance.
- **Rolling Debt Payoff blank-workbook handling** — tab renders an empty / setup-aware state instead of throwing when `INPUT - Debts`, `SYS - Accounts`, or Cash Flow year sheets are missing.
- **Quick Add load + submit safety** — prefill and submit no longer throw on a blank workbook; form loads with neutral empty state and guides users to Setup / Review when Bills / Debts / Accounts are missing.
- **Planner email gating fix** — `sendPlannerEmailIfConfigured_` reads `INPUT - Settings.Email` strictly (no `Session.getActiveUser()` fallback), and also requires `isPlannerSummaryMeaningful_(summary)` before sending. Blank / not-set-up workbooks no longer silently email the owner; populated workbooks with a valid settings email are unaffected.
- **UI copy consistency pass** — bounded pass across Dashboard HTML + standalone dialogs + user-facing backend messages: ellipsis normalization (`Saving…`), removal of user-facing `"Error:"` prefixes, calm exception messages (`Couldn't load — please try again.`), direct validation tone (`<Field> is required.`), standard empty / setup wording (`No <things> yet.`, `Add your <things> in Setup / Review to see <outcome>.`), `Open Setup / Review` CTA label preserved, and removal of internal sheet-name leakage from user-facing strings.

---

## V1.1 — Retirement Profile Integration (DOB Source of Truth)

V1.1 is closed. The headline V1.1 item — **Retirement profile integration** — shipped end-to-end. Profile is now the single source of truth for Date of Birth; Retirement derives current age from it and no longer edits or stores an age of its own. This note is the phase summary; detailed day-by-day entries are folded into the Archive below where applicable.

**Shipped (commits `92c8673` → `6d25c0e`):**

- **Profile expansion** — added **Date of Birth** plus a full spouse/partner block (`Spouse Name / Email / Phone / Address / Date of Birth`) to Profile, using the flat `INPUT - Settings` key-value store. Existing required fields (`Name`, `Email`) unchanged; all new fields optional; populated workbooks unaffected. Client-side validation + server-side round-trip in `profile.js`.
- **Retirement DOB derivation** — added `readRetirementProfileDerivedAges_()` + `computeAgeFromDob_()` in `retirement.js`, and surfaced **derived age hints** in Retirement Basics as helper text (e.g. "From your Date of Birth in Profile: 53") without removing the manual inputs in the first pass.
- **Current-age removal from Retirement** — converted the per-scenario age fields to **display-only** plain divs (no spinner arrows, no editable styling), removed the Retirement Basics edit form entirely, removed `saveRetirementBasicsFromUi_` and its helpers from the client, and dropped `yourCurrentAge` / `spouseCurrentAge` from the `saveRetirement` payload. The backend `saveRetirementBasics` entry point is now a friendly-error stub for any stale cached client.
- **`needsProfileDob` readiness state** — new Retirement state replacing the old `needsHouseholdBasics` gate. When the primary DOB is missing, Retirement renders a clean empty-state card with an **Open Profile** CTA instead of an editable fallback. Missing spouse DOB does **not** block.
- **DOB parsing bug fix** — `INPUT - Settings` DOB cells were being auto-coerced to `Date` objects by `getValues()`, then stringified to a non-ISO form, then rejected by the previous strict `YYYY-MM-DD` regex in `computeAgeFromDob_`. The parser was widened to accept Date objects, valid `YYYY-MM-DD` strings, and other date-like strings, while keeping all existing validation rules (calendar round-trip, future-date rejection, age cap, etc.).
- **UI cleanup (no-spinner, display-only)** — `<input type="number" readonly>` replaced with plain `<div class="retirement-age-display">` for both "Your Current Age" and "Spouse Current Age" display rows. Matching client JS switched from `.value = …` to `.textContent = …` in every render branch (`ready`, `needsProfileDob`, `needsScenarioAssumptions`).
- **Sheet model cleanup** — `getOrCreateRetirementSheet_` no longer seeds the `Household Input` header, `Your Current Age`, `Spouse Current Age`, or the trailing blank separator row on **new** `INPUT - Retirement` sheets. All downstream hardcoded formatting ranges were shifted −4 rows to match the new layout. Existing populated sheets are **left untouched** — legacy rows remain in place but are inert (no read, no write, no planner consumption).

**Backward compatibility (explicit decision):**

- **Do not hard-delete legacy age rows** from existing `INPUT - Retirement` sheets in this pass. Leaving them inert is strictly safer: no label-index shifts, no risk to populated workbooks, and a future opt-in "Legacy sheet cleanup tool" can sweep them with user confirmation later.
- **No fallback to saved manual ages.** If Profile DOB is missing, Retirement shows setup guidance — it never silently resurrects old saved age values. This was a deliberate trade-off to keep DOB as the single source of truth.

**Known V1.2 follow-ups (see `TODO.md → V1.2 candidates`):**

- Profile DOB parser symmetry — `profile.js::isValidProfileDateString_` still assumes strict string format; widen it to match the retirement-side normalization.
- Overview Retirement Outlook copy alignment with the new `needsProfileDob` language.
- Dead-code prune — `readRetirementHouseholdSafe_`, `getRetirementHouseholdInputs_`, `writeRetirementHouseholdInputs_`, and the `saveRetirementBasics` stub are now unused; safe to remove in a future cleanup pass.

---

## Current State — Post V1.2 Prep

Captured at a pause point so work can resume cleanly. Product state carried since the V1.1 close-out and the V1.2 prep passes that followed.

**Shipped since the V1.1 close-out:**

- **Profile is the source of truth for DOB.** Retirement derives current age from Profile DOB only; editable current-age inputs were removed from the Retirement UI and the payload.
- **DOB parsing is robust.** The retirement-side reader (`computeAgeFromDob_`) and the profile-side save validator both accept Date objects, `YYYY-MM-DD` strings, and other date-like strings. The silent Sheets auto-coercion path that used to produce blank derived ages no longer breaks anything. Save-side parser symmetry shipped in `5f1e34d`.
- **Profile edit-form hydration fixed.** Opening Edit Profile before the async detail fetch completed used to leave every field blank (not just DOB). The editor now hydrates from the fresh payload as soon as the detail load resolves (`onboardingProfilePrefillEditor_`). Shipped in `5f1e34d`.
- **Retirement and Overview refresh after Profile save.** `onboardingSaveProfile_` fires a guarded `loadRetirementSection()` on success; `loadRetirementSection()` then repaints the Overview Retirement Outlook card from the same fresh payload (no extra server RPC). Both tabs and the Overview card stay consistent with the latest DOB. Shipped in `5f1e34d`.
- **Planner performance improvements.**
  - Dashboard chart reuse across runs (`89c1088`) — charts are not torn down and re-inserted when their title + range are unchanged. Cuts the biggest single chunk of planner latency.
  - Cash Flow read de-duplication (`b498366`) — `runDebtPlanner` and `getBillsDueFromCashFlowForDashboard` now share a single `readCashFlowSheetRaw_` snapshot instead of reading and parsing the same current-year sheet twice per run.
- **Bank Import — Step 1 scaffold (`8ced838`).** `bank_import.js` ships three inert ensure helpers that create two new SYS sheets and append an `External Account Id` column on `SYS - Accounts`. Nothing existing calls them, so planner, overview, retirement, cash flow, and the manual bank account UI are unaffected. Full scope, resume instructions, and Step 2a plan live in `TODO.md → Bank Import — status & resume plan`.
- **Debts — fast save + activity log + background planner (`c26c11c`).** Saving a field on Planning → Debts → Update now shows a proper `Saving… → Saved.` status row, optimistically repaints the right-hand info panel with the new value (no waiting for a server round-trip just to redraw), fires `refreshSnapshot()` so the Overview KPIs follow, and calls `runPlannerAndRefreshDashboard()` as a **silent background RPC** so Rolling Debt Payoff and other planner-dependent cards catch up shortly after. The previous behavior ran the debt planner inline inside `updateDebtField`, which held the UI on `Saving…` for several seconds on big workbooks — that inline call is gone. Every field edit is also written to `LOG - Activity` as a new `debt_update` event, classified as `Debt` kind, with a dynamic action label (`debtUpdateActionLabel_` in `activity_log.js`) like *Updated Account Balance to $54,000.00* / *Updated Int Rate to 7.50%* / *Updated Due Day to 15*. Amount renders `—` (`activityLogIsNonMonetaryEvent_` now includes `debt_update`) so field edits don’t double-count against Activity totals; the previous / new raw + display values and the `fieldKind` are preserved in the event `details` JSON (`detailsVersion: 1`) for future undo tooling. Help updated (`Dashboard_Help.html` → Debts — Update / Activity log → `debt_update`).
- **Quick Add — robust Saving… indicator + $0 allowed (`098fef0` → `29f29a2`).** The status row on Cash Flow → Quick add → Add to Cash Flow now layers plain-text `setStatus('pay_status', 'Saving…', false)` under `setStatusLoading(…)` inside `savePayment()`, so the label shows reliably regardless of deploy / CSS state, then flips to `Saved to Cash Flow.` on success. This mirrors the proven pattern from the legacy sidebar `PlannerDashboard.html::savePayment()`. Server-side `quick_add_payment.js::quickAddPayment` amount validator relaxed from `amount <= 0` to `isNaN(amount) || amount < 0` with the new error string `Amount must be a valid number.` so users can intentionally zero out a month cell, correct a bad entry, or save a $0 placeholder row (since the payee can now show up in Bills Due / Upcoming before the first real payment). `Math.abs()` already coerces stored values so the negative branch is defensive only. Upcoming Expenses (`upcoming_expenses.js:193`), Income Sources (`income_sources.js:382`), and the Purchase Simulator (`purchase_simulator.js:29`) still require `> 0` — different semantics, intentionally left alone. Help updated (`Dashboard_Help.html` → Cash Flow → Quick add).
- **Bills Due — inactive debts and inactive Cash Flow rows no longer leak into the recurring fallback (`9bf3234`).** `Recurring Bills (No Due Date)` on the Bills Due page was showing debts marked `Active = No` in `INPUT - Debts` (reproduced with *Laith VCS Account*). Root cause: `getRecurringBillsWithoutDueDateForDashboard()` in `dashboard_data.js` only excluded payees present in `getDebtPayeeMap_` (active-only) and never checked the Cash Flow row's own `Active` column, so deactivating a debt actually *promoted* its still-present Cash Flow row into the fallback list. Fix adds two guards inside the existing loop: (1) skip Cash Flow rows explicitly marked `Active = No` (accepts `no / n / false / inactive`; blank still means active, matching the `getCashFlowHeaderMap_` convention), and (2) a new sibling helper `getDebtPayeeMapAllStatuses_(ss)` — name-reservation only, no totals/planner impact — so any payee that appears in `INPUT - Debts` (regardless of status) is excluded from the fallback. Only caller of the recurring-fallback function is `Dashboard_Script_BillsDue.html` (line 324), so blast radius is limited to that one section of the Bills page. Planner math, Overview snapshot, Retirement, credit-card totals, Debts list, and the active Bills Due (Next 7 / Overdue) paths are untouched — they already filter inactive debts via `isDebtSheetRowInactive_`.
- **Planner email — handled-this-month check now uses each debt's next-due month (`bae82c9`).** The Debt Planner email's *Pay now* / *Pay soon* sections were silently dropping loan payments due in the next calendar month if the user had already paid the *current* month. Root cause: `buildUpcomingPayments_` checked the "handled this month" flag against the current calendar month's Cash Flow cell, even when the payment's `nextDueDate` fell in a different month. Fix: `buildDebtMinimumHandledMap_` now returns a month-keyed nested map; `isDebtMinimumHandledThisMonth_` accepts a `monthHeader`; and `buildUpcomingPayments_` resolves the correct month header (`getMonthHeaderForDate_`) for each upcoming payment before checking handled status. `runDebtPlanner` passes `[currentMonth, nextMonth]` so both months are pre-built. Bills (non-debt) path was already correct.
- **Bank Import — Step 2a ingestion pipeline (`03d2c4a`).** First server-side ingestion built on the Step 1 scaffold. `processBankImportBatch_(payload)` handles ignored checks (permanent only), exact-id auto-match against `SYS - Accounts.External Account Id` (writes balance through the proven history path, syncs SYS), pending staging upserts for everything else (status `pending`, Pending Reason from a fixed enum), balance-fingerprint dedupe against recent `LOG - Activity`, and `LOG - Activity` events `bank_import_auto_matched` / `bank_import_pending` / `bank_import_ignored_hit` / `bank_import_row_error`. Dev/test harness `_devRunBankImportSample()` and `_devRunBankImportCustom_(payload)` only — no UI, no external sync, no planner impact (pending rows live only in the staging sheet, which no existing module reads). Strict deviations recorded: blank `currency` is treated as `currency_mismatch` (not auto-matched), `BANK_IMPORT_STALE_BALANCE_DAYS = 90` (future-dated `balanceAsOf` always stale), and `runDebtPlanner` is intentionally **not** called from auto-match — left to the user's manual Run Planner trigger.
- **Quick Add — instant Activity ledger refresh + background planner (`d743458`).** Saving a Quick Add payment now calls `loadActivitySection()` immediately on success so the new row shows up on the Activity tab without waiting for the planner, and the planner is fired as a silent background RPC (`runPlannerAndRefreshDashboard()`) just like the Debts save. Mirrors the proven pattern from `c26c11c`. The previous flow ran the planner inline and held the UI on the success state for several seconds before the Activity tab reflected the new payment.
- **Asset updates — activity log + fast save without waiting on planner (`f13d928`).** Bank Account, House Value, and Investment balance updates now log `bank_account_update` / `house_value_update` / `investment_update` events to `LOG - Activity` (previously these manual updates produced no audit entry at all), and the client-side save flows now decouple the UI refresh + activity-log refresh from the full planner run — same pattern as Debts. Status row shows `Saving… → Saved.`, summary panel and activity log update immediately, and `runPlannerAndRefreshDashboard()` runs as a silent background RPC so Rolling Debt Payoff / Overview snapshot catch up shortly after. New events are classified as **Bank** / **House Expenses** / **Investment** kind respectively, action label includes the month and new balance (e.g. *Updated May-26 balance to $1,234.56*), and **Amount** renders `—` (non-monetary) so balance updates don't double-count. Help updated below.
- **Asset pages — collapse repeat sheet reads + show "Saving…" instead of "Loading…" (`6c0953d`).** Two issues fixed in one pass. (1) Performance: Bank Accounts, Investments, House Values, and Debts page-load and dropdown-selection RPCs were each making 2-4 full-sheet reads (e.g. one for Type options, one for inactive set, one for header map). Consolidated to a single `getDataRange().getDisplayValues()` per RPC and threaded into helpers via new optional `display` / `headers` parameters (backward compatible — older callers still work). Per-row `getRange(row, col).getDisplayValue()` loops in `findBankAccountRowInBlock_` / `findHouseRowInBlock_` / `findInvestmentRowInBlock_` were replaced with single batched range reads. (2) UX: after the Asset save fast-save fix, the load helpers were re-triggering `setStatusLoading()` and clobbering the `Saved.` message with `Loading…`. Save handlers now pass an explicit `'Saving…'` label to `setStatusLoading`, and `loadBankData / loadHouseData / loadInvestmentData` accept a `quiet` parameter that skips `setStatusLoading` and the trailing `setStatus('', false)` so the `Saved.` message survives the post-save refresh.
- **Asset save sync — stop hanging on every save (uncommitted, today).** Saving an Investment value reportedly took "forever" — the spinner stayed on `Saving…` for tens of seconds on populated workbooks. Root cause: `syncAllAssetsFromLatestCurrentYear_()` (and its bank/house siblings) computed the latest-value map by doing **~4 Sheets API round-trips per row** in the year block (per-row display lookup + `getLatestNonEmptyMonthColumnForRow_`'s header read + value-row read + matched-cell read), then wrote into SYS - Assets / SYS - Accounts / SYS - House Assets through the format-preserving `setCurrencyCellPreserveRowFormat_` for **every row regardless of whether the value changed**. For ~15-20 investments that produced 100+ round-trips on a single save. Fix in `investments.js`, `bank_accounts.js`, `house_values.js`: (1) `getLatest*ValuesForYear_` rewritten to do **2 round-trips total** — one full-sheet display, one batched `getRange(dataStartRow, 1, numRows, lastCol).getValues()` — and resolve the latest non-empty month entirely in memory using `parseMonthHeader_` against the already-loaded header row; (2) the `syncAll*FromLatestCurrentYear_` write loops now compare the new value against the existing `targetRaw[r][balanceColZero]` (rounded to 2dp on both sides) and **skip the format-preserving write when unchanged** — collapses N writes to 1 in the common case where only one account changed. Helper-map calls in the sync functions also reuse the already-loaded `targetDisplay` instead of re-reading the header row. No behavior changes (same latest-value math, same writes when something actually changed, same activity logging, planner still runs in the background as a silent RPC); just dramatically fewer round-trips. Bank Account and House Value saves benefit from the same fix as defense-in-depth even though only Investments was reported.
- **Quick Add — Bill Pay prefill race + explicit Other payee option (`1305c40`).** Two related Quick Add fixes. (1) Race condition: launching Quick Add from a bill on a cold tab failed to populate the **Existing Payee** dropdown because `prefillQuickPayment` ran synchronously before `paymentPayees` finished loading. Fix stashes the wanted payee in `window.__pendingQuickAddPayee` and applies it via a new `consumePendingQuickAddPayeePrefill_()` helper called from `loadPaymentSection`'s success handler, with a guard that won't overwrite a user edit. (2) New users had no clear way to add a payee that wasn't already in the dropdown — the only path was to type into the free-text input which felt invisible. Added an explicit **Other (type new payee)** sentinel option (`__OTHER__`) at the bottom of the Existing Payee dropdown; `syncPaymentPayeeInput()` clears + focuses the typed input when selected, and `currentPaymentPayee()` treats the sentinel as no-selection so the typed value wins.
- **Quick Add — Activity row now appears instantly via optimistic prepend (uncommitted, today).** User reported saving an income via Quick Add took "forever" to show in the Activity ledger — visibly only appearing after the full planner run + email finished. Root cause: the success handler kicked off five concurrent RPCs (`loadActivitySection`, `refreshSnapshot`, `loadUpcomingSection`, `loadDashboardActionSections`, `runPlannerAndRefreshDashboardFromSave`) and meanwhile blanked the activity table with a `Loading activity…` placeholder. When the planner queued ahead of the activity reload (or just dominated the shared client-side network budget), the table sat on `Loading…` for 10+ seconds. Fix in `Dashboard_Script_Activity.html` and `Dashboard_Script_Payments.html`: the server's `quickAddPayment` already returns `activitySnapshot` with every field needed (entryType, payee, amount, entryDate, cashFlowSheet, cashFlowMonth) — new helper `prependOptimisticQuickPayActivityRow_(snapshot)` builds a row in the same shape `getActivityDashboardData` returns and prepends it to `window.__activityRows`, then re-renders. New `loadActivitySection({ quiet: true })` mode skips the loading-placeholder write so the optimistic row stays visible while the server reconciles in the background; once the server returns, `window.__activityRows` is replaced with the authoritative list (containing the same row at the top), no flicker. Other callers (Apply button, tab navigation, post-delete reload) keep the original placeholder behavior because `opts.quiet` defaults to false. The only `loggedAt` discrepancy between optimistic and reconciled rows is sub-second (client time vs. server tz) — within the rendering granularity. Help updated under Cash Flow → Quick Add.
- **Planner email — debounce per-save runs + send to spouse too (uncommitted, today).** Two related changes shipped together to address the user's "I do 50 saves at month-start and get 50 emails" pain point. (1) **Recipient resolution now reads `Email` AND `Spouse Email`** from `INPUT - Settings` via the new `readPlannerEmailRecipientsStrict_()` helper in `planner_output.js`, validates each value against `PROFILE_EMAIL_REGEX_` (the same regex Profile uses on save), de-duplicates on case-insensitive match, and joins all valid recipients on the `To:` line in a single `MailApp.sendEmail` call so spouse gets the same copy. The legacy single-recipient `readPlannerEmailFromSettingsStrict_` is removed. (2) **Per-save background planner runs no longer email immediately**; instead they bump a `LAST_SAVE_AT` timestamp in `DocumentProperties` and log a `planner_email_deferred` row to `LOG - Activity`. A new time-driven trigger `debouncePlannerEmailRun` (registered idempotently from `getDashboardSnapshot()` via `ensureDebouncePlannerTrigger_()`) polls every **5 minutes** and, once **10 minutes** of inactivity have elapsed since the last save, runs `runDebtPlanner({ emailMode: 'send' })` once to flush a single consolidated email. New file `debounce_planner.js` owns the queue mechanics. **Manual button** (`Run Planner + Refresh Snapshot`) keeps sending immediately because it goes through `runPlannerAndRefreshDashboard()` (default `emailMode === 'send'`); the new save-flow RPC `runPlannerAndRefreshDashboardFromSave()` defers. Threaded `options.emailMode` through `runDebtPlanner(options)` (default `'send'`, preserves byte-for-byte behavior for the menu / sidebar callers) and `sendPlannerEmailIfConfigured_(summary, options)`. New activity events `planner_email_deferred` / `planner_email_sent` / `planner_email_invalid_recipient` (classified as **Planner** kind, all non-monetary, all ineligible for the Activity Remove button — same treatment as the other audit events). Five client save sites in `Dashboard_Script_AssetsBankInvestments.html` (×2), `Dashboard_Script_AssetsHouseValues.html`, `Dashboard_Script_PlanningDebts.html`, and `Dashboard_Script_Payments.html` switched from `runPlannerAndRefreshDashboard()` to `runPlannerAndRefreshDashboardFromSave()`. The server-side `runDebtPlanner()` call from `house_expenses.js` now passes `{ emailMode: 'defer' }`. Help updated (`Dashboard_Help.html` → Debt Planner email → "Who gets the email" + "When the email is sent (debounce)" + Activity log new event descriptions + Remove button greyed list).

This section is the resume anchor. If it drifts from reality, update it first before pulling the next item from `TODO.md → V1.2 work queue`.

---

## Archive (historical notes)

Everything below this line is preserved as-is for historical context. It captures the phase-by-phase stabilization, polish, and feature work that led up to the V1 trust baseline summarized above. Do **not** treat the status lines, TODO/open fragments, or "current" / "next step" text inside this archive as active — current status lives in the V1 trust baseline header, the V1.1 retirement profile integration note, `PROJECT_CONTEXT.md → Current phase`, and `TODO.md → V1.2 work queue`.

## Final Polish Phase

Context:
- The system is now stable. Blank workbook no longer crashes, retirement flow is truthful and guided, Overview explains incomplete Retirement and Buffer Runway states, and Suggested Actions + Issues correctly route blank workbooks to Setup / Review.
- Focus has shifted from stabilization to **UX, clarity, and consistency** polish.

Working rules (apply to every polish step):
- **One issue at a time.** Each prompt identifies and fixes exactly one highest-value issue.
- **No large refactors.** Prefer small, localized, additive changes.
- **No destructive sheet changes.** No schema / header / formatting changes to existing sheets; no rewrites of populated data.
- **Test on both populated and blank workbooks.** Populated must be byte-for-byte unchanged except for intended polish; blank must degrade calmly with clear guidance.
- **Prefer client-side fixes** when the payload already exposes what we need (e.g. `snapshot.state`). Touch backend only when strictly necessary.

## Current Status

- Retirement flow stabilized (needsHouseholdBasics / needsScenarioAssumptions / ready states; no fake defaults; incomplete scenarios treated as inactive).
- Overview Retirement Outlook shows a calm setup hint when analysis is unavailable.
- Buffer Runway corrected (blank workbook no longer shows "Growing / stable" false confidence).
- Suggested Actions corrected (blank workbook routes to Setup / Review instead of "No suggested actions right now.").
- Issues card corrected (blank workbook no longer shows "No active issues detected."; routes to Setup / Review instead).

## Final Polish Checklist

Reusable audit categories. Each bullet below is a concrete finding from the latest full-product audit — file + function references included so the next session can pick one and fix it without re-auditing.

### Empty-State Consistency

Every card on every tab should degrade calmly on a blank / not-set-up workbook. No falsely reassuring numbers or copy when there is literally no data to evaluate.

- **Overview > Operations Snapshot KPIs show confident `$0.00` on blank workbooks.** Bills "Due Soon" / "Overdue" counts (`ov_bills_dueSoonCount`, `ov_bills_overdueCount`), "Bills Next 7 Days" amount (`ov_bills_next7`), "Upcoming Next 7 / Next 30" amounts (`ov_upcoming_next7`, `ov_upcoming_next30`), and "House Expenses This Month / YTD" show formatted zeros when the relevant sheets are missing or unpopulated. Reads as "all clear" when we've never looked. Files/functions: `Dashboard_Script_BillsDue.html::renderBillsDueSummary_`, `Dashboard_Script_CashFlowUpcoming.html::renderUpcomingSummary`, plus whichever renderer fills `ov_house_*` on Overview. **Impact: high.**
- **Bills mini-card turns "bill-card-clear" green on blank workbooks.** `renderBillsDueSummary_` unconditionally adds `bill-card-clear` when `overdueCount === 0 && next7Count === 0`, so a not-set-up workbook visually signals "you're clear" in a positive color. Should stay neutral when no bills data exists. File: `Dashboard_Script_BillsDue.html::renderBillsDueSummary_`. **Impact: high.**
- **Overview > Bills summary line says "No bills due right now." on blank workbooks.** Same class as Issues / Suggested Actions — reads as a checked result, not an unset state. File/function: `Dashboard_Script_BillsDue.html::renderBillsDueSummary_` (`ov_bills_summaryText` branch). **Impact: medium–high.**
- **Cash Flow > Upcoming empty state is a dead end.** `renderUpcomingList` shows "No active upcoming expenses." with no CTA — a brand-new user has no path to "add your first one" without discovering the form below. File: `Dashboard_Script_CashFlowUpcoming.html::renderUpcomingList`. **Impact: medium.**
- **Planning > Debts Payoff empty view lacks Setup CTA.** "No accounts with a balance > $0 to show. Update your debts or refresh after you pay something down." reads as "you're debt-free" on a not-set-up workbook. File: `Dashboard_Script_PlanningDebtPayoff.html` (payoff list renderer, near line 274). **Impact: medium.**
- **Donations empty state has no CTA.** `"No donations logged yet."` is fine when intentionally empty but offers no guidance to brand-new users. File: `Dashboard_Script_Donations.html::loadDonationsSection` renderer. **Impact: low–medium.**
- **Activity log empty state is terse.** `"No rows to show."` — no context for what Activity is or why it might be empty. File: `Dashboard_Script_Activity.html` (renderer around line 157). **Impact: low.**
- **Bills management list empty state is muted but confident.** `"No active bills yet."` on blank workbook. File: `Dashboard_Script_BillsDue.html` (near line 474). **Impact: low.**

### Partial-State Behavior

When some inputs are filled and others are blank, downstream cards should stay truthful — incomplete inputs should be skipped or labeled, not treated as zeros that imply confidence.

- **Weekly net worth change card behavior on partial workbooks is unverified.** `weekly_attrib_root` may show zeroed deltas (or an empty list) when accounts exist but there's no prior snapshot — check whether the copy distinguishes "no change" from "no baseline yet". File: Overview weekly attribution renderer in `Dashboard_Script_Render.html`. **Impact: medium.**
- **Retirement Conservative / Aggressive scenario cards are blanked silently when only Base is filled.** The retirement fix correctly skips incomplete scenarios, but the hidden scenario cards give no signal to the user that they exist and are inactive — they may think the feature only supports one scenario. File: `Dashboard_Script_PlanningRetirement.html::renderRetirementScenarioCards` (and the blank-card branch in `clearRetirementReadOnlyInfo_`). **Impact: medium.**
- **Asset totals can look confident when only one of bank / investments / houses exists.** Overview asset KPIs sum whatever is present; a partial setup (e.g. investments only) produces a number that looks like a complete net-worth total. File: `dashboard_data.js::buildDashboardSnapshot_` asset rollup + Overview Financial Health card. **Impact: medium.**
- **Bills next-7 total mixes zero bills with "clear" messaging.** When bills sheet exists but has no rows in the next 7 days, we say "No bills due right now." — the same copy as the truly not-set-up case. File: `Dashboard_Script_BillsDue.html::renderBillsDueSummary_`. **Impact: low–medium.**

### "What Should I Do Next" Clarity

Every empty or partial surface should either show a next-step CTA or explain honestly why it's empty.

- **Default landing page for a brand-new user is Overview, which is almost all dashes.** A first-time user sees a wall of `—` with a Setup / Review button in the top bar but no explicit "start here" signal on the canvas itself. Consider a dismissible "Finish setup" banner at the top of Overview when `state === 'notSetUp'`, or auto-route first loads to `onboarding`. File: `Dashboard_Body.html` + `Dashboard_Script_Render.html::applySnapshot`. **Impact: high.**
- **Blank Bills, Upcoming, Debts, Donations tabs lack a "Open Setup / Review" row.** The same pattern we applied to Issues / Suggested Actions would work here: when the list is empty AND `state === 'notSetUp'`, show a single calm CTA pointing to onboarding. Files: `Dashboard_Script_BillsDue.html`, `Dashboard_Script_CashFlowUpcoming.html`, `Dashboard_Script_PlanningDebts.html` / `Dashboard_Script_PlanningDebtPayoff.html`, `Dashboard_Script_Donations.html`. **Impact: high.**
- **Overview Operations Snapshot mini-cards have no "go here to fix" affordance.** When blank, the mini-cards just show zeros — they don't deep-link into Setup / Review or the Bills tab. Make the blank-state whole cards (not just the outer card) navigable and labeled. Files: `Dashboard_Body.html` Overview mini-cards + `Dashboard_Script_BillsDue.html::renderBillsDueSummary_`. **Impact: medium.**
- **Next Actions "nothing to do" states are descriptive but not actionable.** "No urgent actions right now." / "No recommended actions right now." read as all-clear — fine on a populated workbook, misleading on a blank one. File: `Dashboard_Script_PlanningNextActions.html::renderNextActionsBucketHtml_` / `renderNextActionsUrgentBucketHtml_`. **Impact: medium.**

### Copy / Language Consistency

Similar states across cards should use similar wording and tone.

- **Mixed "No X …" phrasing across empty states.** "No active issues detected." vs "No active upcoming expenses." vs "No recurring income detected yet." vs "No donations logged yet." vs "No bills due right now." — "detected" is developer-y, some end with periods and some with phrases, tone drifts between cards. Suggest a single house style, e.g. "Nothing to show yet." Files: all `Dashboard_Script_*.html` empty-state renderers. **Impact: medium.**
- **Jargon leaks into user-facing copy.** "Run the planner to see how long your cash covers burn." (Buffer Runway detail), "snapshot", "execution plan" (Rolling Debt Payoff / Next Actions debug), "Planner run" in hint copy. File: `dashboard_data.js::buildBufferRunway_`, `Dashboard_Script_RollingDebtPayoff.html`, `Dashboard_Script_PlanningNextActions.html`. **Impact: medium.**
- **Status message wording is inconsistent.** Some saves return `"Saved."`, some return server-provided messages, some prepend `"Error: "` for failures while others surface a raw exception string. No single convention. Files: all forms that call `setStatus(...)` after a save. **Impact: low–medium.**
- **Button labels mix verb styles.** "Save House Value" (noun-heavy) vs "Quick add payment" vs "Dismiss" vs "Stop tracking". A one-pass copy review for the primary action buttons on each tab would tighten this. Files: all `Dashboard_Body.html` panels + their associated scripts. **Impact: low.**
- **"Nothing to show" indicators mix "—" and blank.** Retirement info panel uses `—`, some list cells show empty strings, buffer runway now shows `—` plus detail — the system mostly converges on `—`, but a few stragglers (e.g. `—` vs blank in upcoming meta rows) remain. Files: Onboarding empty blocks, Upcoming meta rows, Rolling Debt placeholders. **Impact: low.**

### Save + Refresh Behavior

After a user saves, the relevant Overview cards and side panels must refresh without requiring a full reload.

- **Income save does NOT call `refreshSnapshot()`.** Adding or stopping an income source reloads only the Income section; Overview Financial Health / Operations Snapshot / Suggested Actions / Next Actions can show stale values until the user hard-refreshes. File: `Dashboard_Script_Income.html::saveIncomeSource` (~line 367) and `stopTrackingIncomeSource` (~line 417). **Impact: high.**
- **Donation save does NOT call `refreshSnapshot()`.** Adding a donation only reloads the Donations list. Donations feed into Cash Flow and YTD spending, so Overview and Cash Flow tabs are stale until reload. File: `Dashboard_Script_Donations.html::saveDonation` (~line 199). **Impact: high.**
- **Retirement Basics save does NOT call `refreshSnapshot()`.** The scenario save (`saveRetirementInputs`) correctly calls `refreshSnapshot()`, but the Basics save (`saveRetirementBasicsFromUi_`) only reloads the Retirement section — Overview's Retirement Outlook card can stay in the old state until the user navigates away and back. File: `Dashboard_Script_PlanningRetirement.html::saveRetirementBasicsFromUi_` (~line 220). **Impact: medium–high.**
- **No centralized "I just saved something" helper.** Each form implements its own save → refresh pattern, which is why `refreshSnapshot()` is missing in three places. A tiny helper (e.g. `afterSave_()` that logs status + calls `refreshSnapshot()` if defined) would make future regressions unlikely. Cross-cutting. **Impact: medium (preventive).**
- **Saves show "Saved." but don't always confirm which Overview KPI moved.** Consider a brief "Updated Overview" or snapshot-diff toast after multi-card refreshes. Cross-cutting, nice-to-have. **Impact: low.**

### Edge Cases

Things that shouldn't crash or show a red banner even when data is weird.

- **Year rollover (Jan 1) behavior is not documented.** `fiscalYear`, `taxYear`, recurring income `year`, upcoming `dueDate` across year boundaries — verify nothing assumes "current year" statically. Files: `income.js`, `donations.js`, `cash_flow.js`, `upcoming.js`. **Impact: medium–high (time-bomb).**
- **Missing optional sheets (DONATIONS, UPCOMING, BILLS, HOUSES).** We hardened Accounts / Debts / Retirement; the other optional sheets should be audited the same way. Files: `dashboard_data.js`, individual renderers' server calls. **Impact: medium.**
- **Deleted / stop-tracked accounts with historical rows.** Renderers should tolerate history that references an Active=NO account without crashing or double-counting. Files: `bank.js`, `debts.js`. **Impact: medium.**
- **Zero-income / zero-expense months.** Buffer runway and Next Actions should not divide-by-zero or flip to infinity. File: `dashboard_data.js::buildBufferRunway_`, `next_actions.js`. **Impact: medium.**
- **Duplicate account / debt / bill names.** Income has a duplicate-name guard; verify bank, debts, bills, donations all catch and surface it cleanly. Files: respective `add*FromDashboard` RPCs. **Impact: low–medium.**
- **Long text overflow.** Bill / account / payee names longer than the card width — check CSS ellipsis vs wrap. Files: `Dashboard_Styles.html`. **Impact: low.**
- **Non-USD locale formatting.** `fmtCurrency` hardcodes `$`; a non-USD user sees the wrong symbol. Files: dashboard `fmtCurrency` helper. **Impact: low (assumed US-only for now).**
- **Debug toggle side effects.** `isDebugMode()` gates Next Actions liquidity details; verify that flipping debug OFF mid-session doesn't leave stale details rendered. File: `Dashboard_Script_PlanningNextActions.html` (already has a defensive clear, but worth a regression pass). **Impact: low.**

### Navigation Flow

Default landing tabs and back/close paths should make sense.

- **No "start here" signal for first-time users on Overview.** See "What Should I Do Next" — Overview is the default page for everyone, including users with no data. **Impact: high (duplicated above).**
- **Setup / Review handoff bar close path is untested end-to-end.** When a user is deep in an editor (e.g. editing a bank account) and clicks "Close" or "Back", verify they land on a sensible page, not a stale sub-view. File: `Dashboard_Script_Onboarding.html` handoff logic. **Impact: medium.**
- **Overview card click-throughs aren't uniform.** Some Overview cards are fully clickable (`onclick="showPage(...)"` on the `.card`), some only have inner buttons, some have both (with `event.stopPropagation()` juggling). Inconsistent affordance for the user. File: `Dashboard_Body.html` Overview markup. **Impact: medium.**
- **Retirement Outlook card has no click-through to the Retirement tab.** Other Overview cards link to their source tab; Retirement Outlook currently does not. File: `Dashboard_Body.html` Overview Retirement card + `Dashboard_Script_Render.html::renderRetirementSummary`. **Impact: medium.**
- **Sub-tab deep-links (e.g. `showPage('cashflow'); showTab('billsDue')`) are fine but inline.** Repeated inline string pairs are copy-paste prone. A small `goTo('cashflow', 'billsDue')` helper would tighten this without refactoring. Cross-cutting. **Impact: low.**

### Visual Trust Signals

Consistent use of "—" for unknown values, calm colors for neutral empty states, severity colors reserved for actual urgency.

- **`$0.00` used as a confident total on blank workbooks.** Covered above under Empty-State — this is the cross-cutting visual version of the issue. **Impact: high (duplicated above).**
- **Green "clear" styling on Bills mini-card when nothing is tracked.** Covered above — `bill-card-clear` applied on `notSetUp`. **Impact: high (duplicated above).**
- **"Last updated: —" is fine but could explain why.** Currently displays as an empty timestamp; a tooltip or subtle hint ("Will update after your first save") would build trust on blank workbooks. File: `Dashboard_Body.html` header + `Dashboard_Script_Render.html::renderSourceUpdated`. **Impact: low.**
- **Severity colors currently honored, but audit new empty states.** When we add setup CTAs, make sure `severity-info` (blue/neutral) is used, never `severity-warning` or `severity-critical`. Cross-cutting on future fixes. **Impact: preventive.**
- **Loading placeholders are inconsistent.** Some renderers show "Loading…" via `loadingBlockHtml`, some just leave the previous value in place, some show `…`. Files: all `load*` functions. **Impact: low.**

## Next Priority Issues

Top 3 highest-impact items to address first. Each is small, client-side, and consistent with fixes we've already shipped.

1. **Overview Operations Snapshot shows confident `$0.00` KPIs (and green "clear" styling) on blank workbooks.** Same false-confidence class we already fixed for Issues, Suggested Actions, Retirement Outlook, and Buffer Runway — but the raw KPI tiles on Overview still display `$0.00`, `0`, and a green "clear" Bills mini-card when the workbook is `notSetUp`. Highest impact because the KPI row is the first thing a new user sees and it currently lies. Scope: `Dashboard_Script_BillsDue.html::renderBillsDueSummary_` (and the equivalent for `ov_upcoming_*` and `ov_house_*`) — gate KPI values and card styling on `snapshot.state` or equivalent, render `—` on `notSetUp`, and drop the `bill-card-clear` class until there's real data.

2. **Income / Donation / Retirement Basics saves don't call `refreshSnapshot()` — Overview goes stale after save.** Breaks the "save = immediate feedback" contract. User adds income or donates and nothing changes on Overview until a full reload, which reads as "did my save work?". Three one-line fixes in three files. Scope: add `refreshSnapshot()` to `Dashboard_Script_Income.html::saveIncomeSource` / `stopTrackingIncomeSource`, `Dashboard_Script_Donations.html::saveDonation`, and `Dashboard_Script_PlanningRetirement.html::saveRetirementBasicsFromUi_` — guarded behind `typeof refreshSnapshot === 'function'` like existing callers.

3. **Bills / Upcoming / Debts / Donations tabs show muted "No X …" messages on blank workbooks with no setup CTA.** Same class of issue as the Issues card we just fixed on Overview. Each tab shows developer-y "No active X detected / No X logged yet" text that reads as "audited and clean" instead of "never set up". Scope: in each tab's empty-list renderer, check the existing snapshot `state` (already fetched for the Overview) or a simple local readiness probe and, when `notSetUp`, render a single calm row that deep-links into `showPage('onboarding')` — exactly mirroring the Issues / Suggested Actions pattern in `Dashboard_Script_Render.html`.

## How to Continue

Keep the loop tight and honest:

1. **Re-read this checklist** at the start of every session. Items move up/down in priority as we ship.
2. **Pick ONE issue** — highest-impact first, or a quick win if we need momentum.
3. **Plan the minimal fix** — smallest safe change, client-side when possible, respect `state` / snapshot shape.
4. **Implement** — no large refactors, no architecture changes, no destructive sheet writes.
5. **Test on both** a fully populated workbook (must be byte-for-byte unchanged except for the intended polish) and a blank / partially-set-up workbook (must degrade calmly with clear guidance).
6. **Commit + push** when the user explicitly approves.
7. **Update this file** — move the shipped item into "Current Status", mark any follow-ups discovered during the fix.
8. **Repeat.**

---

## Active — Phase A: planner graceful degradation & readiness states

We are moving from bug fixing to **product behavior + UX refinement**. The planner and dashboards must no longer throw red errors on fresh/blank/partially-set-up workbooks. They must degrade gracefully, use safe defaults, and surface a readiness state so the UI can show "needs more info" instead of error banners.

Goal for the whole pass: graceful degradation, safe defaults, readiness states (`notSetUp` / `partial` / `ready`), and a minimal required onboarding (profile name+email, at least one bank account; everything else optional/progressive).

### Core constraints (apply to every step in Phase A–E)

- **One step at a time.** Each prompt implements exactly one phase step. No skipping ahead.
- **No big refactors.** Prefer small additive helpers; preserve existing architecture.
- **Do not break existing working sheets.** No destructive changes to layout, headers, data, or formatting.
- **No new writes or new sheets** unless the step explicitly calls for it.
- **Preserve existing populated-workbook behavior byte-for-byte** where the sheets are already set up.
- **Every step must be tested on both:**
  1. Fully populated workbook (regression check — behavior must be identical except any intentionally added additive fields/UI states).
  2. Fresh / blank / partially set-up workbook (the target case for graceful degradation).
- **Compatibility:** do not change existing snapshot/RPC field names or shapes; only add new fields.

### Phased plan (A–E)

| Phase | Purpose | Steps |
| --- | --- | --- |
| **A — Graceful degradation of core read paths** | Stop throwing on missing required sheets; surface readiness state instead of red banners. | **A1** Retirement tab safe RPC + calm empty state. **A2** `buildDashboardSnapshot_` tolerates missing `SYS - Accounts` / `INPUT - Debts`, adds `state` field. **A3** `getCashToUse()` tolerates missing `SYS - Accounts`. **A4** Remaining planner read paths (next actions, buffer runway, etc.) audited for the same pattern. |
| **B — Minimal required onboarding + readiness rollup** | Define "ready" as profile name+email plus ≥1 bank account; add a single readiness rollup the UI can consume. | **B1** Add `getPlannerReadiness()` aggregating existing probes (`probeProfileStatus_`, `probeBankAccountsStatus_`) without touching onboarding internals. **B2** Wire readiness into the dashboard header as a neutral indicator. |
| **C — Household identity in `INPUT - Settings` (DOB-based)** | Extend existing `INPUT - Settings` key/value store additively with **identity-only** keys: `YourDOB`, `Partnered`, `SpouseName`, `SpouseDOB`. Ages are derived from DOB at read time — never stored. `TargetRetirementAge` and every other retirement-scenario assumption (retirement spending, social security assumptions, contributions, expected return, inflation, safe withdrawal rate, etc.) stay in the retirement workflow / `INPUT - Retirement` sheet. See "Architecture decision" section below. | **C1** Read helpers for the DOB-based identity keys + age-from-DOB derivation. **C2** Write helpers + small UI form that saves identity only (DOB + partner + spouse name + spouse DOB). **C3** Retirement calc prefers derived `yourCurrentAge` / `spouseCurrentAge` from `INPUT - Settings` DOBs when present; falls back to the retirement sheet's age cells. `TargetRetirementAge` is never touched by Phase C; it remains a retirement-sheet field. |
| **D — Retirement sheet without hardcoded fake values** | Stop seeding fake ages / dates in `INPUT - Retirement`. Blank-until-known; populated cases untouched. | **D1** Blank-safe creator. **D2** Migration path that only activates when `INPUT - Retirement` is clearly unmodified default. |
| **E — UI "needs more info" everywhere** | Replace remaining red error banners with calm inline guidance cards across planner tabs. | **E1** Dashboard overview empty state. **E2** Next Actions empty state. **E3** Cash flow empty state. |

### Architecture decision — `INPUT - Settings` vs retirement workflow

Revised after A2 (supersedes the original A1 forward-looking plan):

- **`INPUT - Settings` is for people / household IDENTITY only.** It holds data about *who* the user and their household are. It is not a dumping ground for retirement assumptions.
- **Ages are never stored.** Any age needed by the planner is DERIVED from date of birth at read time. This keeps the sheet correct year-over-year without manual edits.
- **Additive identity keys** that Phase C will introduce to `INPUT - Settings` (no existing key is touched):
  - `YourDOB` — ISO date string
  - `Partnered` — yes/no
  - `SpouseName` — string
  - `SpouseDOB` — ISO date string (blank when `Partnered=No`)
- **Retirement workflow / `INPUT - Retirement` stays the home for every retirement ASSUMPTION**, including:
  - `TargetRetirementAge`
  - retirement spending
  - social security assumptions
  - contributions
  - expected return
  - inflation
  - safe withdrawal rate
  - any other retirement-scenario assumption
- **What this corrects:** the original A1 forward-looking plan proposed storing `YourAge`, `SpouseAge`, and `TargetRetirementAge` directly in `INPUT - Settings`. That plan is withdrawn. Ages are now DOB-derived; `TargetRetirementAge` stays on the retirement sheet. This separation of concerns keeps the identity store stable across time and keeps all retirement modeling in one place.
- **What still stands from A1:** the safe RPC (`getRetirementUiDataSafe`), the calm empty-state UI, and the read-only, non-destructive posture toward `INPUT - Settings` are all unchanged. Only the forward-looking key list is revised.

### Current implementation status

- ✅ **A1 complete** — `retirement.js` gained `getRetirementUiDataSafe()`, `readRetirementHouseholdSafe_()`, `probeRetirementSettingsHousehold_()`, `parseSettingsNumberOrNull_()`, `normalizePartneredSetting_()`. The new RPC never throws; returns `{ state: 'ready' | 'needsHouseholdBasics' | 'error', message, missingFields, settings, ... }`. The retirement probe reads `INPUT - Settings` read-only via `getSheetByName` — no writes, no creation, tolerates the current Name/Email/Phone/Address schema without requiring any additional keys. A1 shipped with a legacy forward-looking key list (`YourAge` / `Partnered` / `SpouseAge` / `TargetRetirementAge`) baked into the probe's switch + the `settings.household` RPC scaffold. **Under the revised architecture (see section below), that key list is superseded.** Those scaffold fields stay in place as null-only placeholders to keep the A1 RPC contract stable; Phase C will replace them with the DOB-based identity model and remove `TargetRetirementAge` from the settings payload entirely (it belongs in the retirement sheet, not `INPUT - Settings`). `Dashboard_Script_PlanningRetirement.html` switched to the safe RPC with new `showRetirementEmptyState_`, `hideRetirementEmptyState_`, `clearRetirementReadOnlyInfo_` helpers. `Dashboard_Body.html` added `<div id="ret_empty_state">`. `Dashboard_Styles.html` added `.retirement-empty-state` calm blue info card (distinct from error styling). Existing `getRetirementUiData()` left untouched for compatibility.
- ✅ **A2 complete** — `dashboard_data.js` only. `buildDashboardSnapshot_()` now wraps `getSheet_(ss, 'ACCOUNTS')` and `getSheet_(ss, 'DEBTS')` each in its own `try/catch` → `accountsPresent` / `debtsPresent` booleans. Missing sheets fall back to `cash = 0` / `totalDebt = 0`. New additive field `state: 'ready' | 'partial' | 'notSetUp'` on the returned object (ready = both present, partial = one present, notSetUp = neither). `buildDashboardIssues_()` — called from the same pipeline — guards its `getSheet_(ss, 'ACCOUNTS')` and `getSheet_(ss, 'DEBTS')` calls the same way so the snapshot actually completes. No field renames, removals, or reshape. No UI changes. No new sheets, no writes. Populated-workbook behavior is identical except for the new `state: "ready"` field existing consumers can ignore.

### Next exact step — **A3 only**

**Make `getCashToUse()` tolerate a missing `SYS - Accounts` sheet without throwing.**

- File: `cash_to_use.js`.
- Symptom: `getCashToUse()` currently calls `getSheet_(ss, 'ACCOUNTS')` directly (~line 78) which throws `Missing sheet (after retry+flush): SYS - Accounts` on a blank workbook, red-banners the Next Actions panel.
- Expected shape after A3: same return shape, with a `state` field (`notSetUp` / `partial` / `ready` — same vocabulary as A2) and zeroed numerics when the sheet is absent. Other field names and existing values when the sheet exists must be identical to today.
- Sheet-safety rule: no sheet creation, no writes, no sheet layout changes, no modifications to `INPUT - Settings`, no onboarding changes. Read/logic only.
- Scope: **only `cash_to_use.js`** (mirror the A2 pattern: narrow try/catch around the `getSheet_` call, derive state locally, return zero-valued numerics on absence). No UI changes unless absolutely required.

### Testing expectations — apply to EVERY step in Phase A

For each step, run both scenarios:

**1. Fully populated workbook (regression):**
- Open the planner dashboard on a real populated spreadsheet.
- Verify the step's affected panel renders *identical* numbers and visuals as before.
- Verify no new red banners, no new empty states, no layout shift.
- Verify all pre-existing RPC fields are unchanged in name, order, and value. Any new field is purely additive.
- Verify no existing sheet was modified, created, renamed, or reformatted.
- Verify downstream consumers (planner run, history snapshot save, baseline snapshot save, etc.) still succeed.

**2. Fresh / blank / partially set-up workbook (target case):**
- Open a blank workbook bound to the same Apps Script project, or simulate "partial" by temporarily renaming a single required sheet (revert afterwards — never delete data).
- Verify the step's affected panel renders a calm state (empty/guidance card or zeroed values) with **no red banner** and **no "Missing sheet (after retry+flush): …"** exception in the Apps Script logs.
- Verify the new `state` field (or equivalent) matches reality: `notSetUp` when all required sheets absent, `partial` when some exist, `ready` when all exist.
- Verify no new sheets were created by the failing call.
- Verify the action panel is still usable — it just shows guidance instead of erroring.

**3. No regressions to existing populated flows:**
- Add an Investment / House / Debt / Bill / Bank Account / Upcoming Expense on a populated workbook. All flows work unchanged.
- Run the planner. Snapshot saves, history writes, baselines write.
- Retirement tab on a populated retirement workbook renders exactly as before A1.

### Resume point

**Next prompt target: Phase A3 only.** Make `getCashToUse()` tolerate a missing `SYS - Accounts` sheet without throwing; add additive `state` field using the same `notSetUp` / `partial` / `ready` vocabulary as A2. Only `cash_to_use.js`. No sheet writes. No UI changes. Test on both populated and blank workbooks.

Do **not** start A4, B, C, D, or E until A3 is implemented, tested, and committed.

---

## Recent — Targeted sheet-creation & consistency pass (F1, F2, F3, F4/F5, F6, F7)

Implemented the high-value safe fixes from the prior new-sheet audit. Deliberately scoped: no schema changes, no broad refactor, no rebuild of existing sheets, no next-year rollover (F8), no sheet-name centralization (F9), no creator-return-shape standardization (F10). Every new helper is idempotent and a no-op on populated workbooks.

### F1 — `LOG - Activity` dedupe read-range arity fix

`activityLogDedupeKeyExists_` (`activity_log.js`) previously called:

```
sh.getRange(2, ACTIVITY_LOG_DEDUPE_COL, lastRow, ACTIVITY_LOG_DEDUPE_COL).getValues()
```

That passed `ACTIVITY_LOG_DEDUPE_COL` (11) as `numColumns`, reading a `lastRow × 11` block starting at column K. It only worked today because the loop read `values[i][0]`. The moment `sh.getMaxColumns()` dropped below K + 11 − 1 it would throw. Fixed to:

```
sh.getRange(2, ACTIVITY_LOG_DEDUPE_COL, lastRow - 1, 1).getValues()
```

Correct row count (excludes header) and exactly 1 column. Same behavior, no latent breakage.

### F2 — Canonical from-scratch creators for `INPUT - Investments` and `INPUT - House Values`

Two new idempotent helpers so a blank workbook can accept the very first "Add Investment" / "Add House" write without "Missing sheet" errors:

- `ensureInputInvestmentsSheet_()` in `investments.js`. Seeds row 1 `Year | <currentYear>`, row 2 `Account Name | Type | Jan-YY … Dec-YY | Active` (cols 1..15, matches `firstMonthCol = 3` + `ensureInvestmentsActiveColumnForBlock_(firstMonthCol + 12)`). Applies `applyInvestmentsSheetStyling_`, `setFrozenRows(2)`, `autoResizeColumns`.
- `ensureInputHouseValuesSheet_()` in `house_values.js`. Same layout but `House | Loan Amount Left | Jan-YY … Dec-YY | Active` (cols 1..15). Applies `applyHouseValuesSheetStyling_`, freeze, auto-resize.

Both helpers intentionally do NOT seed aggregate rows (`Account Totals`, `Delta`, `Total Values`, `House Assets`). `refreshBlockSumAggregates_` only rewrites existing SUM formulas — it never creates them — so seeding empty aggregate labels would either be a no-op (no formulas) or produce `#REF!` (formulas pointing at zero data rows). Both block readers (`getInvestmentsYearBlock_`, `getHouseValuesYearBlock_`) gracefully fall back to `sheet.getLastRow()` when aggregate markers are absent; users who later want the block totals can add them manually and the existing refresh machinery will maintain them.

Wired in at the very top of `addInvestmentAccountFromDashboard` and `addHouseFromDashboard`, before any `getSheet_('INVESTMENTS' | 'HOUSE_VALUES' | 'ASSETS' | 'HOUSE_ASSETS')` call. Each ensure call is wrapped in a user-actionable error ("Could not prepare INPUT - Investments: …") and followed by `SpreadsheetApp.flush()` so the stale-handle retry in `getSheet_` sees the fresh state.

### F3 — Canonical from-scratch creators for `SYS - Assets` and `SYS - House Assets`

Flat-table companions to F2:

- `ensureSysAssetsSheet_()` in `investments.js`. Headers `Account Name | Type | Current Balance | Active`. Pre-formats Current Balance currency bounded to `sheet.getMaxRows() - 1` data rows, then `applyAssetsSheetStyling_` + `autoResizeColumns`.
- `ensureSysHouseAssetsSheet_()` in `house_values.js`. Headers `House | Type | Loan Amount Left | Current Value | Active`. Pre-formats both currency columns bounded to data rows, then `applyHouseAssetsSheetStyling_` + `autoResizeColumns`.

Also wired into `addInvestmentAccountFromDashboard` and `addHouseFromDashboard` alongside the F2 calls. Roll-back semantics in `addHouseFromDashboard` (delete HV row on HA failure) are unchanged.

### F4 / F5 — `LOG - Activity` first-creation polish

`getOrCreateActivityLogSheet_` (`activity_log.js`) now, only on the `insertSheet` branch:

1. Bolds the header row (`ACTIVITY_LOG_HEADERS.length` cells, row 1).
2. Auto-resizes all header columns once.

Both wrapped in `try/catch` — purely cosmetic, never fails logging. The existing-sheet branch is untouched, so populated LOG sheets keep their current formatting exactly as-is.

### F6 — Bounded `Upcoming Expenses` date/currency format ranges

`getOrCreateUpcomingExpensesSheet_` (`upcoming_expenses.js`) replaced whole-column `F:F` / `G:G` `setNumberFormat` with bounded ranges:

```
sheet.getRange(2, 6, maxRowsUpcoming - 1, 1).setNumberFormat('yyyy-mm-dd')
sheet.getRange(2, 7, maxRowsUpcoming - 1, 1).setNumberFormat('$#,##0.00;-$#,##0.00')
```

Same visible behavior (columns F and G still format identically across all existing rows) but now consistent with every other sheet creator in the codebase (`INPUT - Bank Accounts`, `SYS - Assets`, `SYS - House Assets`, cash flow blocks) which all avoid whole-column formatting.

### F7 — Ensure-before-write guards for Debts and Bills

Mirrored the Bank Accounts pattern from `addBankAccountFromDashboard`:

- `addDebtFromDashboard` (`debts.js`) — calls `ensureOnboardingDebtsSheetFromDashboard('normal')` (existing idempotent helper in `onboarding.js`, seeds the canonical INPUT - Debts header) + `SpreadsheetApp.flush()` before the first `getSheet_(ss, 'DEBTS')`.
- `addBillFromDashboard` (`bills.js`) — same, with `ensureOnboardingBillsSheetFromDashboard('normal')` before `getSheet_(ss, 'BILLS')`.

Both ensure calls wrapped in a user-actionable "Could not prepare INPUT - …" error. No new sheet-building code in either module — just a call to the existing idempotent ensure helper.

### Existing-user safety

Every path is a check-then-create-if-missing:
- F1 — behavioral parity; strictly a read-shape fix.
- F2 / F3 / F7 — `ss.getSheetByName(…)` short-circuits the entire creator when the sheet already exists. No styling, no header rewrite, no data touch on populated workbooks.
- F4 / F5 — wrapped inside the `insertSheet` branch of `getOrCreateActivityLogSheet_`. Populated LOG sheets skip that branch entirely.
- F6 — narrowly a `setNumberFormat` scope change on an already-formatted column; visible cells render identically.

No schema changes. No broad refactor. No touch to cash flow / bank accounts / onboarding / sheet_bootstrap.

### Files changed

`activity_log.js`, `upcoming_expenses.js`, `investments.js`, `house_values.js`, `debts.js`, `bills.js`, `SESSION_NOTES.md`.

### What to test

1. **Fresh workbook investment add** — brand-new spreadsheet, no `INPUT - Investments` or `SYS - Assets`, run Add Investment from dashboard. Both sheets appear with canonical headers + styling; the new account lands correctly.
2. **Fresh workbook house add** — same scenario with `INPUT - House Values` / `SYS - House Assets`. Confirm roll-back still works (force a synthetic HA failure; HV row must be deleted).
3. **Debt write guard** — fresh workbook, Add Debt from dashboard. `INPUT - Debts` is created with the canonical header and the new row lands.
4. **Bill write guard** — same for `INPUT - Bills`.
5. **Activity log creation** — delete `LOG - Activity`, trigger any logged action. New sheet appears with bold, auto-sized headers. Repeat on a populated workbook: existing LOG formatting is NOT touched.
6. **Upcoming formatting sanity** — open `INPUT - Upcoming Expenses`. Columns F (date) and G (amount) still format as before across all existing rows; type a new date / amount below the last row — still formats correctly.
7. **Existing populated workbook regression** — open a real user workbook. Confirm Add Investment / House / Debt / Bill flows still produce identical rows and formatting as before this pass.

---

## Recent — Aggregate-row SUM formulas: refresh on every add-row

User asked to verify the total / sum rows were correct across the sheets we've been restyling. Audit surfaced a real correctness bug on the year-block aggregates.

### The bug

`INPUT - House Values` and `INPUT - Investments` year blocks use user-maintained aggregate rows (`Total Values`, `Account Totals`). These sheets have no programmatic formula writers — the user owns the formulas.

When a new house / investment is added, `insertNewHouseHistoryRow_` and `insertNewInvestmentHistoryRow_` call `sheet.insertRowAfter(lastDataRow)` to place the new row immediately above the block's aggregate rows. Google Sheets' range-expansion rule is unambiguous here: inserting a row **strictly inside** a referenced range expands the range; inserting **at or past** the range's lower boundary is a no-op.

So a user SUM like `=SUM(C4:C8)` with Total Values at row 9, after `insertRowAfter(8)`:
- new row lands at row 9
- Total Values moves to row 10
- formula stays `=SUM(C4:C8)` — the new row is silently missing from the total

Cash Flow's `Summary | Cash Flow Per Month` was already immune (programmatic `writeCashFlowSummaryFormulas_` rewrites bounded ranges after every row insert), but House Values and Investments were exposed.

### The fix

New conservative helper `refreshBlockSumAggregates_(sheet, dataStartRow, dataEndRow, afterRow, targetLabels)` in `cashflow_setup.js` (co-located with `columnToLetter_`, its one dependency, and the other Cash Flow bounded-range work).

For each row in `[afterRow .. lastRow]` whose column A matches one of `targetLabels`, inspects each data-column cell and only rewrites cells whose formula matches EXACTLY `=SUM(<L><N>:<L><M>)` where both endpoints are on the same column letter AND that letter equals the cell's own column. Rewrites the endpoints to `dataStartRow:dataEndRow`. Stops the scan at the next `Year` marker so a different year's aggregate row is never touched.

Deliberately leaves alone:
- Compound formulas (`=SUM(C4:C8)+100`, `=SUM(C4:C8)-SUM(D4:D8)`, etc.)
- Cross-sheet refs, named ranges, structured refs
- Non-SUM aggregates (AVERAGE, SUMIF, IF, etc.)
- `Delta` rows in Investments (YoY / period diffs, not block sums — callers don't pass 'Delta' in `targetLabels` anyway, but the strict regex would skip them regardless)
- `House Assets` row in House Values (per-row snapshot, not a sum of data rows)
- Blank cells, literal numbers, text

All failures are swallowed — defense in depth only; never fails an add-row write.

### Wire-up

- `insertNewHouseHistoryRow_` → calls `refreshBlockSumAggregates_` with `targetLabels = ['Total Values']` right after the Active=Yes write, computing the new block's data range from the pre-insertion block + the inserted row.
- `insertNewInvestmentHistoryRow_` → same, with `targetLabels = ['Account Totals']`.
- `writeCashFlowSummaryFormulas_` (Cash Flow) — unchanged; already programmatic with bounded ranges, already refreshed on every `insertCashFlowRow_`.

### Coverage matrix

| Sheet | Aggregate row(s) | Formula source | Auto-refresh on add |
| --- | --- | --- | --- |
| `INPUT - Cash Flow YYYY` | Summary / Cash Flow Per Month | Programmatic | ✅ `writeCashFlowSummaryFormulas_` |
| `INPUT - House Values` | Total Values (pink) | User-maintained | ✅ `refreshBlockSumAggregates_(['Total Values'])` |
| `INPUT - House Values` | House Assets (green) | User-maintained per-row snapshot | Untouched by design |
| `INPUT - Investments` | Account Totals (green) | User-maintained | ✅ `refreshBlockSumAggregates_(['Account Totals'])` |
| `INPUT - Investments` | Delta (pink) | User-maintained YoY diff | Untouched by design |
| `SYS - Assets` | — | n/a | n/a |
| `SYS - House Assets` | — | n/a | n/a |

Files changed: `cashflow_setup.js`, `house_values.js`, `investments.js`, `SESSION_NOTES.md`.

What to test:
1. On a sheet with existing `Total Values = SUM(C{start}:C{last})` per month, add a new house from the dashboard — confirm the Total Values row's formulas now reference `C{start}:C{newLast}` and the new house's contribution shows up.
2. Same test on Investments Account Totals.
3. Delta row on Investments is unchanged (its YoY formula should still reference the right cells because it was never a block sum).
4. Cash Flow Summary still computes correctly after adding an income or expense.

## Recent — SYS - House Assets canonical header styling

User pasted the live `SYS - House Assets` layout. Flat 5-column table (no year blocks, no footer rows):

- Row 1: `House | Type | Loan Amount Left | Current Value | Active` — yellow `#fff200`, bold black, centered, row height 32, solid-medium black bottom border
- Rows 2…: one house per row. Append-only via `appendHouseAssetsRowForNewHouse_` — each new row inherits formatting from a neighbor template via `PASTE_FORMAT` so data-row treatment (currency formats, user's red-text conditional formatting on Loan Amount Left, Active cell styling) stays consistent without extra intervention.

New helper `applyHouseAssetsSheetStyling_(sheet)` in `house_values.js`:

- Asserts the header-row fill / bold / alignment / row height, plus a bottom border.
- Freezes row 1 + column 1 so House stays pinned when scrolling.
- Data rows and user conditional formatting deliberately never touched.
- All writes wrapped in try/catch — cosmetic only, never blocks a House Assets write.

Hooked into `appendHouseAssetsRowForNewHouse_` after the row append + Active=Yes write, so every Add-house flow re-asserts header styling. Idempotent — repeated adds don't flicker.

Files changed: `house_values.js`, `SESSION_NOTES.md`.

What to test: Add a new house — confirm `SYS - House Assets` row 1 shows bold yellow header with bottom separator, column 1 stays pinned when scrolling, and existing rows keep their currency formatting, red-text conditional formatting on Loan Amount Left, and Active text styling unchanged.

## Recent — SYS - Assets canonical header styling

User pasted the live `SYS - Assets` layout. Flat 4-column table (no year blocks, no footer rows):

- Row 1: `Account Name | Type | Current Balance | Active` — yellow `#fff200`, bold black, centered, row height 32, solid-medium black bottom border
- Rows 2…: one investment account per row. Append-only via `appendAssetsRowForNewInvestment_` — each new row inherits formatting from a neighbor template via `PASTE_FORMAT` so data-row treatment stays consistent without extra intervention.

New helper `applyAssetsSheetStyling_(sheet)` in `investments.js`:

- Asserts the header-row fill / bold / alignment / row height, plus a bottom border.
- Freezes row 1 + column 1 so Account Name stays pinned when scrolling horizontally.
- Data rows, number formats, and any user conditional formatting are deliberately never touched.
- All writes wrapped in try/catch — cosmetic only, never blocks an Assets write.

Hooked into `appendAssetsRowForNewInvestment_` after the row append + Active=Yes write, so every Add-investment flow re-asserts header styling. Idempotent — repeated adds don't flicker.

Files changed: `investments.js`, `SESSION_NOTES.md`.

What to test: Add a new investment account — confirm `SYS - Assets` row 1 shows bold yellow header with bottom separator, column 1 stays pinned when scrolling, and existing rows keep their currency formatting and Active text styling unchanged.

## Recent — INPUT - Investments canonical block styling

User pasted the live `INPUT - Investments` layout. Structure mirrors `INPUT - House Values` (year blocks repeating vertically) but with investments-specific banner labels:

- `Year | | <year>` — orange `#f4a300`, bold black, row height 28
- `Account Name | Type | Jan-YY … Dec-YY` — yellow `#fff200`, bold black, centered horizontal / middle vertical, row height 32
- Data rows: one account per row (col A = account name, col B = type, C..N = monthly balances). Month cells carry the user's gain-green / loss-red conditional formatting.
- `Account Totals | | …` — green `#b6d7a8`, bold black (per-column sum)
- `Delta | | …` — pink `#f4cccc`, bold black (month-over-month change)

New helper `applyInvestmentsSheetStyling_(sheet)` in `investments.js`:

- Walks column A once via `getDisplayValues()` and dispatches on the four marker strings above, asserting fill / bold / alignment / row height per row.
- Disambiguates the column-header row ("Account Name" only gets yellow-bannered when col B reads "Type") so a stray data row whose name happens to be literally "Account Name" won't be mis-styled.
- Freezes columns A + B so account names and types stay pinned when scrolling horizontally across the 12 month columns.
- Every `setBackground` / `setFontWeight` / `setRowHeight` wrapped in try/catch; cosmetic only, never fails an Investments write.

Hooked into `insertNewInvestmentHistoryRow_` after the row insert + Active=Yes write, so every Add-investment-account flow re-asserts block styling across every year block in one pass. Idempotent — repeated adds don't flicker or accumulate cost.

Data rows and their conditional formatting (gain/loss colors, any custom cell highlights) are deliberately never touched.

Files changed: `investments.js`, `SESSION_NOTES.md`.

What to test: Add a new investment account via the dashboard — confirm the new row inherits the data-row format from the neighbor template (unchanged behavior) AND the Year / Account Name / Account Totals / Delta banners across every year block stay the canonical colors. On a workbook with multiple year blocks, the helper updates all of them in one pass.

## Recent — INPUT - House Values canonical block styling

User pasted the live `INPUT - House Values` layout and asked the formatting to stay consistent across every year block. The sheet is user-maintained (no programmatic creator in the codebase — only `insertNewHouseHistoryRow_` appends data rows into existing blocks), so the goal is to *assert* the canonical banner-row look on every mutation rather than invent a schema.

Each year block has four structural banner rows around the month-data grid:

- `Year | <year>` — orange `#f4a300`, bold black, row height 28
- `House | Loan Amount Left | Jan-YY … Dec-YY` — yellow `#fff200`, bold black, centered horizontal / middle vertical, row height 32
- `Total Values | …` — pink `#f4cccc`, bold black (sums of each column including Loan Amount Left)
- `House Assets | (blank) | …` — green `#b6d7a8`, bold black (Total Values – Loan Amount Left per month, col B intentionally blank)

Data rows keep their user-applied conditional formatting (e.g. red text on Loan Amount Left) — the helper deliberately does not touch them.

New helper `applyHouseValuesSheetStyling_(sheet)` in `house_values.js`:

- Scans column A top-to-bottom once via `getDisplayValues()`.
- Dispatches on the four marker strings above and asserts the canonical fill / bold / alignment / row height.
- Disambiguates the column-header row ("House" with col B reading "Loan Amount Left") from a data row whose first cell just happens to be the word "House" — only the real header row gets styled.
- Freezes column 1 so house names stay pinned when scrolling horizontally.
- Every `setBackground` / `setFontWeight` / `setRowHeight` is wrapped in try/catch. Cosmetic only — a styling glitch must never fail an Add-house write.

Hooked into `insertNewHouseHistoryRow_` after the row insert + Active=Yes write, so every Add-house flow re-asserts block styling. Idempotent — re-applying identical fills on existing cells is a visual no-op, so repeated adds don't flicker or accumulate cost.

Files changed: `house_values.js`, `SESSION_NOTES.md`.

What to test: Add a new house via the dashboard — confirm the new row inherits the data-row format from the neighbor template (unchanged behavior) AND the Year / House / Total Values / House Assets banners across every year block stay the canonical colors. On a workbook with multiple year blocks, the helper updates all of them in one pass. On a workbook with manually-tweaked banner colors, the helper re-asserts the canonical palette the next time any house is added.

## Recent — Cash Flow sheet styling (warm-yellow header + light-gray Summary)

User pasted a reference Cash Flow sheet (yellow bold header, clean column widths, crisp Summary row) and asked the planner's `INPUT - Cash Flow YYYY` sheets to match. Previous styling was limited to `setFontWeight('bold')` on row 1 plus `autoResizeColumns`, which left the header indistinguishable from the data body at a glance.

Two new idempotent helpers in `cashflow_setup.js`:

1. `applyCashFlowSheetStyling_(sheet, layout)` — header row gets `#fff2cc` (Google Sheets yellow-3) fill, bold black text, centered horizontal alignment, vertical middle, row height 32, a solid-medium black bottom border, and frozen at row 1. Per-column widths are set from the detected layout: Type 110, Flow Source 130, Payee 220, Active 80, each month column 90, Total 110. Layout-driven so workbooks missing optional columns (legacy sheets without Flow Source or Active) don't write widths to column -1.

2. `applyCashFlowSummaryRowStyling_(sheet, summaryRow, layout)` — Summary row gets `#f3f3f3` (light-gray) fill, bold black text, a solid-medium black top border (visual separator from the Expense block above), and row height 28. Called both when Summary is freshly seeded and when `findCashFlowSummaryRow_` returns an existing row, so legacy sheets upgrade transparently the next time any Quick Add / debt seed / bill seed path runs.

Entry points that apply the styling, in order of call:

- `ensureCashFlowYearSheet_` (fresh sheet creation) — calls `applyCashFlowSheetStyling_` before the Summary-row seed so the first render of a brand-new year tab already matches the reference layout.
- `ensureCashFlowSummaryRow_` (idempotent Summary seed) — calls `applyCashFlowSheetStyling_` up-front on every invocation, and `applyCashFlowSummaryRowStyling_` against either the freshly-created Summary row OR an existing one. This is the path Quick Add / debt seed / bill seed all funnel through, so any legacy sheet touched by those flows gets upgraded automatically.
- `createNextYearCashFlowSheet` (year rollover) — layered on top of the existing `PASTE_FORMAT` copy so a new year tab cloned from a legacy unstyled source still reads like the reference layout.

All styling calls are wrapped in try/catch and log a diagnostic on failure. The core contract — row writes, formula writes, Summary-row seeding — is never blocked by a styling glitch. Setting the same background / bold / width on the same range repeatedly is a visual no-op, so calling `applyCashFlowSheetStyling_` on every Quick Add doesn't accumulate cost or flicker.

Files changed: `cashflow_setup.js`, `SESSION_NOTES.md`.

What to test on a fresh workbook: Create a new debt / bill / income entry to seed `INPUT - Cash Flow <year>`. Confirm row 1 is warm yellow, bold, taller than data rows, with a solid bottom line. Confirm the Summary row near the bottom is light gray, bold, with a solid top line separating it from the Expense block. Column widths should accommodate Type / Flow Source / Payee / Active labels without truncation and each month column should be the same width. On an existing workbook: any add-row interaction picks up the new styling the next time `ensureCashFlowSummaryRow_` runs (i.e. the next Quick Add / debt seed / bill seed). For year rollover: run **Create Next Year Cash Flow** — the new year tab gets the canonical header / Summary styling even if the source year was a pre-styling legacy sheet.

## Recent — Summary row math + dashboard tolerant of missing optional SYS sheets

Two follow-ups after the previous polish pass that both reproduced on a fresh workbook once required Setup finished.

1. **Cash Flow Summary row stayed at $0.00 even when Income / Expense rows had values.** First seen with one Income row (`TEST PAY`, Apr-26 = $200.00) above an Expense block: the Summary row's month cells all read `$0.00`. Root cause was the open-ended SUMIF pattern introduced in the prior pass — `=SUMIF($A$2:$A,"Income",E$2:E)+SUMIF($A$2:$A,"Expense",E$2:E)` — which in practice did not re-evaluate to include rows inserted above Summary after formula write-time. Two-argument open-ended ranges passed through `setFormula` appear to be frozen to the row count at write-time on some Apps Script runtimes; the `$A$2:$A` is accepted but the effective evaluation stops at whatever `getLastRow()` was on the first write. Fix:
   - `cashflow_setup.js → writeCashFlowSummaryFormulas_` switched back to BOUNDED ranges `$A$2:$A$<summaryRow-1>` / `$<monthCol>$2:$<monthCol>$<summaryRow-1>`. The bound always covers every data row strictly above Summary (header at row 1, optional blank separator, then Income block + Expense block). Degenerate case (Summary at row 2, empty sheet) falls back to a single-cell range that evaluates to 0.
   - `quick_add_payment.js → insertCashFlowRow_` now re-runs `writeCashFlowSummaryFormulas_` (wrapped in try/catch, best-effort) at the end of every row insert. Needed because `insertRowAfter(insertAfterRow)` shifts the Summary row DOWN by 1 but leaves the formula's upper bound at the pre-insert last-data-row — without the rewrite, the freshly-inserted row would sit outside the bounded range until the next sheet-level operation.
   - `ensureCashFlowSummaryRow_` is unchanged semantically (it still writes formulas via `writeCashFlowSummaryFormulas_` on first seed), and picks up the bounded-range behavior transparently.

2. **Red "Missing sheet (after retry+flush): SYS - Assets" banner on the Overview after Setup.** The user completed the five required Setup steps (Bank, Debts, Bills, Income, Profile), returned to the dashboard, and saw a red error strip above the KPI cards listing every sheet currently in the workbook MINUS the ones the snapshot unconditionally read. Root cause was `dashboard_data.js → buildDashboardSnapshot_` calling `sumColumnByHeader_(getSheet_(ss, 'ASSETS'), 'Current Balance')` / `getSheet_(ss, 'HOUSE_ASSETS')` directly. Those two SYS sheets are populated by the OPTIONAL Houses / Investments panels and are legitimately absent for users who only ran required Setup. The strict `getSheet_` helper threw `Missing sheet (after retry+flush): SYS - Assets` which the UI surfaces verbatim.
   - New helper `sumColumnByHeaderForOptionalSheet_(ss, sheetKey, headerName)` does a name lookup via `ss.getSheetByName(getSheetNames_()[sheetKey])`. Missing sheet → return 0. Sheet present but empty / missing header → return 0 (wraps the strict helper in try/catch). Required-setup sheets (`ACCOUNTS`, `DEBTS`) continue to use the strict `getSheet_` + `sumColumnByHeader_` path — a missing sheet there is a genuine workbook-corruption signal and MUST surface.
   - `buildDashboardSnapshot_` now routes `investments`, `houseValues`, and `houseLoans` through the optional helper. Everything downstream (deltas, attribution, issues) was already tolerant of the prior-month readers returning `null` via their own try/catch wrappers, so no other changes were needed.

Files changed: `cashflow_setup.js`, `quick_add_payment.js`, `dashboard_data.js`, `SESSION_NOTES.md`.

What to test on a fresh workbook: (a) After adding one Income row with a non-zero month amount, confirm the Summary row's corresponding month cell shows that amount (not $0.00) and the Total column shows the yearly sum. Add an Expense row in a different month — Summary for that month should show `Expense - 0` (negative or positive depending on your sign convention); Total sums across months. Adding more rows above Summary keeps the totals in sync without a manual refresh. (b) After completing only the five required Setup steps and skipping Houses / Investments, click **Back to Dashboard** — the Overview should render with $0 for Total Investments and Real Estate Value, no red banner. Health / Retirement / Buffer Runway cards render their standard empty states. Populated workbooks with real SYS - Assets / SYS - House Assets rows continue to render the real totals (the optional helper delegates to the strict sum when the sheet exists).

## Recent — Polish pass: dropdown dedup, debt cash-flow seed, Cash Flow Summary row

Five small fixes grouped into one pass after the first-run bank save landed. All five reproduced on a fresh workbook and were flagged together.

1. **Debt type dropdown shows two "Other" rows.** `Dashboard_Script_PlanningDebts.html → populateDebtAddDatalists_` now filters `other` / `other…` / `__other__` (case-insensitive) out of the server list + fallback array before the terminal sentinel is appended. Previously the static fallback (`['Credit Card', 'Loan', 'HELOC', 'Other']`) plus the always-appended `Other…` sentinel produced two adjacent Other rows. Users can still pick the sentinel and type any label (including literally "Other") in the custom-text input.

2. **Bill category dropdown shows two "Other" rows.** Same pattern, same fix: `Dashboard_Script_BillsDue.html → populateBillCategoryOptions_` now dedupes server + fallback category labels via a `seenCategories` map that also filters the Other/Other…/__other__ sentinels before appending the terminal sentinel. No behavior change for non-Other categories; the dedup map preserves first-seen casing on the rare chance a server-side category list has internal duplicates.

3. **Adding a Debt did not seed an expense row on INPUT - Cash Flow YYYY.** `bills.js` had a belt-and-suspenders `ensureCashFlowYearSheet_(currentYear)` call right before `tryGetCashFlowSheet_` so first-run bills self-heal; `debts.js` was missing it. On a fresh workbook where `INPUT - Cash Flow 2026` did not exist at the moment of the debt save, `tryGetCashFlowSheet_` returned null and the seed was silently skipped with a warning. `addDebtFromDashboard` now runs the same ensure call first, mirroring the bills pattern exactly, so the Cash Flow tab is created on demand and the expense row is written in the same save. Populated workbooks are untouched (`ensureCashFlowYearSheet_` is a hard no-op when the sheet exists).

4. **Cash Flow sheet had no Summary / "Cash Flow Per Month" totals row.** The user pasted a reference layout that wanted Income on top, Expenses below, and a trailing `Summary | Cash Flow Per Month | <per-month totals> | <yearly total>` row. `ensureCashFlowYearSheet_` now calls a new `ensureCashFlowSummaryRow_(sheet)` helper (added to `cashflow_setup.js` next to the existing summary helpers) after setting up the header row and currency formats. The helper is idempotent — returns the existing Summary row if present, otherwise appends a blank separator row + a Summary row with formulas two rows below the last data row. The Summary formulas switched from fixed ranges `$A$2:$A$<summaryRow-1>` to open-ended `$A$2:$A` / `<col>$2:<col>` so inserts above the Summary row auto-flow into the totals without needing to rewrite the formula (the SUMIF criteria `"Income"` + `"Expense"` naturally exclude the Summary row's own `Type="Summary"` even though the range now covers it).

5. **New rows did not keep Income-on-top / Expense-above-Summary ordering.** `insertCashFlowRow_` (in `quick_add_payment.js`) used to fall through to `sheet.getLastRow()` whenever no row of the same type existed yet, which meant the very first Income row on a sheet that already had Expenses would land AT THE BOTTOM (after the Expense block) and interleave the two types. New placement rules:
   - Same-type rows exist → stack immediately after the last one (unchanged).
   - Income with no existing Income rows → insert right after the header row (row 1) so Income always precedes any Expense / Summary block.
   - Anything else (Expense) → insert just above the Summary row, or append to the end on legacy sheets without a Summary row.
   `insertCashFlowRow_` also calls `ensureCashFlowSummaryRow_` up-front so legacy sheets built before the Summary-row rollout self-heal on the next insert. The row-format copy step is skipped when the reference row is row 1 (the bold, frozen header) to keep data rows from inheriting header bold; font weight is explicitly reset to `normal` on the new row in that branch as belt-and-suspenders against Google Sheets' row-format inheritance.

Files changed: `Dashboard_Script_PlanningDebts.html`, `Dashboard_Script_BillsDue.html`, `debts.js`, `cashflow_setup.js`, `quick_add_payment.js`, `SESSION_NOTES.md`.

What to test on a fresh workbook: Add a Debt → confirm no duplicate "Other" in Type dropdown, confirm `INPUT - Cash Flow <year>` gets a new `Expense | <flow source> | <name> | YES` row AND a trailing Summary row with per-month + yearly total formulas. Add a Bill → confirm no duplicate "Other" in Category dropdown, confirm the bill lands as a second Expense row stacked right after the debt Expense row, still above Summary. Add Income (via Income Sources or Quick Add) → confirm it lands at the top (right below the header row), separated from the Expense block below. Scroll to the Summary row and confirm each month cell shows the running net (Income − Expense) and the Total column shows the yearly sum. Populated workbooks: no layout changes, existing Income/Expense ordering is preserved; the Summary row is appended at the bottom only if the sheet didn't already have one.

## Recent — Stale-handle retry baked into getSheet_() itself

Belt-and-suspenders hardening layered on top of the downstream save-path fix. Even with `syncAllAccountsFromLatestCurrentYear_()` and `updateAccountsSheetFields_()` routed through `ensureSysAccountsSheet_()`, a brand-new workbook could still throw `Missing sheet: SYS - Accounts` if the deployment was pinned to a pre-fix version. To make the issue impossible to re-introduce at any call site past *or* future, `getSheet_()` in `config.js` now retries once after a flush:

1. First lookup via the passed-in `ss.getSheetByName(name)`. If found, return (zero behavior change for populated workbooks — this is the fast path).
2. If missing, call `SpreadsheetApp.flush()` (best-effort, wrapped in try/catch) to commit any pending `insertSheet` structural writes from earlier in the same Apps Script execution.
3. Re-fetch the Spreadsheet handle via `SpreadsheetApp.getActiveSpreadsheet()` and re-query `getSheetByName(name)`. Some Apps Script runtimes cache the sheet index on the original handle and only surface freshly-inserted sheets to a new handle post-flush.
4. If the retry also returns null, throw the same `Missing sheet: <name>` error as before. Sheets that truly don't exist still surface the expected error.

This means any future function that reads a sheet via `getSheet_()` right after an ensure call (or across an execution boundary where a sheet was just created) will self-heal, without every caller needing to know about the stale-handle quirk. It also closes the race window where a brand-new-workbook save path might accidentally read `SYS - Accounts` / `INPUT - Bank Accounts` / `INPUT - Debts` / etc. before the handle sees them. Existing-workbook performance is unchanged: populated workbooks always hit the fast-path return on the first lookup and never reach the flush or retry.

Files changed: `config.js`, `SESSION_NOTES.md`.

## Recent — First-run bank save follow-up: stale-handle fix for downstream SYS readers

Even after the previous three-pronged hardening of `addBankAccountFromDashboard` (direct Sheet return from `ensureSysAccountsSheet_()`, `SpreadsheetApp.flush()`, fresh `ss` handle), a brand-new workbook still threw `Error: Missing sheet: SYS - Accounts` on the first Add-account click. The failure was happening *downstream* of my fix, inside `syncAllAccountsFromLatestCurrentYear_()` (called at the end of the save path) and `updateAccountsSheetFields_()` (called when setAvailableFromOpening / setMinBufferFromOpening are on). Both helpers independently did `SpreadsheetApp.getActiveSpreadsheet()` + `getSheet_(ss, 'ACCOUNTS')` with their own freshly-fetched handle — and on some Apps Script executions that lookup still returned null for a sheet that was inserted earlier in the same call, even after a flush.

**Fix.** Both helpers now resolve the SYS - Accounts handle through the idempotent `ensureSysAccountsSheet_()` (which either returns the existing sheet or inserts the canonical structure and returns *that* Sheet object directly, so the lookup never goes through the stale cache):

- `syncAllAccountsFromLatestCurrentYear_()`: replaced `const targetSheet = getSheet_(ss, 'ACCOUNTS')` with `const targetSheet = ensureSysAccountsSheet_()`. The `ss` handle is still fetched afterward for the (guaranteed-to-exist) `INPUT - Bank Accounts` lookup.
- `updateAccountsSheetFields_()`: replaced `const sheet = getSheet_(ss, 'ACCOUNTS')` with `const sheet = ensureSysAccountsSheet_()`; the standalone `ss` variable is dropped since nothing else in the function used it.

Both helpers are no-ops on populated workbooks (sheet exists → returned untouched), so the change is pure defensive hardening — no behavioral change for any existing CashCompass workbook. Other read-only SYS - Accounts helpers outside the save path (`getInactiveBankAccountsSet_`, `getAccountsDistinctColumnValues_`, `accountExistsInAccountsSheet_`, `dashboard_data.js` aggregates, `cash_to_use.js`) are intentionally untouched: they're called from non-save contexts where the sheet is either already guaranteed to exist or a missing-sheet error is the right thing to surface.

Files changed: `bank_accounts.js`, `SESSION_NOTES.md`.

What to test: fresh deployment → Setup / Review → Welcome → Continue → Assets → Bank Accounts → Add new (with opening balance). First attempt should create both `INPUT - Bank Accounts` and `SYS - Accounts`, append the opening-balance row, run the SYS sync, and (if Available Now / Min Buffer checkboxes are on) update those columns — all in a single call with no "Missing sheet" banner. Populated workbooks are unaffected.

## Recent — Fresh-deployment fixes: Welcome gate inversion + first-run bank save

Two regressions surfaced on a literally-fresh deployment (brand-new CashCompass workbook, no data in any sheet, tested by opening the published web-app URL for the first time):

1. **Welcome screen never rendered.** The app landed directly on the Setup grid with "0 complete · 6 not set up" — no Welcome introduction. Ideal landing for a fresh deployment is Welcome; the grid is strictly a worse restatement of "nothing is set up yet" with no context on what Setup is.
2. **Assets → Bank Accounts → Add new failed with `Missing sheet: INPUT - Bank Accounts`** on the first attempt, then `Missing sheet: SYS - Accounts` on the retry. Both sheets are first created on the very first save; `addBankAccountFromDashboard` had an `ensureSysAccountsSheet_()` call but nothing for `INPUT - Bank Accounts`, so `getSheet_(ss, 'BANK_ACCOUNTS')` two lines earlier threw before the ensure could run.

### Welcome gate simplification — `Dashboard_Script_Onboarding.html` → `loadOnboardingSection()`

Reverted the previous two-gate model (primary `window.__cashCompassDashboardInited` + secondary `sheetExists || status !== 'missing'`) to a single **payload-driven** gate, because both lenient signals were over-reporting "populated":

- `window.__cashCompassDashboardInited` is set whenever `workbookHasAnyAppSheet_` finds *any* `INPUT - / SYS - / OUT - / LOG -` sheet. On a fresh deployment, `INPUT - Cash Flow <year>` and `INPUT - Upcoming Expenses` are typically already scaffolded (empty), so the flag is true even though Setup is genuinely empty.
- `sheetExists === true` on a per-step probe has the same failure mode: the Upcoming and Income probes report `sheetExists: true, status: 'missing'` on those scaffold sheets.

New rule: `loadOnboardingSection()` looks only at per-step `status`. If any step reports `status !== 'missing'` (complete or partial) → grid; else → Welcome. The loop risk the earlier two-gate model defended against is already gone: the grid's Back button routes to Dashboard (see below / prior session notes), so Welcome → Continue → grid or Welcome → Back to Dashboard → overview never cycles. Probe failures still fail closed to the grid (it surfaces the error inline and has Refresh + Back to Dashboard; Welcome has neither). `ONBOARDING_SKIP_GRID_AUTOLOAD_` is still set before `onboardingShowView('grid')` when we have the payload so `onboardingApplyStatusGrid_()` runs from the same fetch.

### First-run bank account creation — `bank_accounts.js` → `addBankAccountFromDashboard`

`addBankAccountFromDashboard` now calls `ensureOnboardingBankAccountsSheetFromDashboard('normal')` *and* `ensureSysAccountsSheet_()` **before** any sheet read, instead of only ensuring SYS. Both helpers are existing, tested, idempotent no-ops on populated workbooks (sheet exists → return untouched). For a fresh workbook:

- The INPUT helper writes the canonical Year-block structure the very next line reads: `Year | <current year>` on row 1, `Account Name | Jan-YY … Dec-YY | Total` on row 2 — exactly what `getBankAccountsYearBlock_` parses.
- The SYS helper writes the canonical column set `normalizeAccounts_` / `getAccountsHeaderMap_` look up by label: `Account Name, Current Balance, Available Now, Min Buffer, Type, Use Policy, Priority, Active`.

**Stale-handle defense.** Initial version of this fix still threw `Missing sheet: SYS - Accounts` on the very first Add-account run because the outer `const ss = SpreadsheetApp.getActiveSpreadsheet()` was captured *before* the ensure helpers ran their `insertSheet` calls. In some Apps Script executions that handle does not surface sheets inserted later in the same call via `getSheetByName`, so `getSheet_(ss, 'ACCOUNTS')` right after the ensure still returned null. Hardened in three ways:

1. `ensureSysAccountsSheet_()` already returns its Sheet object; `accountsSheet` is now taken directly from that return value instead of via `getSheet_(ss, 'ACCOUNTS')` — zero dependency on the outer handle seeing the fresh state.
2. `SpreadsheetApp.flush()` runs after both ensures so the next `getSheetByName` lookup sees committed structural writes.
3. The outer `const ss = SpreadsheetApp.getActiveSpreadsheet()` is declared *after* the ensures + flush, so the single remaining `getSheet_(ss, 'BANK_ACCOUNTS')` lookup is against a fresh handle. A defensive null check on the SYS return keeps the error message actionable if the helper ever returns no sheet (e.g. permissions failure swallowed upstream).

Both ensure calls are wrapped in try/catch that re-surfaces user-facing "Could not prepare INPUT - Bank Accounts: …" / "Could not prepare SYS - Accounts: …" messages instead of the raw `Missing sheet: …` banner if creation itself fails. The existing rollback pattern (delete the bank row if SYS append fails) is unchanged.

Files changed: `Dashboard_Script_Onboarding.html`, `bank_accounts.js`, `Dashboard_Help.html`, `PROJECT_CONTEXT.md`, `SESSION_NOTES.md`.

What to test:

- Fresh deployment (no prior data, even scaffold sheets): Setup / Review lands on **Welcome**. Continue → grid. Back to Dashboard → overview.
- Fresh deployment (scaffold sheets only, e.g. empty `INPUT - Cash Flow 2026` + empty `INPUT - Upcoming Expenses`): same as above — still Welcome.
- Populated workbook (any step complete/partial): Setup / Review lands directly on grid, no Welcome flash. Back to Dashboard on grid → overview (no Welcome loop).
- Fresh deployment Assets → Bank Accounts → Add new account with opening balance: creates `INPUT - Bank Accounts` with Year block for current year and `SYS - Accounts` with canonical headers, then writes both rows + opening balance into the Jan-Dec block. Second add on the same fresh workbook reuses both sheets (no duplicate structure).

## Recent — Setup / Review: Welcome gate hardening + grid Back button fix

Follow-up to the first-run UX hardening batch. Two related regressions were surfacing on populated workbooks when opening **Setup / Review** from the dashboard:

1. Opening Setup / Review could still land on **Welcome** even though the workbook was clearly populated, because the in-Setup Welcome gate only looked at per-step `status !== 'missing'`. A workbook with data in `INPUT - Investments` / `SYS - House Assets` / other sheets — but where `INPUT - Bank Accounts` / `INPUT - Debts` / `INPUT - Bills` / `INPUT - Upcoming Expenses` / `INPUT - Cash Flow <year>` / `INPUT - Settings` probes all returned `missing` — still flipped into Welcome.
2. Even when the grid rendered correctly on entry, the **Back** button on the grid was hardcoded to `onboardingShowView('welcome')`, so "go back" from Setup sent populated users straight to Welcome. Every other detail view already routed Back to `grid`; only the grid's Back was wrong.

### Welcome gate overhaul — `Dashboard_Script_Onboarding.html` → `loadOnboardingSection()`

- **Primary signal: `window.__cashCompassDashboardInited`.** This flag is only ever set by `initDashboard()` (in `PlannerDashboardWeb.html`), which the startup router only invokes for workbooks that `workbookHasAnyAppSheet_` has already classified as populated. If the user reached Setup / Review from the dashboard at all, this flag is true — so `loadOnboardingSection()` now renders the grid **synchronously** (pre-setting `ONBOARDING_SKIP_GRID_AUTOLOAD_` so the subsequent payload fetch doesn't double-render) before `getOnboardingStatusFromDashboard` returns. Welcome is literally unreachable for that session.
- **Secondary signal (only when primary flag is unset): per-step payload.** The existing payload gate now ORs two signals — any `sheetExists === true` or any `status !== 'missing'` → grid, else Welcome. This keeps the blank-workbook first-run flow working (`window.__cashCompassDashboardInited` stays unset when the startup router routed straight to onboarding, and every probe reports `sheetExists: false` for a truly fresh workbook).
- **Probe failure / malformed payload fails closed to the grid.** Stranding a populated user on Welcome because the probe hiccuped is strictly worse than showing an empty grid with Refresh available.

### Grid Back button — `Dashboard_Body.html`

- The status-grid view's action row had `<button onclick="onboardingShowView('welcome')">Back</button>`. Changed to `<button onclick="onboardingBackToDashboard()">Back to Dashboard</button>` so Back exits Setup (same semantics as Welcome's own Back to Dashboard button: hydrate overview if needed, then switch to `overview`). Label updated to "Back to Dashboard" for consistency with Welcome. Detail views' Back buttons (bank/debts/bills/upcoming/income/profile/houses/finish → grid) and the setup-editor-mode "Back to Setup" button are unchanged.

### Docs

- `Dashboard_Help.html` → Setup / Review → Flow → Welcome bullet rewritten to describe the two-gate model (primary = `window.__cashCompassDashboardInited`; secondary = per-step payload with `sheetExists`/status; probe failures fail closed). Also documents that the grid's **Back to Dashboard** button exits Setup instead of bouncing back to Welcome.
- `PROJECT_CONTEXT.md` → **Startup routing** bullet extended to cover the `loadOnboardingSection()` primary/secondary gates, the fail-closed behavior, and that both Welcome's and the grid's Back buttons call `onboardingBackToDashboard()`.

### Safety

- No server-side changes. No changes to `getStartupRoutingFromDashboard`, `getOnboardingStatusFromDashboard`, any step probe, `initDashboard`, or the setup-editor-mode flow.
- No sheet-schema, planner, or update-mode changes.
- Blank-workbook first-run flow preserved: truly new workbook still shows Welcome → Continue → grid; Back from grid now returns to dashboard (previously it bounced to Welcome), which is also acceptable for the first-run case and matches Welcome's own Back semantics.

### What to verify

- Populated workbook: Dashboard → **Setup / Review** → status grid renders immediately (no Welcome flash). Click **Back to Dashboard** on the grid → lands on overview. Re-open **Setup / Review** → grid again.
- Truly blank workbook (no `INPUT -`/`SYS -`/`OUT -`/`LOG -` sheets): page load still routes to Welcome; Continue → grid; **Back to Dashboard** on the grid exits to overview.
- Detail views (Bank / Debts / Bills / Upcoming / Income / Profile / Houses / Finish): Back still returns to the grid, never to Welcome.

---

## Recent — First-run UX hardening: startup routing + Bank / House / Investment add-form polish

Second pass of first-run / blank-workbook hardening after Setup / Review shipped. Fixes a startup regression where populated workbooks were landing on Welcome and tightens the three asset add-new forms (Bank, House, Investment) so first-time users can't get stuck on ambiguous inputs.

### Startup / onboarding

- `sheet_bootstrap.js` — `getStartupRoutingFromDashboard` now classifies a workbook as blank only when it has **no** `INPUT -`, `SYS -`, `OUT -`, or `LOG -` sheets (new `STARTUP_APP_SHEET_PREFIXES_` + `workbookHasAnyAppSheet_`). Previously an existing populated workbook could be misclassified based on a narrower core-sheet probe and get stuck on Welcome. Fails closed: any probe error treats the workbook as populated.
- `PlannerDashboardWeb.html` — `initDashboard()` is exposed on `window` and now sets `window.__cashCompassDashboardInited = true` the first time it runs.
- `Dashboard_Script_Onboarding.html` — `onboardingBackToDashboard()` runs `window.initDashboard()` when it hasn't run yet, so **Back to Dashboard** from Welcome can't loop back into blank classification.
- `onboarding.js` / `dashboard_data.js` — supporting first-run bootstrap + safe probes.

### Bank Account add form — `Dashboard_Body.html`, `Dashboard_Script_AssetsBankInvestments.html`, `bank_accounts.js`

- **Use policy** is now a real dropdown with canonical tokens — `DO_NOT_TOUCH`, `USE_FOR_BILLS`, `USE_FOR_DEBT`, `USE_WITH_CAUTION` — plus an **Other (custom)…** sentinel that reveals a free-text input and saves the typed string. Plain-English helper text explains each choice; unmapped custom values are treated like `DO_NOT_TOUCH` until mapped.
- **Priority** replaced with a dropdown — *Use first (primary account)*, *Use after others*, *Use last (backup)* — defaulting to *Use last*. Saves numeric 1 / 5 / 9 to the canonical `SYS - Accounts → Priority` column the planner already reads.
- **Opening balance** is required and prefilled to `0.00`; `0` is allowed but blank / invalid shows an error. Date remains required only when the amount is non-zero.
- **Also set Min Buffer to opening amount** now defaults to checked (matches *Also set Available Now*), so a fresh account has sensible buffers from the first save.
- `bank_accounts.js` — new `ensureSysAccountsSheet_` creates `SYS - Accounts` with canonical headers on blank workbooks (race-safe, never overwrites). Unblocks first-run add-bank-account from throwing *Missing sheet: SYS - Accounts*.

### House add form — `Dashboard_Body.html`, `Dashboard_Script_AssetsHouseValues.html`, `house_values.js`

- **Property type** replaced with a dropdown — *Primary Residence*, *Vacation Home*, *Rental* — merged with any existing workbook types (case-insensitive dedup, literal *Other* from server dropped so the sentinel stays last). **Other (custom)…** reveals a free-text input and saves the typed string. UX only; no schema or planner-logic change (the only `propertyType`-branching code in the app is `isHouseAssetsRentalForCashFlow_`, which keys on `"rental"`).
- **Valuation date** stays optional in the UI but now defaults to today server-side (`addHouseFromDashboard`) so the Current value always lands in a real month column. Historical "empty month for 0" semantic is preserved: we still skip the month write when Current value is `0`. UI copy updated to say *"If left blank, the current month will be used."*

### Investment add form — `Dashboard_Body.html`, `Dashboard_Script_AssetsBankInvestments.html`, `investments.js`

- Mirrors the Bank hardening. **Starting value** is required, prefilled to `0.00`; `0` is allowed, blank / invalid shows an error. **Starting value date** stays optional — blank resolves to today server-side; non-blank must still be in the current year. The old both-or-neither coupling is gone (`addInvestmentAccountFromDashboard` now defaults amount to 0 and date to today independently), and month-cell writes are skipped when amount is 0 to preserve the historical "no data" convention.
- **Type** dropdown merges existing `SYS - Assets` types with fallback options (*Brokerage*, *Retirement*, *Education*) plus an **Other (custom)…** sentinel that saves a user-typed string.

### Other

- `Dashboard_Script_BillsDue.html`, `Dashboard_Script_PlanningDebts.html`, `bills.js` — follow-on polish from the same first-run pass (sheet-name-free user copy, minor wiring).
- No sheet schema changes. No planner-logic changes. No touches to already-saved rows. Update-mode for all three asset types is unchanged.

### Docs

- `Dashboard_Help.html`
  - **Setup / Review → Flow**: Welcome bullet clarified to say populated workbooks never land on Welcome and **Back to Dashboard** routes to the real dashboard.
  - **Assets → House Values → Add new**: Property type described as a dropdown with *Other (custom)…*; Valuation date described with the "current month when blank" behavior.
  - **Assets → Bank Accounts → Add new**: Opening balance described as required / prefilled 0.00; Use policy dropdown + canonical tokens + Other; Priority dropdown (*Use first* / *Use after others* / *Use last*) with numeric 1/5/9 mapping; note that both *Available Now* and *Min Buffer* checkboxes default to checked.
  - **Assets → Investments → Add new**: Starting value listed as required / prefilled 0.00; Starting value date described with the "current month when blank" behavior; Type dropdown with core + Other.
  - **Activity log → `bank_account_add` / `investment_add`**: Amount text aligned with the new "required opening / starting value (may be $0.00)" model.
- `PROJECT_CONTEXT.md`
  - Bank Accounts and Investments system-area bullets rewritten to match the new add-form behavior (canonical Use Policy tokens + Other, Priority dropdown with 1/5/9 mapping, required opening / starting value, blank date → today, `ensureSysAccountsSheet_` first-run safety).
  - Setup / Review section gains a **Startup routing** bullet naming `getStartupRoutingFromDashboard` / `workbookHasAnyAppSheet_` / `onboardingBackToDashboard` and the fail-closed behavior.

### What to verify

- Existing populated workbook opens on the normal dashboard (not Welcome).
- Truly blank workbook still opens Welcome; **Back to Dashboard** routes to the dashboard and doesn't loop.
- Bank / House / Investment Add-new forms reject blank required fields with the new inline errors; dropdowns honor the *Other (custom)…* flow; saves land in the expected month cell (today's month when the date is blank, skipping writes for `0`).

---

## Recent — Setup / Review (Onboarding Phase 1) shipped + docs catch-up

Onboarding Phase 1 from the queued product backlog has landed as the **Setup / Review** flow (top-right dashboard button) and is now documented. This entry captures the final product shape plus the docs/help pass that caught `PROJECT_CONTEXT.md`, `ENHANCEMENTS.md`, and `Dashboard_Help.html` up to the implementation.

### What shipped

- **Entry point** — top-right `Setup / Review` button (renamed from `Setup`). Opens a focused flow: **Welcome → status grid → per-step detail → (optional) editor in Setup mode**.
- **Five step detail screens**, each read-only, mode-aware, and pattern-consistent:
  - **Bank Accounts** — reads the current-year block on `INPUT - Bank Accounts`.
  - **Debts** — reads active rows from `INPUT - Debts`.
  - **Bills** — reads active rows from `INPUT - Bills` (payee / amount / due day / frequency).
  - **Upcoming Expenses** — reads *Planned* rows only from `INPUT - Upcoming Expenses`.
  - **Income** — derived from the latest `INPUT - Cash Flow <year>`; groups recurring income conservatively (e.g. *Cisco Pay 1/2/3 → Cisco Salary*) and lists excluded categories (Bonus / RSU / ESPP / Refund / …) as "Other detected income". No `INPUT - Income Sources` sheet was reintroduced.
- **Finish screen** — per-step summary list with *Review* deep-links back into each detail screen and a *Go to Next Actions* CTA that exits Setup cleanly.
- **Setup-mode editor handoff (consistency pass)** — opening any editor from Setup hides the main top nav, page sub-tabs (`.assets-tabs`, `.cashflow-tabs`, `.planning-tools`, `.planning-tools-wrap`, `.planning-next-actions-feature`), the *Setup / Review* button, and *Run Planner + Refresh Snapshot*, and shows a slim **Back to Setup** bar. All five handoffs (Bank Accounts, Debts, Bills, Upcoming, Income) now share this behavior via a single `body.setup-editor-mode` CSS rule in `Dashboard_Styles.html`. Normal navigation to the same editor is unchanged.
- **Sheet safeguards** — Setup ensures `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, and `INPUT - Upcoming Expenses` exist with the canonical headers before opening their editor, reusing existing schema definitions (`getDebtsHeaderMap_`, `getOrCreateUpcomingExpensesSheet_`, etc.). Cash Flow year sheets are **not** auto-created from Setup — if missing, the Income step says so explicitly.
- **TEST mode deprecation (light)** — TEST messaging was removed from user-facing Setup copy. Existing `?onboarding=test` routing and `TEST -` fallbacks in `onboarding.js` still work but will not grow; full retirement is tracked as a follow-up.
- **Read-only guarantee** — viewing Setup never writes, never touches `SYS -` sheets, and never appends to `LOG - Activity`. Writes only happen through the underlying editors, which use the same save logic as the normal path.

### Docs catch-up

- `PROJECT_CONTEXT.md`
  - New **Setup / Review (Onboarding Phase 1, delivered)** section covering the flow, Setup-mode editor handoff, Income-from-Cash-Flow derivation, sheet safeguards, and the read-only guarantee.
  - Queued-work list rewritten: Onboarding is now delivered; Income Sources is explicitly **superseded** (income lives in Setup via Cash Flow); TEST-mode retirement and the onboarding-factory refactor are the only onboarding-adjacent items still queued.
  - Prioritization line updated to reflect the new ordering.
- `ENHANCEMENTS.md → § 4 → Onboarding (Phase 1)`
  - Status flipped to **Delivered** with the concrete screen flow, editor handoff behavior, sheet safeguards, read-only guarantee, and the two remaining follow-ups (TEST retirement, per-step factory refactor).
  - Prioritization bullet #5 updated to note delivery and the Income Sources supersession.
- `Dashboard_Help.html`
  - New **Setup / Review** section (`#help-setup`) added between *Introduction* and *Overview*, with a matching TOC entry.
  - Section covers: screen flow (Welcome / status grid / detail screens), per-step coverage, Setup-mode editor handoff, and safety rules (no writes, no `SYS -` touch, no Activity writes, editor parity with normal path).

### Scope

Docs-only follow-up to the delivered feature. No code changes in this pass. The Setup / Review flow itself was built in prior passes; this entry formalizes product framing and user-facing documentation.

---

## Recent — App-wide user-facing text cleanup (extends Planning pass)

Follow-up to the Planning-surface text cleanup below. Applies the same rule — never expose internal sheet names, schema field names, or technical terms in user-facing copy — to every other surface in the dashboard: Cash Flow (Quick add, Upcoming, Donations, Bills), Assets (Bank Accounts, Investments, House Values), Properties (Performance, House Expenses), Planning → Debts add/update flows, Activity, and the planner-driven strings that bubble up into Rolling Debt Payoff. No backend logic, ranking, or routing changed — text / label / status / confirm dialog / empty-state changes only.

### What changed

- **Add-panel descriptions — `Dashboard_Body.html`**
  - Houses, Bank Accounts, Investments, Debts, and Bills Add-new info blocks rewritten to drop `INPUT - House Values` / `INPUT - Bank Accounts` / `SYS - Accounts` / `INPUT - Investments` / `SYS - Assets` / `INPUT - Debts` / `INPUT - Cash Flow` / `INPUT - Bills` and describe behavior in product terms (e.g. *"Creates the account in the current year's Bank Accounts block"*).
  - Investment Update card label `Current SYS - Assets balance:` → `Current balance:`.
  - Dropdown help copy for bank `Type` and investment `Type` no longer references `SYS - Accounts` / `SYS - Assets`.
  - Donations panel subtitle `Log giving to INPUT - Donation …` → `Log charitable giving …`.
  - Property performance subtitle `SYS - House Assets + Cash Flow rent + HOUSES expenses` → `Houses + rental income + expense sheets`.
- **Assets → Bank / Investments — `Dashboard_Script_AssetsBankInvestments.html`**
  - Stop-tracking confirm dialogs for bank and investment accounts no longer mention `INPUT - Bank Accounts`, `SYS - Accounts`, `INPUT - Investments`, `SYS - Assets`. Reworded to: *"All history is preserved — you can still view past values for reporting."*
- **Cash Flow → Bills — `Dashboard_Script_BillsDue.html`**
  - Stop-tracking confirm: `"the row stays in INPUT - Bills for history."` → `"History is preserved."`
  - Recurring (no-due-date) card caption: `"Recurring · no due date in INPUT - Bills"` → `"Recurring · no due date set"`.
- **Cash Flow → Donations — `Dashboard_Script_Donations.html`**
  - Tax-year dropdown empty-state: `"— Add Year blocks on INPUT - Donation —"` → `"— No tax years available —"`.
  - Recent donations empty-state: `"No donation rows found on INPUT - Donation yet."` → `"No donations logged yet."`
  - Tax-year validation: `"add Year sections to INPUT - Donation if empty"` → `"no tax years are available yet"`.
- **Activity — `Dashboard_Script_Activity.html`**
  - Delete-confirm for donation log lines: `"LOG - Activity"` / `"INPUT - Donation"` replaced with `"Activity"` / `"matching donation record"`.
  - Post-delete status messages rephrased in the same direction (`"deleted the matching donation record"`, `"Donation record was left unchanged"`, etc.).
  - Disabled-row tooltip no longer says *"delete the row on the LOG - Activity sheet"*.
  - Scan footer: `"Scanned N row(s) in LOG - Activity."` → `"Scanned N activity entries."`
- **Properties → Performance — `Dashboard_Script_PropertyPerformance.html`**
  - Empty-state: `"No houses in SYS - House Assets."` → `"No houses to show."`
- **Backend success / error messages surfaced in the UI**
  - `activity_log.js`: `"LOG - Activity not found."` → `"Activity log not found."`; `"No rows in LOG - Activity yet."` → `"No activity recorded yet."`; delete-guard copy drops the *"delete other lines directly on the LOG - Activity sheet"* suffix.
  - `debts.js`: schema errors (`INPUT - Debts is empty` / `has no header row` / `must contain …`), duplicate-name message, stop-tracking message, Cash Flow seed warning/success, and "field not found" all rephrased without sheet-name references (e.g. `"Debts list is empty."`, `"Created debt \"X\".\nAdded a matching expense row to Cash Flow so Bills Due and Upcoming see it right away."`).
  - `bank_accounts.js`: duplicate-name, rollback error, create-success, stop-tracking, and missing-rows messages no longer mention `INPUT - Bank Accounts` / `SYS - Accounts`.
  - `investments.js`: success message (`"Investment value updated."`), year-block / schema throws, duplicate-name, insert/rollback throws, create-success, stop-tracking, and missing-rows messages cleaned the same way.
  - `house_values.js`: duplicate-name, insert/rollback throws, create-success bullet list (now *"House Values updated"* / *"House asset recorded"* / *"Expense sheet created/already existed"*), and missing-rows message cleaned.
  - `bills.js`: schema throws (`Bills sheet has no header row` / `is missing required header …`) cleaned.
  - `dashboard_data.js`: schema throw (`Bills sheet must contain Payee, Due Day, Default Amount, and Active headers.`) cleaned.
  - `quick_add_payment.js`: debt-balance change note no longer appends `" (INPUT - Debts)."`.
- **Planner output strings surfaced in Rolling Debt Payoff — `rolling_debt_payoff.js`**
  - Key warnings, context notes, info triggers, required-action `sheet` fields, execution long-term review hint, required-payments summary, and HELOC strict-gate fail reasons no longer leak `INPUT - Cash Flow` / `INPUT - Debts` / `INPUT - Upcoming Expenses` / `SYS - Accounts`.
  - `planner_core.js` `reserve_source` metadata: `"DO_NOT_TOUCH accounts (SYS - Accounts current balances)"` → `"Do-not-touch accounts (current balances)"`, so the liquidity body in the React dashboard reads in plain English.
- **Dead-but-present Debt Overview `recommendations` payload — `debt_payoff_projection.js`**
  - Cash snapshot line no longer appends `"(SYS - Accounts)."`.
  - CF-paid disclosure line no longer says `"Expense rows on INPUT - Cash Flow"`; now `"expense rows on Cash Flow"`.

### Terms removed / replaced (user-facing only)

- `INPUT - Bank Accounts` / `SYS - Accounts` → *Bank Accounts* / *Accounts* / removed
- `INPUT - Investments` / `SYS - Assets` → *Investments* / *Assets* / removed
- `INPUT - House Values` / `SYS - House Assets` / `HOUSES - *` → *House Values* / *house asset* / *expense sheet*
- `INPUT - Bills` → *Bills* / removed
- `INPUT - Debts` → *Debts* / removed
- `INPUT - Cash Flow` / `INPUT - Cash Flow YYYY` → *Cash Flow* / *Cash Flow YYYY*
- `INPUT - Donation` → *donation record* / removed
- `INPUT - Upcoming Expenses` → *Upcoming*
- `LOG - Activity` → *Activity* / *activity log*
- `DO_NOT_TOUCH accounts (SYS - Accounts current balances)` → *Do-not-touch accounts (current balances)*

### How descriptions were simplified

- Add-new info blocks dropped the "adds a row to sheet X" phrasing and describe what the user actually achieves in-product (*"Creates the account …"*, *"Creates the house in the current year's House Values block"*).
- Confirm dialogs for "stop tracking" were unified across bank / investment / bill / debt: all collapse to *"History is preserved"* / *"All history is preserved — you can still view past values for reporting."* instead of naming every sheet that stays in place.
- Error / schema messages no longer require the reader to know which sheet / column is involved; they reference the concept (*"Bills sheet"*, *"Debts sheet"*, *"Cash Flow"*).
- Rolling Debt Payoff caution / context / info strings were pruned to the behavior sentence and dropped the *"verify INPUT - Cash Flow Type column"*-style pointers that leaked schema details into the plan.

### Deliberately out of scope

- `Dashboard_Help.html` sections outside the Planning help (the Houses / Bank / Investments / Cash Flow / Bills / Donations / Activity / Sheets references, and the `debt_add` / `debt_deactivate` event descriptions) still spell out sheet names. These are documentation, not the dashboard's active UI — they describe how the workbook is structured on purpose. A separate, deliberate help rewrite should decide whether to keep that reference intact or abstract it.
- `home.js` (HOME sheet generator) still groups workbook tabs by `INPUT - ` / `SYS - ` / `HOUSES - ` / `CARS - ` / `LOANS - ` prefix. That's the whole purpose of the HOME tab; renaming it would break the feature.
- Sheet-name constants in `config.js`, `donations.js`, `activity_log.js`, `upcoming_expenses.js`, `retirement.js` are internal identifiers that match real sheet names — required for reads/writes to work.
- Developer-only audit tables inside the Rolling Debt Payoff host `rollingThisMonthPlanHtml_` / `rollingRecurringBaselineAuditHtml_` branches (emitted only when `include_debug_details` is true) still mention sheet names. Same rationale as before — debug surfaces, not user-facing UI.
- React bundle (`RollingDebtPayoffDashboardBundle.html`) wasn't rebuilt in this pass; the planner-string cleanups above reach it through the JSON payload, but any static strings hard-coded inside the React source would need a bundle rebuild. None of the strings touched here live inside the bundle.

### Files touched

Frontend:
- `Dashboard_Body.html`
- `Dashboard_Script_AssetsBankInvestments.html`
- `Dashboard_Script_BillsDue.html`
- `Dashboard_Script_Donations.html`
- `Dashboard_Script_Activity.html`
- `Dashboard_Script_PropertyPerformance.html`

Backend:
- `activity_log.js`
- `debts.js`
- `bank_accounts.js`
- `investments.js`
- `house_values.js`
- `bills.js`
- `dashboard_data.js`
- `quick_add_payment.js`
- `rolling_debt_payoff.js`
- `planner_core.js`
- `debt_payoff_projection.js`

Docs:
- `SESSION_NOTES.md`

### Scope held

- No backend logic changes. Ranking, routing, payment flows, balance math, and planner decisions all untouched — only the strings they emit.
- No layout / feature changes. Every dialog, card, panel, and tab still looks the same; only the copy inside changed.
- Sheet-name *constants* (the identifiers the code uses to read / write actual tabs) were left intact; only the strings shown to users were rephrased.

---

## Recent — Planning-surface user-facing text cleanup

Presentation-only pass to remove internal sheet names, technical variable names, and verbose reasoning from the three Planning surfaces. No ranking, routing, or backend logic changed — only user-visible strings.

### What changed

- **Next Actions reason strings — `next_actions.js`**
  - Cash-gap reason no longer leaks the internal `cash_to_use` identifier. Wording now reads `"Urgent obligations total $X but only $Y is available — short by $Z."`
  - `nextActionsReasonForBillUrgent_()`: non-debt `"Bill due within 7 days."` → `"Due soon."` (overdue bill unchanged).
  - `nextActionsReasonForUpcomingUrgent_()`: `"Upcoming obligation due within 7 days."` → `"Due soon."`; `"Overdue upcoming obligation."` → `"Overdue."`
  - Debt-minimum and extra-debt reason copy was already short after the earlier overlap cleanup; left untouched.
- **Next Actions card title fallback — `Dashboard_Script_PlanningNextActions.html`**
  - Removed the `action.actionType` fallback on the card title. If a row ever arrives without a `title`, the card shows a generic `Next action` label instead of leaking the backend `actionType` enum.
- **Debt Overview empty-state — `Dashboard_Script_PlanningDebtPayoff.html`**
  - `"Update INPUT - Debts or refresh after you pay something down."` → `"Update your debts or refresh after you pay something down."`
- **Planning → Debts stop-tracking confirm — `Dashboard_Script_PlanningDebts.html`**
  - Confirm dialog no longer mentions `INPUT - Debts`. Reworded as `"History stays in place so the account name remains reserved and past activity is preserved."`
- **Rolling Debt Payoff Standard-tab tooltip — `Dashboard_Body.html`**
  - `"Clean operator-facing dashboard. Toggle Advanced to see audit panels."` → `"Clean decision view. Toggle Show details for audit panels."`
- **Help copy — `Dashboard_Help.html`**
  - `#help-next-actions`: replaced the `USE_FOR_BILLS / USE_FOR_DEBT / USE_WITH_CAUTION / DO_NOT_TOUCH` policy-code enumeration and the `max(0, balance − minBuffer)` formula snippet on the **Cash to use** bullet with a plain-English sentence. Reworded the **Urgent** and **Recommended** bullets to drop *"blended score"* in favor of *"earlier / larger items surfaced first"* and *"a conservative slice of ..."* (same behavior, readable language).
  - `#help-payoff-path`: `INPUT - Debts` → `Debts`; `INPUT - Cash Flow` → `Cash Flow` on the **Data sources** bullets.
  - `#help-rolling-debt-payoff`: anchor-month intro now reads `"latest Cash Flow month that has any income or expense data"` (was `INPUT - Cash Flow ... Income/Expense data`). **Safe to use** bullets no longer reference `SYS - Accounts` or the `DO_NOT_TOUCH` code. **Cash out vs minimums** bullet replaces `INPUT - Cash Flow` / `INPUT - Debts` with `Cash Flow` / `Debts`.
  - `#help-sheets` reference section (*Sheet names (quick reference)*) intentionally left unchanged — it exists precisely to document the underlying workbook model for power users; not a Planning surface.

### Terms removed / replaced (user-facing only)

- `INPUT - Debts` → **Debts** (or the surrounding sentence reworded)
- `INPUT - Cash Flow` → **Cash Flow**
- `SYS - Accounts` → **Accounts**
- `INPUT - Upcoming Expenses` → **Upcoming** (where it was in user-facing copy)
- `cash_to_use` → `"available cash"` in the cash-gap reason line
- `actionType` (card-title fallback) → `"Next action"`
- `USE_FOR_BILLS`, `USE_FOR_DEBT`, `USE_WITH_CAUTION` enum values → dropped from help; replaced with `"eligible Bank Accounts"`
- `DO_NOT_TOUCH` → `"accounts flagged do-not-touch"` / `"reserve"`
- `max(0, balance − minBuffer)` formula snippet → `"after each account's minimum buffer"`
- `"blended score of due-date proximity + amount"` → `"earlier / larger items surfaced first"`
- `"Bill due within 7 days."` / `"Upcoming obligation due within 7 days."` → `"Due soon."`
- `"Overdue upcoming obligation."` → `"Overdue."`

### How descriptions were simplified

- Urgent reason lines are now 1–3 words (`"Overdue."`, `"Due soon."`, `"Overdue bill."`, `"Overdue debt minimum."`, `"Debt minimum due soon."`). Amount and due date are already rendered as dedicated fields on the card, so the reason only has to answer *"why is this urgent?"*.
- Cash-gap row's reason is still a complete sentence because it needs to explain the shortfall, but it no longer names the internal `cash_to_use` variable.
- Help bullets trade formulas / enum codes for the concept they encode (`"minimum buffer"`, `"do-not-touch"`, `"eligible Bank Accounts"`), so the same guardrails are conveyed without requiring the reader to decode variable names.

### Deliberately out of scope (flagged for a future pass)

Sheet names still appear in user-visible copy on surfaces outside the three Planning tabs: Cash Flow → Bills Due (`Dashboard_Script_BillsDue.html`), Cash Flow → Donations (`Dashboard_Script_Donations.html`), Cash Flow → Activity (`Dashboard_Script_Activity.html`), Assets → Bank / Investments (`Dashboard_Script_AssetsBankInvestments.html`), Properties → Performance (`Dashboard_Script_PropertyPerformance.html`), Properties → House Expenses, and the detailed dialogs under Assets / Debts. These weren't touched because the user request scoped consistency to *Next Actions / Debt Overview / Rolling Debt Payoff*. Same approach will apply when those surfaces get a cleanup pass.

Rolling Debt Payoff host-side developer tables (`rollingThisMonthPlanHtml_`, `rollingRecurringBaselineAuditHtml_`) still reference `INPUT - Upcoming Expenses` / `INPUT - Cash Flow` / `SYS - Accounts` — these live inside the `dbg` branch (reachable only via the programmatic `includeDebug=true` path) and are developer surfaces, so they remain as-is.

### Files touched

- `next_actions.js`
- `Dashboard_Script_PlanningNextActions.html`
- `Dashboard_Script_PlanningDebtPayoff.html`
- `Dashboard_Script_PlanningDebts.html`
- `Dashboard_Body.html`
- `Dashboard_Help.html`
- `SESSION_NOTES.md`

### Scope held

- No backend changes to `getCashToUse()`, `getNextActionsData()`, ranking, routing, or payment flows.
- No layout / feature changes. Cards still show title, amount, due date, and a 1-line reason.
- Help structure and anchor IDs unchanged.

---

## Recent — Debug-mode flag + Next Actions debug gating

Small, presentation-only pass. Introduced a single app-wide debug flag and used it to hide the one remaining developer surface on the default Next Actions view. No backend logic changed (`getCashToUse()`, `getNextActionsData()`, routing, and Quick Add flows are untouched).

### What changed

- **Debug-mode flag (single source of truth) — `Dashboard_Script_Render.html`**
  - Added `APP_DEBUG_MODE` (default `false`) and a `isDebugMode()` helper at the top of the host bootstrap script.
  - `isDebugMode()` returns `true` when `APP_DEBUG_MODE === true` **or** the deployed web-app URL carries `?debug=1` / `?debug=true`. No persistence, no settings page, no per-surface fan-out — renderers just branch on the helper.
- **Next Actions — `Dashboard_Script_PlanningNextActions.html`**
  - The *"Why this cash amount?"* per-account `getCashToUse()` breakdown is now gated behind `isDebugMode()`. In the default (debug OFF) state, `loadNextActions()` skips the secondary `getCashToUse()` fetch and clears `#next_actions_liquidity_details` so the slot stays empty. In debug ON, the disclosure renders exactly as before.
  - `loadNextActionsLiquidityDetails_()` also re-checks `isDebugMode()` defensively — any future / programmatic caller hits the same gate so the table cannot leak into the user surface by accident.
  - File header + section comment updated to name this as a developer aid, not a user-facing feature.
- **Host markup — `Dashboard_Body.html`**
  - Comment on the `#nextActions` panel now explicitly labels `#next_actions_liquidity_details` as a *debug-only* slot.
- **Help copy — `Dashboard_Help.html`**
  - Removed the *"Why this cash amount?"* subsection from `#help-next-actions`. The disclosure is no longer part of the default product surface, so the help paragraph describing it would be misleading for normal users. Guardrails / summary / open-targets copy is unchanged.

### Where debug mode is defined

- `APP_DEBUG_MODE` constant + `isDebugMode()` helper in `Dashboard_Script_Render.html` (loaded first by `PlannerDashboardWeb.html`, so every downstream script sees the helper).

### Which UI elements are hidden when debug is OFF

- Next Actions → collapsed *"Why this cash amount?"* disclosure (per-account balance / min buffer / usable / included / excluded-reason table backed by `getCashToUse()`).

### Remaining developer-only surfaces intentionally still visible

- Rolling Debt Payoff React dashboard still renders the *"Show full policy bridge (debug)"* button and the *"Display plan validator (debug)"* section inside its `Show details` disclosure. Both live in the prebuilt React bundle (`components/RollingDebtPayoffDashboard.tsx` → `RollingDebtPayoffDashboardBundle.html`), so removing the `(debug)` suffixes or gating them on `isDebugMode()` requires a bundle rebuild (`npm run build:rolling-dashboard`). Deferred to a follow-up pass; they remain behind a collapsed *Show details* toggle today, so they don't bleed into the default surface.
- Rolling Debt Payoff host script still supports a programmatic `includeDebug=true` path that emits a `DEBUG DETAILS` outer wrapper (`Dashboard_Script_RollingDebtPayoff.html`). The user-facing checkbox that enabled it was already removed, so this path is reachable only by developers calling the setter directly. Left as-is.

### Scope held

- No backend changes (`cash_to_use.js`, `next_actions.js`, `getNextActionsData()`, ranking, routing, payment flows untouched).
- No new settings page, no profile/config surface, no layout redesign, no feature additions.
- No changes to the primary Next Actions UI: summary cards, Urgent / Recommended / Optimize buckets, and the `Open X →` navigation links render exactly as before.

### Files touched

- `Dashboard_Script_Render.html`
- `Dashboard_Script_PlanningNextActions.html`
- `Dashboard_Body.html`
- `Dashboard_Help.html`
- `SESSION_NOTES.md` (this entry)

---

## Recent — Help + docs catch-up for Planning surface overlap cleanup

Docs-only follow-up to the overlap cleanup. The overlap commit updated Help's Next Actions section inline but left a few current-state descriptions describing the pre-cleanup world. Swept them so the spec, the backlog entry, and the user-facing Help all match what the code actually emits.

### What changed

- **`Dashboard_Help.html` → Debt Overview (`#help-payoff-path`)**
  - Dropped the *"longest payoff" callout* phrase from the stop-tracked-rows bullet (the callout no longer exists).
  - Rewrote **What it is** to explicitly position Debt Overview as a read-only reference with no recommendations / no cash-flow notes / no decision content, and point users to Rolling Debt Payoff for this month's action plan and Next Actions for cross-surface prioritization.
  - Renamed **Summary and notes** → **Summary**, trimmed to describe only *Total debt balance* + *Total monthly minimums*, and explicitly called out that decision-style context (safe-to-use, projected cash flow, highest-APR / longest-payoff callouts) lives on Next Actions / Rolling Debt Payoff by design.
- **`PROJECT_CONTEXT.md` → Next Actions v1**
  - Priority buckets: replaced the *"review HELOC strategy"* example in Optimize with a note that HELOC strategy is **not** surfaced on Next Actions (it lives on the Rolling Debt Payoff *HELOC strategy* card).
  - v1 action types: removed `review_heloc_strategy`; added a short `pay_extra_debt` clarifier (*reason kept short — "Confirm in Rolling Debt Payoff" — to avoid duplicating the Focus-debt narrative*) and a single line stating HELOC strategy is intentionally not a Next Actions action type.
  - `cash_to_use` guardrail: rephrased the HELOC line so it no longer references the deleted `review_heloc_strategy` signal.
- **`ENHANCEMENTS.md` → Next Actions v1 contract**
  - Action-types list: dropped `review_heloc_strategy`; same single-line HELOC-ownership clarifier.
  - Liquidity-model guardrail: rephrased the HELOC line in the same way.

### Scope held

- No code changes. No backend contract changes (the action-type list reflects what `getNextActionsData()` has emitted since the overlap cleanup commit).
- Historical SESSION_NOTES entries that describe the prior (pre-cleanup) state were **not** edited — they are point-in-time records and stay as written.
- No changes to Rolling Debt Payoff help content, Next Actions help content beyond what shipped in the overlap commit, or any other Planning surface.

### Files touched

- `Dashboard_Help.html`
- `PROJECT_CONTEXT.md`
- `ENHANCEMENTS.md`
- `SESSION_NOTES.md` (this entry)

---

## Recent — Planning surface overlap cleanup

Tightened the boundaries between the three Planning surfaces so each owns a distinct role and the app stops repeating itself. Minimal code edits, no backend logic changes, no UI redesign, no layout changes.

### Clarified boundaries

- **Next Actions** = *what to do* (prioritized action list; routes to source pages).
- **Debt Overview** = *reference only* (read-only portfolio view of balances + minimums).
- **Rolling Debt Payoff** = *strategy* (monthly decision engine; where extra-payment / HELOC decisions live).

### What changed

- **Removed recommendation content from Debt Overview.**
  - `Dashboard_Body.html` — deleted the `<h3>Notes</h3>` header and the entire `#debt_payoff_read_recommendations` block (cash snapshot, safe-to-use vs minimums, projected cash flow, highest APR callout, longest payoff callout). Intro paragraph rewritten to position Debt Overview as read-only with a cross-link to Rolling Debt Payoff for this month's action plan.
  - `Dashboard_Script_PlanningDebtPayoff.html` — `renderDebtPayoffReadData_` now emits only *Total debt balance* and *Minimum payments (about)*. Dropped the *Safe to use (before planned expenses)* and *Longest estimated payoff* bullets. Recommendations container is unconditionally cleared (`recEl.innerHTML = ''`) so stale decision content cannot leak back in.
- **Simplified Next Actions wording (no APR / heuristic duplication).**
  - `next_actions.js → nextActionsBuildExtraDebtAction_` — `pay_extra_debt` reason collapsed to `"Extra payment toward <debt>. Confirm in Rolling Debt Payoff."` in both `recommended` and `optimize` buckets. APR fragment and highest-APR heuristic narrative removed; Next Actions no longer restates Rolling Debt Payoff's focus-debt explanation.
- **Removed HELOC from Next Actions (now owned by Rolling Debt Payoff).**
  - `next_actions.js → getNextActionsData()` — the `review_heloc_strategy` action is no longer emitted; the HELOC target selection helper `nextActionsPickHelocTarget_()` was deleted. JSDoc `NextActionItem` narrowed: `'review_heloc_strategy'` dropped from `actionType`, `'heloc'` dropped from `sourceEntityType`. HELOC strategy continues to live on the Rolling Debt Payoff *HELOC strategy* card as before.
- **Added cross-links between surfaces to prevent future duplication.**
  - `Dashboard_Body.html` — Debt Overview intro links to Rolling Debt Payoff (*"For this month's action plan, see Rolling Debt Payoff"*); Rolling Debt Payoff panel head links back to Debt Overview (*"For portfolio-level balances and minimums, see Debt Overview"*). Both use the existing `showTab()` helper, no new navigation glue.
- **Help copy (`Dashboard_Help.html`)** — `#help-next-actions` updated so the *Recommended* description matches the short `Confirm in Rolling Debt Payoff` reason and the *Optimize* description explicitly notes that HELOC strategy is **not** surfaced in Next Actions (it lives on the Rolling Debt Payoff HELOC strategy card).

### Scope held

- No backend logic changes beyond the HELOC action removal (no change to ranking, cash-gap detection, `getCashToUse()`, or `getRollingDebtPayoffPlan`).
- No UI redesign, no layout changes, no new sheets or columns.
- Rolling Debt Payoff itself was not edited other than the cross-link line in its panel head.
- No changes to the single payment path (Cash Flow → Quick Add).

### Files touched

- `Dashboard_Body.html`
- `Dashboard_Script_PlanningDebtPayoff.html`
- `next_actions.js`
- `Dashboard_Help.html`

---

## Recent — Queued product work captured (debug mode / income sources / onboarding) — docs only

Docs-only pass. Captured three upcoming product surfaces so the intent does not drift while overlap cleanup and Next Actions stabilization finish. No code changes, no feature descriptions modified, no planner / Next Actions / Rolling Debt Payoff edits.

### What was added

- **`ENHANCEMENTS.md`** — new subsection **"Queued — post Next Actions stabilization"** inside § 4 Prioritized enhancement opportunities (directly after Tier 3, before § 5 Recommended next item). Contains three structured enhancement items and a pinned prioritization order:
  - **Debug mode control** — single host-global `isDebugMode` flag that gates developer / internal surfaces (e.g. *Why this cash amount?* liquidity breakdown, planner diagnostics, raw JSON exports). Presentation-only, no backend changes. Low risk.
  - **Income Sources (new input surface)** — structured income entry under **Assets → Income Sources** (primary) or **Cash Flow → Income Setup** (fallback). v1 fields: `source name`, `amount`, `frequency`, `active`. Explicit non-goals: no planner integration, no forecasting, no automatic Cash Flow posting. Adds `income_source_add` / `income_source_deactivate` to `LOG - Activity` under the usual Add / Update / Stop tracking pattern.
  - **Onboarding (Phase 1)** — guided first-time setup walkthrough across Bank Accounts (with buffers + use policy), Debts, Bills, Upcoming, and (future) Income Sources. Explains `cash_to_use` and how Next Actions prioritizes actions in plain language. No advanced strategy (HELOC, optimization) in v1. Additive host surface over canonical inputs.
  - **Prioritization order** — (1) finish overlap cleanup → (2) stabilize Next Actions → (3) debug mode → (4) income sources → (5) onboarding. Not to be reshuffled without an explicit product decision.

- **`PROJECT_CONTEXT.md`** — added a short **"Queued product work (post Next Actions stabilization)"** block directly below the Decision Layer Roadmap. Three high-level bullets plus the prioritization order, with a pointer to the full spec in `ENHANCEMENTS.md`. No existing Decision Layer / Planning / Rolling Debt Payoff descriptions were touched.

- **`SESSION_NOTES.md`** — this entry.

### Scope held

- Docs-only. No feature code, no help copy, no UI changes.
- No existing feature descriptions modified in any file.
- No new roadmap phases; these three items sit under the existing Planning / Decision Layer framing as queued product work, not new phases.
- Prioritization is pinned but non-blocking: the overlap cleanup and Next Actions stabilization work already in flight are unaffected.

### Files touched

- `ENHANCEMENTS.md`
- `PROJECT_CONTEXT.md`
- `SESSION_NOTES.md` (this entry)

---

## Recent — Next Actions v1 finalization (preview → real feature)

Removed all preview / temp / debug framing around Planning → Next Actions and promoted the surface to a real v1 feature. No backend logic changes in this pass (`getCashToUse()` and `getNextActionsData()` are untouched); no ranking, routing, or action-shape changes. Pure finalization / polish.

### What changed

- **Panel copy (`Dashboard_Body.html`)** — Dropped the `(preview)` suffix from the header, the `featured-preview` badge on the Planning entry point, and the long "Temporary developer preview of the Decision Layer backend" paragraph. New intro copy is one sentence: *"Your prioritized next steps across Bills, Upcoming, and Debts. Tap a card to open the related tool."* Updated the HTML comment blocks around the Planning hierarchy and the panel itself to describe the shipped surface instead of a temporary stepping stone.
- **Panel script (`Dashboard_Script_PlanningNextActions.html`)** — Renamed the top-level entry points so identifiers stop implying "preview":
  - `loadNextActionsPreview` → `loadNextActions`
  - `renderNextActionsPreview_` → `renderNextActions_`
  - `loadNextActionsLiquidityDebug_` → `loadNextActionsLiquidityDetails_`
  - `renderNextActionsLiquidityDebug_` → `renderNextActionsLiquidityDetails_`
  - Local `debugWrap` → `detailsWrap`
  - DOM id `next_actions_liquidity_debug` → `next_actions_liquidity_details`
  
  Updated the file header, section comments, and loading/error copy accordingly. The "Why this cash amount?" disclosure replaces the old `Liquidity details (debug) — cash_to_use $X` label; it stays collapsed by default and is visually quieter than before but still exposes the full per-account `getCashToUse()` breakdown on demand.
- **Render wiring (`Dashboard_Script_Render.html`)** — Updated the two `loadNextActionsPreview` callers (the Planning-page default-load guard and the per-tab-entry reloader) to the new `loadNextActions` name and cleaned the surrounding comments.
- **Styles (`Dashboard_Styles.html`)** — Dropped the now-unused `.planning-next-actions-feature .featured-preview` rule and the "Decision Layer cleanup" framing from the surrounding comment.
- **Backend header comment (`next_actions.js`)** — Replaced *"Decision Layer — v1 Next Actions aggregator (backend only)"* and the reference to "the temporary preview" with a plain *"Planning → Next Actions (v1) — backend aggregator"* header. Also trimmed the urgent-cap comment's "preview" wording.
- **In-app Help (`Dashboard_Help.html`)** — Added a new top-level TOC entry and full **Next Actions** section (`#help-next-actions`) between Planning and Debt Overview. Documents: summary-row math, Urgent / Recommended / Optimize rules (including the grouped "Other bills due soon" tail and the hard debt-balance cap on `pay_extra_debt`), Open-link routing table (Bills / Upcoming / Payoff / Debts), "Why this cash amount?" disclosure, and guardrails (no writes, no forecasts, explainability rule). Updated the Planning section intro to position Next Actions as the landing view.
- **Product docs (`PROJECT_CONTEXT.md`, `ENHANCEMENTS.md`)** — Flipped the Next Actions v1 and `cash_to_use` subsections from *"docs only; no code yet"* / *"Proposed"* to *"delivered"*, and updated the roadmap line (Phase 1 now ✅). Retained the design-note contract verbatim so the delivered spec is still grep-able.

### Liquidity details — disposition

Kept, not removed. The v1 surface now has a collapsed-by-default **Why this cash amount?** disclosure in place of the old debug panel. Rationale: `Cash to use` is the only figure in the summary row the user can't reproduce from other parts of the app (it's a conservative, buffer-respecting sum with explicit eligibility rules), and the per-account breakdown is how we explain *why* a given account was included or excluded. The disclosure is low-prominence (muted summary text, dashed top border, reduced opacity) so it does not compete with the primary actions.

### Scope held

- No changes to `getNextActionsData()`, `getCashToUse()`, or any ranking / cash-gap / extra-debt logic.
- No changes to `targetTab` routing, the grouped-urgent UI behavior, or the clickable-card wiring.
- No new actions, no new decision rules, no Planning-hierarchy redesign.
- No Rolling Debt Payoff edits.

### Files touched

- `Dashboard_Body.html`
- `Dashboard_Script_PlanningNextActions.html`
- `Dashboard_Script_Render.html`
- `Dashboard_Styles.html`
- `next_actions.js` (comments only)
- `Dashboard_Help.html`
- `PROJECT_CONTEXT.md`
- `ENHANCEMENTS.md`
- `SESSION_NOTES.md` (this entry)

---

## Recent — Liquidity model v1 (`cash_to_use`) design note (docs only)

Locks the liquidity contract consumed by Planning → Next Actions v1. No code changes in this pass. Full spec lives in `PROJECT_CONTEXT.md → Decision Layer → Liquidity model v1 — cash_to_use`; this entry is a short pointer.

### Key decisions recorded

- **Definition** — `cash_to_use` = conservative, buffer-respecting, current-state dollars safely available to act on recommendations **right now**. No forecasts, no future income, no credit lines, no investments.
- **Data sources** — Bank Accounts only (`INPUT - Bank Accounts` + `SYS - Accounts` mirror). Per-account fields read: `balance`, `minBuffer`, `active`, `usePolicy`. No new sheets / columns.
- **Core formula** — `usable = max(0, balance - minBuffer)` per account; `cash_to_use = Σ usable` across eligible accounts.
- **Eligibility** — include only active accounts (shared inactive rule); exclude restricted / do-not-use accounts; v1 Use Policy handling is simplified (include most, exclude only explicit restrictions). Finer-grained policies stay for a later phase.
- **Output model** — `{ cashToUse, accounts: [{ name, balance, minBuffer, usable, included, excludedReason? }] }`. Per-account breakdown is part of the contract so the UI can show *why* a number is what it is.
- **Usage in Next Actions** — compare `cashToUse` vs `sum(urgent)`; emit `review_cash_gap` when insufficient and suppress `recommended` money-movement until resolved; leftover feeds `pay_extra_debt` against the Rolling Debt Payoff focus debt.
- **Guardrails** — never negative contributions (clamped at 0 per account); buffers are sacred; no future-income / pending-transfer / timing assumptions; HELOC is not counted (surfaced separately via `review_heloc_strategy`).
- **Non-goals (v1)** — no forecasting, no time-based modeling, no cross-account optimization ("drain this first"-style logic is deferred to Phase 2 Cash Strategy).

### Why lock this now

Next Actions v1 already depends on the phrase *cash-to-use* in its deterministic rules (urgent-vs-cash comparison, `review_cash_gap` emission, leftover-for-recommended). Pinning the definition, formula, eligibility, and output shape **before** the backend aggregator is written keeps the Next Actions implementation thin and prevents the liquidity math from quietly drifting toward the richer Rolling Debt Payoff *Safe-to-use* model (which intentionally includes near-term holds, reserves, and unmapped card risk — those stay inside the Rolling Debt Payoff engine).

### Files touched

- `PROJECT_CONTEXT.md` — added "Liquidity model v1 — `cash_to_use`" subsection under Decision Layer, directly below the Next Actions v1 design note.
- `SESSION_NOTES.md` — this entry.
- `ENHANCEMENTS.md` — liquidity model listed as a prerequisite block inside the existing Tier 1 Next Actions enhancement.

No feature code, no existing feature descriptions changed.

---

## Recent — Next Actions v1 decision-logic design note (docs only)

Locks the backend contract and product rules for Planning → Next Actions **before** any UI is built. No code changes in this pass. Full spec lives in `PROJECT_CONTEXT.md → Decision Layer → Next Actions v1 — design note`; this entry is a short pointer.

### Key decisions recorded

- **Purpose** — answers *"what should I do next, in priority order?"* by interpreting existing data only. No writes.
- **Output model** — single compact action object: `priorityBucket`, `actionType`, `title`, `reason`, `amount`, `dueDate`, `sourceEntity {type,name}`, `target {page,tab}`.
- **Data sources (no new ones)** — Bills, Upcoming (remaining balance only), Debts, Bank Accounts / usable cash via the existing liquidity model, and the Rolling Debt Payoff recommendation. Next Actions **reuses** `getRollingDebtPayoffPlan`; it does not re-run the engine.
- **Priority buckets** —
  - `urgent` = overdue / due soon / unpaid minimums / near-term obligations / cash gap
  - `recommended` = next best moves once urgent is covered
  - `optimize` = optional improvements only after urgent is safe
- **Deterministic rules** — build urgent obligations first; compare `sum(urgent)` vs cash-to-use; emit `review_cash_gap` when obligations exceed cash; suppress `recommended` money-movement until the gap is resolved; the preferred extra-debt target is the Rolling Debt Payoff focus debt.
- **Action types (v1)** — `pay_bill`, `pay_debt_minimum`, `pay_upcoming`, `finish_upcoming`, `review_cash_gap`, `pay_extra_debt`, `review_heloc_strategy`.
- **Explainability rule** — every action must be describable in **one sentence** from current snapshot data; if not, it's not emitted.
- **Non-goals for v1** — retirement optimization, investment allocation advice, purchase simulation, scenario planning, automatic execution (Quick Add remains the single payment path; Next Actions only routes).

### Why lock this before UI

Next Actions is the new entry point inside Planning. Deciding the action object shape, the bucket rules, the cash-gap short-circuit, and the Rolling-Debt-Payoff reuse **now** keeps the eventual UI thin (it renders; it doesn't think) and keeps the backend contract stable before the first render lands.

### Files touched

- `PROJECT_CONTEXT.md` — added the "Next Actions v1 — design note" subsection under Decision Layer.
- `SESSION_NOTES.md` — this entry.
- `ENHANCEMENTS.md` — v1 design block added to the existing Tier 1 Next Actions entry (rules, action object shape, action types, non-goals).

No feature code, no existing feature descriptions changed.

---

## Recent — Decision Layer framing + Next Actions entry point (docs only)

Introducing a product framing shift — no code changes in this pass. The app now has two named layers:

- **Input / execution layer** — Bills, Upcoming, Debts, Bank Accounts, Investments, House Values / Expenses, Donations, Cash Flow (Quick Add), LOG - Activity. These are the source-of-truth editors and ledger. This layer is now considered **complete and consistent** after the recent cleanup passes.
- **Decision layer (Planning tab)** — answers *"what should I do next?"* by reading Bills, Upcoming, Debts, Bank Accounts, and Cash Flow. It is **not** a source-of-truth editor and **not** a ledger.

### Next Actions (Phase 1)

- **"Next Actions"** becomes the first / default sub-tab inside Planning and the primary entry point for users.
- Action-first (no editing), short lists only (3–5 items per section).
- Single payment path remains **Cash Flow → Quick Add**; Next Actions routes users there (and to source pages) rather than duplicating detail.

### Existing Planning tabs — unchanged

- **Debts**, **Retirement**, **Purchase Sim**, **Debt Overview**, **Rolling Debt Payoff** stay as they are and are re-framed as **tools / deep dives**.
- Intended flow: **Next Actions → drill into these tabs**.
- No new top-level tabs. No new dashboards stacked on top of Planning. No restructuring of existing tabs.

### Design principles (guardrails)

- Do not add multiple new top-level tabs.
- Do not overload Planning with dashboards.
- Keep Next Actions simple (3–5 items per section).
- Single payment path remains Quick Add.
- Decision layer does not create new data; it reads existing sources.

### Roadmap (intent only)

- **Phase 1 — Next Actions (v1)**
- **Phase 2 — Cash Strategy** (later)
- **Phase 3 — HELOC Advisor refinement** (later)

### Files touched

- `PROJECT_CONTEXT.md` — new "Decision Layer (product framing)" section.
- `SESSION_NOTES.md` — this entry.
- `ENHANCEMENTS.md` — new backlog item.

No feature code, no existing feature descriptions changed.

---

## Recent — upcoming_payment action label enrichment

Tightened the Activity label for `upcoming_payment` rows so the list shows the paid amount (and remaining balance) inline instead of a flat "Payment applied". Scope is label clarity only — no event-structure changes, no new fields, Amount column still renders **—** so the dollars aren't double-counted against the paired `quick_pay` row.

### Label format
Pulled from the existing details JSON (`paidAmount`, `remainingAfter`, `fullyPaid`) written by `appendUpcomingActivityPayment_`:
- `Applied $500.00 (Remaining $250.00)` — partial payment, row stays on the active board
- `Applied $500.00 (Fully paid)` — terminal payment, row dropped from the active board
- `Applied $500.00` — amount present but remaining missing (defensive fallback)
- `Payment applied` — legacy rows that predate the paid-amount details

### How it was wired
- `activityLogActionLabel_` now accepts an optional `detailsJson` second arg; only `upcoming_payment` consumes it. Every other event type still returns its static label (default arg ignored), so no other activity type changed.
- New private helpers in `activity_log.js`: `upcomingPaymentActionLabel_` (label builder), `activityLogAsFiniteNumber_` (safe coercion), `activityLogFmtMoney_` (server-side `$1,234.56` formatter, no Intl dependency).
- Single caller updated: `getActivityDashboardData`'s row emission passes the raw details string (column 11) alongside the event type. `classifyActivityKind_`, the Type filter, and `activityLogIsNonMonetaryEvent_` are untouched — the Amount column keeps rendering **—**.

### Files
- `activity_log.js` — `activityLogActionLabel_` gains an optional `detailsJson` arg; new `upcomingPaymentActionLabel_` + two small helpers; row emission passes details into the label helper.
- `Dashboard_Help.html` — Activity log section explains the new `upcoming_payment` label format and notes the fallback for legacy rows.

---

## Recent — Upcoming Expenses action-model cleanup

Simplified Upcoming into a true open-obligations board. The old multi-button status model (Planned / Paid / Skipped + Add to Cash Flow + Open in Quick add) created an overlapping second payment system; replaced it with a single payment path (Quick Add) plus an explicit Dismiss. Quick Add now carries the remaining balance back to the Upcoming row so partial payments shrink it in place and a full payment retires it automatically.

### New action model
- **Status is display-only** — `Planned` / `Paid` / `Dismissed` (legacy `Skipped` rows render the same as `Dismissed` for filtering and sort, not rewritten). The status buttons are gone.
- **Two action buttons** per row:
  - **Quick add payment** — hands off to the normal Quick Add flow with payee, due date, remaining amount, and (when the Account/Source is literally `CASH` or `CREDIT_CARD`) a flow-source hint pre-filled.
  - **Dismiss** — preserves the row and logs `upcoming_status` with `newStatus: Dismissed`. Legacy `Skipped` rows are treated as already-dismissed (idempotent no-op).
- **Active board filter** — `renderUpcomingList` now shows only `status === 'Planned' && amount > 0.005`. Paid, Dismissed, and (legacy) Skipped rows drop off automatically; they stay in the sheet + Activity log for history.

### Partial / full payment via Quick Add
- `prefillQuickPayment` stashes `window.__pendingUpcomingPaymentId` when the prefill includes `upcomingId`. `loadPaymentSection()` clears it on cold tab load; `savePayment` captures-and-clears it before firing `quickAddPayment` so a retry can't double-apply.
- On `quickAddPayment` success, `savePayment` chains `applyPaymentToUpcomingExpense(id, numericAmount)`. That backend call:
  1. Reads the row's current `Amount` (the live remaining balance).
  2. Subtracts the paid amount; clamps sub-penny results (`<= 0.005`) to 0 to avoid rounding-ghost balances.
  3. Writes the new remaining back to the `Amount` column (reuses existing currency format).
  4. Flips `Added To Cash Flow` → `Yes`.
  5. If `newRemaining <= 0`, flips `Status` → `Paid`; otherwise leaves it `Planned` so the row stays on the active board.
  6. Logs `upcoming_payment` with `paidAmount`, `remainingAfter`, and `fullyPaid` in details.
- Non-Planned rows short-circuit to a benign no-op so a stray callback can't resurrect a Paid/Dismissed row.

### Cash Flow + Activity are the only money trail
- `upcoming_payment` is **non-monetary** on the Activity sheet (Amount = 0, rendered as "—"). The dollar movement is the paired `quick_pay` row written by `quickAddPayment`. This prevents double-counting.
- Action labels (`activity_log.js → activityLogActionLabel_`):
  - `upcoming_add` → `Upcoming added`
  - `upcoming_payment` → `Payment applied`
  - `upcoming_status` → `Dismissed` (Dismiss is now the only writer)
  - `upcoming_cashflow` → `Pushed to cash flow` (legacy; no new rows emitted)
- `activityLogIsNonMonetaryEvent_` includes both `upcoming_status` and `upcoming_payment`.

### Removed / retired
- `updateUpcomingExpenseStatus`, `markUpcomingExpensePaid_`, `addUpcomingExpenseToCashFlow`, `addUpcomingExpenseRowToCashFlow_` — the entire legacy status-toggle + direct-push-to-Cash-Flow path. Replaced by `dismissUpcomingExpense` + `applyPaymentToUpcomingExpense` + Quick Add.
- Client-side `setUpcomingStatus`, `addUpcomingToCashFlow`, `openUpcomingInQuickPayment` — replaced by `dismissUpcoming` + `quickAddFromUpcoming`.
- No new `upcoming_cashflow` events are written. Historical rows still label and classify correctly.

### Not a change
- Canonical sheet `INPUT - Upcoming Expenses` — 11 fixed headers unchanged. The `Amount` column is now explicitly the **live remaining** balance (documented in Help); no new columns added.
- `getUpcomingExpenseMetrics_`, `getUpcomingBillsDueForDashboard`, `buildUpcomingExpensesSummary_`, and `rolling_debt_payoff.js` all filter on `status === 'Planned'` with `amount > 0.005`, so the auto-flip to Paid cleanly removes fully-paid rows from every downstream consumer without touching those readers.
- Summary / mini-card math still runs over Planned rows from the full dataset, so the Next 7 / Next 30 / Overdue / Total Planned counters match the active-board filter.

### Files
- `upcoming_expenses.js` — new `dismissUpcomingExpense`, `applyPaymentToUpcomingExpense`, `appendUpcomingActivityPayment_`; removed `updateUpcomingExpenseStatus` / `markUpcomingExpensePaid_` / `addUpcomingExpenseToCashFlow` / `addUpcomingExpenseRowToCashFlow_`; `getUpcomingExpenseForQuickPayment` now returns `upcomingId` + normalized `flowSource` hint; status-rank helpers know `Dismissed`.
- `activity_log.js` — `upcoming_payment` added to `activityLogIsNonMonetaryEvent_` and `activityLogActionLabel_`; `upcoming_status` label changed to `Dismissed` (only writer now).
- `Dashboard_Script_CashFlowUpcoming.html` — list filters to `Planned && amount > 0`; two buttons only (`Quick add payment`, `Dismiss`); new `quickAddFromUpcoming` / `dismissUpcoming` handlers.
- `Dashboard_Script_Payments.html` — `prefillQuickPayment` + `loadPaymentSection` manage `window.__pendingUpcomingPaymentId`; `savePayment` chains `applyPaymentToUpcomingExpense` after a successful Quick Add save originating from Upcoming.
- `Dashboard_Help.html` — Upcoming section rewritten to cover the open-obligations model, partial / full payment behavior, Dismiss, and the new Activity log conventions.

---

## Recent — Upcoming Expenses consistency cleanup

Tightened the Upcoming Expenses flow to match the canonical input-surface pattern now used by Bills / Debts / Houses / Investments / Bank Accounts — without expanding scope (no pulldowns from Accounts/Credit Cards yet, no schema changes). Focus: preserve the existing lifecycle model, close validation / loading-text / activity-log gaps.

### Audit — what is canonical and what reads it
- **Canonical sheet** — `INPUT - Upcoming Expenses` (11 fixed headers: `ID, Status, Expense Name, Category, Payee, Due Date, Amount, Account / Source, Auto Add To Cash Flow, Added To Cash Flow, Notes`). Self-heals via `getOrCreateUpcomingExpensesSheet_`.
- **Lifecycle model** — intentionally **`Status` column** (`Planned` / `Paid` / `Skipped`) rather than `Active`. Skipped rows stay on the sheet so history + ID are reserved. This was explicitly preserved per the consistency pass ground rules: consistency of behavior, not forcing identical columns across unrelated domains.
- **Backend writers** — `upcoming_expenses.js`: `addUpcomingExpense`, `updateUpcomingExpenseStatus`, `markUpcomingExpensePaid_`, `addUpcomingExpenseToCashFlow` / `addUpcomingExpenseRowToCashFlow_`. Cash Flow push goes through `quickAddPayment(..., suppressActivityLog: true)` so the `quick_pay` event is not duplicated alongside `upcoming_cashflow`.
- **Backend readers** — `getUpcomingExpensesUiData` (Upcoming panel), `getUpcomingExpenseMetrics_` (Overview snapshot cards via `dashboard_data.js`), `getUpcomingBillsDueForDashboard` (Bills Due joined list), `rolling_debt_payoff.js` (planned-expenses impact on the HELOC / cash bridge).
- **UI surfaces** — `Dashboard_Body.html` Upcoming panel (form + list + mini cards), Overview Next 7 / Next 30 / Overdue mini cards (same `summary` payload), Bills Due card. All are already tab-entry-refreshed (`billsDue`, `upcoming`) from a prior audit.

### Gaps found and closed
- **Validation was backend-only for Expense Name.** Empty name threw from the backend (`Expense Name is required.`) and surfaced as generic status text at the bottom of the form. Aligned to the Debts/Bills `field-error` pattern: `Dashboard_Body.html` gained `<div id="up_name_error" class="field-error" …>` and an `oninput` hook. `Dashboard_Script_CashFlowUpcoming.html` added `clearUpcomingAddNameError_` / `showUpcomingAddNameError_` / `isUpcomingNameRelatedError_` helpers. `saveUpcomingExpense` now validates Expense Name, Due Date, and Amount inline with focus-on-error before any `google.script.run` call, and name-related failures from the backend (e.g. future reservations) surface on the field-error div in addition to the status line.
- **Generic loading text replaced with action-specific `setStatusLoading` calls.** Matches the Debts / Bills convention (spinner + labeled status). Labels: **Saving upcoming expense…**, **Updating status…**, **Adding to cash flow…**. `setUpcomingStatus` previously had **no** loading text at all — users now get immediate feedback while the status flip runs.
- **Amount ≤ 0 guard moved to the client.** Backend still rejects, but users now see the inline error without a round-trip.
- **`upcoming_status` events no longer render a misleading dollar amount.** This is a lifecycle-only event; the actual money movement (if any) is logged separately as `upcoming_cashflow` when the Paid flow pushes to Cash Flow. Two changes:
  - `activity_log.js → activityLogIsNonMonetaryEvent_` now includes `upcoming_status`, so the Activity UI renders Amount as **—**, matching the `*_deactivate` convention used by every other input surface.
  - `upcoming_expenses.js → appendUpcomingActivityStatus_` now writes `amount: 0` to the sheet for `upcoming_status` rows (instead of echoing the row's planned amount). The underlying planned amount is still captured in the details JSON for auditing.
- **Activity action labels aligned.** `activity_log.js → activityLogActionLabel_` now returns `Upcoming added` / `Status changed` / `Pushed to cash flow` for `upcoming_add` / `upcoming_status` / `upcoming_cashflow` — previously blank. This is the same secondary-label pattern used by Bill / Debt / House / Investment / Bank events and makes same-kind events easy to disambiguate in the Activity list without touching the Type filter.

### Not a gap (verified)
- **Cross-panel refresh on Upcoming writes** — `saveUpcomingExpense`, `setUpcomingStatus`, and `addUpcomingToCashFlow` already call `loadUpcomingSection()`, `loadDashboardActionSections()`, and `refreshSnapshot()` on success. Tab-entry refresh for `upcoming` and `billsDue` is already wired in `Dashboard_Script_Render.html`. Debts / Debt Overview / Rolling Debt Payoff refresh on their own tab-entry (already in place), so a Cash Flow push from Upcoming that touches a debt balance via `quickAddPayment` → `adjustDebtsBalanceAfterQuickPayment_` is visible on navigation.
- **Schema / sheet safety** — no header changes, no row deletions, no renames. Historical rows and the `Skipped` soft-deactivate behavior are untouched.
- **React bundle** — Rolling Debt Payoff consumes `getUpcomingExpensesUiData` for planned-expense horizon classification. No changes needed; its input shape is unchanged.

### Files
- `upcoming_expenses.js` — `appendUpcomingActivityStatus_` logs `amount: 0` for lifecycle rows.
- `activity_log.js` — `activityLogIsNonMonetaryEvent_` includes `upcoming_status`; `activityLogActionLabel_` adds labels for all three upcoming events.
- `Dashboard_Body.html` — Expense Name field-error div + `oninput` clear hook.
- `Dashboard_Script_CashFlowUpcoming.html` — inline validation helpers, required-field guards with focus-on-error, `setStatusLoading` with action-specific labels, name-related error routing from the backend.
- `Dashboard_Help.html` — Upcoming expenses section rewritten to cover Lifecycle model, action-specific status messages, cross-panel refresh, and the non-monetary `upcoming_status` Activity convention.

---

## Recent — Cross-panel refresh audit (post-Debt Add race fix)

After fixing the Debts → Bills Due race condition, I swept the rest of the dashboard write paths looking for the same pattern — **a mutation in Panel A that affects data read by Panel B, where Panel B has its own loader that the write path doesn't call**. Two more gaps found and closed:

### Audit method
- Listed every `load…Section` / `load…Ui_` loader (20+ total across `Dashboard_Script_*.html`).
- Listed every `google.script.run.<mutator>` success handler in `Dashboard_Script_*.html` (add / deactivate / save / quickAddPayment / addBill / addHouseExpense / addDonation / addUpcomingExpense).
- Cross-referenced which sheets each mutator touches against which loaders read those sheets, and checked whether the success handler triggers the right loaders.

### Gap 1 — Quick Add payee dropdown stale after adding a debt or bill
- **Symptom** — `loadPaymentSection` (Quick Add) calls `getQuickAddPaymentUiData`, which returns the joined active bills + active debts list. The function is called **once at init** and never again, so adding a new debt from Planning → Debts or a new bill from Bills → Add new left the Quick Add **payee dropdown stale until a full page reload.**
- **Fix** — `Dashboard_Script_Render.html → showTab(name)` now calls `loadPaymentSection()` when `name === 'payments'`. Safe to call repeatedly: `loadPaymentSection` only resets the date field (to today) and clears the transient Flow Source prefill; it does not overwrite the Amount, Type, or Payee in-progress values the user may be editing. Same safety-net rationale as the `billsDue` / `upcoming` tab-entry refresh.

### Gap 2 — `addHouseExpense` with "Also add to Cash Flow" didn't refresh Bills Due / Upcoming
- **Symptom** — `house_expenses.js → addHouseExpense` writes a cell on the current year's **`INPUT - Cash Flow`** when the **Also add to Cash Flow** checkbox is on. Bills Due, Upcoming, and the Overview Next-7 sum all read that sheet — but the client-side `addHouseExpense` success handler (`Dashboard_Script_PropertiesHouseExpenses.html`) only called `loadRecentHouseExpenses`, `loadHouseExpenseSummaries`, and `refreshSnapshot`. Result: a house expense that *also* cleared an outstanding Cash Flow bill (e.g. Mortgage) would not drop off the **Bills Due → Next 7 Days** card until reload.
- **Fix** — the success handler now also calls `loadDashboardActionSections()` (Bills Due / Recurring / Manage) and `loadUpcomingSection()`. Both are wrapped in `try/catch` and guarded by `typeof === 'function'` so they degrade silently if a future refactor drops the loaders. Always called (not gated on the checkbox) because the refresh is cheap and avoids any future regression if the write path ever starts touching Cash Flow unconditionally.

### Debts tab safety net
- `showTab('debts')` now also re-runs `loadDebtSection()` on tab entry. This is defense-in-depth for cross-workflow adds (e.g. sidebar adds, scripted adds) — the in-panel add flow already triggers its own reload.

### Not a gap (verified)
- `quickAddPayment` — already calls `refreshSnapshot`, `loadUpcomingSection`, `loadDashboardActionSections`, `runDebtPlannerAfterQuickPayment_`. Comprehensive.
- `addBillFromDashboard` / `deactivateBillFromDashboard` — already call `loadDashboardActionSections` + `refreshSnapshot`. Quick Add is now covered by the tab-entry refresh.
- `addBankAccountFromDashboard` / `deactivateBankAccountFromDashboard` — bank changes affect Overview (handled by `refreshSnapshot`) and the Bank panel (handled by its own reload). No Cash Flow / Bills Due dependency.
- `addInvestmentAccountFromDashboard` / `deactivateInvestmentAccountFromDashboard` — same story.
- `addHouseFromDashboard` / `deactivateHouseFromDashboard` — already refresh Assets House Values + House Expenses selector + Overview snapshot. Property Performance tab re-fetches on tab entry via the existing `propertyPerformance` branch.
- `addDonation` — writes to `INPUT - Donations` only; no cross-panel dependency beyond Activity (which reloads on its own page entry).
- `addUpcomingExpense` / `updateUpcomingExpenseStatus` / `addUpcomingToCashFlow` — already call `loadUpcomingSection`, `loadDashboardActionSections`, `refreshSnapshot`.

### Files
- `Dashboard_Script_Render.html` (tab-entry refresh for `payments` + `debts` added; `billsDue` + `upcoming` already added previously).
- `Dashboard_Script_PropertiesHouseExpenses.html` (`addHouseExpense` success handler now reloads Bills Due + Upcoming).

---

## Recent — Debt Add/Stop now reloads Bills Due / Upcoming

- **Gap** — Even after `addDebtFromDashboard` began auto-seeding a Cash Flow Expense row, the **Bills Due → Next 7 Days** card still did not show the new debt until the whole app was reloaded. Root cause: `createDebtAccount` in `Dashboard_Script_PlanningDebts.html` only called `refreshSnapshot()`, which refreshes the Overview snapshot (`getDashboardSnapshot`), not the Bills Due / Upcoming panels. Those panels have their own loader, `loadDashboardActionSections()`, that fetches `getBillsDueFromCashFlowForDashboard`, `getRecurringBillsWithoutDueDateForDashboard`, and active bills data. Payment/skip flows already call `loadDashboardActionSections()` after success — the debt add flow was the odd one out.
- **Fix (action-side)** — `createDebtAccount` now calls `loadDashboardActionSections()` after `refreshSnapshot()` on success so the newly-seeded Cash Flow row appears in **Bills Due** and **Upcoming** immediately. `stopTrackingDebt` got the same treatment so deactivated debts drop out of the lists in the same render (they filter on Active).
- **Fix (tab-entry safety net)** — `Dashboard_Script_Render.html → showTab(name)` now **re-runs the loader whenever the user navigates into a data-driven tab**, matching the existing pattern for `houseExpenses`, `donations`, `debtPayoff`, and `rollingDebtPayoff`:
  - `name === 'billsDue'` → `loadDashboardActionSections()` (Bills Due / Upcoming fallback / Manage bills)
  - `name === 'upcoming'` → `loadUpcomingSection()`
  This means that even if a write path forgets to trigger a refresh (or a race in the success handler swallows it), simply clicking the tab pulls a fresh view. No more "refresh the whole app to see my new debt / bill."
- **Files** — `Dashboard_Script_PlanningDebts.html` (add + stop success handlers), `Dashboard_Script_Render.html` (tab-entry refresh for `billsDue` / `upcoming`).

---

## Recent — Debt Add auto-seeds INPUT - Cash Flow Expense row

- **Gap** — After the Debt consistency pass + form hardening, a freshly added debt with an Active flag and a Due day still did not appear on the **Bills Due → Next 7 Days** card. Root cause: `dashboard_data.js → getDebtBillsDueRows_` iterates **Expense rows on the current year's INPUT - Cash Flow tab** and joins back to `INPUT - Debts` by Payee. A new debt without a Cash Flow row has nothing to match against, so it never shows in Bills Due / Upcoming / overdue detection even though it is Active and has a Due day. (The planner email's Pay now / Pay soon block iterates `normalizeDebts_` directly, so it was already visible there — the dashboard card was the odd one out.)
- **Fix — system seeds the Cash Flow row on the user's behalf** — `debts.js → addDebtFromDashboard` now, after writing the `INPUT - Debts` row, also:
  - Resolves the current year's Cash Flow sheet via `tryGetCashFlowSheet_(ss, year)`; missing sheet → skip with a warning, never blocks the debt add.
  - Idempotency: `findCashFlowRowByTypeAndPayee_(sheet, 'Expense', accountName)` — if an Expense row for that Payee already exists, leave it alone (don't duplicate history).
  - Otherwise calls the existing `insertCashFlowRow_(sheet, 'Expense', accountName, flowSource)` helper. Flow Source is inferred the same way the Bills Due reader does it: `isDebtCreditCardType_(type)` → **`CREDIT_CARD`**, everything else (Loan / HELOC / Other) → **`CASH`**.
  - **Month cells stay blank.** `insertCashFlowRow_` copies formatting from the row above, `clearContent()`s the whole new row, then only writes `Type`, `Payee`, `Flow Source`, and `Active = YES`. No month seeding, no `$0.00`, no dashes. Bills Due still treats the current cycle as unhandled until an actual Quick Add / Bills Pay fills the month cell.
  - Never fatal: all Cash Flow seeding is wrapped in try/catch. On any failure the debt row itself is already on `INPUT - Debts` and the status line explains what happened.
- **Status feedback** — Return payload now carries `cashFlowRowSeeded: boolean` and `cashFlowSeedWarning: string`. The status message appended to the dashboard banner reflects which branch fired ("Seeded an Expense row…" vs "…already exists — left untouched" vs missing year tab).
- **Activity log** — `debt_add` Details JSON now includes `cashFlowRowSeeded` so the audit trail records whether the row was seeded, skipped as duplicate, or skipped because the year tab was missing.
- **Docs** — `Dashboard_Help.html` → **Debts — Update / Add new / Stop tracking** gained a **Cash Flow auto-seed** bullet describing the new behavior (including the "month cells stay blank" guarantee and the idempotency / missing-year-tab rules). `Dashboard_Body.html` info panel echoes the same explanation.
- **Files** — `debts.js` (`addDebtFromDashboard` Cash Flow seed + message + return payload), `Dashboard_Body.html` (info copy), `Dashboard_Help.html` (help bullet).

---

## Recent — Debt Add: all fields required + Type dropdown with "Other…"

- **Form** — On **Planning → Debts → Add new**, every input is now required: Account name, Type, Account balance, Minimum payment, Credit limit, Interest rate %, Due day of month. Labels no longer say "(optional)." Users enter **0** where a value does not apply (for example, Credit limit on a Loan / HELOC); the hint under Credit limit mentions this explicitly.
- **Type control** — Replaced the free-text input + `<datalist>` with a `<select>` populated from existing **INPUT - Debts** Type values (deduplicated, case-insensitive) plus a final **Other…** option. Selecting **Other…** reveals an inline text input (`debt_add_type_other`) for typing a brand-new type; the typed value is written as-is to the new row and will appear in the dropdown next time the panel refreshes.
- **Client validation** (`Dashboard_Script_PlanningDebts.html`) — `createDebtAccount` now runs a `requiredNum_` helper per field (blank → inline error + focus), plus explicit required checks for the Type selection (including the **Other…** new-type field) and Due day of month. `resetDebtAddForm_` resets the Type select back to the placeholder and clears the Other-type input.
- **Backend validation** (`debts.js → addDebtFromDashboard`) — `validateRequired_` now enforces `balance`, `minimumPayment`, `creditLimit`, `intRate`, `dueDay`; the old `parseOptional*` helpers were replaced with `parseRequiredNonNegative_`, `parseRequiredPercent_`, and `parseRequiredDueDay_` that throw field-specific "is required" errors on blank payloads. Credit Left is unconditionally derived as `round2_(creditLimit − balance)`; the row-writer no longer guards per-field `!== null` since every value is present.
- **Activity log** — `debt_add` Amount always shows the supplied opening balance (may be `$0.00` if the user enters 0); the conditional `balance !== null ? balance : 0` fallback was removed.
- **Docs** — Dashboard Help (**Debts — Update / Add new / Stop tracking** + **Activity → debt_add**) updated to describe required fields, the new Type dropdown + **Other…** behavior, and the clarified Amount semantics.
- **Files** — `Dashboard_Body.html`, `Dashboard_Script_PlanningDebts.html`, `debts.js`, `Dashboard_Help.html`.

---

## Recent — Debt Overview now respects Active

- **Regression** — Stop-tracked debts kept showing up on **Planning → Debt Overview** (bar chart + table) even though `normalizeDebts_` was correctly flagging them as inactive. Root cause: `getDebtPayoffReadData()` in `debt_payoff_projection.js` mapped `debtsOut` from *all* normalized debts without filtering by `d.active`, so inactive rows still made it onto the chart / table / "longest payoff" callout.
- **Fix** — `debtsOut` now filters to `d.active === true` before the `.map`. `totalDebtBalance` also adds an `d.active` guard to the `balance > 0` filter so the summary lines up with the list. `findLongestRoughPayoff_` iterates `debtsOut` (already filtered) so "Longest estimated payoff" won't be an inactive debt either. Recommendations in `buildDebtPayoffRecommendations_` were already filtering by `d.active`, so no change there.
- **Rolling Debt Payoff** — Unchanged. Its ~20 internal consumers (`rolling_debt_payoff.js`) already respect `d.active`, and `normalizeDebts_` correctly marks stop-tracked debts as inactive.
- **Files** — `debt_payoff_projection.js` (`getDebtPayoffReadData()` filters `debtsOut` + tightened `totalDebtBalance`).

---

## Recent — Debt Add polish: insertion position + derived Credit Left + PCT calc bug

- **Insert position** — New debts now land directly above the **TOTAL DEBT** summary instead of being appended at the bottom of the sheet (where they'd fall past the summary and any blank buffer rows). `findDebtTemplateRow_` now scans only rows above TOTAL DEBT so it correctly anchors the insert even when orphaned rows from earlier test inserts sit below the summary. `addDebtFromDashboard` switched from `sheet.appendRow(row)` to `sheet.insertRowAfter(templateRow)` + `setValues([row])`. The PASTE_FORMAT + row-height copy runs afterwards so the new row still inherits neighbor row formatting.
- **Acct PCT Avail bug** — `recalcDebtPctAvailForRow_` was incorrectly taking the "Credit Left / Credit Limit" branch even when Credit Left was blank (because `toNumber_('')` returns **0**, not NaN, so `!isNaN(creditLeft)` was always true). Fix: look at the raw cell value — a truly blank / null / undefined Credit Left cell now triggers the derivation branch `(Credit Limit − Balance) / Credit Limit`. Cards that *do* have Credit Left filled in still use that value directly, matching legacy behavior.
- **Credit Left is a derived field** — Removed the **Credit left (optional)** input from the Add form (both `Dashboard_Body.html` and `Dashboard_Script_PlanningDebts.html`): no more `debt_add_credit_left` field, no more `creditLeft` payload key, and a muted helper line under the Credit limit row ("Credit left is derived automatically (Credit limit − Account balance).") explains the new behavior. Backend `addDebtFromDashboard` now pre-populates Credit Left with `round2_(creditLimit − balance)` when both are provided so the new row reads like existing hand-entered rows; if either is blank, the cell is left blank and `recalcDebtPctAvailForRow_` falls back to the Credit Limit − Balance derivation. Help text for **Planning → Debts → Add new** updated to reflect the removed input.
- **Files** — `debts.js` (`recalcDebtPctAvailForRow_` blank-cell detection; `addDebtFromDashboard` derives `creditLeft` + `insertRowAfter(templateRow)`; `findDebtTemplateRow_` scans only above TOTAL DEBT), `Dashboard_Body.html` (dropped Credit left input, added derivation hint), `Dashboard_Script_PlanningDebts.html` (removed `debt_add_credit_left` from reset / payload / validation), `Dashboard_Help.html` (Add new bullet updated).

---

## Recent — Debt dropdown regression fix (legacy workbooks with no Active column)

- **Regression** — After the Debt Accounts consistency pass, the Planning → Debts dropdown only showed 8 of 22 credit cards on workbooks where the **Active** column hadn't been self-healed yet. Root cause: the new UI-read filter (`debts.js → isDebtRowInactive_`, `dashboard_data.js → isDebtSheetRowInactive_`) was applying the legacy `balance > 0 || minPayment > 0` fallback when the Active column was missing, which silently dropped every $0-balance / $0-min card. Pre-pass, `getDebtRows_()` did no active filtering at all — so this was a regression, not a preservation of prior behavior.
- **Fix — UI readers are explicit-only** — `isDebtRowInactive_` and `isDebtSheetRowInactive_` no longer apply the balance-based fallback. If the Active column is missing, both helpers return **false** (every debt is treated as active). Only explicit `No / n / false / inactive` counts as inactive. This restores the pre-pass dropdown / dashboard-aggregate behavior for untouched workbooks while keeping the stop-tracking soft-delete behavior intact for workbooks that have self-healed the column.
- **Planner still uses explicit-wins-with-fallback** — `planner_core.js → normalizeDebts_` is unchanged: when the Active column is missing it still derives `active = balance > 0 || minPayment > 0`. That's a planner/waterfall concern (skip dormant debts from rolling payoff math), not a dropdown-visibility concern, and it matches the pre-pass planner behavior exactly.
- **`getInactiveDebtsSet_`** — Inherits the explicit-only rule via `isDebtRowInactive_`, so it returns an empty set on legacy workbooks. No call sites needed changes.
- **`quick_add_payment.js → resolveFlowSourceFromBillOrDebt_`** — Already used an explicit-only inline check, so no change was needed there.
- **Files** — `debts.js` (tightened `isDebtRowInactive_` to explicit-only; updated file docstring and `getInactiveDebtsSet_` comment), `dashboard_data.js` (tightened `isDebtSheetRowInactive_` to explicit-only with updated docstring).

---

## Recent — Debt Accounts consistency pass: Active + Add new + Stop tracking

- **Canonical sheet, no mirror** — **INPUT - Debts** is the only debt sheet. There is no `SYS - Debts` mirror; the **Active** column is self-healed on the canonical sheet only. Unique key is **Account Name**; **TOTAL DEBT** is a reserved summary row that is never treated as a normal account and never stamped with Active.
- **Active semantics — explicit wins, fallback preserved** — New shared rule drives every debt reader (centralized in `debts.js → isDebtRowInactive_` / `getInactiveDebtsSet_`, `dashboard_data.js → isDebtSheetRowInactive_`, `planner_core.js → normalizeDebts_`, and an inline check in `quick_add_payment.js → resolveFlowSourceFromBillOrDebt_`):
  - If the **Active** column exists on the sheet (or any row exposes it via `readSheetAsObjects_`): explicit `No` / `n` / `false` / `inactive` (case-insensitive) → inactive; blank / unknown → active.
  - If the column is missing (legacy workbook): fall back to the original implicit rule — active iff `balance > 0 || minimumPayment > 0`. This keeps untouched workbooks behaving exactly like before until the column is self-healed.
- **Add new Debt Account** — New **Planning → Debts → Add new** segmented tab writes a row to **INPUT - Debts** with `Active = Yes`. Required: Account name + Type. Optional: Account Balance, Minimum Payment, Credit Limit, Credit Left, Int Rate, Due Date. Only canonical schema columns are written; no invented fields. Duplicate-name validation uses `getAllDebtAccountNamesIncludingInactive_` so stop-tracked names stay reserved; `TOTAL DEBT` is rejected as a reserved name. New rows inherit neighbor-row formatting (borders/font/number formats + row height) via `findDebtTemplateRow_` + `PASTE_FORMAT`; the **Active** cell is re-stamped with `writeActiveCellWithRowFormat_` (shared helper from `house_values.js`). `Acct PCT Avail` is recomputed immediately for the new row. Logs `debt_add` on **LOG - Activity** with Type **Debt**, Action **Account added**, Amount = opening balance (0 when none supplied).
- **Stop tracking Debt Account** — `deactivateDebtFromDashboard({ accountName })` flips `Active = No` on the matching **INPUT - Debts** row only; no delete, no rename, no touch of the TOTAL DEBT row. Fields, formulas, row height, and borders are preserved. Logs `debt_deactivate` on **LOG - Activity** (Type **Debt**, Action **Tracking stopped**, Amount **—**; `activityLogIsNonMonetaryEvent_` now returns true for `debt_deactivate`).
- **Filtered readers now respect Active** — `getDebtRows_` / `getDebtsUiData` (dashboard + sidebar dropdowns), `planner_core.js → normalizeDebts_` (drives Rolling Debt Payoff, debt projection, planner email, overdue / next 7), `dashboard_data.js → sumDebtBalances_`, `getHighUtilizationDebtIssues_`, `getDebtBillsDueRows_`, `getDebtPayeeMap_`, `quick_add_payment.js → adjustDebtsBalanceAfterQuickPayment_` and `resolveFlowSourceFromBillOrDebt_` all skip inactive debts via the shared rule. Intended side effect: inactive debts drop out of the waterfall, HELOC gate, focus/next-debt selection, payment windows, and liability summary — exactly what Stop tracking should do.
- **Intentionally unfiltered** — `activity_log.js → buildActivityKindLookup_` still reads every debt row (including inactive) so historical **quick_pay** / bill-related activity rows keep classifying correctly even after a debt is stop-tracked.
- **UI — parity with Bank Accounts / Investments / House Values** — `Dashboard_Body.html` Debts panel is now a segmented `Update` / `Add new` switch; Update has a secondary **Stop tracking** button next to **Save Debt Update**. Inline name-error slot (`debt_add_name_error`) + inline field validation (type, numeric fields, due day 1–31). Status text uses `Creating debt account…` and `Stopping tracking…`; success flips back to **Update** and preselects the newly created debt. The sidebar (`DebtsUI.html`) remains update-only (matching `BankAccountsUI.html` / `HouseValuesUI.html` / `InvestmentsUI.html`); inactive debts auto-drop from its dropdown via the now-filtered `getDebtsUiData`.
- **Activity Log classification** — `classifyActivityKind_` maps `debt_add` / `debt_deactivate` → **Debt**. `activityLogActionLabel_` → `Account added` / `Tracking stopped`. Amount rendering: `debt_deactivate` is non-monetary (**—**); `debt_add` follows the bank/investment/house pattern (opening balance or $0.00).
- **Backward compatibility** — Existing workbooks with no **Active** column keep working (legacy balance/minPayment fallback). The first `addDebtFromDashboard` / `deactivateDebtFromDashboard` call self-heals the column via `ensureDebtsActiveColumn_` (reusing a trailing empty header cell when possible). Existing rows keep blank **Active** and are treated as active until a user explicitly stop-tracks them.
- **Files** — `debts.js` (rewritten: `ensureDebtsActiveColumn_`, `isExplicitInactive_` / `isDebtRowInactive_` / `getInactiveDebtsSet_`, `getAllDebtAccountNamesIncludingInactive_`, `validateNewDebtAccountName_`, `addDebtFromDashboard`, `deactivateDebtFromDashboard`, `findDebtTemplateRow_`, `getDebtDistinctColumnValues_`; extended `getDebtsHeaderMap_` with Active; `getDebtRows_` filters via shared rule; `getDebtsUiData` now also returns `typeOptions`), `planner_core.js → normalizeDebts_` (explicit-wins-with-fallback active), `dashboard_data.js` (shared `isDebtSheetRowInactive_` helper; `sumDebtBalances_` / `getHighUtilizationDebtIssues_` / `getDebtBillsDueRows_` / `getDebtPayeeMap_` filter inactive), `quick_add_payment.js` (`adjustDebtsBalanceAfterQuickPayment_` + `resolveFlowSourceFromBillOrDebt_` skip inactive), `activity_log.js` (`debt_add` / `debt_deactivate` classification, action labels, `debt_deactivate` non-monetary, updated file docstring), `Dashboard_Body.html` (segmented Debts panel + Add form + Stop tracking button), `Dashboard_Script_PlanningDebts.html` (`setDebtPanelMode`, `createDebtAccount`, `stopTrackingDebt`, inline name-error helpers, `populateDebtAddDatalists_`, `loadDebtSectionThenSelect_`, action-specific status text), `Dashboard_Help.html` (Planning → Debts subsection + `debt_add` / `debt_deactivate` Activity bullets + Amount / Remove-button updates), `PROJECT_CONTEXT.md`, `TODO.md`.

---

## Recent — Bank Accounts final cleanup: SYS row formatting + Priority + activity Amount

- **SYS - Accounts row formatting inheritance** — `appendAccountsRowForNewBank_` now mirrors the Investments pattern: a new `findAccountsTemplateRow_` helper locates the last non-blank account row, then after `appendRow` we copy its format across the full row with `PASTE_FORMAT` and also carry over the row height via `setRowHeight(appendedRow, getRowHeight(templateRow))`. Borders, background, font, alignment, and number formats now match neighbor rows immediately after create. Currency formats on **Current Balance / Available Now / Min Buffer** are re-asserted as a safety net for older workbooks whose template row lacks currency formatting. Active re-stamp via `writeActiveCellWithRowFormat_` is preserved.
- **Priority field on Add new** — New numeric input `bank_add_priority` (type `number`, min **1**, max **99**, step **1**, **default 9**) in both `Dashboard_Body.html` and `PlannerDashboard.html`, placed directly after **Use policy** with a short muted hint ("Lower number = used earlier within its Use policy bucket. Default 9."). Client-side `createBankAccount` reads the value, defaults to 9 when blank, validates it's a whole number in range, and sends `priority` in the payload. `resetBankAddForm_` resets the field to `9`.
- **Priority — backend write** — `getAccountsHeaderMap_` now also exposes `priorityColZero` / `priorityCol` (optional — `-1` when the header isn't present). `addBankAccountFromDashboard` parses `payload.priority`, validates the 1–99 range, defaults to 9, and `appendAccountsRowForNewBank_(sheet, accountName, typeStr, policyStr, priorityNum)` writes it into the canonical **SYS - Accounts → Priority** column consumed by `planner_core.js → normalizeAccounts_`. Priority is **not** written to **INPUT - Bank Accounts** — that sheet's canonical schema is still Account Name + 12 months + Active, with no Priority column. The activity log Details JSON gained a `priority` field so the value is audit-traceable.
- **`bank_account_add` Amount fix** — Removed `bank_account_add` from `activityLogIsNonMonetaryEvent_` in `activity_log.js`. The Amount column now shows the supplied opening balance when one was provided (e.g. **$150.00**) instead of **—**; when no opening balance is provided it shows **$0.00**, consistent with `investment_add` / `house_add`. `bank_account_deactivate` stays non-monetary (still renders **—**), alongside `bill_deactivate`, `house_deactivate`, and `investment_deactivate`.
- **Files** — `bank_accounts.js` (`findAccountsTemplateRow_` helper; `appendAccountsRowForNewBank_` extended with `priorityNum` + neighbor row format copy + row height + currency safety net; `getAccountsHeaderMap_` extended with `priorityColZero` / `priorityCol`; `addBankAccountFromDashboard` parses/validates `priority` and includes it in activity Details), `activity_log.js` (dropped `bank_account_add` from `activityLogIsNonMonetaryEvent_`), `Dashboard_Body.html` + `PlannerDashboard.html` (new Priority `<input type="number">` with default 9 and hint), `Dashboard_Script_AssetsBankInvestments.html` + `PlannerDashboard.html` script (read/validate Priority in `createBankAccount`; reset to 9 in `resetBankAddForm_`), `Dashboard_Help.html` (Bank Accounts subsection gained Priority + row-formatting notes; `bank_account_add` activity bullet and Amount-column description updated), `PROJECT_CONTEXT.md` (Bank accounts entry, `activity_log.js` + `bank_accounts.js` summaries updated).

---

## Recent — Bank Accounts consistency cleanup: Active + Stop tracking + UX parity

- **Pattern parity with Houses / Investments** — **Assets → Bank Accounts** already had the **Update | Add new** segmented switch; this pass extended it with the same **Stop tracking** button in the Update panel (next to the existing Save action) + a new inline **name-error** slot below the Add-new Account name field + a controlled `<select>` for **Type** (replacing the free-text `<input list>`). Mirrored in both `Dashboard_Body.html` and `PlannerDashboard.html`.
- **Active column — storage + self-heal** — **Active** is stored in two places:
  - **INPUT - Bank Accounts** (canonical source of truth) — each Year block gains an **Active** header (column **14**, i.e. right after the 12 month columns) via `ensureBankAccountsActiveColumnForBlock_`. Existing year blocks without the column are self-healed the first time they are read/written.
  - **SYS - Accounts** (mirror) — the **Active** column is self-healed via `ensureAccountsActiveColumn_` (reuses an empty trailing header cell when available, otherwise appends a new column).
  - Both writes route through the shared `writeActiveCellWithRowFormat_` helper so the **Yes** / **No** cell inherits row-level text formatting (avoids the default tiny-text look).
- **Backward compatibility** — `getInactiveBankAccountsSet_` follows the shared rule: explicit **No / n / false / inactive** = inactive; blank / missing / unknown = **active**. This means existing workbooks with no **Active** column (or blank values) continue to show every account until the user explicitly stops tracking one.
- **Stop tracking** — `deactivateBankAccountFromDashboard({ accountName })` in `bank_accounts.js`:
  1. `setBankAccountActiveInAllBlocks_` walks every Year block via new `forEachBankAccountsYearBlock_`, self-heals each block's **Active** column, and writes **No** on every matching row.
  2. `setAccountsActiveValue_` mirrors **Active = No** on the matching row in **SYS - Accounts**.
  3. Month values, **Available Now**, **Min Buffer**, **Type**, **Use Policy**, and every historical row remain untouched; the name stays reserved against reuse.
  4. Logs **`bank_account_deactivate`** (Type **Bank**, Action **Tracking stopped**, Amount **—**). `touchDashboardSourceUpdated_('bank_accounts')` bumps the snapshot timestamp.
- **Add new — writes (unchanged behavior, now with Active)** — `addBankAccountFromDashboard` still writes **INPUT - Bank Accounts** + **SYS - Accounts** in a sequenced, roll-backable transaction; both writes now stamp **Active = Yes** via `writeActiveCellWithRowFormat_`. The existing opening-balance seed + `syncAllAccountsFromLatestCurrentYear_()` flow is preserved. Logs **`bank_account_add`** (at this point still non-monetary, Amount **—** — **superseded**: see **Bank Accounts final cleanup** at the top for the Amount fix).
- **Active filtering** — `getBankAccountUiData` now filters via `getInactiveBankAccountsSet_` so the **Bank Account** dropdown only shows active accounts. Duplicate-name validation still scans the unfiltered history so inactive names stay reserved.
- **Type field constraint (UX polish)** — The Add-new **Type** input was a free-text `<input list>`; now a `<select>` with a `— Select type —` placeholder and a short hint (`Choose from existing account types in SYS - Accounts.`). `populateBankAddDatalists_` fills the `<select>` options from `typeOptions` (preserving any currently selected value). The **Use Policy** field stays a datalist because policies are freer-form by design.
- **Inline name validation (UX polish)** — New `bank_add_name_error` slot + `clearBankAddNameError_` / `showBankAddNameError_` / `isBankNameRelatedError_` helpers mirror the Houses / Investments pattern. Name-related errors render inline (with red border + subtle glow on the input) instead of a popup; the error clears on input.
- **Action-specific status text (UX polish)** — Create flow now shows `Creating bank account…` via `setStatusLoading('bank_status', ...)`; Stop tracking shows `Stopping tracking…`. Generic "Loading…" text during Update-panel date/account changes is left alone.
- **Activity classification** — `activity_log.js` now recognizes `bank_account_deactivate` (Type **Bank**, Action **Tracking stopped**, Amount **—**) alongside the existing `bank_account_add`. At this point both were flagged non-monetary so Amount rendered as **—** instead of **$0.00**. **Superseded**: see **Bank Accounts final cleanup** at the top — `bank_account_add` is now monetary and renders the opening balance (or $0.00 when none was provided); `bank_account_deactivate` stays non-monetary.
- **Files** — `bank_accounts.js` (`deactivateBankAccountFromDashboard`, `setBankAccountActiveInAllBlocks_`, `setAccountsActiveValue_`, `forEachBankAccountsYearBlock_`, `ensureBankAccountsActiveColumnForBlock_`, `ensureAccountsActiveColumn_`, `getInactiveBankAccountsSet_`, extended `getAccountsHeaderMap_` for the **Active** column, filtered `getBankAccountUiData`, Active-stamping on `insertNewBankAccountHistoryRow_` + `appendAccountsRowForNewBank_`), `activity_log.js` (`bank_account_deactivate` classification + non-monetary flag), `Dashboard_Body.html` (Stop tracking button + inline name-error slot + controlled `<select>` for Type), `Dashboard_Script_AssetsBankInvestments.html` (`stopTrackingBank`, name-error helpers, `populateBankAddDatalists_` → select options, `createBankAccount` with action-specific loading text + inline error routing), `PlannerDashboard.html` (sidebar UI + handler mirror), `Dashboard_Help.html` (Bank Accounts + Bank Accounts Stop tracking subsections, Activity log bullets, Amount column non-monetary list), `PROJECT_CONTEXT.md` (Bank Accounts entry, LOG - Activity list, backend files list gained `bank_accounts.js`).

---

## Recent — Investments account-management v1: Add new + Stop tracking + Active + UX polish

- **Pattern parity with Bank Accounts / House Values** — **Assets → Investments** now has a **Update | Add new** segmented switch (same `bank-mode-wrap` / `segmented` classes, mirrored in `PlannerDashboard.html`). **Update** keeps the existing by-month value flow unchanged; **Add new** opens an inline form that writes the new account across **INPUT - Investments** and **SYS - Assets** in one transaction. **Update** also gained a secondary **Stop tracking** button next to **Save Investment**.
- **Add new — fields** — **Required:** Account name (validated for empty, too long, reserved, illegal characters, and duplicates across every **INPUT - Investments** year block *and* **SYS - Assets**, including inactive rows), Type (controlled `<select>` populated from distinct existing **SYS - Assets → Type** values — no free-text datalist). **Optional:** Starting value date + amount — must be provided together; the date must fall in the current year and seeds the amount into the matching month cell.
- **Add new — writes** — `addInvestmentAccountFromDashboard(payload)` in `investments.js` performs a sequenced, roll-backable write:
  1. **INPUT - Investments** — `insertNewInvestmentHistoryRow_` self-heals the current year-block's **Active** column (`ensureInvestmentsActiveColumnForBlock_`), copies format from a sibling row via `PASTE_FORMAT`, writes Account Name + Type + `Active = Yes`, and returns the row number for rollback.
  2. **SYS - Assets** — `appendAssetsRowForNewInvestment_` self-heals the **Active** column (`ensureAssetsActiveColumn_`), finds a neighbor template row via `findAssetsTemplateRow_`, copies formatting via `PASTE_FORMAT`, and writes Account Name + Type + Current Balance (starting amount or 0) + `Active = Yes`. Both Active writes route through the shared `writeActiveCellWithRowFormat_` so the **Yes** cell inherits row-level text styling.
  3. **Optional month-seed** — when a starting date + amount were supplied, `updateInvestmentHistory_` writes the value into the matching month column, then `syncAllAssetsFromLatestCurrentYear_()` refreshes SYS Current Balance.
  4. **LOG - Activity** — `appendActivityLog_` fires **`investment_add`** (best-effort).
  - Any failure after step 1 rolls back prior writes (`deleteAssetsRowByExactName_` + `invSheet.deleteRow(invRowNum)`) so partial state never lingers on the workbook.
- **Stop tracking** — `deactivateInvestmentAccountFromDashboard({ accountName })` walks every year block via `forEachInvestmentsYearBlock_` and `setInvestmentActiveInAllBlocks_` to flip **Active = No** on every matching **INPUT - Investments** row (canonical source of truth), then `setAssetsActiveValue_` mirrors **Active = No** on the single matching **SYS - Assets** row. Month values, Current Balance, Type, totals / delta rows, and the row itself stay untouched; the name stays reserved against reuse. Logs **`investment_deactivate`** with Type **Investment**, sub-label **Tracking stopped**, Amount **—** (added to `activityLogIsNonMonetaryEvent_`).
- **Active filtering** — New `getInactiveInvestmentsSet_` in `investments.js` is the shared rule for Investments (explicit **No / n / false / inactive** = inactive; blank / unknown = active). `getInvestmentUiData` now returns `{ accounts: activeOnly, typeOptions }` so the **Investment Account** dropdown only shows active accounts immediately after stop tracking. Duplicate validation still reads the unfiltered history via `getInvestmentsFromHistory_` + `assetExistsInAssetsSheet_` so inactive names remain reserved.
- **Type field constraint (UX polish)** — The Add-new **Type** input was originally a free-text input + datalist; now a `<select>` with a `— Select type —` placeholder and a short hint (`Choose from existing investment types in SYS - Assets.`). `populateInvestmentAddDatalists_` fills the `<select>` options from `typeOptions` (preserving any currently selected value). Backend contract unchanged — the handler still reads `.value` as a string.
- **Action-specific status text (UX polish)** — Create flow now shows `Creating investment account…` via `setStatusLoading('inv_status', ...)`; Stop tracking shows `Stopping tracking…`. The Update panel's generic "Loading…" label on date/account change was left alone.
- **Activity classification** — `activity_log.js` recognizes `investment_add` (Type **Investment**, Action **Account added**; Amount = starting value or 0) and `investment_deactivate` (Type **Investment**, Action **Tracking stopped**, Amount **—**).
- **Files** — `investments.js` (`addInvestmentAccountFromDashboard`, `deactivateInvestmentAccountFromDashboard`, `setInvestmentActiveInAllBlocks_`, `setAssetsActiveValue_`, `forEachInvestmentsYearBlock_`, `ensureInvestmentsActiveColumnForBlock_`, `ensureAssetsActiveColumn_`, `validateNewInvestmentAccountName_`, `assetExistsInAssetsSheet_`, `findLastInvestmentDataRowInBlock_`, `insertNewInvestmentHistoryRow_`, `findAssetsTemplateRow_`, `appendAssetsRowForNewInvestment_`, `deleteAssetsRowByExactName_`, `getInactiveInvestmentsSet_`, `getAssetsDistinctColumnValues_`, extended `getAssetsHeaderMap_` for the `Active` column, `getInvestmentUiData` returns active accounts + typeOptions), `activity_log.js` (`investment_add` / `investment_deactivate` classification + non-monetary flag on deactivate), `Dashboard_Body.html` (segmented switch + Add form with `<select>` Type + Stop tracking button in Update panel), `Dashboard_Script_AssetsBankInvestments.html` (`setInvestmentPanelMode`, `fillInvestmentAccountDropdownFromData_`, `populateInvestmentAddDatalists_` → select options, `createInvestmentAccount` with action-specific loading text, `stopTrackingInvestment`, inline `field-error` helpers), `PlannerDashboard.html` (sidebar UI + handler mirror), `Dashboard_Help.html` (Investments + Investments Stop tracking subsections, Activity log bullets, Type column pill, Sheet-names list gained **INPUT - Investments** and **SYS - Assets**).

---

## Recent — House stop-tracking (soft sale) + Active-cell formatting + Property Performance filter

- **Stop tracking in House Values** — **Assets → House Values → Update** now has a secondary **Stop tracking** button next to **Save House Value** (mirrored in the sidebar `PlannerDashboard.html`). Follows the Bills soft-delete pattern: no hard delete, no rename, no new sale fields.
- **Backend entry point** — `deactivateHouseFromDashboard({ houseName })` in `house_values.js`. Sequence:
  1. `setHouseActiveInAllHouseValuesBlocks_` walks every `Year` block via a new `forEachHouseValuesYearBlock_` iterator, self-heals each block's **Active** column (`ensureHouseValuesActiveColumnForBlock_`), and writes **No** on every data row whose House column matches (case-insensitive) — canonical source of truth across multi-year storage.
  2. `setHouseAssetsActiveValue_` mirrors **Active = No** on the single matching row in **SYS - House Assets**.
  3. Activity log fires `house_deactivate` (best-effort); `touchDashboardSourceUpdated_('house_values')` bumps the snapshot timestamp.
- **Preserves history** — Month values, **Loan Amount Left**, **Current Value**, **Type**, the **HOUSES - {House}** sheet, and every historical row stay untouched. Only the **Active** cell changes. Duplicate-name validation still blocks reuse of stop-tracked names (`getHousesFromHouseValues_` is unfiltered by design).
- **Active-cell formatting cleanup** — New `writeActiveCellWithRowFormat_` helper copies format from column 1 of the same row (`PASTE_FORMAT`) + forces `@` number format before writing **Yes** / **No**, so the Active cell inherits row-level text styling instead of defaulting to the workbook's baseline tiny text. Used by both the deactivate path *and* retrofitted into `insertNewHouseHistoryRow_` (new `Active=Yes` in **INPUT - House Values**) and `appendHouseAssetsRowForNewHouse_` (re-stamps **Active=Yes** after the whole-row format copy in **SYS - House Assets**).
- **Activity classification** — `activity_log.js` recognizes `house_deactivate`: **Type** = **House Expenses**, **Action** sub-label = **Tracking stopped**, **Amount** renders as **—** (added to `activityLogIsNonMonetaryEvent_` alongside `bill_deactivate` / `bank_account_add`).
- **UI refresh on success** — `stopTrackingHouse()` in `Dashboard_Script_AssetsHouseValues.html` confirms inline (`window.confirm`), calls `setStatusLoading('house_status', 'Stopping tracking…')`, then on success refreshes the Update dropdown (`loadHouseSection`), clears the info panel (`loadHouseData`), refreshes **Properties → House Expenses** (`loadHouseExpensesSection`), and calls `refreshSnapshot`. Sidebar (`PlannerDashboard.html`) has a matching handler.
- **Active-house filter consumers** — `getInactiveHousesSet_` (added in a prior pass) is the shared rule: explicit **No / n / false / inactive** = inactive; blank / unknown = active for backward compatibility. Reused by `getHouseUiData` (Update dropdown), `getHouseExpenseUiData` (House Expenses selector), and — new in this pass — `getHouseNamesFromHouseAssets_` in `property_performance.js`. Property Performance rows + portfolio mini-cards (`equity`, `rent`, `expenses`, `netCash`) now exclude inactive houses; totals stay aligned because they're summed from the filtered row set.
- **Styling** — Minimal additions: `.house-update-actions` (flex column, 8px gap) in `Dashboard_Styles.html` + sidebar `<style>`. Stop tracking button uses existing `.small-btn` treatment (neutral secondary).
- **Files** — `house_values.js` (`deactivateHouseFromDashboard`, `setHouseActiveInAllHouseValuesBlocks_`, `setHouseAssetsActiveValue_`, `forEachHouseValuesYearBlock_`, `writeActiveCellWithRowFormat_`; retrofitted `insertNewHouseHistoryRow_` + `appendHouseAssetsRowForNewHouse_`), `property_performance.js` (`getHouseNamesFromHouseAssets_` now filters via `getInactiveHousesSet_`), `activity_log.js` (`house_deactivate` classification + non-monetary flag), `Dashboard_Body.html` (`.house-update-actions` wrap + Stop tracking button in Update panel), `Dashboard_Styles.html` (`.house-update-actions` rule), `Dashboard_Script_AssetsHouseValues.html` (`stopTrackingHouse()` handler), `PlannerDashboard.html` (sidebar UI + handler mirror + `.small-btn` / `.house-update-actions` CSS), `Dashboard_Help.html` (House Values "Stop tracking" subsection, Activity log `house_deactivate` bullet, Remove button greyed list, Property performance "Active houses only" subsection).

---

## Recent — Assets → House Values: Add new house + integration polish

- **Pattern parity with Bank Accounts** — **Assets → House Values** now has a **Update | Add new** segmented switch (same `bank-mode-wrap` / `segmented` classes). **Update** keeps the existing valuation-by-date flow unchanged; **Add new** opens an inline form that writes a new house across all three canonical sheets in one transaction.
- **Add new — fields** — **Required:** House name (max 120), Property type (max 80, datalist suggestions from distinct **SYS - House Assets → Type** values), Current value, Loan amount left. **Optional:** Valuation date (defaults to today; must fall in current year; seeds the Current value into that month cell).
- **Add new — writes** — `addHouseFromDashboard(payload)` (`house_values.js`) performs a sequenced, roll-backable write:
  1. **INPUT - House Values** — inserts a new data row in the current-year block (format copied from a sibling row via `PASTE_FORMAT`). Column **1 = House**, column **2 = Loan Amount Left** (currency-formatted), month columns left blank.
  2. **SYS - House Assets** — appends a row with **House / Type / Loan Amount Left / Current Value**. Row formatting (borders, backgrounds, number formats, row height) is copied from the last existing data row via `findHouseAssetsTemplateRow_` + `PASTE_FORMAT`; currency format is re-asserted as a safety net.
  3. **Optional month-seed** — when a valuation date was provided and Current value ≠ 0, `updateHouseValuesHistory_` writes the value into the matching month column, then `syncAllHouseAssetsFromLatestCurrentYear_()` updates SYS Current Value (Type and Loan Amount Left are still never overwritten by this sync).
  4. **HOUSES - {House} sheet** — created (only when missing) with canonical headers: `Year | <currentYear>` (row 1) and `Item | Type | Date | Location | Cost | Service Fees Paid | Insurance covered | Payments Links | Notes` (row 2). Frozen rows = 2.
  5. **LOG - Activity** — `appendActivityLog_` fires a **`house_add`** event.
  - Any failure after step 1 **rolls back** prior writes (INPUT row delete, SYS row delete, HOUSES sheet delete) so partial state is not left on the workbook.
- **HOUSES - {House} formatting** — `createHousesExpenseSheet_` finds an existing `HOUSES - *` template via `findExistingHousesTemplateRows_`, copies header/year-row formatting, and copies **column widths** for columns 1–9 via `copyHousesColumnWidths_` so the new sheet visually matches the rest of the portfolio. Fallback formatting (`applyHousesYearRowFallbackFormat_` / `applyHousesHeaderRowFallbackFormat_`) only runs when the workbook has no existing HOUSES sheet.
- **Duplicate-name validation** — `validateNewHouseName_` rejects empty, too-long, reserved, illegal (`: \ / ? * [ ]`), or duplicate names by scanning **INPUT - House Values**, **SYS - House Assets**, and all existing `HOUSES - *` sheet names. Client surfaces the error inline in a new **`.field-error`** block placed immediately below the House name input (not a popup), with a red border + subtle glow on the input (`input.field-error-input`), and focuses + selects the field so the user can edit directly. The error clears on input.
- **House Expenses selector refresh** — `Dashboard_Script_Render.html → showTab('houseExpenses')` now calls `loadHouseExpensesSection()` on every navigation (mirroring the existing `propertyPerformance` pattern). `createHouse()` also proactively calls it on success. The selector is driven off live `ss.getSheets()` filtered by `HOUSES - ` prefix (`getHouseExpenseUiData` in `house_expenses.js`), so the new house appears without a page reload.
- **Activity classification** — `activity_log.js` recognizes **`house_add`**: **Type** = **House Expenses**, **Action** sub-label = **House added**, **Amount** = initial Current Value.
- **Files** — `house_values.js` (`addHouseFromDashboard`, `validateNewHouseName_`, `insertNewHouseHistoryRow_` with loan col, `appendHouseAssetsRowForNewHouse_` with neighbor format copy + `findHouseAssetsTemplateRow_`, `createHousesExpenseSheet_` with `copyHousesColumnWidths_`, `findExistingHousesTemplateRows_`, rollback helpers), `activity_log.js` (house_add classification), `Dashboard_Body.html` (segmented switch + Add form markup + inline field-error node), `Dashboard_Script_AssetsHouseValues.html` (`setHousePanelMode`, `populateHouseAddDatalists_`, `resetHouseAddForm_`, `createHouse`, name-error helpers, House Expenses refresh on success), `Dashboard_Script_Render.html` (refresh `loadHouseExpensesSection` on tab nav), `PlannerDashboard.html` (sidebar mirror of UI + JS), `Dashboard_Styles.html` + sidebar `<style>` (`.field-error` / `input.field-error-input` styles), `Dashboard_Help.html` (House Values, Activity log, Properties, HOUSES sheet, Sheet names sections).

---

## Recent — Bills page: Manage bills, Flow Source, header tolerance

- **Bills page split** — The Cash Flow **Bills** panel is now an internal two-view surface with a lightweight segmented switch: **Due this period** (execution, unchanged behavior — Pay / Skip on dated cards) and **Manage bills** (new table over **INPUT - Bills** with inline sortable **Payee** / **Due Day** columns; default sort Due Day ascending). Heading renamed from "Bills Due" to **Bills** in both the TOC and the section header; anchors (`#help-bills-due`) preserved. Segmented switch restyled as inline buttons with a subtle inactive state (CSS: `.bills-view-switch`, `.bills-view-switch-btn`; container styling removed).
- **Manage bills actions**
  - **Add bill** opens an inline form that writes a new row to **INPUT - Bills** via `addBillFromDashboard` (`bills.js`). Required fields: **Payee**, **Category**, **Due Day**, **Default Amount**, **Payment Source** (CASH / CREDIT_CARD). Optional: **Frequency**, **Start Month**, **Varies**, **Autopay**, **Notes**. Client and server both enforce **Category** (dedicated error, not the generic "missing field" message).
  - **Stop tracking** sets **Active = No** on the INPUT - Bills row (never deletes). Bill stays in the sheet for history/audit.
- **Flow Source on Bills → Pay** — New Cash Flow rows created from a Bills pay action now populate **Flow Source** from **INPUT - Bills.Payment Source**. Debt-backed bills (no INPUT - Bills row) infer **CREDIT_CARD** when the debt **Type** is Credit Card, else **CASH**. Implementation: UI passes `flowSource` through `window.__pendingQuickAddFlowSource` → `savePayment` → `quickAddPayment`, and a server-side fallback `resolveFlowSourceFromBillOrDebt_` in `quick_add_payment.js` derives it from `INPUT - Bills` / `INPUT - Debts` for any caller that loses the field in transit (sidebar dashboard, upcoming auto-writes, stale client bundles).
  - **Existing rows** are never silently overwritten. Flow Source is only filled on existing rows when the caller explicitly provided it.
  - **Months before Start Month** stay blank on new rows — no backfill, no zero, no dash.
- **Header tolerance (case + trailing spaces)** — Real workbooks ship **INPUT - Bills** with variant headers such as `PAYMENT SOURCE` or `Payment Source ` (trailing space). `indexOf` was returning -1 on reads, silently blanking `paymentSource` downstream and leaving Flow Source empty on created Cash Flow rows. Fix: `bills.js`, `dashboard_data.js` (`getInputBillsDueRows_`), and `quick_add_payment.js` (`resolveFlowSourceFromBillOrDebt_`) now normalize both the sheet header and the lookup label with `trim().toLowerCase()` before matching.
- **Self-heal INPUT - Bills** — `addBillFromDashboard` auto-inserts any missing optional columns (**Payment Source**, **Category**, **Frequency**, **Start Month**, **Notes**) before writing a new row, so new installs / older workbooks don't silently drop fields.
- **Activity log — bill lifecycle** — `bill_add` fires on successful Add bill; `bill_deactivate` fires on Stop tracking. Both render on the **Activity** page with Type **Bill** and Action sub-labels (**Bill added** / **Tracking stopped**). Tracking stopped shows **—** in the Amount column because no money moved.
- **Help refactor (Dashboard_Help.html)** — Readability pass only (no behavior changes). Shorter paragraphs, per-section subheads (**What it does / What gets logged / What the buttons do / What the numbers mean / Notes**), bullets over prose. Most-reshaped sections: Activity log, Bills, Rolling Debt Payoff, Debt Planner email, Sheet names. All 15 section anchors preserved (`help-intro` … `help-sheets`).
- **Files** — `bills.js` (new; `addBillFromDashboard`, `deactivateBillFromDashboard`, `headerIndex_` helper, self-heal), `dashboard_data.js` (`getInputBillsDueRows_` header tolerance + `Start Month` hard-skip guard), `quick_add_payment.js` (`resolveFlowSourceFromBillOrDebt_` + `callerProvidedFlowSource` guard on existing rows), `Dashboard_Script_BillsDue.html` (internal view switch, Manage table, Add bill form, inline sort), `Dashboard_Script_Payments.html` (`window.__pendingQuickAddFlowSource` plumbing), `Dashboard_Body.html` (Bills page markup + Add bill form), `Dashboard_Styles.html` (inline segmented switch, sort headers), `activity_log.js` (`bill_add` / `bill_deactivate` Type + Action rendering), `Dashboard_Help.html` (readability refactor; Bills section retitled).

---

## Recent — Rolling Debt Payoff: Standard-mode UX sweep

- **Two Planning tabs, clear split** — **Debt Overview** (renamed from the old "Payoff Path") is a read-only reference view of balances/minimums/APRs and estimated payoff at current minimums; **Rolling Debt Payoff** is the monthly decision engine. Help **Planning**, **Debt Overview**, and **Rolling Debt Payoff** sections updated to reflect the split.
- **Standard vs Details mode** — Rolling Debt Payoff opens in a compact decision layout; a single **Show details / Hide details** toggle reveals the full planner report (cash bridge audit, allocation audit, 12-month table, yearly projection, diagnostics, JSON). Replaces the previous "Include DEBUG DETAILS" checkbox wording.
- **User-facing waterfall role names** — `CompactPaymentResultRoleKey` stays `Cleanup | Primary | Secondary | Overflow` internally, but the Standard view labels rows via `PAYMENT_RESULT_ROLE_LABEL` as **Small balance**, **Focus debt**, **Next debt**, and **Excess** (same rename reflected in allocation audits, progress bars, extras section copy, and audit tables). Help **Rolling Debt Payoff** documents the mapping.
- **Narrative decision card** — New `CompactDecisionCard` renders three lines: **Recommendation** (what to do), **Why** (short reason), **Caution** (near-term risk / why conservative). Driven by the same planner JSON (`action_decision_box` + context).
- **HELOC card — "What would change this?"** — Compact HELOC advisor card lists the actionable levers (APR spread, eligible-debt threshold, upcoming-expense hold, recurring monthly repayment) with current values anchored inline so the user sees what drives the recommendation.
- **Payment result enhancements** — Compact table with the four columns (Account + role / Action / Remaining / Add payment):
  - **Action wording** — `'Closed' | 'Paid down'` → **'Paid off (this month)' | 'Partially paid'**. Green tone on the paid-off row updated to match.
  - **[Add payment] pill** — Per-row button (only when `row.paid > 0`) calls host `window.prefillQuickPayment({ entryType: 'Expense', payee: row.account, entryDate: today, amount: Math.round(row.paid) })` to open **Cash Flow → Quick add** pre-filled. Hidden in standalone contexts (no `prefillQuickPayment` global). Quick add preview stays visible after prefill so the user can accept/adjust.
  - `CompactPaymentResultRow` gained a public `paid` field (replaces the stripped `_paid`); overflow footer `colSpan` is dynamic (3 or 4).
- **"Why not more?" block** — Renders the two holds (Near-term planned hold, Unmapped card risk hold) as wide text rows; each exposes an inline **[View]** pill that routes to **Cash Flow → Upcoming** via `window.showPage('cashflow')` + `window.showTab('upcoming')` when the hold is materially driven by upcoming planned expenses. The second bullet only shows the [View] pill when `unmappedCardRiskHold` is upcoming-fed; otherwise it stays plain text. Inline styles explicitly reset conflicting host CSS (`width`, `margin`, `background`, `color`, `border-radius`) so the pills render consistently inside the React bundle embedded in the host page.
- **Anchored HELOC bullets, stable header** — Header copy no longer flickers when inputs change; HELOC `What would change this?` bullets are stable (single ordered list keyed by lever).
- **Files** — `components/RollingDebtPayoffDashboard.tsx` (Standard-mode cards, payment-result column, role labels, action wording, host navigation callbacks), `RollingDebtPayoffDashboardBundle.html` (rebuilt), `Dashboard_Help.html` (§ Rolling Debt Payoff rewritten + Debt Overview section), `Dashboard_Styles.html` (added `.help-section h4` rule for subsection headings).
- **Host integration** — `window.prefillQuickPayment` lives in `Dashboard_Script_Payments.html`; `window.showPage` / `window.showTab` in `Dashboard_Script_Render.html`. The React component calls these defensively and silently no-ops in standalone environments. `npx tsc --noEmit -p tsconfig.rolling-dashboard.json` and `npm run build:rolling-dashboard` pass.

---

## Recent — Status targets + Help Upcoming

- **Debt Planner email — Pay now / Pay soon** — Merges **INPUT - Bills** (same dated, unhandled rows as Bills Due) with **INPUT - Debts** minimums via `buildInputBillPlannerPaymentWindows_` + `mergeDebtAndBillPaymentWindows_` in `code.js` / `dashboard_data.js` / `planner_core.js`. Totals, `buildActionPlan_`, history, and email use the merged lists; dedupe key is `normalizeBillName_(account)|dueDate` (debt row wins). Email lines for `type === 'Bill'` omit the word “min”. Help **Debt Planner email** updated.
- **Product name** — Web dashboard and sidebar HTML titles rebranded to **CashCompass**; tagline *Guiding your money decisions.* Sheet menu: **Open CashCompass (sidebar)** / **Open CashCompass Web** / **Set CashCompass Web App URL**. Script property key `PLANNER_DASHBOARD_WEBAPP_URL` unchanged. `Dashboard_Body.html`, `PlannerDashboard.html`, `dashboard.js`, `webapp.js`, `code.js`, Help, `PROJECT_CONTEXT.md`, `FIRST_RUN.md`.
- **Logo** — Top bar shows tight-cropped **CashCompass** mark: **PNG** embedded as `data:image/png;base64,…` in `Dashboard_Body.html` (256px max dimension for bundle size). Source files: `assets/CashCompass-logo-cropped.png`, `assets/CashCompass-logo-cropped-256.png`. Framed in `product-logo-wrap` (`Dashboard_Styles.html`). Apps Script `doGet` does not serve standalone images; inline data avoids extra hosting.
- **Overview — Suggested Actions vs Issues** — `buildSuggestedActions_` no longer copies the top 3 `issues` (removes duplicate utilization lines). Suggested Actions keeps cash-flow / runway / retirement nudges only. Hint under **Suggested Actions** when issues exist: points to **Issues** (no numeric count — full `issues` list mixes severities and types). `dashboard_data.js`, `Dashboard_Script_Render.html`, `Dashboard_Body.html`, `Dashboard_Styles.html`, Help **Overview**.
- **INPUT - Bills Default Amount 0** — `getInputBillsDueRows_` no longer skips zero defaults; bills still show in Overdue / Next 7 when the Cash Flow cell is unhandled. Autopay only runs when **Default Amount > 0**. `dashboard_data.js`; Help **Bills Due**; `PROJECT_CONTEXT.md`.
- **Bills Due load failure** (`loadBillsDueUi_`) → **`bills_due_status`** (was `planner_status`). Overview Bills card still shows the same error text in the summary. `Dashboard_Script_BillsDue.html`.
- **Debt planner after Quick add** (`runDebtPlannerAfterQuickPayment_` failure) → **`pay_status`** (was `planner_status`). `Dashboard_Script_Payments.html`.
- **Help**: **Upcoming expenses** section + TOC; Cash Flow intro links to Upcoming / Donations / Bills Due; **Bills Due** documents load errors under the panel heading; sheet list includes **INPUT - Upcoming Expenses**. `Dashboard_Help.html`.

---

## Recent — Quick add wording + Activity page

- **Quick add** (UI) vs **`quick_pay`** (sheet event): aligned across `TESTING_PLAN.md`, `GoingToProduction.md`, `TODO.md` (incl. `planner_status` inventory #19), `PROJECT_CONTEXT.md`, `SESSION_NOTES.md`, `Dashboard_Help.html`, `activity_log.js` header comment.
- **Activity** (`Dashboard_Body.html` `#page_activity`): removed redundant intro paragraph; full explanation stays in **Help → Activity log**. Removed unused `.activity-intro` from `Dashboard_Styles.html`.

---

## LOG - Activity (audit log)

- **Tab**: `LOG - Activity` — created on first log if missing; header row: Logged At, Event Type, Entry Date, Amount, Direction, Payee, Category, Account / Source, Cash Flow Sheet, Cash Flow Month, Dedupe Key, Details.
- **Phase 1**: `quick_pay` after successful `quickAddPayment` (`quick_add_payment.js`); Details JSON includes previous/new cell values, signed amount, `createIfMissing`, optional debt balance note. Payload may set **`suppressActivityLog: true`** when a higher-level flow already logged the action (e.g. **House Expense** saves that also post to Cash Flow — avoids a second `quick_pay` row next to `house_expense`).
- **Phase 2**: `bill_skip` when Bills Due skip writes **0** into Cash Flow (`skipDashboardBill` in `dashboard_data.js`); `bill_autopay` after INPUT - Bills autopay write; **dedupe** on `bill_autopay::…` so dashboard refresh does not duplicate rows (`buildBillAutopayDedupeKey_`, `activityLogDedupeKeyExists_`).
- **Phase 4**: `house_expense` after **`addHouseExpense`** (`house_expenses.js`); **Category** on the log row matches the House Expenses form **Type** (Repair, Maintenance, Utilities, etc.; stored **Tax** → **Property Tax** in the Activity **Type** column).
- **Server**: `activity_log.js` — `getActivityDashboardData` (filters + derived kinds + **500** match cap; each row includes **sheetRow** for the physical line on **LOG - Activity**). **`deleteActivityLogRow(row)`** accepts **only** **`donation`** event type (others return error). For donations, may call **`tryDeleteDonationRowForActivityUndo_`** (`donations.js`) when **Details** + fingerprint match, then deletes the log row. **Entry Date** on the log is normalized with **`activityLogEntryDateToYyyyMmDd_`** before compare—`getValues()` often returns a **Date** for that column, not the literal `yyyy-MM-dd` string, which previously made fingerprint date checks always fail. Append failures use `Logger.log` and do not block payments/skips.
- **Tab visibility**: `ensureActivityLogSheet_(ss)` runs at the start of **`buildDashboardSnapshot_`** and **`getBillsDueFromCashFlowForDashboard`** so **LOG - Activity** exists after **Overview refresh** or **Bills Due load**, even before any row is appended. Skip logging no longer requires `getDashboardBillByKey_` to succeed (fallback payee + month column from the Cash Flow header row).
- **Web UI**: **Activity** page (top nav) — logged **from/to** on one row, **Payee** contains, **Type** `<select>` (options = distinct kinds from **LOG - Activity**, same derivation as the Type column), amount min/max, **Apply** → up to **500** matches; table **sort** applies to that full filtered set, then **20 rows per page** with Previous/Next; **Remove** is **enabled only for `donation`** rows (others greyed out); **`deleteActivityLogRow`** rejects non-donation. For donations, removes log row and may remove matching **INPUT - Donation** row. `Dashboard_Script_Activity.html`, `Dashboard_Body.html` `#page_activity`.
- **Debt Planner email** — Compact action block (overdue, pay now / pay soon line items); debts omitted when the **current** Cash Flow month already “handles” that payment (same rule as Bills Due); term definitions in Help **Debt Planner email** only.

---

## SYS - House Assets — Property type column

- **Layout**: `House | Type | Loan Amount Left | Current Value` (optional **Type**; if absent, code behaves as before).
- **Sync**: `syncAllHouseAssetsFromLatestCurrentYear_` still updates **Current Value** only (by header); **Type** and **Loan Amount Left** are never overwritten from INPUT - House Values.
- **API**: `getHouseAssetsHeaderMap_` / `getHouseAssetRowData_` expose **propertyType**; `getHouseValueForDate` returns **propertyType** for UIs.
- **Property performance**: Cash Flow **rent** is summed only when **Type** is **Rental** or **Renal** (typo); **Home**, **Vacation Home**, etc. show **$0** rent. Empty **Type** keeps legacy behavior (still sum rent). Table includes a **Type** column (from SYS).
- **Planner**: `normalizeHouseAssets_` includes **propertyType** from column **Type**.

---

## Cash Flow — Quick add: previous month (info box)

- **Behavior**: **Previous month** in the UI = **cell value** on the **prior calendar month** for the same **Type + Payee** on that year's **INPUT - Cash Flow** tab. **January** date → **December** of the **previous calendar year** → read from **INPUT - Cash Flow (year−1)** (e.g. Jan-26 on 2026 tab → Dec-25 on **2025** tab). Each tab only has **Jan-YY … Dec-YY** for that year, so “last month” for January is **never** on the current year’s tab. Not a delta.
- **No match / messages**: Missing **prior-year** tab, **no payee row** on that tab (new payee in the new year, rename, etc.), or month column missing → specific `priorMonthUnavailableMessage` (replacing generic copy).
- **Server**: `computeQuickAddPriorMonthPreview_` + `getQuickAddPreview` / `quickAddPayment` preview in `quick_add_payment.js`.
- **UI**: `pay_priorMonthLabel`, `pay_priorMonthPayment`; `Dashboard_Body.html`, `PlannerDashboard.html`, `Dashboard_Script_Payments.html`, `QuickAddPaymentUI.html`.

---

## Assets — Bank & Investments: change vs prior month

- **Behavior**: Same as House Values — **stored INPUT value for the selected month** minus **INPUT** (`BANK_ACCOUNTS` / `INVESTMENTS`) for the **same account** and **prior calendar month**. Missing prior → **—**.
- **Server**: `getBankAccountValueForDate` (`bank_accounts.js`) and `getInvestmentValueForDate` (`investments.js`) add `deltaFromPreviousMonth` via `getBankAccountHistoryValueForMonth_` / `getInvestmentHistoryValueForMonth_` on the prior month date.
- **UI**: Separator + **Change vs prior month** after the last info line — `bank_deltaPriorMonth`, `inv_deltaPriorMonth`; `Dashboard_Body.html`, `PlannerDashboard.html`, `Dashboard_Script_AssetsBankInvestments.html`.

---

## Assets — House Values: change vs prior month (commit `81b46d6`)

- **Behavior**: **Change vs prior month** = **stored INPUT value for the selected month** minus **INPUT - House Values** for the **same house** and **calendar month before** the selected date. Missing/invalid prior month → **—**.
- **Server**: `getHouseValueForDate` in `house_values.js` sets `deltaFromPreviousMonth` (and `previousMonthLabel`); prior month via `getHouseValueFromHistoryForMonth_` on the prior month’s date.
- **UI**: Blue info box — four existing lines, then a **separator** (`.house-value-delta-sep`), then **Change vs prior month** (`house_deltaPriorMonth`, `fmtSignedCurrency` in client scripts).
- **Files**: `house_values.js`, `Dashboard_Body.html`, `Dashboard_Script_AssetsHouseValues.html`, `Dashboard_Styles.html`, `PlannerDashboard.html`.

---

## Earlier session work (misc)

- **Quick add** / **Bills Due** (bill pay): sped up screen updates (faster round-trip pattern).
- **Debts / credit cards**: show cards in the UI even when balance is $0 where applicable.
- **Debts — non-loan payments**: payment amount subtracted from the displayed balance for non-loan debt rows (see debt sheet logic).
- **Bills Due / recurring**: `hasHistory` guard removed in `getRecurringBillsWithoutDueDateForDashboard()` in `dashboard_data.js` so unmapped Cash Flow rows can still surface; a short comment in code documents how to restore the old gate if needed.

---

## Properties — Property performance tab (commit: feature + HOUSES matching + tabs layout)

- **CashCompass web → Properties**: new sub-tab **Property performance** next to **House Expenses** (CSS: `properties-tabs` uses two columns like other tab rows).
- **Data**: `property_performance.js` + `getPropertyPerformanceData` — per row in **SYS - House Assets**: **Type** (SYS column), equity, rent (calendar year from **INPUT - Cash Flow** `Income` rows whose Payee matches `Rent {House name}` with optional suffix), expenses (sum **Cost + Service Fees** on **HOUSES - …** for that year). Portfolio mini-cards sum columns. Property performance table shows **Type** next to **House**.
- **HOUSES matching / expenses**: resolve tab by exact `HOUSES - {House}` first, then normalized match on location suffix (case/spacing). Expense totals use the resolved sheet’s location key (UI no longer shows a Yes/— column).
- **Files**: `property_performance.js`, `Dashboard_Script_PropertyPerformance.html`, `Dashboard_Body.html`, `Dashboard_Script_Render.html`, `PlannerDashboardWeb.html`, `Dashboard_Styles.html`.
- **Sheet naming**: align **INPUT - House Values** `House`, **SYS - House Assets** `House`, **`HOUSES - {same}`**, and Cash Flow **`Rent {same}`**; optional mismatch handled by normalized HOUSES lookup only when strings match after normalize.

---

## Date parsing — local ISO `YYYY-MM-DD` (avoid UTC month shift)

- **Bug**: `new Date('2026-04-01')` is parsed as **UTC** midnight, so in US timezones the **local** month/day can be the **previous** calendar day → wrong month label and wrong month column (e.g. Apr 1 → Mar-xx).
- **Fix**: use **`parseIsoDateLocal_`** from `quick_add_payment.js` (`new Date(y, m-1, d)` in script timezone) for HTML `<input type="date">` payloads.
- **Touched**: `house_values.js` (get/update house value), `bank_accounts.js`, `investments.js`, `house_expenses.js` (`addHouseExpense`), `upcoming_expenses.js` (`addUpcomingExpense`). **Quick add** already used the helper.

---

## House Expenses — Type dropdown label

- **Change**: display label **Tax** → **Property Tax** in Add House Expense (Type). The option still uses **`value="Tax"`** so existing HOUSES sheet rows and stored values stay valid.
- **Files**: `Dashboard_Body.html`, `HouseExpensesUI.html`.

---

## Operations Snapshot — Bills next 7 days

- **UI**: first row in **Operations Snapshot** card: **Bills Next 7 Days** — sum of **`amount`** for bills in **`getBillsDueFromCashFlowForDashboard()`** `next7` (same as Bills Due list). Click opens **Cash Flow → Bills Due**.
- **Files**: `Dashboard_Body.html`, `Dashboard_Script_BillsDue.html`.
- **Bills Due cards (compact UI)**: Each card shows **name**, **amount**, **due date**, **Pay** / **Skip** only—no duplicate “suggested amount,” no category/autopay/varies/source line. Details in Help **`#help-bills-due`**. Recurring row: one short meta line. Styles: `.bill-card-compact`, `.bill-card-actions` in `Dashboard_Styles.html`.
- **Bills Due status**: `bills_due_status` under the Bills Due panel head; Pay/Skip success and errors use it, and **initial load** failures for `getBillsDueFromCashFlowForDashboard` use it too (not `planner_status`). Overview Bills card summary still shows the load error when applicable.

---

## Overview — Weekly net worth change (replaces duplicate “What changed” / “Net worth Attribution”)

- **Behavior**: One card **Weekly net worth change**. Deltas = **live** balances (assets / house values / debts / net worth from sheets) **minus** a **baseline row** from **`OUT - History`**: the **latest** run whose **Run Date** is on or **before** (today − 7 calendar days). If no run is that old, **fallback** to the **earliest** row in History and show a short note in the card.
- **Removed**: `buildNetWorthAttribution_(latest, previous)` (consecutive History rows). **Revert**: restore that function and wire `buildDashboardSnapshot_` to it; restore two Overview cards + `renderRecentChanges` / `renderAttribution` in `Dashboard_Script_Render.html` and `Dashboard_Body.html`.
- **Files touched**: `dashboard_data.js` (`getAllHistorySnapshotRows_`, `pickWeeklyBaselineFromRows_`, `buildNetWorthAttributionWeekly_`, `parseHistoryRunDate_`), `Dashboard_Body.html`, `Dashboard_Script_Render.html`.

---

## Overview — Snapshot month-over-month + net worth + health + buffer runway (2026)

- **Top snapshot cards — “Change vs MMM yyyy”** (script timezone, **prior calendar month**). **`fmtPriorMonthDelta`** in `Dashboard_Script_Render.html`.
  - **Total cash**: sum **INPUT - Bank Accounts** prior month column vs **SYS - Accounts** current (`getPriorMonthCashTotalFromBankInput_` in `bank_accounts.js`).
  - **Total investments**: sum **INPUT - Investments** prior month vs **SYS - Assets** (`getPriorMonthInvestmentsTotalFromInput_` in `investments.js`). Not from `OUT - History` for this line.
  - **Real estate value**: sum **INPUT - House Values** prior month vs **SYS - House Assets** (`getPriorMonthHouseValuesTotalFromHouseValuesInput_` in `house_values.js`).
  - **Total debt**: no monthly INPUT; **latest `OUT - History` run in prior month** → **Total Liabilities** (`getPriorMonthTotalDebtFromHistory_` in `dashboard_data.js`).
  - **Net worth (Option 1)**: prior month reconstructed only if all three exist: **INPUT** inv + house − **History** debt; delta = current NW − prior. Current **NW = cash + investments + house values − total debt** (`dashboard_data.js`); **`runDebtPlanner`** **`totalAssets`** includes bank **Current Balance** sum + financial + RE (`code.js`) so History aligns after planner runs.
- **Financial Health**: score still from latest planner metrics + live upcoming; **trend** = **current score − score recomputed from prior month’s History row** with **no upcoming penalty** (`computeFinancialHealthScoreNumber_`, `getPriorMonthPlannerHistoryMetrics_`). UI: **`fmtHealthTrendPoints`** (“Change vs Mar 2026: +3 pts”). **`readPlannerHistoryMetricsRow_`** shared by offset + prior-month pick.
- **Buffer Runway**: **detail** + **`runway_months_line`** (`monthsLine`). **Non-negative projected cash flow**: **`monthsLine`** = **`usable ÷ Total Minimum Payments`** when min payments &gt; 0; else **“Many months+”** if usable &gt; 0; else **—**. **Negative cash flow (burn)**: **`label`** = months from usable ÷ burn; **`monthsLine`** omitted (no duplicate under headline). Style: **`.runway-months-line`**; **`:empty`** hidden in `Dashboard_Styles.html`.

---

## CashCompass web — split workspace scripts (replaces `Dashboard_Script_Features_1.html`)

- **Was**: one large `Dashboard_Script_Features_1.html` (House Values, House Expenses, Bank, Investments, Debts, Upcoming, Retirement, Purchase sim).
- **Now**: seven includes after `Dashboard_Script_Render` in `PlannerDashboardWeb.html`: `Dashboard_Script_AssetsHouseValues`, `Dashboard_Script_PropertiesHouseExpenses`, `Dashboard_Script_AssetsBankInvestments`, `Dashboard_Script_PlanningDebts`, `Dashboard_Script_CashFlowUpcoming`, `Dashboard_Script_PlanningRetirement`, `Dashboard_Script_PlanningPurchaseSim`.
- **Globals** (`bankCurrentData`, `houseExpenseOptions`, etc.) stay in `Dashboard_Script_Render.html`.

---

## CashCompass web — Help page (no nav tab)

- **Entry**: Prominent **Help** button in the top bar with Run Planner; opens `page_help` via `showPage('help')` (not a sixth page tab).
- **Content**: `Dashboard_Help.html` included from **`PlannerDashboardWeb.html`** after `Dashboard_Body` (same template level — `includeHtml_` uses `getRawContent()`, so nested `<?!= … ?>` inside Body does not run).
- **JS**: `scrollHelpToSection`, `openHelpToSection`; delegated clicks on `.help-toc a` use `preventDefault` + `scrollIntoView` to avoid hash/sticky layout jumps (Safari).
- **CSS**: `.help-toc-wrap` sticky wrapper, `.help-section` `scroll-margin-top`; styles in `Dashboard_Styles.html`.
- **Property performance**: Table has no **HOUSES sheet** column (matching is documented in Help only); no in-panel footnote.
- **Help — property performance copy**: **HOUSES sheet** paragraph explains tab alignment (not a table column); **Expenses** + **HOUSES sheet** split for clarity.

---

## CashCompass web — loading spinner (CSS + `setStatusLoading`)

- **CSS** (`Dashboard_Styles.html`): `.dash-loading`, `.dash-loading-spinner`, `.dash-loading--block`, `.dash-loading--center`, `dash-loading-spin` keyframes; `prefers-reduced-motion` tames animation.
- **JS** (`Dashboard_Script_Render.html`): `loadingIndicatorHtml`, `loadingBlockHtml`, `setStatusLoading` (after `escapeHtml`).
- **Used for**: house/bank/investments/debt fetch status lines; property performance status + table row; **Run planner** status; house expense summaries/recent; bills due lists + recurring; initial placeholders in `Dashboard_Body.html`.
- **Standalone**: `PlannerDashboard.html` includes same spinner styles + `setStatusLoading` for assets tabs.

---

## Dead code — removed unreferenced dashboard HTML

- **Removed**: `Dashboard_Script_DueCards.html`, `Dashboard_Script_Core.html`, `Dashboard_Script_Utils.html` (never `includeHtml_`’d from `PlannerDashboardWeb.html` nor `createHtmlOutputFromFile` elsewhere). **Revert**: restore those files from git history if a mirror is needed again.

---

## Donations — INPUT - Donation (web dashboard)

- **UI:** **Cash Flow → Donations** (`Dashboard_Body.html`, `Dashboard_Script_Donations.html`, `PlannerDashboardWeb.html` include). **`showTab('donations')`** switches to Cash Flow and loads form data.
- **Backend:** `donations.js` — `getDonationsFormData` (tax years from `Year` rows, distinct **Name of Charity** and **Payment type** lists), `addDonation` (find block by tax year, append after last non-empty row in block; headers must match **Name of Charity**, **Date**, **Amount**, **Tax Year**, **Comments**, **Payment type**). Successful saves append **LOG - Activity** with `eventType` **donation** (`appendActivityLog_`); Activity **Type** = **Donation** (`classifyActivityKind_` in `activity_log.js`).
- **UI:** Charity and payment type are `<select>` lists from the sheet + **Other…**; **payment type is required**. Sheet values **Check #4768** etc. collapse to one **Check** option; choosing Check shows **Check #** field and saves as `Check #` + number. **Recent donations** (right column) lists newest rows across all year blocks. Details in **Help → Donations**.
- **Formats:** New rows copy **PASTE_FORMAT** from the last existing data row in that tax-year block when possible; first row in an empty block keeps explicit Date/Amount formats.
- **Help:** `Dashboard_Help.html` § Donations + sheet list **INPUT - Donation**.

---

## First run doc

- **`FIRST_RUN.md`** — One-page setup: prerequisites, time zone, workbook/template, clasp vs editor, web app deploy (`USER_DEPLOYING` / `MYSELF`), Script Properties URL, smoke check, “do not rename” warnings. Linked from **`INIT_PROMPT.md`**, **`GoingToProduction.md`** Phase 1, **`PROJECT_CONTEXT.md`** § First-time setup (optional template link placeholder).

---

## Contributor docs — `includeHtml_` + release safety net (TODO #18, #23)

- **`WORKING_RULES.md`** — New § **HtmlService includes (`includeHtml_`)**: `getRawContent()` / no nested template tags in included fragments; where to put `<?!= … ?>`.
- **`PROJECT_CONTEXT.md`** — Backend bullet + resolved-infra pointer to that section; **Next task** now defers to **`TODO.md`**.
- **`TESTING_PLAN.md`** — § **Light safety net**: manual checklist after risky dashboard edits; `grep` commands to list `PlannerDashboardWeb.html` includes and flag orphan `Dashboard_Script_*.html`; note on `PlannerDashboard.html` vs web app.
