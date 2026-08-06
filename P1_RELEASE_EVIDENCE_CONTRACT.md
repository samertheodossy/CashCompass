# P1 Automated Release Evidence Contract

**Status:** Active implementation contract
**Safety boundary:** Validator checks are read-only. Harness scenarios create only Central-owned disposable workbooks, require Restricted sharing, and use recoverable Trash cleanup. No release runner accepts a workbook ID for mutation.

## Operator identity and source convergence

- `samertheodossy@gmail.com` is the sole administrator and the only identity permitted to execute admin-gated release evidence.
- `cashcompass2026@gmail.com` remains a non-admin disposable test identity. It may exercise normal user/recovery behavior but must never be elevated for test convenience.
- `ADMIN_EMAILS` is immutable during testing. If the sole administrator is not authenticated, the run stops.
- Release evidence must support the same reviewed source in Central and bounded deployments. Safety comes from execution-context guards, explicit disposable targets, and preserved no-argument resolver behavior—not from leaving the bounded deployment indefinitely pinned to older code.

## Verdict

`READY` requires all of the following on the exact candidate:

1. Provisioning `PASS` and Schema compatibility other than `UPGRADE_REQUIRED`.
2. Every required suite registered, executed, and `PASS` with no missing or stale result.
3. Restricted sharing verified for every disposable fixture.
4. Requested cleanup verified through Drive read-back.
5. No open Severity 1 or Severity 2 issue.
6. Exact source version and deployment identity recorded.

Formula, Conditional Formatting, Named Range, and width drift are advisory during P1. They must be visible in Workbook Health and assigned before release; a ProductDecision may promote any advisory class to a release gate.

## Required suite inventory

Runnable foundation: Bills Regression, Recovery Regression, Quick Add Reliability, Populated Fixture, Central Safety, House Financial Accuracy, and Financial Integrity Canonical.

Required deeper evidence: First-Run UX E2E, Populated Dashboard E2E, Recovery Live, Performance Planner, and Bills Pay E2E. A suite is not considered implemented merely because its name is registered: it must invoke the real scoped workflow or an approved explicit-workbook seam and make functional assertions.

Financial Integrity Canonical is a gating server suite in Release Readiness. Its
shared scenario must prove the active-owned-position basis, property-financing
fail-closed behavior, live consumer/audit convergence, and immutable canonical
History capture/freshness on its own Restricted disposable workbook.

Current runtime status (2026-08-05): exact-owner Release Readiness run
`RR-18146129-6e3c-4389-8599-01cbb627b95d` bound source
`8aa4bf5bf58259598289d79368eea944e015d43e` to isolated Central `@318`.
Performance campaign `PERF-e75d61db-7f46-446b-a4cd-93c84e893a8a` completed
20/20 independent first/repeat pairs (40 Planner executions), with every fixture
Restricted and cleanup-verified. First p50/p95 was 12.890/16.773 s, repeat was
12.350/16.034 s, and combined was 12.600/16.773 s against the 30/60 s budgets.
The saved report records `releaseEligible: true`, `overall: PASS`,
`decision: ACCEPT`, and `budgetRatified: true`; Validation shows
`SUITE-PERFORMANCE-PLANNER` PASS/Verified. The owning run was then finalized and
correctly archived overall `NOT_READY` because this performance-only exercise did
not run First-Run, Populated Dashboard, Recovery Live, or the remaining required
server inventory. The disposable runner is OFF. This proves exact-owner evidence
and ratifies the Planner budget for `8aa4bf5` / `@318`; it does not waive missing
exact-candidate suites or make the full P1 verdict READY. Any later candidate
source/deployment change requires a fresh campaign at the frozen-candidate gate.
`TEST_PRODUCTION_PATH_AUDIT.md` records the real-code-first contract; `npm test`
rejects unreviewed direct-write test files.

## Bounded execution

- One scenario is executed per Apps Script invocation.
- Each scenario receives its own disposable workbook and run ID.
- Compact, privacy-safe evidence is saved after each chunk.
- Shared scenarios may satisfy more than one suite; they are executed once per release run.
- Finalization refuses `READY` when a required suite/scenario is absent, not run, failed, or stale.

## Saved evidence

Saved evidence contains only run IDs, candidate/deployment identifiers, suite/scenario IDs, timestamps, durations, verdicts, counts, compatibility, cleanup/sharing outcomes, and sanitized error text. It never stores balances, transaction descriptions, account names, workbook cell values, user email addresses, or permission identifiers.

### Browser evidence ownership

- A generic suite launch or direct browser-runner URL is always standalone,
  diagnostic-only evidence, even when an older Release Readiness run remains
  `IN_PROGRESS`.
- Only the browser-suite action rendered inside the active Release Readiness
  report may supply an owning release run id.
- The admin launcher validates that supplied id against the exact active run
  before opening the disposable-account runner.
- Campaign preparation captures that explicit owner and completion revalidates the
  same run and candidate. Missing, stale, replaced, finalized, or mismatched
  ownership saves `releaseEligible: false`, a null candidate, and no release run
  id. Diagnostic Performance evidence cannot ratify a release budget.

## Current limitation boundary

Browser rendering/navigation and account-specific Recovery adoption cannot be truthfully simulated by a workbook-only scenario. Accordingly, a browser pack is `NOT IMPLEMENTED` until its UI-driver or disposable-account execution seam exists and passes. All three required browser packs now meet that standard. The Release Readiness runner must still report any missing or stale browser evidence as `NOT READY`; it must never substitute static checks or the pure Recovery decision matrix for live E2E evidence.
