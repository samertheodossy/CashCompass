# CashCompass Roadmap

*The current at-a-glance **priority stack** for CashCompass — the authoritative view of what comes next and in what order.*

**Documentation only.** This document sets **priority and sequence**. The detailed **Stage 1–6** roadmap (with per-item effort, dependencies, and history) lives in `TODO.md → Product Maturity Stages`; current technical status lives in `PROJECT_CONTEXT.md`; engineering rules (incl. **Milestone Discipline**) live in `ENGINEERING_STANDARDS.md`. Where the priority stack below and the Stage model disagree on ordering, **this document reflects the latest intent.**

> Follow **Milestone Discipline** (`ENGINEERING_STANDARDS.md → §11`): finish the current milestone before starting the next; record discoveries here instead of implementing them immediately; close milestones cleanly before opening the next.

---

## Current status (2026-07-20)

**Completed:**

- ✅ **Golden/Canonical engineering convergence** — `AdoptGolden = 0` for the audited families (Operational, Financial Ledger, SYS, Special); remaining diffs are intentional (KeepCentral / ProductDecision / IgnoreNoise). See `GOLDEN_WORKBOOK.md`, `WORKBOOK_PARITY_CHECKLIST.md`.
- ✅ **Validator Phase 1** — read-only Golden↔Central formatting parity + recommendation engine + scoped family runners, admin-gated and default-off. See `VALIDATOR_ARCHITECTURE.md`.
- ✅ **Central migration Phase 1** — user-facing paths resolve the correct workbook via `getUserSpreadsheet_()` (no `getActiveSpreadsheet()` null bugs on the audited paths).
- ✅ **Validator Phase 2 foundation + Test Harness Foundation V1** — Provisioning, Workbook Drift, Schema Evolution V1, the disposable-workbook harness foundation, and the Validation & Testing console V1 shipped 2026-07-13. Remaining Phase 2 work is listed under P1 below.
- ✅ **P0 Documentation Cleanup / Project Stabilization** — closed 2026-07-20 after synchronized documentation, ProductDecision closeout, Central Tier-2 verification, the full Recovery 6F matrix, and two-track isolated `@114` blank/fresh plus representative populated-workbook runtime validation.

**Now / next:**

- **Current engineering milestone:** **Remaining Validator Phase 2 scope** (P1).
- **Next product-model milestone:** **House Financial Accuracy** (P2).
- **Measured follow-up:** Financial Plan refresh succeeded but took 143 seconds on the blank/fresh fixture; investigate under P3 Performance without reopening the completed P0 functional-feedback work.

---

## Priority stack (P0–P4)

### Priority 0 — Project stabilization — ✅ complete 2026-07-20

- **Documentation** — keep architecture docs, roadmap, and standards in sync with the current state (this milestone).
- **Regression Discovery (process)** — every meaningful bug fix / feature / schema / dashboard / financial-calc change runs the **Regression Discovery Policy** and appends the reusable **Regression Discovery** prompt block (`REGRESSION_SUITE_PLAN.md → Regression Discovery Policy` + `§A`) so test coverage grows as the product evolves.
- **Product decisions — ✅ current P0 inventory resolved.** The final known P0 item, Settings header/body typography, was ratified 2026-07-20 as 16pt / 14pt and implemented first-create only. Future Validator discoveries follow the normal record-and-defer rule.
- **Beta readiness — ✅ stabilization evidence complete.** On isolated Central `@114`, the canonical blank/fresh pass and a Central-owned representative populated fixture both passed Setup, navigation, editor gating, first-run/populated rendering, Help, and broad workspace checks without console warnings. This closes the stabilization slice; remaining Beta-Gate work stays sequenced under P1/P2.
- **Central resolver verification — ✅ static Tier-2 sweep closed 2026-07-20.** All Central user-facing production paths use `getUserSpreadsheet_()`; remaining direct active-spreadsheet calls are intentionally confined to the resolver's bound fallback, bound-only utilities, developer Test Setup, and the harness safety guard.
- **Recovery Validation 6F — ✅ P0 complete 2026-07-20.** Full disposable-account matrix passed, including MEDIUM auto-adopt ON; flags OFF and fixture gate removed. Read-only orphan detection remains P1.

### Priority 1 — Validator Phase 2 + Test Harness / Regression Runner

*(P0 closed 2026-07-20; this is now the current engineering milestone. Detail: `VALIDATOR_ARCHITECTURE.md → §10 Phase 2` (the judge) and `TEST_HARNESS_ARCHITECTURE.md` (the writer), with `REGRESSION_SCENARIOS.md` + `RELEASE_READINESS.md`.)*

**Sequenced milestone order** (the Validator is the read-only **judge**; the Test Harness is the developer-only **writer/mutator** that drives scenarios against disposable workbooks and asks the Validator to confirm nothing broke):

