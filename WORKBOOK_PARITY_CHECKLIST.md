# Workbook Parity Checklist

The engineering checklist for **Golden Workbook Convergence** — bringing every newly provisioned CashCompass workbook *toward* the **Golden Workbook** (the production workbook — the visual source of truth). See `GOLDEN_WORKBOOK.md` for what the standard is, why, and the four **design families**. This is a **convergence project, not a formatting redesign.**

**Status:** Documentation only. No code changes are authorized by this checklist. The **first Golden Workbook Audit is complete (2026-07-06)** — ten core user-facing sheets are visually verified and rated below. The remaining sheets stay **UNKNOWN** until audited; no convergence code is written for a sheet until its row is resolved out of **UNKNOWN**.

---

## How to use this checklist

1. **Audit the Golden Workbook** (capture the screenshots in the Validation section and record concrete attribute values from the production workbook). *Done for the ten core sheets on 2026-07-06.*
2. For each audited sheet, converge a **freshly provisioned** workbook *toward* the Golden Workbook standard for that sheet's **design family**.
3. Only after a sheet is **no longer UNKNOWN** may a convergence pass be written for it (one sheet per pass, additive first-create only — see `GOLDEN_WORKBOOK.md → §6`).

## Status legend

**Audit ratings** (quality of the production sheet as a reference — set by the Golden Workbook Audit):

- **★★★★★ Golden Reference** — a fully mature exemplar; it *defines* the standard for its design family.
- **★★★★☆ Production Ready** — polished and shippable; sets the family standard with only minor room for future refinement.

**Convergence status** (gap between a freshly provisioned sheet and the audited standard — used to scope the convergence pass):

- **COMPLETE** — fresh provisioned sheet is visually indistinguishable from the Golden Workbook.
- **MINOR DIFFERENCES** — small, low-effort convergence gaps (a few widths, a missing number format, a color tweak).
- **MAJOR DIFFERENCES** — substantial convergence gaps (no styling, wrong layout, missing structure).
- **UNKNOWN (requires visual comparison)** — not yet audited against the production workbook. **The honest default for any sheet the audit has not yet reached.**

> **Do not guess.** Ratings and parity are set only by looking at the actual production workbook — never inferred from code. The ten core user-facing sheets below carry their **verified 2026-07-06 audit rating**; the rest remain **UNKNOWN** until audited. The "Remaining gaps" column lists **convergence hypotheses for the auditor/implementer to confirm** — they are not parity conclusions.

---

## Checklist — user-facing sheets

Columns: **Sheet** · **Design family** · **Audit status** · **Convergence focus (fresh → Golden)** · **Est. effort** · **Priority**.
(Effort is a provisional estimate for the convergence pass and firms up as each pass is scoped. XS < 0.5d · S 0.5–1d · M 1–3d.)

**Audited 2026-07-06** — the ten core sheets below carry their verified audit rating; convergence work now targets the audited standard rather than a redesign.

