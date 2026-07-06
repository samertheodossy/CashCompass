# Workbook Parity Checklist

The engineering checklist for converging every newly provisioned CashCompass workbook toward the **Golden Workbook** (the production workbook — the visual source of truth). See `GOLDEN_WORKBOOK.md` for what the standard is and why.

**Status:** Documentation only. No code changes are authorized by this checklist. The **first task is the Golden Workbook Audit** (§ Validation); no styling code is changed until a sheet's row is resolved out of **UNKNOWN**.

---

## How to use this checklist

1. Complete the **Golden Workbook Audit** (capture the screenshots in the Validation section and record concrete attribute values from the production workbook).
2. For each sheet, compare a **freshly provisioned** workbook against the Golden Workbook and set the sheet's status.
3. Only after a sheet is **no longer UNKNOWN** may a styling-convergence pass be written for it (one sheet per pass, additive first-create only — see `GOLDEN_WORKBOOK.md → §6`).

## Status legend

- **COMPLETE** — fresh provisioned sheet is visually indistinguishable from the Golden Workbook.
- **MINOR DIFFERENCES** — small, low-effort gaps (a few widths, a missing number format, a color tweak).
- **MAJOR DIFFERENCES** — substantial gaps (no styling, wrong layout, missing structure).
- **UNKNOWN (requires visual comparison)** — parity has **not** been verified against the production workbook. **This is the honest default for every sheet until the Golden Workbook Audit is done.**

> **Do not guess.** Parity can only be confirmed by looking at the actual production workbook. Nothing in this checklist infers styling from code. Every user-facing sheet below is currently **UNKNOWN** because the audit has not been performed. The "Remaining gaps (to verify)" column lists **unconfirmed code-side observations** only as *hypotheses for the auditor to check* — they are not parity conclusions.

---

## Checklist — user-facing sheets

Columns: **Sheet** · **Current status** · **Visual comparison required** · **Remaining gaps (to verify)** · **Estimated effort** · **Priority**.
(Effort is a provisional estimate for the eventual convergence pass and firms up once the audit resolves the gap. XS < 0.5d · S 0.5–1d · M 1–3d.)

| Sheet | Current status | Visual comparison required | Remaining gaps (to verify — unconfirmed) | Est. effort | Priority |
|---|---|---|---|---|---|
| **INPUT - Cash Flow `<year>`** | UNKNOWN | Yes | Confirm header palette, negative-number format, summary-row styling, per-column widths, borders, any conditional formatting/banding, tab order | S | P1 |
| **INPUT - Bank Accounts** | UNKNOWN | Yes | Confirm year-row/header/Total/Delta colors, month-column widths & currency, freeze rows/cols, any conditional formatting on negatives, notes | S | P1 |
| **INPUT - Debts** | UNKNOWN | Yes | Confirm header color, TOTAL DEBT band, column widths, currency formats on empty range, notes/tooltips, conditional formatting | S | P1 |
| **INPUT - Bills** | UNKNOWN | Yes | Confirm header color, widths, notes on non-obvious columns (e.g. use-policy/autopay), number formats, any conditional formatting | S | P1 |
| **INPUT - Upcoming Expenses** | UNKNOWN | Yes | Confirm header color, widths, date/amount formats on empty range, banding | S | P1 |
| **INPUT - Investments** | UNKNOWN | Yes | Confirm year/header/total/delta colors, **month-column currency pre-format on create**, freeze rows/cols, widths | S | P1 |
| **INPUT - House Values** | UNKNOWN | Yes | Confirm year-banner contrast, money-column formats on create, widths (empty-column collapse), freeze | S–M | P1 |
| **HOUSES - `<Name>`** | UNKNOWN | Yes | Confirm **first-ever house** (fallback path) vs later houses (template clone): row heights, widths, banner/header styling | M | P2 |
| **INPUT - Retirement** | UNKNOWN | Yes | Confirm section shading/structure, borders between scenario blocks, widths, number/percent formats | M | P1 |
| **INPUT - Donation** | UNKNOWN | Yes | Confirm whether production has header styling/colors/widths/number formats (fresh sheet currently minimal) | M | P1 |
| **INPUT - Settings** | UNKNOWN | Yes | Confirm header background/border, widths; small key/value surface | XS | P2 |
| **LOG - Activity** | UNKNOWN | Yes | Confirm header background, column widths (wide text columns), amount/date number formats | S | P2 |
| **OUT - Dashboard** | UNKNOWN | Yes | Planner rebuilds formatting on each run; confirm the planner-produced look matches production | S | P2 |
| **OUT - History** | UNKNOWN | Yes | Confirm header styling, widths, number formats vs production | S | P2 |

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

## First implementation task

**Golden Workbook Audit** (this Validation section) — before any styling code is changed. See `GOLDEN_WORKBOOK.md → §8` and `TODO.md → Stage 3 → D. Workbook Formatting & Visual Parity`.
