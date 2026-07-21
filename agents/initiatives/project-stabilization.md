# Project Stabilization

## 1. Initiative Metadata

| Field | Value |
| --- | --- |
| Initiative | Project Stabilization |
| Initiative slug | `project-stabilization` |
| Priority | P0 |
| Initiative status | `COMPLETE` |
| Knowledge status | `VERIFIED` |
| Last reviewed date | `2026-07-20` |
| Last reviewed Git reference | `e3582c0` (P0 decisions + Central verification evidence) |
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
| Documentation synchronization | `ROADMAP.md` → P0 Documentation; `PROJECT_CONTEXT.md`; `TODO.md` | `COMPLETE` — synchronized 2026-07-20 | P0 closeout and current P1 sequencing agree across the status mirrors |
| Regression Discovery process | `ROADMAP.md` → P0 Regression Discovery; `REGRESSION_SUITE_PLAN.md` → policy and prompt block | `ACTIVE` — current P0 | Meaningful changes record their coverage decision and add reusable scenarios where required |
| Remaining ProductDecision items | `ROADMAP.md` → P0 Product decisions; `GOLDEN_WORKBOOK.md`; `WORKBOOK_PARITY_CHECKLIST.md`; `ENGINEERING_STANDARDS.md` | `COMPLETE` — known P0 inventory resolved 2026-07-20 | Settings typography ratified as 16pt header / 14pt body and implemented first-create only; future discoveries use normal record-and-defer discipline |
| Beta readiness | `ROADMAP.md` → P0 Beta readiness; `TODO.md` → Beta Gate; `PROJECT_CONTEXT.md` → Family Beta Readiness | `COMPLETE` — P0 stabilization slice closed 2026-07-20 | Isolated `@114` passed both canonical blank/fresh and representative populated-workbook runtime validation; remaining Beta-Gate work is sequenced under P1/P2 |
| Central verification | `ROADMAP.md` → P0 Central resolver verification + Recovery Validation 6F; `PROJECT_CONTEXT.md` → Central status | `COMPLETE` — static Tier-2 sweep + full 6F matrix closed | Final MEDIUM auto-adopt-ON row passed; flags OFF and fixture gate removed. |

## 6. Related Designs and Decisions

| Document | Relationship | Status or decision needed |
| --- | --- | --- |
| [`CENTRAL_APP_DOC_INDEX.md`](../../CENTRAL_APP_DOC_INDEX.md) | Index for Central architecture and verification evidence | Use it to select current documents; do not read every historical Central file by default |
| [`CENTRAL_APP_RECOVERY_COMPLETION_PLAN.md`](../../CENTRAL_APP_RECOVERY_COMPLETION_PLAN.md) | Recovery architecture + completed P0 validation evidence | Full P0 matrix closed 2026-07-20; read-only Orphan detection remains P1 |
| [`GOLDEN_WORKBOOK.md`](../../GOLDEN_WORKBOOK.md) | Canonical workbook convergence authority | Remaining UNKNOWN sheets and ProductDecision items require explicit handling |
| [`WORKBOOK_PARITY_CHECKLIST.md`](../../WORKBOOK_PARITY_CHECKLIST.md) | Per-sheet audit and convergence status | Do not write convergence code for UNKNOWN sheets before audit resolution |
| [`REGRESSION_SUITE_PLAN.md`](../../REGRESSION_SUITE_PLAN.md) | Regression discovery and future scenario-pack plan | Apply discovery now; scenario-pack implementation belongs to the sequenced P1 work |
| [`RELEASE_READINESS.md`](../../RELEASE_READINESS.md) | Future aggregate beta gate | Design exists; implementation depends on P1 harness/Validator coverage |

## 7. Related Features

| Feature | Knowledge document | Initiative relationship |
| --- | --- | --- |
| Bills | [`agents/features/bills.md`](../features/bills.md) | The DRAFT records pending runtime and coverage evidence relevant to stabilization; it does not independently define P0 priority |
| Central App | Not yet created | Central resolver/Tier-2 verification and Recovery Validation 6F P0 evidence are complete; read-only Orphan detection remains P1 |
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
- Recovery Validation 6F is complete. Read-only Orphan detection remains P1.
- Release Readiness is designed but not implemented. Do not report the future aggregate gate as current evidence.

