# CashCompass Full Beta Remaining Plan

**Status:** Active execution inventory

**Reconciled:** 2026-08-22

**Current isolated deployment:** `@353`. The Activity-correction evidence
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
changing any writer. Bills lifecycle is complete in `bb20008`, backed by the
isolated `@387` Bills suite and owner bounded review. The current House
Stop/Reactivate candidate now adds counted inactive discovery, exact
row/name-guarded Reactivate across the preserved House Values and House Assets
Active cells, Add duplicate refusal, rollback, and `house_reactivate` evidence.
The corrected candidate is runtime-proven on isolated `@391`: House Financial
Accuracy passed 2/2 scenarios and 50/50 assertions, including the 23/23 House
Stop/Reactivate lifecycle scenario; both Restricted fixtures were verified
TRASHED and the runner returned OFF. The shared CashCompass confirmation now
lives outside every workspace page, so House actions cannot remain hidden until
Cash Flow is opened. House metadata Edit/Rename remains open. The Income
Stop/Reactivate lifecycle candidate is locally complete with counted inactive
discovery, exact-row guards, Add separation, value-preserving Reactivate, and
non-monetary Activity evidence; isolated runtime proof remains.
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

## 0. Frozen Planning foundation and next accuracy milestone

The Rolling Financial Plan foundation is frozen at commit `9a6cb96`: Overview is
**FROZEN**, Debt is **FROZEN**, and the 30/90-day post-decision safety proof is
**PROVEN**. It uses CashCompass' household facts to account for obligations,
reserves, every active remaining debt, and the separately approved Samer
Robinhood policy. The foundation composes existing capabilities; it does not
replace Rolling Debt Payoff or require security-level holdings for its base
plan. The current priority is the shadow-only Cash + Credit Card Import / Refresh
accuracy milestone described below; residual RFP experience/evidence items stay
separate and do not reopen the frozen Overview/Debt checkpoint.

| ID | Increment | Exit evidence | Estimate |
|---|---|---|---:|
| RFP-1 | Read-only household funding reconciliation and decision contract | Complete in `ROLLING_FINANCIAL_PLAN_DECISION_CONTRACT.md`: accepted waterfall, compatibility boundary, required-first/exact-once ownership, explicit Income-Producing designations including Samer Robinhood, every active positive-balance debt with APR affecting order rather than inclusion, independent reserve/pacing controls, and frozen lifecycle semantics | Complete |
| RFP-2 | Optional account-purpose and funding metadata | Complete on isolated Central `@349`: explicit zero/one/many Income-Producing designations use stable investment IDs, survive rename and Stop/Reactivate, preserve blank legacy behavior, and do not change `INPUT - Investments`; disposable closeout passed 19/19 with verified cleanup | Complete |
| RFP-3 | Deterministic Capital Allocation Queue and read-only recommendation engine | Complete frozen foundation in `9a6cb96`: one canonical plan owns eligibility, ranking, allocation, exact reconciliation, required/optional separation, Balanced pacing, gross 30/90-day current-cash safety, payment-evidence audit, recommendation lifecycle, and Overview/Debt values. No LLM controls numbers or order; no transfer, trade, payment, or workbook recommendation write | Complete |

`RFP-3a` completed on isolated Central `@353`: canonical read-only facts,
blocking data-quality findings, required constraints, and an unranked in-memory
candidate queue. Run `20260814-112123-c4fd` passed 16/16 assertions in 5.7 s
with Provisioning/Drift PASS, verified Trash cleanup, and the runner returned
OFF. It allocates $0 by design; the later RFP-3b and safety slices subsequently
completed the ranking, weekly/monthly allocation, UI, and frozen proof.

