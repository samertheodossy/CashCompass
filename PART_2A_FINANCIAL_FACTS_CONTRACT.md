# CashCompass Part 2A-2 — Financial Facts Foundation

**Status:** Complete on isolated Central `@357` (25/25 assertions, Provisioning/Drift PASS, verified Trash cleanup).
**Authority boundary:** Existing Part 1 domain readers remain authoritative. The normalized fact reader is shadow-only.

## 1. Purpose

This slice records versioned evidence capable of answering what a financial
fact is, where it came from, when it was true, when CashCompass observed it,
how authoritative it is, and whether it is current enough for a specific
decision. It does not import production financial data or change Planning.

## 2. Versioned evidence sheet

`SYS - Financial Facts` is a lazy, additive, append-only evidence table:

1. Fact Id
2. Stable Account Id
3. Fact Type
4. Numeric Value
5. Text Value
6. Currency Or Unit
7. Effective As Of
8. Observed At
9. Source Type
10. Source System
11. Import Run Id
12. Source Record Key
13. Authority Class
14. Verification Status
15. Verified At
16. Manual Override
17. Supersedes Fact Id
18. Reconciliation Status
19. Created At

No `SYS - Current Facts` sheet is created in Part 2A-2. Current selection is a
rebuildable in-memory projection derived from the versioned evidence table.
The projection contains no policy and is not an independent authority.

## 3. Initial fact types and value contracts

| Fact type | Value kind | Unit contract | Freshness category |
| --- | --- | --- | --- |
| CURRENT_BALANCE | Numeric | ISO currency | Highly time-sensitive |
| AVAILABLE_BALANCE | Numeric | ISO currency | Highly time-sensitive |
| ACCOUNT_VALUE | Numeric | ISO currency | Lower change frequency |
| APR | Numeric | PERCENT, PERCENT_FIXED, or PERCENT_VARIABLE | Moderate; fixed uses lower-frequency policy |
| APY | Numeric | PERCENT | Moderate |
| CREDIT_LIMIT | Numeric | ISO currency | Lower change frequency |
| MINIMUM_PAYMENT | Numeric | ISO currency | Moderate |
| NEXT_PAYMENT_AMOUNT | Numeric | ISO currency | Moderate |
| NEXT_PAYMENT_DATE | Canonical date text | DATE / YYYY-MM-DD | Moderate |
| POSITION_QUANTITY | Numeric | SHARES or UNITS | Highly time-sensitive |
| POSITION_MARKET_VALUE | Numeric | ISO currency | Highly time-sensitive |
| SECURITY_PRICE | Numeric | ISO currency | Highly time-sensitive |
| COST_BASIS | Numeric | ISO currency | Reconciliation-dependent |
| CASH_SWEEP_YIELD | Numeric | PERCENT | Moderate |
| AVAILABLE_CREDIT | Numeric | ISO currency | Highly time-sensitive |
| DISCLOSED_APR | Numeric | PERCENT, PERCENT_FIXED, or PERCENT_VARIABLE | Moderate |
| PURCHASE_APR | Numeric | PERCENT, PERCENT_FIXED, or PERCENT_VARIABLE | Moderate |
| CASH_ADVANCE_APR | Numeric | PERCENT, PERCENT_FIXED, or PERCENT_VARIABLE | Moderate |
| BALANCE_TRANSFER_APR | Numeric | PERCENT, PERCENT_FIXED, or PERCENT_VARIABLE | Moderate |
| PROMOTIONAL_APR | Numeric | PERCENT, PERCENT_FIXED, or PERCENT_VARIABLE | Moderate |
| PROMOTIONAL_APR_EXPIRATION | Canonical date text | DATE / YYYY-MM-DD | Moderate |
| DEFERRED_INTEREST_STATUS | Text | STATUS | Moderate |
| DEFERRED_INTEREST_EXPIRATION | Canonical date text | DATE / YYYY-MM-DD | Moderate |

A fact type permits exactly its declared value representation. Malformed dates,
ambiguous percentage units, and simultaneous numeric/text values fail closed.
Household policy field names are not valid fact types.

## 4. Dates and provenance

