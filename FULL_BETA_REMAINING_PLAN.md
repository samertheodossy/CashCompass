# CashCompass Full Beta Remaining Plan

**Status:** Active execution inventory

**Reconciled:** 2026-07-23

**Current evidence:** isolated Central `@180`, advocate score **8.3/10**

**Target broad invited-Beta decision:** **2026-09-24**

**Contingency boundary:** **2026-10-02**

## Purpose and authority

This is the authoritative numbered inventory of work remaining before a broad
invited CashCompass Beta. It translates the gates in
`BETA_10_OUT_OF_10_PLAN.md` into executable work with focused-effort estimates.

- `ROADMAP.md` controls priority and sequence.
- `BETA_10_OUT_OF_10_PLAN.md` controls the release standard.
- This document controls the numbered remaining-work inventory and estimates.
- `PROJECT_CONTEXT.md` controls current technical status.
- `TODO.md` retains detailed backlog and historical context.

The estimates below are focused effort for one person. They exclude the planned
August break, external review time, Apps Script waiting time, the five-to-seven
calendar day cohort, and unpredictable defect rework. A date never waives a gate.

## Completion standard

Broad invited Beta requires all of the following:

- weighted readiness score at least **95/100**;
- no scored dimension below **9/10**;
- no unresolved Severity 1 or Severity 2 defect;
- every non-negotiable financial, safety, privacy, usability, performance,
  automated-evidence, operations, and cohort gate passing on the exact candidate;
- every accepted warning documented with an owner, rationale, mitigation, and
  review date.

## 1. Reliability and trustworthy evidence

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 1a | Apps Script HTTP 0 recovery (`REG-018`) | Calm bounded retry/recovery, no raw transport error, no duplicate submission, permanent regression, isolated PASS | 1–2 d |
| 1b | Dedicated exact-owner browser-evidence proof (`REG-015`) | Release Readiness-owned launcher accepts only its exact active run/candidate; stale or standalone evidence fails closed | 0.5–1 d |
| 1c | Controlled Bank/Debt stale and failure journeys | Loading failure, stale response, server error, retry, disabled actions, and recovery pass on a marked disposable fixture | 1–2 d |
| 1d | Skip and Stop-tracking safety evidence | Consequence, preserved history, confirmation, stale protection, recovery, and cleanup are explicit and regression-protected | 1–2 d |
| 1e | Retirement guidance runtime proof | Missing-minimum-input guidance hides result walls; ready state reveals correct results; focused journey passes | 0.5–1 d |

**Group 1 estimate: 4–8 focused days.**

## 2. Bills and daily-task completion

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 2a | Decide the Bills Pay contract | Product decision states whether Pay records immediately or intentionally hands off to Quick Add | 0.5 d |
| 2b | Implement the approved Pay → Quick Add behavior | The remaining action is unmistakable, context is preserved, and no duplicate payment is possible | 1–2 d |
| 2c | Explain the next bill occurrence | After an occurrence is paid, the next overdue/upcoming/handled state and reason are explicit | 0.5–1 d |
| 2d | Clarify Quick Add duplicate/update semantics | Customer-facing copy truthfully states replace/update/add behavior | 0.5–1 d |
| 2e | Clarify Upcoming Dismiss | The outcome and preserved-history rule are explicit | 0.5–1 d |
| 2f | Permanent Bills journey regression | Pay, handoff, submission, next occurrence, duplicate behavior, Help, Restricted sharing, and verified cleanup pass | 1–2 d |

**Group 2 estimate: 4–7.5 focused days.**

## 3. Remaining UX score improvements

Each page pass begins with an audit. If the existing experience already meets the
acceptance contract, close it with evidence rather than manufacturing a redesign.

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 3a | Finish loading-state consistency | Remaining Overview, Planner, picker, onboarding, and Admin slots use contextual shared loading states | 1–2 d |
| 3b | Finish empty/error-state consistency | Standard empty, unavailable, retry, and failure patterns cover core surfaces | 1–2 d |
| 3c | Planning hierarchy and Debt relationships | Debt accounts, Debt Overview, and Rolling Payoff purposes and links are understandable | 0.5–1 d |
| 3d | Assets workflow consistency | Bank, Investment, and House selection/summary/update/Save/Stop-tracking patterns align | 1–2 d |
| 3e | Properties context polish | Selected property/year remains clear; Cash Flow-posting consequences are understandable | 0.5–1 d |
| 3f | Activity review polish | Filters are visible/reversible; Donation-only Remove is correctly gated; narrow layout is readable | 1–2 d |
| 3g | Setup progress and next step | Required progress and one recommended next action are visible without performing a write | 0.5–1 d |
| 3h | Help and contextual links | Common tasks precede Advanced material; complex pages expose concise contextual Help | 1–2 d |
| 3i | Medium-width header and visual balance | Desktop/medium/390px compositions are balanced without weakening the established visual system | 0.5–1 d |
| 3j | Responsive and accessibility closeout | Desktop/medium/390px, keyboard, focus, semantics, names, target size, contrast, and reduced motion pass | 2–4 d |
| 3k | Exact-candidate task-based advocate rerun | All eight criteria are rescored from interactive evidence; every category reaches the release path to ≥9 | 1–2 d |

