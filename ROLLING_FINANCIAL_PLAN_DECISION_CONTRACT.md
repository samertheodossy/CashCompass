# Rolling Financial Plan — RFP-1 Decision Contract

**Status:** RFP-1/RFP-2 decisions complete; RFP-3 architecture approved; RFP-3b preview policy implemented for review

**Date:** 2026-08-14

**Runtime impact:** None. This document does not change a workbook, schema,
writer, calculation, UI, feature flag, Apps Script deployment, or user data.

## Objective

Build a comprehensive household plan that accounts for current obligations,
protected cash, and every active remaining debt while deliberately funding
**Samer Robinhood** into the family's long-term income pipeline. Reuse
CashCompass as the current household source of truth and preserve Rolling Debt
Payoff as the detailed debt engine.

The base Rolling Financial Plan must work at account level. Security holdings
and tax lots are later optional analysis layers, not prerequisites.

## Approved decision-engine architecture

**Approved 2026-08-14:** CashCompass owns the financial decision path
deterministically. Application code—not an LLM—must build the household input
snapshot, enforce constraints, calculate balances and economic effects, rank
eligible actions, allocate dollars, calculate counterfactuals, and reconcile
every result. Identical authoritative inputs and policy settings must produce
identical ordered actions without requiring an LLM.

RFP-3 introduces an in-memory **Capital Allocation Queue** with two explicit
classes:

1. **Hard constraints and required actions** — protected/earmarked cash, urgent
   obligations, taxes, property requirements, and every required debt minimum.
   These are eligibility and safety boundaries; they cannot lose to a scored
   discretionary candidate.
2. **Discretionary allocation candidates** — named extra-debt payments,
   reserve restoration, Income-Producing Account funding, other approved family
   investing, or intentionally holding cash. Each candidate carries its source,
   target, maximum usable amount, timing, expected benefit, guaranteed versus
   uncertain character, tax/liquidity/cash-flow effects when supported, risk,
   reversibility, confidence, and source provenance.

The queue is a runtime read model, not a new recommendation worksheet. RFP-3
does not persist recommendations or mark them completed. RFP-4 makes **This
Week** the center of the feature-guarded Planning experience and adds **Why
not?** comparisons. Those comparisons use backend-calculated counterfactuals;
an optional LLM may explain validated facts, assumptions, recommendations,
warnings, and scenarios, but may not invent inputs or silently change amounts,
eligibility, ranking, or action order.

### RFP-3a implementation boundary

RFP-3a establishes the read-only deterministic seam before policy is enabled.
It returns canonical household facts, provenance-backed data-quality findings,
hard constraints/required actions, and stable discretionary candidates. Every
discretionary candidate is explicitly `UNRANKED` with `rank = null` and
`allocatedAmount = null`; reconciliation reports zero allocated dollars and
unchanged available cash. Missing APR, unscheduled income receipt dates, or an
unreconciled tracked-bill occurrence blocks later allocation rather than being
silently estimated. Ranking, dollar allocation, ordered weekly actions,
counterfactuals, and the This Week UI remain later reviewed increments.

### RFP-3b read-only Planning boundary

RFP-3b adds a deterministic weekly allocation kernel and an integrated,
read-only **This Week** experience under Planning. This Week is the default
Start Here view, with Next Actions retained under Do now beside Rolling Debt
Payoff. Its visible V1 order is:
required household actions; a rolling 90-day operating reserve; the user-defined
$500 weekly Samer Robinhood `POLICY_FLOOR` unless an explicit liquidity or
solvency override is active; account-buffer
restoration; serial extra principal by descending APR; confirmed account-scoped
Income-Producing funding pace; then explicitly held cash. Every active positive-balance debt remains visible even
when it receives $0 this week.

The plan uses current deployable cash and counts no forecast income unless an
authoritative receipt amount is available for the week. Missing income timing
therefore remains visible as a warning but does not inflate cash or block a
current-cash-only plan. Tracked Bills reuse the production recurrence and
handled-occurrence logic through an explicit no-write option. Variable Bills
use their saved estimate as a protected required amount and remain visibly
labeled as estimates; only a variable Bill with no usable saved estimate blocks
allocation. Required-payment shortfalls and missing APRs also fail closed. Extra principal is capped after any same-week
minimum payment so a debt cannot be overpaid.

