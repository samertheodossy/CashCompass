# CashCompass Full Beta Remaining Plan

**Status:** Active execution inventory

**Reconciled:** 2026-07-29

**Current evidence:** isolated Central `@240`; clean Populated Dashboard run
`FR-d75843e0-486e-4faa-8967-05ee40b73e25` passed **21/21** in 383.006 s. It
includes the complete `REG-030`–`REG-039` direct Quick Add matrix plus
change-amount/remove correction for cash, credit-card, created-row, and Donation
operations; immutable correction history; replay/retry refusal; same-page value
refresh; customer-safe language; newest/middle/earlier/post-correction replay;
and same-target receipt retirement while preserving later values. Every prior
populated journey passed with zero browser errors, Restricted single-owner
sharing, and verified exact-fixture Trash cleanup. The user completed the
corresponding Central visual review; only the Git checkpoint remains.

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
| 1f | Guarded unattended browser-suite orchestration (`REG-022`) | Isolated `@201` First-Run and Populated suites self-started under the fixed disposable identity without an email or workbook target; both verified Restricted sharing and exact-fixture Trash cleanup |
| 1c | Controlled Bank/Debt loading resilience (`REG-023`) | Isolated `@203` Populated Dashboard V5 passed 16/16; controlled failures kept Save disabled, transient retry recovered, late stale responses were ignored, zero browser errors were captured, and the exact Restricted fixture was verified in Trash |
| 1d | Bill Skip/Stop-tracking safety (`REG-024`) | Isolated `@206` Populated Dashboard V6 passed 17/17; Skip required consequence confirmation and stayed dismissed without requiring a Cash Flow row, stale Stop failed closed, valid retry soft-deactivated the bill, source fields/history and exact Activity evidence were preserved, and cleanup was verified |
| 1e | Retirement guidance runtime proof (`REG-025`) | Isolated `@211` First-Run V6 passed 12/12 and Populated V7 passed 18/18; not-ready guidance hid result walls, ready Base results rendered, label-based row resolution preserved compact/legacy compatibility, and both fixtures were verified in Trash |
| 2d | Quick Add cumulative language (`REG-026`) | Completed and pushed in `168a49b`; action copy and Help state add-to-total / do-not-replace semantics, the production writer remains cumulative, the user confirmed the bounded presentation, and permanent Dashboard UX coverage passes |
| 2e | Upcoming Dismiss consequences (`REG-027`) | Completed and pushed in `168a49b`; the action surface, hint, success message, and Help state no payment, no Cash Flow change, and preserved Upcoming/Activity history; the user confirmed the bounded wording and permanent server/UI coverage passes |
| REG-028 | Appended-row presentation safety | Completed and pushed in `168a49b`; Upcoming, Bills, Debts, and Donations inherit sibling format/row height with first-row fallbacks, while Bank, Investment, and House paths were already protected |

The remaining tables below are therefore an **open-only list**.

## Open list at a glance

| Order | Open IDs | Workstream | Focused estimate |
|---:|---|---|---:|
| 1 | `5h`–`5m` | End-to-end financial operation identity and safe correction | 7–12 d including integrated disposable-workbook validation; rebaseline after `5h` |
| 2 | `3a`–`3c`, `3e`–`3k`, `3m` | Remaining page UX, trust, advocate scoring, responsive/accessibility | 11–21 d |
| 3 | `4a`–`4f` | Performance optimization, measurement, and percentile gate | 5–11 d |
| 4 | `5a`–`5f` | Remaining financial/workbook proof | 9–19 d |
| 5 | `6a`–`6f` | Release operations, support, privacy, and known limitations | 3.5–6.5 d |
| 6 | `7a`–`7f` | Monetization-ready policy and architecture foundation; no billing activation | 5–10 d |
| 7 | `8a`–`8f` | Freeze, complete exact-candidate evidence, score, and READY verdict | 3.5–7 d plus fixes |
| 8 | `9a`–`9e` | Supervised cohort, go/no-go, and separately approved Central Beta promotion | 2–3 active d plus 5–7 calendar d and fixes |

