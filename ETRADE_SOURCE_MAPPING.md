# E*TRADE Source Mapping — Inspection Report (Adapter Design Input)

**Status:** Source inspection **complete** (Transactions CSV + Expanded Positions PDF + Gains & Losses PDF). **No adapter, persistence, production import, or workbook changes.**

**Inspection date:** 2026-08-28  
**Foundation baseline:** `investment_portfolio_foundation.js` v1.0.0, `investment_adapters.js`, `MULTI_BROKER_PORTFOLIO_DATA_MODEL.md`

### Three-source model (inspected)

| # | Source | Role | Format |
|---|--------|------|--------|
| 1 | **Transactions CSV** | Activity / cash events | Delimited CSV with preamble |
| 2 | **Expanded Positions PDF** | Current holdings + **open lots** | Browser-print PDF |
| 3 | **Gains & Losses PDF** | **Realized closed lots** in selected period | Browser-print PDF |

Import package identifier: **`ETRADE_PACKAGE`** (multi-file). Activity-only CSV parsing may register under `ETRADE_CSV` as a single-file subset.

**Readiness boundary:** Source **mapping** is ready for **preview-only adapter design**. It is **not** ready for persistence, dashboard upload, production import, or Net Worth authority changes.

---

## Inspection scope and source availability

| Source | Owner description | Local inspection | Result |
|--------|-------------------|------------------|--------|
| **Transactions CSV** | Multi-year activity export; 13 data columns | Owner file (outside Git) | **Inspected** — headers, types, field population, pairing patterns |
| **Expanded Positions PDF** | Multi-page holdings + open lots | Owner attachment (outside Git) | **Inspected** — hierarchical position/lot layout, wash-sale markers, snapshot metadata |
| **Gains & Losses PDF** | Multi-page closed lots for owner-selected Date From → Date Closed | Owner attachment (outside Git) | **Inspected** — closed-lot columns, term/FIFO/deferred-loss fields; **period-scoped only** |

**Rule applied:** Structural findings below are **observed** from owner-supplied files stored outside Git. Numeric balances, account labels, and row-level holdings are **not** copied into this document.

**Format note:** Both PDFs are **browser-rendered portfolio pages** (print/save-as-PDF from E*TRADE web UI), not structured CSV/XML exports. Adapter design must assume **PDF text/table extraction**, not column-stable delimited files.

**Structured Positions / Gains CSV — unresolved:** Owner download attempts produced invalid placeholder files (`Invalid request`, 15 bytes). Whether E*TRADE offers structured CSV/XLS exports equivalent to the Positions or Gains & Losses PDFs **remains unknown**. Until confirmed, treat **PDF as the authoritative non-transaction source** for open lots and realized closed lots.

**Privacy:** No real account numbers, balances, tax lots, transaction rows, or row-level holdings appear in this document.

---

## 1. Transactions CSV — exact headers and data types

### File shape

E*TRADE exports a **preamble** before the data table:

1. Filter label line (`All Transactions Activity Types`)
2. Blank line
3. Account + date-range line (contains masked account suffix and export window)
4. Blank line
5. Optional summary line (`Total:` + currency amount)
6. Blank line
7. **Header row** (13 columns)
8. Data rows
9. **Footer disclaimer rows** (4 observed) — prose in the first column, empty Activity Type; must be excluded from import

### Header row (exact)

| # | E*TRADE column | Observed type / format | Population (360 data rows) |
|---|----------------|------------------------|----------------------------|
| 1 | `Activity/Trade Date` | `MM/DD/YYYY` | 100% populated |
| 2 | `Transaction Date` | `MM/DD/YYYY` | 99% (4 footer rows blank) |
| 3 | `Settlement Date` | `MM/DD/YYYY` or empty | 98% populated; empty on some dividends |
| 4 | `Activity Type` | Enumerated string (see §2) | 99%; 4 footer rows blank |
| 5 | `Description` | Free text; carries reinvest/exchange/REFID detail | 99% |
| 6 | `Symbol` | Ticker or `--` | 89% ticker; 10% `--`; 4 footer blank |
| 7 | `Cusip` | CUSIP or `--` | **0% populated** (all `--` in sample) |
| 8 | `Quantity #` | Signed decimal string or empty | 49% populated |
| 9 | `Price $` | Decimal string or empty | 46% populated |
| 10 | `Amount $` | Signed decimal currency | 99% |
| 11 | `Commission` | Decimal; `0.0` when none | 99% |
| 12 | `Category` | Always `--` in sample | **Unused** |
| 13 | `Note` | Always `--` in sample | **Unused** |

