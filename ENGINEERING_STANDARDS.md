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

### 10. Runtime Helpers Must Not Style

Runtime helper functions (those invoked during normal application operation — e.g. row inserters, summary/formula maintainers, seed helpers called on every Quick Add / bill / debt / income write) should:

- update **data**,
- update **formulas**,
- perform **correctness** operations.

They should **not** perform cosmetic styling (backgrounds, borders, fonts, font sizes, row heights, column widths, alignment, banding) **except** during:

- **first-create**,
- **explicit repair** (a deliberate, reviewed, idempotent re-converge operation), or
- **approved schema evolution** (styling only the newly added columns/rows, additively).

This complements the Styling Reassertion Rule (§9): §9 says *reassert only correctness-critical styling*; §10 says *runtime helpers should not be the place cosmetic styling lives at all*. Cosmetic styling belongs to the creation/repair/evolution paths, not to the routine write path.

### 11. Milestone Discipline

Once a milestone has started, **finish it before beginning another.**

- **Finish the current milestone** before starting a new one.
- **Do not jump to unrelated improvements** just because they were discovered mid-milestone.
- **The only exceptions are:**
  - the user explicitly changes priorities, **or**
  - a **production bug / blocker** is discovered.
- **ProductDecision items** discovered mid-milestone are **recorded and deferred** (in the relevant doc — `GOLDEN_WORKBOOK.md` / `WORKBOOK_PARITY_CHECKLIST.md` / this file's *Ratified product decisions*) **unless they block completion** of the current milestone.
- **Engineering convergence should be completed before expanding architecture** — converge what exists to the canonical standard before adding new subsystems.

**Purpose:** keep work focused, reduce context switching, and finish and close milestones cleanly. This pairs with the Validator-driven workflow (implement → run Validator → fix `AdoptGolden` → repeat → commit): the milestone is *done* when `AdoptGolden = 0` for its scope and the remaining diffs are intentional (KeepCentral / ProductDecision / IgnoreNoise).

---

## Cash Flow Data Semantics — Actuals vs Projection

`INPUT - Cash Flow <year>` is an **actuals ledger**, not a forecast. Two concepts must be kept strictly separate; conflating them corrupts trust in the numbers.

### Actuals (what exists today)

- **Adding a bill** (`addBillFromDashboard`) seeds only a **blank** Cash Flow Expense row (Type / Payee / Flow Source). It writes **no monthly amounts**.
- **AutoPay** (`getInputBillsDueRows_`, on the Bills Due read) is the *only* thing that writes bill amounts, and it is an **actuals** mechanism. It writes `-amount` into a month cell **only when all of these hold**: AutoPay enabled, the occurrence is inside the Bills Due rolling window (`generateOccurrences_` → `monthOffsets = [-1, 0, +1]`), the **due date has passed**, and the occurrence is **not already handled** (marker or populated cell). Each write carries a `bill_autopay` dedupe marker.
- **`Start Month`** controls **recurrence eligibility** (occurrences before it in the current year are suppressed). It does **not** populate Cash Flow months. This is intentional.
- Consequence: current Cash Flow represents **settled / actual** activity, never projected activity. A monthly bill with `Start Month = 1` added mid-year correctly shows amounts only for months that have already come due — not January→December.

### Projection (future feature — see `TODO.md → Future Feature — Cash Flow Forward Projection`)

Forward projection is a **separate, explicit product feature**, not unfinished actuals behavior. If/when built, it must:

- be **explicit / opt-in** — never triggered implicitly on a read;
- be **forward-only** — never back-fill past months (that rewrites financial history);
- **never overwrite a populated cell** (manual protection);
- **skip `Varies = Yes`** bills (no fixed amount to project);
- write **no `bill_autopay` markers** and never suppress the Bills Due card;
- be **visually distinguishable** from actuals so projected values are never mistaken for settled payments.

**Rule:** Projection must **never reuse the AutoPay pipeline.** AutoPay settles actuals; projection forecasts. Do not "fix" the actuals behavior above by making AutoPay fill the year — that is by design.

---

## Canonical Row Styling Standard

All app-created sheets derive their appearance from the **semantic purpose of the row**, not from implementation details or Apps Script defaults. Every row in every app-owned sheet should belong to one of the categories below.

### Canonical typography (single source of truth)

Font **sizes** are defined once in code as constants in `sheet_bootstrap.js` (`CANON_FONT_YEAR_BANNER_`, `CANON_FONT_HEADER_`, `CANON_FONT_HEADER_SYS_`, `CANON_FONT_BODY_`, `CANON_FONT_TOTAL_`). Every styling helper reads these constants so families can never silently drift apart again. Weight (bold/normal) and **color** remain per-family/per-role and are set at each call site — the constants govern **size only**.

> **History (Stop-Global-Visual-Drift, 2026-07-10):** a single global 24/20 header standard was tried and reverted — it clipped Financial Ledger + Operational grids whose column widths were tuned for 16pt (fonts grew, widths did not). The corrected standard below keeps **one** genuine per-family difference: **flat SYS sheets read at a 20pt header** (few, wide columns), while **year-block + Operational grids use 16pt**. Readability wins over a single global font number.

| Row role | Size | Weight | Row height | V-align | Border |
| --- | --- | --- | --- | --- | --- |
| Year / Banner | **20 pt** | Bold | **40** | middle | **none** (color band separates) |
| Column Header (Ledger + Operational) | **16 pt** | Bold | **40** | middle | thin **black** SOLID bottom |
| Column Header (flat SYS sheets) | **20 pt** | Bold | **40** | middle | thin **black** SOLID bottom |
| Body | **14 pt** | Normal | **26** | middle | none |
| Totals / Summary / Delta | **14 pt** | Bold | **28** | middle | none / existing summary divider |

Column Header is **16 pt** on year-block (Financial Ledger) and Operational sheets, and **20 pt** on flat `SYS -` sheets (`CANON_FONT_HEADER_SYS_`). **Column Header horizontal alignment is CENTER** on all data families. Body and Totals horizontal alignment stay canonical-per-column (labels left, currency right).

### Canonical geometry (single source of truth)

Font **sizes** live in the `CANON_FONT_*` constants; row **geometry** (heights + vertical alignment) lives in the matching constants in `sheet_bootstrap.js`: `CANON_ROW_HEIGHT_YEAR_` (40), `CANON_ROW_HEIGHT_HEADER_` (40), `CANON_ROW_HEIGHT_BODY_` (26), `CANON_ROW_HEIGHT_TOTAL_` (28), `CANON_VERTICAL_ALIGNMENT_` (`'middle'`). Colors/backgrounds/border-color stay per-family; the constants govern size + geometry only.

**Application boundary (safety):** geometry is applied at **first-create** (and approved additive schema evolution / explicit repair) **only**. Runtime styling helpers must **not** reshape populated workbooks with these values — they may reassert colors/freeze for correctness but must not set heights/alignment/borders on every write (see §9 and §10 below). Bringing already-populated workbooks up to the new geometry is an **explicit repair**, tracked separately.

**Shared family stylers (no duplicate implementations):** each sheet family routes its header + body presentation through **one** shared helper in `sheet_bootstrap.js`, then layers only its own schema-specific widths/formats. Do not hand-copy the header/body block into per-sheet stylers (that is exactly how the family drifted).
- **Operational (flat)** — Bills, Debts, Upcoming Expenses → `applyOperationalFlatSheetStyling_(sheet)` (`#ffe599`, 16pt header).
- **SYS (flat)** — SYS - Assets, SYS - House Assets, SYS - Accounts → `applySysSheetBaseStyle_(sheet, widthByHeader)` (`#ffe599`, 20pt header, canonical widths, freeze row+col).
- **Financial Ledger (year-block)** — Investments, House Values, Bank Accounts, **Donation** → `applyFinancialLedgerBaseStyle_(sheet, options)`, a marker-driven walker with two explicit modes. **`mode: 'runtime'`** = marker colors (`#f4a300` Year / `#ffe599` header / `#b6d7a8` totals / `#f4cccc` delta) + freeze **only** (never fonts/heights/borders/alignment/widths/number-formats) — safe on populated sheets. **`mode: 'firstCreate'`** = colors + freeze + canonical geometry (fonts/heights/vertical-middle/centered header/thin header border) + optional whole-grid body wash — must only be called from a guarded post-`insertSheet` first-create path. Marker labels differ per sheet and are passed via `options`; the palette + safety contract are shared. `applyInvestmentsSheetStyling_` / `applyHouseValuesSheetStyling_` are thin **runtime-mode** wrappers; `applyBankAccountsSheetStyling_` and `applyDonationSheetStyling_` call **firstCreate mode** (+ their own widen-only widths). Donation is a year-block sheet (Year banner + `Name of Charity` header + stacked tax-year blocks), so it routes through this walker rather than the flat Operational helper. `HOUSES - <Property>` shares the palette but uses a **fixed 2-row** header (not repeated markers), so it intentionally keeps `applyHousesExpenseSheetStyling_` and does **not** route through the walker.
- **Cash Flow** keeps its own styler (Summary row + Income/Expense conditional colors) but sources header size/geometry from the shared constants.

### Year / Banner Rows
Purpose: separate year blocks.
- Font size **20** (`CANON_FONT_YEAR_BANNER_`), **bold**, canonical **Year** background, height **40** (`CANON_ROW_HEIGHT_YEAR_`), vertical **middle** (`CANON_VERTICAL_ALIGNMENT_`), **no bottom border** (the color band is the separator).

### Column Header Rows
Purpose: column labels.
- Font size **16** (`CANON_FONT_HEADER_`) on year-block (Financial Ledger) + Operational sheets; **20** (`CANON_FONT_HEADER_SYS_`) on flat SYS sheets.
- **Bold**, canonical **yellow** background, **black** text, **horizontally centered**, height **40** (`CANON_ROW_HEIGHT_HEADER_`), vertical **middle**, thin **black** SOLID bottom border.

### Body Rows
Purpose: normal editable data.
- Font size **14** (`CANON_FONT_BODY_`), **normal** weight, **white** background, height **26** (`CANON_ROW_HEIGHT_BODY_`), vertical **middle**, canonical per-column horizontal alignment (labels left, currency right).

### Aggregate / Total Rows
Purpose: summaries.
- Font size **14** (`CANON_FONT_TOTAL_`), **bold**, canonical **green** background, height **28** (`CANON_ROW_HEIGHT_TOTAL_`), currency formatting where appropriate.

### Delta / Change Rows
Purpose: month-over-month or change calculations.
- Font size **14** (`CANON_FONT_TOTAL_`), **bold**, canonical **pink** background, height **28** (`CANON_ROW_HEIGHT_TOTAL_`).

### Spacer Rows
Purpose: visual separation only.
- No special styling beyond the canonical sheet defaults.

### Intentional typography exceptions
These sheets deliberately use a **different visual language** and are **out of scope** for the ledger typography above. Do not auto-convert them:
- **Planner / OUT sheets** (e.g. `OUT - Debt Planner Dashboard`, `planner_output.js`): report/dashboard layout with its own dark-blue title banner and section-header sizing. Audit before changing.
- **`HOME` landing sheet** (`home.js`): marketing/landing title sizing, not a data grid.

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

### Ratified product decisions (deliberate deviations from historical Golden)

Where readability requires it, a canonical width or attribute may **intentionally differ** from the older Golden workbook state. Such deviations are ratified, documented, and expected to appear in the Validator as **KeepCentral**/**ProductDecision** (never AdoptGolden). Current entries:

- **`INPUT - Upcoming Expenses` — body font 14pt + ID width 190px (2026-07-11).** The body font is the canonical **14pt** (the historical Golden used 12pt, which allowed a narrower ID column). Because the generated 16-character IDs (`UE-` + 13-digit epoch ms) are cramped at 14pt, the **ID column is 190px** (historical Golden was 165px). **Readability is preferred over preserving historical compactness.** Implemented widen-only, first-create-only via `UPCOMING_EXPENSES_CANONICAL_WIDTHS_` in `upcoming_expenses.js`; the Canonical workbook's ID width is aligned to 190 so the two agree. The **header background is `#ffe599`** per the ratified header-yellow standardization (below) — the older Canonical `#ffff00` is updated to match, so this is no longer an open ProductDecision. See `GOLDEN_WORKBOOK.md → Operational Planning family`.
- **Canonical header yellow — single value `#ffe599` everywhere (2026-07-12).** All CashCompass header bands (Operational, Financial Ledger, SYS, Special/Settings/Donation, HOUSES) use **one** canonical header yellow, `CANON_HEADER_YELLOW_ = '#ffe599'` (the softer Operational "yellow-2"). The brighter legacy yellows (`#ffff00`, `#fff200`) are retired. This was ratified as a **deliberate product migration**, so — unusually for a color — runtime header-colour reassertions in the SYS / Financial Ledger walkers **may** repaint an existing header band to `#ffe599` (an intentional, colour-only convergence, not accidental restyling). The legacy `CANON_HEADER_YELLOW_LEGACY_` split was removed. **Non-header semantic colours are preserved** (year-banner orange `#f4a300`, totals green `#b6d7a8`, delta pink `#f4cccc`, Cash Flow income/expense/summary health colours, planner/output theme colours). The Canonical workbook's older header hexes are updated to `#ffe599` to match.
- **`INPUT - Cash Flow <year>` — Summary row financial-health coloring (2026-07-11).** The `Summary | Cash Flow Per Month` net values are a **financial-health cue**: **positive → green (`#38761d`)**, **negative → red (`#cc0000`)**, **zero → neutral black**. Implemented through **narrowly scoped conditional formatting, not a number format** — two idempotent rules over the Summary money cells (`=AND($<Type>1="Summary", <money>1>0)` → green font; `<0` → red font) — because CF matches the exact Cash Flow colour language already used for Income/Expense rows (shared `CASH_FLOW_HEALTH_COLOR_POSITIVE_` / `CASH_FLOW_HEALTH_COLOR_NEGATIVE_` constants), is dynamic, and unifies all Cash Flow colour under one mechanism. The Summary **number format stays neutral currency** (`$#,##0.00;-$#,##0.00;$#,##0.00`), so **zero stays black**. *(An earlier `[Green]…;[Red]…` number-format approach was evaluated and rejected.)* Conditional-format rules are **not yet inspectable by the Validator** — CF capture is a future Validator Phase 2 capability. **Scope: Summary money cells only** — Income/Expense row formatting, formulas, widths, row heights, borders, background, and typography are unchanged. Implemented via `applyCashFlowSummaryHealthColorRules_` (called by `writeCashFlowSummaryFormulas_`, `cashflow_setup.js`), added idempotently (prior `="Summary"` health rules dropped and re-added, always exactly two). **Existing workbooks self-heal narrowly** the next time `writeCashFlowSummaryFormulas_` runs (every Quick Add) — allowed because that function already rewrites the Summary formulas and the reassertion is colour-only and scoped to the Summary cells. See `GOLDEN_WORKBOOK.md → Financial Ledger family`.