**Group 3 estimate: 10–20 focused days.**

## 4. Performance gate

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 4a | Optimize Dashboard formatting | Measured formatting stage is reduced without changing workbook output | 1–3 d |
| 4b | Optimize snapshot construction | Duplicate reads/calculation work are removed while totals and freshness remain correct | 1–2 d |
| 4c | Review Dashboard chart rebuilding | Unnecessary chart work is avoided without removing required output | 0.5–1.5 d |
| 4d | Measure remaining release flows | Initial load, Save, first-create, navigation, provisioning, and mature-workbook timings are captured | 1–2 d |
| 4e | Run the exact-candidate 20-pair campaign | Twenty independent first/repeat pairs complete with Restricted fixtures and verified Trash | 1–2 active d; 2–4 elapsed d |
| 4f | Ratify p50/p95 budgets | Budgets are approved and every routine flow passes; failures return to optimization | 0.5–1 d plus rework |

**Group 4 estimate: 5–11 focused days.**

## 5. Final financial, workbook, and recovery proof

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 5a | Rerun Financial Integrity on the frozen candidate | Existing 53 assertions, `$0.01` reconciliation, Restricted sharing, and cleanup pass | 0.5–1 d |
| 5b | Complete the candidate fixture matrix | Blank, sparse, populated, mature/multi-year, and legacy-compatible evidence passes | 1–3 d |
| 5c | Final workbook visual-quality review | Fresh provisioning is production-grade and mature workbook compatibility is preserved | 1–2 d |
| 5d | Read-only orphan detection | The remaining P1 Recovery follow-up is implemented and proved, or explicitly removed from the broad-Beta gate | 1–2 d |
| 5e | Recovery follow-up disposition | Create New Workbook and Admin Set Mapping are either closed or documented as supervised-admin scope | 0.5–2 d |
| 5f | Unified-source bounded-safety evidence | The exact reviewed source preserves no-argument bounded behavior; any bounded deployment remains user-controlled | 0.5–1 d |

**Group 5 estimate: 4.5–11 focused days.**

## 6. Operations, support, and privacy

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 6a | Release and rollback runbook | Promotion, smoke verification, rollback target, and responsibilities are explicit | 0.5–1 d |
| 6b | Incident and workbook-recovery runbook | Severity, containment, communication, recovery, and audit steps are usable | 0.5–1 d |
| 6c | Support intake and response expectations | Owner, channel, severity definitions, and response expectations exist | 0.5–1 d |
| 6d | User offboarding and owned-data behavior | Export, cancellation, deletion, mapping removal, and workbook ownership are defined | 1–2 d |
| 6e | Privacy-safe monitoring plan | Reliability, deployment, failure, and cost signals exclude household financial content | 0.5–1 d |
| 6f | Known limitations register | Every user-relevant limitation has wording, workaround, owner, and review date | 0.5 d |

**Group 6 estimate: 3.5–6.5 focused days.**

## 7. Monetization-ready foundation

This is design and policy readiness, not payment activation.

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 7a | Target customer and value proposition | The intended customer and paid decision value are explicit | 0.5–1 d |
| 7b | Free/Beta/Paid packaging and pricing hypotheses | Boundaries and hypotheses are documented without committing to live billing | 0.5–1 d |
| 7c | Entitlement seams and safe feature gating | Plan state cannot lock users out of their owned workbook or history | 1–2 d |
| 7d | Privacy, terms, support, refund, and incident posture | Required posture is documented; external review remains separately timed | 1–2 d plus review |
| 7e | Billing/tax/webhook architecture decision | Provider-neutral design covers idempotency, retries, failures, tax, and cancellation | 1–2 d |
| 7f | Privacy-safe product and cost metrics | Activation, retention, reliability, support cost, and unit cost can be measured safely | 1–2 d |

**Group 7 estimate: 5–10 focused days, largely parallelizable.**

## 8. Frozen Release Candidate and final gate

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 8a | Freeze exact source/deployment identity | Candidate commit, Apps Script version, deployment, and rollback target are immutable | 0.5 d |
| 8b | Run all required exact-candidate suites | Server, browser, recovery, financial, workbook, and performance inventory passes | 1–2 d |
| 8c | Resolve or formally accept warnings | Every warning has owner, mitigation, rationale, and review date | 0.5–2 d plus fixes |
| 8d | Final independent advocate scorecard | Weighted score ≥95/100 and no dimension below 9/10 | 0.5–1 d |
| 8e | Confirm no Severity 1/2 defect | Open-defect inventory passes the release treatment rules | 0.5 d |
| 8f | Archive the reproducible READY verdict | Candidate identity, evidence, warnings, cleanup, and rollback target are archived | 0.5 d |

**Group 8 estimate: 3.5–7 focused days plus defect rework.**