### Resolved source conflict

| Decision | Sources synchronized | Governing interpretation |
| --- | --- | --- |
| Recovery Validation 6F closed 2026-07-20 | `ROADMAP.md`, `TODO.md`, `PROJECT_CONTEXT.md`, and this initiative | Full P0 matrix passed; read-only Orphan detection remains P1. |

## 10. Completion Criteria

- [x] Architecture, roadmap, standards, and technical-status mirrors agree that Recovery 6F is complete and broader beta-readiness evidence remains.
- [x] Regression Discovery is applied consistently to meaningful changes and any required reusable scenarios are recorded. *(`npm run test:dashboard-ux` covers the six UX regressions.)*
- [x] Remaining P0 ProductDecision items have an explicit disposition in their authoritative documents. *(Settings typography resolved 2026-07-20; no other known P0 ProductDecision remains.)*
- [x] Beta-readiness polish and runtime regression evidence required for P0 are recorded. *(Blank/fresh plus representative populated-workbook passes completed on isolated `@114`.)*
- [x] Central verification gaps assigned to P0 are closed. *(Static Tier-2 sweep + full 6F matrix complete 2026-07-20.)*
- [x] `ROADMAP.md` and `PROJECT_CONTEXT.md` explicitly identify P0 as complete and the remaining P1 scope as current before additional P1 implementation advances.
- [x] Required validation evidence is recorded without claiming the future aggregate Release Readiness report has run.
- [x] Deferred work is explicitly routed to P1, P2, or a later authoritative milestone.

## 11. Recommended Next Task

- Task: Begin P1 with disposable populated-fixture hardening: Central-created fixture lifecycle, representative-data seeding, Restricted-sharing assertion, `drive.file`-compatible access, and verified Trash cleanup.
- Why this task: P0 Project Stabilization is closed; the populated pass exposed this concrete Test Harness gap, and resolving it makes later P1 scenario packs repeatable without touching owner/bounded workbooks.
- Required role flow: Planner → Engineer → Reviewer → Tester → Validator for any non-trivial implementation slice.
- Approval gates: Explicit approval remains required for any Apps Script push/deployment, commit, and Git push.

### Local closeout evidence (2026-07-20)

- ProductDecision inventory: Settings typography was the only explicitly open P0 decision found. It is ratified as 16pt header / 14pt body and implemented on first-create only; existing populated sheets remain untouched.
- Central Tier-2 source sweep: no direct active-spreadsheet acquisition remains in a Central user-facing production path outside the resolver. Residual executable calls are the resolver's bound fallback, bound-only HOME/sort utilities, developer Test Setup, and the harness fail-closed safety check.
- Regression Discovery: the Settings change affects first-create formatting only. Existing Provisioning and Workbook Drift coverage are the appropriate checks; no header/schema, financial calculation, dashboard output, recovery behavior, or historical `REG-###` case changes.
- Isolated deployment `@109` runtime evidence: Recovery Regression Suite passed 1/1 with 7/7 functional assertions; its disposable workbook was inspected with a 16pt `INPUT - Settings` header, 14pt body, and the ratified `#ffe599` header background, then moved to trash.
- Configured Central default read-only Workbook Health passed provisioning 8/8. Workbook Drift reported six non-blocking width advisories only. The disposable-account pass closed every 6F row.

### Blank/fresh Central runtime pass (2026-07-20)

