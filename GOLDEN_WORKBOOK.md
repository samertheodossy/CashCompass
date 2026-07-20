# Golden Workbook *(the Canonical Workbook)*

*The permanent visual specification for every CashCompass workbook.*

> **Terminology:** the reference workbook is called both the **Golden Workbook** (historical name, used throughout this doc and in `VALIDATOR_GOLDEN_WORKBOOK_ID` / "AdoptGolden") and the **Canonical Workbook** (the term used in code, Validator output, and `ENGINEERING_STANDARDS.md`). They are the **same living reference**; "Canonical" emphasizes that it is an **evolving standard**, not a frozen historical snapshot (see the full note under *The core principle*).

**Status:** Documentation only. This document defines a standard and a process; it authorizes no code changes. The initiative is **Golden Workbook Convergence** — scheduled as **Stage 3 → D (P1)**.

**Convergence progress (updated 2026-07-20): engineering convergence complete for the audited families.** Driven by the **Validator** (`VALIDATOR_ARCHITECTURE.md`), the **Operational** (Bills · Debts · Upcoming Expenses · LOG - Activity), **Financial Ledger** (Cash Flow · Bank Accounts), **SYS** (SYS - Accounts), and **Special** (Settings · Donation) families have completed their engineering `AdoptGolden` convergence — all remaining Validator differences for these are intentionally classified **KeepCentral**, **ProductDecision**, or **IgnoreNoise**. Per-sheet status lives in `WORKBOOK_PARITY_CHECKLIST.md`. The known P0 ProductDecision inventory is resolved; manual Canonical-workbook alignment is non-blocking. Still open: full audit + convergence for the remaining **UNKNOWN** sheets (HOUSES, OUT sheets, some SYS backing sheets) and workbook-level cross-cutting items.

**Audit progress:** The **first Golden Workbook Audit was completed on 2026-07-06** against the actual bound production workbook. Ten core user-facing sheets have been visually verified and rated (see the **Design families** section below and `WORKBOOK_PARITY_CHECKLIST.md`); they are no longer **UNKNOWN**. Remaining sheets (HOUSES, OUT sheets, some SYS backing sheets, and the workbook-level cross-cutting items) stay **UNKNOWN** until audited. Convergence code for a sheet may only be written once that sheet's row is resolved out of UNKNOWN.

---

## Ratified product decisions during convergence (index)

These are the **deliberate deviations from the older hand-tuned Golden state** ratified during the 2026-07 convergence milestone — cases where readability or a product decision improved on history and the Canonical workbook was updated to the new standard. Each is detailed in-line under its design family below and in `ENGINEERING_STANDARDS.md → Ratified product decisions`.

