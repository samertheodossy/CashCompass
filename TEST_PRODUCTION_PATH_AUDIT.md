# Test Production-Path Audit

## Policy

CashCompass tests use production code by default. Test-only code may create a
deterministic disposable fixture or deliberately corrupt a value when that state
cannot be reached safely through the product, but it must not reimplement the
behavior being validated.

Every workbook writer must receive the already verified disposable spreadsheet
explicitly. A test must never resolve a bounded, mapped, configured-default, or
canonical workbook for a write.

## Current coverage

| Test area | Production path exercised | Test-only work that remains |
|---|---|---|
| Harness lifecycle | Restricted-sharing inspection, marker verification, validators, verified Drive Trash read-back | Create and identify the disposable workbook |
| Donation smoke | `runMinimalBootstrap_` and the real `addDonation` writer | Synthetic donation values |
| Bills recurrence | `buildInputBillDueCandidates_` recurrence engine | Deterministic dates and expected occurrences |
| Bills integration | Production schema/styling/activity helpers and Cash Flow builder | Explicit Bills fixture rows because the public writer resolves the signed-in user's workbook |
| Recovery regression | `decideRecoveryCandidateAction_` | Synthetic candidate sets; this is not a substitute for Recovery Live |
| Quick Add reliability | Production inspect/restore compare-and-set seams | Direct late-edit values needed to create MATCH/RESTORE_REFUSED states |
| Representative fixture | Production creators, year-block insertion helpers, formulas, styling, Cash Flow row builder, and Activity creator | Direct synthetic Bills, Upcoming, SYS mirrors, and retirement inputs used only to establish state |
| Performance Planner | Real `runDebtPlanner` twice with explicit disposable spreadsheet and suppressed email | Timing capture |
| Bills Pay E2E | Real `quickAddPayment` and `markDashboardBillOccurrencePaid` | Representative bill fixture |
| First-Run UX E2E | Real Central `provisionWorkbookForUser_`, product dashboard, real planner refresh, verified cleanup | Browser assertions and synthetic identity |
| Populated Dashboard E2E | Real Central provisioning, product renderers/navigation/load-and-select helpers, real planner refresh, verified cleanup | Representative fixture setup and browser assertions |
| Workbook Health | Real aggregate read-only validator modules | Representative fixture setup |

## Reviewed direct-write exceptions

- `test_harness_core.js`: writes only disposable identity markers.
- `test_harness_data.js`: constructs deterministic fixture state after every
  write is gated; production creators, insertion helpers, formulas, and styling
  are reused wherever an explicit-spreadsheet seam exists.
- `test_harness_scenarios_bills.js`: creates controlled Bills rows for recurrence,
  schema, and Cash Flow integration cases while calling the production engine.
- `test_harness_scenarios_quick_add.js`: deliberately changes one Cash Flow cell
  to reproduce late-edit and compare-and-set states.

`scripts/checkTestProductionPaths.mjs` enforces this inventory. A new test file
with direct workbook writes fails the local regression suite until its design is
reviewed and this audit is updated.

## Follow-up rule

When a production writer gains an explicit disposable-workbook seam, replace the
corresponding fixture-only row writer. Do not maintain two implementations of
the same behavior. Recovery Live remains the only planned pack that cannot be
substituted by a pure or synthetic test.
