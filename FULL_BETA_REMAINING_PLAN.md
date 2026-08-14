# CashCompass Full Beta Remaining Plan

**Status:** Active execution inventory

**Reconciled:** 2026-08-14

**Current isolated deployment:** `@352`. The Activity-correction evidence
baseline remains isolated Central `@240`; clean Populated Dashboard run
`FR-d75843e0-486e-4faa-8967-05ee40b73e25` passed **21/21** in 383.006 s. It
includes the complete `REG-030`–`REG-039` direct Quick Add matrix plus
change-amount/remove correction for cash, credit-card, created-row, and Donation
operations; immutable correction history; replay/retry refusal; same-page value
refresh; customer-safe language; newest/middle/earlier/post-correction replay;
and same-target receipt retirement while preserving later values. Every prior
populated journey passed with zero browser errors, Restricted single-owner
sharing, and verified exact-fixture Trash cleanup. The user completed the
corresponding Central visual review, and `5i` is committed and pushed as
`16b6a8f`. Bill occurrence correction (`5j`) is deferred for a later focused
redesign. `3c`, Planning hierarchy and Debt relationships, is complete in
`7c0e2ac` through isolated Central `@293`. `3a`, loading-state consistency, is
complete in `be76bdb` through permanent regression coverage and read-only
isolated Central `@294`; `3b`,
empty/error-state consistency, is complete through permanent regression coverage
and guarded First-Run run `FR-e92641a0-2c59-45da-a90c-8b8780410f76`, which
passed 14/14 on isolated Central `@296` with Restricted sharing, zero browser
errors, and verified Trash cleanup. The final empty-Upcoming and empty-Bills
context refinements are deployed to isolated `@298`, permanently covered, and
user-verified on a fresh workbook. Source commit `3e2db4f` is on `origin/main`.
The follow-up Bill reliability fix in `433bfed` replaces native Skip
confirmation with the CashCompass drawer and makes explicit tracked Bills
authoritative over matching debt-derived Bills Due cards. Both behaviors were
user-verified on isolated Central `@299` and have permanent regression coverage.
The combined `3e`–`3i` and `3m` UX wave is runtime-complete on isolated `@325`.
Populated run `FR-51e0f9a0-0d1b-4049-9eea-36b1107a0976` passed 24/24 and
First-Run run `FR-78d9e3b6-a907-4959-bbca-db0966f623f1` passed 16/16, both with
Restricted sharing and verified Trash cleanup. `3j` remains a separate task.
Retirement scenario-load latency (`4g`) is closed on isolated Central `@328`.
Money-format consistency `3n` is closed on isolated Central `@331`. Shared
dynamic changed-column fit `3p` is runtime-closed on isolated Central `@341`;
Investments is runtime-closed on isolated `@343`. The `@352` common-source UX
cleanup removed duplicate Add actions from House, Bank, and Investment Manage
views with permanent regression coverage and owner visual approval, without
changing any writer. Houses, Income, and Bills remain under `3o`: each must show
its inactive inventory and reactivate the preserved existing identity; Houses
and Income also retain their pending Edit/Rename convergence, while Bills must
replace re-add-as-recovery with duplicate-safe Reactivate.
Beta is still `@106` and bounded remains user-controlled.

The exact-owner Performance Planner campaign is complete for source
`8aa4bf5bf58259598289d79368eea944e015d43e` on isolated Central `@318`.
Campaign `PERF-e75d61db-7f46-446b-a4cd-93c84e893a8a`, owned by Release
Readiness run `RR-18146129-6e3c-4389-8599-01cbb627b95d`, passed all 20
first/repeat pairs and all 40 Planner executions. First, repeat, and combined
p50/p95 were 12.890/16.773 s, 12.350/16.034 s, and 12.600/16.773 s against
the ratified 30/60 s budgets. All fixtures were Restricted and all 20 cleanups
were verified. The owning run recorded `SUITE-PERFORMANCE-PLANNER` as PASS,
then was intentionally finalized overall `NOT_READY` because unrelated browser
and server suites were not run; the disposable runner returned OFF. This closes
`4e` and `4f` for `@318`. A later source/deployment change makes this evidence
stale for final-candidate `8b` and requires the suite to be rerun there.