## 9. Supervised cohort and go/no-go

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 9a | Prepare the cohort | Consented users, known workbook types, support contact, tasks, and measurement plan are ready | 0.5–1 d |
| 9b | Run the observation window | Five to seven calendar days capture task success, time-to-value, confusion, repeat use, reliability, and support load | 5–7 calendar d |
| 9c | Repair and revalidate candidate defects | Each material fix receives regression discovery and the exact gate reruns | 1–5 d per cycle |
| 9d | Final broad-Beta go/no-go | Score, READY verdict, cohort result, support readiness, known limits, and rollback all pass | 0.5 d |
| 9e | Promote Central Beta and smoke test | Only after explicit deployment approval; Beta smoke passes; bounded remains user-controlled | 0.5–1 d |

**Group 9 estimate: 2–3 active days plus 5–7 calendar days and possible rework.**

## Overall capacity range

- **Best case:** approximately **25–35 focused working days** because many page
  passes can close through audit, and operations/business foundations can run
  alongside runtime waits.
- **Conservative case:** approximately **35–50 focused working days**.
- **Cohort:** add **5–7 calendar days**.
- **Contingency:** add **1–2 weeks** if performance, accessibility, or cohort
  evidence exposes a material defect.

The September 24 decision is the optimized best-case path after the August
buffer. October 2 supports one focused repair/retest cycle. The strictest failed
gate controls the actual date.

## Optimized execution model

### Critical path

The work that directly controls the finish date is:

`1a → 1b → 2a → 2b–2f → 1c–1e → 3j–3k → 4a–4f → 8a–8f → 9a–9e`

Financial/workbook proof in Group 5 must finish before `8b`. Operations and
monetization foundations in Groups 6–7 must finish before `8d`, but they should
not block early engineering.

### Three parallel lanes

| Lane | Work | Optimization rule |
|---|---|---|
| A — Critical engineering | Groups 1–2, performance fixes, candidate gate | One defect/behavior contract at a time; do not start speculative features |
| B — UX and evidence | Group 3, fixture matrix, accessibility, advocate reviews | Audit first; implement only confirmed gaps; reuse existing components and permanent suites |
| C — Operations and product foundation | Groups 6–7, known limits, cohort design | Advance during Apps Script executions, performance samples, and review waits |

### Time-saving rules

1. **Resolve decisions before coding.** Decide Bills Pay, recovery disposition,
   performance budgets, and broad-Beta packaging boundaries at the start.
2. **Measure performance early.** Run diagnostic timings before the final freeze
   so the 20-pair campaign is confirmation, not discovery.
3. **Audit before redesigning.** Close a UX item with evidence when it already
   meets the contract; do not manufacture scope.
4. **Attach a regression to every fix.** Prefer extending the existing suite over
   creating a parallel runner.
5. **Use coherent isolated deployment waves.** Validate related read-only polish
   together, while every writer journey still creates and re-verifies its own
   marked disposable workbook.
6. **Keep the candidate quiet.** No new major feature, schema expansion, broad
   migration, or unrelated refactor enters the pre-Beta critical path.
7. **Use wait time productively.** Documentation, runbooks, packaging, known
   limitations, and cohort preparation advance while Apps Script runs.
8. **Freeze only once.** Complete diagnostic performance and UX discovery before
   the candidate freeze; after freeze, accept only release-blocking corrections.
9. **Preserve environment boundaries.** Beta stays pinned until promotion;
   bounded remains user-controlled and is never a Harness target.

## Optimized calendar waves

| Window | Lane A — critical | Lane B — UX/evidence | Lane C — parallel foundation | Exit |
|---|---|---|---|---|
| Aug 21–27 | `1a`, `1b`, decision `2a` | Audit `1e`, `3a`, `3b`; begin diagnostic performance | Start `6a`–`6f`, `7a`–`7b`, cohort design | Reliability/evidence truth closed; Bills contract approved |
| Aug 28–Sep 3 | `2b`–`2f`, `1c`–`1d` | Close Retirement and targeted page-pass gaps | `7c`–`7f`, known limitations, support posture | Critical task completion and trust journeys pass |
| Sep 4–10 | Performance fixes `4a`–`4d` | `3c`–`3j`, Group 5 matrix/recovery proof | Finish Groups 6–7 | UX/accessibility path ≥9 understood; no unresolved proof gap |
| Sep 11–17 | Freeze `8a`; run `4e`–`4f`, `8b`–`8f` | Exact-candidate advocate `3k` | Final release/rollback/support review | Exact candidate reaches automated READY prerequisites |
| Sep 18–24 | Release-blocking fixes only | Cohort observation and final advocate check | Support the cohort; prepare go/no-go | Five-to-seven-day cohort and final broad-Beta decision |

## Explicitly outside broad-Beta scope

- production billing activation;
- bank/account aggregation;
- Chat/Assistant;
- Money Plan Phase 2;
- paid-bill correction workflow;
- automatic external payment detection;
- other future Priority 4 features.

These items may be designed later, but their implementations do not enter the
current Beta critical path.