The 90-day operating reserve includes recorded Bills, debt minimums, Upcoming
expenses, and an irregular-property contingency after the current seven-day
window, offset by estimated recurring
income. Future income reduces
the reserve estimate but is never added to current deployable cash and cannot
reduce protected cash below one month of the 90-day scheduled outflows. Variable
Bills use saved estimates; missing estimates fail closed. Debt minimums already
represented by active tracked Bills are counted once, including configured name
aliases. An explicitly saved $0 estimate is valid, and episodic healthcare costs
may remain $0 until an Upcoming expense or saved estimate records an expected
visit. Recurring gross rent is the property-income input. Bills, linked debt
minimums, and Upcoming expenses own scheduled mortgages and property costs once.
Trailing House Expense history contributes only Repair, Maintenance, Appliance,
and Other contingency, and matching planned Upcoming costs reduce that allowance.
HOA, management, insurance, utilities, tax, cleaning, and warranty history is
excluded from the contingency because scheduled sources own it. Aggregate
Property Performance net cash flow is analytics only and is not another reserve
input.

The twelve normal-policy Robinhood contributions remain disclosed separately
in the forecast. They do not inflate the solvency floor and may be temporarily
paused only when required bills/debt minimums cannot be covered, projected cash
would be negative, the hard operating floor would be breached, or an explicitly
configured emergency is active. Higher APR alone is not an override. The monthly
card aggregates only the actions in the current weekly ledger and
is labeled `CURRENT_WEEK_ONLY`; it does not fabricate future paydays or income.
The plan writes no recommendation, transfer, payment, trade, Cash Flow value,
or Activity row. It is part of the same common dashboard source and requires no
alternate URL or feature-specific deployment.

Every current action carries recommendation state `PROPOSED`. Any calculated
debt reduction, released minimum payment, interest benefit, or next-period
allocation remains `AWAITING_CONFIRMATION` until refreshed authoritative
workbook balances reflect the action. `CONFIRMED` is reserved for observed
facts, and `SUPERSEDED` for an older proposal replaced by a newer plan. The
read-only V1 does not persist a recommendation history or infer completion from
the proposal itself. Its conditional next plan reranks Robinhood, the highest
remaining debt, and additional liquidity only after the refresh boundary.

Recurring investment contributions are not household Bills. Samer Robinhood's
$500 weekly amount is a distinct user-defined `POLICY_FLOOR`, not an ordinary
bill or optional acceleration. A scheduled Robinhood contribution fulfills it
rather than creating a duplicate. The optimizer compares only amounts above the
floor against optional uses unless the explicit liquidity/solvency override
applies. Every override remains visible with the exact violated constraint.
Policy output separates `policy_floor`, `optional_acceleration`,
`scheduled_amount`, and `recommended_amount`. Policy precedence is
ownership/hard exclusion, then Use Policy, account
buffer, Planning Role, and finally optimizer recommendation.

Delivery 1 also distinguishes three M1 decisions: stop or redirect future
funding; review an in-kind custodian transfer; and review a taxable sale and
redeployment. An in-kind transfer is not passive-income progress. Taxable-sale
recommendations return `TAX_DATA_REQUIRED` until security, account, quantity,
market value, basis, tax lots, holding period, unrealized gain/loss, and planning
status are available. No transfer, sale, or funding change is executed.

Eligible Cash Sources audits every current account's recorded balance, Use
Policy, minimum protected buffer, optimizer-eligible amount, Planning Role, and
inclusion status. An eligible positive-balance account with a $0 buffer is
prominently warned because its full balance is otherwise deployable; it is not
silently protected or reclassified from its name. Other capital decisions list
forecast free cash flow, optional contribution redirects, and blocked brokerage sources. The optimizer
maximizes sustainable household after-tax net worth, free cash flow, and passive
income rather than a brokerage balance. A proposed full payoff projects its
former monthly minimum into future allocatable cash, but that release remains
awaiting confirmation until refreshed balances show the debt at $0.

