# Project Stabilization

## 1. Initiative Metadata

| Field | Value |
| --- | --- |
| Initiative | Project Stabilization |
| Initiative slug | `project-stabilization` |
| Priority | P0 |
| Initiative status | `ACTIVE` |
| Knowledge status | `DRAFT` |
| Last reviewed date | `2026-07-19` |
| Last reviewed Git reference | `255890a` (pre-change baseline) |
| Authoritative priority source | [`ROADMAP.md`](../../ROADMAP.md) → “Priority 0 — Project stabilization” |

## 2. Mission and Outcome

### Mission

Close the remaining documentation, decision, beta-readiness, and Central-verification gaps without starting the next engineering milestone prematurely.

### Intended outcome

CashCompass has synchronized project documentation, recorded disposition of remaining ProductDecision items, explicit beta-readiness evidence, and completed Central verification sufficient to close P0 and advance the remaining Validator Phase 2 scope.

### Why now

`ROADMAP.md` identifies Documentation Cleanup / Project Stabilization as the current milestone and requires it to close before the remaining P1 Validator Phase 2 work advances. Phase 2A/2B, the Test Harness foundation, and the Validation & Testing console V1 are already source-reported as shipped; this initiative does not describe P1 as wholly unstarted. This ordering follows Milestone Discipline in `ENGINEERING_STANDARDS.md`.

## 3. Scope and Boundaries

### In scope

- Keep architecture, roadmap, standards, and project-status documentation synchronized.
- Apply the Regression Discovery Policy to meaningful changes.
- Record and resolve or explicitly defer remaining ProductDecision items.
- Complete the P0 beta-readiness polish and runtime regression evidence defined by authoritative sources.
- Confirm remaining Central user-facing paths and close the documented Tier-2 verification sweep.

### Out of scope

- Advancing the remaining P1 Validator Phase 2 modules, scenario-pack expansion, or aggregate Release Readiness implementation before P0 closes.
- Beginning P2 House Financial Accuracy.
- Implementing P3 performance work or P4 future features.
- Treating this navigation document as authorization for code changes, workbook mutation, testing against real populated workbooks, commit, push, or deployment.

## 4. Source-of-Truth Map

| Subject | Authoritative source | What it controls |
| --- | --- | --- |
| Priority and sequence | [`ROADMAP.md`](../../ROADMAP.md) → “Current status” and “Priority 0 — Project stabilization” | Current milestone and P0 workstreams |
| Detailed maturity work | [`TODO.md`](../../TODO.md) → “Product Maturity Stages,” “Beta Gate,” and “Open testing inventory” | Detailed tasks, dependencies, history, and remaining validation inventory |
| Current technical status | [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) → “Current Product Status” | Implemented state, runtime evidence, and known remaining gaps |
| Engineering discipline | [`ENGINEERING_STANDARDS.md`](../../ENGINEERING_STANDARDS.md) → “Milestone Discipline” and “Regression-First Development” | Work sequencing, workbook safety, and regression expectations |
| Canonical convergence | [`GOLDEN_WORKBOOK.md`](../../GOLDEN_WORKBOOK.md) and [`WORKBOOK_PARITY_CHECKLIST.md`](../../WORKBOOK_PARITY_CHECKLIST.md) | Audited-family convergence and remaining ProductDecision/UNKNOWN items |
| Regression process | [`REGRESSION_SUITE_PLAN.md`](../../REGRESSION_SUITE_PLAN.md) → “Regression Discovery Policy” | Per-change regression discovery requirements |
| Beta gate design | [`RELEASE_READINESS.md`](../../RELEASE_READINESS.md) | Planned release evidence and go/no-go model; aggregate implementation remains future work |
| Central architecture navigation | [`CENTRAL_APP_DOC_INDEX.md`](../../CENTRAL_APP_DOC_INDEX.md) | Routing to current Central design, lifecycle, recovery, and verification documents |

## 5. Workstreams and Roadmap Links