`RFP-3b` is complete and owner-accepted, with final safety evidence on isolated
Central `@387` and source committed as `9a6cb96`. It adds
the pure weekly ranking/allocation kernel, exact remaining-cash ledger,
current-week-derived monthly rollup, no-write tracked-Bill occurrence reader,
and the integrated read-only Planning **This Week** experience. This Week is
the default in a single five-tool Planning selector. The retired customer-facing
Next Actions route and Setup completion resolve to This week → Overview while
the legacy backend/panel remains compatible; there is no alternate URL or
parallel dashboard. Current-cash allocation counts no unscheduled
income. A rolling 90-day operating reserve protects future Bills, debt minimums,
Upcoming expenses, and an
irregular-property contingency after estimated recurring income. Recurring
gross rent supplies the income side; scheduled mortgages and property operating
costs remain owned once by Bills, debts, or Upcoming. Only trailing
Repair/Maintenance/Appliance/Other house history, net of matching planned
Upcoming costs, contributes an additional property contingency. Future income reduces the
reserve forecast but never inflates current cash or removes the one-month
operating floor. Variable Bills use their saved
estimates as protected required amounts; only missing estimates, missing APR,
required-payment shortfalls, and reserve shortfalls fail closed.
Explicit $0 estimates and episodic healthcare periods with no scheduled cost do
not pause the plan. Active tracked-debt aliases suppress duplicate debt minimums.
The aggregate Property Performance shortfall is not a forecast input, preventing
mortgages, HOA, management, and other scheduled property costs from being
counted twice.
The default customer view uses grouped cash/plan cards, a collapsed What waits
section, and separately disclosed calculation details instead of exposing the
full internal ledger first.
RFP-3b removes recurring investment contributions represented in Bills from the
household-Bill total and shows them separately. Samer Robinhood receives a distinct
user-defined `$500/week` `POLICY_FLOOR`; a scheduled contribution fulfills rather
than duplicates it, and acceleration above the floor remains optional. A higher
APR alone never overrides the floor. An override is allowed only for an exact
liquidity or solvency violation: uncovered required bills/debt minimums, negative
projected cash, breach of the hard operating floor, or an explicitly configured
emergency. Normal future commitments remain disclosed but do not inflate the
operating reserve. Every positive revolving balance participates, highest APR
to lowest, without a payoff cutoff. Term loans remain dynamically compared with
the uncertain investment alternative using their economics.
Delivery 1 now adds a Capital Source Ladder, separates stopping M1 funding from
an in-kind transfer and from a taxable sale, blocks sales as `TAX_DATA_REQUIRED`,
shows deterministic Why-not comparisons, recomputes After Action → Next Dollar,
and releases a fully paid debt's former minimum into future cash flow. It never
performs a transfer, payment, or trade.
The current correction makes the transition explicit: weekly recommendations
are `PROPOSED`; projected payoffs, released minimums, and the conditional next
plan remain `AWAITING_CONFIRMATION` until refreshed authoritative balances
confirm them. The supported lifecycle also reserves `CONFIRMED` and
`SUPERSEDED` without adding a recommendation-history write. Eligible Cash
Sources now audits each account's balance, Use Policy, minimum buffer, usable
amount, Planning Role, and inclusion status, with a prominent warning whenever
an eligible positive-balance account has a $0 protected buffer.
The Part 1 freeze makes a Samer Ally `DO_NOT_TOUCH` mismatch a
blocking, customer-actionable policy conflict instead of silently excluding or
overriding it; children-owned accounts remain protected. Vague Robinhood safety
pauses are replaced by exact policy-floor override constraints. Explanatory APR labels
do not control behavior; all revolving debt remains in the serial payoff order.
The policy output separates floor, optional acceleration, scheduled amount, and
recommended amount. Proposed payoff effects and released minimums remain awaiting
authoritative confirmation, and open-ended passive-income milestones never stop
next-dollar optimization.
Property contingency retains a 25% unknown-repair floor after Upcoming offsets.
Brokerage rows expose stable identity status, while 401(k), retirement, and
custodial assets are retained for household analysis but removed from actionable
capital-source candidates.
No workbook recommendation write, transfer, payment, or trade was added.
A complete future-week monthly forecast and tax-lot calculations remain later
slices.

The final Part 1 pacing correction inserts a deterministic Capital Deployment
Pace between reserve protection and ranking. It preserves the $500/week Samer
Robinhood `POLICY_FLOOR`, source protections, M1 stop/in-kind/sale separation,
and the full highest-APR-first revolving avalanche. The default `BALANCED`
preferred-liquidity cushion is the maximum of one normalized month of forecast
operating outflows, current monthly active-debt service, or one normalized month
of property contingency, plus explicitly configured stability/volatility/event
cushions; it is not a fixed debt or cash percentage. `LIQUIDITY_FIRST` retains
more and `AGGRESSIVE_DEBT_REDUCTION` may retain less without crossing the hard
floor. Weekly proposal identity, confirmed/awaiting deployment deductions,
scenario comparisons, and `CASH_YIELD_DATA_REQUIRED` are exposed. Capital above
preferred liquidity does not authorize deployment by itself. The approved
calendar-month Balanced tranche is the lesser of potential excess capital and
the calculated Balanced liquidity cushion. It is a maximum, not a target,
percentage, or fixed dollar allowance, and confirmed or awaiting optional
deployment reduces its remaining capacity. Required payments do not consume the
tranche. The actual optional recommendation must also preserve required uses,
account protections, the hard reserve, preferred liquidity, and explicit
30/90-day coverage from current cash without depending on unreceived future
income. Missing cushion inputs fail closed as `PACING_DATA_REQUIRED`. Persistent
cross-device recommendation state and cash-yield economics remain later work.

