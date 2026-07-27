# CashCompass Full Beta Remaining Plan

**Status:** Active execution inventory

**Reconciled:** 2026-07-27

**Current evidence:** isolated Central `@201`; First-Run V5 **11/11 PASS** and
Populated Dashboard V4 **14/14 PASS** are the latest writer-inclusive browser
evidence from the dedicated unattended test session, with zero errors,
Restricted single-owner disposable fixtures, and verified exact-fixture Trash
cleanup.

**Last formal independent advocate score:** **8.3/10** on isolated Central
`@180`. This remains the official score until the next full scored advocate run;
the product has materially improved since that baseline.

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

## Reconciled completion checkpoint

The following numbered items were open when this plan was created and are now
closed. They are retained here so the work map does not lose history.

| ID | Completed result | Closing evidence |
|---|---|---|
| 1a | Apps Script HTTP 0 recovery (`REG-018`) | One bounded retry for verified pure reads, calm customer wording, no write retry, deterministic regression, and clean isolated `@181` integration replay |
| 1b | Exact-owner browser-evidence proof (`REG-015`, `REG-019`) | Exact-run ownership and fail-closed standalone behavior passed through isolated `@182` |
| 2a | Bills Pay contract decided | Pay records in a dedicated Bills side panel; Quick Add remains separate |
| 2b | Approved Bills Pay experience implemented | Amount/date confirmation, one guarded write, receipt details, and explicit **Done** flow shipped on isolated `@193` |
| 2c | Paid occurrence completion explained | Successful payment shows Cash Flow month, previous total, payment added, new total, payment history, and verifies the occurrence is cleared |
| 2f | Permanent Bills journey regression | Bills Due/Add/Manage, creation-month floor, payment marker, Cash Flow receipt, history chart, no stale warning, Restricted fixture, and cleanup passed |
| 3d | Tracked-editor workflow consistency | Bills use **Due · Add · Manage**; Houses, Bank Accounts, Investments, and Debts use **Update · Add · Manage**; Setup preserves Add/Manage intent; Update is Save-only and Manage owns guarded Stop tracking |
| 5g | Activity action-column truth (`REG-020`) | Isolated `@196` interactively showed **Action**, **Remove donation** only for an eligible Donation row, and `—` for unsupported rows; permanent UI and forged-request server regressions pass |
| 3l | Overview health prerequisite/freshness trust (`REG-021`) | Isolated `@197` First-Run V5 passed 11/11 and Populated V4 passed 14/14; both proved `health_prerequisite_truth`, Restricted single-owner fixtures, zero errors, and verified Trash cleanup |

The remaining tables below are therefore an **open-only list**.

## Open list at a glance

| Order | Open IDs | Workstream | Focused estimate |
|---:|---|---|---:|
| 1 | `1c`–`1f` | Controlled reliability, writer safety, Retirement proof, and unattended browser evidence | 3.5–8 d |
| 2 | `2d`–`2e` | Quick Add and Upcoming consequence language | 1–2 d |
| 3 | `3a`–`3c`, `3e`–`3k`, `3m` | Remaining page UX, trust, advocate scoring, responsive/accessibility | 11–21 d |
| 4 | `4a`–`4f` | Performance optimization, measurement, and percentile gate | 5–11 d |
| 5 | `5a`–`5f`, `5h`–`5m` | Financial/workbook proof plus Beta-critical Activity correction and reversal | 17–36 d |
| 6 | `6a`–`6f` | Release operations, support, privacy, and known limitations | 3.5–6.5 d |
| 7 | `7a`–`7f` | Monetization-ready policy and architecture foundation; no billing activation | 5–10 d |
| 8 | `8a`–`8f` | Freeze, complete exact-candidate evidence, score, and READY verdict | 3.5–7 d plus fixes |
| 9 | `9a`–`9e` | Supervised cohort, go/no-go, and separately approved Central Beta promotion | 2–3 active d plus 5–7 calendar d and fixes |

The arithmetic sum is intentionally not the delivery forecast because Groups
6–7 and parts of Groups 3 and 5 can advance during runtime waits. The optimized
capacity forecast is **35–52 focused working days best case** or **48–76
conservatively**, plus the five-to-seven-day cohort and defect contingency. The
2026-09-24 target is now at risk until the Activity correction scope and the
new P1 health/accessibility findings are implemented and measured; dates remain
gates, not promises.

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
| 1c | Controlled Bank/Debt stale and failure journeys | Loading failure, stale response, server error, retry, disabled actions, and recovery pass on a marked disposable fixture | 1–2 d |
| 1d | Skip and Stop-tracking safety evidence | Consequence, preserved history, confirmation, stale protection, recovery, and cleanup are explicit and regression-protected | 1–2 d |
| 1e | Retirement guidance runtime proof | Missing-minimum-input guidance hides result walls; ready state reveals correct results; focused journey passes | 0.5–1 d |
| 1f | Guarded unattended browser-suite orchestration (`REG-022`) | **Complete 2026-07-27 on isolated `@201`.** The agent keeps a dedicated authenticated `cashcompass2026@gmail.com` session and opens guarded self-starting routes directly; no account chooser, email parameter, or workbook ID is used. First-Run passed 11/11 and Populated passed 14/14 with Restricted single-owner fixtures and verified Trash cleanup. Expired Google authentication remains the only human pause. | Complete |