### Sign conventions (observed)

| Activity Type | Quantity | Amount $ |
|---------------|----------|----------|
| `Bought` | Positive shares | **Negative** (cash out) |
| `Sold` | Negative shares | **Positive** (cash in) |
| `Dividend` / `Qualified Dividend` | Usually empty; reinvest rows have positive qty | Positive for cash dividend; **negative** for `DIVIDEND REINVESTMENT` rows |
| `Transfer` (security) | Signed share qty; amount often `0.0` | `0.0` |
| `Online Transfer` (ACH) | Empty | Positive deposit / negative withdrawal |
| `Exchange *` | Signed qty on in/out legs | Usually `0.0` |
| `Service Fee` | Empty | Negative fee; reversals positive |

Adapter must **not** silently flip signs; normalize to canonical `amount` (signed cash effect) and `quantity` (signed share effect) with explicit rules per mapped type.

---

## 2. E*TRADE activity taxonomy → canonical mapping

### Observed E*TRADE `Activity Type` values (15 + footer blank)

| Count | E*TRADE Activity Type | Proposed canonical type | Notes |
|------:|----------------------|-------------------------|-------|
| 163 | `Dividend` | See §3 | Often reinvest leg or cash dividend |
| 97 | `Qualified Dividend` | `QUALIFIED_DIVIDEND` | Usually paired with reinvest row |
| 27 | `Sold` | `SELL` | |
| 20 | `Bought` | `BUY` | |
| 14 | `Online Transfer` | `TRANSFER_IN` / `TRANSFER_OUT` / `CONTRIBUTION` / `WITHDRAWAL` | ACH; infer direction from amount sign + description |
| 10 | `Service Fee` | `FEE` | Includes mandatory reorg fees + reversals |
| 7 | `Transfer` | `TRANSFER_IN` / `TRANSFER_OUT` | Security or cash; **not** a purchase |
| 5 | `Interest Income` | `INTEREST` | Sweep / bank deposit program interest |
| 4 | `Exchange Delivered Out` | `EXCHANGE` (leg: delivered) | Pair with Received In |
| 4 | `Exchange Received In` | `EXCHANGE` (leg: received) | Pair with Delivered Out |
| 2 | `Cash in Lieu` | `CASH_IN_LIEU` | Fractional share cash |
| 1 | `Cancel Sold` | `CANCEL` | Reversal of errant sell before reinvest |
| 1 | `Redemption` | `REDEMPTION` | Cash merger / exchange for cash |
| 1 | `Stock Split` | `STOCK_SPLIT` | Ratio in description |
| 4 | *(footer disclaimers)* | *(exclude)* | Non-transaction prose rows |

### Foundation v1 gap

