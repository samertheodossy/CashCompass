# M1 Finance — Brokerage Statement PDF Source Mapping

**Status:** Structural mapping from owner-inspected real statement (outside Git).  
**Parser:** `investment_m1_statement_pdf.js` (`M1_STATEMENT_PDF`, preview-only).  
**Contract:** `PORTFOLIO_INTELLIGENCE_HOLDINGS_V1`

Real numeric balances, account titles, and addresses are **not** copied into this document.

---

## Source identity

| Item | Value |
|------|--------|
| Provider | M1 Finance LLC |
| Document | Monthly brokerage **Statement** PDF (4 pages observed) |
| CashCompass source enum | `M1_STATEMENT_PDF` |
| File role | `HOLDINGS` + `ACCOUNT_SNAPSHOT` |
| Distinct from | `M1_CSV` (future activity CSV — not implemented) |

---

## Observed layout

### Page 1 — Account summary

| Block | Fields |
|-------|--------|
| Header | Statement period (`MM/DD/YYYY` to `MM/DD/YYYY`), masked account number (`XXXX####`), account label, account type (`Margin`), joint account title |
| Account value | Total account value, 1-month change ($ and %) |
| Account breakdown | `Cash`, `Equities`, `Total portfolio` with last/current period columns |
| Activity summary | Rollups only: paid dividends, deposits, securities purchased, closing cash balance |

### Page 2 — Holdings

| Table | Columns |
|-------|---------|
| Total portfolio | `Symbol`, `Quantity`, `Price`, `Market value`, `Cost basis`, `Unrealized P/L` |
| Financial instrument information | `Symbol`, `Share class`, `Description`, `Exchange` |

### Pages 3–4

Legal/disclosure text only. References tax lots at M1 but **does not** include open-lot rows on the statement.

---

## Field mapping → unified contract

| M1 field | Unified target | Notes |
|----------|----------------|-------|
| Statement period end | `asOf`, `sourceAsOf`, `priceAsOf` | Period-end date authority |
| Account label / owner `accountName` | `accounts[].displayName` | Not durable identity |
| Account type (`Margin`) | `accounts[].accountType` | Do **not** infer `registrationType` |
| Owner `registrationType` | `accounts[].registrationType`, `taxStatus` | Explicit metadata required |
| Owner `stableAccountId` + `explicitAccountMatch` | `accounts[].stableAccountId`, `matchStatus` | Masked `XXXX####` is **not** used |
| Total account value | `accountSnapshots[].marketValue` | |
| Cash row | `accountSnapshots[].cashBalance` | Not a security holding |
| Equities subtotal | `statementParseMeta.equitiesSubtotal` | Summary cache only |
| Symbol + instrument merge | `securities[]`, `holdings[]` | |
| Aggregate cost basis | `holdings[].providerCostBasis`, `costBasisQuality: PROVIDER_AGGREGATE` | Blocks lot-level planning |
| Unrealized P/L | `holdings[].unrealizedGainLoss` | |
| Paid dividends rollup | `statementParseMeta` + warning | **Not** `distributions[]` |

---

## Security identity

No CUSIP/ISIN on observed statement.

Durable key format:

```
M1|{SYMBOL}|{Share class}|{EXCHANGE}
```

Append `|{descriptionDigest}` only when duplicate instrument rows disambiguate the same symbol.

Ticker alone is **not** durable identity.

---

## Parser exclusions

| Row / block | Treatment |
|-------------|-----------|
| `Total` on holdings table | Excluded (`PAGE_TOTAL`) |
| `Cash` / `Equities` in holdings section | Excluded (`ACCOUNT_ROLLUP`) |
| Activity summary rows | Ignored for `activities[]` |
| Paid dividends rollup | Warning only |

---

## Readiness (one-document MVP)

| Flag | Expected |
|------|----------|
| `trustedForHoldingsVisibility` | ✅ with explicit account match + valid holdings |
| `trustedForIncomeAnalysis` | ❌ (no classified per-security distributions) |
| `trustedForTaxLotSalePlanning` | ❌ (aggregate basis only; no open lots) |

---

## PDF text extraction notes

- Browser/print PDF text may contain private-use Unicode separators; parser normalizes `\uE000–\uF8FF` to `/`.
- Fractional quantities use high precision (e.g. `57.65199`).
- Parenthesized money values denote negatives.

---

## Related documents

- `PORTFOLIO_INTELLIGENCE_HOLDINGS_CONTRACT.md`
- `ETRADE_SOURCE_MAPPING.md` §7 (E*TRADE Positions PDF — parallel one-document MVP)
- `investment_m1_statement_pdf.js`