**Pre-travel RFP-3 checkpoint — 2026-08-18:** the user completed bounded visual
testing and accepted the Overview and Debt presentation. Record **Overview UX:
ACCEPTED / STABLE CHECKPOINT**, **Debt UX: ACCEPTED / STABLE CHECKPOINT**, and
**Financial safety certification: PASS / COMPLETE (2026-08-21)**.
The accepted evidence is `$21,980.49` required this month, `$20,322.08` covered,
`$1,658.41` still to cover, `$41,895.78` extra payoff, `$43,554.19` remaining
monthly debt payments, `$98,712.16` current card debt, and `$55,827.97`
expected after the recommendation. The plan distinguishes `$90,117.54`
potentially available over time, `$41,895.78` recommended now, and `$48,221.76`
staged for future decisions. Required items are Southwest `$988.41` due Aug 22,
CitiAA `$270.00` due Aug 28, and Meriwest `$400.00` due Aug 28; recommended
extra payoff is Amex `$39,790.53` plus CitiAA `$2,105.25`; the projected
`$1,193.72/month` release remains conditional on confirmed Amex payoff. Treat
all values as evidence, not future constants.

**Post-decision 30/90-day safety proof — COMPLETE:** the common source now emits
one fail-closed safety packet from the canonical plan. Permanent regressions
cover account buffers and exclusions, current requirements, exact dated 30-day
and gross 90-day coverage, reserve/preferred liquidity, Balanced pacing and
staged capital, no-future-income deployment, exact source ownership,
deduplicated payment evidence, recurrence, and recommendation/confirmation
separation. Isolated Central `@387` passed 2/2 scenarios and 124/124 assertions
with Restricted Provisioning and Drift PASS; both marker-verified fixtures were
TRASHED and the runner returned OFF. The owner approved the Overview/Debt freeze
and this combined checkpoint for commit/push on 2026-08-21.

**Bounded 90-day reconciliation — PASS (2026-08-21):** Planning displayed
`$125,454.92` of gross 90-day operating obligations and a `$41,818.31`
protected reserve. These are intentionally different controls. The gross total
already includes future tracked Bills, debt minimums, Upcoming expenses, and
the net irregular-property contingency, with debt-owned Bills and scheduled
property costs suppressed from duplicate ownership. The reserve formula keeps
at least one third of gross outflows: `$125,454.92 / 3 = $41,818.31`. The
permitted forecast-income offset is therefore capped at `$83,636.61`, so
`$125,454.92 - $83,636.61 = $41,818.31`; there is no additional below-line
reserve component. Account buffers and Do Not Touch amounts remain separate
protections. Post-recommendation current cash is `$133,010.14`, producing
`$7,555.22` gross headroom and `1.06x` coverage. The deployment limiter tests
current cash against the unreduced `$125,454.92`, not the net reserve, so the
optional deployment does not rely on unreceived future income.

**Next open product milestone — customer Import / Refresh:** checkpoint
`9a6cb96` is committed and pushed. Under the combined Cash + Credit Card label,
implement revolving-debt/credit-card evidence first, then bank/cash evidence,
with balances, minimums, due dates, applicable APRs, timestamps/freshness,
provenance, and shadow comparison before any Planning-authority migration. The
canonical later order is loans/mortgages; investment accounts; holdings and
tax-aware data; Bills/income/property/retirement/known commitments plus targeted
transaction evidence; then an explicit authority checkpoint. See
`PART_2A_FINANCIAL_FACTS_CONTRACT.md → §§11–15`.

**Post-checkpoint Bills recurrence defect — FIXED / VALIDATED:** a newly added
AutoPay bill with a blank legacy `Schedule Effective Date` now derives its
creation-month floor read-only from the latest immutable matching `bill_add`
Activity row. It can no longer inherit a false prior-month overdue occurrence;
manually seeded legacy bills without creation evidence retain their prior
behavior. Isolated Central `@387` Bills Regression passed 15/15 scenarios and
123/123 assertions; all Restricted fixtures were TRASHED. The Edit Integrity
fixture retained one advisory Drift finding while its functional and
Provisioning gates passed. The runner returned OFF.