- **Canonical header yellow — `#ffe599` everywhere (2026-07-12).** A single canonical header yellow for **all** header bands (Operational, Financial Ledger, SYS, HOUSES, Special). Supersedes the brighter legacy `#ffff00` / `#fff200`; runtime header-color reassertions were intentionally allowed to repaint to `#ffe599` (a deliberate product migration). Non-header semantic colors (year-banner orange, totals green, delta pink/tan, Cash Flow income/expense/summary) are preserved. → see *Financial Ledger* / *Special* families below and line-referenced note.
- **Cash Flow Summary row financial-health coloring (2026-07-11).** Summary net values color green (`#38761d`) positive / red (`#cc0000`) negative / black zero via narrowly-scoped conditional formatting; Summary number format reverted to neutral currency. → see *Financial Ledger* family below.
- **Donation year-block styling (2026-07-12).** `INPUT - Donation` migrated to the shared Financial-Ledger year-block styling engine (`applyDonationSheetStyling_` → `applyFinancialLedgerBaseStyle_`), first-create only. → see *Financial Ledger* family below.
- **Upcoming Expenses typography (2026-07-11).** 14pt body font retained (vs Golden's historical 12pt) with `ID` widened for readability; surfaces as **KeepCentral**, never **AdoptGolden**. → see *Operational Planning* family below.
- **Settings typography (2026-07-20).** `INPUT - Settings` uses the canonical non-SYS input-grid sizes: 16pt Key / Value header and 14pt editable body, first-create only. This resolves the final known P0 typography ProductDecision; manual alignment of the Canonical workbook is non-blocking.

---

## The core principle

> **The production workbook is the visual source of truth.**

CashCompass is built on a real Google Sheets workbook that the user owns and can open. That workbook is not an implementation detail — for many users it *is* the product surface they inspect and trust. The mature production workbook (the developer's long-lived, hand-tuned workbook) has, over months of manual refinement, arrived at a layout and styling that is clear, scannable, and trustworthy.

We now elevate that workbook to a named standard: **the Golden Workbook.** Every newly provisioned workbook should **converge toward the Golden Workbook** until a freshly provisioned workbook is *visually indistinguishable* from it.

When code and the Golden Workbook disagree, **the Golden Workbook wins** and the provisioning/styling code is what changes.

> **Terminology — "Golden" ↔ "Canonical".** The reference workbook is increasingly called the **Canonical workbook** in code and Validator output (e.g. `VALIDATOR_GOLDEN_WORKBOOK_ID`, "AdoptGolden"/"KeepCentral" recommendations). "Golden" and "Canonical" refer to the **same living reference**. The nuance the newer term captures: the workbook is an **evolving standard**, not a frozen historical snapshot — where readability or a ratified product decision improves on the old hand-tuned state, the Canonical workbook is updated to the new standard and the code follows it (see the ratified product decisions recorded per family below and in `ENGINEERING_STANDARDS.md → Ratified product decisions`).

---

## 1. What the Golden Workbook is

The Golden Workbook is the **mature production workbook**, treated as the reference implementation for all visual formatting. It defines the target for every visual attribute of every user-facing sheet:

- Fonts (family, size, weight, color)
- Colors (header bands, year banners, totals, deltas, backgrounds)
- Column widths and row heights
- Freeze panes (frozen rows / columns)
- Hidden helper columns
- Conditional formatting rules
- Number formats (currency, percent, date, text)
- Borders
- Total / summary rows
- Cell notes / tooltips
- Filters
- Sheet (tab) ordering, tab colors
- Overall visual polish and scannability

It is a **living reference**: as the production workbook evolves, the standard evolves with it. It is *not* a frozen snapshot or a mock-up — it is the actual workbook, observed directly.

## 2. Why it exists

- **First impressions are the workbook.** A Family Beta user's trust is shaped the moment they open their workbook. A cramped, unstyled, first-create sheet undermines confidence even when the data is perfectly correct.
- **A single, unambiguous target.** Without a named reference, "make it look nicer" is subjective and every styling decision is re-litigated. The Golden Workbook makes parity an objective, checkable goal: *does the fresh sheet match the production sheet?*
- **Prevents drift.** Provisioning styling is scattered across many domain modules. A single visual source of truth keeps them converging on one look instead of diverging into per-module styles.
- **Protects ownership + trust.** Because users own and can inspect their workbook, its visual quality is a trust signal, consistent with the product principle that the user owns the data (`PRODUCT_VISION.md → §5`).

## 3. What "converge toward the Golden Workbook" means

Newly provisioned (and first-create) workbooks should be styled so that, for each user-facing sheet, the fresh sheet matches the corresponding Golden Workbook sheet across every attribute in §1. The engineering target and per-sheet status live in **`WORKBOOK_PARITY_CHECKLIST.md`**.

Convergence is **directional and incremental**: sheets are brought to parity one at a time, highest-visibility first, without ever restyling an existing populated workbook (see §6 guardrails).

This is explicitly a **convergence project, not a redesign project.** The Golden Workbook already defines the target look. The work is bringing freshly provisioned sheets *toward* that established standard — not inventing new formatting.

## Design families

The 2026-07-06 Golden Workbook Audit revealed that the production workbook is **not one uniform look** — it is organized into **four deliberate design families**, each an intentional visual language suited to how that group of sheets is used. They share one consistent CashCompass visual identity (common palette, typography, and header conventions) while differing in density, structure, and emphasis.

> **These families are intentional. The goal is not to make every sheet look identical** — it is for a freshly provisioned sheet to match the *appropriate family* for its purpose, so the whole workbook reads as one coherent product with the right tool for each job.

Rating scale (audit quality of the production sheet as a reference):

- **★★★★★ Golden Reference** — the sheet is a fully mature exemplar; it *defines* the standard for its family.
- **★★★★☆ Production Ready** — the sheet is polished and shippable; it sets the family standard with only minor room for future refinement.

### 1. Financial Ledger family — ★★★★★ Golden Reference

**Sheets:** Cash Flow · Bank Accounts · Investments · House Values.

**Purpose:** track balances and money flows *across time*. These are the dense, columnar, year-blocked ledgers at the heart of the workbook. Visual language: year banners/bands, month columns, currency-heavy number formats, total/delta rows, freeze panes for headers and label columns, and high scannability across long time ranges. This family is the most mature and sets the visual bar for the whole workbook.

> **`INPUT - Cash Flow <year>` is an actuals ledger, not a forecast (by design).** Its month cells record **what has actually happened** — settled activity — not a projection of what will. Adding a bill creates its Cash Flow row only; it does **not** seed monthly amounts. Amounts appear as occurrences come due and **AutoPay** (an *actuals* mechanism) settles them. **`Start Month`** governs recurrence eligibility, **not** month population, so a monthly bill with `Start Month = 1` does not pre-fill Jan→Dec. Forward-looking projection is a **planned future feature**, kept separate from actuals — see `TODO.md → Future Feature — Cash Flow Forward Projection` and `ENGINEERING_STANDARDS.md → Cash Flow Data Semantics — Actuals vs Projection`.

**Ratified product decision — Cash Flow Summary row financial-health coloring (2026-07-11).** The `Summary | Cash Flow Per Month` row communicates **financial health** through its net values:

- **Positive → green (`#38761d`)**, **negative → red (`#cc0000`)**, **zero → neutral black**.
- Implemented via **narrowly scoped conditional formatting** (not a number format). Two idempotent rules over the Summary money cells: `=AND($<Type>1="Summary", <money>1>0)` → green font and `=AND($<Type>1="Summary", <money>1<0)` → red font. The Summary **number format stays neutral currency** (`$#,##0.00;-$#,##0.00;$#,##0.00`); colour comes from the rules, so **zero stays black**.

**Rationale:** conditional formatting matches the exact Cash Flow colour language already used for Income/Expense rows (shared `CASH_FLOW_HEALTH_COLOR_POSITIVE_` / `CASH_FLOW_HEALTH_COLOR_NEGATIVE_` constants), is dynamic (never stale), and unifies all Cash Flow colour under one mechanism. *(An earlier `[Green]…;[Red]…` number-format approach was evaluated and **rejected** — it could not render a green positive cleanly alongside a neutral zero, and it would fork the colour language away from the Income/Expense rules.)* Conditional-format rules are **not yet inspectable by the Validator** — capturing them is a **future Validator Phase 2 capability** (`VALIDATOR_ARCHITECTURE.md §10`).

**Scope:** applies **only** to the Summary row's money cells. It does **not** change Income/Expense row formatting, and does **not** change formulas, widths, row heights, borders, background, or typography. Implemented in `applyCashFlowSummaryHealthColorRules_` (called by `writeCashFlowSummaryFormulas_`, `cashflow_setup.js`); rules are added **idempotently** — any prior `="Summary"` health rule is dropped and re-added, always exactly two. **Existing workbooks self-heal narrowly** the next time `writeCashFlowSummaryFormulas_` runs (every Quick Add) — allowed because that function already rewrites the Summary formulas and the reassertion is **colour-only** and scoped to the Summary cells. See `ENGINEERING_STANDARDS.md → Ratified product decisions`.

### 2. Operational family — ★★★★★ Golden Reference

**Sheets:** Debts · Bills.

**Purpose:** the working lists the user actively *maintains and acts on*. Row-per-obligation, status- and action-oriented, with header emphasis, notes/tooltips on non-obvious columns, and clear totals where relevant (e.g., TOTAL DEBT). Visual language favors legibility of individual records and quick action over time-series density.

#### `INPUT - Bills` — canonical scheduling columns *(part of the Golden Workbook standard)*

The canonical `INPUT - Bills` sheet **ends with three trailing scheduling columns**, in this exact order, immediately after `Notes`. They were introduced with Recurrence Engine V2 (Weekday & Biweekly scheduling) and are now a permanent part of the Golden Workbook standard — a newly provisioned workbook must include them, and older workbooks self-heal to add them (append-only, right of `Notes`).

| Column (in order) | Purpose | Blank default | Canonical formatting |
|---|---|---|---|
| **Weekday** | The weekday a **Weekly** or **Biweekly** bill recurs on (`Sunday`…`Saturday`). Blank = legacy Due-Day behavior. Ignored for Monthly/Quarterly/Semiannual/Yearly. | **Blank** (legacy Due-Day behavior) | Text; inherits the neighboring Bills column's font, alignment, and background. Canonical width **120**. |
| **Anchor Date** | For **Biweekly** bills only: a real date on the selected weekday that establishes the recurring two-week cadence. Must fall on the chosen Weekday (never silently corrected). | **Blank** (no biweekly anchor set) | Date, stored as canonical `yyyy-MM-dd`; inherits the neighboring Bills column's font/alignment/background. Canonical width **160** (fits the 11-char header). |
| **Schedule Effective Date** | The date a scheduling change takes effect. Set automatically to *today* when a scheduling field (Frequency, Due Day, Weekday, Anchor Date) changes, so changes apply going forward only. Not user-edited. | **Blank** (no prospective change recorded; full history applies) | Date, stored as canonical `yyyy-MM-dd`; inherits the neighboring Bills column's font/alignment/background. Canonical width **280** (fits the 23-char header — widest on the sheet). |

**Canonical Bills styling (applies to these columns and the whole sheet):** **body font size 14** on white (`#ffffff`); **header row (row 1) font size 20**, bold, black (`#000000`) text on the yellow Bills header (`#ffe599`), vertically centered; header row frozen. The three scheduling columns follow this exact styling — header cell size 20 on `#ffe599`, body cells size 14 on white.

> **Typography (canonical).** The header size above is **16pt** on Financial Ledger + Operational sheets (**20pt** on flat SYS sheets), per the product-wide [Canonical typography](ENGINEERING_STANDARDS.md#canonical-row-styling-standard) standard (Year banner 20pt bold, Header 16pt / SYS 20pt bold, Body 14pt normal, Totals/Summary/Delta 14pt bold). A single global 24/20 header was briefly tried and reverted (2026-07-10) — larger headers clipped grids whose widths were tuned for 16pt. The Golden Workbook's *authority* is its colors, structure, families, and conventions; font sizes are governed by the canonical standard.

**Convergence rules:** all three are **append-only** and **blank by default** — no example data is ever seeded. On first-create they receive the canonical Bills styling above; on self-heal they take the standard Bills column styling copied from an adjacent Bills column (font family/size/color, alignment, background, number format) so the result is identical either way — plus the canonical widths above — making them visually indistinguishable from the rest of the Bills row. Header text must match exactly: `Weekday`, `Anchor Date`, `Schedule Effective Date`.

### 3. Operational Planning family — ★★★★☆ Production Ready

**Sheets:** Upcoming Expenses · Donations.

**Purpose:** forward-looking planning lists that *feed the plan*. Lighter and more entry-oriented than the ledgers — date + amount capture for expected/planned items. Visual language is a cleaner, simpler list that signals "things you are planning" rather than "history you are tracking."

> **Note — `INPUT - Donation` uses the Financial Ledger year-block *styling engine*.** Although Donation belongs to this family by **purpose**, it is **structurally** a year-block sheet (row 1 Year banner, row 2 `Name of Charity` header, data below, additional tax years stacked as more blocks). As of 2026-07-12 it routes through the shared year-block walker `applyFinancialLedgerBaseStyle_` (via `applyDonationSheetStyling_`, first-create only) rather than the flat Operational helper — Year banner `#f4a300`/20pt, header `#ffe599`/16pt centered with thin black bottom border, white 14pt body/26px, freeze rows 2 + column 1, widen-only header-keyed widths (`DONATION_CANONICAL_WIDTHS_`). This replaced the old ad-hoc minimal first-create styling.

**Ratified product decision — Upcoming Expenses (2026-07-11).** After Operational Validator convergence, two attributes on `INPUT - Upcoming Expenses` are **intentional, ratified deviations** from the older Golden workbook state — **readability is preferred over preserving historical compactness**:

- **Body font remains 14pt** (the canonical body size). The historical Golden workbook used 12pt body text, which allowed a narrower ID column; the Canonical workbook has since been updated to 14pt so the two agree.
- **ID column width is 190px.** At 14pt the generated 16-character IDs (`UE-` + 13-digit epoch ms) were cramped at the historical 165px, so ID is widened to **190px** for comfortable display. This is a **product decision, not Golden parity** — the Canonical workbook's ID width is aligned to 190 to match.
- **Header background is `#ffe599`** — resolved by the ratified header-yellow standardization (2026-07-12): all CashCompass header bands use the single canonical yellow `#ffe599`, and the older Canonical `#ffff00` is updated to match. No longer an open ProductDecision.

The ID width / body font are expected to surface in the Validator as **KeepCentral** — never **AdoptGolden**. See `ENGINEERING_STANDARDS.md → Canonical Width Standard` and `→ Ratified product decisions` (canonical header yellow).

### 4. Analytical / Configuration family — ★★★★☆ Production Ready

**Sheets:** Retirement · Settings.

**Purpose:** structured inputs, long-horizon analysis, and configuration surfaces. Visual language uses section shading/structure, scenario or key/value blocks, and percent/number formats appropriate to parameters and projections. These sheets read as "settings and assumptions" rather than day-to-day ledgers.

## 4. How future formatting decisions are made

1. **Observe, don't invent.** A styling decision is made by looking at how the production (Golden) workbook does it — not by inventing a new look or inferring intent from code.
2. **Audit before code.** Before any styling change, the relevant sheet must have a recorded visual observation from the Golden Workbook (screenshots + captured attribute values). Undocumented sheets are marked **UNKNOWN** in the checklist until audited.
3. **The Golden Workbook resolves disputes.** If two modules style similarly-shaped sheets differently, the Golden Workbook decides which is correct; the other converges.
4. **Deviations are deliberate and documented.** If a provisioned workbook must intentionally differ from the Golden Workbook (e.g., a first-create sheet cannot yet show data-dependent conditional formatting), the deviation is recorded in the checklist with a reason — it is not left as an accidental gap.
5. **New sheets extend the standard.** When a new user-facing sheet is introduced, its Golden Workbook appearance is captured and added to the checklist as part of shipping it.

## 5. How the Golden Workbook is maintained

- **Owner:** the production workbook owner (developer) is the custodian of the Golden Workbook.
- **When production styling changes intentionally,** the change is captured (re-screenshot the affected sheet, update the attribute record) and the corresponding row in `WORKBOOK_PARITY_CHECKLIST.md` is reopened if provisioning no longer matches.
- **Re-audit cadence:** the Golden Workbook Audit is reviewed **before every Family Beta milestone and before External Beta** (aligned with the `TODO.md → UX Backlog (Version 1)` review cadence).
- **Screenshots are the artifact of record.** Because styling must be observed rather than inferred, the audit screenshots (see §8) are the durable evidence; the checklist references them.

## 6. Relationship to code / guardrails

The Golden Workbook is the *target*; the provisioning and `apply*SheetStyling_` helpers are the *mechanism*. Any convergence work must honor the existing additive contract (`WORKING_RULES.md → No destructive sheet changes`, `PROJECT_CONTEXT.md → Workbook styling`):

- **First-create only.** Styling runs only when a sheet is newly created in the current execution, gated by each creator's `if (existing) return existing` short-circuit.
- **No populated-workbook overwrite.** Existing/production workbooks are never restyled by convergence work. The Golden Workbook is read-only for the process — we match it, we do not rewrite it.
- **Widen-only / additive.** Column-width logic widens but never shrinks; styling never removes user customizations.
- **Cosmetic failures never abort creation.** Styling calls are wrapped so a formatting error cannot break sheet creation.

## 7. Non-goals

- Not a schema change (no header/column/name changes).
- Not a web-app UI redesign (this is spreadsheet-level formatting only).
- Not a formula change.
- Not a re-format of the production/populated workbook.
- Not an inference exercise — styling is **not** to be reverse-engineered from code; it is observed from the Golden Workbook directly.

## 8. First implementation task — the Golden Workbook Audit

**No styling-convergence code for a sheet until that sheet is audited.** The audit produces the observed, screenshot-backed record of the Golden Workbook that `WORKBOOK_PARITY_CHECKLIST.md` needs to move sheets out of **UNKNOWN**.

**First audit complete (2026-07-06).** The first pass audited ten core user-facing sheets against the bound production workbook and rated them by design family (see **Design families** above): the **Financial Ledger** and **Operational** families are **★★★★★ Golden Reference**; the **Operational Planning** and **Analytical / Configuration** families are **★★★★☆ Production Ready**. Those rows are resolved in `WORKBOOK_PARITY_CHECKLIST.md`.

The audit process, for any sheet:
1. Captures the required screenshots of the production (Golden) workbook — see `WORKBOOK_PARITY_CHECKLIST.md → Validation — Required screenshots`.
2. Records the concrete attribute values per sheet (exact hex colors, column widths, row heights, freeze counts, number-format strings, border styles, conditional-format rules, notes, filters, tab order/colors).
3. Updates each sheet's row in `WORKBOOK_PARITY_CHECKLIST.md` from **UNKNOWN** to a verified status (**★★★★★ Golden Reference / ★★★★☆ Production Ready**, or the finer **COMPLETE / MINOR / MAJOR** convergence gap where relevant).

**Remaining to audit:** HOUSES - `<Name>`, LOG - Activity, OUT - Dashboard, OUT - History, the SYS backing sheets, and the workbook-level cross-cutting items. Only after a sheet's row is resolved (no longer UNKNOWN) may a convergence pass be written for that sheet.

## 9. Related documents

- **`WORKBOOK_PARITY_CHECKLIST.md`** — the engineering checklist: per-sheet status, gaps, effort, priority, and the required-screenshots list.
- **`GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`** — the earlier (2026-05-23) polish plan; **superseded** by this initiative for framing/status (parts are stale — e.g., Bank Accounts / Debts / Bills now have styling helpers). Retained for its additive-implementation strategy and non-goals.
- **`PROJECT_CONTEXT.md → Workbook styling`** — the current first-create styling contract in code.
- **`TODO.md → Product Maturity Stages → Stage 3 → D. Golden Workbook Convergence`** — roadmap home (P1).
- **`PRODUCT_VISION.md`** — why ownership and a trustworthy, polished workbook matter.