| Workstream | Source | Source-reported status | Completion evidence |
| --- | --- | --- | --- |
| Documentation synchronization | `ROADMAP.md` → P0 Documentation; `PROJECT_CONTEXT.md`; `TODO.md` | `ACTIVE` — current P0 | Architecture, roadmap, standards, and status documents agree on current milestones and remaining work |
| Regression Discovery process | `ROADMAP.md` → P0 Regression Discovery; `REGRESSION_SUITE_PLAN.md` → policy and prompt block | `ACTIVE` — current P0 | Meaningful changes record their coverage decision and add reusable scenarios where required |
| Remaining ProductDecision items | `ROADMAP.md` → P0 Remaining product decisions; `GOLDEN_WORKBOOK.md`; `WORKBOOK_PARITY_CHECKLIST.md`; `ENGINEERING_STANDARDS.md` | `ACTIVE` — current P0 | Each remaining item is ratified, deferred with rationale, or otherwise given an explicit disposition |
| Beta readiness | `ROADMAP.md` → P0 Beta readiness; `TODO.md` → Beta Gate; `PROJECT_CONTEXT.md` → Family Beta Readiness | `ACTIVE` — current P0 | Required onboarding/UX/error/empty-state review and runtime regression evidence are recorded in authoritative sources |
| Central verification | `ROADMAP.md` → P0 Central verification; `PROJECT_CONTEXT.md` → Central status | `ACTIVE` — current P0 | User-facing paths are confirmed through the resolver seam and the documented remaining non-critical/dev sweep is closed or explicitly deferred |

## 6. Related Designs and Decisions

| Document | Relationship | Status or decision needed |
| --- | --- | --- |
| [`CENTRAL_APP_DOC_INDEX.md`](../../CENTRAL_APP_DOC_INDEX.md) | Index for Central architecture and verification evidence | Use it to select current documents; do not read every historical Central file by default |
| [`CENTRAL_APP_RECOVERY_COMPLETION_PLAN.md`](../../CENTRAL_APP_RECOVERY_COMPLETION_PLAN.md) | Related remaining recovery adoption-path design and validation | Decision recorded 2026-07-19: the duplicate-prevention safety matrix is P0; read-only Orphan detection is P1 and does not block P0 closure |
| [`GOLDEN_WORKBOOK.md`](../../GOLDEN_WORKBOOK.md) | Canonical workbook convergence authority | Remaining UNKNOWN sheets and ProductDecision items require explicit handling |
| [`WORKBOOK_PARITY_CHECKLIST.md`](../../WORKBOOK_PARITY_CHECKLIST.md) | Per-sheet audit and convergence status | Do not write convergence code for UNKNOWN sheets before audit resolution |
| [`REGRESSION_SUITE_PLAN.md`](../../REGRESSION_SUITE_PLAN.md) | Regression discovery and future scenario-pack plan | Apply discovery now; scenario-pack implementation belongs to the sequenced P1 work |
| [`RELEASE_READINESS.md`](../../RELEASE_READINESS.md) | Future aggregate beta gate | Design exists; implementation depends on P1 harness/Validator coverage |

## 7. Related Features

| Feature | Knowledge document | Initiative relationship |
| --- | --- | --- |
| Bills | [`agents/features/bills.md`](../features/bills.md) | The DRAFT records pending runtime and coverage evidence relevant to stabilization; it does not independently define P0 priority |
| Central App | Not yet created | P0 uses Central resolver/Tier-2 verification evidence; Recovery Validation 6F now has an explicit split: the duplicate-prevention safety matrix is P0, while read-only Orphan detection is P1 and does not block P0 closure |
| Validator / Test Harness | Not yet created | Existing infrastructure supplies evidence; remaining expansion is sequenced primarily under P1 |
| Onboarding and Dashboard UX | Not yet created | Beta-readiness polish and calm failure/empty-state behavior are P0 concerns |

## 8. Dependencies and Sequencing