The arithmetic sum is intentionally not the delivery forecast because Groups
6–7 and parts of Groups 3 and 5 can advance during runtime waits. The optimized
capacity forecast is **34–50 focused working days best case** or **47–74
conservatively**, plus the five-to-seven-day cohort and defect contingency. The
Wave 1 finished ahead of the buffered August schedule, but the 2026-09-24 target
remains at risk until the Activity correction foundation is implemented and
measured and the remaining accessibility findings close; dates remain gates,
not promises.

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
| 1d | Skip and Stop-tracking safety evidence (`REG-024`) | **Complete 2026-07-27 on isolated `@206`.** Populated V6 passed 17/17. Skip confirms no payment/future recurrence consequences, a missing Cash Flow row falls back only to an active-bill-gated occurrence marker, monthly dismissal persists, stale Bills responses cannot restore the card, stale Stop fails closed, valid retry preserves the inactive source row/history, and exact Skip/deactivate Activity counts plus Trash cleanup are verified. | Complete |
| 1e | Retirement guidance runtime proof (`REG-025`) | **Complete 2026-07-27 on isolated `@211`.** First-Run V6 passed 12/12 and Populated V7 passed 18/18. Missing-DOB guidance hid results; the seeded Base scenario revealed age, scenario cards, goal, funded result, and analysis. Stale fixed row numbers were replaced by label-based lookup compatible with compact and legacy sheets. | Complete |
| 1f | Guarded unattended browser-suite orchestration (`REG-022`) | **Complete 2026-07-27 on isolated `@201`.** The agent keeps a dedicated authenticated `cashcompass2026@gmail.com` session and opens guarded self-starting routes directly; no account chooser, email parameter, or workbook ID is used. First-Run passed 11/11 and Populated passed 14/14 with Restricted single-owner fixtures and verified Trash cleanup. Expired Google authentication remains the only human pause. | Complete |

**Group 1 open estimate: 0 focused days.**

## 2. Bills and daily-task completion — complete

`2a`–`2f` are closed. `2d` / `2e` were originally estimated at **1–2 focused
days** before source inspection. Measured implementation and local verification
were approximately **0.5 focused hour** because both underlying writers already
had the correct behavior; the work reduced to precise language, existing-suite
regressions, and bounded visual confirmation. Exact-candidate Central replay is
retained in the final release evidence wave rather than keeping these
implementation items artificially open.

**Estimation calibration:** audit-first language/cosmetic items that reuse an
existing component and regression home should begin at **1–3 focused hours**.
Deployment queues, authentication pauses, and external visual review are tracked
as elapsed validation time, not engineering effort. Increase the estimate only
when the audit finds a behavior, schema, financial, or cross-workbook change.

**Group 2 open estimate: 0 focused days.**

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
| P2 | Quick Add duplicate/update behavior was vague | `2d` | **Closed in `168a49b` as `REG-026`;** Dashboard UX locks cumulative add-not-replace copy and cross-checks the production writer; bounded presentation confirmed |
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
| 5h | End-to-end operation envelope and immutable correction contract | **Complete in commit `d040a34`.** Persist the existing Quick Add operation identity as a shared server-generated `operationId`; give each Activity row an `eventId`; record versioned operation type, authorized workbook/actor identity, logical target descriptors, and normalized before/after state; preview rejects legacy/forged/changed/cross-workbook state. No Activity column/schema migration. Isolated `@214` Populated V8 passed 19/19. | Measured within the one-day cap |
| 5i | Direct Cash Flow correction | **Implementation, product review, and guarded isolated runtime validation are complete; Git approval remains.** Activity supports **Change amount** and **Remove entry** for explicitly identified direct Quick Add operations. A locked server coordinator reconstructs the verified operation sequence, preserves later active entries, restores optional credit-card effects, writes immutable correction evidence, blocks retries, and refuses linked/legacy/externally changed operations. The same correction language and immutable-history model now covers eligible Donation operations. Clean isolated `@240` run `FR-d75843e0-486e-4faa-8967-05ee40b73e25` passed 21/21, including cash/card/donation change and removal, newest/middle/earlier/post-correction replay, same-page refresh, zero browser errors, and verified Trash cleanup. | Measured within the original 1–1.5 d estimate |
| 5j | Bill occurrence correction | One operation ID links Manual Pay money and occurrence evidence; Skip and AutoPay record exact prior/new state; Bills Due recognizes an immutable reversal without duplicate amounts or stranded/silently active markers | 2–3 d |
| 5k | Upcoming correction | The payment operation ID links `quick_pay` to stable `upcomingId`; payment and remaining-balance/status changes correct together; ordinary add/update/dismiss edits route to Upcoming | 1–2 d |
| 5l | House Expense compound correction | The operation envelope captures the existing exact House row fingerprint plus the optional Quick Add receipt; both targets preflight and correct together or not at all | 1–2 d |
| 5m | Entity/audit disposition plus permanent evidence | Entity lifecycle rows route to their owning Update/Manage workflow; Planner/email/import audit rows expose no reversal; every supported family receives client/server regression and guarded disposable-workbook runtime proof | 0.5–1 d plus integrated runtime |