| Sheet | Design family | Audit status | Convergence focus (fresh → Golden) | Est. effort | Priority |
|---|---|---|---|---|---|
| **INPUT - Cash Flow `<year>`** | Financial Ledger | ★★★★★ Golden Reference | Converge fresh sheet toward Golden: header palette, negative-number format, summary-row styling, per-column widths, borders, banding, tab order | S | P1 |
| **INPUT - Bank Accounts** | Financial Ledger | ★★★★★ Golden Reference | Converge toward Golden: year-row/header/Total/Delta colors, month-column widths & currency, freeze rows/cols, negative conditional formatting, notes | S | P1 |
| **INPUT - Investments** | Financial Ledger | ★★★★★ Golden Reference | Converge toward Golden: year/header/total/delta colors, **month-column currency pre-format on create**, freeze rows/cols, widths | S | P1 |
| **INPUT - House Values** | Financial Ledger | ★★★★★ Golden Reference | Converge toward Golden: year-banner contrast, money-column formats on create, widths (empty-column collapse), freeze | S–M | P1 |
| **INPUT - Debts** | Operational | ★★★★★ Golden Reference | Converge toward Golden: header color, TOTAL DEBT band, column widths, currency formats on empty range, notes/tooltips, conditional formatting | S | P1 |
| **INPUT - Bills** | Operational | ★★★★★ Golden Reference | Converge toward Golden: header color, widths, notes on non-obvious columns (use-policy/autopay), number formats, conditional formatting. **Canonical schema now ends with `Weekday` · `Anchor Date` · `Schedule Effective Date` — see "Canonical schema — INPUT - Bills scheduling columns" below.** | S | P1 |
| **INPUT - Upcoming Expenses** | Operational Planning | ★★★★☆ Production Ready | Converge toward Golden: header color, widths, date/amount formats on empty range, banding | S | P1 |
| **INPUT - Donation** | Operational Planning | ★★★★☆ Production Ready | Converge toward Golden: header styling/colors/widths/number formats (fresh sheet currently minimal) | M | P1 |
| **INPUT - Retirement** | Analytical / Configuration | ★★★★☆ Production Ready | Converge toward Golden: section shading/structure, borders between scenario blocks, widths, number/percent formats | M | P1 |
| **INPUT - Settings** | Analytical / Configuration | ★★★★☆ Production Ready | Converge toward Golden: header background/border, widths; small key/value surface | XS | P2 |
| **HOUSES - `<Name>`** | Financial Ledger | UNKNOWN | Audit first: **first-ever house** (fallback path) vs later houses (template clone) — row heights, widths, banner/header styling | M | P2 |
| **LOG - Activity** | Operational | UNKNOWN | Audit first: header background, column widths (wide text columns), amount/date number formats | S | P2 |
| **OUT - Dashboard** | Analytical / Configuration | UNKNOWN | Audit first: planner rebuilds formatting each run — confirm the planner-produced look matches production | S | P2 |
| **OUT - History** | Analytical / Configuration | UNKNOWN | Audit first: header styling, widths, number formats vs production | S | P2 |

### Canonical schema — INPUT - Bills scheduling columns

The canonical `INPUT - Bills` sheet **ends with three trailing scheduling columns**, in this order, immediately after `Notes` (Recurrence Engine V2 — now part of the Golden Workbook standard). They are **provisioned on new workbooks** and **added append-only by schema self-heal** on older workbooks. **Structure only — never seed example data; all three are blank by default.**

| # | Column (exact header) | Purpose | Blank default | Canonical formatting |
|---|---|---|---|---|
| 1 | **Weekday** | Weekday a Weekly/Biweekly bill recurs on (`Sunday`…`Saturday`). Ignored for other frequencies. | Blank → legacy Due-Day behavior | Text; inherits adjacent Bills column styling (font/alignment/background). Width **110**. |
| 2 | **Anchor Date** | Biweekly only: a date on the selected Weekday that sets the two-week cadence; must fall on that weekday (no silent correction). | Blank → no biweekly anchor | Date, canonical `yyyy-MM-dd`; inherits adjacent Bills column styling. Width **120**. |
| 3 | **Schedule Effective Date** | Auto-set to *today* when a scheduling field changes so changes apply going forward only; not user-edited. | Blank → no prospective change (full history applies) | Date, canonical `yyyy-MM-dd`; inherits adjacent Bills column styling. Width **160**. |

**Convergence rule:** on first-create and self-heal, these columns inherit the standard Bills column formatting (copied from an adjacent Bills column) plus the canonical widths above, so they are visually indistinguishable from the rest of the Bills row. Headers must match exactly: `Weekday`, `Anchor Date`, `Schedule Effective Date`. Order is fixed and append-only (right of `Notes`).

## Checklist — system / backing sheets (secondary)

These are backing data sheets a user *can* open but rarely does. Audit only if the Golden Workbook shows deliberate styling on them.

| Sheet | Current status | Visual comparison required | Remaining gaps (to verify — unconfirmed) | Est. effort | Priority |
|---|---|---|---|---|---|
| **SYS - Accounts** | UNKNOWN | Yes | Confirm header color/widths vs production | XS–S | P3 |
| **SYS - Assets** | UNKNOWN | Yes | Confirm header styling/widths | XS | P3 |
| **SYS - House Assets** | UNKNOWN | Yes | Confirm header styling/widths/money formats | XS | P3 |

## Excluded from parity (with rationale)

| Sheet | Reason |
|---|---|
| **SYS - Meta** | Hidden system marker; never user-visible. |
| **SYS - Import Staging — Bank Accounts** / **SYS - Import Ignored — Bank Accounts** | Bank Import is out of Family Beta scope; audit deferred until it re-enters scope. |
| **HOME** | Admin/menu tool, not part of Central provisioning. |

## Cross-cutting items (audit at the workbook level, not per sheet)

