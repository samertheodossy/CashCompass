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

Runnable foundation: Bills Regression, Recovery Regression, Quick Add Reliability, Populated Fixture, and Central Safety.

Required deeper evidence: First-Run UX E2E, Populated Dashboard E2E, Recovery Live, Performance Planner, and Bills Pay E2E. A suite is not considered implemented merely because its name is registered: it must invoke the real scoped workflow or an approved explicit-workbook seam and make functional assertions.

Current runtime status (2026-07-21): First-Run UX E2E is implemented as authenticated external browser evidence. V2 run `FR-9c57ac53-0250-4ebb-a57a-cddec545356b` passed 9/9 on isolated Central `@129` in 85.864 s, including the whole-interface customer-language gate, Restricted owner-only sharing, real Refresh behavior, clean console/navigation, and verified Trash cleanup. Its privacy-safe V2 evidence is saved and no active fixture remains. Release Readiness refuses to treat the browser suite as an empty server scenario. Populated Dashboard E2E and Recovery Live remain missing and continue to force NOT READY.

## Bounded execution

- One scenario is executed per Apps Script invocation.
- Each scenario receives its own disposable workbook and run ID.
- Compact, privacy-safe evidence is saved after each chunk.
- Shared scenarios may satisfy more than one suite; they are executed once per release run.
- Finalization refuses `READY` when a required suite/scenario is absent, not run, failed, or stale.

## Saved evidence

Saved evidence contains only run IDs, candidate/deployment identifiers, suite/scenario IDs, timestamps, durations, verdicts, counts, compatibility, cleanup/sharing outcomes, and sanitized error text. It never stores balances, transaction descriptions, account names, workbook cell values, user email addresses, or permission identifiers.

## Current limitation boundary

Browser rendering/navigation and account-specific Recovery adoption cannot be truthfully simulated by a workbook-only scenario. Those packs remain `NOT IMPLEMENTED` until their UI-driver or disposable-account execution seam exists and passes. The Release Readiness runner must report that state as `NOT READY`; it must never substitute static checks or the pure Recovery decision matrix for live E2E evidence.