The controlling invariants are required obligations first and exactly once;
Unknown is not zero; future income is not current cash; optional investing is
not an operating obligation; account buffers and Do Not Touch cash remain
protected; reserve and pacing are independent; Balanced preserves future
optionality and never deploys all potential excess automatically; the debt
avalanche receives only the approved paced amount; recorded payment and
institution-confirmed payment remain distinct; recommendation and confirmation
remain distinct; and every result remains explainable and source-reconciled.

**Planning foundation closure:** Overview **FROZEN**; Debt **FROZEN**; 30/90-day
post-decision safety **PROVEN**; Planning foundation **STABLE CHECKPOINT**. The
completed proof certifies calculation semantics, not the currency of manually
maintained facts, which are known to be stale. The next accuracy milestone is
Cash + Credit Card Import / Refresh in shadow mode: authoritative cash and
revolving-debt balances/minimums/due dates/APRs, fact-level effective dates,
freshness, provenance, and exact comparison to existing Planning values. No
silent authority switch, payment execution, broad transaction import, or
authority migration is included; migration requires a later explicit
checkpoint. Rewards/spend optimization, recurring schedule/gap modeling,
brokerage/holdings/tax-aware optimization, and existing retirement/property/data
phases remain deferred.
| RFP-4 | Complete **This Week** decision experience and **Why not?** comparisons | Mature the integrated This Week view with amount, source, destination, reason, required/recommended status, expected benefit, liquidity/tax/risk effects when supported, confidence, and remaining cash. Why not? compares backend-calculated alternatives such as debt payment, investment funding, or holding liquidity; an optional LLM may explain validated results but cannot change their numbers or order | 1.5–2.5 d |
| RFP-5 | Disposable-workbook and isolated runtime proof | Marker-verified fixtures prove deterministic repeatability, exact reconciliation, reserve shortfall, mixed APRs, net rental income, multiple Income-Producing Accounts, missing metadata, zero-dollar investment recommendations, counterfactual comparisons, and legacy behavior; cleanup and environment boundaries verified | 1–2 d |
| RFP-6a | Broker activity, holdings, and portfolio-intention foundation | Complete on isolated Central `@351` and owner-accepted on the bounded app: preview-first Robinhood CSV import on a selected Income-Producing account; server-side option/unrelated/admin exclusions; raw CSV is not retained; duplicate-safe normalized `SYS - Investment Activity`; derived `SYS - Investment Holdings`; opening capital, later contributions, purchases, quantities, dividends, and weekly recurring buys. `INPUT - Investments` remains the account-total authority. Robinhood's blank disclaimer footer is excluded and reported without weakening the fail-closed rule for transaction-bearing rows with no date. Run `20260814-070625-5dbc` passed both integration scenarios and 40/40 assertions in 136.0 s, with Restricted sharing, provisioning/drift PASS, verified Trash cleanup, and the runner OFF. The first owner-controlled bounded import saved 104 Samer Robinhood activities; JEPQ, QQQ, QQQI, and SPYI quantities reconciled to the later broker view after the next weekly buys and dividend reinvestment. Post-proof common-source commit `529ce88` adds an account-first Portfolio activity drawer, editable recurring plans kept separate from imported facts, and checkpointed ticker review that reopens after a later purchase without retroactively importing excluded history. The owner accepted the bounded presentation; this extension is not claimed as part of the earlier isolated `@351` evidence | Complete |
| RFP-6b | Holdings and target-allocation analysis | Additive position model produces Hold/Add/Reduce/Sell/Review by holding and account; household-wide concentration/overlap; and a Samer Robinhood allocation by ticker/fund (for example QQQ/JEPQ/QQQI/SPYI/other approved holdings/cash) totaling 100%, including contribution routing and rebalance bands. No recommendation from account totals alone; base weekly plan remains independent | 2–4 d after RFP-6a proof and current prices/distribution inputs |
| RFP-6c | Product data-import framework and adapter expansion | Reusable infrastructure follows the canonical Part 2A lifecycle rather than creating a separate authority path. Common controls cover source detection, stable identity mapping, Preview, validation, shadow comparison/review, provenance/as-of dates, import history, duplicates, actionable errors, audit/rollback, and safe re-import. Domain contracts retain their own semantics and adapters. Implementation order is revolving debt → bank/cash → loans/mortgages → investment accounts → holdings/tax-aware data → household domains/targeted evidence → later authority migration. Raw files remain non-retained by default; direct connections require separate read-only security/privacy review | Enabling framework only; each domain remains a separately reviewed slice under `PART_2A_FINANCIAL_FACTS_CONTRACT.md → §§11–15` |
| Part 2A-0 / 2A-1 | Normalized contracts and stable financial identity | Complete in commit `9dc7c5a`: additive account and source-link registries cover CASH, DEBT, INVESTMENT, RETIREMENT, and PROPERTY; existing Investment IDs are adopted; owner/registration conflicts and ambiguous source links fail closed; raw external identifiers are replaced with source-scoped protected keys and masked display. Isolated Central `@356` run `20260815-115249-7301` passed 7/7 with Provisioning/Drift PASS and verified Trash cleanup | Complete |
| Part 2A-2 | Financial Facts Foundation | Complete on isolated Central `@357`: additive append-only `SYS - Financial Facts`; all 14 typed fact/value contracts; exact Effective As Of vs Observed At provenance; versioned category thresholds and fact-specific precedence under `DATA_QUALITY_POLICY_V1`; deterministic current selection; conflict preservation; decision-specific confidence/actionability; legacy UNKNOWN timestamps; idempotent supersession; bulk shadow reads and rebuildable in-memory current projection. Existing Part 1 readers remain authoritative; no Current Facts sheet, production import, OAuth/connector, tax-lot behavior, or Planning authority switch | Two scenarios passed 25/25 assertions in 18.8 s with Provisioning/Drift PASS, both marker-verified fixtures verified TRASHED, and the disposable runner OFF. Stop before production fact import/shadow authority work |
| Part 2A-3 | First Authoritative Cash Import | Runtime-proven on isolated Central `@358`: source-neutral cash evidence contract; OFX/QFX ledger/available balance adapter; protected fail-closed identity matching; per-account deterministic Preview/Apply; append-only CURRENT_BALANCE/optional AVAILABLE_BALANCE/optional APY facts; exact effective/observed time; sanitized import-run manifest; duplicate no-op; verified-manual fallback; exact-match versus difference-detected reconciliation at currency-minor-unit precision; separately versioned planning materiality intentionally remains not yet decided; freshness/actionability and `CASH_YIELD_DATA_REQUIRED` diagnostics. Existing Planning reader and every household policy remain untouched | Run `20260816-200938-c001` passed 1/1 scenario and 24/24 assertions in 23.8 s with Provisioning/Drift PASS, verified Trash cleanup, and runner OFF. Real owner Ally/Bank of America exports remain unproven until supplied; no bounded testing and no Planning authority switch |
| Part 2A-4 | Authoritative Revolving Debt Import | Runtime-proven on isolated Central `@363`: source-neutral debt evidence, OFX/QFX plus structured/manual adapters, protected identity, deterministic Preview/Apply, sanitized shared run manifest, duplicate no-op, typed APR components, carried-balance planning-APR rule, canonical date-only facts across Sheets reads, shadow comparison, and granular balance/ranking/payment/payoff readiness. Zero evidence does not release minimums; `INPUT - Debts` remains authoritative | Run `20260817-074631-0fb6` passed 1/1 scenario and 33/33 assertions in 44.7 s with Restricted sharing, Provisioning/Drift PASS, verified Trash cleanup, and runner OFF. No bounded testing, payment execution, transaction import, or Planning authority switch |
| Part 2A-5 | Data Refresh & Plan Readiness UI | Runtime-proven shadow-only candidate on isolated Central `@369`: compact Planning Overview status plus This Week → Data for actionable cash/card review, per-fact freshness, exact legacy-vs-normalized differences, granular readiness, collapsed audit details, and verified-manual carried-balance APR review. Customer states distinguish Not connected, More data needed, Needs review, and Ready for review; empty domains cannot pass as Ready 0 / 0. Proposed debt actions use recommended/expected/projected wording; completed-state language requires confirmation. Existing Planning values remain authoritative | Run `20260817-102843-e241` passed 1/1 scenario and 35/35 assertions in 29.8 s; companion Capital Allocation run `20260817-102943-17fd` passed 2/2 scenarios and 99/99 assertions in 17.3 s. Restricted sharing, Provisioning/Drift PASS, all fixtures verified TRASHED, and runner OFF. No bounded writer test, authority switch, Current Facts sheet, schema migration, or Part 1 calculation change |
| Future CC Rewards | Credit Card Rewards & Spend Optimization | Later phase after debt-data authority and debt optimization: determine cards safe for new spend, exclude or penalize likely expensive revolving spend, then rank net reward by category using multipliers, rotating categories, restrictions, promo windows, caps, fees/credits, FX fees, and point valuation. Explain the winner and allow “do not use while revolving” outcomes | Deferred. Rewards must never override debt/interest risk. No current schema, UI, or recommendation behavior |
| Future Bill Scheduling | Recurring Bill Schedule & Gap Modeling | Later phase after current Part 2A data-authority and debt work: derive period expectations for monthly, every-other-month, every-N-month, quarterly, semiannual, annual, seasonal/custom, irregular-known, and one-time expenses. Preserve `0.00` as explicitly known non-due, an amount as actual/expected, and blank/Unknown as insufficient evidence. Keep historical actuals separate from future expectations; support dates, intervals, exceptions, skips, amount changes, and optional sinking-fund planning | Deferred. Prefer rendering recurrence-derived known zeros rather than physically writing artificial zero entries. No current recurrence schema, zero-fill behavior, sinking-fund logic, or UI change |
| Future Bill Discovery | Recurring Bill & Subscription Discovery | After a proven safe transaction-level credit-card/bank import source, normalize merchant evidence, infer possible recurrence, compare it with existing Bills, and explain match/conflict/duplicate/stale-amount-or-cadence/missing-bill candidates for customer review near Cash Flow → Bills. Support Add, Link, Review/update, Ignore, Not recurring, and Review later decisions retained by stable evidence/pattern identity. Distinguish variable and periodic obligations, repeated purchases, installments, refunds/reversals, pending/posted state, duplicate imports, descriptor variations/intermediaries, and cross-account evidence; unsupported recurrence remains Unknown and absence cannot imply cancellation without adequate source coverage | Deferred and separate from account-facts Credit Card Import / Refresh Phase 1. Imported patterns are discovery evidence, never Bill authority: no silent create/edit/deactivate/reactivate or amount, cadence, due-date, AutoPay, or payment-source change. Account-level facts alone are insufficient; current import architecture should avoid unnecessarily foreclosing the later transaction-ingestion capability |
| Future Property Value Refresh | Property Value Import / AVM Refresh | After lifecycle cleanup and the core Financial Facts/import foundations, obtain supported/licensed third-party residential valuation evidence, normalize it as `AVM_ESTIMATE`, match through stable House/property identity, and show customer-reviewed shadow comparison against the current CashCompass value. Preserve provider/property ID, estimate, valuation/effective date, observed timestamp, provenance, freshness, and genuine confidence/range; keep customer value, AVM, tax assessment, sale price, and appraisal semantically distinct. Customer may Keep current, Accept estimate, or Enter another reviewed value | Deferred; does not block Income lifecycle or Credit Card Import correctness/real-source proof. No provider commitment or API dependency yet; ATTOM is a candidate for later licensed-provider assessment. Never scrape consumer sites for production automation, match by display name alone, or silently overwrite House value authority. Ambiguity fails closed; accepted changes should reuse existing House Values history while external observations retain separate evidence/provenance. Prefer on-demand or low-frequency refresh |
| Future Capital Allocation | Strategic Capital Allocation and Portfolio Growth | Continuously allocate each safely available next dollar across debt, liquidity, approved contributions, brokerage, term debt, property, retirement, taxes, and known commitments by comparing guaranteed interest avoided, uncertain return, liquidity, tax, risk, timing, and optionality. Robinhood is a current destination, not the objective. Confirmed released payments are reranked; contribution redirects, in-kind transfers, and tax-aware sales remain distinct paths | Deferred until authoritative cross-domain facts are sufficiently current. Never override obligations, protections, 30/90-day safety, tax, retirement, debt economics, or freshness. Canonical contract: `ROLLING_FINANCIAL_PLAN_DECISION_CONTRACT.md → Future north star — Strategic Capital Allocation and Portfolio Growth` |
| Future Debt Freedom | Whole-Household Debt Freedom Planner | Liability/timeline view of Strategic Capital Allocation: continuously reforecast a confidence-labeled debt-free date and phase roadmap across every liability and economically justified resource; compare More Liquidity, Balanced, Faster Debt-Free, and Custom strategies; work backward from five-/seven-year targets; roll only confirmed released payments; and evaluate HELOC/refinance, investment, property-equity, tax, and known-event tradeoffs | Deferred until authoritative cross-domain facts are sufficiently current. Debt freedom and portfolio growth are sequenced together; never improve the date by violating required obligations, liquidity, 30/90-day safety, tax, retirement, or other protections. Canonical contract: `ROLLING_FINANCIAL_PLAN_DECISION_CONTRACT.md → Future north star — Whole-Household Debt Freedom Planner` |
| RFP-7 | Tax-lot-aware sale plan | Additive lot basis makes Reduce/Sell guidance tax-aware by account, acquisition date, basis, gain/loss, and holding period. Missing basis forces a warning or Review; no automatic trade and no prerequisite for the base plan | 2–4 d after granular data |

