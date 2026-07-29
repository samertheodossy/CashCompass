# CashCompass Roadmap

*The current at-a-glance **priority stack** for CashCompass — the authoritative view of what comes next and in what order.*

**Documentation only.** This document sets **priority and sequence**. The complete numbered pre-Beta inventory, estimates, critical path, and parallel lanes live in `FULL_BETA_REMAINING_PLAN.md`; the detailed **Stage 1–6** roadmap (with per-item effort, dependencies, and history) lives in `TODO.md → Product Maturity Stages`; current technical status lives in `PROJECT_CONTEXT.md`; engineering rules (incl. **Milestone Discipline**) live in `ENGINEERING_STANDARDS.md`. Where the priority stack below and the Stage model disagree on ordering, **this document reflects the latest intent.**

> Follow **Milestone Discipline** (`ENGINEERING_STANDARDS.md → §11`): finish the current milestone before starting the next; record discoveries here instead of implementing them immediately; close milestones cleanly before opening the next.

---

## Current status (2026-07-29)

**Completed:**

- ✅ **Golden/Canonical engineering convergence** — `AdoptGolden = 0` for the audited families (Operational, Financial Ledger, SYS, Special); remaining diffs are intentional (KeepCentral / ProductDecision / IgnoreNoise). See `GOLDEN_WORKBOOK.md`, `WORKBOOK_PARITY_CHECKLIST.md`.
- ✅ **Validator Phase 1** — read-only Golden↔Central formatting parity + recommendation engine + scoped family runners, admin-gated and default-off. See `VALIDATOR_ARCHITECTURE.md`.
- ✅ **Central migration Phase 1** — user-facing paths resolve the correct workbook via `getUserSpreadsheet_()` (no `getActiveSpreadsheet()` null bugs on the audited paths).
- ✅ **Validator Phase 2 + Test Harness / Release Readiness foundation** — Provisioning, Workbook Drift, Schema Evolution V1, the formal schema, Formula / Conditional-Formatting / Named-Range modules, aggregate Workbook Health, the disposable-workbook harness, required non-performance scenario packs, and the bounded Validation console are complete and runtime-proven through isolated Central `@141`.
- ✅ **P0 Documentation Cleanup / Project Stabilization** — closed 2026-07-20 after synchronized documentation, ProductDecision closeout, Central Tier-2 verification, the full Recovery 6F matrix, and two-track isolated `@114` blank/fresh plus representative populated-workbook runtime validation.
- ✅ **Unified-source bounded smoke + signed-currency polish** — after creating a safety copy, the same source was pushed to the bounded Apps Script project. Overview loaded materially faster; sampled balances, Upcoming, Bills, weekly change, and several pages reconciled; no rollback was required. Negative deltas now render as `-$…` consistently, with bounded runtime proof and permanent dashboard regression coverage.
- ✅ **House Financial Accuracy V1** — commit `96d0ebe` is on `origin/main`. Additive final `Linked Property` debt schema, Loan/HELOC-only managed links, actual selected-year Cash Flow loan payments, fail-closed ambiguity guards, and after-financing Property Performance totals passed exact isolated Central `@145` run `20260722-124210-bc23` (27/27 assertions, Restricted sharing, verified Trash) and a user-approved bounded comparison made under a workbook backup. Existing Overview values, property equity, rent, and operating expenses remained unchanged; no Harness run targeted the bounded workbook.
- ✅ **Financial Integrity Phase 3** — commit `9b97c4d` is on `origin/main`. The approved active-owned-position basis, shared Planner/Rolling/Dashboard path, five read-only audits, canonical History freshness, and Release Readiness inventory passed isolated Validation `@156` suite `20260722-164849-6081` 53/53 with all safety gates and verified Trash.

**Now / next:**