`INVESTMENT_PORTFOLIO_ACTIVITY_TYPES_` today includes `BUY`, `SELL`, `DIVIDEND`, `REINVESTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `SPLIT`, `FEE`, `INTEREST`, `CORPORATE_ACTION`, `UNSUPPORTED` but **not**:

- `QUALIFIED_DIVIDEND`
- `STOCK_SPLIT` (maps to `SPLIT` or new alias)
- `EXCHANGE`
- `REDEMPTION`
- `CASH_IN_LIEU`
- `CANCEL`

**Recommendation before adapter:** extend foundation enum **or** map to `activitySubtype` on canonical rows while keeping primary type conservative (e.g. `DIVIDEND` + subtype `QUALIFIED`; `CORPORATE_ACTION` + subtype `EXCHANGE_RECEIVED`).

User-requested adapter-facing taxonomy should be preserved in **`activitySubtype`** at minimum even if primary enum stays narrower until Foundation v1.1.

### Mapping table (target adapter output)

| E*TRADE Activity Type | Condition | Canonical `activityType` | Canonical `activitySubtype` |
|----------------------|-----------|--------------------------|-------------------------------|
| `Bought` | — | `BUY` | — |
| `Sold` | — | `SELL` | — |
| `Qualified Dividend` | — | `QUALIFIED_DIVIDEND` | `CASH` |
| `Dividend` | Description contains `DIVIDEND REINVESTMENT` | `REINVESTMENT` | `DRIP` |
| `Dividend` | Otherwise | `DIVIDEND` | `CASH` |
| `Transfer` | Description `ACH DEPOSIT` | `CONTRIBUTION` | `ACH` |
| `Transfer` | Description `TFR TO ACCT` / `GIFT TFR` + negative qty | `TRANSFER_OUT` | `SECURITY` |
| `Transfer` | Incoming security transfer (positive qty) | `TRANSFER_IN` | `SECURITY` |
| `Online Transfer` | Amount > 0 | `TRANSFER_IN` or `CONTRIBUTION` | `ACH` |
| `Online Transfer` | Amount < 0 | `TRANSFER_OUT` or `WITHDRAWAL` | `ACH` |
| `Exchange Received In` | — | `EXCHANGE` | `RECEIVED` |
| `Exchange Delivered Out` | — | `EXCHANGE` | `DELIVERED` |
| `Cash in Lieu` | — | `CASH_IN_LIEU` | `FRACTIONAL` |
| `Stock Split` | — | `STOCK_SPLIT` | parse ratio from description |
| `Redemption` | — | `REDEMPTION` | `CASH_MERGER` |
| `Cancel Sold` | — | `CANCEL` | `SELL_REVERSAL` |
| `Service Fee` | — | `FEE` | `SERVICE` or `REORG` |
| `Interest Income` | — | `INTEREST` | `SWEEP` |
| Unknown future type | — | `UNKNOWN` | original Activity Type preserved |

---

## 3. Special row treatments

### 3.1 Dividend + reinvestment pairs

**Observed pattern (dominant):** same `Activity/Trade Date` + `Symbol` produces **two or three** rows:

1. `Qualified Dividend` — cash credit (positive `Amount $`, no quantity)
2. `Dividend` + description `… DIVIDEND REINVESTMENT` — share purchase (positive qty, **negative** amount)
3. Occasionally a third `Dividend` cash row without reinvest (foreign tax / gross-up variants)

**Combo frequency (sample):**

| Pattern | Approx. count |
|---------|---------------|
| Qualified + Reinvest only | 83 |
| Cash Dividend + Reinvest (no Qualified row) | 24 |
| Cash Dividend only | 16 |
| Qualified + Cash Dividend + Reinvest | 8 |
| Qualified only | 4 |

**Canonical treatment:**

- Emit **one income event** (`QUALIFIED_DIVIDEND` or `DIVIDEND`) for the cash credit amount.
- Emit **one `REINVESTMENT`** linked to the same `sourceDividendKey` / pairing group.
- **Do not** double-count income in holdings cash or portfolio income summaries.
- Link group id: `{tradeDate}|{symbol}|dividend-group` for review UI.
- Foreign tax / gross-up rows with `$0.00` amount → preserve as `UNSUPPORTED` or `DIVIDEND` subtype `TAX_ADJUSTMENT` with review flag.

**Observed edge case:** `Cancel Sold` immediately before reinvest `Bought` on same symbol/date/qty — treat as **single reinvest chain**, not a round-trip trade.

### 3.2 Security transfers vs purchases

| Signal | Treatment |
|--------|-----------|
| Activity Type `Transfer` + share qty + `$0` amount | `TRANSFER_OUT` / `TRANSFER_IN` — **no** cost basis from amount |
| Description `TFR TO ACCT` / `GIFT TFR` | Cross-account transfer; extract masked acct + `REFID` |
| Activity Type `Bought` / `Sold` | Normal trade; amount and commission apply |

Security transfers must **not** increment `Total Buy Cost` trade semantics or duplicate positions when receiving account is also in CashCompass.

### 3.3 Exchange received / delivered

**Observed:** paired legs on same date (sometimes 3 rows including cash-in-lieu whole shares):

- `Exchange Delivered Out` — negative qty, symbol often `--` on outbound leg
- `Exchange Received In` — positive qty, symbol on inbound leg
- Related `Cash in Lieu` may follow on a later settlement date

**Treatment:**

- Group as one `EXCHANGE` corporate action with two legs (+ optional `CASH_IN_LIEU`).
- Do not classify as sell + buy.
- Outbound symbol blank → resolve via description text + pairing group, not ticker alone.

### 3.4 Cash in lieu

Two forms observed:

1. Activity Type `Cash in Lieu` — fractional cash payment
2. `Exchange Received In` with description `CASH-IN-LIEU WHOLE SHRS`

Both → `CASH_IN_LIEU`; no share quantity; positive cash amount; link to parent exchange group.

### 3.5 Stock splits

Single row: Activity Type `Stock Split`, positive quantity adjustment, `$0` amount, ratio in description (e.g. `SPLIT RATIO 10:1`).

→ `STOCK_SPLIT`; store ratio in subtype/metadata; **do not** treat as buy.

### 3.6 Redemptions

Activity Type `Redemption` — negative qty, positive cash, price populated.

→ `REDEMPTION` / cash merger; removes position; realized detail for closed lots belongs in the **Gains & Losses PDF** (§8), not inferred from this row alone.

### 3.7 Cancel sold

→ `CANCEL` reversing a sell; must net against adjacent reinvest/buy rows on same date+symbol+qty.

### 3.8 Online transfers (ACH)

Cash only (`Symbol = --`). Infer:

- `ACH DEPOSIT` / positive amount → `CONTRIBUTION` or `TRANSFER_IN`
- `ACH WITHDRAWL` / negative amount → `WITHDRAWAL` or `TRANSFER_OUT`

These affect **cash balance** but not security holdings. Overlap with `INPUT - Investments` account total remains authoritative for Net Worth.

### 3.9 Commissions and fees

- Trade rows: `Commission` column (often `0.0`)
- `Service Fee` rows: separate activity; includes reorg fees and **reversals** (positive amount)

Normalize:

- `fees` = abs(commission) on trades
- Standalone `FEE` rows as separate activities
- Fee reversals → linked `FEE` with negative fee amount or `CANCEL` subtype `FEE_REVERSAL`

---

## 4. Date semantics

| E*TRADE field | Canonical use | Notes |
|---------------|---------------|-------|
| `Activity/Trade Date` | **`activityDate`** (primary) | Footer notes: for some Morgan Stanley accounts, Processing Date equals Activity Date |
| `Transaction Date` | **`transactionDate`** (metadata) | Usually equals Activity Date in sample |
| `Settlement Date` | **`settleDate`** | Empty on some dividend declarations; populated on trades |
| Positions PDF lot/acquisition date | **`acquisitionDate`** on open lots | Observed in symbol column on expanded lot rows (§7) |
| G/L PDF `Date Added` | **`acquisitionDate`** on closed lots | Populated on `Sell` lot rows (§8) |
| G/L PDF close `Date` | **`realizedCloseDate`** | Sale/close date on `Sell` lot rows; **only within owner-selected closing-date period** |

**Gains & Losses period limit:** The inspected export used a custom **Date From → Date Closed** window. Closed lots outside that window are **absent** even when Transactions CSV or open-lot history spans wider dates. Never treat G/L PDF as full lifetime realized history unless the owner exports a wider period.

**Recommendation:**

- Replay/dedupe primary date: **`Activity/Trade Date`**, fallback `Settlement Date` for settled trades only.
- Tax-lot acquisition date: prefer **Positions PDF** over inferred buy date when provider lot exists.
- Realized G/L: use **close date** from G/L PDF as authority for closed lots; do not infer from sell activity alone when G/L is supplied.

---

## 5. Replay / source-key recommendations

### Priority

1. **`REFID` from Description** when present (~6% of rows in sample — mostly ACH and account transfers)  
   `sourceRecordKey = 'REFID:' + digits`
2. **Deterministic fingerprint** (foundation `investmentPortfolioBuildActivityFingerprint_`) using:  
   `source + sourceAccountKey + activityDate + settleDate + activityType + symbol + quantity + price + amount + commission + normalizedDescription`
3. **Paired-event group key** for dividend reinvest triplets:  
   `DIVGROUP:{date}:{symbol}:{sequence}` — prevents partial replay from splitting pairs

### Overlapping two-year exports

Expected workflow: re-download overlapping CSV monthly.

| Outcome | When |
|---------|------|
| `EXACT_REPLAY` | Same `sourceRecordKey` or fingerprint match + equivalent fields |
| `NEW_RECORD` | New date/type not in prior import batch |
| `SOURCE_CORRECTION` | Same REFID/fingerprint but changed amount/qty/settle date |
| `CONFLICT` | Same key, materially different non-correction shape |

**Collision risks (documented):**

- Same-day identical trades without REFID
- Dividend triplet partial overlap if grouping logic differs between imports
- Exchange multi-leg if legs imported in separate batches without group id

**Import batch metadata:** store `sourceFileFingerprint`, export date range from preamble, parser version `etrade-txn-csv-v1`.

---

## 6. Security identity strategy

### Observed (Transactions CSV)

- **Symbol:** primary identifier; populated on most security rows
- **CUSIP:** column present but **entirely `--`** in sample — do not rely on txn CSV for CUSIP
- **Description:** required for type disambiguation (reinvest, exchange, merger)

### Observed (Expanded Positions PDF)

- **Symbol** on position header rows only; open-lot child rows use **acquisition date** (`MM/DD/YYYY`) in the symbol column
- **Security type label** adjacent to symbol on header rows: observed value **`Trade`** for all 32 positions (ETFs/equities share the same label)
- **CUSIP** appears in UI filter text (`Symbol / CUSIP`) but **not** as a per-row column in the extracted table
- **Wash sale:** lot acquisition dates may suffix **` WS`**; footer legend: *“WS This lot has been adjusted for wash sales”*
- **Special corporate events** may show a marker on the position header row (UI icon; treat as review flag)

### Matching priority (align with foundation)

1. `(ETRADE_PACKAGE, sourceSecurityKey)` where `sourceSecurityKey` = normalized symbol from export
2. **CUSIP** when a future export exposes it (not present in inspected txn CSV or positions table text)
3. Normalized **symbol + security type** (infer ETF vs equity from name/description when type label is generic `Trade`)
4. Manual review queue

### `stableSecurityId`

Assign on first sighting:

```
stableSecurityId = SEC-{hash(source + normalizedSymbol + securityType)}
```

Register in future `SYS - Investment Securities` on first persistence (not during inspection).

**Do not** use ticker alone as lot identity when exchange/rename events exist (symbol blank on delivered-out leg).

---

## 7. Holdings authority and open-lot authority

### Expanded Positions PDF — observed structure

**Provenance:** E*TRADE Portfolios → Positions (expanded open-lot view), saved as PDF.  
**Pages:** 40 (38 data pages + 2 disclosure pages).  
**Snapshot as-of:** header `Refresh` timestamp (observed format: `Aug DD, YYYY HH:MM PM ET`).  
**Position count:** footer reports `Viewing N of N positions` (observed example N = 32; use export footer, not hard-coded count).

**Account header block (each export):**

- Net Account Value
- Total Unrealized Gain ($ and %)
- Day's Gain Unrealized
- Cash Purchasing Power / Available for Withdrawal

**Logical columns (position header + lot rows):**

| Column | Header row | Open-lot row |
|--------|------------|--------------|
| Identity | Symbol + type label (`Trade`) | Acquisition date (`MM/DD/YYYY` or `MM/DD/YYYY WS`) |
| Quote | Last Price $, Change $, Change % | Same (inherited from parent) |
| Position | Qty # (aggregate), Price Paid $ | Qty # (lot), Price Paid $ (lot) |
| P&L | Day's Gain $, Total Gain $, Total Gain % | Same fields at lot granularity |
| Value | Value $ | Value $ |

**Row types:**

| Row kind | Detection | Canonical target |
|----------|-----------|------------------|
| Position header | Symbol + `Trade` + aggregate qty | `holdingsSnapshots[]` aggregate + parent for lots |
| Open lot | Date in symbol column | `taxLots[]` open / `PROVIDER_REPORTED` |
| Cash | `Cash` + `Transfer money` | Cash snapshot (not security holding) |
| Page total | `Total` row repeating account rollup | **Exclude** from holdings parse (parser noise) |

**Footnotes observed:**

- *“The total amount of the price paid column reflects the total costs of all open positions”* — aggregate **Price Paid $** on header rows is total cost basis for open positions, not per-share on every row.
- *“Partially delayed quotes”* — `priceAsOf` / stale quote reconciliation may apply.

### Authority model

| Source | Authority | Use |
|--------|-----------|-----|
| Transactions CSV (reconstructed) | `CASHCOMPASS_RECONSTRUCTED` | Audit trail; qty/cash reconstruction |
| Positions PDF position header | `PROVIDER_REPORTED` | Current aggregate qty, last price, market value |
| Positions PDF open-lot rows | `PROVIDER_REPORTED` | Acquisition date, lot qty, price paid, unrealized G/L, wash-sale |
| Cash row | `PROVIDER_REPORTED` | Sweep cash only; does not override `SYS - Assets` account total |

**Reconciliation (Foundation v1 contract):**

- `reconstructedQuantity` vs sum(open lots) vs header aggregate qty
- `providerMarketValue` vs `calculatedMarketValue` with `PRICE_STALE` when quote delayed
- Open-lot `Price Paid $` sum vs header cost — expect footnote semantics (total open cost)

**Net Worth:** `INPUT - Investments` → `SYS - Assets` **remains authoritative**; holdings MV is intelligence/reconciliation only.

---

## 8. Realized gains authority and date-range limitation

### Gains & Losses PDF — observed structure

**Provenance:** E*TRADE Portfolios → Gains & Losses, custom date range, saved as PDF.  
**Pages:** 16 (15 data + wash-sale legend footer).  
**Selected period:** custom **Date From → Date Closed** (observed example spans three years; exact dates vary by owner export).

**Critical limitation:** This PDF reports **realized closed lots only for the selected closing-date period**. It is not full account tax history. Re-export with a wider period if older closes are required.

**Period summary block:**

| Field | Meaning |
|-------|---------|
| Total Gain | Realized gain across selected closes |
| Short-Term Gain | Subtotal short-term |
| Long-Term Gain | Subtotal long-term |
| Deferred Loss | Wash-sale deferred loss (account-level total in period summary) |
| Total Commission & Fees | Fees in scope |

**Logical columns:**

| Column | Symbol summary row | Closed-lot (`Sell`) row |
|--------|-------------------|-------------------------|
| Symbol | Ticker | Literal `Sell` |
| Qty # | Aggregate closed qty | Lot quantity |
| Date Added | `--` | Acquisition date |
| Cost / Share | `--` | Per-share cost |
| Total Cost | Aggregate cost | Lot total cost |
| Date | `--` | **Close date** (sale date) |
| Price / Share | `--` | Sale price per share |
| Proceeds | Aggregate proceeds | Lot proceeds |
| Gain $ | Aggregate realized gain | Lot realized gain |
| Deferred Loss $ | `--` or aggregate | Per-lot deferred loss (may be negative) |
| Term | `Long`, `Short`, or `Mixed` | `Long` or `Short` |
| Lot Selection | `--` | **`FIFO`** (observed on all sell rows) |

**Row hierarchy:**

1. **Symbol summary** — one row per symbol with totals; detail columns `--`
2. **Sell lot rows** — one row per closed FIFO lot under that symbol

**Footer:** `As of MM/DD/YYYY` + wash-sale legend (*“WS This lot has been adjusted for wash sales”*).

### Authority and limitations

| Source | Scope | Authority |
|--------|-------|-----------|
| Gains & Losses PDF | Owner-selected close-date window only | `PROVIDER_REPORTED` for **closed lots in range** |
| Transactions CSV `Sold` rows | Txn export window (~2 years in sample) | Activity audit; **not** tax-lot authoritative when G/L supplied |

**Limitations:**

- Closes **before the selected Date From** are absent from the export
- Txn CSV sells inside the window may not 1:1 match G/L rows (lot splitting, FIFO, wash adjustments)
- `Mixed` term at symbol summary requires review — do not flatten to single term
- Negative **Deferred Loss $** on individual lots (observed) must be preserved, not clamped to zero
- Do not infer closed-lot history from sells alone when G/L PDF is in the import package

---

## 9. Tax-lot authority classification

| Data | Classification |
|------|----------------|
| Positions PDF open-lot rows | `PROVIDER_REPORTED` |
| G/L PDF closed lots | `PROVIDER_REPORTED` (realized) |
| Activity-derived FIFO lots | `CASHCOMPASS_RECONSTRUCTED` |
| Aggregate cost on position without lot expansion | `AGGREGATE_ONLY` |
| Missing lot detail | `UNKNOWN` |

**Precedence:** Provider open/closed lots > reconstructed > aggregate-only. Never fabricate lot-level accuracy from `Total Buy Cost` semantics.

---

## 10. RSU / stock-plan double-counting prevention

### CashCompass account model (from capital allocation regressions)

Separate stable identities expected (per capital allocation regression design):

- **Taxable brokerage pool** — primary trading account (`INV-*` operational id)
- **RSU/ESPP / stock-plan pool** — separate Investment Id; never merge with taxable pool

### Sample inspected

- Transactions CSV covers **one account** (preamble account suffix only); **no RSU/ESPP/vest activity rows** in txn sample
- Footer disclaimers reference ESOP third-party sourcing — informational only

### Rules (design)

| Risk | Prevention |
|------|------------|
| RSU vest shares appear in brokerage + income in Cash Flow | Tag plan-sourced transfers; exclude vest from `CURRENT_SPENDABLE` income bucket |
| Same shares in taxable + RSU/ESPP pools | One **stableAccountId** per E*TRADE pool; never merge imports |
| Transfer between E*TRADE sub-accounts | `TRANSFER_OUT` / `TRANSFER_IN` pair; no BUY/SELL |
| RSU sold for taxes in brokerage | Preserve as SELL with subtype review; do not duplicate in plan account |
| Net Worth double count | Account totals remain per **INPUT - Investments** row; holdings import does not override |

**Gap:** RSU/ESPP **stock-plan export format** not in sample set — need owner export from plan account or confirm plan activity appears in standard txn CSV.

---

## 11. Missing fields, ambiguities, review-required cases

| Item | Status |
|------|--------|
| Positions PDF → structured parse rules | **Inspected** — PDF text hierarchy documented; parser not implemented |
| G/L PDF → structured parse rules | **Inspected** — column/row model documented; parser not implemented |
| PDF vs CSV export parity | **Unknown** — no structured Positions/G-L CSV in sample (Download stubs invalid) |
| CUSIP in any inspected source | **Not in row data** — txn column empty; positions table text has no CUSIP column |
| Category / Note columns | Unused in sample |
| Stable broker transaction id column | **Absent** — only REFID in description (~6%) |
| Blank Activity Type footer rows | Must filter (4 rows) |
| `Qualified Dividend` vs `Dividend` tax distinction | Map to `QUALIFIED_DIVIDEND` vs `DIVIDEND`; income bucket still derived from registration |
| Foreign tax / gross-up dividend rows | Review-required; `$0` amount rows |
| Exchange outbound symbol blank | Resolve via pairing + description |
| Multi-account CSV | Sample is single-account; multi-account export behavior unknown |
| Options / bonds / mutual funds | Not observed in sample types — may appear as `UNKNOWN` until mapped |

---

## 12. Synthetic fixture plan (Git-safe)

**No real brokerage data in Git.** Fixtures under `test/fixtures/etrade/` (future):

### `synthetic_etrade_txn_minimal.csv`

- Preamble with **fake** account label `TEST-ACCT-0001` and date range
- Rows covering: BUY, SELL, QUALIFIED_DIVIDEND + REINVESTMENT pair, cash DIVIDEND, ACH deposit/withdrawal, security TRANSFER, EXCHANGE in/out + CASH_IN_LIEU, STOCK_SPLIT, REDEMPTION, FEE + reversal, INTEREST, CANCEL_SOLD
- Footer disclaimer rows (must be skipped)
- Symbols: `SYNAAA`, `SYNBBB`, `SYNETF` only

### `synthetic_etrade_positions_snapshot.json`

- Mimics Positions PDF parse output (not raw PDF bytes in Git)
- 2 symbols (`SYNAAA`, `SYNETF`), each with header aggregate + 2 open-lot children
- One lot with `acquisitionDate` suffix ` WS` for wash-sale parser test
- Cash row + explicit **excluded** page-total row for negative testing
- `authority: PROVIDER_REPORTED`, fake `priceAsOf` timestamp

### `synthetic_etrade_open_lots.json`

- Normalized open lots extracted from snapshot; `lotAuthority: PROVIDER_REPORTED`
- Fields: acquisitionDate, quantity, pricePaid, marketValue, unrealizedGain, washSaleAdjusted

### `synthetic_etrade_realized_gl.json`

- Mimics G/L PDF parse output for custom period `2023-01-01` → `2026-01-01`
- Symbol summary + 2 `Sell` lot rows: one Long FIFO, one Short FIFO
- One lot with negative `deferredLoss` (e.g. `-0.13`)
- `Mixed` term symbol summary row for review-path testing

### Regression coverage (future adapter phase)

- Preamble/footer stripping
- Activity type mapping table
- Dividend pair grouping (no double income)
- Exchange leg grouping
- REFID extraction + fingerprint fallback
- Overlapping import replay outcomes
- Positions vs reconstructed reconciliation classifications

---

---

## Cross-reference updates (reconciliation pass)

| File | Update |
|------|--------|
| `MULTI_BROKER_PORTFOLIO_DATA_MODEL.md` | Link here; next milestone → preview-only E*TRADE adapter |
| `ROADMAP.md` | Single status: E*TRADE Source Inspection **complete** |
| `investment_portfolio_foundation.js` | Future: extend activity enum or subtype mapping |
| `investment_adapters.js` | Future: register `ETRADE_PACKAGE` after fixtures (not started) |

## Adapter package contract (proposed)

```javascript
{
  source: 'ETRADE_PACKAGE',
  files: [
    { role: 'ACTIVITY', format: 'CSV', required: true },
    { role: 'HOLDINGS', format: 'PDF', required: false },           // Expanded Positions
    { role: 'REALIZED_GAIN_LOSS', format: 'PDF', required: false }  // Gains & Losses
  ],
  capabilities: {
    activities: true,
    holdings: true,
    taxLots: true,           // open lots from Positions PDF
    realizedGainLoss: true,  // closed lots from G/L PDF
    accountSnapshot: true    // header block: cash, MV, as-of
  }
}
```

**Detect rules (proposed):**

- CSV: preamble contains `Activity/Trade Date` header row after account line
- Positions PDF: URL/footer contains `portfolios/positions`; columns `Price Paid $` + `Total Gain %`
- G/L PDF: URL/footer contains `gains-and-losses`; columns `Date Added` + `Lot Selection`

---

## Readiness assessment

| Gate | Ready? |
|------|--------|
| Transactions CSV structural mapping | **Yes** |
| Positions PDF structural mapping (open lots) | **Yes** |
| G/L PDF structural mapping (closed lots, period-scoped) | **Yes** |
| Structured Positions/G-L CSV availability | **Unresolved** |
| Foundation enum/subtype support | **Partial** — extend or use `activitySubtype` |
| PDF parser implementation | **No** — design only |
| Synthetic fixtures | **Not started** — plan defined |
| Preview-only adapter design | **Yes** — may begin after owner approves this doc |
| Persistence / production import | **No** |

**Overall:** The **source mapping contract** is ready for **preview-only `ETRADE_PACKAGE` adapter design** (Phases A–C below). Parser code, synthetic fixtures, owner preview validation, and an explicit persistence approval gate remain before any workbook writes.

---

## Recommended next development step

1. **Owner review:** Approve `ETRADE_SOURCE_MAPPING.md` for commit (structural findings only; no real data in repo).
2. **Engineering (after approval):** Extend foundation activity subtypes → build synthetic fixtures → implement **preview-only** `ETRADE_PACKAGE` adapter:
   - Phase A: Transactions CSV → normalized activity preview
   - Phase B: Expanded Positions PDF → open lots + holdings snapshot preview
   - Phase C: Gains & Losses PDF → period-scoped realized closed-lot preview
3. **Owner validation:** Compare preview summaries against live exports **outside Git** before any persistence or dashboard wiring.

**Do not implement persistence, dashboard upload, workbook sheet creation, or production import until preview-only adapter passes owner review.**
