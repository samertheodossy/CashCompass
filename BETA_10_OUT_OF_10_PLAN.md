# CashCompass 10/10 Beta and Monetization-Ready Plan

**Status:** Active quality strategy

**Created:** 2026-07-20

**Current baseline:** 7.5/10 controlled-family-beta product
**Target:** A 10/10 Beta Release Candidate whose trust, operations, and product architecture make later monetization an incremental launch step rather than a rescue project.

## 1. Strategic decision

CashCompass will be **quality-gated, not date-gated**.

We will accept schedule movement when it buys measurable improvements in financial correctness, recovery, performance, usability, privacy, release confidence, and operational readiness. We will not broaden release merely because a planned date arrives.

This does not mean waiting for every future feature. A 10/10 beta is not feature-complete; it is a focused product whose **core promises are excellent and provable**:

- the numbers reconcile;
- the user's workbook and history are safe;
- common workflows are clear and responsive;
- failures are calm, recoverable, and diagnosable;
- releases have repeatable evidence;
- support, privacy, entitlements, and product packaging have deliberate foundations.

Trusted users may participate in a **supervised validation cohort** before the release gate closes. That cohort is a learning mechanism, not a declaration that the product is broadly ready.

## 2. Honest baseline from the 2026-07-20 validation

| Dimension | Baseline | What was observed |
| --- | ---: | --- |
| Financial consistency | 9/10 | Tested cash, investments, property, debt, equity, and net-worth values reconciled across the dashboard and workbook. |
| Recovery and data safety | 8.5/10 | Full Recovery 6F matrix passed; duplicate prevention and bounded-workbook isolation are strong. Disposable-fixture privacy/access still needs automation. |
| Core workflow usability | 7.5/10 | Setup, navigation, populated editors, action gating, subtab retention, and automatic structure creation worked. |
| First-time-user clarity | 7/10 | The product is understandable with guidance, but the number of areas, modes, and planning concepts can overwhelm a new user. |
| Visual/copy polish | 7/10 | The experience is coherent but still has terminology, loading-state, Help-density, and contextual-guidance inconsistencies. |
| Performance | 5/10 | Financial Plan refresh took 143 seconds; several first-create actions took tens of seconds. Successful but not yet confidence-inspiring. |
| Automated release confidence | 7/10 | Strong recovery, Quick Add, provisioning, drift, schema, and targeted UX evidence exists; the aggregate release gate and mature populated scenario coverage remain incomplete. |

**Overall baseline: 7.5/10.** Suitable for one or two trusted users with close support. Not yet suitable for a broad, unattended, or monetized beta.

## 3. What “10/10 beta” means

“10/10” is a release standard, not a claim that software can never fail.

CashCompass earns the 10/10 Beta Release Candidate label only when:

1. the weighted readiness score is at least **95/100**;
2. no scored dimension is below **9/10**;
3. every non-negotiable release gate is PASS;
4. there are no unresolved Severity 1 or Severity 2 defects;
5. every accepted warning has an owner, rationale, mitigation, and review date;
6. the final candidate completes a supervised cohort without a financial-integrity, privacy, recovery, or data-loss incident.

### Weighted scorecard

| Dimension | Weight | 10/10 evidence |
| --- | ---: | --- |
| Financial integrity and explainability | 20 | Dashboard, Planner, Rolling Debt, assets, liabilities, and workbook sources reconcile to $0.01; assumptions and unavailable states are explicit. |
| Data safety, recovery, and privacy | 15 | No silent duplicates; recovery matrix green; least-privilege access; Restricted fixtures; safe ownership, export, cleanup, and rollback behavior. |
| Core usability and workflow completion | 15 | New and returning users complete core tasks without developer help; safe defaults, clear actions, contextual guidance, and recoverable errors. |
| Performance and responsiveness | 15 | Agreed p50/p95 budgets pass for load, save, create, refresh, and large-workbook workflows; no unexplained long-running states. |
| Automated release evidence | 15 | Aggregate Release Readiness report passes required packs and Validator gates; results are archived and reproducible. |
| Workbook and visual quality | 10 | Fresh provisioning is visually production-grade; mature workbooks remain compatible; responsive/accessibility review passes. |
| Operations, support, and monetization foundation | 10 | Release/rollback runbook, support intake, privacy/terms posture, entitlement seams, packaging, metrics, and billing architecture decision are ready. |

