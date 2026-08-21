# CashCompass Roadmap

*The current at-a-glance **priority stack** for CashCompass — the authoritative view of what comes next and in what order.*

**Documentation only.** This document sets **priority and sequence**. The complete numbered pre-Beta inventory, estimates, critical path, and parallel lanes live in `FULL_BETA_REMAINING_PLAN.md`; the detailed **Stage 1–6** roadmap (with per-item effort, dependencies, and history) lives in `TODO.md → Product Maturity Stages`; current technical status lives in `PROJECT_CONTEXT.md`; engineering rules (incl. **Milestone Discipline**) live in `ENGINEERING_STANDARDS.md`. Where the priority stack below and the Stage model disagree on ordering, **this document reflects the latest intent.**

> Follow **Milestone Discipline** (`ENGINEERING_STANDARDS.md → §11`): finish the current milestone before starting the next; record discoveries here instead of implementing them immediately; close milestones cleanly before opening the next.

---

## Current status (2026-08-21)

**Completed:**

- ✅ **Golden/Canonical engineering convergence** — `AdoptGolden = 0` for the audited families (Operational, Financial Ledger, SYS, Special); remaining diffs are intentional (KeepCentral / ProductDecision / IgnoreNoise). See `GOLDEN_WORKBOOK.md`, `WORKBOOK_PARITY_CHECKLIST.md`.
- ✅ **Validator Phase 1** — read-only Golden↔Central formatting parity + recommendation engine + scoped family runners, admin-gated and default-off. See `VALIDATOR_ARCHITECTURE.md`.
- ✅ **Central migration Phase 1** — user-facing paths resolve the correct workbook via `getUserSpreadsheet_()` (no `getActiveSpreadsheet()` null bugs on the audited paths).
- ✅ **Validator Phase 2 + Test Harness / Release Readiness foundation** — Provisioning, Workbook Drift, Schema Evolution V1, the formal schema, Formula / Conditional-Formatting / Named-Range modules, aggregate Workbook Health, the disposable-workbook harness, required non-performance scenario packs, and the bounded Validation console are complete and runtime-proven through isolated Central `@141`.
- ✅ **P0 Documentation Cleanup / Project Stabilization** — closed 2026-07-20 after synchronized documentation, ProductDecision closeout, Central Tier-2 verification, the full Recovery 6F matrix, and two-track isolated `@114` blank/fresh plus representative populated-workbook runtime validation.
- ✅ **Unified-source bounded smoke + signed-currency polish** — after creating a safety copy, the same source was pushed to the bounded Apps Script project. Overview loaded materially faster; sampled balances, Upcoming, Bills, weekly change, and several pages reconciled; no rollback was required. Negative deltas now render as `-$…` consistently, with bounded runtime proof and permanent dashboard regression coverage.
- ✅ **House Financial Accuracy V1** — commit `96d0ebe` is on `origin/main`. Additive final `Linked Property` debt schema, Loan/HELOC-only managed links, actual selected-year Cash Flow loan payments, fail-closed ambiguity guards, and after-financing Property Performance totals passed exact isolated Central `@145` run `20260722-124210-bc23` (27/27 assertions, Restricted sharing, verified Trash) and a user-approved bounded comparison made under a workbook backup. Existing Overview values, property equity, rent, and operating expenses remained unchanged; no Harness run targeted the bounded workbook.
- ✅ **Financial Integrity Phase 3** — commit `9b97c4d` is on `origin/main`. The approved active-owned-position basis, shared Planner/Rolling/Dashboard path, five read-only audits, canonical History freshness, and Release Readiness inventory passed isolated Validation `@156` suite `20260722-164849-6081` 53/53 with all safety gates and verified Trash.
- ✅ **Performance Planner percentile gate for `@318`** — exact-owner campaign `PERF-e75d61db-7f46-446b-a4cd-93c84e893a8a`, bound to source `8aa4bf5bf58259598289d79368eea944e015d43e`, isolated `@318`, and Release Readiness run `RR-18146129-6e3c-4389-8599-01cbb627b95d`, passed 20/20 pairs and 40 Planner executions. First, repeat, and combined p50/p95 were 12.890/16.773 s, 12.350/16.034 s, and 12.600/16.773 s against the ratified 30/60 s budgets. All fixtures were Restricted, all cleanups were verified, and the suite recorded `PASS`, `ACCEPT`, `releaseEligible: true`, and `budgetRatified: true`. The owning overall run was intentionally archived `NOT_READY` because unrelated required suites were not run; the disposable runner returned OFF.
- ✅ **Cross-flow performance measurement `4d` on `@319`** — diagnostic Populated Dashboard V9 run `FR-47ef0c44-68c8-4cff-a745-828677acf353` passed every browser assertion with Restricted single-owner sharing and verified Trash cleanup. Ordinary Bank Save acknowledged in 1 ms and completed in 8.332 s; 12 loaded-navigation samples measured 17/18 ms p50/p95; representative populated Overview after Planner history completed in 11.776 s. Navigation and Overview were within candidate targets. Save acknowledgement passed, while the 6 s completion miss opened the now-complete `4f` follow-up below.
- ✅ **Ordinary Save investigation `4f` on `@322`** — Populated Dashboard V10 run `FR-afc35e3b-77ff-4c91-88cb-88f28c55fa0f` passed 24/24 with five exact Saves, Restricted single-owner sharing, zero browser errors, and verified Trash cleanup. Same-call workbook and Bank/SYS read-context reuse reduced completion p50/p95 from 11.060/17.568 s to 6.520/9.418 s; acknowledgement p95 was 1 ms. The strict 6 s completion budget remains a documented near-miss and is not claimed passed. The investigation/justified optimization is closed; no required history, synchronization, or immutable audit stage is weakened.
- ✅ **Combined UX closeout `3e`–`3i` and `3m` on isolated `@325`** — Properties context, Activity filters/narrow layout, Setup progress/next action, contextual Help, medium/390px composition, form readiness, and customer language now share permanent Dashboard regressions. Populated run `FR-51e0f9a0-0d1b-4049-9eea-36b1107a0976` passed 24/24 on `@324`; First-Run run `FR-78d9e3b6-a907-4959-bbca-db0966f623f1` passed 16/16 on `@325`. Both used Restricted single-owner disposable workbooks and verified Trash cleanup. The only source difference between those deployments is the First-Run copy-contract correction found by the initial clean run. Beta stayed `@106`; bounded was untouched. `3j` remains a separate accessibility task.
- ✅ **Tracked Manage loading truth `REG-065` on isolated `@326`** — Bank, Investment, and House Manage views now show loading or retryable failure before considering a confirmed empty result. Populated run `FR-91155508-65ef-436c-9e3a-fb46fe4177ad` passed 24/24 with Restricted single-owner sharing, zero failed assertions, and verified Trash cleanup; the user visually confirmed the corrected transition. Genuine new workbooks still route to Add new only after a successful empty response.
- ✅ **Retirement selected-first performance `4g` / `REG-066` on isolated `@328`** — Overview's authoritative selected payload paints immediately while two alternatives background-load through stale-response-safe read-only paths. Populated V11 run `FR-72b047d7-4f26-469a-9287-2bfda293023e` passed 25/25; selected/all-comparison timings improved from 8.626/13.167 s at `@327` to 1 ms/5.648 s, with Restricted sharing, verified cleanup, and user visual approval.
- ✅ **Money-format consistency `3n` / `REG-067` on isolated `@331`** — normal-path finite money now uses grouped `$x.xx` with signs before `$`; percentages, counts, ages, dates, numeric-entry behavior, stored values, schemas, and writers are unchanged. Populated V12 run `FR-f7719f23-9248-41fa-9f5c-7327db963ce3` passed 26/26, including the cross-surface money sweep and clean console, with Restricted single-owner sharing and verified cleanup. Source commit `d1278ef` is on `origin/main`. Beta stayed `@106`; bounded was untouched.
- ✅ **Debt Edit/Rename convergence `3o.1` / `REG-068` on isolated `@334`** — user validation correctly rejected the initial two-save interaction on `@332`. The corrected contract uses one **Save changes** action for account name and every other debt field; the server keeps the Central-safe user lock, linked Cash Flow updates, rollback, and Activity evidence behind that action. The first corrected run on `@333` failed closed on the inherited null document-lock assumption and verified Trash cleanup; the permanent Central-lock regression and `@334` fix followed. Diagnostic Populated run `FR-2abc5049-2b4a-4f3b-b938-10f78ddc9244` passed 26/26, including a real rename-and-restore through Save changes, both immutable rename events, clean console, Restricted sharing, and verified cleanup. Residual House, Income, and Debt implementation-language leaks remain removed. Beta stayed `@106`; bounded was untouched.
- ✅ **Bank Account Edit/Rename/lifecycle convergence `3o.2` / `REG-069` through isolated `@338`** — Manage now exposes one **Edit → Save changes** action for Account name, Type, Use policy, Priority, Available now, and Minimum buffer; Update remains the dated-balance workflow. A guarded coordinator updates the existing `SYS - Accounts` row and every matching Bank history block under a Central-safe user lock, preserving month values, formulas, import staging, `External Account Id`, and immutable Activity history, with stale/duplicate/ambiguous-history guards and rollback. Inactive inventory and Reactivate complete the lifecycle. Populated retry `FR-02e19b9d-9757-4847-afe0-55fd5a03be32` on `@335` passed the exact Bank rename/restore plus Stop/Reactivate assertion and Activity labels before an unrelated credit-card correction timed out after Apps Script `HTTP 0`; the marker-verified fixture was then explicitly trashed and state returned to `active: null`. Shared presentation behavior is recorded separately under completed `3p` / `REG-070`. Beta stayed `@106`; bounded was untouched.
- ✅ **Shared dynamic changed-column fit `3p` / `REG-070` on isolated `@341`** — one best-effort helper now fits every text or numeric column changed by supported Debt, Bill, Bank, Investment, House, and Income add/edit/rename/value-save paths, including linked Cash Flow columns. It adds a 24 px rendering gutter, caps width at 1000 px, and never converts a presentation failure into a failed financial/entity write. Disposable Bills integrity run `20260807-154251-d5e9` passed 14/14 in 24 s, including linked Payee, large formatted currency, and exact-gutter assertions; the fixture was trashed and the runner returned OFF. Manual sheet edits and unrelated non-entity writers remain outside this app-triggered contract. Beta stayed `@106`; bounded was untouched.
- ✅ **Investment Edit/Rename/lifecycle convergence `3o.3` / `REG-071` on isolated `@343`** — Manage now uses one Edit/Save for Account name and Type, guarded stable-row Stop/Reactivate, and a current-year-plus-active-SYS predicate so older-year-only names such as Lending Club appear under Inactive rather than masquerading as current editable accounts. Populated run `FR-ec5cf708-d20a-4bd2-a539-2a3cc139aefc` passed 26/26, including Investment rename/restore and Stop/Reactivate, with Restricted single-owner sharing, zero browser errors, verified Trash cleanup, and `active: null`. The user visually confirmed name propagation in `INPUT - Investments` and `SYS - Assets`. Beta stayed `@106`; bounded was untouched.
- ✅ **Tracked-editor single-entry cleanup `REG-072` on isolated `@352`** — House, Bank Account, and Investment Manage views no longer repeat the primary **Add new** action already provided by their segmented mode control. Manage retains only lifecycle-specific controls such as Edit, Stop tracking, Show inactive, Reactivate, and guarded import tools. Permanent Dashboard UX coverage enforces one standard Add entry point, the full local suite passes, and the owner visually approved the common-source presentation on the bounded app. No writer, formula, financial rule, workbook schema, or workbook data changed. Central Beta stayed `@106`.