1. **Validator Phase 2A/2B — Provisioning + Drift + Schema Evolution** *(the judge; shipped in `validator_provisioning.js` / `validator_drift.js` / `validator_schema.js`; the aggregate `validator_health.js` umbrella remains planned — `VALIDATOR_ARCHITECTURE.md → §10.12`)*. Phase 2A (provisioning runner), 2B′ (advisory Workbook Drift runner), and 2B″ V1 (Schema Evolution — `validator_schema.js`) are implemented. Phase 2 distinguishes **three questions**: **Provisioning** = *"created correctly?"* (required sheets/headers; **gating/FAIL** — `§10.0a`); **Workbook Drift** = *"diverged cosmetically?"* (widths, row heights, styling, formulas, CF; **advisory** — `§10.0a`); **Schema Evolution** = *"supported legacy schema?"* (version-attributable deltas — missing `SYS - Meta`, header ordering, frozen-pane conventions — reconciled to a **Workbook Type** + **Compatibility** verdict; **advisory, version-aware** — `§10.0b`). **2B″ V1 done:** `validatorRunSchemaEvolution()` / `validateSchemaEvolution_(ss)` move those version-attributable deltas out of the provisioning gate into an advisory, era-aware lens so legacy/bound workbooks read as *Compatible Legacy* rather than provisioning failures; surfaced in the Workbook Health Console. **Future:** a formal per-version schema registry.
2. **Test Harness foundation** — **✅ V1 done.** *(disposable-workbook lifecycle + fail-closed guard + `assertDisposableTarget_` + single SMOKE scenario `SMOKE-PROVISION-DONATION` + report; editor runners `testRunSmoke()` / `testRunSmokeTrash()` and the console Test Harness card — `TEST_HARNESS_ARCHITECTURE.md`)*
3. **Scenario packs** *(SMOKE → REGRESSION → RECOVERY → STRESS; full E2E roadmap + coverage matrices + build order in `REGRESSION_SUITE_PLAN.md`; historical-bug registry in `REGRESSION_SCENARIOS.md`)* — SMOKE V1 exists; the eighteen-pack suite (Levels 1–18, four bands — incl. Bills Recurrence, Income, Investments/Retirement, Houses, Dashboard E2E, System Integrity) is planned. Two enablers gate functional depth: a harness **functional-assertion capability** and the **ss-injection refactor**.
4. **Release Readiness gate** *(aggregate Harness + Validator results into a pre-beta go/no-go — `RELEASE_READINESS.md`)*
5. **Validation & Testing admin console** — **◑ V1 done.** *(operator UI surface — `VALIDATION_TESTING_CONSOLE.md`; route `?view=validation`. Live: Target + Workbook Health (Provisioning / Drift / Schema Evolution) + a single-scenario Test Harness card. Future: multi-suite selector, Formula/CF buttons, Release Readiness verdict.)*

Remaining Validator Phase 2 modules (fold into the judge track, `§10`): formal per-version schema registry beyond the shipped Schema Evolution V1 · Conditional-format validation *(the current Validator blind spot — Drift-class)* · Formula validation *(Drift-class)* · Named-range validation · Workbook Health umbrella report *(combines the Provisioning gate + Schema Evolution + Drift advisory into one score and a Compatibility badge)*.

### Priority 2 — Financial Model Accuracy

The next **product-model** milestone (after Validator Phase 2, before major new user features). Full spec below in **House Financial Accuracy**.

- **House Financial Accuracy** — rental-property cash-flow accuracy including financing costs, with one shared house cash-flow model reconciled across all house-related sheets.

### Priority 3 — Performance and scalability

- Provisioning + dashboard/planner latency, bulk-API and caching passes where measured; scale toward more users/workbooks.

### Priority 4 — Future features

- **AutoPay Pending Confirmation UX** *(future product enhancement — after Test Harness / Release Readiness)* — visually distinguish AutoPay bills that are **awaiting payment confirmation** from bills that **require manual action**, without hiding them or inferring payment from the due date. Keeps current behavior; adds an "AutoPay Pending" state/badge and a future auto-transition **Pending → Confirmed → Completed** once a matching payment is detected via manual entry / bank import / future bank sync (then removed from the Bills Due attention queue). Never auto-complete AutoPay bills without payment evidence. Full spec: `ENHANCEMENTS.md → Future — AutoPay Pending Confirmation UX`.
- **Paid Bill Correction / Edit Recorded Payment** *(planned financial-correction workflow)* — allow a user to select a specific already-recorded bill occurrence and correct the paid amount, payment date/month, or reopen it when payment did not actually occur. The correction must update the existing Cash Flow/payment evidence rather than add another payment, preserve an immutable before/after Activity audit trail, and never create duplicate Cash Flow amounts or occurrence markers. Reuse the guarded-reversal model in `TODO.md` under **Activity — Smart undo / reverse transaction**: resolve exact stored coordinates or dedupe evidence, verify the current workbook state still matches the recorded post-state, and stop for reconciliation if it does not. Scope manual Bills Pay first; treat AutoPay and expanded recurrence separately until their evidence is sufficient.
- Money Plan Phase 2, Account Aggregation & Transaction Import, Chat / Assistant, Paid Product framework, and other post-beta product direction (`PRODUCT_VISION.md`, `ENHANCEMENTS.md`).

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
- `GOLDEN_WORKBOOK.md` / `WORKBOOK_PARITY_CHECKLIST.md` — the Canonical workbook standard + per-sheet convergence status.