- **Current milestone checkpoint:** **`5i`, immutable direct Quick Add correction, is product-approved and ready for the Git checkpoint.** Activity offers **Change amount** and **Remove entry** for eligible cash, created-row, credit-card, and Donation operations. Permanent coverage includes exact-state and retry refusal, newest/middle/earlier/post-correction positions, later-entry preservation, immutable correction history, same-page refreshed values, customer-safe positive expense amounts, and same-target receipt retirement. Full local regressions pass. Clean isolated Central `@240` run `FR-d75843e0-486e-4faa-8967-05ee40b73e25` passed 21/21 in 383.006 s with zero browser errors, Restricted single-owner sharing, and verified exact-fixture Trash cleanup. No formula definition, schema, or Activity-column migration was introduced. `5h` is committed as `d040a34`; after this commit checkpoint, `5j` Bill occurrence correction is next. Beta remains `@106`; bounded deployment and workbook control remain with the user.
- **Independent advocate gate added 2026-07-23:** the approved isolated interactive writer journey confirmed P1 trust defects in formatted bank-amount replacement, Income/Setup classification consistency, Bills Pay handoff/occurrence feedback, and normal-path implementation terminology. The bank replacement defect is runtime-closed on isolated `@175`, the Income/Setup fix on `@176`/`@178`, the contained language/responsive wave on `@177`, `REG-017` on `@179`, exact-owner `REG-015` on `@181`, readiness-refresh `REG-019` on `@182`, Bills completion semantics on `@193`, controlled failure evidence through `@203`, and Retirement runtime truth on `@211`. The last formal advocate score is **8.3/10** pending a fresh full-score run. Medium/narrow replay and accessibility remain open. No Beta, mapped-user, Golden, or configured-default workbook was used by the Harness; bounded inspection remained user-controlled. These findings are sequenced in `TODO.md → UX Backlog (Version 1) → Independent advocate priorities`.
- **Tracked-editor consistency polish completed 2026-07-24:** Bills use **Due · Add · Manage**. Houses, Bank Accounts, Investments, and Debts use **Update · Add · Manage**, with explicit Setup Add/Manage handoffs, responsive active-item inventories, and a shared UI layer for mode selection, list rendering, focus, and empty states. Update is Save-only; Manage is the single lifecycle-maintenance surface for guarded Stop tracking. Bank Import / Review imports remain secondary tools under Manage accounts. First-Run V4 run `FR-a1df6d9b-c123-4759-b08e-438d4047bf4c` passed 10/10 and Populated V3 run `FR-158bd6a2-bcb9-41b3-addc-180369266010` passed 13/13 on isolated Central `@195`, each with Restricted single-owner sharing, zero browser errors, and verified Trash cleanup.
- **Activity correction elevated to the broad-Beta gate 2026-07-26:** Activity must distinguish audit evidence from correctable financial operations. The first slice (`5g`) replaces the misleading Remove-for-every-row presentation with an **Action** column, shows **Remove donation** only for eligible Donation rows, exposes no action control for Planner/email/import or other unsupported rows, and preserves the server-side donation-only rejection. Later slices add immutable, precondition-gated correction for Quick Add, linked Bill occurrences, Upcoming payments/lifecycle, and compound House Expenses; entity lifecycle events route to their owning Manage workflow and system/import rows remain audit-only. Full scope and estimates: `FULL_BETA_REMAINING_PLAN.md → 5g–5m`; safety contract: `TODO.md → Activity — Correction / reverse transaction`.
- **Isolated `@196` advocate reconciliation:** `5g` passed interactively. The read-only **7.2/10** run is evidence-limited and does not replace the formal writer-inclusive **8.3/10** score. The resulting Beta work is mapped as `3l` Overview health prerequisite/freshness trust, expanded `3j` programmatic labels and target sizes, `3m` form readiness/customer language, plus `3b`, `3c`, `3h`, and `3i`; `2d` is now closed as `REG-026`. Each fix must add or extend the exact permanent UI/server/browser regression described in `FULL_BETA_REMAINING_PLAN.md`; generic page-load coverage is not sufficient.
- **Isolated `@197` Overview trust closure:** First-Run V5 run `FR-23fd31cb-df7b-4f2e-8202-586e70254af0` passed 11/11 and Populated V4 run `FR-9a7b266a-681e-467d-8489-cf8218be666f` passed 14/14. Both used a new Restricted, single-owner disposable workbook, passed `health_prerequisite_truth`, recorded zero errors, and verified exact-fixture Trash cleanup. The console-owned disposable-runner flag returned to **OFF**. Beta remained `@106`; no bounded, mapped-user, configured-default, Golden, or administrator workbook was a writer target.
- **Then:** execute the remaining score-by-score program in `TODO.md → Advocate 10/10 score-improvement program`: controlled error/safety journeys → transition/language cleanup → page-level ease/navigation/visual polish → responsive/accessibility → exact-candidate rescore. Each criterion requires isolated runtime evidence and an advocate rescore before closure. The core Bills decision and payment journey are no longer open.
- **Explicitly parked pre-Beta gate:** the Performance Planner percentile campaign and final exact-candidate READY/NOT READY verdict. Seven historical sample pairs are diagnostic only because the campaign began before `@141`; performance must be rerun as an exact-candidate campaign and ratified before any broad Beta release. Deferral does not waive the gate.
- **Measured follow-up:** Financial Plan refresh succeeded but took 143 seconds on the blank/fresh fixture. Reusable privacy-safe stage instrumentation is now source-ready behind `PERFORMANCE_TIMING_ENABLED`; isolated first-run/repeat timing evidence and optimization remain under P3 Performance without reopening the completed P0 functional-feedback work.
- **Release policy:** CashCompass is **quality-gated, not date-gated**. A small supervised cohort may validate work during P1–P3, but a broad Beta Release Candidate must satisfy `BETA_10_OUT_OF_10_PLAN.md`: score ≥95/100, no dimension below 9/10, no unresolved Severity 1 or Severity 2 defect, and every non-negotiable release gate passing.