**`5h` one-day checkpoint — 2026-07-28:** the additive Details envelope,
server-owned Quick Add operation ID, per-row event ID, opaque actor/workbook
scope, Cash Flow/Debt target snapshots, legacy/audit-only classification, and
read-only exact-state preview are implemented as `REG-029`. The full local suite
passes. Isolated Central `@214` Populated V8 run
`FR-dbe0482c-0c10-47c7-8189-109be59be6a4` passed 19/19 in 239.225 s, including
the operation-envelope assertion and strengthened server-verified Bill stale
rejection; it recorded no browser errors and verified Restricted sharing plus
exact-fixture Trash cleanup. No correction writer or Activity UI action exists
yet. Git commit/push remain the approval checkpoint. The measured foundation
supports the existing **7–12-day** `5h`–`5m` program estimate; rebaseline again
after `5i` measures the first immutable correction writer.

**`5i` runtime checkpoint — 2026-07-28:** the full local regression suite
passed. Isolated Central `@216` first proved the new writer 19/19; final
user-facing wording was then changed from **Corrected** to **Reversed** and
locked by UI regression. The exact final `@217` run
`FR-558cd995-c4c2-4770-a82f-774b6318d1ab` passed 19/19 in 266.627 s, including
exact prior-value restoration, immutable reversal evidence, retry refusal, zero
browser errors, Restricted single-owner sharing, and verified Trash cleanup.
Beta stayed `@106`; no bounded, mapped-user, configured-default, Golden, or
administrator workbook was a writer target.

The user's first manual `@217` replay then exposed `REG-031`: reversal completed
financially, but the correction loader remained visible and the Quick Add
late-write monitor treated the intentional restored value as an external
overwrite. The contained UI fix explicitly hides the loader, changes the
success heading to **Entry reversed**, and retires only that operation's browser
receipt before refresh while suppressing any in-flight reintroduction.
Permanent local and Populated Dashboard browser coverage now locks this state;
Final unchanged `@218` replay `FR-34e460e8-9421-47f8-a59f-9f3319070483`
passed 19/19 in 187.193 s. Its Activity assertion explicitly verified that the
spinner stopped and the expected-reversal warning was retired; Refresh, zero
browser errors, Restricted sharing, and verified cleanup also passed. The
earlier 18/19 `@218` diagnostic run had already passed the correction assertion
but hit one Refresh timing failure; the unchanged replay closed that as a
timing flake rather than a product regression.

Further manual `@218` use exposed three feedback defects without changing the
underlying corrected money state: `REG-032` leaked a physical worksheet name in
prior-month preview copy; `REG-033` let an obsolete first-write verification
warn against a valid second cumulative Quick Add; and `REG-034` omitted the
verified current values from correction success. The contained fixes execute
all prior-month failure branches with customer-safe copy, reconcile late
verification responses only against current receipts, and render the reversed
amount plus before/current values for Cash Flow and optional card impacts. The
full local suite passes and only isolated Central has advanced to `@219`.
Guarded run `FR-51f648de-a039-4426-85a9-08d2dee1eac1` passed 19/19 with
Restricted single-owner sharing and verified fixture Trash cleanup. Exact user
replay remains required before `5i` closes.