Part 1 freeze contract: Samer Ally is eligible only after its recorded
Use Policy permits use above its minimum buffer; a conflicting `DO_NOT_TOUCH`
value blocks discretionary allocation and directs the user to the Bank Manage
screen rather than being silently overridden. Children-owned Ally accounts stay
hard-excluded. The policy-floor override exposes its exact liquidity or solvency
constraint, required reserve, projected protected cash, and reserve surplus.
APR by itself is never an override; after the floor and reserve are protected,
all revolving balances rank from highest APR to lowest without a rate cutoff.
Planned property
repairs may offset overlapping history but cannot reduce unknown-property
contingency below 25% of the trailing 90-day irregular allowance. Brokerage
source rows carry their SYS - Assets row and stable-ID status; retirement and
custodial assets remain available to net-worth/allocation analysis but are not
actionable capital-source candidates.

When holdings granularity is added, the portfolio layer must answer two distinct
questions without changing the base weekly cash plan:

1. **Existing accounts:** for every position in every investment account, show
   Hold / Add / Reduce / Sell / Review, the recommended quantity or percentage,
   rationale, account context, concentration and overlap effects, and tax-data
   confidence.
2. **Samer Robinhood:** recommend an explicit target allocation by ticker or
   fund—such as QQQ, JEPI, other approved positions, and cash—with percentages
   totaling exactly 100%, contribution routing, rebalance bands, and the role of
   each holding in the long-term income pipeline.

No ticker recommendation is made from account totals alone. Sell guidance
requires, at minimum, symbol, quantity, market value, account/registration type,
cost basis or a clear missing-basis warning, unrealized gain/loss, and acquisition
or holding-period data. Recommendations must separate taxes from investment
merit and must never place or imply an automatic trade.

## Existing authoritative sources

| Planning input | Current source and reader | Contract for RFP |
|---|---|---|
| Current liquid cash | `SYS - Accounts`; `getCashToUse()` and `buildAccountCashAvailabilityModel_()` | Reuse active Cash/Checking/Savings balances, Use Policy, Priority, and Minimum buffer. Investments and credit lines are not cash. |
| Protected reserve and buffers | `SYS - Accounts` | Reuse `DO_NOT_TOUCH` current balances as protected reserve and per-account Minimum buffer for eligible accounts. Do not add a second hidden reserve constant. |
| Active debts and APRs | `INPUT - Debts`; `normalizeDebts_()` plus the canonical active-debt filter | Reuse balances, minimums, APR, due day, type, linked property, and low-rate keep-last classification. |
| Due-now obligations | Current-year `INPUT - Cash Flow`, `INPUT - Bills`, `INPUT - Upcoming`, and debt minimums through the existing Bills/Next Actions readers | Obligations are satisfied before discretionary debt or investment funding. Do not double-count debt minimums already represented as Cash Flow expenses. |
| Cash Flow anchor | Latest populated Cash Flow month on or before the current month | Preserve the existing capped anchor. A future-only month must not become current actual data. |
| Stable and variable income | Cash Flow history through Rolling Debt Payoff's classification and trailing baselines | Keep stable recurring income separate from RSU, stock sale, bonus, refund, dividend, and other variable income. Forecast values must never be labeled actual. |
| Property value and financing | `SYS - House Assets`, linked active Loan/HELOC rows in `INPUT - Debts` | Use existing current value, loan balance, and link guards. |
| Rental cash generation | Recurring Cash Flow rent plus Bills, debts, Upcoming expenses, and House Expense history | Use recurring gross rent as forecast income. Count scheduled mortgages and property costs once through Bills/debts/Upcoming; add only an irregular Repair/Maintenance/Appliance/Other historical contingency net of matching Upcoming costs. Property Performance remains analytics and is not added as another forecast ledger line. |
| Investment account identity and balance | `INPUT - Investments` history with `SYS - Assets` current mirror | Use only an active current-year account with one matching system row. Current balance is account-level; holdings are optional later. |
| Investment activity, holdings, and recurring intentions | `SYS - Investment Activity`, `SYS - Investment Holdings`, and `SYS - Investment Plans` for explicitly designated Income-Producing Accounts | Imported activity and derived holdings are facts; editable recurring plans are user intentions. `INPUT - Investments` remains the account-total authority. A plan is a requested funding pace, not proof that household cash can safely fund it. |
| Current-versus-month reporting | Current `SYS -` mirrors versus exact cells in the selected `INPUT` month | Label latest-known current values separately from exact-month ledger values and include coverage/staleness. Never imply they are the same measure. |

