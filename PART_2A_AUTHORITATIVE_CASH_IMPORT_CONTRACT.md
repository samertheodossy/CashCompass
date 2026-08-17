# CashCompass Part 2A-3 — First Authoritative Cash Import

**Status:** Runtime-proven on isolated Central `@358`; run
`20260816-200938-c001` passed 24/24 assertions with verified Trash cleanup.
**Authority boundary:** Imported cash is authoritative normalized evidence in
`SYS - Financial Facts`. Existing Part 1 bank readers remain the Planning
authority. No imported value changes a current recommendation in this slice.

## Source and adapter boundary

The normalized `CASH_EVIDENCE_V1` contract contains source system/type, a
source-scoped protected account key, masked identifier, institution, account
type, currency, typed facts, source-effective time, observation time, protected
source-record key, and adapter/version evidence. Raw files and raw account
numbers are transient and are not retained.

The first adapter accepts OFX/QFX banking statement aggregates only when an
explicit `LEDGERBAL/BALAMT` is present. `LEDGERBAL/DTASOF` is the balance's
effective time. `AVAILBAL` becomes `AVAILABLE_BALANCE` only when supplied. APY
becomes `APY` only when an explicit source field supplies it. Transaction lists
never imply a balance, APY, transfer, or income event. Ally documents QFX and
CSV activity downloads, but no real owner export was available during local
development; the adapter is therefore architecture- and fixture-proven until a
real export is reviewed. No Bank of America layout is hard-coded.

## Identity and preview

Identity matching is fail-closed in this order:

1. existing VERIFIED source link;
2. exact protected source account key;
3. explicit user-confirmed match;
4. REVIEW_REQUIRED candidate.

Institution, display name, or last four digits may identify a review candidate
but never auto-merge accounts. Explicit owner or registration conflicts stop
the account. Each source account previews independently with matched identity,
legacy and selected balance, imported balance, exact effective time, current
and resulting freshness, reconciliation difference, and one action:
`MATCH`, `ADD`, `IGNORE`, or `REVIEW_REQUIRED`. Save requires the unchanged
preview digest. A safe account may apply while another remains in review.

## Evidence apply and import manifest

Apply appends `CURRENT_BALANCE`, optional `AVAILABLE_BALANCE`, and optional
`APY` facts. It does not overwrite prior facts. Exact replays are no-ops.
`SYS - Import Runs` is a lazy append-only sanitized manifest containing only
protected fingerprints, adapter/version, timing range, counts, and status. It
contains no raw payload, token, routing number, or raw account identifier.

When the source provides no balance-effective time, Effective As Of remains
blank, freshness remains `UNKNOWN`, and the evidence is `REVIEW_REQUIRED`; the
import time is never substituted. The explicit manual fallback requires a
verified CashCompass account, value, and effective date and uses
`USER_VERIFIED_MANUAL` authority.

## Reconciliation and data quality

`CASH_SHADOW_EXACT_RECONCILIATION_V1` compares values at one currency minor
unit (`$0.01` for USD): exact equality is `EXACT_MATCH`, while every non-zero
difference is `DIFFERENCE_DETECTED` and remains fully quantified. Economic
planning materiality is separate under `CASH_SHADOW_PLANNING_MATERIALITY_V1`
and remains `NOT_YET_DECIDED` in this slice; no arbitrary absolute or percentage
threshold is invented and no discrepancy is discarded. Shadow output includes legacy value, normalized
selected value, absolute/percentage difference, provenance, effective time,
freshness, and safe-to-model/safe-to-act state. Missing yield emits
`CASH_YIELD_DATA_REQUIRED` rather than inventing APY.

The current-fact selector ranks effective evidence, not merely the most recently
imported file. Equal-quality same-effective-date disagreement is retained as a
conflict. Planning continues to use `SYS - Accounts` and existing domain sheets,
so imported cash cannot change Part 1 output yet.

## Explicit exclusions and next milestone

This slice adds no OAuth, Plaid, scraping, token storage, transaction ledger,
transfer classification, automatic transfer, Planning authority switch, debt
import, or workbook recommendation write. The weekly plan cannot be called
fully current until authoritative cash and revolving-debt freshness are both
operational and separately approved for Planning consumption.

Permanent proof lives in `scripts/checkCashImportRegressions.mjs` and the
marker-verified disposable suite
`SUITE-PART-2A-AUTHORITATIVE-CASH-IMPORT`. The bounded workbook is never a test
target. Isolated run `20260816-200938-c001` passed the suite's single scenario
and 24/24 assertions in 23.8 seconds with Provisioning/Drift PASS, its fixture
verified TRASHED, and the disposable runner returned OFF.