**Group 1 open estimate: 2.5–5 focused days.**

## 2. Bills and daily-task completion

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 2d | Clarify Quick Add duplicate/update semantics | Customer-facing copy truthfully states replace/update/add behavior | 0.5–1 d |
| 2e | Clarify Upcoming Dismiss | The outcome and preserved-history rule are explicit | 0.5–1 d |

**Group 2 open estimate: 1–2 focused days.** The core Bills flow is closed; only
the adjacent Quick Add and Upcoming wording contracts remain.

## 3. Remaining UX score improvements

Each page pass begins with an audit. If the existing experience already meets the
acceptance contract, close it with evidence rather than manufacturing a redesign.

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 3a | Finish loading-state consistency | Remaining Overview, Planner, picker, onboarding, and Admin slots use contextual shared loading states | 1–2 d |
| 3b | Finish empty/error-state consistency | Standard empty, unavailable, retry, and failure patterns cover core surfaces | 1–2 d |
| 3c | Planning hierarchy and Debt relationships | Debt accounts, Debt Overview, and Rolling Payoff purposes and links are understandable | 0.5–1 d |
| 3e | Properties context polish | Selected property/year remains clear; Cash Flow-posting consequences are understandable | 0.5–1 d |
| 3f | Activity review polish | Filters are visible/reversible; Donation-only Remove is correctly gated; narrow layout is readable | 1–2 d |
| 3g | Setup progress and next step | Required progress and one recommended next action are visible without performing a write | 0.5–1 d |
| 3h | Help and contextual links | Common tasks precede Advanced material; complex pages expose concise contextual Help | 1–2 d |
| 3i | Medium-width header and visual balance | Desktop/medium/390px compositions are balanced without weakening the established visual system | 0.5–1 d |
| 3j | Responsive and accessibility closeout | Desktop/medium/390px, keyboard, focus, programmatic control names, target size, contrast, and reduced motion pass; all visible form labels are associated with their controls | 3–5 d |
| 3k | Exact-candidate task-based advocate rerun | All eight criteria are rescored from interactive evidence; every category reaches the release path to ≥9 | 1–2 d |
| 3m | Form readiness and residual customer language | Primary actions remain disabled until minimum inputs are valid; customer labels replace stored tokens/internal workbook language; duplicated guidance is removed without changing stored values or server validation | 1–2 d |

**Group 3 open estimate: 11–21 focused days.**

### Isolated `@196` advocate finding reconciliation

The 2026-07-26 read-only run found no new browser error and confirmed `5g`.
Its **7.2/10** read-only score is evidence-limited and is not comparable with
the writer-inclusive formal **8.3/10** score, which remains official. Every new
finding is nevertheless scheduled and receives a permanent regression home.

| Priority | Confirmed finding | Work ID | Required permanent coverage |
|---|---|---|---|
| P1 | Overview says **Financial health 85 — Strong** while setup is 1/5, balances are zero, projected cash flow is negative, and the baseline is stale | `3l` | Runtime-closed on isolated `@197`: pure/server and Dashboard UX contracts pass; First-Run V5 passed 11/11 and Populated V4 passed 14/14 with exact fixture cleanup |
| P1 | Visible form labels are not programmatically associated with core inputs/selects | `3j` | Dashboard UX DOM/accessible-name contract plus keyboard, focus, desktop/medium/390px browser evidence |
| P2 | Quick Add duplicate/update behavior remains vague | `2d` | Existing Quick Add reliability suite plus Dashboard UX copy assertion |
| P2 | Empty Bank/Investment/Debt Update and Purchase Simulator surfaces begin with blank selectors or dash-only results | `3b` | Dashboard UX empty-state contract plus First-Run exact-candidate assertion |
| P2 | Add Bill exposes stored tokens and several primary actions appear enabled before required input exists | `3m` | Dashboard UX label/action-state contract plus server-validation guard and First-Run/Populated assertions |
| P2 | Help points to `Planning → Debts` instead of **Assets & Liabilities → Debt accounts** | `3c`, `3h` | Dashboard UX Help-link/copy assertion |
| P2 | Several controls are below the 44px target | `3j` | Computed target-size audit at desktop, medium, and 390px |
| P3 | Setup says “2026 block,” Retirement repeats the same prerequisite, and customer-facing abbreviations remain | `3m` | Normal-path terminology and duplicate-guidance Dashboard UX assertions |
| P3 | Medium header and Setup-card density remain visually unbalanced | `3i` | Medium-width screenshot contract and task-based advocate replay |