## Remaining gaps and completed foundations

1. **Resolved by RFP-2:** `SYS - Assets` now carries stable Investment Id and
   optional Planning Purpose. Zero, one, or many accounts can be explicitly
   designated Income-Producing; identity and purpose survive rename and
   Stop/Reactivate without changing `INPUT - Investments`.
2. **Resolved by RFP-6a and post-proof commit `529ce88`:** selected-account
   imports now provide duplicate-safe activity, derived holdings, editable
   recurring intentions, and checkpointed ticker review. Samer Robinhood is the
   current primary account, while the broader import and holdings architecture
   remains multi-account. The current standing-minimum policy resolves the exact
   Samer Robinhood account and carries its stable Investment Id into actions;
   explicit primary-role metadata remains a future rename-hardening gap.
3. **Resolved for RFP-3b:** recurring gross rent and scheduled property outflows
   now enter one forecast ledger. Aggregate Property Performance net cash flow
   is excluded from allocation, and only unscheduled historical property costs
   contribute a separate contingency.
4. Next Actions currently recommends urgent obligations and extra debt; it
   intentionally excludes investment optimization. The new decision engine
   should compose this information rather than change Next Actions in place.
5. User-confirmed recurring investment intentions can now be stored, but RFP-3
   still needs a transparent household allocation policy for competition between
   extra debt, safely affordable Income-Producing Account funding, reserve
   restoration, and holding liquidity. No plan amount is an entitlement to cash.
   Distribution policy and tax haircut remain unapproved where source data is
   insufficient. Every active positive-balance debt remains included without an
   APR eligibility threshold.
6. Latest-known system balances can legitimately differ from an exact-month
   ledger total when some current-month cells are blank. RFP must expose that
   distinction; it must not silently substitute one basis for the other.
7. Activity-derived holdings now exist for imported accounts, but current market
   prices, household-wide position coverage, look-through exposure, account
   registration/restrictions, cost basis, tax lots, and dependable distribution
   forecasts remain incomplete. Until those inputs arrive, RFP-3 may recommend
   how much to fund an Income-Producing Account but may not invent per-ticker
   routing or Hold/Add/Reduce/Sell advice.

## Approved future portfolio-analysis contract

**Approved 2026-08-13; activated only when granular data is available.**

For each account, the analysis must show current allocation, target allocation,
concentration and cross-account overlap, income contribution, tax status, and an
ordered proposed-trade list. Every holding receives one disposition:

- **Hold** — keep the existing position;
- **Add** — route new contributions to it;
- **Reduce** — sell only the amount needed to reach its target band;
- **Sell** — exit, with tax impact and replacement destination shown;
- **Review** — insufficient or conflicting data; no trade recommendation.

For **Samer Robinhood**, the allocation output must include:

- target percentage and dollar amount for every approved holding;
- percentages that reconcile to 100%;
- income, growth, diversification, and liquidity role of each holding;
- expected distribution range labeled as a forecast, never guaranteed income;
- where each new weekly/monthly contribution goes;
- rebalance tolerance and the least-tax/disruption route back to target; and
- current versus target allocation plus the exact proposed buys/sells needed.

The target is household-aware: overlapping exposure held in E*TRADE, M1,
Schwab, retirement, or other accounts must be considered rather than optimizing
Samer Robinhood in isolation. Account tax treatment and restrictions may make
different holdings appropriate in different accounts.

## Proposed household waterfall

Each step receives funds only after the preceding step is satisfied. Every
amount carries its source, as-of month, coverage, and actual/forecast label.

1. **Data readiness** — fail closed on ambiguous account identity, duplicate
   active records, missing debt APR needed for ranking, or unreconciled cash.
2. **Urgent obligations** — overdue and near-term Bills, Upcoming items, and
   required cash out.
3. **Protected cash** — apply ownership/hard exclusions, `DO_NOT_TOUCH`, account
   minimum buffers, and the 90-day operating floor before optimizer choices.
4. **Samer Robinhood policy floor** — allocate $500 every week unless an exact
   liquidity or solvency constraint requires an override. Higher APR alone does
   not qualify. Record the floor, scheduled amount, recommended amount, and any
   optional acceleration separately. A scheduled contribution satisfies this
   action once; it is never also counted as a Bill. When the override is active,
   show the recommended $0 and the exact violated constraint.