---

## Broad invited-Beta forecast

**Target decision: 2026-09-24 · contingency boundary: 2026-10-02.** This is a
gate-based forecast, not a promise to ship. Controlled Family Beta can continue
now for the existing supervised cohort; it does not authorize a Central Beta or
bounded deployment change. A four-week buffer accommodates planned time away in
August. Finishing Wave 1 early creates useful schedule margin, but the September
24 target remains **at risk** because the newly elevated Activity correction
program is still the largest uncertainty. Rebaseline after the durable
correction foundation (`5h`) has measured implementation evidence.

| Window | Planned scope and exit |
|---|---|
| Completed through Jul 27 | Closed HTTP 0 recovery, exact-candidate ownership, core Bills Pay, tracked-editor convergence, Activity action truth, Overview prerequisite/freshness trust, unattended browser orchestration, controlled Bank/Debt loading, Bill Skip/Stop safety, and Retirement runtime through isolated `@211`. Wave 1 is complete. |
| Aug 21–27 | Begin `5h` durable correction identity/preconditions and, if that contract closes cleanly, advance `5i` direct Cash Flow correction. Use runtime waits for audits of `3a`, `3b`, and `3m` plus operations/product documentation. |
| Aug 28–Sep 3 | Complete Bills/Upcoming/House Activity correction, entity/audit dispositions, and permanent correction evidence. |
| Sep 4–10 | Close remaining UX including form readiness/customer language, accessibility, responsive/medium-width, keyboard/focus/semantics/contrast/reduced-motion evidence and finish candidate prerequisites. |
| Sep 11–17 | Freeze the candidate; complete the 20-pair Performance campaign, ratify p50/p95 budgets, and run full Release Readiness. |
| Sep 18–24 | Complete a five-to-seven-day supervised cohort, final scorecard, and broad-Beta go/no-go. |

