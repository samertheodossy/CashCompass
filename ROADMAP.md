# CashCompass Roadmap

*The current at-a-glance **priority stack** for CashCompass — the authoritative view of what comes next and in what order.*

**Documentation only.** This document sets **priority and sequence**. The detailed **Stage 1–6** roadmap (with per-item effort, dependencies, and history) lives in `TODO.md → Product Maturity Stages`; current technical status lives in `PROJECT_CONTEXT.md`; engineering rules (incl. **Milestone Discipline**) live in `ENGINEERING_STANDARDS.md`. Where the priority stack below and the Stage model disagree on ordering, **this document reflects the latest intent.**

> Follow **Milestone Discipline** (`ENGINEERING_STANDARDS.md → §11`): finish the current milestone before starting the next; record discoveries here instead of implementing them immediately; close milestones cleanly before opening the next.

---

## Current status (2026-07-22)

**Completed:**

- ✅ **Golden/Canonical engineering convergence** — `AdoptGolden = 0` for the audited families (Operational, Financial Ledger, SYS, Special); remaining diffs are intentional (KeepCentral / ProductDecision / IgnoreNoise). See `GOLDEN_WORKBOOK.md`, `WORKBOOK_PARITY_CHECKLIST.md`.
- ✅ **Validator Phase 1** — read-only Golden↔Central formatting parity + recommendation engine + scoped family runners, admin-gated and default-off. See `VALIDATOR_ARCHITECTURE.md`.
- ✅ **Central migration Phase 1** — user-facing paths resolve the correct workbook via `getUserSpreadsheet_()` (no `getActiveSpreadsheet()` null bugs on the audited paths).
- ✅ **Validator Phase 2 + Test Harness / Release Readiness foundation** — Provisioning, Workbook Drift, Schema Evolution V1, the formal schema, Formula / Conditional-Formatting / Named-Range modules, aggregate Workbook Health, the disposable-workbook harness, required non-performance scenario packs, and the bounded Validation console are complete and runtime-proven through isolated Central `@141`.
- ✅ **P0 Documentation Cleanup / Project Stabilization** — closed 2026-07-20 after synchronized documentation, ProductDecision closeout, Central Tier-2 verification, the full Recovery 6F matrix, and two-track isolated `@114` blank/fresh plus representative populated-workbook runtime validation.
- ✅ **Unified-source bounded smoke + signed-currency polish** — after creating a safety copy, the same source was pushed to the bounded Apps Script project. Overview loaded materially faster; sampled balances, Upcoming, Bills, weekly change, and several pages reconciled; no rollback was required. Negative deltas now render as `-$…` consistently, with bounded runtime proof and permanent dashboard regression coverage.
- ✅ **House Financial Accuracy V1** — commit `96d0ebe` is on `origin/main`. Additive final `Linked Property` debt schema, Loan/HELOC-only managed links, actual selected-year Cash Flow loan payments, fail-closed ambiguity guards, and after-financing Property Performance totals passed exact isolated Central `@145` run `20260722-124210-bc23` (27/27 assertions, Restricted sharing, verified Trash) and a user-approved bounded comparison made under a workbook backup. Existing Overview values, property equity, rent, and operating expenses remained unchanged; no Harness run targeted the bounded workbook.

**Now / next:**

- **Current active milestone:** **P2 Financial Integrity Phase 3 convergence.** House Financial Accuracy V1 is complete, but the broader Beta financial-truth gate remains open: declare the canonical basis, reconcile Planner / Dashboard / Rolling Debt and source totals to `$0.01`, add Asset / Planner / Dashboard audit modules, and wire the result into Release Readiness. Broader principal/interest, escrow, and refinancing detail remains future scope.
- **Then:** execute the ordered **P3 finished-feeling UX and focused performance** work, beginning with `UX-01` Overview information architecture and continuing through `UX-10` responsive/accessibility closeout.
- **Explicitly parked pre-Beta gate:** the Performance Planner percentile campaign and final exact-candidate READY/NOT READY verdict. Seven historical sample pairs are diagnostic only because the campaign began before `@141`; performance must be rerun as an exact-candidate campaign and ratified before any broad Beta release. Deferral does not waive the gate.
- **Measured follow-up:** Financial Plan refresh succeeded but took 143 seconds on the blank/fresh fixture. Reusable privacy-safe stage instrumentation is now source-ready behind `PERFORMANCE_TIMING_ENABLED`; isolated first-run/repeat timing evidence and optimization remain under P3 Performance without reopening the completed P0 functional-feedback work.
- **Release policy:** CashCompass is **quality-gated, not date-gated**. A small supervised cohort may validate work during P1–P3, but a broad Beta Release Candidate must satisfy `BETA_10_OUT_OF_10_PLAN.md`: score ≥95/100, no dimension below 9/10, no unresolved Severity 1 or Severity 2 defect, and every non-negotiable release gate passing.

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