**Compatibility gates for every increment:** one reviewed slice and one commit
boundary at a time; no broad sheet rewrite or migration; missing new metadata
means current behavior; no automatic cash transfer, security sale, or debt
payment; bounded is never a test target; and every writer test creates and
continuously verifies its own disposable workbook. `5n` is reconciled inside
the completed `RFP-1` foundation. House Stop/Reactivate is complete. Income
Stop/Reactivate is locally complete and runtime-pending as its own `3o` slice;
House metadata Edit/Rename remains a separate follow-up. Bills lifecycle is
complete. Shadow-only Cash + Credit Card Import / Refresh is
deferred until explicitly reopened, not removed. Residual `RFP-4`/`RFP-5` experience/evidence
work remains separately tracked and does not reopen frozen Overview/Debt UX.

## Open list at a glance

| Order | Open IDs | Workstream | Focused estimate |
|---:|---|---|---:|
| 1 | `3o` House metadata | House Stop/Reactivate is complete; scope Edit/Rename separately without reopening the proven lifecycle | 0.5–1 d plus fixes |
| 2 | `3o` Income lifecycle | Stop/Reactivate locally complete: counted inactive discovery, exact-row guarded Reactivate, Add separation, financial noninterference, and Activity evidence. Edit/Rename remains separately unclaimed | Isolated runtime validation pending |
| Deferred | Next Import / Refresh slice | Revolving-debt/credit-card facts first, shadow comparison/review only; then bank/cash, when explicitly reopened | Estimate only in the separately approved implementation plan |
| 3 | `3j`, `3q`, `3k` | Accessibility closeout, final cross-surface UI consistency audit, and frozen-candidate advocate score | 5–9 d plus audit fixes |
| 4 | `5j`–`5m` | Deferred safe correction families and audit disposition | 4.5–8 d including integrated disposable-workbook validation |
| 5 | `5a`–`5f`, `5n` | Remaining financial/workbook proof; preserve the completed RFP-1 reconciliation | 5–12.5 d before credited overlap |
| 6 | `6a`–`6f` | Release operations, support, privacy, and known limitations | 3.5–6.5 d |
| 7 | `7a`–`7f` | Monetization-ready policy and architecture foundation; no billing activation | 5–10 d |
| 8 | `8a`–`8f` | Freeze, complete exact-candidate evidence, score, and READY verdict | 3.5–7 d plus fixes |
| 9 | `9a`–`9e` | Supervised cohort, go/no-go, and separately approved Central Beta promotion | 2–3 active d plus 5–7 calendar d and fixes |