The next manual sequence replay exposed four deeper reliability gaps:
`REG-035` allowed only the newest operation to be corrected because later valid
Quick Adds changed the shared cell; `REG-036` allowed one eventually-consistent
read to flash a false yellow warning; `REG-037` kept **Saving…** blocked on
presentation-only history reads; and `REG-038` derived dates from auto-parsed
Activity cells. The corrected coordinator verifies and replays the complete
operation ledger while excluding only the selected entry, so newest, middle,
earlier, and post-correction Quick Adds remain independently correctable.
Warnings require the same mismatch twice, presentation history loads quietly
after the authoritative write, and immutable target locators supply concise
dates/months. Full local regressions pass. Isolated Central `@221` guarded run
`FR-5490cb51-aea7-4538-b756-6fb866f60d1c` passed 19/19 in 218.515 s, including
the expanded sequence assertion, zero browser errors, Restricted single-owner
sharing, and verified exact-fixture Trash cleanup. Beta remained `@106` and no
bounded workbook was used. Exact user replay and Git approval remain the `5i`
checkpoint.

The user's next exact replay found `REG-039`: the server correctly removed the
middle `$25`, but the browser still held the later `$50` receipt whose expected
cumulative value predated the reversal. Returning to Activity compared that
stale expected total with the valid corrected total and showed a yellow warning.
Correction completion now retires every receipt for the corrected Cash Flow
target and suppresses their in-flight responses while leaving unrelated
receipts intact. The browser evidence now uses the real later-entry snapshot
from the guarded sequence and corrects newest, middle, earlier, and a
post-correction entry. Isolated `@223` run
`FR-f78afc2b-7807-4d72-83b1-b30ea398062f` passed 19/19 in 213.270 s with the
same-target warning closed, zero browser errors, Restricted single-owner
sharing, and verified Trash cleanup. Beta remained `@106`; bounded remained
untouched.

**Final `5i` closure checkpoint — 2026-07-29:** the correction surface now
offers the two customer intents directly: **Change amount** or **Remove entry**.
Expense amounts display as positive customer amounts while the internal signed
Cash Flow representation remains unchanged. Cash, created-row, credit-card, and
Donation corrections preserve immutable history and expose current values
without workbook terminology. After the user approved the final compact layout,
the unchanged isolated Central `@240` source passed clean run
`FR-d75843e0-486e-4faa-8967-05ee40b73e25` **21/21** in 383.006 s. The operation
envelope, full direct Quick Add sequence, linked credit-card impact, Donation
change/remove flow, Bill safety, refresh state, language, and clean-console
assertions all passed. Sharing was Restricted to one owner and the exact marked
fixture was verified before Trash cleanup. One earlier clean attempt stopped on
Apps Script HTTP 0; its exact fixture was also verified and trashed before this
fresh passing run. No bounded, mapped-user, default, Golden, Beta, or
administrator workbook was used by a writer.

**Group 5 estimate: approximately 12–23 focused days.** This includes **7–12
days** for the operation-identity/correction program and integrated runtime
validation. Generic one-click reversal of
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

- **Best case:** approximately **34–50 focused working days**. The narrower
  post-audit Activity range creates contingency inside this planning envelope;
  do not trade that margin for a weaker architecture. Rebaseline again when
  `5h` replaces the estimate with measured implementation evidence.
  Several page passes can still close through audit, and operations/business
  foundations can run alongside runtime waits.
- **Conservative case:** approximately **47–74 focused working days**.
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

`5h–5m → 3a–3k/3m → 4a–4f → 8a–8f → 9a–9e`

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
| Completed through Jul 27 | `1a`–`1f`, `2a`–`2f`, `5g`; `REG-028` appended-row safety | `3d`, `3l`; shared tracked-editor convergence, Overview trust, Quick Add/Dismiss language | — | Wave 1 and daily-task language are closed; commit `168a49b` is on `origin/main`; exact-candidate replay remains part of the final evidence wave; Beta stays `@106`; bounded remains user-controlled |
| Aug 21–27 | Begin `5h`; advance `5i` only after the shared identity/precondition contract closes | Audit `3a`, `3b`, `3m`; collect diagnostic performance evidence without starting the final campaign | Start `6a`–`6f`, `7a`–`7b`, cohort design | Durable Activity correction foundation is measured |
| Aug 28–Sep 3 | `5j`–`5m` | Advance Group 5 matrix/recovery proof | `7c`–`7f`, known limitations, support posture | Supported Activity correction families and audit-only dispositions pass |
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
