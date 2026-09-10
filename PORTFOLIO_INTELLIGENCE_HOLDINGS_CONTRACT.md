# Portfolio Intelligence — Unified Holdings Data Contract (Step 1)

**Status:** Contract definition — **preview contract shipped; bounded Apply to Unified holdings implemented locally (2026-09-09, not deployed).**
**Version:** `PORTFOLIO_INTELLIGENCE_HOLDINGS_V1` (schema `1.0.0`)  
**Extends:** `investment_portfolio_foundation.js`, `MULTI_BROKER_PORTFOLIO_DATA_MODEL.md`, `ETRADE_SOURCE_MAPPING.md`

This document defines the **minimal additive read model** required before CashCompass can produce explainable portfolio recommendations (passive income, debt-payoff funding, retirement around age 58 using Social Security, 401(k), taxable investments, rental income, and Robinhood income).

**Not in Step 1:** stock recommendations, E*TRADE Positions/Gains parsers, M1 parser, persistence, dashboard upload, Planning/Net Worth/Cash Flow changes, automatic trading, or brokerage API execution.

---

## Design principles

1. **One canonical read model** for Robinhood, E*TRADE, M1, and 401(k) summary data — provider schemas stop at the adapter boundary.
2. **Preview-first:** upload → parse → preview → explicit owner selection → apply (future). Step 1 is preview contract only.
3. **Identity is protected:** `Investment Id` / `stableAccountId` / `stableSecurityId` / `stableLotId` — never raw provider account numbers in customer-visible output.
4. **Ticker alone is not durable security identity** when CUSIP, ISIN, or `(source, sourceSecurityKey)` exists or is required.
5. **No auto-map, no auto-apply:** account association requires explicit owner confirmation; imports never silently change Planning authority.
6. **Fail closed:** stale, conflicting, incomplete, or ambiguous data blocks recommendation trust flags — it does not get silently repaired.

---

## Relationship to existing models

| Layer | Reuse |
|-------|--------|
| Account identity | `SYS - Financial Accounts`, `Investment Id`, `stableAccountId`, `Registration Type`, `Domain` (`financial_identity.js`) |
| Activity ledger | `SYS - Investment Activity` + extended provenance columns (Robinhood production path unchanged) |
| Holdings rows | `SYS - Investment Holdings` legacy columns + `INVESTMENT_HOLDINGS_EXTENDED_HEADERS_`; **`SYS - Investment Holdings Unified`** for bounded M1/E*TRADE statement Apply (19 columns — see `PORTFOLIO_INTELLIGENCE_HOLDINGS_APPLY_DESIGN.md`) |
| Tax lots | `INVESTMENT_TAX_LOT_HEADERS_` (first-create only; not opened on dashboard load) |
| Securities registry | `INVESTMENT_SECURITIES_HEADERS_` |
| Financial Facts | Part 2A fact types for account **values** at planning boundaries — holdings contract does **not** replace `INPUT - Investments` Net Worth authority |
| Adapter envelope | `investmentPortfolioBuildImportPreviewSummary_`, capabilities, replay outcomes |
| E*TRADE Phase A | `investment_etrade_csv.js` — activities only; maps into `activities[]`, not holdings yet |
| Robinhood | `investmentPortfolioNormalizeRobinhoodPreview_` — activities only today; holdings remain activity-reconstructed |

---

## Unified preview envelope

All broker adapters (future) normalize into this **read-only preview** shape:

