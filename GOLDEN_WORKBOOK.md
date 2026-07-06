# Golden Workbook

*The permanent visual specification for every CashCompass workbook.*

**Status:** Documentation only. This document defines a standard and a process; it authorizes no code changes. Implementation of visual parity is scheduled as **Stage 3 → D — Workbook Formatting & Visual Parity (P1)**, and its **first task is the Golden Workbook Audit** (see §8) — no styling code changes before that audit is complete.

---

## The core principle

> **The production workbook is the visual source of truth.**

CashCompass is built on a real Google Sheets workbook that the user owns and can open. That workbook is not an implementation detail — for many users it *is* the product surface they inspect and trust. The mature production workbook (the developer's long-lived, hand-tuned workbook) has, over months of manual refinement, arrived at a layout and styling that is clear, scannable, and trustworthy.

We now elevate that workbook to a named standard: **the Golden Workbook.** Every newly provisioned workbook should **converge toward the Golden Workbook** until a freshly provisioned workbook is *visually indistinguishable* from it.

When code and the Golden Workbook disagree, **the Golden Workbook wins** and the provisioning/styling code is what changes.

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

**No styling code changes until this audit is complete.** The audit produces the observed, screenshot-backed record of the Golden Workbook that `WORKBOOK_PARITY_CHECKLIST.md` needs to move sheets out of **UNKNOWN**.

The audit:
1. Captures the required screenshots of the production (Golden) workbook — see `WORKBOOK_PARITY_CHECKLIST.md → Validation — Required screenshots`.
2. Records the concrete attribute values per sheet (exact hex colors, column widths, row heights, freeze counts, number-format strings, border styles, conditional-format rules, notes, filters, tab order/colors).
3. Updates each sheet's row in `WORKBOOK_PARITY_CHECKLIST.md` from **UNKNOWN** to **COMPLETE / MINOR / MAJOR** based on the observed comparison against a freshly provisioned workbook.

Only after a sheet's row is resolved (no longer UNKNOWN) may a styling-convergence pass be written for that sheet.

## 9. Related documents

- **`WORKBOOK_PARITY_CHECKLIST.md`** — the engineering checklist: per-sheet status, gaps, effort, priority, and the required-screenshots list.
- **`GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`** — the earlier (2026-05-23) polish plan; **superseded** by this initiative for framing/status (parts are stale — e.g., Bank Accounts / Debts / Bills now have styling helpers). Retained for its additive-implementation strategy and non-goals.
- **`PROJECT_CONTEXT.md → Workbook styling`** — the current first-create styling contract in code.
- **`TODO.md → Product Maturity Stages → Stage 3 → D. Workbook Formatting & Visual Parity`** — roadmap home (P1).
- **`PRODUCT_VISION.md`** — why ownership and a trustworthy, polished workbook matter.