Cross-flow measurement `4d` is complete on isolated Central `@319`. Diagnostic
Populated Dashboard run `FR-47ef0c44-68c8-4cff-a745-828677acf353` passed every
browser assertion with Restricted single-owner sharing and verified Trash
cleanup. Ordinary Bank Save acknowledged in **1 ms** and completed in
**8.332 s**; 12 loaded-navigation samples measured **17 ms p50 / 18 ms p95**;
and the representative populated Overview refresh after Planner history
completed in **11.776 s**. Navigation and Overview were within their candidate
targets, while Save acknowledgement passed and Save completion exceeded the
directional **6 s** target. Follow-up V10 run
`FR-afc35e3b-77ff-4c91-88cb-88f28c55fa0f` on isolated `@322` then passed
24/24 with five Saves, Restricted sharing, zero errors, and verified cleanup.
Same-call workbook/read reuse reduced completion p50/p95 from 11.060/17.568 s
to 6.520/9.418 s. The strict 6 s budget remains a documented near-miss, but the
investigation and justified optimization are complete; only normal
frozen-candidate replay remains under `8b`.

**Last formal independent advocate score:** **8.3/10** on isolated Central
`@180`. This remains the official score until the next full scored advocate run;
the product has materially improved since that baseline.

**Broad invited-Beta decision date:** pending rebaseline after the deferred
`5j` redesign is measured. The former 2026-09-24 target and 2026-10-02
contingency boundary are historical planning references only.

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
| 4a | Optimize Dashboard formatting | Isolated `@310` `REG-056` passed 14/14 and reduced repeat `format_dashboard` from 18.303 s to 0.378 s |
| 4b | Optimize snapshot construction | Isolated `@317` `REG-057` reduced current-position construction from 5.508 s to 0.128 s and total snapshot from 13.026 s to 4.867 s with functional, sharing, and cleanup gates passing |
| 4c | Retire embedded `OUT - Dashboard` charts | Isolated `@308` preserved tabular, History, and web behavior while generated charts and support tables remained absent |
| 4e | Exact-candidate 20-pair campaign | Exact-owner `@318` campaign `PERF-e75d61db-7f46-446b-a4cd-93c84e893a8a` passed 20/20 pairs, 40 Planner executions, Restricted sharing, and verified cleanup |
| 4f | Ratify Planner budgets and close ordinary Save investigation | Planner evidence recorded `PASS` / `ACCEPT` / `budgetRatified: true` on `@318`. On `@322`, V10 run `FR-afc35e3b-77ff-4c91-88cb-88f28c55fa0f` passed 24/24 with five Saves, Restricted sharing, verified cleanup, and zero errors; completion p50/p95 improved from 11.060/17.568 s to 6.520/9.418 s. The directional investigation is closed as a substantial near-miss; the strict 6 s Save budget is not claimed passed. |
| 4d | Measure remaining release flows | Isolated `@319` diagnostic run `FR-47ef0c44-68c8-4cff-a745-828677acf353` passed with Restricted sharing and verified cleanup; Save 1 ms acknowledgement / 8.332 s completion, navigation 17/18 ms p50/p95, and populated Overview 11.776 s completion |

The at-a-glance inventory below is **open-only**. Detailed group tables retain
recently completed `5h` and `5i` as implementation history.

## 0. Highest-priority Rolling Financial Plan program

The Rolling Financial Plan is the current product priority. It uses CashCompass'
existing current household data to account for obligations, reserves, and every
active remaining debt while calculating how to fund **Samer Robinhood** to build
the family's long-term income pipeline. It composes existing capabilities; it does not replace
Rolling Debt Payoff or require security-level holdings for its base plan.