The 7.5/10 baseline above is an honest product-review judgment, not a backfilled formal score. The first auditable weighted baseline will be recorded after P1 supplies consistent fixtures, performance instrumentation, and evidence contracts. We will not manufacture precision from evidence that does not yet exist.

## 4. Non-negotiable release gates

### Gate A — Financial truth

- Canonical financial basis is declared.
- Planner, Dashboard, Rolling Debt, assets, liabilities, and relevant sheets reconcile to **$0.01**.
- House Financial Accuracy uses one shared property model, including financing costs where promised.
- Blank, sparse, representative populated, mature/multi-year, and legacy-compatible fixtures pass.
- No fake confident state: unavailable, incomplete, and not-initialized conditions remain explicit.

### Gate B — Workbook safety and privacy

- Recovery 6F remains green and all production recovery flags return OFF after tests.
- No tested path silently creates a duplicate workbook.
- Populated test fixtures are Central-created, synthetic, `drive.file`-compatible, and **Restricted**.
- Harness refuses link-accessible or non-disposable targets.
- Cleanup is recoverable Trash movement, never broad or permanent deletion.
- Owner/bounded workbooks are never mutated by Central test scenarios.

### Gate C — Core experience

- Setup gives a new user a clear first path and a clear definition of “ready.”
- The six main workspaces and their primary tasks are understandable without reading the full Help reference.
- Terminology is consistent, including **Due day of month** and **Refresh Financial Plan** language.
- Loading, saving, completion, empty, warning, and error states use one coherent system.
- Long-running actions communicate progress and prevent duplicate submissions.
- Keyboard, contrast, responsive/mobile, and common browser checks pass.

### Gate D — Performance

The reusable, flag-gated timing foundation is implemented in `performance_timing.js` (`PERFORMANCE_OBSERVABILITY.md`). Isolated planner timing passed on Central `@115`: first/repeat server time was **81.455 s / 77.275 s**, with 82.2% of the repeat in dashboard formatting, snapshot construction, and History/Dashboard chart rebuilding. The first optimization passed on isolated Central `@116`: preserving History rows while retiring their six unused embedded charts reduced the repeat History stage from **11.507 s to 0.165 s** and total repeat server time to **43.946 s**. Performance hardening remains beta-critical; more samples and the remaining hotspots are still required. P1 should extend the same contract to representative flows and ratify budgets. Proposed starting budgets:

| Flow | Proposed p50 | Proposed p95 |
| --- | ---: | ---: |
| Initial meaningful dashboard | ≤ 8 s | ≤ 20 s |
| Ordinary save acknowledgement | ≤ 2 s | ≤ 5 s |
| Ordinary server save completion | ≤ 6 s | ≤ 12 s |
| First-create account/property/debt | ≤ 15 s | ≤ 30 s |
| Financial Plan refresh | ≤ 30 s | ≤ 60 s |
| Main tab/subtab navigation after load | ≤ 1 s | ≤ 3 s |

Budgets may be ratified after measurement, but a 143-second routine refresh is not acceptable for release. If it is repeatable, its optimization moves into the beta-critical path rather than remaining a later performance enhancement.

### Gate E — Automated release confidence

- Disposable populated-fixture lifecycle is automated.
- Functional assertions and spreadsheet injection support repeatable scenario packs.
- Formula, conditional-formatting, named-range, and Workbook Health coverage are complete to the agreed release scope.
- SMOKE, REGRESSION, RECOVERY, and selected STRESS packs pass.
- The aggregate Release Readiness report produces a reproducible **READY FOR BETA** verdict.
- Every release archives its inputs, version/deployment identity, results, warnings, and rollback target.

### Gate F — Operability and support

- Release, rollback, incident, workbook-recovery, and user-offboarding runbooks exist.
- Support intake and severity definitions exist with an owner and response expectations.
- Admins can identify deployment, mapping, workbook health, and recent failures without inspecting private financial values.
- Monitoring respects privacy and reports operational facts rather than financial content.
- Known limitations are visible to users before they depend on affected behavior.

### Gate G — Monetization readiness

The beta does not need to charge immediately, but it must avoid architecture and trust debt that makes charging painful later.