**Next active item:** the **Financial Integrity Phase 3 canonical basis, live consumers, and read-only audits are runtime-proven**. Isolated Central `@150` run `20260722-145136-d3ce` passed 45/45 with Provisioning/Drift/Restricted/Trash PASS. Checkpoint the audit slice, then complete History convergence and Release Readiness wiring before ordered **P3 page-by-page UX polish** at `UX-01`. Keep Performance Planner as an explicit parked gate, then restart its full exact-candidate percentile campaign, ratify the budget ProductDecision, and produce the final bounded verdict before broad Beta release.

### Priority 2 — Financial Model Accuracy — active Beta gate

**✅ House Financial Accuracy V1 complete 2026-07-22.** This product-model milestone followed Validator Phase 2 and closed before the broad Beta Release Candidate. Full scope and evidence are recorded below and in `HOUSE_FINANCIAL_ACCURACY_PLAN.md`.

- **House Financial Accuracy V1** — rental-property cash-flow accuracy now includes actual linked financing payments in Property Performance while preserving operating expenses and equity sources. Broader house-model expansion is deferred.
- **Financial Integrity Phase 3 — active; live consumers and audits runtime-proven.** Isolated Central `@150` run `20260722-145136-d3ce` passed 45/45. Planner, Rolling, Dashboard, and Debt/Asset/Planner/Dashboard audits share the authoritative active-owned-position basis. Remaining History checks and Release Readiness wiring remain.

### Priority 3 — Performance, finished-feeling UX, and scalability

- Beta-critical performance and experience pass before broad release: provisioning + dashboard/planner latency, bulk-API and caching passes, long-running-action feedback, terminology/loading consistency, responsive/accessibility review, and measured scale toward more users/workbooks.
- **Web Dashboard page-by-page polish** — execute the ordered `UX-01` through `UX-10` passes in `TODO.md → UX Backlog (Version 1)`, beginning with the Overview information architecture and balanced-grid pass. Each ID is a separate reviewable/validatable change; preserve calculations, schemas, and write behavior.
- **Financial Plan refresh latency** — isolated blank/fresh `@114` completed correctly but took **143 seconds**. Central `@115` profiling measured **81.455 s first / 77.275 s repeat**. The first optimization passed on isolated `@116`: History rows and their dashboard consumers remained correct while six unused embedded History charts were retired; the repeat History stage fell from **11.507 s to 0.165 s** and total repeat server time reached **43.946 s**. Next address Dashboard formatting (**18.303 s on the `@116` repeat**), snapshot construction (**11.783 s**), and Dashboard charts (**4.848 s**), then collect enough samples to ratify the release percentile.
- **10/10 Beta Release Candidate gate** — after P1 evidence, P2 financial truth, and P3 experience/performance work, run the exact candidate through the full scorecard and release gates in `BETA_10_OUT_OF_10_PLAN.md`. A supervised cohort may run earlier; broad or monetized beta does not.

### Priority 4 — Future features

- **AutoPay Pending Confirmation UX** *(future product enhancement — after Test Harness / Release Readiness)* — visually distinguish AutoPay bills that are **awaiting payment confirmation** from bills that **require manual action**, without hiding them or inferring payment from the due date. Keeps current behavior; adds an "AutoPay Pending" state/badge and a future auto-transition **Pending → Confirmed → Completed** once a matching payment is detected via manual entry / bank import / future bank sync (then removed from the Bills Due attention queue). Never auto-complete AutoPay bills without payment evidence. Full spec: `ENHANCEMENTS.md → Future — AutoPay Pending Confirmation UX`.
- **Paid Bill Correction / Edit Recorded Payment** *(planned financial-correction workflow)* — allow a user to select a specific already-recorded bill occurrence and correct the paid amount, payment date/month, or reopen it when payment did not actually occur. The correction must update the existing Cash Flow/payment evidence rather than add another payment, preserve an immutable before/after Activity audit trail, and never create duplicate Cash Flow amounts or occurrence markers. Reuse the guarded-reversal model in `TODO.md` under **Activity — Smart undo / reverse transaction**: resolve exact stored coordinates or dedupe evidence, verify the current workbook state still matches the recorded post-state, and stop for reconciliation if it does not. Scope manual Bills Pay first; treat AutoPay and expanded recurrence separately until their evidence is sufficient.
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