| ID | Increment | Exit evidence | Estimate |
|---|---|---|---:|
| RFP-1 | Read-only household funding reconciliation and decision contract | Audit, proposed defaults, waterfall, compatibility boundary, and test contract are complete in `ROLLING_FINANCIAL_PLAN_DECISION_CONTRACT.md`; zero or more investments may be explicitly designated as **Income-Producing Accounts**, including Samer Robinhood; every active positive-balance debt is included with no APR threshold and rate affects ordering only; remaining product decisions are pending | 0.5–1 d |
| RFP-2 | Optional account-purpose and funding metadata | Complete on isolated Central `@349`: explicit zero/one/many Income-Producing designations use stable investment IDs, survive rename and Stop/Reactivate, preserve blank legacy behavior, and do not change `INPUT - Investments`; disposable closeout passed 19/19 with verified cleanup | Complete |
| RFP-3 | Read-only recommendation engine | Deterministic weekly action schedule and monthly aggregation from the same decisions, with exact cash reconciliation, source/provenance, and confidence. Each period says what to pay, named minimum/extra debt amounts, how much to add to Samer Robinhood, what cash stays protected, and what waits; existing Rolling Debt Payoff calculations remain intact; no transfers, trades, payments, or workbook writes | 1–2 d |
| RFP-4 | Feature-flagged Planning experience | Default-off UI leads with this week, then the monthly outlook; each ordered action shows amount, reason, required/recommended status, and remaining cash. Existing Planning remains unchanged with the flag off | 1–2 d |
| RFP-5 | Disposable-workbook and isolated runtime proof | Marker-verified fixtures cover reserve shortfall, mixed APRs, net rental income, multiple Robinhood accounts, missing metadata, and legacy behavior; cleanup and environment boundaries verified | 1–2 d |
| RFP-6a | Broker activity and holdings foundation | Complete on isolated Central `@351` and owner-accepted on the bounded app: preview-first Robinhood CSV import on a selected Income-Producing account; server-side option/unrelated/admin exclusions; raw CSV is not retained; duplicate-safe normalized `SYS - Investment Activity`; derived `SYS - Investment Holdings`; opening capital, later contributions, purchases, quantities, dividends, and weekly recurring buys. `INPUT - Investments` remains the account-total authority. Robinhood's blank disclaimer footer is excluded and reported without weakening the fail-closed rule for transaction-bearing rows with no date. Run `20260814-070625-5dbc` passed both integration scenarios and 40/40 assertions in 136.0 s, with Restricted sharing, provisioning/drift PASS, verified Trash cleanup, and the runner OFF. The first owner-controlled bounded import saved 104 Samer Robinhood activities; JEPQ, QQQ, QQQI, and SPYI quantities reconciled to the later broker view after the next weekly buys and dividend reinvestment | Complete |
| RFP-6b | Holdings and target-allocation analysis | Additive position model produces Hold/Add/Reduce/Sell/Review by holding and account; household-wide concentration/overlap; and a Samer Robinhood allocation by ticker/fund (for example QQQ/JEPQ/QQQI/SPYI/other approved holdings/cash) totaling 100%, including contribution routing and rebalance bands. No recommendation from account totals alone; base weekly plan remains independent | 2–4 d after RFP-6a proof and current prices/distribution inputs |
| RFP-6c | Product data-import framework and adapter expansion | Extract the RFP-6a Robinhood path into a reusable CashCompass import framework shared by Investments, Bank Accounts, Debts, Bills, Income, Houses/valuations, and future domains. Common controls cover source detection, account/entity mapping, Preview, validation, confirmation, import history/status, provenance/as-of dates, duplicate reporting, actionable row-level errors, audit/rollback, and safe overlapping re-imports. Each domain retains its own normalized contract, business rules, permissions, and adapter registry; brokerage activity, bank transactions, balances, bills, and property valuations are not forced into one universal row schema. Robinhood is the first adapter, with E*TRADE/M1/Schwab and other approved file formats added incrementally. Preserve raw-file non-retention by default. Any future direct provider connection is a separate read-only security/privacy review and is not implied by file import | 3–6 d for common framework extraction and a second-domain proof; later adapters commonly 0.5–1.5 d each |
| RFP-7 | Tax-lot-aware sale plan | Additive lot basis makes Reduce/Sell guidance tax-aware by account, acquisition date, basis, gain/loss, and holding period. Missing basis forces a warning or Review; no automatic trade and no prerequisite for the base plan | 2–4 d after granular data |

**Compatibility gates for every increment:** one reviewed slice and one commit
boundary at a time; no broad sheet rewrite or migration; missing new metadata
means current behavior; no automatic cash transfer, security sale, or debt
payment; bounded is never a test target; and every writer test creates and
continuously verifies its own disposable workbook. `5n` is reconciled inside
`RFP-1` but closes only when its existing exit criteria pass. Houses, Income,
and Bills under `3o` are paused behind the core `RFP-1`–`RFP-5` sequence, not
removed.

## Open list at a glance

