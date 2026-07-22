# Financial Integrity Phase 3

## 1. Initiative Metadata

| Field | Value |
| --- | --- |
| Initiative | Financial Integrity Phase 3 |
| Initiative slug | `financial-integrity-phase-3` |
| Priority | P0 Beta gate |
| Initiative status | `ACTIVE` |
| Knowledge status | `DRAFT` |
| Last reviewed date | `2026-07-22` |
| Last reviewed Git reference | `96d0ebe` |
| Authoritative priority source | [`ROADMAP.md`](../../ROADMAP.md) → “Priority 2 — Financial Model Accuracy” |

## 2. Mission and Outcome

### Mission

Make CashCompass financial totals defensible by declaring one canonical current-position model and proving every release-critical surface agrees to `$0.01`.

### Intended outcome

Dashboard, Planner, Rolling Debt’s live anchor, source ledgers, mirrors, property financing, and history reconcile or produce a precise gated diagnostic; Financial Integrity becomes part of Release Readiness.

### Why now

The roadmap identifies Financial Integrity Phase 3 as the remaining financial-truth gate after House Financial Accuracy V1 and before broad Beta.

## 3. Scope and Boundaries

### In scope

- Canonical-basis ProductDecision.
- Cross-surface convergence and mirror/source validation.
- Asset, Planner, and Dashboard audit modules.
- Property-financing reconciliation.
- Permanent regressions and Release Readiness wiring.

### Out of scope

- Reclassifying total cash as usable/deployable cash.
- Treating Rolling forecast adjustments as current liabilities.
- Rewriting historical rows.
- Destructive workbook migration, broad formatting, or testing against the bounded workbook.
- The parked exact-candidate Performance campaign.

## 4. Source-of-Truth Map

| Subject | Authoritative source | What it controls |
| --- | --- | --- |
| Priority and sequence | [`ROADMAP.md`](../../ROADMAP.md) → “Priority 2 — Financial Model Accuracy” | Current milestone |
| Detailed work | [`TODO.md`](../../TODO.md) → “Financial Integrity — Phase 3” | Work inventory and dependencies |
| Technical status | [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) → “Financial Integrity” | Implemented foundation and remaining scope |
| Phase 3 design | [`FINANCIAL_INTEGRITY_PHASE_3_PLAN.md`](../../FINANCIAL_INTEGRITY_PHASE_3_PLAN.md) | Basis inventory, approved canonical contract, discrepancies, and implementation order |
| Existing audit architecture | [`financial_integrity_audit.js`](../../financial_integrity_audit.js) | Read-only framework, Debt Audit, and module registry |
| Release evidence | [`RELEASE_READINESS.md`](../../RELEASE_READINESS.md) | Aggregate release gate and evidence model |

## 5. Workstreams and Roadmap Links

| Workstream | Source | Source-reported status | Completion evidence |
| --- | --- | --- | --- |
| Read-only basis inventory | Phase 3 plan → §§3–4 | `COMPLETE` locally; uncommitted | Reviewed source map for Dashboard, Planner, Rolling Debt, history, and mirrors |
| Canonical-basis ProductDecision | Phase 3 plan → §§5–6 | `COMPLETE` | Option A approved 2026-07-22 with fail-closed unlinked-property handling |
| Canonical snapshot + regression | Phase 3 plan → §7 steps 1–2 | `COMPLETE` with isolated runtime evidence | Pure explicit-spreadsheet read model plus isolated Central `@147` run `20260722-133952-4f0a`: 21/21, Provisioning/Drift/Restricted/Trash PASS |
| Cross-surface convergence | `TODO.md` → Financial Integrity | Planner/Rolling/Dashboard totals runtime-proven | Shared Central/bounded helpers; isolated `@149` run `20260722-143242-d150` 34/34 |
| Audit modules | `TODO.md` → Financial Integrity | `COMPLETE` with isolated evidence | Debt v2 plus Asset, Planner, and Dashboard modules; isolated `@150` run `20260722-145136-d3ce` passed 45/45 |
| Release wiring | `RELEASE_READINESS.md` | `PLANNED` | Exact-candidate aggregate gate evidence |

## 6. Related Designs and Decisions

