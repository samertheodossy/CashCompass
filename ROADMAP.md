# CashCompass Roadmap

*The current at-a-glance **priority stack** for CashCompass — the authoritative view of what comes next and in what order.*

**Documentation only.** This document sets **priority and sequence**. The detailed **Stage 1–6** roadmap (with per-item effort, dependencies, and history) lives in `TODO.md → Product Maturity Stages`; current technical status lives in `PROJECT_CONTEXT.md`; engineering rules (incl. **Milestone Discipline**) live in `ENGINEERING_STANDARDS.md`. Where the priority stack below and the Stage model disagree on ordering, **this document reflects the latest intent.**

> Follow **Milestone Discipline** (`ENGINEERING_STANDARDS.md → §11`): finish the current milestone before starting the next; record discoveries here instead of implementing them immediately; close milestones cleanly before opening the next.

---

## Current status (2026-07-21)

**Completed:**

- ✅ **Golden/Canonical engineering convergence** — `AdoptGolden = 0` for the audited families (Operational, Financial Ledger, SYS, Special); remaining diffs are intentional (KeepCentral / ProductDecision / IgnoreNoise). See `GOLDEN_WORKBOOK.md`, `WORKBOOK_PARITY_CHECKLIST.md`.
- ✅ **Validator Phase 1** — read-only Golden↔Central formatting parity + recommendation engine + scoped family runners, admin-gated and default-off. See `VALIDATOR_ARCHITECTURE.md`.
- ✅ **Central migration Phase 1** — user-facing paths resolve the correct workbook via `getUserSpreadsheet_()` (no `getActiveSpreadsheet()` null bugs on the audited paths).
- ✅ **Validator Phase 2 foundation + Test Harness Foundation V1** — Provisioning, Workbook Drift, Schema Evolution V1, the disposable-workbook harness foundation, and the Validation & Testing console V1 shipped 2026-07-13. Remaining Phase 2 work is listed under P1 below.
- ✅ **P0 Documentation Cleanup / Project Stabilization** — closed 2026-07-20 after synchronized documentation, ProductDecision closeout, Central Tier-2 verification, the full Recovery 6F matrix, and two-track isolated `@114` blank/fresh plus representative populated-workbook runtime validation.
- ✅ **Unified-source bounded smoke + signed-currency polish** — after creating a safety copy, the same source was pushed to the bounded Apps Script project. Overview loaded materially faster; sampled balances, Upcoming, Bills, weekly change, and several pages reconciled; no rollback was required. Negative deltas now render as `-$…` consistently, with bounded runtime proof and permanent dashboard regression coverage.

**Now / next:**

- **Current engineering milestone:** **Complete automated release evidence** (P1): performance-budget ratification, console controls, and final bounded verdict.
- **Next product-model milestone:** **House Financial Accuracy** (P2).
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

*(P0 closed 2026-07-20; this is now the current engineering milestone. Detail: `VALIDATOR_ARCHITECTURE.md → §10 Phase 2` (the judge) and `TEST_HARNESS_ARCHITECTURE.md` (the writer), with `REGRESSION_SCENARIOS.md`, `RELEASE_READINESS.md`, and the quality gate in `BETA_10_OUT_OF_10_PLAN.md`.)*

**Sequenced milestone order** (the Validator is the read-only **judge**; the Test Harness is the developer-only **writer/mutator** that drives scenarios against disposable workbooks and asks the Validator to confirm nothing broke):

