# House Financial Accuracy Plan

**Status:** V1 implementation and approved validation complete (2026-07-22).
Slices A–D are implemented; exact isolated Central `@145` suite run
`20260722-124210-bc23` passed 1/1 with 27/27 functional assertions, Restricted
sharing, CURRENT/FULLY_CURRENT schema, and verified Trash cleanup;
and, after creating a backup, the user completed an approved bounded rollout and
confirmed additive debt links plus reconciled Property Performance results. The
canonical fresh/evolved workbook contract is implemented in code. Manual Golden
workbook alignment remains a separately approval-gated parity task; no Harness run
targeted the bounded workbook and no Golden workbook was modified.

**Priority:** P2 — High; V1 milestone completed.

**Scope owner:** Properties + Debts + Property Performance.
**Planning decision date:** 2026-07-21.

> **Documentation only.** This plan authorizes no code change, workbook mutation,
> Apps Script push, deployment update, or Golden/Canonical workbook edit. Each
> implementation, runtime-test, and deployment action still requires the normal
> review and explicit approval gates.

## 1. Objective

Make property cash flow truthful without deleting, moving, or rewriting existing
financial data. The current Property Performance view calculates:

```text
Operating Net = Rent - HOUSES Expenses
```

It does not show the cash effect of mortgage, loan, or HELOC payments. The first
delivery slice will preserve that operating result and add financing separately:

```text
Net Cash Flow = Rent - Operating Expenses - Loan Payments
```

The user confirmed that the reviewed `HOUSES - <Property>` expense data contains
maintenance, repair, material, insurance, cleaning, and similar property expenses;
loan payments are not currently included. The implementation must nevertheless
retain a permanent no-double-counting guard for future data.

## 2. Ratified product decisions

1. **Additive schema only.** Append `Linked Property` as the final column of
   `INPUT - Debts`. Never insert it between existing columns, reorder existing
   headers, move rows, or rewrite populated cells.
2. **Golden/new-workbook parity.** The Golden/Canonical workbook and every newly
   provisioned workbook must contain `Linked Property` at the same final position,
   with matching header/body styling, width, note, and validation behavior.
3. **Backward compatibility.** Existing workbooks append the column only when it
   is missing. Existing debt rows default to blank and remain otherwise unchanged.
4. **Explicit links only.** CashCompass never guesses a property from a debt or
   payee name. Users select an active property; blank means unlinked.
5. **Debt-owned relationship.** The link belongs on each Loan/HELOC row in
   `INPUT - Debts`. This allows one property to have multiple linked loans without
   duplicating payment data on `SYS - House Assets` or a `HOUSES -` sheet.
6. **Actual annual cash movement.** For the selected year, loan payments come from
   the linked debt account's existing Cash Flow payment row(s). Do not manufacture
   annual payments from `Minimum Payment x 12` and do not infer principal.
7. **No automatic balance reduction.** `Loan Amount Left` remains the balance used
   for property equity. A payment may contain interest, escrow, fees, and principal,
   so Property Performance must not subtract the full payment from the balance.
8. **Preserve the current calculation.** The existing operating result remains in
   the payload for reconciliation and future analytics, but is not repeated as a
   visible card or table column. `Net Cash Flow` is the primary after-financing
   result.
9. **Single operator surface for tests.** New automated scenarios must be exposed
   through the existing Validation & Testing console, not through a new standalone
   operator page.

## 3. User-visible result

### Property table

Target columns:

| House | Type | Value | Loan Balance | Equity | Rent | Operating Expenses | Loan Payments | Net Cash Flow |
|---|---|---:|---:|---:|---:|---:|---:|---:|

Calculations:

- `Equity = Value - Loan Balance` *(unchanged)*
- `Operating Net = Rent - Operating Expenses` *(retained internally)*
- `Loan Payments = sum of actual selected-year Cash Flow payments for active linked Loan/HELOC accounts`
- `Net Cash Flow = Operating Net - Loan Payments`

### Portfolio summary

Preserve the existing values and expose five traceable totals:

1. Portfolio equity
2. Rent (year)
3. Operating expenses (year)
4. Loan payments (year)
5. Net cash flow

If a linked loan has no matching selected-year Cash Flow row or payments, show
`$0.00` plus calm guidance such as `No loan payments recorded for this year`.
Never substitute a guessed payment.

## 4. Data contract

### `INPUT - Debts`

- New header: `Linked Property`
- Position: final column, after every current column including `Active`
- Default: blank
- Allowed debt types: `Loan` and `HELOC`
- Allowed values: active house names from `SYS - House Assets`
- Unrelated debt types: blank; Manage Debts should hide or disable the field
- Reserved `TOTAL DEBT` row: always blank and never used as a link source
- Reader/writer rule: locate by normalized header name, never fixed index