The October 2 boundary allows one focused repair/retest cycle. Any failed
financial, safety, privacy, performance, Severity 1/2, ≥95/100, or
no-dimension-below-9 gate moves the decision. Assumptions and full exit evidence
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
2. `5i` — direct Cash Flow correction. **Implementation, user Central review,
   and isolated-runtime validation complete; pending commit approval.**
   The Activity Action column exposes
   **Correct entry** only for new direct Quick Add operations. Preview and the
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
   cleanup. This item is ready for the Git checkpoint.
3. `5j` — Bill payment, Skip, and AutoPay occurrence correction.
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

1. `3a` — loading states.
2. `3b` — empty/error and guided-Add states.
3. `3c` — Debt destination relationships.
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

1. `4a`–`4c` — optimize Dashboard formatting, snapshot construction, and chart
   rebuilding.
2. `4d` — measure every release-critical flow.
3. Finish all candidate prerequisites, then freeze once.
4. `4e` — run twenty exact-candidate first/repeat pairs.
5. `4f` — ratify and pass p50/p95 budgets.

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

*(P0 closed 2026-07-20; P1 **Release Readiness infrastructure and non-performance evidence** are complete, while its Performance/final-verdict gate is intentionally parked. This is an explicitly approved sequencing exception to Milestone Discipline so P2 may proceed without waiving the parked gate. Other P1 recovery follow-ups—including read-only orphan detection, 6D.2b Create New Workbook, and 6E.2 Admin Set Mapping—remain separately tracked and are not claimed complete here. Detail: `VALIDATOR_ARCHITECTURE.md → §10 Phase 2` (the judge) and `TEST_HARNESS_ARCHITECTURE.md` (the writer), with `REGRESSION_SCENARIOS.md`, `RELEASE_READINESS.md`, and the quality gate in `BETA_10_OUT_OF_10_PLAN.md`.)*

**Sequenced milestone order** (the Validator is the read-only **judge**; the Test Harness is the developer-only **writer/mutator** that drives scenarios against disposable workbooks and asks the Validator to confirm nothing broke):

1. **Validator Phase 2 / Workbook Health — ✅ dedicated runtime evidence complete; isolated Central `@122` PASS 2026-07-21.** The formal schema registry, targeted Formula validation, Conditional-Formatting validation, thin Named-Range validation, Provisioning, Drift, and aggregate Workbook Health ran on a Restricted populated disposable fixture. The first `@121` run safely exposed 25 advisory formula findings: 24 valid Google Sheets-normalized single-cell `SUM` shapes and one Debt fixture row-order defect. Narrow fixes plus permanent regressions were deployed at `@122`; confirmation run `20260721-120759-5dc2` returned aggregate Health PASS with zero warnings, 9/9 functional assertions, CURRENT/FULLY_CURRENT schema, Restricted sharing, and verified Trash cleanup (160.338 s). Beta stayed `@106`; the bounded workbook was untouched.
2. **Test Harness foundation** — **✅ V1 done.** *(disposable-workbook lifecycle + fail-closed guard + `assertDisposableTarget_` + single SMOKE scenario `SMOKE-PROVISION-DONATION` + report; editor runners `testRunSmoke()` / `testRunSmokeTrash()` and the console Test Harness card — `TEST_HARNESS_ARCHITECTURE.md`)*
3. **Disposable populated-fixture hardening** — **✅ complete; isolated Central `@117` PASS 2026-07-21.** Central created a Restricted, owner-only fixture under the intentional `drive.file` boundary; the harness seeded representative Bank / Investment / House / Debt / Bills / Income / Upcoming / Retirement data, passed 9/9 functional assertions plus Provisioning/Schema/Drift checks, and verified Trash cleanup by Drive read-back. Every write received the disposable spreadsheet explicitly; owner/bounded workbooks were untouched. The 119.7-second harness duration is recorded as test-infrastructure performance evidence, not a product-flow regression.
4. **Scenario packs — ✅ complete except the parked percentile campaign.** The exact `@141` evidence run passed First-Run UX (`FR-0c415ac6-cfea-4525-8bf2-766086ce83e9`), Populated Dashboard (`FR-263dfd04-4166-454b-8f95-2db2f26613d9`), and Recovery Live (`RL-099c9c9c-c090-46d7-9d4b-84d7b8af14df`). Recovery Live passed 9/9 in 44.060 s; all three fixtures were Restricted and verified in Trash, protected-target matches were zero, and sole-admin configuration/mapping fingerprints were unchanged. The bounded Release Readiness run also passed Workbook Health and all 13/13 server checks. On isolated Central `@120`, **Bills Pay E2E** passed 3/3 and the single-scenario **Performance Planner** smoke passed 4/4. The production-path audit remains enforced by `npm test`.
5. **Release Readiness gate — ✅ orchestration/runtime controls complete; final verdict parked.** The single Validation console now starts, resumes, pauses, and finalizes bounded runs; each writer check creates and safely trashes its own disposable workbook; browser evidence is accepted only for the exact source/deployment candidate; compact evidence is archived; and a console-owned Harness flag returns OFF at finalization. Source commit `a4f6ddf` is on `origin/main`; isolated Central `@141` proved the runner. The current run remains `IN_PROGRESS`, not READY, because Performance p50/p95 budgets are unratified.
6. **Validation & Testing admin console — ✅ Release Readiness controls complete.** Workbook Health, the suite inventory, guarded browser adapters, resumable bounded checks, saved status, privacy-safe evidence export, and final READY/NOT READY controls now start and end from the single console.