```javascript
{
  contractVersion: 'PORTFOLIO_INTELLIGENCE_HOLDINGS_V1',
  schemaVersion: '1.0.0',              // INVESTMENT_PORTFOLIO_SCHEMA_VERSION_
  previewOnly: true,                     // mandatory true in Step 1
  asOf: '2026-08-15T20:00:00.000Z',      // CashCompass comparison instant
  observedAt: '2026-08-15T14:00:00.000Z', // receipt instant; excluded from replay keys

  source: 'ROBINHOOD_CSV' | 'ETRADE_PACKAGE' | 'M1_CSV' | 'RETIREMENT_PLAN_CSV' | ...,
  parserVersion: 'etrade-txn-csv-v1',
  sourceFiles: [{
    role: 'ACTIVITY' | 'HOLDINGS' | 'REALIZED_GAIN_LOSS' | 'ACCOUNT_SNAPSHOT',
    fileName: 'sanitized-label-only',
    sourceFileFingerprint: 'sha256:...',
    sourceAsOf: '2026-08-15T13:00:00.000Z',  // provider snapshot / export instant
    parserVersion: '...'
  }],

  capabilities: {
    activities: false,
    holdings: false,
    taxLots: false,
    accountSnapshot: false,
    dividendHistory: false,
    realizedGainLoss: false
  },

  accounts: [ /* UnifiedAccount */ ],
  securities: [ /* UnifiedSecurity */ ],
  holdings: [ /* UnifiedHoldingSnapshot */ ],
  taxLots: [ /* UnifiedTaxLot — open lots */ ],
  realizedGainLoss: [ /* UnifiedRealizedGainLoss — closed lots */ ],
  distributions: [ /* UnifiedDistribution — income events, not total return */ ],
  accountSnapshots: [ /* 401(k) / cash rollup summaries */ ],

  activities: [ /* existing normalized activity rows when package includes activity */ ],

  importSummary: { /* investmentPortfolioBuildImportPreviewSummary_ */ },
  recommendationReadiness: {
    trustedForHoldingsVisibility: false,
    trustedForIncomeAnalysis: false,
    trustedForTaxLotSalePlanning: false,
    blockingReasons: ['SOURCE_INCOMPLETE']
  },

  warnings: [],
  unsupportedRows: []
}
```

Validation entry point: `investmentPortfolioValidateUnifiedHoldingsPreview_(preview)`.

Empty shell: `investmentPortfolioBuildEmptyHoldingsPreview_(options)`.

---

## UnifiedAccount

| Field | Required | Notes |
|-------|----------|-------|
| `investmentId` | one of id pair | Existing Robinhood operational id (`INV-*`) |
| `stableAccountId` | one of id pair | CashCompass Financial Identity link |
| `institution` | yes | Display/normalized label — **not** identity |
| `displayName` | yes | Mutable label — **not** identity |
| `accountType` | yes | Broker account type string (Checking, Brokerage, 401(k), …) |
| `registrationType` | yes | `TAXABLE`, `TRADITIONAL_IRA`, `ROTH_IRA`, `401K`, … |
| `domain` | derived | `INVESTMENT` or `RETIREMENT` via `investmentPortfolioResolveDomainForRegistration_` |
| `taxStatus` | derived | `TAXABLE` or `RETIREMENT` via `investmentPortfolioResolveTaxStatus_` |
| `portfolioRoles` | optional | `PROTECTED`, `INCOME_PRODUCING`, `DO_NOT_SELL_FOR_CASH_FUNDING`, … |
| `active` | yes | Inactive accounts fail closed for import association |
| `matchStatus` | preview | `EXACT_LINK`, `EXPLICIT_MATCH`, `REVIEW_REQUIRED`, `AMBIGUOUS`, `CONFLICT` — never auto-map |

**Taxable vs retirement separation:** recommendations must filter by `taxStatus`. Robinhood passive-income accounts may be `TAXABLE` + `INCOME_PRODUCING` + `DO_NOT_SELL_FOR_CASH_FUNDING`. 401(k) rows use `taxStatus: RETIREMENT` and are excluded from taxable liquidation recommendations by default.

---

## UnifiedSecurity

| Field | Required | Notes |
|-------|----------|-------|
| `stableSecurityId` | yes | `SEC-{digest}` — assigned on first sighting |
| `ticker` | conditional | Required when no CUSIP/ISIN; normalized uppercase |
| `cusip` | optional | Preferred when trustworthy |
| `isin` | optional | Preferred when trustworthy |
| `securityName` | recommended | Provider display name |
| `securityType` | yes | `EQUITY`, `ETF`, `MUTUAL_FUND`, `BOND`, `OPTION`, `CASH_EQUIVALENT`, `CRYPTO`, `UNKNOWN` |
| `assetClass` | recommended | `US_EQUITY`, `INTL_EQUITY`, `FIXED_INCOME`, `CASH`, `ALTERNATIVE`, `UNKNOWN` |
| `primarySource` | yes | e.g. `ETRADE_PACKAGE`, `ROBINHOOD_CSV` |
| `sourceSecurityKey` | yes* | Provider-stable key (*required unless CUSIP/ISIN present) |

**Matching priority** (reuse `investmentPortfolioMatchSecurity_`):