### Validation behavior

- Use an active-house dropdown in the managed UI and sheet validation.
- Permit blank.
- Reject a new nonblank link for non-Loan/HELOC debt types.
- If a previously linked house or debt becomes inactive, retain the historical
  cell value but exclude it from current Property Performance and surface a calm
  advisory rather than deleting the link.
- Multiple active Loan/HELOC rows may link to the same property and are summed.

### Cash Flow attribution

- Match a linked debt by its exact canonical `Account Name`, using existing
  normalized debt-payee matching helpers where possible.
- Sum the selected year's payment values from `INPUT - Cash Flow <year>`.
- Reuse production readers/helpers; do not create a Harness-only calculation path.
- Detect and deduplicate duplicate matches fail-closed. An ambiguous match produces
  an advisory and no guessed amount.

## 5. Golden/Canonical and schema evolution

The schema change must be implemented as one coordinated contract:

1. Add the final-column requirement to the formal schema registry.
2. Include the header on fresh `INPUT - Debts` creation.
3. Add an idempotent `ensure` path for existing workbooks.
4. Style only the newly appended column, copying the adjacent canonical column's
   header/body presentation while applying an intentional width/note/validation.
5. Never restyle or resize the rest of a populated debt sheet.
6. Update the Golden/Canonical workbook to the same final-column contract only in
   the separately approved Golden-alignment step.
7. Update Golden comparison/Validator expectations so fresh, evolved, and Golden
   workbooks agree on header, order, presentation, and validation.

Compatibility rule:

- Legacy workbook without the column: supported and safely evolved.
- Current workbook with the column: idempotent no-op.
- Duplicate/misplaced header: Validator failure or advisory requiring review;
  never automatically reorder or delete columns.

## 6. Implementation slices

### Slice A — Read-only audit and specification confirmation

**Status: COMPLETE (2026-07-22).** Debt consumers are header-driven; the
existing Cash Flow debt-payment reader can be reused; and legacy evolution must
establish `Active` before appending `Linked Property`.

- Inventory all production readers/writers of `INPUT - Debts`.
- Confirm each locates columns by header or update it before schema evolution.
- Inspect current Cash Flow debt-payment attribution and exact matching rules.
- Confirm no loan payments exist in the in-scope `HOUSES -` expense data.
- Capture before-state Property Performance values for bounded comparison.

**Exit:** affected-file map, confirmed payment source, and no unresolved fixed-index
or double-counting risk.

### Slice B — Schema and managed linking

**Status: COMPLETE + RUNTIME VALIDATED (2026-07-22).** The current code adds the
canonical trailing header, safe writer-triggered evolution, Loan/HELOC-only managed
linking, Validator/Schema Evolution rules, and the
`SUITE-HOUSE-FINANCIAL-ACCURACY` disposable regression pack. The isolated suite and
approved bounded comparison passed; manual Golden alignment remains a separate
approval-gated parity task.

- Append `Linked Property` safely for existing workbooks.
- Include it on first-create/new workbooks.
- Update the formal schema registry and Golden expectations.
- Add the field to Manage Debts add/edit for Loan/HELOC accounts.
- Preserve link values during all unrelated debt updates and renames.
- Keep Activity logging privacy-safe; record that a link changed without copying
  unrelated financial data.

**Exit:** legacy and fresh disposable workbooks pass schema, formatting, formula,
and data-preservation checks.

### Slice C — Shared financing calculation

**Status: COMPLETE + RUNTIME VALIDATED (2026-07-22).** The explicit-spreadsheet
production helper aggregates actual selected-year Cash Flow payments for active
linked Loan/HELOC debts and fails closed on duplicate debt names or matching
payment rows. Permanent disposable assertions cover both ambiguity guards.

- Add one production house-financing helper that accepts an explicit spreadsheet
  and year.
- Resolve active linked loans, read actual Cash Flow payments, and aggregate per
  property plus portfolio.
- Add ambiguity, inactive-link, missing-year, and missing-payment advisories.
- Keep property loan balance/equity calculations unchanged.

**Exit:** deterministic calculation tests and no duplicate implementation.

### Slice D — Property Performance presentation

**Status: IMPLEMENTED; ISOLATED SUITE + USER-APPROVED BOUNDED VALIDATION PASS
(2026-07-22).**
The existing operating result remains available under both legacy payload aliases
and the new explicit names. The UI adds Loan Payments and Net Cash Flow without
changing equity, rent, or operating-expense sources; the redundant Operating Net
card and column were removed after user review to keep the screen focused.

- Extend the existing payload without removing current fields during transition.
- Rename visible `Expenses` to `Operating Expenses`; retain the former `Net`
  calculation internally for compatibility and reconciliation.