| Item | Current status | Visual comparison required | Notes (to verify) | Est. effort | Priority |
|---|---|---|---|---|---|
| **Sheet (tab) ordering** | UNKNOWN | Yes | Fresh workbook tabs appear in creation order; confirm the production tab order and whether provisioning should enforce it | M | P1 |
| **Tab colors** | UNKNOWN | Yes | Confirm whether production uses tab colors | XS | P3 |
| **Conditional formatting** | UNKNOWN | Yes | Confirm which sheets/cells use conditional formatting in production (design decision before implementing) | M | P2 |
| **Row banding** | UNKNOWN | Yes | Confirm whether production uses banding on data tables | S | P3 |
| **Number formats on empty ranges** | UNKNOWN | Yes | Confirm which sheets pre-format the empty data area in production | S | P2 |
| **Cell notes / tooltips** | UNKNOWN | Yes | Confirm whether production annotates non-obvious headers | XS–S | P3 |
| **Filters** | UNKNOWN | Yes | Confirm whether production has filters on any sheet | XS | P3 |

---

## Validation — Required screenshots (Golden Workbook Audit)

**The first audit pass (2026-07-06) covered the ten core user-facing sheets** using this procedure against the bound production workbook. The same procedure applies to the remaining **UNKNOWN** sheets (HOUSES, LOG - Activity, OUT sheets, SYS backing sheets, cross-cutting items).

The audit **must compare against the actual production workbook**. Styling must **not** be inferred from code. Capture the following from the production (Golden) workbook. Save them where the team stores audit artifacts and reference them from the relevant checklist row.

### Whole-workbook (once)

1. **Full tab bar** — showing every sheet, in order, with any tab colors (for Sheet ordering + Tab colors).
2. **Any workbook-level view settings** relevant to appearance (e.g., default font if set at workbook level).

### Per user-facing sheet (each sheet listed above)

For **every** sheet in the user-facing table, capture:

1. **Top-left, unscrolled** — header row(s) + year banner (if a year-block sheet) + the first several data rows, so header colors, fonts, banner styling, and totals are visible.
2. **Scrolled-down view** — enough to demonstrate **freeze panes** (which rows/columns stay pinned).
3. **Column widths / row heights** — a view where relative widths and heights are clear (or record the exact px values via the resize handle / Format menu).
4. **Representative formatted cells** — a currency cell, a percent cell, a date cell, and (if present) a negative-value cell, each showing its **number format** (capture the format string from Format → Number where possible).
5. **Totals / summary rows** — the total/summary row styling (color, border, weight); for Cash Flow, the Summary row specifically.
6. **Conditional formatting** — if any cells change color by value, capture both the "normal" and "triggered" states, and the rule (Format → Conditional formatting).
7. **Borders** — any header/section/total borders.
8. **Notes / tooltips** — hover any non-obvious header that shows a note; capture the note text.
9. **Hidden helper columns** — note which columns (if any) are hidden.
10. **Filters** — capture if a filter/filter view is present.

### Year-block sheets — extra capture

For **INPUT - Bank Accounts**, **INPUT - Investments**, **INPUT - House Values**, and (if year-blocked) **INPUT - Donation**: capture the **boundary between two year blocks** so the auditor can see how one year's block visually separates from the next (banner styling, separator row, borders).

### HOUSES sheets — extra capture

For **HOUSES - `<Name>`**: capture both an **established house** sheet and, if reproducible, the **first-ever house** appearance, since first-create uses a different (fallback) formatting path than later houses.

### After capture

For each sheet, record concrete values alongside the screenshots: exact hex colors, column widths (px), row heights (px), frozen row/column counts, number-format strings, border styles, conditional-format rules, notes, filters, and tab position/color. Then update the sheet's **Current status** from **UNKNOWN** to **COMPLETE / MINOR / MAJOR**.

---

## Next implementation steps

1. **Finish the audit** for the remaining **UNKNOWN** sheets (HOUSES, LOG - Activity, OUT sheets, SYS backing sheets, cross-cutting items) using the Validation procedure above.
2. **Golden Workbook Convergence** — for each resolved (non-UNKNOWN) sheet, write an additive first-create convergence pass toward its audited family standard (one sheet per pass — see `GOLDEN_WORKBOOK.md → §6`).

The first audit (ten core sheets) is complete (2026-07-06). See `GOLDEN_WORKBOOK.md → §8` and `TODO.md → Stage 3 → D. Golden Workbook Convergence`.