| Order | Open IDs | Workstream | Focused estimate |
|---:|---|---|---:|
| 1 | `RFP-1`–`RFP-5` | Rolling Financial Plan core, one compatibility-gated increment at a time | 4–8.5 d |
| 2 | `3o` | Resume Houses, Income, and Bills product consistency/shared lifecycle | 4–7 d |
| 3 | `3j`, `3k` | Separate accessibility closeout and frozen-candidate advocate score | 4–7 d |
| 4 | `5j`–`5m` | Deferred safe correction families and audit disposition | 4.5–8 d including integrated disposable-workbook validation |
| 5 | `5a`–`5f`, `5n` | Remaining financial/workbook proof; `5n` begins within `RFP-1` | 5–12.5 d before credited overlap |
| 6 | `6a`–`6f` | Release operations, support, privacy, and known limitations | 3.5–6.5 d |
| 7 | `7a`–`7f` | Monetization-ready policy and architecture foundation; no billing activation | 5–10 d |
| 8 | `8a`–`8f` | Freeze, complete exact-candidate evidence, score, and READY verdict | 3.5–7 d plus fixes |
| 9 | `9a`–`9e` | Supervised cohort, go/no-go, and separately approved Central Beta promotion | 2–3 active d plus 5–7 calendar d and fixes |

**Current execution decision (2026-08-13):** `RFP-1`, `RFP-2`, and `RFP-6a` are
complete. Granular Robinhood data was supplied, so the contained activity and
holdings foundation was prioritized and proven on isolated Central `@351`
before commit. It is an input foundation, not yet a Hold/Add/Reduce/Sell
recommendation engine. Continue `RFP-3`–`RFP-5` and
`RFP-6b` only through separate review, validation, and commit boundaries.
`RFP-6c` now captures the long-term product-wide import framework: the current
Robinhood workflow remains the first adapter, while shared format detection,
entity mapping, Preview/Save, provenance, import history/status, duplicate
handling, actionable errors, and later adapters for brokerages, banks, debts,
bills, income, and house valuations stay out of the current proof slice. Common
orchestration is reused without erasing domain-specific schemas and validation.
The combined `3e`–`3i`/`3m` wave,
Retirement scenario-load work (`4g`), and money-format consistency (`3n`) are
complete; `3n` source commit `d1278ef` is on `origin/main`. Hold customer-facing
release work. Debt, Bank Account, and Investment convergence are complete through
isolated `@343`; `3p` is complete on isolated `@341`; resume Houses, Income, and Bills
after the core Rolling Financial Plan. Execute `3j` afterward. Compound Activity correction
`5j`–`5m` remains a broad-Beta requirement but is deliberately deferred until
after these focused follow-ups. The exact-candidate advocate rerun `3k` occurs
only after freeze; Groups 6–7 may advance during runtime/review waits.

