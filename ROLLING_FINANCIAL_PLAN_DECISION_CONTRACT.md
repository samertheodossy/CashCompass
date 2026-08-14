# Rolling Financial Plan — RFP-1 Decision Contract

**Status:** Read-only audit complete; product decisions pending

**Date:** 2026-08-13

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
| Rental cash generation | Cash Flow rent, House Expenses, and linked Cash Flow loan payments through Property Performance | Use **net cash flow**: rent minus operating expenses minus actual linked loan payments. Gross rent alone is never available family funding. |
| Investment account identity and balance | `INPUT - Investments` history with `SYS - Assets` current mirror | Use only an active current-year account with one matching system row. Current balance is account-level; holdings are optional later. |
| Current-versus-month reporting | Current `SYS -` mirrors versus exact cells in the selected `INPUT` month | Label latest-known current values separately from exact-month ledger values and include coverage/staleness. Never imply they are the same measure. |

## Confirmed gaps

1. `SYS - Assets` has Account name, Type, Current balance, and Active, but no
   stable account ID, purpose, funding target, distribution target, or funding
   priority.
2. The approved account is **Samer Robinhood**. More than one account may contain
   “Robinhood,” so name-pattern matching remains unsafe and a later rename must
   not break the plan.
3. Property Performance provides selected-year net cash flow, while the Rolling
   planner's stable-income list treats named rent receipts as income. The new
   plan needs a monthly/trailing **net rental** projection so gross rent is not
   allocated twice or without its costs.
4. Next Actions currently recommends urgent obligations and extra debt; it
   intentionally excludes investment optimization. The new decision engine
   should compose this information rather than change Next Actions in place.
5. The system has no approved rule for the Samer Robinhood funding target,
   reinvest/distribute policy, contribution amount, or tax haircut. The debt
   inclusion rule is approved: every active debt with a remaining balance must
   be represented, without an APR eligibility threshold.
6. Latest-known system balances can legitimately differ from an exact-month
   ledger total when some current-month cells are blank. RFP must expose that
   distinction; it must not silently substitute one basis for the other.
7. Holdings, tax lots, account registration/type, distributions, fees, and
   trade restrictions are not yet modeled. Until that granularity arrives,
   CashCompass may recommend how much to fund Samer Robinhood but not which
   security to buy, hold, reduce, or sell.

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
3. **Protected cash** — `DO_NOT_TOUCH` reserve plus account Minimum buffers and
   existing near-term planned-cash holds.
4. **Complete debt plan** — include every active debt with a remaining balance,
   preserve its required minimum/scheduled payment, and reuse Rolling Debt
   Payoff's serial extra-payment ordering. Higher APR generally ranks before
   lower APR, but no rate threshold excludes or hides a debt. A missing APR
   keeps the debt in the plan, flags its ranking confidence, and never suppresses
   its required payment.
5. **Reserve restoration** — if protected cash fell below its target, restore it
   before discretionary investment funding.
6. **Income-Producing Accounts funding** — calculate the recurring and one-time
   household surplus that can be directed to **Samer Robinhood** without missing
   obligations, violating protected cash, or omitting any debt. Show the source
   of funding, start month, monthly and annual funding pace, cumulative
   contributions, projected account balance, and progress toward the approved
   observed income production and balance growth. No artificial income target
   or target date is required.
7. **Remaining ranked debts and family investing** — show the complete rolling
   timeline for every remaining debt alongside Samer Robinhood funding. Lower
   rates may receive extra principal later than higher rates, but they remain in
   the plan until their balances reach zero.

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

## Product decisions required before RFP-2

| Decision | Recommended starting rule | Why approval is required |
|---|---|---|
| Income-Producing Accounts — **approved 2026-08-13** | Explicitly designate zero, one, or multiple investment accounts intended to grow and produce long-term income, including **Samer Robinhood** and potentially retirement accounts such as the 401(k). Persist every designation by stable ID; never infer purpose from a name or account type | The long-term income strategy can span several accounts. Each identity must survive rename and Stop/Reactivate, while later recommendations separately respect taxes, liquidity, retirement access, and withdrawal restrictions. |
| Debt inclusion and ordering — **approved 2026-08-13** | Include every active account with a remaining debt balance. Preserve minimum/scheduled payments for all; rank extra principal continuously, generally higher APR before lower APR, with deterministic tie-breakers. Use **no APR threshold** | The plan must be comprehensive. Interest rate affects priority, not whether a debt is accounted for. |
| Decision cadence and output — **approved 2026-08-13** | Produce an ordered weekly dollar-action plan and a monthly aggregation from the same decisions: pay obligations, pay debt minimums, apply named extra principal, fund Samer Robinhood, protect cash, and defer/review when necessary. Reconcile cash after every action | The product must answer what to do now, not only show an eventual balance projection. |
| Protected cash | Reuse `DO_NOT_TOUCH` balances + eligible account Minimum buffers + planned-cash holds; no second fixed reserve | This preserves the existing account policy model and avoids double protection. |
| Recurring contribution | Treat **$1,100/week** as a forecast assumption only until confirmed and stored; actual funding comes only from recorded transactions | The amount came from planning discussion, not an authoritative current CashCompass field. |
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