- Target customer and paid value proposition are explicit.
- Free/beta/paid packaging hypotheses are documented.
- Identity and entitlement seams are designed independently from billing-provider code.
- Feature gates fail safely and never lock users out of their owned data.
- Export, cancellation, account deletion, and workbook ownership behavior are defined.
- Terms, privacy disclosures, support obligations, refund posture, and incident handling are reviewed before payment collection.
- Usage/cost metrics needed for pricing are measured without collecting unnecessary financial data.
- Billing provider, tax, webhook, retry, and failed-payment architecture has an approved design.
- Actual payment collection waits until the product demonstrates trust, repeated use, and supportability.

### Defect severity used by the gate

| Severity | Meaning | Release treatment |
| --- | --- | --- |
| Severity 1 | Data loss, privacy/security exposure, irrecoverable workbook damage, or materially wrong financial results presented as trustworthy. | Immediate stop; no release. |
| Severity 2 | A core workflow is blocked or unreliable, recovery cannot be completed safely, or a routine flow materially violates the approved performance budget. | Must be fixed before release. |
| Severity 3 | A meaningful defect has a safe, documented workaround and does not compromise financial truth, privacy, or data safety. | May be accepted only with an owner, user-visible limitation, and review date. |
| Severity 4 | Minor copy, visual, or convenience issue that does not impede task completion. | Prioritize by frequency and polish impact. |

## 5. Quality-first delivery map

### Phase 1 — Repeatable proof foundation (current P1)

**Objective:** Make every important claim reproducible without touching a real household workbook.

1. **Complete:** Harden Central-created populated fixtures and Restricted-sharing assertions; verify safe Trash cleanup without touching owner/bounded workbooks.
2. **Complete for the current representative fixture:** Seed Bank, Investment, House, Debt, Bills, Income, Upcoming, and Retirement data automatically. Multi-year history remains a future pack need.
3. Ratify performance instrumentation and budgets.
4. Complete the required Validator modules and Workbook Health aggregation.
5. Expand E2E, live, and performance packs around historical defects and core workflows.
6. Implement bounded Release Readiness orchestration and its aggregate report.

**Exit:** Repeatable evidence can judge blank, sparse, populated, mature, legacy, and recovery states without manual fixture improvisation.

### Phase 2 — Financial truth and model convergence (P2)

**Objective:** Make the core financial promise defensible before broader release.

1. Declare the canonical financial basis.
2. Reconcile Planner, Dashboard, Rolling Debt, assets, liabilities, and sheets to $0.01.
3. Complete House Financial Accuracy with one shared operating/financing model.
4. Add Asset, Planner, Dashboard, and property reconciliation diagnostics.
5. Add regression scenarios for every corrected discrepancy.

**Exit:** All release-critical financial surfaces agree and explain why.

### Phase 3 — Finished-feeling experience and performance (beta-critical P3)

**Objective:** Turn a capable power-user beta into a product normal users can trust without supervision.

1. Profile and reduce Financial Plan, provisioning, create, load, and large-workbook latency.
2. Standardize loading, save, success, error, and empty states.
3. Resolve terminology and Help/contextual-guidance inconsistencies.
4. Complete responsive, keyboard, contrast, and browser compatibility review.
5. Run task-based usability sessions; fix repeated confusion rather than isolated preference.

The ordered implementation inventory for this experience work is `TODO.md → UX Backlog (Version 1) → Web Dashboard page-by-page polish` (`UX-01` through `UX-10`). It begins with Overview hierarchy and balanced card rows, then proceeds through global consistency, Cash Flow, Planning, Assets, Properties, Activity, Setup, Help, and the responsive/accessibility closeout. Each ID is intended to ship and validate independently; this phase is not authorization for a broad redesign or for calculation/schema/write-path changes.

**Exit:** Performance budgets pass and core tasks feel coherent, responsive, and understandable.

### Phase 4 — Supervised validation cohort

**Objective:** Prove the engineered quality with real behavior while maintaining close support.

1. Use a small, consented cohort with known workbook types.
2. Record task success, time-to-value, confusion points, reliability, support load, and repeated use.
3. Triage blockers separately from enhancements.
4. Require the release gate after every candidate fix.
5. Complete a sustained observation window without financial-integrity, recovery, privacy, or data-loss incidents.

**Exit:** Users complete core workflows, return voluntarily, trust the numbers, and do not require developer intervention for routine use.

### Phase 5 — Monetization-ready release preparation

**Objective:** Make charging an incremental business activation rather than a redesign.

