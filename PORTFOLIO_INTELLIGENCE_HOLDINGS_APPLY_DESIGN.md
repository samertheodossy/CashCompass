# Portfolio Intelligence — Unified Holdings Apply (Future Design)

**Status:** Design only — **not implemented**. Step 3/3B remain preview-only.

This document describes the smallest safe Apply path after bounded and Central preview validation.
It does not authorize implementation without an explicit owner review gate.

---

## Authority boundaries (unchanged)

| Layer | Role after Apply |
|-------|------------------|
| `INPUT - Investments` | Remains the **account-level monthly value** source for Net Worth and Planning |
| Unified holdings sheet (new) | **Detailed security rows** for portfolio intelligence — one sheet for all brokers |
| `SYS - Assets` | Account registry row (name, type, balance); **not** per-broker holdings duplication |
| Planning / Net Worth / Cash Flow / debt | Unchanged until a separate approved slice wires holdings-derived signals |

Apply must never silently overwrite ambiguous accounts or infer registration type from PDF labels.

---

## Target sheet: unified holdings (proposed name)

**`SYS - Investment Holdings Unified`** (exact name subject to owner schema review; one sheet, not one per broker).

Each row represents one security snapshot line for one account at one as-of instant.

### Required columns (minimum)

| Column | Purpose |
|--------|---------|
| Broker / Source | `ETRADE_POSITIONS_PDF`, `M1_STATEMENT_PDF`, `ROBINHOOD_CSV`, … |
| stableAccountId | Durable CashCompass account identity |
| Account Name | Display label at apply time |
| sourceSecurityKey | Durable security identity within source |
| Symbol | Ticker when present |
| Shares | Quantity |
| Price | Mark price when present |
| Market Value | Position market value |
| Cost Basis | When source provides it |
| As-Of Date | Statement / positions snapshot date |
| Import Status | e.g. `PREVIEWED`, `APPLIED`, `SUPERSEDED`, `REVIEW_REQUIRED` |

Optional additive columns may mirror `INVESTMENT_HOLDINGS_EXTENDED_HEADERS_` (share class, exchange, unrealized G/L) when the source supplies them.

Robinhood activity-reconstructed holdings remain on the existing Robinhood path until an explicit migration slice is approved.

---

## Apply workflow (explicit confirmation required)

1. **Preview** — current Step 3/3B adapters produce `PORTFOLIO_INTELLIGENCE_HOLDINGS_V1` in memory only.
2. **Diff** — show complete before/after for the selected `stableAccountId`:
   - rows to add, update, mark superseded, or leave unchanged
   - account-level total vs `INPUT - Investments` monthly value (informational; no auto-sync)
3. **Confirm** — owner checks explicit account match again; registration type must match registry or an approved correction flow.
4. **Write** — append/replace rows only on the unified holdings sheet for that account + as-of scope; log to Activity.
5. **No auto-map** — if identity is ambiguous, Apply is blocked with the same fail-closed codes as preview.

Apply must **not**:

- write raw document text
- overwrite `INPUT - Investments` monthly totals automatically
- change Planning authority, debt schedules, or Cash Flow
- merge multiple documents for one account in one action without an explicit multi-file review UI (future)

---

## Next implementation slice (after preview sign-off)

1. First-create unified holdings sheet schema (empty workbook only; no migration wash).
2. Read-only diff builder comparing preview envelope to existing unified rows for one `stableAccountId`.
3. Explicit Apply RPC with lock, rollback, and disposable-workbook regression proof.
4. Only then connect income/debt-payoff analysis to classified distribution adapters.