**Now / next:**

- **Frozen Planning checkpoint:** **Overview FROZEN · Debt FROZEN · 30/90-day
  post-decision safety PROVEN · Planning foundation STABLE.** Commit `9a6cb96`
  contains the canonical required-first/exact-once plan, recurrence and payment-
  evidence corrections, independent reserve and Balanced-pacing protections,
  gross current-cash 30/90-day solvency checks, and the accepted Overview/Debt
  presentation. Do not reopen ordinary Overview or Debt UX work.
- **Highest-priority accuracy milestone:** **Cash + Credit Card Import / Refresh**,
  initially shadow-only. Implement revolving-debt/credit-card evidence first
  because it controls debt-paydown safety, then bank/cash evidence. Ingest
  balances, contractual minimums, due dates, applicable APRs, and supporting
  statement/account facts with effective/observed timestamps, freshness, and
  provenance; then compare them exactly with the manually maintained values
  Planning currently consumes. The canonical cross-domain lifecycle and later
  domain order live in `PART_2A_FINANCIAL_FACTS_CONTRACT.md → §§11–15`.
- **Authority boundary:** the frozen checkpoint certifies calculation semantics,
  not institution-current balances. The existing manual facts are known stale.
  This next slice does not silently switch Planning authority, execute payments,
  or broadly import transactions. Any authority migration requires a later
  explicit checkpoint.
- **Paused, not waived:** finish `3o` Houses, Income, and Bills after the core
  Import / Refresh accuracy slice. Debt, Bank Account, and Investment convergence are
  runtime-complete through isolated `@343`; shared changed-column fit `3p` is
  complete through `@341`. The remaining contract is explicit inactive
  inventory plus Reactivate of the existing identity, with Edit/Rename where
  applicable, history preservation, duplicate/stale guards, coordinated
  rollback, and Activity evidence. Bills must replace the current re-add
  guidance with true reactivation so Stop tracking cannot lead to a second
  logical Bill row. Financial follow-up `5n` remains folded into the `RFP-1`
  reporting-basis audit and closes only if its own reconciliation exit criteria
  pass.
- Customer-facing operations/support/privacy work (`6a`–`6f`) and the broad
  `3j` responsive/accessibility closeout remain deferred, not waived. Beta
  remains `@106`; bounded deployment and workbook control remain with the user.
- **Independent advocate gate added 2026-07-23:** the approved isolated interactive writer journey confirmed P1 trust defects in formatted bank-amount replacement, Income/Setup classification consistency, Bills Pay handoff/occurrence feedback, and normal-path implementation terminology. The bank replacement defect is runtime-closed on isolated `@175`, the Income/Setup fix on `@176`/`@178`, the contained language/responsive wave on `@177`, `REG-017` on `@179`, exact-owner `REG-015` on `@181`, readiness-refresh `REG-019` on `@182`, Bills completion semantics on `@193`, controlled failure evidence through `@203`, and Retirement runtime truth on `@211`. The last formal advocate score is **8.3/10** pending a fresh full-score run. Medium/narrow replay and accessibility remain open. No Beta, mapped-user, Golden, or configured-default workbook was used by the Harness; bounded inspection remained user-controlled. These findings are sequenced in `TODO.md → UX Backlog (Version 1) → Independent advocate priorities`.
- **Tracked-editor consistency polish completed 2026-07-24:** Bills use **Due · Add · Manage**. Houses, Bank Accounts, Investments, and Debts use **Update · Add · Manage**, with explicit Setup Add/Manage handoffs, responsive active-item inventories, and a shared UI layer for mode selection, list rendering, focus, and empty states. Update is Save-only; Manage is the single lifecycle-maintenance surface for guarded Stop tracking. Bank Import / Review imports remain secondary tools under Manage accounts. First-Run V4 run `FR-a1df6d9b-c123-4759-b08e-438d4047bf4c` passed 10/10 and Populated V3 run `FR-158bd6a2-bcb9-41b3-addc-180369266010` passed 13/13 on isolated Central `@195`, each with Restricted single-owner sharing, zero browser errors, and verified Trash cleanup.
- **Activity correction elevated to the broad-Beta gate 2026-07-26:** Activity must distinguish audit evidence from correctable financial operations. The first slice (`5g`) replaces the misleading Remove-for-every-row presentation with an **Action** column, shows **Remove donation** only for eligible Donation rows, exposes no action control for Planner/email/import or other unsupported rows, and preserves the server-side donation-only rejection. Later slices add immutable, precondition-gated correction for Quick Add, linked Bill occurrences, Upcoming payments/lifecycle, and compound House Expenses; entity lifecycle events route to their owning Manage workflow and system/import rows remain audit-only. Full scope and estimates: `FULL_BETA_REMAINING_PLAN.md → 5g–5m`; safety contract: `TODO.md → Activity — Correction / reverse transaction`.
- **Isolated `@196` advocate reconciliation:** `5g` passed interactively. The read-only **7.2/10** run is evidence-limited and does not replace the formal writer-inclusive **8.3/10** score. The resulting Beta work is mapped as `3l` Overview health prerequisite/freshness trust, expanded `3j` programmatic labels and target sizes, `3m` form readiness/customer language, plus `3b`, `3c`, `3h`, and `3i`; `2d` is now closed as `REG-026`. Each fix must add or extend the exact permanent UI/server/browser regression described in `FULL_BETA_REMAINING_PLAN.md`; generic page-load coverage is not sufficient.
- **Isolated `@197` Overview trust closure:** First-Run V5 run `FR-23fd31cb-df7b-4f2e-8202-586e70254af0` passed 11/11 and Populated V4 run `FR-9a7b266a-681e-467d-8489-cf8218be666f` passed 14/14. Both used a new Restricted, single-owner disposable workbook, passed `health_prerequisite_truth`, recorded zero errors, and verified exact-fixture Trash cleanup. The console-owned disposable-runner flag returned to **OFF**. Beta remained `@106`; no bounded, mapped-user, configured-default, Golden, or administrator workbook was a writer target.
- **Then:** execute the remaining score-by-score program in `TODO.md → Advocate 10/10 score-improvement program`: controlled error/safety journeys → transition/language cleanup → page-level ease/navigation/visual polish → responsive/accessibility → exact-candidate rescore. Each criterion requires isolated runtime evidence and an advocate rescore before closure. The core Bills decision and payment journey are no longer open.
- **Remaining performance work:** `4a`–`4g` are complete for their current evidence candidates. Any source or deployment change before the frozen-candidate `8b` gate requires a fresh Performance replay because exact-candidate evidence cannot be inherited.
- **Release policy:** CashCompass is **quality-gated, not date-gated**. A small supervised cohort may validate work during P1–P3, but a broad Beta Release Candidate must satisfy `BETA_10_OUT_OF_10_PLAN.md`: score ≥95/100, no dimension below 9/10, no unresolved Severity 1 or Severity 2 defect, and every non-negotiable release gate passing.

