# CashCompass Part 2A — Identity and Data Contracts

**Status:** Complete checkpoint for Part 2A-0 and Part 2A-1
**Scope:** Contracts and stable identity only. Financial facts, Planning authority changes, OAuth, production connectors, tax lots, and portfolio recommendations are out of scope.

## 1. Architectural boundaries

1. `SYS - Financial Accounts` owns identity only. It is never a balance authority.
2. `SYS - Account Source Links` maps one CashCompass account to zero or more source-specific identities.
3. Authority and freshness are fact-level. An account is never globally declared current.
4. `Effective As Of` is when a financial value was true. `Observed At` is when CashCompass received it. They are never substituted for one another.
5. Imported financial facts never overwrite user-controlled policy, including Use Policy, Min Buffer, Planning Role, ownership restrictions, liquidity strategy, or the Robinhood weekly floor.
6. Existing `Investment Id` values are adopted verbatim as stable account IDs.
7. Institution, display name, and last four digits may suggest review candidates but can never authorize an automatic merge.
8. Unknown owner or registration data fails closed for automatic matching.
9. Part 1 Planning remains on its existing readers during Part 2A-0 and Part 2A-1.
10. Current cash plus current revolving-debt facts form the first operational Planning milestone. A cash-only import does not make the weekly plan operationally authoritative.

## 2. `SYS - Financial Accounts`

| Column | Contract |
| --- | --- |
| Stable Account Id | Immutable CashCompass identity. Existing Investment IDs are preserved. Other IDs are generated once with a domain prefix and UUID. |
| Domain | Controlled value: CASH, DEBT, INVESTMENT, RETIREMENT, PROPERTY. |
| Display Name | Current customer label. Mutable and never an identity key. |
| Institution | Normalized display label; not sufficient for matching. |
| Account Type | Controlled domain-level account type. |
| Account Subtype | Optional normalized subtype. |
| Owner Id | Stable non-email household key. UNKNOWN_REVIEW_REQUIRED cannot auto-match. |
| Registration Type | Controlled registration value. UNKNOWN cannot auto-match. |
| Currency | ISO currency when known. |
| Last 4 | Masked display/matching aid only. |
| Active | Lifecycle state. Imports cannot change it. |
| Identity Status | VERIFIED, REVIEW_REQUIRED, CONFLICT, or LEGACY_UNRESOLVED. |
| Legacy Domain | Source domain of the pre-Part-2A record. |
| Legacy Key | Migration locator only; never independent identity proof. |
| Created At | Actual registry creation timestamp. |
| Updated At | Actual identity-metadata update timestamp. |

## 3. `SYS - Account Source Links`

| Column | Contract |
| --- | --- |
| Source Link Id | Immutable link ID. |
| Stable Account Id | Foreign key to `SYS - Financial Accounts`. |
| Source Type | MANUAL, CSV, OFX, QFX, STATEMENT, API, AGGREGATOR, or LEGACY. |
| Source System | Adapter/provider namespace. |
| Source Account Key | Deterministic non-reversible source-scoped key; never the raw external identifier. |
| Masked Identifier | Customer-safe identifier such as `••••0393`. |
| Institution | Source-reported institution label. |
| Source Account Type | Source-reported account type. |
| Link Status | VERIFIED, REVIEW_REQUIRED, AMBIGUOUS, DISABLED, or CONFLICT. |
| Linked At | Actual link creation timestamp. |
| Verified At | Actual explicit verification timestamp, blank until verified. |

The pair `Source System + Source Account Key` is unique. A stable account may have several source links.

## 4. Adapter identity contract

Every adapter maps institution-specific input into:

```text
sourceType
sourceSystem
externalAccountId (server-side transient only)
institution
displayName
last4
accountType
accountSubtype
ownerId
registrationType
currency
```

The identity matcher returns exactly one of:

- `EXACT_LINK` — one verified source link identifies one stable account.
- `REVIEW_CANDIDATE` — one possible legacy match exists, but user review is required.
- `AMBIGUOUS` — multiple candidates exist; no mutation is allowed.
- `NO_MATCH` — a new account may be proposed, never silently created.
- `CONFLICT` — owner, registration, domain, or source-link invariants disagree.

## 5. Stable ID generation and adoption

1. Adopt a nonblank unique `SYS - Assets.Investment Id` verbatim.
2. Duplicate Investment IDs produce `CONFLICT`; neither record is silently adopted.
3. Other domains receive a stored random ID with prefix `CASH-`, `DEBT-`, `RET-`, or `PROP-` plus a UUID.
4. Generated IDs are never derived from institution, account name, last4, owner, or sheet row.
5. Rename, Stop, and Reactivate preserve the stored ID.
6. Repeated migration is idempotent.

## 6. Owner and registration representation

Initial owner IDs are non-email household keys: `SAMER`, `LAITH`, `LUTFI`, `HOUSEHOLD_JOINT`, and `UNKNOWN_REVIEW_REQUIRED`. The representation is extensible; display names remain separate.

Registration values initially supported are `INDIVIDUAL`, `JOINT`, `CUSTODIAL`, `TAXABLE`, `401K`, `IRA`, `529`, `TRUST`, `PROPERTY_TITLE`, and `UNKNOWN`.

Child/adult separation is an identity invariant. `CUSTODIAL`, `529`, or a child owner can never auto-match an adult account.

## 7. Legacy mapping

- INVESTMENT: existing Investment ID is both the adopted stable ID and preferred legacy key.
- CASH: current canonical account name is a temporary migration locator only.
- DEBT: current canonical debt name is a temporary migration locator only.
- RETIREMENT: existing Investment ID when available; otherwise explicit review.
- PROPERTY: current canonical property name is a temporary migration locator only.

Legacy keys are retained for compatibility but cannot by themselves establish a source link.

## 8. Fact-level authority and dates reserved for Part 2A-2

Future financial facts must independently carry `Effective As Of`, `Observed At`, source, authority, and verification evidence. For example, a card may have a current balance, aging APR, current minimum, and unknown credit limit simultaneously.

Uploading a July 31 statement on August 15 records `Effective As Of = July 31` and `Observed At = August 15`. No code may promote the former to the latter.

## 9. Migration and Planning boundary

Part 2A-1 provides read-only preview plus explicit digest-guarded apply. It creates only the two additive identity sheets and never rewrites existing INPUT or SYS domain sheets. Planning continues to use its current readers. A future shadow reader must reconcile legacy and normalized input before any authority switch.

## 10. Security

- Raw external account identifiers are transient server input only.
- Persisted source identity uses a deterministic source-scoped SHA-256 key and masked identifier.
- Activity and customer-facing diagnostics must not include raw external identifiers.
- OAuth tokens, credentials, and raw account numbers never enter workbook cells, logs, recommendation objects, or browser responses.

Part 2A-2 financial-fact semantics are defined separately in
`PART_2A_FINANCIAL_FACTS_CONTRACT.md`; this identity contract remains frozen.

## 11. Chase V1 statement-source association

`STATEMENT` remains an ordinary source-link class in the existing registry; it
does not create a second identity system. Chase V1 PDF identity is weaker than
QFX identity, so every PDF association requires explicit customer confirmation
to one existing active, VERIFIED, revolving-DEBT Financial Account. Last four,
institution, and product context may support a sanitized candidate display but
never authorize the link. Missing, inactive, review-required, wrong-domain,
wrong-type, stale, or ambiguous targets fail closed.

When a protected QFX source identity exists, the protected statement
association key may be derived from that already-protected key and the exact
statement-profile version. Otherwise the server creates a protected random
statement association only after explicit confirmation. Neither path hashes
last four as if it were strong identity, and neither persists a raw account
number. This explicit-confirmation rule is Chase V1 policy; a future statement
source with independently reviewed stronger identity may define a different
contract.
