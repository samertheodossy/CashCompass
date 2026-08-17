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