---

## Broad invited-Beta forecast

**Calendar requires rebaseline.** The former 2026-09-24 target and 2026-10-02
contingency boundary are retained only as historical planning references, not
current commitments. Controlled Family Beta can continue for the existing
supervised cohort; it does not authorize a Central Beta or bounded deployment
change. Deferring `5j` changes the critical-path order, so a new decision date
must be based on measured compound-operation evidence after its focused redesign.

| Window | Planned scope and exit |
|---|---|
| Completed through Jul 27 | Closed HTTP 0 recovery, exact-candidate ownership, core Bills Pay, tracked-editor convergence, Activity action truth, Overview prerequisite/freshness trust, unattended browser orchestration, controlled Bank/Debt loading, Bill Skip/Stop safety, and Retirement runtime through isolated `@211`. Wave 1 is complete. |
| Completed early Jul 28–29 | Closed `5h` durable correction identity/preconditions and `5i` direct Cash Flow/Donation correction through commits `d040a34` and `16b6a8f`; isolated Central advanced only to `@240`, while Beta remained `@106` and bounded remained user-controlled. |
| Completed through Jul 31 | Closed UX `3c`, `3a`, and `3b` in `7c0e2ac`, `be76bdb`, and `3e2db4f`; isolated Central advanced to `@298`, while Beta remained `@106` and bounded remained user-controlled. |
| Completed Aug 1 | Closed `REG-041` styled Bill Skip and `REG-042` Bills Due source authority in `433bfed`; user-verified on isolated Central `@299`, while Beta and bounded remained unchanged. |
| Completed Aug 5 | Closed `4a`–`4c`, `4e`, and `4f` for source `8aa4bf5` on isolated `@318`; exact-owner Performance passed 20/20 with ratified Planner p50/p95 budgets, Restricted fixtures, verified cleanup, Beta `@106`, and bounded untouched. |
| Completed Aug 6 | Closed combined UX items `3e`–`3i` and `3m` on isolated `@325`; Populated 24/24 and First-Run 16/16 passed with Restricted fixtures and verified cleanup. |
| Current | Execute `RFP-1`: read-only household funding reconciliation and decision contract. No schema, writer, calculation, UI, or deployment change. |
| Next | Implement the Rolling Financial Plan one gated slice at a time: optional funding-purpose metadata → read-only decision engine → feature-flagged Planning UI → disposable-workbook proof. Then resume `3o` Houses → Income → Bills. |
| Candidate preparation | Close financial/workbook/recovery proof `5a`–`5f`, operations/support `6a`–`6f`, and monetization-ready architecture `7a`–`7f`. |
| Frozen candidate | Complete `8a`–`8f`, the exact-candidate advocate rerun `3k`, and full Release Readiness; rerun Performance under `8b` if the frozen source/deployment differs from `8aa4bf5` / `@318`. |
| Promotion | Complete `9a`–`9e`: five-to-seven-day supervised cohort, final scorecard, go/no-go, and separately approved Beta promotion. |

Any failed financial, safety, privacy, performance, Severity 1/2, ≥95/100, or
no-dimension-below-9 gate moves the eventual decision. Assumptions and full exit evidence
are maintained in `PROJECT_CONTEXT.md → Beta delivery forecast` and
`BETA_10_OUT_OF_10_PLAN.md`. Execution IDs, estimates, the critical path, and
parallel work lanes are maintained in `FULL_BETA_REMAINING_PLAN.md`.

---

## Focused Beta execution sequence

This is the operating order from the current state to broad invited Beta. Work
one numbered wave at a time. A discovery from a later wave is recorded in the
appropriate plan but does not interrupt the active wave unless it is a Severity
1/2 defect or blocks the active work. Every fix must receive exact regression
coverage and isolated evidence before its item closes.

### Wave 1 — Trust foundation

**Wave complete on isolated `@211`.**

1. ~~`1f` — establish guarded unattended browser-suite orchestration.~~
   **Complete on isolated `@201`; First-Run and Populated suites self-started
   under the fixed disposable identity with verified cleanup (`REG-022`).**
2. ~~`1c` — prove Bank/Debt stale, failure, retry, disabled-action, and recovery
   behavior.~~ **Complete on isolated `@203`; Populated V5 16/16 PASS.**
3. ~~`1d` — prove Skip and Stop tracking consequences, confirmations, preserved
   history, stale protection, and cleanup.~~ **Complete on isolated `@206`;
   Populated V6 17/17 PASS (`REG-024`).**
4. ~~`1e` — prove Retirement not-ready guidance and ready-state results.~~
   **Complete on isolated `@211`; First-Run V6 12/12 and Populated V7 18/18
   PASS (`REG-025`).**

**Exit:** all four items pass permanent regressions and isolated runtime
validation. Do not begin Activity correction implementation before this exit.

### Wave 2 — Daily-task language

**Complete in commit `168a49b`; exact-candidate Central replay remains part of
the final release evidence wave rather than an open implementation item.**

1. ~~`2d` — state Quick Add add/update/replace behavior precisely.~~
   **Complete with `REG-026`: Quick Add explicitly says the entered
   amount is added to the selected-month total and does not replace an existing
   amount.**
2. ~~`2e` — state Upcoming Dismiss consequences and preserved history
   precisely.~~ **Complete with `REG-027`: the action surface,
   success message, and Help say Dismiss records no payment, changes no Cash
   Flow value, and preserves the Upcoming row plus Activity history.**

**Exit:** copy contracts pass Dashboard UX assertions and the applicable
interactive journey.

Measured result: the original **1–2 day** combined placeholder closed in about
**0.5 focused hour** after audit showed both production behaviors were already
correct. Future language/cosmetic items with an existing regression home start
at **1–3 focused hours**; runtime queues and external review are tracked
separately from engineering effort.

### Wave 3 — Safe Activity correction

1. `5h` — establish the production-wide end-to-end financial operation envelope:
   one server-generated `operationId` for the complete action, one `eventId` per
   Activity row, versioned target descriptors and before/after state, preview,
   exact-state preconditions, and an immutable correction event. Reuse the
   existing Quick Add UUID/workbook/CAS seams; do not migrate Activity columns.