The arithmetic sum is intentionally not the delivery forecast because Groups
6–7 and parts of Groups 3 and 5 can advance during runtime waits. The optimized
capacity forecast is **34–49 focused working days best case** or **46–73
conservatively**, plus the five-to-seven-day cohort and defect contingency. This
conservative planning envelope is retained until `5j` measures the first
compound correction family. No current broad-Beta date is committed; evidence
gates control the decision.

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
| 3a | Finish loading-state consistency — **✅ complete** | Overview, Planner, picker, onboarding, and Admin slots use contextual shared loading states; pickers and dependent actions fail closed; stale Bank responses cannot overwrite newer state | Complete in `be76bdb` at isolated Central `@294` |
| 3b | Finish empty/error-state consistency — **✅ complete** | Standard empty, unavailable, retry, and failure patterns cover core surfaces | Complete in `3e2db4f` at isolated Central `@298`; First-Run 14/14 baseline plus fresh-workbook contextual-state confirmation |
| 3c | Planning hierarchy and Debt relationships — **✅ complete** | Debt accounts, Debt Overview, and Rolling Payoff purposes and links are understandable; Setup and Help use the current destination | Complete in `7c0e2ac` at isolated Central `@293` |
| 3e | Properties context polish — **✅ complete** | Selected property/year and Cash Flow-posting consequences passed permanent regressions and isolated browser review | Complete on isolated `@325` |
| 3f | Activity review polish — **✅ complete** | Reversible filters, active-filter feedback, and the corrected 390px date layout passed isolated browser review | Complete on isolated `@325` |
| 3g | Setup progress and next step — **✅ complete** | Required progress and one recommended next action render without performing a write | Complete on isolated `@325` |
| 3h | Help and contextual links — **✅ complete** | Common tasks precede Advanced material; Activity, Properties, and Setup expose contextual Help | Complete on isolated `@325` |
| 3i | Medium-width header and visual balance — **✅ complete** | 1024px and 390px compositions are balanced without horizontal overflow | Complete on isolated `@325` |
| 3j | Responsive and accessibility closeout | Desktop/medium/390px, keyboard, focus, programmatic control names, target size, contrast, and reduced motion pass; all visible form labels are associated with their controls | 3–5 d |
| 3k | Exact-candidate task-based advocate rerun | All eight criteria are rescored from interactive evidence; every category reaches the release path to ≥9 | 1–2 d |
| 3m | Form readiness and residual customer language — **✅ complete** | Primary actions fail closed until minimum input is valid; customer labels replace stored tokens; duplicate/obsolete guidance is removed without changing stored values or server validation | Complete on isolated `@325`; Populated 24/24 and First-Run 16/16 |
| 3n | Customer-visible money-format consistency — **✅ complete** | Normal-path finite money uses grouped `$x.xx` with signs before `$`; percentages, counts, ages, stored values, schemas, writers, and numeric-entry behavior remain unchanged | Commit `d1278ef` on `origin/main`; isolated `@331`; Populated V12 26/26 PASS under `REG-067` |
| 3o | Pre-publish product consistency and shared lifecycle | Converge Edit/Rename/Stop/Reactivate behavior and customer language across long-lived entities without partial cross-sheet migrations. One user intent gets one obvious action; internal linked-reference, rollback, and audit mechanics stay behind it. Debt is the reference implementation; Bank, Investments, Houses, Income, and Bills migrate one at a time with duplicate/stale guards, rollback, audit evidence, and guarded disposable-workbook proof. Every Stop path must expose a counted inactive inventory and Reactivate the existing preserved identity; Add must never be the recovery mechanism | Debt complete on isolated `@334`. Bank source closeout reached `@338`; runtime retry `FR-02e19b9d-9757-4847-afe0-55fd5a03be32` on `@335` passed one-save rename/restore plus Stop/Reactivate before a later unrelated correction hit `HTTP 0`, and verified cleanup returned `active: null`. Investments is runtime-complete on isolated `@343`: one Edit/Save updates name/type across INPUT and SYS under lock/rollback, Stop/Reactivate uses stable identity, and historical-only names are inactive rather than editable current accounts. Populated run `FR-ec5cf708-d20a-4bd2-a539-2a3cc139aefc` passed 26/26 with Restricted sharing, zero browser errors, verified Trash, and `active: null`; the user visually confirmed cross-sheet rename propagation. The 2026-08-14 audit found three remaining gaps: Houses filter inactive rows out entirely and lack metadata Edit/Rename plus a coordinated Reactivate writer; Income hides inactive groups and only revives an exact-name row indirectly through Add, without explicit Edit/Reactivate or distinct lifecycle evidence; Bills expose only active rows, instruct re-add instead of restoring the stopped row, and the Add writer does not establish a duplicate-safe reactivation identity. Implement Houses → Income → Bills as separate guarded slices; estimate 4–7 d |
| 3p | Shared dynamic changed-column fit — **✅ complete** | Every supported CashCompass entity add/edit/rename/value-save fits the authoritative and linked text or numeric columns it actually changes, with a 24 px rendering gutter and a 1000 px cap so current values remain readable. Covers Debt/Cash Flow, Bills/Cash Flow, Bank, Investments, Houses, and Income; manual sheet edits and unrelated non-entity writers remain outside the app-triggered contract | Complete on isolated `@341` under `REG-070`. Disposable run `20260807-154251-d5e9` passed 14/14 in 24 s, including linked text, large formatted currency, and exact-gutter assertions; fixture disposition was `TRASHED` and the runner returned OFF |