**Current execution decision (2026-08-14):** `RFP-1`, `RFP-2`, and `RFP-6a` are
complete. Granular Robinhood data was supplied, so the contained activity and
holdings foundation was prioritized and proven on isolated Central `@351`
before commit. It is an input foundation, not yet a Hold/Add/Reduce/Sell
recommendation engine. Post-proof commit `529ce88` adds account-first portfolio
review, editable recurring intentions, and checkpointed ticker decisions. The
next implementation is the deterministic, in-memory Capital Allocation Queue;
This Week and Why not? consume its validated outputs rather than asking an LLM
to calculate or rank actions. Continue `RFP-3`–`RFP-5` and
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
isolated `@343`; Bills is complete through isolated `@387`; `3p` is complete on
isolated `@341`; finish the House candidate, then Income. Execute `3j`
afterward. Compound Activity correction
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
| 3o | Pre-publish product consistency and shared lifecycle | Converge Edit/Rename/Stop/Reactivate behavior and customer language across long-lived entities without partial cross-sheet migrations. One user intent gets one obvious action; internal linked-reference, rollback, and audit mechanics stay behind it. Debt is the reference implementation; Bank, Investments, Houses, Income, and Bills migrate one at a time with duplicate/stale guards, rollback, audit evidence, and guarded disposable-workbook proof. Every Stop path must expose a counted inactive inventory and Reactivate the existing preserved identity; Add must never be the recovery mechanism | Debt complete on isolated `@334`; Bank through `@338`; Investments through `@343`; Bills complete in `bb20008` with isolated `@387` and owner bounded evidence. House Stop/Reactivate is runtime-complete on isolated `@391`. House metadata Edit/Rename remains separate. Income Stop/Reactivate is locally complete with Current/Add/Manage separation, counted inactive inventory, exact-row guards, Add refusal, and distinct Activity evidence; isolated runtime validation remains. Income Edit/Rename is not claimed. |
| 3p | Shared dynamic changed-column fit — **✅ complete** | Every supported CashCompass entity add/edit/rename/value-save fits the authoritative and linked text or numeric columns it actually changes, with a 24 px rendering gutter and a 1000 px cap so current values remain readable. Covers Debt/Cash Flow, Bills/Cash Flow, Bank, Investments, Houses, and Income; manual sheet edits and unrelated non-entity writers remain outside the app-triggered contract | Complete on isolated `@341` under `REG-070`. Disposable run `20260807-154251-d5e9` passed 14/14 in 24 s, including linked text, large formatted currency, and exact-gutter assertions; fixture disposition was `TRASHED` and the runner returned OFF |
| 3q | Final cross-surface UI consistency audit | After intended UI work is complete and before `8a`, compare every equivalent CashCompass surface for Current/Update/Add/Manage structure, action placement, lifecycle terminology, CashCompass confirmation treatment, loading/empty/error states, focus/keyboard behavior, and desktop/medium/390px layout. Correct each slip or document a product reason with permanent regression evidence | Required pre-freeze audit; prior page sweeps and local consistency checks do not waive it. Estimate 1–2 d plus fixes |