2. `5i` — direct Cash Flow correction. **Complete in commit `16b6a8f`.**
   The Activity Action column exposes **Change amount** and **Remove entry**
   only for eligible direct Quick Add and Donation operations. Preview and the
   locked writer restore recorded before-state; created rows require a complete
   untouched-row fingerprint; optional credit-card balance is part of the same
   preflight; linked, legacy, changed, or already-corrected operations fail
   closed. The original event becomes non-actionable **Reversed** and a separate
   non-actionable correction event is appended. Final isolated Central `@218`
   run `FR-34e460e8-9421-47f8-a59f-9f3319070483` passed 19/19 with `REG-031`
   completion-state reconciliation and verified cleanup. Subsequent manual use
   exposed `REG-032`–`REG-039`; their contained language, feedback,
   eventual-consistency, latency, date, and full-sequence fixes pass the local
   suite and isolated Central `@223`. Guarded run
   `FR-f78afc2b-7807-4d72-83b1-b30ea398062f` passed 19/19 with newest, middle,
   earlier, and post-correction reversal, later-value preservation,
   same-target receipt retirement, zero browser errors, and verified Trash
   cleanup. The final compact **Change amount / Remove entry** design, positive
   customer expense amounts, eligible Donation correction, and same-page
   refreshed values then passed clean isolated `@240` run
   `FR-d75843e0-486e-4faa-8967-05ee40b73e25` 21/21 in 383.006 s with verified
   cleanup.
3. `5j` — Bill payment, Skip, and AutoPay occurrence correction — **deferred for later redesign**.
4. `5k` — Upcoming payment/lifecycle correction.
5. `5l` — compound House Expense and optional Cash Flow correction.
6. `5m` — entity events route to Manage; Planner/email/import remain
   audit-only; complete permanent evidence.

**Exit:** each supported family corrects atomically or fails closed on a
harness-created disposable workbook; original Activity evidence remains intact.

**Audit rebaseline (2026-07-27):** the pre-audit 12.5–25-day placeholder assumed
a new accounting platform. Source inspection found Quick Add already has an
operation UUID, workbook identity, before/after receipt, lock, and compare/set
inspection; Upcoming and House also retain stable target evidence. The
end-to-end program is now **7–12 focused days including integrated runtime
validation**. Begin `5h` with a one-day cap, review the envelope, and re-estimate
before `5i`. The forecast keeps the recovered margin as quality contingency.

### Wave 4 — Page-by-page UX closeout

Complete in this order:

1. `3a` — loading states — **✅ complete in `be76bdb` through isolated Central `@294` read-only validation and permanent automated coverage**.
2. `3b` — empty/error and guided-Add states — **✅ complete in `3e2db4f` through isolated Central `@298`, guarded First-Run 14/14 baseline, fresh-workbook visual confirmation of the contextual Upcoming/Bills refinements, and permanent automated coverage**.
3. `3c` — Debt destination relationships — **✅ complete in `7c0e2ac` through isolated Central `@293` and user-approved visual validation**.
4. `3e` — Properties context.
5. `3f` — Activity filters and responsive review.
6. `3g` — Setup progress and recommended next step.
7. `3h` — Help and contextual links.
8. `3i` — medium-width visual balance.
9. `3m` — form readiness and remaining customer language.
10. `3j` — programmatic labels, keyboard/focus, target sizes, contrast,
    reduced motion, and desktop/medium/390px evidence.

**Exit:** no unresolved Severity 1/2 UX defect and every advocate category has a
documented path to at least 9/10. The final score remains deferred until the
candidate is frozen.

### Wave 5 — Financial, workbook, and recovery proof

Complete `5a`–`5f`: exact-candidate Financial Integrity, fixture matrix, workbook
visual review, orphan/recovery disposition, and unified-source bounded-safety
evidence.

**Exit:** all release-critical financial/workbook gates pass without using the
bounded workbook as a test target.

### Wave 6 — Performance and candidate preparation

1. `4a`–`4c` — **complete** through isolated `@317` with chart retirement,
   Dashboard-format batching, and snapshot optimization proved.
2. `4f` — **complete on isolated `@322`**; ordinary Save p50/p95 improved from 11.060/17.568 s to 6.520/9.418 s, with the strict 6 s budget retained as an explicit near-miss;
   initial Overview plus provisioning/first-create evidence is already captured.
3. `4e`–`4f` — **complete for `8aa4bf5` / `@318`** with 20/20 exact-owner
   pairs and ratified 30/60 s Planner budgets.
4. Finish all candidate prerequisites, then freeze once. Rerun the Performance
   suite under `8b` if the frozen source/deployment differs.

**Exit:** performance is a passing exact-candidate gate, not diagnostic evidence.

### Parallel lane — Operations and product foundation

Advance `6a`–`6f` and `7a`–`7f` only during runtime waits and review gaps. This
lane must not interrupt Waves 1–6, but must finish before the final advocate and
go/no-go verdict.

### Wave 7 — Frozen candidate and final gate

Complete `8a`–`8f` plus `3k`: freeze exact identity, run every required suite,
resolve warnings, run the full writer-inclusive advocate scorecard, confirm no
Severity 1/2 defects, and archive the reproducible READY verdict and rollback
target.

**Exit:** weighted readiness is at least 95/100, no dimension is below 9/10, and
every non-negotiable gate passes.

### Wave 8 — Supervised cohort and launch decision

Complete `9a`–`9e`: prepare the cohort, observe for five to seven calendar days,
repair and revalidate defects, make the broad-Beta go/no-go decision, and promote
Central Beta only after separate explicit approval. The bounded deployment
remains user-controlled.

**Focused-effort forecast:** **34–50 working days best case** or **47–74
conservatively**, with operations/product work parallelized, plus the five-to-
seven-day cohort and any repair cycle. Dates never override a failed gate.

---

## Priority stack (P0–P4)

### Priority 0 — Project stabilization — ✅ complete 2026-07-20

- **Documentation** — keep architecture docs, roadmap, and standards in sync with the current state (this milestone).
- **Regression Discovery (process)** — every meaningful bug fix / feature / schema / dashboard / financial-calc change runs the **Regression Discovery Policy** and appends the reusable **Regression Discovery** prompt block (`REGRESSION_SUITE_PLAN.md → Regression Discovery Policy` + `§A`) so test coverage grows as the product evolves.
- **Product decisions — ✅ current P0 inventory resolved.** The final known P0 item, Settings header/body typography, was ratified 2026-07-20 as 16pt / 14pt and implemented first-create only. Future Validator discoveries follow the normal record-and-defer rule.
- **Beta readiness — ✅ stabilization evidence complete.** On isolated Central `@114`, the canonical blank/fresh pass and a Central-owned representative populated fixture both passed Setup, navigation, editor gating, first-run/populated rendering, Help, and broad workspace checks without console warnings. This closes the stabilization slice; remaining Beta-Gate work stays sequenced under P1 evidence, P2 financial truth, P3 experience/performance, and the final 10/10 Release Candidate gate.
- **Central resolver verification — ✅ static Tier-2 sweep closed 2026-07-20.** All Central user-facing production paths use `getUserSpreadsheet_()`; remaining direct active-spreadsheet calls are intentionally confined to the resolver's bound fallback, bound-only utilities, developer Test Setup, and the harness safety guard.
- **Recovery Validation 6F — ✅ P0 complete 2026-07-20.** Full disposable-account matrix passed, including MEDIUM auto-adopt ON; flags OFF and fixture gate removed. Read-only orphan detection remains P1.

### Priority 1 — Validator Phase 2 + Test Harness / Regression Runner

*(P0 closed 2026-07-20; P1 Release Readiness infrastructure and non-performance evidence are complete. The exact-owner Performance Planner percentile gate closed for `8aa4bf5` / isolated `@318` on 2026-08-05; the full product/final-verdict gate remains open because unrelated exact-candidate suites and scenarios are still required. Other P1 recovery follow-ups—including read-only orphan detection, 6D.2b Create New Workbook, and 6E.2 Admin Set Mapping—remain separately tracked and are not claimed complete here. Detail: `VALIDATOR_ARCHITECTURE.md → §10 Phase 2` (the judge) and `TEST_HARNESS_ARCHITECTURE.md` (the writer), with `REGRESSION_SCENARIOS.md`, `RELEASE_READINESS.md`, and the quality gate in `BETA_10_OUT_OF_10_PLAN.md`.)*

**Sequenced milestone order** (the Validator is the read-only **judge**; the Test Harness is the developer-only **writer/mutator** that drives scenarios against disposable workbooks and asks the Validator to confirm nothing broke):