**Group 3 open estimate: 9–16 focused days, with remaining `3o` sequenced before `3j`.**

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
| P2 | Help points to `Planning → Debts` instead of **Assets & Liabilities → Debt accounts** | `3c` | Exact Dashboard UX destination, Setup handoff, three-surface cross-link, and stale-path rejection assertions |
| P2 | Several controls are below the 44px target | `3j` | Computed target-size audit at desktop, medium, and 390px |
| P3 | Setup says “2026 block,” Retirement repeats the same prerequisite, and customer-facing abbreviations remain | `3m` | Normal-path terminology and duplicate-guidance Dashboard UX assertions |
| P3 | Medium header and Setup-card density remain visually unbalanced | `3i` | Medium-width screenshot contract and task-based advocate replay |

When a fix closes a confirmed historical defect, Regression Discovery must
either map the exact failure to an existing assertion or add the next
`REG-###` entry. Broad “page loaded” coverage is not sufficient.

## 4. Performance gate

| ID | Remaining item | Exit evidence | Estimate |
|---|---|---|---:|
| 4a | Optimize Dashboard formatting | **Complete on isolated Central `@310` under `REG-056`.** Exact production-path first/repeat runs passed 14/14 functional and formatting read-back assertions with Restricted sharing and verified Trash cleanup; repeat `format_dashboard` fell from 18.303 s on `@116` to 0.378 s | complete |
| 4b | Optimize snapshot construction | **Complete on isolated Central `@317` under `REG-057`.** History/prior-month reads are shared or batched, Overview calculates only the selected retirement scenario, Income readiness reuses one Cash Flow grid, and refresh snapshots reuse Planner's same-call canonical position. Functional assertions, Restricted sharing, and verified Trash cleanup passed; current-position construction fell from 5.508 s to 0.128 s and total snapshot from 13.026 s to 4.867 s | complete |
| 4c | Retire embedded `OUT - Dashboard` charts | **Complete on isolated Central `@308`.** Six generated charts and their O:Z support tables remain absent while tabular output, History, and web-dashboard behavior remain correct | complete |
| 4d | Measure remaining release flows | **Complete on isolated Central `@319`.** Diagnostic Populated Dashboard run `FR-47ef0c44-68c8-4cff-a745-828677acf353` passed every assertion with Restricted single-owner sharing and verified Trash cleanup. Ordinary Bank Save acknowledged in 1 ms and completed in 8.332 s; 12 loaded-navigation samples measured 17/18 ms p50/p95; representative populated Overview after Planner history completed in 11.776 s. Navigation and Overview were within candidate targets; Save completion exceeded the directional 6 s target and moves to `4f` disposition/optimization. | complete |
| 4e | Run the exact-candidate 20-pair campaign | **Complete for source `8aa4bf5` on isolated `@318`.** Exact-owner campaign `PERF-e75d61db-7f46-446b-a4cd-93c84e893a8a` completed 20/20 passing pairs and 40 Planner executions; every fixture was Restricted and every cleanup was verified. Rerun under `8b` if the final candidate differs. | complete for `@318` |
| 4f | Ratify p50/p95 budgets and close ordinary Save follow-up | **Complete.** Financial Plan refresh passed its 30/60 s budgets on exact-owner `@318`. Ordinary Save V10 on `@322` passed 24/24 assertions in run `FR-afc35e3b-77ff-4c91-88cb-88f28c55fa0f`, with five samples, Restricted sharing, verified Trash cleanup, and no errors. Same-call workbook/read reuse reduced Save completion p50/p95 from 11.060/17.568 s to 6.520/9.418 s; acknowledgement p95 was 1 ms. The 6 s strict completion budget remains a documented near-miss and is not marked passed; further removal or deferral of required history, synchronization, or immutable audit work is not justified. | complete; frozen-candidate replay remains under `8b` |
| 4g | Investigate Retirement scenario-load latency | **Complete on isolated Central `@328` under `REG-066`.** Overview's authoritative selected payload now paints immediately; alternatives background-load through batched read-only, generation-guarded, persisted-selection-checked paths. Populated V11 run `FR-72b047d7-4f26-469a-9287-2bfda293023e` passed 25/25; selected/all-comparison timings improved from 8.626/13.167 s at `@327` to 0.001/5.648 s, within directional 6/15 s targets, with Restricted sharing and verified cleanup. | complete; frozen-candidate replay remains under `8b` |

