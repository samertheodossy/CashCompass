# Multi-Broker Portfolio Data Model — Foundation v1

CSV-first canonical investment infrastructure for CashCompass. This document describes the Foundation v1 contracts implemented in `investment_portfolio_foundation.js` and `investment_adapters.js`.

**Status:** Foundation infrastructure. Robinhood production import remains in `investment_activity.js`. E*TRADE Phase A preview-only Transactions CSV adapter is implemented locally (not committed). M1 and Schwab adapters are not implemented.

---

## Strategy: CSV-first, multi-file capable

Brokerage-native structured file imports are the **primary** multi-broker path. Plaid Investments is optional convenience and may implement the same adapter contract later as `PLAID_INVESTMENTS`.

Typical workflow:

```
Broker export (one or more files)
  → Broker Adapter (parse only)
  → Normalized Preview
  → Owner review
  → Canonical Activity / Holdings / Tax Lots / Securities
  → Reconciliation (review-only in v1)
  → Persistence (centralized; not adapter-owned)
```

Monthly re-import of overlapping history is expected. Users do not need to export only new rows.

---

## Source identifiers

Canonical sources (`INVESTMENT_PORTFOLIO_SOURCES_`):

| Source | Status |
|--------|--------|
| `ROBINHOOD_CSV` | Adapter wrapper (delegates to legacy parser) |
| `ETRADE_CSV` | **Preview-only** — Transactions CSV activity alias (`source: 'ETRADE_CSV'`) |
| `ETRADE_PACKAGE` | **Preview-only Phase A** — Transactions CSV implemented; Positions PDF and Gains & Losses PDF **not** implemented; see `ETRADE_SOURCE_MAPPING.md` |
| `M1_CSV` | Contract only |
| `SCHWAB_CSV` | Contract only |
| `RETIREMENT_PLAN_CSV` | Contract only |
| `PLAID_INVESTMENTS` | Contract only |
| `MANUAL_STRUCTURED` | Contract only |

Every normalized record preserves provenance: `source`, `sourceAccountKey`, `sourceRecordKey`, `sourceSecurityKey`, `sourceLotKey`, `sourceAsOfDate`, `importedAt`, `parserVersion`, `importBatchId` / `sourceFileFingerprint`. Provider account identifiers are hashed/opaque where appropriate.

---

## Capability-driven adapter contract

Adapters declare what a file package can supply:

- `activities`
- `holdings`
- `taxLots`
- `accountSnapshot`
- `dividendHistory`
- `realizedGainLoss`

Import package shape (conceptual):

```javascript
{
  source: 'ETRADE_PACKAGE',
  accountHint: { investmentId, stableAccountId },
  files: [
    { role: 'ACTIVITY', content: '...' },           // Transactions CSV
    { role: 'HOLDINGS', content: '...' },             // Expanded Positions PDF (open lots)
    { role: 'REALIZED_GAIN_LOSS', content: '...' }    // Gains & Losses PDF (period-scoped closed lots)
  ]
}
```

Activity-only packages may use `source: 'ETRADE_CSV'` with a single `ACTIVITY` file.

Adapters infer file roles when safe; ambiguous packages fail preview with a review-required error.

Normalized preview result:

```javascript
{
  source,
  parserVersion,
  schemaVersion,
  capabilities: { ... },
  accountCandidates: [],
  activities: [],
  holdingsSnapshots: [],
  taxLots: [],
  securities: [],
  accountSnapshots: [],
  warnings: [],
  unsupportedRows: [],
  importSummary: { ... }
}
```

Broker-specific column names must not escape the adapter boundary.

---

## Adapter registry

`getInvestmentAdapter_(source)` → adapter with:

- `detect(input)` — validate package / infer roles
- `preview(input, optionalSs)` — review-first normalized preview
- `normalize(input, optionalSs)` — canonical records only

**Robinhood:** `investmentAdapterPreviewRobinhoodCsv_` delegates to `previewInvestmentActivityImportFromDashboard` and wraps output via `investmentPortfolioNormalizeRobinhoodPreview_`. No adapter writes workbook sheets.

---

## Account identity

| Field | Role |
|-------|------|
| `Investment Id` (`INV-<uuid>`) | Investment subsystem operational identity (preserved) |
| `stableAccountId` | CashCompass-wide Financial Identity link |

New multi-broker rows carry both when resolvable. Existing Robinhood rows are not destructively backfilled in Foundation v1.

---

## Registration Type (single canonical concept)

Extended in `financial_identity.js`:

- `TAXABLE`
- `TRADITIONAL_IRA`
- `ROTH_IRA`
- `401K`
- `403B`
- `HSA`
- `OTHER_RETIREMENT`
- `UNKNOWN`

