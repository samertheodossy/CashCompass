# CashCompass Engineering Standards

These standards guide **all** future development unless a specific task explicitly overrides them. This is the permanent, authoritative home for the safety and quality rules that previously lived only in prompts. When in doubt, default to the more conservative option.

`PROJECT_CONTEXT.md` links here; the Golden Workbook specifics live in `GOLDEN_WORKBOOK.md` and `WORKBOOK_PARITY_CHECKLIST.md`.

---

## Core Standards

### 1. Existing Workbook Safety (default assumption)

The bounded application contains **real user workbooks**. Whenever implementing changes:

- Existing populated sheets must **not** be modified or restyled unless the task explicitly requires it.
- Preserve all user **data**, **formulas**, **formatting**, **column widths**, **row heights**, and **workbook behavior**.
- Existing user workbooks must continue behaving exactly as they do today.

This is always the default assumption, even when a prompt doesn't restate it.

### 2. First-Create vs Existing Workbook

- **Golden Workbook styling** applies to **new workbook creation** and **first-create sheet creation**.
- Existing workbooks receive **only** updates that are **additive**, **idempotent**, **narrowly scoped**, and **reviewed**.
- **Avoid destructive migrations.**

### 3. Canonical Sheet Styling

Every app-owned sheet should follow the Golden Workbook: fonts, font sizes, colors, backgrounds, borders, row heights, column widths, freeze panes, number formats, alignment, and wrapping. **The Golden Workbook is the visual authority.**

### 4. Canonical Schema Evolution

When adding columns to any app-owned sheet, the new columns must appear **as though they were always part of the original workbook**.

- Copy styling from adjacent canonical columns: font family, font size, font color, background, borders, alignment, vertical alignment, number format, wrapping, notes, data validation, row-height behavior, and column width (or a canonical width if intentionally different).
- **Header** cells inherit **header** styling; **body** cells inherit **body** styling.
- New columns should be visually indistinguishable from the existing sheet.

Creation rules:

- First-create includes the new columns.
- Existing workbooks receive **additive** schema evolution only; existing user formatting must not be disturbed.
- New columns default to **blank** unless the feature specifically requires seeded values or formulas.

### 5. Readability Standard

Every newly created sheet should be **immediately readable** — users should never need to manually resize columns after creation.

- Readable column widths and row heights; no clipped headers or values; visually consistent spacing.
- Prefer **canonical widths** over auto-resize where appropriate.
- Use **widen-only** logic where applicable (never shrink a user's column).

### 6. Safe Self-Heal

Self-heal operations must be **additive**, **idempotent**, and **narrowly scoped** — never destructive, and never a rewrite of an entire populated sheet.

### 7. Golden Workbook Authority

When implementation details are uncertain, the **Golden Workbook is the canonical source**. Runtime behavior should match the Golden Workbook whenever practical.

### 8. Runtime Validation

When reasonably possible, features are runtime validated before commit. The standard order is: **investigation → implementation → runtime validation → commit** (commit only after successful validation).

### 9. Styling Reassertion Rule (Runtime Styling Discipline)

Runtime styling helpers (those invoked on every read/write during normal application operation) should **only reassert styling that is required for correctness** — e.g. number formats that must survive a value write, or a frozen header the app depends on. They should **not** repeatedly set cosmetic properties (backgrounds, borders, fonts, row heights, column widths, alignment) on every write.

Prefer, in order:

- **First-create** — apply full canonical styling once, when the sheet or block is created.
- **Safe schema evolution** — apply canonical styling to newly added columns/rows only, additively.
- **Explicit repair** — a deliberate, reviewed, idempotent operation the user or an admin triggers to re-converge styling.

…over re-applying cosmetic formatting on every normal write. Repeated cosmetic reassertion mutates existing user workbooks on routine actions, can clobber intentional first-create styling, and risks unintended visual changes. Minimize mutations to existing user workbooks.

---

## Canonical Row Styling Standard

All app-created sheets derive their appearance from the **semantic purpose of the row**, not from implementation details or Apps Script defaults. Every row in every app-owned sheet should belong to one of the categories below.

### Year / Banner Rows
Purpose: separate year blocks.
- Font size **20**, **bold**, canonical **Year** background, **centered**, consistent row height.

### Column Header Rows
Purpose: column labels.
- Font size: **16** on year-block sheets, **20** on flat `SYS -` sheets.
- **Bold**, canonical **yellow** background, **black** text, **centered**, consistent row height, bottom border where appropriate.

### Body Rows
Purpose: normal editable data.
- Font size **14**, **normal** weight, **white** background, canonical alignment, readable spacing.

### Aggregate / Total Rows
Purpose: summaries.
- Font size **14**, **bold**, canonical **green** background, currency formatting where appropriate.

### Delta / Change Rows
Purpose: month-over-month or change calculations.
- Font size **14**, **bold**, canonical **pink** background.

### Spacer Rows
Purpose: visual separation only.
- No special styling beyond the canonical sheet defaults.

---

## Canonical Readability Standard

Every newly created sheet should be immediately readable. Users should never need to **resize columns**, **increase row heights**, or **adjust fonts** after sheet creation. First-create should always produce a readable sheet.

---

## Canonical Width Standard

Whenever creating a sheet:

- Use **canonical widths**.
- Prefer **widen-only** behavior.
- Never intentionally create clipped headers.
- Never intentionally create clipped values.
- **Golden Workbook appearance takes precedence over auto-resize** if auto-resize produces a poorer (tighter) result. Auto-resize fits text tightly with minimal padding; canonical widths provide deliberate breathing room and are authoritative.
