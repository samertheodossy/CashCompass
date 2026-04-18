# ONBOARDING & INPUT STRATEGY

## Purpose

Define how users (including non-technical users like family members) will:
- get started with the system
- add their financial data
- progressively improve accuracy over time

This document ensures we build onboarding and data entry without breaking the existing Sheets-based system.

---

## Core Principle

Build each data entry flow ONCE in its natural location, then reuse it everywhere.

- No duplicate forms
- No onboarding-specific data entry UIs
- No logic divergence

---

## System Model

The system is structured in 3 layers:

### 1. Input Layer (user data entry)
- Bank Accounts
- Debts
- Bills (recurring)
- Upcoming (one-time)

### 2. Decision Layer
- Rolling Debt Payoff
- HELOC strategy
- Cash-to-use calculation

### 3. Guidance Layer
- Onboarding (first-time)
- "Why not more?"
- "What would change this?"
- Navigation (View / Add payment)

---

## Canonical Input Locations

Each data type must have ONE home.

- Bank Accounts → Assets → Bank Accounts
- Investments → Assets → Investments
- Houses → Assets → House Values
- Debts → Debts page
- Bills → Cash Flow → Bills Due
- Upcoming → Cash Flow → Upcoming

---

## Workbook Initialization & Validation

The workbook should start from a structured template, even if user data is initially empty.

- Each user operates on a single Google Sheet workbook as the source of truth.
- The system assumes a consistent workbook structure across required tabs and columns.
- Onboarding should help users get started without changing the existing architecture.

Guidelines:
- Prefer starting from a structured workbook/template rather than a totally blank spreadsheet.
- The app should detect missing critical data and missing required workbook structure separately.
- Missing data should trigger onboarding guidance.
- Missing required structure should trigger validation / repair guidance.
- The planner should only be expected to work correctly when the workbook is structurally valid.
- Future improvements may include a lightweight “scan and repair workbook” flow.

### First-run requirement

- The onboarding path should leave the user with a workbook that can support a valid first planner run.
- The goal is not perfect setup; the goal is a structurally valid workbook plus enough seed data to produce meaningful output.

---

## Implementation Pattern (for all inputs)

For each page:

1. Add entry point:
   [+ Add X]

2. Add form (inline or modal):
   minimal required fields only

3. Save:
   write to Sheets
   refresh UI

4. Reuse:
   onboarding points here
   overview points here
   planner consumes data

---

## Onboarding Strategy

DO NOT:
- build a full wizard
- force setup before usage
- duplicate forms

DO:
- show a Welcome / Start screen
- guide users to existing pages

---

## First-Time Experience

When the workbook is structurally valid but has no user data yet:

Welcome to CashCompass

To get started:

[Add accounts]
[Add debts]
[Add bills]
[Add upcoming expenses] (optional)

[Continue to dashboard]

---

## Detection Logic

Assumes the workbook is already structurally valid (structure issues are handled by validation / repair guidance, not onboarding).

Show onboarding if:

- no accounts OR
- no debts OR
- no bills

---

## After onboarding

System shifts to:

- dashboard-driven usage
- contextual prompts
- progressive improvement

---

## Progressive Data Improvement

Instead of forcing perfect setup:

System should guide users in context.

Examples:

- You haven’t added any upcoming expenses
- This expense is not mapped to a debt
- Card spending estimate is low confidence

Each should include:
- explanation
- action link

---

## Priority Implementation Order

### Tier 1 (next)
1. Bills UI (critical missing input)
2. Debts UI (if not already smooth)
3. Improve Upcoming UX (if needed)

### Tier 2
4. Investments input
5. Houses input

---

## Design Rules

- Keep Standard mode simple
- Do not expose unfinished strategies (Aggressive stays hidden)
- Do not duplicate data views
- Always navigate to source-of-truth pages
- React = presentation/navigation only (no direct writes)
- Backend = logic source
- Add logic backend-first → map → render

---

## Execution Flow Pattern

From planner:

- View → navigate to source data
- Add payment → Quick Add with prefill
- Add bill → Bills page

---

## Key Insight

You are building:

A financial system that becomes more accurate as the user adds data

NOT:

A system that requires perfect setup to start

---

## Current Status

- Bank Accounts → implemented
- Planner → complete and polished
- Payment execution → working
- Navigation → consistent

Remaining critical gap:
- Bills input (recurring expenses)

---

## Next Session Starting Point

Implement Bills input flow in Bills Due page

Then:
- connect onboarding → Bills
- connect Overview → Bills
- ensure planner uses it cleanly

---

## Working Method

- Implement one feature at a time
- Test in UI
- Lock before moving on
- Do not refactor broadly while adding features

---

## Future Updates / Upgrade Strategy

### Central app updates

- UI, navigation, wording, planner logic, and backend behavior should be updated centrally through the Apps Script project and web app deployment whenever possible.
- If a change only affects app logic or presentation and uses existing workbook data, users should receive the update without needing to modify their sheets manually.
- React/UI changes require rebuilding the bundled dashboard artifact before deployment so the live app reflects the latest code.

### Workbook structure updates

- Some future features may require workbook/schema changes, such as:
  - new tabs
  - new columns
  - new formulas
  - new config/storage locations
- Those changes cannot be assumed to exist in older user workbook copies.
- Any feature that depends on workbook structure changes must include a migration plan.

### Preferred design rule

- Prefer backward-compatible changes whenever possible.
- The app should gracefully handle missing newer workbook fields/tabs instead of breaking.
- New features should hide or degrade cleanly when required workbook structure is not yet present.

### Long-term upgrade strategy

- Add a workbook version marker in the future (for example in a SYS / Meta sheet, named range, or script property).
- The app should eventually be able to detect workbook version and compare it to the minimum required version for newer features.
- When a workbook is outdated, the system should guide the user through a safe upgrade path rather than requiring manual sheet edits.

### Migration expectations

- Do not rely on users to manually alter workbook structure.
- If workbook upgrades become necessary, they should be handled through a controlled migration helper or scripted upgrade process.
- Each future schema-level feature should document:
  - what changed
  - whether it is backward-compatible
  - whether migration is required

End of document.