**Group 3 open estimate: 10–18 focused days, with remaining `3o` sequenced before `3j` and final `3q` completed before `8a`.**

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
| Completed Aug 22 House lifecycle | `3o` House Stop/Reactivate runtime-complete on isolated `@391`; House metadata Edit/Rename remains separate | House Financial Accuracy passed 2/2 scenarios and 50/50 assertions; both Restricted fixtures TRASHED; runner OFF | Beta stayed `@106`; bounded stayed user-controlled | One preserved House returns active without duplicate or history/configuration loss; Add never substitutes for Reactivate; confirmation is visible from its originating surface |
| Current local candidate | Income Stop/Reactivate lifecycle parity | Counted inactive inventory, exact-row stale/ambiguity-safe Reactivate, Add duplicate refusal, unchanged monthly values, and non-monetary Activity evidence | Local regressions complete; isolated disposable runtime validation pending; Beta stays `@106`; bounded stays user-controlled | Income reaches explicit tracking recovery without treating Reactivate as Add or creating income dollars |
| Deferred financial-facts milestone | Cash + Credit Card Import / Refresh: revolving debt first, bank/cash second, all shadow-only, only when explicitly reopened | Preserve metadata, stable identity, exact legacy comparison, customer review, fail-closed freshness, privacy, and byte/value equivalence before any authority change | No authority switch, broad transaction import, payment execution, Beta change, or bounded writer test | Reviewed slice proves current account/statement facts without switching Planning authority |
| Separate accessibility closeout | Complete `3j` alone | Keyboard, focus, names, target size, contrast, reduced motion, and supported-width evidence | Continue operations foundations during browser waits | Accessibility reaches its release gate without broadening the prior UX patch |
| Deferred correction return | Implement and prove `5j`–`5m` on guarded disposable workbooks | Advance `5a`–`5f` candidate matrix/recovery proof | Continue known limitations and support posture | Supported correction families are atomic; unsupported audit rows remain honest |
| Candidate preparation | Finish every remaining `5a`–`5f` prerequisite | Complete fixture, visual, accessibility, and operations evidence | Finish Groups 6–7 | Candidate prerequisites are complete before one freeze |
| Frozen candidate | Freeze `8a`; run `8b`–`8f` and advocate `3k`, including a fresh Performance replay if the candidate differs from `8aa4bf5` / `@318` | Release-blocking fixes only | Final release/rollback/support review | Exact candidate reaches automated READY prerequisites and ≥95/100 |
| Supervised cohort | `9a`–`9e` cohort, observation, go/no-go, and separately approved promotion | Final advocate check | Support the cohort | Five-to-seven-day cohort and final broad-Beta decision |

## Explicitly outside broad-Beta scope

- production billing activation;
- broad bank/account aggregation, provider connectivity, and transaction
  ingestion beyond the current shadow account/statement-fact accuracy milestone;
- Chat/Assistant;
- Money Plan Phase 2;
- generic reversal of legacy Activity rows whose original state cannot be proved;
- automatic external payment detection;
- other future Priority 4 features.

These items may be designed later, but their implementations do not enter the
current Beta critical path.