1. `(primarySource, sourceSecurityKey)`
2. CUSIP
3. ISIN
4. `(ticker, securityType)` — fallback only
5. `UNRESOLVED` → manual review; fail closed for lot-level recommendations

**Duplicate securities across accounts:** same `stableSecurityId` appears on multiple `UnifiedHoldingSnapshot` rows distinguished by `stableAccountId`. Never merge positions across accounts by ticker alone.

---

## UnifiedHoldingSnapshot (position-level)

| Field | Required | Notes |
|-------|----------|-------|
| `stableAccountId` | yes | |
| `stableSecurityId` | yes | |
| `ticker` | display | Copy for UI; not authoritative identity |
| `shares` | yes | Signed quantity; 0 allowed with explicit meaning |
| `price` | conditional | Required unless `marketValue` provider-reported |
| `priceAsOf` | conditional | Required when `price` present |
| `marketValue` | conditional | Provider-reported MV or `shares × price` |
| `providerCostBasis` | optional | Aggregate basis when lots unavailable |
| `costBasisQuality` | yes | `PROVIDER_LOT`, `PROVIDER_AGGREGATE`, `RECONSTRUCTED`, `UNKNOWN` |
| `unrealizedGainLoss` | optional | Provider-reported or derived; mark quality |
| `authority` | yes | `PROVIDER_REPORTED`, `CASHCOMPASS_RECONSTRUCTED`, `HYBRID` |
| `source` | yes | Adapter source enum |
| `sourceSnapshotKey` | yes | Protected replay identity (excludes `observedAt`) |
| `sourceAsOf` | yes | Provider snapshot timestamp |
| `sourceFileFingerprint` | recommended | File-level dedupe |
| `dataQuality` | yes | `PROVIDER_REPORTED`, `NORMALIZED`, `INFERRED`, `UNKNOWN` |
| `freshness` | derived | `CURRENT`, `RECENT`, `AGING`, `STALE`, `UNKNOWN` |
| `confidence` | derived | `HIGH`, `MEDIUM`, `LOW` |
| `replayKey` | derived | `investmentPortfolioBuildHoldingsSnapshotReplayKey_` |
| `replayOutcome` | optional | When compared to prior preview/import |

Robinhood today: holdings remain `CASHCOMPASS_RECONSTRUCTED` from activity until provider snapshot adapters exist. `Total Buy Cost` ≠ tax cost basis.

---

## UnifiedTaxLot (open)

Maps to `INVESTMENT_TAX_LOT_HEADERS_` / E*TRADE Expanded Positions PDF (Phase B).

| Field | Required | Notes |
|-------|----------|-------|
| `stableLotId` | yes | |
| `stableAccountId`, `stableSecurityId`, `ticker` | yes | |
| `acquisitionDate` | yes | Positions PDF authority over inferred buy date |
| `originalQuantity`, `remainingQuantity` | yes | |
| `costPerShare`, `originalCostBasis`, `adjustedCostBasis` | conditional | Wash-sale adjusted basis when marked ` WS` |
| `lotAuthority` | yes | `PROVIDER_REPORTED`, `CASHCOMPASS_RECONSTRUCTED`, `AGGREGATE_ONLY`, `UNKNOWN` |
| `currentPrice`, `currentValue`, `unrealizedGainLoss` | optional | |
| `holdingPeriodDays`, `termStatus` | optional | `SHORT`, `LONG`, `UNKNOWN` |
| `sourceLotKey` | yes | Protected replay identity |
| `sourceAsOf` | yes | Positions PDF refresh timestamp |
| `replayKey` | derived | |

**Do not fabricate** true lots from aggregate cost basis (`AGGREGATE_ONLY` blocks tax-lot sale planning).

---

## UnifiedRealizedGainLoss (closed — Phase C)

Maps to E*TRADE Gains & Losses PDF. **Period-scoped only** — never full lifetime unless owner exports wide window.

| Field | Notes |
|-------|-------|
| `realizedCloseDate` | G/L PDF close date authority |
| `acquisitionDate` | `Date Added` on sell lot row |
| `realizedGainLoss` | Short/long term columns when present |
| `termStatus` | `SHORT`, `LONG` |
| `sourceLotKey` | Protected replay identity |
| `sourcePeriodStart`, `sourcePeriodEnd` | Owner-selected export window |