`Effective As Of` is when the value was true. `Observed At` is when CashCompass
received it. Freshness uses only Effective As Of. A July 31 statement observed
August 15 remains July 31 evidence.

Supported source types are MANUAL, FILE_IMPORT, INSTITUTION, STATEMENT,
CALCULATED, ESTIMATED, and LEGACY. Authority is separately represented as
INSTITUTION_AUTHORITATIVE, USER_VERIFIED_MANUAL, STATEMENT_DERIVED, CALCULATED,
FILE_IMPORTED, ESTIMATED, or LEGACY_MANUAL.

Legacy values preserve a real historical date when one exists. If none exists,
Effective As Of remains blank and freshness is UNKNOWN. Migration, refresh, and
row-update times are never fabricated as the date the value was true.

## 5. `DATA_QUALITY_POLICY_V1`

The centralized versioned policy defines both age thresholds and fact-specific
selection rules:

| Category | Current | Recent | Aging | Older |
| --- | ---: | ---: | ---: | --- |
| Highly time-sensitive | 0–3 days | 4–7 | 8–14 | STALE |
| Moderately time-sensitive | 0–30 days | 31–60 | 61–120 | STALE |
| Lower change frequency | 0–180 days | 181–365 | 366–730 | STALE |
| Reconciliation-dependent | 0–7 days | 8–30 | 31–90 | STALE |

These are explicit planning-policy thresholds, not claims of objective financial
optimality. Reconciliation-dependent facts also require MATCHED reconciliation
before they can be safe to act upon.

Selection is not universally freshness-first. `DATA_QUALITY_POLICY_V1` owns
named precedence tables that combine admissibility, freshness, authority,
verification, manual override, and reconciliation. For balances, a recent
verified institution fact outranks a current unverified estimate, while a
current verified manual fact outranks stale institution evidence. An explicit
verified manual override may outrank otherwise current evidence according to
the same policy table. Equal-quality conflicting values remain retained and
non-actionable.

## 6. Verification, reconciliation, and history

Verification states are VERIFIED, UNVERIFIED, REVIEW_REQUIRED, and CONFLICT.
Reconciliation states are MATCHED, SUPERSEDED, CONFLICT, REVIEW_REQUIRED, and
UNVERIFIED.

Newer evidence appends a new fact and references the prior selected fact through
Supersedes Fact Id. It does not rewrite the old value. Repeated identical
evidence uses deterministic content identity and does not append another row.
Same-effective-date, equal-quality disagreement remains a conflict instead of
being overwritten.

## 7. Decision-specific actionability

The shared service supports PAY_DEBT, FUND_INVESTMENT, SELL_SECURITY,
TRANSFER_SECURITY, PAY_LOAN, and USE_CASH_SOURCE. It evaluates only the facts
required by the requested decision and returns separate `safeToModel`,
`safeToAct`, reasons, and HIGH/MEDIUM/LOW confidence.

An unrelated stale brokerage fact does not lower debt-payoff confidence. A stale
card balance may still support approximate modeling but blocks action. A stale
position quantity blocks a security sale. A verified fixed mortgage APR can
remain usable under its lower-frequency policy while the balance is evaluated
under its own fact-level rule.

## 8. Performance and privacy

Planning-shadow requests bulk-read the fact table once, index/select in memory,
and evaluate each requested fact once. No per-account sheet scan is used.

Full account numbers, raw external IDs, connector secrets, OAuth tokens, and raw
source payloads are prohibited from fact cells, diagnostics, logs,
recommendations, and customer output. Diagnostics expose stable internal IDs or
protected hashes, fact types, status, and reason codes only.

## 9. Current authority and deferred work

Authoritative evidence today:

- Existing Part 1 domain sheets and Planning readers.
- `SYS - Financial Accounts` and `SYS - Account Source Links` for normalized identity only.
- `SYS - Financial Facts` as versioned normalized evidence written by guarded tests and the reviewed Part 2A-3 cash adapter.

Shadow-only today:

- `readPlanningFinancialFacts_` and the in-memory current-fact projection.
- Freshness, selection, diagnostics, and decision-quality evaluation over normalized facts.

Not switched in this slice:

- Revolving-debt evidence is accepted by the reviewed Part 2A-4 adapter, but
  remains shadow-only and does not replace the Part 1 debt reader.
- Plaid, OAuth, direct connectors, statement pipelines, or broad legacy migration.
- Brokerage tax lots, position reconciliation, or sell recommendations.
- Any Planning or Capital Allocation authority change.

Not safe to act upon:

- Missing, unknown-timestamp, stale, unverified, conflicting, or review-required
  evidence when the decision policy requires a current verified fact.
- Cost basis that has not reconciled to the current position quantity.

Part 2A-3 adds cash evidence and shadow comparison under
`PART_2A_AUTHORITATIVE_CASH_IMPORT_CONTRACT.md`. No Planning authority switch is
implied by either foundation.

Part 2A-4 adds revolving-debt evidence and granular readiness under
`PART_2A_AUTHORITATIVE_REVOLVING_DEBT_CONTRACT.md`. Its selected facts remain a
shadow comparison until a later, separately approved combined authority switch.

## 10. Frozen Planning checkpoint and next accuracy milestone

As of 2026-08-21, Overview and Debt are frozen, post-decision 30/90-day safety
is proven, and the Planning calculation foundation is stable. This certifies
calculation semantics, not institution-current inputs: existing manually
maintained cash and revolving-debt facts are known to be stale.

The next milestone is real customer Cash + Credit Card Import / Refresh using
this fact model. It begins shadow-only with current balances, contractual
minimums, exact due dates, applicable APRs, Effective As Of, Observed At,
freshness, provenance, and exact legacy comparison. It does not silently switch
Planning authority, execute payments, or broadly import transactions. Any
authority migration requires a later explicit checkpoint.

## 11. Canonical long-term import and financial-facts model

This document is the canonical cross-domain import/data strategy. Domain
contracts may specialize adapters, validation, and business semantics, but they
must use this shared lifecycle and must not create a parallel authority path:

`Import evidence → normalize → match stable identity → compare with existing Planning values → show differences → review/approve → establish authority → recalculate`

The first implementation slices stop before `establish authority`. Imported
facts are shadow evidence that may increase confidence and expose stale or
incorrect manual values; they do not silently overwrite Planning inputs.

Every imported or verified fact preserves, where applicable:

- stable internal account identity, fact type, typed value, and unit;
- Effective As Of and Observed At as distinct timestamps;
- source type/system, authority class, verification status, and freshness;
- protected source-record identity and import-run lineage;
- reconciliation, conflict, review, and supersession state.

Raw account identifiers, credentials, tokens, full card numbers, source files,
and raw payloads remain transient or protected under the privacy rules in §8.
They never become ordinary fact values, diagnostics, or recommendation output.

## 12. Implementation order and domain scope

The product milestone is named **Cash + Credit Card Import / Refresh**, but its
implementation order is intentionally debt-risk-first:

| Phase | Domain | Initial facts and boundary |
| --- | --- | --- |
| 1 | Credit cards / revolving debt | Current and statement balance; applicable Planning APR and separately typed component APRs; contractual minimum; due date; next payment amount; payment/statement status when supplied; credit limit/available credit; promotional APR/expiration; deferred-interest evidence; statement/effective date and provenance. A purchase or headline APR is not the optimization APR unless evidence establishes that it applies to the carried balance. |
| 2 | Bank / cash accounts | Current and available balance, account type, ownership/registration, effective date, APY/yield when supplied, and account status. Minimum buffers, Do Not Touch, custodial/restricted status, and existing eligibility policy remain authoritative protections. |
| 3 | Loans / mortgages | Principal/current balance, rate, required payment, due date, payment status, fixed/variable status, maturity, escrow, and next-payment facts for mortgages, auto, credit-union/personal, and other term debt. Required-payment protection remains separate from extra-payoff ranking. |
| 4A | Investment accounts | Account-level market value, cash balance, account type/registration, and contribution information where supplied. |
| 4B | Holdings | Security/ticker, quantity, price, market value, allocation, and distributions/dividends where supplied. |
| 4C | Tax-aware investment data | Cost basis, acquisition dates, lots, realized/unrealized gains, and wash-sale evidence. No tax-sensitive Sell/Trim recommendation is actionable before required tax evidence is current and reconciled. |
| 5 | Household domains and targeted evidence | Bills/recurring obligations, income, property, retirement, known future commitments/events, and only the targeted transaction/payment evidence needed for reconciliation. |
| 6 | Authority migration | A later explicit, domain-by-domain approval may promote qualified imported facts to Planning authority. It is not part of the first Import/Refresh implementation. |