**Next active item:** `5h`, the end-to-end financial operation envelope,
exact-state precondition, preview, and immutable correction-event foundation.
Retirement runtime proof (`1e` / `REG-025`) is complete on isolated `@211`;
Bill Skip/Stop-tracking safety (`1d` / `REG-024`) remains complete on `@206`.
Keep Performance Planner
parked until the exact candidate, never treat a diagnostic browser run as release
evidence, and preserve Beta `@106` plus the user-controlled bounded deployment.

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
- **Financial Plan refresh latency** — isolated blank/fresh `@114` completed correctly but took **143 seconds**. Central `@115` profiling measured **81.455 s first / 77.275 s repeat**. The first optimization passed on isolated `@116`: History rows and their dashboard consumers remained correct while six unused embedded History charts were retired; the repeat History stage fell from **11.507 s to 0.165 s** and total repeat server time reached **43.946 s**. Next address Dashboard formatting (**18.303 s on the `@116` repeat**), snapshot construction (**11.783 s**), and Dashboard charts (**4.848 s**), then collect enough samples to ratify the release percentile.
- **10/10 Beta Release Candidate gate** — after P1 evidence, P2 financial truth, and P3 experience/performance work, run the exact candidate through the full scorecard and release gates in `BETA_10_OUT_OF_10_PLAN.md`. A supervised cohort may run earlier; broad or monetized beta does not.

### Priority 4 — Future features

- **AutoPay Pending Confirmation UX** *(future product enhancement — after Test Harness / Release Readiness)* — visually distinguish AutoPay bills that are **awaiting payment confirmation** from bills that **require manual action**, without hiding them or inferring payment from the due date. Keeps current behavior; adds an "AutoPay Pending" state/badge and a future auto-transition **Pending → Confirmed → Completed** once a matching payment is detected via manual entry / bank import / future bank sync (then removed from the Bills Due attention queue). Never auto-complete AutoPay bills without payment evidence. Full spec: `ENHANCEMENTS.md → Future — AutoPay Pending Confirmation UX`.
- Money Plan Phase 2, Account Aggregation & Transaction Import, Chat / Assistant, Paid Product framework, and other post-beta product direction (`PRODUCT_VISION.md`, `ENHANCEMENTS.md`).
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
