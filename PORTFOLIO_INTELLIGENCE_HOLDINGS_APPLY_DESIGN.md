# Portfolio Intelligence — Unified Holdings Apply (Future Design)

**Status:** **Implemented locally (2026-09-09) — not deployed.** Preview remains read-only until explicit Apply. Owner clasp push + bounded runtime proof are required before treating Apply as production-ready.

This document describes the smallest safe Apply path after bounded and Central preview validation.

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

## Target sheet: unified holdings

**`SYS - Investment Holdings Unified`** — config key `INVESTMENT_HOLDINGS_UNIFIED` in `config.js`.

Each row represents one security snapshot line (or cash line) for one account at one as-of instant.

### Implemented schema (19 columns)

Headers in `BOUNDED_HOLDINGS_UNIFIED_HEADERS_` (`bounded_holdings_preview_apply_sheet.js`):

Source · Provider · Parent CashCompass account · Child account/partition · Investment Id · Source security key · Symbol · Security name · Shares · Price · Market value · Cost basis · Unrealized gain/loss · **Cash balance** · As-of date · Document fingerprint · Import status · Imported at · Import run/reference

Formatting: currency on columns 11–14 (cash at column 14); as-of `yyyy-mm-dd`; imported-at timestamp; audit columns 4, 5, 6, 16, 19 **hidden** (not deleted).

Replay key: `source|accountIdentityKey|sourceSecurityKey|asOfDate`.

Robinhood activity-reconstructed holdings remain on **`SYS - Investment Holdings`** until an explicit migration slice is approved.

---

## Apply workflow (explicit confirmation required)

1. **Preview** — bounded preview adapters produce holdings in memory only (`bounded_holdings_preview.js` et al.).
2. **Diff** — `boundedHoldingsPreviewBuildApplyDiffFromDashboard` / grouped variant builds create/update/unchanged/conflict + document replay classification.
3. **Review** — `BoundedHoldingsPreviewUI.html` Apply section after successful preview.
4. **Apply** — `boundedHoldingsPreviewApplyFromDashboard` / grouped variant under document lock; rollback on failed write.
5. **No auto-map** — identity ambiguity blocks Apply (same fail-closed posture as preview).

Apply must **not**:

- write raw document text
- overwrite `INPUT - Investments` monthly totals automatically
- change Planning authority, debt schedules, or Cash Flow
- merge multiple documents for one account in one action without an explicit multi-file review UI (future)

---

## Implementation map (local)

| Module | Role |
|--------|------|
| `bounded_holdings_preview_apply_sheet.js` | Sheet I/O, 19-column schema, formatting, rollback helpers |
| `bounded_holdings_preview_apply_diff.js` | Diff builder, replay outcomes, duplicate noop |
| `bounded_holdings_preview_apply.js` | Apply RPCs from dashboard |
| `BoundedHoldingsPreviewUI.html` | Review / Apply / Cancel UI |
| `scripts/checkBoundedHoldingsPreviewApplyRegressions.mjs` | `npm run test:bounded-holdings-preview-apply` |

---

## Next gates (owner-operated)

1. Review + commit local source.
2. Owner `./push-central.sh` or bounded clasp push (whichever deployment target is approved).
3. Bounded runtime Apply proof on owner workbook (M1 + E*TRADE); run `adminGetSysSheetRuntimeSnapshot()` to confirm Unified row counts and cash currency display.
4. **Then** consider Robinhood → Unified migration design execution (separate approval — see audit fixture `robinhoodMigration`).

---

## Related audit artifacts

- `test/fixtures/sys-sheet-audit-inventory.json` — repository SYS inventory + cleanup classifications
- `test/fixtures/sys-sheet-runtime-snapshot-schema.json` — runtime diagnostic output schema
- `sys_sheet_runtime_snapshot.js` — read-only bounded workbook SYS snapshot