Transactions CSV `Sold` rows alone are **insufficient** for closed-lot tax detail when G/L PDF is available.

---

## UnifiedDistribution (income — not total return)

Distributions are **cash or reinvest income events**. They are distinct from:

- **Total return** (price appreciation + dividends)
- **Market value changes**
- **Aggregate `Dividends Received`** on holdings rows (derived summary cache, not canonical income history)

| Field | Required | Notes |
|-------|----------|-------|
| `stableAccountId` | yes | |
| `stableSecurityId` | optional | Cash sweep interest may omit |
| `amount` | yes | Signed cash effect |
| `distributionDate` | yes | Activity/trade date or pay date |
| `classification` | recommended | See enum below |
| `activityType` | optional | Link to normalized activity when sourced from ledger |
| `sourceRecordKey` | yes | Row-level replay identity |
| `sourceAsOf` | optional | Export/snapshot instant |
| `incomeBucket` | derived | `CURRENT_SPENDABLE_PORTFOLIO_INCOME` vs `RETIREMENT_PORTFOLIO_INCOME` |
| `replayKey` | derived | `investmentPortfolioBuildDistributionReplayKey_` |

**Classification enum:** `QUALIFIED_DIVIDEND`, `ORDINARY_DIVIDEND`, `NON_QUALIFIED_DIVIDEND`, `INTEREST`, `RETURN_OF_CAPITAL`, `REINVESTMENT`, `CAPITAL_GAIN_DISTRIBUTION`, `UNKNOWN`.

Qualified vs ordinary affects future tax-aware recommendations but not Step 1 persistence.

---

## UnifiedAccountSnapshot (401(k) / cash rollup)

For retirement plan summary CSV/PDF and broker cash blocks without lot detail:

| Field | Notes |
|-------|-------|
| `snapshotType` | `401K_SUMMARY`, `RETIREMENT_BALANCE`, `CASH`, `MARGIN` |
| `marketValue` | Total account value |
| `cashBalance` | When split from invested balance |
| `employerMatchYtd` | When provided |
| `asOf` | Statement / export date |
| `authority` | `PROVIDER_REPORTED` |
| `sourceSnapshotKey` | Protected replay identity |

401(k) summary can support **visibility and allocation** recommendations without lot-level sell planning.

---

## E*TRADE Phase B/C mapping (future — not implemented in Step 1)

| Source file | Role | Maps to |
|-------------|------|---------|
| Transactions CSV | `ACTIVITY` | `activities[]`, `distributions[]` (dividend rows) — **Phase A done (preview)** |
| Expanded Positions PDF | `HOLDINGS` | `holdings[]` position headers + `taxLots[]` open lots (`PROVIDER_REPORTED`) |
| Gains & Losses PDF | `REALIZED_GAIN_LOSS` | `realizedGainLoss[]` closed lots for selected period only |

**Phase B blockers (Positions PDF):**

- PDF text/table extraction parser (`investment_etrade_positions_pdf.js` exists as scaffold)
- Position header vs open-lot row detection
- Wash-sale ` WS` suffix on acquisition dates
- Cash row vs security row separation
- Exclude repeating `Total` rollup rows
- Snapshot `Refresh` timestamp → `sourceAsOf`
- Merge with Phase A activities without double-counting dividends

**Phase C blockers (Gains & Losses PDF):**

- Period-scoped export window metadata
- Closed-lot columns (term, deferred loss, FIFO markers)
- Reconciliation against `Sold` activity rows

---

## M1 data requirements (adapter not implemented)

Contract-only source: `M1_CSV`. Required before M1 preview:

| Capability | Minimum data |
|------------|----------------|
| Activity | Buy/sell/dividend/reinvest/transfer rows with stable row identity |
| Holdings | Position snapshot or reconstructable from complete activity |
| Tax lots | If M1 export includes lot detail; otherwise mark `AGGREGATE_ONLY` |
| Distributions | Dividend/reinvest classification distinct from trade rows |
| Account | Explicit `stableAccountId` / `investmentId` association after owner confirmation |

M1 stop-funding / in-kind transfer scenarios in Planning remain separate policy decisions — import contract does not auto-execute them.

No M1 adapter code exists; `getInvestmentAdapter_('M1_CSV')` must throw `not implemented`.

---

## Replay identity