- Add `Loan Payments` and `Net Cash Flow` columns.
- Present the five decision-useful portfolio cards and omit redundant Operating Net.
- Update loading/empty/error colspan values and responsive table behavior.

**Exit:** blank, legacy, populated, multiple-loan, and no-payment states render
calmly and reconcile to the shared helper.

### Slice E — Broader house-model reconciliation

**Status: DEFERRED FOLLOW-UP.** V1 intentionally keeps the new shared financing
helper scoped to Property Performance and the existing Cash Flow source. Broader
principal/interest, escrow, refinancing, Planner, or additional house-model
adoption requires a separately approved financial-model milestone.

- After Slice D is accepted, audit Property Performance, House Values, House
  Expenses, Planner, Cash Flow, and rolling debt logic against the shared model.
- Adopt the helper only where the financial meaning matches; do not expand scope
  through opportunistic rewrites.
- Record any principal/interest, escrow, refinancing, or multiple-loan enhancements
  as separate decisions unless required for correctness.

**Exit:** Validator proves all in-scope property totals reconcile without changing
unrelated planner or debt behavior.

## 7. Regression and validation plan

All writer tests use Restricted disposable workbooks and verified Trash cleanup.
The bounded workbook is never an automated writer target.

Required automated scenarios:

1. Fresh workbook creates `Linked Property` as the final debt column.
2. Legacy workbook without the column appends it once without moving data.
3. Repeat ensure is an idempotent no-op.
4. Existing debt values, formulas, formats, widths, and `TOTAL DEBT` remain intact.
5. Golden/new/legacy-evolved schemas reconcile.
6. Blank link leaves all current Property Performance values unchanged.
7. One linked loan produces the correct selected-year payment and net cash flow.
8. Multiple linked loans for one property sum correctly.
9. Loan linked to one property never leaks into another property's result.
10. Credit Card or unrelated debt cannot receive a new property link.
11. Inactive debt and inactive property are excluded without deleting history.
12. Missing Cash Flow year/payment renders `$0.00` plus guidance, not an estimate.
13. Ambiguous duplicate Cash Flow match fails closed and does not double-count.
14. Operating Expenses never include the new financing total.
15. Portfolio totals equal the sum of visible property rows to the cent.
16. Existing dashboard, planner, Bills, Quick Add, debt management, and Workbook
    Health suites remain green.

Bounded validation, only after disposable evidence and explicit approval:

1. Create/confirm a workbook backup.
2. Capture the current six property rows and four existing portfolio totals.
3. Push the reviewed shared source to the bounded Apps Script project; do not run
   the Test Harness against the bounded workbook.
4. Confirm `Linked Property` appears once at the final column and nothing moved.
5. Link one loan at a time through Manage Debts.
6. Compare Operating Expenses to the captured baseline and reconcile the retained
   operating result as `Net Cash Flow + Loan Payments`; both must remain identical.
7. Compare Loan Payments to the selected-year Cash Flow source rows.
8. Confirm Net Cash Flow reconciles exactly.
9. Verify unrelated dashboard pages and debt workflows remain unchanged.

## 8. Safety and rollback

- No row deletion, column deletion, header rewrite, sheet rename, broad formatting
  wash, or historical Cash Flow rewrite.
- No automatic link inference.
- No automated mutation of the bounded or Golden workbook.
- No change to `ADMIN_EMAILS`, mappings, recovery flags, or deployment pinning.
- No Beta deployment update during development.
- Code rollback is a normal commit revert. The appended final column can remain:
  older code ignores unknown trailing columns, and preserving user-entered links is
  safer than deleting the column.
- A detected reconciliation error blocks commit/deploy readiness; it never triggers
  an automatic data repair.

## 9. Acceptance criteria

The milestone is complete only when:

- `Linked Property` is the final `INPUT - Debts` column in Golden, fresh, and safely
  evolved legacy workbooks.
- Existing debt and property data is preserved.
- Property Performance retains the exact prior Operating Expenses and internal
  Operating Net values when no financing is linked.
- Linked actual payments reconcile to Cash Flow and the after-financing totals sum
  to the cent.
- Multiple loans, missing payments, inactive records, and ambiguous matches behave
  safely and understandably.
- Workbook Health and all affected regression suites pass through the consolidated
  Validation console.
- Disposable validation passes before any bounded rollout.
- Bounded comparison passes under a user-created backup and explicit approval.
- Documentation, roadmap, Golden checklist, and Release Readiness inventory are
  synchronized before commit and push.

## 10. Closeout and next milestone

House Financial Accuracy V1 is complete after the final disposable ambiguity
coverage, documentation synchronization, and commit-readiness review. Resume P3
finished-feeling UX work next; keep the exact-candidate Performance percentile
campaign explicitly parked until it is restarted before broad Beta release.