1. **Validator Phase 2 / Workbook Health — ✅ dedicated runtime evidence complete; isolated Central `@122` PASS 2026-07-21.** The formal schema registry, targeted Formula validation, Conditional-Formatting validation, thin Named-Range validation, Provisioning, Drift, and aggregate Workbook Health ran on a Restricted populated disposable fixture. The first `@121` run safely exposed 25 advisory formula findings: 24 valid Google Sheets-normalized single-cell `SUM` shapes and one Debt fixture row-order defect. Narrow fixes plus permanent regressions were deployed at `@122`; confirmation run `20260721-120759-5dc2` returned aggregate Health PASS with zero warnings, 9/9 functional assertions, CURRENT/FULLY_CURRENT schema, Restricted sharing, and verified Trash cleanup (160.338 s). Beta stayed `@106`; the bounded workbook was untouched.
2. **Test Harness foundation** — **✅ V1 done.** *(disposable-workbook lifecycle + fail-closed guard + `assertDisposableTarget_` + single SMOKE scenario `SMOKE-PROVISION-DONATION` + report; editor runners `testRunSmoke()` / `testRunSmokeTrash()` and the console Test Harness card — `TEST_HARNESS_ARCHITECTURE.md`)*
3. **Disposable populated-fixture hardening** — **✅ complete; isolated Central `@117` PASS 2026-07-21.** Central created a Restricted, owner-only fixture under the intentional `drive.file` boundary; the harness seeded representative Bank / Investment / House / Debt / Bills / Income / Upcoming / Retirement data, passed 9/9 functional assertions plus Provisioning/Schema/Drift checks, and verified Trash cleanup by Drive read-back. Every write received the disposable spreadsheet explicitly; owner/bounded workbooks were untouched. The 119.7-second harness duration is recorded as test-infrastructure performance evidence, not a product-flow regression.
4. **Scenario packs — ✅ Performance percentile evidence complete for `@318`; other final-candidate replay remains.** The historical exact `@141` evidence run passed First-Run UX, Populated Dashboard, Recovery Live, Workbook Health, and 13/13 server checks. On 2026-08-05, exact-owner Performance campaign `PERF-e75d61db-7f46-446b-a4cd-93c84e893a8a` passed 20/20 pairs and ratified the Planner budgets for source `8aa4bf5` on isolated `@318`. The production-path audit remains enforced by `npm test`; `8b` must rerun stale suites after any final-candidate change.
5. **Release Readiness gate — ✅ orchestration/runtime controls and `@318` Performance proof complete; full verdict still open.** The single Validation console starts, resumes, pauses, and finalizes bounded runs; each writer check creates and safely trashes its own disposable workbook; browser evidence is accepted only for the exact source/deployment candidate; compact evidence is archived; and a console-owned Harness flag returns OFF at finalization. Run `RR-18146129-6e3c-4389-8599-01cbb627b95d` recorded Performance PASS/Verified, then intentionally archived `NOT_READY` because First-Run, Populated Dashboard, Recovery Live, and 24 required server checks were not part of the performance-only run. The disposable runner is OFF.
6. **Validation & Testing admin console — ✅ Release Readiness controls complete.** Workbook Health, the suite inventory, guarded browser adapters, resumable bounded checks, saved status, privacy-safe evidence export, and final READY/NOT READY controls now start and end from the single console.

**Latest completed item:** `RFP-6a`, the broker-activity and holdings foundation,
passed isolated disposable runtime proof on Central `@351`. Run
`20260814-070625-5dbc` passed both integration scenarios and 40/40 assertions in
136.0 seconds; both Restricted fixtures passed provisioning and drift checks,
were verified Trashed, and the disposable runner is OFF. The activity proof
includes safe exclusion of Robinhood's blank disclaimer footer while preserving
fail-closed rejection of genuine undated transactions. It adds
preview-first Robinhood CSV import for explicitly designated
**Income-Producing Accounts**, a duplicate-safe normalized activity ledger, and
derived holdings reconciliation. Options, unrelated holdings, brokerage fees,
and cash-administration rows are excluded; raw CSV is not retained; `INPUT -
Investments` remains the account-total authority. This slice does not yet issue
Hold/Add/Reduce/Sell advice or execute trades.

The owner subsequently pushed and deployed this source to the bounded app and
completed the first real import. It saved 104 Samer Robinhood activities and
produced JEPQ, QQQ, QQQI, and SPYI holdings that reconcile to the later broker
view after the next weekly purchases and dividend reinvestment. This is bounded
acceptance evidence, not Harness evidence; the bounded workbook was never used
as a test target by Codex.

Post-proof foundation commit `529ce88` adds the account-first Portfolio activity
drawer, editable recurring plans that remain separate from imported facts, and
checkpointed ticker review. A ticker marked as not part of the portfolio for now
stays quiet for already reviewed history, returns after a later purchase, and
does not retroactively import activity behind its boundary if later included.
The owner reviewed and accepted the bounded presentation. This is a common-source
foundation extension; it is not retroactively claimed as isolated `@351` evidence.

**Next active item after the separate commit boundary:** `RFP-3`, the read-only
Capital Allocation Queue and weekly recommendation engine. It uses an in-memory
read model with two classes: hard constraints such as obligations, protected
cash, and debt minimums; and ranked discretionary candidates such as extra debt,
Income-Producing Account funding, reserve restoration, or waiting. Every result
must be deterministic, provenance-backed, confidence-labeled, and exactly
reconciled. It may not transfer funds, place trades, post payments, or write
recommendations into the workbook.

**RFP-3a complete on isolated Central `@353`:** the first contained slice defines the
spreadsheet-scoped read-only fact seam and pure Capital Allocation Queue kernel.
It emits hard constraints and stable discretionary candidates but deliberately
does not rank or allocate them. Account buffers and Do Not Touch cash are
protected, every active positive-balance debt remains eligible regardless of
APR, Income-Producing funding stays account-scoped, holding cash is explicit,
and unsupported timing/reconciliation inputs fail closed through data-quality
findings. Permanent local regressions pass, and isolated run
`20260814-112123-c4fd` passed its PURE scenario and 16/16 assertions in 5.7 s
with Provisioning/Drift PASS, verified Trash cleanup, and the runner returned
OFF. Ranking and allocation remain the next separately reviewed RFP-3 slice.

**RFP-3 Part 1 Capital Deployment Pace candidate:** the optimizer no longer
hands every dollar above the hard reserve to the ranker. A disclosed preferred
liquidity target first caps the current-period deployment budget. `BALANCED`
adds the greatest of one normalized month of forecast operating outflows,
monthly active-debt service, or monthly property contingency, plus configured
stability/volatility/event cushions; `LIQUIDITY_FIRST` retains more and
`AGGRESSIVE_DEBT_REDUCTION` can deploy more without breaching the hard floor.
The existing Robinhood policy floor, reserve restoration, source protection,
and serial APR avalanche are unchanged. Same-week proposal identity and
confirmed/awaiting period deductions prevent additive refreshes when tracking
inputs are supplied. Capital above preferred liquidity is only potential
capacity. The approved calendar-month Balanced tranche is the lesser of that
potential excess and the calculated Balanced liquidity cushion, reduced by
confirmed and awaiting-confirmation optional deployment. It is a maximum, never
a target or fixed percentage. The final recommendation is constrained again by
required uses, account protections, the hard reserve, preferred liquidity, and
post-decision 30/90-day coverage using current cash only. Missing cushion inputs
fail closed as `PACING_DATA_REQUIRED`; cash-yield ordering remains explicitly
deferred as `CASH_YIELD_DATA_REQUIRED`.

**Pre-travel Planning checkpoint — 2026-08-18:** Overview and Debt have reached
an owner-accepted, stable customer-facing checkpoint. The user performed bounded
visual testing and confirmed the current presentation looked correct. This is
visual acceptance, not Codex writer evidence and not final financial
certification. Current checkpoint evidence is: required payments this month
`$21,980.49`; already covered `$20,322.08`; still to cover `$1,658.41`; extra
payoff `$41,895.78`; remaining debt payments this month `$43,554.19`; current
credit-card debt `$98,712.16`; expected card debt after the recommendation
`$55,827.97`; potentially available over time `$90,117.54`; recommended extra
now `$41,895.78`; and `$48,221.76` staged for future decisions. The actionable
required items shown were Southwest `$988.41` due Aug 22, CitiAA `$270.00` due
Aug 28, and Meriwest `$400.00` due Aug 28. The recommendation applies
`$39,790.53` to pay off Amex and `$2,105.25` as extra CitiAA payoff, with
`$1,193.72/month` expected to be freed only after the Amex payoff is confirmed.
These figures are checkpoint evidence, never hard-coded future expectations.