| Document | Relationship | Status or decision needed |
| --- | --- | --- |
| [`FINANCIAL_INTEGRITY_PHASE_3_PLAN.md`](../../FINANCIAL_INTEGRITY_PHASE_3_PLAN.md) | Inventory and approved contract | Option A, live consumers, and audit convergence runtime-proven; History/release wiring remains |
| [`HOUSE_FINANCIAL_ACCURACY_PLAN.md`](../../HOUSE_FINANCIAL_ACCURACY_PLAN.md) | Introduced property-linked financing inputs and actual loan-payment reporting | V1 complete; Phase 3 must reconcile loan balances, not rework payment reporting |
| [`ENGINEERING_STANDARDS.md`](../../ENGINEERING_STANDARDS.md) | Regression-first, milestone discipline, and workbook safety | Governing rules |
| [`BETA_10_OUT_OF_10_PLAN.md`](../../BETA_10_OUT_OF_10_PLAN.md) | Financial-truth exit gate | Must pass before broad Beta |

## 7. Related Features

| Feature | Knowledge document | Initiative relationship |
| --- | --- | --- |
| Bills | [`agents/features/bills.md`](../features/bills.md) | Actuals and occurrence evidence feed cash-flow behavior but are not redefined here |
| Dashboard | Not yet created | Must consume the canonical current-position read model |
| Planner | Not yet created | Must calculate and snapshot the canonical basis |
| Rolling Debt | Not yet created | Must separate canonical live anchor from modeled adjustments |
| Properties | Not yet created | Linked financing must reconcile without double counting |

## 8. Dependencies and Sequencing

- Upstream dependencies: Financial Integrity framework and Debt Audit; House Financial Accuracy V1; disposable harness and validation console.
- Downstream initiatives: P3 UX/performance, final Release Readiness, supervised cohort, and broad Beta.
- Required ordering: inventory → ProductDecision → canonical read model + regressions → surface convergence → audit modules → release wiring.
- Parallel work allowed: read-only documentation and test-design work consistent with the approved contract; each additional consumer/audit slice remains separately gated.

## 9. Risks, Blockers, and Source Conflicts

### Risks and blockers

- The current hybrid Active semantics can preserve stale asset/property balances while excluding inactive debt.
- Planner/Rolling and Dashboard liabilities can differ today when inactive debt carries a balance.
- Property loan references and linked debts can disagree without a current gate.
- Dashboard mirrors can lag authoritative source ledgers.
- The ProductDecision, read model, shared Planner/Rolling/Dashboard totals, and audit-module evidence are complete. Remaining History convergence and release wiring remain separately gated.

### Source conflicts

| Conflict | Sources | Governing interpretation | Follow-up |
| --- | --- | --- | --- |
| Current debt basis | Dashboard active-only vs prior Planner/Rolling all normalized debt | Approved Option A makes active non-summary debt rows canonical; isolated `@148` proves the shared Planner/Rolling basis | Preserve this regression while converging Dashboard and audits |
| Active semantics | Asset/property stop-tracking code preserves balances and gross totals; debt Dashboard excludes inactive rows | Approved Option A excludes explicitly inactive rows from the current position while retaining history | Adopt the implemented shared inclusion rule only through separately reviewed consumer slices |

## 10. Completion Criteria

- [x] Every release-critical financial basis is inventoried.
- [x] Canonical financial contract is explicitly approved.
- [ ] Dashboard, Planner, Rolling live anchor, sources, mirrors, and history reconcile to `$0.01`.
- [ ] Property financing reconciles and is counted exactly once.
- [ ] Asset, Planner, and Dashboard audit modules pass.
- [ ] Every corrected discrepancy has a permanent disposable regression.
- [ ] Financial Integrity gates Release Readiness.
- [ ] Roadmap and technical-status documents agree that the initiative is complete.
- [ ] Required exact-candidate evidence is recorded.
- [ ] Deferred scenario/performance work is routed to its authoritative milestone.

## 11. Recommended Next Task

- Task: Obtain separate commit/Git-push approval for the runtime-proven audit slice, then plan remaining History convergence and Release Readiness wiring.
- Why this task: all live consumers and read-only audits are runtime-proven; only historical snapshot/freshness and aggregate release integration remain in Phase 3.
- Required role flow: Planner (`COMPLETE`) → Engineer slices 1–4 (`COMPLETE`) → Reviewer/Tester/Validator (`PASS`) → next Planner/Engineer approval gate.
- Approval gates: runtime consumer-calculation implementation, commit, push, Central push/version/deployment, and any workbook migration remain separate explicit approvals.

## 12. Maintenance

Re-review this document when the canonical basis is decided, a convergence slice lands, an audit module is enabled, release wiring changes, or runtime evidence changes initiative status.
