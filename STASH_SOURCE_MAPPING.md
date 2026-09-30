# Stash Investments LLC — Brokerage Statement PDF Source Mapping

**Status:** Structural mapping from owner-inspected real statement (outside Git).  
**Parser:** `investment_stash_brokerage_statement_pdf.js` (`STASH_BROKERAGE_STATEMENT_PDF`).  
**Contract:** `PORTFOLIO_INTELLIGENCE_HOLDINGS_V1`

Real owner names, addresses, and account numbers are **not** copied into this document.

---

## Source identity

| Item | Value |
|------|--------|
| Provider | Stash (introducing broker; Apex Clearing is the clearing firm) |
| Document | Monthly Stash-branded Apex brokerage statement PDF |
| CashCompass source enum | `STASH_BROKERAGE_STATEMENT_PDF` |
| File role | `HOLDINGS` + `ACCOUNT_SNAPSHOT` |
| Distinct from | Apex-only statements from other introducing brokers |

---

## Observed layout

### Account summary

| Block | Fields |
|-------|--------|
| Branding | `STASH CAPITAL` registered representative |
| Clearing | Apex Clearing Corporation |
| Period | `Month D, YYYY - Month D, YYYY` |
| Totals | FDIC Insured Deposits, Securities, **TOTAL PRICED PORTFOLIO** (opening and closing) |

### Holdings

| Table | Columns |
|-------|---------|
| FDIC sweep | `THE INSURED DEPOSIT PROGRAM` / `ISPXZ` — cash, not an equity |
| Equities / Options | `DESCRIPTION`, `SYMBOL/CUSIP`, account type, `QUANTITY`, `PRICE`, `MARKET VALUE` |

Transactions begin at **BUY / SELL TRANSACTIONS** and are out of scope.

---

## Field mapping → unified contract

| Stash field | Unified target | Notes |
|-------------|----------------|-------|
| Statement period end | `asOf`, `sourceAsOf`, `priceAsOf` | Period-end date authority |
| Owner `accountName` | `accounts[].displayName` | CashCompass name, not PDF account number |
| Owner `stableAccountId` + `explicitAccountMatch` | `accounts[].stableAccountId`, `matchStatus` | PDF account number is never `sourceAccountKey` |
| TOTAL PRICED PORTFOLIO (closing) | `reconciliation.endingTotalValue`, snapshot `marketValue` | Never holdings-sum fallback |
| FDIC Insured Deposits | `cashBalance` / Apply `__CASH__` | Missing label stays `null`, never `$0` |
| ISPXZ | excluded `CASH_SWEEP` | Do not emit as a security |
| Symbol + issuer | `securities[]`, `holdings[]` | Quantity/price/market value only |
| Cost basis / unrealized | unavailable | Stay `null` |

---

## Security identity

Durable key format:

```
STASH|{SYMBOL}|STATEMENT
```

---

## Readiness (this slice)

| Flag | Expected |
|------|----------|
| `trustedForHoldingsVisibility` | ✅ when recon succeeds and explicit match is present |
| `trustedForIncomeAnalysis` | ❌ |
| `trustedForTaxLotSalePlanning` | ❌ |
| Monthly INPUT - Investments | ❌ not in this slice |

---

## Related documents

- `M1_SOURCE_MAPPING.md`
- `investment_stash_brokerage_statement_pdf.js`