Checkpoint status is **Overview UX: ACCEPTED / STABLE CHECKPOINT** and **Debt
UX: ACCEPTED / STABLE CHECKPOINT**. **Financial safety certification is PASS /
COMPLETE (2026-08-21)**. The canonical fail-closed packet proves account
buffers, current requirements, next-30-day and next-90-day gross obligations,
hard reserve, preferred liquidity, staged capital, current-cash-only coverage,
recurrence correctness, unique obligation ownership, payment-evidence
deduplication, and canonical Overview/Debt reconciliation. Isolated Central
`@387` passed 2/2 scenarios and 124/124 assertions with Restricted Provisioning
and Drift PASS, both fixtures TRASHED, and the runner OFF. A genuine financial
defect may be corrected later without reopening the accepted UX unnecessarily.
Final bounded reconciliation confirmed that the `$41,818.31` protected reserve
is the net floor after a capped `$83,636.61` forecast-income offset from
`$125,454.92` gross obligations, while the independent current-cash test uses
the full gross amount. Post-decision cash of `$133,010.14` leaves `$7,555.22`
headroom (`1.06x`), so optional deployment requires no unreceived future income.
Checkpoint `9a6cb96` is committed and pushed. The next milestone is the real
customer Import / Refresh program under the debt-risk-first sequence defined in
`PART_2A_FINANCIAL_FACTS_CONTRACT.md → §§11–15`.

The same `@387` source also fixes a newly tracked AutoPay bill inheriting a
false prior-month overdue occurrence when its row-level effective date is
blank. Bills Due now uses the immutable `bill_add` creation month as a read-only
fallback before recurrence generation. Bills Regression passed 15/15 scenarios
and 123/123 assertions with every Restricted fixture TRASHED; the runner
returned OFF.

**RFP-3b completed checkpoint (implementation detail retained):** the deterministic kernel
now orders required actions, a rolling 90-day operating reserve, account-buffer
restoration, extra debt by APR, confirmed Income-Producing funding pace, and explicit held cash; caps extra principal
after same-week minimums; and reconciles every cash use to ending cash. A
read-only **This Week** experience renders the weekly ledger, ranked choices,
blockers, protected cash, and a current-week-only monthly rollup as Planning's
default tool. Planning now uses one five-choice selector: This week, Rolling
debt payoff, Debt overview, Retirement, and Purchase simulator. The legacy Next
Actions reader/panel remains compatible, while its routes and Setup completion
resolve to This week → Overview; the common app has no alternate Planning URL.
The Bills occurrence
reader has an explicit no-write mode, so plan reads cannot trigger AutoPay.
Variable Bills use their saved estimates as protected required amounts with one
visible estimate warning; a genuinely missing estimate still fails closed. The
90-day reserve includes future Bills, debt minimums, Upcoming expenses, and an
irregular-property contingency,
offset by estimated recurring income without treating future income as current
cash or dropping below a one-month
operating floor.
Episodic healthcare Bills may remain at $0 when no expense is scheduled. Debt
minimums represented by tracked Bill aliases are counted once. Recurring gross
rent supplies property income; Bills/debts/Upcoming own scheduled mortgages,
HOA, management, insurance, utilities, tax, cleaning, and warranty costs once.
Only trailing Repair/Maintenance/Appliance/Other history, net of matching
Upcoming items, supplies additional property contingency. The aggregate
Property Performance gap is not used in this forecast.
The default view presents grouped household and plan cards, keeps zero-dollar
choices under What waits, and moves the full ledger behind calculation details.
Recurring investment contributions recorded through Bills are separated from
household Bills and displayed for review without double counting. Samer
Robinhood receives a distinct user-defined `$500/week` `POLICY_FLOOR`; its
scheduled contribution fulfills that policy, while acceleration above it remains
optional. Higher APR debt alone cannot pause the floor. An override requires an
exact liquidity or solvency violation and names the violated constraint. Future
normal-policy payments are disclosed separately from the operating reserve.
All positive revolving balances receive remaining goal money from highest APR to
lowest with no arbitrary cutoff; loans are compared using relative economics.
Delivery 1
adds the Capital Source Ladder, deterministic contribution redirection,
After Action → Next Dollar recomputation, released-minimum snowballing, and a
Why-not comparison. Stopping M1 funding, reviewing an in-kind transfer, and
reviewing a taxable sell/redeploy are distinct; sales remain `TAX_DATA_REQUIRED`.
The current correction adds recommendation lifecycle state: current actions are
`PROPOSED`, while projected payoff effects, released minimums, and the next plan
remain `AWAITING_CONFIRMATION` until refreshed balances confirm them;
`CONFIRMED` and `SUPERSEDED` are reserved lifecycle states. Eligible Cash
Sources exposes every account's balance, Use Policy, minimum buffer, usable
amount, Planning Role, and inclusion decision, and prominently warns when an
eligible positive-balance account has a $0 protected buffer.
The Part 1 freeze blocks rather than silently overrides a Samer
Ally `DO_NOT_TOUCH` mismatch, keeps children-owned cash protected, explains the
exact Robinhood policy-floor override and reserve surplus, removes behavioral APR
thresholds, keeps a 25% unknown-property-repair contingency floor,
requires visible stable identity for brokerage pools, and removes retirement or
custodial assets from actionable Capital Source Ladder candidates.
The final source is committed as `9a6cb96`; isolated Central `@387`, owner
visual acceptance, and the 30/90-day proof close this RFP-3b foundation.

**Rolling Financial Plan sequence:** `RFP-1` read-only contract → `RFP-2`
optional funding-purpose metadata → `RFP-6a` broker activity/holdings foundation
(prioritized after granular data arrived) → `RFP-3` read-only recommendation engine →
`RFP-4` completed **This Week** decision detail with deterministic **Why not?**
counterfactuals → `RFP-5` disposable-workbook and isolated runtime proof.
`RFP-6b` allocation analysis and `RFP-7` tax-lot analysis are later optional
portfolio layers; the household plan must work without either. Each slice has a
separate review and commit boundary. Existing Rolling Debt Payoff behavior stays
unchanged until a reviewed composition seam is introduced, and no slice may
automatically transfer cash, sell securities, or post debt payments.

`RFP-6c` is the product-wide data-import framework follow-up. It extracts the
safe workflow established by the Robinhood adapter—source detection,
account/entity mapping, Preview, validation, confirmation, provenance/as-of
status, import history, duplicate reporting, actionable row-level errors,
audit/rollback, and safe overlapping re-imports—for reuse by Investments, Bank
Accounts, Debts, Bills, Income, Houses/valuations, and future domains. Each
domain keeps its own normalized contract, business rules, permissions, and
adapter registry; brokerage trades, bank transactions, balances, bills, and
property valuations are not forced into one universal schema. Robinhood remains
the first adapter; E*TRADE, M1, Schwab, bank exports, valuation sources, and
other approved formats are added incrementally. Raw source files remain
non-retained by default. Any future direct provider connection requires its own
read-only security, consent, token-storage, privacy, and support review. This
work does not block the base household plan or expand the current `RFP-6a`
runtime-validation boundary.

**RFP-6c sequencing clarification (2026-08-21):** RFP-6c is reusable import
infrastructure, not authority to ingest every domain at once. The canonical
long-term order is revolving debt → bank/cash → loans/mortgages → investment
accounts → holdings/tax-aware data → Bills, income, property, retirement, known
commitments, and targeted transaction evidence → later authority migration.
See `PART_2A_FINANCIAL_FACTS_CONTRACT.md → §§11–15`. Where the older RFP-6c
adapter list appears broader, this ordered Part 2A lifecycle controls
implementation.

### Part 2A normalized financial data foundation

- **2A-0 — Contracts:** complete in
  `PART_2A_IDENTITY_CONTRACT.md`. Authority and freshness are fact-level;
  Effective As Of and Observed At remain distinct; adapters never overwrite
  household policy.