- Upstream dependencies: Completed Golden/Canonical convergence for audited families, Validator Phase 1, Central migration Phase 1, and the current authoritative roadmap/status documents.
- Downstream initiatives: Remaining P1 Validator Phase 2 + Test Harness / Regression Runner work, followed by P2 House Financial Accuracy.
- Required ordering: Finish P0 before advancing the remaining P1 scope; finish P1 before beginning P2, unless the user explicitly changes priority or a production blocker requires intervention.
- Parallel work allowed: Documentation synchronization may proceed alongside read-only discovery and evidence collection that does not open a new implementation milestone.

## 9. Risks, Blockers, and Source Conflicts

### Risks and blockers

- Status drift across `ROADMAP.md`, `TODO.md`, and `PROJECT_CONTEXT.md` can cause the Planner to recommend outdated work. Mitigation: route each fact to its declared source of truth and update mirrors together when status changes.
- P0 spans multiple workstreams; treating every listed item as one implementation task would create scope creep. Mitigation: plan and approve one narrow task at a time.
- Remaining Central Recovery Validation 6F includes high-risk paths and must use an isolated disposable account with flags returned OFF, as specified in `TODO.md`. The duplicate-prevention safety matrix is P0; read-only Orphan detection is P1 and does not block P0 closure. This document authorizes no runtime execution.
- Release Readiness is designed but not implemented. Do not report the future aggregate gate as current evidence.

### Resolved source conflict

| Decision | Sources synchronized | Governing interpretation |
| --- | --- | --- |
| Recovery Validation 6F priority split resolved 2026-07-19 | `ROADMAP.md`, `TODO.md`, `PROJECT_CONTEXT.md`, and this initiative | P0 includes the remaining duplicate-prevention safety matrix: confirmed-zero create, MEDIUM confirmation/OFF + auto-adopt/ON, ambiguity, search/verification failure, stale variants, and cross-user isolation. Read-only Orphan detection remains P1 and does not block P0 closure. |

## 10. Completion Criteria

- [ ] Architecture, roadmap, standards, and technical-status mirrors agree on the current milestone and remaining P0 work. *(Recovery Validation priority was resolved and synchronized 2026-07-19; continue checking other P0 mirrors.)*
- [ ] Regression Discovery is applied consistently to meaningful changes and any required reusable scenarios are recorded.
- [ ] Remaining P0 ProductDecision items have an explicit disposition in their authoritative documents.
- [ ] Beta-readiness polish and runtime regression evidence required for P0 are recorded.
- [ ] Central verification gaps assigned to P0 are closed or explicitly deferred with rationale and safety evidence.
- [ ] `ROADMAP.md` and `PROJECT_CONTEXT.md` explicitly identify P0 as complete and the remaining P1 scope as current before additional P1 implementation advances.
- [ ] Required validation evidence is recorded without claiming the future aggregate Release Readiness report has run.
- [ ] Deferred work is explicitly routed to P1, P2, or a later authoritative milestone.

## 11. Recommended Next Task

- Task: Plan the P0 Recovery Validation 6F safety-matrix pass against an isolated disposable Central account, including the exact flag transitions, evidence capture, and flags-OFF cleanup check.
- Why this task: The sequencing decision is now resolved; runtime evidence for the remaining duplicate-prevention branches is the next Central-verification gate for P0.
- Required role flow: Planner → Tester → Validator; route to Engineer only if validation exposes a defect.
- Approval gates: Explicit runtime-test approval for the named disposable account and Central target; separate approval for any code edit, commit, push, or deployment.

## 12. Maintenance

Re-review this document when:

- `ROADMAP.md` changes P0 priority, scope, or sequence.
- `TODO.md` or `PROJECT_CONTEXT.md` changes Beta Gate, Central verification, or current milestone status.
- A ProductDecision is resolved or a remaining Golden/Canonical scope closes.
- Central recovery/verification evidence changes.
- P0 closes and responsibility passes to Validator Phase 2.