1. Define customer, positioning, packaging, pricing hypotheses, and paid outcomes.
2. Finalize entitlement boundaries and safe owned-data behavior.
3. Prepare privacy, terms, support, refunds, incidents, export, and deletion processes.
4. Choose billing/tax architecture and document webhook/idempotency/failure handling.
5. Establish privacy-preserving activation, retention, reliability, support-cost, and unit-cost metrics.
6. Run the full 10/10 scorecard and Release Readiness gate on the exact candidate.

**Exit:** The product can launch as a high-quality beta and later enable payment without compromising data ownership, trust, or supportability.

### Planning horizon, not a deadline

Current repository estimates imply roughly **33–73 focused engineering days** for full P1 (15–35), P2 (10–21), and beta-critical P3 (8–17), before allowing for cohort observation, external review, Apps Script authorization/runtime delays, defect rework, and final release evidence. Some cohort learning and monetization-foundation design can overlap safely, but the hard gates cannot be skipped to recover a date.

This range is for capacity planning only. The release decision is based on evidence, not elapsed time.

## 6. Stop/go rules

### Stop the release when

- any financial total cannot be reconciled;
- any path risks duplicate, lost, inaccessible, or wrongly shared workbook data;
- routine core actions regularly exceed ratified performance budgets;
- a required scenario or release gate is unavailable, flaky, or failing;
- new users cannot complete core tasks without direct developer help;
- privacy, ownership, export, cancellation, or support obligations are unclear;
- a release requires “we will fix it after users arrive” for a core trust promise.

### Proceed when

- all non-negotiable gates pass on the exact release candidate;
- the weighted score is at least 95/100 with no dimension below 9/10;
- the supervised cohort supports the engineering evidence;
- residual warnings are explicit, non-critical, owned, and visible;
- rollback and support are ready before deployment;
- the release is compelling because it is trustworthy, not because it is early.

## 7. Monetization principle

CashCompass should monetize **earned trust and decision value**, not access to a user's own data.

The likely paid value is deeper planning, automation, guided decisions, advanced scenarios, aggregation, and premium support—not holding workbook access hostage. Users must retain their Drive-owned workbook, exportability, and understandable financial history regardless of plan state.

The commercial sequence is therefore:

```text
Prove correctness and safety
        ↓
Prove usability and performance
        ↓
Prove repeated household value
        ↓
Prepare support, privacy, entitlements, and pricing
        ↓
Enable billing
        ↓
Expand automation and premium decision support
```

This is the slower path to first revenue and the faster path to durable trust, retention, referrals, and a product people are willing to pay for.

### Monetization enablement map

| When | Build or prove | Decision enabled |
| --- | --- | --- |
| During P1–P3 | Privacy-safe product events, operational cost measurement, identity/entitlement seams, and owned-data guarantees. | Know what is used, what creates cost, and what can be packaged safely. |
| Supervised cohort | Activation rate, time to first useful plan, core-task completion, voluntary repeat use, support minutes per household, and trust/confusion feedback. | Know whether the product creates repeatable value and can be supported economically. |
| Before broad beta | Target customer, free/beta/paid boundaries, pricing hypotheses, terms/privacy/support posture, export/deletion/cancellation behavior, and billing/tax architecture. | Know what could be sold without redesigning the product or compromising trust. |
| After the 10/10 gate | Billing-provider sandbox, idempotent webhook handling, entitlement tests, failed-payment behavior, refunds, and cancellation rehearsals. | Know that payment can be enabled safely. |
| Before charging real users | Explicit willingness-to-pay evidence, acceptable retention/support load, reviewed legal/financial obligations, and a rollback plan. | Make a deliberate go/no-go payment decision. |

Metrics must be defined before instrumentation and must avoid copying transaction descriptions, balances, account names, or other private financial content into analytics. The purpose is to measure product outcomes and operating health, not observe household finances.

## 8. Immediate next decision

Validator modules and the required E2E/live packs are runtime-proven. A permanent resumable Performance Planner percentile suite is deployed only to isolated Central `@136`; its 20-pair campaign is intentionally paused after six confirmed pairs, so the proposed p50/p95 budgets remain unratified. The next active P1 work is the single-console Release Readiness controls; afterward, resume the remaining performance pairs and run bounded orchestration to produce the reproducible beta verdict without relying on one timeout-prone Apps Script execution.