- **2A-1 — Stable identity:** complete in commit `9dc7c5a`, with additive
  `SYS - Financial Accounts` and `SYS - Account Source Links` registries,
  adoption of existing Investment IDs, fail-closed owner/registration matching,
  source-scoped protected identifiers, and no Planning authority switch. Isolated
  Central `@356` run `20260815-115249-7301` passed 7/7 with verified cleanup.
- **2A-2 — Financial Facts Foundation:** complete on isolated Central `@357`. Adds
  lazy append-only `SYS - Financial Facts`, 14 typed value contracts, versioned
  provenance/freshness/selection policy, conflict-preserving current selection,
  decision-specific model/action confidence, legacy UNKNOWN-date representation,
  idempotent supersession, and an in-memory rebuildable projection. Part 1
  Planning remains authoritative; no persisted Current Facts sheet or production
  import is introduced. Two scenarios passed 25/25 assertions in 18.8 seconds
  with Provisioning/Drift PASS, both marker-verified fixtures verified TRASHED,
  and the disposable runner OFF. Contract: `PART_2A_FINANCIAL_FACTS_CONTRACT.md`.
- **2A-3 — First Authoritative Cash Import:** runtime-proven on isolated Central
  `@358`. Adds the
  source-neutral `CASH_EVIDENCE_V1` boundary, first OFX/QFX statement adapter,
  fail-closed account matching, deterministic Preview/Apply, append-only cash
  facts, sanitized `SYS - Import Runs`, exact timestamps, duplicate no-op,
  verified-manual fallback, exact currency-minor-unit shadow reconciliation
  separated from not-yet-decided planning materiality, and
  explicit cash-yield diagnostics. Planning remains on its existing reader.
  Run `20260816-200938-c001` passed the registered scenario and 24/24 assertions
  in 23.8 seconds with Provisioning/Drift PASS, verified Trash cleanup, and the
  disposable runner OFF. Real Ally/Bank of America exports remain unproven; no
  bounded evidence is claimed.
- **2A-4 — Authoritative Revolving Debt Import:** runtime-proven on isolated
  Central `@363`. Adds `DEBT_EVIDENCE_V1`, OFX/QFX and
  structured/manual adapters, separate debt/APR component facts, deterministic
  Preview/Apply, protected identity, granular balance/ranking/payment/payoff
  readiness, and shadow reconciliation. Planning APR is selected only when the
  source proves economic applicability to the carried balance; ambiguity stays
  Review Required. Current zero balances do not release minimums. Planning
  remains on `INPUT - Debts` and no authority switch is included. Run
  `20260817-074631-0fb6` passed 1/1 scenario and 33/33 assertions in 44.7 seconds
  with restricted sharing, Provisioning/Drift PASS, verified Trash cleanup, and
  the disposable runner OFF.
- **2A-5 — Data Refresh & Plan Readiness UI:** runtime-proven on isolated Central
  `@369`. Adds one compact
  Planning Overview status and a dedicated This Week → Data subview for cash and
  revolving-debt freshness, exact differences, actionable review items, and
  verified-manual carried-balance APR review. This is a shadow-only customer
  review surface; it does not change Part 1 calculations or Planning authority.
  The customer-state contract now distinguishes **Not connected**, **More data
  needed**, **Needs review**, and **Ready for review**; empty domains never render
  as `Ready 0 / 0`. Run `20260817-100909-59f7` passed 1/1 scenario and 35/35
  assertions in 29.8 seconds with Restricted sharing, Provisioning/Drift PASS, verified Trash
  cleanup, and the disposable runner OFF. Central Beta and the bounded workbook
  were untouched. Companion Capital Allocation run `20260817-102943-17fd`
  passed 2/2 scenarios and 99/99 assertions after the proposed/awaiting/confirmed
  customer-language correction, with both fixtures verified TRASHED.
  Deferred UX note: bounded testing showed that top-level **Planning → Cash**
  can be confused with the internal **Data → Cash** section. This does not
  reopen the frozen Overview/Debt checkpoint and is outside the next accuracy
  milestone; any future label change requires its own focused approval.
- **Planning foundation checkpoint after 2A-5:** Overview and Debt are frozen,
  30/90-day safety is proven, and calculation semantics are stable. Manually
  maintained cash/card facts are nevertheless known to be stale. The next
  accuracy milestone is real customer Cash + Credit Card Import / Refresh,
  initially shadow-only, with effective dates, freshness, provenance, and exact
  comparison against current Planning values. The combined authority switch,
  persisted Current Facts, payment execution, broad transaction import, and
  authority migration remain stopped behind later explicit review.
- **Canonical long-term import/data model:**
  `PART_2A_FINANCIAL_FACTS_CONTRACT.md → §§11–15` owns the shared evidence →
  normalization → stable-identity match → shadow comparison → review → later
  authority → recalculation lifecycle. The first slice does not cross the
  authority boundary. After revolving debt and cash, the planned order is
  loans/mortgages; investment accounts; holdings/tax-aware data; Bills/income/
  property/retirement/known commitments plus targeted transaction evidence;
  then a separately approved authority migration.

**Remaining broad-Beta sequence:** preserve the frozen Planning foundation while
the shadow-only Cash + Credit Card Import / Refresh accuracy milestone proceeds;
retain residual `RFP-4`/`RFP-5` broader-experience and evidence work as separate
future items rather than reopening Overview/Debt UX;
resume and close `3o` Houses, Income, and Bills; close the separate `3j` task; return to
the deferred `5j`–`5m` correction families; finish `5a`–`5f`
financial/workbook/recovery proof; finish `6a`–`6f` operations and
`7a`–`7f` product foundation; then complete frozen-candidate evidence `8a`–`8f`
plus advocate rerun `3k`, followed by supervised cohort/promotion `9a`–`9e`.
Retirement runtime proof (`1e` / `REG-025`) is complete on isolated `@211`;
Bill Skip/Stop-tracking safety (`1d` / `REG-024`) remains complete on `@206`.
Preserve the exact-owner rule: diagnostic browser runs are never release
evidence, and a final candidate different from `8aa4bf5` / `@318` must rerun
Performance under `8b`. Preserve Beta `@106` plus the user-controlled bounded deployment.

### Priority 2 — Financial Model Accuracy — complete

**✅ House Financial Accuracy V1 complete 2026-07-22.** This product-model milestone followed Validator Phase 2 and closed before the broad Beta Release Candidate. Full scope and evidence are recorded below and in `HOUSE_FINANCIAL_ACCURACY_PLAN.md`.

- **House Financial Accuracy V1** — rental-property cash-flow accuracy now includes actual linked financing payments in Property Performance while preserving operating expenses and equity sources. Broader house-model expansion is deferred.
- **Financial Integrity Phase 3 — complete.** Commit `9b97c4d`; isolated Validation `@156` suite `20260722-164849-6081` passed 53/53. Planner, Rolling, Dashboard, History, and all five audits share and prove the authoritative active-owned-position basis.

### Priority 3 — Performance, finished-feeling UX, and scalability

- Beta-critical performance and experience pass before broad release: provisioning + dashboard/planner latency, bulk-API and caching passes, long-running-action feedback, terminology/loading consistency, responsive/accessibility review, and measured scale toward more users/workbooks.
- **Activity correction / recorded-payment correction — broad-Beta gate.** Execute
  `FULL_BETA_REMAINING_PLAN.md → 5g–5m`: truthful actions first, then immutable
  precondition-gated correction for direct Cash Flow, linked Bill occurrences,
  Upcoming, and compound House Expenses. A specific recorded occurrence may be
  corrected or reopened only when its affected state reconciles; preserve the
  original Activity event and append a correction event with before/after state.