1. **Validator Phase 2 / Workbook Health — ✅ dedicated runtime evidence complete; isolated Central `@122` PASS 2026-07-21.** The formal schema registry, targeted Formula validation, Conditional-Formatting validation, thin Named-Range validation, Provisioning, Drift, and aggregate Workbook Health ran on a Restricted populated disposable fixture. The first `@121` run safely exposed 25 advisory formula findings: 24 valid Google Sheets-normalized single-cell `SUM` shapes and one Debt fixture row-order defect. Narrow fixes plus permanent regressions were deployed at `@122`; confirmation run `20260721-120759-5dc2` returned aggregate Health PASS with zero warnings, 9/9 functional assertions, CURRENT/FULLY_CURRENT schema, Restricted sharing, and verified Trash cleanup (160.338 s). Beta stayed `@106`; the bounded workbook was untouched.
2. **Test Harness foundation** — **✅ V1 done.** *(disposable-workbook lifecycle + fail-closed guard + `assertDisposableTarget_` + single SMOKE scenario `SMOKE-PROVISION-DONATION` + report; editor runners `testRunSmoke()` / `testRunSmokeTrash()` and the console Test Harness card — `TEST_HARNESS_ARCHITECTURE.md`)*
3. **Disposable populated-fixture hardening** — **✅ complete; isolated Central `@117` PASS 2026-07-21.** Central created a Restricted, owner-only fixture under the intentional `drive.file` boundary; the harness seeded representative Bank / Investment / House / Debt / Bills / Income / Upcoming / Retirement data, passed 9/9 functional assertions plus Provisioning/Schema/Drift checks, and verified Trash cleanup by Drive read-back. Every write received the disposable spreadsheet explicitly; owner/bounded workbooks were untouched. The 119.7-second harness duration is recorded as test-infrastructure performance evidence, not a product-flow regression.
4. **Scenario packs — ✅ complete.** First-Run run `FR-9c57ac53-0250-4ebb-a57a-cddec545356b` at `@129` passed 9/9; Populated Dashboard run `FR-19eb43ab-e8fe-4bc8-96a5-336afff43596` at `@133` passed 11/11; and Recovery Live run `RL-12557aaa-5e18-4d67-a567-6304a5b57542` at `@135` passed 9/9 in 42.071 s. Recovery Live exercised production confirmation, self-reconnect, stale/Trash routing, and ambiguity as the permanent disposable non-admin; all three owner-only fixtures were Restricted and verified in Trash, no mapping remained, protected-target matches were zero, and sole-admin configuration/mapping fingerprints were unchanged. On isolated Central `@120`, **Bills Pay E2E** passed 3/3 and **Performance Planner** passed 4/4. The production-path audit remains enforced by `npm test`.
5. **Release Readiness gate** — bounded orchestration and privacy-safe archived evidence are source-ready, and the inventory now consumes all three saved browser-suite PASS records. The verdict remains NOT READY until performance-budget ratification, console controls, and the final bounded evidence run close.
6. **Validation & Testing admin console** — the local Workbook Health action now aggregates and renders all Validator modules. Release Readiness start/progress/final-verdict controls remain future.

**Next item:** collect enough planner timing samples to make the **performance-budget ProductDecision**. After that: Release Readiness console controls and the final bounded evidence run.

### Priority 2 — Financial Model Accuracy

The next **product-model** milestone (after Validator Phase 2, before the broad Beta Release Candidate and before major new user features). Full spec below in **House Financial Accuracy**.

- **House Financial Accuracy** — rental-property cash-flow accuracy including financing costs, with one shared house cash-flow model reconciled across all house-related sheets.

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

Sequenced **immediately after Validator Phase 2 and before major new user features.**

> **This is a financial-model improvement, not a UI enhancement.**

**Goal.** Improve the financial accuracy of rental-property cash-flow calculations.

**Motivation.** Current property profitability does **not** include financing costs, producing an **optimistic** monthly cash-flow picture. Including mortgage/loan payments gives a truthful net-cash-flow view per property.

**Planned work.**

- Include **mortgage / loan payments** in recurring monthly property expenses.
- **Separate** expense classes:
  - **Operating Expenses**
  - **Financing Expenses**
- **Calculate**:
  - **Operating Cash Flow**
  - **Financing Cash Flow**
  - **Net Property Cash Flow**
- Ensure **Property Performance**, **House Values**, **House Expenses**, **Planner**, and **Cash Flow** all use **one shared calculation model**.

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