When a fix closes a confirmed historical defect, Regression Discovery must
either map the exact failure to an existing assertion or add the next
`REG-###` entry. Broad “page loaded” coverage is not sufficient.

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
| 5h | Durable correction identity and immutable reversal contract | Newly correctable events carry a durable event/operation ID, versioned affected-state descriptors, preview, compare-and-swap preflight, one active reversal, and an immutable correction row | 1.5–3 d |
| 5i | Direct Cash Flow correction | `quick_pay` income/expense can restore the recorded prior Cash Flow state only when the exact post-state still matches; any debt side effect is verified or the correction fails closed | 2–4 d |
| 5j | Bill occurrence correction | Manual Pay, `bill_paid`, `bill_skip`, and `bill_autopay` are corrected as linked occurrence operations without duplicate amounts or stranded recurrence markers | 3–5 d |
| 5k | Upcoming correction | Stable `upcomingId` links payment/lifecycle evidence; payment and remaining-balance/status changes correct together; ordinary edits route to Upcoming | 2–4 d |
| 5l | House Expense compound correction | The exact House row and optional Cash Flow posting pass a dual-target preflight and correct together or not at all | 2–4 d |
| 5m | Entity/audit disposition plus permanent evidence | Entity lifecycle rows route to their owning Update/Manage workflow; Planner/email/import audit rows expose no reversal; every supported family receives client/server regression and guarded disposable-workbook runtime proof | 2–5 d |

**Group 5 estimate: 17–36 focused days.** This includes approximately **13–26
days** of newly elevated Activity correction work. Generic one-click reversal of
multi-sheet entity lifecycle or bank-import/system audit events is not part of
the broad-Beta scope; those rows must route to their owning workflow or remain
explicitly audit-only.

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

- **Best case:** approximately **35–52 focused working days** after reconciling
  Activity correction and the `@196` advocate findings. Several page passes can still close
  through audit, and operations/business foundations can run alongside runtime
  waits.
- **Conservative case:** approximately **48–76 focused working days**.
- **Cohort:** add **5–7 calendar days**.
- **Contingency:** add **1–2 weeks** if performance, accessibility, or cohort
  evidence exposes a material defect.

The September 24 decision is now an at-risk best-case target after the August
buffer. October 2 may not contain the full correction program plus one repair
cycle; re-baseline after `5h` proves the shared correction foundation. The
strictest failed gate controls the actual date.

## Optimized execution model

### Critical path

The remaining work that directly controls the finish date is:

`1c–1e → 5h–5m → 2d–2e → 3a–3k/3m → 4a–4f → 8a–8f → 9a–9e`

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

1. **Resolve decisions before coding.** Decide recovery disposition,
   performance budgets, and broad-Beta packaging boundaries before implementation.
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
| Completed through Jul 26 | `1a`, `1b`, `2a`–`2c`, `2f`, `5g` | `3d`; shared tracked-editor convergence | — | Isolated `@196` Activity truth passes; Beta stays `@106`; bounded untouched |
| Aug 21–27 | `1c`–`1e`; begin `5h`–`5i` | Audit `3a`, `3b`; begin `3m` and diagnostic performance | Start `6a`–`6f`, `7a`–`7b`, cohort design | Reliability proof closes; Activity correction foundation and direct Cash Flow path advance |
| Aug 28–Sep 3 | `5j`–`5m` | Close `2d`–`2e`; advance Group 5 matrix/recovery proof | `7c`–`7f`, known limitations, support posture | Supported Activity correction families and audit-only dispositions pass |
| Sep 4–10 | Begin/finish performance fixes `4a`–`4d` | Close `3c`, `3e`–`3m`; finish Group 5 | Finish Groups 6–7 | UX/accessibility path ≥9 and candidate prerequisites complete |
| Sep 11–17 | Freeze `8a`; run `4e`–`4f`, `8b`–`8f` | Exact-candidate advocate `3k` | Final release/rollback/support review | Exact candidate reaches automated READY prerequisites |
| Sep 18–24 | Release-blocking fixes only | Cohort observation and final advocate check | Support the cohort; prepare go/no-go | Five-to-seven-day cohort and final broad-Beta decision |

## Explicitly outside broad-Beta scope

- production billing activation;
- bank/account aggregation;
- Chat/Assistant;
- Money Plan Phase 2;
- generic reversal of legacy Activity rows whose original state cannot be proved;
- automatic external payment detection;
- other future Priority 4 features.

These items may be designed later, but their implementations do not enter the
current Beta critical path.