Priority (aligned with Part 2A and portfolio foundation):

1. `source + sourceAccountKey + sourceRecordKey` (activities, distributions)
2. `source + sourceAccountKey + sourceSnapshotKey + stableSecurityId` (holdings snapshots)
3. `source + sourceAccountKey + sourceLotKey` (tax lots / realized rows)
4. Deterministic normalized fingerprint (fallback — review-required for corrections)

**Excluded from replay keys:** `observedAt`, raw file bytes, customer display names, last-four digits alone.

**Outcomes:** `EXACT_REPLAY`, `NEW_RECORD`, `SOURCE_CORRECTION`, `CONFLICT` — same as `INVESTMENT_PORTFOLIO_REPLAY_OUTCOMES_`.

Stale or conflicting rows set `confidence: LOW` and add blocking reasons; they do not silently merge.

---

## Protected fields (never overwritten by import preview/apply)

| Authority | Owner |
|-----------|--------|
| `INPUT - Investments` account totals | Net Worth / Planning until separately approved migration |
| `INPUT - Debts`, Credit Limit, Credit Left | Debt authority |
| Planning queue, minimum releases, payoff confirmations | Part 1 Planning |
| Settings persistence | Settings sheets |
| Robinhood production import semantics | `investment_activity.js` path unchanged |

Step 1 preview performs **zero workbook writes**. **Bounded Apply (2026-09-09, local)** writes only to **`SYS - Investment Holdings Unified`** on explicit owner confirmation — see `bounded_holdings_preview_apply*.js`.

---

## SYS sheet audit (2026-09-09)

Repository-only inventory of all `SYS -` sheets: `test/fixtures/sys-sheet-audit-inventory.json` (`npm run test:sys-sheet-audit`). Read-only runtime snapshot for bounded workbooks: `sys_sheet_runtime_snapshot.js` (`npm run test:sys-sheet-runtime-snapshot`). No cleanup deletes/migrations authorized by the audit alone; Robinhood → Unified migration remains a separate approved slice.

---

## Recommendation-engine prerequisites

Future recommendations require these **trust flags** on the preview (computed by `investmentPortfolioEvaluateRecommendationReadiness_`):

| Flag | Minimum evidence |
|------|------------------|
| `trustedForHoldingsVisibility` | ≥1 holding with `shares`, (`marketValue` or `price`+`priceAsOf`), `sourceAsOf`, resolved `stableAccountId`, no `CONFLICT` |
| `trustedForIncomeAnalysis` | Distributions and/or dividend activities with `classification`, `distributionDate`, account `taxStatus`, freshness ≤ `AGING` |
| `trustedForTaxLotSalePlanning` | `PROVIDER_REPORTED` open lots with `acquisitionDate`, `remainingQuantity`, basis, `termStatus` or computable holding period; no `AGGREGATE_ONLY`-only positions for sell candidates |

**Always fail closed when:**

- `matchStatus` is `AMBIGUOUS`, `CONFLICT`, or `REVIEW_REQUIRED` for target account
- `replayOutcome` is `CONFLICT`
- `freshness` is `STALE` or `UNKNOWN` for price-sensitive recommendations
- `lotAuthority` is `AGGREGATE_ONLY` or `UNKNOWN` for lot-specific sell advice
- Security identity is `UNRESOLVED`
- Account is inactive or non-revolving/non-investment domain mismatch

---

## Next smallest implementation step

**Phase B — E*TRADE Expanded Positions PDF preview parser** (still preview-only):

1. Implement text extraction → `holdings[]` + `taxLots[]` in `investment_etrade_positions_pdf.js`
2. Normalize into this contract via adapter `preview()` merge with Phase A activities
3. Add fixture regressions; no persistence, no dashboard wiring
4. Owner review of synthetic + one real export before Phase C G/L PDF

---

## Related documents

- `MULTI_BROKER_PORTFOLIO_INTELLIGENCE.md` — product direction (Phase 1–8)
- `MULTI_BROKER_PORTFOLIO_DATA_MODEL.md` — Foundation v1 infrastructure
- `ETRADE_SOURCE_MAPPING.md` — inspected E*TRADE source structures
- `PART_2A_FINANCIAL_FACTS_CONTRACT.md` — import lifecycle and replay semantics
- `PART_2A_IDENTITY_CONTRACT.md` — account/source-link rules
