# CashCompass Change Flow

Use this flow for non-trivial CashCompass changes.

## Flow

1. Planner
2. Engineer
3. Reviewer
4. Tester
5. Validator

## Planner Phase

Purpose:
- Understand the task and discover relevant documentation.
- Identify affected features, files, sheets, workflows, and user data paths.
- Identify existing validator, regression, and test harness coverage.
- Identify risks, assumptions, and open questions.
- Propose the smallest safe implementation plan.

Output:
- Task summary
- Relevant docs reviewed
- Affected areas
- Existing coverage to reuse
- Proposed plan
- Risks / assumptions / open questions

## Engineer Phase

Purpose:
- Understand the issue.
- Identify affected files and docs.
- Find root cause before editing.
- Propose the smallest safe fix.
- Implement only approved scope.

Output:
- Root cause
- Proposed fix
- Files changed
- Known risks
- Test notes

## Reviewer Phase

Purpose:
- Review the diff, not the intent.
- Challenge assumptions.
- Look for regressions, data loss, formatting drift, schema risk, and Central/bounded behavior changes.
- Identify must-fix issues before testing.

Output:
- Must-fix issues
- Should-fix issues
- Questions
- Safe-to-test assessment

## Tester Phase

Purpose:
- Convert the change into executable manual or automated test coverage.
- Cover Central and bounded behavior when relevant.
- Include regression and edge cases.

Output:
- Test matrix
- Manual test steps
- Automated test candidates
- Pass/fail criteria

## Validator Phase

Purpose:
- Decide commit, push, and deploy readiness separately.
- Confirm safety rules were followed.
- Confirm docs, tests, rollback notes, and deployment risk are understood.

Output:
- Commit readiness
- Push readiness
- Deploy readiness
- Remaining risks
- Required follow-ups

## Phase Status Routing

Every phase must report `COMPLETE`, `BLOCKED`, or `NEEDS_USER_DECISION`. Follow the routing rules in `agents/orchestrator.md`; do not advance a blocked phase or infer a user decision.

## Hard Rule

Do not skip directly from Engineer to commit, push, or deploy. Each action requires its own explicit approval under `agents/orchestrator.md`.