**Group 4 is complete for current evidence candidates. The conditional
frozen-candidate `8b` replay remains.**

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
| 5i | Direct Cash Flow correction | **Complete in commit `16b6a8f`.** Activity supports **Change amount** and **Remove entry** for explicitly identified direct Quick Add operations. A locked server coordinator reconstructs the verified operation sequence, preserves later active entries, restores optional credit-card effects, writes immutable correction evidence, blocks retries, and refuses linked/legacy/externally changed operations. The same correction language and immutable-history model covers eligible Donation operations. Clean isolated `@240` run `FR-d75843e0-486e-4faa-8967-05ee40b73e25` passed 21/21, including cash/card/donation change and removal, newest/middle/earlier/post-correction replay, same-page refresh, zero browser errors, and verified Trash cleanup. | Measured within the original 1–1.5 d estimate |
| 5j | Bill occurrence correction | One operation ID links Manual Pay money and occurrence evidence; Skip and AutoPay record exact prior/new state; Bills Due recognizes an immutable reversal without duplicate amounts or stranded/silently active markers | 2–3 d |
| 5k | Upcoming correction | The payment operation ID links `quick_pay` to stable `upcomingId`; payment and remaining-balance/status changes correct together; ordinary add/update/dismiss edits route to Upcoming | 1–2 d |
| 5l | House Expense compound correction | The operation envelope captures the existing exact House row fingerprint plus the optional Quick Add receipt; both targets preflight and correct together or not at all | 1–2 d |
| 5m | Entity/audit disposition plus permanent evidence | Entity lifecycle rows route to their owning Update/Manage workflow; Planner/email/import audit rows expose no reversal; every supported family receives client/server regression and guarded disposable-workbook runtime proof | 0.5–1 d plus integrated runtime |
| 5n | Reporting-month and latest-known balance reconciliation | Decide and document the consumer meaning of Dashboard current totals versus exact-month ledger totals. The canonical `INPUT` ledgers are authoritative and `SYS -` sheets are mirrors; current behavior uses each active entity's latest known non-empty balance, while sheet Total rows represent one exact month. Preserve latest-known behavior unless product review chooses another explicit basis; expose month/coverage or staleness so the two totals cannot be mistaken for the same measure. Prove Bank, Investment, and House behavior with mixed-current/prior-month disposable rows and `$0.01` cross-surface reconciliation | Audit/decision plus focused implementation only if justified; estimate 0.5–1.5 d |

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

**Group 5 remaining estimate: approximately 9.5–20.5 focused days.** This includes
**4.5–8 days** for `5j`–`5m` and integrated runtime validation; completed `5h`
and `5i` are excluded. Generic one-click reversal of
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
  `5j` provides measured compound-operation implementation evidence.
  Several page passes can still close through audit, and operations/business
  foundations can run alongside runtime waits.
- **Conservative case:** approximately **47–74 focused working days**.
- **Cohort:** add **5–7 calendar days**.
- **Contingency:** add **1–2 weeks** if performance, accessibility, or cohort
  evidence exposes a material defect.

Rebaseline the calendar after `5j` measures the first compound correction
family. The strictest failed gate controls the actual decision date.

## Optimized execution model

### Critical path

The remaining work that directly controls the finish date is:

`3j → 5j–5m → 5a–5f → 8a–8f/3k → 9a–9e`

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

## Reconciled execution waves