Within Phase 5, preserve these domain rules:

- Bills cover utilities, subscriptions, insurance, HOA, taxes, tuition, and
  other recurring obligations with monthly, weekly, biweekly, quarterly,
  semiannual, annual, every-N-month, irregular-known, one-time, and supported
  custom schedules. Explicit `0.00` means known non-due/non-occurrence; an
  amount means an actual or expected occurrence; blank/Unknown means
  insufficient evidence. Prefer recurrence-derived display to artificial zero
  writes where appropriate.
- Income may include paycheck, bonus/commission, rental, dividend, interest,
  and other recurring evidence. Forecast income can improve forecasting but
  unreceived future income is never cash available today.
- Property valuation remains distinct from mortgage/loan evidence. Property
  facts may include value, rent, tax, insurance, HOA, maintenance, and other
  operating costs. Scheduled obligations are never duplicated in the
  irregular-property contingency.
- Retirement facts may include value, holdings, contributions, employer match,
  tax registration, and withdrawal/restriction metadata. Restricted retirement
  assets remain unavailable to ordinary current funding decisions unless an
  explicit future policy changes that rule.
- Tax facts may later include marginal rates, realized gains, estimated tax
  exposure, loss carryforwards, lots, and other evidence required for a
  tax-sensitive recommendation.
- Known future commitments/events may include annual insurance, property tax,
  tuition, vehicle purchase, renovation, travel, other major household expense,
  bonus, RSU vest, or similar evidence. They are explicit forecast facts and
  are not inferred automatically from unrelated transactions.

## 13. Shadow comparison and review-before-authority

The customer review unit is one fact and must show:

- existing Planning value;
- latest selected imported value;
- exact absolute/percentage difference where meaningful;
- Effective As Of, freshness, and source/provenance;
- conflict/reconciliation state and a clear review action.

Review never rewrites historical evidence. Approval may verify or reconcile a
fact, but Planning continues to use its legacy reader until a later explicit
authority checkpoint qualifies freshness/readiness and promotes that fact or
domain. Equivalent values must be source-invariant: changing the source of an
otherwise identical fact cannot change recurrence, obligation ownership,
reserve classification, pacing, or debt priority.

Long term, decision output distinguishes at least: calculated from stale or
incomplete evidence; refresh recommended before acting; ready for review; and
ready to act from sufficiently current authoritative facts. A mathematically
correct recommendation based on stale decision-critical facts is not necessarily
actionable. Larger cash/debt actions require appropriately fresh balances,
minimums, due dates, and applicable rates.

## 14. Transaction-import boundary

Broad transaction ingestion is not an initial target. Merchant normalization,
transfers, duplicates, refunds, pending items, categorization, and split
transactions create a separate evidence problem. Early Import / Refresh
prioritizes account- and statement-level facts. Targeted transaction or payment
evidence is allowed only in a separately reviewed slice where it materially
improves reconciliation, such as institution evidence that a current-cycle
required payment occurred.

## 15. Stable financial semantics and deferred optimization

Fresh evidence may change recommendation numbers; it must not change governing
financial rules. Required obligations remain first and counted exactly once;
Unknown never becomes zero; future income never becomes current cash; optional
investments are not operating obligations; account protections precede eligible
capital; reserve and pacing remain independent; Balanced does not deploy all
potential excess; avalanche ranking consumes only the paced optional budget;
recorded payment is not institution confirmation; recommendation is not
confirmation; and every result remains explainable and source-reconciled.

Credit Card Rewards & Spend Optimization, Recurring Bill Schedule & Gap
Modeling, tax-aware brokerage optimization, portfolio/income optimization,
retirement planning, property optimization, and authority migration remain
deferred. Credit-card rewards are always subordinate to revolving-interest and
debt risk.