Legacy `IRA` remains for backward-compatible display but is **not tax-authoritative** until owner confirms Traditional vs Roth (`investmentPortfolioRegistrationTaxAuthoritative_('IRA') === false`).

HSA is distinct from IRA registrations.

Domain resolution:

- Retirement registrations → `RETIREMENT`
- Taxable brokerage → `INVESTMENT`

Retirement accounts participate fully in portfolio ingestion (Activity, Holdings, Securities, Tax Lots, allocation, concentration, income, Net Worth).

---

## Portfolio Role / policy (orthogonal to Registration Type)

Portfolio roles (`INVESTMENT_PORTFOLIO_PORTFOLIO_ROLES_`):

- `RETIREMENT_ACCUMULATION`
- `INCOME_PRODUCING`
- `GROWTH`
- `PROTECTED`
- `OPTIMIZATION_CANDIDATE`
- `DO_NOT_SELL_FOR_CASH_FUNDING`

Robinhood effective behavior preserved via existing `Planning Purpose = INCOME_PRODUCING` plus capital-allocation policy (protected floor, do-not-sell semantics).

---

## Import eligibility (separate from Portfolio Role)

| Seam | Question |
|------|----------|
| `investmentPortfolioImportEligible_` | Can CashCompass ingest this portfolio? Requires active `INVESTMENT` or `RETIREMENT` domain + `investmentId` or `stableAccountId`. **Does not** require `INCOME_PRODUCING`. |
| `investmentPortfolioRobinhoodImportEligible_` | Legacy Robinhood UI gate; still requires `incomeProducingEligible`. |

401(k) and other retirement accounts are import-eligible under the generic seam.

Default retirement policy: `investmentPortfolioCashFundingSellEligible_` returns `false` for retirement registrations and `DO_NOT_SELL_FOR_CASH_FUNDING` / `PROTECTED` roles.

---

## Activity schema evolution

Existing `SYS - Investment Activity` columns are preserved. Append-only extensions (`INVESTMENT_ACTIVITY_EXTENDED_HEADERS_`):

- Stable Account Id, Stable Security Id
- Source Record Key, Source Account Key
- Fees, Net Amount, Activity Subtype
- Parser Version, Data Quality, Import Batch Id, Source File Fingerprint
- Income Bucket Snapshot (cache metadata only)

Canonical activity types include BUY, SELL, DIVIDEND, DISTRIBUTION, REINVESTMENT, CONTRIBUTION, WITHDRAWAL, EMPLOYER_MATCH, TRANSFER_IN/OUT, SPLIT, FEE, INTEREST, OPENING_BALANCE, CORPORATE_ACTION, LOAN, HARDSHIP_WITHDRAWAL, UNSUPPORTED.

Unknown source activity → `UNSUPPORTED` with provenance; never silently dropped.

---

## Holdings schema evolution

Robinhood-derived holdings behavior unchanged (`CASHCOMPASS_RECONSTRUCTED` from partial activity taxonomy).

Extended holdings fields support future provider snapshots:

- Market Value, Current Price, Price As Of
- Provider Cost Basis, Cost Basis Quality, Unrealized Gain/Loss
- Authority (`CASHCOMPASS_RECONSTRUCTED` | `PROVIDER_REPORTED` | `HYBRID`)
- Reconstruction Status, Source Snapshot Key, Source As Of Date

**Total Buy Cost** remains aggregate cash-spent semantics for Robinhood; it is not tax cost basis.

Holdings snapshot identity: account + security + asOfDate + source + sourceSnapshotKey + importedAt.

---

## Tax Lots (`SYS - Investment Tax Lots`)

First-create headers defined; sheet is **not** created during Foundation v1 development or on dashboard open.

Lot authority:

- `PROVIDER_REPORTED` — brokerage export (reconciliation precedence for tax)
- `CASHCOMPASS_RECONSTRUCTED` — from complete activity history
- `AGGREGATE_ONLY` — provider gave aggregate basis only; not lot-level tax accuracy
- `UNKNOWN`

Do not fabricate true lots from aggregate cost basis.

---

## Security identity (`SYS - Investment Securities`)

Minimal registry contract for `stableSecurityId` with types: EQUITY, ETF, MUTUAL_FUND, BOND, OPTION, CASH_EQUIVALENT, CRYPTO, UNKNOWN.

Matching priority:

1. `(source, sourceSecurityKey)`
2. CUSIP / ISIN when trustworthy
3. normalized ticker + security type
4. unresolved / manual review

Ticker alone is not authoritative when better identity exists.

OPTIONS rows may remain `UNSUPPORTED` for analytics but must not be discarded from adapter output.

---

## Current price / market value authority

Concepts remain distinct:

| Concept | Robinhood today |
|---------|-----------------|
| Last Activity Price | Last transaction price in holdings rebuild |
| Provider Current Price | Future broker snapshot |
| Market Quote Price | Future external quote provider |
| Provider Market Value | Future broker snapshot |

Future precedence: provider-reported MV/price with as-of → external quote → last activity price (explicit fallback only).

---

## Spendable vs retirement income

`Income Bucket` (derived from Registration Type):

- `TAXABLE` → `CURRENT_SPENDABLE_PORTFOLIO_INCOME`
- Retirement registrations → `RETIREMENT_PORTFOLIO_INCOME`
- `UNKNOWN` → review

Classifies investment income **availability** for planning; does not automatically sweep dividends into cash-flow spending. Activity-level snapshot field is cache metadata only.

Holdings aggregate `Dividends Received` remains a derived summary, not canonical income history.

---

## Replay, dedupe, and corrections

Replay outcomes:

| Outcome | Behavior |
|---------|----------|
| `EXACT_REPLAY` | Ignore safely |
| `NEW_RECORD` | Candidate for append |
| `SOURCE_CORRECTION` | Same source record key, changed fields → review/version path |
| `CONFLICT` | Fail closed / owner review |

Identity priority:

1. `source + sourceAccountKey + sourceRecordKey`
2. deterministic normalized fingerprint
3. content-hash fallback

Robinhood `Import Key` semantics preserved via legacy replay key mapping.

**Collision risk:** same-day identical trades without source record IDs share fingerprint keys (documented in tests).

Historical Activity is audit-oriented; no silent overwrite.

---

## Reconciliation (review-only in v1)

`investmentPortfolioReconcilePosition_` compares reconstructed vs provider quantities, cost basis, and market value.

Classifications: `MATCH`, `ROUNDING_DIFFERENCE`, `SOURCE_INCOMPLETE`, `ACTIVITY_GAP`, `COST_BASIS_GAP`, `PRICE_STALE`, `CASH_GAP`, `MATERIAL_MISMATCH`.

No auto-correction in Foundation v1.

Authority precedence:

- Historical Activity: source transactions (immutable audit)
- Tax basis: provider lots > reconstructed lots
- Current positions: provider snapshot evidence
- Reconstructed holdings: consistency check
- Account total: `INPUT - Investments` → `SYS - Assets` **remains Net Worth authority**

---

## Robinhood protection

Production path unchanged:

```
Robinhood CSV → previewInvestmentActivityImportFromDashboard / importInvestmentActivityFromDashboard
→ SYS - Investment Activity → rebuildInvestmentHoldingsForAccount_
→ SYS - Investment Holdings → Plans / Capital Allocation
```

Protected: Import Key semantics, INCOME_PRODUCING gate, holdings rebuild, Total Buy Cost, dividends received, policy floor, Net Worth authority.

Generic adapter infrastructure is parallel and not wired to dashboard persistence.

---

## Workbook safety

- New sheets (`SYS - Investment Tax Lots`, `SYS - Investment Securities`) first-create via `investmentPortfolioEnsure*` helpers only when explicitly invoked
- No module-load sheet creation
- No broad restyle of populated sheets
- Append-only column extensions on existing sheets when migrated

---

## Schema versioning

- `INVESTMENT_PORTFOLIO_SCHEMA_VERSION_` = `1.0.0`
- Per-adapter `parserVersion` (Robinhood: `robinhood-legacy-v1`)

---

## Future phases (not in Foundation v1)

- **Phase B/C E*TRADE:** Positions PDF, Gains & Losses PDF, multi-file package merge (Phase A Transactions CSV preview is implemented — preview-only, no persistence)
- M1 / Schwab source inspection and adapters
- Real brokerage file import / persistence wiring
- Market quote provider
- Holdings-derived Net Worth authority migration
- Portfolio optimizer
- Plaid Investments adapter
- Generic persistence wired to production UI
- Robinhood eligibility migration off `INCOME_PRODUCING`-only gate

---

## E*TRADE source inspection — complete (2026-08-28)

Owner-supplied exports were inspected **outside Git**. Authoritative structural mapping: **`ETRADE_SOURCE_MAPPING.md`**.

| Source | Role |
|--------|------|
| Transactions CSV | Activity / cash events |
| Expanded Positions PDF | Current holdings + **open lots** |
| Gains & Losses PDF | **Realized closed lots** for owner-selected Date From → Date Closed only |

**Unresolved:** structured Positions or Gains & Losses CSV/XLS exports (download stubs were invalid).

**Phase A status (2026-08-29):** preview-only Transactions CSV adapter implemented locally (`investment_etrade_csv.js`, synthetic fixtures, regression tests). **Not** persistence, dashboard upload, or production import.

**Next engineering milestone:** Phase B Positions PDF preview, then Phase C Gains & Losses PDF — still preview-only until owner review passes.