| Window | Lane A — critical | Lane B — UX/evidence | Lane C — parallel foundation | Exit |
|---|---|---|---|---|
| Completed through Jul 31 | `1a`–`1f`, `2a`–`2f`, `5g`–`5i`; `REG-028` appended-row safety | `3a`–`3d`, `3l`; tracked-editor convergence, Overview trust, loading, empty/error, Debt relationships, and daily-task language | — | Current source is on `origin/main`; isolated Central reached `@298`; Beta stays `@106`; bounded remains user-controlled |
| Completed Aug 1 | `REG-041` styled Bill Skip and `REG-042` Bills Due authority | CashCompass drawer consistency and one-card Bill/debt presentation | — | Commit `433bfed`; user-verified on isolated Central `@299`; Beta and bounded unchanged |
| Completed Aug 5 performance gate | `4a`–`4c`, `4e`, and `4f` closed for exact source `8aa4bf5` on isolated `@318`; 20/20 exact-owner pairs passed and Planner budgets were ratified | Validation console recorded `SUITE-PERFORMANCE-PLANNER` PASS with verified cleanup | Beta stayed `@106`; bounded stayed user-controlled; runner returned OFF | Planner percentile gate is closed for `@318`; later candidate changes require an `8b` rerun |
| Completed Aug 5 cross-flow measurement | `4d` closed on isolated `@319`: Save 1 ms acknowledgement / 8.332 s completion, navigation 17/18 ms p50/p95, populated Overview 11.776 s | Populated Dashboard V9 PASS, Restricted sharing, verified Trash cleanup, and admin 4d panel confirmation | Beta stayed `@106`; bounded stayed untouched; runner returned OFF | Measurement gap closed; ordinary Save completion moves to `4f` follow-up |
| Completed Aug 6 ordinary Save follow-up | `4f` Save investigation closed on isolated `@322`: p50/p95 improved from 11.060/17.568 s to 6.520/9.418 s | Populated Dashboard V10 run `FR-afc35e3b-77ff-4c91-88cb-88f28c55fa0f` passed 24/24, Restricted sharing, zero errors, and verified Trash cleanup | Beta stayed `@106`; bounded stayed untouched; no Git commit or push yet | Strict 6 s budget remains a documented near-miss; no required Save/audit stage is weakened |
| Completed Aug 6 UX closeout | `3e`–`3i` and `3m` runtime-complete on isolated `@325` | Populated `FR-51e0f9a0-0d1b-4049-9eea-36b1107a0976` passed 24/24; First-Run `FR-78d9e3b6-a907-4959-bbca-db0966f623f1` passed 16/16; Restricted sharing and cleanup verified | Beta stayed `@106`; bounded stayed untouched; source commit `993720c` is on `origin/main` | Context, filters, Setup progress, Help, composition, readiness, and customer language close together; `3j` remains separate |
| Completed Aug 6 money-format closeout | `3n` / `REG-067` runtime-complete on isolated `@331` | Populated V12 run `FR-f7719f23-9248-41fa-9f5c-7327db963ce3` passed 26/26 with clean console, Restricted sharing, and verified cleanup | Source commit `d1278ef` is on `origin/main`; Beta stayed `@106`; bounded stayed untouched | Normal-path money is grouped `$x.xx` with signs before `$`; stored values and writers are unchanged |
| Current Rolling Financial Plan contract | `RFP-1`; reconcile existing household sources and define the financial waterfall before implementation | Produce the source map, stable Robinhood identity, decision rules, current-versus-exact-month reconciliation, missing-data report, and test matrix | No runtime change; Beta stays `@106`; bounded stays untouched | Reviewed decision contract makes the later slices additive and independently testable |
| Paused product-consistency closeout | Resume `3o` Houses → Income → Bills after core `RFP-1`–`RFP-5`; Debt, Bank, and Investments are complete through `@343`, shared fit `3p` through `@341` | Existing Debt, Bank, Investment, and `REG-070` evidence remains valid for its exact source; new House, Income, and Bill slices require their own guarded proof of counted inactive inventory, duplicate-safe Reactivate, history preservation, Activity evidence, and cleanup | Beta stays `@106`; bounded stays user-controlled | One customer intent maps to one obvious action; Add never substitutes for Reactivate; cross-sheet lifecycle remains guarded |
| Separate accessibility closeout | Complete `3j` alone | Keyboard, focus, names, target size, contrast, reduced motion, and supported-width evidence | Continue operations foundations during browser waits | Accessibility reaches its release gate without broadening the prior UX patch |
| Deferred correction return | Implement and prove `5j`–`5m` on guarded disposable workbooks | Advance `5a`–`5f` candidate matrix/recovery proof | Continue known limitations and support posture | Supported correction families are atomic; unsupported audit rows remain honest |
| Candidate preparation | Finish every remaining `5a`–`5f` prerequisite | Complete fixture, visual, accessibility, and operations evidence | Finish Groups 6–7 | Candidate prerequisites are complete before one freeze |
| Frozen candidate | Freeze `8a`; run `8b`–`8f` and advocate `3k`, including a fresh Performance replay if the candidate differs from `8aa4bf5` / `@318` | Release-blocking fixes only | Final release/rollback/support review | Exact candidate reaches automated READY prerequisites and ≥95/100 |
| Supervised cohort | `9a`–`9e` cohort, observation, go/no-go, and separately approved promotion | Final advocate check | Support the cohort | Five-to-seven-day cohort and final broad-Beta decision |

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
