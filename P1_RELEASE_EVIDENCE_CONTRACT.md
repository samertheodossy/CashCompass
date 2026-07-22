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

Current runtime status (2026-07-21): First-Run UX E2E V2 run `FR-9c57ac53-0250-4ebb-a57a-cddec545356b` passed 9/9 on isolated Central `@129`; Populated Dashboard E2E run `FR-19eb43ab-e8fe-4bc8-96a5-336afff43596` passed 11/11 on `@133`; and Recovery Live run `RL-12557aaa-5e18-4d67-a567-6304a5b57542` passed 9/9 on `@135` in 42.071 s. Recovery Live used the production confirmation, self-reconnect, stale/Trash-routing, and ambiguity seams; all three fixtures were Restricted and verified in Trash, no disposable mapping remained, no protected target matched, and the sole-admin configuration/mapping fingerprints were unchanged. Release Readiness refuses to treat any authenticated browser suite as an empty server scenario and now consumes all three saved PASS records. The permanent Performance Planner suite is available at isolated `@136`; its 20-pair campaign is paused after six confirmed pairs, so its p50/p95 budget evidence remains incomplete and unratified. `TEST_PRODUCTION_PATH_AUDIT.md` records the real-code-first contract; `npm test` rejects unreviewed direct-write test files. P1 remains NOT READY pending Release Readiness console controls, completion of performance-budget ratification, and the final bounded evidence run.

## Bounded execution

- One scenario is executed per Apps Script invocation.
- Each scenario receives its own disposable workbook and run ID.
- Compact, privacy-safe evidence is saved after each chunk.
- Shared scenarios may satisfy more than one suite; they are executed once per release run.
- Finalization refuses `READY` when a required suite/scenario is absent, not run, failed, or stale.

## Saved evidence

Saved evidence contains only run IDs, candidate/deployment identifiers, suite/scenario IDs, timestamps, durations, verdicts, counts, compatibility, cleanup/sharing outcomes, and sanitized error text. It never stores balances, transaction descriptions, account names, workbook cell values, user email addresses, or permission identifiers.

## Current limitation boundary

Browser rendering/navigation and account-specific Recovery adoption cannot be truthfully simulated by a workbook-only scenario. Accordingly, a browser pack is `NOT IMPLEMENTED` until its UI-driver or disposable-account execution seam exists and passes. All three required browser packs now meet that standard. The Release Readiness runner must still report any missing or stale browser evidence as `NOT READY`; it must never substitute static checks or the pure Recovery decision matrix for live E2E evidence.