5. **Complete debt plan** — include every active debt with a remaining balance,
   preserve its required minimum/scheduled payment, and reuse Rolling Debt
   Payoff's serial extra-payment ordering. Higher APR generally ranks before
   lower APR, but no rate threshold excludes or hides a debt. A missing APR
   keeps the debt in the plan, flags its ranking confidence, and never suppresses
   its required payment.
6. **Reserve restoration** — if protected cash fell below its target, restore it
   before discretionary investment funding.
7. **Additional Income-Producing funding** — when a confirmed account plan pace
   exceeds the required $500, calculate the additional household surplus that
   can be directed to **Samer Robinhood** without missing obligations, violating
   protected cash, or omitting any debt. Show the source
   of funding, start month, monthly and annual funding pace, cumulative
   contributions, projected account balance, and progress toward the approved
   observed income production and balance growth. No artificial income target
   or target date is required.
8. **Remaining ranked debts and family investing** — show the complete rolling
   timeline for every remaining debt alongside Samer Robinhood funding. Lower
   rates may receive extra principal later than higher rates, but they remain in
   the plan until their balances reach zero.

Term-loan comparisons use a disclosed, configurable expected investment-return
range and base assumption. Revolving debt inclusion never depends on that
assumption. Debt payoff is represented as near-guaranteed avoided cost subject
to actual terms; investment return remains uncertain. The assumption is an
auditable input, not a hidden APR classification or terminal target.

### Capital Deployment Pace

The hard operating floor and preferred liquidity target are distinct. Under the
default `BALANCED` preference, the preferred target is the held hard floor plus
the maximum of: one normalized month of 90-day forecast operating outflows,
total monthly minimum payments for active positive-balance debts, or one
normalized month of property contingency. Explicit configured cushions for
income stability, cash-flow volatility, and other known events are then added.
No fixed share of debt or cash is used. `LIQUIDITY_FIRST` adds the larger of
monthly debt service or property risk to the Balanced derived cushion.
`AGGRESSIVE_DEBT_REDUCTION` uses the larger of the largest single debt minimum
or property risk, but the hard floor remains inviolable.

Only capital above the preferred target, further capped by remaining period
capacity after confirmed and awaiting-confirmation deployment, enters the
existing ranked waterfall. Unchanged facts in the same Monday-based week retain
one deterministic proposal identity. This Part 1 contract carries state and
tracking seams but does not add a persistent recommendation ledger; without
authoritative period totals the result is explicitly snapshot-idempotent rather
than proof of cross-device completion. Cash-source yield comparison remains
`CASH_YIELD_DATA_REQUIRED`.

This is advice only. No step initiates a transfer, security trade, sale, debt
payment, or Cash Flow posting.

## Approved weekly and monthly action-plan contract

**Approved 2026-08-13:** the primary output is an executable decision schedule,
not only a long-range projection.

### Weekly plan

For the current week and each forecast week in the selected planning horizon,
return an ordered list of explicit dollar actions:

1. opening available cash and cash expected during the week;
2. **Pay** — each obligation due, with date, amount, and source account;
3. **Debt minimum** — each required debt payment due that week;
4. **Extra debt** — debt account and additional principal, when affordable;
5. **Fund Samer Robinhood** — exact recommended contribution for that week;
6. **Protect/hold** — cash retained for reserve, account buffers, and upcoming
   obligations;
7. **Wait/review** — actions deferred because data, cash, or confidence is
   insufficient; and
8. ending projected cash with a reconciliation proving that opening cash plus
   inflows minus every action equals the ending amount.

Each action must show **why**, whether it is **required** or **recommended**, its
source data and as-of date, and its effect on remaining cash. A zero-dollar Samer
Robinhood recommendation must still appear with the reason funding is paused.

### Monthly outlook

Aggregate the same weekly decisions—never a separate calculation—into:

- total required obligations and minimum debt payments;
- extra principal by debt account;
- total Samer Robinhood contributions;
- protected cash and ending cash;
- each debt's starting balance, payments, interest, and projected ending balance;
- Samer Robinhood starting balance, contributions, modeled growth shown
  separately, and projected ending balance; and
- changes from the prior plan caused by new balances, Cash Flow, Bills,
  Upcoming items, or user assumptions.