- **Target/account:** isolated deployment `@113`, signed in as `cashcompass2026@gmail.com`; no mapping and no candidate were present at startup.
- **Provisioning and startup PASS:** exactly one workbook (`CashCompass — cashcompass2026@gmail.com`) was created; Welcome rendered; Back to Dashboard reached Overview; the blank snapshot settled at zero without console errors.
- **Navigation/empty-state PASS after explicit subtab selection:** Assets, Cash Flow, Activity, Properties, Planning, and Help loaded. Upcoming, Donations, Bills, Income, Activity, Property Performance, Next Actions, Debts, Debt Overview, Rolling Debt Payoff, Retirement, and Purchase Sim rendered calm zero/setup states without a crash.
- **P0 FAIL — internal implementation names exposed:** Setup / Review status rows displayed messages including `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, and `INPUT - Cash Flow 2026`. The emitting paths are in `onboarding.js` (missing-sheet and no-income probe notes). This violates the product-language/no-internal-sheet-name rule.
- **P0 FAIL — blank first-entry workspaces:** entering Cash Flow, Properties, or Planning from the top navigation initially showed only the subnavigation and no main content until a subtab was clicked. `showPage(...)` does not select a default subpanel; Planning only loads Next Actions when that panel is already active. This violates the canonical blank/fresh requirement that every workspace render a calm usable state.
- **Follow-up polish:** empty Bank Accounts, Investments, and Debts update editors leave Save/Stop Tracking actions enabled; Bank Accounts and Investments add-new copy says a current-year block must already exist; Help includes developer implementation details; blank-workbook Refresh Financial Plan took about 65–75 seconds and showed progress but no durable completion message.
- **Cleanup PASS:** the single disposable workbook was moved to Drive Trash; its exact `mapping::947b…041` and `wbid::1Gvk…hzE` properties were removed; no other mapping was touched. `CENTRAL_AUTO_ADOPT`, `CENTRAL_RECOVERY_ACTIONS`, and `CENTRAL_ADMIN_REPAIR` were verified `false`; `RECOVERY_6F_TEST_EMAIL` was absent. Existing Beta and bounded deployments were not updated.

### Blank/fresh Central fix retest (2026-07-20)

- **Deployment scope PASS:** reviewed source was pushed to the Central Apps Script project; immutable version `114` was created; only isolated deployment `AKfycbz…UlWZQ` moved from `@113` to `@114`. Beta stayed pinned to `@106`; no bound deployment changed.
- **Provisioning/startup PASS:** `cashcompass2026@gmail.com` began without a mapping or candidate, provisioned exactly one workbook, reached Welcome and Overview, and settled without visible errors or console warnings.
- **P0 fixes PASS:** Setup / Review used product guidance without internal sheet names or raw errors. Top-level entry selected Assets → House Values, Cash Flow → Quick add, Properties → House Expenses, and Planning → Next Actions.
- **Approved polish PASS:** empty Bank/Investment/Debt Save/Stop and House Expenses Add actions were disabled with guidance; Bank/Investment/House first-run copy matched automatic preparation; Setup Help was user-facing with an Advanced sheet reference; Financial Plan refresh disabled duplicate clicks and left `Financial plan refreshed at 6:11 PM` after completion.
- **Broad blank navigation PASS:** Upcoming, Donations, Bills, Income, Activity, Property Performance, Debts, Debt Overview, Rolling Debt Payoff, Next Actions, Retirement, and Purchase Sim rendered calm zero/setup states.
- **Performance OPEN:** Financial Plan refresh completed successfully but took **143 seconds**. This does not reopen the functional feedback fix; it is direct evidence for separate performance investigation.
- **Cleanup PASS:** the single workbook was moved to Drive Trash; only exact properties `mapping::947b…041` and `wbid::1Ia0…Ubo` were removed. All three recovery flags remained `false`, `RECOVERY_6F_TEST_EMAIL` remained absent, and no unrelated mapping was touched.

### Representative populated Central pass (2026-07-20)

- **Isolation PASS:** used only the Central-created disposable workbook `1quI…4BLkQ` as `cashcompass2026@gmail.com`. The owner copy and main bounded workbook were not touched. No source push or deployment change occurred.
- **Populated editors PASS:** the existing Bank record rendered `$3,400.00`; Bank Save/Stop changed from disabled before selection to enabled after selection. Dashboard-created representative Investment (`$12,500.00`), House (`$350,000.00` value / `$200,000.00` loan), and Debt (`$2,200.00`) records rendered in their populated editors with actions enabled.
- **Cross-surface calculations PASS:** Overview rendered cash `$3,400`, investments `$12,500`, real estate `$350,000`, debt `$2,200`, and net worth `$363,700`. Property Performance calculated `$150,000` equity from the house value and loan. House Expenses enabled once the property existed.
- **UX/navigation PASS:** Setup used product language; Help retained the user-facing Setup guidance plus explicitly labeled Advanced sheet reference. Assets retained Investments and Planning retained Debts after leaving and returning. Broad navigation completed without visible errors or console warnings.
- **Cleanup PASS:** the Central-owned fixture was returned to Drive Trash. Recovery flags/properties were not changed during this pass; the previously verified OFF state remains. Beta stayed `@106`, isolated stayed `@114`, and no bound deployment changed.

### P0 beta-readiness evidence audit (started 2026-07-20)

**Confirmed current evidence:**

- Central static Tier-2 resolver sweep is closed; retained direct active-spreadsheet calls are bound/dev/safety-only.
- Recovery Regression Suite passed 1/1 with 7/7 functional assertions, and the full live 6F decision matrix passed on the isolated disposable account without duplicates.
- Configured Central default Provisioning passed 8/8; the six Workbook Drift findings were advisory widths only.
- Quick Add Reliability Suite passed 1/1 with 8/8 functional assertions on isolated deployment `@108`; the guarded restore flow also passed manual disposable-account validation without a duplicate Activity entry.
- Recurrence Engine V2 has natural runtime evidence across the recorded Weekly/Biweekly bills. The Bills regression suite is implemented as eight PURE plus two workbook-integration scenarios, but no single current Family Beta release pass across every registered suite is recorded.

**Explicit go/no-go gaps:**

1. **Full runtime regression — P0 stabilization slice complete.** The canonical blank/fresh and representative populated-workbook passes both passed on isolated `@114`.
2. **Bills Due → Pay — natural runtime evidence pending.** The occurrence bridge is committed, but the next genuine payable occurrence still needs to prove save → `bill_paid` marker → exact occurrence suppression. Do not create fake financial activity to force this row.
3. **Family Beta UX review — P0 slice passed.** Internal sheet-name leakage, blank first-entry panels, empty/populated editor action gating, first-run copy, populated rendering, Setup Help, subtab retention, and durable refresh feedback passed on isolated `@114`. The successful 143-second refresh remains a P3 performance follow-up in `TODO.md`.
4. **Automated release aggregation — not available.** The registered Bills, Recovery, Quick Add, and SMOKE coverage is useful evidence, but `RELEASE_READINESS.md` remains a design/template; a complete automated Beta verdict cannot be claimed.
5. **Milestone-boundary clarification — resolved.** `ROADMAP.md` is the declared ordering authority. Remaining Golden Workbook, Financial Integrity, Validator/Test Harness, Release Readiness, and Bills Due natural-evidence rows remain Beta-Gate work, but do not keep the narrower Project Stabilization milestone open. Current engineering work advances to P1; House Financial Accuracy remains P2; measured refresh latency remains P3.

**Current verdict:** P0 Project Stabilization is **CLOSED / PASS (2026-07-20)**. Recovery, Central verification, documentation synchronization, ProductDecision closeout, and the isolated `@114` two-track runtime evidence are green. The aggregate Release Readiness gate has not run and is not claimed. Further Apps Script deployment, commit, and Git push remain separate approval gates.

## 12. Maintenance

Re-review this document when:

- `ROADMAP.md` changes P0 priority, scope, or sequence.
- `TODO.md` or `PROJECT_CONTEXT.md` changes Beta Gate, Central verification, or current milestone status.
- A ProductDecision is resolved or a remaining Golden/Canonical scope closes.
- Central recovery/verification evidence changes.
- P0 closes and responsibility passes to Validator Phase 2.
