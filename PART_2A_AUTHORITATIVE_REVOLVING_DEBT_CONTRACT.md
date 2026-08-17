# CashCompass Part 2A-4 — Authoritative Revolving Debt Import

**Status:** Runtime-proven on isolated Central `@363`; authority remains shadow-only.
**Authority boundary:** `INPUT - Debts` and the existing Part 1 reader remain
authoritative. Imported debt evidence is append-only and shadow-only.

## Purpose and scope

Part 2A-4 normalizes current revolving-debt evidence without changing the
weekly recommendation. It adds a source-neutral `DEBT_EVIDENCE_V1` contract,
an OFX/QFX credit-card statement adapter, a structured snapshot adapter, and an
explicit verified-manual supplement. Preview must remain unchanged before Apply.
Raw files, account numbers, external identifiers, and transaction detail are not
retained.

The slice may append `SYS - Financial Facts` and sanitized `SYS - Import Runs`
rows. It never writes `INPUT - Debts`, changes debt policy, releases a minimum,
or switches Planning authority.

## Normalized evidence

Evidence may contain current balance, credit limit, available credit,
contractual minimum payment, next payment amount, exact next payment date, and
separately typed APR components. `MINIMUM_PAYMENT` is the current cycle's
contractual required minimum. `NEXT_PAYMENT_AMOUNT` remains distinct unless the
source explicitly states that it is the same obligation.

A legacy due day such as `16` is not equal to an imported exact date such as
`2026-09-16`. Shadow reconciliation reports that comparison as unavailable
rather than inventing precision.

## Planning APR semantics

`APR` is a selected planning rate, not a synonym for the first or headline rate
in a file. It may be emitted only when source semantics identify the rate
economically applicable to the carried balance being optimized.

Purchase, cash-advance, balance-transfer, promotional, deferred-interest, and
generic disclosed rates remain separate evidence. If multiple balance buckets
exist and the source cannot establish which rate applies to the outstanding
balance, selection is `REVIEW_REQUIRED`. CashCompass does not silently choose
the lowest, highest, first, or generic purchase APR.

## Granular readiness

Debt readiness is not one boolean:

| Dimension | Required evidence | Example limitation |
| --- | --- | --- |
| BALANCE_READINESS | Current selected balance | A stale balance may model approximately but cannot support an exact payoff |
| INTEREST_RANKING_READINESS | Current balance plus applicable planning APR for each positive revolving balance | Missing or ambiguous APR blocks economic ordering |
| PAYMENT_OBLIGATION_READINESS | Current balance, contractual minimum, and exact next-payment date for each positive revolving balance | A next-payment amount does not substitute for a missing contractual minimum |
| EXACT_PAYOFF_READINESS | Current actionable balance with no unresolved balance/APR conflict | Unknown, stale, conflicting, or review-required evidence blocks an exact instruction |

`WEEKLY_PLAN_DATA_READINESS` aggregates these dimensions with authoritative cash
readiness, but it preserves every reason code. No dimension changes Planning in
this slice.

## Zero-balance semantics

A current authoritative `CURRENT_BALANCE = 0` is retained as evidence that the
reported balance is zero. It does not prove pending interest is zero, a statement
is settled, autopay is canceled, or a previously required minimum may be
released. Part 1 recommendation lifecycle and released-minimum behavior remain
unchanged.

## Identity, idempotency, and conflicts

Records resolve through protected stable Financial Account identity. Ambiguous,
inactive, unsupported, and unlinked records fail closed or remain explicitly
unlinked. Protected identity fields cannot be supplied by an adapter. Repeating
the same normalized evidence is a no-op. Equal-quality conflicts remain stored
and non-actionable rather than being silently selected.

## Validation boundary

Permanent local and disposable-Central coverage must prove Preview/Apply,
duplicate no-op, partial source behavior, multiple APR review, verified-manual
supplement, current/aging/stale selection, current zero balance, protected
identity, privacy, shared manifests, cleanup, and exact byte-equivalence of the
legacy debt/Planning output before and after shadow writes.

Real owner exports are not proven by synthetic fixtures. No bounded workbook,
Central Beta deployment, direct connector, transaction import, payment action,
or authority migration is included.

## Runtime evidence

Suite `SUITE-PART-2A-AUTHORITATIVE-REVOLVING-DEBT`, run
`20260817-074631-0fb6`, passed 1/1 scenario and 33/33 functional assertions in
44.7 seconds on isolated Central `@363`. Restricted sharing, Provisioning, and
Workbook Drift passed. The marker-verified fixture was verified TRASHED and the
disposable runner returned OFF. The run proved exact byte-equivalence of both
the legacy `INPUT - Debts` row and the Planning output before and after shadow
evidence writes.