- **Web Dashboard page-by-page polish** — execute the ordered `UX-01` through `UX-10` passes in `TODO.md → UX Backlog (Version 1)`, beginning with the Overview information architecture and balanced-grid pass. Each ID is a separate reviewable/validatable change; preserve calculations, schemas, and write behavior.
- **Tracked-editor navigation consistency — runtime-validated through isolated `@195`.** Long-lived financial items now use one recognizable hierarchy: Bills **Due · Add · Manage**; Houses / Bank Accounts / Investments / Debts **Update · Add · Manage**. Setup deep-links preserve whether the customer chose Add or Manage. Update is Save-only; Manage owns active-item inventories and guarded Stop tracking actions with confirmation. Bank import workflows are secondary Manage tools. Shared UI primitives prevent each asset editor from reimplementing mode, focus, list, and empty-state behavior; writers remain feature-specific. First-Run V4 passed 10/10 and Populated V3 passed 13/13 with zero browser errors, Restricted ownership, and verified Trash cleanup.
- **Independent advocate trust gate** — close the confirmed P1 Bank money-editor, Income/Setup truth, Bills Pay/occurrence feedback, and customer-language findings before claiming Core Experience or 10/10 UX readiness. Preserve the advocate as an independent evidence role and retest every writer fix only on a newly guarded disposable workbook.
- **Financial Plan refresh latency — Planner gate closed for `@318`; cross-flow measurement closed on `@319`; ordinary Save investigation closed on `@322`.** Isolated blank/fresh `@114` took 143 seconds; profiling and focused optimization through `@317` retired generated charts, reduced repeat `format_dashboard` from 18.303 s to 0.378 s, and reduced snapshot construction from 13.026 s to 4.867 s. Exact-owner `@318` campaign `PERF-e75d61db-7f46-446b-a4cd-93c84e893a8a` then passed 20/20 pairs against ratified 30/60 s budgets. V10 `@322` reduced ordinary Save completion p50/p95 from 11.060/17.568 s to 6.520/9.418 s and passed 24/24 functional assertions; the strict 6 s budget remains a documented near-miss. All fixtures were Restricted and cleanup-verified. `8b` reruns Performance if the final source/deployment differs.
- **10/10 Beta Release Candidate gate** — after P1 evidence, P2 financial truth, and P3 experience/performance work, run the exact candidate through the full scorecard and release gates in `BETA_10_OUT_OF_10_PLAN.md`. A supervised cohort may run earlier; broad or monetized beta does not.

### Priority 4 — Future features

- **Whole-Household Debt Freedom Planner** *(north-star capability; after the
  import/freshness foundation)* — continuously construct the safest
  high-confidence path from today's next dollar to debt freedom across credit
  cards, HELOCs, mortgages, auto/personal/credit-union loans, and other debt.
  Compare More Liquidity, Balanced, Faster Debt-Free, and Custom strategies;
  answer five-year versus seven-year target questions; roll confirmed freed
  payments into the next best use; evaluate refinance/HELOC, investing,
  property-equity, and known liquidity-event tradeoffs; and continuously
  reforecast a confidence-labeled date as authoritative facts change. It may
  never accelerate the date by violating required obligations, liquidity,
  30/90-day safety, taxes, retirement restrictions/match economics, or other
  household protections. Canonical future contract:
  `ROLLING_FINANCIAL_PLAN_DECISION_CONTRACT.md → Future north star`.
- **Credit Card Rewards & Spend Optimization** *(later phase, only after debt-data
  authority and debt optimization are complete)* — answer “Which credit card
  should I use for this purchase/category right now?” from reward multipliers,
  rotating categories, merchant restrictions, promo dates, caps, annual fees and
  statement credits, foreign-transaction fees, point valuation, revolving
  balances, expected payoff behavior, and interest risk. Safety is authoritative:
  rewards never override debt or interest risk. First exclude or penalize cards
  whose new spend is likely to revolve at expensive APR; only then rank net reward
  among financially safe cards and explain the winner. The future surface may say
  “Use Costco for gas this quarter” or “Do not use Southwest while its balance is
  revolving.” No schema, UI, or reward recommendation logic belongs in Part 2A.
- **Recurring Bill Schedule & Gap Modeling** *(later phase, only after current
  Part 2A data-authority and debt work)* — model bills and expenses that are
  monthly, every other month, every N months, quarterly, semiannual, annual,
  seasonal/custom-month, irregular-but-known, or one-time. Preserve three
  different meanings in every period: `0.00` means the schedule proves nothing
  is due; an amount means an actual or expected bill belongs in the period; blank
  or Unknown means Cash Compass lacks enough evidence and must not silently infer
  zero. Future rules should cover frequency/interval, due months and dates,
  expected versus actual amounts, start/end dates, next occurrence, exceptions,
  skips, and amount changes, with optional sinking-fund/accrual planning for large
  periodic costs. Historical actuals and future expectations remain separate.
  Prefer rendering derived zero values from the recurrence rule instead of
  physically filling workbook cells with artificial zero records. No recurrence
  schema, zero-fill behavior, sinking-fund logic, or UI change belongs in Part 2A.
- **AutoPay Pending Confirmation UX** *(future product enhancement — after Test Harness / Release Readiness)* — visually distinguish AutoPay bills that are **awaiting payment confirmation** from bills that **require manual action**, without hiding them or inferring payment from the due date. Keeps current behavior; adds an "AutoPay Pending" state/badge and a future auto-transition **Pending → Confirmed → Completed** once a matching payment is detected via manual entry / bank import / future bank sync (then removed from the Bills Due attention queue). Never auto-complete AutoPay bills without payment evidence. Full spec: `ENHANCEMENTS.md → Future — AutoPay Pending Confirmation UX`.
- Money Plan Phase 2; broad provider-connected Account Aggregation & Transaction
  Import beyond the current shadow fact milestone; Chat / Assistant; Paid
  Product framework; and other post-beta product direction (`PRODUCT_VISION.md`,
  `ENHANCEMENTS.md`).
- **Monetization preparation begins before billing:** define customer/value proposition, packaging hypotheses, entitlement seams, owned-data guarantees, privacy/terms/support posture, cost metrics, and billing architecture during beta hardening. Actual payment collection remains gated on demonstrated trust, repeated use, supportability, and the 10/10 release standard.

---

## House Financial Accuracy *(Priority 2 — High)*

**Execution plan:** `HOUSE_FINANCIAL_ACCURACY_PLAN.md` — completed additive V1
direction, canonical fresh/evolved schema, implementation slices, regression
matrix, approved bounded validation, and rollback boundaries. Manual Golden
workbook alignment remains separately approval-gated.

Sequenced **immediately after Validator Phase 2 and before major new user features.**

> **This is a financial-model improvement, not a UI enhancement.**

**Goal.** Improve the financial accuracy of rental-property cash-flow calculations.

**Delivered result.** Property Performance now preserves operating income and expenses while separately including actual selected-year mortgage/loan/HELOC payments and truthful after-financing net cash flow.

**Delivered V1 work.**

- Include actual selected-year **mortgage / loan / HELOC payments** in Property Performance cash flow without mixing them into operating expenses.
- **Separate** expense classes:
  - **Operating Expenses**
  - **Financing Expenses**
- **Calculate**:
  - internal **Operating Cash Flow**
  - **Loan Payments**
  - **Net Property Cash Flow**
- Reconcile Property Performance to the existing House Values, House Expenses, Debts, and Cash Flow sources without changing their established values.

**Still outside V1:** full Planner / Dashboard / Rolling Debt convergence belongs to Financial Integrity Phase 3; principal-vs-interest, escrow, HOA, refinancing, and variable-rate modeling remain future enhancements.

**Future-proof the design for:** escrow · HOA · refinancing · variable-rate loans · interest-vs-principal reporting · multiple loans per property.

**Engineering goals.**

- **One shared house cash-flow calculation helper.**
- **No duplicated mortgage calculations.**
- **Validator checks** that property totals **reconcile across all house-related sheets**.

*(Related existing work to build on / reconcile: `property_performance.js` (Property Performance module + `getInactiveHousesSet_`), the `HOUSES - <Property>` expense sheets, House Values year-block ledgers, and the Upcoming Expenses "Loan / Financing excluded from cash reserve" behavior in `rolling_debt_payoff.js`. This milestone **unifies** the financing model rather than adding another one.)*

---

## Related documents

- `TODO.md → Product Maturity Stages` — the detailed Stage 1–6 roadmap (effort, dependencies, history, Beta Gate).
- `PROJECT_CONTEXT.md` — current architecture + project status.
- `ENGINEERING_STANDARDS.md` — engineering rules, canonical styling, and **Milestone Discipline (§11)**.
- `VALIDATOR_ARCHITECTURE.md` — the Validator subsystem (Phase 1 and the Phase 2 foundation complete; remaining Phase 2 scope planned).
- `BETA_10_OUT_OF_10_PLAN.md` — quality scorecard, non-negotiable release gates, supervised-cohort boundary, and monetization-ready delivery map.
- `GOLDEN_WORKBOOK.md` / `WORKBOOK_PARITY_CHECKLIST.md` — the Canonical workbook standard + per-sheet convergence status.