The current week is based on recorded actual data plus known scheduled items.
Future weeks and months are forecasts and must be labeled as such. The plan is
recalculated when authoritative CashCompass data changes; it never marks an
action completed merely because it was recommended.

## Recommended compatibility design for RFP-2

Do not add purpose fields to historical `INPUT - Investments` year blocks. Add
an optional, current-state configuration keyed to a new stable investment record
ID, or an equivalently isolated configuration table selected during RFP-2
design. Requirements:

- existing workbooks with no new metadata behave exactly as they do now;
- designation is explicit, not inferred from the word “Robinhood”;
- zero, one, or multiple accounts can hold `INCOME_PRODUCING` purpose;
- designation records planning purpose only and does not make retirement or
  otherwise restricted funds immediately accessible;
- rename preserves the stable identity and purpose;
- Stop tracking suspends its eligibility without deleting its configuration;
- Reactivate restores that account's eligibility without affecting other
  designated accounts;
- all changes are guarded, auditable, and rollback-capable;
- no global rollout flag controls a household's choice: missing workbook
  metadata is the natural unconfigured state, and Setup / Review changes it
  only after an explicit Save or Clear action.

## Product decisions for the RFP program

| Decision | Recommended starting rule | Why approval is required |
|---|---|---|
| Income-Producing Accounts — **approved 2026-08-13** | Explicitly designate zero, one, or multiple investment accounts intended to grow and produce long-term income, including **Samer Robinhood** and potentially retirement accounts such as the 401(k). Persist every designation by stable ID; never infer purpose from a name or account type | The long-term income strategy can span several accounts. Each identity must survive rename and Stop/Reactivate, while later recommendations separately respect taxes, liquidity, retirement access, and withdrawal restrictions. |
| Debt inclusion and ordering — **approved 2026-08-13** | Include every active account with a remaining debt balance. Preserve minimum/scheduled payments for all; rank extra principal continuously, generally higher APR before lower APR, with deterministic tie-breakers. Use **no APR threshold** | The plan must be comprehensive. Interest rate affects priority, not whether a debt is accounted for. |
| Decision cadence and output — **approved 2026-08-13** | Produce an ordered weekly dollar-action plan and a monthly aggregation from the same decisions: pay obligations, pay debt minimums, apply named extra principal, fund Samer Robinhood, protect cash, and defer/review when necessary. Reconcile cash after every action | The product must answer what to do now, not only show an eventual balance projection. |
| Deterministic decision kernel and Capital Allocation Queue — **approved 2026-08-14** | Application code owns household context, hard constraints, candidate generation, ranking, allocation, counterfactual math, and exact reconciliation. The queue is an in-memory read model and separates required actions from discretionary candidates | Financial recommendations must be reproducible, auditable, testable, and usable without an LLM. Required reserves or obligations cannot lose to an opaque score. |
| This Week and Why not? — **approved 2026-08-14** | Make This Week the center of the feature-guarded Planning experience. Compare alternatives through deterministic backend counterfactuals; an optional LLM explains validated results but cannot alter calculations or order | The product should tell the user what the next dollar should do and directly explain why a competing use ranks lower. |
| Protected cash | Reuse `DO_NOT_TOUCH` balances + eligible account Minimum buffers + planned-cash holds; no second fixed reserve | This preserves the existing account policy model and avoids double protection. |
| Recurring contribution | Treat **$1,100/week** as a forecast assumption only until confirmed in the account-and-ticker plan model. Confirmed active plans are user intentions and cap/request the desired pace; RFP-3 may recommend less when household constraints require it. Actual funding comes only from recorded transactions | A planned amount must remain distinct from both safely affordable funding and completed activity. |
| Growth and income tracking — **approved 2026-08-13** | Use no artificial income goal, balance target, or deadline. Track what Samer Robinhood actually produces as it grows: recorded contributions, withdrawals, distributions/interest, balance change, and—when holdings data is available—market gain/loss separately. Show trailing production and clearly labeled projections without judging progress against an invented target | The purpose is to observe and improve the account's developing income pipeline, not force it toward a speculative goal. |
| Distribution policy | Report recorded reinvested and withdrawn distributions separately when the source data supports that distinction. Until then, do not infer whether distributions were reinvested or spent | Reinvestment behavior cannot be derived safely from account balance alone. |
| Rental funding | Use trailing monthly **net** rental cash flow after operating expenses and linked loan payments; require adequate coverage before forecasting | Gross receipts overstate deployable household cash. |
| Tax treatment | Show pre-tax recommendation initially and apply no invented tax rate; optional tax-lot analysis comes later | Tax effects depend on account type, holding period, basis, and jurisdiction. |

