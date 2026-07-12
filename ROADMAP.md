# CashCompass Roadmap

*The current at-a-glance **priority stack** for CashCompass — the authoritative view of what comes next and in what order.*

**Documentation only.** This document sets **priority and sequence**. The detailed **Stage 1–6** roadmap (with per-item effort, dependencies, and history) lives in `TODO.md → Product Maturity Stages`; current technical status lives in `PROJECT_CONTEXT.md`; engineering rules (incl. **Milestone Discipline**) live in `ENGINEERING_STANDARDS.md`. Where the priority stack below and the Stage model disagree on ordering, **this document reflects the latest intent.**

> Follow **Milestone Discipline** (`ENGINEERING_STANDARDS.md → §11`): finish the current milestone before starting the next; record discoveries here instead of implementing them immediately; close milestones cleanly before opening the next.

---

## Current status (2026-07-12)

**Completed:**

- ✅ **Golden/Canonical engineering convergence** — `AdoptGolden = 0` for the audited families (Operational, Financial Ledger, SYS, Special); remaining diffs are intentional (KeepCentral / ProductDecision / IgnoreNoise). See `GOLDEN_WORKBOOK.md`, `WORKBOOK_PARITY_CHECKLIST.md`.
- ✅ **Validator Phase 1** — read-only Golden↔Central formatting parity + recommendation engine + scoped family runners, admin-gated and default-off. See `VALIDATOR_ARCHITECTURE.md`.
- ✅ **Central migration Phase 1** — user-facing paths resolve the correct workbook via `getUserSpreadsheet_()` (no `getActiveSpreadsheet()` null bugs on the audited paths).

**Now / next:**

- **Current milestone:** **Documentation Cleanup / Project stabilization** (P0).
- **Next engineering milestone:** **Validator Phase 2** (P1).
- **Next product-model milestone:** **House Financial Accuracy** (P2).

---

## Priority stack (P0–P4)

### Priority 0 — Project stabilization

- **Documentation** — keep architecture docs, roadmap, and standards in sync with the current state (this milestone).
- **Remaining product decisions** — record and resolve the deferred **ProductDecision** items (e.g. Settings header/body font size) tracked in `GOLDEN_WORKBOOK.md` / `WORKBOOK_PARITY_CHECKLIST.md` / `ENGINEERING_STANDARDS.md → Ratified product decisions`.
- **Beta readiness** — onboarding polish, error handling, empty-state / UX consistency, and a runtime regression pass before release.
- **Central verification** — confirm all user-facing paths resolve the correct workbook in Central mode; close the Tier-2 sweep of remaining non-critical / dev paths.

### Priority 1 — Validator Phase 2 + Test Harness / Regression Runner

*(Do not start until P0 is closed. Detail: `VALIDATOR_ARCHITECTURE.md → §10 Phase 2` (the judge) and `TEST_HARNESS_ARCHITECTURE.md` (the writer), with `REGRESSION_SCENARIOS.md` + `RELEASE_READINESS.md`.)*

**Sequenced milestone order** (the Validator is the read-only **judge**; the Test Harness is the developer-only **writer/mutator** that drives scenarios against disposable workbooks and asks the Validator to confirm nothing broke):

1. **Validator Phase 2A/2B — Provisioning + Schema validation** *(the judge; `validator_health.js` — `VALIDATOR_ARCHITECTURE.md → §10.12`)*
2. **Test Harness foundation** *(disposable-workbook lifecycle + fail-closed guard + single-scenario run loop — `TEST_HARNESS_ARCHITECTURE.md`)*
3. **Scenario packs** *(SMOKE → REGRESSION → RECOVERY → STRESS; registry in `REGRESSION_SCENARIOS.md`)*
4. **Release Readiness gate** *(aggregate Harness + Validator results into a pre-beta go/no-go — `RELEASE_READINESS.md`)*
5. **Validation & Testing admin console** *(operator UI surface for B/C above — `VALIDATION_TESTING_CONSOLE.md`; C1 read-only Validator page after Validator 2A, Regression Testing section after the Harness foundation)*

Remaining Validator Phase 2 modules (fold into the judge track, `§10`): Conditional-format validation *(the current Validator blind spot)* · Formula validation · Named-range validation · Workbook Health scoring/diagnostics surface.

### Priority 2 — Financial Model Accuracy

The next **product-model** milestone (after Validator Phase 2, before major new user features). Full spec below in **House Financial Accuracy**.

- **House Financial Accuracy** — rental-property cash-flow accuracy including financing costs, with one shared house cash-flow model reconciled across all house-related sheets.

### Priority 3 — Performance and scalability

- Provisioning + dashboard/planner latency, bulk-API and caching passes where measured; scale toward more users/workbooks.

### Priority 4 — Future features

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
- `VALIDATOR_ARCHITECTURE.md` — the Validator subsystem (Phase 1 complete; Phase 2 future).
- `GOLDEN_WORKBOOK.md` / `WORKBOOK_PARITY_CHECKLIST.md` — the Canonical workbook standard + per-sheet convergence status.