## RFP-2 non-regression test contract

Before implementation is accepted, static and disposable tests must prove:

1. feature off and missing metadata produce byte-for-byte-equivalent legacy
   planner payloads for the protected fields;
2. two Robinhood-like names cannot be silently auto-selected;
3. every active positive-balance debt appears in the plan regardless of APR,
   and missing APR never removes its required payment;
4. changing one debt's APR changes ordering where justified but never eligibility;
5. weekly actions reconcile exactly from opening cash and inflows through every
   pay, debt, Samer Robinhood, and protected-cash decision to ending cash;
6. monthly totals equal the sum of their underlying weekly decisions;
7. a zero Samer Robinhood recommendation remains visible with its reason;
8. current/recorded actions and future forecasts are labeled distinctly;
9. rename retains the designated stable identity;
10. Stop/Reactivate suspends/restores eligibility without losing history;
11. inactive, historical-only, missing-system, duplicate, and stale records fail
   closed;
12. no investment metadata change modifies balances, history, Cash Flow, debt,
   property, retirement, or existing Rolling Debt Payoff output;
13. no writer receives a bounded, mapped-user, Golden, or configured-default
   workbook; every writer fixture is marker-verified and cleanup-verified.

## RFP-6 / RFP-7 data contract before recommendations

`RFP-6a` implements the first broker-neutral foundation behind this contract.
A Robinhood adapter previews exported activity, infers the long-term portfolio
universe from recurring buys and dividends, excludes options/unrelated/admin
rows, and saves only normalized activity tied to the selected stable Investment
Id. `SYS - Investment Holdings` is derived from that ledger. `INPUT -
Investments` remains the account-balance authority, and raw broker CSV is not
retained. Current market prices, security metadata, expense ratios,
restrictions, and tax lots remain later inputs; missing values are not invented.

`RFP-6c` productizes ingestion without changing this model. The common import
orchestrator provides format detection, entity mapping, Preview, validation,
Save, deduplication, provenance/as-of status, import history, actionable errors,
audit, and rollback. Domain adapters then map into separate authoritative
contracts for investments, bank activity, debts, bills, income, and property
valuations; a trade and a house valuation never become the same generic record.
File support never implies custody, trade authority, or permission to overwrite
authoritative data silently. Any later direct provider connection must be
independently approved as read-only and must define consent, least-privilege
scopes, token handling, revocation, retention, privacy, support, and failure
behavior before implementation.

Part 2A-3 implements the first cash evidence slice behind that direction. OFX/QFX
adapts only explicit ledger/available balances and source-effective timestamps
into protected, append-only Financial Facts after deterministic Preview. It does
not import transaction rows as income or transfers, retain the raw file, write
legacy bank balances/policies, or change Planning authority. The weekly plan
cannot claim operational currentness until revolving-debt freshness joins cash
and the combined reader switch is separately approved.

The holdings layer should accept one current row per account/position containing
at least Account stable ID, account name, account/registration type, ticker,
security name/type, quantity, price/as-of date, market value, cash, annual
distributions, expense ratio when known, and restrictions. The tax-lot layer
adds lot ID, acquisition date, quantity, cost basis, unrealized gain/loss, and
short/long-term status. Missing fields lower confidence or force **Review**; they
are never silently invented.

## RFP-1 exit assessment

The source audit, gap analysis, waterfall, compatibility boundary, and test
contract are complete. Four decisions are approved: **Samer Robinhood** is the
account the plan must deliberately fund to build the family's long-term income
pipeline, and the plan includes **every active debt with a remaining balance
with no APR threshold**; the plan produces one reconciled weekly action schedule
and monthly rollup; and Samer Robinhood is tracked by its observed growth and
income production with no artificial goal or deadline. RFP-1 remains
decision-pending for the other product decisions above. No RFP-2 implementation
should start before that checkpoint.
